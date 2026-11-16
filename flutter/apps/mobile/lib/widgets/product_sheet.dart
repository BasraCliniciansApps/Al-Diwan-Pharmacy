import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'product_card.dart';
import 'product_image.dart';

String _fmt(num n) => n
    .round()
    .toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');

String batchText(Batch b, Product p) {
  final parts = <String>[
    if (b.q > 0) '${b.q} علبة',
    if (b.l > 0) '${b.l} ${p.subType}',
  ];
  return parts.isEmpty ? '0' : parts.join(' + ');
}

({String label, Color bg, Color fg})? expiryChip(String date, {DateTime? today}) {
  final d = expiryDaysOf(date, today: today);
  if (d == null) return null;
  if (d <= 0) return (label: 'منتهية', bg: const Color(0xFF991B1B), fg: Colors.white);
  if (d <= 90) return (label: 'أقل من 3 أشهر', bg: const Color(0xFFEA580C), fg: Colors.white);
  if (d <= 180) return (label: 'أقل من 6 أشهر', bg: const Color(0xFFFDE68A), fg: const Color(0xFF713F12));
  return null;
}

/// بطاقة المادة التفصيلية (فاحص المادة): للقراءة فقط في م1.
Future<void> showProductSheet(BuildContext context, Product p,
    {required AlertConfig cfg, required bool isOwner}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: context.cSurface,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26))),
    builder: (_) => Directionality(
      textDirection: TextDirection.rtl,
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: .82,
        minChildSize: .5,
        maxChildSize: .95,
        builder: (ctx, scroll) => _Sheet(p: p, cfg: cfg, isOwner: isOwner, scroll: scroll),
      ),
    ),
  );
}

class _Sheet extends StatelessWidget {
  const _Sheet({required this.p, required this.cfg, required this.isOwner, required this.scroll});
  final Product p;
  final AlertConfig cfg;
  final bool isOwner;
  final ScrollController scroll;

  Widget _row(BuildContext c, String k, String v, {Color? color, bool ltr = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              width: 108,
              child: Text(k, style: TextStyle(color: c.cTextSub, fontWeight: FontWeight.w700, fontSize: 13))),
          Expanded(
            child: Text(v,
                textDirection: ltr ? TextDirection.ltr : null,
                textAlign: ltr ? TextAlign.left : TextAlign.start,
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: color)),
          ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final badge = formBadge(p);
    final bc = badgeColors(badge.cls);
    final k = alertKinds(p, cfg);
    final batches = getBatches(p).where((b) => b.e.isNotEmpty || p.raw['bt'] != null).toList();
    final cost = jsNum(p.raw['costPrice']);
    final details = jsStr(p.raw['details']);
    final active = jsStr(p.raw['activeIngredient']);
    return ListView(
      controller: scroll,
      padding: EdgeInsets.fromLTRB(18, 10, 18, 24 + MediaQuery.of(context).padding.bottom),
      children: [
        Center(
          child: Container(
              width: 44, height: 5,
              decoration: BoxDecoration(color: context.cBorder, borderRadius: BorderRadius.circular(3))),
        ),
        const SizedBox(height: 14),
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: AspectRatio(
            aspectRatio: 1.6,
            child: ColoredBox(
              color: context.isDark ? const Color(0xFF0E1730) : const Color(0xFFF1F4F9),
              child: ProductImage(p.img, fit: BoxFit.contain, cacheWidth: 900),
            ),
          ),
        ),
        const SizedBox(height: 14),
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: bc.bg, borderRadius: BorderRadius.circular(9)),
            child: Text(badge.txt,
                textDirection: TextDirection.ltr,
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: bc.fg)),
          ),
          const SizedBox(width: 8),
          if (p.brand.isNotEmpty)
            Expanded(
              child: Text(p.brand,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)),
            ),
        ]),
        const SizedBox(height: 8),
        SelectableText(dispName(p),
            style: ruqaa(size: 22, color: context.cTitle).copyWith(height: 1.4)),
        const SizedBox(height: 10),
        Row(children: [
          Text('${_fmt(p.price)} د.ع',
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: context.isDark ? DiwanColors.gold : const Color(0xFFB45309))),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: (p.inStock ? DiwanColors.success : DiwanColors.danger).withValues(alpha: .14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(p.inStock ? 'متوفر: ${stockLabel(p)}' : 'نافد',
                style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: p.inStock ? DiwanColors.success : DiwanColors.danger)),
          ),
        ]),
        if (k.low && !p.arch)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('كمية قليلة (الحد الأدنى ${minQty(p, cfg)})',
                style: const TextStyle(color: Color(0xFF1E3A8A), fontWeight: FontWeight.w800)),
          ),
        const Divider(height: 28),
        if (p.hasRetail) ...[
          _row(context, 'البيع بالجزء', '${p.subCount} ${p.subType} في العبوة · ${_fmt(p.subPrice)} د.ع للجزء'),
        ],
        if (active.isNotEmpty) _row(context, 'المادة الفعالة', active, ltr: true),
        if (jsStr(p.raw['category']).isNotEmpty) _row(context, 'التصنيف', p.cats.join('، ')),
        if (details.isNotEmpty) _row(context, 'الاستخدام', details),
        if (p.barcodes.isNotEmpty) _row(context, 'الباركود', p.barcodes.join('\n'), ltr: true),
        if (isOwner && cost > 0) _row(context, 'سعر الشراء', '${_fmt(cost)} د.ع'),
        if (batches.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('الدفعات وتواريخ النفاذ',
              style: ruqaa(size: 18, color: context.cTitle)),
          const SizedBox(height: 6),
          for (final b in batches)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: context.isDark ? DiwanColors.darkBg : DiwanColors.bg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.cBorder),
              ),
              child: Row(children: [
                Text(b.e.isEmpty ? 'بلا تاريخ' : b.e,
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(width: 8),
                if (b.e.isNotEmpty)
                  Builder(builder: (_) {
                    final c = expiryChip(b.e);
                    if (c == null) return const SizedBox.shrink();
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(8)),
                      child: Text(c.label,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: c.fg)),
                    );
                  }),
                const Spacer(),
                if (b.pr > 0)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 10),
                    child: Text('${_fmt(b.pr)} د.ع',
                        style: TextStyle(fontSize: 12, color: context.cTextSub)),
                  ),
                Text(batchText(b, p), style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
            ),
        ],
        const SizedBox(height: 14),
        if (p.barcodes.isNotEmpty)
          OutlinedButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: p.barcodes.first));
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('تم نسخ الباركود'), duration: Duration(seconds: 1)));
            },
            icon: const Icon(DiwanIcons.copy, size: 18),
            label: const Text('نسخ الباركود'),
          ),
      ],
    );
  }
}
