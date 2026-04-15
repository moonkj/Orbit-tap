import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/utils/platform_channel.dart';

final extensionEnabledProvider = FutureProvider<bool>((ref) async {
  return await PlatformChannel.isExtensionEnabled();
});

final subscriptionActiveProvider = FutureProvider<bool>((ref) async {
  return await PlatformChannel.isSubscriptionActive();
});

final floatingButtonEnabledProvider = StateNotifierProvider<FloatingButtonNotifier, bool>((ref) {
  return FloatingButtonNotifier();
});

class FloatingButtonNotifier extends StateNotifier<bool> {
  FloatingButtonNotifier() : super(true) {
    _load();
  }

  Future<void> _load() async {
    final config = await PlatformChannel.loadGestureConfig();
    if (config != null && config.containsKey('floatingButtonEnabled')) {
      state = config['floatingButtonEnabled'] as bool;
    }
  }

  Future<void> toggle(bool value) async {
    state = value;
    final config = await PlatformChannel.loadGestureConfig() ?? {};
    config['floatingButtonEnabled'] = value;
    await PlatformChannel.saveGestureConfig(config);
  }
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final extensionEnabled = ref.watch(extensionEnabledProvider);
    final subscriptionActive = ref.watch(subscriptionActiveProvider);

    return Scaffold(
      appBar: AppBar(title: Text(AppConstants.appName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Extension Status Card
          extensionEnabled.when(
            data: (enabled) => _StatusCard(
              title: l10n.get('safariExtension'),
              subtitle: enabled ? l10n.get('enabled') : l10n.get('notEnabled'),
              icon: enabled ? Icons.check_circle : Icons.error,
              color: enabled ? Colors.green : Colors.red,
              onTap: enabled ? null : () => _showExtensionGuide(context, l10n),
            ),
            loading: () => _StatusCard(
              title: l10n.get('safariExtension'),
              subtitle: l10n.get('checking'),
              icon: Icons.hourglass_empty,
              color: Colors.grey,
            ),
            error: (e, s) => _StatusCard(
              title: l10n.get('safariExtension'),
              subtitle: l10n.get('unknown'),
              icon: Icons.help,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 16),

          // Gestures Section
          _SectionHeader(title: l10n.get('gestures')),
          _GestureToggle(
            name: l10n.get('swipeBackForward'),
            subtitle: l10n.get('swipeDesc'),
            gestureKey: 'swipe',
            enabled: true,
            isPremium: false,
            onTap: () => context.push('/gesture-detail/swipe'),
          ),
          _GestureToggle(
            name: l10n.get('vShapeCloseTab'),
            subtitle: l10n.get('vShapeDesc'),
            gestureKey: 'vshape',
            enabled: true,
            isPremium: true,
            onTap: () => context.push('/gesture-detail/vshape'),
          ),
          _GestureToggle(
            name: l10n.get('lShapeRestoreTab'),
            subtitle: l10n.get('lShapeDesc'),
            gestureKey: 'lshape',
            enabled: true,
            isPremium: true,
            onTap: () => context.push('/gesture-detail/lshape'),
          ),
          _GestureToggle(
            name: l10n.get('doubleTapSearch'),
            subtitle: l10n.get('doubleTapDesc'),
            gestureKey: 'doubletap',
            enabled: true,
            isPremium: true,
            onTap: () => context.push('/gesture-detail/doubletap'),
          ),
          _GestureToggle(
            name: l10n.get('longPressScroll'),
            subtitle: l10n.get('longPressDesc'),
            gestureKey: 'longpress',
            enabled: true,
            isPremium: true,
            onTap: () => context.push('/gesture-detail/longpress'),
          ),
          _GestureToggle(
            name: l10n.get('twoFingerFlick'),
            subtitle: l10n.get('twoFingerDesc'),
            gestureKey: 'twofinger',
            enabled: true,
            isPremium: true,
            onTap: () => context.push('/gesture-detail/twofinger'),
          ),
          const SizedBox(height: 24),

          // Floating Button Section
          _SectionHeader(title: l10n.get('floatingButton')),
          SwitchListTile(
            title: Text(l10n.get('showFloatingButton')),
            subtitle: Text(l10n.get('quickAccessControl')),
            value: ref.watch(floatingButtonEnabledProvider),
            onChanged: (v) {
              ref.read(floatingButtonEnabledProvider.notifier).toggle(v);
            },
          ),
          ListTile(
            title: Text(l10n.get('floatingButton')),
            subtitle: Text(l10n.get('buttonPosition')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/floating-button-settings'),
          ),
          const SizedBox(height: 24),

          // Exclusion List Section
          ListTile(
            leading: const Icon(Icons.block),
            title: Text(l10n.get('exclusionList')),
            subtitle: Text(l10n.get('manageExcludedSites')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/exclusion-list'),
          ),
          const SizedBox(height: 8),

          // Statistics Section
          ListTile(
            leading: const Icon(Icons.bar_chart),
            title: Text(l10n.get('statistics')),
            subtitle: Text(l10n.get('weeklyUsage')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/stats'),
          ),
          const SizedBox(height: 24),

          // Subscription Section
          _SectionHeader(title: l10n.get('subscription')),
          subscriptionActive.when(
            data: (active) => Card(
              child: ListTile(
                leading: Icon(
                  active ? Icons.star : Icons.star_border,
                  color: active ? Colors.amber : null,
                ),
                title: Text(
                  active ? l10n.get('premiumActive') : l10n.get('freePlan'),
                ),
                subtitle: Text(
                  active
                      ? l10n.get('allGesturesUnlocked')
                      : l10n.get('monthlyPrice'),
                ),
                trailing: active
                    ? null
                    : FilledButton(
                        onPressed: () => context.push('/paywall'),
                        child: Text(l10n.get('upgrade')),
                      ),
              ),
            ),
            loading: () => const Card(
              child: ListTile(title: Text('Loading...')),
            ),
            error: (e, s) => const Card(
              child: ListTile(title: Text('Unable to check status')),
            ),
          ),
          const SizedBox(height: 8),
          if (true)
            TextButton(
              onPressed: () {},
              child: Text(l10n.get('restore')),
            ),
          const SizedBox(height: 24),

          // About Section
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: Text(l10n.get('about')),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/about'),
          ),
        ],
      ),
    );
  }

  void _showExtensionGuide(BuildContext context, AppLocalizations l10n) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.get('enableExtension'),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            Text(l10n.get('enableStep1')),
            const SizedBox(height: 4),
            Text(l10n.get('enableStep2')),
            const SizedBox(height: 4),
            Text(l10n.get('enableStep3')),
            const SizedBox(height: 4),
            Text(l10n.get('enableStep4')),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: Text(l10n.get('gotIt')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleLarge
            ?.copyWith(fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _StatusCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, color: color, size: 32),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: onTap != null ? const Icon(Icons.chevron_right) : null,
        onTap: onTap,
      ),
    );
  }
}

class _GestureToggle extends StatelessWidget {
  final String name;
  final String subtitle;
  final String gestureKey;
  final bool enabled;
  final bool isPremium;
  final VoidCallback? onTap;

  const _GestureToggle({
    required this.name,
    required this.subtitle,
    required this.gestureKey,
    required this.enabled,
    required this.isPremium,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Row(
        children: [
          Expanded(child: Text(name)),
          if (isPremium)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'PRO',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.amber,
                ),
              ),
            ),
        ],
      ),
      subtitle: Text(subtitle),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Switch(value: enabled, onChanged: (v) {}),
          const Icon(Icons.chevron_right, size: 16),
        ],
      ),
      onTap: onTap,
    );
  }
}
