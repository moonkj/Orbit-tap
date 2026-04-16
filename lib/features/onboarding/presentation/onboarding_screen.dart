import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/l10n/app_localizations.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _currentPage = 0;
  int get _pageCount => 5;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final pages = [
      _OnboardingPageData(
        title: l10n.get('onboardingTitle1'),
        subtitle: l10n.get('onboardingSubtitle1'),
        description: l10n.get('onboardingDesc1'),
        icon: Icons.touch_app,
      ),
      _OnboardingPageData(
        title: l10n.get('onboardingTitle2'),
        subtitle: l10n.get('onboardingSubtitle2'),
        description: l10n.get('onboardingDesc2'),
        icon: Icons.extension,
      ),
      _OnboardingPageData(
        title: l10n.get('onboardingTitle3'),
        subtitle: l10n.get('onboardingSubtitle3'),
        description: l10n.get('onboardingDesc3'),
        icon: Icons.gesture,
      ),
      _OnboardingPageData(
        title: l10n.get('onboardingTitle4'),
        subtitle: l10n.get('onboardingSubtitle4'),
        description: l10n.get('onboardingDesc4'),
        icon: Icons.adjust,
      ),
      _OnboardingPageData(
        title: l10n.get('onboardingTitle5'),
        subtitle: l10n.get('onboardingSubtitle5'),
        description: l10n.get('onboardingDesc5'),
        icon: Icons.workspace_premium,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pageCount,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemBuilder: (context, index) {
                  final page = pages[index];
                  return _OnboardingPageWidget(
                    title: page.title,
                    subtitle: page.subtitle,
                    description: page.description,
                    icon: page.icon,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  SmoothPageIndicator(
                    controller: _controller,
                    count: _pageCount,
                    effect: const WormEffect(
                      dotHeight: 8,
                      dotWidth: 8,
                      activeDotColor: Color(0xFF0A84FF),
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () {
                        if (_currentPage < _pageCount - 1) {
                          _controller.nextPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        } else {
                          context.go('/');
                        }
                      },
                      child: Text(
                        _currentPage < _pageCount - 1
                            ? l10n.get('next')
                            : l10n.get('getStarted'),
                      ),
                    ),
                  ),
                  if (_currentPage < _pageCount - 1)
                    TextButton(
                      onPressed: () => context.go('/'),
                      child: Text(l10n.get('skip')),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}

class _OnboardingPageData {
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;

  const _OnboardingPageData({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
  });
}

class _OnboardingPageWidget extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final IconData icon;

  const _OnboardingPageWidget({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 100, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 32),
          Text(
            title,
            style: Theme.of(context)
                .textTheme
                .headlineLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                ),
          ),
          const SizedBox(height: 16),
          Text(
            description,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    );
  }
}
