import 'user_profile.dart';

/// واجهات مجرّدة: تنفيذ Firestore الآن، وتنفيذ محلي (Drift/LAN) في المرحلة 7.
abstract class AuthRepository {
  /// المستخدم الحالي مع دوره، أو null عند عدم تسجيل الدخول.
  Stream<UserProfile?> watchProfile();

  /// [login] اسم مستخدم أو بريد. يرمي [AuthFailure] برسالة عربية.
  Future<void> signIn(String login, String password);

  Future<void> signOut();
}

abstract class ProductRepository {
  /// عدد المواد في pharmacy_products (قراءة تجريبية لاختبار الربط، م0).
  Future<int> countProducts();
}

class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
  @override
  String toString() => message;
}
