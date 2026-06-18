import 'package:flutter/services.dart';

class PlatformChannel {
  static const _appGroup = MethodChannel('com.swift.app/appgroup');
  static const _extension = MethodChannel('com.swift.app/extension');

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
