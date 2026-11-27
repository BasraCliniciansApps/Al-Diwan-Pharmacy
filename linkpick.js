// =====================================================================
// المادة المرافقة: ربط الأمبول/الفيال بمادة تلزمه (سرنجة مثلاً). عند إضافة المادة للفاتورة يُقترح إضافة المرافقة.
// p.link = { pid, qty }  — qty = عدد المرافق لكل قطعة مباعة (أمبولة / فيال). المرافق مادة مستقلة بمخزنها وجردها.
// =====================================================================
const LK_AUTO_KEY = 'diwanLinkAuto';
let lkBusy = false;   // يمنع سلسلة اقتراحات (إضافة المرافق لا تقترح مرافقاً له)
function lkAutoOn() { try { return localStorage.getItem(LK_AUTO_KEY) === '1'; } catch (e) { return false; } }
function lkAutoSet(on) { try { localStorage.setItem(LK_AUTO_KEY, on ? '1' : '0'); } catch (e) { /* تجاهل */ } document.querySelectorAll('.im-lk').forEach(c => { c.checked = !!on; }); }
function lkOf(p) {
    if (!p || !p.link || !p.link.pid) return null;
    const lp = products.find(x => x.id === p.link.pid); if (!lp || lp.arch || lp.id === p.id) return null;
    return { p: lp, qty: Math.max(1, parseInt(p.link.qty) || 1) };
}
// ---- نافذة اختيار مادة (بحث) ----
function lkPick(title) {
    return new Promise(resolve => {
        let found = [], done = false;
        const fin = v => { if (done) return; done = true; resolve(v); };
        Swal.fire({
            title: title || 'اختيار المادة المرافقة', showCancelButton: true, showConfirmButton: false, cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38',
            html: '<input id="lkQ" class="swal2-input" dir="auto" placeholder="ابحث باسم المادة…" autocomplete="off"><div id="lkRes" class="lk-res"></div>',
            didOpen: () => {
                const q = document.getElementById('lkQ'), box = document.getElementById('lkRes');
                q.focus();
                q.addEventListener('input', () => {
                    const qn = normSearch(q.value);
                    if (!qn) { found = []; box.innerHTML = ''; return; }
                    const toks = qn.split(' ');
                    found = products.filter(p => !p.arch).map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
                    box.innerHTML = found.map(p => `<button type="button" class="lk-row" data-id="${p.id}"><span dir="ltr">${dispNameHtml(p)}</span></button>`).join('') || '<div class="lk-none">لا نتائج</div>';
                });
                box.addEventListener('click', e => { const b = e.target.closest('.lk-row'); if (!b) return; fin(parseInt(b.dataset.id)); Swal.close(); });
            },
            willClose: () => fin(null)
        });
    });
}
// ---- حقل نموذج المادة ----
let lkForm = null;   // { pid, qty } الحالي في النموذج
function lkFormLoad(p) { lkForm = p && p.link && p.link.pid ? { pid: p.link.pid, qty: Math.max(1, parseInt(p.link.qty) || 1) } : null; lkFormRender(); }
function lkFormRead() { return lkForm && lkForm.pid ? { link: { pid: lkForm.pid, qty: Math.max(1, parseInt((document.getElementById('fLinkQty') || {}).value) || lkForm.qty || 1) } } : { link: null }; }
function lkFormRender() {
    const nm = document.getElementById('fLinkName'), q = document.getElementById('fLinkQty'), clr = document.getElementById('fLinkClr'); if (!nm) return;
    const lp = lkForm && products.find(x => x.id === lkForm.pid);
    nm.textContent = lp ? dispName(lp) : 'بلا مادة مرافقة'; nm.classList.toggle('lk-empty', !lp);
    if (q) { q.value = lp ? lkForm.qty : 1; q.disabled = !lp; }
    if (clr) clr.style.display = lp ? '' : 'none';
}
async function lkFormPick() {
    const id = await lkPick(); if (!id) return;
    const cur = parseInt((document.getElementById('fLinkQty') || {}).value) || 1;
    lkForm = { pid: id, qty: lkForm ? cur : 1 }; lkFormRender();
}
function lkFormClear() { lkForm = null; lkFormRender(); }
// ---- ربط من الجرد ----
async function lkCountLink(pid) {
    const p = products.find(x => x.id === pid); if (!p) return;
    if (typeof cnCanEdit === 'function' && !cnCanEdit()) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'ربط المادة المرافقة يحتاج صلاحية تعديل المواد.', confirmButtonColor: '#0f1c38' }); return; }
    const cur = lkOf(p);
    if (cur) {
        const r = await Swal.fire({ title: 'المادة المرافقة', html: `<div dir="auto" style="line-height:1.9"><b dir="ltr">${escapeHtml(dispName(cur.p))}</b><br>العدد لكل قطعة مباعة: ${cur.qty}</div>`, showCancelButton: true, showDenyButton: true, confirmButtonText: 'تغيير', denyButtonText: 'إزالة الربط', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' });
        if (r.isDenied) { const old = p.link; p.link = null; const ok = await saveProductsDelta([{ p, dq: 0, dl: 0 }]); if (!ok) p.link = old; if (typeof cnRedraw === 'function') cnRedraw(); return; }
        if (!r.isConfirmed) return;
    }
    const id = await lkPick(); if (!id) return;
    if (id === p.id) { Swal.fire({ icon: 'warning', title: 'لا يمكن ربط المادة بنفسها', toast: true, position: 'top', showConfirmButton: false, timer: 2000 }); return; }
    const r2 = await Swal.fire({ title: 'عدد المرافق لكل قطعة مباعة (أمبولة / فيال)', input: 'number', inputValue: cur ? cur.qty : 1, inputAttributes: { min: 1, step: 1 }, showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
    if (!r2.isConfirmed) return;
    const old = p.link; p.link = { pid: id, qty: Math.max(1, parseInt(r2.value) || 1) };
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0 }]); if (!ok) p.link = old;
    if (typeof cnRedraw === 'function') cnRedraw();
}
function lkCountChip(p) {
    const l = lkOf(p);
    return `<button type="button" class="cn-lk ${l ? 'has' : ''}" onclick="lkCountLink(${p.id})">🔗 <span dir="auto">${l ? escapeHtml(l.p.name) + (l.qty > 1 ? ' ×' + l.qty : '') : 'ربط مادة مرافقة'}</span></button>`;
}
// ---- الاقتراح عند البيع ----
function lkAddLinked(l, n) {
    lkBusy = true;
    try {
        const unit = typeof sellDefUnit === 'function' ? sellDefUnit(l.p) : 'pack';
        if (typeof posAdd === 'function') posAdd(l.p.id, unit, n);
        else if (typeof billAddProduct === 'function') { for (let i = 0; i < n; i++) billAddProduct(l.p.id); }
        if (typeof posDone_ === 'function' && typeof posOpenFlag !== 'undefined' && posOpenFlag) posDone_();
        else { try { renderInvoiceRows(); billChanged(); } catch (e) { /* تجاهل */ } }
    } finally { lkBusy = false; }
}
// units = العدد المباع، unit = pack|part. المرافق يُحسب لكل قطعة (أمبولة)، فبيع عبوة كاملة من 5 يقترح 5 مرافق
function lkOffer(pid, units, unit) {
    if (lkBusy) return;
    const p = products.find(x => x.id === pid), l = lkOf(p); if (!l) return;
    const pieces = Math.max(1, Math.round(units || 1)) * (unit === 'part' || !hasRetail(p) ? 1 : btSc(p));
    const n = l.qty * pieces;
    const nm = l.p.name + ' ×' + n;
    setTimeout(async () => {
        if (lkAutoOn()) {
            lkAddLinked(l, n);
            Swal.fire({ icon: 'success', title: 'أُضيف المرافق: ' + nm, toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
            return;
        }
        const r = await Swal.fire({ toast: true, position: 'bottom', icon: 'question', title: 'إضافة ' + nm + '؟', showConfirmButton: true, confirmButtonText: 'إضافة', showCancelButton: true, cancelButtonText: 'تخطي', confirmButtonColor: '#0f1c38', timer: 9000, timerProgressBar: true });
        if (r.isConfirmed) lkAddLinked(l, n);
    }, 450);
}
