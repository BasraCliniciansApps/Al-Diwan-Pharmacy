import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../providers.dart';
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
            int? badge}) =>
        DiwanTile(
          style: st,
          icon: ic,
          title: title,
          subtitle: sub,
          size: size,
          badge: badge,
          enabled: _ok(perm),
          onTap: () => _soon(context),
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
              final bigH = (w - gap) / 2 * .70;
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
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
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
                        size: DiwanTileSize.big),
                  ], bigH),
                  row([
                    tile(TileStyle.navy, DiwanIcons.scan, 'فاحص المادة',
                        perm: 'stockView'),
                    tile(TileStyle.navy, DiwanIcons.customers, 'الزبائن',
                        perm: 'sell'),
                    tile(TileStyle.navy, DiwanIcons.doctors, 'ركن الأطباء',
                        perm: 'manager'),
                  ], smallH),
                  row([
                    tile(TileStyle.navy, DiwanIcons.inventory, 'الجرد',
                        perm: 'invList'),
                    tile(TileStyle.alert, DiwanIcons.alerts, 'التنبيهات',
                        perm: 'stockView'),
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
