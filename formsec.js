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
    { id: 'exp', ico: '📅', t: 'تواريخ النفاذ', open: false, f: ['expiryDatesWrap'] },
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
