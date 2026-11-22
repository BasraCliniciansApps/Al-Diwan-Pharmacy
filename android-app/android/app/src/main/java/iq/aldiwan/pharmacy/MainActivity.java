package iq.aldiwan.pharmacy;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.LayerDrawable;
import android.content.Intent;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
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
import com.getcapacitor.CapConfig;

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


    // ملف تبادل واتساب (.dwsync) مفتوحاً من واتساب أو مدير الملفات: نقرؤه (حتى 12 ميغابايت) ونسلّمه للصفحة التي تستورده بمعاينة
    private String fileTextOf(Intent i) {
        if (i == null) return null;
        try {
            Uri u = null;
            if (Intent.ACTION_VIEW.equals(i.getAction())) u = i.getData();
            else if (Intent.ACTION_SEND.equals(i.getAction())) u = (Uri) i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u == null) return null;
            String sc = u.getScheme();
            if (sc == null || !(sc.equals("content") || sc.equals("file"))) return null;
            InputStream in = getContentResolver().openInputStream(u);
            if (in == null) return null;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int n; long tot = 0;
            while ((n = in.read(buf)) > 0) { tot += n; if (tot > 12L * 1024 * 1024) { in.close(); return null; } bo.write(buf, 0, n); }
            in.close();
            return bo.toString("UTF-8");
        } catch (Exception e) { return null; }
    }

    private void sendFile(Intent i) {
        final String t = fileTextOf(i);
        if (t == null || t.isEmpty() || t.indexOf("\"diwan\"") < 0) return;
        final String js = "(function(){if(window.dwOpenFile)window.dwOpenFile(" + org.json.JSONObject.quote(t) + ");})()";
        final long[] delays = { 0, 2500, 7000, 14000 };   // الصفحة قد لا تكون جاهزة بعد؛ والصفحة نفسها تتجاهل التكرار
        for (long d : delays) {
            try { getBridge().getWebView().postDelayed(() -> { try { getBridge().getWebView().evaluateJavascript(js, null); } catch (Exception e) { /* تجاهل */ } }, d); } catch (Exception e) { /* تجاهل */ }
        }
    }

    // الفتح المباشر: عند الإطلاق من أيقونة البيع/الفاحص تُحمَّل الصفحة بوسيط go كي تفتح الشاشة المطلوبة دون المرور بالرئيسية
    @Override
    protected void load() {
        try {
            String t = targetOf(getIntent());
            if (!t.isEmpty()) {
                if (config == null) config = CapConfig.loadDefault(this);
                java.lang.reflect.Field f = CapConfig.class.getDeclaredField("startPath");
                f.setAccessible(true);
                f.set(config, "?go=" + t);
            }
        } catch (Throwable e) { /* تجاهل: يبقى الإرسال بعد التحميل احتياطاً */ }
        super.load();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        sendTarget(targetOf(intent));
        sendFile(intent);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiwanPrintPlugin.class);
        super.onCreate(savedInstanceState);
        sendTarget(targetOf(getIntent()));
        sendFile(getIntent());
        try { Intent cl = new Intent(getIntent()); cl.setData(null); cl.setAction(Intent.ACTION_MAIN); setIntent(cl); } catch (Exception e) { /* تجاهل */ }
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
