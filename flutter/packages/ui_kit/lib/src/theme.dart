import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

/// ألوان الهوية (من style.css).
class DiwanColors {
  static const navy = Color(0xFF0F1C38);
  static const navyDeep = Color(0xFF0A1428);
  static const navySoft = Color(0xFF1B2C52);
  static const gold = Color(0xFFF4B73F);
  static const goldDeep = Color(0xFFF9A825);
  static const goldDark = Color(0xFFA85D08);
  static const goldSoft = Color(0xFFFFF3D6);
  static const slateText = Color(0xFFCBD5E1);
  static const bg = Color(0xFFF2F4F8);
  static const surface = Color(0xFFFFFFFF);
  static const textMain = Color(0xFF0F172A);
  static const textSub = Color(0xFF5B6578);
  static const border = Color(0xFFDFE4EE);
  static const success = Color(0xFF12A37A);
  static const danger = Color(0xFFE5484D);

  // الوضع الليلي (من :root[data-theme="dark"])
  static const darkBg = Color(0xFF0A1020);
  static const darkSurface = Color(0xFF141E36);
  static const darkText = Color(0xFFE8EDF7);
  static const darkTextSub = Color(0xFF9AA8C2);
  static const darkBorder = Color(0xFF2A3857);
  static const darkHeader = Color(0xFF0B1326);
}

/// ألوان تتبع الوضع الحالي (نهاري/ليلي).
extension DiwanThemeX on BuildContext {
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  Color get cSurface => isDark ? DiwanColors.darkSurface : DiwanColors.surface;
  Color get cBorder => isDark ? DiwanColors.darkBorder : DiwanColors.border;
  Color get cText => isDark ? DiwanColors.darkText : DiwanColors.textMain;
  Color get cTextSub => isDark ? DiwanColors.darkTextSub : DiwanColors.textSub;
  Color get cTitle => isDark ? DiwanColors.gold : DiwanColors.navy;
}

const kRuqaa = 'ArefRuqaa';
const kTajawal = 'Tajawal';
const kUiPackage = 'diwan_ui';

/// نمط خط الرقعة للعناوين.
TextStyle ruqaa({double size = 16.8, Color? color, FontWeight? weight}) =>
    TextStyle(
      fontFamily: kRuqaa,
      package: kUiPackage,
      fontSize: size,
      color: color,
      fontWeight: weight ?? FontWeight.w700,
      height: 1.2,
    );

ThemeData buildDiwanTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final surface = dark ? DiwanColors.darkSurface : DiwanColors.surface;
  final border = dark ? DiwanColors.darkBorder : DiwanColors.border;
  final text = dark ? DiwanColors.darkText : DiwanColors.textMain;
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: kTajawal,
    colorScheme: ColorScheme.fromSeed(
      seedColor: DiwanColors.navy,
      brightness: brightness,
      primary: dark ? DiwanColors.gold : DiwanColors.navy,
      secondary: DiwanColors.gold,
      surface: surface,
      error: DiwanColors.danger,
    ),
    scaffoldBackgroundColor: dark ? DiwanColors.darkBg : DiwanColors.bg,
  );
  OutlineInputBorder ob(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c, width: w),
      );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      fontFamily: kTajawal,
      package: kUiPackage,
      bodyColor: text,
      displayColor: text,
    ),
    dialogTheme: DialogThemeData(backgroundColor: surface),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: ob(border),
      enabledBorder: ob(border),
      focusedBorder: ob(DiwanColors.gold, 2),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: dark ? DiwanColors.gold : DiwanColors.navy,
        foregroundColor: dark ? DiwanColors.navy : Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
            fontFamily: kTajawal,
            package: kUiPackage,
            fontWeight: FontWeight.w700,
            fontSize: 16),
      ),
    ),
  );
}

/// يُلفّ به التطبيق: RTL + تثبيت حجم الخط على 1.0 + شريط الحالة بأيقونات فاتحة
/// (الترويسة نيلية دائماً) وشريط التنقّل يتبع الوضع.
Widget diwanAppBuilder(BuildContext context, Widget? child) {
  final mq = MediaQuery.of(context);
  final dark = Theme.of(context).brightness == Brightness.dark;
  return AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: dark ? DiwanColors.darkBg : DiwanColors.bg,
      systemNavigationBarIconBrightness:
          dark ? Brightness.light : Brightness.dark,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
    child: Directionality(
      textDirection: TextDirection.rtl,
      child: MediaQuery(
        data: mq.copyWith(textScaler: TextScaler.noScaling),
        child: child ?? const SizedBox.shrink(),
      ),
    ),
  );
}
