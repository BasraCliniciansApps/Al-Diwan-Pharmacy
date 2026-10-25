// ============================================================================
// شريط التقدّم الموحّد: يظهر أعلى الشاشة لأي عملية (تحميل/رفع/حفظ/استيراد) ويبيّن النسبة والوقت والتأخير والخطأ
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
        h.drop = () => { h.state = 'drop'; if (Prog.cur === h) { Prog.cur = null; } };
        h.close = () => { if (Prog.cur === h) Prog.hide(); };
        Prog.cur = h; Prog.paint();
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
    hide() { if (Prog.el) Prog.el.hidden = true; clearInterval(Prog.timer); Prog.cur = null; },
    fmtT(s) { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' ث' : Math.floor(s / 60) + ' د ' + (s % 60) + ' ث'; },
    paint() {
        const h = Prog.cur, el = Prog.el; if (!h || !el) return;
        el.hidden = false;
        const now = Date.now(), el_s = (now - h.t0) / 1000, idle = (now - h.last) / 1000, det = h.pct !== null;
        const pct = det ? Math.round(h.pct) : 0;
        let note = '', cls = h.state;
        if (h.state === 'run') {
            if (!navigator.onLine) { note = '📴 ما كو إنترنت — العملية تنتظر رجوع الاتصال'; cls = 'warn'; }
            else if (idle > 40) { note = '⚠️ ما كو تقدّم من ' + Prog.fmtT(idle) + ' — غالباً الإنترنت ضعيف أو العملية عالقة. تقدر تسكّرها وتعيد المحاولة'; cls = 'stuck'; }
            else if (idle > 12) { note = '⏳ بطيئة شوي (الاتصال ضعيف) — ما زالت شغالة، لا تسكّر التطبيق'; cls = 'warn'; }
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
