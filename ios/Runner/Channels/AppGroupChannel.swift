import Flutter

class AppGroupChannel {
    static let channelName = "com.swift.app/appgroup"

    static func register(with messenger: FlutterBinaryMessenger) {
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler { call, result in
            switch call.method {
            case "saveConfig":
                guard let config = call.arguments as? [String: Any] else {
                    result(FlutterError(code: "INVALID_ARGS", message: "Missing config", details: nil))
                    return
                }
                saveConfig(config)
                result(true)
            case "loadConfig":
                result(loadConfig())
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }

    private static func saveConfig(_ config: [String: Any]) {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        if let data = try? JSONSerialization.data(withJSONObject: config) {
            defaults?.set(data, forKey: AppGroupConstants.gestureConfigKey)
            let version = (defaults?.integer(forKey: AppGroupConstants.settingsVersionKey) ?? 0) + 1
            defaults?.set(version, forKey: AppGroupConstants.settingsVersionKey)
            defaults?.synchronize()
        }
    }

    private static func loadConfig() -> [String: Any]? {
        let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        guard let data = defaults?.data(forKey: AppGroupConstants.gestureConfigKey),
              let config = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }
        return config
    }
}
