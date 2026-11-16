import 'package:diwan_core/diwan_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('loginKey مطابق لـ loginKey في الويب', () {
    expect(loginKey('  Ali  Hassan.x '), 'ali_hassanx');
    expect(loginKey('a/b#c?d[e]f'), 'abcdef');
  });

  test('المالك يملك كل الصلاحيات', () {
    final o = UserProfile.owner(diwanOwnerUid);
    expect(o.can('sell'), true);
    expect(o.can('anything'), true);
  });

  test('الموظف: ما لم يُمنح يُمنع', () {
    final s = UserProfile.fromDoc('u1', {
      'active': true,
      'perms': {'sell': true, 'stockEdit': false},
    });
    expect(s.can('sell'), true);
    expect(s.can('stockEdit'), false);
    expect(s.can('purchases'), false);
    expect(s.can(null), true);
  });
}
