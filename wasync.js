// =====================================================================
// المبيعات عبر واتساب: مستخدم بلا سحابة ولا حاسوب يرسل مبيعاته كملف إلى المدير، والمدير يستورده فتتحدّث الأرصدة والفواتير.
// المبدأ: ننقل «حركات» (ما بيع وما أُلغي) لا أرصدة، فتجتمع مبيعات المدير والمستخدم ولا تُلغي إحداهما الأخرى.
//   • كل حركة لها معرّف فريد، فاستيراد الملف مرتين لا يكرّر شيئاً.
//   • الملف موقَّع (HMAC-SHA256) بمفتاح خاص بكل جهاز مستخدم يمنحه المدير، فلا يُقبل ملف معدَّل أو من جهاز غير مسجَّل.
//   • المستخدم لا يرسل إلا البيع والإلغاء والتعديل والمرتجع، ولا يرسل أسعار الشراء.
//   • «لقطة المخزون» من المدير للمستخدم: أرصدة وأسعار حديثة، وتُعاد فوقها مبيعات المستخدم التي لم يؤكدها المدير.
// =====================================================================
(function () {
    'use strict';
    const L = window.LAN; if (!L || !L._i) return;
    const I = L._i, ls = L._ls;
    const K = { mode: 'diwanWaMode', link: 'diwanWaLink', ops: 'diwanWaOps', exp: 'diwanWaExp', seen: 'diwanWaSeen', devs: 'diwanWaDevices', imp: 'diwanWaImp', cnt: 'diwanWaCnt', log: 'diwanWaLog', snapAt: 'diwanWaSnapAt', dev: 'diwanWaDev' };
    const STAFF_KINDS = ['sale', 'cancel', 'edit', 'ret'];
    const SNAP_ST = ['qty', 'loose', 'counted', 'bt', 'expiryDate', 'expiryDates'];
    const OPS_KEEP_DAYS = 75, MAX_FILE = 12 * 1024 * 1024;
    const nowIso = () => new Date().toISOString();
    const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
    const num = n => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
    const iso = n => parseInt(n) || 0;
    const isOwner = () => typeof userRole !== 'undefined' && userRole === 'owner';
    const waOn = () => ls.raw(K.mode) === '1';
    const toast = (icon, title) => { try { Swal.fire({ icon, title, toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 }); } catch (e) { /* تجاهل */ } };
    const ago = t => { try { return typeof syncAgo === 'function' ? syncAgo(t) : String(t).slice(0, 16).replace('T', ' '); } catch (e) { return ''; } };

    // ---------------- التشفير: SHA-256 و HMAC بدون اعتماد على المتصفح ----------------
    const KC = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
    function sha256(msg) {
        const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
        const l = msg.length, tot = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(tot); b.set(msg); b[l] = 0x80;
        const dv = new DataView(b.buffer); dv.setUint32(tot - 4, (l * 8) >>> 0); dv.setUint32(tot - 8, Math.floor(l * 8 / 4294967296));
        const w = new Uint32Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
        for (let o = 0; o < tot; o += 64) {
            for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
            for (let i = 16; i < 64; i++) { const a = w[i - 15], c = w[i - 2]; w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(c, 17) ^ rot(c, 19) ^ (c >>> 10))) >>> 0; }
            let [a, b2, c, d, e, f, g, h] = H;
            for (let i = 0; i < 64; i++) {
                const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + KC[i] + w[i]) >>> 0, t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) >>> 0;
                h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
            }
            H[0] += a; H[1] += b2; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
        }
        const out = new Uint8Array(32); const ov = new DataView(out.buffer); for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]); return out;
    }
    const te = new TextEncoder();
    const hex = u => Array.prototype.map.call(u, x => x.toString(16).padStart(2, '0')).join('');
    function hmacHex(key, msg) {
        let k = te.encode(key); if (k.length > 64) k = sha256(k);
        const ip = new Uint8Array(64), op = new Uint8Array(64); ip.fill(0x36); op.fill(0x5c); for (let i = 0; i < k.length; i++) { ip[i] ^= k[i]; op[i] ^= k[i]; }
        const m = te.encode(msg), a = new Uint8Array(64 + m.length); a.set(ip); a.set(m, 64);
        const inner = sha256(a), b = new Uint8Array(96); b.set(op); b.set(inner, 64); return hex(sha256(b));
    }
    function rid(n) { const al = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; const a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); } for (let i = 0; i < n; i++) s += al[a[i] % al.length]; return s; }
    const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const b64d = s => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))));
    const sign = (secret, o) => { const c = Object.assign({}, o); delete c.sig; return hmacHex(secret, I.stable(c)); };

    // ---------------- أدوات عامة ----------------
    const devId = () => { let d = ls.raw(K.dev); if (!d) { d = 'w' + Date.now().toString(36) + rid(4).toLowerCase(); try { localStorage.setItem(K.dev, d); } catch (e) { /* تجاهل */ } } return d; };
    const safeId = s => typeof s === 'string' && /^[\w\-:.#]{2,120}$/.test(s);
    function stripCost(o) {   // سعر الشراء لا يغادر جهاز المستخدم
        if (Array.isArray(o)) return o.map(stripCost);
        if (o && typeof o === 'object') { const r = {}; Object.keys(o).forEach(k => { if (k === 'cost' || k === 'costPrice' || k === 'lastPurchase' || k === 'profit') return; r[k] = stripCost(o[k]); }); return r; }
        return o;
    }
    function opKind(o) { return o && o.data && o.data.op ? o.data.op.kind : ''; }
    const allowedOp = o => !!o && safeId(o.id) && (o.type === 'invoice' ? !!(o.data && o.data.rec && safeId(String(o.data.rec.id))) : (o.type === 'stock' && STAFF_KINDS.indexOf(opKind(o)) >= 0 && !!(o.data && Array.isArray(o.data.entries))));
    const groupKey = o => o.type === 'invoice' ? String(o.data.rec.id) : String((o.data.op && o.data.op.inv) || o.id);
    function shareText(name, text, title) { return shareBlob(new Blob([text], { type: 'text/plain' }), name, title); }
    async function shareBlob(blob, name, title) {   // يرجع 'shared' | 'saved' | 'downloaded' | 'cancelled' | 'blocked'
        try { if (window.NAT && NAT.is && NAT.shareFile) { const r = await NAT.shareFile(blob, name, title); if (r) return r; } } catch (e) { /* ننتقل للطريقة التالية */ }
        try {
            const file = new File([blob], name, { type: 'text/plain' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: title || name }); return 'shared'; }
        } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; if (e && e.name === 'NotAllowedError') return 'blocked'; }
        if (typeof dlTry === 'function') return await dlTry(blob, name, 'text/plain');
        return 'blocked';
    }
    function pickFile() {
        return new Promise(res => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.txt,application/json,text/plain,*/*'; inp.style.display = 'none';
            let done = false; const fin = v => { if (done) return; done = true; try { inp.remove(); } catch (e) { /* تجاهل */ } res(v); };
            inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return fin(null); if (f.size > MAX_FILE) { Swal.fire({ icon: 'error', title: 'الملف كبير جداً', text: 'الحد الأقصى ' + Math.round(MAX_FILE / 1048576) + ' م.ب.', confirmButtonColor: '#0f1c38' }); return fin(null); } const r = new FileReader(); r.onload = () => fin({ name: f.name, text: String(r.result || '') }); r.onerror = () => fin(null); r.readAsText(f); };
            window.addEventListener('focus', () => setTimeout(() => { if (!inp.files || !inp.files.length) fin(null); }, 1500), { once: true });
            document.body.appendChild(inp); inp.click();
        });
    }

    // ---------------- جهاز المستخدم: سجل الحركات ----------------
    const ops = () => ls.get(K.ops, []);
    const expMap = () => ls.get(K.exp, {});
    const seenSet = () => new Set(ls.get(K.seen, []));
    function add(op) {
        if (!op || !op.id) return;
        const all = ops(); if (all.some(x => x.id === op.id)) return;
        const lim = Date.now() - OPS_KEEP_DAYS * 86400000, e = expMap(), s = seenSet();
        const keep = all.filter(x => !(s.has(x.id) && Date.parse(x.ts) < lim));   // ما أكّده المدير وقدُم يُحذف
        keep.push(op); ls.set(K.ops, keep);
        const em = {}; keep.forEach(x => { if (e[x.id]) em[x.id] = e[x.id]; }); ls.set(K.exp, em);
        refresh(); try { syncRefresh(); } catch (x) { /* تجاهل */ }
    }
    const unsent = () => { const e = expMap(), s = seenSet(); return ops().filter(o => allowedOp(o) && !e[o.id] && !s.has(o.id)); };
    const unconfirmed = () => { const s = seenSet(); return ops().filter(o => allowedOp(o) && !s.has(o.id)); };
    const groups = list => { const g = new Set(); list.forEach(o => g.add(groupKey(o))); return g.size; };
    function pendingCount() { return groups(unsent()); }
    function opsBlocked() { return ops().filter(o => !allowedOp(o)).length; }
    function summarize(list) {   // ملخص عمليات: عدد الفواتير ومبلغها
        const last = {}; list.filter(o => o.type === 'invoice').forEach(o => { const id = String(o.data.rec.id); if (!last[id] || last[id].ts < o.ts) last[id] = o; });
        let n = 0, canc = 0, tot = 0;
        Object.keys(last).forEach(id => { const r = last[id].data.rec; if (r.cancelled) canc++; else if (r.issued) { n++; try { tot += invTotalOf(r); } catch (e) { tot += parseFloat(r.total) || 0; } } });
        return { n, canc, tot, ops: list.length };
    }
    function link() { return ls.get(K.link, null); }
    function parseCode(s) {
        s = String(s || '').trim().replace(/\s+/g, ''); if (s.slice(0, 5).toUpperCase() !== 'DWA1-') return null;
        try { const o = JSON.parse(b64d(s.slice(5))); if (o && safeId(o.k) && typeof o.s === 'string' && o.s.length >= 12) return { k: o.k, s: o.s, n: String(o.n || '').slice(0, 60) }; } catch (e) { /* رمز تالف */ }
        return null;
    }
    const codeOf = d => 'DWA1-' + b64e(JSON.stringify({ k: d.kid, s: d.secret, n: d.label }));

    async function setLink() {
        const r = await Swal.fire({ title: 'ربط بالمدير', html: '<div style="text-align:right;font-size:.85rem;margin-bottom:8px">الصق رمز الربط الذي أرسله لك المدير (يبدأ بـ DWA1).</div><textarea id="waCodeIn" class="swal2-textarea" dir="ltr" style="height:90px;font-size:.8rem" placeholder="DWA1-..."></textarea>', showCancelButton: true, confirmButtonText: 'ربط', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => { const c = parseCode(document.getElementById('waCodeIn').value); if (!c) { Swal.showValidationMessage('الرمز غير صحيح. انسخه كاملاً كما وصلك.'); return false; } return c; } });
        if (!r.isConfirmed || !r.value) return;
        const old = link();
        if (old && old.k !== r.value.k && unconfirmed().length) { const q = await Swal.fire({ icon: 'warning', title: 'يوجد مبيعات غير مؤكدة', text: 'ربط الجهاز بمدير آخر قد يُضيّع مبيعاتك غير المؤكدة. تأكد من إرسالها أولاً. المتابعة؟', showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' }); if (!q.isConfirmed) return; }
        ls.set(K.link, { k: r.value.k, s: r.value.s, n: r.value.n, at: nowIso() });
        toast('success', 'تم الربط بالمدير'); refresh();
    }
    async function unlink() {
        const n = groups(unconfirmed());
        const r = await Swal.fire({ icon: 'warning', title: 'فك الربط بالمدير؟', html: 'لن تتمكن من إرسال مبيعات أو استلام لقطة مخزون حتى تربط الجهاز من جديد.' + (n ? '<br><b style="color:#b91c1c">يوجد ' + num(n) + ' فاتورة لم يؤكدها المدير.</b>' : ''), showCancelButton: true, confirmButtonText: 'فك الربط', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' });
        if (!r.isConfirmed) return;
        if (waOn()) { await setMode(false, true); if (waOn()) return; }
        try { localStorage.removeItem(K.link); } catch (e) { /* تجاهل */ }
        toast('success', 'فُكّ الربط'); refresh();
    }
    async function setMode(on, silent) {
        if (isOwner()) { Swal.fire({ icon: 'info', title: 'لحساب المستخدم فقط', text: 'المدير يستورد الملفات ولا يحتاج هذا الوضع.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return false; }
        if (on) {
            if (!link()) { await Swal.fire({ icon: 'info', title: 'اربط الجهاز بالمدير أولاً', text: 'اضغط «ربط بالمدير» وألصق الرمز الذي أرسله لك.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return false; }
            if (L.mode() === 'lan') { await Swal.fire({ icon: 'info', title: 'المزامنة عبر الحاسوب مفعّلة', text: 'أوقفها أولاً من الإعدادات، فلا يجتمع الوضعان.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return false; }
            const r = await Swal.fire({ icon: 'question', title: 'تفعيل وضع واتساب؟', html: 'يتوقف اتصال هذا الجهاز بالسحابة، وتُحفظ مبيعاتك على الجهاز ثم ترسلها للمدير كملف عبر واتساب.<br><small>الأرصدة تتحدّث عندك حين تستورد «لقطة المخزون» من المدير.</small>', showCancelButton: true, confirmButtonText: 'تفعيل', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
            if (!r.isConfirmed) return false;
            try { localStorage.setItem(K.mode, '1'); } catch (e) { /* تجاهل */ }
            try { await Promise.race([usagePause('wa'), new Promise(r => setTimeout(r, 4000))]); } catch (e) { /* تجاهل */ }
            usagePaused = 'wa'; try { syncRefresh(); } catch (e) { /* تجاهل */ }
            refresh(); return true;
        }
        // إيقاف الوضع: ما لم يُرسل بعد يُرفع للسحابة أو يُرسل كملف
        const un = unsent();
        const warnSent = (() => { const e = expMap(), s = seenSet(); return groups(ops().filter(o => allowedOp(o) && e[o.id] && !s.has(o.id))); })();
        let choice = 'cloud';
        if (!silent || un.length) {
            const sm = summarize(un);
            const r = await Swal.fire({ icon: un.length ? 'warning' : 'question', title: 'الرجوع إلى السحابة؟', html: (un.length ? 'لديك <b>' + num(pendingCount()) + '</b> فاتورة لم تُرسل للمدير.<br>اختر: رفعها إلى السحابة مباشرة، أو إرسالها كملف أولاً.' : 'ستعود المزامنة مع السحابة.') + (warnSent ? '<br><small style="color:#b45309">أرسلتَ كملف ' + num(warnSent) + ' فاتورة لم يؤكدها المدير بعد؛ تأكد أنه استوردها.</small>' : ''), showCancelButton: true, showDenyButton: un.length > 0, confirmButtonText: un.length ? 'رفعها للسحابة والرجوع' : 'رجوع', denyButtonText: 'إرسالها كملف أولاً', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', customClass: { denyButton: 'dw-btn dw-btn-ghost dw-btn-soft', cancelButton: 'dw-btn dw-btn-text' } });
            if (r.isDenied) { await exportSales(); return false; }
            if (!r.isConfirmed) return false;
        }
        try { localStorage.setItem(K.mode, '0'); } catch (e) { /* تجاهل */ }
        try { await Promise.race([usageResume(), new Promise(r => setTimeout(r, 4000))]); } catch (e) { /* تجاهل */ }
        usagePaused = ''; try { syncRefresh(); } catch (e) { /* تجاهل */ }
        if (un.length) {
            const h = Prog.start('رفع المبيعات إلى السحابة', { text: 'جاري الرفع...' }); let ok = 0; const em = expMap(), failed = [];
            for (const o of un) { try { await I.replayOne(o); em[o.id] = nowIso() + '|cloud'; ok++; } catch (e) { failed.push(o); } h.set(Math.round((ok + failed.length) / un.length * 100), 'رُفعت ' + ok + ' من ' + un.length); }
            ls.set(K.exp, em);
            if (failed.length) h.fail('تعذّر رفع بعض العمليات', 'بقيت ' + failed.length + '؛ ستجدها في «إرسال المبيعات». فعّل الوضع وأرسلها كملف.'); else h.ok('رُفعت ' + ok + ' عملية');
            if (failed.length) { try { localStorage.setItem(K.mode, '1'); await Promise.race([usagePause('wa'), new Promise(r => setTimeout(r, 4000))]); usagePaused = 'wa'; } catch (e) { /* تجاهل */ } }
        }
        refresh(); try { syncRefresh(); } catch (e) { /* تجاهل */ }
        return !waOn();
    }

    // ---------------- التصدير (المستخدم → المدير) ----------------
    function fileName(kind, kid) { const d = new Date(), p = n => String(n).padStart(2, '0'); return 'diwan-' + kind + '-' + kid + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json'; }
    async function exportSales(opts) {
        opts = opts || {};
        if (isOwner()) { Swal.fire({ icon: 'info', title: 'لحساب المستخدم فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const lk = link();
        if (!lk) { await Swal.fire({ icon: 'info', title: 'اربط الجهاز بالمدير أولاً', text: 'اضغط «ربط بالمدير» وألصق الرمز الذي أرسله لك.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const list = (opts.all ? unconfirmed() : unsent()).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        if (!list.length) { await Swal.fire({ icon: 'info', title: opts.all ? 'لا توجد مبيعات غير مؤكدة' : 'لا توجد مبيعات جديدة للإرسال', text: opts.all ? 'المدير أكّد كل مبيعاتك.' : 'كل مبيعاتك أُرسلت سابقاً. إن لم يصل شيء للمدير استعمل «إعادة إرسال ما لم يؤكده المدير».', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const sm = summarize(list);
        const h = Prog.start('تجهيز ملف المبيعات', { text: 'جمع الحركات...' });
        let text, name;
        try {
            const payload = { diwan: 1, kind: 'sales', kid: lk.k, at: nowIso(), from: { name: (typeof userName !== 'undefined' && userName) || lk.n || '', dev: devId() }, n: list.length, ops: list.map(o => ({ id: o.id, type: o.type, ts: o.ts, data: stripCost(o.data) })) };
            const rt = JSON.parse(JSON.stringify(payload)); rt.sig = sign(lk.s, rt); text = JSON.stringify(rt); name = fileName('sales', lk.k);   // التوقيع على الشكل المسلسل نفسه (بدون الحقول غير المعرّفة)
            h.set(70, 'فتح واتساب...'); h.ok('الملف جاهز: ' + num(list.length) + ' عملية');
        } catch (e) { h.fail('تعذّر تجهيز الملف', (e && e.message) || ''); return; }
        const msg = 'مبيعات ' + ((typeof userName !== 'undefined' && userName) || lk.n || '') + ' — ' + num(sm.n) + ' فاتورة';
        let res = await shareText(name, text, msg);
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: num(list.length) + ' عملية · ' + num(sm.n) + ' فاتورة<br><small>اضغط «إرسال» واختر واتساب ثم المدير.</small>', confirmButtonText: 'إرسال', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: async () => { const x = await shareText(name, text, msg); return x; } });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (res === 'cancelled' || res === 'blocked' || !res) { toast('info', 'لم يُرسل الملف. تبقى المبيعات بانتظار الإرسال'); refresh(); return; }
        const em = expMap(); list.forEach(o => { em[o.id] = nowIso(); }); ls.set(K.exp, em); ls.set('diwanWaLastExp', { at: nowIso(), n: list.length });
        if (res === 'saved') await Swal.fire({ icon: 'success', title: 'حُفظ الملف على الجهاز', html: 'أرسله للمدير من واتساب: <b>📎 ← مستند</b> ثم اختر الملف<br><small dir="ltr">' + esc(window._natSavedPath || name) + '</small>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else if (res === 'downloaded') await Swal.fire({ icon: 'success', title: 'نُزّل الملف', text: 'أرفقه من التنزيلات في واتساب وأرسله للمدير.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else toast('success', 'جُهّز الملف: ' + num(list.length) + ' عملية');
        refresh(); try { syncRefresh(); } catch (e) { /* تجاهل */ }
    }

    // ---------------- المدير: الأجهزة والاستيراد ----------------
    const devs = () => ls.get(K.devs, []);
    const impAll = () => ls.get(K.imp, {});
    function impSet() { const s = new Set(); const m = impAll(); Object.keys(m).forEach(k => (m[k] || []).forEach(x => s.add(x))); return s; }
    function markImp(kid, id) { const m = impAll(); (m[kid] = m[kid] || []).push(id); if (m[kid].length > 6000) m[kid] = m[kid].slice(-6000); ls.set(K.imp, m); }
    const cntTs = pid => { const c = ls.get(K.cnt, {}); return c[String(pid)] || ''; };
    function noteCount(entries) {
        let c = null; (entries || []).forEach(e => { if (e && e.mark && e.p && e.p.id !== undefined) { c = c || ls.get(K.cnt, {}); c[String(e.p.id)] = nowIso(); } });
        if (c) ls.set(K.cnt, c);
    }
    // المستخدمون الذين أضافهم المدير من الإعدادات يظهرون تلقائياً كأجهزة (لكل مستخدم مفتاح توقيع خاص)
    let usersAt = 0, loadingUsers = false;
    function mergeUsers() {
        if (!isOwner() || typeof usersCache === 'undefined' || !usersCache.length) return false;
        const all = devs(); let ch = false;
        usersCache.forEach(u => {
            const off = u.active === false; let d = all.find(x => x.uid === u.uid);
            if (!d) { all.push({ kid: rid(6), secret: rid(24), uid: u.uid, label: u.name || 'مستخدم', created: nowIso(), last: '', n: 0, ni: 0, off }); ch = true; }
            else { if (u.name && d.label !== u.name) { d.label = u.name; ch = true; } if (!!d.off !== off) { d.off = off; ch = true; } }
        });
        if (ch) ls.set(K.devs, all); return ch;
    }
    async function loadUsers(force) {
        if (!isOwner() || loadingUsers) return;
        if (!force && Date.now() - usersAt < 600000) { if (mergeUsers()) refresh(); return; }
        if (!(typeof cloudReady === 'function' && cloudReady() && navigator.onLine)) { if (mergeUsers()) refresh(); return; }
        loadingUsers = true; const h = Prog.start('تحميل المستخدمين', { text: 'جاري القراءة من السحابة...' });
        try {
            const snap = await db.collection('pharmacy_users').get(), arr = []; snap.forEach(d => arr.push({ uid: d.id, ...d.data() }));
            usersCache = arr; usersAt = Date.now();
            const ids = new Set(arr.map(u => u.uid)); ls.set(K.devs, devs().filter(d => !d.uid || ids.has(d.uid)));   // مستخدم حُذف: يسقط مفتاحه فلا تُقبل ملفاته
            mergeUsers(); h.ok('تم التحميل');
        } catch (e) { h.fail('تعذّر تحميل المستخدمين', 'تظهر آخر قائمة محفوظة'); mergeUsers(); }
        finally { loadingUsers = false; refresh(); }
    }
    async function renewKey(kid) {
        const d = devs().find(x => x.kid === kid); if (!d) return;
        const r = await Swal.fire({ icon: 'warning', title: 'تجديد مفتاح «' + esc(d.label) + '»؟', html: 'يبطل الرمز القديم، ولن تُقبل ملفات المستخدم حتى يربط جهازه بالرمز الجديد.', showCancelButton: true, confirmButtonText: 'تجديد', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' });
        if (!r.isConfirmed) return;
        const all = devs(), x = all.find(y => y.kid === kid); x.secret = rid(24); ls.set(K.devs, all); refresh(); await showCode(kid);
    }
    async function addDevice() {
        if (!isOwner()) return;
        const r = await Swal.fire({ title: 'إضافة جهاز مستخدم', html: '<div style="text-align:right;font-size:.85rem;margin-bottom:8px">اكتب اسماً يدلّك على صاحب الجهاز.</div><input id="waDevLbl" class="swal2-input" placeholder="مثال: أحمد (الفرع الثاني)" maxlength="40">', showCancelButton: true, confirmButtonText: 'إنشاء الرمز', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => { const v = document.getElementById('waDevLbl').value.trim(); if (!v) { Swal.showValidationMessage('اكتب اسماً'); return false; } return v; } });
        if (!r.isConfirmed) return;
        const d = { kid: rid(6), secret: rid(24), label: r.value, created: nowIso(), last: '', n: 0, ni: 0 };
        const all = devs(); all.push(d); ls.set(K.devs, all); refresh();
        await showCode(d.kid);
    }
    async function showCode(kid) {
        const d = devs().find(x => x.kid === kid); if (!d) return;
        const code = codeOf(d);
        const msg = 'رمز ربط جهازك بصيدلية الديوان (واتساب):\n' + code + '\nالصقه في: حالة المزامنة ← المبيعات عبر واتساب ← ربط بالمدير.';
        const r = await Swal.fire({ icon: 'success', title: 'رمز ربط: ' + esc(d.label), html: '<div style="font-size:.82rem;text-align:right;margin-bottom:6px">أرسل هذا الرمز لصاحب الجهاز وحده، فهو مفتاح توقيع مبيعاته.</div><textarea readonly class="swal2-textarea" dir="ltr" style="height:96px;font-size:.72rem" onclick="this.select()">' + esc(code) + '</textarea>', showCancelButton: true, showDenyButton: true, confirmButtonText: 'إرسال عبر واتساب', denyButtonText: 'نسخ الرمز', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', customClass: { denyButton: 'dw-btn dw-btn-ghost dw-btn-soft', cancelButton: 'dw-btn dw-btn-text' }, preConfirm: () => 'wa', preDeny: () => 'copy' });
        if (r.isConfirmed) { try { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank'); } catch (e) { /* تجاهل */ } }
        else if (r.isDenied) { try { await navigator.clipboard.writeText(code); toast('success', 'نُسخ الرمز'); } catch (e) { toast('info', 'حدّد الرمز وانسخه يدوياً'); } }
    }
    async function delDevice(kid) {
        const d = devs().find(x => x.kid === kid); if (!d) return;
        const r = await Swal.fire({ icon: 'warning', title: 'حذف جهاز «' + esc(d.label) + '»؟', html: 'لن تُقبل ملفات هذا الجهاز بعد الآن، وتبقى الفواتير والأرصدة التي استوردتها كما هي.', showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' });
        if (!r.isConfirmed) return;
        ls.set(K.devs, devs().filter(x => x.kid !== kid)); toast('success', 'حُذف الجهاز'); refresh();
    }
    function cleanStock(op) {   // يقبل من الملف الحقول المسموحة فقط
        const entries = (op.data.entries || []).map(en => {
            if (!en || en.pid === undefined || en.pid === null) return null;
            const o = { pid: en.pid, name: String(en.name || '').slice(0, 120), dq: iso(en.dq), dl: iso(en.dl) };
            if (Array.isArray(en.hints) && en.hints.length) o.hints = en.hints.slice(0, 40).map(h => { const x = { q: iso(h && h.q), l: iso(h && h.l) }; if (h && typeof h.e === 'string') x.e = h.e.slice(0, 12); if (h && Number(h.pr) > 0) x.pr = Number(h.pr); return x; });
            if (Array.isArray(en.expAdd)) o.expAdd = en.expAdd.slice(0, 20).map(x => String(x).slice(0, 12));
            if (Array.isArray(en.expRemove)) o.expRemove = en.expRemove.slice(0, 20).map(x => String(x).slice(0, 12));
            if (en.expChanged) o.expChanged = true;
            return o;
        }).filter(Boolean).slice(0, 400);
        const k = op.data.op || {};
        return { op: { key: String(k.key || '').slice(0, 120), kind: k.kind, inv: String(k.inv || '').slice(0, 120), no: String(k.no || '').slice(0, 60) }, entries };
    }
    function parseFile(text) {
        let f; try { f = JSON.parse(text); } catch (e) { return { err: 'الملف ليس ملف الديوان (تعذّرت قراءته).' }; }
        if (!f || f.diwan !== 1 || (f.kind !== 'sales' && f.kind !== 'snap') || !safeId(f.kid) || typeof f.sig !== 'string') return { err: 'هذا ليس ملفاً صادراً من تطبيق الديوان.' };
        return { f };
    }
    // يبني خطة الاستيراد دون تغيير شيء
    function planSales(f, dev, skipCounted) {
        const imp = impSet(), sim = {}, P = { ops: [], dup: 0, bad: 0, blockedKinds: 0, missing: new Set(), counted: new Set(), over: new Set(), invIds: new Set(), invUpd: 0, stockOps: 0 };
        const list = (Array.isArray(f.ops) ? f.ops : []).filter(o => o && typeof o === 'object').sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        list.forEach(o => {
            if (!allowedOp(o)) { P.bad++; return; }
            if (imp.has(o.id)) { P.dup++; return; }
            if (o.type === 'stock') {
                const c = cleanStock(o), ent = [];
                c.entries.forEach(en => {
                    const p = (typeof products !== 'undefined' ? products : []).find(x => String(x.id) === String(en.pid));
                    if (!p) { P.missing.add(en.name || en.pid); return; }
                    const ct = cntTs(p.id); if (skipCounted && ct && String(o.ts) < ct) { P.counted.add(p.name); return; }
                    const sc = btSc(p), cur = sim[p.id] !== undefined ? sim[p.id] : (parseInt(p.qty) || 0) * sc + (sc > 1 ? (parseInt(p.loose) || 0) : 0), raw = cur + en.dq * sc + (sc > 1 ? en.dl : 0);
                    if (raw < 0) P.over.add(p.name); sim[p.id] = Math.max(0, raw); ent.push(en);
                });
                P.ops.push({ id: o.id, type: 'stock', ts: o.ts, clean: c, ent, hasLines: ent.length }); if (ent.length) P.stockOps++;
            } else {
                const r = o.data.rec; if (!Array.isArray(r.items)) { P.bad++; return; }
                const old = (typeof billAll !== 'undefined' ? billAll : []).find(x => x.id === r.id);
                if (old) P.invUpd++;
                P.invIds.add(String(r.id)); P.ops.push({ id: o.id, type: 'invoice', ts: o.ts, rec: r });
            }
        });
        const sm = summarize(P.ops.filter(o => o.type === 'invoice').map(o => ({ type: 'invoice', ts: o.ts, data: { rec: o.rec } })));
        P.sm = sm; return P;
    }
    async function importFlow(file) {
        file = file || await pickFile(); if (!file) return;
        const pf = parseFile(file.text);
        if (pf.err) { await Swal.fire({ icon: 'error', title: 'ملف غير صالح', text: pf.err, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const f = pf.f;
        if (f.kind === 'snap') return importSnapshot(f);
        if (!isOwner()) { await Swal.fire({ icon: 'info', title: 'ملف مبيعات', text: 'هذا الملف يستورده المدير. أنت تستورد «لقطة المخزون» فقط.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const dev = devs().find(d => d.kid === f.kid);
        if (!dev) { await Swal.fire({ icon: 'error', title: 'جهاز غير مسجَّل', html: 'هذا الملف من جهاز لم تضفه في «أجهزة المستخدمين»، أو حُذف.<br><small>أضف الجهاز وأرسل له رمز الربط ثم ليعد الإرسال.</small>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (dev.off) { await Swal.fire({ icon: 'error', title: 'حساب المستخدم معطّل', text: 'فعّل حساب «' + dev.label + '» من المستخدمين والصلاحيات ثم أعد المحاولة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (sign(dev.secret, f) !== f.sig) { await Swal.fire({ icon: 'error', title: 'الملف غير موثوق', text: 'التوقيع لا يطابق: الملف مُعدَّل أو تالف، فلم يُقبل. اطلب من المستخدم إعادة الإرسال.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        let skipCounted = true, P = planSales(f, dev, skipCounted);
        if (!P.ops.length) { await Swal.fire({ icon: 'info', title: P.dup ? 'استُورد هذا الملف سابقاً' : 'لا توجد حركات صالحة', text: P.dup ? 'كل عملياته موجودة عندك، فلم يتغيّر شيء.' : '', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const html = () => {
            const li = (ic, t, cls) => '<div class="wa-li ' + (cls || '') + '"><i>' + ic + '</i><span>' + t + '</span></div>';
            let h = '<div class="wa-pv"><div class="wa-pv-h"><b>' + esc(dev.label) + '</b><small>' + esc((f.from && f.from.name) || '') + ' · أُرسل ' + esc(ago(f.at)) + '</small></div>';
            h += li('🧾', '<b>' + num(P.sm.n) + '</b> فاتورة جديدة بمبلغ <b>' + num(P.sm.tot) + '</b> د.ع');
            if (P.sm.canc) h += li('↩️', '<b>' + num(P.sm.canc) + '</b> فاتورة ملغاة');
            if (P.invUpd) h += li('✏️', num(P.invUpd) + ' فاتورة موجودة عندك وستُحدَّث');
            h += li('📦', '<b>' + num(P.stockOps) + '</b> حركة مخزون ستُطبَّق');
            if (P.dup) h += li('♻️', num(P.dup) + ' عملية مستوردة سابقاً (ستُتخطى)', 'mut');
            if (P.bad) h += li('🚫', num(P.bad) + ' عملية غير مسموحة (ستُرفض)', 'bad');
            if (P.missing.size) h += li('❓', 'مواد غير موجودة عندك: ' + esc([...P.missing].slice(0, 6).join('، ')) + (P.missing.size > 6 ? ' …' : '') + '<br><small>تُحفظ الفاتورة دون خصم هذه المواد.</small>', 'warn');
            if (P.counted.size) h += li('🔢', 'حركات أقدم من آخر جرد لك ستُتجاهل لأن الجرد يشملها: ' + esc([...P.counted].slice(0, 6).join('، ')) + (P.counted.size > 6 ? ' …' : ''), 'warn');
            if (P.over.size) h += li('⚠️', 'رصيدك لا يكفي لبعض المواد وسيصير صفراً: ' + esc([...P.over].slice(0, 6).join('، ')), 'warn');
            h += '<div class="qk-row" style="margin-top:8px"><div><b>تجاهل ما يشمله الجرد</b><small>يتجاوز الحركات الأقدم من آخر جرد أجريتَه للمادة.</small></div><label class="setup-sw"><input type="checkbox" id="waSkipCnt" ' + (skipCounted ? 'checked' : '') + ' onchange="WA._skip(this.checked)"><i></i></label></div></div>';
            return h;
        };
        window.WA._skip = v => { skipCounted = !!v; P = planSales(f, dev, skipCounted); const box = document.querySelector('.swal2-html-container'); if (box) { box.innerHTML = html(); } };
        const r = await Swal.fire({ title: 'استيراد مبيعات', html: html(), showCancelButton: true, confirmButtonText: 'استيراد', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        window.WA._skip = null;
        if (!r.isConfirmed) return;
        await applySales(f, dev, P, skipCounted);
    }
    let busy = false;
    async function applyStock(op, skipCounted, rep) {
        const c = op.clean, entries = [], undo = [];
        c.entries.forEach(en => {
            const p = products.find(x => String(x.id) === String(en.pid)); if (!p) { rep.missing++; return; }
            const ct = cntTs(p.id); if (skipCounted && ct && String(op.ts) < ct) { rep.counted++; return; }
            const sc = btSc(p), q0 = parseInt(p.qty) || 0, l0 = parseInt(p.loose) || 0, cur = q0 * sc + (sc > 1 ? l0 : 0), raw = cur + en.dq * sc + (sc > 1 ? en.dl : 0), nt = Math.max(0, raw);
            if (raw < 0) rep.over.add(p.name);
            p.qty = Math.floor(nt / sc); p.loose = sc > 1 ? nt % sc : 0;
            if (en.hints) p._badd = (p._badd || []).concat(en.hints);
            entries.push({ p, dq: p.qty - q0, dl: p.loose - l0, expAdd: en.expAdd || [], expRemove: en.expRemove || [], expChanged: !!en.expChanged });
            undo.push({ p, q0, l0 });
        });
        if (!entries.length) return false;
        const o = c.op && c.op.key ? { key: c.op.key, kind: c.op.kind, inv: c.op.inv, no: c.op.no } : null;
        const ok = await saveProductsDelta(entries, o);
        if (!ok) { undo.forEach(u => { u.p.qty = u.q0; u.p.loose = u.l0; delete u.p._badd; }); throw new Error('تعذّر حفظ حركة المخزون'); }
        if (window.__opAlready) { rep.already++; return true; }
        try { entries.forEach((e, i) => { logAction('qty', e.p, [{ f: 'الكمية (استيراد واتساب' + (c.op && c.op.no ? ' · ' + c.op.no : '') + ')', from: stockTxt(e.p, { qty: undo[i].q0, loose: undo[i].l0 }), to: stockTxt(e.p, { qty: e.p.qty, loose: e.p.loose }) }]); }); } catch (e) { /* تجاهل */ }
        return true;
    }
    async function applyInvoice(op, f, dev, rep) {
        const rec = JSON.parse(JSON.stringify(op.rec)); rec.__pre = dev.kid;
        if (!rec.byUid) rec.byUid = 'wa:' + dev.kid; if (!rec.by) rec.by = (f.from && f.from.name) || dev.label;
        rec.viaWa = dev.kid;
        const r0 = { inv: 0, pur: 0, stale: 0, renum: 0, stock: 0, skipped: [], touched: new Set() };
        I.applyRecordOp('invoice', rec, r0);
        if (r0.stale) { rep.invStale++; return; }
        const saved = (typeof billAll !== 'undefined' ? billAll : []).find(x => x.id === rec.id) || rec;
        if (r0.renum) rep.renum++;
        if (L.net()) L.captureRecord('invoice', saved);
        else if (cloudReady() && (navigator.onLine || persistenceOn)) { try { await fsSet(db.collection('pharmacy_invoices').doc(saved.id), JSON.parse(JSON.stringify(saved))); } catch (e) { lsSet('diwanNeedsPush', '1'); } }
        else lsSet('diwanNeedsPush', '1');
        rep.inv++;
    }
    async function applySales(f, dev, P, skipCounted) {
        if (busy) return; busy = true; window.__waImporting = true;
        const rep = { inv: 0, invStale: 0, renum: 0, stock: 0, missing: 0, counted: 0, already: 0, over: new Set(), fail: [] };
        const h = Prog.start('استيراد مبيعات ' + dev.label, { text: 'جاري التطبيق...' });
        const total = P.ops.length; let i = 0;
        try {
            for (const op of P.ops) {
                try {
                    if (op.type === 'stock') { if (await applyStock(op, skipCounted, rep)) rep.stock++; }
                    else await applyInvoice(op, f, dev, rep);
                    markImp(dev.kid, op.id);
                } catch (e) { rep.fail.push(op.id + ': ' + ((e && e.message) || e)); }
                i++; if (i % 3 === 0 || i === total) h.set(Math.round(i / total * 100), 'طُبّقت ' + i + ' من ' + total);
            }
            try { saveLocal(); } catch (e) { /* تجاهل */ }
            try { renderAll(); } catch (e) { /* تجاهل */ }
            const all = devs(), d = all.find(x => x.kid === dev.kid); if (d) { d.last = nowIso(); d.n = (d.n || 0) + 1; d.ni = (d.ni || 0) + rep.inv; ls.set(K.devs, all); }
            const lg = ls.get(K.log, []); lg.unshift({ at: nowIso(), kid: dev.kid, label: dev.label, inv: rep.inv, stock: rep.stock, missing: rep.missing, counted: rep.counted, over: [...rep.over].slice(0, 8), fail: rep.fail.length }); ls.set(K.log, lg.slice(0, 40));
            if (rep.fail.length) h.fail('اكتمل مع أخطاء', 'تعذّر ' + rep.fail.length + ' عملية؛ أعد استيراد الملف نفسه لتكتمل (ما استُورد لا يتكرر)');
            else h.ok('تم الاستيراد: ' + num(rep.inv) + ' فاتورة و' + num(rep.stock) + ' حركة');
        } finally { busy = false; window.__waImporting = false; refresh(); }
        const li = (t, c) => '<div class="wa-li ' + (c || '') + '"><span>' + t + '</span></div>';
        let body = li('🧾 فواتير مضافة: <b>' + num(rep.inv) + '</b>') + li('📦 حركات مخزون مطبّقة: <b>' + num(rep.stock) + '</b>');
        if (rep.invStale) body += li('فواتير أحدث منها موجودة عندك: ' + num(rep.invStale), 'mut');
        if (rep.already) body += li('حركات سُجّلت سابقاً في السحابة: ' + num(rep.already), 'mut');
        if (rep.missing) body += li('مواد غير موجودة (لم تُخصم): ' + num(rep.missing), 'warn');
        if (rep.counted) body += li('حركات يشملها الجرد (تُجوهلت): ' + num(rep.counted), 'warn');
        if (rep.over.size) body += li('رصيد غير كافٍ (صار صفراً): ' + esc([...rep.over].slice(0, 6).join('، ')), 'warn');
        if (rep.renum) body += li('فواتير بأرقام مكررة أُعيد ترقيمها: ' + num(rep.renum), 'warn');
        if (rep.fail.length) body += li('أخطاء: ' + num(rep.fail.length) + ' — أعد استيراد الملف', 'bad');
        await Swal.fire({ icon: rep.fail.length ? 'warning' : 'success', title: rep.fail.length ? 'اكتمل جزئياً' : 'تم الاستيراد', html: '<div class="wa-pv">' + body + '<div class="wa-li mut"><span>أرسل للمستخدم «لقطة مخزون» ليتحدّث رصيده.</span></div></div>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    }

    // ---------------- لقطة المخزون (المدير → المستخدم) ----------------
    async function exportSnapshot(kid) {
        if (!isOwner()) return;
        const dev = devs().find(d => d.kid === kid); if (!dev) return;
        const h = Prog.start('تجهيز لقطة المخزون', { text: 'جمع الأصناف...' });
        let text, name, n;
        try {
            const items = products.map(p => { const s = I.pSplit(p), st = {}; SNAP_ST.forEach(k => { if (p[k] !== undefined) st[k] = p[k]; }); return { pid: p.id, info: s.info, st }; });
            n = items.length;
            const payload = { diwan: 1, kind: 'snap', kid, at: nowIso(), from: { name: (typeof userName !== 'undefined' && userName) || 'المدير' }, products: items, cfg: I.cfgNow(), seen: (impAll()[kid] || []).slice(-4000) };
            h.set(60, 'توقيع الملف...'); const rt = JSON.parse(JSON.stringify(payload)); rt.sig = sign(dev.secret, rt); text = JSON.stringify(rt); name = fileName('stock', kid);
            h.ok('الملف جاهز: ' + num(n) + ' مادة (' + (typeof fmtBytes === 'function' ? fmtBytes(text.length) : Math.round(text.length / 1024) + ' ك.ب') + ')');
        } catch (e) { h.fail('تعذّر تجهيز اللقطة', (e && e.message) || ''); return; }
        let res = await shareText(name, text, 'لقطة مخزون صيدلية الديوان');
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: num(n) + ' مادة<br><small>اضغط «إرسال» واختر واتساب ثم المستخدم.</small>', confirmButtonText: 'إرسال', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: async () => await shareText(name, text, 'لقطة مخزون صيدلية الديوان') });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (!res || res === 'cancelled' || res === 'blocked') { toast('info', 'لم يُرسل الملف'); return; }
        if (res === 'saved') await Swal.fire({ icon: 'success', title: 'حُفظ الملف على الجهاز', html: 'أرسله للمستخدم من واتساب: <b>📎 ← مستند</b><br><small dir="ltr">' + esc(window._natSavedPath || name) + '</small>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else if (res === 'downloaded') await Swal.fire({ icon: 'success', title: 'نُزّل الملف', text: 'أرفقه من التنزيلات في واتساب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else toast('success', 'جُهّزت لقطة المخزون');
    }
    const SINFO_DROP = ['costPrice', 'lastPurchase', 'markupPct'];
    async function importSnapshot(f) {
        if (isOwner()) { await Swal.fire({ icon: 'info', title: 'لقطة مخزون', text: 'هذا الملف يستورده المستخدم. أنت تستورد ملفات المبيعات.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const lk = link();
        if (!lk) { await Swal.fire({ icon: 'info', title: 'اربط الجهاز بالمدير أولاً', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (f.kid !== lk.k) { await Swal.fire({ icon: 'error', title: 'الملف لجهاز آخر', text: 'هذه اللقطة أُعدّت لجهاز غير هذا الجهاز.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (sign(lk.s, f) !== f.sig) { await Swal.fire({ icon: 'error', title: 'الملف غير موثوق', text: 'التوقيع لا يطابق: الملف مُعدَّل أو تالف. اطلب من المدير إعادة الإرسال.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const last = ls.get(K.snapAt, ''); if (last && f.at && String(f.at) <= String(last)) { const q = await Swal.fire({ icon: 'warning', title: 'لقطة أقدم من المستورَدة', text: 'استوردتَ لقطة أحدث من هذه سابقاً. استيراد الأقدم قد يعيد أرصدة قديمة. المتابعة؟', showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' }); if (!q.isConfirmed) return; }
        const seen = new Set(Array.isArray(f.seen) ? f.seen : []);
        const pend = ops().filter(o => o.type === 'stock' && allowedOp(o) && !seen.has(o.id)).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        const pc = new Set(); pend.forEach(o => pc.add(groupKey(o)));
        const r = await Swal.fire({ icon: 'question', title: 'استيراد لقطة المخزون', html: '<div class="wa-pv"><div class="wa-li"><span>📦 <b>' + num((f.products || []).length) + '</b> مادة بأرصدتها وأسعارها · أُعدّت ' + esc(ago(f.at)) + '</span></div>' + (pend.length ? '<div class="wa-li warn"><span>مبيعاتك التي لم يؤكدها المدير (' + num(pc.size) + ') ستُحسب فوق الرصيد الجديد، فلا يضيع شيء.</span></div>' : '') + '</div>', showCancelButton: true, confirmButtonText: 'استيراد', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return;
        const h = Prog.start('تحديث المخزون من المدير', { text: 'جاري التطبيق...' });
        try {
            const arr = Array.isArray(f.products) ? f.products : []; let added = 0, upd = 0, i = 0;
            arr.forEach(it => {
                if (!it || it.pid === undefined || !it.info || typeof it.info !== 'object') return;
                const info = {}; Object.keys(it.info).forEach(k => { if (k.charAt(0) !== '_' && SINFO_DROP.indexOf(k) < 0) info[k] = it.info[k]; });
                let p = products.find(x => String(x.id) === String(it.pid));
                if (!p) { p = Object.assign({}, info); p.id = it.pid; products.push(p); added++; }
                else { Object.keys(p).forEach(k => { if (k.charAt(0) !== '_' && STOCK_FIELDS.indexOf(k) < 0 && k !== 'inStock' && k !== 'dlim' && !(k in info)) delete p[k]; }); Object.assign(p, info); upd++; }
                const st = it.st || {}; SNAP_ST.forEach(k => { if (st[k] !== undefined) p[k] = st[k]; else delete p[k]; });
                if (++i % 200 === 0) h.set(Math.round(i / arr.length * 60), 'تحديث الأصناف...');
            });
            h.set(65, 'إعادة مبيعاتك غير المؤكدة...');
            const rep = { stock: 0, inv: 0, pur: 0, stale: 0, renum: 0, skipped: [], touched: new Set() };
            pend.forEach(o => { try { I.applyStockOp(o.data, rep, o.ts); } catch (e) { /* عملية تالفة: تُتخطّى */ } });
            products.forEach(p => { p.inStock = !p.arch && ((parseInt(p.qty) || 0) > 0 || (parseInt(p.loose) || 0) > 0); });
            try { syncStockLocal(products); } catch (e) { /* تجاهل */ }
            if (f.cfg) { try { I.trackIngest('cfg', { cfg: f.cfg }); } catch (e) { /* تجاهل */ } }
            const ns = seenSet(); seen.forEach(x => ns.add(x)); ls.set(K.seen, [...ns].slice(-6000)); ls.set(K.snapAt, f.at || nowIso());
            saveLocal(); try { renderAll(); } catch (e) { /* تجاهل */ }
            h.ok('تم التحديث: ' + num(upd) + ' مادة' + (added ? ' و' + num(added) + ' جديدة' : ''));
        } catch (e) { h.fail('تعذّر تحديث المخزون', (e && e.message) || ''); }
        refresh(); try { syncRefresh(); } catch (e) { /* تجاهل */ }
    }

    // ---------------- الواجهة ----------------
    const sw = (id, chk, fn) => '<label class="setup-sw"><input type="checkbox" id="' + id + '" ' + (chk ? 'checked' : '') + ' onchange="' + fn + '"><i></i></label>';
    const btn = (cls, fn, t, sub) => '<button type="button" class="set-nav ' + cls + '" onclick="' + fn + '"><div><b>' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><i>‹</i></button>';
    function html() {
        if (isOwner()) {
            mergeUsers(); const dv = devs(), lg = ls.get(K.log, []);
            let h = '<p class="set-desc wa-intro">يرسل المستخدم مبيعاته كملف عبر واتساب، فتستورده هنا فتتحدّث الأرصدة والفواتير. وترسل له «لقطة مخزون» ليتحدّث رصيده. لا تتكرر الحركات ولا تتداخل مع مبيعاتك.</p>';
            h += btn('set-act wa-main', 'WA.importFlow()', '📥 استيراد ملف من مستخدم', 'اختر الملف الذي وصلك على واتساب (مبيعات).');
            h += '<h5 class="wa-h">المستخدمون</h5>';
            if (!dv.length) h += '<div class="wa-empty">لا يوجد مستخدمون. أضف مستخدماً من «المستخدمون والصلاحيات» فيظهر هنا تلقائياً.</div>';
            dv.forEach(d => { h += '<div class="wa-dev"><div class="wa-dev-t"><b>' + esc(d.label) + (d.off ? ' <em class="tg bad">معطّل</em>' : '') + '</b><small dir="ltr">' + esc(d.kid) + '</small></div><small>' + (d.last ? 'آخر استيراد ' + esc(ago(d.last)) + ' · ' + num(d.ni || 0) + ' فاتورة' : 'لم يُستورد منه شيء بعد') + '</small><div class="wa-dev-b"><button type="button" onclick="WA.showCode(\'' + esc(d.kid) + '\')">رمز الربط</button><button type="button" onclick="WA.exportSnapshot(\'' + esc(d.kid) + '\')">إرسال لقطة مخزون</button>' + (d.uid ? '<button type="button" class="del" onclick="WA.renewKey(\'' + esc(d.kid) + '\')">تجديد المفتاح</button>' : '<button type="button" class="del" onclick="WA.delDevice(\'' + esc(d.kid) + '\')">حذف</button>') + '</div></div>'; });
            if (lg.length) { h += '<h5 class="wa-h">آخر عمليات الاستيراد</h5>'; lg.slice(0, 5).forEach(x => { h += '<div class="wa-log"><b>' + esc(x.label) + '</b><span>' + esc(ago(x.at)) + '</span><small>' + num(x.inv) + ' فاتورة · ' + num(x.stock) + ' حركة' + (x.fail ? ' · ' + num(x.fail) + ' خطأ' : '') + '</small></div>'; }); }
            return h;
        }
        const lk = link(), on = waOn(), un = unsent(), sm = summarize(un), conf = groups(unconfirmed()), le = ls.get('diwanWaLastExp', null), sa = ls.get(K.snapAt, '');
        let h = '<p class="set-desc wa-intro">تُحفظ مبيعاتك على الجهاز وترسلها للمدير كملف عبر واتساب، ويرسل لك المدير «لقطة مخزون» لتحديث الأرصدة.</p>';
        if (!lk) return h + '<div class="wa-empty">الجهاز غير مربوط بالمدير.</div>' + btn('set-act wa-main', 'WA.setLink()', '🔗 ربط بالمدير', 'الصق رمز الربط الذي أرسله لك المدير.');
        h += '<div class="qk-row"><div><b>وضع واتساب</b><small>' + (on ? 'مفعّل: لا اتصال بالسحابة، والمبيعات تُرسل كملف.' : 'متوقف: الجهاز يعمل مع السحابة كالمعتاد.') + '</small></div>' + sw('waSw', on, 'WA.toggleMode(this)') + '</div>';
        h += '<div class="wa-st"><div><b>' + num(pendingCount()) + '</b><small>مبيعات لم تُرسل</small></div><div><b>' + num(sm.tot) + '</b><small>مبلغها (د.ع)</small></div><div><b>' + num(conf) + '</b><small>لم يؤكدها المدير</small></div></div>';
        h += btn('set-act wa-main', 'WA.exportSales()', '📤 إرسال المبيعات للمدير', un.length ? num(un.length) + ' عملية جاهزة للإرسال عبر واتساب.' : 'لا توجد مبيعات جديدة.');
        h += btn('set-act', 'WA.exportSales({all:true})', '🔁 إعادة إرسال ما لم يؤكده المدير', 'إن لم يصل ملف سابق. التكرار آمن ولا يضاعف شيئاً.');
        h += btn('set-act', 'WA.importFlow()', '📥 استيراد لقطة المخزون', sa ? 'آخر لقطة: ' + esc(ago(sa)) : 'اختر الملف الذي أرسله المدير.');
        const bl = opsBlocked(); if (bl) h += '<div class="wa-li warn"><span>' + num(bl) + ' عملية (جرد أو تعديل) لا تُرسل عبر واتساب وتبقى على هذا الجهاز فقط.</span></div>';
        h += '<div class="wa-meta">مرتبط بـ: <b>' + esc(lk.n || lk.k) + '</b>' + (le ? ' · آخر إرسال ' + esc(ago(le.at)) : '') + ' · <a href="#" onclick="WA.unlink();return false">فك الربط</a></div>';
        return h;
    }
    function refresh() {
        const hs = [document.getElementById('waHost'), document.getElementById('waOvBody')];
        hs.forEach(el => { if (el) { try { el.innerHTML = html(); } catch (e) { el.innerHTML = '<div class="wa-empty">تعذّر العرض</div>'; } } });
    }
    function open() {
        let ov = document.getElementById('waOv');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'waOv'; ov.className = 'wa-ov no-print'; ov.setAttribute('dir', 'rtl');
            ov.innerHTML = '<div class="wa-sheet"><div class="wa-hd"><b>📲 المبيعات عبر واتساب</b><button type="button" class="wa-x" onclick="WA.close()" aria-label="إغلاق">✕</button></div><div class="wa-body" id="waOvBody"></div></div>';
            ov.addEventListener('click', e => { if (e.target === ov) close(); });
            document.body.appendChild(ov);
        }
        ov.style.display = 'flex'; refresh(); loadUsers();
    }
    function close() { const ov = document.getElementById('waOv'); if (ov) ov.style.display = 'none'; }
    async function toggleMode(cb) { const want = cb.checked; const ok = await setMode(want); if (!ok) cb.checked = !want; refresh(); }
    setInterval(() => { const ov = document.getElementById('waOv'); if ((ov && ov.style.display !== 'none') || document.getElementById('waHost')) { if (!document.querySelector('.swal2-container')) refresh(); } }, 20000);

    window.WA = { loadUsers, renewKey, add, noteCount, pendingCount, open, close, render: refresh, exportSales, importFlow, exportSnapshot, setLink, unlink, toggleMode, addDevice, showCode, delDevice, on: waOn, _skip: null, _t: { sha256, hmacHex, sign, parseCode, codeOf, planSales, cleanStock, devs, impSet, link, ops, unsent, unconfirmed, summarize, applySales, importSnapshot, parseFile, K } };
    window.addEventListener('load', () => setTimeout(refresh, 1500));
})();
