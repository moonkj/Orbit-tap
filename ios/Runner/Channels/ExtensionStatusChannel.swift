import Flutter
import SafariServices

class ExtensionStatusChannel {
    static let channelName = "com.swift.app/extension"

    static func register(with messenger: FlutterBinaryMessenger) {
        let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
        channel.setMethodCallHandler { call, result in
            switch call.method {
            case "isEnabled":
                // Note: There's no direct API to check if extension is enabled
                // We check via App Groups if extension has written any data
                let defaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
                let extensionActive = defaults?.bool(forKey: "extensionActive") ?? false
                result(extensionActive)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
    }
}
