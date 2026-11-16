import 'dart:async';

import 'package:diwan_core/diwan_core.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../providers.dart';

/// نتيجة نافذة مسح الباركود: باركود مقروء أو مادة مختارة بالبحث اليدوي.
class BarcodeResult {
  const BarcodeResult.code(String this.code) : product = null;
  const BarcodeResult.product(Product this.product) : code = null;
  final String? code;
  final Product? product;
}

/// نافذة «مسح الباركود» (barcodeModal): كاميرا بإطار ذهبي، إدخال رقم الباركود، بحث يدوي بالاسم.
/// بعد 8 ثوانٍ بلا قراءة ينتقل للبحث بالاسم مع تنبيه (SC_SCAN_WAIT_MS).
Future<BarcodeResult?> showBarcodeDialog(BuildContext context) => showDialog<BarcodeResult>(
      context: context,
      barrierColor: const Color(0x99000000),
      builder: (_) => const Directionality(textDirection: TextDirection.rtl, child: _BarcodeDialog()),
    );

class _BarcodeDialog extends ConsumerStatefulWidget {
  const _BarcodeDialog();
  @override
  ConsumerState<_BarcodeDialog> createState() => _BarcodeDialogState();
}

class _BarcodeDialogState extends ConsumerState<_BarcodeDialog> {
  final _cam = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [
      BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.upcA, BarcodeFormat.upcE,
      BarcodeFormat.code128, BarcodeFormat.code39, BarcodeFormat.code93,
      BarcodeFormat.itf14, BarcodeFormat.dataMatrix, BarcodeFormat.qrCode,
    ],
  );
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _nameFocus = FocusNode();
  Timer? _wait;
  String _q = '';
  String? _err;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _wait = Timer(const Duration(seconds: 8), () {
      if (!mounted || _done || _name.text.isNotEmpty) return;
      _nameFocus.requestFocus();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(const SnackBar(
          content: Text('لم يُقرأ باركود — ابحث بالاسم'), duration: Duration(seconds: 2)));
    });
  }

  @override
  void dispose() {
    _wait?.cancel();
    _cam.dispose();
    _code.dispose();
    _name.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  void _finish(BarcodeResult r) {
    if (_done) return;
    _done = true;
    HapticFeedback.mediumImpact();
    Navigator.of(context).pop(r);
  }

  @override
  Widget build(BuildContext context) {
    final idx = ref.watch(catalogIndexProvider);
    final res = _q.trim().isEmpty ? const <Product>[] : idx.search(_q, where: (p) => !p.arch, limit: 6);
    final dark = context.isDark;
    final navy = dark ? DiwanColors.darkText : DiwanColors.navy;
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 24),
      backgroundColor: context.cSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(textDirection: TextDirection.ltr, children: [
            Icon(DiwanIcons.scan, size: 20, color: navy),
            const SizedBox(width: 6),
            Text('مسح الباركود', style: ruqaa(size: 20.8, color: navy)),
            const Spacer(),
            Material(
              color: dark ? const Color(0xFF1E2B4A) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => Navigator.of(context).pop(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  child: Row(mainAxisSize: MainAxisSize.min, textDirection: TextDirection.ltr, children: [
                    Text('رجوع', style: TextStyle(fontSize: 12.8, fontWeight: FontWeight.w700, color: navy)),
                    const SizedBox(width: 4),
                    Icon(DiwanIcons.chevLeft, size: 16, color: navy),
                  ]),
                ),
              ),
            ),
          ]),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: AspectRatio(
              aspectRatio: 338 / 254,
              child: Stack(fit: StackFit.expand, children: [
                const ColoredBox(color: Color(0xFF0B1220)),
                MobileScanner(
                  controller: _cam,
                  onDetect: (c) {
                    final v = c.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
                    if (v != null && v.isNotEmpty) _finish(BarcodeResult.code(v));
                  },
                  errorBuilder: (ctx, e) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted && _err == null) {
                        setState(() => _err = 'تعذر تشغيل الكاميرا (اسمح للتطبيق باستخدامها). يمكنك الكتابة يدوياً أو تصوير الباركود.');
                      }
                    });
                    return const SizedBox.shrink();
                  },
                ),
                IgnorePointer(
                  child: Center(
                    child: FractionallySizedBox(
                      widthFactor: .8,
                      heightFactor: .56,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFF59E0B), width: 2.5),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ),
              ]),
            ),
          ),
          if (_err != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(_err!,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFFB91C1C), height: 1.5)),
            ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: SizedBox(
                height: 46,
                child: TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  decoration: InputDecoration(
                    hintText: 'أو اكتب رقم الباركود',
                    hintStyle: TextStyle(fontSize: 13.5, color: context.cTextSub),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder)),
                  ),
                  onSubmitted: (v) => v.trim().isEmpty ? null : _finish(BarcodeResult.code(v.trim())),
                ),
              ),
            ),
            const SizedBox(width: 6),
            SizedBox(
              height: 46,
              width: 62,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  side: BorderSide(color: context.cBorder),
                  padding: EdgeInsets.zero,
                ),
                onPressed: () => _code.text.trim().isEmpty ? null : _finish(BarcodeResult.code(_code.text.trim())),
                child: Text('بحث', style: TextStyle(fontWeight: FontWeight.w800, color: navy)),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          SizedBox(
            height: 46,
            child: TextField(
              controller: _name,
              focusNode: _nameFocus,
              onChanged: (v) => setState(() => _q = v),
              decoration: InputDecoration(
                hintText: 'بحث يدوي (اكتب اسم المادة)',
                hintStyle: TextStyle(fontSize: 14, color: context.cTextSub),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder, width: 1.5)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: context.cBorder, width: 1.5)),
              ),
            ),
          ),
          for (final p in res)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Material(
                color: context.cSurface,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: context.cBorder)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _finish(BarcodeResult.product(p)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: SizedBox(
                      height: 32,
                      child: Row(children: [
                        Expanded(
                          child: Text(dispName(p),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textDirection: TextDirection.ltr,
                              textAlign: TextAlign.right,
                              style: TextStyle(fontSize: 14.4, fontWeight: FontWeight.w800, color: navy)),
                        ),
                        const SizedBox(width: 8),
                        Text(_fmt(p.price), style: TextStyle(fontWeight: FontWeight.w800, color: navy)),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 10),
          SizedBox(
            height: 46,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                side: BorderSide(color: context.cBorder),
              ),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('قراءة الباركود من صورة تُفعَّل في مرحلة لاحقة'), duration: Duration(seconds: 1))),
              icon: Icon(DiwanIcons.imageIn, size: 18, color: navy),
              label: Text('قراءة من صورة', style: TextStyle(fontWeight: FontWeight.w800, color: navy)),
            ),
          ),
        ]),
      ),
    );
  }
}

String _fmt(num n) => n.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
