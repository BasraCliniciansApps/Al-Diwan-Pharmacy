package iq.aldiwan.pharmacy;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

/** طباعة أصلية للأندرويد: window.print() لا يعمل داخل WebView، فنستعمل PrintManager. */
@CapacitorPlugin(name = "DiwanPrint")
public class DiwanPrintPlugin extends Plugin {
    private final Handler h = new Handler(Looper.getMainLooper());
    private final List<WebView> keep = new ArrayList<>();

    /** يطبع الصفحة الحالية (بتنسيق @media print) ويُنهي الوعد عند انتهاء مهمة الطباعة أو إلغائها. */
    @PluginMethod
    public void print(final PluginCall call) {
        final String title = call.getString("title", "Al-Diwan-Pharmacy");
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = getBridge().getWebView();
                startJob(wv, title, call);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    /** يطبع مستنداً HTML مستقلاً (مثل الوصفات والملصقات المبنية داخل iframe). */
    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        final String base = call.getString("base", "https://localhost/");
        final String title = call.getString("title", "Al-Diwan-Pharmacy");
        getActivity().runOnUiThread(() -> {
            try {
                final WebView w = new WebView(getActivity());
                keep.add(w);
                w.getSettings().setJavaScriptEnabled(false);
                w.setWebViewClient(new WebViewClient() {
                    @Override public void onPageFinished(final WebView v, String url) {
                        h.postDelayed(() -> {
                            try { startJob(v, title, call); } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); keep.remove(v); }
                        }, 500);
                    }
                });
                w.loadDataWithBaseURL(base, html, "text/html", "utf-8", null);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private void startJob(final WebView wv, String title, final PluginCall call) {
        PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter ad = wv.createPrintDocumentAdapter(title);
        final PrintJob job = pm.print(title, ad, new PrintAttributes.Builder().build());
        final Runnable poll = new Runnable() {
            int n = 0;
            @Override public void run() {
                boolean end = job.isCompleted() || job.isCancelled() || job.isFailed() || ++n > 1800;
                if (end) { keep.remove(wv); call.resolve(); return; }
                h.postDelayed(this, 700);
            }
        };
        h.postDelayed(poll, 1500);
    }
}
