import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF0A84FF);
  static const Color secondary = Color(0xFF5E5CE6);
  static const Color success = Color(0xFF30D158);
  static const Color warning = Color(0xFFFFD60A);
  static const Color error = Color(0xFFFF453A);
  static const Color gesturePreview = Color(0xFF64D2FF);
  static const Color floatingButton = Color(0xFF0A84FF);
  static const Color hudBackground = Color(0xCC1C1C1E);

  // Brand "active" gradient — same hues as the in-page gesture-mode border
  // (purple → pink → cyan). Reuse for any Pro / active / energy moment so
  // the paywall, onboarding and gesture surface feel like one system.
  static const Color brandPurple = Color(0xFFA855F7);
  static const Color brandPink = Color(0xFFEC4899);
  static const Color brandCyan = Color(0xFF06B6D4);

  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brandPurple, brandPink, brandCyan],
  );
}
