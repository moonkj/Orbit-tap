import Foundation

/// ShieldMail 패턴: App Groups 키 정의
struct AppGroupConstants {
    static let suiteName = "group.com.swift.app"

    // Gesture config
    static let gestureConfigKey = "gestureConfig"
    static let settingsVersionKey = "settingsVersion"

    // Subscription (ShieldMail 패턴: tier 기반)
    static let subscriptionActiveKey = "isSubscriptionActive"
    static let subscriptionExpiryKey = "subscriptionExpiry"
    static let lastVerifiedKey = "lastVerified"
    static let tierKey = "swift_tier"              // "free" or "pro"
    static let jwsKey = "swift_jws"                // JWS token
    static let productIdKey = "swift_product_id"   // Product ID
}
