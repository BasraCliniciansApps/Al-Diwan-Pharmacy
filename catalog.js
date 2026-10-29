// سجل الأدوية: كل الأصناف بتسلسل الإدخال، مع زر ضم لمادة أخرى وزر قراءة/ربط الباركود
let catQ = '', catUncounted = false, catIncomplete = false;
function catRankMap() { const m = new Map(); products.slice().sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)).forEach((p, i) => m.set(p.id, i + 1)); return m; }
async function toggleSetupMode(on) {
    if (userRole !== 'owner' || !db || !currentUser) { renderCatalog(); return; }
    const r = await Swal.fire({ icon: 'question', title: on ? 'تشغيل وضع التأسيس؟' : 'إيقاف وضع التأسيس؟', confirmButtonColor: '#0f1c38', showCancelButton: true, confirmButtonText: on ? 'تشغيل' : 'إيقاف', cancelButtonText: 'رجوع', width: 'min(94vw, 460px)',
        html: on ? '<div style="text-align:right;font-size:.88rem;line-height:1.9">• المواد التي لم تُجرد بعد: الوارد والبيع والمردود <b>لا تغيّر كميتها</b> (تُحفظ القوائم في السجل والمستحقات).<br>• تصبح المادة «مجرودة» عند ضبط عددها (سجل الأدوية، الجرد، تعديل المادة).<br>• خذ نسخة احتياطية قبل أن تبدأ.</div>' : '<div style="text-align:right;font-size:.88rem;line-height:1.9">عند الإيقاف: <b>كل المواد</b> (حتى غير المجرودة) تتأثر بالوارد والبيع كالمعتاد.<br>تأكد من انتهاء الجرد.</div>' });
    if (!r.isConfirmed) { renderCatalog(); return; }
    try { await db.collection('pharmacy_stock').doc('_setup').set({ on: !!on, at: new Date().toISOString(), by: actorName() }); }
    catch (e) { Swal.fire({ icon: 'error', title: 'تعذّر الحفظ', text: e.message, confirmButtonColor: '#0f1c38' }); renderCatalog(); return; }
    setupMode = !!on; renderAll(); renderCatalog();
    Swal.fire({ icon: 'success', title: on ? 'وضع التأسيس مفعّل' : 'وضع التأسيس متوقف', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 });
}
function catToggleUnc() { catUncounted = !catUncounted; renderCatalog(); }
async function catConfirm(id) {   // اعتماد الرصيد الحالي للمادة كمجرود بدون تغيير العدد
    const p = products.find(x => x.id === id); if (!p || !writesAllowed()) return;
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0, mark: true }]);
    if (ok) { logAction('qty', p, [{ f: 'اعتماد الرصيد كمجرود (وضع التأسيس)', from: stockLabel(p), to: stockLabel(p) }]); renderCatalog(); }
}
async function catUnconfirm(id) {   // التراجع عن اعتماد الرصيد: ترجع المادة «لم تُجرد» وتبقى كميتها
    const p = products.find(x => x.id === id); if (!p || !writesAllowed() || !can('stockEdit')) return;
    const r = await Swal.fire({ icon: 'question', title: 'إلغاء اعتماد الرصيد؟', html: 'ستعود المادة «' + escapeHtml(p.name) + '» إلى حالة «لم تُجرد» وتبقى كميتها كما هي.', showCancelButton: true, confirmButtonText: 'نعم، إلغاء الاعتماد', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38' });
    if (!r.isConfirmed) return;
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0, unmark: true }]);
    if (ok) { logAction('qty', p, [{ f: 'إلغاء اعتماد الرصيد (وضع التأسيس)', from: stockLabel(p), to: stockLabel(p) }]); renderCatalog(); }
}
function catInput() { catQ = (document.getElementById('catSearch') || {}).value || ''; renderCatalog(); }
function renderCatalog() {
    const box = document.getElementById('catList'); if (!box) return;
    const rank = catRankMap(), qn = normSearch(catQ);
    let arr = products.slice().sort((a, b) => rank.get(a.id) - rank.get(b.id));
    if (qn) { const toks = qn.split(' '); arr = arr.filter(p => searchScore(p, qn, toks) > 0); }
    const unc = setupMode ? products.filter(p => p.counted !== true).length : 0;
    if (!setupMode) catUncounted = false;
    if (catUncounted) arr = arr.filter(p => p.counted !== true);
    const inc = products.filter(p => p.incomplete).length;
    if (!inc) catIncomplete = false;
    if (catIncomplete) arr = arr.filter(p => p.incomplete);
    const withBc = products.filter(p => barcodesOf(p).length).length;
    const sum = document.getElementById('catSum');
    if (sum) sum.innerHTML = `<span>${fmtNum(products.length)} مادة</span><span class="cat-ok">🟢 بباركود ${fmtNum(withBc)}</span><span class="cat-no">🔴 بلا باركود ${fmtNum(products.length - withBc)}</span>${inc ? `<button type="button" class="cat-unc ${catIncomplete ? 'on' : ''}" onclick="catIncomplete = !catIncomplete; renderCatalog()">✏️ ناقصة التفاصيل ${fmtNum(inc)}</button>` : ''}${setupMode ? `<button type="button" class="cat-unc ${catUncounted ? 'on' : ''}" onclick="catToggleUnc()">🧮 لم تُجرد ${fmtNum(unc)} من ${fmtNum(products.length)}</button>` : ''}`;
    const sb = document.getElementById('catSetup');
    if (sb) {
        const own = userRole === 'owner', sw = `<label class="setup-sw ${own ? '' : 'ro'}" title="${own ? 'تشغيل / إيقاف وضع التأسيس' : 'للمالك فقط'}"><input type="checkbox" ${setupMode ? 'checked' : ''} ${own ? '' : 'disabled'} onchange="toggleSetupMode(this.checked)"><i></i></label>`;
        sb.innerHTML = `<div class="setup-bar ${setupMode ? 'on' : 'off'}">${sw}<div class="setup-txt"><b>🧮 وضع التأسيس: ${setupMode ? 'مفعّل' : 'متوقف'}</b><span>${setupMode ? 'الوارد والبيع والمردود <u>لا تغيّر</u> كمية أي مادة «لم تُجرد». المادة تصير مجرودة أول ما تضبط عددها' + (unc ? '.' : ' — كل المواد انجردت 🎉') : 'كل المواد تتأثر بالوارد والبيع بشكل عادي. شغّله أثناء إدخال أرصدة الصيدلية.'}</span></div></div>`;
    }
    const SHOW = 300, part = arr.slice(0, SHOW);
    box.innerHTML = part.map(p => {
        const n = barcodesOf(p).length, meta = [p.brand, fixMetaOrder(p.meta || '')].filter(Boolean).join(' · ');
        return `<div class="cat-row"><span class="cat-n">${rank.get(p.id)}</span>
            <div class="cat-main" onclick="catPrice(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b>${p.incomplete ? '<span class="cat-uncT" style="background:#e0e7ff;color:#3730a3" title="أُضيفت من الوارد بدون تفاصيل">ناقصة</span>' : ''}${setupMode && p.counted !== true ? `<span class="cat-uncT" onclick="event.stopPropagation();catConfirm(${p.id})" title="اضغط لاعتماد الرصيد الحالي كمجرود">لم تُجرد ✓</span>` : ''}${setupMode && p.counted === true && can('stockEdit') ? `<span class="cat-uncT cat-doneT" onclick="event.stopPropagation();catUnconfirm(${p.id})" title="اضغط للتراجع عن اعتماد الرصيد">✓ مجرودة</span>` : ''}<small dir="ltr">${escapeHtml(meta) || '—'}</small></div>
            <button type="button" class="cat-btn cat-merge" onclick="catMergeStart(${p.id})" title="ضم لمادة أخرى">⇄<small>ضم</small></button>
            <button type="button" class="cat-btn cat-bc ${n ? 'has' : 'none'}" onclick="catBarcode(${p.id})" title="${n ? n + ' باركود' : 'بلا باركود'}">▦<small>${n ? n : 'ربط'}</small></button>
            <div class="cat-sub">
                <div class="cat-qty"><button type="button" onclick="catQty(${p.id},-1)" aria-label="نقص">−</button><input type="number" inputmode="numeric" min="0" id="cq${p.id}" value="${parseInt(p.qty) || 0}" onchange="catQtySet(${p.id},this.value)" onfocus="this.select()"><button type="button" onclick="catQty(${p.id},1)" aria-label="زيادة">+</button>${hasRetail(p) ? `<button type="button" class="cat-parts ${(parseInt(p.loose) || 0) > 0 ? 'on' : ''}" onclick="openCountDialog(${p.id})" title="تعديل العلب والأجزاء">🧩 ${parseInt(p.loose) || 0}</button>` : ''}</div>
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
async function sheetImgDelete(id) {
    const p = products.find(x => x.id === id); if (!p || !p.img) return;
    if (!writesAllowed()) return;
    if (!(await askSure('حذف صورة المادة؟', 'ستُزال الصورة من «' + p.name + '» ويمكنك إضافة غيرها لاحقاً.', 'نعم، احذف'))) return;
    document.getElementById('zoomModal').style.display = 'none';
    const old = p.img; p.img = '';
    if (!(await saveProductsDelta([{ p, dq: 0, dl: 0 }]))) { p.img = old; Swal.fire({ icon: 'error', title: 'تعذر حذف الصورة', confirmButtonColor: '#0f1c38' }); return; }
    logAction('edit', p, [{ f: 'الصورة', from: old, to: '' }]);
    renderAll(); if (typeof dhImgDone === 'function') dhImgDone(p.id);
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
    const h = Prog.start('رفع صورة المادة', { text: 'قراءة الصورة...', indeterminate: false });
    try {
        const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(new Error('تعذر قراءة الصورة')); fr.onload = () => res(fr.result); fr.readAsDataURL(file); });
        h.set(10, 'تصغير الصورة...');
        const b64 = await new Promise((res, rej) => {
            const im = new Image(); im.onerror = () => rej(new Error('الصورة غير صالحة'));
            im.onload = () => { const cv = document.createElement('canvas'), max = 600; let w = im.width, h = im.height; if (w > h && w > max) { h *= max / w; w = max; } else if (h > max) { w *= max / h; h = max; } cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h); res(cv.toDataURL('image/jpeg', 0.82).split(',')[1]); };
            im.src = dataUrl;
        });
        const fileName = 'med_' + Date.now() + '.jpg', path = 'images/' + fileName;
        let resp, out;
        h.set(25, 'رفع الصورة إلى GitHub...');
        for (let i = 0; i < 5; i++) { // تعارض لحظي بالفرع (is at … but expected) → إعادة المحاولة
            resp = await progPutJson('https://api.github.com/repos/BasraCliniciansApps/Al-Diwan-Pharmacy/contents/' + path, { Authorization: 'token ' + token, 'Content-Type': 'application/json' }, { message: 'صورة دواء: ' + fileName, content: b64, branch: 'main' }, (l, t) => h.set(25 + 55 * l / t));
            out = resp.json || {};
            if (resp.ok || !(resp.status === 409 || /but expected|is at/i.test(out.message || ''))) break;
            h.set(null, 'تعارض لحظي — إعادة المحاولة ' + (i + 2) + ' من 5...');
            await new Promise(r => setTimeout(r, 1200 * (i + 1)));
        }
        if (!resp.ok || !out.content) { if (resp.status === 401) localStorage.removeItem('diwan_gh_token'); throw new Error(out.message || 'فشل الرفع إلى GitHub'); }
        h.set(85, 'حفظ رابط الصورة في المادة...');
        const old = p.img; p.img = 'https://raw.githubusercontent.com/BasraCliniciansApps/Al-Diwan-Pharmacy/main/' + path;
        if (!(await saveProductsDelta([{ p, dq: 0, dl: 0 }]))) { p.img = old; h.fail('رُفعت الصورة لكن لم يُحفظ رابطها', 'جرّب مرة ثانية'); return; }
        logAction('edit', p, [{ f: 'الصورة', from: old || '', to: p.img }]);
        renderAll(); if (typeof dhImgDone === 'function' && dhImgDone(p.id)) { /* من مركز التجهيز */ } else { try { openSheet(p.id); } catch (e) { /* تجاهل */ } }
        h.ok(old ? 'تم تبديل الصورة' : 'تمت إضافة الصورة');
    } catch (e) { h.fail('تعذر رفع الصورة', (e && e.message) || String(e)); }
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
    const ok = await saveProductsDelta([{ p, dq: to - from, dl: 0, mark: true }]);
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
    return `<div class="qp">
        <div class="qf"><span>اسم الدواء</span><input id="qpName" class="qin ltr" dir="ltr" value="${escapeHtml((p && p.name) || preName)}" placeholder="مثال: Panadol 500mg tablet"></div>
        <div class="qg2 qrow">
            <div class="qf"><span>العدد (عبوات)</span><div class="qstep"><button type="button" id="qpMinus">−</button><input id="qpQty" type="number" inputmode="numeric" min="0" value="${p ? (parseInt(p.qty) || 0) : 0}" onfocus="this.select()"><button type="button" id="qpPlus">+</button></div></div>
            <div class="qf"><span>الباركود</span><div class="qbc"><input id="qpBc" class="qin ltr" dir="ltr" inputmode="numeric" value="${escapeHtml(p ? (barcodesOf(p)[0] || '') : preBc)}" placeholder="اكتب أو امسح"><button type="button" id="qpScan" aria-label="مسح">▦</button></div></div>
        </div>
        <div class="qsep"></div>
        <div class="qf qrow"><span>طريقة التسعير</span><select id="qpMode" class="qin"><option value="manual">يدوي — ملصق الوزارة</option><option value="syndicate">حسب كتاب النقابة (سعر المذخر + نسبة)</option><option value="percent">بنسبة مئوية أدخلها أنا</option></select></div>
        <div class="qg2 qrow">
            <div class="qf"><span>سعر الشراء (د.ع)</span><input id="qpCost" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${p && p.costPrice ? p.costPrice : ''}"></div>
            <div class="qf"><span>سعر البيع (د.ع)</span><input id="qpPrice" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${p && p.price ? p.price : ''}"></div>
        </div>
        <div class="qf qrow" id="qpMkW"><span>نسبة الإضافة على سعر الشراء (%)</span><input id="qpMk" type="number" inputmode="decimal" min="0" step="any" class="qin ltr" dir="ltr" value="${p && p.markupPct != null ? p.markupPct : ''}"></div>
        <div class="qnote" id="qpHint"></div>
        <div class="qsec"><h4>🧩 البيع بالتجزئة (اختياري)</h4>
            <div class="qg3">
                <div class="qf"><span>عدد الأجزاء</span><input id="qpSc" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${sub ? subCountOf(sub) : ''}"></div>
                <div class="qf"><span>نوع الجزء</span><select id="qpSt" class="qin ltr" dir="ltr">${types.map(t => `<option value="${escapeHtml(t)}"${sub && sub.subType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></div>
                <div class="qf"><span>سعر الجزء</span><input id="qpSp" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${sub && sub.subPrice ? sub.subPrice : ''}" data-manual="${sub && sub.subPrice && (Math.round((parseFloat(sub.price) || 0) / subCountOf(sub)) !== (parseFloat(sub.subPrice) || 0) && subPriceCalc(sub.price, subCountOf(sub)) !== (parseFloat(sub.subPrice) || 0)) ? 1 : ''}"></div>
            </div>
            <div class="qf qrow"><span>أجزاء مفتوحة من عبوة (تتحول لعلب إذا زادت عن عدد الأجزاء)</span><input id="qpLoose" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${p ? (parseInt(p.loose) || 0) : 0}"></div>
        </div>
    </div>`;
}
function catPriceWire(p) {
    const $ = id => document.getElementById(id), mode = $('qpMode');
    mode.value = (p && p.pricing) || 'manual';
    const refresh = (fromUser) => {
        const m = mode.value, cost = $('qpCost').value, mk = $('qpMk').value;
        $('qpMkW').style.display = m === 'percent' ? '' : 'none';
        $('qpPrice').readOnly = m !== 'manual';
        if (m === 'syndicate') { { const r = syndCalc(cost); $('qpHint').innerHTML = r ? `سعر المذخر ${Number(cost).toLocaleString()} ≈ $${r.usd.toFixed(2)} ← نسبة ${r.pct}% ← ${r.price.toLocaleString()} د.ع · ${escapeHtml(syndBookText())} · الصرف ${pricingCfg.rate.toLocaleString()}` : 'أدخل سعر الشراء (سعر المذخر) ليُحسب السعر تلقائياً.'; } if (Number(cost) > 0) $('qpPrice').value = syndPrice(cost); }
        else if (m === 'percent') { $('qpHint').innerHTML = markupHintHtml(cost, mk).replace(/<\/?b>/g, ''); if (Number(cost) > 0 && mk !== '' && Number(mk) >= 0) $('qpPrice').value = markupCalc(cost, mk); }
        else $('qpHint').textContent = 'اكتب السعر المطبوع على ملصق الوزارة.';
        const sc = parseInt($('qpSc').value) || 0, sp = $('qpSp'), price = parseFloat($('qpPrice').value) || 0;
        if (sp.dataset.manual !== '1') sp.value = sc > 1 && price > 0 ? subPriceCalc(price, sc) : '';
    };
    ['qpMode', 'qpCost', 'qpMk', 'qpPrice', 'qpSc'].forEach(id => $(id).addEventListener('input', refresh));
    mode.addEventListener('change', refresh);
    $('qpSp').addEventListener('input', () => { $('qpSp').dataset.manual = '1'; });
    const qq = $('qpQty'); if (qq) { $('qpMinus').addEventListener('click', () => { qq.value = Math.max(0, (parseInt(qq.value) || 0) - 1); }); $('qpPlus').addEventListener('click', () => { qq.value = (parseInt(qq.value) || 0) + 1; }); }
    if ($('qpScan')) $('qpScan').addEventListener('click', () => openBarcodeScanner(code => { const c = cleanBarcode(code); if ($('qpBc')) $('qpBc').value = c; }));
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
    return { name, qty: Math.max(0, parseInt($('qpQty').value) || 0), loose: Math.max(0, parseInt($('qpLoose').value) || 0), bc: cleanBarcode($('qpBc').value), pricing: mode, costPrice: cost, price, markupPct: mode === 'percent' ? mk : null,
        retail: sc < 2 ? { subCount: 0, subType: '', subPrice: 0 } : { subCount: sc, subType: $('qpSt').value || 'جزء', subPrice: sp > 0 ? sp : subPriceCalc(price, sc) } };
}
async function catPrice(id, pre) {
    const p = id ? products.find(x => x.id === id) : null; if (id && !p) return;
    if (!writesAllowed()) return;
    const isNew = !p;
    const r = await Swal.fire({ title: isNew ? '➕ مادة جديدة' : 'تسعير وتعديل سريع', html: catPriceHtml(p, isNew, pre), showCancelButton: true, confirmButtonText: isNew ? 'إضافة' : 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', width: 'min(94vw, 520px)', customClass: { popup: 'dw-pop qp-pop' },
        didOpen: () => { catPriceWire(p); if (isNew) document.getElementById('qpName').focus(); }, preConfirm: catPriceRead });
    if (!r.isConfirmed || !r.value) return;
    const v = r.value;
    if (v.bc) { const dup = findByBarcode(v.bc); if (dup && (!p || dup.id !== p.id)) { Swal.fire({ icon: 'warning', title: 'الباركود مستعمل', html: `هذا الباركود مسجّل للمادة: <b dir="ltr">${escapeHtml(dup.name)}</b>`, confirmButtonColor: '#0f1c38' }); return; } }
    if (isNew) {
        const dept = (activeDept && activeDept !== ALL_DEPTS) ? activeDept : (departments[0] || 'قسم الجلدية');
        const obj = { id: Date.now(), department: dept, category: subCategories[0] || '', type: '', extraDepartments: [], extraCategories: [], extraTypes: [], form: '', activeIngredient: '', minQty: null, brand: 'GENERIC', name: v.name, details: '', meta: '',
            qty: v.qty, price: v.price, costPrice: v.costPrice, pricing: v.pricing, markupPct: v.markupPct, ...v.retail, ...(() => { const n = catNorm(v.qty, v.loose, v.retail.subCount); return { qty: n.q, loose: n.l }; })(), expiryDates: [], expiryDate: '', keywords: '', barcode: v.bc, barcodes: v.bc ? [v.bc] : [], img: '' };
        if (obj.qty > 0 || obj.loose > 0) obj.counted = true;
        products.unshift(obj); renderAll(); renderCatalog();
        const ok = await saveSingleProductToCloud(obj);
        if (typeof onProductSaved === 'function') onProductSaved(obj);
        if (ok) { logAction('add', obj, []); Swal.fire({ icon: 'success', title: 'أُضيفت المادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); }
        return;
    }
    const old = JSON.parse(JSON.stringify(p)), oldQty = parseInt(p.qty) || 0, oldLoose = parseInt(p.loose) || 0;
    const nn = catNorm(v.qty, v.loose, v.retail.subCount);
    Object.assign(p, { name: v.name, qty: nn.q, loose: nn.l, price: v.price, costPrice: v.costPrice, pricing: v.pricing, markupPct: v.markupPct, ...v.retail });
    const bcs = barcodesOf(p).filter(b => b !== v.bc); if (v.bc) bcs.unshift(v.bc);
    p.barcodes = v.bc ? bcs : barcodesOf(old); p.barcode = p.barcodes[0] || '';
    const ok = await saveProductsDelta([{ p, dq: nn.q - oldQty, dl: nn.l - oldLoose, cost: p.costPrice, mark: nn.q !== oldQty || nn.l !== oldLoose }]);
    if (!ok) { Object.assign(p, old); renderCatalog(); return; }
    const ch = diffProduct(old, p); if (ch.length) logAction('edit', p, ch);
    renderAll(); renderCatalog();
    Swal.fire({ icon: 'success', title: 'تم الحفظ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
}

// ---------- تعديل العدد بالعلب والأجزاء (يتحول تلقائياً بين الأجزاء والعلب الكاملة) ----------
async function openCountDialog(id) {
    const p = products.find(x => x.id === id); if (!p || !writesAllowed()) return;
    const sc = hasRetail(p) ? subCountOf(p) : 0, ty = subTypeOf(p) || 'جزء';
    const q0 = parseInt(p.qty) || 0, l0 = parseInt(p.loose) || 0;
    const r = await Swal.fire({ title: 'تعديل العدد', showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', width: 'min(94vw, 460px)', customClass: { popup: 'dw-pop qp-pop' },
        html: `<div class="qp"><div class="sw-info" dir="ltr"><b>${escapeHtml(p.name)}</b></div>
            <div class="${sc ? 'qg2' : ''} qrow"><div class="qf"><span>علب كاملة</span><input id="ctBox" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${q0}" onfocus="this.select()"></div>
            ${sc ? `<div class="qf"><span>${escapeHtml(ty)} مفتوحة</span><input id="ctPart" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${l0}" onfocus="this.select()"></div>` : ''}</div>
            ${sc ? `<div class="qf qrow"><span>المجموع بالأجزاء (العبوة = <bdi>${sc} ${escapeHtml(ty)}</bdi>) — عدّله فتتحول العلب والأجزاء تلقائياً</span><input id="ctTot" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${q0 * sc + l0}" onfocus="this.select()"></div><div class="qnote" id="ctNote" style="color:#475569"></div>` : ''}</div>`,
        didOpen: () => {
            if (!sc) return;
            const $ = i => document.getElementById(i), note = () => { const b = parseInt($('ctBox').value) || 0, pr = parseInt($('ctPart').value) || 0; $('ctNote').textContent = `= ${b} عبوة + ${pr} ${ty}`; };
            const fromParts = () => { const b = parseInt($('ctBox').value) || 0, pr = parseInt($('ctPart').value) || 0; $('ctTot').value = b * sc + pr; note(); };
            $('ctBox').addEventListener('input', fromParts); $('ctPart').addEventListener('input', fromParts);
            $('ctTot').addEventListener('input', () => { const t = Math.max(0, parseInt($('ctTot').value) || 0); $('ctBox').value = Math.floor(t / sc); $('ctPart').value = t % sc; note(); });
            note();
        },
        preConfirm: () => {
            const b = Math.max(0, parseInt(document.getElementById('ctBox').value) || 0);
            if (!sc) return { q: b, l: 0 };
            const t = b * sc + Math.max(0, parseInt(document.getElementById('ctPart').value) || 0);
            return { q: Math.floor(t / sc), l: t % sc };   // الأجزاء المفتوحة دائماً أقل من عبوة
        } });
    if (!r.isConfirmed || !r.value) return;
    const nq = r.value.q, nl = sc ? r.value.l : (parseInt(p.loose) || 0), oldLabel = stockLabel(p);
    if (nq === q0 && nl === l0 && !setupSkip(p)) return;   // في وضع التأسيس التأكيد بنفس العدد يعتمد المادة كمجرودة
    p.qty = nq; p.loose = nl;
    const ok = await saveProductsDelta([{ p, dq: nq - q0, dl: nl - l0, mark: true }]);
    if (!ok) { p.qty = q0; p.loose = l0; return; }
    logAction('qty', p, [{ f: 'الكمية', from: oldLabel, to: stockLabel(p) }]);
    renderAll(); try { if (document.getElementById('catList')) renderCatalog(); } catch (e) { /* تجاهل */ }
    if (typeof currentOpenId !== 'undefined' && currentOpenId === id) { try { openSheet(id); } catch (e) { /* تجاهل */ } }
    Swal.fire({ icon: 'success', title: 'تم تعديل العدد', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
}

function catNorm(boxes, parts, sc) { boxes = Math.max(0, parseInt(boxes) || 0); parts = Math.max(0, parseInt(parts) || 0); sc = parseInt(sc) || 0; if (sc < 2) return { q: boxes, l: 0 }; const t = boxes * sc + parts; return { q: Math.floor(t / sc), l: t % sc }; }
