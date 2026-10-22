// =====================================================================
// الوارد من المذاخر (للصيدلي فقط): فاتورة وارد، سجل، مستحقات، كشف شهري، مذاخر وأسعار
// يعتمد على دوال invoice.js و data.js (products, saveProductsBatch, logAction ...)
// =====================================================================
const PU_LS = { list: 'diwanPurchasesLocal', draft: 'diwanPurchDraft', sup: 'diwanSuppliers' };
let pu = null;                 // مسودة الوارد الحالي
let puAll = [];                // كل الواردات المحفوظة
let puSuppliers = [];          // [{id,name,phone}]
let puTabName = 'new';
let puPendingBc = '';          // باركود جديد بانتظار ربطه بدواء
let puDraftTimer = null;

function emptyPurchase() { return { supplier: '', no: '', date: todayLocalISO(), items: [], returnAmt: '', paid: '', notes: '' }; }
const puNum = v => parseFloat(v) || 0;
function puTotalOf(r) { return (r.items || []).reduce((s, it) => s + puNum(it.qty) * puNum(it.cost), 0); }
function puNetOf(r) { return Math.max(puTotalOf(r) - puNum(r.returnAmt), 0); }
function puRemaining(r) { return r.cancelled ? 0 : Math.max(puNetOf(r) - puNum(r.paid), 0); }
const puKey = s => String(s || '').trim().toLowerCase();

// ---------- التخزين (محلي + سحابة) ----------
function puLocalList() { try { return JSON.parse(lsGet(PU_LS.list)) || []; } catch (e) { return []; } }
async function puLoad() {
    const map = new Map();
    puLocalList().forEach(x => x && x.id && map.set(x.id, x));
    let sup = [];
    try { sup = JSON.parse(lsGet(PU_LS.sup)) || []; } catch (e) { sup = []; }
    const smap = new Map(sup.map(s => [s.id, s]));
    if (cloudReady() && navigator.onLine) {
        try { const snap = await db.collection('pharmacy_purchases').limit(1000).get(); snap.forEach(d => { const x = d.data(); if (x && x.id) map.set(x.id, x); }); } catch (e) { /* القواعد غير مضافة */ }
        try { const snap = await db.collection('pharmacy_suppliers').limit(500).get(); snap.forEach(d => { const x = d.data(); if (x && x.id) smap.set(x.id, x); }); } catch (e) { /* القواعد غير مضافة */ }
    }
    puAll = [...map.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdTs).localeCompare(String(a.createdTs)));
    puSuppliers = [...smap.values()];
    lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500)));
    lsSet(PU_LS.sup, JSON.stringify(puSuppliers));
    return puAll;
}
async function puSaveRecord(r) {
    puAll = puAll.filter(x => x.id !== r.id); puAll.unshift(r);
    lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500)));
    if (cloudReady() && navigator.onLine) {
        try { await db.collection('pharmacy_purchases').doc(r.id).set(JSON.parse(JSON.stringify(r))); }
        catch (e) { Swal.fire({ icon: 'warning', title: 'حُفظ الوارد على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_purchases إلى قواعد Firestore لتُحفظ في السحابة أيضاً.', confirmButtonColor: '#0f1c38' }); }
    }
}
async function puSaveSupplierRec(s) {
    puSuppliers = puSuppliers.filter(x => x.id !== s.id); puSuppliers.push(s);
    lsSet(PU_LS.sup, JSON.stringify(puSuppliers));
    if (cloudReady() && navigator.onLine) { try { await db.collection('pharmacy_suppliers').doc(s.id).set(s); } catch (e) { /* تجاهل */ } }
}
async function puUpsertSupplier(name) {
    name = String(name || '').trim(); if (!name) return;
    if (puSuppliers.some(s => puKey(s.name) === puKey(name))) return;
    await puSaveSupplierRec({ id: 's' + Date.now() + Math.floor(Math.random() * 99), name, phone: '' });
}
function puSupplierNames() {
    const set = new Map();
    puSuppliers.forEach(s => set.set(puKey(s.name), s.name));
    puAll.forEach(r => { if (r.supplier && !set.has(puKey(r.supplier))) set.set(puKey(r.supplier), r.supplier); });
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'ar'));
}

// ---------- التبويبات ----------
function puTab(name) {
    puTabName = name;
    document.querySelectorAll('#puTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.pu-pane').forEach(p => { p.classList.toggle('active', p.id === 'puPane-' + name); p.classList.remove('print-active'); });
    if (name === 'month') $b('puPane-month').classList.add('print-active');
    if (name === 'new') puInitNew();
    puLoad().then(() => {
        puFillSupplierList();
        if (name === 'log') renderPuLog(); else if (name === 'debt') renderPuDebt(); else if (name === 'month') puInitMonth(); else if (name === 'sup') renderPuSuppliers();
    });
}
function onShowPurch() { puTab(puTabName || 'new'); }
function puFillSupplierList() { const dl = $b('puSupList'); if (dl) dl.innerHTML = puSupplierNames().map(n => `<option value="${escapeHtml(n)}"></option>`).join(''); }

// ---------- وارد جديد ----------
function puInitNew() {
    if (!pu) { try { pu = JSON.parse(lsGet(PU_LS.draft)); } catch (e) { pu = null; } if (!pu || !Array.isArray(pu.items)) pu = emptyPurchase(); }
    puWriteFields(); puRenderItems(); puRecalc(); puFillSupplierList();
}
function puWriteFields() {
    $b('puSupplier').value = pu.supplier || ''; $b('puNo').value = pu.no || ''; $b('puDate').value = pu.date || todayLocalISO();
    $b('puReturn').value = pu.returnAmt === '' ? '' : pu.returnAmt; $b('puPaid').value = pu.paid === '' ? '' : pu.paid; $b('puNotes').value = pu.notes || '';
}
function puReadFields() {
    pu.supplier = $b('puSupplier').value; pu.no = $b('puNo').value; pu.date = $b('puDate').value || todayLocalISO();
    pu.returnAmt = $b('puReturn').value; pu.paid = $b('puPaid').value; pu.notes = $b('puNotes').value;
}
function puChanged() { puReadFields(); puRecalc(); clearTimeout(puDraftTimer); puDraftTimer = setTimeout(() => lsSet(PU_LS.draft, JSON.stringify(pu)), 300); }
function puRecalc() {
    const tot = puTotalOf(pu), net = puNetOf(pu), rem = Math.max(net - puNum(pu.paid), 0);
    $b('puTotal').innerText = fmtNum(tot); $b('puNet').innerText = fmtNum(net); $b('puRem').innerText = fmtNum(rem);
    pu.items.forEach((it, i) => { const el = $b('puLine-' + i); if (el) el.innerText = fmtNum(puNum(it.qty) * puNum(it.cost)); });
}
function puRenderItems() {
    $b('puItems').innerHTML = pu.items.map((it, i) => `
        <div class="pu-item">
            <div class="pu-item-h"><b dir="ltr">${escapeHtml(it.name)}</b><span>${escapeHtml(((products.find(p => p.id === it.pid) || {}).brand) || '')}</span><button type="button" class="pu-x" onclick="puRemoveItem(${i})" aria-label="حذف">✕</button></div>
            <div class="pu-grid">
                <label><span>العدد (عبوة)</span><input type="number" min="1" inputmode="numeric" value="${escapeHtml(it.qty)}" oninput="puItemEdit(${i},'qty',this.value)"></label>
                <label><span>سعر الشراء</span><input type="number" min="0" inputmode="decimal" value="${escapeHtml(it.cost)}" oninput="puItemEdit(${i},'cost',this.value)"></label>
                <label><span>تاريخ الانتهاء</span><input type="month" dir="ltr" value="${escapeHtml(it.expiry || '')}" oninput="puItemEdit(${i},'expiry',this.value)"></label>
                <label><span>رقم الدفعة (اختياري)</span><input dir="ltr" value="${escapeHtml(it.batch || '')}" oninput="puItemEdit(${i},'batch',this.value)"></label>
            </div>
            <div class="pu-line">المجموع: <b id="puLine-${i}">0</b> د.ع</div>
        </div>`).join('') || '<div class="bill-none">ابحث عن دواء أو امسح باركوده لإضافته إلى الفاتورة الواردة.</div>';
}
function puItemEdit(i, f, v) { if (!pu.items[i]) return; pu.items[i][f] = v; puChanged(); }
function puRemoveItem(i) { pu.items.splice(i, 1); puRenderItems(); puChanged(); }
function puAddProduct(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    if (puPendingBc) { puAttachBarcode(p, puPendingBc); puPendingBc = ''; puShowPending(); }
    const ex = pu.items.find(it => it.pid === id);
    if (ex) ex.qty = (parseInt(ex.qty) || 0) + 1;
    else pu.items.push({ pid: id, name: p.name, qty: 1, cost: p.costPrice || '', expiry: '', batch: '' });
    $b('puSearch').value = ''; $b('puResults').style.display = 'none';
    puRenderItems(); puChanged();
}
async function puAttachBarcode(p, code) {
    const list = barcodesOf(p); if (!list.includes(code)) list.push(code);
    p.barcodes = list; p.barcode = list[0];
    await saveProductsBatch([p]);
    Swal.fire({ icon: 'success', title: 'رُبط الباركود بـ ' + p.name, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
}
function puShowPending() {
    const h = $b('puPendingHint');
    if (puPendingBc) { h.innerHTML = `باركود جديد <b dir="ltr">${escapeHtml(puPendingBc)}</b> — اختر الدواء من البحث لربطه به. <button type="button" onclick="puPendingBc='';puShowPending()">إلغاء</button>`; h.style.display = 'block'; }
    else h.style.display = 'none';
}
let puFound = [];
function puSearchInput() {
    const qn = normSearch($b('puSearch').value), box = $b('puResults');
    if (!qn) { box.style.display = 'none'; puFound = []; return; }
    const toks = qn.split(' ');
    puFound = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    box.innerHTML = puFound.length
        ? puFound.map(p => `<button type="button" onclick="puAddProduct(${p.id})"><span dir="ltr">${escapeHtml(p.name)}</span><small>${escapeHtml(p.brand || '')}${p.costPrice ? ' · شراء ' + fmtNum(p.costPrice) : ''}</small></button>`).join('')
        : `<div class="bill-noresult">لا توجد نتائج — أضف الصنف أولاً من المخزن</div>`;
    box.style.display = 'block';
}
function puSearchEnter() {
    const raw = $b('puSearch').value.trim(), code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code)) { puAddByBarcode(code); $b('puSearch').value = ''; $b('puResults').style.display = 'none'; return; }
    if (puFound.length) puAddProduct(puFound[0].id);
}
function puScan() { openBarcodeScanner(puAddByBarcode); }
function puAddByBarcode(code) {
    code = cleanBarcode(code);
    const p = findByBarcode(code);
    if (p) { puAddProduct(p.id); Swal.fire({ icon: 'success', title: 'أُضيف: ' + p.name, toast: true, position: 'bottom', showConfirmButton: false, timer: 1200 }); return; }
    puPendingBc = code; puShowPending(); $b('puSearch').focus();
    Swal.fire({ icon: 'info', title: 'باركود غير معروف', text: 'ابحث عن الدواء واختره لربط هذا الباركود به.', toast: true, position: 'bottom', showConfirmButton: false, timer: 3000 });
}
function puNew() {
    const has = pu && (pu.items.length || pu.supplier || pu.no);
    const go = () => { pu = emptyPurchase(); lsSet(PU_LS.draft, JSON.stringify(pu)); puPendingBc = ''; puShowPending(); puInitNew(); };
    if (!has) return go();
    Swal.fire({ icon: 'question', title: 'وارد جديد؟', text: 'سيتم مسح البيانات الحالية.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم', cancelButtonText: 'إلغاء' }).then(r => { if (r.isConfirmed) go(); });
}
function puExpiryPush(p, e) {   // يُرجع true إذا أُضيف تاريخ جديد
    const dates = getProductExpiryDates(p);
    if (dates.includes(e)) return false;
    dates.push(e); dates.sort(); p.expiryDates = dates; p.expiryDate = dates[0]; return true;
}
async function puSave() {
    puReadFields();
    const supplier = pu.supplier.trim(), no = pu.no.trim();
    const items = pu.items.filter(it => parseInt(it.qty) > 0);
    const warn = t => Swal.fire({ icon: 'warning', title: t, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    if (!supplier) return warn('اكتب اسم المذخر');
    if (!no) return warn('اكتب رقم فاتورة المذخر');
    if (!items.length) return warn('أضف مادة واحدة على الأقل بعدد صحيح');
    if (items.some(it => !(puNum(it.cost) > 0))) {
        const r = await Swal.fire({ icon: 'question', title: 'بعض المواد بلا سعر شراء', text: 'لن يُحسب لها ربح ولن يتغير سعر شرائها. متابعة؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'رجوع' });
        if (!r.isConfirmed) return;
    }
    await puLoad();
    if (puAll.some(x => !x.cancelled && puKey(x.supplier) === puKey(supplier) && puKey(x.no) === puKey(no))) {
        const r = await Swal.fire({ icon: 'warning', title: 'رقم الفاتورة مسجّل سابقاً لهذا المذخر', text: 'هل تريد تسجيلها مرة أخرى؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'تسجيل', cancelButtonText: 'رجوع' });
        if (!r.isConfirmed) return;
    }
    if (!requireOnline()) return;
    const total = items.reduce((s, it) => s + puNum(it.qty) * puNum(it.cost), 0), ret = puNum(pu.returnAmt);
    if (ret > total) return warn('مبلغ الاسترجاع أكبر من مجموع الفاتورة');
    const lines = [], touched = [], snaps = [];
    items.forEach(it => {
        const p = products.find(x => x.id === it.pid); if (!p) return;
        const n = parseInt(it.qty) || 0, cost = puNum(it.cost);
        snaps.push({ p, qty: p.qty, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate });
        const line = { pid: p.id, name: p.name, qty: n, cost, expiry: it.expiry || '', batch: (it.batch || '').trim(), prevQty: parseInt(p.qty) || 0, prevCost: p.costPrice || 0 };
        p.qty = line.prevQty + n;
        if (cost > 0) p.costPrice = cost;
        if (line.expiry && puExpiryPush(p, line.expiry)) line.expAdded = true;
        lines.push(line); touched.push(p);
    });
    const ok = await saveProductsBatch(touched);
    if (!ok) { snaps.forEach(s => { s.p.qty = s.qty; s.p.costPrice = s.costPrice; s.p.expiryDates = s.expiryDates; s.p.expiryDate = s.expiryDate; }); renderAll(); return; }
    lines.forEach(l => { const p = products.find(x => x.id === l.pid); logAction('qty', p, [{ f: 'الكمية (وارد ' + no + ' - ' + supplier + ')', from: String(l.prevQty), to: String(l.prevQty + l.qty) }]); });
    const paid = Math.min(puNum(pu.paid), Math.max(total - ret, 0));
    const rec = { id: 'pu' + Date.now(), supplier, no, date: pu.date, items: lines, returnAmt: ret, paid, payments: paid > 0 ? [{ at: pu.date, amount: paid }] : [], notes: pu.notes.trim(), cancelled: false, createdTs: new Date().toISOString() };
    await puSaveRecord(rec);
    await puUpsertSupplier(supplier);
    renderAll();
    pu = emptyPurchase(); lsSet(PU_LS.draft, JSON.stringify(pu)); puInitNew();
    Swal.fire({ icon: 'success', title: 'حُفظ الوارد وأُضيفت الكميات للمخزن', toast: true, position: 'bottom', showConfirmButton: false, timer: 2500 });
}

// ---------- السجل ----------
function puCardHtml(r, extra) {
    const rem = puRemaining(r);
    const tags = (r.cancelled ? '<em class="tg bad">ملغى</em>' : '') + (rem > 0 ? `<em class="tg warn">متبقي ${fmtNum(rem)}</em>` : '') + (puNum(r.returnAmt) > 0 ? `<em class="tg">استرجاع ${fmtNum(r.returnAmt)}</em>` : '');
    return `<div class="bill-card ${r.cancelled ? 'cancelled' : ''}">
        <div class="bill-card-main" onclick="puOpen('${r.id}')">
            <b>${escapeHtml(r.supplier)}</b> <span dir="ltr">${escapeHtml(r.no)}</span> ${tags}
            <small>${escapeHtml(fmtDateDMY(r.date))} • ${(r.items || []).length} مادة</small>
        </div>
        <div class="bill-card-amt">${fmtNum(puNetOf(r))}<small>د.ع</small></div>
        ${extra || ''}
    </div>`;
}
function renderPuLog() {
    const q = puKey($b('puLogSearch').value);
    const arr = puAll.filter(r => !q || [r.supplier, r.no].some(x => puKey(x).includes(q)));
    $b('puLogList').innerHTML = arr.map(r => puCardHtml(r)).join('') || '<div class="bill-none">لا توجد واردات مسجّلة بعد.</div>';
}
function puOpen(id) {
    const r = puAll.find(x => x.id === id); if (!r) return;
    const rows = (r.items || []).map(it => `<tr><td dir="ltr">${escapeHtml(it.name)}</td><td>${fmtNum(it.qty)}</td><td>${fmtNum(it.cost)}</td><td dir="ltr">${escapeHtml(it.expiry || '—')}</td><td dir="ltr">${escapeHtml(it.batch || '—')}</td><td>${fmtNum(it.qty * it.cost)}</td></tr>`).join('');
    const pays = (r.payments || []).map(p => `<div>${escapeHtml(fmtDateDMY(p.at))} — ${fmtNum(p.amount)} د.ع</div>`).join('') || '<div>لا دفعات</div>';
    const btn = (label, fn, cls) => `<button type="button" class="bill-tb-btn ${cls || ''}" onclick="Swal.close();${fn}">${label}</button>`;
    Swal.fire({
        title: escapeHtml(r.supplier) + ' — ' + escapeHtml(r.no), showConfirmButton: false, showCloseButton: true, width: 640,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(r.date))}${r.cancelled ? ' • <b style="color:#b91c1c">ملغى</b>' : ''}</div>
            <div class="pu-d-scroll"><table class="bill-table"><thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>الانتهاء</th><th>الدفعة</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody></table></div>
            <div class="pu-d-tot"><div>المجموع: <b>${fmtNum(puTotalOf(r))}</b></div><div>الاسترجاع: <b>${fmtNum(r.returnAmt)}</b></div><div>الصافي: <b>${fmtNum(puNetOf(r))}</b></div><div>المدفوع: <b>${fmtNum(r.paid)}</b></div><div>المتبقي: <b>${fmtNum(puRemaining(r))}</b></div></div>
            <div class="pu-d-pays"><b>الدفعات:</b>${pays}</div>${r.notes ? `<div class="pu-d-pays"><b>ملاحظات:</b> ${escapeHtml(r.notes)}</div>` : ''}
            <div class="pu-d-btns">${r.cancelled ? '' : btn('💳 تسديد', `puPay('${r.id}')`, 'bill-pay') + btn('↩️ مبلغ الاسترجاع', `puSetReturn('${r.id}')`) + btn('✖ إلغاء الوارد', `puCancel('${r.id}')`, 'bill-danger')}</div></div>`
    });
}
async function puSetReturn(id) {
    const r = puAll.find(x => x.id === id); if (!r) return;
    const res = await Swal.fire({ title: 'مبلغ الاسترجاع', html: `مجموع الفاتورة: <b>${fmtNum(puTotalOf(r))} د.ع</b>`, input: 'number', inputValue: puNum(r.returnAmt) || '', inputAttributes: { min: 0, max: puTotalOf(r) }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء' });
    if (!res.isConfirmed) return;
    r.returnAmt = Math.min(Math.max(puNum(res.value), 0), puTotalOf(r));
    if (puNum(r.paid) > puNetOf(r)) r.paid = puNetOf(r);
    await puSaveRecord(r); puRefreshCurrent();
}
async function puCancel(id) {
    const r = puAll.find(x => x.id === id); if (!r || r.cancelled) return;
    const res = await Swal.fire({ icon: 'warning', title: 'إلغاء الوارد؟', text: 'ستُنقص الكميات المضافة من المخزن ويُلغى مبلغها من المستحقات.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، إلغاء', cancelButtonText: 'رجوع' });
    if (!res.isConfirmed) return;
    if (!requireOnline()) return;
    const touched = [];
    (r.items || []).forEach(l => {
        const p = products.find(x => x.id === l.pid); if (!p) return;
        p.qty = Math.max((parseInt(p.qty) || 0) - l.qty, 0);
        if (l.cost > 0 && puNum(p.costPrice) === l.cost) p.costPrice = l.prevCost || 0;
        if (l.expAdded && l.expiry) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== l.expiry); p.expiryDate = p.expiryDates[0] || ''; }
        touched.push(p);
    });
    if (touched.length && !(await saveProductsBatch(touched))) return;
    r.cancelled = true; r.cancelledAt = todayLocalISO();
    await puSaveRecord(r); renderAll(); puRefreshCurrent();
}
function puRefreshCurrent() { if (puTabName === 'log') renderPuLog(); else if (puTabName === 'debt') renderPuDebt(); else if (puTabName === 'month') renderPuMonth(); else if (puTabName === 'sup') renderPuSuppliers(); }

// ---------- المستحقات ----------
async function puPay(id) {
    const r = puAll.find(x => x.id === id); if (!r) return;
    const rem = puRemaining(r);
    if (rem <= 0) { Swal.fire({ icon: 'info', title: 'لا يوجد مبلغ متبقٍ', confirmButtonColor: '#0f1c38' }); return; }
    const res = await Swal.fire({ title: 'تسديد للمذخر — ' + escapeHtml(r.no), html: `المتبقي: <b>${fmtNum(rem)} د.ع</b>`, input: 'number', inputValue: rem, inputAttributes: { min: 0, max: rem }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'تسجيل الدفعة', cancelButtonText: 'إلغاء' });
    const amt = parseFloat(res && res.value);
    if (!res.isConfirmed || !(amt > 0)) return;
    const pay = Math.min(amt, rem);
    r.paid = puNum(r.paid) + pay; (r.payments = r.payments || []).push({ at: todayLocalISO(), amount: pay });
    await puSaveRecord(r); puRefreshCurrent();
}
async function puPaySupplier(name) {
    const list = puAll.filter(r => puKey(r.supplier) === puKey(name) && puRemaining(r) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const owed = list.reduce((s, r) => s + puRemaining(r), 0); if (owed <= 0) return;
    const res = await Swal.fire({ title: 'تسديد للمذخر ' + escapeHtml(name), html: `إجمالي المستحق: <b>${fmtNum(owed)} د.ع</b><br><small>يُوزَّع المبلغ على الفواتير الأقدم أولاً</small>`, input: 'number', inputValue: owed, inputAttributes: { min: 0, max: owed }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'تسجيل', cancelButtonText: 'إلغاء' });
    let left = Math.min(parseFloat(res && res.value) || 0, owed);
    if (!res.isConfirmed || !(left > 0)) return;
    for (const r of list) {
        if (left <= 0) break;
        const pay = Math.min(left, puRemaining(r)); left -= pay;
        r.paid = puNum(r.paid) + pay; (r.payments = r.payments || []).push({ at: todayLocalISO(), amount: pay });
        await puSaveRecord(r);
    }
    puRefreshCurrent();
}
function renderPuDebt() {
    const groups = new Map();
    puAll.filter(r => puRemaining(r) > 0).forEach(r => { const k = puKey(r.supplier); if (!groups.has(k)) groups.set(k, { name: r.supplier, list: [] }); groups.get(k).list.push(r); });
    const arr = [...groups.values()].map(g => ({ ...g, owed: g.list.reduce((s, r) => s + puRemaining(r), 0) })).sort((a, b) => b.owed - a.owed);
    const total = arr.reduce((s, g) => s + g.owed, 0);
    $b('puDebtSummary').innerHTML = `<span>إجمالي مستحقات المذاخر</span><b>${fmtNum(total)} د.ع</b><small>${arr.length} مذخر</small>`;
    $b('puDebtList').innerHTML = arr.map(g => `
        <div class="pu-group">
            <div class="pu-group-h"><b>${escapeHtml(g.name)}</b><span>${fmtNum(g.owed)} د.ع</span><button type="button" class="bill-tb-btn bill-pay" onclick="puPaySupplier(decodeURIComponent('${encodeURIComponent(g.name)}'))">تسديد للمذخر</button></div>
            ${g.list.sort((a, b) => String(a.date).localeCompare(String(b.date))).map(r => puCardHtml(r, `<button type="button" class="bill-tb-btn bill-pay" onclick="puPay('${r.id}')">تسديد</button>`)).join('')}
        </div>`).join('') || '<div class="bill-none">لا توجد مستحقات للمذاخر 🎉</div>';
    puHomeBadge();
}
function puHomeBadge() {
    const el = $b('homePuOwed'); if (!el) return;
    const total = puAll.reduce((s, r) => s + puRemaining(r), 0);
    el.innerText = total > 0 ? 'مستحق للمذاخر: ' + fmtNum(total) : 'فواتير المذاخر والدفعات';
}

// ---------- الكشف الشهري ----------
function puMonthNow() { return todayLocalISO().slice(0, 7); }
function puInitMonth() {
    if (!$b('puMonth').value) $b('puMonth').value = puMonthNow();
    const sel = $b('puMonthSup'), cur = sel.value;
    sel.innerHTML = '<option value="">كل المذاخر</option>' + puSupplierNames().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    sel.value = cur; renderPuMonth();
}
function puMonthRows() {
    const m = $b('puMonth').value || puMonthNow(), sup = $b('puMonthSup').value;
    return puAll.filter(r => !r.cancelled && String(r.date).slice(0, 7) === m && (!sup || puKey(r.supplier) === puKey(sup))).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdTs).localeCompare(String(b.createdTs)));
}
function renderPuMonth() {
    const m = $b('puMonth').value || puMonthNow(), sup = $b('puMonthSup').value, rows = puMonthRows(), meta = getInvMeta();
    const tot = rows.reduce((s, r) => s + puTotalOf(r), 0), ret = rows.reduce((s, r) => s + puNum(r.returnAmt), 0), net = tot - ret;
    const paid = rows.reduce((s, r) => s + puNum(r.paid), 0), rem = rows.reduce((s, r) => s + puRemaining(r), 0);
    const [yy, mm] = m.split('-');
    $b('puMonthSheet').innerHTML = `
        <div class="bill-letterhead">
            <img src="icon.jpg" alt="" class="bill-logo">
            <div class="bill-ph"><div class="bill-ph-name">صيدلية الديوان</div><div class="bill-ph-line">${escapeHtml(meta.addr || '')}</div><div class="bill-ph-line">${meta.phone ? 'هاتف: ' + escapeHtml(meta.phone) : ''}</div></div>
            <div class="bill-title-box"><div class="bill-title">كشف الوارد الشهري</div><div class="pu-mtitle">${mm}/${yy}${sup ? ' — ' + escapeHtml(sup) : ''}</div></div>
        </div>
        <table class="bill-table pu-mtable">
            <thead><tr><th class="pu-n">#</th><th>المذخر</th><th>رقم الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>الاسترجاع</th><th>المبلغ الكلي (بعد الاسترجاع)</th></tr></thead>
            <tbody>${rows.map((r, i) => `<tr><td class="pu-n">${i + 1}</td><td>${escapeHtml(r.supplier)}</td><td dir="ltr">${escapeHtml(r.no)}</td><td>${escapeHtml(fmtDateDMY(r.date))}</td><td>${fmtNum(puTotalOf(r))}</td><td>${puNum(r.returnAmt) ? fmtNum(r.returnAmt) : '—'}</td><td><b>${fmtNum(puNetOf(r))}</b></td></tr>`).join('') || '<tr><td colspan="7" class="bill-empty-row">لا توجد واردات في هذا الشهر.</td></tr>'}</tbody>
            ${rows.length ? `<tfoot><tr><td colspan="4">المجموع</td><td>${fmtNum(tot)}</td><td>${fmtNum(ret)}</td><td>${fmtNum(net)}</td></tr></tfoot>` : ''}
        </table>
        <div class="bill-bottom"><div class="bill-totals"><div class="bill-trow bill-grand"><span>التوتل الشهري</span><b>${fmtNum(net)} د.ع</b></div></div></div>
        <div class="bill-words">${net > 0 ? 'المبلغ كتابةً: ' + escapeHtml(numberToArabicWords(net)) + ' دينار عراقي فقط لا غير' : ''}</div>
        <div class="pu-mextra no-print"><span>المدفوع: <b>${fmtNum(paid)}</b></span><span>المتبقي للمذاخر: <b>${fmtNum(rem)}</b></span><span>عدد الفواتير: <b>${rows.length}</b></span></div>`;
}
function puMonthCsv() {
    const rows = puMonthRows(), q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['المذخر', 'رقم الفاتورة', 'التاريخ', 'المبلغ', 'الاسترجاع', 'المبلغ الكلي بعد الاسترجاع'].map(q).join(',')];
    let tot = 0, ret = 0, net = 0;
    rows.forEach(r => { const t = puTotalOf(r), rt = puNum(r.returnAmt), n = puNetOf(r); tot += t; ret += rt; net += n; lines.push([r.supplier, r.no, r.date, t, rt, n].map(q).join(',')); });
    lines.push(['المجموع', '', '', tot, ret, net].map(q).join(','));
    lines.push(['التوتل الشهري', '', '', '', '', net].map(q).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'purchases-' + ($b('puMonth').value || puMonthNow()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function puPrint(paneId) {
    document.querySelectorAll('.pu-pane').forEach(p => p.classList.toggle('print-active', p.id === paneId));
    document.body.classList.add('printing-purch');
    const done = () => { document.body.classList.remove('printing-purch'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
}

// ---------- المذاخر والأسعار ----------
function renderPuSuppliers() {
    const names = puSupplierNames();
    $b('puSupList2').innerHTML = names.map(n => {
        const list = puAll.filter(r => !r.cancelled && puKey(r.supplier) === puKey(n));
        const net = list.reduce((s, r) => s + puNetOf(r), 0), owed = list.reduce((s, r) => s + puRemaining(r), 0);
        const rec = puSuppliers.find(s => puKey(s.name) === puKey(n)) || {};
        const enc = encodeURIComponent(n);
        return `<div class="bill-card"><div class="bill-card-main" onclick="puEditSupplier(decodeURIComponent('${enc}'))"><b>${escapeHtml(n)}</b>${owed > 0 ? `<em class="tg warn">مستحق ${fmtNum(owed)}</em>` : ''}<small>${rec.phone ? escapeHtml(rec.phone) + ' • ' : ''}${list.length} فاتورة • إجمالي التعامل ${fmtNum(net)} د.ع</small></div><button type="button" class="bill-tb-btn" onclick="puEditSupplier(decodeURIComponent('${enc}'))">تعديل</button></div>`;
    }).join('') || '<div class="bill-none">لا توجد مذاخر بعد — تُضاف تلقائياً عند أول وارد.</div>';
}
async function puEditSupplier(name) {
    const rec = puSuppliers.find(s => puKey(s.name) === puKey(name)) || { id: '', name: '', phone: '' };
    const res = await Swal.fire({
        title: name ? 'تعديل المذخر' : 'إضافة مذخر', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<input id="swSupName" class="swal2-input" placeholder="اسم المذخر" value="${escapeHtml(rec.name || name)}"><input id="swSupPhone" class="swal2-input" dir="ltr" placeholder="الهاتف (اختياري)" value="${escapeHtml(rec.phone || '')}">`,
        preConfirm: () => { const n = document.getElementById('swSupName').value.trim(); if (!n) { Swal.showValidationMessage('اكتب اسم المذخر'); return false; } return { name: n, phone: document.getElementById('swSupPhone').value.trim() }; }
    });
    if (!res.isConfirmed || !res.value) return;
    const nn = res.value.name, old = rec.name || name;
    await puSaveSupplierRec({ id: rec.id || 's' + Date.now(), name: nn, phone: res.value.phone });
    if (old && puKey(old) !== puKey(nn)) {   // إعادة التسمية تنعكس على الواردات السابقة
        for (const r of puAll.filter(x => puKey(x.supplier) === puKey(old))) { r.supplier = nn; await puSaveRecord(r); }
    }
    puFillSupplierList(); renderPuSuppliers();
}
function puCmpInput() {
    const qn = normSearch($b('puCmpSearch').value), box = $b('puCmpResults');
    if (!qn) { box.style.display = 'none'; return; }
    const toks = qn.split(' ');
    const found = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    box.innerHTML = found.map(p => `<button type="button" onclick="puCmpShow(${p.id})"><span dir="ltr">${escapeHtml(p.name)}</span><small>${escapeHtml(p.brand || '')}</small></button>`).join('') || '<div class="bill-noresult">لا توجد نتائج</div>';
    box.style.display = 'block';
}
function puCmpShow(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    $b('puCmpResults').style.display = 'none'; $b('puCmpSearch').value = p.name;
    const by = new Map();
    puAll.filter(r => !r.cancelled).forEach(r => (r.items || []).filter(l => l.pid === id && l.cost > 0).forEach(l => {
        const k = puKey(r.supplier), e = by.get(k) || { name: r.supplier, last: null, count: 0, qty: 0 };
        e.count++; e.qty += l.qty; if (!e.last || String(r.date) >= String(e.last.date)) e.last = { date: r.date, cost: l.cost }; by.set(k, e);
    }));
    const arr = [...by.values()].sort((a, b) => a.last.cost - b.last.cost);
    $b('puCmpBody').innerHTML = arr.length
        ? `<table class="bill-table"><thead><tr><th>المذخر</th><th>آخر سعر</th><th>تاريخه</th><th>مرات الشراء</th></tr></thead><tbody>${arr.map((e, i) => `<tr class="${i === 0 ? 'pu-best' : ''}"><td>${i === 0 ? '✅ ' : ''}${escapeHtml(e.name)}</td><td><b>${fmtNum(e.last.cost)}</b></td><td>${escapeHtml(fmtDateDMY(e.last.date))}</td><td>${e.count}</td></tr>`).join('')}</tbody></table><div class="bill-set-hint">سعر البيع الحالي: ${fmtNum(p.price)} د.ع${p.costPrice ? ' • سعر الشراء المسجّل: ' + fmtNum(p.costPrice) : ''}</div>`
        : '<div class="bill-none">لا توجد مشتريات مسجّلة لهذا الدواء بعد.</div>';
}
