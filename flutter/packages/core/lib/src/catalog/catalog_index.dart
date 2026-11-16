import 'barcode.dart';
import 'product.dart';
import 'text_search.dart';

/// لقطة كاملة للمخزن في لحظة واحدة.
class CatalogSnapshot {
  const CatalogSnapshot(this.index, {this.setupMode = false, this.fromCache = false});
  final CatalogIndex index;
  final bool setupMode;
  final bool fromCache;
}

/// فهرس في الذاكرة: بحث (اسم/باركود/شركة/مادة فعّالة) أقل من 100ms على آلاف المواد،
/// وبحث باركود O(1). يُبنى مرة لكل تغيير.
class CatalogIndex {
  CatalogIndex(Iterable<Product> items) {
    final l = items.toList()..sort((a, b) => b.id.compareTo(a.id)); // الأحدث أولاً كالويب
    all = List.unmodifiable(l);
    _entries = [for (final p in all) buildSearchEntry(p, p.barcodes)];
    for (final p in all) {
      for (final b in p.barcodes) {
        for (final k in barcodeKeys(b)) {
          _byKey.putIfAbsent(k, () => p); // أول مادة تفوز (كـ find)
        }
      }
    }
  }

  late final List<Product> all;
  late final List<SearchEntry> _entries;
  final Map<String, Product> _byKey = {};

  static final empty = CatalogIndex(const []);

  /// بحث ذكي: كل كلمات الاستعلام يجب أن تتطابق، والترتيب بالدرجة ثم الأحدث.
  List<Product> search(String query, {bool Function(Product)? where, int? limit}) {
    final qn = normSearch(query);
    final toks = qn.isEmpty ? <String>[] : qn.split(' ');
    final scored = <(int, int)>[]; // (idx, score)
    for (var i = 0; i < all.length; i++) {
      final p = all[i];
      if (where != null && !where(p)) continue;
      final s = searchScore(_entries[i], qn, toks);
      if (s > 0) scored.add((i, s));
    }
    if (toks.isNotEmpty) {
      scored.sort((a, b) => b.$2 != a.$2 ? b.$2.compareTo(a.$2) : a.$1.compareTo(b.$1));
    }
    final out = [for (final s in scored) all[s.$1]];
    return limit != null && out.length > limit ? out.sublist(0, limit) : out;
  }

  /// درجة مادة معيّنة لاستعلام (للاختبارات).
  int scoreOf(int i, String query) {
    final qn = normSearch(query);
    return searchScore(_entries[i], qn, qn.isEmpty ? [] : qn.split(' '));
  }

  Product? byBarcode(String code) {
    final keys = barcodeKeys(code);
    for (final k in keys) {
      final p = _byKey[k];
      if (p != null) return p;
    }
    return null;
  }
}
