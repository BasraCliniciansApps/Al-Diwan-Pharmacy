// =====================================================================
// الرجوع بين التبويبات الداخلية: زر رجوع الهاتف يرجع للتبويب السابق قبل مغادرة الشاشة.
// آخر 5 تبويبات لكل شاشة، بدون تكرار متتالٍ، وتتصفّر عند تغيير الشاشة.
// =====================================================================
(function () {
    'use strict';
    const MAX = 5, stack = [];   // عناصر: { view, fn, arg }
    let fresh = false;   // true في نفس اللحظة التي تتغير فيها الشاشة: التبويب المفتوح مباشرة بعدها (اختصار) ليس تنقلاً يُرجع إليه
    const defs = [
        { fn: 'puTab', view: 'purch', get: () => (typeof puTabName !== 'undefined' ? puTabName : null) },
        { fn: 'billTab', view: 'bill', get: () => (typeof currentBillTab !== 'undefined' ? currentBillTab : null) },
        { fn: 'setMainTab', view: 'stock', get: () => (typeof mainTab !== 'undefined' ? mainTab : null) }
    ];
    window.__tabDepth = function () { const v = typeof currentView !== 'undefined' ? currentView : ''; return stack.filter(e => e.view === v).length; };
    window.__tabBack = function () {
        const v = typeof currentView !== 'undefined' ? currentView : '';
        while (stack.length) {
            const e = stack.pop();
            if (e.view !== v) continue;
            window.__tabNav = true;
            try { window[e.fn](e.arg); } finally { window.__tabNav = false; }
            return true;
        }
        return false;
    };
    defs.forEach(d => {
        const orig = window[d.fn]; if (typeof orig !== 'function') return;
        window[d.fn] = function (arg) {
            if (!window.__tabNav && !fresh) {
                const cur = d.get();
                if (cur != null && cur !== arg) {
                    const last = stack[stack.length - 1];
                    if (!(last && last.fn === d.fn && last.arg === cur)) stack.push({ view: d.view, fn: d.fn, arg: cur });
                    if (stack.length > MAX * 3) stack.splice(0, stack.length - MAX * 3);
                }
            }
            return orig.apply(this, arguments);
        };
    });
    // تصفير عند تغيير الشاشة (لا يمس الرجوع نفسه)
    if (typeof window.showView === 'function') {
        const sv = window.showView;
        window.showView = function (v) { if (typeof currentView !== 'undefined' && v !== currentView && !window.__navBack) { try { if (window.__shStale) window.__shStale(); } catch (e) { /* تجاهل */ } stack.length = 0; fresh = true; setTimeout(() => { fresh = false; }, 0); } return sv.apply(this, arguments); };
    }
})();
