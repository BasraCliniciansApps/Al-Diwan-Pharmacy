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
    unit = unit === 'part' && hasRetail(p) ? 'part' : 'pack'; n = n || 1;
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
    bill.items = bill.items.filter(it => !g.lines.includes(it));
    if (!posAdd(g.pid, to, 1)) { bill.items.push(...g.lines); }   // فشلت الإضافة (بلا سعر): نُبقي كما كانت
    posDone_();
}
function posBatch(key) { const g = posGroup(key); if (g && g.pid) spOpen(g.pid, { edit: true }); }   // تغيير الدفعة/السعر يدوياً

// ---------- البحث والمسح ----------
function posAddProduct(pid) {
    const ok = posAdd(pid, 'pack', 1);
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

// ---------- الخيارات الإضافية ----------
function posField(k, v) {
    bill[k] = v; writeInvoiceFields(); recalcInvoice(); billChanged(); posFoot();
}
function posToggleExtra() { posExtraOpen = !posExtraOpen; posRender(); }

// ---------- الإصدار ----------
async function posIssue(withPrint) {
    if (!bill.items.length) { Swal.fire({ icon: 'info', title: 'أضف مادة أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 1500 }); return; }
    writeInvoiceFields();
    await issueInvoice(withPrint ? true : false);
    if (bill.issued) { posDone = true; posRender(); }
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
    const unit = p && hasRetail(p) ? `<div class="pos-unit"><button type="button" class="${g.unit === 'pack' ? 'on' : ''}" onclick="posSetUnit('${g.key}','pack')">علبة</button><button type="button" class="${g.unit === 'part' ? 'on' : ''}" onclick="posSetUnit('${g.key}','part')">${posEsc(subTypeOf(p))}</button></div>` : '';
    const prices = [...new Set(g.lines.map(it => parseFloat(it.price) || 0))];
    return `<div class="pos-card"><div class="pos-top"><b dir="ltr">${posEsc(first.name)}</b><button type="button" class="pos-x" onclick="posDel('${g.key}')" aria-label="حذف">✕</button></div>
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
            <button type="button" class="pos-big go" onclick="posNew()">فاتورة جديدة</button><button type="button" class="pos-big alt" onclick="printInvoice()">🖨️ طباعة</button>`;
        return;
    }
    const gs = posGroups();
    list.innerHTML = gs.map(posCardHtml).join('') || '<div class="pos-empty"><div>🛒</div>امسح باركود أو اكتب اسم المادة للبدء</div>';
    const ex = document.getElementById('posExtra');
    ex.innerHTML = `<button type="button" class="pos-more" onclick="posToggleExtra()">${posExtraOpen ? '▲ إخفاء الخيارات' : '▼ خيارات إضافية (اسم الزبون، خصم، مدفوع)'}</button>` + (posExtraOpen ? `<div class="pos-fields">
        <label>اسم الزبون<input value="${posEsc(bill.to || '')}" onchange="posField('to', this.value)"></label>
        <label>الخصم<input type="number" inputmode="decimal" min="0" value="${posEsc(bill.discount)}" onchange="posField('discount', this.value)"></label>
        <label>المبلغ المدفوع (اتركه فارغاً إن دُفع كاملاً)<input type="number" inputmode="decimal" min="0" value="${posEsc(bill.paid)}" onchange="posField('paid', this.value)"></label></div>` : '');
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
        <div class="pos-btns"><button type="button" class="pos-big go" onclick="posIssue(false)">إصدار</button><button type="button" class="pos-big alt" onclick="posIssue(true)">إصدار وطباعة</button></div></div>`;
    document.body.appendChild(d);
}
function posOpen() {
    if (typeof userRole !== 'undefined' && userRole === 'guest') return;
    try { initBillEditor(); } catch (e) { /* تجاهل */ }
    if (bill && bill.issued && !bill.editing) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); try { initBillEditor(); } catch (e) { /* تجاهل */ } }
    posEnsureDom(); posDone = false; posOpenFlag = true; posFound = [];
    document.getElementById('posNo').textContent = bill.no || '';
    document.getElementById('posOv').style.display = 'flex'; document.documentElement.classList.add('lk');
    const q = document.getElementById('posQ'); q.value = ''; posResults(); posRender(); posFocus();
}
function posClose() {
    const ov = document.getElementById('posOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); posOpenFlag = false;
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
