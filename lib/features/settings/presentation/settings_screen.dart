import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_colors.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              // App icon and branding
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.swipe, color: Colors.white, size: 40),
              ),
              const SizedBox(height: 16),
              Text(AppConstants.appName, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(l10n.get('appSlogan'), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 32),

              // Setup Steps
              _StepCard(number: '1', title: l10n.get('enableStep1Title'), description: l10n.get('enableStep1Desc')),
              const SizedBox(height: 12),
              _StepCard(number: '2', title: l10n.get('enableStep2Title'), description: l10n.get('enableStep2Desc')),
              const SizedBox(height: 32),

              // Features Section
              _SectionTitle(icon: Icons.auto_awesome, title: l10n.get('featuresTitle')),
              const SizedBox(height: 16),
              _FeatureItem(icon: Icons.swipe, color: Colors.blue, title: l10n.get('featSwipeTitle'), description: l10n.get('featSwipeDesc')),
              _FeatureItem(icon: Icons.close, color: Colors.red, title: l10n.get('featVShapeTitle'), description: l10n.get('featVShapeDesc')),
              _FeatureItem(icon: Icons.restore, color: Colors.green, title: l10n.get('featLShapeTitle'), description: l10n.get('featLShapeDesc')),
              _FeatureItem(icon: Icons.touch_app, color: Colors.orange, title: l10n.get('featDoubleTapTitle'), description: l10n.get('featDoubleTapDesc')),
              _FeatureItem(icon: Icons.swap_vert, color: Colors.purple, title: l10n.get('featLongPressTitle'), description: l10n.get('featLongPressDesc')),
              _FeatureItem(icon: Icons.refresh, color: Colors.teal, title: l10n.get('featTwoFingerTitle'), description: l10n.get('featTwoFingerDesc')),
              _FeatureItem(icon: Icons.radio_button_checked, color: AppColors.primary, title: l10n.get('featFloatingTitle'), description: l10n.get('featFloatingDesc')),
              const SizedBox(height: 32),

              // Legal Section
              _SectionTitle(icon: Icons.description, title: l10n.get('legalTitle')),
              const SizedBox(height: 12),
              _LegalRow(title: l10n.get('privacyPolicy'), onTap: () => _showLegal(context, l10n, 'privacy')),
              _LegalRow(title: l10n.get('termsOfService'), onTap: () => _showLegal(context, l10n, 'terms')),
              _LegalRow(title: l10n.get('support'), onTap: () {}),
              const SizedBox(height: 24),

              // Version
              Text('${l10n.get('version')} 1.0.0', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  void _showLegal(BuildContext context, AppLocalizations l10n, String type) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _LegalPage(type: type, l10n: l10n),
    ));
  }
}

class _StepCard extends StatelessWidget {
  final String number;
  final String title;
  final String description;
  const _StepCard({required this.number, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(child: Text(number, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(description, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            )),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final String title;
  const _SectionTitle({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
      ],
    );
  }
}

class _FeatureItem extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String description;
  const _FeatureItem({required this.icon, required this.color, required this.title, required this.description});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              Text(description, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ],
          )),
        ],
      ),
    );
  }
}

class _LegalRow extends StatelessWidget {
  final String title;
  final VoidCallback onTap;
  const _LegalRow({required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Row(
          children: [
            Expanded(child: Text(title, style: const TextStyle(fontSize: 15))),
            Icon(Icons.chevron_right, size: 20, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ],
        ),
      ),
    );
  }
}

class _LegalPage extends StatelessWidget {
  final String type;
  final AppLocalizations l10n;
  const _LegalPage({required this.type, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final title = type == 'privacy' ? l10n.get('privacyPolicy') : l10n.get('termsOfService');
    final sections = _getSections();

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: sections.map((s) => Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(s[0], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 4),
              Text(s[1], style: const TextStyle(fontSize: 14, height: 1.5)),
            ],
          ),
        )).toList(),
      ),
    );
  }

  List<List<String>> _getSections() {
    if (type == 'privacy') {
      return [
        ['1. Information We Collect', 'Swift Gestures collects no personal information — no names, emails, location data, device identifiers, or usage statistics.'],
        ['2. Local Storage', 'Only gesture settings and preferences are stored on your device. This data never leaves your device.'],
        ['3. Network Communication', 'Swift Gestures makes zero network requests. It works fully offline.'],
        ['4. Third-Party Services', 'No advertising networks, analytics tools, social logins, or third-party SDKs are used.'],
        ['5. Children\'s Privacy', 'We do not knowingly collect personal information from children under 13.'],
        ['6. Policy Changes', 'Changes will be announced via app updates.'],
        ['7. Contact', 'Please use the developer contact in the Apple App Store.'],
      ];
    } else {
      return [
        ['1. License Grant', 'You are granted a non-exclusive, non-transferable, personal license to use the App.'],
        ['2. User Responsibilities', 'Use the App only for lawful purposes. You are responsible for all consequences of your use.'],
        ['3. Intellectual Property', 'All rights in the App belong to the Developer.'],
        ['4. Disclaimer of Warranties', 'The App is provided "AS IS" with no warranties.'],
        ['5. Limitation of Liability', 'The Developer is not liable for any indirect or consequential damages.'],
        ['6. Relationship with Apple', 'These Terms are solely between you and the Developer.'],
        ['7. Governing Law', 'These Terms are interpreted under the laws of the Republic of Korea.'],
        ['8. Contact', 'Please use the developer contact in the Apple App Store.'],
      ];
    }
  }
}
