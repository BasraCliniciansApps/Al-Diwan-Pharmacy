// نافذة البيع المستقلة (PWA، ملف pos.html): تفتح شاشة البيع مباشرة بعد جاهزية التطبيق،
// وإذا أُغلقت شاشة البيع وبقيت الرئيسية تُعاد فتحها كي تبقى هذه النافذة للبيع فقط (الخروج بزر الرجوع للنظام).
(function () {
    'use strict';
    if (window.__dwGo !== 'pos') return;
    let tries = 0;
    const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const open = () => { try { if (!shown('posOv') && !shown('p2Ov')) { window.__dwDirect = 'pos'; posOpen(); } } catch (e) { /* تجاهل */ } };
    const go = () => {
        tries++;
        const ready = typeof currentView !== 'undefined' && !['splash', 'login', ''].includes(currentView) && typeof products !== 'undefined' && typeof posOpen === 'function';
        if (!ready) { if (tries < 200) setTimeout(go, 400); else document.documentElement.classList.remove('dw-go'); return; }
        if (typeof can === 'function' && !can('sell')) { document.documentElement.classList.remove('dw-go'); return; }
        open(); setTimeout(() => document.documentElement.classList.remove('dw-go'), 250);
    };
    go();
    window.addEventListener('load', () => {
        ['posClose', 'p2Close'].forEach(name => {
            const o = window[name]; if (typeof o !== 'function') return;
            window[name] = function () { const r = o.apply(this, arguments); setTimeout(() => { if (currentView === 'home' && !window.__dwNav) open(); }, 450); return r; };
        });
    });
})();
