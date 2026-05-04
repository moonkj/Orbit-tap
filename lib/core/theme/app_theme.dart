import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  static const _radius = 14.0;
  static const _cardRadius = 16.0;
  static const _buttonHeight = 54.0;

  // iOS HIG-leaning type scale. Use these via Theme.of(context).textTheme
  // instead of hardcoding fontSize on every Text widget.
  static const TextTheme _textTheme = TextTheme(
    displayLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5),
    displayMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.4),
    headlineLarge: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3),
    headlineMedium: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
    headlineSmall: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
    titleLarge: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
    titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    titleSmall: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.3),
    bodyLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w400, height: 1.4),
    bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.4),
    bodySmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w400, height: 1.35),
    labelLarge: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
    labelMedium: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
    labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.4),
  );

  static FilledButtonThemeData _filledButtonTheme(ColorScheme cs) =>
      FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: cs.primary,
          foregroundColor: cs.onPrimary,
          minimumSize: const Size.fromHeight(_buttonHeight),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      );

  static OutlinedButtonThemeData _outlinedButtonTheme(ColorScheme cs) =>
      OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: cs.primary,
          minimumSize: const Size.fromHeight(_buttonHeight),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_radius)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      );

  static SnackBarThemeData _snackBarTheme(ColorScheme cs) => SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: cs.inverseSurface,
        contentTextStyle: TextStyle(color: cs.onInverseSurface, fontSize: 14, fontWeight: FontWeight.w500),
      );

  static ThemeData _build(Brightness b) {
    final cs = ColorScheme.fromSeed(seedColor: AppColors.primary, brightness: b);
    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: cs,
      textTheme: _textTheme.apply(
        bodyColor: cs.onSurface,
        displayColor: cs.onSurface,
      ),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: cs.surface,
        foregroundColor: cs.onSurface,
        titleTextStyle: TextStyle(color: cs.onSurface, fontSize: 17, fontWeight: FontWeight.w600),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: cs.surfaceContainerHighest,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(_cardRadius)),
      ),
      filledButtonTheme: _filledButtonTheme(cs),
      outlinedButtonTheme: _outlinedButtonTheme(cs),
      snackBarTheme: _snackBarTheme(cs),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? Colors.white : null),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? AppColors.success : null),
      ),
    );
  }

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);
}
