import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        GeneratedPluginRegistrant.register(with: self)

        // When using Scene lifecycle, window may not be ready yet.
        // Channel registration is deferred to registerChannels()
        // which is called from SceneDelegate after the window is set.
        if let controller = window?.rootViewController as? FlutterViewController {
            registerChannels(with: controller.binaryMessenger)
        }

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    func registerChannels(with messenger: FlutterBinaryMessenger) {
        StoreKitChannel.register(with: messenger)
        AppGroupChannel.register(with: messenger)
        ExtensionStatusChannel.register(with: messenger)
    }
}
