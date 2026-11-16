import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/product_card.dart';
import '../widgets/product_sheet.dart';
import '../widgets/search_field.dart';

enum AlertFilter { all, expired, m1, m3, m6, low }

String _monthsTxt(int n) => n == 1 ? 'شهر' : n == 2 ? 'شهرين' : '$n${n <= 10 ? ' أشهر' : ' شهراً'}';

/// التنبيهات: صلاحية (منتهية/شهر/3 أشهر/6 أشهر) ومخزون منخفض، بنفس منطق الويب.
class AlertsScreen extends ConsumerStatefulWidget {
  const AlertsScreen({super.key});
  @override
  ConsumerState<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends ConsumerState<AlertsScreen> {
  final _ctl = TextEditingController();
  AlertFilter _f = AlertFilter.all;
  String _q = '';

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
      return CardTag('كمية قليلة: ${stockLabel(p)}', const Color(0xFFDBEAFE), const Color(0xFF1E3A8A));
    }
    final q = k.bq != null ? ' · ${batchText(k.bq!, p)}' : '';
    if (k.expired) {
      return CardTag('منتهية · ${k.date}$q', const Color(0xFF991B1B), Colors.white);
    }
    if (k.m1) return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFEA580C), Colors.white);
    if (k.m3) return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFF59E0B), const Color(0xFF1F1300));
    return CardTag('${k.date} · ${k.days} يوم$q', const Color(0xFFFDE68A), const Color(0xFF713F12));
  }

  @override
  Widget build(BuildContext context) {
    final snap = ref.watch(catalogProvider);
    final idx = ref.watch(catalogIndexProvider);
    final cfg = ref.watch(alertCfgValueProvider);
    final profile = ref.watch(profileProvider).value;

    final all = [for (final p in idx.all) (p: p, k: alertKinds(p, cfg))];
    int cnt(AlertFilter f) => all.where((x) => _in(x.k, f)).length;
    final allowed = _q.trim().isEmpty ? null : idx.search(_q).map((p) => p.id).toSet();
    final list = all.where((x) => _in(x.k, _f) && (allowed == null || allowed.contains(x.p.id))).toList()
      ..sort((a, b) {
        final da = a.k.days ?? 1000000000, db = b.k.days ?? 1000000000;
        return da != db ? da.compareTo(db) : a.p.qty.compareTo(b.p.qty);
      });

    return Scaffold(
      appBar: DiwanHeader(
        title: 'التنبيهات',
        icon: DiwanIcons.alerts,
        onHome: () => goHome(context),
        onStock: () => goStock(context),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('تصفية التنبيهات',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: context.cTextSub)),
            const SizedBox(height: 6),
            DropdownButtonFormField<AlertFilter>(
              initialValue: _f,
              isExpanded: true,
              decoration: const InputDecoration(),
              items: [
                for (final f in AlertFilter.values)
                  DropdownMenuItem(
                      value: f,
                      child: Text('${_label(f, cfg)} (${cnt(f)})',
                          style: const TextStyle(fontWeight: FontWeight.w700))),
              ],
              onChanged: (v) => setState(() => _f = v ?? AlertFilter.all),
            ),
            const SizedBox(height: 10),
            DiwanSearchField(
              controller: _ctl,
              hint: 'ابحث داخل التنبيهات...',
              onChanged: (v) => setState(() => _q = v),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: context.cSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.cBorder),
              ),
              child: Row(children: [
                Expanded(
                    child: Text(_label(_f, cfg),
                        style: const TextStyle(fontWeight: FontWeight.w900))),
                Text('${list.length} صنف',
                    style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: snap.when(
            loading: () => const Center(child: CircularProgressIndicator(color: DiwanColors.gold)),
            error: (e, _) => Center(child: Text('تعذّر تحميل المخزن: $e')),
            data: (_) => list.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(30),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(DiwanIcons.check, size: 52, color: DiwanColors.success),
                        const SizedBox(height: 10),
                        Text('لا توجد أصناف ضمن هذا التنبيه',
                            style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)),
                      ]),
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: .68,
                    ),
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final x = list[i];
                      return ProductCard(
                        key: ValueKey(x.p.id),
                        p: x.p,
                        cfg: cfg,
                        tag: _tag(x.p, x.k),
                        onTap: () => showProductSheet(context, x.p,
                            cfg: cfg, isOwner: profile?.isOwner ?? false),
                      );
                    },
                  ),
          ),
        ),
      ]),
    );
  }
}
