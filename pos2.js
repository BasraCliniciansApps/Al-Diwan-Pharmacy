// =====================================================================
// واجهة بيع تجريبية (مستقلة عن شاشة البيع الحالية): على الكمبيوتر عمودان (المواد يميناً، ولوحة الملخص والدفع ثابتة يساراً)،
// وعلى الموبايل عمود واحد. تعمل على نفس كائن الفاتورة (bill) ونفس دوال الإضافة والدفعات والتجزئة والخصم والإصدار في pos.js وinvoice.js
// دون تغيير أي منها؛ هذا الملف يضيف العرض ولوحة الدفع وحاسبة الباقي فقط.
// =====================================================================
let p2 = { open: false, done: false, extra: false, recv: '', credit: false, paid: '', found: [] };
const P2_CALC_LS = 'diwanP2Calc';
const P2_NOTES = [250, 500, 1000, 5000, 10000, 25000, 50000];   // فئات الدينار العراقي المتداولة
const p2Calc = () => { try { return localStorage.getItem(P2_CALC_LS) !== '0'; } catch (e) { return true; } };
const p2El = id => document.getElementById(id);
const p2Net = () => billTotals().total;

// البطاقات تعيد رسم هذه الواجهة بدل واجهة pos.js حين تكون مفتوحة
(function () {
    const od = posDone_; window.posDone_ = function () { od(); if (p2.open) p2Render(); };
    const orr = renderInvoiceRows; renderInvoiceRows = function () { const r = orr.apply(this, arguments); try { if (p2.open && !spOpenNow()) p2Render(); } catch (e) { /* تجاهل */ } return r; };
})();

function p2Ensure() {
    if (p2El('p2Ov')) return;
    const d = document.createElement('div'); d.id = 'p2Ov'; d.className = 'p2-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = `<div class="p2-head"><button type="button" class="p2-back" onclick="p2Close()" aria-label="رجوع">›</button><b>🧪 واجهة بيع تجريبية</b><span class="p2-no" dir="ltr" id="p2No"></span></div>
        <div class="p2-main" id="p2Main">
            <section class="p2-items" id="p2Items">
                <div class="p2-bar"><input id="p2Q" type="search" autocomplete="off" placeholder="امسح الباركود أو اكتب اسم المادة" oninput="p2SearchInput()" onkeydown="if(event.key==='Enter'){event.preventDefault();p2Enter();}"><button type="button" class="p2-cam" onclick="p2Scan()" aria-label="مسح بالكاميرا">📷</button></div>
                <div id="p2Res" class="p2-resbox" style="display:none"></div>
                <div id="p2List" class="p2-list"></div>
                <div id="p2Extra" class="p2-extra"></div>
            </section>
            <aside class="p2-panel" id="p2Panel"></aside>
        </div>
        <div id="p2Done" class="p2-done" style="display:none"></div>`;
    document.body.appendChild(d);
}
function p2Open() {
    if (typeof userRole !== 'undefined' && userRole === 'guest') return;
    try { initBillEditor(); } catch (e) { /* تجاهل */ }
    if (bill && bill.issued && !bill.editing) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); try { initBillEditor(); } catch (e) { /* تجاهل */ } }
    p2Ensure(); p2 = Object.assign(p2, { open: true, done: false, extra: false, recv: '', credit: false, paid: '', found: [] });
    p2El('p2No').textContent = bill.no || '';
    p2El('p2Ov').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open');
    const q = p2El('p2Q'); if (q) q.value = ''; p2Results(); p2Render(); p2Focus();
}
function p2Close() {
    const ov = p2El('p2Ov'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); p2.open = false;
    try { writeInvoiceFields(); renderInvoiceRows(); recalcInvoice(); updateIssuedUI(); } catch (e) { /* تجاهل */ }
}
function p2Focus() { const q = p2El('p2Q'); if (q && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) q.focus(); }
function p2New() {
    bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); p2.done = false; p2.extra = false; p2.recv = ''; p2.credit = false; p2.paid = '';
    try { initBillEditor(); } catch (e) { /* تجاهل */ }
    p2El('p2No').textContent = bill.no || ''; p2Render(); p2Focus();
}

// ---------- البحث والمسح ----------
function p2AddProduct(pid) {
    const ok = posAdd(pid, sellDefUnit(products.find(x => x.id === pid)), 1);
    const q = p2El('p2Q'); if (q) q.value = '';
    p2.found = []; p2Results();
    if (ok) { posBeep(true); billChanged(); p2Render(); }
    p2Focus();
}
function p2SearchInput() {
    const qn = normSearch(p2El('p2Q').value);
    if (!qn) { p2.found = []; return p2Results(); }
    const toks = qn.split(' ');
    p2.found = products.filter(p => !p.arch).map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    p2Results(true);
}
function p2Results(show) {
    const box = p2El('p2Res'); if (!box) return;
    if (!show || !p2.found.length) {
        const q = p2El('p2Q');
        box.innerHTML = show && q && q.value.trim() ? '<div class="pos-none">لا توجد نتائج</div>' : '';
        box.style.display = box.innerHTML ? 'block' : 'none'; return;
    }
    box.innerHTML = p2.found.map(p => {
        const ne = posNearestExp(p), inS = isInStock(p);
        return `<button type="button" class="pos-res" onclick="p2AddProduct(${p.id})"><span class="pos-rn" dir="ltr">${dispNameHtml(p)}</span><span class="pos-rm"><b>${p.price ? fmtNum(p.price) + ' د.ع' : 'بلا سعر'}</b><em class="${inS ? '' : 'bad'}">${inS ? 'المتوفر ' + posEsc(stockLabel(p)) : 'غير متوفر'}</em>${ne ? `<em>ينتهي ${posFmtExp(ne)}</em>` : ''}</span></button>`;
    }).join('');
    box.style.display = 'block';
}
function p2ByCode(code) {
    const p = findByBarcode(code);
    if (p) { p2AddProduct(p.id); return true; }
    posBeep(false);
    offerUnknownBarcode(code, p2b => { p2AddProduct(p2b.id); });
    return false;
}
function p2Enter() {
    const raw = p2El('p2Q').value.trim(), code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code) && /^[0-9A-Za-z\-]+$/.test(raw)) {
        const p = findByBarcode(code);
        if (p) return p2AddProduct(p.id);
        if (/^\d{6,}$/.test(code)) return p2ByCode(code);
    }
    if (p2.found.length) p2AddProduct(p2.found[0].id);
}
function p2Scan() {   // كاميرا: تستمر بعد كل قراءة لحين الإغلاق
    const cb = code => { if (!p2.open) return; p2ByCode(code); setTimeout(() => { if (p2.open && !document.querySelector('.swal2-container')) p2Scan(); }, 350); };
    openBarcodeScanner(cb);
}

// ---------- بيانات الفاتورة الإضافية ----------
function p2Field(k, v) { bill[k] = v; writeInvoiceFields(); recalcInvoice(); billChanged(); p2Totals(); }
function p2ToggleExtra() { p2.extra = !p2.extra; p2Render(); }

// ---------- الخصم والصافي (بنفس دوال pos.js دون تغيير) ----------
function p2SetDisc(v) { bill.discount = v ? String(v) : ''; writeInvoiceFields(); billChanged(); p2Totals(); }
function p2DiscPct(el) { const S = billTotals().sub, pc = parseFloat(el.value) || 0; p2SetDisc(posDiscForPct(S, pc)); const a = p2El('p2A'); if (a) a.value = bill.discount; }
function p2DiscAmt(el) { p2SetDisc(Math.max(0, parseFloat(el.value) || 0)); const S = billTotals().sub, d = billTotals().disc, p = p2El('p2P'); if (p) p.value = S > 0 && d > 0 ? Math.round(d / S * 1000) / 10 : ''; }
function p2Chip(k) { const S = billTotals().sub; p2SetDisc(k === 'cost' ? posDiscForCost(S) : k === '0' ? 0 : posDiscForPct(S, +k)); p2Sync(); }
function p2DiscMax() { p2SetDisc(posDiscForMax(billTotals().sub, posLimits().allow)); p2Sync(); }
function p2Sync() { const t = billTotals(), a = p2El('p2A'), p = p2El('p2P'); if (a) a.value = t.disc || ''; if (p) p.value = t.sub > 0 && t.disc > 0 ? Math.round(t.disc / t.sub * 1000) / 10 : ''; p2Totals(); }
function p2Totals() {   // تحديث الأرقام دون إعادة رسم اللوحة (حتى لا يضيع المؤشر من الحقول)
    const t = billTotals(), L = posLimits(), set = (id, v) => { const e = p2El(id); if (e) e.textContent = v; };
    set('p2Sub', fmtNum(t.sub) + ' د.ع'); set('p2Dsc', t.disc > 0 ? '− ' + fmtNum(t.disc) + ' د.ع' : '0'); set('p2Net', fmtNum(t.total));
    const mx = p2El('p2Max'); if (mx) mx.textContent = L.unknown && L.own ? 'أعلى خصم غير محسوب لبعض المواد (لا كلفة)' : 'أعلى خصم بدون خسارة: ' + (t.sub > 0 ? Math.floor(L.allow / t.sub * 1000) / 10 : 0) + '٪ (' + fmtNum(L.allow) + ' د.ع)';
    const m = p2El('p2Msg');
    if (m) {
        if (t.disc > 0) { if (t.disc > L.allow && !(L.own && L.unknown)) { m.className = 'px-msg bad'; m.textContent = L.own ? '🔴 خسارة: الخصم أعلى من الحد الآمن' : '🔴 يتجاوز الحد المسموح'; } else { m.className = 'px-msg ok'; m.textContent = '🟢 خصم آمن'; } } else { m.className = 'px-msg'; m.textContent = ''; }
    }
    document.querySelectorAll('#p2Chips button').forEach(b => { const k = b.dataset.p, cd = k === 'cost' ? posDiscForCost(t.sub) : k === '0' ? 0 : posDiscForPct(t.sub, +k); b.disabled = k !== '0' && (cd <= 0 || (!L.own && cd > L.allow)); b.classList.toggle('on', k === '0' ? t.disc === 0 : cd > 0 && t.disc === cd); });
    p2CalcRefresh();
}

// ---------- حاسبة الباقي (للعرض فقط، لا تُخزَّن في الفاتورة) ----------
function p2RecvAdd(n) { p2RecvSet((parseFloat(p2.recv) || 0) + n); }   // كل ضغطة تضيف الفئة إلى المبلغ المستلم
function p2RecvSet(v) { p2.recv = v === '' ? '' : String(v); const i = p2El('p2R'); if (i) i.value = p2.recv; p2CalcRefresh(); }
function p2CalcRefresh() {
    const box = p2El('p2Chg'); if (!box) return;
    const net = p2Net(), r = parseFloat(p2.recv);
    const q = p2El('p2Quick'); if (q && !q.dataset.r) { q.dataset.r = '1'; q.innerHTML = P2_NOTES.map(n => `<button type="button" onclick="p2RecvAdd(${n})">${fmtNum(n)}</button>`).join('') + '<button type="button" class="m" onclick="p2RecvSet(Math.round(p2Net()))">مطابق</button><button type="button" class="c" onclick="p2RecvSet(\'\')">مسح</button>'; }
    if (!(r >= 0) || p2.recv === '') { box.className = 'p2-chg'; box.innerHTML = '<span>الباقي للزبون</span><b>—</b>'; return; }
    if (r >= net) { box.className = 'p2-chg ok'; box.innerHTML = `<span>الباقي للزبون</span><b>${fmtNum(r - net)} د.ع</b>`; }
    else { box.className = 'p2-chg bad'; box.innerHTML = `<span>ناقص</span><b>${fmtNum(net - r)} د.ع</b><small>فعّل «بيع آجل» لتسجيل المتبقي ديناً.</small>`; }
}
function p2CalcToggle(on) { try { localStorage.setItem(P2_CALC_LS, on ? '1' : '0'); } catch (e) { /* تجاهل */ } p2.recv = ''; p2Render(); }
function p2CreditToggle(on) { p2.credit = !!on; const b = p2El('p2PaidBox'); if (b) b.style.display = on ? '' : 'none'; }

// ---------- الإصدار (نفس منطق التحقق في posIssue) ----------
async function p2Issue(print) {
    if (!bill.items.length) { Swal.fire({ icon: 'info', title: 'أضف مادة أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 1500 }); return; }
    if (typeof billHasExpired === 'function' && billHasExpired()) return;
    writeInvoiceFields();
    const L = posLimits(), d = parseFloat(bill.discount) || 0, msg = t => { const e = p2El('p2Val'); if (e) { e.textContent = t || ''; e.style.display = t ? '' : 'none'; } };
    msg('');
    if (userRole !== 'owner' && d > L.allow) { msg(L.allow > 0 ? 'الخصم يتجاوز الحد المسموح' : 'لا يُسمح بخصم على هذه المواد'); return; }
    if (d > 0 && L.own && !L.unknown && d > L.allow) {   // تحذير: خصم يتجاوز الحد الآمن = بيع بخسارة
        const w = await Swal.fire({ icon: 'warning', title: 'تحذير: بيع بخسارة', html: `الخصم <b>${fmtNum(d)} د.ع</b> أعلى من الحد الآمن <b>${fmtNum(L.allow)} د.ع</b>.<br>هذه الفاتورة ستُباع <b style="color:#b91c1c">بخسارة تقارب ${fmtNum(d - L.allow)} د.ع</b>.<br>هل تريد إصدارها رغم ذلك؟`, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، إصدار بخسارة', cancelButtonText: 'رجوع' });
        if (!w.isConfirmed) return;
    }
    const t = billTotals(), paidIn = parseFloat((p2El('p2Paid') || {}).value) || 0;
    bill.paid = p2.credit ? String(Math.min(paidIn, t.total)) : '';
    writeInvoiceFields(); billChanged(); try { qiRemember(); } catch (e) { /* تجاهل */ }
    await issueInvoice(!!print, true);
    if (bill.issued) { p2.done = true; }
    p2Render();
}


// ---------- بطاقة المادة: شريحة الدفعة (تاريخ + المتاح) مع أسهم للتنقل بين الدفعات عند وجود دفعة واحدة في السطر ----------
const p2Ic = n => (window.AppIcons ? AppIcons.svg(n) : '');
function p2Batches(p, unit) {   // الدفعات الصالحة للبيع (غير منتهية ولها متاح) مرتبة بالأقرب انتهاءً، بعد استثناء سطور هذه المادة
    const sim = spSim(p, unit, true);
    return sim.bat.filter(b => !billExpired(b.e) && spAvail(b, p, unit) > 0).map(b => ({ e: b.e || '', pr: b.pr || 0, av: spAvail(b, p, unit) }))
        .sort((a, b) => (a.e ? 0 : 1) - (b.e ? 0 : 1) || String(a.e).localeCompare(String(b.e)) || a.pr - b.pr);
}
function p2ChipHtml(it, av, key, clickable) {
    const t = posExpTag(it.exp), warn = t.c === 'warn' || t.c === 'bad';
    const date = it.exp ? posFmtExp(it.exp) : 'بدون تاريخ';
    return `<button type="button" class="p2-chip ${t.c}" onclick="posBatch('${key}')" title="تغيير الدفعة" aria-label="تغيير الدفعة">${warn ? p2Ic('triangle-alert') : ''}<span class="p2-cd">${posEsc(date)}</span>${av !== null ? `<span class="p2-cq">متاح ${posEsc(av)}</span>` : `<span class="p2-cq">× ${posEsc(it.qty)}</span>`}${p2Ic('pencil')}</button>`;
}
function p2BatchRow(g, p) {
    if (!g.pid || !p) return '';
    const bats = p2Batches(p, g.unit);
    if (g.lines.length !== 1) return `<div class="p2-batches">${g.lines.map(it => p2ChipHtml(it, null, g.key, true)).join('')}</div>`;   // الكمية موزّعة على أكثر من دفعة: بلا أسهم
    const it = g.lines[0], cur = bats.findIndex(b => spKey(b.e, b.pr) === spKey(it.exp, it.bpr)), av = cur >= 0 ? bats[cur].av : null;
    const arrows = bats.length > 1 && cur >= 0;
    return `<div class="p2-batches">${arrows ? `<button type="button" class="p2-arr" onclick="p2BatchStep('${g.key}',-1)" ${cur <= 0 ? 'disabled' : ''} aria-label="الدفعة السابقة">${p2Ic('chevron-right')}</button>` : ''}${p2ChipHtml(it, av, g.key, true)}${arrows ? `<button type="button" class="p2-arr" onclick="p2BatchStep('${g.key}',1)" ${cur >= bats.length - 1 ? 'disabled' : ''} aria-label="الدفعة التالية">${p2Ic('chevron-left')}</button>` : ''}</div>`;
}
function p2BatchStep(key, d) {
    const g = posGroup(key); if (!g || g.lines.length !== 1) return;
    const p = products.find(x => x.id === g.pid); if (!p) return;
    const it = g.lines[0], bats = p2Batches(p, g.unit), cur = bats.findIndex(b => spKey(b.e, b.pr) === spKey(it.exp, it.bpr)), nx = bats[cur + d];
    if (cur < 0 || !nx) return;
    const q = parseFloat(it.qty) || 0;
    if (nx.av < q) { Swal.fire({ icon: 'warning', title: 'الدفعة لا تكفي الكمية (المتاح ' + nx.av + ')', toast: true, position: 'top', showConfirmButton: false, timer: 2000 }); return; }
    const hadBatchPrice = it.bpr > 0;
    if (nx.e) it.exp = nx.e; else delete it.exp;
    if (nx.pr) it.bpr = nx.pr; else delete it.bpr;
    if (nx.pr > 0) it.price = g.unit === 'part' ? (subPriceCalc(nx.pr, btSc(p)) || 0) : nx.pr;
    else if (hadBatchPrice) it.price = g.unit === 'part' ? subPriceOf(p) : (parseFloat(p.price) || 0);   // رجوع للسعر العادي بعد سعر دفعة خاص
    posBeep(true); billChanged(); p2Render();
}
function p2CardHtml(g) {
    const p = g.pid ? products.find(x => x.id === g.pid) : null, first = g.lines[0], qty = posTotalQty(g);
    const tot = g.lines.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    const unit = p && hasRetail(p) && !sellLocked(p) ? `<div class="pos-unit"><button type="button" class="${g.unit === 'pack' ? 'on' : ''}" onclick="posSetUnit('${g.key}','pack')">علبة</button><button type="button" class="${g.unit === 'part' ? 'on' : ''}" onclick="posSetUnit('${g.key}','part')">${posEsc(subTypeOf(p))}</button></div>` : '';
    const prices = [...new Set(g.lines.map(it => parseFloat(it.price) || 0))];
    const cnt = g.pid && posNeedsCount(p) ? `<button type="button" class="pos-cnt" onclick="posCountOpen(${g.pid})">⚠️ المادة لم تُجرد بعد — اضغط لإدخال العدد والسعر</button>` : '';
    return `<div class="pos-card"><div class="pos-top"><b dir="ltr">${posEsc(first.name)}</b><button type="button" class="pos-x" onclick="posDel('${g.key}')" aria-label="حذف">✕</button></div>
        ${p ? posStockLine(p) : ''}${cnt}${p2BatchRow(g, p)}
        <div class="pos-mid">${unit}<div class="pos-st"><button type="button" onclick="posQtyStep('${g.key}',-1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="1" value="${posEsc(qty)}" onchange="posQtySet('${g.key}',this.value)" aria-label="العدد"><button type="button" onclick="posQtyStep('${g.key}',1)" aria-label="زيادة">+</button></div>
        <div class="pos-sum">${prices.length === 1 && prices[0] ? `<small>${fmtNum(prices[0])} ×</small>` : ''}<b>${fmtNum(tot)}</b></div></div></div>`;
}

// ---------- الرسم ----------
function p2Panel() {
    const t = billTotals(), L = posLimits(), showLim = userRole === 'owner' || (typeof can === 'function' && can('scanDisc')), n = posGroups().length;
    return `<div class="p2-sec">ملخص الفاتورة</div>
        <div class="p2-row"><span>عدد المواد</span><b>${n}</b></div>
        <div class="p2-row"><span>المجموع قبل الخصم</span><b id="p2Sub"></b></div>
        <div class="p2-row"><span>الخصم</span><b id="p2Dsc"></b></div>
        <div class="p2-sec">الخصم</div>
        <div class="px-row"><label><span>نسبة الخصم ٪</span><input id="p2P" type="number" inputmode="decimal" min="0" step="any" oninput="p2DiscPct(this)"></label><label><span>مبلغ الخصم (د.ع)</span><input id="p2A" type="number" inputmode="numeric" min="0" oninput="p2DiscAmt(this)"></label></div>
        <div class="px-chips" id="p2Chips">${[5, 10, 15, 20].map(k => `<button type="button" data-p="${k}" onclick="p2Chip('${k}')">${k}٪</button>`).join('')}${posCostChipOn() ? '<button type="button" data-p="cost" class="cost" onclick="p2Chip(\'cost\')">سعر الكلفة</button>' : ''}<button type="button" data-p="0" class="clr" onclick="p2Chip('0')">بدون خصم</button></div>
        ${showLim ? '<button type="button" class="px-max" id="p2Max" onclick="p2DiscMax()"></button>' : ''}
        <div id="p2Msg" class="px-msg"></div>
        <div class="p2-netbox"><span>الصافي</span><b id="p2Net"></b><i>د.ع</i></div>
        <div class="p2-sec p2-sec-sw"><span>حاسبة الباقي (بيع نقدي)</span><label class="setup-sw"><input type="checkbox" ${p2Calc() ? 'checked' : ''} onchange="p2CalcToggle(this.checked)" aria-label="حاسبة الباقي"><i></i></label></div>
        ${p2Calc() ? `<label class="p2-recv"><span>المبلغ المستلم (د.ع)</span><input id="p2R" type="number" inputmode="numeric" min="0" value="${posEsc(p2.recv)}" oninput="p2.recv=this.value;p2CalcRefresh()"></label>
            <div class="p2-quick" id="p2Quick"></div><div id="p2Chg" class="p2-chg"></div>` : ''}
        <div class="px-cr"><span>بيع آجل (دفع جزء من المبلغ)</span><label class="setup-sw"><input type="checkbox" ${p2.credit ? 'checked' : ''} onchange="p2CreditToggle(this.checked)" aria-label="بيع آجل"><i></i></label></div>
        <div id="p2PaidBox" style="display:${p2.credit ? '' : 'none'}"><input id="p2Paid" type="number" inputmode="numeric" min="0" class="px-paid" placeholder="المبلغ المدفوع (0 إن لم يُدفع شيء)" value="${posEsc(p2.paid)}" oninput="p2.paid=this.value"></div>
        <button type="button" class="pos-more" onclick="p2ToggleExtra()">${p2.extra ? '▲ إخفاء بيانات الفاتورة' : '▼ بيانات الفاتورة (الشركة، الزبون، الطبيب، التاريخ، ملاحظات)'}</button>
        ${p2.extra ? `<div class="pos-fields">
            <label>إلى السيد / الشركة<input list="qiDl_to" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.to || '')}" onchange="p2Field('to', this.value)"></label>
            <label>اسم الزبون<input list="qiDl_customer" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.customer || '')}" onchange="p2Field('customer', this.value)"></label>
            <label>اسم الطبيب المعالج<input list="qiDl_doctor" autocomplete="off" placeholder="اختياري" value="${posEsc(bill.doctor || '')}" onchange="p2Field('doctor', this.value)"></label>
            <label>التاريخ<input type="date" value="${posEsc(bill.date || todayLocalISO())}" onchange="p2Field('date', this.value || todayLocalISO())"></label>
            <label>ملاحظات<textarea rows="2" onchange="p2Field('notes', this.value)">${posEsc(bill.notes || '')}</textarea></label>
            ${['to', 'customer', 'doctor'].map(k => qiDl(k)).join('')}</div>` : ''}
        <div class="p2-act"><div class="px-val" id="p2Val" style="display:none" role="alert"></div>
            <div class="p2-netbar"><span>الصافي</span><b>${fmtNum(t.total)}</b><i>د.ع</i></div>
            <div class="p2-btns"><button type="button" class="pos-big go" onclick="p2Issue(true)">إصدار وطباعة</button><button type="button" class="pos-big alt" onclick="p2Issue(false)">إصدار فقط</button></div></div>`;
}
function p2Render() {
    const ov = p2El('p2Ov'); if (!ov || !bill) return;
    const done = p2El('p2Done'), main = p2El('p2Main');
    if (p2.done) {
        main.style.display = 'none'; done.style.display = 'flex';
        done.innerHTML = `<div class="pos-ok">✓</div><h2>صدرت الفاتورة</h2><div class="pos-okno" dir="ltr">${posEsc(bill.no)}</div><div class="pos-oktot">${fmtNum(billTotals().total)} د.ع</div>
            <button type="button" class="pos-big go" onclick="p2New()">فاتورة جديدة</button><button type="button" class="pos-big alt" onclick="printInvoice()">🖨️ طباعة</button><button type="button" class="pos-big alt" onclick="billSharePdf()">📤 مشاركة PDF</button>${window.NAT && NAT.is ? '<button type="button" class="pos-big alt" onclick="NAT.printBill()">🧾 طباعة حرارية</button>' : ''}`;
        return;
    }
    done.style.display = 'none'; main.style.display = '';
    p2El('p2List').innerHTML = posGroups().map(p2CardHtml).join('') || '<div class="pos-empty"><div>🛒</div>امسح باركود أو اكتب اسم المادة للبدء</div>';
    const ex = p2El('p2Extra'); if (ex) ex.innerHTML = '';
    p2El('p2Panel').innerHTML = p2Panel();
    p2Sync();
}
