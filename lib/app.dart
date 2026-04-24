import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/l10n/app_localizations.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/router.dart';

class OrbitTapApp extends ConsumerStatefulWidget {
  const OrbitTapApp({super.key});

  @override
  ConsumerState<OrbitTapApp> createState() => _OrbitTapAppState();
}

class _OrbitTapAppState extends ConsumerState<OrbitTapApp> {
  static const _navChannel = MethodChannel('com.swift.app/navigation');

  @override
  void initState() {
    super.initState();
    _navChannel.setMethodCallHandler((call) async {
      if (call.method == 'navigate' && call.arguments is String) {
        final route = call.arguments as String;
        ref.read(routerProvider).go(route);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Orbit Tap',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
