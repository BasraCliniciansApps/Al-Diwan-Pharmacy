// المزامنة عبر الحاسوب (خيار إضافي بديل مؤقت عن السحابة؛ لا تُمَس السحابة ولا تتغير طريقة عملها عند إيقافه).
// الجوال: يحفظ العملية على الجهاز ويرسل «العملية» (فاتورة، حركة مخزون، وارد) إلى برنامج الحاسوب عبر الشبكة المحلية.
// الحاسوب: يستقبل العمليات، ثم يعرضها للمراجعة، وبعد الموافقة ينسخ احتياطياً ويطبقها على بياناته المحلية.
// عند العودة إلى السحابة: يعيد كل جوال إرسال عملياته (التي سلّمها للحاسوب) إلى السحابة بمفاتيح ثابتة، فلا يتكرر شيء.
(function () {
    'use strict';
    const K = { mode: 'diwanLanMode', hub: 'diwanLanHub', dev: 'diwanLanDev', out: 'diwanLanOut', arch: 'diwanLanArch', done: 'diwanLanApplied' };
    const D = window.diwanDesktop && window.diwanDesktop.lan ? window.diwanDesktop : null;   // الحاسوب فقط
    const ls = {
        get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
        raw(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    };
    const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
    const modeOn = () => ls.raw(K.mode) === 'lan';
    const rnd = () => Math.random().toString(36).slice(2, 8);
    function devId() { let d = ls.raw(K.dev); if (!d) { d = 'd' + Date.now().toString(36) + rnd(); try { localStorage.setItem(K.dev, d); } catch (e) { /* تجاهل */ } } return d; }
    function toast(icon, title) { try { Swal.fire({ icon, title, toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 }); } catch (e) { /* تجاهل */ } }
    function ask(o) { return Swal.fire(Object.assign({ showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء' }, o)); }

    // ======================= الجوال: الاتصال بالحاسوب =======================
    async function http(method, path, body, withToken, tmo) {
        const hub = ls.get(K.hub, null); if (!hub || !hub.ip) throw new Error('لم يُربط الجهاز بالحاسوب');
        const url = 'http://' + hub.ip + ':' + (hub.port || 8765) + path;
        const headers = { 'content-type': 'application/json' }; if (withToken !== false && hub.token) headers['x-diwan-token'] = hub.token;
        const CH = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
        if (CH) {   // داخل التطبيق: طلب أصلي (لا يمنعه قيد المحتوى المختلط بين https وhttp)
            const r = await CH.request({ url, method, headers, data: body, connectTimeout: tmo || 4000, readTimeout: tmo || 15000 });
            let j = r.data; if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { j = {}; } }
            return { s: r.status, j: j || {} };
        }
        const ac = new AbortController(), t = setTimeout(() => ac.abort(), tmo || 8000);
        try { const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ac.signal }); let j = {}; try { j = await r.json(); } catch (e) { /* تجاهل */ } return { s: r.status, j }; }
        finally { clearTimeout(t); }
    }
    function parseAddr(s) { s = String(s || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); const m = s.match(/^([\d.]{7,15})(?::(\d{2,5}))?$/); return m ? { ip: m[1], port: m[2] ? +m[2] : 8765 } : null; }
    async function pair(addr, code) {
        const a = parseAddr(addr); if (!a) throw new Error('عنوان الحاسوب غير صحيح');
        ls.set(K.hub, { ip: a.ip, port: a.port });
        const r = await http('POST', '/v1/pair', { code: String(code || '').trim(), deviceId: devId(), deviceName: (window.userName || (window.userRole === 'owner' ? 'المالك' : 'جهاز')) + ' · ' + (/Android/i.test(navigator.userAgent) ? 'هاتف' : 'متصفح') }, false);
        if (r.s !== 200 || !r.j.token) { ls.set(K.hub, null); throw new Error(r.s === 403 ? 'الرمز غير صحيح أو منتهي' : r.s === 429 ? 'محاولات كثيرة، انتظر دقيقة' : 'تعذر الربط'); }
        ls.set(K.hub, { ip: a.ip, port: a.port, token: r.j.token, prefix: r.j.prefix, name: r.j.hub });
    }

    // ======================= الربط بمسح رمز QR =======================
    function loadScript(src, test) {
        return new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => (test() ? res() : rej(new Error('تعذر تحميل المكتبة'))); s.onerror = () => rej(new Error('تعذر تحميل المكتبة')); document.head.appendChild(s); });
    }
    async function pairQr(p) {
        if (!p || p.t !== 'diwan-lan' || !p.c || !Array.isArray(p.i)) throw new Error('الرمز ليس رمز ربط للحاسوب');
        const prev = ls.get(K.hub, null); let found = '';
        for (const ip of p.i.slice(0, 6)) {
            try { ls.set(K.hub, { ip, port: p.p || 8765 }); const r = await http('GET', '/v1/ping', null, false, 2500); if (r.s === 200 && r.j.app === 'diwan-hub') { found = ip; break; } } catch (e) { /* العنوان التالي */ }
        }
        if (!found) { ls.set(K.hub, prev); throw new Error('تعذر الوصول إلى الحاسوب. تأكد أن الجوال والحاسوب على الشبكة نفسها'); }
        try { await pair(found + ':' + (p.p || 8765), p.c); } catch (e) { ls.set(K.hub, prev); throw e; }
    }
    async function scanUi() {
        try { await loadScript('vendor/jsQR.js', () => !!window.jsQR); } catch (e) { toast('error', e.message); return; }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('error', 'الكاميرا غير متاحة على هذا الجهاز'); return; }
        let stream = null; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر فتح الكاميرا', text: 'اسمح للتطبيق باستخدام الكاميرا ثم أعد المحاولة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const ov = document.createElement('div'); ov.id = 'lanScanOv';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0b1220;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box';
        ov.innerHTML = '<div style="color:#fff;font-weight:800;font-size:1.05rem">ربط بالحاسوب</div><video playsinline muted style="width:100%;max-width:420px;aspect-ratio:1;object-fit:cover;border-radius:18px;border:2px solid #f59e0b"></video><div style="color:#cbd5e1;font-size:.9rem;text-align:center">وجّه الكاميرا نحو الرمز المعروض في برنامج الحاسوب</div><button type="button" id="lanScanX" style="padding:12px 28px;border-radius:12px;border:none;background:#1e293b;color:#fff;font:inherit;font-weight:700">إغلاق</button>';
        document.body.appendChild(ov);
        const v = ov.querySelector('video'); v.srcObject = stream; try { await v.play(); } catch (e) { /* تجاهل */ }
        const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
        let alive = true; const stop = () => { alive = false; try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* تجاهل */ } ov.remove(); };
        ov.querySelector('#lanScanX').onclick = stop;
        const tick = async () => {
            if (!alive) return;
            if (v.videoWidth) {
                const w = Math.min(640, v.videoWidth), hh = Math.round(w * v.videoHeight / v.videoWidth); cv.width = w; cv.height = hh; cx.drawImage(v, 0, 0, w, hh);
                const q = window.jsQR(cx.getImageData(0, 0, w, hh).data, w, hh, { inversionAttempts: 'dontInvert' });
                if (q && q.data) {
                    let p = null; try { p = JSON.parse(q.data); } catch (e) { /* ليس رمزنا */ }
                    if (p && p.t === 'diwan-lan') {
                        stop();
                        const h = Prog.start('الربط بالحاسوب', { text: 'جاري الاتصال...' });
                        try { await pairQr(p); h.ok('تم الربط بالحاسوب'); } catch (e) { h.fail('تعذر الربط', (e && e.message) || ''); }
                        refreshUi(); return;
                    }
                }
            }
            setTimeout(tick, 120);
        };
        tick();
    }

    // ======================= الجوال: إرسال كل بيانات الجهاز دفعة واحدة =======================
    function chunkBy(arr, maxBytes) { const out = []; let cur = [], sz = 0; (arr || []).forEach(x => { const l = JSON.stringify(x).length; if (cur.length && sz + l > maxBytes) { out.push(cur); cur = []; sz = 0; } cur.push(x); sz += l; }); if (cur.length) out.push(cur); return out; }
    async function sendSnapshot() {
        const hub = ls.get(K.hub, null);
        if (!hub || !hub.token) { Swal.fire({ icon: 'info', title: 'اربط الجهاز بالحاسوب أولاً', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const r = await ask({ icon: 'question', title: 'إرسال كل بيانات هذا الجهاز إلى الحاسوب؟', html: 'تُرسل نسخة كاملة (الأصناف والفواتير والوارد والمذاخر والسجل).<br><small>لا يُغيَّر شيء على الحاسوب قبل أن تراجعه هناك وتوافق عليه، وتُحفظ نسخة احتياطية قبل التطبيق.</small>', confirmButtonText: 'إرسال' });
        if (!r.isConfirmed) return;
        const h = Prog.start('تجهيز نسخة الجهاز', { text: 'جمع البيانات...' });
        try {
            const data = buildFullBackup(), sid = 's' + Date.now().toString(36) + rnd(), parts = [];
            ['products', 'purchases', 'suppliers', 'invoices', 'ledger'].forEach(k => chunkBy(data[k], 180000).forEach(c => parts.push({ part: k, items: c })));
            parts.push({ part: 'meta', extras: { invoiceSettings: data.invoiceSettings || null, counts: data.counts || null, exportedAt: data.exportedAt } });
            const now = new Date().toISOString();
            const ops = parts.map((p, i) => ({ id: 'snap:' + sid + ':' + i, type: 'snapshot', ts: now, data: Object.assign({ sid, n: i, total: parts.length }, p) }));
            const arch = archive(); outbox().forEach(o => { if (o.type !== 'snapshot' && !arch.some(x => x.id === o.id)) arch.push(o); });   // العمليات المنتظرة مشمولة بالنسخة، فلا تُرسل ثانية
            ls.set(K.arch, arch); ls.set(K.out, ops);
            h.set(30, 'جاري الإرسال إلى الحاسوب...');
            await flush(true);
            const left = outbox().length;
            if (left) throw new Error('بقي ' + left + ' جزء لم يُرسل');
            h.ok('أُرسلت نسخة الجهاز. راجعها على الحاسوب');
        } catch (e) { h.fail('تعذر الإرسال', (e && e.message) || ''); }
        refreshUi();
    }

    // ======================= الجوال: التقاط العمليات =======================
    const outbox = () => ls.get(K.out, []);
    const archive = () => ls.get(K.arch, []);
    function enqueue(op) { const o = outbox(); if (!o.some(x => x.id === op.id)) o.push(op); ls.set(K.out, o); setTimeout(flush, 50); refreshUi(); }
    function active() { return modeOn() && !D; }
    function snapNum(n) { return parseInt(n) || 0; }

    function captureStock(entries, op) {
        window.__opAlready = false;
        entries = (entries || []).filter(Boolean);
        const list = entries.map(e => {
            const hints = Array.isArray(e.p._badd) && e.p._badd.length ? JSON.parse(JSON.stringify(e.p._badd)) : null;   // قبل أن يستهلكها btPrepare
            return { e, pack: { pid: e.p.id, name: e.p.name, dq: snapNum(e.dq), dl: snapNum(e.dl), hints, expAdd: e.expAdd || [], expRemove: e.expRemove || [], expChanged: !!e.expChanged, cost: e.cost, lastSet: !!e.lastSet, last: e.last, mark: !!e.mark, unmark: !!e.unmark } };
        });
        list.forEach(x => btPrepare(x.e));
        saveLocal();
        try { syncStockLocal(entries.map(e => e.p)); } catch (e) { /* تجاهل */ }
        const key = op && op.key ? op.key : 'k' + Date.now().toString(36) + rnd();
        enqueue({ id: 'stk:' + key, type: 'stock', ts: new Date().toISOString(), data: { op: op ? { key: op.key, kind: op.kind || '', inv: op.inv || '', no: op.no || '' } : null, entries: list.map(x => x.pack) } });
        return Promise.resolve(true);
    }
    function recStamp(r) { return String(r.editedAt || r.cancelledAt || r.issuedTs || r.createdTs || r.date || ''); }
    function captureRecord(type, rec) {
        const hub = ls.get(K.hub, {});
        const data = JSON.parse(JSON.stringify(rec)); data.__pre = hub.prefix || '';
        enqueue({ id: (type === 'invoice' ? 'inv:' : 'pur:') + rec.id + ':' + recStamp(rec).replace(/[^\w]/g, '').slice(-14), type, ts: new Date().toISOString(), data: { rec: data } });
    }

    let flushing = false, lastErr = '', lastOkAt = 0;
    async function flush(manual) {
        if (D || flushing) return 0;
        const hub = ls.get(K.hub, null); const out = outbox();
        if (!hub || !hub.token || !out.length) return 0;
        flushing = true; let sent = 0;
        try {
            const batches = []; let cur = [], sz = 0;
            out.forEach(o => { const l = JSON.stringify(o).length; if (cur.length && (cur.length >= 50 || sz + l > 3 * 1024 * 1024)) { batches.push(cur); cur = []; sz = 0; } cur.push(o); sz += l; });
            if (cur.length) batches.push(cur);
            for (const part of batches) {
                const r = await http('POST', '/v1/ops', { ops: part });
                if (r.s !== 200) throw new Error(r.s === 401 ? 'انتهى الربط، أعد الربط بالحاسوب' : 'رفض الحاسوب الإرسال');
                const ok = new Set([].concat(r.j.stored || [], r.j.dup || []));
                const bad = new Set(r.j.invalid || []);
                const arch = archive(); part.forEach(o => { if (ok.has(o.id) && o.type !== 'snapshot' && !arch.some(x => x.id === o.id)) arch.push(o); });
                ls.set(K.arch, arch.slice(-5000));
                ls.set(K.out, outbox().filter(o => !ok.has(o.id) && !bad.has(o.id)));
                sent += ok.size;
            }
            lastErr = ''; lastOkAt = Date.now();
        } catch (e) { lastErr = (e && e.message) || 'تعذر الاتصال بالحاسوب'; if (manual) throw e; }
        finally { flushing = false; refreshUi(); try { syncRefresh(); } catch (e) { /* تجاهل */ } }
        return sent;
    }
    setInterval(() => { if (active()) flush(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && active()) flush(); });

    // ======================= التبديل بين الطريقتين =======================
    async function switchToLan() {
        if (D) {
            const r = await ask({ icon: 'question', title: 'تفعيل المزامنة عبر الحاسوب؟', html: 'سيستقبل هذا البرنامج عمليات الهواتف على الشبكة المحلية، ويُوقَف الاتصال بالسحابة مؤقتاً.<br><small>قد يطلب ويندوز السماح للبرنامج بالشبكة الخاصة، اضغط «السماح».</small>' });
            if (!r.isConfirmed) return false;
            const info = await D.lan.enable(true); if (!info.on) { Swal.fire({ icon: 'error', title: 'تعذر تشغيل الخادم', text: info.error || '', confirmButtonColor: '#0f1c38' }); return false; }
            try { localStorage.setItem(K.mode, 'lan'); } catch (e) { /* تجاهل */ }
            await usagePause('lan'); await D.lan.newCode(); return true;
        }
        const hub = ls.get(K.hub, null);
        if (!hub || !hub.token) { Swal.fire({ icon: 'info', title: 'اربط الجهاز بالحاسوب أولاً', text: 'اضغط «ربط بالحاسوب»، وأدخل العنوان والرمز الظاهرين في برنامج الحاسوب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return false; }
        const r = await ask({ icon: 'question', title: 'تفعيل المزامنة عبر الحاسوب؟', html: 'ستُوقَف المزامنة مع السحابة مؤقتاً، وتُرسل العمليات إلى الحاسوب على الشبكة المحلية.<br><small>تبقى البيانات محفوظة على هذا الجهاز، وعند العودة إلى السحابة تُرسل العمليات إليها تلقائياً.</small>' });
        if (!r.isConfirmed) return false;
        try { localStorage.setItem(K.mode, 'lan'); } catch (e) { /* تجاهل */ }
        await usagePause('lan'); flush(); return true;
    }
    async function switchToCloud() {
        const out = outbox(), arch = archive();
        const r = await ask({ icon: 'question', title: 'العودة إلى السحابة؟', html: 'ستُستأنف المزامنة مع السحابة.' + (D ? '<br>يتوقف استقبال العمليات من الهواتف.' + ' <br><small>طبّق العمليات المنتظرة قبل العودة، فالبيانات الجديدة تُقرأ من السحابة.</small>' : (arch.length + out.length ? '<br>ستُرسل ' + (arch.length + out.length) + ' عملية من هذا الجهاز إلى السحابة بدون تكرار.' : '')) });
        if (!r.isConfirmed) return false;
        try { localStorage.setItem(K.mode, 'cloud'); } catch (e) { /* تجاهل */ }
        if (D) { await D.lan.enable(false); await usageResume(); refreshUi(); return true; }
        await usageResume();
        await replay();
        return true;
    }
    async function replay() {
        const seen = new Set(), ops = archive().concat(outbox()).filter(o => o && o.id && !seen.has(o.id) && seen.add(o.id));
        if (!ops.length) return;
        const h = Prog.start('إرسال العمليات إلى السحابة', { text: 'جاري الإرسال...' });
        let done = 0;
        try {
            for (let i = 0; i < ops.length; i++) {
                await replayOne(ops[i]); done++;
                h.set(Math.round(done / ops.length * 100), 'أُرسلت ' + done + ' من ' + ops.length);
            }
            ls.set(K.arch, []); ls.set(K.out, []);
            h.ok('أُرسلت ' + done + ' عملية إلى السحابة');
        } catch (e) {
            const rest = ops.slice(done); ls.set(K.arch, []); ls.set(K.out, rest);   // ما لم يُرسل يبقى محفوظاً ويُعاد لاحقاً
            h.fail('تعذر إرسال بعض العمليات', (e && e.message) || '');
        }
        refreshUi();
    }
    async function replayOne(o) {
        if (o.type === 'stock') {
            const entries = (o.data.entries || []).map(en => { const p = products.find(x => String(x.id) === String(en.pid)); return p ? { p, dq: en.dq, dl: en.dl, cost: en.cost, lastSet: en.lastSet, last: en.last, mark: en.mark, unmark: en.unmark, expAdd: en.expAdd, expRemove: en.expRemove, expChanged: en.expChanged } : null; }).filter(Boolean);
            if (!entries.length) return;
            const ok = await saveProductsDelta(entries, o.data.op && o.data.op.key ? o.data.op : null);
            if (window.__opAlready) { entries.forEach(e => { e.p.qty = snapNum(e.p.qty) + e.dq; e.p.loose = snapNum(e.p.loose) + e.dl; }); saveLocal(); }   // العملية مسجلة سابقاً: لا نمس الأعداد المحلية
            if (!ok) throw new Error('تعذر حفظ حركة المخزون');
        } else if (o.type === 'invoice') {
            if (cloudReady()) await fsSet(db.collection('pharmacy_invoices').doc(o.data.rec.id), stripPre(o.data.rec));
        } else if (o.type === 'purchase') {
            if (cloudReady()) await fsSet(db.collection('pharmacy_purchases').doc(o.data.rec.id), stripPre(o.data.rec));
        }
    }
    function stripPre(r) { const c = JSON.parse(JSON.stringify(r)); delete c.__pre; return c; }

    // ======================= الحاسوب: التطبيق المحلي للعمليات =======================
    function applyStockOp(d, rep) {
        (d.entries || []).forEach(en => {
            const p = (typeof products !== 'undefined' ? products : []).find(x => String(x.id) === String(en.pid));
            if (!p) { rep.skipped.push(en.name || en.pid); return; }
            const sc = btSc(p), cur = snapNum(p.qty) * sc + (sc > 1 ? snapNum(p.loose) : 0);
            const nt = Math.max(0, cur + snapNum(en.dq) * sc + (sc > 1 ? snapNum(en.dl) : 0));
            p.qty = Math.floor(nt / sc); p.loose = sc > 1 ? nt % sc : 0;
            if (en.hints) p._badd = en.hints;
            btPrepare({ p, expAdd: en.expAdd || [], expRemove: en.expRemove || [], expChanged: !!en.expChanged });
            if (en.cost !== undefined && en.cost !== null && !isNaN(parseFloat(en.cost))) p.costPrice = en.cost;
            if (en.lastSet) p.lastPurchase = en.last;
            if (en.mark) p.counted = true; if (en.unmark) p.counted = false;
            try { syncStockLocal([p]); } catch (e) { /* تجاهل */ }
            rep.touched.add(p.id);
        });
        rep.stock++;
    }
    function applyRecordOp(type, rec0, rep) {
        const rec = stripPre(rec0), pre = rec0.__pre || '';
        const KEY = type === 'invoice' ? BILL_LS.list : PU_LS.list;
        let list = []; try { list = JSON.parse(lsGet(KEY)) || []; } catch (e) { list = []; }
        const old = list.find(x => x.id === rec.id);
        if (old && recStamp(old) >= recStamp(rec) && !(rec.cancelled && !old.cancelled)) { rep.stale++; return; }
        if (type === 'invoice' && rec.issued && !rec.cancelled && rec.no && list.some(x => x.id !== rec.id && x.issued && !x.cancelled && String(x.no) === String(rec.no))) {
            rec.no = rec.no + '-' + (pre || 'X'); rec.renumbered = true; rep.renum++;   // رقم مكرر من جهاز آخر: يُميَّز بحرف الجهاز
        }
        list = list.filter(x => x.id !== rec.id); list.unshift(rec);
        lsSet(KEY, JSON.stringify(list.slice(0, type === 'invoice' ? 300 : 1500)));
        try { if (type === 'invoice') { billAll = billAll.filter(x => x.id !== rec.id); billAll.unshift(rec); } else { puAll = puAll.filter(x => x.id !== rec.id); puAll.unshift(rec); } } catch (e) { /* تجاهل */ }
        rep[type === 'invoice' ? 'inv' : 'pur']++;
    }
    function stable(o) { if (o === null || typeof o !== 'object') return JSON.stringify(o); if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'; return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'; }
    function snapGroups(list) {
        const g = {};
        list.filter(o => o.type === 'snapshot').forEach(o => { const k = o.dev + ':' + o.data.sid; const x = g[k] || (g[k] = { dev: o.dev, devName: o.devName, sid: o.data.sid, total: o.data.total, parts: [], minSeq: Infinity }); x.parts.push(o); x.minSeq = Math.min(x.minSeq, o.seq); });
        return Object.values(g);
    }
    function snapDiff(g) {
        const data = { products: [], purchases: [], suppliers: [], invoices: [], ledger: [], version: 2, full: true };
        g.parts.sort((a, b) => a.data.n - b.data.n).forEach(o => { if (o.data.part === 'meta') data.invoiceSettings = o.data.extras && o.data.extras.invoiceSettings; else if (data[o.data.part]) data[o.data.part] = data[o.data.part].concat(o.data.items || []); });
        const pcMap = new Map(products.map(p => [String(p.id), p])); const padd = [], pupd = []; let psame = 0;
        data.products.forEach(sp => { const ex = pcMap.get(String(sp.id)); if (!ex) padd.push(sp); else if (stable(ex) !== stable(sp)) pupd.push(sp); else psame++; });
        return { data, plan: bkPlan(data), padd, pupd, psame };
    }
    async function applySnapshot(g, fresh) {
        const d = snapDiff(g);
        const rows = [['الأصناف', d.padd.length, d.pupd.length, d.psame]].concat(d.plan.filter(p => p.total).map(p => [p.c.label, p.add.length, p.upd.length, p.keep]));
        const html = '<div style="text-align:right;font-size:.85rem;margin-bottom:6px">من «' + esc(g.devName) + '»</div>' + rows.map(r => '<div style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right"><b>' + esc(r[0]) + '</b>: ' + r[1] + ' جديد · ' + r[2] + ' مختلف/أحدث · ' + r[3] + ' كما هو</div>').join('') + '<div style="margin-top:10px;font-size:.8rem;color:#475569;text-align:right">الأصناف المختلفة تُستبدل بنسخة الجوال. الفواتير والوارد والسجل لا يُستبدل منها سجل أحدث على الحاسوب. تُحفظ نسخة احتياطية قبل التطبيق.</div>';
        const r = await Swal.fire({ icon: 'question', title: 'نسخة كاملة من الجوال', html, showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'لاحقاً', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return null;
        const h = Prog.start('تطبيق نسخة الجوال', { text: 'نسخة احتياطية قبل التطبيق...' });
        try {
            const b = await D.writeBackup(JSON.stringify(buildFullBackup()));
            if (!b || !b.ok) throw new Error('تعذر حفظ النسخة الاحتياطية، لم يُطبَّق شيء');
            h.set(40, 'تطبيق الأصناف...');
            const map = new Map(products.map(p => [String(p.id), p])), touched = [];
            d.padd.concat(d.pupd).forEach(sp => { const ex = map.get(String(sp.id)); if (ex) { Object.keys(ex).forEach(k => delete ex[k]); Object.assign(ex, sp); touched.push(ex); } else { products.push(sp); touched.push(sp); } });
            try { syncStockLocal(touched); } catch (e) { /* تجاهل */ }
            saveLocal();
            h.set(70, 'تطبيق الفواتير والوارد...');
            const oc = window.cloudReady; window.cloudReady = () => false;   // الحاسوب لا يكتب إلى السحابة
            try { await bkApplyPlan(d.plan); } finally { window.cloudReady = oc; }
            bkApplyExtras(d.data);
            const cover = fresh.filter(o => o.type !== 'snapshot' && o.dev === g.dev && o.seq < g.minSeq).map(o => o.id);   // عمليات أقدم من النسخة: مشمولة بها
            const done = ls.get(K.done, []); g.parts.forEach(o => done.push(o.id)); cover.forEach(id => done.push(id)); ls.set(K.done, done.slice(-20000));
            await D.lan.mark(g.parts.map(o => o.id).concat(cover), 'applied');
            try { renderAll(); } catch (e) { /* تجاهل */ }
            h.ok('طُبِّقت نسخة الجوال');
            return new Set(cover);
        } catch (e) { h.fail('تعذر التطبيق', (e && e.message) || ''); return null; }
    }
    async function review() {
        if (!D) return;
        const all = await D.lan.pending();
        if (!all.length) { toast('info', 'لا توجد عمليات بانتظار المراجعة'); return; }
        const done = new Set(ls.get(K.done, []));
        let fresh = all.filter(o => !done.has(o.id)); const already = all.filter(o => done.has(o.id));
        if (already.length) await D.lan.mark(already.map(o => o.id), 'applied');   // طُبِّقت سابقاً قبل انقطاع: لا تُطبَّق مرتين
        const snaps = snapGroups(fresh).filter(g => g.parts.length >= g.total).sort((a, b) => a.minSeq - b.minSeq);
        const partial = snapGroups(fresh).filter(g => g.parts.length < g.total);
        if (snaps.length) {
            const g = snaps[snaps.length - 1];   // الأحدث لكل جهاز؛ الأقدم مشمول به
            const older = snaps.filter(x => x !== g && x.dev === g.dev);
            const cov = await applySnapshot(g, fresh);
            if (cov) { await D.lan.mark(older.flatMap(x => x.parts.map(o => o.id)), 'applied'); const gone = new Set([...cov, ...g.parts.map(o => o.id), ...older.flatMap(x => x.parts.map(o => o.id))]); fresh = fresh.filter(o => !gone.has(o.id)); }
            else return;
        }
        fresh = fresh.filter(o => o.type !== 'snapshot' && !partial.some(g => g.dev === o.dev && g.sid === (o.data && o.data.sid)));
        if (partial.length && !fresh.length) { toast('info', 'نسخة الجوال لم تكتمل بعد، أعد الإرسال'); return; }
        if (!fresh.length) { refreshUi(); return; }
        const by = {}; fresh.forEach(o => { const g = by[o.devName] || (by[o.devName] = { inv: 0, stk: 0, pur: 0, tot: 0 }); if (o.type === 'invoice') { g.inv++; if (!o.data.rec.cancelled) g.tot += (typeof invTotalOf === 'function' ? invTotalOf(o.data.rec) : 0); } else if (o.type === 'stock') g.stk++; else g.pur++; });
        const html = Object.keys(by).map(n => { const g = by[n]; return '<div style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right"><b>' + esc(n) + '</b><br><small>' + g.inv + ' فاتورة (' + fmtNum(g.tot) + ' د.ع) · ' + g.stk + ' حركة مخزون · ' + g.pur + ' وارد</small></div>'; }).join('');
        const r = await Swal.fire({ icon: 'question', title: 'عمليات واردة من الهواتف', html: html + '<div style="margin-top:10px;font-size:.82rem;color:#475569">تُحفظ نسخة احتياطية على القرص قبل التطبيق.</div>', showCancelButton: true, showDenyButton: true, confirmButtonText: 'تطبيق (' + fresh.length + ')', denyButtonText: 'رفض', cancelButtonText: 'لاحقاً', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c' });
        if (r.isDenied) {
            const c = await ask({ icon: 'warning', title: 'رفض هذه العمليات؟', text: 'لن تُطبَّق على بيانات الحاسوب.', confirmButtonText: 'رفض', confirmButtonColor: '#b91c1c' });
            if (c.isConfirmed) { await D.lan.mark(fresh.map(o => o.id), 'rejected'); refreshUi(); } return;
        }
        if (!r.isConfirmed) return;
        const h = Prog.start('تطبيق عمليات الهواتف', { text: 'نسخة احتياطية قبل التطبيق...' });
        const rep = { stock: 0, inv: 0, pur: 0, stale: 0, renum: 0, skipped: [], touched: new Set() };
        try {
            const b = await D.writeBackup(JSON.stringify(buildFullBackup()));
            if (!b || !b.ok) throw new Error('تعذر حفظ النسخة الاحتياطية، لم يُطبَّق شيء');
            const doneIds = ls.get(K.done, []);
            for (let i = 0; i < fresh.length; i++) {
                const o = fresh[i];
                if (o.type === 'stock') applyStockOp(o.data, rep); else applyRecordOp(o.type, o.data.rec, rep);
                saveLocal(); doneIds.push(o.id); ls.set(K.done, doneIds.slice(-20000));
                h.set(Math.round((i + 1) / fresh.length * 100), 'طُبِّقت ' + (i + 1) + ' من ' + fresh.length);
            }
            await D.lan.mark(fresh.map(o => o.id), 'applied');
            try { renderAll(); } catch (e) { /* تجاهل */ }
            h.ok('طُبِّقت ' + fresh.length + ' عملية');
            if (rep.skipped.length || rep.renum || rep.stale) Swal.fire({ icon: 'info', title: 'ملاحظات التطبيق', html: (rep.renum ? rep.renum + ' فاتورة بُدّل رقمها لتكرار الرقم<br>' : '') + (rep.stale ? rep.stale + ' سجل أقدم من الموجود فتُخطّي<br>' : '') + (rep.skipped.length ? 'مواد غير موجودة على الحاسوب: ' + esc(rep.skipped.slice(0, 8).join('، ')) : ''), confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        } catch (e) { h.fail('تعذر التطبيق', (e && e.message) || ''); }
        refreshUi();
    }

    // ======================= الواجهة (الإعدادات) =======================
    async function refreshUi() {
        const host = document.getElementById('lanHost'); if (!host) return;
        const on = modeOn(), sw = (id, chk, fn) => '<label class="setup-sw"><input type="checkbox" id="' + id + '" ' + (chk ? 'checked' : '') + ' onchange="' + fn + '"><i></i></label>';
        let body = '';
        if (D) {
            const info = await D.lan.info().catch(() => ({ on: false }));
            body = '<div class="qk-row"><div><b>المزامنة عبر الحاسوب</b><small>تُوقَف السحابة مؤقتاً، ويستقبل هذا البرنامج عمليات الهواتف.</small></div>' + sw('lanSw', on, 'LAN.toggle(this)') + '</div>';
            if (info.on) {
                const ip = (info.ips || [])[0] || '—';
                if (!info.code && !window.__lanAuto) { window.__lanAuto = 1; D.lan.newCode().then(() => { window.__lanAuto = 0; refreshUi(); }); }
                let qr = '';
                if (info.code) { try { await loadScript('vendor/qrcode.js', () => !!window.qrcode); const q = window.qrcode(0, 'M'); q.addData(JSON.stringify({ t: 'diwan-lan', p: info.port, i: info.ips || [], c: info.code })); q.make(); qr = '<div style="display:flex;justify-content:center;padding:10px 0"><div style="background:#fff;padding:10px;border-radius:12px;width:210px;height:210px;box-sizing:border-box;border:1px solid #e5e7eb">' + q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) + '</div></div><div class="ds-bk-s" style="text-align:center">امسح الرمز بكاميرا التطبيق: الإعدادات ← المزامنة عبر الحاسوب ← ربط بمسح QR</div>'; } catch (e) { qr = ''; } }
                body += '<div class="ds-bk"><div class="ds-bk-t">بيانات الربط للهواتف</div>' + qr +
                    '<div class="ds-bk-p" dir="ltr">' + esc(ip + ':' + info.port) + '</div>' +
                    '<div class="ds-bk-s">الرمز: <b dir="ltr" style="letter-spacing:3px">' + esc(info.code || '——') + '</b>' + (info.code ? '' : ' (منتهٍ)') + '</div>' +
                    '<div class="ds-bk-b"><button type="button" onclick="LAN.newCode()">رمز جديد</button><button type="button" onclick="LAN.review()">مراجعة العمليات (' + (info.pending || 0) + ')</button></div>' +
                    ((info.devices || []).length ? '<div class="ds-bk-s" style="margin-top:8px">الأجهزة المرتبطة: ' + info.devices.map(d => esc(d.name) + ' (' + esc(d.prefix) + ')').join('، ') + '</div>' : '') + '</div>';
            }
        } else {
            const hub = ls.get(K.hub, null), out = outbox().length, arch = archive().length;
            body = '<div class="qk-row"><div><b>المزامنة عبر الحاسوب</b><small>' + (hub && hub.token ? 'مرتبط بالحاسوب ' + esc(hub.ip) : 'غير مرتبط بالحاسوب') + '</small></div>' + sw('lanSw', on, 'LAN.toggle(this)') + '</div>' +
                '<div class="ds-bk"><div class="ds-bk-s' + (lastErr ? ' bad' : '') + '">' + (lastErr ? 'تعذر الاتصال: ' + esc(lastErr) : (on ? 'بانتظار الإرسال: ' + out + ' · سُلِّمت للحاسوب: ' + arch : 'السحابة هي الطريقة المفعّلة')) + '</div>' +
                '<div class="ds-bk-b"><button type="button" onclick="LAN.scanUi()">ربط بمسح QR</button><button type="button" onclick="LAN.pairUi()">ربط يدوي</button>' + (on ? '<button type="button" onclick="LAN.sendNow()">إرسال الآن</button><button type="button" onclick="LAN.sendSnapshot()">إرسال كل بيانات الجهاز</button>' : '') + (!on && out + arch ? '<button type="button" onclick="LAN.replay()">إرسال العمليات المحفوظة إلى السحابة (' + (out + arch) + ')</button>' : '') + '</div></div>';
        }
        host.innerHTML = body;
    }
    async function toggle(cb) {
        const want = cb.checked;
        const ok = want ? await switchToLan() : await switchToCloud();
        if (!ok) cb.checked = !want;
        try { syncRefresh(); } catch (e) { /* تجاهل */ }
        refreshUi();
    }
    async function pairUi() {
        const hub = ls.get(K.hub, {});
        const r = await Swal.fire({ title: 'ربط بالحاسوب', html: '<div style="text-align:right;font-size:.85rem;margin-bottom:6px">افتح «المزامنة عبر الحاسوب» في إعدادات برنامج الحاسوب، وأدخل العنوان والرمز الظاهرين فيه.</div><input id="lanAddr" class="swal2-input" dir="ltr" placeholder="192.168.1.5:8765" value="' + esc(hub.ip ? hub.ip + ':' + (hub.port || 8765) : '') + '"><input id="lanCode" class="swal2-input" dir="ltr" inputmode="numeric" maxlength="6" placeholder="000000">', showCancelButton: true, confirmButtonText: 'ربط', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', focusConfirm: false, preConfirm: () => ({ a: document.getElementById('lanAddr').value, c: document.getElementById('lanCode').value }) });
        if (!r.isConfirmed) return;
        const h = Prog.start('الربط بالحاسوب', { text: 'جاري الاتصال...' });
        try { await pair(r.value.a, r.value.c); h.ok('تم الربط بالحاسوب'); } catch (e) { h.fail('تعذر الربط', (e && e.message) || ''); }
        refreshUi();
    }
    async function sendNow() {
        const h = Prog.start('الإرسال إلى الحاسوب', { text: 'جاري الإرسال...' });
        try { const n = await flush(true); h.ok(n ? 'سُلِّمت ' + n + ' عملية للحاسوب' : 'لا توجد عمليات بانتظار الإرسال'); } catch (e) { h.fail('تعذر الإرسال', (e && e.message) || ''); }
    }
    async function newCode() { if (D) { await D.lan.newCode(); refreshUi(); } }

    window.LAN = { scanUi, pairQr, sendSnapshot, active, mode: () => (modeOn() ? 'lan' : 'cloud'), captureStock, captureRecord, toggle, pairUi, sendNow, newCode, review, flush, replay, refreshUi, pair, _ls: ls, K };
    if (D) D.lan.onChange(() => { refreshUi(); });
    window.addEventListener('load', () => { refreshUi(); if (D && modeOn()) D.lan.enable(true).catch(() => { /* تجاهل */ }); setInterval(refreshUi, 30000); });
})();
