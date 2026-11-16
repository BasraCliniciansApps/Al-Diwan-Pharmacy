import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'progress.dart';
import 'theme.dart';

/// ترويسة صفحة داخلية: 97px، حواف سفلية 22، نجوم ذهبية على النيلي، خط ذهبي سفلي.
/// صف علوي: الشعار + «صيدلية الديوان» + أيقونتا المخزن والرئيسية.
/// سطر ثانٍ: أيقونة + عنوان الصفحة (58px من الأعلى، 19px من اليمين).
class DiwanHeader extends StatelessWidget implements PreferredSizeWidget {
  const DiwanHeader({
    super.key,
    required this.title,
    required this.icon,
    this.onHome,
    this.onStock,
    this.trailing = const [],
  });

  static const double height = 97;

  final String title;
  final IconData icon;
  final VoidCallback? onHome;
  final VoidCallback? onStock;
  final List<Widget> trailing;

  @override
  Size get preferredSize => const Size.fromHeight(height + 2);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return SizedBox(
      height: height + top + 2,
      child: Stack(
        children: [
          Positioned.fill(
            bottom: 2,
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(22)),
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [DiwanColors.navySoft, DiwanColors.navy],
                  ),
                  border: Border(
                      bottom: BorderSide(color: DiwanColors.gold, width: 2)),
                ),
                child: CustomPaint(painter: _StarsPainter()),
              ),
            ),
          ),
          // صف الشعار والأيقونات
          Positioned(
            top: top + 8,
            left: 12,
            right: 16,
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset('images/logo.jpg',
                      package: kUiPackage, width: 30, height: 30),
                ),
                const SizedBox(width: 8),
                Text('صيدلية الديوان',
                    style: ruqaa(size: 20.8, color: DiwanColors.gold)),
                const Spacer(),
                ...trailing,
                if (onStock != null)
                  _HdrIcon(LucideIcons.package, 'المخزن', onStock!),
                if (onHome != null)
                  _HdrIcon(LucideIcons.house, 'الرئيسية', onHome!),
              ],
            ),
          ),
          // سطر العنوان
          Positioned(
            top: top + 58,
            right: 19,
            child: Row(
              children: [
                Icon(icon, size: 18, color: DiwanColors.slateText),
                const SizedBox(width: 6),
                Text(title,
                    style: ruqaa(size: 16.8, color: DiwanColors.slateText)),
              ],
            ),
          ),
          // شريط التقدّم عند حدّ الترويسة
          const Positioned(
              left: 0, right: 0, bottom: 0, child: DiwanProgressBar()),
        ],
      ),
    );
  }
}

class _HdrIcon extends StatelessWidget {
  const _HdrIcon(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => IconButton(
        onPressed: onTap,
        tooltip: label,
        visualDensity: VisualDensity.compact,
        icon: Icon(icon, size: 22, color: DiwanColors.gold),
      );
}

/// نجوم ذهبية خافتة موزّعة بثبات (بلا عشوائية حتى تثبت لقطات golden).
class _StarsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = DiwanColors.gold.withValues(alpha: .16);
    const step = 34.0;
    for (var y = 12.0, r = 0; y < size.height; y += step * .8, r++) {
      for (var x = (r.isEven ? 10.0 : 27.0); x < size.width; x += step) {
        _star(canvas, Offset(x, y), r.isEven ? 3.2 : 2.2, p);
      }
    }
  }

  void _star(Canvas c, Offset o, double r, Paint p) {
    final path = Path();
    for (var i = 0; i < 8; i++) {
      final a = i * math.pi / 4;
      final rad = i.isEven ? r : r * .42;
      final pt = Offset(o.dx + rad * math.cos(a), o.dy + rad * math.sin(a));
      i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
    }
    c.drawPath(path..close(), p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
