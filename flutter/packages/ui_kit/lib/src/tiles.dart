import 'package:material_ui/material_ui.dart';

import 'patterns.dart';
import 'theme.dart';

/// أنماط ألوان بلاطات الرئيسية (مطابقة لـ style.css).
enum TileStyle { pos, bill, stock, purch, navy, alert }

class _Look {
  const _Look(this.a, this.b, this.fg, this.iconColor, this.shadow);
  final Color a, b, fg, iconColor, shadow;
}

const _looks = <TileStyle, _Look>{
  TileStyle.pos: _Look(Color(0xFFFBBF3C), Color(0xFFC9780F), Color(0xFF1A1200),
      Color(0xFF1A1200), Color(0xFF965A0A)),
  TileStyle.bill: _Look(Color(0xFF26407A), Color(0xFF0E1B3C), Colors.white,
      Colors.white, Color(0xFF0E1B3C)),
  TileStyle.stock: _Look(Color(0xFF34508F), Color(0xFF1B2C52), Colors.white,
      Colors.white, Color(0xFF1B2C52)),
  TileStyle.purch: _Look(Color(0xFF12968A), Color(0xFF0B5F58), Colors.white,
      Colors.white, Color(0xFF0B5F58)),
  TileStyle.navy: _Look(Color(0xFF2C437A), Color(0xFF172647), Colors.white,
      Color(0xFFF9C14A), Color(0xFF172647)),
  TileStyle.alert: _Look(Color(0xFFC4504B), Color(0xFF8F2A27), Colors.white,
      Colors.white, Color(0xFF8F2A27)),
};

/// بلاطة الرئيسية: تدرّج + نسيج النجوم + أيقونة داخل دائرة + عنوان بخط الرقعة.
class DiwanTile extends StatelessWidget {
  const DiwanTile({
    super.key,
    required this.style,
    required this.icon,
    required this.title,
    this.subtitle,
    this.size = DiwanTileSize.small,
    this.badge,
    this.enabled = true,
    this.onTap,
  });

  final TileStyle style;
  final IconData icon;
  final String title;
  final String? subtitle;
  final DiwanTileSize size;
  final int? badge;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = _looks[style]!;
    final big = size == DiwanTileSize.big;
    final circle = big ? 60.0 : 42.0;
    final isz = big ? 30.0 : 22.0;
    final radius = BorderRadius.circular(big ? 26 : 22);
    final dark = l.fg == Colors.white;
    return Opacity(
      opacity: enabled ? 1 : .4, // صلاحية مفقودة = معطّل بنفس التخطيط
      child: Container(
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: LinearGradient(
            begin: const Alignment(-.6, -1),
            end: const Alignment(.6, 1),
            colors: [l.a, l.b],
          ),
          boxShadow: [
            BoxShadow(
                color: l.shadow.withValues(alpha: .3),
                blurRadius: 3,
                offset: const Offset(0, 2)),
            BoxShadow(
                color: l.shadow.withValues(alpha: .55),
                blurRadius: 22,
                spreadRadius: -10,
                offset: const Offset(0, 14)),
          ],
        ),
        child: ClipRRect(
          borderRadius: radius,
          child: Stack(
            children: [
              Positioned.fill(
                child: CustomPaint(
                  painter: TilePatternPainter(
                      color: dark ? Colors.white : Colors.black,
                      opacity: dark ? .13 : .12),
                ),
              ),
              Material(
                type: MaterialType.transparency,
                child: InkWell(
                  onTap: enabled ? onTap : null,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: circle,
                          height: circle,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white
                                .withValues(alpha: l.fg == Colors.white ? .2 : .28),
                            border: Border.all(
                                color: (dark ? Colors.white : l.fg)
                                    .withValues(alpha: dark ? .4 : .35),
                                width: 1.5),
                          ),
                          child: Icon(icon, size: isz, color: l.iconColor),
                        ),
                        SizedBox(height: big ? 10 : 6),
                        Text(
                          title,
                          textAlign: TextAlign.center,
                          style: ruqaa(size: big ? 21 : 17.5, color: l.fg)
                              .copyWith(fontWeight: FontWeight.w700),
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(subtitle!,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: l.fg.withValues(alpha: .85))),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (badge != null && badge! > 0)
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    constraints:
                        const BoxConstraints(minWidth: 24, minHeight: 24),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12)),
                    child: Text('$badge',
                        style: const TextStyle(
                            color: Color(0xFFB91C1C),
                            fontWeight: FontWeight.w900,
                            fontSize: 12.5)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

enum DiwanTileSize { big, small }
