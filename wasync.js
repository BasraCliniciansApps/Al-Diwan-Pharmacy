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
    const STAFF_KINDS = ['sale', 'cancel', 'edit', 'ret', 'count'];
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

    // بصمة تحقق (SHA-256 بلا مفتاح ولا تشفير): تكشف تلف الملف أو انقطاعه أثناء النقل
    function sealText(obj) { const c = Object.assign({}, obj); delete c.chk; const body = JSON.stringify(c); c.chk = hex(sha256(te.encode(body))); return JSON.stringify(c); }
    function chkOk(f) { if (!f || typeof f.chk !== 'string') return true; const c = Object.assign({}, f), k = c.chk; delete c.chk; try { return hex(sha256(te.encode(JSON.stringify(c)))) === k; } catch (e) { return false; } }

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
    // سقف حجم السجل (localStorage محدود ~5 ميغا ويشاركه التطبيق): تُحذف أقدم العمليات المُرسَلة/المؤكَّدة أولاً، ولا تُحذف عملية لم تُرسل أبداً
    function capOps(list, done, maxBytes) {
        maxBytes = maxBytes || 1200000; let sz = 0; try { sz = JSON.stringify(list).length; } catch (e) { return; }
        for (let i = 0; i < list.length && sz > maxBytes;) { if (done(list[i])) { try { sz -= JSON.stringify(list[i]).length + 1; } catch (e) { /* تجاهل */ } list.splice(i, 1); } else i++; }
    }
    const ops = () => ls.get(K.ops, []);
    const expMap = () => ls.get(K.exp, {});
    const seenSet = () => new Set(ls.get(K.seen, []));
    function add(op) {
        if (!op || !op.id) return;
        const all = ops(); if (all.some(x => x.id === op.id)) return;
        const lim = Date.now() - OPS_KEEP_DAYS * 86400000, e = expMap(), s = seenSet();
        const keep = all.filter(x => !(s.has(x.id) && Date.parse(x.ts) < lim));   // ما أكّده المدير وقدُم يُحذف
        keep.push(op); capOps(keep, o => s.has(o.id) || !!e[o.id]); ls.set(K.ops, keep);
        const em = {}; keep.forEach(x => { if (e[x.id]) em[x.id] = e[x.id]; }); ls.set(K.exp, em);
        refresh(); try { syncRefresh(); } catch (x) { /* تجاهل */ }
    }
    const unsent = () => { const e = expMap(), s = seenSet(); return ops().filter(o => allowedOp(o) && !e[o.id] && !s.has(o.id)); };
    const unconfirmed = () => { const s = seenSet(); return ops().filter(o => allowedOp(o) && !s.has(o.id)); };
    const groups = list => { const g = new Set(); list.forEach(o => g.add(groupKey(o))); return g.size; };
    function pendingCount() { return groups(unsent()); }
    const unsentBytes = () => { try { return JSON.stringify(unsent()).length; } catch (e) { return 0; } };
    const kb = n => num(Math.round(n / 1024)) + ' ك.ب';
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
    function fileName(kind, kid) { const d = new Date(), p = n => String(n).padStart(2, '0'); return 'diwan-' + kind + '-' + kid + '-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + (kind === 'share' || kind === 'shsnap' ? '.dwsync' : '.json'); }
    async function exportSales(opts) {
        opts = opts || {};
        if (isOwner()) { Swal.fire({ icon: 'info', title: 'لحساب المستخدم فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const lk0 = link(), shared = !waOn();   // خارج وضع واتساب: ملف تبادل موازٍ للسحابة، بلا ربط ولا توقيع
        const lk = shared ? { k: 'u' + devId(), s: '', n: (typeof userName !== 'undefined' && userName) || '' } : lk0;
        if (!lk) { await Swal.fire({ icon: 'info', title: 'اربط الجهاز بالمدير أولاً', text: 'اضغط «ربط بالمدير» وألصق الرمز الذي أرسله لك.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const list = (opts.all ? unconfirmed() : unsent()).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        const got = ls.get(GOT, {}), gotSent = ls.get(GOTSENT, {}), ackNew = shared && Object.keys(got).some(k => (got[k] || 0) > (gotSent[k] || 0));
        if (!list.length && !ackNew) { await Swal.fire({ icon: 'info', title: opts.all ? 'لا توجد مبيعات غير مؤكدة' : 'لا توجد مبيعات جديدة للإرسال', text: opts.all ? 'المدير أكّد كل مبيعاتك.' : 'كل مبيعاتك أُرسلت سابقاً. إن لم يصل شيء للمدير استعمل «إعادة إرسال ما لم يؤكده المدير».', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const sm = summarize(list);
        const h = Prog.start('تجهيز ملف المبيعات', { text: 'جمع الحركات...' });
        let text, name;
        try {
            const payload = { diwan: 1, kind: 'sales', kid: lk.k, at: nowIso(), from: { name: (typeof userName !== 'undefined' && userName) || lk.n || '', dev: devId() }, n: list.length, ops: list.map(o => ({ id: o.id, type: o.type, ts: o.ts, data: stripCost(o.data) })) };
            if (shared && Object.keys(got).length) payload.ack = got;   // تأكيد استلام تحديثات المدير
            const rt = JSON.parse(JSON.stringify(payload)); if (shared) { rt.share = 1; rt.from.uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) || ''; text = sealText(rt); } else { rt.sig = sign(lk.s, rt); text = JSON.stringify(rt); } name = fileName(shared ? 'share' : 'sales', lk.k);   // التوقيع على الشكل المسلسل نفسه (بدون الحقول غير المعرّفة)
            h.set(70, 'فتح واتساب...'); h.ok('الملف جاهز: ' + num(list.length) + ' عملية');
        } catch (e) { h.fail('تعذّر تجهيز الملف', (e && e.message) || ''); return; }
        const msg = 'مبيعات ' + ((typeof userName !== 'undefined' && userName) || lk.n || '') + ' — ' + num(sm.n) + ' فاتورة';
        let res = await shareText(name, text, msg);
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: num(list.length) + ' عملية · ' + num(sm.n) + ' فاتورة<br><small>اضغط «إرسال» واختر واتساب ثم المدير.</small>', confirmButtonText: 'إرسال', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: async () => { const x = await shareText(name, text, msg); return x; } });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (res === 'cancelled' || res === 'blocked' || !res) { toast('info', 'لم يُرسل الملف. تبقى المبيعات بانتظار الإرسال'); refresh(); return; }
        const em = expMap(); list.forEach(o => { em[o.id] = nowIso(); }); ls.set(K.exp, em); ls.set('diwanWaLastExp', { at: nowIso(), n: list.length }); if (shared) ls.set(GOTSENT, got);
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
        if (f && f.diwan === 1 && !chkOk(f)) return { err: 'الملف تالف أو لم يكتمل نقله (فشل فحص البصمة). اطلب إعادة إرساله.' };
        if (!f || f.diwan !== 1 || (f.kind !== 'sales' && f.kind !== 'snap' && f.kind !== 'mgr' && f.kind !== 'full') || !safeId(f.kid) || (typeof f.sig !== 'string' && f.share !== 1)) return { err: 'هذا ليس ملفاً صادراً من تطبيق الديوان.' };
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
        if (f.kind === 'mgr') return importMgr(f);
        if (f.kind === 'full') return importFull(f);
        if (!isOwner()) { await Swal.fire({ icon: 'info', title: 'ملف مبيعات', text: 'هذا الملف يستورده المدير. أنت تستورد «لقطة المخزون» فقط.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        let dev = f.share === 1 ? null : devs().find(d => d.kid === f.kid);
        if (f.share === 1) {   // ملف تبادل غير موقّع: نطابق صاحبه بحسابات المستخدمين، والمعاينة تبقى إلزامية
            const uu = (typeof usersCache !== 'undefined' ? usersCache : []).find(u => u.uid && u.uid === (f.from && f.from.uid));
            if (uu && uu.active === false) { await Swal.fire({ icon: 'error', title: 'حساب المستخدم معطّل', text: 'فعّل حساب «' + (uu.name || '') + '» ثم أعد المحاولة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
            dev = { kid: f.kid, label: (uu && uu.name) || (f.from && f.from.name) || 'مستخدم', secret: '', share: 1 };
        }
        if (!dev) { await Swal.fire({ icon: 'error', title: 'جهاز غير مسجَّل', html: 'هذا الملف من جهاز لم تضفه في «أجهزة المستخدمين»، أو حُذف.<br><small>أضف الجهاز وأرسل له رمز الربط ثم ليعد الإرسال.</small>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (dev.off) { await Swal.fire({ icon: 'error', title: 'حساب المستخدم معطّل', text: 'فعّل حساب «' + dev.label + '» من المستخدمين والصلاحيات ثم أعد المحاولة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (f.share !== 1 && sign(dev.secret, f) !== f.sig) { await Swal.fire({ icon: 'error', title: 'الملف غير موثوق', text: 'التوقيع لا يطابق: الملف مُعدَّل أو تالف، فلم يُقبل. اطلب من المستخدم إعادة الإرسال.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (f.share === 1 && f.ack && typeof f.ack === 'object') {   // تأكيد استلام المستخدم لتحديثاتي: تتقدم نقطة المقارنة
            try { const fu = (f.from && f.from.uid) || ''; Object.keys(f.ack).forEach(xs => { const n = parseInt(f.ack[xs]) || 0; if (n && (xs === '' || (fu && xs === fu))) strAck(xs, n); }); refresh(); } catch (e) { /* تجاهل */ }
            if (!(Array.isArray(f.ops) && f.ops.length)) { await Swal.fire({ icon: 'success', title: 'تأكيد استلام', text: 'وصل «' + dev.label + '» ما أرسلتَه من تحديثات، وسُجّل ذلك.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        }
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
        const lk = link(), SH = f.share === 1;
        if (!lk && !SH) { await Swal.fire({ icon: 'info', title: 'اربط الجهاز بالمدير أولاً', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (!SH && f.kid !== lk.k) { await Swal.fire({ icon: 'error', title: 'الملف لجهاز آخر', text: 'هذه اللقطة أُعدّت لجهاز غير هذا الجهاز.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (!SH && sign(lk.s, f) !== f.sig) { await Swal.fire({ icon: 'error', title: 'الملف غير موثوق', text: 'التوقيع لا يطابق: الملف مُعدَّل أو تالف. اطلب من المدير إعادة الإرسال.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const last = ls.get(K.snapAt, ''); if (last && f.at && String(f.at) <= String(last)) { const q = await Swal.fire({ icon: 'warning', title: 'لقطة أقدم من المستورَدة', text: 'استوردتَ لقطة أحدث من هذه سابقاً. استيراد الأقدم قد يعيد أرصدة قديمة. المتابعة؟', showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' }); if (!q.isConfirmed) return; }
        const seen = new Set(Array.isArray(f.seen) ? f.seen : []);
        const pend = ops().filter(o => o.type === 'stock' && allowedOp(o) && !seen.has(o.id)).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        const pc = new Set(); pend.forEach(o => pc.add(groupKey(o)));
        const r = await Swal.fire({ icon: 'question', title: 'استيراد لقطة المخزون', html: '<div class="wa-pv"><div class="wa-li"><span>📦 <b>' + num((f.products || []).length) + '</b> مادة بأرصدتها وأسعارها' + (Array.isArray(f.del) && f.del.length ? ' · <b>' + num(f.del.length) + '</b> محذوفة' : '') + ' · أُعدّت ' + esc(ago(f.at)) + '</span></div>' + (pend.length ? '<div class="wa-li warn"><span>مبيعاتك التي لم يؤكدها المدير (' + num(pc.size) + ') ستُحسب فوق الرصيد الجديد، فلا يضيع شيء.</span></div>' : '') + '</div>', showCancelButton: true, confirmButtonText: 'استيراد', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return;
        const h = Prog.start('تحديث المخزون من المدير', { text: 'جاري التطبيق...' });
        try {
            const arr = Array.isArray(f.products) ? f.products : []; let added = 0, upd = 0, i = 0, delN = 0, stampSkip = 0, tombSkip = 0, cfgSkip = false;
            const cloudLive = SH && !waOn() && typeof cloudReady === 'function' && cloudReady() && navigator.onLine;   // السحابة متصلة: هي المرجع للأرصدة، فلا نكتب فوقها

            arr.forEach(it => {
                if (!it || it.pid === undefined || !it.info || typeof it.info !== 'object') return;
                const info = {}; Object.keys(it.info).forEach(k => { if (k.charAt(0) !== '_' && SINFO_DROP.indexOf(k) < 0) info[k] = it.info[k]; });
                let p = products.find(x => String(x.id) === String(it.pid));
                let isNew = false;
                if (!p) { if (tombNewer(it.pid, f.at)) { tombSkip++; return; } p = Object.assign({}, info); p.id = it.pid; products.push(p); added++; isNew = true; }
                else if (p.metaUpdatedAt && info.metaUpdatedAt && p.metaUpdatedAt > info.metaUpdatedAt) { stampSkip++; }   // نسخة الجهاز أحدث (معلومات وأسعار): لا نكتب فوقها
                else { Object.keys(p).forEach(k => { if (k.charAt(0) !== '_' && STOCK_FIELDS.indexOf(k) < 0 && k !== 'inStock' && k !== 'dlim' && !(k in info)) delete p[k]; }); Object.assign(p, info); upd++; }
                const st = it.st || {}; if (!cloudLive || isNew) SNAP_ST.forEach(k => { if (st[k] !== undefined) p[k] = st[k]; else delete p[k]; });
                if (++i % 200 === 0) h.set(Math.round(i / arr.length * 60), 'تحديث الأصناف...');
            });
            if (!cloudLive && Array.isArray(f.del) && f.del.length) { const ds = new Set(f.del.map(String)); const b4 = products.length, gone = products.filter(p => ds.has(String(p.id))).map(p => p.id); products = products.filter(p => !ds.has(String(p.id))); delN = b4 - products.length; if (gone.length) addTomb(gone); }
            h.set(65, 'إعادة مبيعاتك غير المؤكدة...');
            const rep = { stock: 0, inv: 0, pur: 0, stale: 0, renum: 0, skipped: [], touched: new Set() };
            if (!cloudLive) pend.forEach(o => { try { I.applyStockOp(o.data, rep, o.ts); } catch (e) { /* عملية تالفة: تُتخطّى */ } });
            products.forEach(p => { p.inStock = !p.arch && ((parseInt(p.qty) || 0) > 0 || (parseInt(p.loose) || 0) > 0); });
            try { syncStockLocal(products); } catch (e) { /* تجاهل */ }
            if (f.cfg) { if (f.cfgAt && cfgAtNow() > f.cfgAt) cfgSkip = true; else { try { I.trackIngest('cfg', { cfg: f.cfg }); setCfgAt(f.cfgAt); } catch (e) { /* تجاهل */ } } }
            if (SH && f.xid !== undefined) setGot(f.xs || '', f.xid);   // لتأكيد الاستلام للمدير مع ملف مبيعاتك التالي
            const ns = seenSet(); seen.forEach(x => ns.add(x)); ls.set(K.seen, [...ns].slice(-6000)); ls.set(K.snapAt, f.at || nowIso());
            saveLocal(); try { renderAll(); } catch (e) { /* تجاهل */ }
            h.ok('تم التحديث: ' + num(upd) + ' مادة' + (added ? ' و' + num(added) + ' جديدة' : '') + (delN ? ' وحُذف ' + num(delN) : '') + (stampSkip ? ' · تُخطّيت ' + num(stampSkip) + ' مادة نسخة جهازك أحدث' : '') + (tombSkip ? ' · تُخطّيت ' + num(tombSkip) + ' مادة محذوفة' : '') + (cfgSkip ? ' · الإعدادات عندك أحدث' : ''));
        } catch (e) { h.fail('تعذّر تحديث المخزون', (e && e.message) || ''); }
        refresh(); try { syncRefresh(); } catch (e) { /* تجاهل */ }
    }

    // ---------------- تبادل واتساب الموازي للسحابة (ملف .dwsync بلا تشفير) ----------------
    // المستخدم: كل بيع يُسجَّل في سجل الحركات حتى والسحابة شغّالة، ويُرسل كملف. بمفتاح الحركة نفسه الذي تعرفه السحابة (pharmacy_moves)،
    // فإن وصل البيع للسحابة ثم استورد المدير الملف (أو العكس) تُتخطى الحركة ولا تتكرر.
    // المدير: يرسل «ما تغيّر» فقط (مواد وأسعار وإعدادات) مقارنةً بآخر إرسال.
    const SHK = { sent: 'diwanShSent', cfg: 'diwanShCfg', opened: 'diwanShOpened' };
    const shLogOn = () => ls.raw('diwanShOff') !== '1';
    const MG = { ops: 'diwanMgOps', exp: 'diwanMgExp', sent: 'diwanMgSent' };
    function addMg(op) {   // سجل حركات المدير (تُرسل للحاسوب كملف)
        const all = ls.get(MG.ops, []); if (all.some(x => x.id === op.id)) return;
        const em = ls.get(MG.exp, {}), keep = all.filter(x => !em[x.id] || Date.now() - Date.parse(x.ts) < 14 * 86400000); keep.push(op); capOps(keep, o => !!em[o.id]); ls.set(MG.ops, keep);
    }
    function tapStock(entries, op) {   // يُستدعى قبل btPrepare (يقرأ _badd) ولا يغيّر شيئاً
        try {
            if (!shLogOn() || L.active() || window.__waImporting) return;
            const own = isOwner();
            let nk = false;
            if (!op || !op.key) {   // جرد أو ضبط كمية يدوي: بلا مفتاح تعرفه السحابة. يُنقل للحاسوب بمفتاح خاص بالملف، ويُطبَّق هناك محلياً فقط (السحابة تنقله إن كان متصلاً)
                if (!own) return;
                op = Object.assign({}, op || {}, { key: 'g' + Date.now().toString(36) + rid(4).toLowerCase(), kind: (op && op.kind) || 'adjust' }); nk = true;
            }
            if (!own && STAFF_KINDS.indexOf(op.kind) < 0) return;
            const list = (entries || []).filter(Boolean).filter(e => e.dq || e.dl || e.expChanged || (e.expAdd && e.expAdd.length) || (e.expRemove && e.expRemove.length));
            if (!list.length) return;
            const sn = I.snapNum;
            const pack = list.map(e => ({ pid: e.p.id, name: e.p.name, dq: sn(e.dq), dl: sn(e.dl), abs: (e.mark && (sn(e.dq) || sn(e.dl))) ? { q: sn(e.p.qty), l: sn(e.p.loose) } : undefined, hints: Array.isArray(e.p._badd) && e.p._badd.length ? JSON.parse(JSON.stringify(e.p._badd)) : null, expAdd: e.expAdd || [], expRemove: e.expRemove || [], expChanged: !!e.expChanged, lastSet: !!e.lastSet, last: e.last, mark: !!e.mark, unmark: !!e.unmark }));
            const o = { id: 'stk:' + op.key, type: 'stock', ts: nowIso(), data: { op: { key: op.key, kind: op.kind || '', inv: op.inv || '', no: op.no || '', nk: nk || undefined }, entries: pack } };
            if (own) addMg(o); else add(o);
        } catch (e) { /* التسجيل لا يعطّل البيع */ }
    }
    function tapRecord(type, rec) {
        try {
            if ((type !== 'invoice' && type !== 'purchase') || !rec || !shLogOn() || L.active() || window.__waImporting) return;
            const own = isOwner(); if (!own && type !== 'invoice') return;
            const o = { id: (type === 'invoice' ? 'inv:' : 'pur:') + rec.id + ':' + String(I.recStamp(rec)).replace(/[^\w]/g, '').slice(-14), type, ts: nowIso(), data: { rec: JSON.parse(JSON.stringify(rec)) } };
            if (own) addMg(o); else add(o);
        } catch (e) { /* تجاهل */ }
    }
    // ---- تأكيد الاستلام: كل ملف يحمل رقماً (xid) ضمن مجرى (xs: معرّف المستخدم، أو '' للمشترك، أو 'd' للحاسوب).
    // نقطة المقارنة المؤكَّدة لا تتقدم عند الإرسال بل عند وصول التأكيد (ack)، فما ضاع ملفه يُعاد في الملف التالي ولا يُفقد.
    const STR = 'diwanWaStr_';
    const strGet = k => ls.get(STR + k, { n: 0, acked: 0, pend: [] });
    function strPush(k, e) { const s = strGet(k); s.n = Math.max(s.n, e.n); s.pend.push(e); if (s.pend.length > 30) s.pend = s.pend.slice(-30); ls.set(STR + k, s); }
    function applyPend(k, p) {
        if (k === 'd') {
            const sent = mgSent(); if (p.full) { sent.p = {}; sent.r = {}; }
            Object.assign(sent.p, p.p || {}); Object.assign(sent.r, p.r || {}); if (p.c) sent.c = p.c;
            (p.delP || []).forEach(x => { delete sent.p[x]; }); (p.delR || []).forEach(x => { delete sent.r[x]; }); ls.set(MG.sent, sent);
        } else {
            const sent = p.full ? {} : shSent(k); Object.assign(sent, p.h || {}); (p.dels || []).forEach(x => { delete sent[x]; });
            ls.set(k ? SHK.sent + '_' + k : SHK.sent, sent); if (p.cfgH) ls.set(shCfgKey(k), p.cfgH);
        }
    }
    function strAck(k, n) {   // تأكيد تراكمي: ack رقم n يؤكد كل ما قبله
        const s = strGet(k); if (!n || n <= s.acked) return 0;
        const due = s.pend.filter(p => p.n <= n).sort((a, b) => a.n - b.n); due.forEach(p => applyPend(k, p));
        s.pend = s.pend.filter(p => p.n > n); s.acked = Math.max(s.acked, n); ls.set(STR + k, s); return due.length;
    }
    function strAll() { const o = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(STR) === 0) { const s = ls.get(k, null); if (s && s.pend && s.pend.length) o.push({ k: k.slice(STR.length), s }); } } } catch (e) { /* تجاهل */ } return o; }
    const GOT = 'diwanWaGot', GOTSENT = 'diwanWaGotSent';
    function setGot(xs, n) { const g = ls.get(GOT, {}); if ((g[xs] || 0) < n) { g[xs] = n; ls.set(GOT, g); } }
    // ---- شواهد الحذف (عند المستلم): ملف أقدم من الحذف لا يعيد المادة
    const TOMB = 'diwanWaTomb';
    function addTomb(ids) { const t = ls.get(TOMB, {}), now = nowIso(), lim = Date.now() - 180 * 86400000; ids.forEach(i => { t[String(i)] = now; }); Object.keys(t).forEach(k => { if (Date.parse(t[k]) < lim) delete t[k]; }); ls.set(TOMB, t); }
    const tombNewer = (pid, fileAt) => { const t = ls.get(TOMB, {})[String(pid)]; return !!(t && String(t) > String(fileAt || '')); };
    // ---- ختم الإعدادات
    const cfgAtNow = () => ls.get('diwanCfgAt', 0) || 0;
    function setCfgAt(v) { if (!v) return; ls.set('diwanCfgAt', v); try { window.__cfgSig = JSON.stringify(I.cfgNow()); } catch (e) { /* تجاهل */ } }
    const shSent = uid => ls.get(uid ? SHK.sent + '_' + uid : SHK.sent, {});
    const shCfgKey = uid => uid ? SHK.cfg + '_' + uid : SHK.cfg;
    // اختيار المستخدم المستلم: لكل مستخدم نقطة مقارنة خاصة به، فلا يفوته تغيير أُرسل لغيره
    async function pickRecipient() {
        const us = (typeof usersCache !== 'undefined' ? usersCache : []).filter(u => u && u.uid && u.active !== false && u.role !== 'owner' && u.role !== 'manager');
        if (!us.length) return { uid: '', name: '' };
        const opt = '<option value="">كل المستخدمين (نقطة مقارنة مشتركة)</option>' + us.map(u => '<option value="' + esc(u.uid) + '">' + esc(u.name || 'مستخدم') + '</option>').join('');
        const r = await Swal.fire({ title: 'لمن الملف؟', html: '<div class="wa-pv"><select id="waRcpt" class="swal2-select" style="display:flex;width:100%;margin:6px 0">' + opt + '</select><div class="wa-li mut"><span>اختر مستخدماً بعينه ليصله كل ما تغيّر منذ آخر ملف أُرسل له هو. الاختيار العام مناسب إذا أرسلت الملف نفسه للجميع دائماً.</span></div></div>', showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => { const el = document.getElementById('waRcpt'); return el ? el.value : ''; } });
        if (!r.isConfirmed) return null;
        const u = us.find(x => x.uid === r.value); return { uid: r.value || '', name: u ? (u.name || '') : '' };
    }
    // المدير: ملف التحديثات (الفرق فقط) ← المستخدمين
    async function exportShare(opts) {
        opts = opts || {};
        if (!isOwner()) { Swal.fire({ icon: 'info', title: 'للمدير فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const rc = opts.to !== undefined ? { uid: opts.to } : await pickRecipient(); if (!rc) return; const rUid = rc.uid || '';
        const h = Prog.start('تجهيز تحديثات المستخدمين', { text: 'مقارنة مع آخر إرسال...' });
        let text, name, nP = 0, hashes = {}, cfgH = '', withCfg = false, dels = [];
        const xid = strGet(rUid).n + 1;
        try {
            const sent = opts.full ? {} : shSent(rUid), items = [];
            const live = new Set(products.map(p => String(p.id)));
            if (!opts.full) Object.keys(sent).forEach(k => { if (!live.has(String(k))) dels.push(k); });
            products.forEach(p => {
                const s = I.pSplit(p), st = {}; SNAP_ST.forEach(k => { if (p[k] !== undefined) st[k] = p[k]; });
                const hh = I.hsh(I.stable({ i: s.info, st }));
                if (sent[p.id] === hh) return;
                hashes[p.id] = hh; items.push({ pid: p.id, info: s.info, st });
            });
            nP = items.length;
            const cf = I.cfgNow(); cfgH = I.hsh(I.stable(cf)); withCfg = opts.full || ls.get(shCfgKey(rUid), '') !== cfgH;
            if (!nP && !withCfg && !dels.length) { h.ok('لا توجد تغييرات جديدة'); await Swal.fire({ icon: 'info', title: 'لا توجد تحديثات جديدة', text: 'كل ما تغيّر أُرسل سابقاً. لإرسال كل شيء من جديد اختر «ملف كامل».', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
            const seen = []; const m = impAll(); Object.keys(m).forEach(k => (m[k] || []).forEach(x => seen.push(x)));
            const payload = { diwan: 1, kind: 'snap', share: 1, kid: 'm' + devId(), at: nowIso(), delta: !opts.full, xid, xs: rUid, cfgAt: withCfg ? cfgAtNow() : undefined, from: { name: (typeof userName !== 'undefined' && userName) || 'المدير' }, products: items, del: dels.length ? dels : undefined, cfg: withCfg ? cf : undefined, seen: seen.slice(-6000) };
            text = sealText(payload); name = fileName('shsnap', 'upd');
            h.ok('الملف جاهز: ' + num(nP) + ' مادة' + (dels.length ? ' + حذف ' + num(dels.length) : '') + (withCfg ? ' + الإعدادات' : ''));
        } catch (e) { h.fail('تعذّر تجهيز الملف', (e && e.message) || ''); return; }
        let res = await shareText(name, text, 'تحديثات صيدلية الديوان');
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: num(nP) + ' مادة<br><small>اضغط «إرسال» واختر واتساب.</small>', showCancelButton: true, confirmButtonText: 'إرسال', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => shareText(name, text, 'تحديثات صيدلية الديوان') });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (!res || res === 'cancelled' || res === 'blocked') { toast('info', 'لم يُرسل الملف'); return; }
        strPush(rUid, { n: xid, at: nowIso(), h: hashes, dels, cfgH: withCfg ? cfgH : undefined, full: !!opts.full });   // لا تتقدم نقطة المقارنة إلا بوصول التأكيد
        if (res === 'saved') await Swal.fire({ icon: 'success', title: 'حُفظ الملف على الجهاز', html: 'أرسله من واتساب: <b>📎 ← مستند</b>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else if (res === 'downloaded') await Swal.fire({ icon: 'success', title: 'نُزّل الملف', text: 'أرفقه من التنزيلات في واتساب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else toast('success', 'جُهّز الملف: ' + num(nP) + ' مادة');
        refresh();
    }
    // المدير (الجوال) ← الحاسوب: ملف واحد فيه حركات المخزون والفواتير والوارد وتغييرات المواد (بالكلفة) والإعدادات والمذاخر والدفتر
    const mgSent = () => ls.get(MG.sent, { p: {}, r: {}, c: '' });
    // قبل التصدير للحاسوب: تحديث فواتير السحابة (فواتير المستخدمين). بلا اتصال أو عند البطء (8 ثوانٍ) يُتخطى ويُصدَّر الموجود محلياً
    async function pullInvoicesForExport() {
        try {
            if (!(typeof cloudReady === 'function' && cloudReady() && navigator.onLine) || typeof loadInvoices !== 'function') return 'offline';
            let to; const tm = new Promise(res => { to = setTimeout(() => res('timeout'), 8000); });
            const r = await Promise.race([loadInvoices(0).then(() => 'ok'), tm]); clearTimeout(to);
            return r === 'ok' ? 'ok' : 'offline';
        } catch (e) { return 'offline'; }
    }
    // فواتير وصلت المدير عبر السحابة أو الاستيراد (لم تُسجَّل كحركات) تُضاف لسجل الحاسوب؛ الحاسوب يتخطى المكرر ويقارن الأحدث بالختم
    function addCloudInvoiceOps() {
        try {
            if (!shLogOn() || L.active() || typeof billAll === 'undefined') return 0;
            const cut = new Date(Date.now() - 14 * 86400000).toISOString(); let n = 0;
            billAll.forEach(rec => {
                if (!rec || !rec.id || !rec.issued || !Array.isArray(rec.items)) return;
                const st = String(I.recStamp(rec)); if (!st || st < cut) return;
                const id = 'inv:' + rec.id + ':' + st.replace(/[^\w]/g, '').slice(-14);
                if (ls.get(MG.ops, []).some(x => x.id === id)) return;
                addMg({ id, type: 'invoice', ts: nowIso(), data: { rec: JSON.parse(JSON.stringify(rec)) } }); n++;
            });
            return n;
        } catch (e) { return 0; }
    }
    async function exportDesktop(opts) {
        opts = opts || {}; const onlyIds = Array.isArray(opts.ids) ? new Set(opts.ids) : null, wantInfo = !onlyIds || opts.withInfo;
        if (!isOwner()) { Swal.fire({ icon: 'info', title: 'للمدير فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        if (!onlyIds) {   // هل وصل الملف السابق؟ (الحاسوب لا يرد تلقائياً)
            const sd = strGet('d');
            if (sd.pend.length) {
                const last = sd.pend[sd.pend.length - 1];
                const q = await Swal.fire({ icon: 'question', title: 'هل وصل الملف السابق إلى الحاسوب؟', html: 'آخر ملف أُرسل ' + esc(ago(last.at)) + '.<br><small>إن كان الحاسوب قد استورده اضغط «نعم، وصل». وإن لم تكن متأكداً اضغط «لا أدري» فتُعاد تلك التغييرات مع هذا الملف (لا يتضاعف شيء).</small>', showDenyButton: true, showCancelButton: true, confirmButtonText: 'نعم، وصل', denyButtonText: 'لا أدري', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
                if (q.isDismissed) return;
                if (q.isConfirmed) strAck('d', last.n);
            }
        }
        const h = Prog.start('تجهيز ملف الحاسوب', { text: 'جمع التغييرات...' });
        let text, name, sum, mark, offline = false; const xid = strGet('d').n + 1;
        try {
            if (!onlyIds) { h.set(5, 'تحديث الفواتير من السحابة...'); offline = (await pullInvoicesForExport()) !== 'ok'; addCloudInvoiceOps(); }
            const sent = mgSent(), em = ls.get(MG.exp, {}), ops = ls.get(MG.ops, []).filter(o => onlyIds ? onlyIds.has(o.id) : !em[o.id]);
            const info = { p: [], rec: [] }; mark = { p: {}, r: {}, c: sent.c, ids: ops.map(o => o.id) };
            if (wantInfo) products.forEach(p => {
                const s = I.pSplit(p), hh = I.hsh(I.stable({ i: s.info, c: s.cost }));
                if (sent.p[p.id] === hh) return;
                mark.p[p.id] = hh; info.p.push({ pid: p.id, info: s.info, cost: s.cost, init: s.init });
            });
            const rs = []; try { rs.push(['suppliers', puSuppliers || []]); rs.push(['ledger', lgAll || []]); } catch (e) { /* تجاهل */ }
            if (wantInfo) rs.forEach(([coll, arr]) => arr.forEach(r => { if (!r || !r.id) return; const k = coll + ':' + r.id, hh = I.hsh(I.stable(r)); if (sent.r[k] === hh) return; mark.r[k] = hh; info.rec.push({ coll, rec: r }); }));
            const cf = I.cfgNow(), ch = I.hsh(I.stable(cf)); if (wantInfo && sent.c !== ch) { info.cfg = cf; mark.c = ch; }
            // محذوفات: ما كان في نقطة المقارنة ولم يعد موجوداً
            const live = new Set(products.map(p => String(p.id))); info.delP = wantInfo ? Object.keys(sent.p).filter(k => !live.has(String(k))) : [];
            const liveR = new Set(rs.reduce((a, [c, arr]) => a.concat(arr.filter(r => r && r.id).map(r => c + ':' + r.id)), [])); info.delR = wantInfo ? Object.keys(sent.r).filter(k => !liveR.has(k)) : []; mark.delP = info.delP; mark.delR = info.delR;
            // حالة المخزون الدقيقة للمواد التي لمسها جرد/ضبط (دفعات وصلاحية وعلامة الجرد) لأن حركات الجرد تحمل الكمية فقط
            const touched = new Set(); ops.forEach(o => { if (o.type === 'stock' && o.data && o.data.op && o.data.op.nk) (o.data.entries || []).forEach(e => { if (e && e.pid !== undefined) touched.add(String(e.pid)); }); });
            if (touched.size) { info.sf = {}; products.forEach(p => { if (touched.has(String(p.id))) { const st = {}; ['bt', 'expiryDate', 'expiryDates', 'counted'].forEach(k => { if (p[k] !== undefined) st[k] = p[k]; }); info.sf[p.id] = st; } }); }
            sum = { ops: ops.length, p: info.p.length, rec: info.rec.length, cfg: !!info.cfg, del: info.delP.length + info.delR.length };
            if (!sum.ops && !sum.p && !sum.rec && !sum.cfg && !sum.del) { h.ok('لا توجد تغييرات جديدة'); await Swal.fire({ icon: 'info', title: 'لا توجد تغييرات جديدة للحاسوب', text: 'كل ما تغيّر أُرسل سابقاً.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
            if (info.cfg) info.cfgAt = cfgAtNow();
            const payload = { diwan: 1, kind: 'mgr', share: 1, kid: 'g' + devId(), at: nowIso(), xid, xs: 'd', from: { name: (typeof userName !== 'undefined' && userName) || 'المدير' }, ops: ops.map(o => ({ id: o.id, type: o.type, ts: o.ts, data: o.data })), info };
            text = sealText(payload); name = fileName('share', 'pc');
            h.ok('الملف جاهز (' + (typeof fmtBytes === 'function' ? fmtBytes(text.length) : Math.round(text.length / 1024) + ' ك.ب') + ')');
        } catch (e) { h.fail('تعذّر تجهيز الملف', (e && e.message) || ''); return; }
        let res = await shareText(name, text, 'تحديثات صيدلية الديوان للحاسوب');
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: 'اضغط «إرسال» واختر واتساب ثم محادثتك مع نفسك أو الحاسوب.', showCancelButton: true, confirmButtonText: 'إرسال', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => shareText(name, text, 'تحديثات صيدلية الديوان للحاسوب') });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (!res || res === 'cancelled' || res === 'blocked') { toast('info', 'لم يُرسل الملف'); return; }
        if (wantInfo) strPush('d', { n: xid, at: nowIso(), p: mark.p, r: mark.r, c: mark.c !== mgSent().c ? mark.c : undefined, delP: mark.delP || [], delR: mark.delR || [] });   // تتقدم نقطة المقارنة عند التأكيد
        const em = ls.get(MG.exp, {}); mark.ids.forEach(i => { em[i] = nowIso(); }); ls.set(MG.exp, em);
        if (res === 'saved') await Swal.fire({ icon: 'success', title: 'حُفظ الملف على الجهاز', html: 'أرسله من واتساب: <b>📎 ← مستند</b>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else if (res === 'downloaded') await Swal.fire({ icon: 'success', title: 'نُزّل الملف', text: 'أرفقه من التنزيلات في واتساب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else toast('success', 'جُهّز الملف للحاسوب');
        if (offline) setTimeout(() => toast('warning', 'تم التصدير بدون تحديث السحابة لانقطاع الاتصال'), 2800);
        refresh();
    }
    // ---------------- سجل التبادل (للمدير): ما أُرسل وما لم يُرسل، مع اختيار عمليات وفترة زمنية ----------------
    function opLabel(o) {
        try {
            const d = o.data || {};
            if (o.type === 'stock') { const en = d.entries || [], nm = en.slice(0, 2).map(e => e.name).filter(Boolean).join('، '); const k = d.op && d.op.nk ? 'جرد/ضبط كمية' : ({ sale: 'بيع', sell: 'بيع', purchase: 'وارد', adjust: 'ضبط كمية', ret: 'إرجاع' }[(d.op && d.op.kind) || ''] || 'حركة مخزون'); return k + ': ' + (nm || '—') + (en.length > 2 ? ' +' + (en.length - 2) : ''); }
            const r = d.rec || {};
            if (o.type === 'invoice') return 'فاتورة ' + (r.no || r.number || r.id || '') + (r.total !== undefined ? ' · ' + num(r.total) : '');
            if (o.type === 'purchase') return 'وارد ' + (r.no || r.id || '') + (r.supplierName || r.supplier ? ' · ' + (r.supplierName || (r.supplier && r.supplier.name) || r.supplier) : '');
        } catch (e) { /* تجاهل */ }
        return o.type || 'عملية';
    }
    const toLocalInput = t => { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); };
    async function showLog() {
        if (!isOwner()) { Swal.fire({ icon: 'info', title: 'للمدير فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const all = ls.get(MG.ops, []).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))), em = ls.get(MG.exp, {});
        let pu = 0, pr = 0, pc = false, pd = 0;
        try {   // تغييرات المواد والإعدادات التي لم تُرسل بعد (مقارنة بنقطتي الإرسال)
            const su = shSent(''), sd = mgSent();
            products.forEach(p => { const x = I.pSplit(p); if (su[p.id] !== I.hsh(I.stable({ i: x.info, st: SNAP_ST.reduce((o, k) => { if (p[k] !== undefined) o[k] = p[k]; return o; }, {}) }))) pu++; if (sd.p[p.id] !== I.hsh(I.stable({ i: x.info, c: x.cost }))) pd++; });
            [['suppliers', puSuppliers || []], ['ledger', lgAll || []]].forEach(([c, arr]) => arr.forEach(r => { if (r && r.id && sd.r[c + ':' + r.id] !== I.hsh(I.stable(r))) pr++; }));
            pc = sd.c !== I.hsh(I.stable(I.cfgNow()));
        } catch (e) { /* تجاهل */ }
        const nSent = all.filter(o => em[o.id]).length, nUn = all.length - nSent;
        const sz = a => { try { return JSON.stringify(a || []).length; } catch (e) { return 0; } };
        const dat = [['أصناف', products], ['فواتير', typeof billAll !== 'undefined' ? billAll : []], ['واردات', typeof puAll !== 'undefined' ? puAll : []], ['مذاخر', puSuppliers || []], ['دفتر', lgAll || []]].map(([n, a]) => ({ n, c: (a || []).length, b: sz(a) }));
        let lsTot = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsTot += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* تجاهل */ }
        const opsB = sz(all);
        const imp = ls.get(K.log, []).slice(0, 8);
        const strs = strAll(), nm = k => k === 'd' ? 'الحاسوب' : k === '' ? 'المستخدمون (مشترك)' : (((typeof usersCache !== 'undefined' ? usersCache : []).find(u => u.uid === k) || {}).name || 'مستخدم');
        const sel = new Set();
        const st = 'width:100%;margin:2px 0;padding:6px;border:1px solid #cbd5e1;border-radius:8px;font:inherit';
        const html = '<div class="wa-pv">' +
            '<div class="wa-li mut"><span>📊 الأحجام: ' + dat.map(x => x.n + ' <b>' + num(x.c) + '</b> (' + kb(x.b) + ')').join(' · ') + ' · سجل العمليات ' + kb(opsB) + ' · كل مخزن الجهاز ~' + kb(lsTot) + ' من ~5000 ك.ب</span></div>' +
            (strs.length ? '<div class="wa-li warn"><span>⏳ ملفات لم يصل تأكيد استلامها: ' + strs.map(x => esc(nm(x.k)) + ' <b>' + num(x.s.pend.length) + '</b>').join(' · ') + '<br><small>ما فيها من تغييرات يُعاد مع الملف التالي إلى أن يصل التأكيد. التأكيد يصل تلقائياً مع ملف مبيعات المستخدم، وللحاسوب يدوياً من الزر أدناه.</small></span></div>' : '') +
            '<div class="wa-li"><span>🖥️ إلى الحاسوب: <b>' + num(nUn) + '</b> عملية لم تُرسل · <b>' + num(nSent) + '</b> أُرسلت</span></div>' +
            '<div class="wa-li"><span>💊 مواد تغيّرت: للحاسوب <b>' + num(pd) + '</b>' + (pr ? ' · مذاخر ودفتر <b>' + num(pr) + '</b>' : '') + (pc ? ' · الإعدادات' : '') + ' · للمستخدمين (النقطة المشتركة) <b>' + num(pu) + '</b></span></div>' +
            '<div class="wa-li mut"><span>المواد والأسعار والإعدادات تُقارَن بآخر إرسال ولا يُحفظ لكل تعديل تاريخ، لذلك تُرسل كاملة من «إرسال التحديثات». الاختيار هنا للعمليات (مخزون وفواتير ووارد).</span></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><label><small>من</small><input type="datetime-local" id="waLgFrom" style="' + st + '"></label><label><small>إلى</small><input type="datetime-local" id="waLgTo" style="' + st + '"></label></div>' +
            '<select id="waLgSt" style="' + st + '"><option value="all">كل العمليات</option><option value="un" selected>لم تُرسل</option><option value="sent">أُرسلت</option></select>' +
            '<div id="waLgList" style="max-height:34vh;overflow:auto;display:flex;flex-direction:column;gap:4px"></div>' +
            '<div class="qk-row"><div><b>تضمين تغييرات المواد والإعدادات</b><small>تُضاف إلى الملف كل تغييرات المواد والمذاخر والإعدادات غير المرسلة.</small></div><label class="setup-sw"><input type="checkbox" id="waLgInfo"><i></i></label></div>' +
            (imp.length ? '<h5 class="wa-h">آخر عمليات الاستيراد</h5>' + imp.map(x => '<div class="wa-log"><b>' + esc(x.label) + '</b><span>' + esc(ago(x.at)) + '</span><small>' + num(x.inv) + ' فاتورة · ' + num(x.stock) + ' حركة' + (x.fail ? ' · ' + num(x.fail) + ' خطأ' : '') + '</small></div>').join('') : '') + '</div>';
        const draw = () => {
            const q = id => document.getElementById(id); if (!q('waLgList')) return;
            const f = q('waLgFrom').value ? Date.parse(q('waLgFrom').value) : 0, t = q('waLgTo').value ? Date.parse(q('waLgTo').value) : Infinity, s2 = q('waLgSt').value;
            const rows = all.filter(o => { const ms = Date.parse(o.ts); return ms >= f && ms <= t && (s2 === 'all' || (s2 === 'sent') === !!em[o.id]); });
            sel.clear(); if (s2 !== 'sent') rows.forEach(o => { if (!em[o.id]) sel.add(o.id); });
            q('waLgList').innerHTML = rows.length ? rows.slice(0, 300).map(o => '<div class="qk-row"><div><b>' + esc(opLabel(o)) + '</b><small>' + esc(new Date(o.ts).toLocaleString('ar-IQ')) + ' · ' + (em[o.id] ? 'أُرسلت ' + esc(ago(em[o.id])) : 'لم تُرسل') + '</small></div><label class="setup-sw"><input type="checkbox" data-id="' + esc(o.id) + '"' + (sel.has(o.id) ? ' checked' : '') + '><i></i></label></div>').join('') + (rows.length > 300 ? '<div class="wa-li mut"><span>يُعرض أحدث 300 فقط، ضيّق الفترة لرؤية الباقي.</span></div>' : '') : '<div class="wa-empty">لا توجد عمليات ضمن هذا الاختيار.</div>';
            q('waLgList').querySelectorAll('input[data-id]').forEach(i => { i.onchange = () => { if (i.checked) sel.add(i.dataset.id); else sel.delete(i.dataset.id); }; });
        };
        const r = await Swal.fire({ title: 'سجل التبادل', html, width: 560, showCancelButton: true, showDenyButton: strs.length > 0, denyButtonText: 'تأكيد وصول الملفات', confirmButtonText: 'إرسال المحدد إلى الحاسوب', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', didOpen: () => { draw(); ['waLgFrom', 'waLgTo', 'waLgSt'].forEach(id => { document.getElementById(id).onchange = draw; }); }, preConfirm: () => ({ ids: [...sel], info: !!(document.getElementById('waLgInfo') || {}).checked }) });
        if (r.isDenied) {
            const c = await Swal.fire({ icon: 'question', title: 'تأكيد وصول الملفات؟', text: 'اضغط «نعم» فقط إذا كنت متأكداً أن كل الملفات المرسلة استُوردت عند الطرف الآخر.', showCancelButton: true, confirmButtonText: 'نعم، وصلت', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
            if (c.isConfirmed) { strs.forEach(x => strAck(x.k, x.s.n)); toast('success', 'سُجّل التأكيد'); refresh(); }
            return;
        }
        if (!r.isConfirmed) return;
        if (!r.value.ids.length && !r.value.info) { toast('info', 'لم تُحدَّد أي عملية'); return; }
        await exportDesktop({ ids: r.value.ids, withInfo: r.value.info });
    }
    // نسخة كاملة من جوال المدير إلى الحاسوب: كل ما في النسخة الاحتياطية الكاملة للتطبيق (أصناف بكمياتها وكلفها وفواتير وواردات ومذاخر ودفتر وإعدادات)
    // ما لا تشمله النسخة الاحتياطية العادية: المصروفات وفئاتها والمتابعات وقوائم الجرد (تُنقل كما هي)
    const EXTRA_KEYS = ['diwanExpenses', 'diwanExpCats', 'diwanFollowups', 'diwanCountLists'];
    function fullExtras() { const o = {}; EXTRA_KEYS.forEach(k => { try { const v = lsGet(k); if (v) o[k] = JSON.parse(v); } catch (e) { /* تجاهل */ } }); return o; }
    function applyExtras(x, exact) {
        if (!x || typeof x !== 'object') return 0; let n = 0;
        EXTRA_KEYS.forEach(k => {
            const inc = x[k]; if (inc === undefined || inc === null) return;
            try {
                if (exact || !Array.isArray(inc)) { lsSet(k, JSON.stringify(inc)); n++; return; }
                let cur = []; try { cur = JSON.parse(lsGet(k) || '[]'); } catch (e) { cur = []; } if (!Array.isArray(cur)) cur = [];
                const m = new Map(cur.map(r => [String(r && r.id), r])); inc.forEach(r => { if (r && r.id !== undefined) m.set(String(r.id), r); });
                lsSet(k, JSON.stringify([...m.values()])); n++;
            } catch (e) { /* تجاهل */ }
        });
        try { if (typeof exLocal === 'function') exAll = exLocal(); } catch (e) { /* تجاهل */ }
        try { if (typeof cnLocal === 'function') cnLists = cnLocal(); } catch (e) { /* تجاهل */ }
        return n;
    }
    async function exportFull() {
        if (!isOwner() || window.diwanDesktop) { Swal.fire({ icon: 'info', title: 'من جوال المدير فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const h = Prog.start('تجهيز النسخة الكاملة للحاسوب', { text: 'جمع البيانات...' });
        let text, name, cnt;
        try {
            if (typeof cloudReady === 'function' && cloudReady() && navigator.onLine && typeof bkRefresh === 'function') { h.set(10, 'قراءة أحدث نسخة من السحابة...'); try { let to; await Promise.race([bkRefresh(), new Promise(res => { to = setTimeout(res, 20000); })]); clearTimeout(to); } catch (e) { /* نكمل بالمحلي */ } }
            h.set(60, 'تحويل الملف...');
            const data = buildFullBackup(); cnt = data.counts || {};
            text = sealText({ diwan: 1, kind: 'full', share: 1, kid: 'f' + devId(), at: nowIso(), from: { name: (typeof userName !== 'undefined' && userName) || 'المدير' }, backup: data, extras: fullExtras() });
            name = fileName('share', 'full');
            h.ok('الملف جاهز (' + (typeof fmtBytes === 'function' ? fmtBytes(text.length) : Math.round(text.length / 1024) + ' ك.ب') + ')');
        } catch (e) { h.fail('تعذّر تجهيز الملف', (e && e.message) || ''); return; }
        let res = await shareText(name, text, 'نسخة صيدلية الديوان الكاملة');
        if (res === 'blocked') {
            const r = await Swal.fire({ icon: 'success', title: 'الملف جاهز', html: 'اضغط «إرسال» واختر واتساب.', showCancelButton: true, confirmButtonText: 'إرسال', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => shareText(name, text, 'نسخة صيدلية الديوان الكاملة') });
            res = r.isConfirmed ? r.value : 'cancelled';
        }
        if (!res || res === 'cancelled' || res === 'blocked') { toast('info', 'لم يُرسل الملف'); return; }
        try {   // نقطة بداية جديدة: ملف «التحديثات» القادم يحمل ما بعد هذه النسخة فقط
            const sent = { p: {}, r: {}, c: '' };
            products.forEach(p => { const x = I.pSplit(p); sent.p[p.id] = I.hsh(I.stable({ i: x.info, c: x.cost })); });
            [['suppliers', puSuppliers || []], ['ledger', lgAll || []]].forEach(([c, arr]) => arr.forEach(r => { if (r && r.id) sent.r[c + ':' + r.id] = I.hsh(I.stable(r)); }));
            sent.c = I.hsh(I.stable(I.cfgNow())); ls.set(MG.sent, sent);
            const em = ls.get(MG.exp, {}); ls.get(MG.ops, []).forEach(o => { em[o.id] = nowIso(); }); ls.set(MG.exp, em);
        } catch (e) { /* تجاهل */ }
        if (res === 'saved') await Swal.fire({ icon: 'success', title: 'حُفظ الملف على الجهاز', html: 'أرسله من واتساب: <b>📎 ← مستند</b>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else if (res === 'downloaded') await Swal.fire({ icon: 'success', title: 'نُزّل الملف', text: 'أرفقه من التنزيلات في واتساب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        else toast('success', 'جُهّزت النسخة الكاملة: ' + num(cnt.products || 0) + ' صنف');
        if (!(typeof cloudReady === 'function' && cloudReady() && navigator.onLine)) setTimeout(() => toast('warning', 'تم التصدير بدون تحديث السحابة لانقطاع الاتصال'), 2800);
        refresh();
    }
    async function importFull(f) {
        if (!isOwner() || !window.diwanDesktop) { await Swal.fire({ icon: 'info', title: 'نسخة كاملة للحاسوب', text: 'هذا الملف يُفتح في تطبيق المدير على الحاسوب فقط.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const d = f.backup;
        if (!d || !Array.isArray(d.products) || !d.products.length) { await Swal.fire({ icon: 'error', title: 'ملف غير صالح', text: 'لا توجد أصناف في الملف.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const arr = k => (Array.isArray(d[k]) ? d[k].filter(x => x && x.id !== undefined) : []);
        const L2 = { products: d.products.filter(x => x && x.id !== undefined), purchases: arr('purchases'), suppliers: arr('suppliers'), invoices: arr('invoices'), ledger: arr('ledger') };
        const cur = { products: products.length, purchases: (puAll || []).length, suppliers: (puSuppliers || []).length, invoices: (billAll || []).length, ledger: (lgAll || []).length };
        const lbl = { products: 'أصناف', purchases: 'واردات', suppliers: 'مذاخر', invoices: 'فواتير', ledger: 'سجل الدفتر' };
        const row = k => '<div class="wa-li"><span>' + lbl[k] + ': <b>' + num(L2[k].length) + '</b> في الملف · عندك الآن ' + num(cur[k]) + '</span></div>';
        // قوائم الجرد تنتقل ضمن ملحقات الملف (لا ضمن الأصناف): نعرض ما في الملف مقابل ما عندك حتى تتأكد قبل التطبيق
        const cnSum = a => ({ n: a.length, g: a.reduce((s2, l) => s2 + ((l && l.groups) || []).length, 0), r: a.reduce((s2, l) => s2 + ((l && l.rows) || []).length, 0) });
        const cnFile = (f.extras && Array.isArray(f.extras.diwanCountLists)) ? f.extras.diwanCountLists.filter(x => x && x.id !== undefined) : null;
        let cnNow = []; try { cnNow = typeof cnLocal === 'function' ? cnLocal() : []; } catch (e) { cnNow = []; }
        const cf = cnFile ? cnSum(cnFile) : null, cc = cnSum(cnNow);
        const cnRow = cf ? '<div class="wa-li"><span>قوائم الجرد: <b>' + num(cf.n) + '</b> في الملف (' + num(cf.g) + ' مجموعة · ' + num(cf.r) + ' سطر) · عندك الآن ' + num(cc.n) + ' (' + num(cc.g) + ' مجموعة · ' + num(cc.r) + ' سطر)</span></div>'
            : '<div class="wa-li warn"><span>قوائم الجرد: <b>غير موجودة في الملف</b> (عندك الآن ' + num(cc.n) + ')</span></div>';
        // ما سيُحذف من الحاسوب عند «مطابقة تامة» لأنه ليس في الملف
        const curOf = k => (k === 'products' ? products : k === 'purchases' ? puAll : k === 'suppliers' ? puSuppliers : k === 'invoices' ? billAll : lgAll) || [];
        const goneTxt = Object.keys(lbl).map(k => { const inFile = new Set(L2[k].map(x => String(x.id))); const n = curOf(k).filter(x => x && x.id !== undefined && !inFile.has(String(x.id))).length; return n ? num(n) + ' ' + lbl[k] : ''; }).filter(Boolean).join('، ');
        const goneRow = goneTxt ? '<div class="wa-li warn"><span>⚠️ عند «مطابقة تامة» سيُحذف من الحاسوب لأنه ليس في الملف: <b>' + goneTxt + '</b>. أوقف المطابقة التامة إن أردت الإبقاء عليها (دمج).</span></div>' : '';
        const html = '<div class="wa-pv"><div class="wa-pv-h"><b>' + esc((f.from && f.from.name) || 'المدير') + '</b><small>أُعدّت ' + esc(ago(f.at)) + '</small></div>' + Object.keys(lbl).map(row).join('') + cnRow + goneRow +
            '<div class="qk-row" style="margin-top:8px"><div><b>مطابقة تامة</b><small>تصبح بيانات الحاسوب نسخة طبق الأصل من الجوال، ويُحذف ما ليس في الملف. عند الإيقاف: دمج (الملف يغلب عند التطابق ولا يُحذف شيء).</small></div><label class="setup-sw"><input type="checkbox" id="waFullExact" checked><i></i></label></div>' +
            '<div class="wa-li mut"><span>تُحفظ نسخة احتياطية على الحاسوب قبل التطبيق، ولا تُكتب أي بيانات في السحابة.</span></div></div>';
        const r = await Swal.fire({ title: 'استيراد نسخة كاملة من الجوال', html, showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', preConfirm: () => { const el = document.getElementById('waFullExact'); return { exact: !el || el.checked }; } });
        if (!r.isConfirmed) return;
        const exact = !(r.value && r.value.exact === false);
        if (busy) return; busy = true; window.__waImporting = true;
        const h = Prog.start('استيراد النسخة الكاملة', { text: 'نسخة احتياطية قبل التطبيق...' });
        try {
            const b = await window.diwanDesktop.writeBackup(JSON.stringify(buildFullBackup())); if (!b || !b.ok) throw new Error('تعذر حفظ النسخة الاحتياطية، لم يُطبَّق شيء');
            h.set(25, 'تطبيق الأصناف...');
            const merge = (curArr, inc, tsf) => { const m = new Map((curArr || []).map(x => [String(x.id), x])); inc.forEach(x => { const o = m.get(String(x.id)); if (!o || !tsf || tsf(x) >= tsf(o)) m.set(String(x.id), x); }); return [...m.values()]; };
            if (exact) products = L2.products.slice(); else { const m = new Map(products.map(p => [String(p.id), p])); L2.products.forEach(p => m.set(String(p.id), p)); products = [...m.values()]; }
            products.sort((a, b2) => (b2.id > a.id ? 1 : b2.id < a.id ? -1 : 0));
            h.set(50, 'تطبيق السجلات...');
            const ts = { purchases: r2 => String(r2.editedAt || r2.cancelledAt || r2.createdTs || ''), invoices: r2 => String(r2.editedAt || r2.cancelledAt || r2.issuedTs || ''), ledger: r2 => String(r2.upd || ''), suppliers: null };
            const pick = k => exact ? L2[k].slice() : merge(k === 'purchases' ? puAll : k === 'suppliers' ? puSuppliers : k === 'invoices' ? billAll : lgAll, L2[k], ts[k]);
            puAll = pick('purchases').sort((a, b2) => String(b2.date).localeCompare(String(a.date)) || String(b2.createdTs).localeCompare(String(a.createdTs))); lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500)));
            puSuppliers = pick('suppliers'); lsSet(PU_LS.sup, JSON.stringify(puSuppliers));
            billAll = pick('invoices').sort((a, b2) => String(b2.issuedTs || b2.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt))); lsSet(BILL_LS.list, JSON.stringify(billAll));
            lgAll = pick('ledger'); lsSet(LG_LS.list, JSON.stringify(lgAll));
            h.set(75, 'تطبيق الإعدادات...');
            if (exact) { if (Array.isArray(d.departments)) departments = d.departments; if (Array.isArray(d.subCategories)) subCategories = d.subCategories; if (d.deptSubs && typeof d.deptSubs === 'object') deptSubs = d.deptSubs; if (d.taxLegacy && Array.isArray(d.taxLegacy.d)) taxLegacy = d.taxLegacy; }
            else { if (Array.isArray(d.departments)) departments = [...new Set([...departments, ...d.departments])]; if (Array.isArray(d.subCategories)) subCategories = [...new Set([...subCategories, ...d.subCategories])]; if (d.deptSubs && typeof d.deptSubs === 'object') deptSubs = { ...deptSubs, ...d.deptSubs }; }
            if (d.learn && typeof learnImport === 'function') { try { learnImport(d.learn, true); } catch (e) { /* تجاهل */ } }
            if (typeof d.lowStockThreshold === 'number') lowStockThreshold = d.lowStockThreshold;
            if (Array.isArray(d.alertMonths) && d.alertMonths.length === 3) alertMonths = d.alertMonths;
            if (d.pricingCfg) pricingCfg = normPricingCfg(d.pricingCfg);
            if (d.formCfg && typeof formCfgImport === 'function') { try { formCfgImport(d.formCfg); } catch (e) { /* تجاهل */ } }
            if (Array.isArray(d.trash)) { try { lsPut(LS_TRASH, d.trash); } catch (e) { /* تجاهل */ } }
            try { bkApplyExtras(d); } catch (e) { /* تجاهل */ }
            try { applyExtras(f.extras, exact); } catch (e) { /* تجاهل */ }
            h.set(90, 'حفظ على الجهاز...');
            try { syncStockLocal(products); } catch (e) { /* تجاهل */ }
            saveLocal(); try { renderAll(); } catch (e) { /* تجاهل */ }
            h.ok('تم: ' + num(products.length) + ' صنف و' + num(billAll.length) + ' فاتورة');
        } catch (e) { h.fail('لم يُطبَّق شيء', (e && e.message) || ''); }
        finally { busy = false; window.__waImporting = false; refresh(); }
    }
    async function importMgr(f) {
        if (!isOwner() || !window.diwanDesktop) { await Swal.fire({ icon: 'info', title: 'ملف للحاسوب', text: 'هذا الملف يُفتح في تطبيق المدير على الحاسوب فقط.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const kid = 'mg:' + f.kid, imp = impSet(), ops0 = (Array.isArray(f.ops) ? f.ops : []).filter(o => o && typeof o === 'object' && safeId(o.id)).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        const stockOps = [], recOps = []; let dup = 0, bad = 0;
        ops0.forEach(o => {
            if (imp.has(o.id)) { dup++; return; }
            if (o.type === 'stock' && o.data && Array.isArray(o.data.entries) && o.data.op && o.data.op.key) stockOps.push({ id: o.id, type: 'stock', ts: o.ts, clean: cleanStock(o), nk: !!o.data.op.nk, raw: o.data.entries });
            else if ((o.type === 'invoice' || o.type === 'purchase') && o.data && o.data.rec && safeId(String(o.data.rec.id)) && Array.isArray(o.data.rec.items)) recOps.push({ id: o.id, type: o.type, ts: o.ts, rec: o.data.rec });
            else bad++;
        });
        const inf = f.info || {}, loc = new Map(products.map(p => [String(p.id), p]));
        const pch = (inf.p || []).filter(x => { if (!x || x.pid === undefined || !x.info) return false; const p = loc.get(String(x.pid)); if (!p) return !tombNewer(x.pid, f.at); if (p.metaUpdatedAt && x.info.metaUpdatedAt && p.metaUpdatedAt > x.info.metaUpdatedAt) return false; const s = I.pSplit(p); return I.hsh(I.stable({ i: s.info, c: s.cost })) !== I.hsh(I.stable({ i: x.info, c: x.cost || {} })); });
        const rch = (inf.rec || []).filter(x => { if (!x || !x.rec || !x.rec.id || (x.coll !== 'suppliers' && x.coll !== 'ledger')) return false; const arr = x.coll === 'suppliers' ? puSuppliers : lgAll; const o = (arr || []).find(y => y.id === x.rec.id); return !o || I.stable(o) !== I.stable(x.rec); });
        const cfgCh = !!inf.cfg && !(inf.cfgAt && cfgAtNow() > inf.cfgAt) && I.stable(inf.cfg) !== I.stable(I.cfgNow());
        const cloudLiveD = typeof cloudReady === 'function' && cloudReady() && navigator.onLine;   // الحاسوب متصل بالسحابة: لا نحذف ولا نغيّر الأرصدة محلياً (السحابة هي المرجع)
        const dP = cloudLiveD ? [] : (inf.delP || []).filter(k => loc.has(String(k)));
        const dR = cloudLiveD ? [] : (inf.delR || []).filter(k => { const i2 = String(k).indexOf(':'), c = k.slice(0, i2), id = k.slice(i2 + 1), arr = c === 'suppliers' ? puSuppliers : c === 'ledger' ? lgAll : null; return arr && arr.some(y => String(y.id) === id); });
        if (!stockOps.length && !recOps.length && !pch.length && !rch.length && !cfgCh && !dP.length && !dR.length) { await Swal.fire({ icon: 'info', title: dup ? 'استُورد هذا الملف سابقاً' : 'لا توجد تغييرات', text: dup ? 'كل حركاته موجودة عندك.' : 'بياناتك مطابقة لما في الملف.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
        const li = (t, c) => '<div class="wa-li ' + (c || '') + '"><span>' + t + '</span></div>';
        const nInv = recOps.filter(o => o.type === 'invoice').length, nPur = recOps.length - nInv;
        let body = '<div class="wa-pv"><div class="wa-pv-h"><b>' + esc((f.from && f.from.name) || 'المدير') + '</b><small>أُرسل ' + esc(ago(f.at)) + '</small></div>';
        if (stockOps.length) body += li('📦 حركات مخزون: <b>' + num(stockOps.length) + '</b>');
        if (nInv) body += li('🧾 فواتير: <b>' + num(nInv) + '</b>'); if (nPur) body += li('🚚 واردات: <b>' + num(nPur) + '</b>');
        if (pch.length) body += li('💊 مواد وأسعار تغيّرت: <b>' + num(pch.length) + '</b>');
        if (rch.length) body += li('📒 مذاخر ودفتر: <b>' + num(rch.length) + '</b>');
        if (cfgCh) body += li('⚙️ الإعدادات ستُحدَّث');
        if (dP.length || dR.length) body += li('🗑️ محذوفات ستُحذف أيضاً: <b>' + num(dP.length + dR.length) + '</b>', 'warn');
        if (dup) body += li('♻️ مستوردة سابقاً (ستُتخطى): ' + num(dup), 'mut'); if (bad) body += li('🚫 غير صالحة: ' + num(bad), 'bad');
        body += li('ستُحفظ نسخة احتياطية قبل التطبيق.', 'mut') + '</div>';
        const r = await Swal.fire({ title: 'استيراد تحديثات من الجوال', html: body, showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return;
        if (busy) return; busy = true; window.__waImporting = true;
        const h = Prog.start('استيراد تحديثات الجوال', { text: 'نسخة احتياطية قبل التطبيق...' });
        const rep = { inv: 0, invStale: 0, renum: 0, stock: 0, missing: 0, counted: 0, already: 0, over: new Set(), fail: [] }; let pi = 0, pSkip = 0;
        try {
            try { const b = await window.diwanDesktop.writeBackup(JSON.stringify(buildFullBackup())); if (!b || !b.ok) throw new Error('تعذر حفظ النسخة الاحتياطية، لم يُطبَّق شيء'); } catch (e) { throw new Error((e && e.message) || 'تعذر حفظ النسخة الاحتياطية'); }
            const dev = { kid, label: (f.from && f.from.name) || 'المدير' }, total = stockOps.length + recOps.length + pch.length + rch.length + 1; let i = 0;
            const tick = () => { i++; if (i % 5 === 0 || i === total) h.set(Math.round(i / total * 100), 'طُبّق ' + i + ' من ' + total); };
            // المعلومات أولاً: مادة جديدة يجب أن تُنشأ قبل أن تصلها حركاتها
            for (const x of pch) { try { if (L._i.trackIngest('pinfo', { pid: x.pid, info: x.info, cost: x.cost, init: x.init })) pi++; else pSkip++; } catch (e) { rep.fail.push('p' + x.pid); } tick(); }
            if (cfgCh) { try { L._i.trackIngest('cfg', { cfg: inf.cfg }); setCfgAt(inf.cfgAt); } catch (e) { rep.fail.push('cfg'); } }
            for (const x of rch) { try { L._i.trackIngest('rec', { coll: x.coll, rec: x.rec }); } catch (e) { rep.fail.push(x.coll); } tick(); }
            tick();
            if (dP.length) { const ds = new Set(dP.map(String)); products = products.filter(p => !ds.has(String(p.id))); addTomb(dP); }
            dR.forEach(k => { const i2 = k.indexOf(':'), c = k.slice(0, i2), id = k.slice(i2 + 1); if (c === 'suppliers') puSuppliers = puSuppliers.filter(y => String(y.id) !== id); else lgAll = lgAll.filter(y => String(y.id) !== id); });
            if (dR.length) { try { lsSet(PU_LS.sup, JSON.stringify(puSuppliers)); lsSet(LG_LS.list, JSON.stringify(lgAll)); } catch (e) { /* تجاهل */ } }
            const all = stockOps.concat(recOps).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
            for (const op of all) {
                try {
                    if (op.type === 'stock') { if (op.nk ? applyLocalAdj(op, rep) : await applyStock(op, false, rep)) rep.stock++; }
                    else if (op.type === 'invoice') await applyInvoice(op, f, dev, rep);
                    else await applyPurchase(op, rep);
                    markImp(kid, op.id);
                } catch (e) { rep.fail.push(op.id + ': ' + ((e && e.message) || e)); }
                tick();
            }
            if (!cloudLiveD && inf.sf && typeof inf.sf === 'object') Object.keys(inf.sf).forEach(pid => { const p = loc.get(String(pid)) || products.find(x => String(x.id) === String(pid)); if (!p) return; const st = inf.sf[pid] || {}; ['bt', 'expiryDate', 'expiryDates', 'counted'].forEach(k => { if (st[k] !== undefined) p[k] = st[k]; else if (k !== 'counted') delete p[k]; }); });
            try { if (typeof L.pushDirty === 'function') await L.pushDirty(); } catch (e) { /* يبقى معلّماً للرفع لاحقاً */ }
            try { saveLocal(); } catch (e) { /* تجاهل */ } try { renderAll(); } catch (e) { /* تجاهل */ }
            const lg = ls.get(K.log, []); lg.unshift({ at: nowIso(), kid, label: dev.label, inv: rep.inv, stock: rep.stock, missing: rep.missing, counted: 0, over: [...rep.over].slice(0, 8), fail: rep.fail.length }); ls.set(K.log, lg.slice(0, 30));
            if (rep.fail.length) h.fail('اكتمل مع أخطاء', 'تعذّر ' + rep.fail.length + '؛ أعد فتح الملف نفسه لتكتمل (ما استُورد لا يتكرر)');
            else h.ok('تم الاستيراد');
        } catch (e) { h.fail('لم يُطبَّق شيء', (e && e.message) || ''); }
        finally { busy = false; window.__waImporting = false; refresh(); }
        let b2 = li('💊 مواد وإعدادات طُبّقت: <b>' + num(pi) + '</b>') + li('📦 حركات مخزون: <b>' + num(rep.stock) + '</b>') + li('🧾 فواتير ووارد: <b>' + num(rep.inv + (rep.pur || 0)) + '</b>');
        if (pSkip) b2 += li('مواد عندك فيها تعديل غير مرسل فلم تُستبدل: ' + num(pSkip), 'warn');
        if (rep.viaCloud) b2 += li('جرد وتعديلات كمية تنتقل عبر السحابة (تصل عند المزامنة): ' + num(rep.viaCloud), 'mut');
        if (rep.already) b2 += li('حركات سُجّلت سابقاً في السحابة: ' + num(rep.already), 'mut');
        if (rep.missing) b2 += li('مواد غير موجودة (لم تُخصم): ' + num(rep.missing), 'warn');
        if (rep.over.size) b2 += li('رصيد غير كافٍ (صار صفراً): ' + esc([...rep.over].slice(0, 6).join('، ')), 'warn');
        await Swal.fire({ icon: rep.fail.length ? 'warning' : 'success', title: rep.fail.length ? 'اكتمل جزئياً' : 'تم الاستيراد', html: '<div class="wa-pv">' + b2 + '</div>', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    }
    // جرد/ضبط كمية من الجوال: يُطبَّق محلياً فقط. إن كان الحاسوب متصلاً بالسحابة فهي تنقله (الجوال كتبه فيها) فلا نكتب مرة ثانية.
    function applyLocalAdj(op, rep) {
        if (typeof cloudReady === 'function' && cloudReady() && navigator.onLine) { rep.viaCloud = (rep.viaCloud || 0) + 1; return false; }
        let n = 0;
        (op.raw || []).forEach(en => {
            const p = products.find(x => String(x.id) === String(en && en.pid)); if (!p) { rep.missing++; return; }
            const sc = btSc(p), dq = iso(en.dq), dl = iso(en.dl), cur = (parseInt(p.qty) || 0) * sc + (sc > 1 ? (parseInt(p.loose) || 0) : 0), nt = Math.max(0, cur + dq * sc + (sc > 1 ? dl : 0));
            p.qty = Math.floor(nt / sc); p.loose = sc > 1 ? nt % sc : 0;
            if (en.mark) p.counted = true; if (en.unmark) p.counted = false;
            p.inStock = !p.arch && (p.qty > 0 || p.loose > 0);
            try { syncStockLocal([p]); } catch (e) { /* تجاهل */ } n++;
        });
        return n > 0;
    }
    async function applyPurchase(op, rep) {
        const rec = JSON.parse(JSON.stringify(op.rec)), r0 = { inv: 0, pur: 0, stale: 0, renum: 0, stock: 0, skipped: [], touched: new Set() };
        I.applyRecordOp('purchase', rec, r0);
        if (r0.stale) return;
        const saved = (typeof puAll !== 'undefined' ? puAll : []).find(x => x.id === rec.id) || rec;
        if (L.net()) L.captureRecord('purchase', saved);
        else if (cloudReady() && (navigator.onLine || persistenceOn)) { try { await fsSet(db.collection('pharmacy_purchases').doc(saved.id), JSON.parse(JSON.stringify(saved))); } catch (e) { lsSet('diwanNeedsPush', '1'); } }
        else lsSet('diwanNeedsPush', '1');
        rep.pur = (rep.pur || 0) + 1;
    }
    // زر واحد: المدير يرسل التحديثات، والمستخدم يرسل مبيعاته
    function quickSend() { return isOwner() ? exportShare() : exportSales(); }
    // فتح ملف وصل من واتساب (من نظام الأندرويد أو من الاستيراد اليدوي): استيراد مباشر بمعاينة
    let opening = false;
    async function openText(text) {
        try {
            text = String(text || ''); if (!text) return;
            const key = I.hsh(text.slice(0, 4000) + text.length);
            if (window.__dwOpenKey === key && Date.now() - (window.__dwOpenAt || 0) < 30000) return;   // المحاولات المتكررة من النظام
            window.__dwOpenKey = key; window.__dwOpenAt = Date.now();
            let probe; try { probe = JSON.parse(text); } catch (e) { probe = null; }
            if (!probe || probe.diwan !== 1) { toast('error', 'هذا الملف ليس من تطبيق الديوان'); return; }
            const t0 = Date.now();
            while ((typeof currentUser === 'undefined' || !currentUser || typeof products === 'undefined' || !products.length) && Date.now() - t0 < 90000) await new Promise(r => setTimeout(r, 800));   // ننتظر دخول المستخدم وتحميل البيانات
            if (opening) return; opening = true;
            try { await importFlow({ text, name: 'whatsapp' }); } finally { opening = false; }
        } catch (e) { opening = false; toast('error', 'تعذّر فتح الملف'); }
    }
    window.dwOpenFile = openText;

    // ---------------- الواجهة ----------------
    const sw = (id, chk, fn) => '<label class="setup-sw"><input type="checkbox" id="' + id + '" ' + (chk ? 'checked' : '') + ' onchange="' + fn + '"><i></i></label>';
    const btn = (cls, fn, t, sub) => '<button type="button" class="set-nav ' + cls + '" onclick="' + fn + '"><div><b>' + t + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div><i>‹</i></button>';
    function html(emb) { let o = html0(); if (emb) o = o.replace(/onclick="WA\.(exportShare|exportSales|importFlow|exportDesktop|exportFull|showLog)\(([^"]*)\)"/g, (m, f, a) => 'onclick="WA.act(\'' + f + '\',' + (a || 'undefined') + ')"'); return o; }
    function html0() {
        if (isOwner()) {
            const lg = ls.get(K.log, []);
            let h = '<p class="set-desc wa-intro">تبادل موازٍ للسحابة: يرسل المدير ما تغيّر فقط (مواد وأسعار وإعدادات)، ويرسل المستخدم مبيعاته. الملف يُفتح من واتساب فيُستورد تلقائياً، ولا يتكرر ما وصل من السحابة.</p>';
            h += btn('set-act wa-main', 'WA.exportShare()', '📤 إرسال التحديثات للمستخدمين', 'المواد والأسعار والإعدادات التي تغيّرت منذ آخر إرسال فقط.');
            if (!window.diwanDesktop) h += btn('set-act wa-main', 'WA.exportFull()', '🖥️ نسخة كاملة إلى الحاسوب', 'كل ما في جوالك: الأصناف بكمياتها وكلفها، الفواتير، الواردات، المذاخر، الدفتر، الإعدادات. تظهر على الحاسوب بالضبط.');
            if (!window.diwanDesktop) h += btn('set-act', 'WA.exportDesktop()', '🖥️ إرسال التحديثات إلى الحاسوب', 'ملف للحاسوب فيه حركات المخزون والفواتير والوارد والمواد (بالكلفة) والإعدادات. يُفتح في تطبيق المدير على الحاسوب فقط.');
            h += btn('set-act', 'WA.exportShare({full:true})', '📦 إرسال ملف كامل', 'كل المواد والإعدادات (لمستخدم جديد).');
            h += btn('set-act', 'WA.showLog()', '📋 سجل التبادل', 'ما أُرسل وما لم يُرسل، مع اختيار عمليات وفترة زمنية.');
            h += btn('set-act wa-main', 'WA.importFlow()', '📥 استيراد ملف', 'اختر ملفاً وصلك على واتساب إن لم يُفتح تلقائياً.');
            if (lg.length) { h += '<h5 class="wa-h">آخر عمليات الاستيراد</h5>'; lg.slice(0, 5).forEach(x => { h += '<div class="wa-log"><b>' + esc(x.label) + '</b><span>' + esc(ago(x.at)) + '</span><small>' + num(x.inv) + ' فاتورة · ' + num(x.stock) + ' حركة' + (x.fail ? ' · ' + num(x.fail) + ' خطأ' : '') + '</small></div>'; }); }
            return h;
        }
        const lk = link(), on = waOn(), un = unsent(), sm = summarize(un), conf = groups(unconfirmed()), le = ls.get('diwanWaLastExp', null), sa = ls.get(K.snapAt, '');
        if (!on) {   // التبادل الموازي للسحابة: بلا ربط ولا إيقاف للسحابة
            let g = '<p class="set-desc wa-intro">تبادل عبر واتساب بالتوازي مع السحابة: يُرسل ملف صغير فيه ما لا يملكه الطرف الآخر فقط، وعند فتحه من واتساب يُستورد تلقائياً. لا يتعارض مع السحابة؛ ما وصل منها مسبقاً لا يتكرر.</p>';
            if (unsentBytes() > 750000) g += '<div class="wa-li warn"><span>لديك مبيعات كثيرة غير مُرسَلة (' + kb(unsentBytes()) + ')، أرسلها للمدير الآن حتى لا يمتلئ مخزن الجهاز.</span></div>';
            g += btn('set-act wa-main', 'WA.exportSales()', '📤 إرسال مبيعاتي للمدير', un.length ? num(un.length) + ' عملية لم تُرسل.' : 'لا توجد مبيعات جديدة.');
            g += btn('set-act', 'WA.exportSales({all:true})', '🔁 إعادة إرسال ما لم يؤكده المدير', 'التكرار آمن ولا يضاعف شيئاً.');
            g += btn('set-act', 'WA.importFlow()', '📥 استيراد ملف', sa ? 'آخر تحديث: ' + esc(ago(sa)) : 'اختر الملف الذي وصلك على واتساب.');
            if (!lk) return g;
            let h = g;
            h += '<div class="qk-row"><div><b>وضع واتساب</b><small>' + (on ? 'مفعّل: لا اتصال بالسحابة، والمبيعات تُرسل كملف.' : 'متوقف: الجهاز يعمل مع السحابة كالمعتاد.') + '</small></div>' + sw('waSw', on, 'WA.toggleMode(this)') + '</div>';
            return h;
        }
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
        const hs = [document.getElementById('waHost'), document.getElementById('waOvBody'), document.getElementById('waHostSs')];
        hs.forEach(el => { if (el) { try { el.innerHTML = html(el.id === 'waHostSs'); } catch (e) { el.innerHTML = '<div class="wa-empty">تعذّر العرض</div>'; } } });
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

    window.WA = { showLog, exportFull, exportDesktop, act: async (f, a) => { try { await WA[f](a); } finally { setTimeout(() => { try { if (document.getElementById('waHostSs') === null && typeof showSyncStatus === 'function') showSyncStatus(); } catch (e) { /* تجاهل */ } }, 200); } }, hostHtml: () => html(true), tapStock, tapRecord, exportShare, quickSend, openText, loadUsers, renewKey, add, noteCount, pendingCount, open, close, render: refresh, exportSales, importFlow, exportSnapshot, setLink, unlink, toggleMode, addDevice, showCode, delDevice, on: waOn, _skip: null, _t: { sha256, hmacHex, sign, parseCode, codeOf, planSales, cleanStock, devs, impSet, link, ops, unsent, unconfirmed, summarize, applySales, importSnapshot, parseFile, K } };
    window.addEventListener('load', () => setTimeout(refresh, 1500));
    try {   // الحاسوب: ملف .dwsync فُتح بالنقر المزدوج
        const DD = window.diwanDesktop;
        if (DD && DD.onFile && DD.takeFile) { const take = async () => { try { const t = await DD.takeFile(); if (t) openText(t); } catch (e) { /* تجاهل */ } }; DD.onFile(take); setTimeout(take, 3500); }
    } catch (e) { /* تجاهل */ }
})();
