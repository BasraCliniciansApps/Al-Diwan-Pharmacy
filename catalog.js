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
            <div class="cat-main" onclick="openSheet(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b><small dir="ltr">${escapeHtml(meta) || '—'}</small></div>
            <button type="button" class="cat-btn cat-merge" onclick="catMergeStart(${p.id})" title="ضم لمادة أخرى">⇄<small>ضم</small></button>
            <button type="button" class="cat-btn cat-bc ${n ? 'has' : 'none'}" onclick="catBarcode(${p.id})" title="${n ? n + ' باركود' : 'بلا باركود'}">▦<small>${n ? n : 'ربط'}</small></button></div>`;
    }).join('') || '<div class="bill-none">لا توجد مواد مطابقة.</div>';
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
