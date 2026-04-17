import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
    override func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        super.scene(scene, willConnectTo: session, options: connectionOptions)

        if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
           let windowScene = scene as? UIWindowScene,
           let controller = windowScene.windows.first?.rootViewController as? FlutterViewController {
            appDelegate.registerChannels(with: controller.binaryMessenger)
        }
    }

    // ShieldMail 패턴: URL scheme 핸들러 (swiftgesture://subscribe)
    override func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for urlContext in URLContexts {
            handleURL(urlContext.url)
        }
    }

    private func handleURL(_ url: URL) {
        guard url.scheme == "swiftgesture" else { return }

        if url.host == "subscribe" {
            // Extension에서 구독 요청 → Flutter 구독 화면으로 이동
            Task { @MainActor in
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let controller = windowScene.windows.first?.rootViewController as? FlutterViewController {
                    let nav = FlutterMethodChannel(name: "com.swift.app/navigation", binaryMessenger: controller.binaryMessenger)
                    nav.invokeMethod("navigate", arguments: "/subscribe")
                }
            }
        }
    }
}
