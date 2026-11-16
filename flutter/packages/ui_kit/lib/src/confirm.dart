import 'package:material_ui/material_ui.dart';

import 'theme.dart';

/// نافذة تأكيد بنمط التطبيق (عربية فقط) لكل إلغاء أو حذف.
Future<bool> showDiwanConfirm(
  BuildContext context, {
  required String title,
  String? message,
  String confirmLabel = 'نعم',
  String cancelLabel = 'إلغاء',
  bool danger = false,
}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        backgroundColor: ctx.cSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: ruqaa(size: 20, color: ctx.cTitle)),
        content: message == null ? null : Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(cancelLabel,
                style: TextStyle(color: ctx.cTextSub)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size(96, 44),
              backgroundColor: danger ? DiwanColors.danger : DiwanColors.navy,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    ),
  );
  return r ?? false;
}
