import Flutter
import StoreKit

/// ShieldMail 패턴: StoreKit 2 + App Groups + Transaction Listener
@MainActor
class StoreKitChannel {
    static let channelName = "com.swift.app/storekit"
    static let productId = "com.swift.app.monthly"

    private static var product: Product?
    private static var updateListenerTask: Task<Void, Never>?

    static func register(with messenger: FlutterBinaryMessenger) {
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler { call, result in
            Task { @MainActor in
                switch call.method {
                case "loadProducts":
                    await loadProducts(result: result)
                case "purchase":
                    await purchase(result: result)
                case "restore":
                    await restore(result: result)
                case "checkEntitlements":
                    await checkEntitlements(result: result)
                case "getSubscriptionStatus":
                    getSubscriptionStatus(result: result)
                case "showManageSubscriptions":
                    showManageSubscriptions(result: result)
                default:
                    result(FlutterMethodNotImplemented)
                }
            }
        }

        // 앱 시작 시 자동으로 구독 상태 확인 + 리스너 시작
        Task {
            await loadProductsSilent()
            await checkEntitlementsSilent()
            listenForUpdates()
        }
    }

    // ── Products ─────────────────────────────────────────────
    private static func loadProducts(result: @escaping FlutterResult) async {
        do {
            let products = try await Product.products(for: [productId])
            product = products.first
            if let p = product {
                result([
                    "id": p.id,
                    "displayName": p.displayName,
                    "displayPrice": p.displayPrice,
                    "price": "\(p.price)",
                ])
            } else {
                result(FlutterError(code: "NO_PRODUCT", message: "상품 정보를 불러올 수 없습니다", details: nil))
            }
        } catch {
            result(FlutterError(code: "FETCH_ERROR", message: error.localizedDescription, details: nil))
        }
    }

    private static func loadProductsSilent() async {
        do {
            let products = try await Product.products(for: [productId])
            product = products.first
        } catch {}
    }

    // ── Purchase ─────────────────────────────────────────────
    private static func purchase(result: @escaping FlutterResult) async {
        guard let product = product else {
            result(FlutterError(code: "NO_PRODUCT", message: "상품 정보가 없습니다", details: nil))
            return
        }

        do {
            let purchaseResult = try await product.purchase()
            switch purchaseResult {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await handleTransaction(transaction)
                await transaction.finish()
                result(["success": true, "tier": "pro"])
            case .userCancelled:
                result(["success": false, "reason": "cancelled"])
            case .pending:
                result(["success": false, "reason": "pending"])
            @unknown default:
                result(["success": false, "reason": "unknown"])
            }
        } catch {
            result(FlutterError(code: "PURCHASE_ERROR", message: error.localizedDescription, details: nil))
        }
    }

    // ── Restore ──────────────────────────────────────────────
    private static func restore(result: @escaping FlutterResult) async {
        do {
            try await AppStore.sync()
            await checkEntitlementsSilent()
            let tier = getTier()
            result(["success": true, "tier": tier])
        } catch {
            result(FlutterError(code: "RESTORE_ERROR", message: error.localizedDescription, details: nil))
        }
    }

    // ── Entitlements ─────────────────────────────────────────
    private static func checkEntitlements(result: @escaping FlutterResult) async {
        await checkEntitlementsSilent()
        result(["tier": getTier()])
    }

    private static func checkEntitlementsSilent() async {
        var foundActive = false

        for await verification in Transaction.currentEntitlements {
            guard let transaction = try? checkVerified(verification) else { continue }

            if transaction.productID == productId && transaction.revocationDate == nil {
                foundActive = true
                await handleTransaction(transaction)
            }
        }

        if !foundActive {
            persistToAppGroup(tier: "free", jws: nil, expires: nil, productId: nil)
        }
    }

    // ── Transaction Listener (ShieldMail 패턴) ──────────────
    private static func listenForUpdates() {
        updateListenerTask?.cancel()
        updateListenerTask = Task.detached {
            for await result in Transaction.updates {
                guard let transaction = try? await checkVerified(result) else { continue }

                if transaction.revocationDate != nil {
                    await MainActor.run {
                        persistToAppGroup(tier: "free", jws: nil, expires: nil, productId: nil)
                    }
                } else {
                    await MainActor.run {
                        Task { await handleTransaction(transaction) }
                    }
                }

                await transaction.finish()
            }
        }
    }

    // ── Status Query ─────────────────────────────────────────
    private static func getSubscriptionStatus(result: @escaping FlutterResult) {
        let tier = getTier()
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        result([
            "tier": tier,
            "isActive": tier == "pro",
            "expiresDate": defaults?.double(forKey: AppGroupConstants.subscriptionExpiryKey) ?? 0,
        ])
    }

    private static func showManageSubscriptions(result: @escaping FlutterResult) {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            Task {
                try? await AppStore.showManageSubscriptions(in: scene)
            }
        }
        result(nil)
    }

    // ── Helpers ──────────────────────────────────────────────
    private static func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let value):
            return value
        }
    }

    private static func handleTransaction(_ transaction: Transaction) async {
        let jwsData = transaction.jsonRepresentation
        let jws = jwsData.base64EncodedString()
        let expires = transaction.expirationDate?.timeIntervalSince1970

        persistToAppGroup(
            tier: "pro",
            jws: jws,
            expires: expires,
            productId: transaction.productID
        )
    }

    private static func persistToAppGroup(tier: String, jws: String?, expires: Double?, productId: String?) {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        defaults?.set(tier == "pro", forKey: AppGroupConstants.subscriptionActiveKey)
        defaults?.set(Date().timeIntervalSince1970, forKey: AppGroupConstants.lastVerifiedKey)

        if let expires = expires {
            defaults?.set(expires, forKey: AppGroupConstants.subscriptionExpiryKey)
        }
        if let jws = jws {
            defaults?.set(jws, forKey: AppGroupConstants.jwsKey)
        }
        if let productId = productId {
            defaults?.set(productId, forKey: AppGroupConstants.productIdKey)
        }

        defaults?.synchronize()
    }

    private static func getTier() -> String {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        let isActive = defaults?.bool(forKey: AppGroupConstants.subscriptionActiveKey) ?? false
        return isActive ? "pro" : "free"
    }
}
