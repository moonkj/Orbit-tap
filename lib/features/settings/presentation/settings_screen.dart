import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
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
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset('assets/icon.png', width: 80, height: 80, errorBuilder: (c, e, s) =>
                  Container(width: 80, height: 80, decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(20)),
                    child: const Icon(Icons.touch_app, color: Colors.white, size: 40))),
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
              _FeatureItem(icon: Icons.close, color: Colors.red, title: l10n.get('featXShapeTitle'), description: l10n.get('featXShapeDesc')),
              _FeatureItem(icon: Icons.subdirectory_arrow_right, color: Colors.green, title: l10n.get('featLShapeTitle'), description: l10n.get('featLShapeDesc')),
              _FeatureItem(icon: Icons.circle_outlined, color: Colors.blue, title: l10n.get('featCircleTitle'), description: l10n.get('featCircleDesc')),
              _FeatureItem(icon: Icons.refresh, color: Colors.orange, title: l10n.get('featCShapeTitle'), description: l10n.get('featCShapeDesc')),
              _FeatureItem(icon: Icons.radio_button_checked, color: AppColors.primary, title: l10n.get('featFloatingTitle'), description: l10n.get('featFloatingDesc')),
              const SizedBox(height: 32),

              // Legal Section
              _SectionTitle(icon: Icons.description, title: l10n.get('legalTitle')),
              const SizedBox(height: 12),
              _LegalRow(title: l10n.get('privacyPolicy'), onTap: () => _showLegal(context, l10n, 'privacy')),
              _LegalRow(title: l10n.get('termsOfService'), onTap: () => _showLegal(context, l10n, 'terms')),
              _LegalRow(title: l10n.get('support'), onTap: () {
                launchUrl(Uri.parse('mailto:imurmkj@naver.com?subject=SWIFT%20Support'));
              }),
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
    final isKo = l10n.locale.languageCode == 'ko';
    final isJa = l10n.locale.languageCode == 'ja';
    final isZh = l10n.locale.languageCode == 'zh';

    if (type == 'privacy') {
      if (isKo) return [
        ['1. 수집하는 정보', 'SWIFT는 개인정보를 수집하지 않습니다. 이름, 이메일, 위치정보, 기기 식별자, 사용 통계 등 어떤 정보도 수집하지 않습니다.'],
        ['2. 로컬 저장소', '제스처 설정과 환경설정만 기기에 저장됩니다. 이 데이터는 기기 외부로 전송되지 않습니다.'],
        ['3. 네트워크 통신', 'SWIFT는 네트워크 요청을 하지 않습니다. 완전히 오프라인으로 동작합니다.'],
        ['4. 제3자 서비스', '광고 네트워크, 분석 도구, 소셜 로그인, 제3자 SDK를 사용하지 않습니다.'],
        ['5. 아동 개인정보 보호', '13세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.'],
        ['6. 정책 변경', '변경사항은 앱 업데이트를 통해 공지합니다.'],
        ['7. 연락처', 'Apple App Store의 개발자 연락처를 이용해 주세요.'],
      ];
      if (isJa) return [
        ['1. 収集する情報', 'SWIFTは個人情報を収集しません。名前、メール、位置情報、デバイス識別子、使用統計などは一切収集しません。'],
        ['2. ローカルストレージ', 'ジェスチャー設定と環境設定のみがデバイスに保存されます。このデータはデバイス外に送信されません。'],
        ['3. ネットワーク通信', 'SWIFTはネットワークリクエストを行いません。完全にオフラインで動作します。'],
        ['4. 第三者サービス', '広告ネットワーク、分析ツール、ソーシャルログイン、第三者SDKは使用しません。'],
        ['5. 子供のプライバシー', '13歳未満の子供の個人情報を意図的に収集しません。'],
        ['6. ポリシーの変更', '変更はアプリのアップデートで通知します。'],
        ['7. 連絡先', 'Apple App Storeの開発者連絡先をご利用ください。'],
      ];
      if (isZh) return [
        ['1. 收集的信息', 'SWIFT不收集任何个人信息。不收集姓名、邮箱、位置、设备标识或使用统计。'],
        ['2. 本地存储', '仅手势设置和偏好存储在您的设备上。此数据不会离开您的设备。'],
        ['3. 网络通信', 'SWIFT不发送任何网络请求。完全离线运行。'],
        ['4. 第三方服务', '不使用广告网络、分析工具、社交登录或第三方SDK。'],
        ['5. 儿童隐私', '我们不会故意收集13岁以下儿童的个人信息。'],
        ['6. 政策变更', '变更将通过应用更新通知。'],
        ['7. 联系方式', '请使用Apple App Store中的开发者联系方式。'],
      ];
      return [
        ['1. Information We Collect', 'SWIFT collects no personal information — no names, emails, location data, device identifiers, or usage statistics.'],
        ['2. Local Storage', 'Only gesture settings and preferences are stored on your device. This data never leaves your device.'],
        ['3. Network Communication', 'SWIFT makes zero network requests. It works fully offline.'],
        ['4. Third-Party Services', 'No advertising networks, analytics tools, social logins, or third-party SDKs are used.'],
        ['5. Children\'s Privacy', 'We do not knowingly collect personal information from children under 13.'],
        ['6. Policy Changes', 'Changes will be announced via app updates.'],
        ['7. Contact', 'Please use the developer contact in the Apple App Store.'],
      ];
    } else {
      if (isKo) return [
        ['1. 라이선스 부여', '본 앱에 대한 비독점적, 양도 불가능한 개인 라이선스가 부여됩니다.'],
        ['2. 사용자 책임', '합법적인 목적으로만 앱을 사용하세요. 사용에 따른 모든 결과에 대해 본인이 책임집니다.'],
        ['3. 지적 재산권', '앱의 모든 권리는 개발자에게 있습니다.'],
        ['4. 보증 면책', '앱은 "있는 그대로" 제공되며 어떠한 보증도 하지 않습니다.'],
        ['5. 책임 제한', '개발자는 간접적 또는 결과적 손해에 대해 책임지지 않습니다.'],
        ['6. Apple과의 관계', '본 약관은 사용자와 개발자 간에만 적용됩니다.'],
        ['7. 준거법', '본 약관은 대한민국 법률에 따라 해석됩니다.'],
        ['8. 연락처', 'Apple App Store의 개발자 연락처를 이용해 주세요.'],
      ];
      if (isJa) return [
        ['1. ライセンスの付与', '本アプリの非独占的、譲渡不可の個人ライセンスが付与されます。'],
        ['2. ユーザーの責任', '合法的な目的でのみアプリを使用してください。使用の結果はすべてご自身の責任です。'],
        ['3. 知的財産', 'アプリのすべての権利は開発者に帰属します。'],
        ['4. 保証の免責', 'アプリは「現状のまま」提供され、いかなる保証もしません。'],
        ['5. 責任の制限', '開発者は間接的または結果的損害について責任を負いません。'],
        ['6. Appleとの関係', '本規約はユーザーと開発者の間でのみ適用されます。'],
        ['7. 準拠法', '本規約は大韓民国の法律に従って解釈されます。'],
        ['8. 連絡先', 'Apple App Storeの開発者連絡先をご利用ください。'],
      ];
      if (isZh) return [
        ['1. 许可授予', '授予您非独占、不可转让的个人许可证使用本应用。'],
        ['2. 用户责任', '仅出于合法目的使用本应用。您需对使用后果承担所有责任。'],
        ['3. 知识产权', '本应用的所有权利归开发者所有。'],
        ['4. 免责声明', '本应用按"原样"提供，不提供任何保证。'],
        ['5. 责任限制', '开发者不对间接或后果性损害承担责任。'],
        ['6. 与Apple的关系', '本条款仅在您与开发者之间适用。'],
        ['7. 适用法律', '本条款根据大韩民国法律进行解释。'],
        ['8. 联系方式', '请使用Apple App Store中的开发者联系方式。'],
      ];
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
