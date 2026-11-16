import 'dart:async';

import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/product_card.dart';
import '../widgets/product_sheet.dart';
import '../widgets/search_field.dart';

/// المخزن: بحث ذكي (اسم/شركة/مادة فعّالة/باركود) + مسح باركود + تصفية التوفر.
class StockScreen extends ConsumerStatefulWidget {
  const StockScreen({super.key});
  @override
  ConsumerState<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends ConsumerState<StockScreen> {
  final _ctl = TextEditingController();
  Timer? _deb;
  String _q = '';
  int _tab = 0; // 0 الكل · 1 متوفر · 2 نافد

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

  @override
  Widget build(BuildContext context) {
    final snap = ref.watch(catalogProvider);
    final idx = ref.watch(catalogIndexProvider);
    final cfg = ref.watch(alertCfgValueProvider);
    final profile = ref.watch(profileProvider).value;

    bool tabOk(Product p) => !p.arch && (_tab == 0 || (_tab == 1 ? p.inStock : !p.inStock));
    final base = idx.all.where((p) => !p.arch).toList();
    final inN = base.where((p) => p.inStock).length;
    final list = idx.search(_q, where: tabOk);

    return Scaffold(
      appBar: DiwanHeader(
        title: 'المخزن',
        icon: DiwanIcons.stock,
        onHome: () => goHome(context),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
          child: DiwanSearchField(
            controller: _ctl,
            hint: 'ابحث بالاسم التجاري أو المادة الفعالة أو الباركود',
            onChanged: _onChanged,
            onScan: _scan,
          ),
        ),
        DiwanTabs(
          labels: ['الكل (${base.length})', 'متوفر ($inN)', 'نافد (${base.length - inN})'],
          index: _tab,
          onChanged: (i) => setState(() => _tab = i),
        ),
        Expanded(
          child: snap.when(
            loading: () => const Center(child: CircularProgressIndicator(color: DiwanColors.gold)),
            error: (e, _) => Center(child: Text('تعذّر تحميل المخزن: $e')),
            data: (_) => list.isEmpty
                ? _Empty(query: _q)
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 24),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: .68,
                    ),
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final p = list[i];
                      return ProductCard(
                        key: ValueKey(p.id),
                        p: p,
                        cfg: cfg,
                        onTap: () => showProductSheet(context, p,
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

class _Empty extends StatelessWidget {
  const _Empty({required this.query});
  final String query;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(DiwanIcons.empty, size: 52, color: context.cTextSub.withValues(alpha: .6)),
            const SizedBox(height: 12),
            Text(query.isEmpty ? 'لا توجد مواد' : 'لا نتائج لـ «$query»',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w800, color: context.cTextSub)),
          ]),
        ),
      );
}
