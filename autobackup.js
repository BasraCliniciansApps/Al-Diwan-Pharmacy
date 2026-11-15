// ===== نسخة احتياطية تلقائية يومية على الجهاز (12 منتصف الليل) =====
// اسم ثابت لكل جهاز (diwan-AUTO-backup.json) فتستبدل كل نسخة سابقتها، ومنفصل عن النسخ اليدوية.
// في تطبيق الأندرويد تُحفظ في مجلد المستندات (Documents) فتبقى بعد حذف التطبيق؛ وفي المتصفح تُحفظ داخل التطبيق.
(function () {
    const KEY = 'diwanAutoBk', OFF = 'diwanAutoBkOff', NAME = 'diwan-AUTO-backup.json', IDB = 'diwanAutoBkDb';
    let running = false;
    const on = () => { try { return localStorage.getItem(OFF) !== '1'; } catch (e) { return true; } };
    const info = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
    const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    function idbPut(text) {
        return new Promise((ok, no) => {
            const rq = indexedDB.open(IDB, 1);
            rq.onupgradeneeded = () => rq.result.createObjectStore('f');
            rq.onerror = () => no(rq.error);
            rq.onsuccess = () => { const tx = rq.result.transaction('f', 'readwrite'); tx.objectStore('f').put(text, 'auto'); tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); };
        });
    }
    async function run(reason) {
        if (running || typeof products === 'undefined' || !products || !products.length) return false;   // لا نكتب نسخة فارغة فوق نسخة سليمة
        running = true;
        try {
            let data; try { data = typeof buildFullBackup === 'function' ? buildFullBackup() : buildBackupObject(); } catch (e) { data = buildBackupObject(); }
            const text = JSON.stringify(data);
            let where = '', err = '';
            if (window.NAT && NAT.is && NAT.saveBlob) { try { where = (await NAT.saveBlob(new Blob([text], { type: 'application/json' }), NAME)) || ''; } catch (e) { where = ''; } if (!where) err = 'تعذر الحفظ في المستندات'; }
            if (!where) { await idbPut(text); where = 'داخل التطبيق'; }
            const c = data.counts || {};
            localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), day: dayKey(), where, err, bytes: text.length, n: c.products || products.length, reason }));
            running = false; render(); return true;
        } catch (e) {
            try { localStorage.setItem(KEY, JSON.stringify(Object.assign(info(), { err: (e && e.message) || 'فشل الحفظ' }))); } catch (x) { /* تجاهل */ }
            running = false; render(); return false;
        }
    }
    function render() {
        const el = document.getElementById('abInfo'), sw = document.getElementById('abOn'); if (sw) sw.checked = on();
        if (!el) return; const i = info();
        el.textContent = (i.ts ? 'آخر نسخة: ' + new Date(i.ts).toLocaleString('ar-IQ') + ' — ' + (i.where || '') + (i.err ? ' (' + i.err + ')' : '') : 'لم تُحفظ نسخة تلقائية بعد') + ' · تُحفظ كل ليلة عند 12:00 وتستبدل السابقة.';
    }
    function check(reason) { if (on() && info().day !== dayKey()) return run(reason); }
    function schedule() {
        const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
        setTimeout(() => { if (on()) run('midnight'); schedule(); }, t - n);
    }
    window.abToggle = cb => { try { localStorage.setItem(OFF, cb.checked ? '0' : '1'); } catch (e) { /* تجاهل */ } if (cb.checked) check('toggle'); render(); };
    window.abNow = async () => {
        const h = (typeof Prog !== 'undefined') ? Prog.start('نسخة احتياطية تلقائية', { text: 'جمع البيانات...' }) : null;
        const ok = await run('manual');
        if (h) { if (ok && !info().err) h.ok('تم حفظ النسخة: ' + info().where); else h.fail('تعذر الحفظ', info().err || 'لا توجد بيانات محمّلة بعد'); }
    };
    window.abRender = render;
    document.addEventListener('DOMContentLoaded', () => { render(); setInterval(render, 5000); });
    setTimeout(() => check('catchup'), 30000);                 // لحاق: أول فتح بعد منتصف الليل إن كان التطبيق مغلقاً وقتها
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check('resume'); });
    schedule();
})();
