import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/app_localizations.dart';

enum ButtonPosition { left, right }

enum ButtonSize { small, medium, large }

final buttonPositionProvider =
    StateProvider<ButtonPosition>((ref) => ButtonPosition.right);

final buttonSizeProvider =
    StateProvider<ButtonSize>((ref) => ButtonSize.medium);

final buttonOpacityProvider = StateProvider<double>((ref) => 0.85);

class FloatingButtonSettingsScreen extends ConsumerWidget {
  const FloatingButtonSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final position = ref.watch(buttonPositionProvider);
    final size = ref.watch(buttonSizeProvider);
    final opacity = ref.watch(buttonOpacityProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.get('floatingButton')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Live Preview
          _PreviewCard(position: position, size: size, opacity: opacity),
          const SizedBox(height: 16),

          // Position Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.get('buttonPosition'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _PositionButton(
                          label: l10n.get('left'),
                          icon: Icons.align_horizontal_left,
                          isSelected: position == ButtonPosition.left,
                          onTap: () {
                            ref.read(buttonPositionProvider.notifier).state =
                                ButtonPosition.left;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _PositionButton(
                          label: l10n.get('right'),
                          icon: Icons.align_horizontal_right,
                          isSelected: position == ButtonPosition.right,
                          onTap: () {
                            ref.read(buttonPositionProvider.notifier).state =
                                ButtonPosition.right;
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Size Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.get('buttonSize'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _SizeButton(
                          label: l10n.get('small'),
                          sizeValue: ButtonSize.small,
                          currentSize: size,
                          onTap: () {
                            ref.read(buttonSizeProvider.notifier).state =
                                ButtonSize.small;
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _SizeButton(
                          label: l10n.get('medium'),
                          sizeValue: ButtonSize.medium,
                          currentSize: size,
                          onTap: () {
                            ref.read(buttonSizeProvider.notifier).state =
                                ButtonSize.medium;
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _SizeButton(
                          label: l10n.get('large'),
                          sizeValue: ButtonSize.large,
                          currentSize: size,
                          onTap: () {
                            ref.read(buttonSizeProvider.notifier).state =
                                ButtonSize.large;
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Opacity Section
          Card(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        l10n.get('buttonOpacity'),
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        '${(opacity * 100).round()}%',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ],
                  ),
                  Slider(
                    value: opacity,
                    min: 0.2,
                    max: 1.0,
                    divisions: 16,
                    onChanged: (v) {
                      ref.read(buttonOpacityProvider.notifier).state = v;
                    },
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '20%',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        '100%',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewCard extends StatelessWidget {
  final ButtonPosition position;
  final ButtonSize size;
  final double opacity;

  const _PreviewCard({
    required this.position,
    required this.size,
    required this.opacity,
  });

  double get _buttonSize {
    switch (size) {
      case ButtonSize.small:
        return 36;
      case ButtonSize.medium:
        return 48;
      case ButtonSize.large:
        return 60;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Container(
        height: 160,
        padding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Theme.of(context)
                      .colorScheme
                      .surfaceContainerHighest
                      .withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Safari Preview',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ),
            ),
            Positioned(
              right: position == ButtonPosition.right ? 8 : null,
              left: position == ButtonPosition.left ? 8 : null,
              bottom: 8,
              child: Opacity(
                opacity: opacity,
                child: Container(
                  width: _buttonSize,
                  height: _buttonSize,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.radio_button_checked,
                    color: Colors.white,
                    size: _buttonSize * 0.45,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PositionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _PositionButton({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(
                  color: Theme.of(context).colorScheme.primary,
                  width: 2,
                )
              : null,
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontWeight:
                    isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SizeButton extends StatelessWidget {
  final String label;
  final ButtonSize sizeValue;
  final ButtonSize currentSize;
  final VoidCallback onTap;

  const _SizeButton({
    required this.label,
    required this.sizeValue,
    required this.currentSize,
    required this.onTap,
  });

  bool get isSelected => sizeValue == currentSize;

  double get _dotSize {
    switch (sizeValue) {
      case ButtonSize.small:
        return 18;
      case ButtonSize.medium:
        return 26;
      case ButtonSize.large:
        return 34;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          border: isSelected
              ? Border.all(
                  color: Theme.of(context).colorScheme.primary,
                  width: 2,
                )
              : null,
        ),
        child: Column(
          children: [
            Container(
              width: _dotSize,
              height: _dotSize,
              decoration: BoxDecoration(
                color: isSelected
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.outline,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight:
                    isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
