import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';

import 'product_image.dart';

/// ألوان شارة الشكل الدوائي (من style.css).
({Color bg, Color fg}) badgeColors(String cls) => switch (cls) {
      'badge-cream' => (bg: const Color(0xFFE0F2FE), fg: const Color(0xFF0369A1)),
      'badge-oint' => (bg: const Color(0xFFFEF3C7), fg: const Color(0xFF92400E)),
      'badge-gel' => (bg: const Color(0xFFCCFBF1), fg: const Color(0xFF0F766E)),
      'badge-oral' => (bg: const Color(0xFFF3E8FF), fg: const Color(0xFF7E22CE)),
      'badge-syrup' => (bg: const Color(0xFFFCE7F3), fg: const Color(0xFFBE185D)),
      'badge-wash' => (bg: const Color(0xFFDCFCE7), fg: const Color(0xFF15803D)),
      'badge-spray' => (bg: const Color(0xFFE0E7FF), fg: const Color(0xFF4338CA)),
      'badge-inj' => (bg: const Color(0xFFFEE2E2), fg: const Color(0xFFB91C1C)),
      _ => (bg: const Color(0xFFE5E7EB), fg: const Color(0xFF374151)),
    };

/// وسم التنبيه على الصورة (صلاحية/كمية قليلة).
class CardTag {
  const CardTag(this.text, this.bg, this.fg, this.icon);
  final String text;
  final Color bg, fg;
  final IconData icon;
}

String fmtNum(num n) => n
    .round()
    .toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

/// ارتفاع البطاقة الكلي (إطار 2 + صورة 140 + جسم): 340.1 مع زرّي الكمية.
double productCardHeight(bool showQty) => 2 + 140 + 12 + 16.8 + 3 + 39.7 + 8 + 21.6 + 5 + 24 + 14 + (showQty ? 54 : 0);

const _kBrand = Color(0xFFA85D08);
const _kPrice = Color(0xFFB45309);

/// بطاقة المادة (bento-card) بالقياسات الفعلية للويب: صورة 140، جسم 12/14/14، زرّا الكمية 44.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.p,
    required this.cfg,
    this.tag,
    this.onTap,
    this.showQty = false,
    this.onQty,
  });
  final Product p;
  final AlertConfig cfg;
  final CardTag? tag;
  final VoidCallback? onTap;
  final bool showQty;
  final void Function(int delta)? onQty;

  @override
  Widget build(BuildContext context) {
    final badge = formBadge(p);
    final bc = badgeColors(badge.cls);
    final dark = context.isDark;
    final dot = !p.inStock
        ? DiwanColors.danger
        : (isLowStock(p, cfg) ? const Color(0xFFF59E0B) : DiwanColors.success);
    final surface = context.cSurface;
    final meta = packLine(p);
    return Container(
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.cBorder),
        boxShadow: const [BoxShadow(color: Color(0x0F0F1C38), blurRadius: 2, offset: Offset(0, 1))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 140,
                child: Stack(fit: StackFit.expand, children: [
                  ColoredBox(
                    color: dark ? const Color(0xFF0E1730) : const Color(0xFFF5F7FB),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: ProductImage(p.img, fit: BoxFit.contain),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: bc.bg, borderRadius: BorderRadius.circular(7)),
                      child: Text(badge.txt,
                          textDirection: TextDirection.ltr,
                          style: TextStyle(
                              fontSize: 11.2, fontWeight: FontWeight.w800, height: 1.4, color: bc.fg)),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 11,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: dot,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: surface, spreadRadius: 3)],
                      ),
                    ),
                  ),
                  if (tag != null)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: tag!.bg,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))],
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(tag!.icon, size: 13, color: tag!.fg),
                          const SizedBox(width: 4),
                          Text(tag!.text,
                              style: TextStyle(
                                  fontSize: 10.9, fontWeight: FontWeight.w900, height: 1.3, color: tag!.fg)),
                        ]),
                      ),
                    ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 16.8,
                      child: Text(p.brand,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 11.2, fontWeight: FontWeight.w800, height: 1.5, color: _kBrand)),
                    ),
                    const SizedBox(height: 3),
                    SizedBox(
                      height: 39.7,
                      child: Text(p.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textDirection: TextDirection.ltr,
                          textAlign: TextAlign.right,
                          style: TextStyle(
                              fontSize: 14.72,
                              fontWeight: FontWeight.w800,
                              height: 1.35,
                              color: dark ? DiwanColors.darkText : DiwanColors.navy)),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: SizedBox(
                        height: 21.6,
                        child: Text(p.price > 0 ? '${fmtNum(p.price)} د.ع' : '0 د.ع',
                            style: TextStyle(
                                fontSize: 14.4,
                                fontWeight: FontWeight.w900,
                                height: 1.5,
                                color: dark ? DiwanColors.gold : _kPrice)),
                      ),
                    ),
                    const SizedBox(height: 5),
                    SizedBox(
                      height: 24,
                      child: meta.isEmpty
                          ? null
                          : Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                              decoration: BoxDecoration(
                                color: dark ? const Color(0xFF1E2B4A) : const Color(0xFFEAEEF6),
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: Text('‎$meta',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textDirection: TextDirection.ltr,
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      height: 1.5,
                                      color: dark ? DiwanColors.darkText : DiwanColors.navySoft)),
                            ),
                    ),
                    if (showQty) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 44,
                        child: Row(children: [
                          _QtyBtn('−', () => onQty?.call(-1)),
                          Expanded(
                            child: Center(
                              child: Text(qtyShort(p),
                                  style: TextStyle(
                                      fontSize: 16.8,
                                      fontWeight: FontWeight.w900,
                                      color: dark ? DiwanColors.darkText : DiwanColors.navy)),
                            ),
                          ),
                          _QtyBtn('+', () => onQty?.call(1)),
                        ]),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// عرض الكمية المختصر (qtyShort في الويب): «علب+أجزاء» عند البيع بالجزء.
String qtyShort(Product p) => (p.hasRetail && p.loose > 0) ? '${p.qty}+${p.loose}' : '${p.qty}';

class _QtyBtn extends StatelessWidget {
  const _QtyBtn(this.glyph, this.onTap);
  final String glyph;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: context.cSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: context.cBorder),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: SizedBox(
              width: 44,
              height: 44,
              child: Center(
                child: Text(glyph,
                    style: TextStyle(
                        fontSize: 20.8,
                        fontWeight: FontWeight.w800,
                        height: 1.1,
                        color: context.isDark ? DiwanColors.darkText : DiwanColors.navy)),
              )),
        ),
      );
}
