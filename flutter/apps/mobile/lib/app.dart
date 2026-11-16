import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

class DiwanApp extends ConsumerWidget {
  const DiwanApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'صيدلية الديوان',
      debugShowCheckedModeBanner: false,
      theme: buildDiwanTheme(Brightness.light),
      darkTheme: buildDiwanTheme(Brightness.dark),
      themeMode: ref.watch(themeModeProvider),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: diwanAppBuilder,
      home: const _Gate(),
    );
  }
}

/// بوابة الدخول: بلا جلسة → شاشة الدخول، وإلا الرئيسية.
class _Gate extends ConsumerWidget {
  const _Gate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(profileProvider);
    return p.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(color: DiwanColors.gold)),
      ),
      error: (_, _) => const LoginScreen(),
      data: (u) => u == null ? const LoginScreen() : HomeScreen(profile: u),
    );
  }
}
