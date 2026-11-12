// =====================================================================
// شاشة البيع السريعة (تجريبية، مستقلة): شاشة واحدة بلا خطوات — مسح/بحث، أزرار + و −، علبة/تجزئة،
// أقرب دفعة انتهاءً تلقائياً مع تغيير يدوي، وإصدار بزر واحد. تعمل على نفس كائن الفاتورة (bill) ونفس دوال الإصدار والخصم من المخزن.
// =====================================================================
let posOpenFlag = false, posFound = [], posDone = false, posExtraOpen = false;
const posEsc = s => escapeHtml(String(s == null ? '' : s));

function posBeep(ok) {
    try {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const c = posBeep.c || (posBeep.c = new C()), o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = ok ? 1100 : 300; g.gain.value = 0.08; o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + (ok ? 0.07 : 0.22));
        if (navigator.vibrate) navigator.vibrate(ok ? 25 : [60, 40, 60]);
    } catch (e) { /* تجاهل */ }
}
const posUnitOf = it => (it.unit === 'part' && it.pid && hasRetail(products.find(x => x.id === it.pid) || {}) ? 'part' : 'pack');
const posKeyOf = (it, i) => it.pid ? it.pid + '|' + posUnitOf(it) : 'm' + i;
function posGroups() {
    const g = new Map();
    (bill.items || []).forEach((it, i) => { const k = posKeyOf(it, i); if (!g.has(k)) g.set(k, { key: k, pid: it.pid || 0, unit: posUnitOf(it), lines: [] }); g.get(k).lines.push(it); });
    return [...g.values()];
}
function posFmtExp(e) { const m = /^(\d{4})-(\d{2})/.exec(e || ''); return m ? m[2] + '/' + m[1] : (e || ''); }
function posExpTag(e) {
    if (!e) return { t: 'بدون تاريخ', c: 'nd' };
    const d = typeof expiryDaysOf === 'function' ? expiryDaysOf(e) : null;
    if (d !== null && d <= 0) return { t: posFmtExp(e) + ' · منتهية', c: 'bad' };
    if (d !== null && d <= 90) return { t: posFmtExp(e) + ' · قريبة الانتهاء', c: 'warn' };
    return { t: posFmtExp(e), c: 'ok' };
}
function posNearestExp(p) {
    try {
        const sc = btSc(p), l = getBatches(p).filter(b => (b.u !== undefined ? b.u : (b.q * sc + (b.l || 0))) > 0 && b.e && !billExpired(b.e)).map(b => b.e).sort();
        return l[0] || '';
    } catch (e) { return ''; }
}

// ---------- إضافة وتعديل الكمية ----------
function posAdd(pid, unit, n) {
    const p = products.find(x => x.id === pid); if (!p) return false;
    unit = sellLocked(p) ? sellDefUnit(p) : (unit === 'part' && hasRetail(p) ? 'part' : 'pack'); n = n || 1;
    const defPrice = unit === 'part' ? subPriceOf(p) : (parseFloat(p.price) || 0);
    const mine = bill.items.filter(it => it.pid === pid && posUnitOf(it) === unit), last = mine[mine.length - 1];
    const sim = spSim(p, unit, false);
    const out = billAllocate(sim, p, unit, n, last && last.exp, last && last.bpr);
    const needPrice = out.some(r => !(r.pr > 0)) && !(defPrice > 0);
    if (needPrice) { spOpen(pid, { scan: true }); return false; }   // مادة بلا سعر: النافذة الحالية تفرض كتابة السعر
    let over = 0;
    out.forEach(l => {
        const price = l.pr > 0 ? (unit === 'part' ? (subPriceCalc(l.pr, btSc(p)) || 0) : l.pr) : defPrice;
        if (l.over) over += l.n;
        const ex = bill.items.find(it => it.pid === pid && posUnitOf(it) === unit && (it.exp || '') === (l.e || '') && (it.bpr || 0) === (l.pr || 0));
        if (ex) { ex.qty = (parseFloat(ex.qty) || 0) + l.n; ex.price = price; }
        else bill.items.push({ pid, name: dispName(p, unit === 'part'), qty: l.n, price, unit, partType: unit === 'part' ? subTypeOf(p) : '', ...(l.e ? { exp: l.e } : {}), ...(l.pr ? { bpr: l.pr } : {}) });
    });
    if (over) Swal.fire({ icon: 'warning', title: 'المطلوب أكبر من المتوفر بـ ' + over, toast: true, position: 'top', showConfirmButton: false, timer: 2200 });
    return true;
}
function posGroup(key) { return posGroups().find(g => g.key === key); }
function posTotalQty(g) { return g.lines.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0); }
function posReduce(g, by) {   // إنقاص من آخر دفعة (الأبعد انتهاءً) أولاً
    for (let i = g.lines.length - 1; i >= 0 && by > 0; i--) {
        const it = g.lines[i], q = parseFloat(it.qty) || 0, t = Math.min(q, by);
        it.qty = q - t; by -= t;
        if (it.qty <= 0) bill.items.splice(bill.items.indexOf(it), 1);
    }
}
function posDone_() { billChanged(); posRender(); }
function posQtyStep(key, d) {
    const g = posGroup(key); if (!g) return;
    if (!g.pid) { const it = g.lines[0]; it.qty = Math.max(1, (parseFloat(it.qty) || 0) + d); return posDone_(); }
    const tot = posTotalQty(g);
    if (d > 0) { if (!posAdd(g.pid, g.unit, d)) return; }
    else if (tot > 1) posReduce(g, 1);
    posDone_();
}
function posQtySet(key, v) {
    const g = posGroup(key); if (!g) return;
    const t = Math.max(1, parseInt(v) || 1), tot = posTotalQty(g);
    if (!g.pid) { g.lines[0].qty = t; return posDone_(); }
    if (t > tot) { if (!posAdd(g.pid, g.unit, t - tot)) return; } else if (t < tot) posReduce(g, tot - t);
    posDone_();
}
async function posDel(key) {
    const g = posGroup(key); if (!g) return;
    if (!(await askSure('حذف هذه المادة من الفاتورة؟', g.lines[0].name || '', 'حذف'))) return;
    bill.items = bill.items.filter(it => !g.lines.includes(it)); posDone_();
}
function posSetUnit(key, to) {
    const g = posGroup(key); if (!g || !g.pid || g.unit === to) return;
    { const pp = products.find(x => x.id === g.pid); if (pp && sellLocked(pp)) return; }
    bill.items = bill.items.filter(it => !g.lines.includes(it));
    if (!posAdd(g.pid, to, 1)) { bill.items.push(...g.lines); }   // فشلت الإضافة (بلا سعر): نُبقي كما كانت
    posDone_();
}
function posBatch(key) { const g = posGroup(key); if (g && g.pid) spOpen(g.pid, { edit: true }); }   // تغيير الدفعة/السعر يدوياً

// ---------- البحث والمسح ----------
function posAddProduct(pid) {
    const ok = posAdd(pid, sellDefUnit(products.find(x => x.id === pid)), 1);
    const q = document.getElementById('posQ'); if (q) { q.value = ''; }
    posFound = []; posResults();
    if (ok) { posBeep(true); posDone_(); }
    posFocus();
}
function posFocus() { const q = document.getElementById('posQ'); if (q && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) q.focus(); }
function posSearchInput() {
    const q = document.getElementById('posQ').value, qn = normSearch(q);
    if (!qn) { posFound = []; return posResults(); }
    const toks = qn.split(' ');
    posFound = products.filter(p => !p.arch).map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    posResults(true);
}
function posResults(show) {
    const box = document.getElementById('posRes'); if (!box) return;
    if (!show || !posFound.length) {
        const q = document.getElementById('posQ');
        box.innerHTML = show && q && q.value.trim() ? '<div class="pos-none">لا توجد نتائج</div>' : '';
        box.style.display = box.innerHTML ? 'block' : 'none'; return;
    }
    box.innerHTML = posFound.map(p => {
        const ne = posNearestExp(p), inS = isInStock(p);
        return `<button type="button" class="pos-res" onclick="posAddProduct(${p.id})"><span class="pos-rn" dir="ltr">${dispNameHtml(p)}</span><span class="pos-rm"><b>${p.price ? fmtNum(p.price) + ' د.ع' : 'بلا سعر'}</b><em class="${inS ? '' : 'bad'}">${inS ? 'المتوفر ' + posEsc(stockLabel(p)) : 'غير متوفر'}</em>${ne ? `<em>ينتهي ${posFmtExp(ne)}</em>` : ''}</span></button>`;
    }).join('');
    box.style.display = 'block';
}
function posByCode(code) {
    const p = findByBarcode(code);
    if (p) { posAddProduct(p.id); return true; }
    posBeep(false);
    offerUnknownBarcode(code, p2 => { posAddProduct(p2.id); });
    return false;
}
function posEnter() {
    const raw = document.getElementById('posQ').value.trim(), code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code) && /^[0-9A-Za-z\-]+$/.test(raw)) {
        const p = findByBarcode(code);
        if (p) return posAddProduct(p.id);
        if (/^\d{6,}$/.test(code)) return posByCode(code);
    }
    if (posFound.length) posAddProduct(posFound[0].id);
}
function posScan() {   // كاميرا: تستمر بعد كل قراءة لحين الإغلاق
    const cb = code => { if (!posOpenFlag) return; posByCode(code); setTimeout(() => { if (posOpenFlag && !document.querySelector('.swal2-container')) posScan(); }, 350); };
    openBarcodeScanner(cb);
}

// ---------- جرد المادة عند أول بيع (خيار في الإعدادات، متوقف افتراضياً) ----------
function posCountSet(v) { try { const c = scCfg(); c.posCount = !!v; scSave(c); } catch (e) { /* تجاهل */ } }
function posNeedsCount(p) { try { return !!p && scCfg().posCount && setupSkip(p) && posStockCan(); } catch (e) { return false; } }
// ---------- مخزن المادة: عرض صغير على البطاقة + نافذة تعديل (علب/أجزاء/دفعات) ----------
function posStockCan() { return userRole === 'owner' || can('stockEdit') || can('invList'); }
function posStockShow() { return userRole === 'owner' || can('stockView') || can('stockEdit') || can('invList'); }
function posStockLine(p) {
    if (!p || !posStockShow()) return '';
    const cls = posStockCan() ? ' on' : '';
    return `<div class="pos-stk${cls}"${posStockCan() ? ` onclick="posStockOpen(${p.id})"` : ''}>📦 بالمخزن: <b>${posEsc(stockLabel(p))}</b>${setupSkip(p) ? ' <em>(غير مجرودة)</em>' : ''}${posStockCan() ? ' ✎' : ''}</div>`;
}
let posStk = null;
function posStkTotals() {
    const p = posStk.p, sc = btSc(p), retail = hasRetail(p);
    if (!posStk.rows.length) return { q: Math.max(0, parseInt(posStk.q) || 0), l: retail ? Math.max(0, parseInt(posStk.l) || 0) : 0 };
    const u = posStk.rows.reduce((a, b) => a + (parseInt(b.q) || 0) * sc + (retail ? (parseInt(b.l) || 0) : 0), 0);
    return { q: Math.floor(u / sc), l: retail && sc > 1 ? u % sc : 0 };
}
function posStkHtml() {
    const p = posStk.p, retail = hasRetail(p), sc = btSc(p), has = posStk.rows.length > 0, t = posStkTotals();
    return `<div class="px"><div class="px-sum"><b dir="ltr" style="font-size:1rem">${posEsc(p.name)}</b></div>
        <div class="px-row"><label><span>عدد العلب${has ? ' (من الدفعات)' : ''}</span><input id="psQ" type="number" inputmode="numeric" min="0" value="${t.q}" ${has ? 'readonly' : ''} oninput="posStk.q=this.value"></label>
        ${retail ? `<label><span>عدد الأجزاء (${posEsc(subTypeOf(p))})</span><input id="psL" type="number" inputmode="numeric" min="0" max="${sc - 1}" value="${t.l}" ${has ? 'readonly' : ''} oninput="posStk.l=this.value"></label>` : ''}</div>
        <div class="ps-bt"><div class="ps-bh"><b>📅 الدفعات وتواريخ الانتهاء</b><button type="button" onclick="posStkAdd()">＋ دفعة</button></div>
        ${posStk.rows.map((b, i) => `<div class="ps-br"><input type="month" dir="ltr" value="${posEsc(b.e || '')}" onchange="posStkSet(${i},'e',this.value)" aria-label="تاريخ الانتهاء">
            <input type="number" inputmode="numeric" min="0" value="${b.q || 0}" onchange="posStkSet(${i},'q',this.value)" aria-label="علب">
            ${retail ? `<input type="number" inputmode="numeric" min="0" max="${sc - 1}" value="${b.l || 0}" onchange="posStkSet(${i},'l',this.value)" aria-label="أجزاء">` : ''}
            <button type="button" onclick="posStkDel(${i})" aria-label="حذف الدفعة">✕</button></div>`).join('') || '<div class="px-msg">لا دفعات. أضف دفعة لتسجيل تاريخ الانتهاء.</div>'}</div>
        <div class="px-row"><label><span>سعر العلبة (د.ع)</span><input id="psP" type="number" inputmode="numeric" min="0" value="${parseFloat(p.price) || ''}"></label></div>
        <div class="px-msg">بعد الحفظ تُعدّ المادة مجرودة، ويُسجَّل التعديل في سجل العمليات.</div></div>`;
}
function posStkRefresh() {
    const t = posStkTotals(), q = document.getElementById('psQ'), l = document.getElementById('psL'), has = posStk.rows.length > 0;
    if (q) { q.value = t.q; q.readOnly = has; } if (l) { l.value = t.l; l.readOnly = has; }
}
function posStkRedraw() { const h = document.querySelector('.swal2-html-container'); if (h) h.innerHTML = posStkHtml(); }
function posStkAdd() { posStk.rows.push({ e: '', q: 0, l: 0 }); posStkRedraw(); }
function posStkDel(i) { posStk.rows.splice(i, 1); posStkRedraw(); }
function posStkSet(i, f, v) { posStk.rows[i][f] = f === 'e' ? v : Math.max(0, parseInt(v) || 0); posStkRefresh(); }
async function posStockOpen(pid) {
    const p = products.find(x => x.id === pid); if (!p || !posStockCan()) return;
    posStk = { p, rows: getBatches(p).map(b => ({ e: b.e, q: b.q, l: b.l, pr: b.pr })), q: parseInt(p.qty) || 0, l: parseInt(p.loose) || 0 };
    const retail = hasRetail(p), sc = btSc(p);
    const r = await Swal.fire({
        title: 'مخزن المادة', confirmButtonText: 'حفظ', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', html: posStkHtml(),
        preConfirm: () => {
            const t = posStkTotals(), pr = parseFloat(document.getElementById('psP').value);
            if (retail && t.l >= sc) { Swal.showValidationMessage('عدد الأجزاء يجب أن يكون أقل من ' + sc); return false; }
            if (!(pr > 0)) { Swal.showValidationMessage('أدخل سعر المادة'); return false; }
            if (posStk.rows.some(b => !(b.q > 0 || b.l > 0) && !b.e)) { Swal.showValidationMessage('دفعة بلا تاريخ ولا عدد: احذفها أو عبّئها'); return false; }
            return { ...t, pr, rows: posStk.rows.map(b => ({ ...b })), hasRows: posStk.rows.length > 0 };
        } });
    if (!r.isConfirmed || !r.value) return;
    const v = r.value, from = { qty: parseInt(p.qty) || 0, loose: parseInt(p.loose) || 0 };
    const snap = { qty: p.qty, loose: p.loose, bt: p.bt ? JSON.parse(JSON.stringify(p.bt)) : p.bt, ed: p.expiryDates, e1: p.expiryDate, price: p.price, pricing: p.pricing, mk: p.markupPct, sp: p.subPrice };
    let priceChanged = false;
    p.qty = v.q; p.loose = retail ? v.l : 0;
    if (v.hasRows || p.bt) { const dk = btDateOnly(p); p.bt = btFromArr(v.rows); const cur = getBatches(p); btApply(p, cur.concat(btDateRows(dk).filter(x => !cur.some(a => a.e === x.e)))); }
    if (v.pr !== (parseFloat(p.price) || 0)) { p.price = v.pr; p.pricing = 'manual'; p.markupPct = null; if (retail && !p.subManual) p.subPrice = subPriceCalc(v.pr, subCountOf(p)); priceChanged = true; }
    const ok = await saveProductsDelta([{ p, dq: v.q - from.qty, dl: p.loose - from.loose, mark: true, priceFields: priceChanged }]);
    if (!ok) { p.qty = snap.qty; p.loose = snap.loose; p.bt = snap.bt; p.expiryDates = snap.ed; p.expiryDate = snap.e1; p.price = snap.price; p.pricing = snap.pricing; p.markupPct = snap.mk; p.subPrice = snap.sp; saveLocal(); return; }
    p.counted = true;
    try { logAction('qty', p, [{ f: 'الكمية (شاشة البيع)', from: stockTxt(p, from), to: stockTxt(p, { qty: p.qty, loose: p.loose }) }]); } catch (e) { /* تجاهل */ }
    // إعادة توزيع سطور هذه المادة على دفعاتها بعد التعديل (الأقرب انتهاءً أولاً)
    posGroups().filter(g => g.pid === pid).forEach(g => { const t = posTotalQty(g); bill.items = bill.items.filter(it => !g.lines.includes(it)); posAdd(pid, g.unit, t); });
    billChanged(); try { renderAll(); } catch (e) { /* تجاهل */ } posRender();
    Swal.fire({ icon: 'success', title: 'تم تحديث المخزن', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
}
function posCountOpen(pid) { return posStockOpen(pid); }

// ---------- الخيارات الإضافية ----------
function posField(k, v) {
    bill[k] = v; writeInvoiceFields(); recalcInvoice(); billChanged(); posFoot();
}
function posToggleExtra() { posExtraOpen = !posExtraOpen; posRender(); }

// ---------- الإصدار: نافذة واحدة (خصم محسوب بلا خسارة + تسوية الألف + بيع آجل) ----------
function posLimits() {   // أعلى خصم مسموح بالمبلغ، بنفس منطق فاحص المادة (حد البائعين dlim، أو الحد الكامل للمالك)
    const own = userRole === 'owner'; let allow = 0, unknown = false;
    bill.items.forEach(it => {
        const lt = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), p = it.pid && products.find(x => x.id === it.pid); let lim = null;
        if (p) { if (own) { const ex = typeof scExact === 'function' ? scExact(p) : null; lim = ex === null ? null : Math.floor(ex * 10) / 10; } else if (p.dlim !== undefined && p.dlim !== null && p.dlim !== '') lim = Number(p.dlim); }
        if (lim === null) { if (own) unknown = true; } else allow += lt * lim / 100;
    });
    return { allow: Math.floor(allow), unknown, own };
}
// خصم يجعل الصافي مبلغاً بلا كسور (أقرب 250 د.ع)، وخيار «سعر الكلفة» (الكلفة مقرّبة إلى أقرب ألف فوقها)
const POS_NET_STEP = 250;
function posDiscForPct(S, pc) { if (!(pc > 0)) return 0; const net = Math.round(S * (1 - pc / 100) / POS_NET_STEP) * POS_NET_STEP; return Math.max(0, Math.min(Math.floor(S), Math.floor(S - net))); }
function posDiscForMax(S, allow) { const net = Math.ceil((S - allow) / POS_NET_STEP - 1e-9) * POS_NET_STEP; return Math.max(0, Math.min(Math.floor(allow), Math.floor(S - net))); }
function posCostNet() {
    const own = userRole === 'owner'; let cost = 0;
    bill.items.forEach(it => {
        const lt = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), p = it.pid && products.find(x => x.id === it.pid); let lim = null;
        if (p) { if (own) { const ex = typeof scExact === 'function' ? scExact(p) : null; lim = ex; } else if (p.dlim !== undefined && p.dlim !== null && p.dlim !== '') lim = Number(p.dlim); }
        cost += lim === null ? lt : lt * (1 - lim / 100);
    });
    return Math.ceil(cost / 1000 - 1e-9) * 1000;
}
function posDiscForCost(S) { return Math.max(0, Math.floor(S - posCostNet())); }
function posCostChipOn() { try { return userRole === 'owner' || !!scCfg().posCostChip; } catch (e) { return false; } }
function posCostChipSet(v) { try { const c = scCfg(); c.posCostChip = !!v; scSave(c); } catch (e) { /* تجاهل */ } }
async function posIssue() {
    if (!bill.items.length) { Swal.fire({ icon: 'info', title: 'أضف مادة أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 1500 }); return; }
    if (typeof billHasExpired === 'function' && billHasExpired()) return;
    writeInvoiceFields();
    const snap = { disc: bill.discount, paid: bill.paid, prices: bill.items.map(i => i.price) };
    const restore = () => { bill.discount = snap.disc; bill.paid = snap.paid; bill.items.forEach((i, k) => { if (k < snap.prices.length) i.price = snap.prices[k]; }); writeInvoiceFields(); billChanged(); posRender(); };
    const el = typeof qiEligible === 'function' ? qiEligible() : [];
    const short = (typeof billPlan === 'function' && bill.deduct !== false) ? billPlan().filter(e => e.short) : [];
    const showLim = userRole === 'owner' || (typeof can === 'function' && can('scanDisc'));
    const val = () => {
        const L = posLimits(), d = parseFloat(bill.discount) || 0;
        if (userRole !== 'owner' && d > L.allow) { Swal.showValidationMessage(L.allow > 0 ? 'الخصم يتجاوز الحد المسموح' : 'لا يُسمح بخصم على هذه المواد'); return false; }
        const cr = document.getElementById('pxCr').checked;
        return { credit: cr, paid: cr ? (parseFloat(document.getElementById('pxPaid').value) || 0) : null };
    };
    const r = await Swal.fire({
        title: 'إتمام البيع', showCancelButton: true, showDenyButton: true, confirmButtonText: 'إصدار', denyButtonText: 'إصدار وطباعة', cancelButtonText: 'رجوع',
        confirmButtonColor: '#15803d', denyButtonColor: '#0f1c38', preConfirm: val, preDeny: val,
        html: `<div class="px">
            <div class="px-sum"><span>المجموع</span><b id="pxSub"></b></div>
            <div class="px-sec">الخصم</div>
            <div class="px-row"><label><span>نسبة الخصم ٪</span><input id="pxP" type="number" inputmode="decimal" min="0" step="any"></label><label><span>مبلغ الخصم (د.ع)</span><input id="pxA" type="number" inputmode="numeric" min="0"></label></div>
            <div class="px-chips" id="pxChips">${[5, 10, 15, 20].map(n => `<button type="button" data-p="${n}">${n}٪</button>`).join('')}${posCostChipOn() ? '<button type="button" data-p="cost" class="cost">سعر الكلفة</button>' : ''}<button type="button" data-p="0" class="clr">بدون خصم</button></div>
            ${showLim ? '<button type="button" class="px-max" id="pxMax"></button>' : ''}
            <div id="pxMsg" class="px-msg"></div>
            ${el.length ? `<div id="pxRound"><div class="px-sec">تسوية المجموع إلى ألف كاملة</div>
                <div class="px-rl">${el.map((i, k) => `<label class="px-rr"><input type="radio" name="pxRI" value="${i}" ${k === 0 ? 'checked' : ''}><span dir="ltr">${posEsc(bill.items[i].name)}</span><b id="pxRP${i}"></b></label>`).join('')}</div>
                <div class="px-rb"><button type="button" data-d="-750">− 750</button><button type="button" data-d="-500">− 500</button><button type="button" data-d="-250">− 250</button></div>
                <div class="px-rb"><button type="button" data-d="250">+ 250</button><button type="button" data-d="500">+ 500</button><button type="button" data-d="750">+ 750</button></div></div>` : ''}
            <label class="px-cr"><input type="checkbox" id="pxCr"><span>بيع آجل (دفع جزء من المبلغ)</span></label>
            <div id="pxPaidBox" style="display:none"><input id="pxPaid" type="number" inputmode="numeric" min="0" class="swal2-input" placeholder="المبلغ المدفوع (0 إن لم يُدفع شيء)"></div>
            <div class="px-net">الصافي: <b id="pxNet"></b></div>
            ${short.length ? `<div class="px-warn">⚠️ كميات غير كافية بالمخزن:<br>${short.map(e => posEsc(e.p.name)).join('<br>')}</div>` : ''}</div>`,
        didOpen: () => {
            const $ = id => document.getElementById(id), sub = () => billTotals().sub;
            const upd = (from) => {
                const S = sub(); let d = Math.min(Math.max(parseFloat(bill.discount) || 0, 0), S); bill.discount = d ? String(d) : '';
                $('pxSub').textContent = fmtNum(S) + ' د.ع'; if (from !== 'p') $('pxP').value = S > 0 && d > 0 ? Math.round(d / S * 1000) / 10 : ''; if (from !== 'a') $('pxA').value = d || '';
                $('pxNet').textContent = fmtNum(S - d) + ' د.ع';
                const L = posLimits(), mx = S > 0 ? Math.floor(L.allow / S * 1000) / 10 : 0, m = $('pxMsg');
                if ($('pxMax')) $('pxMax').textContent = L.unknown && L.own ? 'أعلى خصم غير محسوب لبعض المواد (لا كلفة)' : 'أعلى خصم بدون خسارة: ' + mx + '٪ (' + fmtNum(L.allow) + ' د.ع)';
                if (d > 0) { if (d > L.allow && !(L.own && L.unknown)) { m.className = 'px-msg bad'; m.textContent = L.own ? '🔴 خسارة: الخصم أعلى من الحد الآمن' : '🔴 يتجاوز الحد المسموح'; } else { m.className = 'px-msg ok'; m.textContent = '🟢 خصم آمن'; } } else { m.className = 'px-msg'; m.textContent = ''; }
                document.querySelectorAll('#pxChips button').forEach(b => { const k = b.dataset.p, cd = k === 'cost' ? posDiscForCost(S) : k === '0' ? 0 : posDiscForPct(S, +k); b.disabled = k !== '0' && (cd <= 0 || (!L.own && cd > L.allow)); b.classList.toggle('on', k === '0' ? d === 0 : cd > 0 && d === cd); });
                el.forEach(i => { const e = $('pxRP' + i); if (e) e.textContent = fmtNum(bill.items[i].price); });
                const rd = $('pxRound'); if (rd) rd.style.display = Math.round(S - d) % 1000 === 0 ? 'none' : '';
            };
            $('pxP').oninput = () => { const S = sub(), pc = parseFloat($('pxP').value) || 0; bill.discount = String(posDiscForPct(S, pc)); upd('p'); $('pxA').value = bill.discount === '0' ? '' : bill.discount; };
            $('pxA').oninput = () => { bill.discount = String(parseFloat($('pxA').value) || 0); upd('a'); };
            document.querySelectorAll('#pxChips button').forEach(b => { b.onclick = () => { const S = sub(), k = b.dataset.p, d = k === 'cost' ? posDiscForCost(S) : posDiscForPct(S, +k); bill.discount = d ? String(d) : ''; upd(); }; });
            if ($('pxMax')) $('pxMax').onclick = () => { bill.discount = String(posDiscForMax(sub(), posLimits().allow)); upd(); };
            $('pxCr').onchange = () => { $('pxPaidBox').style.display = $('pxCr').checked ? '' : 'none'; };
            let cur = el[0];
            document.querySelectorAll('input[name=pxRI]').forEach(x => { x.onchange = () => { cur = +x.value; }; });
            document.querySelectorAll('.px-rb button').forEach(b => { b.onclick = () => { const it = bill.items[cur]; if (!it) return; const np = (parseFloat(it.price) || 0) + (+b.dataset.d) / (parseFloat(it.qty) || 1); if (np <= 0) return; it.price = np; upd(); }; });
            upd();
        }
    });
    if (r.isDismissed) { restore(); return; }
    {   // تحذير: خصم يتجاوز الحد الآمن = بيع بخسارة (يحتاج تأكيداً)
        const L = posLimits(), d = parseFloat(bill.discount) || 0;
        if (d > 0 && L.own && !L.unknown && d > L.allow) {
            const w = await Swal.fire({ icon: 'warning', title: 'تحذير: بيع بخسارة', html: `الخصم <b>${fmtNum(d)} د.ع</b> أعلى من الحد الآمن <b>${fmtNum(L.allow)} د.ع</b>.<br>هذه الفاتورة ستُباع <b style="color:#b91c1c">بخسارة تقارب ${fmtNum(d - L.allow)} د.ع</b>.<br>هل تريد إصدارها رغم ذلك؟`, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، إصدار بخسارة', cancelButtonText: 'رجوع لتعديل الخصم', reverseButtons: true });
            if (!w.isConfirmed) { return posIssue(); }
        }
    }
    const t = billTotals();
    bill.paid = r.value && r.value.credit ? String(Math.min(r.value.paid, t.total)) : '';
    writeInvoiceFields(); billChanged(); try { qiRemember(); } catch (e) { /* تجاهل */ }
    await issueInvoice(!!r.isDenied, true);
    if (bill.issued) { posDone = true; posRender(); } else { posRender(); }
}
function posNew() {
    bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); posDone = false; posExtraOpen = false;
    try { initBillEditor(); } catch (e) { /* تجاهل */ }
    posRender(); posFocus();
}

// ---------- الرسم ----------
function posFoot() {
    const el = document.getElementById('posTotal'); if (!el) return;
    const t = billTotals(); el.textContent = fmtNum(t.total);
    const n = document.getElementById('posCnt'); if (n) n.textContent = posGroups().length ? posGroups().length + ' مادة' : 'لا مواد';
}
function posCardHtml(g) {
    const p = g.pid ? products.find(x => x.id === g.pid) : null, first = g.lines[0], qty = posTotalQty(g);
    const tot = g.lines.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    const chips = g.pid ? g.lines.map(it => { const t = posExpTag(it.exp); return `<span class="pos-chip ${t.c}">${posEsc(t.t)} × ${posEsc(it.qty)}</span>`; }).join('') : '';
    const unit = p && hasRetail(p) && !sellLocked(p) ? `<div class="pos-unit"><button type="button" class="${g.unit === 'pack' ? 'on' : ''}" onclick="posSetUnit('${g.key}','pack')">علبة</button><button type="button" class="${g.unit === 'part' ? 'on' : ''}" onclick="posSetUnit('${g.key}','part')">${posEsc(subTypeOf(p))}</button></div>` : '';
    const prices = [...new Set(g.lines.map(it => parseFloat(it.price) || 0))];
    const cnt = g.pid && posNeedsCount(p) ? `<button type="button" class="pos-cnt" onclick="posCountOpen(${g.pid})">⚠️ المادة لم تُجرد بعد — اضغط لإدخال العدد والسعر</button>` : '';
    return `<div class="pos-card"><div class="pos-top"><b dir="ltr">${posEsc(first.name)}</b><button type="button" class="pos-x" onclick="posDel('${g.key}')" aria-label="حذف">✕</button></div>
        ${p ? posStockLine(p) : ''}${cnt}
        ${chips ? `<div class="pos-batches" onclick="posBatch('${g.key}')" title="تغيير الدفعة أو السعر">${chips}<span class="pos-edit">تغيير الدفعة ✎</span></div>` : ''}
        <div class="pos-mid">${unit}<div class="pos-st"><button type="button" onclick="posQtyStep('${g.key}',-1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="1" value="${posEsc(qty)}" onchange="posQtySet('${g.key}',this.value)" aria-label="العدد"><button type="button" onclick="posQtyStep('${g.key}',1)" aria-label="زيادة">+</button></div>
        <div class="pos-sum">${prices.length === 1 && prices[0] ? `<small>${fmtNum(prices[0])} ×</small>` : ''}<b>${fmtNum(tot)}</b></div></div></div>`;
}
function posRender() {
    const ov = document.getElementById('posOv'); if (!ov || !bill) return;
    const list = document.getElementById('posList'), done = document.getElementById('posDone');
    ov.classList.toggle('is-done', posDone);
    if (posDone) {
        done.innerHTML = `<div class="pos-ok">✓</div><h2>صدرت الفاتورة</h2><div class="pos-okno" dir="ltr">${posEsc(bill.no)}</div><div class="pos-oktot">${fmtNum(billTotals().total)} د.ع</div>
            <button type="button" class="pos-big go" onclick="posNew()">فاتورة جديدة</button><button type="button" class="pos-big alt" onclick="printInvoice()">🖨️ طباعة</button><button type="button" class="pos-big alt" onclick="billSharePdf()">📤 مشاركة PDF</button>`;
        return;
    }
    const gs = posGroups();
    list.innerHTML = gs.map(posCardHtml).join('') || '<div class="pos-empty"><div>🛒</div>امسح باركود أو اكتب اسم المادة للبدء</div>';
    const ex = document.getElementById('posExtra');
    ex.innerHTML = `<button type="button" class="pos-more" onclick="posToggleExtra()">${posExtraOpen ? '▲ إخفاء بيانات الفاتورة' : '▼ بيانات الفاتورة (الشركة، الزبون، الطبيب، التاريخ، ملاحظات)'}</button>` + (posExtraOpen ? `<div class="pos-fields">
        <label>إلى السيد / الشركة<input list="qiDl_to" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.to || '')}" onchange="posField('to', this.value)"></label>
        <label>اسم الزبون<input list="qiDl_customer" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.customer || '')}" onchange="posField('customer', this.value)"></label>
        <label>اسم الطبيب المعالج<input list="qiDl_doctor" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.doctor || '')}" onchange="posField('doctor', this.value)"></label>
        <label>التاريخ<input type="date" value="${posEsc(bill.date || todayLocalISO())}" onchange="posField('date', this.value || todayLocalISO())"></label>
        <label>ملاحظات<textarea rows="2" onchange="posField('notes', this.value)">${posEsc(bill.notes || '')}</textarea></label>
        ${['to', 'customer', 'doctor'].map(k => qiDl(k)).join('')}</div>` : '');
    posFoot();
}
function posEnsureDom() {
    if (document.getElementById('posOv')) return;
    const d = document.createElement('div'); d.id = 'posOv'; d.className = 'pos-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = `<div class="pos-head"><button type="button" class="pos-back" onclick="posClose()" aria-label="رجوع">→</button><b>شاشة البيع</b><span class="pos-no" dir="ltr" id="posNo"></span></div>
        <div class="pos-bar"><input id="posQ" type="search" autocomplete="off" placeholder="امسح الباركود أو اكتب اسم المادة" oninput="posSearchInput()" onkeydown="if(event.key==='Enter'){event.preventDefault();posEnter();}"><button type="button" class="pos-cam" onclick="posScan()" aria-label="مسح بالكاميرا">📷</button></div>
        <div id="posRes" class="pos-resbox" style="display:none"></div>
        <div class="pos-body"><div id="posList" class="pos-list"></div><div id="posExtra" class="pos-extra"></div><div id="posDone" class="pos-donebox"></div></div>
        <div class="pos-foot"><div class="pos-tot"><small id="posCnt"></small><span>المجموع</span><b><span id="posTotal">0</span> <i>د.ع</i></b></div>
        <div class="pos-btns"><button type="button" class="pos-big go" onclick="posIssue()">إصدار</button></div></div>`;
    document.body.appendChild(d);
}
function posOpen() {
    if (typeof userRole !== 'undefined' && userRole === 'guest') return;
    try { initBillEditor(); } catch (e) { /* تجاهل */ }
    if (bill && bill.issued && !bill.editing) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); try { initBillEditor(); } catch (e) { /* تجاهل */ } }
    posEnsureDom(); posDone = false; posOpenFlag = true; posFound = [];
    document.getElementById('posNo').textContent = bill.no || '';
    document.getElementById('posOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open');
    const q = document.getElementById('posQ'); q.value = ''; posResults(); posRender(); posFocus();
}
function posClose() {
    const ov = document.getElementById('posOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); posOpenFlag = false;
    try { writeInvoiceFields(); renderInvoiceRows(); recalcInvoice(); updateIssuedUI(); } catch (e) { /* تجاهل */ }
}

// ---------- زر الدخول داخل صفحة الفاتورة ----------
function posFabSync() {
    const v = document.getElementById('billView'); if (!v) return;
    let b = document.getElementById('posFab');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'posFab'; b.className = 'pos-fab no-print'; b.innerHTML = '🛒<span>شاشة البيع</span>'; b.setAttribute('aria-label', 'شاشة البيع السريعة'); b.onclick = posOpen; v.appendChild(b); }
    b.style.display = (typeof currentBillTab === 'undefined' || currentBillTab === 'new') ? '' : 'none';
}
(function () {
    const ob = billTab; billTab = function () { const r = ob.apply(this, arguments); try { posFabSync(); } catch (e) { /* تجاهل */ } return r; };
    const orr = renderInvoiceRows; renderInvoiceRows = function () { const r = orr.apply(this, arguments); try { if (posOpenFlag && !spOpenNow()) { posRender(); } } catch (e) { /* تجاهل */ } return r; };
})();
function spOpenNow() { return typeof sp !== 'undefined' && !!sp; }
