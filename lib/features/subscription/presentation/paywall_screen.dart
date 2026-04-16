import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/platform_channel.dart';

final purchaseLoadingProvider = StateProvider<bool>((ref) => false);

class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isLoading = ref.watch(purchaseLoadingProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
        title: const Text(l10n.get('swiftPremium')),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Premium icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.secondary],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.star, color: Colors.white, size: 40),
              ),
              const SizedBox(height: 24),
              Text(
                l10n.get('swiftPremium'),
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.get('allGesturesUnlocked'),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),

              // Feature comparison
              Expanded(
                child: ListView(
                  children: [
                    _FeatureRow(name: l10n.get('xShapeCloseTab'), free: true, premium: true),
                    _FeatureRow(name: l10n.get('lShapeNewTab'), free: true, premium: true),
                    _FeatureRow(name: l10n.get('circleSearch'), free: true, premium: true),
                    _FeatureRow(name: l10n.get('cShapeRefresh'), free: true, premium: true),
                    _FeatureRow(name: l10n.get('floatingButton'), free: true, premium: true),
                    _FeatureRow(name: l10n.get('gestureSettings'), free: false, premium: true),
                    _FeatureRow(name: l10n.get('exclusionList'), free: false, premium: true),
                    _FeatureRow(name: l10n.get('statistics'), free: false, premium: true),
                  ],
                ),
              ),

              // Price and CTA
              const SizedBox(height: 16),
              Text(
                '\$0.99 / ${l10n.get('minutes').contains('분') ? '월' : 'month'}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton(
                  onPressed: isLoading ? null : () => _purchase(context, ref),
                  child: isLoading
                    ? const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        l10n.get('upgrade'),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                      ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: isLoading ? null : () => _restore(context, ref),
                child: Text(l10n.get('restore')),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () {},
                    child: Text(l10n.get('termsOfService'), style: const TextStyle(fontSize: 12)),
                  ),
                  const Text(' | ', style: TextStyle(fontSize: 12)),
                  TextButton(
                    onPressed: () {},
                    child: Text(l10n.get('privacyPolicy'), style: const TextStyle(fontSize: 12)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _purchase(BuildContext context, WidgetRef ref) async {
    ref.read(purchaseLoadingProvider.notifier).state = true;
    try {
      final success = await PlatformChannel.purchase('com.swift.app.monthly');
      if (context.mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Welcome to Premium!'), backgroundColor: Colors.green),
          );
          context.pop();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.get('purchaseFailed'))),
          );
        }
      }
    } finally {
      ref.read(purchaseLoadingProvider.notifier).state = false;
    }
  }

  Future<void> _restore(BuildContext context, WidgetRef ref) async {
    ref.read(purchaseLoadingProvider.notifier).state = true;
    try {
      final success = await PlatformChannel.restorePurchases();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? l10n.get('purchaseRestored') : l10n.get('noRestore')),
            backgroundColor: success ? Colors.green : null,
          ),
        );
        if (success) context.pop();
      }
    } finally {
      ref.read(purchaseLoadingProvider.notifier).state = false;
    }
  }
}

class _FeatureRow extends StatelessWidget {
  final String name;
  final bool free;
  final bool premium;
  const _FeatureRow({required this.name, required this.free, required this.premium});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text(name, style: const TextStyle(fontSize: 14))),
          Expanded(
            child: Center(
              child: Icon(
                free ? Icons.check_circle : Icons.cancel,
                color: free ? Colors.green : Colors.red.withValues(alpha: 0.4),
                size: 20,
              ),
            ),
          ),
          Expanded(
            child: Center(
              child: Icon(Icons.check_circle, color: Colors.green, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
