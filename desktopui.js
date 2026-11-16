// واجهة الحاسبة المتقدمة (تعمل داخل برنامج سطح المكتب فقط؛ لا أثر على الموبايل والأندرويد):
// عرض جدولي للمخزن، شريط تنقل جانبي، ولوحة مبيعات وآخر الفواتير بالرئيسية.
(function () {
    'use strict';
    if (!document.documentElement.classList.contains('is-desktop-app')) return;
    const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const LSET = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } };
    const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
    const num = n => (typeof fmtNum === 'function' ? fmtNum(n) : Number(n || 0).toLocaleString('en-US'));
    const svg = d => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

    /* ===== 1) المخزن: تبديل بطاقات / جدول ===== */
    let mode = LS('dkStockMode') === 'table' ? 'table' : 'cards', sortK = 'name', sortD = 1;
    const expiryOf = p => { const a = (Array.isArray(p.expiryDates) && p.expiryDates.length) ? p.expiryDates : (p.expiryDate ? [p.expiryDate] : []); return a.filter(Boolean).sort()[0] || ''; };
    const COLS = [['name', 'الاسم'], ['brand', 'الشركة'], ['pack', 'العبوة'], ['price', 'السعر (د.ع)'], ['qty', 'الكمية'], ['exp', 'أقرب صلاحية']];
    const val = (p, k) => k === 'name' ? String(p.name || '') : k === 'brand' ? String(p.brand || '') : k === 'pack' ? (typeof packLine === 'function' ? packLine(p) : '') : k === 'price' ? (Number(p.price) || 0) : k === 'qty' ? (Number(p.qty) || 0) : expiryOf(p);
    function renderTable() {
        const c = document.getElementById('itemsContainer'); if (!c) return;
        let t = document.getElementById('dkTable');
        const rows = (mode === 'table' && typeof getFiltered === 'function') ? getFiltered().slice() : [];
        if (mode !== 'table' || !rows.length) { if (t) t.style.display = 'none'; c.style.display = ''; return; }
        if (!t) { t = document.createElement('div'); t.id = 'dkTable'; c.parentNode.insertBefore(t, c.nextSibling); }
        c.style.display = 'none'; t.style.display = '';
        rows.sort((a, b) => { const x = val(a, sortK), y = val(b, sortK); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sortD; });
        const ok = typeof isInStock === 'function' ? isInStock : () => true;
        t.innerHTML = '<table class="dk-tb"><thead><tr><th class="dk-dot"></th>' + COLS.map(c2 => '<th class="dk-s' + (sortK === c2[0] ? ' on' : '') + '" onclick="dkSort(\'' + c2[0] + '\')">' + c2[1] + (sortK === c2[0] ? (sortD > 0 ? ' ▲' : ' ▼') : '') + '</th>').join('') + '</tr></thead><tbody></tbody></table>';
        const rowHtml = p => '<tr onclick="openSheet(' + p.id + ')"><td class="dk-dot"><i class="' + (ok(p) ? 'ok' : 'out') + '"></i></td><td class="dk-n" dir="auto">' + esc(p.name) + '</td><td dir="auto">' + esc(p.brand) + '</td><td dir="ltr">' + esc(val(p, 'pack')) + '</td><td>' + (p.price ? num(p.price) : '—') + '</td><td>' + num(p.qty) + '</td><td dir="ltr">' + esc(expiryOf(p) || '—') + '</td></tr>';
        lazyFill(t.querySelector('tbody'), rows, rowHtml, 120, 'tbody');
    }
    window.dkSort = k => { if (sortK === k) sortD = -sortD; else { sortK = k; sortD = 1; } renderTable(); };
    function ensureToggle() {
        const row = document.querySelector('#stockView .search-row'); if (!row || document.getElementById('dkViewBtn')) return;
        const b = document.createElement('button'); b.type = 'button'; b.id = 'dkViewBtn'; b.className = 'filter-btn dk-viewbtn';
        const paint = () => { b.innerHTML = mode === 'table' ? svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>') : svg('<path d="M3 6h18M3 12h18M3 18h18"/>'); b.title = mode === 'table' ? 'عرض البطاقات' : 'عرض جدولي'; b.setAttribute('aria-label', b.title); };
        b.onclick = () => { mode = mode === 'table' ? 'cards' : 'table'; LSET('dkStockMode', mode); paint(); if (typeof renderAll === 'function') renderAll(); };
        paint(); row.appendChild(b);
    }
    function hookRender() { if (typeof window.renderAll === 'function') { const o = window.renderAll; window.renderAll = function () { const r = o.apply(this, arguments); try { ensureToggle(); renderTable(); } catch (e) { /* تجاهل */ } return r; }; } }

    /* ===== 2) شريط التنقل الجانبي ===== */
    const NAV = [
        ['home', 'الرئيسية', '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>', () => showView('home')],
        ['pos', 'شاشة البيع (F2)', '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>', () => posOpen()],
        ['stock', 'المخزن (Ctrl+K)', '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>', () => showView('stock')],
        ['bill', 'الفواتير', '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>', () => showView('bill')],
        ['purch', 'الوارد', '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>', () => showView('purch')],
        ['cust', 'الزبائن', '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M22 21v-1a6 6 0 0 0-4-5.6"/>', () => cuOpen()],
        ['alerts', 'التنبيهات', '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', () => goAlerts('all')],
        ['set', 'الإعدادات', '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>', () => openCategoryManager()]
    ];
    function mountRail() {
        if (document.getElementById('dkRail')) return;
        const r = document.createElement('nav'); r.id = 'dkRail'; r.className = 'no-print'; r.setAttribute('aria-label', 'التنقل');
        r.innerHTML = NAV.map(n => '<button type="button" data-k="' + n[0] + '" title="' + n[1] + '" aria-label="' + n[1] + '">' + svg(n[2]) + '</button>').join('');
        r.addEventListener('click', e => {
            const b = e.target.closest('button'); if (!b) return; const it = NAV.find(n => n[0] === b.dataset.k); if (!it) return;
            try { if (window.__closeAllLayers) window.__closeAllLayers(); it[3](); } catch (er) { /* تجاهل */ }
        });
        document.body.appendChild(r); markRail();
    }
    function markRail() { const v = document.body.dataset.view; document.querySelectorAll('#dkRail button').forEach(b => b.classList.toggle('on', b.dataset.k === v)); }
    new MutationObserver(markRail).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

    /* ===== 3) الرئيسية: مبيعات آخر 7 أيام + آخر الفواتير ===== */
    function allBills() {
        try { if (typeof billAll !== 'undefined' && billAll.length) return billAll; } catch (e) { /* تجاهل */ }
        try { return (JSON.parse(lsGet(BILL_LS.list)) || []).filter(x => x && x.id); } catch (e) { return []; }
    }
    const isoD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    function renderHomeX() {
        const hv = document.getElementById('homeView'); if (!hv || typeof userRole === 'undefined' || userRole !== 'owner') return;
        let s = document.getElementById('dkHome'); if (!s) { s = document.createElement('section'); s.id = 'dkHome'; hv.appendChild(s); }
        const bills = allBills().filter(b => b.issued && !b.cancelled), days = [], now = new Date();
        for (let i = 6; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days.push({ k: isoD(d), l: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'), v: 0 }); }
        bills.forEach(b => { const d = days.find(x => x.k === String(b.issuedAt || '').slice(0, 10)); if (d && typeof invTotalOf === 'function') d.v += invTotalOf(b); });
        const max = Math.max(1, ...days.map(d => d.v)), W = 420, H = 150;
        const bars = days.map((d, i) => { const h = Math.round((d.v / max) * (H - 44)), x = 14 + i * 58; return '<g><rect x="' + x + '" y="' + (H - 22 - h) + '" width="38" height="' + Math.max(h, 2) + '" rx="6" fill="#f4b73f"/><text x="' + (x + 19) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="currentColor" opacity=".7">' + d.l + '</text>' + (d.v ? '<text x="' + (x + 19) + '" y="' + (H - 27 - h) + '" text-anchor="middle" font-size="10" fill="currentColor">' + num(Math.round(d.v)) + '</text>' : '') + '</g>'; }).join('');
        const recent = bills.slice(0, 6).map(b => '<button type="button" class="dk-rb" onclick="billOpenSaved(\'' + esc(b.id) + '\')"><b dir="ltr">' + esc(b.no || '') + '</b><span>' + esc(b.to || b.customer || 'بدون اسم') + '</span><em>' + num(typeof invTotalOf === 'function' ? invTotalOf(b) : 0) + ' د.ع</em></button>').join('') || '<div class="dk-empty">لا توجد فواتير بعد.</div>';
        s.innerHTML = '<div class="dk-card"><h4>مبيعات آخر ٧ أيام</h4><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="مبيعات آخر سبعة أيام">' + bars + '</svg></div><div class="dk-card"><h4>آخر الفواتير</h4>' + recent + '</div>';
    }
    function hookView() { if (typeof window.showView === 'function') { const o = window.showView; window.showView = function (v) { const r = o.apply(this, arguments); if (v === 'home') setTimeout(() => { try { renderHomeX(); } catch (e) { /* تجاهل */ } }, 400); return r; }; } }
    window.addEventListener('load', () => { hookRender(); hookView(); ensureToggle(); try { if (typeof renderAll === 'function') renderAll(); } catch (e) { /* تجاهل */ } });
    setInterval(() => { if (document.body.dataset.view === 'home') { try { renderHomeX(); } catch (e) { /* تجاهل */ } } }, 60000);

    document.addEventListener('DOMContentLoaded', () => { mountRail(); ensureToggle(); setTimeout(renderHomeX, 2500); });
    if (document.readyState !== 'loading') { mountRail(); ensureToggle(); setTimeout(renderHomeX, 2500); }
})();
