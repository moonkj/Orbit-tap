import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/platform_channel.dart';

final extensionEnabledProvider = FutureProvider<bool>((ref) async {
  return await PlatformChannel.isExtensionEnabled();
});

final subscriptionActiveProvider = FutureProvider<bool>((ref) async {
  return await PlatformChannel.isSubscriptionActive();
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extensionEnabled = ref.watch(extensionEnabledProvider);
    final subscriptionActive = ref.watch(subscriptionActiveProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppConstants.appName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Extension Status Card
          extensionEnabled.when(
            data: (enabled) => _StatusCard(
              title: 'Safari Extension',
              subtitle: enabled ? 'Enabled' : 'Not Enabled',
              icon: enabled ? Icons.check_circle : Icons.error,
              color: enabled ? Colors.green : Colors.red,
              onTap: enabled ? null : () => _showExtensionGuide(context),
            ),
            loading: () => const _StatusCard(title: 'Safari Extension', subtitle: 'Checking...', icon: Icons.hourglass_empty, color: Colors.grey),
            error: (e, s) => const _StatusCard(title: 'Safari Extension', subtitle: 'Unknown', icon: Icons.help, color: Colors.grey),
          ),
          const SizedBox(height: 16),

          // Gestures Section
          const _SectionHeader(title: 'Gestures'),
          const _GestureToggle(name: 'Swipe Back/Forward', subtitle: 'Horizontal swipe in center area', enabled: true, isPremium: false),
          const _GestureToggle(name: 'V Shape - Close Tab', subtitle: 'Draw V to close current tab', enabled: true, isPremium: true),
          const _GestureToggle(name: 'L Shape - Restore Tab', subtitle: 'Draw L to restore closed tab', enabled: true, isPremium: true),
          const _GestureToggle(name: 'Double Tap - Search', subtitle: 'Quick page search', enabled: true, isPremium: true),
          const _GestureToggle(name: 'Long Press - Scroll', subtitle: 'Jump to top/bottom', enabled: true, isPremium: true),
          const _GestureToggle(name: 'Two Finger Flick', subtitle: 'Refresh / Fullscreen', enabled: true, isPremium: true),
          const SizedBox(height: 24),

          // Floating Button Section
          const _SectionHeader(title: 'Floating Button'),
          SwitchListTile(
            title: const Text('Show Floating Button'),
            subtitle: const Text('Quick access control on every page'),
            value: true,
            onChanged: (v) {},
          ),
          const SizedBox(height: 24),

          // Subscription Section
          const _SectionHeader(title: 'Subscription'),
          subscriptionActive.when(
            data: (active) => Card(
              child: ListTile(
                leading: Icon(active ? Icons.star : Icons.star_border, color: active ? Colors.amber : null),
                title: Text(active ? 'Premium Active' : 'Free Plan'),
                subtitle: Text(active ? 'All gestures unlocked' : '\$0.99/month for full access'),
                trailing: active ? null : const FilledButton(onPressed: null, child: Text('Upgrade')),
              ),
            ),
            loading: () => const Card(child: ListTile(title: Text('Loading...'))),
            error: (e, s) => const Card(child: ListTile(title: Text('Unable to check status'))),
          ),
        ],
      ),
    );
  }

  void _showExtensionGuide(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Enable Safari Extension', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            const Text('1. Open Settings'),
            const Text('2. Tap Safari > Extensions'),
            const Text('3. Enable Swift Gestures'),
            const Text('4. Allow for All Websites'),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Got it')),
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
      child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
    );
  }
}

class _StatusCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _StatusCard({required this.title, required this.subtitle, required this.icon, required this.color, this.onTap});

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
  final bool enabled;
  final bool isPremium;

  const _GestureToggle({required this.name, required this.subtitle, required this.enabled, required this.isPremium});

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Row(
        children: [
          Expanded(child: Text(name)),
          if (isPremium) Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('PRO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber)),
          ),
        ],
      ),
      subtitle: Text(subtitle),
      value: enabled,
      onChanged: (v) {},
    );
  }
}
