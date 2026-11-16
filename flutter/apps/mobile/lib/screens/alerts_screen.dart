import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/product_card.dart';
import '../widgets/product_sheet.dart';

enum AlertFilter { all, expired, m1, m3, m6, low }

String _monthsTxt(int n) => n == 1 ? 'شهر' : n == 2 ? 'شهرين' : '$n${n <= 10 ? ' أشهر' : ' شهراً'}';

/// التنبيهات: تبويبان (الصيدلية/الأطباء)، تصفية، بحث، شريط المعلومات، زر طلب الشراء، شبكة البطاقات.
class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});
  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  final _ctl = TextEditingController();
  AlertFilter _f = AlertFilter.all;
  String _q = '';
  int _tab = 0;

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  String _label(AlertFilter f, AlertConfig c) => switch (f) {
        AlertFilter.all => 'كل التنبيهات',
        AlertFilter.expired => 'منتهية الصلاحية',
        AlertFilter.m1 => 'تنتهي خلال ${_monthsTxt(c.alertMonths[0])}',
        AlertFilter.m3 => 'تنتهي خلال ${_monthsTxt(c.alertMonths[1])}',
        AlertFilter.m6 => 'تنتهي خلال ${_monthsTxt(c.alertMonths[2])}',
        AlertFilter.low => 'مخزون منخفض',
      };

  bool _in(AlertKinds k, AlertFilter f) => switch (f) {
        AlertFilter.all => k.any,
        AlertFilter.expired => k.expired,
        AlertFilter.m1 => k.m1,
        AlertFilter.m3 => k.m3,
        AlertFilter.m6 => k.m6,
        AlertFilter.low => k.low,
      };

  CardTag _tag(Product p, AlertKinds k) {
    if (_f == AlertFilter.low || k.days == null || !k.m6) {
      return CardTag('كمية قليلة: ${stockLabel(p)}', const Color(0xFFDBEAFE), const Color(0xFF1E3A8A), DiwanIcons.warn);
    }
    final q = k.bq != null ? ' · ${batchText(k.bq!, p)}' : '';
    if (k.expired) {
      return CardTag('منتهية · ${k.date}$q', const Color(0xFF991B1B), Colors.white, DiwanIcons.ban);
    }
    if (k.m1) return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFEA580C), Colors.white, DiwanIcons.hourglass);
    if (k.m3) return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFF59E0B), const Color(0xFF1F1300), DiwanIcons.hourglass);
    return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFFDE68A), const Color(0xFF713F12), DiwanIcons.hourglass);
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
    final dark = context.isDark;
    final navy = dark ? DiwanColors.darkText : DiwanColors.navy;

    final all = [for (final p in idx.all) (p: p, k: alertKinds(p, cfg))];
    int cnt(AlertFilter f) => all.where((x) => _in(x.k, f)).length;
    final allowed = _q.trim().isEmpty ? null : idx.search(_q).map((p) => p.id).toSet();
    final list = all.where((x) => _in(x.k, _f) && (allowed == null || allowed.contains(x.p.id))).toList()
      ..sort((a, b) {
        final da = a.k.days ?? 1000000000, db = b.k.days ?? 1000000000;
        return da != db ? da.compareTo(db) : a.p.qty.compareTo(b.p.qty);
      });
    final phN = cnt(AlertFilter.all);

    Widget tab(int i, String label, IconData ic, int n, Color accent, Color accentBg, Color accentFg) {
      final on = _tab == i;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _tab = i),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: on ? accentBg : context.cSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: on ? accent : (dark ? DiwanColors.darkBorder : const Color(0xFFCBD5E1))),
              boxShadow: on ? [BoxShadow(color: accent.withValues(alpha: .15), spreadRadius: 3)] : null,
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(ic, size: 17, color: on ? accentFg : navy),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 13.12, fontWeight: FontWeight.w800, color: on ? accentFg : navy)),
              const SizedBox(width: 8),
              Container(
                height: 24,
                constraints: const BoxConstraints(minWidth: 26),
                padding: const EdgeInsets.symmetric(horizontal: 7),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(999)),
                child: Text('$n', style: const TextStyle(color: Colors.white, fontSize: 12.48, fontWeight: FontWeight.w900, height: 1.4)),
              ),
            ]),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: DiwanHeader(
        title: 'التنبيهات',
        icon: DiwanIcons.bell,
        trailing: [
          DiwanIconButton(
              icon: mode == ThemeMode.dark ? DiwanIcons.moon : DiwanIcons.sun,
              tooltip: 'الوضع',
              onTap: () => ref.read(themeModeProvider.notifier).toggle()),
          DiwanIconButton(icon: DiwanIcons.info, tooltip: 'مركز المعلومات', onTap: () => _soon('مركز المعلومات')),
        ],
        onHome: () => goHome(context),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 11),
          child: Row(children: [
            tab(0, 'تنبيهات الصيدلية', DiwanIcons.pill, phN, const Color(0xFFD97706), const Color(0xFFFFF7ED), const Color(0xFF9A3412)),
            const SizedBox(width: 6),
            tab(1, 'تنبيهات الأطباء', DiwanIcons.doctor, 0, const Color(0xFF0D9488), const Color(0xFFF0FDFA), const Color(0xFF115E59)),
          ]),
        ),
        Expanded(
          child: _tab == 1
              ? Center(child: Text('لا توجد طلبات من الأطباء', style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)))
              : Column(children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('تصفية التنبيهات',
                          style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w800, color: navy)),
                      const SizedBox(height: 6),
                      SizedBox(
                        height: 48,
                        child: DropdownButtonFormField<AlertFilter>(
                          initialValue: _f,
                          isExpanded: true,
                          icon: Icon(DiwanIcons.chevDown, size: 18, color: context.cTextSub),
                          decoration: InputDecoration(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: context.cBorder)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: context.cBorder)),
                          ),
                          items: [
                            for (final f in AlertFilter.values)
                              DropdownMenuItem(
                                  value: f,
                                  child: Text('${_label(f, cfg)} (${cnt(f)})',
                                      style: TextStyle(fontSize: 15.2, fontWeight: FontWeight.w700, color: navy))),
                          ],
                          onChanged: (v) => setState(() => _f = v ?? AlertFilter.all),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 46,
                        child: TextField(
                          controller: _ctl,
                          onChanged: (v) => setState(() => _q = v),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                          decoration: InputDecoration(
                            hintText: 'ابحث داخل التنبيهات...',
                            hintStyle: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: context.cTextSub),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
                          ),
                        ),
                      ),
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(34, 6, 34, 0),
                    child: Row(children: [
                      Text(_label(_f, cfg), style: TextStyle(fontSize: 13.12, fontWeight: FontWeight.w700, color: context.cTextSub)),
                      const Spacer(),
                      Text('${list.length} صنف', style: TextStyle(fontSize: 13.12, fontWeight: FontWeight.w700, color: context.cTextSub)),
                    ]),
                  ),
                  if (list.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                      child: Material(
                        color: dark ? const Color(0xFF2A1A0A) : const Color(0xFFFFF7ED),
                        shape: const RoundedRectangleBorder(
                            borderRadius: BorderRadius.all(Radius.circular(12)),
                            side: BorderSide(color: Color(0xFFB45309), style: BorderStyle.none)),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _soon('طلب الشراء'),
                          child: CustomPaint(
                            painter: _DashedRRect(const Color(0xFFB45309)),
                            child: Container(
                              height: 45.8,
                              alignment: Alignment.center,
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                Text('أضف أصناف هذه القائمة إلى طلب الشراء',
                                    style: TextStyle(fontSize: 13.33, fontWeight: FontWeight.w500, color: dark ? const Color(0xFFFDBA74) : const Color(0xFF9A3412))),
                                const SizedBox(width: 6),
                                Icon(DiwanIcons.cart, size: 17, color: dark ? const Color(0xFFFDBA74) : const Color(0xFF9A3412)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 10),
                  Expanded(
                    child: snap.when(
                      loading: () => const Center(child: CircularProgressIndicator(color: DiwanColors.gold)),
                      error: (e, _) => Center(child: Text('تعذّر تحميل المخزن: $e')),
                      data: (_) => list.isEmpty
                          ? Center(
                              child: Column(mainAxisSize: MainAxisSize.min, children: [
                                const Icon(DiwanIcons.check, size: 52, color: DiwanColors.success),
                                const SizedBox(height: 10),
                                Text('لا توجد أصناف ضمن هذا التنبيه',
                                    style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)),
                              ]),
                            )
                          : LayoutBuilder(builder: (context, c) {
                              final w = (c.maxWidth - 32 - 12) / 2;
                              const canEdit = false; // بطاقات التنبيهات بلا أزرار كمية (كالويب)
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
                                  final x = list[i];
                                  return ProductCard(
                                    key: ValueKey(x.p.id),
                                    p: x.p,
                                    cfg: cfg,
                                    tag: _tag(x.p, x.k),
                                    onTap: () => showProductSheet(context, x.p, cfg: cfg, profile: profile!, index: idx),
                                  );
                                },
                              );
                            }),
                    ),
                  ),
                ]),
        ),
      ]),
    );
  }
}

class _DashedRRect extends CustomPainter {
  _DashedRRect(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(12));
    final path = Path()..addRRect(r);
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
