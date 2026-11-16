import 'js_compat.dart';

final _bcClean = RegExp(r'[^0-9A-Za-z\-]');

String cleanBarcode(Object? v) {
  final s = jsStr(v).replaceAll(_bcClean, '');
  return s.length > 40 ? s.substring(0, 40) : s;
}

class Gs1 {
  Gs1(this.gtin, this.batch, this.exp, this.serial);
  final String gtin, batch, exp, serial;
}

String gs1Exp(String? v) {
  final m = RegExp(r'^(\d{2})(\d{2})').firstMatch(v ?? '');
  if (m == null) return '';
  final mm = int.parse(m.group(2)!);
  return mm >= 1 && mm <= 12 ? '20${m.group(1)}-${m.group(2)}' : '';
}

Gs1? parseGs1(Object? raw) {
  var s = jsStr(raw).replaceFirst(RegExp(r'^\]d2|^\]C1|^\]Q3'), '');
  if (s.contains('(')) {
    final m = <String, String>{};
    for (final x in RegExp(r'\((\d{2,4})\)([^(]*)').allMatches(s)) {
      m[x.group(1)!] = x.group(2)!.replaceAll(RegExp(r'[\x00-\x1f]'), '');
    }
    final g = m['01'];
    if (g == null || g.isEmpty) return null;
    return Gs1(g.length > 14 ? g.substring(0, 14) : g, m['10'] ?? '',
        gs1Exp(m['17']), m['21'] ?? '');
  }
  if (!RegExp(r'^01\d{14}').hasMatch(s)) return null;
  var batch = '', exp = '', serial = '';
  final gtin = s.substring(2, 16);
  var i = 16;
  const fixed = {'11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2};
  while (i < s.length) {
    final ai = s.substring(i, i + 2 > s.length ? s.length : i + 2);
    if (ai == '10' || ai == '21') {
      var j = i + 2;
      while (j < s.length && s[j] != '\x1d') {
        j++;
      }
      final v = s.substring(i + 2 > s.length ? s.length : i + 2, j);
      if (ai == '10') {
        batch = v;
      } else {
        serial = v;
      }
      i = j + 1;
    } else if (fixed.containsKey(ai)) {
      if (ai == '17') {
        final a = i + 2, b = i + 8 > s.length ? s.length : i + 8;
        exp = gs1Exp(a >= s.length ? '' : s.substring(a, b));
      }
      i += 2 + fixed[ai]!;
    } else {
      break;
    }
  }
  return Gs1(gtin, batch, exp, serial);
}

/// مفاتيح المطابقة: النص كاملاً، GTIN، ونواة الرقم (تتجاوز اختلاف EAN-13/GTIN-14).
Set<String> barcodeKeys(Object? code) {
  final keys = <String>{};
  final c = cleanBarcode(code);
  if (c.isEmpty) return keys;
  keys.add(c);
  final g = parseGs1(c);
  final d = g != null ? g.gtin : (RegExp(r'^\d{8,14}$').hasMatch(c) ? c : '');
  if (g != null) keys.add(g.gtin);
  var core = '';
  if (d.length == 14) {
    core = d.substring(1, 13);
  } else if (d.length == 13) {
    core = d.substring(0, 12);
  } else if (d.length == 12) {
    core = '0${d.substring(0, 11)}';
  }
  if (core.isNotEmpty) keys.add('core:$core');
  return keys;
}
