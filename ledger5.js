// =====================================================================
// سجل طلبات البونص (ما طُلب من المذاخر/المندوبين ولم يُستلم بعد) + تسلسل الأسطر القابل للتعديل
// kind: breq في pharmacy_ledger. يعتمد على ledger.js و purchase.js
// =====================================================================
// بونص مستلم خارج فواتير الوارد (هدايا المندوبين والعروض): يُعرض داخل «سجل البونص»، ولا يحتاج تأكيد استلام
const lgBreqs = () => lgAll.filter(e => e.kind === 'breq' && !e.del);
function lgBreqRefresh() { if (typeof lgRenderBonus === 'function' && $b('lgb-list')) lgRenderBonus(); }
// ---- ربط البونص بالمخزن: الكمية تدخل المخزن (كلفة صفر) ما لم تكن المادة غير مجرودة (وضع التأسيس) أو اختير «سجل فقط» ----
const lgbProd = name => { const k = puKey(name || ''); return k ? products.find(x => puKey(x.name) === k) : null; };
function lgbStockDelta(p, dq, exp, addExp) {   // يطبّق التغيير على المخزن ويحفظه؛ يرجع true عند النجاح
    const s = { p, qty: p.qty, loose: p.loose, expiryDates: getProductExpiryDates(p).slice(), expiryDate: p.expiryDate, costPrice: p.costPrice, lastPurchase: p.lastPurchase };
    p.qty = Math.max((parseInt(p.qty) || 0) + dq, 0);
    let added = false;
    if (addExp && exp) added = puExpiryPush(p, exp);
    else if (!addExp && exp) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== exp); p.expiryDate = p.expiryDates[0] || ''; }
    return { s, added, undo: () => { p.qty = s.qty; p.expiryDates = s.expiryDates; p.expiryDate = s.expiryDate; } };
}
async function lgBreqStockRevert(e) {   // يعكس أثر بونص سابق على المخزن (عند الحذف أو التعديل)
    if (!e || !e.applied || !e.pid) return true;
    const p = products.find(x => x.id === e.pid); if (!p) return true;
    const r = lgbStockDelta(p, -(parseInt(e.qty) || 0), e.expAdded ? e.expiry : '', false);
    if (!(await saveProductsDelta([deltaFromSnap(p, r.s)]))) { r.undo(); return false; }
    try { logAction('qty', p, [{ f: 'الكمية (عكس بونص ' + (e.supplier || e.rep || '') + ')', from: String(r.s.qty), to: String(p.qty) }]); } catch (x) { /* تجاهل */ }
    renderAll(); return true;
}
async function lgBreqDel(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const rev = e.applied && e.pid;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا البونص؟', text: e.name + (rev ? ' — ستُنقص كميته (' + fmtNum(e.qty) + ') من المخزن.' : ''), showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    if (rev && !(await lgBreqStockRevert(e))) return;
    e.del = true; await lgSave(e); lgBreqRefresh();
}
async function lgBreqDelImported() {   // حذف طلبات البونص القديمة المستوردة من الإكسل (لا يمسّ ما أُدخل يدوياً)
    const L = lgAll.filter(e => e.kind === 'breq' && e.imp);
    if (!L.length) { Swal.fire({ icon: 'info', title: 'لا توجد طلبات مستوردة', timer: 1800, showConfirmButton: false }); return; }
    const r = await Swal.fire({ icon: 'warning', title: `حذف ${L.length} طلب بونص مستورد؟`, text: 'هذه طلبات قديمة من الإكسل ولم يثبت استلامها. لن يُحذف أي بونص أُدخل يدوياً أو من الفواتير.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    try {
        if (cloudReady()) for (let i = 0; i < L.length; i += 20) await Promise.all(L.slice(i, i + 20).map(e => fsWrite(db.collection('pharmacy_ledger').doc(String(e.id)).delete())));
        const ids = new Set(L.map(e => e.id)); lgAll = lgAll.filter(e => !ids.has(e.id)); lsSet(LG_LS.list, JSON.stringify(lgAll));
        lgBreqRefresh(); Swal.fire({ icon: 'success', title: `تم حذف ${L.length} طلب`, timer: 1800, showConfirmButton: false });
    } catch (err) { Swal.fire({ icon: 'error', title: 'تعذّر الحذف', text: String(err && err.message || err) }); }
}
function lgbScan() {   // مسح باركود المادة داخل نموذج البونص (نفس طريقة الوارد)
    openBarcodeScanner((code, gs1) => {
        gs1 = gs1 || parseGS1(code); code = gs1 ? gs1.gtin : cleanBarcode(code);
        const p = findByBarcode(code), n = document.getElementById('swQKn'), N = document.getElementById('swQN'); if (!N) return;
        if (!p) { if (n) n.textContent = 'باركود غير مسجّل بالمخزن (' + code + ') — أضف المادة للمخزن أولاً أو اكتب اسمها.'; return; }
        N.value = p.name;
        const X = document.getElementById('swQX'); if (X && gs1 && gs1.exp && !X.value) X.value = gs1.exp;
        if (typeof window.lgbPick === 'function') window.lgbPick();
    });
}
async function lgBreqAdd(eid) {
    const ed = eid ? lgAll.find(x => x.id === eid) : null, v = k => escapeHtml(String(ed && ed[k] != null ? ed[k] : '')).replace(/"/g, '&quot;');
    const inp = (id, label, extra) => `<label style="display:block;text-align:right;font-size:.8rem;font-weight:800;margin-top:6px">${label}<input id="${id}" class="swal2-input" style="margin:4px 0 0;width:100%" ${extra || ''}></label>`;
    const names = [...new Set(products.map(p => p.name))].sort((a, b) => String(a).localeCompare(String(b)));
    const wasApplied = !!(ed && ed.applied);
    const r = await Swal.fire({ title: ed ? 'تعديل البونص' : 'إضافة بونص مستلم (هدية مندوب / عرض)', showCancelButton: true, showDenyButton: !!ed, denyButtonText: 'حذف', denyButtonColor: '#b91c1c', confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<datalist id="lgbNames">${names.map(n => `<option value="${escapeHtml(n).replace(/"/g, '&quot;')}">`).join('')}</datalist>` + `<div style="display:flex;gap:8px;align-items:flex-end">` + `<div style="flex:1;min-width:0">${inp('swQN', 'المادة', `dir="ltr" list="lgbNames" autocomplete="off" value="${v('name')}" oninput="lgbPick()"`)}</div><button type="button" class="bill-tb-btn bill-scan" onclick="lgbScan()" aria-label="مسح باركود" style="margin-bottom:2px">▦ باركود</button></div>` + inp('swQC', 'الشركة', `dir="ltr" value="${v('company')}"`) + inp('swQQ', 'الكمية', `type="number" inputmode="numeric" value="${v('qty')}"`) + inp('swQX', 'تاريخ الانتهاء (اختياري)', `type="month" value="${ed && ed.expiry ? v('expiry') : ''}"`)
            + `<label id="swQKw" class="pu-chk" style="margin-top:10px"><input id="swQK" type="checkbox" ${(!ed || ed.stockAdd === true) ? 'checked' : ''}><span>إضافة الكمية إلى المخزن</span></label><small id="swQKn" style="display:block;text-align:right;color:#64748b;margin-top:4px;line-height:1.6"></small>`
            + inp('swQS', 'المذخر', `list="puSupList" value="${v('supplier')}"`) + inp('swQL', 'رقم القائمة', `dir="ltr" value="${v('listNo')}"`) + inp('swQD', 'التاريخ', `type="date" value="${ed ? v('date') : todayLocalISO()}"`) + inp('swQR', 'المندوب', `value="${v('rep')}"`),
        didOpen: () => { window.__lgbHad = false; window.lgbPick = () => { const p = lgbProd(document.getElementById('swQN').value), c = document.getElementById('swQC'), n = document.getElementById('swQKn'), k = document.getElementById('swQK');
            if (p && !c.value.trim() && p.brand) c.value = p.brand;
            k.disabled = !p; if (!p) k.checked = false; else if (!window.__lgbHad && (!ed || ed.stockAdd === true)) k.checked = true;
            window.__lgbHad = !!p;
            n.textContent = !p ? 'المادة غير موجودة بالمخزن — ستُسجَّل في السجل فقط. أضفها للمخزن أولاً إن أردت إدخال كميتها.' : (setupSkip(p) ? 'هذه المادة لم تُجرد بعد (وضع التأسيس): تُسجَّل مؤجَّلة ولا تتغير كميتها الآن.' : 'الكمية الحالية: ' + fmtNum(parseInt(p.qty) || 0)); };
            if (!ed || !ed.pid) lgbPick(); else { const k = document.getElementById('swQK'); document.getElementById('swQKn').textContent = ed.applied ? 'الكمية مضافة للمخزن. التعديل سيعدّلها بالمقابل.' : (ed.setupSkip ? 'مؤجَّل (وضع التأسيس).' : ''); if (!lgbProd(ed.name)) { k.disabled = true; } } },
        preConfirm: () => { const g = id => (document.getElementById(id).value || '').trim(); if (!g('swQN')) { Swal.showValidationMessage('اكتب اسم المادة'); return false; } return { name: g('swQN'), company: g('swQC'), qty: parseInt(g('swQQ')) || 0, expiry: g('swQX'), supplier: g('swQS'), listNo: g('swQL'), date: g('swQD'), rep: g('swQR'), received: '', stockAdd: document.getElementById('swQK').checked }; } });
    if (r.isDenied && ed) { await lgBreqDel(ed.id); return; }
    if (!r.isConfirmed || !r.value) return;
    const val = r.value, p = lgbProd(val.name);
    const want = !!(val.stockAdd && p && val.qty > 0);
    if (ed && wasApplied && !(await lgBreqStockRevert(ed))) return;   // نعكس القديم ثم نطبّق الجديد
    const rec = ed || { id: lgId(), kind: 'breq', createdTs: new Date().toISOString() };
    Object.assign(rec, val, { received: ed ? (ed.received || '') : '' });
    delete rec.applied; delete rec.setupSkip; delete rec.pid; delete rec.expAdded;
    if (p) rec.pid = p.id;
    if (want) {
        if (setupSkip(p)) { rec.applied = false; rec.setupSkip = true; }
        else {
            const x = lgbStockDelta(p, val.qty, val.expiry, true);
            if (!(await saveProductsDelta([deltaFromSnap(p, x.s)]))) { x.undo(); return; }
            rec.applied = true; rec.expAdded = !!x.added;
            try { logAction('qty', p, [{ f: 'الكمية (بونص ' + (val.supplier || (val.rep ? 'مندوب ' + val.rep : '')) + ')', from: String(x.s.qty), to: String(p.qty) }]); } catch (e) { /* تجاهل */ }
            renderAll();
        }
    }
    await lgSave(rec);
    lgBreqRefresh();
}

// =====================================================================
// تسلسل الأسطر القابل للتعديل: اضغط على رقم السطر (#) واكتب الرقم الذي تريده فينتقل إليه
// يُحفظ كحقل ord في السجل نفسه، ويطبَّق على الكشف الشهري وسجلات المردود والتسديد والبونص والمناقلة والمنتهي
// =====================================================================
function lgSeqRec(kind, id) { return kind === 'pu' ? puAll.find(x => x.id === id) : lgAll.find(x => x.id === id); }
async function lgSeqSave(kind, rec) { if (kind === 'pu') await puSaveRecord(rec); else await lgSave(rec); }
// مقارِن: من له رقم تسلسل مخصَّص (ord_<ctx>) يأتي أولاً بحسب رقمه، ثم الباقي بترتيبهم الأصلي
const lgOrdCmp = (ctx, get) => (a, b) => { const x = get(a), y = get(b), f = 'ord_' + ctx, oa = !!x && x[f] != null, ob = !!y && y[f] != null; if (oa && ob) return x[f] - y[f]; if (oa !== ob) return oa ? -1 : 1; return 0; };
async function lgSeqMove(ctx, from) {
    const list = (window.lgSeqCtx || {})[ctx]; if (!list || !list.length) return;
    const r = await Swal.fire({ title: 'تغيير تسلسل السطر', text: 'الرقم الحالي ' + from + ' من ' + list.length, input: 'number', inputValue: from, inputAttributes: { min: 1, max: list.length, step: 1 }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'انقل', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    let to = Math.round(parseFloat(r.value)); if (!(to >= 1)) return; if (to > list.length) to = list.length; if (to === from) return;
    const order = list.slice(); const [m] = order.splice(from - 1, 1); order.splice(to - 1, 0, m);
    const f = 'ord_' + ctx, changed = [];
    order.forEach((x, i) => { const rec = lgSeqRec(x.kind, x.id); if (rec && rec[f] !== i + 1) { rec[f] = i + 1; changed.push([x.kind, rec]); } });
    for (const [k, rec] of changed) await lgSeqSave(k, rec);
    Swal.fire({ icon: 'success', title: 'تم تغيير التسلسل', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
    lgSeqRefresh();
}
function lgSeqRefresh() {
    try { if (typeof renderPuMonth === 'function' && $b('puMonthSup')) renderPuMonth(); } catch (e) { /* تجاهل */ }
    [['lgRenderRet', 'ret'], ['lgRenderRet', 'unrec']].forEach(([n, a]) => { try { if (typeof window[n] === 'function') window[n](a); } catch (e) { /* تجاهل */ } });
    ['lgPayRender', 'lgRenderXfer'].forEach(n => { try { if (typeof window[n] === 'function') window[n](); } catch (e) { /* تجاهل */ } });
}
// يُستدعى من الجداول: يسجّل ترتيب الأسطر المعروضة ويعيد خلية الرقم القابلة للضغط
function lgSeqSet(ctx, items) { window.lgSeqCtx = window.lgSeqCtx || {}; window.lgSeqCtx[ctx] = items; }
const lgSeqCell = (ctx, i) => `<td class="pu-n pu-seq" onclick="lgSeqMove('${ctx}',${i})" title="اضغط لتغيير التسلسل">${i}</td>`;
