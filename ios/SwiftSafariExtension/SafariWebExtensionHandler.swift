import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let logger = Logger(subsystem: "com.swift.app.extension", category: "handler")

    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any]

        guard let action = message?["action"] as? String else {
            context.completeRequest(returningItems: nil)
            return
        }

        logger.info("Received action: \(action)")

        var response: [String: Any] = [:]

        switch action {
        case "getConfig":
            response = loadGestureConfig()
        case "getSubscriptionStatus":
            response = buildSubscriptionResponse()
        case "purchase":
            response = ["url": "swiftgesture://subscribe"]
        default:
            response = ["error": "Unknown action"]
        }

        let responseItem = NSExtensionItem()
        responseItem.userInfo = [SFExtensionMessageKey: response]
        context.completeRequest(returningItems: [responseItem])
    }

    private func loadGestureConfig() -> [String: Any] {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        guard let data = defaults?.data(forKey: AppGroupConstants.gestureConfigKey),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return ["status": "default"]
        }
        return config
    }

    /// ShieldMail 패턴: App Groups에서 구독 상태 읽기
    private func buildSubscriptionResponse() -> [String: Any] {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        let isActive = defaults?.bool(forKey: AppGroupConstants.subscriptionActiveKey) ?? false
        let expiryTimestamp = defaults?.double(forKey: AppGroupConstants.subscriptionExpiryKey) ?? 0
        let jws = defaults?.string(forKey: AppGroupConstants.jwsKey)
        let productId = defaults?.string(forKey: AppGroupConstants.productIdKey)

        let now = Date().timeIntervalSince1970

        return [
            "tier": isActive ? "pro" : "free",
            "isActive": isActive && (expiryTimestamp == 0 || expiryTimestamp > now),
            "expiresDate": expiryTimestamp,
            "jws": jws ?? NSNull(),
            "productId": productId ?? NSNull(),
        ]
    }
}
