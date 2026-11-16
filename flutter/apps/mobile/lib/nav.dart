import 'package:material_ui/material_ui.dart';

import 'screens/alerts_screen.dart';
import 'screens/scanner_screen.dart';
import 'screens/stock_screen.dart';

/// التنقّل: كل انتقال أمامي = push، فالرجوع يعود دائماً إلى مكان القدوم الفعلي.
/// أيقونتا الرئيسية والمخزن في الترويسة تقفزان مباشرة وتُصفّران المكدّس.
void _push(BuildContext c, Widget w) =>
    Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => w));

void openStock(BuildContext c) => _push(c, const StockScreen());
void openAlerts(BuildContext c) => _push(c, const AlertsScreen());
void openScanner(BuildContext c) => _push(c, const ScannerScreen());

/// ماسح لاختيار باركود فقط (يعيد النص ثم يغلق).
Future<String?> pickBarcode(BuildContext c) => Navigator.of(c)
    .push<String>(MaterialPageRoute(builder: (_) => const ScannerScreen(pick: true)));

void goHome(BuildContext c) => Navigator.of(c).popUntil((r) => r.isFirst);

void goStock(BuildContext c) {
  Navigator.of(c).popUntil((r) => r.isFirst);
  openStock(c);
}
