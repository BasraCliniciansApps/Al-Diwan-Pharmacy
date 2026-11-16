package iq.aldiwan.pharmacy;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.LayerDrawable;
import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // وجهة الفتح السريع: pos (شاشة البيع) أو scan (فاحص المادة)؛ تُرسل إلى الصفحة بعد جاهزيتها (محاولات متعددة، ولكل فتحة رمز مميز كي لا تتكرر)
    private String targetOf(Intent i) {
        if (i == null) return "";
        try {
            String t = i.getStringExtra("dwTarget");
            if (t != null && !t.isEmpty()) return t;
            if (i.getComponent() != null) {
                String c = i.getComponent().getClassName();
                if (c.endsWith("PosAlias")) return "pos";
                if (c.endsWith("ScanAlias")) return "scan";
            }
        } catch (Exception e) { /* تجاهل */ }
        return "";
    }

    private void sendTarget(String t) {
        if (t == null || t.isEmpty()) return;
        final String tok = String.valueOf(System.nanoTime());
        final String js = "(function(){if(!window.dwLaunch||window.__dwTok==='" + tok + "')return;window.__dwTok='" + tok + "';window.dwLaunch('" + t + "');})()";
        final long[] delays = { 0, 1200, 2800, 5500, 9500, 15000 };
        for (long d : delays) {
            try { getBridge().getWebView().postDelayed(() -> { try { getBridge().getWebView().evaluateJavascript(js, null); } catch (Exception e) { /* تجاهل */ } }, d); } catch (Exception e) { /* تجاهل */ }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        sendTarget(targetOf(intent));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiwanPrintPlugin.class);
        super.onCreate(savedInstanceState);
        sendTarget(targetOf(getIntent()));
        try { getBridge().getWebView().getSettings().setTextZoom(100); } catch (Exception e) { /* تثبيت حجم الخط: لا يتبع إعداد خط الجهاز */ }
        try { if (android.os.Build.VERSION.SDK_INT >= 29) getBridge().getWebView().getSettings().setForceDark(android.webkit.WebSettings.FORCE_DARK_OFF); } catch (Exception e) { /* منع القلب التلقائي للألوان */ }
        Window window = getWindow();
        View content = findViewById(android.R.id.content);
        // خلفية خلف الهوامش: أعلى كحلي بلون ترويسة التطبيق (شريط الحالة)، وأسفل فاتح (شريط التنقل)
        ColorDrawable light = new ColorDrawable(Color.parseColor("#F4F6FB"));
        ColorDrawable navy = new ColorDrawable(Color.parseColor("#0F1C38"));
        LayerDrawable bg = new LayerDrawable(new android.graphics.drawable.Drawable[] { light, navy });
        bg.setLayerGravity(1, Gravity.TOP | Gravity.FILL_HORIZONTAL);
        bg.setLayerHeight(1, 400);
        content.setBackground(bg);
        window.getDecorView().setBackgroundColor(Color.parseColor("#F4F6FB"));
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
        c.setAppearanceLightStatusBars(false);       // أيقونات شريط الحالة فاتحة فوق الكحلي
        c.setAppearanceLightNavigationBars(true);    // أيقونات التنقل داكنة فوق الفاتح
        // لوحة المفاتيح: كابتشر لا يحسب ارتفاعها في وضع الحافة، فنرفع المحتوى فوقها بنفسنا
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            Insets sys = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(0, 0, 0, Math.max(0, ime.bottom - sys.bottom));
            return insets;
        });
    }
}
