import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../providers.dart';
import '../nav.dart';
import 'connection_test_screen.dart';

/// الرئيسية (م0): نفس ألوان وتخطيط الويب. الوظائف تُفعَّل في المراحل التالية.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key, required this.profile});
  final UserProfile profile;

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await showDiwanConfirm(context,
        title: 'تسجيل الخروج؟', confirmLabel: 'نعم، خروج');
    if (ok) await ref.read(authRepoProvider).signOut();
  }

  void _soon(BuildContext context) =>
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('هذه الشاشة تُفعَّل في مرحلة لاحقة'),
        duration: Duration(seconds: 1),
      ));

  bool _ok(String? perm) => perm == null
      ? true
      : perm == 'manager'
          ? profile.isOwner
          : profile.can(perm);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final dark = mode == ThemeMode.dark;

    Widget tile(TileStyle st, IconData ic, String title,
            {String? sub,
            String? perm,
            DiwanTileSize size = DiwanTileSize.small,
            int? badge,
            VoidCallback? go}) =>
        DiwanTile(
          style: st,
          icon: ic,
          title: title,
          subtitle: sub,
          size: size,
          badge: badge,
          enabled: _ok(perm),
          onTap: go ?? () => _soon(context),
        );

    return Scaffold(
      body: Column(
        children: [
          DiwanHeader(
            title: 'الرئيسية',
            icon: DiwanIcons.home,
            sideLabel: profile.displayName,
            trailing: [
              DiwanIconButton(
                  icon: dark ? DiwanIcons.moon : DiwanIcons.sun,
                  tooltip: dark ? 'الوضع النهاري' : 'الوضع الليلي',
                  onTap: () => ref.read(themeModeProvider.notifier).toggle()),
              DiwanIconButton(
                  icon: DiwanIcons.info,
                  tooltip: 'مركز المعلومات',
                  onTap: () => _soon(context)),
              DiwanIconButton(
                  icon: DiwanIcons.logout,
                  tooltip: 'تسجيل الخروج',
                  onTap: () => _logout(context, ref)),
            ],
          ),
          Expanded(
            child: LayoutBuilder(builder: (context, c) {
              // نسب ثابتة من العرض فيبقى التخطيط واحداً على كل الشاشات.
              final w = c.maxWidth - 32;
              const gap = 12.0;
              final bigH = (w - gap) / 2 * .796;
              final smallH = (w - 2 * gap) / 3 * .87;
              Widget row(List<Widget> ch, double h) => Padding(
                    padding: const EdgeInsets.only(bottom: gap),
                    child: SizedBox(
                      height: h,
                      child: Row(children: [
                        for (var i = 0; i < ch.length; i++) ...[
                          if (i > 0) const SizedBox(width: gap),
                          Expanded(child: ch[i]),
                        ],
                      ]),
                    ),
                  );
              final idx = ref.watch(catalogIndexProvider);
              final cfg = ref.watch(alertCfgValueProvider);
              final live = idx.all.where((p) => !p.arch);
              final kOut = live.where((p) => !p.inStock).length;
              final kLow = live.where((p) => isLowStock(p, cfg)).length;
              final kExp = expiringCount(idx.all);
              Widget kpi(String label, String val, Color col, {double fs = 20.8}) => Expanded(
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        color: context.cSurface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: context.isDark ? DiwanColors.darkBorder : const Color(0xFFE6EAF3)),
                        boxShadow: const [BoxShadow(color: Color(0x730F1C38), blurRadius: 16, spreadRadius: -12, offset: Offset(0, 8))],
                      ),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        Text(val, style: TextStyle(fontSize: fs, fontWeight: FontWeight.w900, height: 1.15, color: col)),
                        Text(label,
                            maxLines: 1,
                            softWrap: false,
                            overflow: TextOverflow.visible,
                            style: TextStyle(fontSize: 9.92, fontWeight: FontWeight.w700, height: 1.2, color: context.cTextSub)),
                      ]),
                    ),
                  );
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  // تذكير النسخة الاحتياطية (يختفي بعد أول نسخة كاملة؛ وظيفتها في المرحلة 5)
                  Container(
                    height: 41.7,
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: context.isDark ? const Color(0xFF3B2F12) : const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: context.isDark ? const Color(0xFF7C5E10) : const Color(0xFFFCD34D)),
                    ),
                    child: Row(children: [
                      Icon(DiwanIcons.warn, size: 16, color: context.isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E)),
                      const SizedBox(width: 6),
                      Text('لم تُحمَّل نسخة كاملة بعد',
                          style: TextStyle(fontSize: 13.1, color: context.isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E))),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => _soon(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: DiwanColors.navy, borderRadius: BorderRadius.circular(9)),
                          child: const Text('تحميل الآن', style: TextStyle(color: Colors.white, fontSize: 13.3)),
                        ),
                      ),
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(children: [
                      kpi('غير متوفر', '$kOut', const Color(0xFFB91C1C)),
                      const SizedBox(width: 6),
                      kpi('كمية قليلة', '$kLow', const Color(0xFFC2410C)),
                      const SizedBox(width: 6),
                      kpi('قريب الانتهاء', '$kExp', const Color(0xFFA16207)),
                      const SizedBox(width: 6),
                      kpi('مبيعات اليوم', '0', const Color(0xFF15803D), fs: 16.8),
                    ]),
                  ),
                  row([
                    tile(TileStyle.pos, DiwanIcons.pos, 'شاشة البيع',
                        sub: 'بيع سريع',
                        perm: 'sell',
                        size: DiwanTileSize.big),
                    tile(TileStyle.bill, DiwanIcons.bill, 'فاتورة',
                        sub: 'إصدار وإدارة الفواتير',
                        perm: 'sell',
                        size: DiwanTileSize.big),
                  ], bigH),
                  row([
                    tile(TileStyle.purch, DiwanIcons.purchases, 'الوارد',
                        sub: 'فواتير المذاخر',
                        perm: 'purchases',
                        size: DiwanTileSize.big),
                    tile(TileStyle.stock, DiwanIcons.stock, 'مخزن',
                        sub: 'الأصناف والكميات',
                        perm: 'stockView',
                        size: DiwanTileSize.big,
                        go: () => openStock(context)),
                  ], bigH),
                  row([
                    tile(TileStyle.navy, DiwanIcons.scan, 'فاحص المادة',
                        perm: 'stockView', go: () => openScanner(context)),
                    tile(TileStyle.navy, DiwanIcons.customers, 'الزبائن',
                        perm: 'sell'),
                    tile(TileStyle.navy, DiwanIcons.doctors, 'ركن الأطباء',
                        perm: 'manager'),
                  ], smallH),
                  row([
                    tile(TileStyle.navy, DiwanIcons.inventory, 'الجرد',
                        perm: 'invList'),
                    tile(TileStyle.alert, DiwanIcons.alerts, 'التنبيهات',
                        perm: 'stockView',
                        badge: ref.watch(alertCountProvider),
                        go: () => openAlerts(context)),
                    tile(TileStyle.navy, DiwanIcons.settings, 'الإعدادات',
                        perm: 'manager'),
                  ], smallH),
                  row([
                    tile(TileStyle.navy, DiwanIcons.calculator,
                        'حاسبة الأسعار'),
                    tile(TileStyle.navy, DiwanIcons.registry, 'سجل الأدوية'),
                    tile(TileStyle.navy, DiwanIcons.finance,
                        'المصروفات والأرباح',
                        perm: 'manager'),
                  ], smallH),
                  const SizedBox(height: 6),
                  // أداة م0 فقط: اختبار الربط بـ Firestore (قراءة فقط).
                  OutlinedButton.icon(
                    onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ConnectionTestScreen())),
                    icon: const Icon(DiwanIcons.activity, size: 18),
                    label: const Text('اختبار الاتصال (م0)'),
                  ),
                ],
              );
            }),
          ),
        ],
      ),
    );
  }
}
