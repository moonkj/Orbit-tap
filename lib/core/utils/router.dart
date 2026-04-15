import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/settings/presentation/gesture_detail_screen.dart';
import '../../features/settings/presentation/floating_button_settings_screen.dart';
import '../../features/settings/presentation/exclusion_list_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/gesture-detail/:gestureKey',
        builder: (context, state) {
          final gestureKey = state.pathParameters['gestureKey'] ?? 'swipe';
          return GestureDetailScreen(gestureKey: gestureKey);
        },
      ),
      GoRoute(
        path: '/floating-button-settings',
        builder: (context, state) => const FloatingButtonSettingsScreen(),
      ),
      GoRoute(
        path: '/exclusion-list',
        builder: (context, state) => const ExclusionListScreen(),
      ),
    ],
  );
});
