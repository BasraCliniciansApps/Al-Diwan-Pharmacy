import 'firebase_options.dart';

enum DiwanRole { owner, staff }

/// الدور والصلاحيات (مرآة `can()` في security.js: المالك يملك كل شيء).
class UserProfile {
  const UserProfile({
    required this.uid,
    required this.role,
    this.name = '',
    this.perms = const {},
  });

  final String uid;
  final DiwanRole role;
  final String name;
  final Map<String, bool> perms;

  bool get isOwner => role == DiwanRole.owner;

  /// الاسم المعروض: «المدير» للمالك، واسم الموظف لغيره.
  String get displayName => isOwner ? 'المدير' : name;

  bool can(String? perm) =>
      perm == null || perm.isEmpty || isOwner || (perms[perm] ?? false);

  factory UserProfile.owner(String uid) =>
      UserProfile(uid: uid, role: DiwanRole.owner, name: 'المدير');

  factory UserProfile.fromDoc(String uid, Map<String, dynamic> d) {
    final raw = d['perms'];
    final perms = <String, bool>{};
    if (raw is Map) {
      raw.forEach((k, v) => perms['$k'] = v == true);
    }
    return UserProfile(
      uid: uid,
      role: DiwanRole.staff,
      name: (d['name'] ?? d['displayName'] ?? '').toString(),
      perms: perms,
    );
  }

  static bool isOwnerUid(String uid) => uid == diwanOwnerUid;
}

/// مفتاح اسم المستخدم في pharmacy_logins (مطابق لـ loginKey في security.js).
String loginKey(String n) => n
    .trim()
    .toLowerCase()
    .replaceAll(RegExp(r'\s+'), '_')
    .replaceAll(RegExp(r'[/#?\[\].]'), '');
