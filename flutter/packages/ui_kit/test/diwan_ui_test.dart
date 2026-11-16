import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('الرجوع يعود إلى مكان القدوم الفعلي', () {
    final b = BackStack();
    b.push('/stock');
    b.push('/scan'); // قدمنا من المخزن إلى الفاحص
    expect(b.pop(), '/stock');
    expect(b.pop(), '/home');
    expect(b.pop(), isNull);
  });

  test('الرئيسية تُصفّر المكدّس', () {
    final b = BackStack()
      ..push('/stock')
      ..push('/scan')
      ..reset('/home');
    expect(b.canPop, false);
    expect(b.current, '/home');
  });

  test('شريط التقدّم يظهر أثناء العملية فقط', () async {
    final busy = DiwanBusy();
    var during = 0;
    await busy.run(() async => during = busy.value);
    expect(during, 1);
    expect(busy.value, 0);
    await expectLater(busy.run(() async => throw Exception('x')), throwsException);
    expect(busy.value, 0);
  });
}
