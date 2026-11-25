// أدوات الترويسة العامة (v737): بحث شامل · مسح · جرس التنبيهات · قائمة المزيد، بنفس الأماكن في كل الصفحات. والشعار يرجع للرئيسية.
(function () {
    'use strict';
    const svg = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    const IC = {
        search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
        scan: svg('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6" stroke-width="1.6"/>'),
        bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/>'),
        share: svg('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>'),
        more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
        inv: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 13l2 2 4-4"/>'),
        home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
        bill: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
        box: svg('<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'),
        cart: svg('<path d="M3 4h2l2.4 11h9.2L19 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'),
        list: svg('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
        flash: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
        calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>'),
        info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
        gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
        out: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>')
    };
    const ok = k => { try { return typeof can !== 'function' || can(k); } catch (e) { return true; } };
    window.hdAlertN = window.hdAlertN || 0;

    function toolsHtml(noSearch, noScan, noBell, inv) {
        const b = (cls, on, ic, label, extra) => '<button type="button" class="hdt ' + cls + '" onclick="' + on + '" aria-label="' + label + '" title="' + label + '">' + ic + (extra || '') + '</button>';
        return (inv ? b('hdt-i', "hdGo('bill')", IC.bill, 'الفواتير') : '') + (noSearch ? '' : b('hdt-s', 'hdSearch()', IC.search, 'بحث شامل')) + (noScan ? '' : b('hdt-c', 'hdScan()', IC.scan, 'مسح باركود')) +
            (noBell ? '' : b('hdt-b bell-btn', "goAlerts('all')", IC.bell, 'التنبيهات', '<i class="bell-badge hd-alert-n"></i><i class="bell-badge doc-badge" title="طلبات الأطباء"></i><i class="bell-badge rx-badge" title="وصفات جديدة"></i>')) +
            b('hdt-m', 'hdMore()', IC.more, 'القائمة');
    }
    function refresh() {
        document.querySelectorAll('.hdt-s, .hdt-b').forEach(e => { e.style.display = ok('stockView') ? '' : 'none'; });
        document.querySelectorAll('.hdt-i').forEach(e => { e.style.display = ok('sell') ? '' : 'none'; });
        document.querySelectorAll('.hdt-c').forEach(e => { e.style.display = ok('scan') ? '' : 'none'; });
        document.querySelectorAll('.hd-alert-n').forEach(e => { e.textContent = window.hdAlertN; e.style.display = window.hdAlertN ? 'flex' : 'none'; });
    }
    window.hdToolsRefresh = refresh;
    const KEEP_OUT = /showView\('home'\)|helpOpen|gateLogout|goAlerts|p2Home/;
    function mount() {
        const list = document.querySelectorAll('.hd-nav:not([data-hdt]), .brand-actions:not([data-hdt])');
        if (!list.length) return;
        list.forEach(el => {
            el.dataset.hdt = '1';
            if (el.closest('.pos-head')) return;   // ترويسة بيع قديمة تبقى بأزرارها
            const keep = el.classList.contains('hd-nav') ? [] : [...el.children].filter(c => !KEEP_OUT.test(c.getAttribute('onclick') || ''));
            const own = !!el.closest('.stk-bar, .p2-top'); el.innerHTML = toolsHtml(own, own, !!el.closest('#alertsView'), false); keep.forEach(k => el.appendChild(k));
        });
        refresh();
    }
    let mq = 0;
    const sched = () => { if (mq) return; mq = requestAnimationFrame(() => { mq = 0; mount(); }); };
    function start() {
        mount();
        // مراقبة خفيفة: لا نفحص العقد المضافة، بل نجدول مسحاً واحداً لكل إطار، ونتجاهل تغييرات أزرارنا نفسها
        new MutationObserver(ms => { for (const m of ms) { if (m.target && m.target.closest && m.target.closest('.hdt')) continue; if (m.addedNodes.length) { sched(); return; } } }).observe(document.body, { childList: true, subtree: true });
        setInterval(refresh, 3000);
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

    // الشعار يفتح حالة المزامنة (سلوك قائم في data.js)؛ الرئيسية من قائمة المزيد

    // ===== مسار الرجوع =====
    // زر الرجوع = خطوة للخلف إلى المكان الذي كنت فيه قبل الدخول للمكان الحالي (حتى لو كان نافذة منبثقة كشاشة البيع)
    const REOPEN = [['p2Ov', 'posOpen'], ['posOv', 'posOpen'], ['cnOv', 'cnHub'], ['cuOv', 'cuOpen'], ['exOv', 'exOpen'], ['fuOv', 'fuOpen'], ['ndOv', 'ndOpen'], ['rxHub', 'rxOpen'], ['dataHub', 'dhOpen'], ['helpHub', 'helpOpen']];
    const shownEl = id => { const e = document.getElementById(id); return !!e && !!e.style.display && e.style.display !== 'none'; };
    function originEntry() {
        const cv = (typeof currentView !== 'undefined') ? currentView : 'home';
        for (const [id, fn] of REOPEN) if (shownEl(id) && typeof window[fn] === 'function') return '@' + fn + '|' + cv;
        return null;
    }
    window.__reopenEntry = function (ent) {
        const m = /^@(\w+)\|(\w*)$/.exec(String(ent)); if (!m) return false;
        window.__navBack = true; try { if (m[2] && currentView !== m[2]) showView(m[2]); } finally { window.__navBack = false; }
        setTimeout(() => { try { if (m[1] === 'posOpen') window.__dwDirect = window.__dwGo === 'pos' ? 'pos' : window.__dwDirect; window[m[1]](); if (window.__syncBackGuards) window.__syncBackGuards(); } catch (e) { /* تجاهل */ } }, 30);
        return true;
    };
    window.hdGo = function (view) {
        const cv = (typeof currentView !== 'undefined') ? currentView : 'home';
        const ent = originEntry();
        try { if (window.__closeAllLayers && !window.__closeAllLayers()) return; } catch (e) { /* تجاهل */ }
        if (view === 'home') { window.__viewStack = []; try { showView('home'); } catch (e) { /* تجاهل */ } }
        else {
            const st = window.__viewStack = window.__viewStack || [];
            if (cv === view && !ent) return;
            window.__navBack = true; try { showView(view); } finally { window.__navBack = false; }
            if (ent) st.push(ent); else if (cv && cv !== view && !['splash', 'login', 'home'].includes(cv) && st[st.length - 1] !== cv) st.push(cv);
        }
        setTimeout(() => { try { window.__syncBackGuards && window.__syncBackGuards(); } catch (e) { /* تجاهل */ } }, 50);
    };

    // ===== مسح باركود =====
    window.hdScan = function () {
        try {
            const ent = originEntry(), cv = (typeof currentView !== 'undefined') ? currentView : 'home';
            if (window.__closeAllLayers) window.__closeAllLayers();
            window.__dwDirect = ''; window.__scReturn = ent;
            scGo();
        } catch (e) { /* تجاهل */ }
    };
    window.addEventListener('load', () => {
        const o = window.scClose; if (typeof o !== 'function') return;
        window.scClose = function () { const r = o.apply(this, arguments); const ent = window.__scReturn; if (ent) { window.__scReturn = null; setTimeout(() => window.__reopenEntry(ent), 60); } return r; };
    });

    // ===== بحث شامل =====
    let hsT = 0;
    window.hdSearchClose = function () { const w = document.getElementById('hsWrap'); if (!w) return; w.classList.remove('open'); setTimeout(() => w.remove(), 180); };
    window.hdSearch = function () {
        if (!ok('stockView')) return;
        hdSearchClose(); const old = document.getElementById('hsWrap'); if (old) old.remove();
        const w = document.createElement('div'); w.id = 'hsWrap'; w.className = 'hs-wrap';
        w.innerHTML = '<div class="hs-bd"></div><div class="hs-panel" role="dialog" aria-label="بحث شامل"><div class="hs-row"><span class="hs-ic">' + IC.search + '</span><input id="hsIn" type="search" enterkeyhint="search" autocomplete="off" placeholder="اسم تجاري أو علمي أو باركود"><button type="button" class="hs-x" aria-label="إغلاق">✕</button></div><div id="hsOut" class="hs-out"><div class="hs-hint">ابحث عن أي مادة ثم اضغط عليها لعرض تفاصيلها.</div></div></div>';
        document.body.appendChild(w);
        const inp = w.querySelector('#hsIn'), out = w.querySelector('#hsOut');
        w.querySelector('.hs-bd').onclick = w.querySelector('.hs-x').onclick = hdSearchClose;
        const run = () => {
            const q = normSearch(inp.value), toks = q ? q.split(' ') : [];
            if (!q) { out.innerHTML = '<div class="hs-hint">ابحث عن أي مادة ثم اضغط عليها لعرض تفاصيلها.</div>'; return; }
            const r = [];
            for (const p of products) { if (p.arch) continue; const s = searchScore(p, q, toks); if (s > 0) r.push([s, p]); }
            r.sort((a, b) => b[0] - a[0]);
            const top = r.slice(0, 40);
            out.innerHTML = top.length ? top.map(([, p]) => {
                const inS = isInStock(p);
                return '<button type="button" class="hs-it" data-id="' + escapeHtml(String(p.id)) + '"><span class="hs-n"><b>' + escapeHtml(p.name || '') + '</b><small>' + escapeHtml([p.activeIngredient, p.brand].filter(Boolean).join(' · ')) + '</small></span><span class="hs-m"><b>' + fmtMoney(p.price) + '</b><i class="' + (inS ? 'in' : 'out') + '">' + (inS ? 'متوفر' : 'غير متوفر') + '</i></span></button>';
            }).join('') + (r.length > top.length ? '<div class="hs-hint">يوجد ' + fmtMoney(r.length - top.length) + ' نتيجة إضافية، حدّد البحث أكثر.</div>' : '') : '<div class="hs-hint">لا توجد نتائج مطابقة.</div>';
        };
        inp.addEventListener('input', () => { clearTimeout(hsT); hsT = setTimeout(run, 120); });
        out.addEventListener('click', e => { const it = e.target.closest('.hs-it'); if (!it) return; const id = it.dataset.id; hdSearchClose(); setTimeout(() => { try { openSheet(id); } catch (er) { /* تجاهل */ } }, 120); });
        requestAnimationFrame(() => { w.classList.add('open'); setTimeout(() => inp.focus(), 60); });
    };

    // ===== قائمة المزيد =====
    window.hdMoreClose = function () { const w = document.getElementById('hmWrap'); if (!w) return; w.classList.remove('open'); setTimeout(() => w.remove(), 200); };
    window.hdMore = function () {
        hdMoreClose(); const old = document.getElementById('hmWrap'); if (old) old.remove();
        const items = [
            ['الرئيسية', IC.home, "hdGo('home')", true], ['الفواتير', IC.bill, "hdGo('bill')", ok('sell')], ['المخزن', IC.box, "hdGo('stock')", ok('stockView')],
            ['الوارد', IC.cart, "hdGo('purch')", ok('purchases')], ['سجل الأدوية', IC.list, "hdGo('catalog')", ok('catalog')], ['بيع سريع', IC.flash, 'posOpen()', ok('sell')],
            ['تبادل واتساب', IC.share || IC.info, 'showSyncStatus()', !!window.WA && (ok('sell') || userRole === 'owner')], ['الجرد', IC.inv, 'openInventory()', typeof openInventory === 'function' && (userRole === 'owner' || ok('invList'))], ['حاسبة الأسعار', IC.calc, 'pcOpen()', true], ['الإعدادات', IC.gear, 'openCategoryManager()', typeof userRole === 'undefined' || userRole !== 'staff'], ['مركز المعلومات', IC.info, 'helpOpen()', true]
        ].filter(x => x[3]);
        const w = document.createElement('div'); w.id = 'hmWrap'; w.className = 'hm-wrap';
        w.innerHTML = '<div class="hm-bd"></div><div class="hm-sheet" role="dialog" aria-label="القائمة"><div class="hm-grab"></div><div class="hm-grid">' +
            items.map(([t, ic, fn]) => '<button type="button" class="hm-it" data-fn="' + fn + '"><span class="hm-i">' + ic + '</span><span>' + t + '</span></button>').join('') +
            '</div><button type="button" class="hm-out" data-fn="gateLogout()">' + IC.out + '<span>تسجيل الخروج</span></button></div>';
        document.body.appendChild(w);
        w.querySelector('.hm-bd').onclick = hdMoreClose;
        w.querySelectorAll('[data-fn]').forEach(b => b.onclick = () => { const fn = b.dataset.fn; hdMoreClose(); setTimeout(() => { try { (new Function(fn))(); } catch (e) { /* تجاهل */ } }, 160); });
        requestAnimationFrame(() => w.classList.add('open'));
    };
})();
