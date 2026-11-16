import 'dart:math' as math;

import 'js_compat.dart';
import 'product.dart';

/// إعدادات فاحص المادة (SC_DEF في scanner.js) من pharmacy/metadata.scan.
class ScanConfig {
  const ScanConfig({
    this.on = true,
    this.posCount = false,
    this.mode = 'safe',
    this.margin = 5,
    this.step = 5,
    this.price = true,
    this.cost = true,
    this.marginShow = true,
    this.expiry = true,
    this.del = true,
    this.calc = true,
    this.limit = true,
  });
  final bool on, posCount, price, cost, marginShow, expiry, del, calc, limit;
  final String mode; // safe | exact
  final double margin, step;

  factory ScanConfig.fromMap(Map<String, dynamic>? m) {
    if (m == null) return const ScanConfig();
    final sh = m['show'] is Map ? Map<String, dynamic>.from(m['show'] as Map) : const <String, dynamic>{};
    bool b(Object? v, bool d) => v is bool ? v : d;
    return ScanConfig(
      on: b(m['on'], true),
      posCount: b(m['posCount'], false),
      mode: m['mode'] == 'exact' ? 'exact' : 'safe',
      margin: m['margin'] is num ? (m['margin'] as num).toDouble() : 5,
      step: m['step'] is num ? (m['step'] as num).toDouble() : 5,
      price: b(sh['price'], true),
      cost: b(sh['cost'], true),
      marginShow: b(sh['margin'], true),
      expiry: b(sh['expiry'], true),
      del: b(sh['del'], true),
      calc: b(sh['calc'], true),
      limit: b(sh['limit'], true),
    );
  }
}

/// النسبة الفعلية للربح بدون خسارة: (السعر − الكلفة) / السعر × 100، أو null.
double? scExact(Product p) {
  final pr = jsNum(p.raw['price']), c = jsNum(p.raw['costPrice']);
  return pr > 0 && c > 0 ? math.max(0, (pr - c) / pr * 100) : null;
}

/// حد الخصم للبائعين (scLimitFor): null = لا يتغير.
double? scLimitFor(Product p, ScanConfig c) {
  final ex = scExact(p);
  if (ex == null) return null;
  if (c.mode == 'exact') return (ex * 10).floorToDouble() / 10;
  final st = math.max(1, c.step.isNaN || c.step == 0 ? 5 : c.step);
  final mg = c.margin.isNaN ? 0 : c.margin;
  return math.max(0, ((ex - mg) / st).floorToDouble() * st);
}

/// سطر شراء واحد (من pharmacy_purchases) لمادة.
class BuyLine {
  const BuyLine(this.cost, this.supplier, this.date);
  final double cost;
  final String supplier, date; // date = YYYY-MM-DD
}

/// سطور الشراء المعتمدة للمادة (أحدثها أولاً)، من وثائق الوارد غير الملغاة.
List<BuyLine> scBuyLines(Product p, Iterable<Map<String, dynamic>> purchases) {
  final out = <BuyLine>[];
  for (final r in purchases) {
    if (r['cancelled'] == true) continue;
    final items = r['items'];
    if (items is! List) continue;
    for (final l in items) {
      if (l is! Map) continue;
      final pid = jsParseInt(l['pid']);
      final sameName = pid == null && _key(jsStr(l['name'])) == _key(p.name);
      if ((pid == p.id || sameName) && jsNum(l['cost']) > 0 && jsNum(l['qty']) > 0) {
        out.add(BuyLine(jsNum(l['cost']), jsStr(r['supplier']), jsStr(r['date'])));
      }
    }
  }
  return stableSorted(out, (a, b) => b.date.compareTo(a.date));
}

String _key(String s) => s.toLowerCase().replaceAll(RegExp(r'\s+'), ' ').trim();

/// نتيجة حاسبة الخصم (scCalc).
class DiscountResult {
  const DiscountResult(this.cls, this.msg, this.d, this.fin, this.detail, {this.detailNote = ''});
  final String cls; // ok | mid | bad
  final String msg;
  final double d, fin;
  final String detail; // ربحك بعد الخصم
  final String detailNote; // أعلى من حد البائعين
}

/// owner: المدير يرى الربح؛ غيره يرى حالة الحد الآمن فقط (لا يُكشف سعر الشراء).
DiscountResult scCalc(
  Product p,
  ScanConfig cfg, {
  required bool owner,
  required double d,
  required double fin,
  double? lastBuyCost,
}) {
  var cls = 'ok', msg = '', det = '', note = '';
  if (owner) {
    final cost = jsNum(p.raw['costPrice']) > 0 ? jsNum(p.raw['costPrice']) : (lastBuyCost ?? 0);
    final lim = scLimitFor(p, cfg);
    if (cost > 0) {
      final pf = fin - cost, pp = fin > 0 ? pf / fin * 100 : -100;
      if (pf < 0) {
        cls = 'bad';
        msg = 'خسارة';
      } else if (pp < cfg.margin) {
        cls = 'mid';
        msg = 'هامش ضعيف';
      } else {
        cls = 'ok';
        msg = 'رابح';
      }
      det = 'ربحك بعد الخصم: ${_fmt(pf)} د.ع (${pp.toStringAsFixed(1)}٪)';
    } else {
      cls = 'mid';
      msg = 'لا توجد كلفة';
    }
    if (lim != null && d > lim) note = 'أعلى من حد البائعين (${_n(lim)}٪)';
  } else {
    final raw = p.raw['dlim'];
    final lim = (raw == null || raw == '') ? null : jsNum(raw);
    if (lim == null) {
      cls = 'mid';
      msg = 'حد الخصم غير محسوب';
    } else if (lim <= 0) {
      cls = 'bad';
      msg = 'لا يسمح بخصم';
    } else if (d <= lim + 1e-9) {
      cls = 'ok';
      msg = 'آمن';
    } else {
      cls = 'bad';
      msg = cfg.mode == 'safe' ? 'يتجاوز الحد الآمن' : 'خسارة';
    }
  }
  return DiscountResult(cls, msg, (d * 10).roundToDouble() / 10, fin.roundToDouble(), det, detailNote: note);
}

String _fmt(num n) => n.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
String _n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
