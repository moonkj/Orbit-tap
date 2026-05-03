import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:swift_safari_gesture/features/settings/presentation/settings_screen.dart';
import 'package:swift_safari_gesture/features/onboarding/presentation/onboarding_screen.dart';
import 'package:swift_safari_gesture/core/l10n/app_localizations.dart';

Widget testApp(Widget child) {
  return ProviderScope(
    child: MaterialApp(
      localizationsDelegates: const [AppLocalizations.delegate],
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

void main() {
  group('SettingsScreen', () {
    testWidgets('renders app title', (tester) async {
      await tester.pumpWidget(testApp(const SettingsScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Orbit Tap'), findsOneWidget);
    });

    testWidgets('shows gesture toggles', (tester) async {
      await tester.pumpWidget(testApp(const SettingsScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Gestures'), findsOneWidget);
    });

    testWidgets('shows subscription section', (tester) async {
      await tester.pumpWidget(testApp(const SettingsScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      // Scroll down to reveal subscription section
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -600));
      await tester.pump();
      expect(find.text('Subscription'), findsOneWidget);
    });

    testWidgets('shows floating button toggle', (tester) async {
      await tester.pumpWidget(testApp(const SettingsScreen()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      // Scroll to floating button section
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -300));
      await tester.pump();
      expect(find.text('Floating Button'), findsWidgets);
    });
  });

  group('OnboardingScreen', () {
    testWidgets('renders first page', (tester) async {
      await tester.pumpWidget(testApp(const OnboardingScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Orbit Tap'), findsOneWidget);
    });

    testWidgets('has next button', (tester) async {
      await tester.pumpWidget(testApp(const OnboardingScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Next'), findsOneWidget);
    });

    testWidgets('has skip button', (tester) async {
      await tester.pumpWidget(testApp(const OnboardingScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Skip'), findsOneWidget);
    });
  });

  group('AppLocalizations', () {
    test('English locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('en'));
      expect(l10n.get('appName'), 'Orbit Tap');
      expect(l10n.get('settings'), 'Settings');
      expect(l10n.get('gestures'), 'Gestures');
    });

    test('Korean locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('ko'));
      expect(l10n.get('appName'), 'Orbit Tap');
      expect(l10n.get('settings'), '설정');
      expect(l10n.get('gestures'), '제스처');
    });

    test('Japanese locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('ja'));
      expect(l10n.get('settings'), '設定');
      expect(l10n.get('gestures'), 'ジェスチャー');
    });

    test('Chinese locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('zh', 'CN'));
      expect(l10n.get('settings'), '设置');
      expect(l10n.get('gestures'), '手势');
    });

    test('French locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('fr'));
      expect(l10n.get('settings'), 'Paramètres');
    });

    test('Hindi locale returns correct values', () {
      final l10n = AppLocalizations(const Locale('hi'));
      expect(l10n.get('settings'), 'सेटिंग्स');
    });

    test('Unknown key falls back to key itself', () {
      final l10n = AppLocalizations(const Locale('en'));
      expect(l10n.get('nonExistentKey'), 'nonExistentKey');
    });

    test('Unsupported locale falls back to English', () {
      final l10n = AppLocalizations(const Locale('de'));
      expect(l10n.get('settings'), 'Settings');
    });
  });
}
