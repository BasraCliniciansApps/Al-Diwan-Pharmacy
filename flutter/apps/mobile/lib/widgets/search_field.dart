import 'package:diwan_ui/diwan_ui.dart';
import 'package:material_ui/material_ui.dart';

/// حقل البحث الموحّد: أيقونة بحث، زر مسح، وزر باركود اختياري. اتجاه الكتابة يتبع المحتوى.
class DiwanSearchField extends StatelessWidget {
  const DiwanSearchField({
    super.key,
    required this.controller,
    required this.hint,
    required this.onChanged,
    this.onScan,
  });
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final VoidCallback? onScan;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (_, v, _) => TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: context.cTextSub, fontSize: 14),
          prefixIcon: Icon(DiwanIcons.search, size: 20, color: context.cTextSub),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (v.text.isNotEmpty)
                IconButton(
                  tooltip: 'مسح',
                  icon: Icon(DiwanIcons.close, size: 18, color: context.cTextSub),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                ),
              if (onScan != null)
                IconButton(
                  tooltip: 'مسح باركود',
                  icon: Icon(DiwanIcons.scan, size: 22, color: context.cTitle),
                  onPressed: onScan,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
