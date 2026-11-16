// تشخيص الأداء: Ctrl+Shift+P (أو perfDiag() من أي مكان). يقيس الحمل الفعلي على بيانات هذا الجهاز ويعرض النتيجة في نافذة.
(function () {
    'use strict';
    const longs = []; let t0 = performance.now();
    try { new PerformanceObserver(l => l.getEntries().forEach(e => { longs.push({ at: Math.round(e.startTime / 1000), d: Math.round(e.duration) }); if (longs.length > 400) longs.shift(); })).observe({ entryTypes: ['longtask'] }); } catch (e) { /* غير مدعوم */ }
    const timers = { i: 0, t: 0 };
    const si = window.setInterval; window.setInterval = function (f, ms) { timers.i++; return si.apply(this, arguments); };
    const kb = n => (n / 1024 >= 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
    function lsReport() {
        let tot = 0; const rows = [];
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), n = (localStorage.getItem(k) || '').length * 2; tot += n; rows.push([k, n]); } } catch (e) { /* تجاهل */ }
        rows.sort((a, b) => b[1] - a[1]); return { tot, top: rows.slice(0, 7) };
    }
    function time(fn) { const a = performance.now(); let r; try { r = fn(); } catch (e) { r = 'ERR ' + e.message; } return { ms: Math.round(performance.now() - a), r }; }
    async function fps(ms) { return new Promise(res => { let n = 0, worst = 0, last = performance.now(), a = last; const f = now => { n++; worst = Math.max(worst, now - last); last = now; if (now - a < ms) requestAnimationFrame(f); else res({ fps: Math.round(n / ((now - a) / 1000)), worst: Math.round(worst) }); }; requestAnimationFrame(f); }); }
    async function run() {
        const L = [];
        const up = Math.round((performance.now() - t0) / 1000);
        const lt = longs.slice(-60), ltTot = lt.reduce((s, x) => s + x.d, 0), ltMax = lt.reduce((m, x) => Math.max(m, x.d), 0);
        L.push('مدة التشغيل: ' + up + ' ث · مهام طويلة (آخر ' + lt.length + '): مجموعها ' + ltTot + ' م.ث، أطولها ' + ltMax + ' م.ث');
        L.push('مؤقتات دورية مسجّلة: ' + timers.i);
        L.push('عقد الصفحة: ' + document.getElementsByTagName('*').length + ' · صور: ' + document.images.length);
        try { const m = performance.memory; if (m) L.push('الذاكرة: ' + kb(m.usedJSHeapSize) + ' من ' + kb(m.jsHeapSizeLimit)); } catch (e) { /* تجاهل */ }
        const p = (typeof products !== 'undefined' ? products : []);
        let pj = 0, imgN = 0, imgB = 0, big = [];
        p.forEach(x => { const s = JSON.stringify(x).length; pj += s; ['img', 'image', 'photo', 'pic'].forEach(k => { if (typeof x[k] === 'string' && x[k].length > 500) { imgN++; imgB += x[k].length; } }); if (s > 20000) big.push(s); });
        L.push('الأصناف: ' + p.length + ' · حجمها ' + kb(pj) + ' · صور مضمّنة: ' + imgN + ' (' + kb(imgB) + ') · أصناف > 20KB: ' + big.length);
        const ls = lsReport(); L.push('التخزين المحلي: ' + kb(ls.tot) + ' · الأكبر: ' + ls.top.map(r => r[0] + ' ' + kb(r[1])).join(' ، '));
        const sv = time(() => saveLocal()); L.push('saveLocal: ' + sv.ms + ' م.ث');
        const bk = time(() => JSON.stringify(buildFullBackup()).length); L.push('بناء النسخة الكاملة: ' + bk.ms + ' م.ث · حجمها ' + (typeof bk.r === 'number' ? kb(bk.r) : bk.r));
        const ra = time(() => { if (typeof renderAll === 'function') renderAll(); }); L.push('renderAll: ' + ra.ms + ' م.ث');
        const home = time(() => { if (typeof refreshHome === 'function') refreshHome(); }); L.push('refreshHome: ' + home.ms + ' م.ث');
        const f = await fps(2500); L.push('سلاسة الرسم (خمول): ' + f.fps + ' إطار/ث · أسوأ إطار ' + f.worst + ' م.ث');
        const busy = longs.filter(x => x.at >= up).length; L.push('مهام طويلة خلال القياس: ' + busy);
        window.__perfLast = L.join('\n');
        try { await Swal.fire({ title: 'تشخيص الأداء', html: '<pre dir="rtl" style="text-align:right;white-space:pre-wrap;font-size:.78rem;line-height:1.7;margin:0">' + L.map(s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n') + '</pre>', confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', width: 760 }); } catch (e) { alert(L.join('\n')); }
    }
    window.perfDiag = run;
    document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) { e.preventDefault(); run(); } });
})();
