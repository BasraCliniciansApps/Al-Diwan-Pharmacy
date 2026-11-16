import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';

/// نافذة «تصفية الأصناف» (مطابقة لـ renderFilterSheet): المتوفر فقط، الأقسام والتصنيفات،
/// الشركة، الشكل الدوائي، وتذييل «مسح الكل / عرض N صنف».
Future<void> showFilterSheet(
  BuildContext context, {
  required StockFilters filters,
  required List<Product> base,
  required AlertConfig cfg,
  required int Function() total,
  required VoidCallback onChanged,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _FilterSheet(filters: filters, base: base, cfg: cfg, total: total, onChanged: onChanged),
  );
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.filters, required this.base, required this.cfg, required this.total, required this.onChanged});
  final StockFilters filters;
  final List<Product> base;
  final AlertConfig cfg;
  final int Function() total;
  final VoidCallback onChanged;
  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  String _open = '';
  final Set<String> _openDepts = {};
  String _q = '';

  StockFilters get f => widget.filters;
  void _ch(VoidCallback fn) {
    setState(fn);
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final tree = taxTree(widget.base, widget.cfg);
    int dCount(String d) => widget.base.where((p) => deptsOf(p).contains(d)).length;
    int cCount(String c) => widget.base.where((p) => p.cats.contains(c)).length;
    final brands = <String, int>{};
    final forms = <String, int>{};
    for (final p in widget.base) {
      brands.update(brandOf(p), (v) => v + 1, ifAbsent: () => 1);
      forms.update(formOf(p), (v) => v + 1, ifAbsent: () => 1);
    }
    final bl = brands.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    final fl = forms.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final dark = context.isDark;
    final navy = dark ? DiwanColors.darkText : DiwanColors.navy;

    Widget dd(String kind, String title, List<MapEntry<String, int>> items, Set<String> set) {
      if (items.isEmpty) return const SizedBox.shrink();
      final open = _open == kind;
      final summary = set.isEmpty ? 'الكل' : set.length == 1 ? set.first : '${set.length} مختارة';
      return Container(
        margin: const EdgeInsets.only(top: 12),
        decoration: BoxDecoration(
          color: context.cSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.cBorder),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          InkWell(
            onTap: () => setState(() => _open = open ? '' : kind),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: SizedBox(
                height: 50,
                child: Row(children: [
                  Text(title, style: TextStyle(fontSize: 14.4, fontWeight: FontWeight.w800, color: navy)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.left,
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: set.isEmpty ? FontWeight.w500 : FontWeight.w800,
                            color: set.isEmpty ? context.cTextSub : (dark ? DiwanColors.gold : DiwanColors.navy))),
                  ),
                  Icon(open ? DiwanIcons.chevDown : DiwanIcons.chevDown,
                      size: 16, color: context.cTextSub),
                ]),
              ),
            ),
          ),
          if (open)
            Container(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: context.cBorder))),
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(children: [
                for (final e in items)
                  InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => _ch(() => set.contains(e.key) ? set.remove(e.key) : set.add(e.key)),
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: set.contains(e.key) ? const Color(0x2EF4B73F) : null,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: Checkbox(
                            value: set.contains(e.key),
                            onChanged: (_) => _ch(() => set.contains(e.key) ? set.remove(e.key) : set.add(e.key)),
                            activeColor: dark ? DiwanColors.gold : DiwanColors.navy,
                            visualDensity: VisualDensity.compact,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Text(e.key,
                                textDirection: kind == 'brand' ? TextDirection.ltr : null,
                                textAlign: kind == 'brand' ? TextAlign.right : TextAlign.start,
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: navy))),
                        Text('${e.value}', style: TextStyle(fontSize: 11.8, fontWeight: FontWeight.w800, color: context.cTextSub)),
                      ]),
                    ),
                  ),
              ]),
            ),
        ]),
      );
    }

    final q = _q.trim().toLowerCase();
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: BoxDecoration(
          color: context.cSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: const [BoxShadow(color: Color(0x40000000), blurRadius: 36, offset: Offset(0, -12))],
        ),
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * .72),
        padding: const EdgeInsets.only(top: 12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(color: const Color(0xFFCDD4E2), borderRadius: BorderRadius.circular(10))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: SizedBox(
              height: 40,
              child: Row(children: [
                Text('تصفية الأصناف', style: ruqaa(size: 16.8, color: navy)),
                const Spacer(),
                Material(
                  color: dark ? const Color(0xFF1E2B4A) : const Color(0xFFF1F4F9),
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => Navigator.pop(context),
                    child: SizedBox(width: 40, height: 40, child: Icon(DiwanIcons.close, size: 18, color: navy)),
                  ),
                ),
              ]),
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
              children: [
                // المتوفر فقط
                InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => _ch(() => f.inStock = !f.inStock),
                  child: Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14), border: Border.all(color: context.cBorder)),
                    child: Row(children: [
                      Text('المتوفر فقط', style: TextStyle(fontSize: 13.33, fontWeight: FontWeight.w800, color: navy)),
                      const Spacer(),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        width: 44,
                        height: 26,
                        padding: const EdgeInsets.all(3),
                        alignment: f.inStock ? Alignment.centerLeft : Alignment.centerRight,
                        decoration: BoxDecoration(
                          color: f.inStock ? const Color(0xFF16A34A) : (dark ? const Color(0xFF3A4868) : const Color(0xFFCBD5E1)),
                          borderRadius: BorderRadius.circular(13),
                        ),
                        child: Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [BoxShadow(color: Color(0x4D000000), blurRadius: 3, offset: Offset(0, 1))],
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(2, 12, 2, 8),
                  child: Text('الأقسام والتصنيفات',
                      style: TextStyle(fontSize: 13.76, fontWeight: FontWeight.w800, color: navy)),
                ),
                // شجرة الأقسام
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: context.cSurface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: context.cBorder, width: 1.5),
                  ),
                  child: Column(children: [
                    TextField(
                      onChanged: (v) => setState(() => _q = v),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'ابحث عن قسم أو تصنيف',
                        hintStyle: TextStyle(color: context.cTextSub, fontSize: 14),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder, width: 1.5)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    for (final n in tree)
                      if (q.isEmpty || n.k.toLowerCase().contains(q) || n.cats.any((c) => c.toLowerCase().contains(q)))
                        _TreeDept(
                          node: n,
                          filters: f,
                          count: n.virtual ? 0 : dCount(n.k),
                          catCount: cCount,
                          open: _openDepts.contains(n.k) || q.isNotEmpty,
                          query: q,
                          onToggleOpen: () => setState(() => _openDepts.contains(n.k) ? _openDepts.remove(n.k) : _openDepts.add(n.k)),
                          onChanged: () => _ch(() {}),
                        ),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        flex: 10,
                        child: _FBtn('مسح التحديد', false,
                            (f.depts.isEmpty && f.cats.isEmpty) ? null : () => _ch(() {
                                  f.depts.clear();
                                  f.cats.clear();
                                })),
                      ),
                      const SizedBox(width: 8),
                      Expanded(flex: 14, child: _FBtn('تم', true, () => Navigator.pop(context))),
                    ]),
                  ]),
                ),
                dd('brand', 'الشركة', bl, f.brands),
                dd('form', 'الشكل الدوائي', fl, f.forms),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + MediaQuery.of(context).padding.bottom),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: context.cBorder))),
            child: Row(children: [
              Expanded(
                flex: 10,
                child: SizedBox(
                  height: 48,
                  child: _FBtn('مسح الكل', false, f.count == 0 ? null : () => _ch(f.clear)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 26,
                child: SizedBox(
                  height: 48,
                  child: _FBtn('عرض ${widget.total()} صنف', true, () => Navigator.pop(context)),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _FBtn extends StatelessWidget {
  const _FBtn(this.label, this.primary, this.onTap);
  final String label;
  final bool primary;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    return Opacity(
      opacity: onTap == null ? .45 : 1,
      child: Material(
        color: primary ? (dark ? DiwanColors.gold : DiwanColors.navy) : context.cSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: primary ? (dark ? DiwanColors.gold : DiwanColors.navy) : context.cBorder),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: onTap,
          child: Container(
            height: 48,
            alignment: Alignment.center,
            child: Text(label,
                style: TextStyle(
                    fontSize: 14.08,
                    fontWeight: FontWeight.w700,
                    color: primary ? (dark ? DiwanColors.navy : Colors.white) : (dark ? DiwanColors.darkText : DiwanColors.navy))),
          ),
        ),
      ),
    );
  }
}

class _TreeDept extends StatelessWidget {
  const _TreeDept({
    required this.node,
    required this.filters,
    required this.count,
    required this.catCount,
    required this.open,
    required this.query,
    required this.onToggleOpen,
    required this.onChanged,
  });
  final TaxNode node;
  final StockFilters filters;
  final int count;
  final int Function(String) catCount;
  final bool open;
  final String query;
  final VoidCallback onToggleOpen, onChanged;

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    final navy = dark ? DiwanColors.darkText : DiwanColors.navy;
    final on = !node.virtual && filters.depts.contains(node.k);
    final sel = node.cats.where(filters.cats.contains).length;
    final part = !on && sel > 0;
    Widget ck(bool v, bool p, VoidCallback t) => GestureDetector(
          onTap: t,
          child: Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: v ? const Color(0xFF0F766E) : (p ? const Color(0xFF99D3CB) : (dark ? Colors.transparent : Colors.white)),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: (v || p) ? const Color(0xFF0F766E) : const Color(0xFF94A3B8), width: 2),
            ),
            child: v
                ? const Icon(DiwanIcons.check, size: 0)
                : null,
          ),
        );
    final cats = node.cats.where((c) => query.isEmpty || node.k.toLowerCase().contains(query) || c.toLowerCase().contains(query));
    return Column(children: [
      Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: dark ? DiwanColors.darkBg : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(children: [
          if (!node.virtual)
            ck(on, part, () {
              if (on) {
                filters.depts.remove(node.k);
              } else {
                filters.depts.add(node.k);
              }
              onChanged();
            })
          else
            const SizedBox(width: 26),
          const SizedBox(width: 9),
          Expanded(
            child: InkWell(
              onTap: onToggleOpen,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                child: Row(children: [
                  Expanded(child: Text(node.k, style: TextStyle(fontSize: 13.76, fontWeight: FontWeight.w800, color: navy))),
                  Text('$count', style: TextStyle(fontSize: 11.2, fontWeight: FontWeight.w700, color: context.cTextSub)),
                  const SizedBox(width: 8),
                  if (node.cats.isNotEmpty)
                    Icon(open ? DiwanIcons.chevDown : DiwanIcons.chevRight, size: 16, color: navy),
                ]),
              ),
            ),
          ),
        ]),
      ),
      if (open)
        Padding(
          padding: const EdgeInsets.only(right: 22, bottom: 4),
          child: Column(children: [
            for (final c in cats)
              InkWell(
                onTap: () {
                  filters.cats.contains(c) ? filters.cats.remove(c) : filters.cats.add(c);
                  onChanged();
                },
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Row(children: [
                    ck(filters.cats.contains(c), false, () {
                      filters.cats.contains(c) ? filters.cats.remove(c) : filters.cats.add(c);
                      onChanged();
                    }),
                    const SizedBox(width: 9),
                    Expanded(child: Text(c, style: TextStyle(fontSize: 13.28, fontWeight: FontWeight.w600, color: navy))),
                    Text('${catCount(c)}', style: TextStyle(fontSize: 11.2, fontWeight: FontWeight.w700, color: context.cTextSub)),
                  ]),
                ),
              ),
          ]),
        ),
    ]);
  }
}
