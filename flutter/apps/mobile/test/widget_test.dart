import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart' show FontLoader;
import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_mobile/app.dart';
import 'package:diwan_mobile/providers.dart';
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

Widget _app(UserProfile? p) => ProviderScope(
      overrides: [
        authRepoProvider.overrideWithValue(_FakeAuth(p)),
        productRepoProvider.overrideWithValue(_FakeProducts()),
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
}
