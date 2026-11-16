import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart' show FontLoader;
import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_mobile/app.dart';
import 'package:diwan_mobile/providers.dart';
import 'package:diwan_mobile/screens/scan_card_screen.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeAuth implements AuthRepository {
  _FakeAuth(this.profile);
  UserProfile? profile;
  @override
  Stream<UserProfile?> watchProfile() => Stream.value(profile);
  @override
  Future<void> signIn(String l, String p) async {}
  @override
  Future<void> signOut() async {}
}

class _FakeProducts implements ProductRepository {
  @override
  Future<int> countProducts() async => 7;
}

void _phone(WidgetTester t) {
  t.view.physicalSize = const Size(1080, 2400); // هاتف نموذجي
  t.view.devicePixelRatio = 2.625;
  addTearDown(t.view.reset);
}

final _items = (jsonDecode(File('../../../tools/parity/seed_products.json').readAsStringSync()) as List)
    .cast<Map<String, dynamic>>();

class _FakeCatalog implements CatalogRepository {
  @override
  Stream<CatalogSnapshot> watchCatalog() =>
      Stream.value(CatalogSnapshot(CatalogIndex([for (final m in _items) Product(m)])));
  @override
  Stream<AlertConfig> watchAlertConfig() => Stream.value(const AlertConfig());
  @override
  Stream<ScanConfig> watchScanConfig() => Stream.value(const ScanConfig());
  @override
  Stream<List<Map<String, dynamic>>> watchPurchases() => Stream.value(const []);
}

Widget _app(UserProfile? p) => ProviderScope(
      overrides: [
        authRepoProvider.overrideWithValue(_FakeAuth(p)),
        productRepoProvider.overrideWithValue(_FakeProducts()),
        catalogRepoFactoryProvider.overrideWithValue((_) => _FakeCatalog()),
      ],
      child: const DiwanApp(),
    );

Future<void> _loadFonts() async {
  Future<ByteData> f(String n) async =>
      ByteData.sublistView(await File('../../packages/ui_kit/assets/fonts/$n').readAsBytes());
  final r = FontLoader('packages/diwan_ui/ArefRuqaa')..addFont(f('ArefRuqaa-Bold.ttf'));
  final t = FontLoader('packages/diwan_ui/Tajawal')
    ..addFont(f('Tajawal-Regular.ttf'))
    ..addFont(f('Tajawal-Bold.ttf'));
  await r.load();
  await t.load();
  if (Platform.environment['GOLDEN'] != null) {
    final home = Platform.environment['HOME'] ?? '';
    final f = File('$home/.pub-cache/hosted/pub.dev/lucide_icons_flutter-4.0.3/assets/build_font/LucideVariable-w300.ttf');
    for (final w in ['300', '600']) {
      final ff = File('$home/.pub-cache/hosted/pub.dev/lucide_icons_flutter-4.0.3/assets/build_font/LucideVariable-w$w.ttf');
      if (ff.existsSync()) {
        final l = FontLoader('packages/lucide_icons_flutter/Lucide$w')
          ..addFont(Future.value(ByteData.sublistView(ff.readAsBytesSync())));
        await l.load();
      }
    }
    if (f.existsSync()) {}
  }
}

void main() {
  setUpAll(_loadFonts);
  testWidgets('بلا جلسة: تظهر شاشة الدخول', (t) async {
    _phone(t);
    await t.pumpWidget(_app(null));
    await t.pumpAndSettle();
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });

  testWidgets('المالك: الرئيسية بكل البلاطات والاتجاه RTL', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    expect(find.text('شاشة البيع'), findsOneWidget);
    expect(find.text('الجرد'), findsOneWidget);
    expect(find.text('المصروفات والأرباح'), findsOneWidget);
    expect(find.text('المدير'), findsOneWidget);
    expect(find.text('المالك'), findsNothing);
    final ctx = t.element(find.text('الرئيسية'));
    expect(Directionality.of(ctx), TextDirection.rtl);
    expect(MediaQuery.of(ctx).textScaler, TextScaler.noScaling);
  });

  testWidgets('اختبار الاتصال يعرض عدد المواد', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(find.text('اختبار الاتصال (م0)'), 200);
    await t.tap(find.text('اختبار الاتصال (م0)'));
    await t.pumpAndSettle();
    await t.tap(find.text('فحص'));
    await t.pumpAndSettle();
    expect(find.textContaining('7'), findsWidgets);
  });

  testWidgets('زر الوضع الليلي يبدّل الثيم', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    Brightness b() => Theme.of(t.element(find.text('الرئيسية'))).brightness;
    expect(b(), Brightness.light);
    await t.tap(find.byTooltip('الوضع الليلي'));
    await t.pumpAndSettle();
    expect(b(), Brightness.dark);
  });

  testWidgets('لقطة الرئيسية (golden)', skip: Platform.environment['GOLDEN'] == null, (t) async {
    _phone(t);
    await t.pumpWidget(RepaintBoundary(
        key: const Key('shot'), child: _app(UserProfile.owner(diwanOwnerUid))));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('shot')),
        matchesGoldenFile('goldens/home_light.png'));
    await t.tap(find.byTooltip('الوضع الليلي'));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('shot')),
        matchesGoldenFile('goldens/home_dark.png'));
  });

  testWidgets('المخزن: يعرض المواد ويبحث ويصفّي «المتوفر فقط»', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    await t.tap(find.text('الأصناف والكميات'));
    await t.pumpAndSettle();
    expect(find.text('Panadol Extra 500mg'), findsOneWidget);
    expect(find.text('8 صنف'), findsOneWidget);
    await t.enterText(find.byType(TextField), 'augmentn'); // خطأ إملائي
    await t.pump(const Duration(milliseconds: 300));
    expect(find.text('Augmentin 1g'), findsOneWidget);
    expect(find.text('Panadol Extra 500mg'), findsNothing);
    await t.enterText(find.byType(TextField), '6291041500213'); // باركود
    await t.pump(const Duration(milliseconds: 300));
    expect(find.text('Panadol Extra 500mg'), findsOneWidget);
    await t.enterText(find.byType(TextField), '');
    await t.pump(const Duration(milliseconds: 300));
    // نافذة التصفية: المتوفر فقط
    await t.tap(find.byTooltip('تصفية'));
    await t.pumpAndSettle();
    await t.tap(find.text('المتوفر فقط'));
    await t.pumpAndSettle();
    expect(find.text('عرض 7 صنف'), findsOneWidget);
  });

  testWidgets('الرئيسية: شارة التنبيهات تحسب الكمية القليلة والصلاحية', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    expect(find.text('5'), findsWidgets); // نفس رقم الويب على نفس البيانات
  });

  testWidgets('التنبيهات: تفتح وتعرض المواد المعنية', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    await t.tap(find.text('التنبيهات'));
    await t.pumpAndSettle();
    expect(find.text('Augmentin 1g'), findsOneWidget);
    expect(find.text('Brufen 400'), findsOneWidget);
    expect(find.text('Zyrtec 10mg'), findsNothing);
  });

  testWidgets('الرجوع يعود إلى مكان القدوم الفعلي', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    await t.tap(find.text('التنبيهات'));
    await t.pumpAndSettle();
    final nav = Navigator.of(t.element(find.text('كل التنبيهات').first));
    expect(nav.canPop(), true);
    nav.pop();
    await t.pumpAndSettle();
    expect(find.text('شاشة البيع'), findsOneWidget);
  });

  /// لقطات التكافؤ البصري مع الويب (تُكتب في docs/parity/app) — تُشغَّل يدوياً: GOLDEN=1
  testWidgets('لقطات التكافؤ (golden)', skip: Platform.environment['GOLDEN'] == null, (t) async {
    _phone(t);
    const out = '../../../../docs/parity/app';
    await t.pumpWidget(RepaintBoundary(key: const Key('s'), child: _app(UserProfile.owner(diwanOwnerUid))));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('$out/home.png'));
    await t.tap(find.text('الأصناف والكميات'));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('$out/stock.png'));
    await t.tap(find.text('Panadol Extra 500mg'));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('$out/sheet.png'));
    await t.tapAt(const Offset(200, 30)); // إغلاق النافذة
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('تصفية'));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('$out/filter.png'));
    await t.tapAt(const Offset(200, 30));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('التنبيهات'));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('$out/alerts.png'));
    Navigator.of(t.element(find.text('كل التنبيهات').first)).pop();
    await t.pumpAndSettle();
  });

  testWidgets('لقطة بطاقة الفاحص (golden)', skip: Platform.environment['GOLDEN'] == null, (t) async {
    _phone(t);
    await t.pumpWidget(RepaintBoundary(key: const Key('s'), child: _app(UserProfile.owner(diwanOwnerUid))));
    await t.pumpAndSettle();
    Navigator.of(t.element(find.text('شاشة البيع'))).push(MaterialPageRoute<void>(builder: (_) => const ScanCardScreen(productId: 8)));
    await t.pumpAndSettle();
    await expectLater(find.byKey(const Key('s')), matchesGoldenFile('../../../../docs/parity/app/scan_card.png'));
  });

  testWidgets('بطاقة الفاحص: حاسبة الخصم تعرض النتيجة', (t) async {
    _phone(t);
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    Navigator.of(t.element(find.text('شاشة البيع'))).push(MaterialPageRoute<void>(builder: (_) => const ScanCardScreen(productId: 8)));
    await t.pumpAndSettle();
    expect(find.text('3,500 د.ع'), findsWidgets);
    await t.scrollUntilVisible(find.text('حاسبة الخصم'), 200, scrollable: find.byType(Scrollable).last);
    await t.tap(find.text('10٪'));
    await t.pumpAndSettle();
    expect(find.textContaining('خصم 10.0٪'), findsOneWidget);
  });
}
