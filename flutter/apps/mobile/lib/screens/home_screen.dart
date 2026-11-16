import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers.dart';
import 'connection_test_screen.dart';

/// الرئيسية (م0): نفس تخطيط الويب (بلاطتان كبيرتان، صف مربعين، صفان من 3).
/// الوظائف تُفعَّل في المراحل التالية؛ الآن تُظهر «قريباً» دون تغيير التخطيط.
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tiles = <_T>[
      _T('شاشة البيع', 'بيع سريع', LucideIcons.store, 'sell'),
      _T('فاتورة', 'إصدار وإدارة الفواتير', LucideIcons.receipt, 'sell'),
    ];
    return Scaffold(
      body: Column(
        children: [
          _Brand(
              onLogout: () => _logout(context, ref),
              name: profile.isOwner ? 'المالك' : profile.name),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 20),
              children: [
                Row(children: [
                  for (final t in tiles)
                    Expanded(
                        child: _Tile(t, profile, big: true, onSoon: _soon)),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                      child: _Tile(
                          _T('الوارد', 'فواتير المذاخر', LucideIcons.truck,
                              'purchases'),
                          profile,
                          mid: true,
                          onSoon: _soon)),
                  Expanded(
                      child: _Tile(
                          _T('مخزن', 'الأصناف والكميات', LucideIcons.package,
                              'stockView'),
                          profile,
                          mid: true,
                          onSoon: _soon)),
                ]),
                const SizedBox(height: 10),
                _row3(context, profile, [
                  _T('فاحص المادة', '', LucideIcons.scanLine, 'stockView'),
                  _T('الزبائن', '', LucideIcons.users, 'sell'),
                  _T('ركن الأطباء', '', LucideIcons.fileText, 'owner'),
                ]),
                const SizedBox(height: 10),
                _row3(context, profile, [
                  _T('الجرد', '', LucideIcons.clipboardCheck, 'invList'),
                  _T('التنبيهات', '', LucideIcons.bell, 'stockView'),
                  _T('الإعدادات', '', LucideIcons.settings, 'owner'),
                ]),
                const SizedBox(height: 10),
                _row3(context, profile, [
                  _T('حاسبة الأسعار', '', LucideIcons.calculator, null),
                  _T('سجل الأدوية', '', LucideIcons.bookOpen, null),
                  _T('المصروفات والأرباح', '', LucideIcons.wallet, 'owner'),
                ]),
                const SizedBox(height: 18),
                // أداة م0 فقط: اختبار الربط بـ Firestore (قراءة فقط).
                OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => const ConnectionTestScreen())),
                  icon: const Icon(LucideIcons.activity, size: 18),
                  label: const Text('اختبار الاتصال (م0)'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row3(BuildContext c, UserProfile p, List<_T> ts) => Row(children: [
        for (final t in ts) Expanded(child: _Tile(t, p, onSoon: _soon)),
      ]);
}

class _T {
  const _T(this.title, this.sub, this.icon, this.perm);
  final String title, sub;
  final IconData icon;
  final String? perm; // null = متاح للجميع، 'owner' = للمالك فقط
}

class _Tile extends StatelessWidget {
  const _Tile(this.t, this.profile,
      {this.big = false, this.mid = false, required this.onSoon});
  final _T t;
  final UserProfile profile;
  final bool big, mid;
  final void Function(BuildContext) onSoon;

  @override
  Widget build(BuildContext context) {
    final allowed = t.perm == null
        ? true
        : t.perm == 'owner'
            ? profile.isOwner
            : profile.can(t.perm);
    final h = big ? 128.0 : (mid ? 92.0 : 84.0);
    final isz = big ? 46.0 : (mid ? 34.0 : 30.0);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Opacity(
        opacity: allowed ? 1 : .38, // صلاحية مفقودة = معطّل بنفس التخطيط
        child: Material(
          color: DiwanColors.surface,
          borderRadius: BorderRadius.circular(18),
          elevation: 1.5,
          shadowColor: DiwanColors.navy.withValues(alpha: .25),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: allowed ? () => onSoon(context) : null,
            child: SizedBox(
              height: h,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(t.icon, size: isz, color: DiwanColors.navy),
                  const SizedBox(height: 6),
                  Text(t.title,
                      textAlign: TextAlign.center,
                      style: ruqaa(size: big ? 19 : 14.5, color: DiwanColors.navy)),
                  if (big && t.sub.isNotEmpty)
                    Text(t.sub,
                        style: const TextStyle(
                            fontSize: 11.5, color: DiwanColors.textSub)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand({required this.onLogout, required this.name});
  final VoidCallback onLogout;
  final String name;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Container(
      padding: EdgeInsets.fromLTRB(14, top + 10, 10, 12),
      decoration: const BoxDecoration(
        color: DiwanColors.navy,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
        border: Border(bottom: BorderSide(color: DiwanColors.gold, width: 2)),
      ),
      child: Column(children: [
        Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset('images/logo.jpg',
                package: 'diwan_ui', width: 40, height: 40),
          ),
          const SizedBox(width: 10),
          Text('صيدلية الديوان',
              style: ruqaa(size: 22, color: DiwanColors.gold)),
          const Spacer(),
          IconButton(
            onPressed: onLogout,
            tooltip: 'تسجيل الخروج',
            icon: const Icon(LucideIcons.power,
                color: DiwanColors.gold, size: 22),
          ),
        ]),
        const SizedBox(height: 4),
        Row(children: [
          const Icon(LucideIcons.house, size: 18, color: DiwanColors.slateText),
          const SizedBox(width: 6),
          Text('الرئيسية',
              style: ruqaa(size: 16.8, color: DiwanColors.slateText)),
          const Spacer(),
          Text(name,
              style: const TextStyle(
                  color: DiwanColors.slateText, fontSize: 12.5)),
        ]),
        const DiwanProgressBar(),
      ]),
    );
  }
}
