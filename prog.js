// ============================================================================
// شريط التقدّم الموحّد: خط داخل ترويسة النافذة التي بدأت فيها العملية (يختفي معها) + قرص صغير بالترويسة يبقى ما دامت العملية جارية (تحميل/رفع/حفظ/استيراد) ويبيّن النسبة والوقت والتأخير والخطأ
// الاستخدام: const h = Prog.start('العنوان'); h.set(40,'نص'); h.tick(i,n); h.ok('تم'); h.fail('سبب');
// الحلقات الداخلية (pushToCloud مثلاً) تستدعي progTick(i,n) وتنضم تلقائياً لأي عملية شغالة.
// ============================================================================
const Prog = {
    cur: null, el: null, timer: null,
    start(title, o) {
        o = o || {};
        if (Prog.cur) Prog.cur.drop();
        Prog.mount();
        const h = { title, pct: o.indeterminate === false ? 0 : null, text: o.text || '', t0: Date.now(), last: Date.now(), state: 'run', lo: 0, hi: 100, pctShown: 0 };
        h.set = (p, t) => { if (h.state !== 'run') return h; if (p !== null && p !== undefined) h.pct = Math.max(h.pct || 0, Math.min(99, p)); if (t !== undefined) h.text = t; h.last = Date.now(); Prog.paint(); return h; };
        h.text_ = t => { h.text = t; h.last = Date.now(); Prog.paint(); return h; };
        h.tick = (i, n, t) => { if (n > 0) h.set(h.lo + (h.hi - h.lo) * Math.min(i, n) / n, t); else if (t !== undefined) h.text_(t); return h; };
        h.span = (lo, hi) => { h.lo = lo; h.hi = hi; return h; };
        h.ok = msg => { if (h.state !== 'run') return; h.state = 'ok'; h.pct = 100; h.text = msg || 'تم بنجاح'; Prog.paint(); setTimeout(() => { if (Prog.cur === h) Prog.hide(); }, 2600); };
        h.fail = (msg, why) => { if (h.state !== 'run') return; h.state = 'err'; h.text = msg || 'فشلت العملية'; h.why = why || ''; Prog.paint(); };
        h.drop = () => { h.state = 'drop'; Prog.detach(h); if (Prog.cur === h) { Prog.cur = null; Prog.chipHide(); } };
        h.close = () => { if (Prog.cur === h) Prog.hide(); };
        Prog.cur = h; h.layer = Prog.topLayer(); h.line = null; Prog.paint();
        clearInterval(Prog.timer); Prog.timer = setInterval(Prog.paint, 500);
        return h;
    },
    // فتح عملية فقط إن ما كانت شغالة وحدة (للدوال المشتركة): يرجع {h, own}
    open(title, o) { return Prog.cur && Prog.cur.state === 'run' ? { h: Prog.cur, own: false } : { h: Prog.start(title, o), own: true }; },
    end(x, how, msg) { if (!x || !x.own) return; if (how === 'ok') x.h.ok(msg); else if (how === 'quiet') x.h.close(); else x.h.fail(msg); },
    mount() {
        if (Prog.el) return;
        const el = document.createElement('div'); el.id = 'progBox'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.hidden = true;
        document.body.appendChild(el); Prog.el = el;
    },
    // ===== ربط الشريط بالنافذة: الشريط عنصر داخل ترويسة النافذة نفسها فيتحرك ويختفي معها =====
    LAYERS: '.swal2-popup, .px-sheet, .modal-overlay .modal-card, .tax-rv, .cn-ov, .p2-ov, .pos-ov, .help-hub, .lg-ov, .wa-ov, .qi-ov, .srt-sheet, .bottom-sheet.open, .hm-sheet, .hs-panel, .app-view, #stockView',
    HDR: '.hd-2, .tr-head, .cn-head, .pos-head, .p2-head, .fm-top, .sh-bar, .sh-sbar, .rv-top, .lg-title, .px-hd, .help-top, .mc-hd, .inv-head, .dw-title, .top-bar, .bill-top, .page-title',
    shown(e) {
        if (!e || !e.isConnected) return false;
        if (e.closest('.swal2-hide, .dw-out-page, .dw-out-card, .dw-out-sheet')) return false;
        const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
        const r = e.getBoundingClientRect(); if (r.width < 60 || r.height < 40 || r.bottom <= 0 || r.top >= window.innerHeight - 10 || r.right <= 0 || r.left >= window.innerWidth) return false;   // خارج الشاشة (ورقة مطويّة) = غير ظاهرة
        const ov = e.closest('.modal-overlay'); if (ov && getComputedStyle(ov).display === 'none') return false;
        return true;
    },
    zOf(e) { let z = 0; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const v = parseInt(getComputedStyle(n).zIndex, 10); if (!isNaN(v) && v > z) z = v; } return z; },
    // أعلى نافذة ظاهرة الآن (الأعلى طبقةً ثم الأحدث في الشجرة)
    topLayer() {
        let best = null, bz = -1;
        try {
            document.querySelectorAll(Prog.LAYERS).forEach(e => {
                if (!Prog.shown(e)) return;
                if ((e.classList.contains('app-view') || e.id === 'stockView') && e.id !== 'homeView' && !e.offsetParent && getComputedStyle(e).position !== 'fixed') return;
                const z = Prog.zOf(e);
                if (z > bz || (z === bz && best && (best.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING))) { best = e; bz = z; }
            });
        } catch (e) { return null; }
        return best;
    },
    darkBg(e) { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(n).backgroundColor || ''); if (m && (m[4] === undefined || parseFloat(m[4]) > 0.6)) return (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) < 90; } return false; },
    // الحافة التي يُرسم عليها الخط: أسفل الترويسة الكحلية إن وُجدت، وإلا أعلى النافذة نفسها
    edgeOf(layer) {
        let hd = null;
        if (layer.classList.contains('app-view') || layer.id === 'stockView') hd = layer.querySelector('.top-bar') || layer.querySelector('.page-title') || null;
        else {   // الترويسة قد تتكوّن من شريطين متتاليين (مثل عنوان الإعدادات + شريط البحث): نختار الأسفل ضمن أعلى النافذة
            const lt = layer.getBoundingClientRect().top; let bb = -1;
            [...layer.querySelectorAll(Prog.HDR)].forEach(e => { const r = e.getBoundingClientRect(); if (r.height > 20 && r.width > 100 && r.top - lt < 200 && Prog.shown(e) && Prog.darkBg(e) && r.bottom > bb) { hd = e; bb = r.bottom; } });
            if (!hd && layer.matches(Prog.HDR)) hd = layer;
        }
        if (hd && Prog.darkBg(hd)) return { el: hd, at: 'bottom' };
        return { el: layer, at: 'top' };
    },
    // ربط العملية بنافذتها (يُستدعى عند البدء وعند فقدان العنصر بسبب إعادة رسم الترويسة)
    attach(h) {
        if (h.layer && !Prog.shown(h.layer)) { Prog.detach(h); return; }   // النافذة أُغلقت: يختفي الخط معها وتبقى العملية بالقرص فقط
        if (!h.layer) { h.layer = Prog.topLayer(); if (!h.layer) return; }
        if (h.line && h.line.isConnected) return;
        const ed = Prog.edgeOf(h.layer); if (!ed.el) return;
        if (getComputedStyle(ed.el).position === 'static') { ed.el.style.position = 'relative'; ed.el.dataset.hdpos = '1'; }
        const ln = document.createElement('i'); ln.className = 'hd-prog' + (ed.at === 'top' ? ' at-top' : ''); ln.setAttribute('aria-hidden', 'true');
        ln.innerHTML = '<b></b>'; ed.el.appendChild(ln); h.line = ln;
    },
    detach(h) { if (h.line) { try { h.line.remove(); } catch (e) { /* تجاهل */ } h.line = null; } },
    // القرص: حلقة تقدم ذهبية تحيط بشعار التطبيق في الترويسة (موضع ثابت). عند الاكتمال تتحول لنقطة ثم تشع وتختفي
    chip() {
        let c = document.getElementById('progChip');
        if (!c) {
            c = document.createElement('div'); c.id = 'progChip'; c.hidden = true; c.setAttribute('role', 'status');
            c.innerHTML = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="pc-tr" cx="22" cy="22" r="19"/><circle class="pc-fg" cx="22" cy="22" r="19"/></svg><u class="pc-dot"></u><u class="pc-r pc-r1"></u><u class="pc-r pc-r2"></u>';
            c.addEventListener('click', () => { const h = Prog.cur; if (h && h.state !== 'run') Prog.hide(); });
            document.body.appendChild(c);
        }
        return c;
    },
    // مرساة القرص: شعار الترويسة الظاهر (نفس المكان بكل النوافذ)، وإلا أعلى يمين الشاشة
    chipPos(c) {
        let best = null;
        try {
            const L = [...document.querySelectorAll('.brand-logo')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 10 && r.top >= -2 && r.bottom < 220 && r.right > 0 && r.left < window.innerWidth && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && +getComputedStyle(e).opacity > 0.05; });
            best = L.find(e => { const r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && (t === e || e.contains(t)); }) || L[0] || null;
        } catch (e) { best = null; }
        let cx, cy, d = 52;
        if (best) { const r = best.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; d = Math.round(Math.max(r.width, r.height) + 12); }
        else { cx = window.innerWidth - 36; cy = 36; }
        c.style.width = c.style.height = d + 'px'; c.style.left = Math.round(cx - d / 2) + 'px'; c.style.top = Math.round(cy - d / 2) + 'px';
    },
    hide() { const h = Prog.cur; if (h) Prog.detach(h); if (Prog.el) Prog.el.hidden = true; Prog.chipHide(); clearInterval(Prog.timer); Prog.cur = null; },
    chipHide() { const c = document.getElementById('progChip'); if (c) { c.hidden = true; c.dataset.m = ''; c.className = ''; } clearInterval(Prog.posTimer); Prog.posTimer = 0; },
    fmtT(s) { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' ث' : Math.floor(s / 60) + ' د ' + (s % 60) + ' ث'; },
    paint() {
        const h = Prog.cur, el = Prog.el; if (!h || !el) return;
        el.hidden = false;
        {   // الخط داخل ترويسة النافذة + القرص بالترويسة
            Prog.attach(h);
            const det = h.pct !== null, stale = (Date.now() - h.last) / 1000 > 12 || !navigator.onLine;
            const cls = h.state === 'ok' ? 'ok' : h.state === 'err' ? 'err' : stale ? 'warn' : 'run';
            const pc = h.state === 'ok' ? 100 : det ? Math.max(3, Math.round(h.pct)) : 100;
            if (h.line) { h.line.className = 'hd-prog pl-' + cls + (det || h.state !== 'run' ? '' : ' ind') + (h.line.classList.contains('at-top') ? ' at-top' : ''); h.line.style.setProperty('--w', pc + '%'); }
            const c = Prog.chip(), mode = cls + (det || h.state !== 'run' ? '' : ' ind');
            if (c.dataset.m !== mode) { c.dataset.m = mode; c.className = 'pc-' + cls + (mode.endsWith('ind') ? ' pc-ind' : ''); }   // لا نعيد الرسم كل مرة حتى لا تُعاد حركة الاكتمال
            c.style.setProperty('--p', h.state === 'ok' ? 100 : det ? Math.max(3, Math.round(h.pct)) : 0);
            c.title = h.title + (h.text ? ' — ' + h.text : '');
            const was = c.hidden; c.hidden = (Date.now() - h.t0) < 500 && h.state === 'run';
            if (!c.hidden) { Prog.chipPos(c); if (!Prog.posTimer) Prog.posTimer = setInterval(() => { const cc = document.getElementById('progChip'); if (cc && !cc.hidden) Prog.chipPos(cc); }, 150); }
        }
        const now = Date.now(), el_s = (now - h.t0) / 1000, idle = (now - h.last) / 1000, det = h.pct !== null;
        const pct = det ? Math.round(h.pct) : 0;
        let note = '', cls = h.state;
        if (h.state === 'run') {
            if (!navigator.onLine) { note = '📴 لا يوجد اتصال بالإنترنت — العملية تنتظر عودة الاتصال'; cls = 'warn'; }
            else if (idle > 40) { note = '⚠️ لا يوجد تقدّم منذ ' + Prog.fmtT(idle) + ' — غالباً الاتصال ضعيف أو العملية عالقة. يمكنك إغلاقها وإعادة المحاولة'; cls = 'stuck'; }
            else if (idle > 12) { note = '⏳ بطيئة قليلاً (الاتصال ضعيف) — ما زالت قيد التنفيذ، لا تغلق التطبيق'; cls = 'warn'; }
        }
        let meta = '';
        if (h.state === 'run') {
            meta = (det ? '<b>' + pct + '٪</b>' : '') + '<span>' + Prog.fmtT(el_s) + '</span>';
            if (det && pct >= 6 && el_s > 2.5) meta += '<span>المتبقي ≈ ' + Prog.fmtT(el_s * (100 - pct) / pct) + '</span>';
        } else if (h.state === 'ok') meta = '<b>100٪</b><span>' + Prog.fmtT(el_s) + '</span>';
        const icon = h.state === 'ok' ? '<i class="pg-i ok">✓</i>' : h.state === 'err' ? '<i class="pg-i err">!</i>' : '<i class="pg-spin"></i>';
        const x = h.state === 'run' ? (cls === 'stuck' || !navigator.onLine ? '<button type="button" class="pg-x" onclick="Prog.hide()" aria-label="إغلاق">✕</button>' : '') : '<button type="button" class="pg-x" onclick="Prog.hide()" aria-label="إغلاق">✕</button>';
        el.className = 'pg-' + cls;
        el.innerHTML = `<div class="pg-top">${icon}<div class="pg-t"><b>${escapeHtml(h.title)}</b><span>${escapeHtml(h.text || '')}</span></div>${x}</div>
            <div class="pg-bar ${det ? '' : 'ind'}"><div class="pg-fill" style="width:${h.state === 'ok' ? 100 : det ? pct : 100}%"></div></div>
            ${meta ? '<div class="pg-meta">' + meta + '</div>' : ''}${note ? '<div class="pg-note">' + escapeHtml(note) + '</div>' : ''}${h.why ? '<div class="pg-why" dir="auto">' + escapeHtml(h.why) + '</div>' : ''}`;
    }
};
function progTick(i, n, t) { if (Prog.cur && Prog.cur.state === 'run') Prog.cur.tick(i, n, t); }
window.addEventListener('online', () => Prog.paint());
window.addEventListener('offline', () => Prog.paint());

// رفع ملف بـ XHR لنعرف نسبة الرفع الحقيقية (fetch ما يعطي تقدّم الرفع)
function progPutJson(url, headers, bodyObj, onProgress) {
    return new Promise((resolve, reject) => {
        const x = new XMLHttpRequest(); x.open('PUT', url); x.timeout = 120000;
        Object.keys(headers || {}).forEach(k => x.setRequestHeader(k, headers[k]));
        x.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
        x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* تجاهل */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, json: j }); };
        x.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
        x.ontimeout = () => reject(new Error('انتهت مهلة الرفع (الاتصال بطيء جداً)'));
        x.send(JSON.stringify(bodyObj));
    });
}
