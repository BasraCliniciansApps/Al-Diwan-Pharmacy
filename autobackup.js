// ===== نسخة احتياطية تلقائية على كل جهاز: نسختان بالتناوب (واحدة لكل يوم) =====
// يوم زوجي ← الملف A، يوم فردي ← الملف B. كل يوم تستبدل نسخةُ اليوم نسخةَ قبل يومين، وتبقى نسخة الأمس سليمة.
// تُحفظ بعد كل تعديل (بعد دقيقة) وعند الخروج من التطبيق وعند 12:00 ليلاً (أو عند أول فتح بعدها).
// في الأندرويد داخل مجلد المستندات (Documents) فتبقى بعد حذف التطبيق؛ وفي المتصفح داخل التطبيق.
(function () {
    const KEY = 'diwanAutoBk2', OFF = 'diwanAutoBkOff', IDB = 'diwanAutoBkDb';
    let running = false;
    const on = () => { try { return localStorage.getItem(OFF) !== '1'; } catch (e) { return true; } };
    const infoAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
    const dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const dayNum = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
    const slot = () => (dayNum() % 2 === 0 ? 'A' : 'B');
    const fname = s => 'diwan-AUTO-backup-' + s + '.json';
    function idb(mode, fn) {
        return new Promise((ok, no) => {
            const rq = indexedDB.open(IDB, 1);
            rq.onupgradeneeded = () => rq.result.createObjectStore('f');
            rq.onerror = () => no(rq.error);
            rq.onsuccess = () => { const tx = rq.result.transaction('f', mode), st = tx.objectStore('f'), r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); };
        });
    }
    async function run(reason) {
        if (running || typeof products === 'undefined' || !products || !products.length) return false;   // لا نكتب نسخة فارغة فوق نسخة سليمة
        running = true;
        const s = slot();
        try {
            let data; try { data = typeof buildFullBackup === 'function' ? buildFullBackup() : buildBackupObject(); } catch (e) { data = buildBackupObject(); }
            const text = JSON.stringify(data);
            let where = '', err = '';
            if (window.NAT && NAT.is && NAT.saveBlob) { try { where = (await NAT.saveBlob(new Blob([text], { type: 'application/json' }), fname(s))) || ''; } catch (e) { where = ''; } if (!where) err = 'تعذر الحفظ في المستندات'; }
            if (!where) where = 'داخل التطبيق';
            await idb('readwrite', st => st.put(text, s)).catch(() => { if (where === 'داخل التطبيق') throw new Error('تعذر الحفظ'); });   // نسخة داخلية دائماً بجانب المستندات
            const all = infoAll(), c = data.counts || {};
            all[s] = { ts: Date.now(), day: dayKey(), where, err, bytes: text.length, n: c.products || products.length, reason };
            localStorage.setItem(KEY, JSON.stringify(all));
            window.__abDirty = 0; running = false; render(); return true;
        } catch (e) {
            try { const all = infoAll(); all[s] = Object.assign(all[s] || {}, { err: (e && e.message) || 'فشل الحفظ' }); localStorage.setItem(KEY, JSON.stringify(all)); } catch (x) { /* تجاهل */ }
            running = false; render(); return false;
        }
    }
    const line = (s, i) => 'النسخة ' + s + ': ' + (i && i.ts ? new Date(i.ts).toLocaleString('ar-IQ') + ' — ' + (i.n || 0) + ' صنف — ' + (i.where || '') + (i.err ? ' (' + i.err + ')' : '') : 'لا توجد بعد');
    function render() {
        const el = document.getElementById('abInfo'), sw = document.getElementById('abOn'); if (sw) sw.checked = on();
        if (!el) return; const a = infoAll();
        el.innerHTML = 'نسختان بالتناوب، واحدة لكل يوم، وتبقى نسخة الأمس سليمة.<br>' + line('A', a.A) + '<br>' + line('B', a.B);
    }
    function check(reason) { if (on() && infoAll()[slot()] && infoAll()[slot()].day === dayKey()) return; if (on()) return run(reason); }
    function schedule() {
        const n = new Date(), t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
        setTimeout(() => { if (on()) run('midnight'); schedule(); }, t - n);
    }
    window.abToggle = cb => { try { localStorage.setItem(OFF, cb.checked ? '0' : '1'); } catch (e) { /* تجاهل */ } if (cb.checked) check('toggle'); render(); };
    window.abNow = async () => {
        const h = (typeof Prog !== 'undefined') ? Prog.start('نسخة احتياطية تلقائية', { text: 'جمع البيانات...' }) : null;
        const ok = await run('manual'), i = infoAll()[slot()] || {};
        if (h) { if (ok && !i.err) h.ok('تم حفظ النسخة ' + slot() + ': ' + i.where); else h.fail('تعذر الحفظ', i.err || 'لا توجد بيانات محمّلة بعد'); }
    };
    // استرجاع بسهولة من النسخة الداخلية (الأحدث من النسختين)، أو من ملف بالمستندات عبر زر الاسترجاع المعتاد
    window.abRestore = async () => {
        const a = infoAll(), order = ['A', 'B'].filter(k => a[k] && a[k].ts).sort((x, y) => a[y].ts - a[x].ts);
        if (!order.length) { Swal.fire({ icon: 'info', title: 'لا توجد نسخة داخلية', text: 'اختر ملف النسخة من مجلد المستندات عبر «الاسترجاع من ملف».', confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38' }); return; }
        const opts = {}; order.forEach(k => { opts[k] = 'النسخة ' + k + ' — ' + new Date(a[k].ts).toLocaleString('ar-IQ') + ' — ' + (a[k].n || 0) + ' صنف'; });
        const r = await Swal.fire({ title: 'استرجاع نسخة تلقائية', input: 'select', inputOptions: opts, inputValue: order[0], showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return;
        let text = null; try { text = await idb('readonly', st => st.get(r.value)); } catch (e) { /* تجاهل */ }
        if (!text) { Swal.fire({ icon: 'error', title: 'تعذر قراءة النسخة', text: 'اختر ملف النسخة من مجلد المستندات عبر «الاسترجاع من ملف».', confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38' }); return; }
        await restoreBackup({ target: { files: [new File([text], fname(r.value), { type: 'application/json' })], value: '' } });
    };
    window.abRender = render;
    document.addEventListener('DOMContentLoaded', () => { render(); setInterval(render, 5000); });
    setTimeout(() => check('catchup'), 30000);                 // لحاق: أول فتح بعد منتصف الليل إن كان التطبيق مغلقاً وقتها
    let dTimer = 0;
    window.abDirty = () => { if (!on() || dTimer) return; dTimer = setTimeout(() => { dTimer = 0; if (window.__abDirty) run('change'); }, 60000); };   // بعد دقيقة من أول تعديل
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check('resume');
        else if (on() && window.__abDirty) run('background');   // عند الخروج من التطبيق
    });
    schedule();
})();
