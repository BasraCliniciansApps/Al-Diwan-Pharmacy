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

// ───────────── المخزن (م1) ─────────────

typedef CatalogRepoFactory = CatalogRepository Function(UserProfile profile);

/// مصنع مستودع المخزن (Firestore الآن؛ الاختبارات/المرحلة 7 تستبدله).
final catalogRepoFactoryProvider = Provider<CatalogRepoFactory>(
    (ref) => (profile) => FirebaseCatalogRepository(profile));

/// لقطة المخزن الحيّة (تبقى حيّة بين الشاشات حتى الخروج).
final catalogProvider = StreamProvider<CatalogSnapshot>((ref) {
  final profile = ref.watch(profileProvider).value;
  if (profile == null) return const Stream.empty();
  return ref.watch(catalogRepoFactoryProvider)(profile).watchCatalog();
});

final alertConfigProvider = StreamProvider<AlertConfig>((ref) {
  final profile = ref.watch(profileProvider).value;
  if (profile == null) return const Stream.empty();
  return ref.watch(catalogRepoFactoryProvider)(profile).watchAlertConfig();
});

/// فهرس المخزن الحالي (فارغ حتى يصل أول تحديث).
final catalogIndexProvider = Provider<CatalogIndex>(
    (ref) => ref.watch(catalogProvider).value?.index ?? CatalogIndex.empty);

final alertCfgValueProvider = Provider<AlertConfig>(
    (ref) => ref.watch(alertConfigProvider).value ?? const AlertConfig());

/// عدد المواد التي عليها تنبيه (صلاحية خلال 6 أشهر أو كمية قليلة) كما في الويب.
final alertCountProvider = Provider<int>((ref) {
  final idx = ref.watch(catalogIndexProvider);
  final cfg = ref.watch(alertCfgValueProvider);
  var n = 0;
  for (final p in idx.all) {
    if (alertKinds(p, cfg).any) n++;
  }
  return n;
});

final scanConfigProvider = StreamProvider<ScanConfig>((ref) {
  final profile = ref.watch(profileProvider).value;
  if (profile == null) return const Stream.empty();
  return ref.watch(catalogRepoFactoryProvider)(profile).watchScanConfig();
});

final purchasesProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final profile = ref.watch(profileProvider).value;
  if (profile == null) return const Stream.empty();
  return ref.watch(catalogRepoFactoryProvider)(profile).watchPurchases();
});
