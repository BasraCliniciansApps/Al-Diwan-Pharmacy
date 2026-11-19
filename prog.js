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
        Prog.cur = h; h.anch = !!Prog.topCard(); Prog.paint();
        clearInterval(Prog.timer); Prog.timer = setInterval(Prog.paint, 500);
        Prog.watch();
        return h;
    },
    // فتح عملية فقط إن ما كانت شغالة وحدة (للدوال المشتركة): يرجع {h, own}
    open(title, o) { return Prog.cur && Prog.cur.state === 'run' ? { h: Prog.cur, own: false } : { h: Prog.start(title, o), own: true }; },
    end(x, how, msg) { if (!x || !x.own) return; if (how === 'ok') x.h.ok(msg); else if (how === 'quiet') x.h.close(); else x.h.fail(msg); },
    mount() {
        if (Prog.el) return;
        const el = document.createElement('div'); el.id = 'progBox'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.hidden = true;
        document.body.appendChild(el); Prog.el = el;
        const ln = document.createElement('div'); ln.id = 'progLine'; ln.hidden = true; ln.innerHTML = '<b class="pl-track"></b><b class="pl-fill"></b>'; document.body.appendChild(ln); Prog.ln = ln;
    },
    // موضع الخط: الحد الفاصل بين الترويسة الكحلية والمحتوى تحتها. داخل النوافذ المنبثقة يلتزم بحدود النافذة نفسها لا بعرض الشاشة
    topCard() {
        let best = null;
        try {
            document.querySelectorAll('.swal2-popup, .px-sheet, .modal-overlay .modal-card, .pos-ov').forEach(e => {
                if (e.classList.contains('swal2-hide') || (e.closest && e.closest('.swal2-container.swal2-backdrop-hide'))) return;   // نافذة قيد الإغلاق: لا يلتزم الخط بها
                const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
                if (r.width < 60 || r.height < 60 || cs.visibility === 'hidden' || cs.display === 'none') return;
                const ov = e.closest('.modal-overlay'); if (ov && getComputedStyle(ov).display === 'none') return;
                if (r.width >= window.innerWidth - 2 && r.top <= 1 && r.height >= window.innerHeight - 2) return;   // شاشة كاملة: ليست نافذة منبثقة
                best = e;
            });
        } catch (e) { return null; }
        return best;
    },
    lineY() {
        const card = Prog.topCard();
        let last = null;
        const dark = e => {
            for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
                const cs = getComputedStyle(n), m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cs.backgroundColor || '');
                if (m && (m[4] === undefined || parseFloat(m[4]) > 0.6)) { const d = (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) < 70; if (d) last = n; return d; }
            }
            return false;
        };
        let y = 0, hit = false, x = Math.round(window.innerWidth / 2), y0 = 2, y1 = 160, cr = null;
        if (card) { cr = card.getBoundingClientRect(); x = Math.round(cr.left + 10); y0 = Math.round(cr.top + 30); y1 = Math.min(Math.round(cr.top + 320), Math.round(cr.bottom - 10)); }
        try {
            for (let yy = y0; yy <= y1; yy += 3) { const e = document.elementFromPoint(x, yy); if (e && dark(e)) y = yy; else { hit = true; break; } }
        } catch (e) { return { y: 0, r: 0 }; }
        if (!hit || !last || y === 0) {
            if (cr) { let R = 0; try { R = Math.min(40, parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0); } catch (e) { R = 0; } return { y: cr.top, r: R, top: true, x0: cr.left, x1: cr.right }; }   // نافذة بلا ترويسة كحلية: الخط يتبع الحافة العلوية المقوسة للنافذة نفسها
            return { y: 0, r: 0 };
        }
        let r = 0; try { r = Math.min(40, parseFloat(getComputedStyle(last).borderBottomLeftRadius) || 0); } catch (e) { r = 0; }
        const lr = last.getBoundingClientRect(), bottom = lr.bottom;
        // لون الخلفية الفعلي عند نقطة (يتجاوز الشفاف): يرجع سطوع اللون أو -1 إن لم يوجد
        const lum = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(getComputedStyle(n).backgroundColor || ''); if (m && (m[4] === undefined || parseFloat(m[4]) > 0.6)) return 0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]; } return -1; };
        if (r > 0) {
            if (Math.abs(bottom - y) > r + 6 && y > 0) r = 0;   // العنصر الكحلي حاوية أكبر من الترويسة: انحناؤه لا يخص الترويسة
            else try {
                // نلغي التقويس فقط إذا كانت الزاوية السفلية كحلية فعلاً (مستقيمة)؛ الشفاف أو غير المعروف لا يلغيه
                const px = Math.round(Math.max(lr.left, cr ? cr.left : 0)) + 2, py = Math.round(Math.min(bottom, y || bottom)) - 2, pe = document.elementFromPoint(px, py);
                if (pe) { const L = lum(pe); if (L >= 0 && L < 70 && (pe === last || last.contains(pe))) r = 0; }
            } catch (e) { /* تجاهل */ }
        } else if (cr) {
            // الترويسة بلا تقويس لكنها ملاصقة لزاوية النافذة السفلية المقوسة: نأخذ تقويس النافذة الأب بديلاً
            try { const R = Math.min(40, parseFloat(getComputedStyle(card).borderBottomLeftRadius) || 0); if (R > 0 && Math.abs(cr.bottom - bottom) <= 2) r = R; } catch (e) { /* تجاهل */ }
        }
        return { y: bottom > 0 && bottom < 520 ? bottom : y, r, x0: cr ? Math.max(cr.left, lr.left) : lr.left, x1: cr ? Math.min(cr.right, lr.right) : lr.right };
    },
    // مراقبة موضع النافذة كل إطار: عند فتح النافذة أو إغلاقها أو تحرّكها ينتقل الخط فوراً بدل انتظار الرسم الدوري
    watch() {
        if (Prog.raf) return;
        const loop = () => {
            if (!Prog.cur) { Prog.raf = 0; Prog.sig = ''; return; }
            try {
                const c = Prog.topCard(); let sig = 'none';
                if (c) { const r = c.getBoundingClientRect(); sig = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','); }
                if (sig !== Prog.sig) { Prog.sig = sig; Prog.paint(); }
            } catch (e) { /* تجاهل */ }
            Prog.raf = requestAnimationFrame(loop);
        };
        Prog.raf = requestAnimationFrame(loop);
    },
    hide() { const tx = document.getElementById('progTxt'); if (tx) tx.hidden = true; if (Prog.raf) { cancelAnimationFrame(Prog.raf); Prog.raf = 0; } if (Prog.el) Prog.el.hidden = true; if (Prog.ln) Prog.ln.hidden = true; clearInterval(Prog.timer); Prog.cur = null; },
    fmtT(s) { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' ث' : Math.floor(s / 60) + ' د ' + (s % 60) + ' ث'; },
    paint() {
        const h = Prog.cur, el = Prog.el; if (!h || !el) return;
        el.hidden = false;
        {   // الخط الرفيع: يتحرك أثناء العمل ولا يعترض اللمس
            const ln = Prog.ln; if (ln) {
                // الخط يتبع النافذة التي بدأت فيها العملية: إن أُغلقت النافذة يختفي الخط معها (العملية تكمل بالخلفية، والخطأ يظهر في الشريط السفلي)
                if (h.anch && h.state === 'run' && !Prog.topCard()) { ln.hidden = true; const t0 = document.getElementById('progTxt'); if (t0) t0.hidden = true; }
                else {
                const g = Prog.lineY(), r = Math.round(g.r), H = r + (g.top ? 4 : 5); Prog.lastG = g;
                                ln.style.top = (g.top ? Math.max(0, g.y) : Math.max(0, g.y - H)) + 'px'; ln.style.height = H + 'px'; ln.style.setProperty('--r', r + 'px'); ln.hidden = false;
                if (g.x1 > g.x0 && (g.x1 - g.x0) < window.innerWidth - 2) { ln.style.left = Math.max(0, g.x0) + 'px'; ln.style.right = Math.max(0, window.innerWidth - g.x1) + 'px'; } else { ln.style.left = ''; ln.style.right = ''; }
                const det = h.pct !== null;
                ln.className = 'pl-' + (h.state === 'ok' ? 'ok' : h.state === 'err' ? 'err' : (!navigator.onLine || (Date.now() - h.last) / 1000 > 12) ? 'warn' : 'run') + (det || h.state !== 'run' ? '' : ' ind') + (g.top ? ' pl-topm' : '');
                const pc = h.state === 'ok' ? 100 : det ? Math.max(3, Math.round(h.pct)) : 100;
                ln.style.setProperty('--cut', (100 - pc) + '%');
                }
            }
        }
        {   // نص التقدّم الصغير تحت الخط للعمليات التي تطول (مثل «حُفظ 40 من 120»)
            let tx = document.getElementById('progTxt');
            if (!tx) { tx = document.createElement('div'); tx.id = 'progTxt'; tx.hidden = true; tx.setAttribute('aria-hidden', 'true'); document.body.appendChild(tx); }
            const g = Prog.lastG || { y: 0 }, show = h.state === 'run' && h.text && (Date.now() - h.t0) > 1200 && !(h.anch && !Prog.topCard());
            if (show) {
                tx.textContent = (h.pct !== null ? Math.round(h.pct) + '% · ' : '') + h.text;
                tx.style.top = (Math.max(0, g.y) + 8) + 'px';
                tx.style.right = Math.max(10, window.innerWidth - (g.x1 || window.innerWidth) + 12) + 'px';
            }
            tx.hidden = !show;
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
