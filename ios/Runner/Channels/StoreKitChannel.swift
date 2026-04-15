import Flutter
import StoreKit

class StoreKitChannel {
    static let channelName = "com.swift.app/storekit"

    static func register(with messenger: FlutterBinaryMessenger) {
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler { call, result in
            Task { @MainActor in
                switch call.method {
                case "fetchProducts":
                    await fetchProducts(result: result)
                case "purchase":
                    guard let args = call.arguments as? [String: Any],
                          let productId = args["productId"] as? String else {
                        result(FlutterError(code: "INVALID_ARGS", message: "Missing productId", details: nil))
                        return
                    }
                    await purchase(productId: productId, result: result)
                case "getSubscriptionStatus":
                    await getSubscriptionStatus(result: result)
                case "restorePurchases":
                    await restorePurchases(result: result)
                default:
                    result(FlutterMethodNotImplemented)
                }
            }
        }
    }

    private static func fetchProducts(result: @escaping FlutterResult) async {
        do {
            let products = try await Product.products(for: ["com.swift.app.monthly"])
            let mapped = products.map { product -> [String: Any] in
                return [
                    "id": product.id,
                    "displayName": product.displayName,
                    "displayPrice": product.displayPrice,
                    "price": "\(product.price)",
                ]
            }
            result(mapped)
        } catch {
            result(FlutterError(code: "FETCH_ERROR", message: error.localizedDescription, details: nil))
        }
    }

    private static func purchase(productId: String, result: @escaping FlutterResult) async {
        do {
            let products = try await Product.products(for: [productId])
            guard let product = products.first else {
                result(false)
                return
            }
            let purchaseResult = try await product.purchase()
            switch purchaseResult {
            case .success(let verification):
                let transaction = try verification.payloadValue
                await transaction.finish()
                syncSubscriptionStatus(isActive: true)
                result(true)
            case .userCancelled, .pending:
                result(false)
            @unknown default:
                result(false)
            }
        } catch {
            result(FlutterError(code: "PURCHASE_ERROR", message: error.localizedDescription, details: nil))
        }
    }

    private static func getSubscriptionStatus(result: @escaping FlutterResult) async {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        let isActive = defaults?.bool(forKey: AppGroupConstants.subscriptionActiveKey) ?? false
        result([
            "isActive": isActive,
        ])
    }

    private static func restorePurchases(result: @escaping FlutterResult) async {
        do {
            try await AppStore.sync()
            result(true)
        } catch {
            result(false)
        }
    }

    private static func syncSubscriptionStatus(isActive: Bool) {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        defaults?.set(isActive, forKey: AppGroupConstants.subscriptionActiveKey)
        defaults?.set(Date().timeIntervalSince1970, forKey: AppGroupConstants.lastVerifiedKey)
        if isActive {
            // Set expiry to 30 days from now as estimate
            defaults?.set(Date().timeIntervalSince1970 + 30 * 86400, forKey: AppGroupConstants.subscriptionExpiryKey)
        }
        defaults?.synchronize()
    }
}
