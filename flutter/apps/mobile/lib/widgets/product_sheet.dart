import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';

import 'product_card.dart';
import 'product_image.dart';

const _gold = DiwanColors.goldDeep;

String batchText(Batch b, Product p) {
  final parts = <String>[
    if (b.q > 0) '${b.q} علبة',
    if (b.l > 0) '${b.l} ${p.subType}',
  ];
  return parts.isEmpty ? '0' : parts.join(' + ');
}

String _dmy(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  return m == null ? '' : '${m.group(3)}/${m.group(2)}/${m.group(1)}';
}

/// حالة صلاحية التاريخ (مرآة getExpiryStatus): ألوان الشريحة.
({Color bg, Color fg}) expiryColors(String date) {
  final d = expiryDaysOf(date);
  if (d == null) return (bg: const Color(0xFFF1F5F9), fg: const Color(0xFF334155));
  if (d <= 0) return (bg: const Color(0xFFFEE2E2), fg: const Color(0xFF991B1B));
  if (d <= 90) return (bg: const Color(0xFFFFEDD5), fg: const Color(0xFFC2410C));
  if (d <= 180) return (bg: const Color(0xFFFEF9C3), fg: const Color(0xFF854D0E));
  return (bg: const Color(0xFFF1F5F9), fg: const Color(0xFF334155));
}

/// بطاقة المادة التفصيلية (openSheet): نفس الترتيب والقياسات. أزرار الكتابة تُفعَّل في مراحلها.
Future<void> showProductSheet(BuildContext context, Product p,
    {required AlertConfig cfg, required UserProfile profile, required CatalogIndex index}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => Directionality(
      textDirection: TextDirection.rtl,
      child: _Sheet(p: p, cfg: cfg, profile: profile, index: index),
    ),
  );
}

class _Sheet extends StatefulWidget {
  const _Sheet({required this.p, required this.cfg, required this.profile, required this.index});
  final Product p;
  final AlertConfig cfg;
  final UserProfile profile;
  final CatalogIndex index;
  @override
  State<_Sheet> createState() => _SheetState();
}

class _SheetState extends State<_Sheet> {
  late Product p = widget.p;
  bool _priceOpen = false;

  void _soon(String what) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$what تُفعَّل في مرحلة لاحقة'), duration: const Duration(seconds: 1)));

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    final navy = dark ? DiwanColors.darkText : DiwanColors.navy;
    final canEdit = widget.profile.can('stockEdit');
    final owner = widget.profile.isOwner;
    final badge = formBadge(p);
    final bc = badgeColors(badge.cls);
    final cleanMeta = packLine(p);
    final active = jsStr(p.raw['activeIngredient']);
    final details = jsStr(p.raw['details']);
    final low = isLowStock(p, widget.cfg);

    final bt = p.raw['bt'] != null ? getBatches(p).where((b) => b.e.isNotEmpty).toList() : null;
    final dateOnly = <String>[
      if (p.raw['bt'] is Map)
        for (final e in (p.raw['bt'] as Map).entries)
          if (e.value is Map &&
              e.value['d'] != null &&
              !(jsInt(e.value['q']) > 0 || jsInt(e.value['l']) > 0) &&
              e.key != 'none')
            btDate('${e.key}')
    ];
    final expDates = bt != null
        ? ({...bt.map((b) => b.e), ...dateOnly}.toList()..sort())
        : productExpiryDates(p);
    final btCnt = <String, List<String>>{};
    for (final b in bt ?? const <Batch>[]) {
      (btCnt[b.e] ??= []).add('${batchText(b, p)}${b.pr > 0 ? ' (${fmtNum(b.pr)} د.ع)' : ''}');
    }
    final alts = alternativesOf(p, widget.index.all);
    final cost = jsNum(p.raw['costPrice']);

    Widget stockTag = Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: p.inStock ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(p.inStock ? 'متوفر (${p.qty})' : 'نافذ (0)',
          style: TextStyle(
              fontSize: 12.8,
              fontWeight: FontWeight.w800,
              height: 1.4,
              color: p.inStock ? const Color(0xFF15803D) : const Color(0xFFB91C1C))),
    );

    Widget section({required List<Widget> children, bool alt = false}) => Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: dark ? DiwanColors.darkBg : const Color(0xFFF5F7FB),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: dark ? DiwanColors.darkBorder : const Color(0xFFE8ECF4)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(children: [
            const Positioned(right: 0, top: 0, bottom: 0, width: 4, child: ColoredBox(color: _gold)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 20, 14),
              child: SizedBox(
                width: double.infinity,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
              ),
            ),
          ]),
        );
    Widget h4(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t, style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w700, color: context.cTextSub)));
    Widget body(String t, {bool ltr = false}) => Align(
          alignment: AlignmentDirectional.centerStart,
          child: Text(ltr ? '‎$t' : t,
              textDirection: ltr ? TextDirection.ltr : null,
              style: TextStyle(fontSize: 15.52, fontWeight: FontWeight.w500, height: 1.7, color: dark ? DiwanColors.darkText : const Color(0xFF0F172A))),
        );

    Widget line(String k, IconData ic, Widget v, {bool muted = false}) => Container(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: context.cBorder))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(ic, size: 16, color: context.cTextSub),
            const SizedBox(width: 6),
            Text(k,
                style: TextStyle(
                    fontSize: 14.4,
                    fontWeight: FontWeight.w700,
                    color: muted ? context.cTextSub : (dark ? DiwanColors.darkText : const Color(0xFF334155)))),
            const SizedBox(width: 10),
            Expanded(child: Align(alignment: AlignmentDirectional.centerEnd, child: v)),
          ]),
        );

    final lp = p.raw['lastPurchase'];
    final lpMap = lp is Map ? lp : null;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .9,
      minChildSize: .5,
      maxChildSize: .92,
      builder: (ctx, scroll) => Container(
        decoration: BoxDecoration(
          color: context.cSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 36, offset: Offset(0, -12))],
        ),
        child: ListView(
          controller: scroll,
          padding: EdgeInsets.fromLTRB(20, 14, 20, 30 + MediaQuery.of(context).padding.bottom),
          children: [
            Center(
              child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(color: const Color(0xFFCDD4E2), borderRadius: BorderRadius.circular(10))),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 44,
              child: Row(children: [
                Material(
                  color: dark ? const Color(0xFF1E2B4A) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => Navigator.pop(context),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(DiwanIcons.chevLeft, size: 17, color: navy),
                        const SizedBox(width: 4),
                        Text('رجوع', style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w700, color: navy)),
                      ]),
                    ),
                  ),
                ),
                const Spacer(),
                if (owner || canEdit)
                  Material(
                    color: context.cSurface,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: Color(0xFFCBD5E1), width: 2)),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _soon('ضم المادة'),
                      child: SizedBox(width: 44, height: 44, child: Icon(DiwanIcons.merge, size: 20, color: navy)),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 10),
            // رأس المادة: صورة (يمين) + العنوان
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CustomPaint(
                painter: p.img.isEmpty ? _DashedBox(context.cBorder) : null,
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: dark ? const Color(0xFF0E1730) : const Color(0xFFF5F7FB),
                    borderRadius: BorderRadius.circular(18),
                    border: p.img.isEmpty ? null : Border.all(color: context.cBorder),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: p.img.isEmpty
                      ? Stack(children: [
                          Center(
                            child: Text('بدون صورة',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: context.cTextSub)),
                          ),
                          if (owner || canEdit)
                            Positioned(
                              left: 7,
                              bottom: 8,
                              child: Container(
                                width: 32,
                                height: 32,
                                decoration: const BoxDecoration(color: Color(0xD90F1C38), shape: BoxShape.circle),
                                child: const Icon(DiwanIcons.camera, size: 17, color: Colors.white),
                              ),
                            ),
                        ])
                      : ProductImage(p.img, fit: BoxFit.contain, cacheWidth: 400),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.brand,
                      style: const TextStyle(fontSize: 12.8, fontWeight: FontWeight.w800, color: Color(0xFFA85D08))),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerRight,
                    child: SelectableText(p.name,
                        textDirection: TextDirection.ltr,
                        textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, height: 1.3, color: navy)),
                  ),
                  const SizedBox(height: 8),
                  Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                    Text(fmtNum(p.price),
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: navy)),
                    const SizedBox(width: 4),
                    Text('د.ع', style: TextStyle(fontSize: 13.6, fontWeight: FontWeight.w800, color: context.cTextSub)),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    stockTag,
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(color: bc.bg, borderRadius: BorderRadius.circular(7)),
                      child: Text(badge.txt,
                          textDirection: TextDirection.ltr,
                          style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w800, height: 1.4, color: bc.fg)),
                    ),
                  ]),
                ]),
              ),
            ]),
            const SizedBox(height: 18),
            section(children: [
              h4('التركيب والاستخدام الطبي'),
              if (active.isNotEmpty) body(active, ltr: true),
              if (details.isNotEmpty) body(details),
              const SizedBox(height: 4),
              h4('العبوة | الشكل الدوائي'),
              body(cleanMeta, ltr: true),
            ]),
            if (canEdit)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: context.cSurface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.cBorder),
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(children: [
                  const Positioned(left: 0, right: 0, top: 0, height: 3, child: ColoredBox(color: _gold)),
                  const Positioned(right: 0, top: 0, bottom: 0, width: 3, child: ColoredBox(color: _gold)),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 17, 17, 16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(DiwanIcons.settings, size: 18, color: context.cTextSub),
                    const SizedBox(width: 8),
                    Text('تحكم الصيدلي المباشر', style: ruqaa(size: 15.2, color: navy)),
                  ]),
                  const SizedBox(height: 14),
                  Row(children: [
                    Text('الكمية', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: navy)),
                    if (low)
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(8)),
                        child: const Text('كمية قليلة',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A))),
                      ),
                    const Spacer(),
                    Container(
                      width: 158,
                      height: 58,
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: dark ? DiwanColors.darkBg : const Color(0xFFF5F7FB),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.cBorder),
                      ),
                      child: Row(children: [
                        _GoldBtn('−', () => _soon('تعديل الكمية')),
                        Expanded(
                          child: Center(
                            child: Text(stockLabel(p),
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: navy)),
                          ),
                        ),
                        _GoldBtn('+', () => _soon('تعديل الكمية')),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  // تواريخ النفاذ
                  if (expDates.isNotEmpty)
                    line(
                      expDates.length > 1 ? 'تواريخ النفاذ' : 'تاريخ النفاذ',
                      DiwanIcons.calendar,
                      Wrap(spacing: 4, runSpacing: 3, alignment: WrapAlignment.end, children: [
                        for (final dt in expDates)
                          Builder(builder: (_) {
                            final c = expiryColors(dt);
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
                              decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(6)),
                              child: Text(
                                  '\u2066$dt\u2069${btCnt[dt] != null ? ' × ${btCnt[dt]!.join(' + ')}' : ''}',
                                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.fg)),
                            );
                          }),
                      ]),
                    )
                  else
                    line('تاريخ النفاذ', DiwanIcons.calendar, Text('غير محدد', style: TextStyle(color: context.cTextSub)), muted: true),
                  // التسعير
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 8),
                    decoration: BoxDecoration(
                      color: context.cSurface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.cBorder),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(children: [
                      InkWell(
                        onTap: () => setState(() => _priceOpen = !_priceOpen),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          child: Row(children: [
                            Icon(DiwanIcons.wallet, size: 17, color: navy),
                            const SizedBox(width: 6),
                            Text('التسعير', style: TextStyle(fontSize: 13.1, fontWeight: FontWeight.w800, color: navy)),
                            const Spacer(),
                            Text('${p.price > 0 ? '${fmtNum(p.price)} د.ع · ' : ''}${_pricingShort(p)}',
                                style: TextStyle(fontSize: 11.8, fontWeight: FontWeight.w700, color: context.cTextSub)),
                            const SizedBox(width: 8),
                            Icon(DiwanIcons.chevDown, size: 16, color: const Color(0xFF94A3B8)),
                          ]),
                        ),
                      ),
                      if (_priceOpen) _PricingBody(p: p, owner: owner),
                    ]),
                  ),
                  if (cost > 0)
                    line('سعر الشراء الحالي', DiwanIcons.wallet, Text('${fmtNum(cost)} د.ع', style: TextStyle(fontWeight: FontWeight.w800, color: navy))),
                  if (lpMap != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(8)),
                      child: Text(
                          'آخر وارد: ${jsStr(lpMap['supplier'])} — ${_dmy(jsStr(lpMap['date']))} — ${fmtNum(jsNum(lpMap['qty']))} عبوة${jsNum(lpMap['cost']) > 0 ? ' × ${fmtNum(jsNum(lpMap['cost']))}' : ''} — فاتورة ${jsStr(lpMap['no'])}',
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF065F46))),
                    )
                  else
                    line('آخر وارد', DiwanIcons.lastIn, Text('لا يوجد وارد مسجّل', style: TextStyle(color: context.cTextSub)), muted: true),
                  const SizedBox(height: 4),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 166 / 50,
                    children: [
                      _Act('تعديل الصنف', DiwanIcons.edit, () => _soon('تعديل الصنف')),
                      _Act('منتهي / تالف', DiwanIcons.trash, () => _soon('الإتلاف')),
                      _Act('مناقلة', DiwanIcons.transfer, () => _soon('المناقلة')),
                      _Act('إرجاع لمذخر', DiwanIcons.returnBack, () => _soon('الإرجاع')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 50,
                    child: _Act('حذف الصنف', DiwanIcons.trash, () => _soon('الحذف'), danger: true),
                  ),
                    ]),
                  ),
                ]),
              ),
            if (p.hasRetail)
              section(children: [
                Text.rich(TextSpan(children: [
                  const TextSpan(text: 'تُباع بالتجزئة: '),
                  TextSpan(text: p.subType, style: const TextStyle(fontWeight: FontWeight.w900)),
                  const TextSpan(text: ' بسعر '),
                  TextSpan(text: '${fmtNum(p.subPrice)} د.ع', style: const TextStyle(fontWeight: FontWeight.w900)),
                  TextSpan(text: ' (العبوة = ${p.subCount} ${p.subType})', style: TextStyle(color: context.cTextSub, fontWeight: FontWeight.w600)),
                ]), style: const TextStyle(fontSize: 13.4, fontWeight: FontWeight.w700)),
              ]),
            if (alts.isNotEmpty)
              section(children: [
                h4('بدائل بنفس المادة الفعالة (${alts.length})'),
                for (final a in alts)
                  InkWell(
                    onTap: () {
                      setState(() => p = a);
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                      decoration: BoxDecoration(
                        color: context.cSurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: context.cBorder),
                      ),
                      child: Opacity(
                        opacity: a.inStock ? 1 : .6,
                        child: Row(children: [
                          Container(width: 9, height: 9, decoration: BoxDecoration(color: a.inStock ? DiwanColors.success : DiwanColors.danger, shape: BoxShape.circle)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(a.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 13.76, fontWeight: FontWeight.w800, color: navy)),
                              Text('${a.brand}${a.price > 0 ? ' | ${fmtNum(a.price)} د.ع' : ''}${a.inStock ? '' : ' | نافذ'}',
                                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: context.cTextSub)),
                            ]),
                          ),
                          Container(
                            constraints: const BoxConstraints(maxWidth: 130),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFEAEEF6), borderRadius: BorderRadius.circular(6)),
                            child: Text(fixMetaOrder(a.meta),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textDirection: TextDirection.ltr,
                                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: DiwanColors.navySoft)),
                          ),
                        ]),
                      ),
                    ),
                  ),
              ]),
          ],
        ),
      ),
    );
  }
}

String _pricingShort(Product p) => switch (p.raw['pricing']) {
      'syndicate' => 'النقابة',
      'percent' => 'نسبة',
      'free' => 'يدوي',
      _ => 'وزارة الصحة',
    };

class _PricingBody extends StatelessWidget {
  const _PricingBody({required this.p, required this.owner});
  final Product p;
  final bool owner;
  @override
  Widget build(BuildContext context) {
    final price = p.price, cost = jsNum(p.raw['costPrice']);
    final mode = switch (p.raw['pricing']) {
      'syndicate' => 'كتاب النقابة',
      'percent' => 'نسبة إضافة',
      'free' => 'يدوي',
      _ => 'تسعيرة وزارة الصحة (الملصق)',
    };
    Widget row(String k, String v, {Color? c}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Text(k, style: TextStyle(fontSize: 12.5, color: context.cTextSub, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: c)),
          ]),
        );
    final rows = <Widget>[
      row('طريقة التسعير', mode),
      if (p.raw['pricing'] == 'percent' && cost > 0)
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Text('سعر الشراء ${fmtNum(cost)} + ${jsNum(p.raw['markupPct']).round()}٪ = ${fmtNum(price)}',
                style: TextStyle(fontSize: 12, color: context.cTextSub))),
      row('سعر البيع', price > 0 ? '${fmtNum(price)} د.ع' : 'غير مسعّر', c: price > 0 ? null : DiwanColors.danger),
      if (owner) row('سعر الشراء', cost > 0 ? '${fmtNum(cost)} د.ع' : 'غير مسجّل'),
      if (owner && price > 0 && cost > 0)
        row('الربح', '${fmtNum(price - cost)} د.ع (${((price - cost) / price * 100).toStringAsFixed(1)}٪)',
            c: price - cost < 0 ? DiwanColors.danger : DiwanColors.success),
      if (p.hasRetail)
        row('البيع بالتجزئة', '${p.subCount} ${p.subType} بالعبوة · سعر الجزء ${p.subPrice > 0 ? fmtNum(p.subPrice) : '—'}'),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: context.cBorder))),
      child: Column(children: rows),
    );
  }
}

class _GoldBtn extends StatelessWidget {
  const _GoldBtn(this.glyph, this.onTap);
  final String glyph;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: _gold,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          borderRadius: BorderRadius.circular(11),
          onTap: onTap,
          child: SizedBox(
              width: 48,
              height: 48,
              child: Center(
                  child: Text(glyph,
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800, height: 1.1, color: DiwanColors.navy)))),
        ),
      );
}

class _Act extends StatelessWidget {
  const _Act(this.label, this.icon, this.onTap, {this.danger = false});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool danger;
  @override
  Widget build(BuildContext context) {
    final fg = danger ? const Color(0xFFB91C1C) : (context.isDark ? DiwanColors.darkText : DiwanColors.navy);
    return Material(
      color: danger ? const Color(0xFFFEE2E2) : context.cSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: danger ? const Color(0xFFFECACA) : context.cBorder),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text(label, style: TextStyle(fontSize: 14.4, fontWeight: FontWeight.w800, color: fg)),
          const SizedBox(width: 8),
          Icon(icon, size: 17, color: fg),
        ]),
      ),
    );
  }
}

class _DashedBox extends CustomPainter {
  _DashedBox(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(18)));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, d + 4), paint);
        d += 7;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
