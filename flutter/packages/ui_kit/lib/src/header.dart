import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:material_ui/material_ui.dart';

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
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: Tooltip(
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
                child: Icon(icon, size: 20, color: Colors.white),
              ),
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
        children: [
          Positioned.fill(
            bottom: 2,
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(bottom: Radius.circular(22)),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: bg,
                  border: const Border(
                      bottom: BorderSide(color: DiwanColors.gold, width: 2)),
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
          // صف الشعار والأزرار
          Positioned(
            top: top + 8,
            left: 12,
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
                ...trailing,
                if (onStock != null)
                  DiwanIconButton(
                      icon: LucideIcons.package,
                      tooltip: 'المخزن',
                      onTap: onStock),
                if (onHome != null)
                  DiwanIconButton(
                      icon: LucideIcons.house,
                      tooltip: 'الرئيسية',
                      onTap: onHome),
              ],
            ),
          ),
          // سطر العنوان
          Positioned(
            top: top + 58,
            right: 19,
            left: 19,
            child: Row(
              children: [
                Icon(icon, size: 18, color: DiwanColors.slateText),
                const SizedBox(width: 6),
                Text(title,
                    style: ruqaa(size: 16.8, color: DiwanColors.slateText)),
                const Spacer(),
                if (sideLabel != null)
                  Text(sideLabel!,
                      style:
                          ruqaa(size: 15, color: DiwanColors.slateText)),
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
