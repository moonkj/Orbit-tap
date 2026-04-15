import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
    override func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        super.scene(scene, willConnectTo: session, options: connectionOptions)

        // After the scene is connected, the window and rootViewController are ready.
        // Register native MethodChannels here since AppDelegate.window is nil
        // during application(_:didFinishLaunchingWithOptions:) in Scene lifecycle.
        if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
           let windowScene = scene as? UIWindowScene,
           let controller = windowScene.windows.first?.rootViewController as? FlutterViewController {
            appDelegate.registerChannels(with: controller.binaryMessenger)
        }
    }
}
