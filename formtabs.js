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
// من «سريع» إلى «مفصل»
function catGoDetailed() {
    const g = i => (document.getElementById(i) || {}).value || '';
    const name = g('qpName').trim(), bc = cleanBarcode(g('qpBc')), id = window.__qpId || 0, cb = window.__qpCb;
    try { Swal.close(); } catch (e) { /* تجاهل */ }
    fmNext = typeof cb === 'function' ? cb : null;
    openFormModal(id || null);
    if (!id) {
        if (name) document.getElementById('fName').value = name;
        if (bc) { document.getElementById('fBarcode').value = bc; addFormBarcode(); }
        formSnapshot = '';
    }
}
