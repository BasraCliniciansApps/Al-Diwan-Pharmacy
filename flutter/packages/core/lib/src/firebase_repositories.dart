import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'repositories.dart';
import 'user_profile.dart';

class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({FirebaseAuth? auth, FirebaseFirestore? db})
      : _auth = auth ?? FirebaseAuth.instance,
        _db = db ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  @override
  Stream<UserProfile?> watchProfile() async* {
    await for (final u in _auth.authStateChanges()) {
      if (u == null) {
        yield null;
        continue;
      }
      if (UserProfile.isOwnerUid(u.uid)) {
        yield UserProfile.owner(u.uid);
        continue;
      }
      try {
        final d = await _db.collection('pharmacy_users').doc(u.uid).get();
        final data = d.data();
        if (data == null || data['active'] != true) {
          await _auth.signOut();
          yield null;
        } else {
          yield UserProfile.fromDoc(u.uid, data);
        }
      } catch (_) {
        yield null;
      }
    }
  }

  @override
  Future<void> signIn(String login, String password) async {
    var email = login.trim();
    if (email.isEmpty || password.isEmpty) {
      throw const AuthFailure('أدخل اسم المستخدم (أو البريد) وكلمة المرور');
    }
    try {
      if (!email.contains('@')) {
        final ld =
            await _db.collection('pharmacy_logins').doc(loginKey(email)).get();
        final em = ld.data()?['email']?.toString() ?? '';
        if (em.isEmpty) throw const AuthFailure('بيانات الدخول غير صحيحة');
        email = em;
      }
      await _auth.signInWithEmailAndPassword(email: email, password: password);
    } on AuthFailure {
      rethrow;
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.code == 'network-request-failed'
          ? 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.'
          : 'بيانات الدخول غير صحيحة');
    } catch (_) {
      throw const AuthFailure('تعذّر إتمام الدخول. تحقق من الإنترنت.');
    }
  }

  @override
  Future<void> signOut() => _auth.signOut();
}

class FirebaseProductRepository implements ProductRepository {
  FirebaseProductRepository({FirebaseFirestore? db})
      : _db = db ?? FirebaseFirestore.instance;
  final FirebaseFirestore _db;

  @override
  Future<int> countProducts() async {
    // استعلام تجميعي: قراءة واحدة بدل تحميل المجموعة كاملة (حماية القراءات).
    final snap = await _db.collection('pharmacy_products').count().get();
    return snap.count ?? 0;
  }
}
