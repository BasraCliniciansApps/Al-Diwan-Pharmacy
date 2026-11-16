import 'package:diwan_core/diwan_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Firebase.initializeApp(options: diwanFirebaseOptions);
  runApp(ProviderScope(
    overrides: [
      authRepoProvider.overrideWithValue(FirebaseAuthRepository()),
      productRepoProvider.overrideWithValue(FirebaseProductRepository()),
    ],
    child: const DiwanApp(),
  ));
}
