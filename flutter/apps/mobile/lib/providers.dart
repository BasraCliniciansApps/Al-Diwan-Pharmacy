import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// المستودعات: تُحقن عند التشغيل (Firestore الآن، محلي/LAN في م7).
final authRepoProvider = Provider<AuthRepository>(
    (ref) => throw UnimplementedError('authRepoProvider غير مهيّأ'));
final productRepoProvider = Provider<ProductRepository>(
    (ref) => throw UnimplementedError('productRepoProvider غير مهيّأ'));

/// المستخدم الحالي (null = غير مسجّل). يحمل الدور والصلاحيات.
final profileProvider = StreamProvider<UserProfile?>(
    (ref) => ref.watch(authRepoProvider).watchProfile());

final backStackProvider = Provider<BackStack>((ref) => BackStack());

/// الوضع النهاري/الليلي، يُحفظ على الجهاز.
class ThemeModeNotifier extends Notifier<ThemeMode> {
  static const _k = 'diwanThemeDark';

  @override
  ThemeMode build() {
    _load();
    return ThemeMode.light;
  }

  Future<void> _load() async {
    try {
      final p = await SharedPreferences.getInstance();
      if (p.getBool(_k) == true) state = ThemeMode.dark;
    } catch (_) {}
  }

  Future<void> toggle() async {
    state = state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    try {
      final p = await SharedPreferences.getInstance();
      await p.setBool(_k, state == ThemeMode.dark);
    } catch (_) {}
  }
}

final themeModeProvider =
    NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);
