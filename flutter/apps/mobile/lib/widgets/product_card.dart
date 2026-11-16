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
      'badge-spray' => (bg: const Color(0xFFE0E7FF), fg: const Color(0xFF4338CC)),
      'badge-inj' => (bg: const Color(0xFFFEE2E2), fg: const Color(0xFFB91C1C)),
      _ => (bg: const Color(0xFFE5E7EB), fg: const Color(0xFF374151)),
    };

/// وسم التنبيه على الصورة (صلاحية/كمية قليلة).
class CardTag {
  const CardTag(this.text, this.bg, this.fg);
  final String text;
  final Color bg, fg;
}

String _fmt(num n) {
  final s = n.round().toString();
  return s.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
}

/// بطاقة المادة (bento-card): صورة، نقطة حالة، شارة شكل، الشركة، الاسم، السعر، العبوة.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.p, required this.cfg, this.tag, this.onTap});
  final Product p;
  final AlertConfig cfg;
  final CardTag? tag;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final badge = formBadge(p);
    final bc = badgeColors(badge.cls);
    final dot = !p.inStock
        ? DiwanColors.danger
        : (isLowStock(p, cfg) ? DiwanColors.goldDeep : DiwanColors.success);
    final dark = context.isDark;
    return Material(
      color: context.cSurface,
      borderRadius: BorderRadius.circular(18),
      elevation: dark ? 0 : 1.5,
      shadowColor: DiwanColors.navy.withValues(alpha: .18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: context.cBorder),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1.15,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(
                      color: dark ? const Color(0xFF0E1730) : const Color(0xFFF1F4F9),
                      child: ProductImage(p.img),
                    ),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: dot,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 110),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                            color: bc.bg, borderRadius: BorderRadius.circular(8)),
                        child: Text(
                          badge.txt,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textDirection: TextDirection.ltr,
                          style: TextStyle(
                              fontSize: 10, fontWeight: FontWeight.w800, color: bc.fg),
                        ),
                      ),
                    ),
                    if (tag != null)
                      Positioned(
                        left: 8,
                        bottom: 8,
                        right: 8,
                        child: Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: tag!.bg,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: const [
                                BoxShadow(color: Color(0x33000000), blurRadius: 6, offset: Offset(0, 2))
                              ],
                            ),
                            child: Text(tag!.text,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: tag!.fg)),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (p.brand.isNotEmpty)
                        Text(p.brand,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                color: context.cTextSub)),
                      Text(p.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13.5, fontWeight: FontWeight.w800, height: 1.3)),
                      const Spacer(),
                      Row(children: [
                        Expanded(
                          child: Text(p.price > 0 ? '${_fmt(p.price)} د.ع' : '0 د.ع',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 14,
                                  color: dark ? DiwanColors.gold : const Color(0xFFB45309))),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: (p.inStock ? DiwanColors.success : DiwanColors.danger)
                                .withValues(alpha: .14),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(p.inStock ? stockLabel(p) : 'نافد',
                              style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w900,
                                  color: p.inStock ? DiwanColors.success : DiwanColors.danger)),
                        ),
                      ]),
                      const SizedBox(height: 3),
                      Text(packLine(p),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textDirection: TextDirection.ltr,
                          textAlign: TextAlign.right,
                          style: TextStyle(fontSize: 10.5, color: context.cTextSub)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
