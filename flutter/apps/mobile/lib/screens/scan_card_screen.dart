import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/barcode_dialog.dart';
import '../widgets/product_card.dart' show fmtNum;
import '../widgets/product_image.dart';

String _fmtD(String ym) {
  final m = RegExp(r'^(\d{4})-(\d{2})').firstMatch(ym);
  return m == null ? ym : '${m.group(2)}/${m.group(1)}';
}

String _dmy(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  return m == null ? '' : '${m.group(3)}/${m.group(2)}/${m.group(1)}';
}

/// بطاقة فاحص المادة (scanView): سعر البيع، سعر الشراء (أقل/أعلى/آخر)، تواريخ الانتهاء، حاسبة الخصم.
class ScanCardScreen extends ConsumerStatefulWidget {
  const ScanCardScreen({super.key, this.productId, this.unknownCode});
  final int? productId;
  final String? unknownCode;
  @override
  ConsumerState<ScanCardScreen> createState() => _ScanCardScreenState();
}

class _ScanCardScreenState extends ConsumerState<ScanCardScreen> {
  final _q = TextEditingController();
  final _d = TextEditingController();
  final _p = TextEditingController();
  int? _id;
  DiscountResult? _res;

  @override
  void initState() {
    super.initState();
    _id = widget.productId;
  }

  @override
  void dispose() {
    _q.dispose();
    _d.dispose();
    _p.dispose();
    super.dispose();
  }

  Product? get _prod => _id == null ? null : ref.read(catalogIndexProvider).all.where((x) => x.id == _id).firstOrNull;

  void _calc(String from) {
    final p = _prod;
    if (p == null || !(p.price > 0)) return;
    final profile = ref.read(profileProvider).value;
    final cfg = ref.read(scanConfigProvider).value ?? const ScanConfig();
    double d, fin;
    if (from == 'd') {
      final v = double.tryParse(_d.text);
      if (v == null || v < 0) {
        setState(() => _res = null);
        _p.text = '';
        return;
      }
      d = v;
      fin = p.price * (1 - d / 100);
      _p.text = fin.round().toString();
    } else {
      final v = double.tryParse(_p.text);
      if (v == null || v < 0) {
        setState(() => _res = null);
        _d.text = '';
        return;
      }
      fin = v;
      d = (p.price - fin) / p.price * 100;
      _d.text = ((d * 10).round() / 10).toString();
    }
    final lines = scBuyLines(p, ref.read(purchasesProvider).value ?? const []);
    setState(() => _res = scCalc(p, cfg, owner: profile?.isOwner ?? false, d: d, fin: fin, lastBuyCost: lines.isEmpty ? null : lines.first.cost));
  }

  Future<void> _rescan() async {
    final r = await showBarcodeDialog(context);
    if (r == null || !mounted) return;
    final idx = ref.read(catalogIndexProvider);
    final p = r.product ?? idx.byBarcode(r.code!);
    setState(() {
      _id = p?.id;
      _res = null;
      _d.clear();
      _p.clear();
    });
    if (p == null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('باركود غير مسجّل: ${r.code}'), duration: const Duration(seconds: 2)));
    }
  }

  void _soon(String what) => ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$what تُفعَّل في مرحلة لاحقة'), duration: const Duration(seconds: 1)));

  @override
  Widget build(BuildContext context) {
    final idx = ref.watch(catalogIndexProvider);
    final profile = ref.watch(profileProvider).value!;
    final cfg = ref.watch(scanConfigProvider).value ?? const ScanConfig();
    final purchases = ref.watch(purchasesProvider).value ?? const <Map<String, dynamic>>[];
    final p = _id == null ? null : idx.all.where((x) => x.id == _id).firstOrNull;
    final dark = context.isDark;
    final own = profile.isOwner;
    final navy = dark ? DiwanColors.darkText : const Color(0xFF0F1C38);
    final border = dark ? DiwanColors.darkBorder : const Color(0xFFE5EAF2);

    final results = _q.text.trim().isEmpty ? const <Product>[] : idx.search(_q.text, where: (x) => !x.arch, limit: 8);

    BoxDecoration card() => BoxDecoration(
          color: context.cSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
        );
    Widget sec(List<Widget> ch, {CrossAxisAlignment ca = CrossAxisAlignment.start}) => Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: card(),
          child: Column(crossAxisAlignment: ca, children: [
            for (var i = 0; i < ch.length; i++) ...[if (i > 0) const SizedBox(height: 8), ch[i]]
          ]),
        );
    Widget h4(String t) => Text(t, style: TextStyle(fontSize: 13.1, fontWeight: FontWeight.w800, color: context.isDark ? DiwanColors.darkTextSub : const Color(0xFF475569)));
    Widget mut(String t) => Text(t, style: TextStyle(fontSize: 13.3, color: context.isDark ? DiwanColors.darkTextSub : const Color(0xFF94A3B8)));

    final cards = <Widget>[];
    if (p == null) {
      cards.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 10),
        child: Center(
            child: Text('امسح باركود المادة أو ابحث باسمها',
                style: TextStyle(fontWeight: FontWeight.w700, color: context.cTextSub))),
      ));
    } else {
      final price = p.price;
      cards.add(Container(
        padding: const EdgeInsets.all(12),
        decoration: card(),
        child: Row(children: [
          Container(
            width: 64,
            height: 64,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(color: dark ? const Color(0xFF0E1730) : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
            child: p.img.isEmpty ? Icon(DiwanIcons.pill, size: 28, color: navy) : ProductImage(p.img, cacheWidth: 200),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(dispName(p),
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.right,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: navy, height: 1.5)),
              Text('بالمخزن: ${stockLabel(p)}', style: TextStyle(fontSize: 12, color: context.cTextSub)),
            ]),
          ),
        ]),
      ));
      if (cfg.price) {
        cards.add(sec(ca: CrossAxisAlignment.center, [
          Text('سعر البيع', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: context.cTextSub)),
          Text(price > 0 ? '${fmtNum(price)} د.ع' : '— غير مسعّرة',
              style: TextStyle(fontSize: 30.4, fontWeight: FontWeight.w900, color: navy)),
          if (p.hasRetail)
            Text('سعر ${p.subType}: ${fmtNum(p.subPrice)} د.ع', style: TextStyle(fontSize: 12, color: context.cTextSub)),
        ]));
      }
      final lines = scBuyLines(p, purchases);
      var refCost = jsNum(p.raw['costPrice']);
      if (own && cfg.cost) {
        if (lines.isNotEmpty || refCost > 0) {
          final lo = lines.isEmpty ? null : lines.reduce((a, b) => b.cost < a.cost ? b : a);
          final hi = lines.isEmpty ? null : lines.reduce((a, b) => b.cost > a.cost ? b : a);
          final last = lines.isEmpty ? null : lines.first;
          if (refCost == 0 && last != null) refCost = last.cost;
          Widget cell(String label, BuyLine? l, {String? fallback}) => Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: BoxDecoration(
                      color: dark ? DiwanColors.darkBg : const Color(0xFFF6F8FC), borderRadius: BorderRadius.circular(12)),
                  child: Column(children: [
                    Text(label, style: TextStyle(fontSize: 10.5, color: context.cTextSub)),
                    Text(l != null ? fmtNum(l.cost) : (fallback ?? '—'),
                        style: TextStyle(fontSize: 16.8, fontWeight: FontWeight.w800, color: navy)),
                    if (l != null)
                      Text('${l.supplier} · ${_dmy(l.date)}',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 10.5, color: context.cTextSub)),
                    if (l == null && label == 'آخر سعر') Text('من بطاقة المادة', style: TextStyle(fontSize: 10.5, color: context.cTextSub)),
                  ]),
                ),
              );
          cards.add(sec([
            h4('سعر الشراء'),
            Row(children: [
              cell('أقل سعر', lo),
              const SizedBox(width: 8),
              cell('أعلى سعر', hi),
              const SizedBox(width: 8),
              cell('آخر سعر', last, fallback: fmtNum(refCost)),
            ]),
            if (cfg.marginShow && price > 0 && refCost > 0)
              Builder(builder: (_) {
                final pf = price - refCost, mp = pf / price * 100;
                final worst = hi != null ? price - hi.cost : null;
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                      color: pf < 0 ? const Color(0xFFFEE2E2) : const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(10)),
                  child: Text.rich(TextSpan(children: [
                    const TextSpan(text: 'الربح على آخر سعر شراء: '),
                    TextSpan(text: '${fmtNum(pf)} د.ع (${mp.toStringAsFixed(1)}٪)', style: const TextStyle(fontWeight: FontWeight.w900)),
                    if (worst != null && hi!.cost != refCost)
                      TextSpan(
                          text: '\nعلى أعلى سعر شراء: ${fmtNum(worst)} د.ع (${(worst / price * 100).toStringAsFixed(1)}٪)',
                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500)),
                  ]), style: TextStyle(fontSize: 13.1, fontWeight: FontWeight.w700, color: pf < 0 ? const Color(0xFF991B1B) : const Color(0xFF065F46))),
                );
              }),
          ]));
        } else {
          cards.add(sec([h4('سعر الشراء'), mut('لا يوجد سعر شراء مسجّل لهذه المادة.')]));
        }
      }
      if (cfg.expiry) {
        final ex = productExpiryDates(p);
        final canDel = cfg.del && profile.can('stockEdit') && (own || profile.can('scanDel'));
        cards.add(sec([
          h4('تواريخ الانتهاء'),
          if (ex.isEmpty)
            mut('لا توجد تواريخ مسجّلة.')
          else
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final e in ex)
                Builder(builder: (_) {
                  final d = expiryDaysOf(e);
                  final lv = d == null ? 'ok' : d <= 0 ? 'expired' : d <= 90 ? '3m' : d <= 180 ? '6m' : 'ok';
                  final c = switch (lv) {
                    'expired' => (const Color(0xFFFEE2E2), const Color(0xFFF87171), const Color(0xFF991B1B)),
                    '3m' => (const Color(0xFFFFEDD5), const Color(0xFFFB923C), const Color(0xFFC2410C)),
                    '6m' => (const Color(0xFFFEF9C3), const Color(0xFFFACC15), const Color(0xFF854D0E)),
                    _ => (const Color(0xFFF0FDF4), const Color(0xFF86EFAC), const Color(0xFF166534)),
                  };
                  final label = lv == 'expired' ? 'منتهي' : lv == '3m' ? 'أقل من 3 أشهر' : lv == '6m' ? 'أقل من 6 أشهر' : 'بعيد';
                  return Container(
                    padding: const EdgeInsets.fromLTRB(10, 6, 8, 6),
                    decoration: BoxDecoration(color: c.$1, borderRadius: BorderRadius.circular(12), border: Border.all(color: c.$2, width: 1.5)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(_fmtD(e), textDirection: TextDirection.ltr, style: TextStyle(fontSize: 15.2, fontWeight: FontWeight.w800, color: c.$3)),
                      const SizedBox(width: 8),
                      Text(label, style: TextStyle(fontSize: 10.5, color: c.$3)),
                      if (canDel) ...[
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => _soon('حذف تاريخ النفاذ'),
                          child: Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(color: const Color(0x14000000), borderRadius: BorderRadius.circular(8)),
                            child: Icon(DiwanIcons.close, size: 14, color: c.$3),
                          ),
                        ),
                      ],
                    ]),
                  );
                }),
            ]),
        ]));
      }
      final rawLim = p.raw['dlim'];
      final lim = (rawLim == null || rawLim == '') ? null : jsNum(rawLim);
      final ownLim = own ? scLimitFor(p, cfg) : null;
      final canDisc = own || profile.can('scanDisc');
      if (cfg.calc && canDisc && price > 0) {
        final eff = own && ownLim != null ? ownLim : lim;
        String n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
        Widget input(String label, TextEditingController c, String from, {bool decimal = true}) => Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontSize: 11.8, fontWeight: FontWeight.w800, color: context.isDark ? DiwanColors.darkTextSub : const Color(0xFF475569))),
                const SizedBox(height: 4),
                SizedBox(
                  height: 46,
                  child: TextField(
                    controller: c,
                    onChanged: (_) => _calc(from),
                    keyboardType: TextInputType.numberWithOptions(decimal: decimal),
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5)),
                    ),
                  ),
                ),
              ]),
            );
        Widget chip(String t, double v, {bool mx = false}) => GestureDetector(
              onTap: () {
                _d.text = n(v);
                _calc('d');
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: mx ? const Color(0xFFEDE9FE) : (dark ? DiwanColors.darkBg : const Color(0xFFF8FAFC)),
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(color: mx ? const Color(0xFFA78BFA) : const Color(0xFFCBD5E1)),
                ),
                child: Text(t, style: TextStyle(fontWeight: FontWeight.w800, height: 1.25, color: mx ? const Color(0xFF5B21B6) : navy)),
              ),
            );
        cards.add(sec([
          h4('حاسبة الخصم'),
          if (cfg.limit)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(10)),
              child: eff == null
                  ? const Text('حد الخصم غير محسوب لهذه المادة', style: TextStyle(fontSize: 13.8, fontWeight: FontWeight.w700, color: Color(0xFF0F1C38)))
                  : Text.rich(TextSpan(children: [
                      TextSpan(text: own ? 'حد البائعين: ' : 'أعلى خصم${cfg.mode == 'safe' ? ' آمن' : ' بدون خسارة'}: '),
                      TextSpan(text: '${n(eff)}٪', style: const TextStyle(fontWeight: FontWeight.w900)),
                      if (own && scExact(p) != null)
                        TextSpan(text: ' (بدون خسارة فعلياً ${scExact(p)!.toStringAsFixed(1)}٪)', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                    ]), style: const TextStyle(fontSize: 13.8, fontWeight: FontWeight.w700, color: Color(0xFF0F1C38))),
            ),
          Row(children: [
            input('نسبة الخصم %', _d, 'd'),
            const SizedBox(width: 8),
            input('السعر بعد الخصم', _p, 'p', decimal: false),
          ]),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final v in [5.0, 10.0, 15.0, 20.0]) chip('${v.toInt()}٪', v),
            if (eff != null && eff > 0) chip('أقصى خصم ${n(eff)}٪', eff, mx: true),
          ]),
          if (_res != null)
            Builder(builder: (_) {
              final r = _res!;
              final bg = switch (r.cls) { 'ok' => const Color(0xFFDCFCE7), 'mid' => const Color(0xFFFEF9C3), _ => const Color(0xFFFEE2E2) };
              final fg = switch (r.cls) { 'ok' => const Color(0xFF166534), 'mid' => const Color(0xFF854D0E), _ => const Color(0xFF991B1B) };
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(DiwanIcons.circleDot, size: 12, color: fg),
                    const SizedBox(width: 6),
                    Text(r.msg, style: TextStyle(fontSize: 16.8, fontWeight: FontWeight.w900, color: fg)),
                  ]),
                  Text('خصم ${r.d}٪ ← ${fmtNum(r.fin)} د.ع', style: TextStyle(fontSize: 14, color: fg)),
                  if (r.detail.isNotEmpty) Text.rich(TextSpan(text: r.detail), style: TextStyle(fontSize: 14, color: fg)),
                  if (r.detailNote.isNotEmpty) Text(r.detailNote, style: TextStyle(fontSize: 11.5, color: fg)),
                ]),
              );
            }),
        ]));
      } else if (cfg.limit && (lim != null || ownLim != null) && canDisc) {
        cards.add(sec([
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(10)),
            child: Text('أعلى خصم: ${lim ?? ''}٪', style: const TextStyle(fontSize: 13.8, fontWeight: FontWeight.w700, color: Color(0xFF0F1C38))),
          ),
        ]));
      }
    }

    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      appBar: DiwanHeader(
        title: 'فاحص المادة',
        icon: DiwanIcons.searchIcon,
        trailing: [
          DiwanIconButton(icon: DiwanIcons.stock, tooltip: 'المخزن', onTap: () => goStock(context)),
          DiwanIconButton(icon: DiwanIcons.home, tooltip: 'الرئيسية', onTap: () => goHome(context)),
        ],
        sideWidget: GestureDetector(
          onTap: () => Navigator.of(context).maybePop(),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: .15), borderRadius: BorderRadius.circular(10)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(DiwanIcons.chevLeft, size: 16, color: Colors.white),
              SizedBox(width: 4),
              Text('رجوع', style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w700, color: Colors.white)),
            ]),
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(10, 14, 10, 30 + top * 0),
        children: [
          GestureDetector(
            onTap: _rescan,
            child: Container(
              height: 84,
              decoration: BoxDecoration(
                gradient: const LinearGradient(begin: Alignment(-.6, -1), end: Alignment(.6, 1), colors: [Color(0xFF4C1D95), Color(0xFF7C3AED)]),
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [BoxShadow(color: Color(0x667C3AED), blurRadius: 20, spreadRadius: -6, offset: Offset(0, 10))],
              ),
              child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(DiwanIcons.scanLine, size: 34, color: Colors.white),
                SizedBox(width: 12),
                Text('مسح باركود', style: TextStyle(fontSize: 13.33, fontWeight: FontWeight.w400, color: Colors.white)),
              ]),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 46,
            child: TextField(
              controller: _q,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'أو ابحث باسم المادة...',
                hintStyle: TextStyle(fontSize: 15, color: context.cTextSub),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
              ),
            ),
          ),
          for (final x in results)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Material(
                color: context.cSurface,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: border)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => setState(() {
                    _id = x.id;
                    _q.clear();
                    _res = null;
                    _d.clear();
                    _p.clear();
                  }),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 48),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(children: [
                      Expanded(
                          child: Text(dispName(x),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textDirection: TextDirection.ltr,
                              textAlign: TextAlign.right,
                              style: TextStyle(fontSize: 14.4, fontWeight: FontWeight.w800, color: navy))),
                      const SizedBox(width: 8),
                      Text(fmtNum(x.price), style: TextStyle(fontWeight: FontWeight.w800, color: navy)),
                    ]),
                  ),
                ),
              ),
            ),
          SizedBox(height: results.isEmpty ? 44 : 10),
          for (var i = 0; i < cards.length; i++) ...[if (i > 0) const SizedBox(height: 10), cards[i]],
        ],
      ),
    );
  }
}
