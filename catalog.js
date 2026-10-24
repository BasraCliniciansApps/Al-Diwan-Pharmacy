// سجل الأدوية: كل الأصناف بتسلسل الإدخال، مع زر ضم لمادة أخرى وزر قراءة/ربط الباركود
let catQ = '';
function catRankMap() { const m = new Map(); products.slice().sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)).forEach((p, i) => m.set(p.id, i + 1)); return m; }
function catInput() { catQ = (document.getElementById('catSearch') || {}).value || ''; renderCatalog(); }
function renderCatalog() {
    const box = document.getElementById('catList'); if (!box) return;
    const rank = catRankMap(), qn = normSearch(catQ);
    let arr = products.slice().sort((a, b) => rank.get(a.id) - rank.get(b.id));
    if (qn) { const toks = qn.split(' '); arr = arr.filter(p => searchScore(p, qn, toks) > 0); }
    const withBc = products.filter(p => barcodesOf(p).length).length;
    const sum = document.getElementById('catSum');
    if (sum) sum.innerHTML = `<span>${fmtNum(products.length)} مادة</span><span class="cat-ok">🟢 بباركود ${fmtNum(withBc)}</span><span class="cat-no">🔴 بلا باركود ${fmtNum(products.length - withBc)}</span>`;
    const SHOW = 300, part = arr.slice(0, SHOW);
    box.innerHTML = part.map(p => {
        const n = barcodesOf(p).length, meta = [p.brand, fixMetaOrder(p.meta || '')].filter(Boolean).join(' · ');
        return `<div class="cat-row"><span class="cat-n">${rank.get(p.id)}</span>
            <div class="cat-main" onclick="catPrice(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b><small dir="ltr">${escapeHtml(meta) || '—'}</small></div>
            <button type="button" class="cat-btn cat-merge" onclick="catMergeStart(${p.id})" title="ضم لمادة أخرى">⇄<small>ضم</small></button>
            <button type="button" class="cat-btn cat-bc ${n ? 'has' : 'none'}" onclick="catBarcode(${p.id})" title="${n ? n + ' باركود' : 'بلا باركود'}">▦<small>${n ? n : 'ربط'}</small></button>
            <div class="cat-sub">
                <div class="cat-qty"><button type="button" onclick="catQty(${p.id},-1)" aria-label="نقص">−</button><input type="number" inputmode="numeric" min="0" id="cq${p.id}" value="${parseInt(p.qty) || 0}" onchange="catQtySet(${p.id},this.value)" onfocus="this.select()"><button type="button" onclick="catQty(${p.id},1)" aria-label="زيادة">+</button></div>
                <button type="button" class="cat-price ${parseFloat(p.price) > 0 ? '' : 'none'}" onclick="catPrice(${p.id})">💲 ${parseFloat(p.price) > 0 ? fmtNum(p.price) : 'بلا سعر'} <small>تسعير</small></button>
            </div></div>`;
    }).join('') || '<div class="bill-none">لا توجد مواد مطابقة.</div>';
    if (catQ.trim()) box.insertAdjacentHTML('beforeend', `<button type="button" class="cat-add ${arr.length ? '' : 'big'}" onclick="catPrice(0, catQ.trim())">➕ إضافة «${escapeHtml(catQ.trim())}» كمادة جديدة</button>`);
    if (arr.length > SHOW) box.insertAdjacentHTML('beforeend', `<div class="bill-none">يظهر أول ${SHOW} من ${fmtNum(arr.length)} — استعمل البحث لتضييق القائمة.</div>`);
}

// ---------- الباركود ----------
async function catAddCode(p, code) {
    const c = cleanBarcode(code); if (!c) return;
    const dup = findByBarcode(c);
    if (dup && dup.id !== p.id) { Swal.fire({ icon: 'warning', title: 'الباركود مستعمل', html: `هذا الباركود مسجّل للمادة: <b dir="ltr">${escapeHtml(dup.name)}</b><br>إن كانت نفس المادة فاستعمل زر «ضم».`, confirmButtonColor: '#0f1c38' }); return; }
    const old = { barcodes: p.barcodes, barcode: p.barcode };
    const list = barcodesOf(p); if (!list.includes(c)) list.push(c);
    p.barcodes = list; p.barcode = list[0];
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0 }]);
    if (!ok) { p.barcodes = old.barcodes; p.barcode = old.barcode; return; }
    logAction('edit', p, [{ f: 'باركود', from: '', to: c }]);
    renderCatalog();
    Swal.fire({ icon: 'success', title: 'رُبط الباركود', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
}
function catScan(id) { const p = products.find(x => x.id === id); if (p) openBarcodeScanner(code => catAddCode(p, code)); }
async function catBarcode(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    const list = barcodesOf(p);
    if (!list.length) { catScan(id); return; }
    const r = await Swal.fire({ title: 'باركودات المادة', showCancelButton: true, showDenyButton: true, confirmButtonText: '📷 إضافة باركود', denyButtonText: '🗑 حذف الباركودات', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><div class="sw-info" dir="ltr"><b>${escapeHtml(p.name)}</b></div>${list.map(b => `<div class="sw-info" dir="ltr">▦ ${escapeHtml(b)}</div>`).join('')}</div>` });
    if (r.isConfirmed) catScan(id);
    else if (r.isDenied) {
        const old = { barcodes: p.barcodes, barcode: p.barcode }; p.barcodes = []; p.barcode = '';
        if (!(await saveProductsDelta([{ p, dq: 0, dl: 0 }]))) { p.barcodes = old.barcodes; p.barcode = old.barcode; return; }
        logAction('edit', p, [{ f: 'باركود', from: list.join(' | '), to: '' }]); renderCatalog();
    }
}

// ---------- الضم ----------
let catSrc = 0;
function catMergeStart(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    catSrc = id;
    Swal.fire({
        title: 'ضم «' + escapeHtml(p.name) + '» إلى مادة أخرى', showConfirmButton: false, showCancelButton: true, cancelButtonText: 'إلغاء', width: 'min(94vw, 480px)',
        customClass: { popup: 'bcp-popup', title: 'bcp-title', cancelButton: 'bcp-cancel' },
        html: `<div class="bcp-search"><span>🔍</span><input id="catMgSearch" placeholder="اكتب اسم المادة التي تريد الضم إليها..." autocomplete="off"></div>
            <div id="catMgRes" class="bcp-res"><div class="bcp-hint">ابحث عن المادة المطابقة. ستنتقل كمية وسجلات هذه المادة إليها ثم تُحذف هذه.</div></div>`,
        didOpen: () => {
            const inp = document.getElementById('catMgSearch'), res = document.getElementById('catMgRes'); if (!inp) return; inp.focus();
            inp.addEventListener('input', () => {
                const qn = normSearch(inp.value); if (!qn) { res.innerHTML = '<div class="bcp-hint">ابحث عن المادة المطابقة.</div>'; return; }
                const toks = qn.split(' ');
                const list = products.filter(x => x.id !== catSrc).map(x => [x, searchScore(x, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
                res.innerHTML = list.length ? list.map(x => bcpRowHtml(x).replace(`attachBarcodePick(${x.id})`, `catMergeConfirm(${x.id})`).replace('>ربط<', '>ضم<')).join('') : '<div class="bcp-hint">لا توجد نتائج</div>';
            });
        }
    });
}
async function catMergeConfirm(dstId) {
    try { Swal.close(); } catch (e) { /* تجاهل */ }
    const s = products.find(x => x.id === catSrc), d = products.find(x => x.id === dstId); if (!s || !d || s.id === d.id) return;
    if (!writesAllowed()) return;
    const refs = (puAll || []).filter(r => (r.items || []).some(l => l.pid === s.id)).length + (lgAll || []).filter(e => (e.items || []).some(l => l.pid === s.id)).length + (billAll || []).filter(b => (b.items || []).some(l => l.pid === s.id)).length;
    const c = await Swal.fire({ icon: 'warning', title: 'تأكيد الضم', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، ضمّ', cancelButtonText: 'إلغاء',
        html: `<div class="sw-form"><div class="sw-info" dir="ltr"><small>تُحذف:</small><br><b>${escapeHtml(s.name)}</b><br>الكمية ${stockLabel(s)}</div><div class="sw-info" dir="ltr"><small>وتبقى (تستلم الكمية والباركودات):</small><br><b>${escapeHtml(d.name)}</b><br>الكمية ${stockLabel(d)}</div><small>ينتقل إلى المادة الباقية: الكمية، الباركودات، تواريخ الانتهاء، وسجلاتها (${refs} سجل وارد/مردود/فاتورة). تُحفظ المادة المحذوفة في سلة المحذوفات 30 يوماً.</small></div>` });
    if (!c.isConfirmed) return;
    await catMerge(s, d);
}
async function catMerge(s, d) {
    const snap = JSON.stringify(d), dq = parseInt(s.qty) || 0, dl = parseInt(s.loose) || 0;
    const exp0 = getProductExpiryDates(d), expAdd = getProductExpiryDates(s).filter(e => !exp0.includes(e));
    try {
        // 1) المادة الباقية تستلم ما عند المحذوفة
        d.qty = (parseInt(d.qty) || 0) + dq; if (dl || d.loose !== undefined) d.loose = (parseInt(d.loose) || 0) + dl;
        const bc = barcodesOf(d); barcodesOf(s).forEach(b => { if (!bc.includes(b)) bc.push(b); }); d.barcodes = bc; d.barcode = bc[0] || '';
        if (expAdd.length) { d.expiryDates = exp0.concat(expAdd).sort(); d.expiryDate = d.expiryDates[0] || ''; }
        const kw = new Set(String(d.keywords || '').split(/[,،\s]+/).filter(Boolean)); [s.name, s.keywords].forEach(t => String(t || '').split(/[,،]+/).map(x => x.trim()).filter(Boolean).forEach(x => kw.add(x))); d.keywords = [...kw].join(', ');
        ['img', 'activeIngredient', 'details', 'brand', 'meta'].forEach(k => { if (!d[k] && s[k]) d[k] = s[k]; });
        if (!(parseFloat(d.price) > 0) && parseFloat(s.price) > 0) d.price = s.price;
        if (!(parseFloat(d.costPrice) > 0) && parseFloat(s.costPrice) > 0) d.costPrice = s.costPrice;
        const sl = s.lastPurchase, dlp = d.lastPurchase; if (sl && (!dlp || String(sl.date || '') > String(dlp.date || ''))) d.lastPurchase = sl;
        const entry = { p: d, dq, dl, expChanged: !!expAdd.length, expAdd, expRemove: [], cost: d.costPrice, lastSet: true, last: d.lastPurchase || null };
        if (!(await saveProductsDelta([entry]))) { Object.assign(d, JSON.parse(snap)); return; }
        // 2) إعادة ربط السجلات
        const re = l => { if (l && l.pid === s.id) { l.pid = d.id; return true; } return false; };
        for (const r of (puAll || []).slice()) { let ch = false; (r.items || []).forEach(l => { if (re(l)) ch = true; }); if (ch) await puSaveRecord(r); }
        for (const e of (lgAll || []).slice()) { let ch = false; (e.items || []).forEach(l => { if (re(l)) ch = true; }); if (ch) await lgSave(e); }
        for (const b of (billAll || []).slice()) { let ch = false; (b.items || []).forEach(l => { if (re(l)) ch = true; }); if (ch) await saveInvoiceRecord(b); }
        // 3) حذف المادة القديمة إلى السلة
        await moveToTrash(s); logAction('delete', s, [{ f: 'ضم إلى', from: s.name, to: d.name }]);
        products = products.filter(x => x.id !== s.id); saveLocal();
        if (isFirebaseReady && currentUser) { const delB = db.batch(); delB.delete(db.collection('pharmacy_products').doc(String(s.id))); delB.delete(db.collection('pharmacy_stock').doc(String(s.id))); if (costSplitOn) delB.delete(db.collection('pharmacy_cost').doc(String(s.id))); await fsCommit(delB); }
        logAction('edit', d, [{ f: 'ضم مادة', from: s.name, to: d.name }]);
        renderAll(); renderCatalog();
        Swal.fire({ icon: 'success', title: 'تم الضم', text: 'صارت الكمية في «' + d.name + '»: ' + stockLabel(d), confirmButtonColor: '#0f1c38' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر إكمال الضم', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' });
    }
}
function openCatalog() { try { closeCategoryManager(); } catch (e) { /* تجاهل */ } showView('catalog'); }

// ---------- صورة المادة من نافذة التفاصيل: لا صورة = إضافة، وجود صورة = عرض مع تبديل ----------
function sheetImgTap(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    if (p.img && String(p.img).trim()) zoomImage(p.img, id); else sheetImgPick(id);
}
function sheetImgPick(id) {
    const inp = document.getElementById('quickImgInput'); if (!inp) return;
    inp.value = ''; inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) quickImgUpload(id, f); };
    inp.click();
}
async function quickImgUpload(id, file) {
    const p = products.find(x => x.id === id); if (!p) return;
    if (!file.type.startsWith('image/')) { Swal.fire({ icon: 'warning', title: 'صيغة غير مدعومة', text: 'اختر صورة صحيحة.', confirmButtonColor: '#0f1c38' }); return; }
    if (!writesAllowed()) return;
    let token = localStorage.getItem('diwan_gh_token');
    if (!token) {
        const r = await Swal.fire({ title: 'مفتاح GitHub (لأول مرة فقط)', text: 'الصق المفتاح (يبدأ بـ ghp_) لحفظه في جهازك ورفع الصور:', input: 'text', inputPlaceholder: 'ghp_...', showCancelButton: true, confirmButtonText: 'حفظ ومتابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed || !String(r.value || '').trim()) return;
        token = r.value.trim(); localStorage.setItem('diwan_gh_token', token);
    }
    document.getElementById('zoomModal').style.display = 'none';
    Swal.fire({ title: 'جاري رفع الصورة...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(new Error('تعذر قراءة الصورة')); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
        const b64 = await new Promise((res, rej) => {
            const im = new Image(); im.onerror = () => rej(new Error('الصورة غير صالحة'));
            im.onload = () => { const cv = document.createElement('canvas'), max = 600; let w = im.width, h = im.height; if (w > h && w > max) { h *= max / w; w = max; } else if (h > max) { w *= max / h; h = max; } cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h); res(cv.toDataURL('image/jpeg', 0.82).split(',')[1]); };
            im.src = dataUrl;
        });
        const fileName = 'med_' + Date.now() + '.jpg', path = 'images/' + fileName;
        let resp, out;
        for (let i = 0; i < 5; i++) { // تعارض لحظي بالفرع (is at … but expected) → إعادة المحاولة
            resp = await fetch('https://api.github.com/repos/BasraCliniciansApps/Al-Diwan-Pharmacy/contents/' + path, { method: 'PUT', headers: { Authorization: 'token ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'صورة دواء: ' + fileName, content: b64, branch: 'main' }) });
            out = await resp.json().catch(() => ({}));
            if (resp.ok || !(resp.status === 409 || /but expected|is at/i.test(out.message || ''))) break;
            await new Promise(r => setTimeout(r, 1200 * (i + 1)));
        }
        if (!resp.ok || !out.content) { if (resp.status === 401) localStorage.removeItem('diwan_gh_token'); throw new Error(out.message || 'فشل الرفع إلى GitHub'); }
        const old = p.img; p.img = 'https://raw.githubusercontent.com/BasraCliniciansApps/Al-Diwan-Pharmacy/main/' + path;
        if (!(await saveProductsDelta([{ p, dq: 0, dl: 0 }]))) { p.img = old; Swal.close(); return; }
        logAction('edit', p, [{ f: 'الصورة', from: old || '', to: p.img }]);
        renderAll(); try { openSheet(p.id); } catch (e) { /* تجاهل */ }
        Swal.fire({ icon: 'success', title: old ? 'تم تبديل الصورة' : 'تمت إضافة الصورة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر رفع الصورة', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
}


// ---------- الكمية السريعة ----------
const catQStart = {}, catQTimer = {};
function catQtyShow(p) { const el = document.getElementById('cq' + p.id); if (el) el.value = parseInt(p.qty) || 0; }
function catQtyApply(p, to) {
    if (!writesAllowed()) { catQtyShow(p); return; }
    if (catQStart[p.id] === undefined) catQStart[p.id] = parseInt(p.qty) || 0;
    p.qty = Math.max(0, parseInt(to) || 0); catQtyShow(p);
    clearTimeout(catQTimer[p.id]); catQTimer[p.id] = setTimeout(() => catQtyFlush(p.id), 800);   // نجمع الضغطات المتتالية بكتابة واحدة
}
function catQty(id, d) { const p = products.find(x => x.id === id); if (p) catQtyApply(p, (parseInt(p.qty) || 0) + d); }
function catQtySet(id, v) { const p = products.find(x => x.id === id); if (p) catQtyApply(p, v); }
async function catQtyFlush(id) {
    const p = products.find(x => x.id === id), from = catQStart[id]; delete catQStart[id];
    if (!p || from === undefined) return;
    const to = parseInt(p.qty) || 0; if (from === to) return;
    const ok = await saveProductsDelta([{ p, dq: to - from, dl: 0 }]);
    if (!ok) { p.qty = from; catQtyShow(p); return; }
    logAction('qty', p, [{ f: 'الكمية', from: String(from), to: String(to) }]);
}

// ---------- نافذة التسعير السريع / إضافة مادة جديدة ----------
function catPriceHtml(p, isNew, pre) {
    const preBc = pre && /^\d{6,}$/.test(pre) ? pre : '', preName = pre && !preBc ? pre : '';
    const q = id => document.getElementById(id);
    const sub = (!isNew && p && subCountOf(p)) ? p : null;
    const types = subTypes.slice(); if (sub && sub.subType && !types.includes(sub.subType)) types.push(sub.subType);
    const pm = (p && p.pricing) || 'manual';
    return `<div class="sw-form qp">
        <label>اسم الدواء<input id="qpName" class="swal2-input" dir="ltr" value="${escapeHtml((p && p.name) || preName)}" placeholder="مثال: Panadol 500mg tablet"></label>
        <div class="qp-2"><label>العدد (عبوات)<input id="qpQty" type="number" inputmode="numeric" min="0" class="swal2-input" value="${p ? (parseInt(p.qty) || 0) : ''}" placeholder="0"></label>
        <label>الباركود<span class="qp-bc"><input id="qpBc" class="swal2-input" dir="ltr" inputmode="numeric" value="${escapeHtml(p ? (barcodesOf(p)[0] || '') : preBc)}" placeholder="اكتب أو امسح"><button type="button" id="qpScan">▦</button></span></label></div>
        <label>طريقة التسعير<select id="qpMode" class="swal2-input"><option value="manual">يدوي — ملصق الوزارة</option><option value="syndicate">حسب كتاب النقابة (سعر المذخر + نسبة)</option><option value="percent">بنسبة مئوية أدخلها أنا</option></select></label>
        <div class="qp-2"><label>سعر الشراء<input id="qpCost" type="number" inputmode="decimal" min="0" class="swal2-input" value="${p && p.costPrice ? p.costPrice : ''}"></label>
        <label id="qpMkW">نسبة الإضافة %<input id="qpMk" type="number" inputmode="decimal" min="0" step="any" class="swal2-input" value="${p && p.markupPct != null ? p.markupPct : ''}"></label></div>
        <label>سعر البيع (د.ع)<input id="qpPrice" type="number" inputmode="decimal" min="0" class="swal2-input" value="${p && p.price ? p.price : ''}"></label>
        <div class="sw-info" id="qpHint"></div>
        <div class="qp-ret"><b>🧩 البيع بالتجزئة (اختياري)</b><div class="qp-2"><label>عدد الأجزاء<input id="qpSc" type="number" inputmode="numeric" min="0" class="swal2-input" value="${sub ? subCountOf(sub) : ''}"></label>
        <label>نوع الجزء<select id="qpSt" class="swal2-input">${types.map(t => `<option value="${escapeHtml(t)}"${sub && sub.subType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label></div>
        <label>سعر الجزء (يُحسب تلقائياً)<input id="qpSp" type="number" inputmode="decimal" min="0" class="swal2-input" value="${sub && sub.subPrice ? sub.subPrice : ''}" data-manual="${sub && sub.subPrice && Math.round((parseFloat(sub.price) || 0) / subCountOf(sub)) !== (parseFloat(sub.subPrice) || 0) ? 1 : ''}"></label></div>
    </div>`;
}
function catPriceWire(p) {
    const $ = id => document.getElementById(id), mode = $('qpMode');
    mode.value = (p && p.pricing) || 'manual';
    const refresh = (fromUser) => {
        const m = mode.value, cost = $('qpCost').value, mk = $('qpMk').value;
        $('qpMkW').style.display = m === 'percent' ? '' : 'none';
        $('qpPrice').readOnly = m !== 'manual';
        if (m === 'syndicate') { $('qpHint').innerHTML = syndHintHtml(cost); if (Number(cost) > 0) $('qpPrice').value = syndPrice(cost); }
        else if (m === 'percent') { $('qpHint').innerHTML = markupHintHtml(cost, mk); if (Number(cost) > 0 && mk !== '' && Number(mk) >= 0) $('qpPrice').value = markupCalc(cost, mk); }
        else $('qpHint').textContent = 'اكتب السعر المطبوع على ملصق الوزارة.';
        const sc = parseInt($('qpSc').value) || 0, sp = $('qpSp'), price = parseFloat($('qpPrice').value) || 0;
        if (sp.dataset.manual !== '1') sp.value = sc > 1 && price > 0 ? Math.round(price / sc) : '';
    };
    ['qpMode', 'qpCost', 'qpMk', 'qpPrice', 'qpSc'].forEach(id => $(id).addEventListener('input', refresh));
    mode.addEventListener('change', refresh);
    $('qpSp').addEventListener('input', () => { $('qpSp').dataset.manual = '1'; });
    $('qpScan').addEventListener('click', () => openBarcodeScanner(code => { const c = cleanBarcode(code); if ($('qpBc')) $('qpBc').value = c; }));
    refresh();
}
function catPriceRead() {
    const $ = id => document.getElementById(id);
    const name = $('qpName').value.trim(); if (!name) { Swal.showValidationMessage('اكتب اسم الدواء'); return false; }
    const mode = $('qpMode').value, cost = parseFloat($('qpCost').value) || 0, price = parseFloat($('qpPrice').value) || 0;
    const mk = parseFloat($('qpMk').value);
    if (mode === 'percent' && (!(cost > 0) || !(mk >= 0))) { Swal.showValidationMessage('التسعير بنسبة يحتاج سعر الشراء ونسبة الإضافة'); return false; }
    if (mode === 'syndicate' && !(cost > 0)) { Swal.showValidationMessage('أدخل سعر الشراء (سعر المذخر) لحساب السعر'); return false; }
    const sc = parseInt($('qpSc').value) || 0, sp = parseFloat($('qpSp').value);
    return { name, qty: Math.max(0, parseInt($('qpQty').value) || 0), bc: cleanBarcode($('qpBc').value), pricing: mode, costPrice: cost, price, markupPct: mode === 'percent' ? mk : null,
        retail: sc < 2 ? { subCount: 0, subType: '', subPrice: 0 } : { subCount: sc, subType: $('qpSt').value || 'جزء', subPrice: sp > 0 ? sp : Math.round(price / sc) } };
}
async function catPrice(id, pre) {
    const p = id ? products.find(x => x.id === id) : null; if (id && !p) return;
    if (!writesAllowed()) return;
    const isNew = !p;
    const r = await Swal.fire({ title: isNew ? '➕ مادة جديدة' : 'تسعير وتعديل سريع', html: catPriceHtml(p, isNew, pre), showCancelButton: true, confirmButtonText: isNew ? 'إضافة' : 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', width: 'min(94vw, 520px)', customClass: { popup: 'dw-pop' },
        didOpen: () => { catPriceWire(p); if (isNew) document.getElementById('qpName').focus(); }, preConfirm: catPriceRead });
    if (!r.isConfirmed || !r.value) return;
    const v = r.value;
    if (v.bc) { const dup = findByBarcode(v.bc); if (dup && (!p || dup.id !== p.id)) { Swal.fire({ icon: 'warning', title: 'الباركود مستعمل', html: `هذا الباركود مسجّل للمادة: <b dir="ltr">${escapeHtml(dup.name)}</b>`, confirmButtonColor: '#0f1c38' }); return; } }
    if (isNew) {
        const dept = (activeDept && activeDept !== ALL_DEPTS) ? activeDept : (departments[0] || 'قسم الجلدية');
        const obj = { id: Date.now(), department: dept, category: subCategories[0] || '', type: '', extraDepartments: [], extraCategories: [], extraTypes: [], form: '', activeIngredient: '', minQty: null, brand: 'GENERIC', name: v.name, details: '', meta: '',
            qty: v.qty, price: v.price, costPrice: v.costPrice, pricing: v.pricing, markupPct: v.markupPct, ...v.retail, loose: 0, expiryDates: [], expiryDate: '', keywords: '', barcode: v.bc, barcodes: v.bc ? [v.bc] : [], img: '' };
        products.unshift(obj); renderAll(); renderCatalog();
        const ok = await saveSingleProductToCloud(obj);
        if (typeof onProductSaved === 'function') onProductSaved(obj);
        if (ok) { logAction('add', obj, []); Swal.fire({ icon: 'success', title: 'أُضيفت المادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); }
        return;
    }
    const old = JSON.parse(JSON.stringify(p)), oldQty = parseInt(p.qty) || 0;
    Object.assign(p, { name: v.name, qty: v.qty, price: v.price, costPrice: v.costPrice, pricing: v.pricing, markupPct: v.markupPct, ...v.retail });
    if (!v.retail.subCount) p.loose = 0; else p.loose = Math.min(parseInt(p.loose) || 0, v.retail.subCount - 1);
    const bcs = barcodesOf(p).filter(b => b !== v.bc); if (v.bc) bcs.unshift(v.bc);
    p.barcodes = v.bc ? bcs : barcodesOf(old); p.barcode = p.barcodes[0] || '';
    const ok = await saveProductsDelta([{ p, dq: v.qty - oldQty, dl: 0, cost: p.costPrice }]);
    if (!ok) { Object.assign(p, old); renderCatalog(); return; }
    const ch = diffProduct(old, p); if (ch.length) logAction('edit', p, ch);
    renderAll(); renderCatalog();
    Swal.fire({ icon: 'success', title: 'تم الحفظ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
}
