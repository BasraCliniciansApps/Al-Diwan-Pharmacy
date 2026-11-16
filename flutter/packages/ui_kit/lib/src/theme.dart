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

ThemeData buildDiwanTheme() {
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: kTajawal,
    colorScheme: ColorScheme.fromSeed(
      seedColor: DiwanColors.navy,
      primary: DiwanColors.navy,
      secondary: DiwanColors.gold,
      surface: DiwanColors.surface,
      error: DiwanColors.danger,
    ),
    scaffoldBackgroundColor: DiwanColors.bg,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(
      fontFamily: kTajawal,
      package: kUiPackage,
      bodyColor: DiwanColors.textMain,
      displayColor: DiwanColors.textMain,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: DiwanColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: DiwanColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: DiwanColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: DiwanColors.gold, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: DiwanColors.navy,
        foregroundColor: Colors.white,
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

/// يُلفّ به التطبيق: RTL + تثبيت حجم الخط على 1.0 (لا يتبع إعدادات الجهاز).
Widget diwanAppBuilder(BuildContext context, Widget? child) {
  final mq = MediaQuery.of(context);
  return Directionality(
    textDirection: TextDirection.rtl,
    child: MediaQuery(
      data: mq.copyWith(textScaler: TextScaler.noScaling),
      child: child ?? const SizedBox.shrink(),
    ),
  );
}
