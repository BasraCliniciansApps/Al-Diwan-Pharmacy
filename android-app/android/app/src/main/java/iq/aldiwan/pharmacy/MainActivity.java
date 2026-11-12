package iq.aldiwan.pharmacy;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
    }
}
