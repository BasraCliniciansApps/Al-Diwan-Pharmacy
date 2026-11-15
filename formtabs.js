// نوافذ إضافة/تعديل المادة: تبويبان «سريع» (تسعير وتعديل سريع) و«مفصل» (النموذج الكامل بالترتيب الجديد).
let fmAfter = null, fmNext = null, fmTimer = 0;
function fmImgSync() {
    const v = ((document.getElementById('fImg') || {}).value || '').trim(), im = document.getElementById('fImgPrev'), ph = document.getElementById('fImgPh'); if (!im || !ph) return;
    const ok = v && !v.includes('⏳');
    if (ok && im.getAttribute('src') !== v) im.setAttribute('src', v);
    im.style.display = ok ? '' : 'none'; ph.style.display = ok ? 'none' : '';
    ph.firstChild.textContent = v.includes('⏳') ? '⏳' : '📷';
}
(function () {
    const _open = openFormModal;
    openFormModal = function (id) {
        fmAfter = fmNext; fmNext = null;
        const r = _open.apply(this, arguments);
        const im = document.getElementById('fImgPrev'); if (im) im.removeAttribute('src');
        fmImgSync(); clearInterval(fmTimer); fmTimer = setInterval(() => { const m = document.getElementById('formModal'); if (!m || m.style.display === 'none') { clearInterval(fmTimer); return; } fmImgSync(); }, 500);
        document.querySelectorAll('#formModal details.fm-sec').forEach(d => { d.open = false; });
        const body = document.querySelector('#formModal .modal-card'); if (body) body.scrollTop = 0;
        return r;
    };
    const _saved = typeof onProductSaved === 'function' ? onProductSaved : null;
    if (_saved) onProductSaved = function (obj) { _saved(obj); const f = fmAfter; fmAfter = null; if (typeof f === 'function') { try { f(obj); } catch (e) { /* تجاهل */ } } };
})();
// من «مفصل» إلى «سريع»
async function fmGoQuick() {
    const id = parseInt(document.getElementById('editId').value) || 0;
    if (id && formSerialize() !== formSnapshot) { await requestCloseForm(); const m = document.getElementById('formModal'); if (m && m.style.display !== 'none' && m.style.display) return; }
    else closeFormModal();
    const name = (document.getElementById('fName').value || '').trim(), bc = (formBarcodes && formBarcodes[0]) || cleanBarcode(document.getElementById('fBarcode').value);
    const cb = fmAfter; fmAfter = null;
    catPrice(id, id ? undefined : { bc, name }, cb);
}
// من «سريع» إلى «مفصل»: ننقل قيم الحقول المعدّلة إلى النموذج المفصل حتى لا تضيع
function fmQuickValues() {
    const g = i => (document.getElementById(i) || {}).value;
    return { name: String(g('qpName') || '').trim(), bc: cleanBarcode(g('qpBc') || ''), qty: g('qpQty'), loose: g('qpLoose'), mode: g('qpMode'), cost: g('qpCost'), price: g('qpPrice'), mk: g('qpMk'), sc: g('qpSc'), st: g('qpSt'), sp: g('qpSp') };
}
function fmCarry(q) {
    const set = (i, v) => { const el = document.getElementById(i); if (!el || v === undefined || v === null) return; if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(v))) return; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('fName', q.name); set('fQty', q.qty); set('fLoose', q.loose);
    set('fPriceMode', q.mode); set('fCost', q.cost); set('fMarkup', q.mk); set('fPrice', q.price);
    const sc = parseInt(q.sc) || 0; set('fSubCount', sc >= 2 ? sc : ''); if (sc >= 2) { set('fSubType', q.st); if (parseFloat(q.sp) > 0) set('fSubPrice', q.sp); }
    if (q.bc && typeof formBarcodes !== 'undefined') { formBarcodes = [q.bc].concat(formBarcodes.filter(x => x !== q.bc)); if (typeof renderBarcodeChips === 'function') renderBarcodeChips(); }
}
function catGoDetailed() {
    const q = fmQuickValues(), name = q.name, bc = q.bc, id = window.__qpId || 0, cb = window.__qpCb;
    try { Swal.close(); } catch (e) { /* تجاهل */ }
    fmNext = typeof cb === 'function' ? cb : null;
    openFormModal(id || null);
    if (!id) {
        if (name) document.getElementById('fName').value = name;
        if (bc) { document.getElementById('fBarcode').value = bc; addFormBarcode(); }
        formSnapshot = '';
    }
    try { fmCarry(q); } catch (e) { /* تجاهل */ }
}
