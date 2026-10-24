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

function emptyPurchase() { return { supplier: '', no: '', date: todayLocalISO(), items: [], returnAmt: '', paid: '', notes: '', stmt: false, useEntry: false }; }
const puNum = v => parseFloat(v) || 0;
const puLQ = l => (parseInt(l.qty) || 0) + (parseInt(l.bonus) || 0);   // الكمية الداخلة للمخزن = المشتراة + البونص
function puTotalOf(r) { return (r.items || []).reduce((s, it) => s + puNum(it.qty) * puNum(it.cost), 0); }
function puNetOf(r) { return Math.max(puTotalOf(r) - puNum(r.returnAmt) - (typeof lgLinkedRet === 'function' ? lgLinkedRet(r.id, 'all') : 0), 0); }
function puRemaining(r) { return r.cancelled ? 0 : Math.max(puNetOf(r) - puNum(r.paid), 0); }
// وارد «بونص فقط» مستورد: يظهر في سجل البونص ولا يظهر كقائمة شراء عادية
const puIsBonusOnly = r => !!(r && (r.bonusOnly || String(r.no || '').startsWith('BONUS-')));
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
    if (cloudReady() && (navigator.onLine || persistenceOn)) {
        try { await fsSet(db.collection('pharmacy_purchases').doc(r.id), JSON.parse(JSON.stringify(r))); }
        catch (e) { lsSet('diwanNeedsPush', '1'); Swal.fire({ icon: 'warning', title: 'حُفظ الوارد على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_purchases إلى قواعد Firestore لتُحفظ في السحابة أيضاً. ستُعاد المحاولة تلقائياً.', confirmButtonColor: '#0f1c38' }); }
    } else lsSet('diwanNeedsPush', '1');
}
async function puSaveSupplierRec(s) {
    puSuppliers = puSuppliers.filter(x => x.id !== s.id); puSuppliers.push(s);
    lsSet(PU_LS.sup, JSON.stringify(puSuppliers));
    if (cloudReady() && (navigator.onLine || persistenceOn)) { try { await fsSet(db.collection('pharmacy_suppliers').doc(s.id), s); } catch (e) { lsSet('diwanNeedsPush', '1'); } } else lsSet('diwanNeedsPush', '1');
}
async function puUpsertSupplier(name) {
    name = String(name || '').trim(); if (!name) return;
    if (puSuppliers.some(s => puKey(s.name) === puKey(name))) return;
    await puSaveSupplierRec({ id: 's' + Date.now() + Math.floor(Math.random() * 99), name, phone: '' });
}
function puSupplierNames(openOnly) {
    const set = new Map();
    puSuppliers.forEach(s => set.set(puKey(s.name), s.name));
    puAll.forEach(r => { if (r.supplier && !set.has(puKey(r.supplier))) set.set(puKey(r.supplier), r.supplier); });
    if (openOnly) { const closed = new Set(puSuppliers.filter(s => s.closed).map(s => puKey(s.name))); return [...set.entries()].filter(([k]) => !closed.has(k)).map(([, v]) => v).sort((a, b) => a.localeCompare(b, 'ar')); }
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'ar'));
}

// ---------- آخر وارد للصنف (يظهر في بطاقة الصنف للصيدلي) ----------
function puLinesOf(pid) {
    const src = (puAll && puAll.length) ? puAll : puLocalList();
    const out = [];
    src.filter(r => r && !r.cancelled && !puIsBonusOnly(r)).forEach(r => (r.items || []).filter(l => l.pid === pid).forEach(l => out.push({ r, l })));
    return out.sort((a, b) => String(b.r.date).localeCompare(String(a.r.date)) || String(b.r.createdTs).localeCompare(String(a.r.createdTs)));
}
function puLastExpBtn(p, arr) {   // زر صغير: استدعاء/إدخال تاريخ نفاذ آخر وارد
    const lp = p.lastPurchase, exp = (lp && lp.expiry) || (arr[0] && arr[0].l.expiry) || '';
    if (!lp && !arr.length) return '';
    const has = exp && getProductExpiryDates(p).includes(exp);
    return `<button type="button" class="lp-exp ${has ? 'done' : ''}" onclick="puLastExpiry(${p.id})" title="${has ? 'تاريخ النفاذ مضاف' : 'إضافة تاريخ نفاذ هذا الوارد'}">${has ? '✓ نفاذ' : '📅 نفاذ'}</button>`;
}
async function puLastExpiry(pid) {
    const p = products.find(x => x.id === pid); if (!p || !can('stockEdit') || !writesAllowed()) return;
    const arr = puLinesOf(pid), top = arr[0], lp = p.lastPurchase;
    let exp = (lp && lp.expiry) || (top && top.l.expiry) || '';
    if (exp && getProductExpiryDates(p).includes(exp)) { Swal.fire({ icon: 'info', title: 'تاريخ النفاذ ' + exp + ' مضاف أصلاً', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 }); return; }
    let fromUser = false;
    if (!exp) {
        const r = await Swal.fire({ title: 'تاريخ نفاذ آخر وارد', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
            html: `<div class="sw-form"><div class="sw-info" dir="ltr"><b>${escapeHtml(p.name)}</b></div><label>الشهر والسنة<input id="swLpExp" type="month" class="swal2-input"></label><small>يُضاف لتواريخ نفاذ المادة ويُسجَّل على فاتورة الوارد.</small></div>`,
            preConfirm: () => { const v = document.getElementById('swLpExp').value; if (!v) { Swal.showValidationMessage('اختر الشهر'); return false; } return v; } });
        if (!r.isConfirmed || !r.value) return;
        exp = r.value; fromUser = true;
    }
    const before = getProductExpiryDates(p).slice();
    puExpiryPush(p, exp);
    const add = getProductExpiryDates(p).filter(e => !before.includes(e));
    if (fromUser) {
        if (top) { top.l.expiry = exp; top.l.expAdded = true; await puSaveRecord(top.r); }
        if (lp) p.lastPurchase = { ...lp, expiry: exp };
    }
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0, expChanged: true, expAdd: add, expRemove: [], ...(fromUser && lp ? { lastSet: true, last: p.lastPurchase } : {}) }]);
    if (!ok) { p.expiryDates = before; p.expiryDate = before[0] || ''; return; }
    logAction('edit', p, [{ f: 'تاريخ النفاذ', from: '', to: exp }]);
    renderAll(); try { openSheet(pid); } catch (e) { /* تجاهل */ }
    Swal.fire({ icon: 'success', title: 'أُضيف تاريخ النفاذ ' + exp, toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 });
}
function lastPurchaseHtml(p) {
    const arr = puLinesOf(p.id);
    const cur = p.costPrice ? `<div style="font-size:0.78rem;margin-bottom:6px;font-weight:700;">💰 سعر الشراء الحالي: ${fmtNum(p.costPrice)} د.ع</div>` : '';
    const lp = p.lastPurchase;
    if (lp && (!arr.length || String(lp.date || '') >= String(arr[0].r.date || ''))) {
        const rows = arr.length ? arr.slice(0, 3).map(x => `<div style="font-size:0.74rem;color:#64748b;">• <b>${escapeHtml(x.r.supplier)}</b> — ${escapeHtml(fmtDateDMY(x.r.date))} — ${fmtNum(x.l.qty)} عبوة${x.l.cost ? ' × ' + fmtNum(x.l.cost) : ''}</div>`).join('') : '';
        return cur + `<div style="font-size:0.78rem; margin-bottom:8px; padding:6px 8px; border-radius:8px; background:#ecfdf5;"><div style="font-weight:800;color:#065f46;">📥 آخر وارد: <b>${escapeHtml(lp.supplier)}</b> — ${escapeHtml(fmtDateDMY(lp.date))} — ${fmtNum(lp.qty)} عبوة${lp.cost ? ' × ' + fmtNum(lp.cost) : ''} — فاتورة <span dir="ltr">${escapeHtml(lp.no)}</span>${lp.expiry ? ' — نفاذ <span dir="ltr">' + escapeHtml(lp.expiry) + '</span>' : ''} ${puLastExpBtn(p, arr)}</div>${rows}</div>`;
    }
    if (!arr.length) return cur + '<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px;">📥 لا يوجد وارد مسجّل لهذا الصنف</div>';
    const row = (x, first) => `<div style="${first ? 'font-weight:800;color:#065f46;' : 'font-size:0.74rem;color:#64748b;'}">${first ? '📥 آخر وارد: ' : '• '}<b>${escapeHtml(x.r.supplier)}</b> — ${escapeHtml(fmtDateDMY(x.r.date))} — ${fmtNum(x.l.qty)} عبوة${x.l.cost ? ' × ' + fmtNum(x.l.cost) : ''} — فاتورة <span dir="ltr">${escapeHtml(x.r.no)}</span>${x.l.batch ? ' — دفعة <span dir="ltr">' + escapeHtml(x.l.batch) + '</span>' : ''}${first ? ' ' + puLastExpBtn(p, arr) : ''}</div>`;
    return cur + `<div style="font-size:0.78rem; margin-bottom:8px; padding:6px 8px; border-radius:8px; background:#ecfdf5;">${row(arr[0], true)}${arr.slice(1, 4).map(x => row(x, false)).join('')}</div>`;
}

// ---------- التبويبات ----------
function puTab(name) {
    puTabName = name;
    document.querySelectorAll('#puTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name || (b.dataset.tab === 'hub' && typeof LG_REGS !== 'undefined' && LG_REGS.includes(name))));
    if (typeof lgHubInit === 'function') lgHubInit();
    document.querySelectorAll('.pu-pane').forEach(p => { p.classList.toggle('active', p.id === 'puPane-' + name); p.classList.remove('print-active'); });
    if (name === 'month') $b('puPane-month').classList.add('print-active');
    if (typeof lgTabBadge === 'function') lgTabBadge();
    if (name === 'new') puInitNew();
    (typeof lgLoad === 'function' ? Promise.all([puLoad(), lgLoad()]) : puLoad()).then(() => {
        puFillSupplierList();
        if (name === 'log') renderPuLog(); else if (name === 'debt') renderPuDebt(); else if (name === 'month') puInitMonth(); else if (name === 'ret') lgInitRet('ret'); else if (name === 'unrec') lgInitRet('unrec'); else if (name === 'pay') lgInitPay(); else if (name === 'bonus') lgInitBonus(); else if (name === 'xfer') lgInitXfer(); else if (name === 'exp') lgInitExp(); else if (name === 'hub') lgRenderHub(); else if (name === 'sum') lgInitSum(); else if (name === 'sup') renderPuSuppliers();
    });
}
function onShowPurch() { puTab(puTabName || 'new'); }
function puFillSupplierList() { const dl = $b('puSupList'); if (dl) dl.innerHTML = puSupplierNames(true).map(n => `<option value="${escapeHtml(n)}"></option>`).join(''); }

// ---------- وارد جديد ----------
function puInitNew() {
    if (!pu) { try { pu = JSON.parse(lsGet(PU_LS.draft)); } catch (e) { pu = null; } if (!pu || !Array.isArray(pu.items)) pu = emptyPurchase(); }
    puWriteFields(); puRenderItems(); puRecalc(); puFillSupplierList();
    const eb = $b('puEditBar'); if (eb) { eb.style.display = pu.editId ? 'flex' : 'none'; }
    $b('puSaveBtn').innerText = pu.editId ? '💾 حفظ التعديلات' : '✅ حفظ الوارد وإضافته للمخزن';
}
function puWriteFields() {
    $b('puSupplier').value = pu.supplier || ''; $b('puNo').value = pu.no || ''; $b('puDate').value = pu.date || todayLocalISO();
    $b('puReturn').value = pu.returnAmt === '' ? '' : pu.returnAmt; $b('puPaid').value = pu.paid === '' ? '' : pu.paid; $b('puNotes').value = pu.notes || '';
    if ($b('puStmt')) $b('puStmt').checked = !!pu.stmt; if ($b('puUseEntry')) $b('puUseEntry').checked = !!pu.useEntry;
}
function puReadFields() {
    pu.supplier = $b('puSupplier').value; pu.no = $b('puNo').value; pu.date = $b('puDate').value || todayLocalISO();
    pu.returnAmt = $b('puReturn').value; pu.paid = $b('puPaid').value; pu.notes = $b('puNotes').value;
    pu.stmt = !!($b('puStmt') && $b('puStmt').checked); pu.useEntry = !!($b('puUseEntry') && $b('puUseEntry').checked);
}
function puChanged() { puReadFields(); puRecalc(); clearTimeout(puDraftTimer); puDraftTimer = setTimeout(() => lsSet(PU_LS.draft, JSON.stringify(pu)), 300); }
function puRecalc() {
    const tot = puTotalOf(pu), net = puNetOf(pu), rem = Math.max(net - puNum(pu.paid), 0);
    $b('puTotal').innerText = fmtNum(tot); $b('puNet').innerText = fmtNum(net); $b('puRem').innerText = fmtNum(rem);
    pu.items.forEach((it, i) => {
        const sum = fmtNum(puNum(it.qty) * puNum(it.cost)), set = (id, v) => { const el = $b(id + i); if (el) el.innerText = v; };
        { const el = $b('puPs-' + i); if (el) el.innerHTML = puPM(it) === 'syndicate' ? syndHintHtml(it.cost) : puPM(it) === 'percent' ? markupHintHtml(it.cost, it.pmarkup) : ''; }
        set('puLine-', sum); set('puBq-', fmtNum(puNum(it.qty))); set('puBc-', puNum(it.cost) > 0 ? fmtNum(it.cost) : '⚠ بلا سعر'); set('puBs-', sum);
    });
}
function puThumb(pid) { const p = products.find(x => x.id === pid); return p && p.img ? `<img class="pk-img" src="${escapeHtml(p.img)}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="pk-img pk-noimg">💊</span>'; }
function puSub(pid) { const p = products.find(x => x.id === pid); return p ? [p.brand, fixMetaOrder(p.meta || ''), 'بالمخزن ' + stockLabel(p)].filter(Boolean).join(' · ') : ''; }
function puPM(it) { const p = products.find(x => x.id === it.pid); return it.pmode || (p && (p.pricing === 'syndicate' || p.pricing === 'percent') ? p.pricing : 'manual'); }
function puMk(it) { const p = products.find(x => x.id === it.pid); return it.pmarkup != null && it.pmarkup !== '' ? it.pmarkup : (p && p.pricing === 'percent' && p.markupPct != null ? p.markupPct : ''); }
function puCurPrice(pid) { const p = products.find(x => x.id === pid); return p && p.price ? '(الحالي ' + fmtNum(p.price) + ')' : ''; }
function puPriceMode(i, v) { const it = pu.items[i]; if (!it) return; it.pmode = v; const a = $b('puPm-' + i), b = $b('puPs-' + i); if (a) a.style.display = v === 'manual' ? 'block' : 'none'; if (b) b.style.display = v === 'syndicate' || v === 'percent' ? 'block' : 'none'; const c = $b('puPk-' + i); if (c) c.style.display = v === 'percent' ? 'block' : 'none'; if (v === 'percent' && it.pmarkup == null) it.pmarkup = puMk(it); puRecalc(); puChanged(); }
function puRenderItems() {
    $b('puCount').innerText = pu.items.length ? 'عدد المواد في الفاتورة: ' + pu.items.length : '';
    $b('puItems').innerHTML = pu.items.map((it, i) => `
        <div class="pu-item ${it.open ? 'open' : 'closed'}" id="puItem-${i}">
            <div class="pu-bar" onclick="puToggle(${i})">
                <span class="pu-chev">${it.open ? '▾' : '▸'}</span>
                <span class="pu-bar-name" dir="ltr">${escapeHtml(it.name)}</span>
                <span class="pu-bar-sum"><span id="puBq-${i}"></span> × <span id="puBc-${i}"></span> = <b id="puBs-${i}"></b></span>
                <button type="button" class="pu-x" onclick="event.stopPropagation();puRemoveItem(${i})" aria-label="حذف">✕</button>
            </div>
            <div class="pu-body" style="display:${it.open ? 'block' : 'none'}">
                <div class="pu-item-h">${puThumb(it.pid)}<span class="pu-item-t"><b dir="ltr">${escapeHtml(it.name)}</b><span>${escapeHtml(puSub(it.pid))}</span></span></div>
                <div class="pu-grid">
                    <label><span>العدد (عبوة)</span><input type="number" min="1" inputmode="numeric" value="${escapeHtml(it.qty)}" oninput="puItemEdit(${i},'qty',this.value)"></label>
                    <label><span>بونص (مجاني)</span><input type="number" min="0" inputmode="numeric" placeholder="0" value="${escapeHtml(it.bonus || '')}" oninput="puItemEdit(${i},'bonus',this.value)"></label>
                    <label><span>سعر الشراء</span><input type="number" min="0" inputmode="decimal" value="${escapeHtml(it.cost)}" oninput="puItemEdit(${i},'cost',this.value)"></label>
                    <label><span>تاريخ الانتهاء</span><input type="month" dir="ltr" value="${escapeHtml(it.expiry || '')}" oninput="puItemEdit(${i},'expiry',this.value)"></label>
                    <label><span>رقم الدفعة (اختياري)</span><input dir="ltr" value="${escapeHtml(it.batch || '')}" oninput="puItemEdit(${i},'batch',this.value)"></label>
                </div>
                <div class="pu-price">
                    <label><span>طريقة تسعير البيع</span><select onchange="puPriceMode(${i},this.value)">
                        <option value="manual" ${puPM(it) === 'manual' ? 'selected' : ''}>يدوي — مسعّر من الوزارة (ملصق)</option>
                        <option value="syndicate" ${puPM(it) === 'syndicate' ? 'selected' : ''}>حسب كتاب نقابة الصيادلة</option>
                        <option value="percent" ${puPM(it) === 'percent' ? 'selected' : ''}>بنسبة مئوية أدخلها (سعر الشراء + %)</option></select></label>
                    <label id="puPk-${i}" style="display:${puPM(it) === 'percent' ? 'block' : 'none'}"><span>نسبة الإضافة على سعر الشراء (%)</span><input type="number" min="0" step="any" inputmode="decimal" placeholder="مثال: 25" value="${escapeHtml(String(puMk(it)))}" oninput="puItemEdit(${i},'pmarkup',this.value)"></label>
                    <label id="puPm-${i}" style="display:${puPM(it) === 'manual' ? 'block' : 'none'}"><span>سعر البيع المطبوع على الملصق ${puCurPrice(it.pid)}</span><input type="number" min="0" inputmode="decimal" placeholder="اتركه فارغاً للإبقاء على السعر الحالي" value="${escapeHtml(it.pprice || '')}" oninput="puItemEdit(${i},'pprice',this.value)"></label>
                    <div id="puPs-${i}" class="pu-syn" style="display:${puPM(it) === 'syndicate' || puPM(it) === 'percent' ? 'block' : 'none'}"></div>
                </div>
                <div class="pu-line">المجموع: <b id="puLine-${i}">0</b> د.ع</div>
            </div>
        </div>`).join('') || '<div class="bill-none">ابحث عن دواء أو امسح باركوده لإضافته إلى الفاتورة الواردة.</div>';
    puRecalc();
}
function puToggle(i) { if (!pu.items[i]) return; pu.items[i].open = !pu.items[i].open; puRenderItems(); if (pu.items[i].open) { const el = $b('puItem-' + i); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
function puItemEdit(i, f, v) { if (!pu.items[i]) return; pu.items[i][f] = v; puChanged(); }
function puRemoveItem(i) { pu.items.splice(i, 1); puRenderItems(); puChanged(); }
function puAddProduct(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    if (puPendingBc) { puAttachBarcode(p, puPendingBc); puPendingBc = ''; puShowPending(); }
    const ex = pu.items.find(it => it.pid === id);
    pu.items.forEach(it => { it.open = false; });   // القديمة تنطوي والجديدة تُفتح
    if (ex) { ex.qty = (parseInt(ex.qty) || 0) + 1; ex.open = true; }
    else pu.items.push({ pid: id, name: p.name, qty: 1, bonus: '', cost: p.costPrice || '', expiry: '', batch: '', open: true });
    $b('puSearch').value = ''; $b('puResults').style.display = 'none';
    puRenderItems(); puChanged();
    const cards = document.querySelectorAll('#puItems .pu-item');   //    // التمرير للصنف المضاف وتمييزه
    const idx = pu.items.findIndex(it => it.pid === id), card = cards[idx];
    if (card) { card.classList.add('pu-flash'); card.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => card.classList.remove('pu-flash'), 1400); }
}
// ---- صنف غير موجود في المخزن: إنشاؤه من داخل الوارد ثم إضافته للفاتورة تلقائياً
let puAwaiting = false;
function puCreateProduct(name, barcode) {
    puAwaiting = true;
    openFormModal();
    document.getElementById('fName').value = name || '';
    document.getElementById('fQty').value = 0;   // الكمية تأتي من الوارد نفسه
    if (barcode) { formBarcodes = [cleanBarcode(barcode)]; renderBarcodeChips(); }
    $b('puResults').style.display = 'none';
}
function onProductSaved(obj) {
    if (puAwaiting && currentView === 'purch') { puAwaiting = false; puAddProduct(obj.id); Swal.fire({ icon: 'success', title: 'أُضيف الصنف الجديد إلى الوارد', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 }); }
}
async function puAttachBarcode(p, code) {
    const list = barcodesOf(p); if (!list.includes(code)) list.push(code);
    p.barcodes = list; p.barcode = list[0];
    await saveProductsDelta([{ p, dq: 0, dl: 0 }]);
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
        ? puFound.map(p => productPickHtml(p, 'puAddProduct', 'بالمخزن ' + stockLabel(p) + (p.costPrice ? ' · آخر شراء ' + fmtNum(p.costPrice) : ''))).join('')
        : `<div class="bill-noresult">الصنف غير موجود في المخزن<button type="button" class="pu-newprod" onclick="puCreateProduct(decodeURIComponent('${encodeURIComponent($b('puSearch').value.trim())}'),'')">➕ إضافة «${escapeHtml($b('puSearch').value.trim())}» كصنف جديد</button></div>`;
    box.style.display = 'block';
}
function puSearchEnter() {
    const raw = $b('puSearch').value.trim(), code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code)) { puAddByBarcode(code); $b('puSearch').value = ''; $b('puResults').style.display = 'none'; return; }
    if (puFound.length) puAddProduct(puFound[0].id);
}
function puScan() { openBarcodeScanner(puAddByBarcode); }
function puAddByBarcode(code, gs1) {
    gs1 = gs1 || parseGS1(code);
    code = gs1 ? gs1.gtin : cleanBarcode(code);
    const p = findByBarcode(code);
    if (p) { puAddProduct(p.id); const it = pu.items.find(x => x.pid === p.id); if (it && gs1) { if (gs1.batch && !it.batch) it.batch = gs1.batch; if (gs1.exp && !it.expiry) it.expiry = gs1.exp; puRenderItems(); puChanged(); } Swal.fire({ icon: 'success', title: 'أُضيف: ' + p.name, toast: true, position: 'bottom', showConfirmButton: false, timer: 1200 }); return; }
    offerUnknownBarcode(code, p2 => puAddProduct(p2.id), { onNew: c => puCreateProduct('', c) });
}
function puNew() {
    const has = pu && (pu.items.length || pu.supplier || pu.no) && !pu.editId;
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
    const editing = pu.editId ? puAll.find(x => x.id === pu.editId) : null;
    const supplier = pu.supplier.trim(), no = pu.no.trim();
    const items = pu.items.filter(it => parseInt(it.qty) > 0 || parseInt(it.bonus) > 0);
    const warn = t => Swal.fire({ icon: 'warning', title: t, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    if (!supplier) return warn('اكتب اسم المذخر');
    if (!no) return warn('اكتب رقم فاتورة المذخر');
    if (!items.length) return warn('أضف مادة واحدة على الأقل بعدد صحيح');
    if (items.some(it => parseInt(it.qty) > 0 && !(puNum(it.cost) > 0))) {
        const r = await Swal.fire({ icon: 'question', title: 'بعض المواد بلا سعر شراء', text: 'لن يُحسب لها ربح ولن يتغير سعر شرائها. متابعة؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'رجوع' });
        if (!r.isConfirmed) return;
    }
    await puLoad();
    if (puAll.some(x => x.id !== pu.editId && !x.cancelled && puKey(x.supplier) === puKey(supplier) && puKey(x.no) === puKey(no))) {
        const r = await Swal.fire({ icon: 'warning', title: 'رقم الفاتورة مسجّل سابقاً لهذا المذخر', text: 'هل تريد تسجيلها مرة أخرى؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'تسجيل', cancelButtonText: 'رجوع' });
        if (!r.isConfirmed) return;
    }
    if (!writesAllowed()) return;
    if (typeof lgGuardClosed === 'function' && !(await lgGuardClosed([pu.date, editing && editing.date].filter(Boolean).map(d => puMonthOf({ date: d, useEntry: pu.useEntry, createdTs: editing && editing.createdTs }))))) return;
    const total = items.reduce((s, it) => s + puNum(it.qty) * puNum(it.cost), 0), ret = puNum(pu.returnAmt);
    if (ret > total) return warn('مبلغ الاسترجاع أكبر من مجموع الفاتورة');
    const oldLines = editing ? (editing.items || []) : [];
    const oldBy = new Map(oldLines.map(l => [l.pid, l]));
    const snaps = new Map(), lines = [];
    const snap = p => { if (!snaps.has(p.id)) snaps.set(p.id, { p, qty: p.qty, loose: p.loose, costPrice: p.costPrice, price: p.price, pricing: p.pricing, markupPct: p.markupPct, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase }); };
    // 1) الأصناف التي أُزيلت من الفاتورة عند التعديل: نُنقص كميتها السابقة
    const newIds = new Set(items.map(it => it.pid));
    oldLines.filter(l => !newIds.has(l.pid)).forEach(l => {
        const p = products.find(x => x.id === l.pid); if (!p) return; snap(p);
        p.qty = Math.max((parseInt(p.qty) || 0) - puLQ(l), 0);
        if (l.cost > 0 && puNum(p.costPrice) === l.cost) p.costPrice = l.prevCost || 0;
        if (l.expAdded && l.expiry) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== l.expiry); p.expiryDate = p.expiryDates[0] || ''; }
    });
    // 2) الأصناف الحالية: الفرق بين الكمية الجديدة والقديمة
    items.forEach(it => {
        const p = products.find(x => x.id === it.pid); if (!p) return; snap(p);
        const n = parseInt(it.qty) || 0, bn = parseInt(it.bonus) || 0, cost = puNum(it.cost), old = oldBy.get(it.pid);
        const line = { pid: p.id, name: p.name, qty: n, bonus: bn, cost, expiry: it.expiry || '', batch: (it.batch || '').trim(), prevQty: old ? old.prevQty : (parseInt(p.qty) || 0), prevCost: old ? old.prevCost : (p.costPrice || 0), expAdded: old ? !!old.expAdded : false };
        p.qty = Math.max((parseInt(p.qty) || 0) + n + bn - (old ? puLQ(old) : 0), 0);
        if (old && old.expiry !== line.expiry && old.expAdded && old.expiry) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== old.expiry); p.expiryDate = p.expiryDates[0] || ''; line.expAdded = false; }
        if (cost > 0) p.costPrice = cost;
        { const pm = puPM(it); if (pm === 'percent') { const mk = puNum(puMk(it)); p.pricing = 'percent'; p.markupPct = mk; if (cost > 0) p.price = markupCalc(cost, mk); } else if (pm === 'syndicate') { p.markupPct = null; p.pricing = 'syndicate'; if (cost > 0) p.price = syndPrice(cost); } else { p.markupPct = null; p.pricing = 'manual'; if (puNum(it.pprice) > 0) p.price = puNum(it.pprice); } }
        line.bonusSale = bn * (Number(p.price) || 0);
        if (line.expiry && puExpiryPush(p, line.expiry)) line.expAdded = true;
        const lp = p.lastPurchase;
        if (!lp || String(pu.date) >= String(lp.date || '')) p.lastPurchase = { supplier, no, date: pu.date, qty: n, cost, batch: line.batch, expiry: line.expiry };
        lines.push(line);
    });
    const touched = [...snaps.values()].map(s => s.p);
    const ok = await saveProductsDelta([...snaps.values()].map(s => deltaFromSnap(s.p, s)));
    if (!ok) { snaps.forEach(s => { s.p.qty = s.qty; s.p.costPrice = s.costPrice; s.p.expiryDates = s.expiryDates; s.p.expiryDate = s.expiryDate; s.p.lastPurchase = s.lastPurchase; s.p.price = s.price; s.p.pricing = s.pricing; s.p.markupPct = s.markupPct; }); renderAll(); return; }
    // تحقق من وصول الكميات للسحابة فعلاً
    try {
        if (cloudReady() && navigator.onLine && pendingOps === 0) {
            const bad = [];
            for (const sn of snaps.values()) { const d = await db.collection('pharmacy_stock').doc(String(sn.p.id)).get(); const data = d.exists ? d.data() : null; if (!data || (parseInt(data.qty) || 0) !== (parseInt(sn.p.qty) || 0)) bad.push(sn.p.name); }
            if (bad.length) Swal.fire({ icon: 'warning', title: 'تنبيه: لم تصل بعض الكميات للسحابة', text: 'الأصناف: ' + bad.join('، ') + '. تأكد من قواعد pharmacy_stock ومن الاتصال ثم أعد المحاولة.', confirmButtonColor: '#0f1c38' });
        }
    } catch (e) { /* تجاهل */ }
    lines.forEach(l => { const p = products.find(x => x.id === l.pid); const old = oldBy.get(l.pid); logAction('qty', p, [{ f: 'الكمية (' + (editing ? 'تعديل وارد ' : 'وارد ') + no + ' - ' + supplier + ')', from: String(old ? puLQ(old) : l.prevQty), to: String(old ? puLQ(l) : l.prevQty + puLQ(l)) }]); });
    const paid = Math.min(puNum(pu.paid), Math.max(total - ret, 0));
    let rec;
    if (editing) {
        const diff = paid - puNum(editing.paid);
        rec = { ...editing, seq: (editing.seq && puMonthOf({ ...editing, date: pu.date, useEntry: !!pu.useEntry }) === puMonthOf(editing)) ? editing.seq : puNextSeq(puMonthOf({ ...editing, date: pu.date, useEntry: !!pu.useEntry }), editing.id), stmt: !!pu.stmt, useEntry: !!pu.useEntry, supplier, no, date: pu.date, items: lines, returnAmt: ret, paid, notes: pu.notes.trim(), editedAt: new Date().toISOString() };
        rec.payments = (editing.payments || []).slice(); if (Math.abs(diff) > 0.001) rec.payments.push({ at: todayLocalISO(), amount: diff, adj: true });
    } else {
        rec = { id: 'pu' + Date.now(), seq: puNextSeq((pu.useEntry ? todayLocalISO() : String(pu.date)).slice(0, 7)), stmt: !!pu.stmt, useEntry: !!pu.useEntry, supplier, no, date: pu.date, items: lines, returnAmt: ret, paid, payments: paid > 0 ? [{ at: pu.date, amount: paid }] : [], notes: pu.notes.trim(), cancelled: false, createdTs: new Date().toISOString() };
    }
    await puSaveRecord(rec);
    await puUpsertSupplier(supplier);
    renderAll();
    pu = emptyPurchase(); lsSet(PU_LS.draft, JSON.stringify(pu)); puInitNew();
    Swal.fire({ icon: 'success', title: editing ? 'حُفظت التعديلات وصُحّح المخزن' : 'حُفظ الوارد وأُضيفت الكميات للمخزن', toast: true, position: 'bottom', showConfirmButton: false, timer: 2500 });
    if (editing) puTab('log');
}
function puCancelEdit() { pu = emptyPurchase(); lsSet(PU_LS.draft, JSON.stringify(pu)); puInitNew(); }
function puEdit(id) {
    const r = puAll.find(x => x.id === id); if (!r || r.cancelled) return;
    if (pu && pu.items.length && !pu.editId) { /* المسودة الحالية ستُستبدل */ }
    pu = { editId: r.id, stmt: !!r.stmt, useEntry: !!r.useEntry, supplier: r.supplier, no: r.no, date: r.date, returnAmt: r.returnAmt || '', paid: r.paid || '', notes: r.notes || '', items: (r.items || []).map(l => ({ pid: l.pid, name: l.name, qty: l.qty, bonus: l.bonus || '', cost: l.cost, expiry: l.expiry || '', batch: l.batch || '' })) };
    puTab('new'); window.scrollTo(0, 0);
}

// ---------- السجل ----------
function puCardHtml(r, extra, withSeq) {
    const rem = puRemaining(r);
    const tags = (r.cancelled ? '<em class="tg bad">ملغى</em>' : '') + (rem > 0 ? `<em class="tg warn">متبقي ${fmtNum(rem)}</em>` : '') + (puNum(r.returnAmt) > 0 ? `<em class="tg">استرجاع ${fmtNum(r.returnAmt)}</em>` : '') + (r.stmt ? '<em class="tg">✓ كشف</em>' : '');
    return `<div class="bill-card ${r.cancelled ? 'cancelled' : ''}">
        ${withSeq && puSelMode ? `<button type="button" class="sel-ck ${puSel.has(r.id) ? 'on' : ''}" onclick="puSelToggle('${r.id}',event)" aria-label="تحديد">${puSel.has(r.id) ? '✓' : ''}</button>` : ''}
        ${withSeq ? `<div class="pu-seqbox" onclick="puSeqEdit('${r.id}', event)" title="رقم القائمة في الشهر — انقر للتعديل">${r.seq || '؟'}</div>` : ''}
        <div class="bill-card-main" onclick="${withSeq && puSelMode ? `puSelToggle('${r.id}',event)` : `puOpen('${r.id}')`}">
            <b>${escapeHtml(r.supplier)}</b> <span dir="ltr">${escapeHtml(r.no)}</span> ${tags}
            <small>${escapeHtml(fmtDateDMY(r.date))} • ${(r.items || []).length} مادة</small>
        </div>
        <div class="bill-card-amt">${fmtNum(puNetOf(r))}<small>د.ع</small></div>
        ${withSeq && !r.cancelled ? `<button type="button" class="stmt-ck ${r.stmt ? 'on' : ''}" onclick="event.stopPropagation();lgToggleStmt('inv','${r.id}')" aria-label="وصل الكشف" title="وصل كشف هذه القائمة">${r.stmt ? '✓' : ''}<small>كشف</small></button>` : ''}
        ${extra || (r.cancelled ? `<button type="button" class="bill-tb-btn bill-danger" onclick="puDeletePermanently('${r.id}')">🗑 حذف</button>` : '')}
    </div>`;
}
// حذف نهائي لوارد ملغى فقط؛ الكميات أُنقصت أصلاً عند الإلغاء ولا يدخل في المستحقات
async function puDeletePermanently(id) {
    const r = puAll.find(x => x.id === id);
    if (!r || !r.cancelled) { Swal.fire({ icon: 'info', title: 'الحذف النهائي للوارد الملغى فقط', text: 'ألغِ الوارد أولاً ثم احذفه.', confirmButtonColor: '#0f1c38' }); return; }
    const c = await Swal.fire({ icon: 'warning', title: 'حذف وارد ' + escapeHtml(r.supplier) + ' (' + escapeHtml(r.no) + ') نهائياً؟', html: 'سيُحذف من هذا الجهاز ومن السحابة ولا يمكن استرجاعه.<br>لا يتأثر المخزون ولا مستحقات المذاخر (فهو ملغى أصلاً).', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'احذف نهائياً', cancelButtonText: 'تراجع' });
    if (!c.isConfirmed) return;
    if (cloudReady() && !navigator.onLine && !persistenceOn) { Swal.fire({ icon: 'error', title: 'لا يوجد اتصال', text: 'الحذف النهائي يحتاج اتصالاً حتى لا يعود الوارد من السحابة.', confirmButtonColor: '#0f1c38' }); return; }
    try {
        if (cloudReady()) await fsWrite(db.collection('pharmacy_purchases').doc(r.id).delete());
        puAll = puAll.filter(x => x.id !== r.id);
        lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500)));
        if (typeof renderPuLog === 'function' && $b('puLogList')) renderPuLog();
        Swal.fire({ icon: 'success', title: 'حُذف الوارد نهائياً', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحذف', text: e.message || String(e), confirmButtonColor: '#0f1c38' }); }
}
// ترقيم القوائم الشهري (عمود «ت» في الإكسل): يبدأ من 1 كل شهر ويتبع الإدخال، ويمكن تعديله بالنقر عليه
function puMonthRecs(m) { return puAll.filter(r => !puIsBonusOnly(r) && puMonthOf(r) === m); }
function puNextSeq(m, exceptId) { return puMonthRecs(m).filter(r => r.id !== exceptId).reduce((a, r) => Math.max(a, parseInt(r.seq) || 0), 0) + 1; }
function puSeqCmp(a, b) { return ((parseInt(a.seq) || 1e9) - (parseInt(b.seq) || 1e9)) || String(a.createdTs || a.date).localeCompare(String(b.createdTs || b.date)); }
function puMonthsList() { return [...new Set(puAll.filter(r => !puIsBonusOnly(r)).map(puMonthOf).filter(Boolean))].sort().reverse(); }
function puLogFillMonths() {
    const sel = $b('puLogMonth'); if (!sel) return;
    const cur = sel.value, ms = puMonthsList();
    sel.innerHTML = '<option value="">كل الأشهر</option>' + ms.map(m => `<option value="${m}">${m} (${puMonthRecs(m).length})</option>`).join('');
    if (!sel.dataset.init) { sel.dataset.init = '1'; sel.value = ms[0] || ''; } else sel.value = (cur === '' || ms.includes(cur)) ? cur : (ms[0] || '');
}
function renderPuLog() {
    puLogFillMonths();
    const q = puKey($b('puLogSearch').value), m = $b('puLogMonth') ? $b('puLogMonth').value : '';
    let arr = puAll.filter(r => !puIsBonusOnly(r)).filter(r => !m || puMonthOf(r) === m).filter(r => !q || [r.supplier, r.no].some(x => puKey(x).includes(q)));
    arr = m ? arr.slice().sort(puSeqCmp) : arr.slice().sort((a, b) => puMonthOf(b).localeCompare(puMonthOf(a)) || puSeqCmp(a, b));
    puLogShown = arr.map(r => r.id);
    $b('puLogList').innerHTML = arr.map(r => puCardHtml(r, undefined, true)).join('') || '<div class="bill-none">لا توجد واردات مسجّلة بعد.</div>';
    puSelBarRender();
}
async function puSeqEdit(id, ev) {
    if (ev) ev.stopPropagation();
    const r = puAll.find(x => x.id === id); if (!r) return;
    const res = await Swal.fire({ title: 'رقم القائمة في شهر ' + puMonthOf(r), text: 'يتطابق مع ترقيم القوائم الورقية', input: 'number', inputValue: r.seq || puNextSeq(puMonthOf(r), r.id), inputAttributes: { min: 1, step: 1 }, showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
    if (!res.isConfirmed) return;
    const n = parseInt(res.value); if (!(n > 0)) return;
    const dup = puMonthRecs(puMonthOf(r)).find(x => x.id !== r.id && parseInt(x.seq) === n);
    if (dup) { const c = await Swal.fire({ icon: 'question', title: 'الرقم ' + n + ' مستخدم', text: 'مستخدم لقائمة ' + dup.supplier + ' (' + dup.no + '). المتابعة تعطي الرقمين نفسه.', showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' }); if (!c.isConfirmed) return; }
    r.seq = n; await puSaveRecord(r); renderPuLog();
}
function puOpen(id) {
    const r = puAll.find(x => x.id === id); if (!r) return;
    const rows = (r.items || []).map(it => `<tr><td dir="ltr">${escapeHtml(it.name)}</td><td>${fmtNum(it.qty)}${it.bonus ? ' <small>+' + fmtNum(it.bonus) + ' بونص</small>' : ''}</td><td>${fmtNum(it.cost)}</td><td dir="ltr">${escapeHtml(it.expiry || '—')}</td><td dir="ltr">${escapeHtml(it.batch || '—')}</td><td>${fmtNum(it.qty * it.cost)}</td></tr>`).join('');
    const pays = (r.payments || []).map(p => `<div>${escapeHtml(fmtDateDMY(p.at))} — ${fmtNum(p.amount)} د.ع</div>`).join('') || '<div>لا دفعات</div>';
    const btn = (label, fn, cls) => `<button type="button" class="bill-tb-btn ${cls || ''}" onclick="Swal.close();${fn}">${label}</button>`;
    Swal.fire({
        title: escapeHtml(r.supplier) + ' — ' + escapeHtml(r.no), showConfirmButton: false, showCloseButton: true, width: 640,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(r.date))}${r.cancelled ? ' • <b style="color:#b91c1c">ملغى</b>' : ''}</div>
            <div class="pu-d-scroll"><table class="bill-table"><thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>الانتهاء</th><th>الدفعة</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody></table></div>
            <div class="pu-d-tot"><div>المجموع: <b>${fmtNum(puTotalOf(r))}</b></div><div>الاسترجاع: <b>${fmtNum(puNum(r.returnAmt) + (typeof lgLinkedRet === 'function' ? lgLinkedRet(r.id, 'all') : 0))}</b></div><div>الصافي: <b>${fmtNum(puNetOf(r))}</b></div><div>المدفوع: <b>${fmtNum(r.paid)}</b></div><div>المتبقي: <b>${fmtNum(puRemaining(r))}</b></div></div>
            <div class="pu-d-pays"><b>الدفعات:</b>${pays}</div>${typeof lgLinkedHtml === 'function' ? lgLinkedHtml(r.id) : ''}${r.notes ? `<div class="pu-d-pays"><b>ملاحظات:</b> ${escapeHtml(r.notes)}</div>` : ''}
            <div class="pu-d-btns">${r.cancelled ? btn('🗑 حذف نهائي', `puDeletePermanently('${r.id}')`, 'bill-danger') : btn('✏️ تعديل الفاتورة', `puEdit('${r.id}')`) + btn('💳 تسديد', `puPay('${r.id}')`, 'bill-pay') + btn('📦 إرجاع مواد', `lgOpenReturn({listId:'${r.id}'})`) + btn('↩️ مبلغ الاسترجاع', `puSetReturn('${r.id}')`) + btn('✖ إلغاء الوارد', `puCancel('${r.id}')`, 'bill-danger')}</div></div>`
    });
}
async function puSetReturn(id) {
    const r = puAll.find(x => x.id === id); if (!r) return;
    const res = await Swal.fire({ title: 'مبلغ الاسترجاع', html: `مجموع الفاتورة: <b>${fmtNum(puTotalOf(r))} د.ع</b>`, input: 'number', inputValue: puNum(r.returnAmt) || '', inputAttributes: { min: 0, max: puTotalOf(r) }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء' });
    if (!res.isConfirmed) return;
    if (typeof lgGuardClosed === 'function' && !(await lgGuardClosed([puMonthOf(r)]))) return;
    r.returnAmt = Math.min(Math.max(puNum(res.value), 0), puTotalOf(r));
    if (puNum(r.paid) > puNetOf(r)) r.paid = puNetOf(r);
    await puSaveRecord(r); puRefreshCurrent();
}
async function puCancel(id) {
    const r = puAll.find(x => x.id === id); if (!r || r.cancelled) return;
    const res = await Swal.fire({ icon: 'warning', title: 'إلغاء الوارد؟', text: 'ستُنقص الكميات المضافة من المخزن ويُلغى مبلغها من المستحقات.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، إلغاء', cancelButtonText: 'رجوع' });
    if (!res.isConfirmed) return;
    if (!writesAllowed()) return;
    if (typeof lgGuardClosed === 'function' && !(await lgGuardClosed([puMonthOf(r)]))) return;
    const touched = [], csnaps = new Map();
    (r.items || []).forEach(l => {
        const p = products.find(x => x.id === l.pid); if (!p) return;
        if (!csnaps.has(p.id)) csnaps.set(p.id, { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase });
        p.qty = Math.max((parseInt(p.qty) || 0) - puLQ(l), 0);
        if (l.cost > 0 && puNum(p.costPrice) === l.cost) p.costPrice = l.prevCost || 0;
        if (l.expAdded && l.expiry) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== l.expiry); p.expiryDate = p.expiryDates[0] || ''; }
        touched.push(p);
    });
    r.cancelled = true;   // مؤقتاً لإعادة حساب «آخر وارد» دون هذه الفاتورة
    touched.forEach(pp => { const rest = puLinesOf(pp.id)[0]; pp.lastPurchase = rest ? { supplier: rest.r.supplier, no: rest.r.no, date: rest.r.date, qty: rest.l.qty, cost: rest.l.cost, batch: rest.l.batch || '', expiry: rest.l.expiry || '' } : null; });
    r.cancelled = false;
    if (touched.length && !(await saveProductsDelta([...new Set(touched)].map(p => deltaFromSnap(p, csnaps.get(p.id)))))) return;
    r.cancelled = true; r.cancelledAt = todayLocalISO();
    await puSaveRecord(r); renderAll(); puRefreshCurrent();
}
function puRefreshCurrent() { if (puTabName === 'log') renderPuLog(); else if (puTabName === 'debt') renderPuDebt(); else if (puTabName === 'month') renderPuMonth(); else if (puTabName === 'ret') lgRenderRet('ret'); else if (puTabName === 'unrec') lgRenderRet('unrec'); else if (puTabName === 'pay') lgPayRender(); else if (puTabName === 'bonus') lgRenderBonus(); else if (puTabName === 'xfer') lgRenderXfer(); else if (puTabName === 'exp') lgRenderExp(); else if (puTabName === 'sum') lgRenderSum(true); else if (puTabName === 'hub') lgRenderHub(); else if (puTabName === 'sup') renderPuSuppliers(); }

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
// (سجل الطلبيات الشهري/السنوي: انظر ledger.js)
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
        return `<div class="bill-card ${rec.closed ? 'is-closed' : ''}"><div class="bill-card-main" onclick="puEditSupplier(decodeURIComponent('${enc}'))"><b>${escapeHtml(n)}</b>${rec.closed ? '<em class="tg">مغلق</em>' : ''}${owed > 0 ? `<em class="tg warn">مستحق ${fmtNum(owed)}</em>` : ''}<small>${rec.phone ? escapeHtml(rec.phone) + ' • ' : ''}${list.length} فاتورة • إجمالي التعامل ${fmtNum(net)} د.ع</small></div><button type="button" class="bill-tb-btn" onclick="puEditSupplier(decodeURIComponent('${enc}'))">تعديل</button></div>`;
    }).join('') || '<div class="bill-none">لا توجد مذاخر بعد — تُضاف تلقائياً عند أول وارد.</div>';
}
async function puEditSupplier(name) {
    const isNew = !name, rec = puSuppliers.find(s => puKey(s.name) === puKey(name)) || { id: '', name: '', phone: '' };
    const res = await Swal.fire({
        title: isNew ? 'إضافة مذخر' : 'تعديل المذخر', showCancelButton: true, showDenyButton: !isNew, denyButtonText: '🗑 حذف المذخر', confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<div class="sw-form"><label>اسم المذخر<input id="swSupName" class="swal2-input" value="${escapeHtml(rec.name || name)}"></label>
            <label>الهاتف (اختياري)<input id="swSupPhone" class="swal2-input" dir="ltr" inputmode="tel" value="${escapeHtml(rec.phone || '')}"></label>
            <label class="pu-chk"><input type="checkbox" id="swSupClosed" ${rec.closed ? 'checked' : ''}><span>مذخر مغلق (يُخفى من اقتراحات الوارد الجديد ويبقى سجله)</span></label></div>`,
        preConfirm: () => { const n = document.getElementById('swSupName').value.trim(); if (!n) { Swal.showValidationMessage('اكتب اسم المذخر'); return false; } return { name: n, phone: document.getElementById('swSupPhone').value.trim(), closed: document.getElementById('swSupClosed').checked }; }
    });
    if (res.isDenied) { await puDeleteSupplier(rec.name || name); return; }
    if (!res.isConfirmed || !res.value) return;
    const nn = res.value.name, old = rec.name || name;
    await puSaveSupplierRec({ id: rec.id || 's' + Date.now(), name: nn, phone: res.value.phone, closed: !!res.value.closed });
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
    box.innerHTML = found.map(p => productPickHtml(p, 'puCmpShow', '')).join('') || '<div class="bill-noresult">لا توجد نتائج</div>';
    box.style.display = 'block';
}
function puCmpShow(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    $b('puCmpResults').style.display = 'none'; $b('puCmpSearch').value = p.name;
    const by = new Map();
    puAll.filter(r => !r.cancelled && !puIsBonusOnly(r)).forEach(r => (r.items || []).filter(l => l.pid === id && l.cost > 0).forEach(l => {
        const k = puKey(r.supplier), e = by.get(k) || { name: r.supplier, last: null, count: 0, qty: 0 };
        e.count++; e.qty += l.qty; if (!e.last || String(r.date) >= String(e.last.date)) e.last = { date: r.date, cost: l.cost }; by.set(k, e);
    }));
    const arr = [...by.values()].sort((a, b) => a.last.cost - b.last.cost);
    $b('puCmpBody').innerHTML = arr.length
        ? `<table class="bill-table"><thead><tr><th>المذخر</th><th>آخر سعر</th><th>تاريخه</th><th>مرات الشراء</th></tr></thead><tbody>${arr.map((e, i) => `<tr class="${i === 0 ? 'pu-best' : ''}"><td>${i === 0 ? '✅ ' : ''}${escapeHtml(e.name)}</td><td><b>${fmtNum(e.last.cost)}</b></td><td>${escapeHtml(fmtDateDMY(e.last.date))}</td><td>${e.count}</td></tr>`).join('')}</tbody></table><div class="bill-set-hint">سعر البيع الحالي: ${fmtNum(p.price)} د.ع${p.costPrice ? ' • سعر الشراء المسجّل: ' + fmtNum(p.costPrice) : ''}</div>`
        : '<div class="bill-none">لا توجد مشتريات مسجّلة لهذا الدواء بعد.</div>';
}

// ---------- إعادة إرسال السجلات المحفوظة محلياً فقط ----------
let syncingLocal = false;
function localOnlyCounts() { return ''; }
async function syncLocalRecords(auto) {
    if (!cloudReady() || !navigator.onLine || syncingLocal) return 0;
    if (auto && lsGet('diwanNeedsPush') !== '1' && lsGet('diwanPushedOnce') === sessionStorage.getItem('diwanSess')) return 0;
    syncingLocal = true; let n = 0;
    try {
        try { n += await pushLocalInvoices(); } catch (e) { /* القواعد */ }
        try {
            const snap = await db.collection('pharmacy_purchases').limit(1000).get(); const have = new Map(); snap.forEach(d => have.set(d.id, d.data()));
            for (const r of puLocalList()) { const c = have.get(r.id); if (!c || (!!r.cancelled && !c.cancelled) || String(r.editedAt || '') > String(c.editedAt || '') || (r.payments || []).length > (c.payments || []).length) { await fsSet(db.collection('pharmacy_purchases').doc(r.id), JSON.parse(JSON.stringify(r))); n++; } }
            const ss = await db.collection('pharmacy_suppliers').limit(500).get(); const sh = new Set(); ss.forEach(d => sh.add(d.id));
            let sup = []; try { sup = JSON.parse(lsGet(PU_LS.sup)) || []; } catch (e) { sup = []; }
            for (const s of sup) if (!sh.has(s.id)) { await fsSet(db.collection('pharmacy_suppliers').doc(s.id), s); n++; }
        } catch (e) { /* القواعد */ }
        try { if (typeof lgSyncLocal === 'function') n += await lgSyncLocal(); } catch (e) { /* القواعد */ }
        lsSet('diwanNeedsPush', '0');
        try { sessionStorage.setItem('diwanSess', sessionStorage.getItem('diwanSess') || String(Date.now())); lsSet('diwanPushedOnce', sessionStorage.getItem('diwanSess')); } catch (e) { /* تجاهل */ }
    } finally { syncingLocal = false; }
    return n;
}

// ---------- تحديث المواد من سجل الوارد (للفواتير المسجّلة سابقاً) ----------
async function puBackfill() {
    await puLoad();
    const best = new Map();   // آخر سطر لكل مادة
    const now = new Date().toISOString().slice(0, 7), yearAgo = new Date(Date.now() - puWindowMonths() * 30.4375 * 864e5).toISOString().slice(0, 10);
    const exps = new Map();   // تواريخ نفاذ حديثة وغير منتهية
    puAll.filter(r => !r.cancelled && !puIsBonusOnly(r)).forEach(r => (r.items || []).forEach(l => {
        const k = l.pid, cur = best.get(k);
        if (!cur || String(r.date).localeCompare(cur.r.date) > 0 || (r.date === cur.r.date && String(r.createdTs).localeCompare(String(cur.r.createdTs)) > 0)) best.set(k, { r, l });
        if (l.expiry && l.expiry >= now && String(r.date) >= yearAgo) { if (!exps.has(k)) exps.set(k, new Set()); exps.get(k).add(l.expiry); }
    }));
    const snaps = [], plan = [];
    best.forEach(({ r, l }, pid) => {
        const p = products.find(x => x.id === pid); if (!p) return;
        const s = { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase };
        let ch = [];
        const lp = { supplier: r.supplier, no: r.no, date: r.date, qty: l.qty, cost: l.cost, batch: l.batch || '', expiry: l.expiry || '' };
        if (JSON.stringify(p.lastPurchase || null) !== JSON.stringify(lp)) { p.lastPurchase = lp; ch.push('آخر مذخر'); }
        if (l.cost > 0 && puNum(p.costPrice) !== l.cost) { p.costPrice = l.cost; ch.push('سعر الشراء'); }
        let added = false; (exps.get(pid) || []).forEach(e => { if (puExpiryPush(p, e)) added = true; });
        if (added) ch.push('تاريخ النفاذ');
        if (ch.length) plan.push({ p, s, ch });
    });
    if (!plan.length) return Swal.fire({ icon: 'success', title: 'كل المواد محدّثة', text: 'لا يوجد ما يحتاج تحديثاً من سجل الوارد.', confirmButtonColor: '#0f1c38' });
    const res = await Swal.fire({ icon: 'question', title: 'تحديث ' + plan.length + ' مادة من سجل الوارد؟', html: '<div style="text-align:right;max-height:240px;overflow:auto;font-size:.85rem">' + plan.slice(0, 40).map(x => '• <b dir="ltr">' + escapeHtml(x.p.name) + '</b>: ' + x.ch.join('، ')).join('<br>') + (plan.length > 40 ? '<br>...' : '') + '<br><small style="color:#64748b">النفاذ: تُضاف فقط التواريخ غير المنتهية من وارد آخر ' + puWindowMonths() + ' شهراً (يمكن تغييرها من الإعدادات). الكميات لا تتغير.</small></div>', showCancelButton: true, confirmButtonText: 'تحديث', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
    if (!res.isConfirmed) { plan.forEach(x => Object.assign(x.p, x.s)); return; }
    const ok = await saveProductsDelta(plan.map(x => deltaFromSnap(x.p, x.s)));
    if (!ok) { plan.forEach(x => Object.assign(x.p, x.s)); renderAll(); return; }
    renderAll();
    Swal.fire({ icon: 'success', title: 'حُدّثت ' + plan.length + ' مادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2500 });
}

function puWindowMonths() { try { const n = parseInt(localStorage.getItem('diwanPuWindow')); return n >= 1 && n <= 60 ? n : 12; } catch (e) { return 12; } }
function savePuWindow() {
    const n = parseInt(document.getElementById('puWindowInput').value);
    if (!(n >= 1 && n <= 60)) { Swal.fire({ icon: 'warning', title: 'أدخل عدد أشهر بين 1 و 60', confirmButtonColor: '#0f1c38' }); return; }
    try { localStorage.setItem('diwanPuWindow', String(n)); } catch (e) { /* تجاهل */ }
    Swal.fire({ icon: 'success', title: 'تم الحفظ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1500 });
}

// حذف مذخر: إن لم يكن له أي سجل يُحذف نهائياً، وإن كان له سجل يُغلق (يُخفى من الاقتراحات ويبقى تاريخه سليماً)
async function puDeleteSupplier(name) {
    const k = puKey(name), rec = puSuppliers.find(s => puKey(s.name) === k);
    const used = puAll.filter(r => puKey(r.supplier) === k).length + (typeof lgAll !== 'undefined' ? lgAll.filter(e => puKey(e.supplier) === k).length : 0);
    if (used) {
        const c = await Swal.fire({ icon: 'question', title: 'إغلاق المذخر «' + escapeHtml(name) + '»؟', html: 'له ' + used + ' سجل (وارد/مردود/تسديد)، لذلك لا يُحذف حتى لا يضيع تاريخه وحساباته.<br>سيُغلق: يختفي من اقتراحات الوارد الجديد ويبقى في السجلات.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'إغلاق المذخر', cancelButtonText: 'إلغاء' });
        if (!c.isConfirmed) return;
        await puSaveSupplierRec({ ...(rec || { id: 's' + Date.now(), name, phone: '' }), closed: true });
    } else {
        const c = await Swal.fire({ icon: 'warning', title: 'حذف المذخر «' + escapeHtml(name) + '» نهائياً؟', text: 'لا توجد له أي سجلات.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
        if (!c.isConfirmed) return;
        if (rec) {
            try { if (cloudReady()) await fsWrite(db.collection('pharmacy_suppliers').doc(rec.id).delete()); }
            catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحذف من السحابة', text: e.message || String(e), confirmButtonColor: '#0f1c38' }); return; }
            puSuppliers = puSuppliers.filter(x => x.id !== rec.id); lsSet(PU_LS.sup, JSON.stringify(puSuppliers));
        }
    }
    puFillSupplierList(); renderPuSuppliers();
}


// ---------- تحديد قوائم وارد للطباعة / Excel ----------
let puSelMode = false, puLogShown = []; const puSel = new Set();
function puSelRecs() { return puAll.filter(r => puSel.has(r.id)).sort((a, b) => puMonthOf(a).localeCompare(puMonthOf(b)) || puSeqCmp(a, b)); }
function puSelBarRender() {
    const bar = $b('puSelBar'); if (!bar) return;
    if (!puSelMode) { bar.innerHTML = '<button type="button" class="bill-tb-btn" onclick="puSelStart()">☑️ تحديد قوائم للطباعة أو Excel</button>'; return; }
    const recs = puSelRecs(), net = recs.reduce((s, r) => s + (r.cancelled ? 0 : puNetOf(r)), 0), none = !recs.length;
    bar.innerHTML = `<div class="psb-info"><b>${fmtNum(recs.length)}</b> قائمة محددة${recs.length ? ` · الصافي <b>${fmtNum(net)}</b> د.ع` : ''}</div>
        <div class="psb-grid"><button type="button" class="bill-tb-btn" onclick="puSelAllShown()">☑️ تحديد المعروض (${fmtNum(puLogShown.length)})</button>
        <button type="button" class="bill-tb-btn" onclick="puSelClear()" ${none ? 'disabled' : ''}>🧹 مسح التحديد</button>
        <button type="button" class="bill-tb-btn" onclick="puSelOut('csv')" ${none ? 'disabled' : ''}>⬇️ Excel</button>
        <button type="button" class="bill-tb-btn bill-tb-primary" onclick="puSelOut('print')" ${none ? 'disabled' : ''}>🖨️ طباعة</button></div>
        <button type="button" class="psb-end" onclick="puSelEnd()">✕ إنهاء التحديد</button>`;
}
function puSelStart() { puSelMode = true; renderPuLog(); }
function puSelEnd() { puSelMode = false; puSel.clear(); renderPuLog(); }
function puSelClear() { puSel.clear(); renderPuLog(); }
function puSelAllShown() { puLogShown.forEach(id => puSel.add(id)); renderPuLog(); }
function puSelToggle(id, ev) { if (ev) ev.stopPropagation(); if (puSel.has(id)) puSel.delete(id); else puSel.add(id); renderPuLog(); }
async function puSelOut(kind) {
    const recs = puSelRecs(); if (!recs.length) return;
    const r = await Swal.fire({ title: kind === 'csv' ? 'شكل جدول Excel' : 'شكل الطباعة', html: `<div class="sw-form"><div class="sw-info"><b>${fmtNum(recs.length)}</b> قائمة محددة. اختر شكل الجدول:</div></div>`, showCancelButton: true, showDenyButton: true, confirmButtonText: '📄 سطر لكل قائمة', denyButtonText: '📋 سطر لكل مادة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', denyButtonColor: '#0f766e' });
    if (!r.isConfirmed && !r.isDenied) return;
    const mode = r.isConfirmed ? 'lists' : 'items', tbl = puSelTable(recs, mode);
    if (kind === 'csv') { lgCsvDownload('orders-selected-' + mode + '-' + todayLocalISO() + '.csv', [[tbl.title], [], tbl.head, ...tbl.rows, tbl.foot]); return; }
    const esc = escapeHtml, td = (v, i) => `<td${i >= tbl.numFrom ? ' class="num"' : ''}>${esc(v)}</td>`;
    $b('puSelSheet').innerHTML = `<h2 class="psp-t">${esc(tbl.title)}</h2><div class="psp-d">${esc(fmtDateDMY(todayLocalISO()))} · ${fmtNum(recs.length)} قائمة</div>
        <table class="bill-table psp-tb"><thead><tr>${tbl.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tbl.rows.map(row => `<tr>${row.map(td).join('')}</tr>`).join('')}</tbody><tfoot><tr>${tbl.foot.map((v, i) => `<th${i >= tbl.numFrom ? ' class="num"' : ''}>${esc(v)}</th>`).join('')}</tr></tfoot></table>`;
    puPrint('puPane-sel');
}
function puSelTable(recs, mode) {
    const n = v => puNum(v), f = v => (v === '' || v == null) ? '' : fmtNum(v);
    if (mode === 'lists') {
        let tot = 0, ret = 0, net = 0, paid = 0, rem = 0;
        const rows = recs.map((r, i) => {
            const t = puTotalOf(r), nt = puNetOf(r), rt = t - nt, pd = n(r.paid), rm = puRemaining(r);
            if (!r.cancelled) { tot += t; ret += rt; net += nt; paid += pd; rem += rm; }
            return [r.seq || i + 1, r.supplier, r.no, fmtDateDMY(r.date), (r.items || []).length, f(t), f(rt), f(nt), f(pd), f(rm), (r.cancelled ? 'ملغى' : '') + (r.stmt ? (r.cancelled ? ' · ' : '') + 'كشف ✓' : '')];
        });
        return { title: 'قوائم الوارد المحددة', head: ['ت', 'المذخر', 'رقم القائمة', 'التاريخ', 'المواد', 'المبلغ', 'المردود', 'الصافي', 'المدفوع', 'المتبقي', 'ملاحظة'], rows, foot: ['', 'المجموع (غير الملغاة)', '', '', '', f(tot), f(ret), f(net), f(paid), f(rem), ''], numFrom: 4 };
    }
    let all = 0, k = 0; const rows = [];
    recs.forEach(r => (r.items || []).forEach(it => { const t = n(it.qty) * n(it.cost); k++; if (!r.cancelled) all += t; rows.push([k, r.supplier, r.no, fmtDateDMY(r.date), it.name, f(n(it.qty)), it.bonus ? f(n(it.bonus)) : '', f(n(it.cost)), f(t), it.expiry || '', it.batch || '']); }));
    return { title: 'تفصيل مواد قوائم الوارد المحددة', head: ['ت', 'المذخر', 'رقم القائمة', 'التاريخ', 'المادة', 'العدد', 'بونص', 'السعر', 'المجموع', 'الانتهاء', 'الدفعة'], rows, foot: ['', 'المجموع (غير الملغاة)', '', '', '', '', '', '', f(all), '', ''], numFrom: 5 };
}
