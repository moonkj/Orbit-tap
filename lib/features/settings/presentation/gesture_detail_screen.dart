import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/app_localizations.dart';

// Provider for gesture settings (enabled state + sensitivity per gesture)
final gestureEnabledProvider =
    StateProvider.family<bool, String>((ref, gestureKey) => true);

final gestureSensitivityProvider =
    StateProvider.family<double, String>((ref, gestureKey) => 0.5);

class GestureDetailScreen extends ConsumerWidget {
  final String gestureKey;

  const GestureDetailScreen({super.key, required this.gestureKey});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isEnabled = ref.watch(gestureEnabledProvider(gestureKey));
    final sensitivity = ref.watch(gestureSensitivityProvider(gestureKey));

    final info = _gestureInfo(gestureKey, l10n);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.get('gestureDetailTitle')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Animation Preview Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    l10n.get('preview'),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                  ),
                  const SizedBox(height: 16),
                  _GestureAnimationPreview(gestureKey: gestureKey),
                  const SizedBox(height: 16),
                  Text(
                    info.name,
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    info.description,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Enable / Disable Toggle
          Card(
            child: SwitchListTile(
              title: Text(l10n.get('gestureEnabled')),
              subtitle: Text(
                isEnabled ? l10n.get('gestureOn') : l10n.get('gestureOff'),
              ),
              secondary: Icon(
                info.icon,
                color: isEnabled
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.outline,
              ),
              value: isEnabled,
              onChanged: (v) {
                ref.read(gestureEnabledProvider(gestureKey).notifier).state = v;
              },
            ),
          ),
          const SizedBox(height: 16),

          // Sensitivity Slider
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
                        l10n.get('sensitivity'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        '${(sensitivity * 100).round()}%',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Slider(
                    value: sensitivity,
                    onChanged: isEnabled
                        ? (v) {
                            ref
                                .read(
                                    gestureSensitivityProvider(gestureKey)
                                        .notifier)
                                .state = v;
                          }
                        : null,
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        l10n.get('sensitivityLow'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        l10n.get('sensitivityHigh'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Gesture Description Card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 18,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        l10n.get('gestureGuide'),
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...info.steps.map(
                    (step) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 20,
                            height: 20,
                            margin: const EdgeInsets.only(right: 8, top: 1),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primaryContainer,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                '${info.steps.indexOf(step) + 1}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onPrimaryContainer,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              step,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  _GestureInfo _gestureInfo(String key, AppLocalizations l10n) {
    switch (key) {
      case 'xshape':
        return _GestureInfo(
          name: l10n.get('xShapeCloseTab'),
          description: l10n.get('xShapeDesc'),
          icon: Icons.close,
          steps: [
            l10n.get('stepGestureMode'),
            l10n.get('stepDrawFirst'),
            l10n.get('stepDrawSecond'),
          ],
        );
      case 'lshape':
        return _GestureInfo(
          name: l10n.get('lShapeNewTab'),
          description: l10n.get('lShapeDesc'),
          icon: Icons.subdirectory_arrow_right,
          steps: [
            l10n.get('stepGestureMode'),
            l10n.get('stepDrawDown'),
            l10n.get('stepDrawRight'),
          ],
        );
      case 'circle':
        return _GestureInfo(
          name: l10n.get('circleSearch'),
          description: l10n.get('circleDesc'),
          icon: Icons.circle_outlined,
          steps: [
            l10n.get('stepGestureMode'),
            l10n.get('stepDrawCircle'),
            l10n.get('stepSearchAppears'),
          ],
        );
      case 'cshape':
        return _GestureInfo(
          name: l10n.get('cShapeRefresh'),
          description: l10n.get('cShapeDesc'),
          icon: Icons.refresh,
          steps: [
            l10n.get('stepGestureMode'),
            l10n.get('stepDrawC'),
            l10n.get('stepRefreshDone'),
          ],
        );
      default:
        return _GestureInfo(
          name: key,
          description: '',
          icon: Icons.gesture,
          steps: [],
        );
    }
  }
}

class _GestureInfo {
  final String name;
  final String description;
  final IconData icon;
  final List<String> steps;

  const _GestureInfo({
    required this.name,
    required this.description,
    required this.icon,
    required this.steps,
  });
}

class _GestureAnimationPreview extends StatefulWidget {
  final String gestureKey;

  const _GestureAnimationPreview({required this.gestureKey});

  @override
  State<_GestureAnimationPreview> createState() =>
      _GestureAnimationPreviewState();
}

class _GestureAnimationPreviewState extends State<_GestureAnimationPreview>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      height: 120,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(16),
      ),
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          return CustomPaint(
            painter: _GesturePainter(
              gestureKey: widget.gestureKey,
              progress: _animation.value,
              color: Theme.of(context).colorScheme.primary,
            ),
          );
        },
      ),
    );
  }
}

class _GesturePainter extends CustomPainter {
  final String gestureKey;
  final double progress;
  final Color color;

  const _GesturePainter({
    required this.gestureKey,
    required this.progress,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    switch (gestureKey) {
      case 'xshape':
        // X shape: two crossing lines
        final cx = size.width / 2;
        final cy = size.height / 2;
        final d = size.width * 0.25;
        canvas.drawLine(Offset(cx - d, cy - d), Offset(cx + d, cy + d), paint);
        canvas.drawLine(Offset(cx + d, cy - d), Offset(cx - d, cy + d), paint);
        break;
      case 'lshape':
        _paintLShape(canvas, size, paint, dotPaint);
        break;
      case 'circle':
        // Circle shape
        canvas.drawCircle(Offset(size.width / 2, size.height / 2), size.width * 0.25, paint);
        break;
      case 'cshape':
        // C shape: arc
        final rect = Rect.fromCenter(center: Offset(size.width / 2, size.height / 2), width: size.width * 0.5, height: size.height * 0.5);
        canvas.drawArc(rect, -2.0, 4.0, false, paint);
        break;
    }
  }

  void _paintSwipe(Canvas canvas, Size size, Paint paint, Paint dotPaint) {
    final startX = size.width * 0.2;
    final endX = size.width * 0.8;
    final y = size.height * 0.5;
    final currentX = startX + (endX - startX) * progress;
    canvas.drawLine(Offset(startX, y), Offset(currentX, y), paint);
    canvas.drawCircle(Offset(currentX, y), 6, dotPaint);
  }

  void _paintVShape(Canvas canvas, Size size, Paint paint, Paint dotPaint) {
    final path = Path();
    final cx = size.width / 2;
    final top = size.height * 0.2;
    final mid = size.height * 0.75;
    final leftX = size.width * 0.2;
    final rightX = size.width * 0.8;

    // First segment: left-top to bottom-center
    if (progress < 0.5) {
      final p = progress * 2;
      path.moveTo(leftX, top);
      path.lineTo(leftX + (cx - leftX) * p, top + (mid - top) * p);
    } else {
      path.moveTo(leftX, top);
      path.lineTo(cx, mid);
      final p = (progress - 0.5) * 2;
      path.lineTo(cx + (rightX - cx) * p, mid + (top - mid) * p);
    }
    canvas.drawPath(path, paint);

    final dotOffset = progress < 0.5
        ? Offset(leftX + (cx - leftX) * (progress * 2),
            top + (mid - top) * (progress * 2))
        : Offset(cx + (rightX - cx) * ((progress - 0.5) * 2),
            mid + (top - mid) * ((progress - 0.5) * 2));
    canvas.drawCircle(dotOffset, 6, dotPaint);
  }

  void _paintLShape(Canvas canvas, Size size, Paint paint, Paint dotPaint) {
    final path = Path();
    final x = size.width * 0.3;
    final top = size.height * 0.2;
    final bottom = size.height * 0.75;
    final endX = size.width * 0.75;

    if (progress < 0.6) {
      final p = progress / 0.6;
      path.moveTo(x, top);
      path.lineTo(x, top + (bottom - top) * p);
    } else {
      path.moveTo(x, top);
      path.lineTo(x, bottom);
      final p = (progress - 0.6) / 0.4;
      path.lineTo(x + (endX - x) * p, bottom);
    }
    canvas.drawPath(path, paint);

    final dotOffset = progress < 0.6
        ? Offset(x, top + (bottom - top) * (progress / 0.6))
        : Offset(x + (endX - x) * ((progress - 0.6) / 0.4), bottom);
    canvas.drawCircle(dotOffset, 6, dotPaint);
  }

  void _paintDoubleTap(Canvas canvas, Size size, Paint paint, Paint dotPaint) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final radius = 18.0 + progress * 14;
    final opacity = (1 - progress).clamp(0.0, 1.0);
    canvas.drawCircle(
      Offset(cx, cy),
      radius,
      Paint()
        ..color = color.withValues(alpha: opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    canvas.drawCircle(Offset(cx, cy), 6, dotPaint);
  }

  void _paintLongPress(Canvas canvas, Size size, Paint dotPaint) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final radius = 12.0 + progress * 8;
    canvas.drawCircle(
      Offset(cx, cy),
      radius,
      Paint()
        ..color = color.withValues(alpha: 0.3)
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(Offset(cx, cy), 8, dotPaint);
  }

  void _paintTwoFinger(Canvas canvas, Size size, Paint paint, Paint dotPaint) {
    final f1x = size.width * 0.4;
    final f2x = size.width * 0.6;
    final startY = size.height * 0.3;
    final endY = size.height * 0.7;
    final currentY = startY + (endY - startY) * progress;

    canvas.drawLine(Offset(f1x, startY), Offset(f1x, currentY), paint);
    canvas.drawLine(Offset(f2x, startY), Offset(f2x, currentY), paint);
    canvas.drawCircle(Offset(f1x, currentY), 5, dotPaint);
    canvas.drawCircle(Offset(f2x, currentY), 5, dotPaint);
  }

  @override
  bool shouldRepaint(_GesturePainter old) =>
      old.progress != progress || old.gestureKey != gestureKey;
}
