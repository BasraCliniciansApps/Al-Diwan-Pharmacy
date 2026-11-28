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
    // بصمة خفيفة لحالة البيانات: إن لم تتغيّر منذ آخر نسخة فلا نبني نسخة كاملة (عشرات الميغابايت) ولا نكتبها كل 10 دقائق وعند كل إخفاء للنافذة
    let lastSig = '';
    function dataSig() {
        try {
            let h = 0; const add = n => { h = (h * 31 + (n | 0)) | 0; };
            products.forEach(p => { add(p.id); add(p.qty); add(p.loose); add(Math.round((+p.price || 0) * 10)); add(Math.round((+p.costPrice || 0) * 10)); add(p.counted ? 1 : 0); add(p.arch ? 1 : 0); add(String(p.name || '').length); });
            const tail = (a, f) => (a && a.length ? String(f(a[0]) || '') : '');
            const ls = k => { try { return (lsGet(k) || '').length; } catch (e) { return 0; } };
            return [products.length, h, puAll.length, tail(puAll, x => x.editedAt || x.createdTs), lgAll.length, lgAll.reduce((m, e) => (String(e.upd || '') > m ? String(e.upd) : m), ''), billAll.length, tail(billAll, x => x.editedAt || x.cancelledAt || x.issuedTs), ls('diwanCountLists'), ls('diwanExpenses'), ls('diwanFollowups'), ls('diwanSuppliers')].join('|');
        } catch (e) { return 'x' + Date.now(); }
    }
    async function run(refresh, force) {
        if (busy) return;
        if (typeof buildFullBackup !== 'function' || typeof products === 'undefined' || !products.length) return;   // لا نكتب نسخة فارغة فوق نسخة سليمة
        busy = true;
        try {
            if (refresh && navigator.onLine && typeof cloudReady === 'function' && cloudReady()) await loadFresh();
            const sg = dataSig();
            if (!force && sg === lastSig) { busy = false; render(); return; }   // لا تغيير: نتجنب العمل الثقيل
            await new Promise(res => (window.requestIdleCallback ? requestIdleCallback(res, { timeout: 4000 }) : setTimeout(res, 50)));   // العمل الثقيل وقت الخمول لا أثناء استعمال البرنامج
            const r = await D.writeBackup(JSON.stringify(buildFullBackup()));
            if (r && r.ok) { lastOk = r.ts; lastErr = ''; lastSig = sg; } else lastErr = (r && r.error) || 'تعذر الحفظ';
        } catch (e) { lastErr = e.message || String(e); }
        busy = false; render();
    }
    function render() {
        const host = document.getElementById('dsHost'); if (!host) return;
        D.backupInfo().then(info => {
            const t = lastOk || info.ts, when = t ? new Date(t).toLocaleString('ar-IQ') : 'لم تُحفظ بعد';
            host.innerHTML = `<div class="qk-row"><div><b>الاستقبال فقط</b><small>يقرأ البرنامج من السحابة ولا يحفظ إليها أي تعديل.</small></div><label class="setup-sw"><input type="checkbox" id="dsRecv" ${recvOnly() ? 'checked' : ''} onchange="dsToggleRecv(this)"><i></i></label></div>
                <div class="ds-bk"><div class="ds-bk-t">💽 نسخة تلقائية على قرص الحاسبة</div>
                <div class="ds-bk-s${lastErr ? ' bad' : ''}">${lastErr ? 'تعذر الحفظ: ' + escapeHtml(lastErr) : 'آخر حفظ: ' + escapeHtml(when)}</div>
                <div class="ds-bk-p" dir="ltr">${escapeHtml(info.dir || '')}</div>
                <div class="ds-bk-b"><button type="button" onclick="dsOpenDir()">فتح المجلد</button><button type="button" onclick="dsChooseDir()">تغيير المجلد</button><button type="button" onclick="dsBackupNow()">حفظ الآن</button></div></div>`;
        }).catch(() => { /* تجاهل */ });
    }
    window.dsRender = render;
    window.dsToggleRecv = async cb => {
        const on = cb.checked;
        const r = await Swal.fire({ icon: 'question', title: on ? 'تفعيل الاستقبال فقط؟' : 'إيقاف الاستقبال فقط؟', text: on ? 'لن يحفظ هذا البرنامج أي تعديل في السحابة.' : 'سيتمكن هذا البرنامج من الكتابة إلى السحابة. قد تستهلك الكتابات الكثيرة الحصة المجانية.', showCancelButton: true, confirmButtonText: 'تأكيد', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) { cb.checked = !on; return; }
        try { localStorage.setItem('diwanRecvOnly', on ? '1' : '0'); if (!on) localStorage.setItem('diwanRecvClean', '0'); } catch (e) { /* تجاهل */ }
        location.reload();
    };
    window.dsOpenDir = () => D.openBackupDir();
    window.dsChooseDir = async () => { const r = await D.chooseBackupDir(); if (r && r.ok) { await run(false, true); } render(); };
    window.dsBackupNow = async () => {
        const h = (typeof Prog !== 'undefined') ? Prog.start('حفظ نسخة على القرص', { text: 'جمع البيانات...' }) : null;
        try { await run(true, true); if (h) { if (lastErr) h.fail('تعذر الحفظ', lastErr); else h.ok('تم حفظ النسخة على القرص'); } }
        catch (e) { if (h) h.fail('تعذر الحفظ', e.message || String(e)); }
    };

    // ===== اختصارات الكيبورد (الحاسبة فقط) =====
    // F2 شاشة البيع · Ctrl+K بحث المخزن · Ctrl+S حفظ · F9 إصدار · Esc/Alt+← إغلاق الأعلى/رجوع
    document.addEventListener('keydown', e => {
        const k = e.key, ctrl = e.ctrlKey || e.metaKey;
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
        const dialog = !!document.querySelector('.swal2-container, .px-ov');
        const vis = el => !!el && el.offsetParent !== null;
        try {
            if (k === 'Escape' && !dialog) { if (typeof window.__handleBack === 'function' && window.__handleBack()) e.preventDefault(); return; }
            if (k === 'ArrowLeft' && e.altKey && !dialog) { if (window.__handleBack && window.__handleBack()) e.preventDefault(); return; }
            if (dialog) return;
            if (k === 'F2') { e.preventDefault(); if (typeof posOpen === 'function') posOpen(); return; }
            if (ctrl && (k === 'k' || k === 'K')) {
                e.preventDefault(); if (typeof showView === 'function') showView('stock');
                setTimeout(() => { const i = document.getElementById('searchInput'); if (i) { i.removeAttribute('readonly'); i.focus(); i.select(); } }, 80); return;
            }
            if (ctrl && (k === 's' || k === 'S')) {
                e.preventDefault();
                const fm = document.getElementById('formModal');
                const sv = fm && fm.style.display !== 'none' ? [...fm.querySelectorAll('button')].find(b => /حفظ/.test(b.textContent) && vis(b)) : null;
                if (sv) sv.click(); return;
            }
            if (k === 'F9') {
                e.preventDefault();
                const b = [document.querySelector('.pos-big.go'), document.getElementById('billIssueBtn')].find(vis);
                if (b) b.click(); return;
            }
            if (!typing && k === '/') { const i = [...document.querySelectorAll('input[type=search], #searchInput')].find(vis); if (i) { e.preventDefault(); i.removeAttribute('readonly'); i.focus(); } }
        } catch (er) { /* تجاهل */ }
    });
    // Enter يُنقل للحقل التالي داخل جداول الفاتورة والوارد (إدخال سريع للأسعار والكميات)
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.shiftKey || !e.target || e.target.tagName !== 'INPUT') return;
        const t = e.target; if (!/^(text|number|tel|search|)$/.test(t.type)) return;
        const row = t.closest('tr'); if (!row) return;
        const all = [...row.closest('table').querySelectorAll('input')].filter(i => i.offsetParent !== null && !i.disabled);
        const idx = all.indexOf(t); if (idx < 0) return;
        const nx = all[idx + 1]; if (nx) { e.preventDefault(); nx.focus(); try { nx.select(); } catch (er) { /* تجاهل */ } }
    });
    window.addEventListener('DOMContentLoaded', () => { render(); setInterval(render, 600000); });
    setTimeout(() => run(true), 45000);                       // بعد الفتح (بعد ما تكتمل البيانات)
    setInterval(() => run(false), 10 * 60 * 1000);            // كل 10 دقائق من الذاكرة
    setInterval(() => run(true), 6 * 60 * 60 * 1000);         // كل 6 ساعات مع قراءة الوارد والفواتير والسجلات (تقليل القراءات المحسوبة على الحصة المجانية)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') run(false); });
})();
