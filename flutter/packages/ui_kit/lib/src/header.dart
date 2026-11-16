import 'package:material_ui/material_ui.dart';

import 'icons.dart';
import 'patterns.dart';
import 'progress.dart';
import 'theme.dart';

/// زر أيقونة صغير بإطار شفاف (مطابق لـ .small-icon-btn في الويب).
class DiwanIconButton extends StatelessWidget {
  const DiwanIconButton(
      {super.key, required this.icon, required this.tooltip, this.onTap});
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Tooltip(
          message: tooltip,
          child: Material(
            color: Colors.white.withValues(alpha: .08),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: BorderSide(color: Colors.white.withValues(alpha: .14)),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: onTap,
              child: SizedBox(
                width: 40,
                height: 40,
                child: Icon(icon, size: 21, color: Colors.white),
              ),
            ),
          ),
      );
}

/// ترويسة صفحة: 97px، حواف سفلية 22، نسيج هندسي ذهبي، خط ذهبي سفلي.
/// صف علوي: الشعار + «صيدلية الديوان» + [trailing] + أيقونتا المخزن والرئيسية.
/// سطر ثانٍ: أيقونة + عنوان الصفحة (58px من الأعلى، 19px من اليمين)،
/// و[sideLabel] بخط الرقعة في الطرف المقابل.
class DiwanHeader extends StatelessWidget implements PreferredSizeWidget {
  const DiwanHeader({
    super.key,
    required this.title,
    required this.icon,
    this.onHome,
    this.onStock,
    this.trailing = const [],
    this.sideLabel,
    this.syncState = SyncState.ok,
  });

  static const double height = 97;

  final String title;
  final IconData icon;
  final VoidCallback? onHome;
  final VoidCallback? onStock;
  final List<Widget> trailing;
  final String? sideLabel;
  final SyncState syncState;

  @override
  Size get preferredSize => const Size.fromHeight(height + 2);

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final bg = context.isDark ? DiwanColors.darkHeader : DiwanColors.navy;
    return SizedBox(
      height: height + top + 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(
            bottom: 2,
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(22)),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: bg,
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x470A1428),
                        blurRadius: 24,
                        offset: Offset(0, 8)),
                  ],
                ),
                child: const CustomPaint(painter: HeaderPatternPainter()),
              ),
            ),
          ),
          // الخط الذهبي السفلي (خارج القصّ ليظهر توهّجه كاملاً)
          const Positioned.fill(
            bottom: 2,
            child: IgnorePointer(
              child: CustomPaint(painter: _GoldEdgePainter()),
            ),
          ),
          // صف الشعار والأزرار
          Positioned(
            top: top + 8,
            left: 16,
            right: 16,
            child: Row(
              children: [
                _Logo(syncState),
                const SizedBox(width: 10),
                Flexible(
                  child: Text('صيدلية الديوان',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ruqaa(size: 20.8, color: DiwanColors.gold)),
                ),
                const Spacer(),
                ..._spaced([
                  ...trailing,
                  if (onStock != null)
                    DiwanIconButton(
                        icon: DiwanIcons.stock,
                        tooltip: 'المخزن',
                        onTap: onStock),
                  if (onHome != null)
                    DiwanIconButton(
                        icon: DiwanIcons.home,
                        tooltip: 'الرئيسية',
                        onTap: onHome),
                ]),
              ],
            ),
          ),
          // سطر العنوان
          Positioned(
            top: top + 58,
            right: 19,
            left: 16,
            child: Row(
              children: [
                Icon(icon, size: 18, color: DiwanColors.slateText),
                const SizedBox(width: 6),
                Text(title,
                    style: ruqaa(size: 16.8, color: DiwanColors.slateText)),
                const Spacer(),
                if (sideLabel != null) _UserPill(sideLabel!),
              ],
            ),
          ),
          const Positioned(
              left: 0, right: 0, bottom: 0, child: DiwanProgressBar()),
        ],
      ),
    );
  }
}

enum SyncState { ok, busy, err, off }

class _Logo extends StatelessWidget {
  const _Logo(this.state);
  final SyncState state;

  @override
  Widget build(BuildContext context) {
    final c = switch (state) {
      SyncState.ok => const Color(0xFF22C55E),
      SyncState.busy => const Color(0xFFF59E0B),
      SyncState.err => const Color(0xFFEF4444),
      SyncState.off => const Color(0xFF94A3B8),
    };
    return SizedBox(
      width: 42,
      height: 42,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset('images/logo.jpg',
                package: kUiPackage, width: 42, height: 42),
          ),
          Positioned(
            left: -3,
            bottom: -3,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: c,
                shape: BoxShape.circle,
                border: Border.all(color: DiwanColors.navy, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

List<Widget> _spaced(List<Widget> ws) => [
      for (var i = 0; i < ws.length; i++) ...[
        if (i > 0) const SizedBox(width: 8),
        ws[i],
      ],
    ];

/// شارة المستخدم (المدير/اسم الموظف): كبسولة بنفس نمط أزرار الترويسة،
/// أيقونة ذهبية + اسم بخط الرقعة، محاذاة يسار الترويسة مع حافة الأزرار.
class _UserPill extends StatelessWidget {
  const _UserPill(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: .14)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(DiwanIcons.user, size: 15, color: DiwanColors.gold),
            const SizedBox(width: 6),
            Text(label,
                style: ruqaa(size: 15, color: DiwanColors.slateText)
                    .copyWith(height: 1.35)),
          ],
        ),
      );
}

/// الخط الذهبي: تدرّج لامع (مركز أفتح وأطراف أعمق) يتبع انحناء الحافة السفلية،
/// بسماكة 2.5px مع توهّج خفيف تحته يمنحه عمقاً دون أن يحجب المحتوى.
class _GoldEdgePainter extends CustomPainter {
  const _GoldEdgePainter();

  @override
  void paint(Canvas canvas, Size size) {
    const r = 22.0, w = 2.5;
    final y = size.height - w / 2;
    final path = Path()
      ..moveTo(0, y - r)
      ..quadraticBezierTo(0, y, r, y)
      ..lineTo(size.width - r, y)
      ..quadraticBezierTo(size.width, y, size.width, y - r);
    final rect = Offset.zero & size;

    // توهّج
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5)
        ..color = DiwanColors.goldDeep.withValues(alpha: .30),
    );
    // الخط
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w
        ..strokeCap = StrokeCap.round
        ..shader = const LinearGradient(
          colors: [
            Color(0xFFC9780F),
            DiwanColors.gold,
            Color(0xFFFFE29A),
            DiwanColors.gold,
            Color(0xFFC9780F),
          ],
          stops: [0, .2, .5, .8, 1],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
