import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'providers.dart';

import 'screens/alerts_screen.dart';
import 'screens/scan_card_screen.dart';
import 'widgets/barcode_dialog.dart';
import 'screens/stock_screen.dart';

/// التنقّل: كل انتقال أمامي = push، فالرجوع يعود دائماً إلى مكان القدوم الفعلي.
/// أيقونتا الرئيسية والمخزن في الترويسة تقفزان مباشرة وتُصفّران المكدّس.
void _push(BuildContext c, Widget w) =>
    Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => w));

void openStock(BuildContext c) => _push(c, const StockScreen());
void openAlerts(BuildContext c) => _push(c, const AlertsScreen());
/// فاحص المادة (scGo): تفتح الكاميرا مباشرة؛ عند اختيار مادة تظهر بطاقتها، وإغلاق الكاميرا بلا اختيار يعيد للمكان السابق.
Future<void> openScanner(BuildContext c) async {
  final container = ProviderScope.containerOf(c);
  final r = await showBarcodeDialog(c);
  if (r == null || !c.mounted) return;
  final p = r.product ?? container.read(catalogIndexProvider).byBarcode(r.code!);
  if (p == null) {
    // باركود غير مسجّل: الربط/الإضافة في مرحلة سجل الأدوية
    ScaffoldMessenger.of(c).showSnackBar(
        SnackBar(content: Text('باركود غير مسجّل: ${r.code}'), duration: const Duration(seconds: 2)));
    return;
  }
  _push(c, ScanCardScreen(productId: p.id));
}

/// ماسح لاختيار باركود فقط للبحث في المخزن (scanBarcodeToSearch): يعيد النص المقروء.
Future<String?> pickBarcode(BuildContext c) async {
  final r = await showBarcodeDialog(c);
  return r?.code ?? r?.product?.name;
}

void goHome(BuildContext c) => Navigator.of(c).popUntil((r) => r.isFirst);

void goStock(BuildContext c) {
  Navigator.of(c).popUntil((r) => r.isFirst);
  openStock(c);
}
