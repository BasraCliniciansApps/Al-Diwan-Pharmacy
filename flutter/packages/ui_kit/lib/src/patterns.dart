import 'package:material_ui/material_ui.dart';

import 'theme.dart';

/// نسيج الترويسة الهندسي: مربع ومربع مدوّر 45° ومعيّنات الأركان بخطوط ذهبية خفيفة
/// (مطابق لـ .top-bar في style.css: خلية 56px، شفافية .13، تتلاشى نحو الأسفل).
class HeaderPatternPainter extends CustomPainter {
  const HeaderPatternPainter({this.fade = true});
  final bool fade;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = DiwanColors.goldDeep.withValues(alpha: .16);
    const cell = 56.0;
    // البداية من أعلى اليمين مثل background-position: right top
    for (var x = size.width; x > -cell; x -= cell) {
      for (var y = 0.0; y < size.height + cell; y += cell) {
        _cell(canvas, Offset(x - cell, y), p);
      }
    }
    if (fade) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0x000F1C38), Color(0x990F1C38)],
          ).createShader(Offset.zero & size),
      );
    }
  }

  void _cell(Canvas c, Offset o, Paint p) {
    c.save();
    c.translate(o.dx, o.dy);
    c.drawRect(const Rect.fromLTWH(14, 14, 28, 28), p);
    c.save();
    c.translate(28, 28);
    c.rotate(0.7853981633974483);
    c.drawRect(const Rect.fromLTWH(-14, -14, 28, 28), p);
    c.restore();
    for (final corner in const [
      Offset(0, 0),
      Offset(56, 0),
      Offset(0, 56),
      Offset(56, 56)
    ]) {
      final d = Path()
        ..moveTo(corner.dx, corner.dy - 7)
        ..lineTo(corner.dx + 7, corner.dy)
        ..lineTo(corner.dx, corner.dy + 7)
        ..lineTo(corner.dx - 7, corner.dy)
        ..close();
      c.drawPath(d, p);
    }
    c.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

/// نجمة ثمانية بدائرة وسطى على البلاطات (خلية 34px، أبيض بشفافية ≈ .065).
class TilePatternPainter extends CustomPainter {
  const TilePatternPainter({this.color = Colors.white, this.opacity = .13});
  final Color color;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1 * 34 / 44
      ..color = color.withValues(alpha: .5 * opacity);
    const cell = 34.0;
    const k = cell / 44;
    final star = Path()
      ..moveTo(22, 2)
      ..lineTo(27.7, 10.3)
      ..lineTo(38, 8)
      ..lineTo(35.7, 18.3)
      ..lineTo(42, 22)
      ..lineTo(35.7, 25.7)
      ..lineTo(38, 36)
      ..lineTo(27.7, 33.7)
      ..lineTo(22, 42)
      ..lineTo(16.3, 33.7)
      ..lineTo(6, 36)
      ..lineTo(8.3, 25.7)
      ..lineTo(2, 22)
      ..lineTo(8.3, 18.3)
      ..lineTo(6, 8)
      ..lineTo(16.3, 10.3)
      ..close();
    for (var y = 0.0; y < size.height; y += cell) {
      for (var x = 0.0; x < size.width; x += cell) {
        canvas.save();
        canvas.translate(x, y);
        canvas.scale(k);
        canvas.drawPath(star, p);
        canvas.drawCircle(const Offset(22, 22), 4.5, p);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(covariant TilePatternPainter old) =>
      old.color != color || old.opacity != opacity;
}
