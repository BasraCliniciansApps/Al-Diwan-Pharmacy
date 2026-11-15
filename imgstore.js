// صور المواد: حفظ على الجهاز (كاش دائم) + رفع بالخلفية إلى GitHub مع إعادة المحاولة + ملف صور للنسخ الاحتياطي (JSON، لا يظهر في معرض الصور)
(function () {
    'use strict';
    const KEEP = 'diwan-keep-img', REPO = 'BasraCliniciansApps/Al-Diwan-Pharmacy';
    const RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/';
    const IMG_FILE = 'diwan-images-backup.json';
    const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } };

    // ---------- طابور الرفع (IndexedDB) ----------
    let dbp = null;
    function qdb() {
        if (dbp) return dbp;
        dbp = new Promise((ok, no) => { const r = indexedDB.open('diwanImgQ', 1); r.onupgradeneeded = () => r.result.createObjectStore('q', { keyPath: 'path' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
        return dbp;
    }
    async function qtx(mode, fn) { const d = await qdb(); return new Promise((ok, no) => { const t = d.transaction('q', mode), s = t.objectStore('q'); const rq = fn(s); t.oncomplete = () => ok(rq && rq.result); t.onerror = () => no(t.error); }); }
    const qAll = () => qtx('readonly', s => s.getAll()).then(x => x || []).catch(() => []);
    const qPut = it => qtx('readwrite', s => s.put(it));
    const qDel = path => qtx('readwrite', s => s.delete(path));

    // ---------- الكاش الدائم ----------
    async function keep() { return caches.open(KEEP); }
    async function localPut(url, blob) { const c = await keep(); await c.put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })); }
    async function localGet(url) { const c = await keep(); const r = await c.match(url); return r ? r.blob() : null; }
    function dataUrlToBlob(d) { const m = /^data:([^;]+);base64,(.*)$/.exec(d || ''); if (!m) return null; const bin = atob(m[2]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: m[1] }); }
    const blobToDataUrl = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(b); });
    const prodUrls = () => { const s = new Set(); (typeof products !== 'undefined' ? products : []).forEach(p => { const u = String(p.img || '').trim(); if (/^https?:\/\//.test(u)) s.add(u); }); return [...s]; };

    // ---------- الرفع بالخلفية ----------
    let running = false, needToken = false;
    async function queueRun() {
        if (running || !navigator.onLine) return;
        const token = lsGet('diwan_gh_token', '');
        const items = await qAll();
        if (!items.length) { needToken = false; return; }
        if (!token) { needToken = true; render(); return; }
        needToken = false; running = true;
        const h = (window.Prog && Prog.start) ? Prog.start('رفع صور المواد بالخلفية', { text: '0 من ' + items.length, indeterminate: false }) : null;
        let done = 0, stop = false;
        try {
            for (const it of items) {
                let ok = false;
                for (let i = 0; i < 5 && !stop; i++) {
                    let resp, out = {};
                    try { resp = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + it.path, { method: 'PUT', headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'صورة دواء: ' + it.path.split('/').pop(), content: it.b64 }) }); out = await resp.json().catch(() => ({})); }
                    catch (e) { stop = true; break; }   // لا اتصال: نكمل لاحقاً
                    if (resp.ok || (resp.status === 422 && /sha/i.test(out.message || ''))) { ok = true; break; }   // 422: الملف مرفوع سابقاً
                    if (resp.status === 401) { lsSet('diwan_gh_token', ''); needToken = true; stop = true; break; }
                    if (resp.status === 409 || /but expected|is at/i.test(out.message || '')) { await new Promise(r => setTimeout(r, 1200 * (i + 1))); continue; }
                    break;
                }
                if (ok) { await qDel(it.path); done++; if (h) h.set(Math.round(done / items.length * 100), done + ' من ' + items.length); }
                if (stop) break;
            }
            if (h) { if (done === items.length) h.ok('تم رفع ' + done + ' صورة'); else h.fail('تعذر إكمال رفع الصور', needToken ? 'مفتاح GitHub غير صالح، أعد إدخاله عند رفع صورة جديدة' : 'سيُعاد الرفع تلقائياً عند توفر الاتصال'); }
        } finally { running = false; render(); if (done) backupSoon(); }
    }
    async function enqueue(path, b64) { await qPut({ path, b64, at: Date.now() }); setTimeout(queueRun, 300); render(); }

    // ---------- ملف الصور للنسخ الاحتياطي ----------
    let bkTimer = 0;
    const sig = urls => urls.length + ':' + urls.slice().sort().join('|').length;
    async function buildBackup(h) {
        const urls = prodUrls(), images = []; let i = 0;
        for (const u of urls) {
            let b = await localGet(u).catch(() => null);
            if (!b && navigator.onLine) { try { const r = await fetch(u, { mode: 'cors', credentials: 'omit' }); if (r.ok) { b = await r.blob(); await localPut(u, b); } } catch (e) { /* تجاهل */ } }
            if (b) images.push({ u, d: await blobToDataUrl(b) });
            if (h && (++i % 10 === 0)) h.set(Math.round(i / urls.length * 100), i + ' من ' + urls.length);
        }
        return { kind: 'diwan-images', v: 1, at: new Date().toISOString(), images };
    }
    async function saveBackup(o) {
        o = o || {};
        const h = (window.Prog && Prog.start) ? Prog.start('حفظ ملف صور المواد', { text: 'تجهيز الصور...', indeterminate: false }) : null;
        try {
            const data = await buildBackup(h);
            if (!data.images.length) { if (h) h.ok('لا توجد صور لحفظها'); return null; }
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            let where = '';
            if (window.NAT && NAT.is && NAT.saveBlob) { if (NAT.nomedia) await NAT.nomedia(); where = (await NAT.saveBlob(blob, IMG_FILE)) || ''; }
            else if (o.manual && typeof downloadFile === 'function') { await downloadFile(IMG_FILE, JSON.stringify(data), 'application/json'); where = 'downloaded'; }
            else { if (h) h.ok('تم'); return null; }
            lsSet('diwanImgBk', JSON.stringify({ n: data.images.length, at: Date.now(), sig: sig(prodUrls()) }));
            if (h) h.ok('تم حفظ ' + data.images.length + ' صورة', where && where !== 'downloaded' ? where : '');
            render(); return where;
        } catch (e) { if (h) h.fail('تعذر حفظ ملف الصور', (e && e.message) || String(e)); return null; }
    }
    function backupSoon() {
        if (!(window.NAT && NAT.is)) return;
        clearTimeout(bkTimer); bkTimer = setTimeout(async () => {
            let last = {}; try { last = JSON.parse(lsGet('diwanImgBk', '{}')); } catch (e) { /* تجاهل */ }
            if (last.sig !== sig(prodUrls()) && prodUrls().length) saveBackup({});
        }, 20000);
    }

    // ---------- الاسترجاع ----------
    async function importData(data, requeue) {
        if (!data || data.kind !== 'diwan-images' || !Array.isArray(data.images)) throw new Error('الملف ليس ملف صور لهذا التطبيق.');
        const h = (window.Prog && Prog.start) ? Prog.start('استرجاع صور المواد', { text: '0 من ' + data.images.length, indeterminate: false }) : null;
        let n = 0, up = 0;
        for (const im of data.images) {
            const b = dataUrlToBlob(im.d); if (!b || !im.u) continue;
            await localPut(im.u, b); n++;
            if (requeue && navigator.onLine && im.u.startsWith(RAW)) {   // إن كانت الصورة غير موجودة على GitHub نعيد رفعها بالخلفية
                try { const r = await fetch(im.u, { method: 'HEAD', mode: 'cors', credentials: 'omit' }); if (r.status === 404) { await qPut({ path: im.u.slice(RAW.length), b64: String(im.d).split(',')[1], at: Date.now() }); up++; } } catch (e) { /* تجاهل */ }
            }
            if (h && n % 10 === 0) h.set(Math.round(n / data.images.length * 100), n + ' من ' + data.images.length);
        }
        if (h) h.ok('تم استرجاع ' + n + ' صورة', up ? ('ستُرفع ' + up + ' صورة مفقودة بالخلفية') : '');
        render(); if (up) setTimeout(queueRun, 500);
        return n;
    }
    async function restoreFromFile(event) {
        const input = event.target, f = input.files && input.files[0]; if (!f) return;
        try { await importData(JSON.parse(await f.text()), true); }
        catch (e) { try { Swal.fire({ icon: 'error', title: 'تعذر استرجاع الصور', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); } catch (x) { /* تجاهل */ } }
        input.value = '';
    }
    async function restoreAuto() {   // بعد استرجاع نسخة المواد: نقرأ ملف الصور من مجلد النسخ إن وُجد
        if (!(window.NAT && NAT.is && NAT.readText)) return false;
        try { const t = await NAT.readText('Backups/' + IMG_FILE); if (!t) return false; await importData(JSON.parse(t), true); return true; } catch (e) { return false; }
    }

    // ---------- العرض في الإعدادات ----------
    async function render() {
        const el = document.getElementById('imgBkInfo'); if (!el) return;
        let cached = 0; try { const c = await keep(); const urls = prodUrls(); cached = (await Promise.all(urls.map(u => c.match(u)))).filter(Boolean).length; } catch (e) { /* تجاهل */ }
        const q = (await qAll()).length; let last = {}; try { last = JSON.parse(lsGet('diwanImgBk', '{}')); } catch (e) { /* تجاهل */ }
        el.textContent = 'محفوظة على الجهاز: ' + cached + ' من ' + prodUrls().length + (q ? ' • بانتظار الرفع: ' + q : '') + (needToken ? ' • مفتاح GitHub مطلوب' : '') + (last.at ? ' • آخر ملف: ' + new Date(last.at).toLocaleDateString('ar-IQ') : '');
    }

    window.ImgStore = { localPut, localGet, enqueue, queueRun, saveBackup, restoreFromFile, restoreAuto, render, RAW };
    window.imgSaveBackup = () => saveBackup({ manual: true });
    window.imgRestoreFromFile = restoreFromFile;
    // ربط النسخ اليدوية: تُحفظ الصور معها
    ['exportBackupJson', 'exportFullBackup'].forEach(n => { const f = window[n]; if (typeof f === 'function') window[n] = function () { const r = f.apply(this, arguments); try { saveBackup({}); } catch (e) { /* تجاهل */ } return r; }; });
    window.addEventListener('online', () => setTimeout(queueRun, 1500));
    setInterval(queueRun, 60000);
    setTimeout(queueRun, 6000); setTimeout(backupSoon, 40000); setTimeout(render, 3000);
})();
