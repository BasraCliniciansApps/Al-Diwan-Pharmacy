import '../forms_table.dart';
import 'js_compat.dart';
import 'product.dart';

// ───────────── العرض: الاسم وسطر العبوة ─────────────

/// مطابق لـ fixMetaOrder.
String fixMetaOrder(String? m) {
  if (m == null || m.isEmpty) return '';
  var f = m.replaceFirstMapped(
      RegExp(r'^(Tablets|Capsules|Capsule|Drops|Syrup|ml|g)\s*\|\s*([A-Za-z\s]+)\s+(\d+)$', caseSensitive: false),
      (x) => '${x.group(3)} ${x.group(1)} | ${x.group(2)}');
  f = f.replaceFirstMapped(
      RegExp(r'^(Syrup|Drops|Solution|Cream|Gel|Ointment)\s*\|\s*(\d+\s*(?:ml|g))$', caseSensitive: false),
      (x) => '${x.group(2)} | ${x.group(1)}');
  return f;
}

final _formTail = RegExp(r'\s*\(.*$');

/// الشكل الدوائي يؤخذ فقط إن حُدِّد صراحةً في المادة (لا نخمّنه).
String dispForm(Product p) {
  final f = p.form;
  if (f == null) return '';
  if (f == 'other') return p.formOther.trim();
  for (final x in diwanForms) {
    if (x.id == f) return x.txt.replaceFirst(_formTail, '').trim();
  }
  return '';
}

/// سطر «حجم العبوة | الشكل الدوائي».
String packLine(Product p) {
  final m = fixMetaOrder(p.meta).trim();
  final f = dispForm(p);
  if (f.isEmpty || m.contains('|') || m.toLowerCase().contains(f.toLowerCase())) return m;
  return m.isNotEmpty ? '$m | $f' : f;
}

class DispParts {
  DispParts(this.name, this.mid, this.brand);
  final String name, brand;
  final List<String> mid;
}

DispParts dispParts(Product p, {bool part = false}) {
  final asPart = part && p.hasRetail;
  return DispParts(
    p.name,
    [asPart ? p.subType : fixMetaOrder(p.meta).trim(), dispForm(p)]
        .where((s) => s.isNotEmpty)
        .toList(),
    p.brand,
  );
}

/// «الاسم والتركيز | حجم العبوة والشكل الدوائي | الشركة»
String dispName(Product p, {bool part = false}) {
  final d = dispParts(p, part: part);
  return [d.name, d.mid.join(' '), d.brand].where((s) => s.isNotEmpty).join(' | ');
}

String stockLabel(Product p) {
  if (p.hasRetail && p.loose > 0) return '${p.qty} عبوة + ${p.loose} ${p.subType}';
  return '${p.qty}';
}

// ───────────── الدفعات وتواريخ النفاذ ─────────────

class Batch {
  Batch({required this.e, required this.q, required this.l, this.pr = 0, this.legacy});
  final String e; // YYYY-MM أو ''
  final int q, l, pr;
  final List<String>? legacy;
}

List<String> productExpiryDates(Product p) {
  final r = p.raw;
  final ds = r['expiryDates'];
  final arr = (ds is List && ds.isNotEmpty)
      ? ds
      : (jsStr(r['expiryDate']).isNotEmpty ? [r['expiryDate']] : const []);
  final set = <String>{
    for (final x in arr)
      if (jsStr(x).isNotEmpty) x.toString()
  };
  return set.toList()..sort();
}

String btDate(String k) {
  final b = k.split('~').first;
  return b == 'none' ? '' : b.replaceAll('_', '-');
}

int btPr(String k, Object? ent) {
  final m = RegExp(r'~(\d+)$').firstMatch(k);
  if (m != null) return int.parse(m.group(1)!);
  final pr = ent is Map ? ent['pr'] : null;
  return jsNum(pr).round();
}

int btSc(Product p) {
  final s = jsInt(p.raw['subCount']);
  return s >= 2 ? s : 1;
}

class _B {
  _B(this.e, this.u, this.pr);
  String e;
  int u;
  int pr;
}

int _cmpB(_B a, _B b) {
  final c = (a.e.isNotEmpty ? 0 : 1) - (b.e.isNotEmpty ? 0 : 1);
  if (c != 0) return c;
  final d = a.e.compareTo(b.e);
  if (d != 0) return d;
  return a.pr - b.pr;
}

/// الدفعات الحيّة للمادة (تُطابق مجموعها مع الكمية الكلية). مرآة getBatches.
List<Batch> getBatches(Product p, {String? surplusTo}) {
  final sc = btSc(p);
  int unitsOf(Object? q, Object? l) => jsInt(q) * sc + (sc > 1 ? jsInt(l) : 0);
  final target = unitsOf(p.raw['qty'], p.raw['loose']);
  var list = <_B>[];
  final bt = p.raw['bt'];
  if (bt is Map) {
    final um = <String, int>{};
    bt.forEach((k, v) {
      final b = v is Map ? v : const {};
      um['$k'] = unitsOf(b['q'], b['l']);
    });
    um.forEach((k, u) {
      if (u > 0) list.add(_B(btDate(k), u, btPr(k, bt[k])));
    });
  } else {
    final ds = productExpiryDates(p);
    return target > 0
        ? [
            Batch(
              e: ds.length == 1 ? ds[0] : '',
              q: jsInt(p.raw['qty']),
              l: sc > 1 ? jsInt(p.raw['loose']) : 0,
              legacy: ds.length > 1 ? ds : null,
            )
          ]
        : [];
  }
  list = stableSorted(list, _cmpB);
  final tot = list.fold<int>(0, (s, b) => s + b.u);
  if (tot > target) {
    var ex = tot - target;
    for (final b in list) {
      final t = b.u < ex ? b.u : ex;
      b.u -= t;
      ex -= t;
      if (ex == 0) break;
    }
  } else if (tot < target) {
    final sur = target - tot;
    _B? b;
    if (surplusTo != null && surplusTo.isNotEmpty) {
      b = list.where((x) => x.e == surplusTo).firstOrNull;
    }
    b ??= list.where((x) => x.e.isEmpty).firstOrNull;
    if (b == null) {
      b = _B(surplusTo ?? '', 0, 0);
      list.add(b);
      list = stableSorted(list, _cmpB);
    }
    b.u += sur;
  }
  return [
    for (final b in list)
      if (b.u > 0)
        Batch(e: b.e, q: b.u ~/ sc, l: b.u % sc, pr: b.pr > 0 ? b.pr : 0)
  ];
}

// ───────────── التنبيهات ─────────────

const defaultDepartments = ['قسم الجلدية'];
const defaultSubCategories = [
  'واقيات الشمس',
  'العناية بالشعر والشامبو',
  'غسولات وعلاجات حب الشباب',
  'المرطبات والترميم',
  'التفتيح والتقشير',
  'المضادات الموضعية (بكتيريا/فطريات/طفيليات)',
  'الكورتيزونات والمراهم الموضعية',
  'الأدوية الفموية والشرابات',
];

/// إعدادات المخزن من pharmacy/metadata: حدود التنبيه والأقسام والتصنيفات.
class AlertConfig {
  const AlertConfig({
    this.lowStockThreshold = 2,
    this.alertMonths = const [1, 3, 6],
    this.departments = defaultDepartments,
    this.subCategories = defaultSubCategories,
    this.deptSubs = const {},
    this.legacyDepts = const [],
    this.legacyCats = const [],
  });
  final int lowStockThreshold;
  final List<int> alertMonths;
  final List<String> departments, subCategories, legacyDepts, legacyCats;
  final Map<String, List<String>> deptSubs;

  factory AlertConfig.fromMetadata(Map<String, dynamic>? d) {
    if (d == null) return const AlertConfig();
    List<String> strs(Object? v, List<String> def) =>
        v is List ? [for (final x in v) x.toString()] : def;
    final t = d['lowStockThreshold'];
    final m = d['alertMonths'];
    final ds = d['deptSubs'];
    final leg = d['taxLegacy'];
    return AlertConfig(
      lowStockThreshold: t is num ? t.toInt() : 2,
      alertMonths: (m is List && m.length == 3) ? m.map((e) => jsInt(e)).toList() : const [1, 3, 6],
      departments: strs(d['departments'], defaultDepartments),
      subCategories: strs(d['subCategories'], defaultSubCategories),
      deptSubs: ds is Map ? {for (final e in ds.entries) '${e.key}': strs(e.value, const [])} : const {},
      legacyDepts: leg is Map ? strs(leg['d'], const []) : const [],
      legacyCats: leg is Map ? strs(leg['c'], const []) : const [],
    );
  }
}

int minQty(Product p, AlertConfig c) => jsParseInt(p.raw['minQty']) ?? c.lowStockThreshold;

bool isLowStock(Product p, AlertConfig c) {
  if (p.arch) return false;
  final q = p.qty;
  return q > 0 && q <= minQty(p, c);
}

/// أيام حتى أول الشهر المذكور (YYYY-MM)؛ null إن لم يكن التاريخ صالحاً.
int? expiryDaysOf(String? s, {DateTime? today}) {
  final m = RegExp(r'^(\d{4})-(\d{2})').firstMatch(s ?? '');
  if (m == null) return null;
  final now = today ?? DateTime.now();
  final t0 = DateTime(now.year, now.month, now.day);
  final exp = DateTime(int.parse(m.group(1)!), int.parse(m.group(2)!), 1); // JS: الشهر يبدأ من 0، Dart من 1
  return (exp.difference(t0).inMilliseconds / 86400000).ceil();
}

class AlertKinds {
  const AlertKinds({
    this.days,
    this.date = '',
    this.bq,
    this.expired = false,
    this.m1 = false,
    this.m3 = false,
    this.m6 = false,
    this.low = false,
  });
  final int? days;
  final String date;
  final Batch? bq;
  final bool expired, m1, m3, m6, low;
  bool get any => m6 || low;
}

AlertKinds alertKinds(Product p, AlertConfig c, {DateTime? today}) {
  if (p.arch) return const AlertKinds();
  int? days;
  var date = '';
  Batch? bq;
  final bts = p.raw['bt'] != null ? getBatches(p).where((b) => b.e.isNotEmpty).toList() : null;
  final dates = bts != null
      ? bts.map((b) => b.e)
      : (p.hasUnits ? productExpiryDates(p) : const <String>[]);
  for (final d in dates) {
    final n = expiryDaysOf(d, today: today);
    if (n != null && (days == null || n < days)) {
      days = n;
      date = d;
    }
  }
  if (bts != null && date.isNotEmpty) {
    final same = bts.where((b) => b.e == date).toList();
    bq = same.length > 1
        ? Batch(e: date, q: same.fold(0, (s, b) => s + b.q), l: same.fold(0, (s, b) => s + b.l))
        : same.first;
  }
  final m = c.alertMonths;
  return AlertKinds(
    days: days,
    date: date,
    bq: bq,
    expired: days != null && days <= 0,
    m1: days != null && days <= m[0] * 30,
    m3: days != null && days <= m[1] * 30,
    m6: days != null && days <= m[2] * 30,
    low: isLowStock(p, c),
  );
}

// ───────────── شارة الشكل الدوائي ─────────────

class FormBadge {
  const FormBadge(this.txt, this.cls);
  final String txt, cls;
}

final Map<String, RegExp?> _formRe = {};

RegExp? _reOf(FormDef f) {
  if (f.pattern == null) return null;
  return _formRe.putIfAbsent(f.id, () {
    try {
      return RegExp(f.pattern!, caseSensitive: !f.flags.contains('i'));
    } catch (_) {
      return null;
    }
  });
}

/// مطابق لـ getFormBadge: الشكل الصريح أولاً، ثم التعرّف على الاسم والعبوة، ثم الافتراضي القديم.
FormBadge formBadge(Product p) {
  if (p.form == 'other' && p.formOther.isNotEmpty) {
    final k = p.formOther.trim().toLowerCase();
    for (final f in diwanForms) {
      if (f.txt.trim().toLowerCase() == k) return FormBadge(p.formOther, f.cls);
    }
    return FormBadge(p.formOther, 'badge-other');
  }
  if (p.form != null) {
    for (final f in diwanForms) {
      if (f.id == p.form) return FormBadge(f.txt, f.cls);
    }
  }
  final str = '${p.name} ${p.meta}'.toLowerCase();
  for (final f in diwanForms) {
    if (_reOf(f)?.hasMatch(str) ?? false) return FormBadge(f.txt, f.cls);
  }
  return const FormBadge('كريم (Cream)', 'badge-cream');
}


// ───────────── التصفية (نافذة تصفية الأصناف) ─────────────

List<String> deptsOf(Product p) {
  final extra = p.raw['extraDepartments'];
  return [
    jsStr(p.raw['department']).isEmpty ? 'قسم الجلدية' : p.raw['department'].toString(),
    if (extra is List) ...extra.where((x) => x is String && x.isNotEmpty).cast<String>(),
  ];
}

String brandOf(Product p) {
  final b = p.brand;
  return b.isEmpty ? 'GENERIC' : b;
}

String formOf(Product p) => formBadge(p).txt;

/// حالة التصفية (مرآة filCats/filDepts/filBrands/filForms/filInStock).
class StockFilters {
  StockFilters({
    Set<String>? depts,
    Set<String>? cats,
    Set<String>? brands,
    Set<String>? forms,
    this.inStock = false,
  })  : depts = depts ?? {},
        cats = cats ?? {},
        brands = brands ?? {},
        forms = forms ?? {};
  final Set<String> depts, cats, brands, forms;
  bool inStock;

  int get count => cats.length + depts.length + brands.length + forms.length + (inStock ? 1 : 0);

  void clear() {
    depts.clear();
    cats.clear();
    brands.clear();
    forms.clear();
    inStock = false;
  }

  bool matches(Product p) {
    if ((cats.isNotEmpty || depts.isNotEmpty) &&
        !(deptsOf(p).any(depts.contains) || p.cats.any(cats.contains))) {
      return false;
    }
    if (brands.isNotEmpty && !brands.contains(brandOf(p))) return false;
    if (forms.isNotEmpty && !forms.contains(formOf(p))) return false;
    if (inStock && !p.inStock) return false;
    return true;
  }
}

class TaxNode {
  TaxNode(this.k, this.cats, {this.virtual = false});
  final String k;
  final List<String> cats;
  final bool virtual;
}

/// شجرة الأقسام والتصنيفات (tfAdminTree): كل قسم بتصنيفاته، ثم «تصنيفات أخرى» لغير الموزّعة.
List<TaxNode> taxTree(Iterable<Product> products, AlertConfig c) {
  final usedCats = <String>{for (final p in products) ...p.cats};
  final usedDepts = <String>{for (final p in products) ...deptsOf(p)};
  final depts = c.departments.where((d) => !c.legacyDepts.contains(d) || usedDepts.contains(d)).toList();
  final list = depts.isEmpty ? c.departments : depts;
  final placed = <String>{};
  final tree = <TaxNode>[];
  for (final d in list) {
    final cats = (c.deptSubs[d] ?? const <String>[])
        .where((x) => c.subCategories.contains(x) && (!c.legacyCats.contains(x) || usedCats.contains(x)))
        .toList();
    placed.addAll(cats);
    tree.add(TaxNode(d, cats));
  }
  final orph = usedCats.where((x) => !placed.contains(x)).toList();
  if (orph.isNotEmpty) tree.add(TaxNode('تصنيفات أخرى', orph, virtual: true));
  return tree;
}

// ───────────── البدائل (بنفس المادة الفعالة) ─────────────

String ingredientKey(String? s) {
  final t = (s ?? '')
      .toLowerCase()
      .replaceAll(RegExp(r'\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|iu|%)'), ' ');
  final parts = t
      .split(RegExp(r'[+,/،&]|\band\b'))
      .map((x) => x.replaceAll(RegExp(r'\s+'), ' ').trim())
      .where((x) => x.isNotEmpty)
      .toList()
    ..sort();
  return parts.join('+');
}

/// بدائل المادة: المتوفر أولاً ثم الأرخص (مرآة getAlternatives).
List<Product> alternativesOf(Product p, Iterable<Product> all) {
  final key = ingredientKey(jsStr(p.raw['activeIngredient']));
  if (key.isEmpty) return const [];
  final l = all
      .where((x) => x.id != p.id && ingredientKey(jsStr(x.raw['activeIngredient'])) == key)
      .toList();
  return stableSorted(l, (a, b) {
    final sa = a.inStock ? 0 : 1, sb = b.inStock ? 0 : 1;
    if (sa != sb) return sa - sb;
    double pr(Product x) => x.price > 0 ? x.price : 1e12;
    return pr(a).compareTo(pr(b));
  });
}


/// عدد الأزواج (مادة، تاريخ) القريبة الانتهاء أو المنتهية (≤ 180 يوماً): مرآة getExpiringProducts().length.
int expiringCount(Iterable<Product> products, {DateTime? today}) {
  var n = 0;
  for (final p in products) {
    if (p.arch || !p.hasUnits) continue;
    final dates = p.raw['bt'] != null
        ? getBatches(p).map((b) => b.e).where((e) => e.isNotEmpty).toSet()
        : productExpiryDates(p).toSet();
    for (final d in dates) {
      final days = expiryDaysOf(d, today: today);
      if (days != null && days <= 180) n++;
    }
  }
  return n;
}
