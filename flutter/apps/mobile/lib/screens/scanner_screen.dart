import 'dart:async';

import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../nav.dart';
import '../providers.dart';
import '../widgets/product_sheet.dart';
import '../widgets/search_field.dart';

/// فاحص المادة: كاميرا الباركود ثم بطاقة المادة. الباركود له الأولوية، وبجانبه بحث بالاسم.
/// في وضع [pick] يعيد النص المقروء فقط ويغلق (للبحث بالباركود في المخزن).
class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key, this.pick = false});
  final bool pick;
  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  final _cam = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [
      BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA, BarcodeFormat.upcE,
      BarcodeFormat.code128, BarcodeFormat.code39, BarcodeFormat.code93,
      BarcodeFormat.itf14, BarcodeFormat.dataMatrix, BarcodeFormat.qrCode,
    ],
  );
  final _ctl = TextEditingController();
  String _q = '';
  bool _busy = false, _torch = false;
  String? _lastMiss;

  @override
  void dispose() {
    _cam.dispose();
    _ctl.dispose();
    super.dispose();
  }

  Future<void> _onCode(String code) async {
    if (_busy || code.isEmpty) return;
    if (widget.pick) {
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(code);
      return;
    }
    _busy = true;
    HapticFeedback.mediumImpact();
    final idx = ref.read(catalogIndexProvider);
    final p = idx.byBarcode(code);
    if (p != null) {
      setState(() => _lastMiss = null);
      await _cam.stop();
      if (!mounted) return;
      await showProductSheet(context, p,
          cfg: ref.read(alertCfgValueProvider),
          isOwner: ref.read(profileProvider).value?.isOwner ?? false);
      if (mounted) await _cam.start();
    } else {
      setState(() => _lastMiss = code);
      await Future<void>.delayed(const Duration(milliseconds: 900));
    }
    _busy = false;
  }

  @override
  Widget build(BuildContext context) {
    final idx = ref.watch(catalogIndexProvider);
    final results = _q.trim().isEmpty ? const <Product>[] : idx.search(_q, where: (p) => !p.arch, limit: 8);
    return Scaffold(
      appBar: DiwanHeader(
        title: widget.pick ? 'مسح باركود' : 'فاحص المادة',
        icon: DiwanIcons.scan,
        onHome: () => goHome(context),
        onStock: widget.pick ? null : () => goStock(context),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: AspectRatio(
              aspectRatio: 1.25,
              child: Stack(fit: StackFit.expand, children: [
                MobileScanner(
                  controller: _cam,
                  onDetect: (c) {
                    final v = c.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
                    if (v != null) _onCode(v);
                  },
                  errorBuilder: (ctx, e) => ColoredBox(
                    color: DiwanColors.navy,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Text(
                          e.errorCode == MobileScannerErrorCode.permissionDenied
                              ? 'يلزم السماح باستخدام الكاميرا من إعدادات التطبيق'
                              : 'تعذّر تشغيل الكاميرا',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ),
                ),
                // إطار التسديد
                IgnorePointer(
                  child: Center(
                    child: Container(
                      width: 230,
                      height: 130,
                      decoration: BoxDecoration(
                        border: Border.all(color: DiwanColors.gold, width: 2.5),
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 10,
                  top: 10,
                  child: DiwanIconButton(
                    icon: _torch ? DiwanIcons.torchOff : DiwanIcons.torch,
                    tooltip: 'الضوء',
                    onTap: () async {
                      await _cam.toggleTorch();
                      setState(() => _torch = !_torch);
                    },
                  ),
                ),
              ]),
            ),
          ),
        ),
        if (_lastMiss != null)
          Container(
            margin: const EdgeInsets.fromLTRB(14, 0, 14, 8),
            padding: const EdgeInsets.all(12),
            width: double.infinity,
            decoration: BoxDecoration(
              color: DiwanColors.danger.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text('باركود غير مسجّل: $_lastMiss',
                textDirection: TextDirection.ltr,
                style: const TextStyle(fontWeight: FontWeight.w800, color: DiwanColors.danger)),
          ),
        if (!widget.pick)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
            child: DiwanSearchField(
              controller: _ctl,
              hint: 'أو ابحث بالاسم أو الرقم',
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 20),
            itemCount: results.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final p = results[i];
              return Material(
                color: context.cSurface,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => showProductSheet(context, p,
                      cfg: ref.read(alertCfgValueProvider),
                      isOwner: ref.read(profileProvider).value?.isOwner ?? false),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Expanded(
                        child: Text(dispName(p),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 8),
                      Text(stockLabel(p),
                          style: TextStyle(
                              fontWeight: FontWeight.w900,
                              color: p.inStock ? DiwanColors.success : DiwanColors.danger)),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}
