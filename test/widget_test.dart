import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:swift_safari_gesture/features/settings/presentation/settings_screen.dart';

void main() {
  testWidgets('Settings screen renders correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: SettingsScreen()),
      ),
    );

    expect(find.text('Swift'), findsOneWidget);
    expect(find.text('Gestures'), findsOneWidget);
  });
}
