// =====================================================================
// فلتر الأقسام والتصنيفات المشترك (المخزن + صفحة الطبيب + إعدادات الطبيب).
// قائمة منسدلة: كل قسم مطوي، علامة الصح على القسم تختاره كله، وبالفتح تختار من داخله.
// tree = [{ k, n, virtual?, cats: [{ k, n }] }]    sel = { d: Set, c: Set }
// cfg  = { tree, sel, open:Set, q:'', count(kind,k)->n|undefined, onChange(), onDone?() }
// =====================================================================
(function () {
    if (window.tfMount) return;
    const css = `
.tf-p{background:var(--surface,#fff);color:var(--text,#0f1c38);border:1.5px solid var(--line,#e2e8f0);border-radius:18px;padding:10px;box-shadow:0 14px 36px rgba(8,14,30,.22);direction:rtl;font-family:inherit}
[data-theme="dark"] .tf-p{background:var(--surface,#1e293b);color:var(--text,#e2e8f0);border-color:var(--line,#334155)}
.tf-q{width:100%;height:42px;border:1.5px solid var(--line,#cbd5e1);border-radius:12px;background:var(--surface-2,#f8fafc);color:inherit;padding:0 12px;font:500 .88rem inherit;font-family:inherit;box-sizing:border-box}
[data-theme="dark"] .tf-q{background:var(--surface-2,#0f172a);border-color:var(--line,#334155)}
.tf-l{max-height:46vh;overflow-y:auto;margin-top:8px;display:flex;flex-direction:column;gap:4px;overscroll-behavior:contain}
.tf-d,.tf-c{display:flex;align-items:center;gap:9px;border-radius:12px;padding:4px 6px}
.tf-d{background:var(--surface-2,#f1f5f9)} [data-theme="dark"] .tf-d{background:var(--surface-2,#0f172a)}
.tf-ck{flex:0 0 auto;width:26px;height:26px;border-radius:8px;border:2px solid #94a3b8;background:var(--surface,#fff);color:#fff;font:900 .95rem/1 inherit;cursor:pointer;padding:0;display:grid;place-items:center}
[data-theme="dark"] .tf-ck{background:transparent}
.tf-ck.on{background:#0f766e;border-color:#0f766e}.tf-ck.part{background:#99d3cb;border-color:#0f766e;color:#0f766e}
.tf-dn{flex:1;min-width:0;display:flex;align-items:center;gap:8px;border:0;background:transparent;color:inherit;font:800 .86rem inherit;font-family:inherit;text-align:start;cursor:pointer;padding:8px 2px}
.tf-dn span{flex:1;min-width:0;overflow-wrap:anywhere}.tf-dn svg{width:16px;height:16px;flex:0 0 auto;transition:transform .2s;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.tf-dn.op svg{transform:rotate(-90deg)}
.tf-dn em,.tf-c em{font-style:normal;font-size:.7rem;font-weight:700;color:var(--sub,#64748b)}
.tf-cs{display:flex;flex-direction:column;gap:2px;padding:2px 22px 4px 0}
.tf-c{cursor:pointer;border:0;background:transparent;color:inherit;font:600 .83rem inherit;font-family:inherit;text-align:start;width:100%;padding:6px}
.tf-c span.t{flex:1;min-width:0;overflow-wrap:anywhere}
.tf-f{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;margin-top:10px}
.tf-f button{height:44px;border-radius:12px;border:1.5px solid var(--line,#cbd5e1);background:var(--surface,#fff);color:inherit;font:800 .85rem inherit;font-family:inherit;cursor:pointer}
.tf-f button.go{background:#0f1c38;border-color:#0f1c38;color:#fff}[data-theme="dark"] .tf-f button.go{background:var(--gold,#f9a825);border-color:var(--gold,#f9a825);color:#0f1c38}
.tf-f button:disabled{opacity:.45}.tf-none{padding:14px;text-align:center;color:var(--sub,#64748b);font-size:.8rem}`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = s => String(s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    const CH = '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
    const num = n => Number(n).toLocaleString('en-US');
    // عدد المحدد (للشارة)
    window.tfCount = sel => sel.d.size + sel.c.size;
    // هل المادة مطابقة (dkeys: أقسامها، ckeys: تصنيفاتها)
    window.tfMatch = (sel, dkeys, ckeys) => (!sel.d.size && !sel.c.size) || (dkeys || []).some(k => sel.d.has(k)) || (ckeys || []).some(k => sel.c.has(k));
    function dState(cfg, d) {
        if (!d.virtual && cfg.sel.d.has(d.k)) return 'on';
        const n = d.cats.filter(c => cfg.sel.c.has(c.k)).length;
        if (!n) return ''; return n === d.cats.length && d.cats.length ? 'on' : 'part';
    }
    function listHtml(cfg) {
        const q = norm(cfg.q || '').trim(); let out = '';
        cfg.tree.forEach(d => {
            const dm = q && norm(d.n).includes(q), cats = q && !dm ? d.cats.filter(c => norm(c.n).includes(q)) : d.cats;
            if (q && !dm && !cats.length) return;
            const op = q ? true : cfg.open.has(d.k), s = dState(cfg, d), dn = cfg.count ? cfg.count('d', d.k) : undefined;
            out += `<div class="tf-d"><button type="button" class="tf-ck ${s}" data-tf="dck" data-k="${esc(d.k)}" aria-label="تحديد القسم">${s === 'on' ? '✓' : s === 'part' ? '−' : ''}</button>
                <button type="button" class="tf-dn ${op ? 'op' : ''}" data-tf="exp" data-k="${esc(d.k)}"><span dir="auto">${esc(d.n)}</span>${dn != null ? `<em>${num(dn)}</em>` : ''}${d.cats.length ? CH : ''}</button></div>`;
            if (op && cats.length) out += `<div class="tf-cs">${cats.map(c => { const on = (!d.virtual && cfg.sel.d.has(d.k)) || cfg.sel.c.has(c.k), cn = cfg.count ? cfg.count('c', c.k) : undefined; return `<button type="button" class="tf-c" data-tf="cck" data-d="${esc(d.k)}" data-k="${esc(c.k)}"><span class="tf-ck ${on ? 'on' : ''}">${on ? '✓' : ''}</span><span class="t" dir="auto">${esc(c.n)}</span>${cn != null ? `<em>${num(cn)}</em>` : ''}</button>`; }).join('')}</div>`;
        });
        return out || '<div class="tf-none">لا توجد نتائج</div>';
    }
    function refresh(host) {
        const cfg = host._tf, l = host.querySelector('.tf-l'); if (!l) return;
        const top = l.scrollTop; l.innerHTML = listHtml(cfg); l.scrollTop = top;
        const clr = host.querySelector('[data-tf="clear"]'); if (clr) clr.disabled = !window.tfCount(cfg.sel);
    }
    window.tfRefresh = refresh;
    window.tfMount = function (host, cfg) {
        host._tf = cfg; cfg.open = cfg.open || new Set(); cfg.q = cfg.q || '';
        host.innerHTML = `<div class="tf-p"><input class="tf-q" type="search" autocomplete="off" placeholder="ابحث عن قسم أو تصنيف" value="${esc(cfg.q)}"><div class="tf-l"></div>
            <div class="tf-f"><button type="button" data-tf="clear">مسح التحديد</button><button type="button" class="go" data-tf="done">تم</button></div></div>`;
        refresh(host);
        if (host._tfBound) return; host._tfBound = true;
        host.addEventListener('input', e => { if (!e.target.classList.contains('tf-q')) return; const c = host._tf; c.q = e.target.value; refresh(host); });
        host.addEventListener('click', e => {
            const b = e.target.closest('[data-tf]'); if (!b) return; const c = host._tf, k = b.dataset.k, a = b.dataset.tf, d = c.tree.find(x => x.k === (a === 'cck' ? b.dataset.d : k));
            if (a === 'exp') { c.open.has(k) ? c.open.delete(k) : c.open.add(k); refresh(host); return; }
            if (a === 'dck' && d) {
                const s = dState(c, d);
                if (s === 'on') { c.sel.d.delete(d.k); d.cats.forEach(x => c.sel.c.delete(x.k)); }
                else if (d.virtual) d.cats.forEach(x => c.sel.c.add(x.k));
                else { c.sel.d.add(d.k); d.cats.forEach(x => c.sel.c.delete(x.k)); }
            } else if (a === 'cck' && d) {
                if (!d.virtual && c.sel.d.has(d.k)) { c.sel.d.delete(d.k); d.cats.forEach(x => { if (x.k !== k) c.sel.c.add(x.k); }); }
                else c.sel.c.has(k) ? c.sel.c.delete(k) : c.sel.c.add(k);
            } else if (a === 'clear') { c.sel.d.clear(); c.sel.c.clear(); }
            else if (a === 'done') { if (c.onDone) c.onDone(); return; }
            refresh(host); if (c.onChange) c.onChange();
        });
    };
})();
