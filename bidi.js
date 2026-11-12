// اتجاه الكتابة داخل الحقول فقط: ما يُكتب بالإنكليزية (أسماء الأدوية وغيرها) يُعرض من اليسار، والعربي من اليمين.
// الاستثناء: حقل معلومات الدواء وحقول الملاحظات (وكل textarea) تبقى عربية دائماً. لا يُغيَّر أي شيء خارج الحقل (العناوين والمواضع).
(function () {
    'use strict';
    const SKIP = /^(number|tel|password|email|date|time|datetime-local|month|week|checkbox|radio|file|range|color|hidden|button|submit|reset|image|url)$/;
    const NOTE = /note|memo|info|detail|remark|comment/i, NOTE_AR = /ملاحظ|معلومات/;
    const isNote = el => el.tagName === 'TEXTAREA' || NOTE.test((el.id || '') + ' ' + (el.name || '') + ' ' + (el.className || '')) || NOTE_AR.test((el.placeholder || '') + ' ' + (el.getAttribute('aria-label') || ''));
    const dirOf = v => { const m = /[A-Za-z؀-ۿ]/.exec(v || ''); return m && /[A-Za-z]/.test(m[0]) ? 'ltr' : 'rtl'; };
    function fix(el) {
        if (!el || el.nodeType !== 1) return;
        const tag = el.tagName; if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        if (el.dataset.bdSkip === undefined) el.dataset.bdSkip = (el.hasAttribute('dir') || el.hasAttribute('data-nobd') || (tag === 'INPUT' && (SKIP.test(el.type) || /^(numeric|decimal|tel)$/.test(el.getAttribute('inputmode') || '')))) ? '1' : '0';
        if (el.dataset.bdSkip === '1') return;
        const d = isNote(el) ? 'rtl' : dirOf(el.value);
        if (el.dataset.bd !== d) { el.dataset.bd = d; el.classList.toggle('bd-ltr', d === 'ltr'); el.classList.toggle('bd-rtl', d === 'rtl'); }
    }
    const scan = () => { document.querySelectorAll('input, textarea').forEach(fix); };
    ['input', 'change', 'focusin'].forEach(t => document.addEventListener(t, e => fix(e.target), true));
    setInterval(scan, 800); scan();
})();
