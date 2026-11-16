import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// المستودعات: تُحقن عند التشغيل (Firestore الآن، محلي/LAN في م7).
final authRepoProvider = Provider<AuthRepository>(
    (ref) => throw UnimplementedError('authRepoProvider غير مهيّأ'));
final productRepoProvider = Provider<ProductRepository>(
    (ref) => throw UnimplementedError('productRepoProvider غير مهيّأ'));

/// المستخدم الحالي (null = غير مسجّل). يحمل الدور والصلاحيات.
final profileProvider = StreamProvider<UserProfile?>(
    (ref) => ref.watch(authRepoProvider).watchProfile());

final backStackProvider = Provider<BackStack>((ref) => BackStack());
