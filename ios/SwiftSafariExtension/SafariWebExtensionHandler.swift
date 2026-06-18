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
        default:
            response = ["error": "Unknown action"]
        }

        let responseItem = NSExtensionItem()
        responseItem.userInfo = [SFExtensionMessageKey: response]
        context.completeRequest(returningItems: [responseItem], completionHandler: nil)
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
}
