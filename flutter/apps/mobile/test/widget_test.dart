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

Widget _app(UserProfile? p) => ProviderScope(
      overrides: [
        authRepoProvider.overrideWithValue(_FakeAuth(p)),
        productRepoProvider.overrideWithValue(_FakeProducts()),
      ],
      child: const DiwanApp(),
    );

void main() {
  testWidgets('بلا جلسة: تظهر شاشة الدخول', (t) async {
    await t.pumpWidget(_app(null));
    await t.pumpAndSettle();
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });

  testWidgets('المالك: الرئيسية بكل البلاطات والاتجاه RTL', (t) async {
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    expect(find.text('شاشة البيع'), findsOneWidget);
    expect(find.text('الجرد'), findsOneWidget);
    expect(find.text('المصروفات والأرباح'), findsOneWidget);
    final ctx = t.element(find.text('الرئيسية'));
    expect(Directionality.of(ctx), TextDirection.rtl);
    expect(MediaQuery.of(ctx).textScaler, TextScaler.noScaling);
  });

  testWidgets('اختبار الاتصال يعرض عدد المواد', (t) async {
    await t.pumpWidget(_app(UserProfile.owner(diwanOwnerUid)));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(find.text('اختبار الاتصال (م0)'), 200);
    await t.tap(find.text('اختبار الاتصال (م0)'));
    await t.pumpAndSettle();
    await t.tap(find.text('فحص'));
    await t.pumpAndSettle();
    expect(find.textContaining('7'), findsWidgets);
  });
}
