// ============================================================================
// نموذج الصنف: أقسام مطوية بحسب أولوية الإدخال + ملخص وحالة لكل قسم + شريط حفظ ثابت.
// وضع «إضافة سريعة» عند إنشاء مادة جديدة من الوارد (الكمية والنفاذ تأتي من الوارد نفسه).
// ما يغيّر أي حقل أو id؛ فقط ينقل الحقول داخل أقسام.
// ============================================================================
const FS_DEF = [
    { id: 'basic', ico: '🏷️', t: 'الأساسي', open: true, f: ['fName', 'fBrand', 'fMeta', 'fBarcode'] },
    { id: 'cls', ico: '🗂️', t: 'التصنيف', open: true, f: ['fDepartment', 'fCategory', 'fType', 'fForm', 'fFormOtherWrap'] },
    { id: 'price', ico: '💰', t: 'السعر', open: true, f: ['fPriceMode', 'fPrice', 'fCost'] },
    { id: 'stock', ico: '📦', t: 'المخزون والتجزئة', open: false, f: ['fQty', '.retail-box', 'fMinQty'] },
    { id: 'exp', ico: '📅', t: 'الدفعات وتواريخ النفاذ', open: false, f: ['expiryDatesWrap'] },
    { id: 'more', ico: '📝', t: 'تفاصيل إضافية', open: false, f: ['fActive', 'fDetails', 'fKeywords', 'fImg'] }
];
let fsBuilt = false, fsTimer = null, fsQuick = false;
const fsEl = id => document.getElementById(id);
function fsGroup(sel) { const e = sel.startsWith('.') ? document.querySelector('#formModal ' + sel) : fsEl(sel); if (!e) return null; return e.classList.contains('form-group') ? e : e.closest('.form-group'); }
function fsBuild() {
    if (fsBuilt) return; const card = document.querySelector('#formModal .modal-card'), scan = card && card.querySelector('.scan-box'); if (!card || !scan) return;
    const wrap = document.createElement('div'); wrap.id = 'fsSections';
    FS_DEF.forEach(s => {
        const sec = document.createElement('div'); sec.className = 'fs-sec' + (s.open ? ' open' : ''); sec.id = 'fs-' + s.id;
        sec.innerHTML = `<button type="button" class="fs-bar" onclick="fsToggle('${s.id}')"><span class="fs-ico">${s.ico}</span><span class="fs-t">${s.t}</span><small class="fs-sum" id="fsSum-${s.id}"></small><i class="fs-dot" id="fsDot-${s.id}"></i><span class="fs-chev">▾</span></button><div class="fs-body"></div>`;
        const body = sec.querySelector('.fs-body'), seen = new Set();
        s.f.forEach(f => { const g = fsGroup(f); if (g && !seen.has(g)) { seen.add(g); body.appendChild(g); } });
        wrap.appendChild(sec);
    });
    const m = document.createElement('div'); m.id = 'fMarginLive'; m.className = 'fs-margin'; wrap.querySelector('#fs-price .fs-body').appendChild(m);
    scan.insertAdjacentElement('afterend', wrap);
    card.addEventListener('input', fsRefresh); card.addEventListener('change', fsRefresh);
    fsBuilt = true;
}
function fsToggle(id) { const s = fsEl('fs-' + id); if (s) s.classList.toggle('open'); }
function fsSelTxt(id) { const e = fsEl(id); if (!e) return ''; const o = e.options && e.options[e.selectedIndex]; return o ? o.textContent.trim() : (e.value || ''); }
function fsRefresh() {
    if (!fsBuilt) return; const v = id => ((fsEl(id) || {}).value || '').trim(), set = (id, t, bad) => { const s = fsEl('fsSum-' + id), d = fsEl('fsDot-' + id); if (s) s.textContent = t; if (d) d.className = 'fs-dot' + (bad ? ' bad' : ''); };
    set('basic', [v('fName'), v('fBrand'), v('fMeta')].filter(Boolean).join(' · ') || 'لم يُملأ بعد', !v('fName'));
    const dep = fsSelTxt('fDepartment'), cat = fsSelTxt('fCategory'), form = fsSelTxt('fForm');
    set('cls', [dep && cat ? dep + ' › ' + cat : (dep || cat), form].filter(Boolean).join(' · ') || 'غير محدد', !dep);
    const pr = parseFloat(v('fPrice')) || 0, co = parseFloat(v('fCost')) || 0;
    let mg = ''; if (pr > 0 && co > 0) mg = ' · هامش ' + ((pr - co) / pr * 100).toFixed(1) + '٪';
    set('price', pr > 0 ? fmtNum(pr) + ' د.ع' + mg : 'غير مسعّر', !(pr > 0));
    const ml = fsEl('fMarginLive'); if (ml) { ml.style.display = pr > 0 && co > 0 ? 'block' : 'none'; if (pr > 0 && co > 0) { ml.className = 'fs-margin' + (pr < co ? ' bad' : ''); ml.innerHTML = 'الربح: <b>' + fmtNum(pr - co) + ' د.ع (' + ((pr - co) / pr * 100).toFixed(1) + '٪)</b>'; } }
    const q = parseInt(v('fQty')) || 0, sc = parseInt(v('fSubCount')) || 0; set('stock', q + ' عبوة' + (sc > 1 ? ' · تجزئة ' + sc + ' ' + fsSelTxt('fSubType') : '') + (parseInt(v('fMinQty')) > 0 ? ' · تنبيه ' + v('fMinQty') : ''));
    const ex = [...document.querySelectorAll('#expiryDatesWrap .expiry-input')].filter(i => i.value).length; set('exp', ex ? ex + (ex === 1 ? ' تاريخ' : ' تواريخ') : 'لا يوجد');
    set('more', [v('fActive'), v('fKeywords')].filter(Boolean).join(' · ') || (v('fImg') ? 'صورة مضافة' : 'اختياري'));
}
function fsApply(id) {
    fsBuild(); if (!fsBuilt) return;
    const isNew = !id; fsQuick = !!(isNew && typeof puAwaiting !== 'undefined' && puAwaiting);
    FS_DEF.forEach(s => { const e = fsEl('fs-' + s.id); if (!e) return; let open = s.open; if (s.id === 'stock' && isNew && !fsQuick) open = true; e.classList.toggle('open', open); e.classList.toggle('fs-hide', fsQuick && (s.id === 'stock' || s.id === 'exp')); });
    let n = fsEl('fsQuickNote'); if (fsQuick) { if (!n) { n = document.createElement('div'); n.id = 'fsQuickNote'; n.className = 'fs-note'; n.innerHTML = '⚡ <b>إضافة سريعة من الوارد</b> — الكمية والنفاذ وسعر الشراء تُسجَّل من الوارد نفسه. أكمل الاسم والتصنيف والسعر فقط.'; fsEl('fsSections').insertAdjacentElement('beforebegin', n); } n.style.display = 'block'; } else if (n) n.style.display = 'none';
    fsRefresh(); clearInterval(fsTimer); fsTimer = setInterval(() => { const m = fsEl('formModal'); if (!m || m.style.display === 'none') { clearInterval(fsTimer); return; } fsRefresh(); }, 700);
    const card = document.querySelector('#formModal .modal-card'); if (card) card.scrollTop = 0;
}
(function () {
    const orig = window.openFormModal; if (typeof orig !== 'function') return;
    window.openFormModal = function (id) { const r = orig.apply(this, arguments); try { fsApply(id); } catch (e) { /* تجاهل */ } return r; };
})();

// ============================================================================
// المرحلة 2: كشف التكرار، مسودة تلقائية للمادة الجديدة، تمييز الحقل الناقص قبل الحفظ
// ============================================================================
const FS_DRAFT_LS = 'diwanFormDraft';
const FS_FIELDS = ['fDepartment', 'fCategory', 'fType', 'fForm', 'fFormOther', 'fName', 'fBrand', 'fMeta', 'fActive', 'fDetails', 'fKeywords', 'fImg', 'fPriceMode', 'fMarkup', 'fPrice', 'fCost', 'fQty', 'fMinQty', 'fSubCount', 'fSubType', 'fSubPrice', 'fLoose'];
const fsNz = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
function fsLev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length; let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
}
function fsDupes() {
    const id = parseInt((fsEl('editId') || {}).value) || 0, name = fsNz((fsEl('fName') || {}).value), out = [];
    if (name.length >= 4) products.forEach(p => { if (p.id === id) return; const n = fsNz(p.name); if (!n) return; if (n === name || (Math.min(n.length, name.length) >= 6 && (n.includes(name) || name.includes(n))) || (name.length >= 6 && fsLev(n, name) <= 2)) out.push({ p, why: 'اسم مشابه' }); });
    (typeof formBarcodes !== 'undefined' ? formBarcodes : []).forEach(b => { const p = findByBarcode(b); if (p && p.id !== id && !out.some(x => x.p.id === p.id)) out.unshift({ p, why: 'نفس الباركود' }); else if (p && p.id !== id) out.find(x => x.p.id === p.id).why = 'نفس الباركود'; });
    return out.slice(0, 3);
}
let fsDupKey = '', fsPriceAsked = false;
function fsRenderDupes() {
    const box = fsEl('fsDup'); if (!box) return; const d = fsDupes(), key = d.map(x => x.p.id + x.why).join(',');
    if (key === fsDupKey) return; fsDupKey = key;
    box.style.display = d.length ? 'block' : 'none';
    box.innerHTML = d.length ? '<b>⚠ مادة مشابهة موجودة بالفعل</b>' + d.map(x => `<div class="fs-dup-r"><span><b dir="ltr">${escapeHtml(x.p.name)}</b><small>${x.why} · ${fmtNum(x.p.price || 0)} د.ع · بالمخزن ${escapeHtml(stockLabel(x.p))}</small></span><button type="button" onclick="fsOpenDup(${x.p.id})">افتحها</button></div>`).join('') + '<small>إن كانت المادة نفسها فافتحها وعدّل عليها بدل إضافة نسخة ثانية.</small>' : '';
}
function fsOpenDup(id) { fsClearDraft(); closeFormModal(); openFormModal(id); }
// ---- مسودة ----
function fsDraftGet() { try { const d = JSON.parse(localStorage.getItem(FS_DRAFT_LS)); return d && Date.now() - d.t < 864e5 ? d : null; } catch (e) { return null; } }
function fsClearDraft() { try { localStorage.removeItem(FS_DRAFT_LS); } catch (e) { /* تجاهل */ } const b = fsEl('fsDraft'); if (b) b.style.display = 'none'; }
function fsDraftSave() {
    if ((fsEl('editId') || {}).value || fsQuick) return;
    const d = { t: Date.now(), v: {}, bc: (typeof formBarcodes !== 'undefined' ? formBarcodes : []).slice(), ex: [...document.querySelectorAll('#expiryDatesWrap .expiry-input')].map(i => i.value).filter(Boolean) };
    FS_FIELDS.forEach(f => { const e = fsEl(f); if (e) d.v[f] = e.value; });
    if (!(d.v.fName || '').trim() && !d.bc.length) return;
    try { localStorage.setItem(FS_DRAFT_LS, JSON.stringify(d)); } catch (e) { /* تجاهل */ }
}
function fsDraftRestore() {
    const d = fsDraftGet(); if (!d) return; const set = (f, v) => { const e = fsEl(f); if (e && v !== undefined) { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('fDepartment', d.v.fDepartment); if (typeof onDeptChanged === 'function') onDeptChanged();
    FS_FIELDS.forEach(f => { if (f !== 'fDepartment') set(f, d.v[f]); });
    if (typeof onFormChange === 'function') try { onFormChange(); } catch (e) { /* تجاهل */ }
    if (typeof formBarcodes !== 'undefined') { formBarcodes = (d.bc || []).slice(); if (typeof renderBarcodeChips === 'function') renderBarcodeChips(); }
    if (fsEl('expiryDatesWrap')) setExpiryDatesInForm(d.ex || []);
    if (typeof onPriceModeChange === 'function') try { onPriceModeChange(); } catch (e) { /* تجاهل */ }
    fsClearDraft(); fsRefresh(); fsRenderDupes();
}
function fsDraftBanner(isNew) {
    let b = fsEl('fsDraft'); if (!b) { b = document.createElement('div'); b.id = 'fsDraft'; b.className = 'fs-note fs-draft'; fsEl('fsSections').insertAdjacentElement('beforebegin', b); }
    const d = isNew && !fsQuick ? fsDraftGet() : null;
    if (!d) { b.style.display = 'none'; return; }
    b.style.display = 'block';
    b.innerHTML = `📝 لديك مسودة غير محفوظة: <b dir="ltr">${escapeHtml(d.v.fName || 'بدون اسم')}</b><div class="fs-draft-act"><button type="button" onclick="fsDraftRestore()">استرجاع</button><button type="button" class="g" onclick="fsClearDraft()">تجاهل</button></div>`;
}
// ---- تمييز الحقل الناقص ----
function fsMark(id, msg) {
    const e = fsEl(id); if (!e) return; const sec = e.closest('.fs-sec'); if (sec) sec.classList.add('open');
    e.classList.add('fs-err'); setTimeout(() => e.classList.remove('fs-err'), 2600);
    try { e.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.focus({ preventScroll: true }); } catch (x) { /* تجاهل */ }
}
(function () {
    const base = window.fsApply = (function (o) { return function (id) { o(id); fsPriceAsked = false; fsInsertDup(); fsDraftBanner(!id); fsDupKey = ''; fsRenderDupes(); }; })(fsApply);
    const _r = fsRefresh;
    window.fsRefresh = function () { _r(); try { fsRenderDupes(); fsDraftSave(); } catch (e) { /* تجاهل */ } };
    // ملاحظة: مستمعو input/change المسجّلون يستدعون النسخة القديمة؛ لذلك نضيف مستمعاً للنسخة الجديدة
    const card = document.querySelector('#formModal .modal-card'); if (card) { card.addEventListener('input', () => { try { fsRenderDupes(); clearTimeout(window.__fsDT); window.__fsDT = setTimeout(fsDraftSave, 800); } catch (e) { /* تجاهل */ } }); }
    const sv = window.saveFormProduct;
    if (typeof sv === 'function') window.saveFormProduct = async function () {
        if (!(((fsEl('fName') || {}).value || '').trim())) { fsMark('fName'); }
        if (((fsEl('fName') || {}).value || '').trim() && !(parseFloat((fsEl('fPrice') || {}).value) > 0) && !fsPriceAsked) {   // السعر فارغ: تنبيه مرة وحدة، والضغطة الثانية تحفظ
            fsPriceAsked = true; fsMark('fPrice');
            Swal.fire({ icon: 'warning', title: 'السعر فارغ', text: 'اكتب سعر البيع، أو اضغط حفظ مرة أخرى للحفظ دون سعر.', toast: true, position: 'top', showConfirmButton: false, timer: 3500 });
            return;
        }
        const r = await sv.apply(this, arguments);
        const m = fsEl('formModal'); if (m && (m.style.display === 'none' || !m.style.display)) fsClearDraft();
        return r;
    };
})();
function fsInsertDup() { if (fsEl('fsDup')) return; const d = document.createElement('div'); d.id = 'fsDup'; d.className = 'fs-dup'; d.style.display = 'none'; const body = document.querySelector('#fs-basic .fs-body'); if (body) body.insertAdjacentElement('afterbegin', d); }
