/* =====================================================
   صيدلية الديوان — جسر تطبيق الأندرويد (Capacitor)
   يعمل فقط داخل تطبيق APK؛ في المتصفح لا يفعل أي شيء.
   الميزات: حفظ الملفات في فولدر Al-Diwan-Pharmacy، قفل البصمة،
   الطباعة الحرارية بالبلوتوث، تذكيرات الصلاحية، ماسح الباركود الأصلي.
   ===================================================== */
(function () {
    'use strict';
    const C = window.Capacitor;
    const IS = !!(C && C.isNativePlatform && C.isNativePlatform());
    const NAT = window.NAT = { is: IS };
    if (!IS) return;
    document.documentElement.classList.add('is-app');

    // في وضع الموقع البعيد (server.url) قد لا تتوفر registerPlugin، فنجرّب عدة طرق للوصول للإضافات الأصلية
    const P = n => {
        try { if (C.Plugins && C.Plugins[n]) return C.Plugins[n]; } catch (e) { /* تجاهل */ }
        try { if (typeof C.registerPlugin === 'function') { const r = C.registerPlugin(n); if (r) return r; } } catch (e) { /* تجاهل */ }
        if (typeof C.nativePromise === 'function') {
            return new Proxy({}, { get: (_, m) => {
                if (m === 'then') return undefined;
                if (m === 'addListener') return (ev, cb) => { let h = null; try { h = C.addListener ? C.addListener(n, ev, cb) : null; } catch (e) { /* تجاهل */ } return Promise.resolve({ remove: () => { try { h && h.remove && h.remove(); } catch (e) { /* تجاهل */ } } }); };
                return o => C.nativePromise(n, m, o || {});
            } });
        }
        return null;
    };
    NAT.plugins = () => ({ DP: !!DP, FS: !!FS, LN: !!LN, BS: !!BS, BIO: !!BIO, TP: !!TP, APP: !!APP });
    const FS = P('Filesystem'), LN = P('LocalNotifications'), BS = P('BarcodeScanner'),
        BIO = P('BiometricAuthNative'), TP = P('CapacitorThermalPrinter'), APP = P('App');
    const KEY = 'diwanNative';
    const cfg = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const setCfg = o => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(cfg(), o))); } catch (e) { /* تجاهل */ } };
    const ROOT = 'Al-Diwan-Pharmacy';
    NAT.root = ROOT;

    // ---------- 0) الطباعة (window.print لا تعمل داخل WebView الأندرويد) ----------
    const DP = P('DiwanPrint');
    NAT.print = function (title) { if (!DP) return Promise.reject(new Error('إضافة الطباعة غير متوفرة. حدّث التطبيق من نسخة APK الجديدة.')); const c = cfg(); return DP.print({ title: title || document.title || 'Al-Diwan-Pharmacy', paper: c.paperSize || 'A4', orientation: c.orient || 'portrait' }); };
    NAT.printFrame = function (f) {
        if (!DP) return Promise.reject(new Error('إضافة الطباعة غير متوفرة. حدّث التطبيق من نسخة APK الجديدة.'));
        const d = f.contentDocument; const html = '<!doctype html>' + d.documentElement.outerHTML;
        const c = cfg(); return DP.printHtml({ html, base: location.href, title: d.title || 'Al-Diwan-Pharmacy', paper: c.paperSize || 'A4', orientation: c.orient || 'portrait' });
    };
    window.print = function () {
        NAT.print(document.title).catch(e => { try { Swal.fire({ icon: 'error', title: 'تعذرت الطباعة', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); } catch (x) { /* تجاهل */ } })
            .then(() => { try { window.dispatchEvent(new Event('diwan-afterprint')); } catch (x) { /* تجاهل */ } });
    };

    // ---------- 1) حفظ الملفات تلقائياً ----------
    function subFor(name) {
        const n = String(name).toLowerCase();
        if (/backup|before-/.test(n)) return 'Backups';
        if (/inventory|count|stocktake/.test(n)) return 'Inventory';
        if (/\.pdf$/.test(n) || /invoice/.test(n)) return 'Invoices';
        if (/\.(xlsx|csv)$/.test(n)) return 'Reports';
        return 'Other';
    }
    function blobB64(blob) {
        return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => no(r.error); r.readAsDataURL(blob); });
    }
    // يرجع المسار النسبي عند النجاح، وإلا null (فيعود التطبيق للمشاركة المعتادة)
    NAT.saveBlob = async function (blob, filename) {
        if (!FS) return null;
        try {
            const path = ROOT + '/' + subFor(filename) + '/' + filename;
            await FS.writeFile({ path, data: await blobB64(blob), directory: 'DOCUMENTS', recursive: true });
            return 'Documents/' + path;
        } catch (e) { console.warn('NAT.saveBlob', e); return null; }
    };

    // ---------- زر الرجوع في الهاتف: نعالجه داخل التطبيق بدل الاعتماد على سجل المتصفح ----------
    if (APP && APP.addListener) {
        APP.addListener('backButton', () => {
            try { if (locked) return; if (window.__handleBack && window.__handleBack()) return; } catch (e) { /* تجاهل */ }
            try { APP.exitApp(); } catch (e) { /* تجاهل */ }
        });
    }

    // ---------- 2) قفل البصمة ----------
    let locked = false, hiddenAt = 0;
    function lockEl() {
        let el = document.getElementById('natLock');
        if (el) return el;
        el = document.createElement('div'); el.id = 'natLock'; el.setAttribute('dir', 'rtl');
        el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0f1c38;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:inherit;text-align:center;padding:24px';
        el.innerHTML = '<div style="font-size:3rem">🔒</div><b style="font-size:1.25rem">صيدلية الديوان</b><div style="opacity:.8">التطبيق مقفل. تحقق من هويتك للمتابعة.</div><div id="natErr" style="color:#fecaca;font-size:.8rem;max-width:300px"></div><button type="button" id="natUnlock" style="background:#fff;color:#0f1c38;border:0;border-radius:14px;padding:12px 28px;font-weight:800;font-size:1rem;font-family:inherit">فتح القفل</button>';
        document.body.appendChild(el);
        el.querySelector('#natUnlock').onclick = () => NAT.unlock();
        return el;
    }
    NAT.unlock = async function () {
        if (!BIO) { locked = false; lockEl().style.display = 'none'; return; }
        try {
            await BIO.internalAuthenticate({ reason: 'فتح تطبيق صيدلية الديوان', cancelTitle: 'إلغاء', allowDeviceCredential: true, deviceCredential: true });
            locked = false; lockEl().style.display = 'none';
        } catch (e) {
            const m = String(e && (e.message || e.code) || e), el = lockEl().querySelector('#natErr');
            if (el) el.textContent = /cancel|user_cancel|negative/i.test(m) ? '' : 'تعذر التحقق: ' + m;
        }
    };
    NAT.lockNow = function () {
        if (!cfg().bio) return;
        locked = true; lockEl().style.display = 'flex'; NAT.unlock();
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
        if (cfg().bio && hiddenAt && Date.now() - hiddenAt > 30000) NAT.lockNow();
    });
    NAT.setBio = async function (on) {
        if (on && !BIO) { Swal.fire({ icon: 'error', title: 'تعذر تفعيل القفل', text: 'إضافة البصمة غير متوفرة في هذه النسخة.', confirmButtonText: 'حسناً' }); return false; }
        if (on) {
            try {
                const r = await BIO.checkBiometry();
                if (!r.isAvailable && !r.deviceIsSecure) { Swal.fire({ icon: 'info', title: 'غير متاح', text: 'فعّل بصمة الإصبع أو قفل الشاشة في إعدادات الهاتف أولاً.', confirmButtonText: 'حسناً' }); return false; }
                await BIO.internalAuthenticate({ reason: 'تأكيد تفعيل القفل', cancelTitle: 'إلغاء', allowDeviceCredential: true, deviceCredential: true });
            } catch (e) {
                const m = String(e && (e.message || e.code) || e);
                if (!/cancel|negative/i.test(m)) Swal.fire({ icon: 'error', title: 'تعذر تفعيل القفل', text: m, confirmButtonText: 'حسناً' });
                return false;
            }
        }
        setCfg({ bio: !!on }); return true;
    };

    // ---------- 3) الطباعة الحرارية (بلوتوث) ----------
    NAT.printerScan = function () {
        return new Promise(async (ok, no) => {
            if (!TP) return no(new Error('الطابعة غير متاحة'));
            const found = {};
            try {
                const h1 = await TP.addListener('discoverDevices', d => (d.devices || []).forEach(x => { found[x.address] = x; }));
                const h2 = await TP.addListener('discoveryFinish', () => { try { h1.remove(); h2.remove(); } catch (e) { /* */ } ok(Object.values(found)); });
                await TP.startScan();
                setTimeout(() => { try { h1.remove(); h2.remove(); } catch (e) { /* */ } ok(Object.values(found)); }, 12000);
            } catch (e) { no(e); }
        });
    };
    NAT.printerChoose = async function () {
        const h = Prog.start('البحث عن الطابعات', { text: 'جاري البحث عبر البلوتوث...' });
        let list = [];
        try { list = await NAT.printerScan(); h.ok('انتهى البحث'); } catch (e) { h.fail('تعذر البحث', String(e && e.message || e)); return; }
        if (!list.length) { Swal.fire({ icon: 'info', title: 'لم يُعثر على طابعة', text: 'شغّل الطابعة وأقرنها من إعدادات بلوتوث الهاتف، ثم أعد المحاولة.', confirmButtonText: 'حسناً' }); return; }
        const opts = {}; list.forEach(d => { opts[d.address] = (d.name || 'طابعة') + ' — ' + d.address; });
        const r = await Swal.fire({ title: 'اختر الطابعة', input: 'select', inputOptions: opts, showCancelButton: true, confirmButtonText: 'اعتماد', cancelButtonText: 'إلغاء' });
        if (!r.isConfirmed || !r.value) return;
        setCfg({ printer: r.value, printerName: opts[r.value] });
        return r.value;
    };
    async function captureBill() {
        await new Promise((ok, no) => { if (window.htmlToImage) return ok(); const s = document.createElement('script'); s.src = 'vendor/html-to-image.js'; s.onload = ok; s.onerror = () => no(new Error('تعذر تحميل أداة التصوير')); document.head.appendChild(s); });
        const sheet = document.getElementById('billSheet');
        if (!sheet) throw new Error('الفاتورة غير جاهزة');
        const bv = document.getElementById('billView'), pane = document.getElementById('billPane-new'), keep = [bv, pane].map(e => e ? e.style.cssText : '');
        if (!sheet.offsetWidth) {
            if (bv) bv.style.cssText += ';display:block !important;position:fixed !important;left:-12000px !important;top:0 !important;width:820px !important;height:auto !important;overflow:visible !important;';
            if (pane) pane.style.cssText += ';display:block !important;';
        }
        document.body.classList.add('capturing-bill'); await new Promise(r => setTimeout(r, 120));
        try {
            if (!sheet.offsetWidth) throw new Error('تعذر تجهيز صفحة الفاتورة للتصوير');
            return await htmlToImage.toPng(sheet, { pixelRatio: 1.2, backgroundColor: '#ffffff', cacheBust: true, filter: n => !(n.classList && n.classList.contains('no-print')) });
        } finally { document.body.classList.remove('capturing-bill'); if (bv) bv.style.cssText = keep[0]; if (pane) pane.style.cssText = keep[1]; }
    }
    NAT.printBill = async function () {
        if (!TP) return;
        let addr = cfg().printer;
        if (!addr) addr = await NAT.printerChoose();
        if (!addr) return;
        const h = Prog.start('الطباعة الحرارية', { text: 'تصوير الفاتورة...' });
        try {
            const png = await captureBill();
            h.set(45, 'الاتصال بالطابعة...');
            try { if (!(await TP.isConnected()).state) await TP.connect({ address: addr }); } catch (e) { await TP.connect({ address: addr }); }
            h.set(70, 'إرسال الفاتورة...');
            await TP.begin();
            await TP.limitWidth({ width: cfg().paper === 80 ? 576 : 384 });
            await TP.align({ alignment: 'center' });
            await TP.image({ image: png });
            await TP.feedCutPaper({ half: false });
            await TP.write();
            h.ok('تمت الطباعة');
        } catch (e) { h.fail('تعذرت الطباعة', String(e && e.message || e)); }
    };

    // ---------- 4) تذكيرات الصلاحية اليومية ----------
    NAT.refreshReminders = async function () {
        if (!LN) return;
        try {
            await LN.cancel({ notifications: [{ id: 7001 }] });
            if (!cfg().remind) return;
            const perm = await LN.checkPermissions();
            if (perm.display !== 'granted') { const q = await LN.requestPermissions(); if (q.display !== 'granted') return; }
            let ex = 0, soon = 0;
            if (typeof products !== 'undefined' && typeof alertKinds === 'function') products.forEach(p => { const k = alertKinds(p); if (k.expired) ex++; else if (k.m1) soon++; });
            const body = ex || soon ? `منتهية: ${ex} — تنتهي خلال شهر: ${soon}` : 'راجع تنبيهات الصلاحية والمخزون.';
            await LN.schedule({ notifications: [{ id: 7001, title: 'صيدلية الديوان — تنبيه الصلاحية', body, schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true } }] });
        } catch (e) { console.warn('reminders', e); }
    };
    NAT.setRemind = async function (on) { setCfg({ remind: !!on }); await NAT.refreshReminders(); return true; };

    // ---------- 5) ماسح الباركود: يبقى ماسح التطبيق المعتاد (فيه مربع اسم المادة ومربع رقم الباركود) ----------

    // ---------- 6) إعدادات التطبيق داخل شاشة الجرد (للمالك) ----------
    function sw(id, on, label) {
        return `<label class="cn-sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
    }
    // صفحة مستقلة ضمن الإعدادات: بطاقة «إعدادات التطبيق» تفتح نافذة بالخيارات
    NAT.openSettings = function (again) {
        const c = cfg();
        Swal.fire({
            title: '📱 إعدادات التطبيق', showConfirmButton: false, showCloseButton: true,
            html: `<div class="sw-form" style="text-align:right">
                ${sw('natBio', c.bio, 'قفل التطبيق بالبصمة أو قفل الشاشة')}
                ${sw('natRem', c.remind, 'تذكير يومي الساعة 9 صباحاً بالمواد المنتهية والقريبة من الانتهاء')}
                <button type="button" class="icon-btn" id="natPrnSet" style="margin-top:10px;width:100%">🖨️ إعدادات الطباعة</button>
                <p style="font-size:.74rem;color:var(--text-sub);margin-top:10px">تُحفظ الملفات تلقائياً في: Documents/${ROOT}</p></div>`,
            didOpen: () => {
                const g = id => document.getElementById(id);
                g('natBio').onchange = async e => { const ok = await NAT.setBio(e.target.checked); if (!ok) e.target.checked = !e.target.checked; };
                g('natRem').onchange = e => NAT.setRemind(e.target.checked);
                g('natPrnSet').onclick = () => NAT.printSettings();
            }
        });
    };
    // كل ما يتعلق بالطباعة في مكان واحد: الورق الافتراضي للطباعة العادية + الطابعة الحرارية
    NAT.printSettings = function () {
        const c = cfg(), ps = c.paperSize || 'A4', ori = c.orient || 'portrait';
        const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
        Swal.fire({
            title: '🖨️ إعدادات الطباعة', showConfirmButton: false, showCloseButton: true,
            html: `<div class="sw-form" style="text-align:right">
                <b style="font-size:.84rem">الطباعة العادية (فواتير، تقارير، وصفات، ملصقات)</b>
                <label>حجم الورق الافتراضي<select id="natPaper">${opt('A4', 'A4', ps)}${opt('A5', 'A5', ps)}${opt('LETTER', 'Letter', ps)}${opt('LEGAL', 'Legal', ps)}</select></label>
                <label>اتجاه الورق<select id="natOri">${opt('portrait', 'عمودي', ori)}${opt('landscape', 'أفقي', ori)}</select></label>
                <b style="font-size:.84rem;margin-top:8px;display:block">الطابعة الحرارية (إيصال البيع)</b>
                ${sw('natP80', c.paper === 80, 'عرض ورق الطابعة 80 ملم (الافتراضي 58 ملم)')}
                <button type="button" class="icon-btn" id="natPrn" style="margin-top:6px;width:100%">🖨️ اختيار الطابعة الحرارية${c.printerName ? ' — ' + escapeHtml(c.printerName) : ''}</button>
                <button type="button" class="icon-btn" id="natBack" style="margin-top:10px;width:100%">← رجوع</button></div>`,
            didOpen: () => {
                const g = id => document.getElementById(id);
                g('natPaper').onchange = e => setCfg({ paperSize: e.target.value });
                g('natOri').onchange = e => setCfg({ orient: e.target.value });
                g('natP80').onchange = e => setCfg({ paper: e.target.checked ? 80 : 58 });
                g('natPrn').onclick = async () => { await NAT.printerChoose(); NAT.printSettings(); };
                g('natBack').onclick = () => NAT.openSettings(true);
            }
        });
    };
    window.natOpenSettings = () => NAT.openSettings();
    if (typeof SH_PAGES !== 'undefined' && !SH_PAGES.some(p => p.id === 'natapp')) {
        SH_PAGES.push({ id: 'natapp', ico: '📱', t: 'إعدادات التطبيق', boxes: [], act: 'natOpenSettings', kw: 'تطبيق اندرويد بصمة قفل طابعة حرارية تذكير صلاحية ورق' });
    }

    // إظهار الحقل الذي يُكتب فيه فوق لوحة المفاتيح
    document.addEventListener('focusin', e => {
        const t = e.target; if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        setTimeout(() => { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (er) { /* تجاهل */ } }, 350);
    });

    // عند الفتح: قفل ثم تحديث التذكير بعد تحميل البيانات
    document.addEventListener('DOMContentLoaded', () => { if (cfg().bio) NAT.lockNow(); });
    if (document.readyState !== 'loading' && cfg().bio) NAT.lockNow();
    setTimeout(() => NAT.refreshReminders(), 15000);
})();
