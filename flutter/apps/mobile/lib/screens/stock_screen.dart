import 'dart:async';

import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/filter_sheet.dart';
import '../widgets/product_card.dart';
import '../widgets/product_sheet.dart';

/// المخزن: بحث ذكي + مسح باركود + تصفية (قسم/تصنيف/شركة/شكل/متوفر) بنفس تخطيط الويب.
class StockScreen extends ConsumerStatefulWidget {
  const StockScreen({super.key});
  @override
  ConsumerState<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends ConsumerState<StockScreen> {
  final _ctl = TextEditingController();
  final _filters = StockFilters();
  Timer? _deb;
  String _q = '';

  @override
  void dispose() {
    _deb?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _deb?.cancel();
    _deb = Timer(const Duration(milliseconds: 120), () => setState(() => _q = v));
  }

  Future<void> _scan() async {
    final code = await pickBarcode(context);
    if (code == null || !mounted) return;
    _ctl.text = code;
    setState(() => _q = code);
  }

  void _soon(String what) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('$what تُفعَّل في مرحلة لاحقة'), duration: const Duration(seconds: 1)));

  @override
  Widget build(BuildContext context) {
    final snap = ref.watch(catalogProvider);
    final idx = ref.watch(catalogIndexProvider);
    final cfg = ref.watch(alertCfgValueProvider);
    final profile = ref.watch(profileProvider).value;
    final mode = ref.watch(themeModeProvider);
    final alerts = ref.watch(alertCountProvider);
    final base = idx.all.where((p) => !p.arch).toList();
    final list = idx.search(_q, where: (p) => !p.arch && _filters.matches(p));
    final canEdit = profile?.can('stockEdit') ?? false;
    final dark = context.isDark;
    final top = MediaQuery.of(context).padding.top;

    return Scaffold(
      body: Column(children: [
        // ───── الترويسة (165 + حافة الحالة) ─────
        SizedBox(
          height: 165 + top,
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                child: DecoratedBox(
                  decoration: BoxDecoration(color: dark ? DiwanColors.darkHeader : DiwanColors.navy),
                  child: const CustomPaint(painter: HeaderPatternPainter()),
                ),
              ),
            ),
            const Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: GoldEdgePainter()))),
            // صف الشعار والأزرار (y=20)
            Positioned(
              top: top + 20,
              left: 16,
              right: 16,
              child: SizedBox(
                height: 36,
                child: Row(children: [
                  _Logo(),
                  const SizedBox(width: 8),
                  Text('صيدلية الديوان', style: ruqaa(size: 18.4, color: DiwanColors.goldDeep)),
                  const Spacer(),
                  _HBtn(DiwanIcons.home, 'الرئيسية', () => goHome(context)),
                  const SizedBox(width: 4),
                  _HBtn(DiwanIcons.bell, 'التنبيهات', () => openAlerts(context), badge: alerts),
                  const SizedBox(width: 4),
                  _HBtn(DiwanIcons.plus, 'إضافة صنف', () => _soon('إضافة صنف')),
                  const SizedBox(width: 4),
                  _HBtn(mode == ThemeMode.dark ? DiwanIcons.moon : DiwanIcons.sun, 'الوضع',
                      () => ref.read(themeModeProvider.notifier).toggle()),
                ]),
              ),
            ),
            // صف العنوان والأدوات (y=51)
            Positioned(
              top: top + 51,
              left: 18,
              right: 18,
              child: SizedBox(
                height: 40,
                child: Row(children: [
                  const Icon(DiwanIcons.stock, size: 19, color: DiwanColors.slateText),
                  const SizedBox(width: 6),
                  Text('المخزن', style: ruqaa(size: 16.8, color: DiwanColors.slateText)),
                  const Spacer(),
                  _Tool(DiwanIcons.barcode, 'ملصقات', onTap: () => _soon('ملصقات الباركود')),
                  const SizedBox(width: 8),
                  _Tool(DiwanIcons.filter, 'تصفية', on: _filters.count > 0, count: _filters.count, onTap: () {
                    showFilterSheet(context,
                        filters: _filters,
                        base: base,
                        cfg: cfg,
                        total: () => idx.search(_q, where: (p) => !p.arch && _filters.matches(p)).length,
                        onChanged: () => setState(() {}));
                  }),
                ]),
              ),
            ),
            // البحث (y=101)
            Positioned(
              top: top + 101,
              left: 16,
              right: 16,
              child: SizedBox(
                height: 46,
                child: ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _ctl,
                  builder: (_, v, _) => TextField(
                    controller: _ctl,
                    expands: true,
                    maxLines: null,
                    minLines: null,
                    textAlignVertical: TextAlignVertical.center,
                    onChanged: _onChanged,
                    textInputAction: TextInputAction.search,
                    style: const TextStyle(fontSize: 16, color: Color(0xFF0F172A)),
                    decoration: InputDecoration(
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white,
                      hintText: 'ابحث بالاسم التجاري، المادة الفعالة، أو الاستخدام...',
                      hintStyle: const TextStyle(color: Color(0xFF8A94A8), fontSize: 14),
                      hintMaxLines: 1,
                      contentPadding: const EdgeInsets.fromLTRB(72, 0, 40, 0),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: DiwanColors.gold, width: 2)),
                      prefixIcon: null,
                      suffixIcon: null,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: top + 101,
              right: 28,
              height: 46,
              child: const IgnorePointer(
                  child: Center(child: Icon(DiwanIcons.search, size: 20, color: Color(0xFF5B6578)))),
            ),
            Positioned(
              top: top + 109,
              left: 16 + 36,
              child: GestureDetector(
                onTap: _scan,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(color: const Color(0xFFFFF3D6), borderRadius: BorderRadius.circular(8)),
                  child: const Icon(DiwanIcons.scan, size: 18, color: DiwanColors.navy),
                ),
              ),
            ),
            if (_ctl.text.isNotEmpty)
              Positioned(
                top: top + 111,
                left: 16 + 6,
                child: GestureDetector(
                  onTap: () {
                    _ctl.clear();
                    _onChanged('');
                    setState(() {});
                  },
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: const BoxDecoration(color: Color(0xFFE2E8F0), shape: BoxShape.circle),
                    child: const Icon(DiwanIcons.close, size: 14, color: DiwanColors.navy),
                  ),
                ),
              ),
            const Positioned(left: 0, right: 0, bottom: 0, child: DiwanProgressBar()),
          ]),
        ),
        // ───── شريط المعلومات ─────
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
          child: SizedBox(
            height: 22,
            child: Row(children: [
              Text('كل الأقسام • جميع الأصناف',
                  style: TextStyle(fontSize: 13.12, fontWeight: FontWeight.w700, color: context.cTextSub)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color: dark ? DiwanColors.gold : DiwanColors.navy, borderRadius: BorderRadius.circular(999)),
                child: Text('${list.length} صنف',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        height: 1.5,
                        color: dark ? DiwanColors.navy : Colors.white)),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: snap.when(
            loading: () => const Center(child: CircularProgressIndicator(color: DiwanColors.gold)),
            error: (e, _) => Center(child: Text('تعذّر تحميل المخزن: $e')),
            data: (_) => list.isEmpty
                ? Center(
                    child: Text(_q.isEmpty && _filters.count == 0 ? 'لا توجد مواد' : 'لا نتائج',
                        style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)))
                : LayoutBuilder(builder: (context, c) {
                    final w = (c.maxWidth - 32 - 12) / 2;
                    final h = productCardHeight(canEdit);
                    return GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: w / h,
                      ),
                      itemCount: list.length,
                      itemBuilder: (_, i) {
                        final p = list[i];
                        return ProductCard(
                          key: ValueKey(p.id),
                          p: p,
                          cfg: cfg,
                          showQty: canEdit,
                          onQty: (_) => _soon('تعديل الكمية'),
                          onTap: () => showProductSheet(context, p, cfg: cfg, profile: profile!, index: idx),
                        );
                      },
                    );
                  }),
          ),
        ),
      ]),
    );
  }
}

class _Logo extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 34,
        height: 34,
        child: Stack(clipBehavior: Clip.none, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset('images/logo.jpg', package: 'diwan_ui', width: 34, height: 34),
          ),
          Positioned(
            left: -3,
            bottom: -3,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: const Color(0xFF94A3B8),
                shape: BoxShape.circle,
                border: Border.all(color: DiwanColors.navy, width: 2),
              ),
            ),
          ),
        ]),
      );
}

class _HBtn extends StatelessWidget {
  const _HBtn(this.icon, this.tip, this.onTap, {this.badge = 0});
  final IconData icon;
  final String tip;
  final VoidCallback onTap;
  final int badge;
  @override
  Widget build(BuildContext context) => Tooltip(
        message: tip,
        child: Stack(clipBehavior: Clip.none, children: [
          Material(
            color: Colors.white.withValues(alpha: .08),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(color: Colors.white.withValues(alpha: .14)),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: onTap,
              child: SizedBox(width: 38, height: 36, child: Icon(icon, size: 20, color: Colors.white)),
            ),
          ),
          if (badge > 0)
            Positioned(
              top: -5,
              left: -5,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: const Color(0xFFDC2626), borderRadius: BorderRadius.circular(9)),
                child: Text('$badge',
                    style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800, height: 1)),
              ),
            ),
        ]),
      );
}

class _Tool extends StatelessWidget {
  const _Tool(this.icon, this.tip, {this.on = false, this.count = 0, required this.onTap});
  final IconData icon;
  final String tip;
  final bool on;
  final int count;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Tooltip(
        message: tip,
        child: Stack(clipBehavior: Clip.none, children: [
          Material(
            color: on ? DiwanColors.goldDeep : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: on ? DiwanColors.goldDeep : const Color(0xFFCBD5E1), width: 1.5),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: onTap,
              child: SizedBox(width: 40, height: 40, child: Icon(icon, size: 20, color: DiwanColors.navy)),
            ),
          ),
          if (count > 0)
            Positioned(
              top: -6,
              left: -6,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: DiwanColors.navy,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Colors.white, spreadRadius: 2)],
                ),
                child: Text('$count',
                    style: const TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800, height: 1)),
              ),
            ),
        ]),
      );
}
