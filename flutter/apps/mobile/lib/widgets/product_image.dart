import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';

const _rawBase = 'https://raw.githubusercontent.com/BasraCliniciansApps/Al-Diwan-Pharmacy/main/';

/// صورة المادة: كاش دائم على القرص. المسارات النسبية تُحلّ على مستودع الصور الحالي،
/// وصور data: تُعرض مباشرة. عند الغياب أو الفشل تظهر أيقونة هادئة.
class ProductImage extends StatelessWidget {
  const ProductImage(this.src, {super.key, this.fit = BoxFit.cover, this.cacheWidth = 400});
  final String src;
  final BoxFit fit;
  final int cacheWidth;

  /// أيقونة «بدون صورة» الكبيرة كما في الويب (SVG رمادي مزرق يملأ الإطار).
  Widget _ph(BuildContext c) => const Center(
        child: Icon(DiwanIcons.imagePlaceholder, size: 100, color: Color(0xFF94A3B8)),
      );

  @override
  Widget build(BuildContext context) {
    final u = src.trim();
    if (u.isEmpty) return _ph(context);
    if (u.startsWith('data:')) {
      try {
        final i = u.indexOf(',');
        return Image.memory(base64Decode(u.substring(i + 1)),
            fit: fit, cacheWidth: cacheWidth, gaplessPlayback: true,
            errorBuilder: (c, _, _) => _ph(c));
      } catch (_) {
        return _ph(context);
      }
    }
    final url = u.startsWith('http') ? u : _rawBase + u.replaceFirst(RegExp(r'^/+'), '');
    return CachedNetworkImage(
      imageUrl: url,
      fit: fit,
      memCacheWidth: cacheWidth,
      fadeInDuration: const Duration(milliseconds: 180),
      placeholder: (c, _) => const SizedBox.shrink(),
      errorWidget: (c, _, _) => _ph(c),
    );
  }
}
