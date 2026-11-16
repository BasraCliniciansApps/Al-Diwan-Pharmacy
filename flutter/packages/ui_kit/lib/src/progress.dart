import 'package:material_ui/material_ui.dart';

import 'theme.dart';

/// عدّاد عمليات جارية: الشريط يظهر فقط عند ضغط الأزرار (لا لمزامنة الخلفية).
class DiwanBusy extends ValueNotifier<int> {
  DiwanBusy() : super(0);
  static final instance = DiwanBusy();

  /// يشغّل [job] مع إظهار الشريط، ويُخفيه عند الانتهاء ولو فشل.
  Future<T> run<T>(Future<T> Function() job) async {
    value++;
    try {
      return await job();
    } finally {
      value--;
    }
  }
}

/// شريط تقدّم ذهبي رفيع جداً عند حدّ الترويسة؛ لا يحجب العمل ولا يحمل نصاً.
class DiwanProgressBar extends StatelessWidget {
  const DiwanProgressBar({super.key, this.busy});
  final DiwanBusy? busy;

  @override
  Widget build(BuildContext context) {
    final b = busy ?? DiwanBusy.instance;
    return IgnorePointer(
      child: ValueListenableBuilder<int>(
        valueListenable: b,
        builder: (_, n, _) => SizedBox(
          height: 2,
          child: n > 0
              ? const LinearProgressIndicator(
                  minHeight: 2,
                  color: DiwanColors.goldDeep,
                  backgroundColor: Colors.transparent,
                )
              : const SizedBox.shrink(),
        ),
      ),
    );
  }
}
