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
            response = getSubscriptionStatus()
        case "getSettingsVersion":
            response = getSettingsVersion()
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

    private func getSubscriptionStatus() -> [String: Any] {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        let isActive = defaults?.bool(forKey: AppGroupConstants.subscriptionActiveKey) ?? false
        let expiryTimestamp = defaults?.double(forKey: AppGroupConstants.subscriptionExpiryKey) ?? 0
        let lastVerified = defaults?.double(forKey: AppGroupConstants.lastVerifiedKey) ?? 0

        let now = Date().timeIntervalSince1970
        let needsRecheck = now - lastVerified > 7 * 86400

        return [
            "isActive": isActive && (expiryTimestamp == 0 || expiryTimestamp > now),
            "needsRecheck": needsRecheck,
            "expiryTimestamp": expiryTimestamp,
        ]
    }

    private func getSettingsVersion() -> [String: Any] {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        let version = defaults?.integer(forKey: AppGroupConstants.settingsVersionKey) ?? 0
        return ["version": version]
    }
}
