/// دوال مطابقة لسلوك JavaScript (تُستعمل لضمان التكافؤ مع الويب).
library;

final _intRe = RegExp(r'^\s*([+-]?\d+)');

/// parseInt: يعيد null بدل NaN.
int? jsParseInt(Object? v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is double) return v.isFinite ? v.truncate() : null;
  if (v is String) {
    final m = _intRe.firstMatch(v);
    return m == null ? null : int.tryParse(m.group(1)!);
  }
  return null;
}

/// parseInt(v) || 0
int jsInt(Object? v) => jsParseInt(v) ?? 0;

/// Number(v) || 0
double jsNum(Object? v) {
  if (v is num) return v.isFinite ? v.toDouble() : 0;
  if (v is String) return double.tryParse(v.trim()) ?? 0;
  return 0;
}

/// String(v || '') : القيم الفارغة/غير الصادقة تصير نصاً فارغاً.
String jsStr(Object? v) {
  if (v == null || v == false || v == 0 || v == '') return '';
  return v.toString();
}

/// ترتيب مستقر (مثل Array.sort في JS).
List<T> stableSorted<T>(Iterable<T> items, int Function(T a, T b) cmp) {
  final l = items.toList();
  final idx = List<int>.generate(l.length, (i) => i);
  idx.sort((i, j) {
    final c = cmp(l[i], l[j]);
    return c != 0 ? c : i.compareTo(j);
  });
  return [for (final i in idx) l[i]];
}
