import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../providers.dart';

/// م0: يقرأ عدد المواد من pharmacy_products للتأكد من الربط (قراءة فقط).
class ConnectionTestScreen extends ConsumerStatefulWidget {
  const ConnectionTestScreen({super.key});
  @override
  ConsumerState<ConnectionTestScreen> createState() => _S();
}

class _S extends ConsumerState<ConnectionTestScreen> {
  String _msg = 'اضغط «فحص» لقراءة عدد المواد من السحابة';
  bool _ok = false;

  Future<void> _run() async {
    try {
      final n = await DiwanBusy.instance
          .run(() => ref.read(productRepoProvider).countProducts());
      setState(() {
        _ok = true;
        _msg = 'الاتصال سليم — عدد المواد في السحابة: $n';
      });
    } catch (e) {
      setState(() {
        _ok = false;
        _msg = 'تعذّر الاتصال: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: DiwanHeader(
        title: 'اختبار الاتصال',
        icon: LucideIcons.activity,
        onHome: () => Navigator.of(context).popUntil((r) => r.isFirst),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          const SizedBox(height: 20),
          Icon(_ok ? LucideIcons.circleCheck : LucideIcons.cloud,
              size: 56, color: _ok ? DiwanColors.success : DiwanColors.navy),
          const SizedBox(height: 12),
          Text(_msg, textAlign: TextAlign.center),
          const SizedBox(height: 20),
          FilledButton(onPressed: _run, child: const Text('فحص')),
        ]),
      ),
    );
  }
}
