// حاسبة الأسعار (تسعيرة نقابة الصيادلة) — تعتمد نفس إعدادات التسعير ودالة syndCalc المستخدمة في المواد.
function pcOpen() {
    const html = `<div class="pc-box" dir="rtl">
        <label class="pc-l">سعر الشراء (د.ع)</label>
        <input id="pcCost" class="swal2-input pc-in" type="text" inputmode="decimal" autocomplete="off" placeholder="أدخل سعر الشراء">
        <div id="pcOut" class="pc-out"><span class="pc-hint">أدخل سعر الشراء ليظهر سعر البيع.</span></div>
        <div class="pc-src">${escapeHtml(syndBookText())} · سعر الصرف ${fmtNum(pricingCfg.rate)}</div></div>`;
    Swal.fire({
        title: '🧮 حاسبة الأسعار', html, showConfirmButton: false, showCloseButton: true, focusConfirm: false, customClass: { title: 'pc-title' },
        didOpen: () => {
            const inp = document.getElementById('pcCost'), out = document.getElementById('pcOut');
            const toNum = s => Number(String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,\s،]/g, '')) || 0;
            const run = () => {
                const c = toNum(inp.value), r = syndCalc(c);
                if (!r) { out.innerHTML = '<span class="pc-hint">أدخل سعر الشراء ليظهر سعر البيع.</span>'; return; }
                out.innerHTML = `<div class="pc-price"><small>سعر البيع</small><b>${fmtNum(r.price)}</b><small>د.ع</small></div>
                    <div class="pc-rows"><div><span>المعادل بالدولار</span><b>${(Math.round(r.usd * 100) / 100).toLocaleString('en-US')} $</b></div>
                    <div><span>نسبة الشريحة</span><b>${r.pct}%</b></div>
                    <div><span>الربح</span><b>${fmtNum(r.price - c)} د.ع</b></div></div>`;
            };
            inp.addEventListener('input', run); setTimeout(() => inp.focus(), 80);
        }
    });
}

// ارتفاع الشريط العلوي للرئيسية يُقاس ليثبت عنوان الصفحة تحته مباشرة
(function () {
    const set = () => { const b = document.querySelector('.home-view > .brand-bar'); if (b && b.offsetHeight > 0) document.documentElement.style.setProperty('--bb-h', b.offsetHeight + 'px'); };
    window.addEventListener('resize', set); window.addEventListener('load', set);
    try { const b = document.querySelector('.home-view > .brand-bar'); if (b && window.ResizeObserver) new ResizeObserver(set).observe(b); } catch (e) { /* تجاهل */ }
    setInterval(set, 1500); set();
})();

// ارتفاع ترويسة كل شاشة يُقاس (لتثبّت التبويبات تحتها مباشرة)
(function () {
    const set = () => document.querySelectorAll('.app-view').forEach(v => {
        let h = 0; const bt = v.querySelector(':scope > .bill-top');
        if (bt) { h = bt.getBoundingClientRect().height; const b0 = bt.querySelector(':scope > .brand-bar'); if (b0 && b0.offsetHeight > 0) v.style.setProperty('--bb-h', b0.getBoundingClientRect().height + 'px'); } else { const bb = v.querySelector(':scope > .brand-bar'), pt = v.querySelector(':scope > .page-title'); if (bb && pt) { h = bb.getBoundingClientRect().height + pt.getBoundingClientRect().height; if (bb.offsetHeight > 0) v.style.setProperty('--bb-h', bb.getBoundingClientRect().height + 'px'); } }
        if (h > 0) v.style.setProperty('--hd-h', h + 'px');
    });
    window.addEventListener('resize', set); window.addEventListener('load', set); setInterval(set, 1000); set();
})();

/* v583: قائمة ⋯ في ترويسة المخزن */
function stkMore(e) {
    const m = document.getElementById('stkMenu'); if (!m) return;
    if (e) { e.stopPropagation(); m.hidden = !m.hidden; } else m.hidden = true;
}
document.addEventListener('click', (ev) => { const m = document.getElementById('stkMenu'); if (m && !m.hidden && !ev.target.closest('.stk-more')) m.hidden = true; });

/* v590: أيقونتا الرئيسية والمخزن في ترويسة كل صفحة داخلية */
function hdRowHtml(pos) {
    const BOX = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>', HOME = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
    return '<div class="hd-row1"><span class="hd-brand"><span class="brand-logo"><img src="icon.jpg" alt=""><i class="sync-dot" data-state="ok"></i></span><b>صيدلية الديوان</b></span><span class="hd-nav">' + (pos ? '<button type="button" class="hd-b" onclick="hdGo(\'bill\')" aria-label="الفواتير" title="الفواتير">' + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>' + '</button>' : '') + '<button type="button" class="hd-b" onclick="hdGo(\'stock\')" aria-label="المخزن" title="المخزن">' + BOX + '</button><button type="button" class="hd-b" onclick="hdGo(\'home\')" aria-label="الرئيسية" title="الرئيسية">' + HOME + '</button></span></div>';
}
function hdGo(view) {
    try { if (window.__closeAllLayers && !window.__closeAllLayers()) return; } catch (e) { /* تجاهل */ }
    try { window.__viewStack = []; showView(view); setTimeout(() => { try { window.__syncBackGuards && window.__syncBackGuards(); } catch (e) { /* تجاهل */ } }, 50); } catch (e) { /* تجاهل */ }
}
(function () {
    const SEL = '.tr-head, .cn-head, .pos-head, .fm-top, .sh-bar, .help-top';
    const HOME = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
    const BOX = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>';
    function mount(root) {
        (root.matches && root.matches(SEL) ? [root] : []).concat([...(root.querySelectorAll ? root.querySelectorAll(SEL) : [])]).forEach(h => {
            if (h.querySelector(':scope > .hd-row1') || h.closest('.top-bar, .bill-top')) return;
            const r = document.createElement('div'); r.className = 'hd-row1';
            r.innerHTML = '<span class="hd-brand"><span class="brand-logo"><img src="icon.jpg" alt=""><i class="sync-dot" data-state="ok"></i></span><b>صيدلية الديوان</b></span><span class="hd-nav">' + (h.matches('.pos-head') ? '<button type="button" class="hd-b" onclick="hdGo(\'bill\')" aria-label="الفواتير" title="الفواتير">' + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>' + '</button>' : '') + '<button type="button" class="hd-b" onclick="hdGo(\'stock\')" aria-label="المخزن" title="المخزن">' + BOX + '</button><button type="button" class="hd-b" onclick="hdGo(\'home\')" aria-label="الرئيسية" title="الرئيسية">' + HOME + '</button></span>';
            h.classList.add('hd-2'); h.insertBefore(r, h.firstChild);
        });
        const src = document.querySelector('.brand-bar .sync-dot');
        if (src) document.querySelectorAll('.hd-brand .sync-dot').forEach(d => { d.dataset.state = src.dataset.state; d.dataset.pend = src.dataset.pend || '0'; d.title = src.title; });
    }
    function start() {
        mount(document.body);
        new MutationObserver(ms => { ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) mount(n); })); }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
