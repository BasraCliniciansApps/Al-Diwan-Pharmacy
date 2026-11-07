// ===== ربط التطبيق ببرنامج سطح المكتب (يعمل فقط داخل البرنامج؛ في الموبايل والمتصفح لا أثر له) =====
// نسخة احتياطية كاملة تُكتب تلقائياً على قرص الحاسبة: بعد الفتح، ثم دورياً، وعند إخفاء النافذة.
(function () {
    const D = window.diwanDesktop;
    if (!D || !D.isDesktop) return;
    document.documentElement.classList.add('is-desktop-app');
    let busy = false, lastOk = 0, lastErr = '';

    async function loadFresh() {   // نقرأ أحدث وارد/فواتير/سجلات من السحابة بصمت (بدون شريط تقدم: عملية خلفية)
        for (const fn of ['puLoad', 'loadInvoices', 'lgLoad']) { try { if (typeof window[fn] === 'function') await window[fn](); } catch (e) { /* تجاهل */ } }
    }
    async function run(refresh) {
        if (busy) return;
        if (typeof buildFullBackup !== 'function' || typeof products === 'undefined' || !products.length) return;   // لا نكتب نسخة فارغة فوق نسخة سليمة
        busy = true;
        try {
            if (refresh && navigator.onLine && typeof cloudReady === 'function' && cloudReady()) await loadFresh();
            const r = await D.writeBackup(JSON.stringify(buildFullBackup()));
            if (r && r.ok) { lastOk = r.ts; lastErr = ''; } else lastErr = (r && r.error) || 'تعذر الحفظ';
        } catch (e) { lastErr = e.message || String(e); }
        busy = false; render();
    }
    function render() {
        const anchor = document.getElementById('bkReminder'); if (!anchor) return;
        let el = document.getElementById('dsBkLine');
        if (!el) { el = document.createElement('div'); el.id = 'dsBkLine'; el.className = 'ds-bk'; anchor.insertAdjacentElement('afterend', el); }
        D.backupInfo().then(info => {
            const t = lastOk || info.ts, when = t ? new Date(t).toLocaleString('ar-IQ') : 'لم تُحفظ بعد';
            el.innerHTML = `<div class="ds-bk-t">💽 نسخة تلقائية على قرص الحاسبة</div>
                <div class="ds-bk-s${lastErr ? ' bad' : ''}">${lastErr ? 'تعذر الحفظ: ' + escapeHtml(lastErr) : 'آخر حفظ: ' + escapeHtml(when)}</div>
                <div class="ds-bk-p" dir="ltr">${escapeHtml(info.dir || '')}</div>
                <div class="ds-bk-b"><button type="button" onclick="dsOpenDir()">فتح المجلد</button><button type="button" onclick="dsChooseDir()">تغيير المجلد</button><button type="button" onclick="dsBackupNow()">حفظ الآن</button></div>`;
        }).catch(() => { /* تجاهل */ });
    }
    window.dsOpenDir = () => D.openBackupDir();
    window.dsChooseDir = async () => { const r = await D.chooseBackupDir(); if (r && r.ok) { await run(false); } render(); };
    window.dsBackupNow = async () => {
        const h = (typeof Prog !== 'undefined') ? Prog.start('حفظ نسخة على القرص', { text: 'جمع البيانات...' }) : null;
        try { await run(true); if (h) { if (lastErr) h.fail('تعذر الحفظ', lastErr); else h.ok('تم حفظ النسخة على القرص'); } }
        catch (e) { if (h) h.fail('تعذر الحفظ', e.message || String(e)); }
    };
    window.addEventListener('DOMContentLoaded', () => { render(); setInterval(render, 600000); });
    setTimeout(() => run(true), 45000);                       // بعد الفتح (بعد ما تكتمل البيانات)
    setInterval(() => run(false), 10 * 60 * 1000);            // كل 10 دقائق من الذاكرة
    setInterval(() => run(true), 60 * 60 * 1000);             // كل ساعة مع قراءة الوارد والفواتير والسجلات من السحابة
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') run(false); });
})();
