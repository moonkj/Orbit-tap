import 'package:flutter/material.dart';

/// Brand gesture glyphs — same shapes drawn in the Safari extension popup
/// so the in-app paywall, settings, and onboarding speak the same visual
/// language as the gesture mode itself.
enum GestureGlyph { x, l, circle, c }

class GestureGlyphIcon extends StatelessWidget {
  const GestureGlyphIcon({
    super.key,
    required this.glyph,
    this.size = 28,
    this.color,
    this.strokeWidth = 2.4,
  });

  final GestureGlyph glyph;
  final double size;
  final Color? color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GlyphPainter(glyph, c, strokeWidth)),
    );
  }
}

class _GlyphPainter extends CustomPainter {
  _GlyphPainter(this.glyph, this.color, this.strokeWidth);
  final GestureGlyph glyph;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;
    final w = size.width;
    final h = size.height;
    final pad = w * 0.18;

    switch (glyph) {
      case GestureGlyph.x:
        canvas.drawLine(Offset(pad, pad), Offset(w - pad, h - pad), p);
        canvas.drawLine(Offset(w - pad, pad), Offset(pad, h - pad), p);
        break;
      case GestureGlyph.l:
        final path = Path()
          ..moveTo(pad, pad)
          ..lineTo(pad, h - pad)
          ..lineTo(w - pad, h - pad);
        canvas.drawPath(path, p);
        break;
      case GestureGlyph.circle:
        canvas.drawCircle(Offset(w / 2, h / 2), (w - pad * 2) / 2, p);
        break;
      case GestureGlyph.c:
        // Open-arc C — same path the Safari popup draws.
        final rect = Rect.fromCircle(center: Offset(w / 2, h / 2), radius: (w - pad * 2) / 2);
        canvas.drawArc(rect, -0.5, 5.0, false, p);
        break;
    }
  }

  @override
  bool shouldRepaint(_GlyphPainter old) =>
      old.glyph != glyph || old.color != color || old.strokeWidth != strokeWidth;
}
