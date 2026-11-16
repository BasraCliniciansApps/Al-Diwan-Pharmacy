import 'package:unorm_dart/unorm_dart.dart' as unorm;

import 'js_compat.dart';
import 'product.dart';

final _marks = RegExp(r'[̀-ͯ]');
final _arDia = RegExp(r'[ً-ٰٟـ]');
final _arDigits = RegExp(r'[٠-٩]');
final _nonWord = RegExp(r'[^a-z0-9؀-ۿ]+');
final _alPrefix = RegExp(r'(^| )ال(?=\S{3,})');

/// مطابق لـ normSearch في data.js: يتجاهل التشكيل وفروق الهمزات والتاء المربوطة.
String normSearch(Object? s) {
  var t = (s == null ? '' : s.toString()).toLowerCase();
  t = unorm.nfkd(t).replaceAll(_marks, '');
  t = t.replaceAll(_arDia, '');
  t = t.replaceAllMapped(
      _arDigits, (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m.group(0)!).toString());
  t = t
      .replaceAll(RegExp('[أإآٱ]'), 'ا')
      .replaceAll('ى', 'ي')
      .replaceAll('ة', 'ه')
      .replaceAll('ؤ', 'و')
      .replaceAll('ئ', 'ي');
  t = t.replaceAll(_nonWord, ' ');
  t = t.replaceAllMapped(_alPrefix, (m) => m.group(1)!);
  return t.trim();
}

/// مسافة التحرير مع إيقاف مبكر (مطابقة editDistanceWithin).
int editDistanceWithin(String a, String b, int max) {
  if ((a.length - b.length).abs() > max) return max + 1;
  var prev = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final cur = <int>[i];
    var rowMin = i;
    for (var j = 1; j <= b.length; j++) {
      final v = [
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1),
      ].reduce((x, y) => x < y ? x : y);
      cur.add(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/// فهرس بحث مادة واحدة.
class SearchEntry {
  SearchEntry(this.name, this.all) : words = all.split(' ').where((w) => w.isNotEmpty).toList();
  final String name, all;
  final List<String> words;
}

String _u(Object? v) => v == null ? 'undefined' : v.toString();

SearchEntry buildSearchEntry(Product p, List<String> barcodes) {
  final r = p.raw;
  final all = normSearch('${_u(r['name'])} ${_u(r['brand'])} ${_u(r['details'])} '
      '${_u(r['meta'])} ${p.cats.join(' ')} ${jsStr(r['keywords'])} '
      '${jsStr(r['activeIngredient'])} ${barcodes.join(' ')}');
  return SearchEntry(normSearch(r['name']), all);
}

/// 0 = لا يطابق، 2 = نصاً، 1 = بخطأ إملائي بسيط.
int tokenMatchScore(String tok, SearchEntry x) {
  if (x.all.contains(tok)) return 2;
  if (tok.length < 5) return 0;
  final max = tok.length >= 8 ? 2 : 1;
  for (final w in x.words) {
    if (w.length >= 3 && editDistanceWithin(tok, w, max) <= max) return 1;
  }
  return 0;
}

/// درجة الصنف (0 = لا يطابق). كل كلمات البحث يجب أن تتطابق.
int searchScore(SearchEntry x, String qNorm, List<String> tokens) {
  if (tokens.isEmpty) return 1;
  var score = 0;
  for (final t in tokens) {
    final s = tokenMatchScore(t, x);
    if (s == 0) return 0;
    score += s;
  }
  if (x.name == qNorm) {
    score += 8;
  } else if (x.name.startsWith(qNorm)) {
    score += 5;
  } else if (x.name.contains(qNorm)) {
    score += 3;
  }
  return score;
}
