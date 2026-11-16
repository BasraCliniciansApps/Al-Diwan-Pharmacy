import 'package:material_ui/material_ui.dart';

import 'theme.dart';

/// تبويبات موحّدة: أزرار مستطيلة حوافها ناعمة متراصّة، المختار ينزل قليلاً.
class DiwanTabs extends StatelessWidget {
  const DiwanTabs({
    super.key,
    required this.labels,
    required this.index,
    required this.onChanged,
  });

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 120),
                  height: 40,
                  margin: EdgeInsets.only(top: i == index ? 3 : 0),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: i == index ? DiwanColors.navy : context.cSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: i == index
                            ? DiwanColors.navy
                            : context.cBorder),
                  ),
                  child: Text(
                    labels[i],
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: i == index ? DiwanColors.gold : context.cTextSub,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
