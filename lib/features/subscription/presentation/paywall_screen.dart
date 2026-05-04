import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/platform_channel.dart';
import '../../../core/widgets/gesture_glyph.dart';
import '../domain/subscription_service.dart';

final purchaseLoadingProvider = StateProvider<bool>((ref) => false);
final priceProvider = StateProvider<String>((ref) => '');

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  @override
  void initState() {
    super.initState();
    _loadPrice();
  }

  Future<void> _loadPrice() async {
    final product = await PlatformChannel.fetchProducts();
    if (product != null && mounted) {
      ref.read(priceProvider.notifier).state = product['displayPrice'] ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isLoading = ref.watch(purchaseLoadingProvider);
    final price = ref.watch(priceProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go('/');
            }
          },
        ),
        title: Text(l10n.get('swiftPremium')),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              // Hero — brand gradient (matches in-page gesture mode border)
              Container(
                width: 84, height: 84,
                decoration: BoxDecoration(
                  gradient: AppColors.brandGradient,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brandPink.withValues(alpha: 0.35),
                      blurRadius: 24, offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(Icons.workspace_premium, color: Colors.white, size: 42),
              ),
              const SizedBox(height: 20),
              Text(l10n.get('swiftPremium'),
                style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 6),
              Text(l10n.get('allGesturesUnlocked'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const SizedBox(height: 24),

              // Free vs Pro comparison
              _ComparisonStrip(l10n: l10n),
              const SizedBox(height: 28),

              // Per-gesture benefits with brand glyphs
              _GestureBenefit(glyph: GestureGlyph.x, color: AppColors.error, text: l10n.get('xShapeCloseTab')),
              _GestureBenefit(glyph: GestureGlyph.l, color: AppColors.success, text: l10n.get('lShapeNewTab')),
              _GestureBenefit(glyph: GestureGlyph.circle, color: AppColors.primary, text: l10n.get('circleSearch')),
              _GestureBenefit(glyph: GestureGlyph.c, color: AppColors.warning, text: l10n.get('cShapeRefresh')),
              const SizedBox(height: 28),

              Text(price.isNotEmpty ? '$price / ${_monthLabel(l10n.locale.languageCode)}' : '',
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  foreground: Paint()
                    ..shader = AppColors.brandGradient.createShader(const Rect.fromLTWH(0, 0, 200, 60)),
                )),
              const SizedBox(height: 6),
              Text(l10n.get('monthlyPrice'),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: isLoading ? null : () => _purchase(context, ref, l10n),
                  icon: isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.workspace_premium),
                  label: Text(l10n.get('upgrade')),
                ),
              ),
              const SizedBox(height: 12),

              TextButton(
                onPressed: isLoading ? null : () => _restore(context, ref, l10n),
                child: Text(l10n.get('restore'), style: Theme.of(context).textTheme.labelMedium),
              ),
              const SizedBox(height: 16),

              Text(
                l10n.get('subscriptionTerms'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.85),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),

              // 이용약관 + 개인정보 → 각 법적 페이지로 이동
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => _showLegal(context, l10n, 'terms'),
                    child: Text(l10n.get('termsOfService'), style: const TextStyle(fontSize: 11)),
                  ),
                  Text(' | ', style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  TextButton(
                    onPressed: () => _showLegal(context, l10n, 'privacy'),
                    child: Text(l10n.get('privacyPolicy'), style: const TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLegal(BuildContext context, AppLocalizations l10n, String type) {
    final title = type == 'privacy' ? l10n.get('privacyPolicy') : l10n.get('termsOfService');
    final sections = _getLegalSections(l10n, type);

    Navigator.push(context, MaterialPageRoute(
      builder: (_) => Scaffold(
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
      ),
    ));
  }

  List<List<String>> _getLegalSections(AppLocalizations l10n, String type) {
    final code = l10n.locale.languageCode;
    if (type == 'privacy') {
      if (code == 'ko') return [
        ['1. 수집하는 정보', 'Orbit Tap은 개인정보를 수집하지 않습니다.'],
        ['2. 로컬 저장소', '제스처 설정만 기기에 저장됩니다.'],
        ['3. 네트워크 통신', '네트워크 요청을 하지 않습니다.'],
        ['4. 연락처', 'Apple App Store의 개발자 연락처를 이용해 주세요.'],
      ];
      if (code == 'ja') return [
        ['1. 収集する情報', 'Orbit Tap は個人情報を収集しません。'],
        ['2. ローカルストレージ', 'ジェスチャー設定のみデバイスに保存されます。'],
        ['3. ネットワーク通信', 'ネットワーク要求は行いません。'],
        ['4. 連絡先', 'Apple App Store の開発者連絡先をご利用ください。'],
      ];
      if (code == 'zh') return [
        ['1. 收集的信息', 'Orbit Tap 不收集任何个人信息。'],
        ['2. 本地存储', '仅手势设置存储在您的设备上。'],
        ['3. 网络通信', '不发送任何网络请求。'],
        ['4. 联系方式', '请使用 App Store 中的开发者联系方式。'],
      ];
      if (code == 'fr') return [
        ['1. Informations collectées', "Orbit Tap ne collecte aucune information personnelle."],
        ['2. Stockage local', "Seuls les paramètres de gestes sont stockés sur votre appareil."],
        ['3. Réseau', "Aucune requête réseau n'est effectuée."],
        ['4. Contact', "Utilisez les coordonnées du développeur sur l'App Store."],
      ];
      if (code == 'hi') return [
        ['1. एकत्रित जानकारी', 'Orbit Tap कोई व्यक्तिगत जानकारी एकत्र नहीं करता।'],
        ['2. स्थानीय संग्रहण', 'केवल जेस्चर सेटिंग्स आपके डिवाइस पर संग्रहीत होती हैं।'],
        ['3. नेटवर्क', 'कोई नेटवर्क अनुरोध नहीं किए जाते।'],
        ['4. संपर्क', 'कृपया App Store में डेवलपर संपर्क का उपयोग करें।'],
      ];
      return [
        ['1. Information We Collect', 'Orbit Tap collects no personal information.'],
        ['2. Local Storage', 'Only gesture settings are stored on your device.'],
        ['3. Network', 'Orbit Tap makes zero network requests.'],
        ['4. Contact', 'Please use the developer contact in the App Store.'],
      ];
    } else {
      if (code == 'ko') return [
        ['1. 라이선스', '비독점적, 양도 불가능한 개인 라이선스가 부여됩니다.'],
        ['2. 자동 갱신', '구독은 취소하지 않으면 자동 갱신됩니다.'],
        ['3. 준거법', '대한민국 법률에 따라 해석됩니다.'],
        ['4. 연락처', 'Apple App Store의 개발자 연락처를 이용해 주세요.'],
      ];
      if (code == 'ja') return [
        ['1. ライセンス', '非独占的かつ譲渡不能な個人ライセンスが付与されます。'],
        ['2. 自動更新', 'キャンセルしない限り、購読は自動更新されます。'],
        ['3. 準拠法', '大韓民国の法律に従って解釈されます。'],
        ['4. 連絡先', 'Apple App Store の開発者連絡先をご利用ください。'],
      ];
      if (code == 'zh') return [
        ['1. 许可证', '授予您非独占、不可转让的个人许可。'],
        ['2. 自动续订', '订阅在取消前将自动续订。'],
        ['3. 适用法律', '根据大韩民国法律解释。'],
        ['4. 联系方式', '请使用 App Store 中的开发者联系方式。'],
      ];
      if (code == 'fr') return [
        ['1. Licence', "Une licence personnelle, non exclusive et non transférable vous est accordée."],
        ['2. Renouvellement automatique', "L'abonnement se renouvelle automatiquement sauf annulation."],
        ['3. Droit applicable', "Interprété selon les lois de la République de Corée."],
        ['4. Contact', "Utilisez les coordonnées du développeur sur l'App Store."],
      ];
      if (code == 'hi') return [
        ['1. लाइसेंस', 'आपको गैर-अनन्य, गैर-हस्तांतरणीय व्यक्तिगत लाइसेंस दिया गया है।'],
        ['2. स्वतः नवीनीकरण', 'रद्द न करने पर सदस्यता स्वतः नवीनीकृत होती है।'],
        ['3. शासी कानून', 'कोरिया गणराज्य के कानूनों के तहत व्याख्या की जाती है।'],
        ['4. संपर्क', 'कृपया App Store में डेवलपर संपर्क का उपयोग करें।'],
      ];
      return [
        ['1. License', 'You are granted a non-exclusive, personal license.'],
        ['2. Auto-Renewal', 'Subscription auto-renews unless cancelled.'],
        ['3. Governing Law', 'Interpreted under the laws of Republic of Korea.'],
        ['4. Contact', 'Please use the developer contact in the App Store.'],
      ];
    }
  }

  Future<void> _purchase(BuildContext context, WidgetRef ref, AppLocalizations l10n) async {
    ref.read(purchaseLoadingProvider.notifier).state = true;
    try {
      final success = await ref.read(subscriptionProvider.notifier).purchase();
      if (context.mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.get('welcomePremium')), backgroundColor: Colors.green),
          );
          if (Navigator.of(context).canPop()) Navigator.of(context).pop(); else context.go('/');
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.get('purchaseFailed'))));
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${l10n.get('purchaseFailed')}: $e')),
        );
      }
    } finally {
      ref.read(purchaseLoadingProvider.notifier).state = false;
    }
  }

  String _monthLabel(String code) {
    switch (code) {
      case 'ko': return '월';
      case 'ja': return '月';
      case 'zh': return '月';
      case 'fr': return 'mois';
      case 'hi': return 'महीना';
      default: return 'month';
    }
  }

  Future<void> _restore(BuildContext context, WidgetRef ref, AppLocalizations l10n) async {
    ref.read(purchaseLoadingProvider.notifier).state = true;
    try {
      final success = await ref.read(subscriptionProvider.notifier).restore();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? l10n.get('purchaseRestored') : l10n.get('noRestore')),
            backgroundColor: success ? Colors.green : null,
          ),
        );
        if (success) {
          if (Navigator.of(context).canPop()) Navigator.of(context).pop(); else context.go('/');
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${l10n.get('purchaseFailed')}: $e')),
        );
      }
    } finally {
      ref.read(purchaseLoadingProvider.notifier).state = false;
    }
  }
}

class _GestureBenefit extends StatelessWidget {
  final GestureGlyph glyph;
  final Color color;
  final String text;
  const _GestureBenefit({required this.glyph, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: GestureGlyphIcon(glyph: glyph, color: color, size: 22)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyLarge),
          ),
          const Icon(Icons.check_circle, color: AppColors.success, size: 18),
        ],
      ),
    );
  }
}

class _ComparisonStrip extends StatelessWidget {
  final AppLocalizations l10n;
  const _ComparisonStrip({required this.l10n});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isKo = l10n.locale.languageCode == 'ko';
    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isKo ? '무료' : 'Free', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: cs.onSurfaceVariant)),
                const SizedBox(height: 6),
                Text(isKo ? '하루 10회' : '10 / day', style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
          ),
          Container(width: 1, height: 36, color: cs.outlineVariant),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShaderMask(
                  shaderCallback: (r) => AppColors.brandGradient.createShader(r),
                  child: Text(
                    'Pro',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 6),
                Text(isKo ? '무제한' : 'Unlimited', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

