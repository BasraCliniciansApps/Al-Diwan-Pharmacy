import 'package:flutter/widgets.dart';

/// مكدّس رجوع يحقق قاعدة «الرجوع إلى مكان القدوم الفعلي» لا إلى شاشة مرتبطة.
/// كل انتقال أمامي = push، والرجوع = pop. الرئيسية/المخزن تُصفّر المكدّس.
class BackStack extends ChangeNotifier {
  final List<String> _s = ['/home'];

  List<String> get stack => List.unmodifiable(_s);
  String get current => _s.last;
  bool get canPop => _s.length > 1;

  void push(String route) {
    if (route == current) return;
    _s.add(route);
    notifyListeners();
  }

  /// يعود للمكان الفعلي السابق؛ يرجع المسار الجديد أو null عند الجذر.
  String? pop() {
    if (!canPop) return null;
    _s.removeLast();
    notifyListeners();
    return current;
  }

  /// أيقونتا الرئيسية/المخزن: قفز مباشر مع تصفير المكدّس.
  void reset(String route) {
    _s
      ..clear()
      ..add(route);
    notifyListeners();
  }
}
