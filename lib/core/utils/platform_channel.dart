import 'package:flutter/services.dart';

class PlatformChannel {
  static const _storeKit = MethodChannel('com.swift.app/storekit');
  static const _appGroup = MethodChannel('com.swift.app/appgroup');
  static const _extension = MethodChannel('com.swift.app/extension');

  // StoreKit
  static Future<Map<String, dynamic>?> fetchProducts() async {
    try {
      final result = await _storeKit.invokeMethod('loadProducts');
      return Map<String, dynamic>.from(result);
    } on PlatformException {
      return null;
    }
  }

  static Future<bool> purchase(String productId) async {
    try {
      final result = await _storeKit.invokeMethod('purchase', {'productId': productId});
      return result == true;
    } on PlatformException {
      return false;
    }
  }

  static Future<bool> isSubscriptionActive() async {
    try {
      final result = await _storeKit.invokeMethod('getSubscriptionStatus');
      return result['isActive'] == true;
    } on PlatformException {
      return false;
    }
  }

  static Future<bool> restorePurchases() async {
    try {
      final result = await _storeKit.invokeMethod('restore');
      return result == true;
    } on PlatformException {
      return false;
    }
  }

  // App Group
  static Future<void> saveGestureConfig(Map<String, dynamic> config) async {
    await _appGroup.invokeMethod('saveConfig', config);
  }

  static Future<Map<String, dynamic>?> loadGestureConfig() async {
    try {
      final result = await _appGroup.invokeMethod('loadConfig');
      return result != null ? Map<String, dynamic>.from(result) : null;
    } on PlatformException {
      return null;
    }
  }

  // Extension
  static Future<bool> isExtensionEnabled() async {
    try {
      final result = await _extension.invokeMethod('isEnabled');
      return result == true;
    } on PlatformException {
      return false;
    }
  }
}
