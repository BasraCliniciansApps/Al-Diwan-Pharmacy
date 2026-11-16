import 'package:lucide_icons_flutter/lucide_icons_weights.dart';
import 'package:material_ui/material_ui.dart';

/// مجموعة أيقونات التطبيق الموحّدة: Lucide بسماكة خط 300 (≈1.5px)
/// فتبدو أرقّ وأكثر احترافية من الافتراضي، وبمعنى واضح لكل وظيفة.
/// كل الشاشات تستخدم هذه الأسماء الدلالية فقط (تغيير أيقونة = تعديل هنا).
abstract final class DiwanIcons {
  static const IconData pos = LucideIcons300.shoppingCart; // شاشة البيع
  static const IconData bill = LucideIcons300.receiptText; // الفاتورة
  static const IconData purchases = LucideIcons300.truck; // الوارد (توريد المذاخر)
  static const IconData stock = LucideIcons300.warehouse; // المخزن
  static const IconData scan = LucideIcons300.scanBarcode; // فاحص المادة
  static const IconData customers = LucideIcons300.users; // الزبائن
  static const IconData doctors = LucideIcons300.stethoscope; // ركن الأطباء
  static const IconData inventory = LucideIcons300.clipboardCheck; // الجرد
  static const IconData alerts = LucideIcons300.bellRing; // التنبيهات
  static const IconData settings = LucideIcons300.settings; // الإعدادات
  static const IconData calculator = LucideIcons300.calculator; // حاسبة الأسعار
  static const IconData registry = LucideIcons300.pill; // سجل الأدوية
  static const IconData finance = LucideIcons300.chartNoAxesCombined; // المصروفات والأرباح

  static const IconData home = LucideIcons300.house;
  static const IconData logout = LucideIcons300.logOut;
  static const IconData info = LucideIcons300.info;
  static const IconData sun = LucideIcons300.sun;
  static const IconData moon = LucideIcons300.moon;
  static const IconData user = LucideIcons300.userRound;
  static const IconData activity = LucideIcons300.activity;
  static const IconData cloud = LucideIcons300.cloud;
  static const IconData check = LucideIcons300.circleCheck;
}
