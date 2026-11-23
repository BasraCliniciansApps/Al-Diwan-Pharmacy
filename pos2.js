// =====================================================================
// شاشة البيع (التصميم الجديد؛ تحل محل شاشة pos.js التي بقيت مكتبة منطق مشتركة): على الكمبيوتر عمودان (المواد يميناً، ولوحة الملخص والدفع ثابتة يساراً)،
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
    d.innerHTML = `<div class="bill-top p2-top"><div class="brand-bar"><div class="brand-id"><span class="brand-logo"><img src="icon.jpg" alt=""><i class="sync-dot" data-state="ok"></i></span><span class="brand-name">صيدلية الديوان</span></div><div class="brand-actions"><button type="button" class="small-icon-btn" onclick="p2Home()" aria-label="الرئيسية">🏠</button><button type="button" class="small-icon-btn" onclick="helpOpen()" aria-label="مركز المعلومات" title="مركز المعلومات">ℹ️</button></div></div>
        <div class="page-title"><span id="p2Title">🛒 شاشة البيع</span><span class="p2-no" dir="ltr" id="p2No"></span></div></div>
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
    if (bill && bill.editing) { p2.extra = false; p2.paid = bill.paid === '' || bill.paid == null ? '' : String(bill.paid); }   // تعديل فاتورة صادرة: الآجل والمدفوع من الفاتورة نفسها
    p2El('p2Title').textContent = bill && bill.editing ? '✏️ تعديل الفاتورة' : '🛒 شاشة البيع';
    p2El('p2No').textContent = bill.no || '';
    p2El('p2Ov').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open');
    const q = p2El('p2Q'); if (q) q.value = ''; p2Results(); p2Render(); p2Focus();
}
// الرجوع: يغلق القسم المفتوح (خصم، آجل...) أولاً على الموبايل، ثم يخرج من نافذة البيع
function p2Back() {
    if (p2.acc && window.matchMedia && matchMedia('(max-width: 899px)').matches && P2_COMPACT) { p2.acc = null; p2Render(); return; }
    if (p2EditLive()) { p2EditExit(false); return; }
    p2Close();
}
const p2EditLive = () => !!(bill && bill.issued && bill.editing && typeof billEditBase !== 'undefined' && billEditBase);
async function p2EditExit(home) {   // الخروج من وضع التعديل دون حفظ: بعد تأكيد
    if (!(await askSure('إلغاء التعديل؟', 'ستضيع كل التغييرات غير المحفوظة على هذه الفاتورة.', 'إلغاء التعديل'))) return;
    try { cancelInvoiceEditNow(); } catch (e) { /* تجاهل */ }
    p2Close();
    if (home) { try { if (typeof currentView !== 'undefined' && currentView !== 'home') showView('home'); } catch (e) { /* تجاهل */ } }
}
function p2Home() { if (p2EditLive()) { p2EditExit(true); return; } p2Close(); try { if (typeof currentView !== 'undefined' && currentView !== 'home') showView('home'); } catch (e) { /* تجاهل */ } }
function p2Close() {
    p2.acc = null;
    const ov = p2El('p2Ov'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); p2.open = false;
    try { writeInvoiceFields(); renderInvoiceRows(); recalcInvoice(); updateIssuedUI(); } catch (e) { /* تجاهل */ }
}
function p2Focus() { const q = p2El('p2Q'); if (q && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) q.focus(); }
function p2New() {
    bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); p2.done = false; p2.extra = false; try { p2El('p2Title').textContent = '🛒 شاشة البيع'; } catch (e) { /* تجاهل */ } p2.recv = ''; p2.credit = false; p2.zero = false; p2.paid = '';
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
    const cb = code => { if (!p2.open) return; if (!posScanDup(code)) p2ByCode(code); setTimeout(() => { if (p2.open && !document.querySelector('.swal2-container')) p2Scan(); }, 350); };
    openBarcodeScanner(cb);
}

// ---------- بيانات الفاتورة الإضافية ----------
function p2Field(k, v) { bill[k] = k === 'doctor' ? fmtDoctor(v) : v; writeInvoiceFields(); recalcInvoice(); billChanged(); p2Totals(); }
function p2ToggleExtra() { p2.extra = !p2.extra; p2Render(); }

// ---------- الخصم والصافي (بنفس دوال pos.js دون تغيير) ----------
function p2SetDisc(v) { bill.discount = v ? String(v) : ''; writeInvoiceFields(); billChanged(); p2Totals(); }
function p2DiscPct(el) { const S = billTotals().sub, pc = parseFloat(el.value) || 0; p2SetDisc(posDiscForPct(S, pc)); const a = p2El('p2A'); if (a) a.value = bill.discount; }
function p2DiscAmt(el) { p2SetDisc(Math.max(0, parseFloat(el.value) || 0)); const S = billTotals().sub, d = billTotals().disc, p = p2El('p2P'); if (p) p.value = S > 0 && d > 0 ? Math.round(d / S * 1000) / 10 : ''; }
const p2ChipD = (k, S) => k === 'cost' ? posDiscForCost(S) : k === '0' ? 0 : k[0] === 'a' ? (+k.slice(1) < S ? +k.slice(1) : 0) : posDiscForPct(S, +k);   // 'aN' = خصم مبلغ ثابت N
function p2RStep(n) {   // نفس تسوية الألف في البيع السابق: تعديل سعر المادة المختارة بمقدار n موزعاً على كميتها
    const it = bill.items[p2.rcur]; if (!it) return;
    const np = (parseFloat(it.price) || 0) + n / (parseFloat(it.qty) || 1); if (np <= 0) return;
    it.price = np; billChanged(); p2Render();
}
function p2Chip(k) { const S = billTotals().sub; p2SetDisc(p2ChipD(k, S)); p2Sync(); }
function p2DiscMax() { p2SetDisc(posDiscForMax(billTotals().sub, posLimits().allow)); p2Sync(); }
function p2Sync() { const t = billTotals(), a = p2El('p2A'), p = p2El('p2P'); if (a) a.value = t.disc || ''; if (p) p.value = t.sub > 0 && t.disc > 0 ? Math.round(t.disc / t.sub * 1000) / 10 : ''; p2Totals(); }
function p2Totals() {   // تحديث الأرقام دون إعادة رسم اللوحة (حتى لا يضيع المؤشر من الحقول)
    const t = billTotals(), L = posLimits(), set = (id, v) => { const e = p2El(id); if (e) e.textContent = v; };
    set('p2Sub', fmtNum(t.sub) + ' د.ع'); set('p2Dsc', t.disc > 0 ? '− ' + fmtNum(t.disc) + ' د.ع' : '0'); set('p2Net', fmtNum(t.total)); set('p2NetBar', fmtNum(t.total)); set('p2NetBar2', fmtNum(t.total)); p2CrSync();
    { const bd = p2El('p2BdD'); if (bd) { bd.hidden = !(t.disc > 0); bd.textContent = fmtNum(t.disc); } set('p2FSum', posGroups().length + ' مواد' + (t.disc > 0 ? ' · الخصم ' + fmtNum(t.disc) + ' د.ع' : '')); }
    const mx = p2El('p2Max'); if (mx) mx.textContent = L.unknown && L.own ? 'أعلى خصم غير محسوب لبعض المواد (لا كلفة)' : 'أعلى خصم بدون خسارة: ' + (t.sub > 0 ? Math.floor(L.allow / t.sub * 1000) / 10 : 0) + '٪ (' + fmtNum(L.allow) + ' د.ع)';
    const m = p2El('p2Msg');
    if (m) {
        if (t.disc > 0) { if (t.disc > L.allow && !(L.own && L.unknown)) { m.className = 'px-msg bad'; m.textContent = L.own ? '🔴 خسارة: الخصم أعلى من الحد الآمن' : '🔴 يتجاوز الحد المسموح'; } else { m.className = 'px-msg ok'; m.textContent = '🟢 خصم آمن'; } } else { m.className = 'px-msg'; m.textContent = ''; }
    }
    document.querySelectorAll('#p2Round input[name=p2RI]').forEach(x => { const e = p2El('p2RP' + x.value); if (e && bill.items[x.value]) e.textContent = fmtNum(bill.items[x.value].price); });
    document.querySelectorAll('#p2Chips > button').forEach(b => { const k = b.dataset.p, cd = p2ChipD(k, t.sub); b.disabled = k !== '0' && (cd <= 0 || (!L.own && cd > L.allow)); b.classList.toggle('on', k === '0' ? t.disc === 0 : cd > 0 && t.disc === cd); });
    p2CalcRefresh();
}

// ---------- حاسبة الباقي (للعرض فقط، لا تُخزَّن في الفاتورة) ----------
function p2RecvAdd(n) { p2RecvSet((parseFloat(p2.recv) || 0) + n); }   // كل ضغطة تضيف الفئة إلى المبلغ المستلم
function p2RecvSet(v) { p2.recv = v === '' ? '' : String(v); const i = p2El('p2R'); if (i) i.value = p2.recv; p2CalcRefresh(); }
function p2CalcRefresh() {
    const box = p2El('p2Chg'); if (!box) return;
    const net = p2Net(), r = parseFloat(p2.recv);
    const q = p2El('p2Quick'); if (q && !q.dataset.r) { q.dataset.r = '1'; q.innerHTML = P2_NOTES.map(n => `<button type="button" onclick="p2RecvAdd(${n})">${fmtNum(n)}</button>`).join('') + '<button type="button" class="m" onclick="p2RecvSet(Math.round(p2Net()))">مطابق</button><button type="button" class="c" onclick="p2RecvSet(\'\')">مسح</button>'; }
    p2CrSync();
    if (!(r >= 0) || p2.recv === '') { box.className = 'p2-chg'; box.innerHTML = '<span>الباقي للزبون</span><b>—</b>'; return; }
    if (r >= net) { box.className = 'p2-chg ok'; box.innerHTML = `<span>الباقي للزبون</span><b>${fmtNum(r - net)} د.ع</b>`; }
    else { box.className = 'p2-chg bad'; box.innerHTML = `<span>ناقص</span><b>${fmtNum(net - r)} د.ع</b><small>سيُسجَّل المتبقي آجلاً عند الإصدار.</small>`; }
}
function p2CalcToggle(on) { try { localStorage.setItem(P2_CALC_LS, on ? '1' : '0'); } catch (e) { /* تجاهل */ } p2.recv = ''; p2Render(); }
// البيع الآجل: يتفعّل تلقائياً عند الضغط على «لم يُدفع شيء» أو كتابة مبلغ مدفوع أقل من الصافي، ويُلغى بإزالتهما
function p2CrSync() {   // مصادر الآجل: زر «لم يُدفع شيء» ثم حقل المدفوع ثم نقص المبلغ المستلم في الحاسبة
    const tot = billTotals().total, pd = parseFloat(p2.paid), rv = parseFloat(p2.recv);
    let src = '', paid = 0;
    if (p2.zero) src = 'zero';
    else if (p2.paid !== '' && pd >= 0 && pd < tot) { src = 'paid'; paid = pd; }
    else if (p2Calc() && p2.recv !== '' && rv >= 0 && rv < tot) { src = 'calc'; paid = rv; }
    p2.credit = !!src; p2.paidEff = paid; p2.crSrc = src;
    const inf = p2El('p2CrInfo'); if (inf) inf.textContent = src ? 'المتبقي آجل: ' + fmtNum(tot - paid) + ' د.ع' + (src === 'calc' ? ' (من المبلغ المستلم في الحاسبة)' : '') : (p2.paid !== '' && pd >= tot ? 'المبلغ المدفوع يغطي الصافي كاملاً، فلا يُعدّ البيع آجلاً' : '');
    const bd = p2El('p2BdR'); if (bd) bd.hidden = !p2.credit;
}
function p2CrZero() { p2.zero = !p2.zero; if (p2.zero) { p2.paid = ''; const f = p2El('p2Paid'); if (f) f.value = ''; } const z = p2El('p2CrZ'); if (z) z.classList.toggle('on', p2.zero); p2CrSync(); }
function p2CrPaid(v) { p2.paid = v; if (v !== '') { p2.zero = false; const z = p2El('p2CrZ'); if (z) z.classList.remove('on'); } p2CrSync(); }

// ---------- الإصدار (نفس منطق التحقق في posIssue) ----------
// منع الضغط المزدوج: لا يبدأ إصدار جديد قبل انتهاء الحالي (بما فيه النوافذ)، ولا بعد صدور الفاتورة
async function p2Issue(print) {
    if (p2.busy || p2.done || (bill && bill.issued && !bill.editing)) return;
    p2.busy = true;
    const bs = [...document.querySelectorAll('.p2-btns .pos-big')]; bs.forEach(b => { b.disabled = true; });
    try { await p2Issue_(print); }
    finally { p2.busy = false; document.querySelectorAll('.p2-btns .pos-big').forEach(b => { b.disabled = false; }); }
}
async function p2Issue_(print) {
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
    p2CrSync(); const t = billTotals();
    bill.paid = p2.credit ? String(Math.min(p2.paidEff, t.total)) : '';
    writeInvoiceFields(); billChanged(); try { qiRemember(); } catch (e) { /* تجاهل */ }
    if (p2.credit) {   // تنبيه: البيع سيُسجَّل آجلاً بالمتبقي
        const cw = await Swal.fire({ icon: 'warning', title: 'بيع آجل', html: `المبلغ المدفوع: <b>${fmtNum(p2.paidEff)} د.ع</b><br>المتبقي غير المدفوع: <b style="color:#b91c1c">${fmtNum(t.total - p2.paidEff)} د.ع</b><br>سيُسجَّل المتبقي ديناً على الزبون، ويلزم إدخال اسمه.`, showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38' });
        if (!cw.isConfirmed) return;
    }
    let mode = '';
    const needCu = p2.credit && !bill.customer;
    if (print || needCu) { if (!(await p2AskInfo(needCu))) return; }   // 1) استكمال بيانات الفاتورة (اسم الزبون إلزامي للآجل)
    if (print) { mode = await p2AskMode(); if (!mode) return; }
    writeInvoiceFields();
    await issueInvoice(false, true);
    if (bill.issued) { p2.done = true; if (print) p2PrintBy(mode); }
    p2Render();
}
// ---------- وضع تعديل فاتورة صادرة: طيّة بيانات الفاتورة + الحفظ (التصحيح بالفرق يتولاه saveInvoiceEdit) ----------
function p2EditFold() {
    const v = k => posEsc(bill[k] || ''), open = p2.extra;
    const sm = [bill.customer, bill.to, bill.doctor].filter(Boolean).map(posEsc).join(' · ');
    return `<button type="button" class="pos-more p2-fold" onclick="p2ToggleExtra()">${open ? '▲ إخفاء بيانات الفاتورة' : '▼ بيانات الفاتورة'}</button>` + (open ? `<div class="pos-fields">
        <label>إلى السيد / الشركة<input list="qiDl_to" autocomplete="off" placeholder="اختياري" value="${v('to')}" onchange="p2Field('to', this.value)"></label>
        <label>اسم الزبون<input list="qiDl_customer" autocomplete="off" placeholder="اختياري" value="${v('customer')}" onchange="p2Field('customer', this.value)"></label>
        <label>اسم الطبيب المعالج<input list="qiDl_doctor" autocomplete="off" placeholder="اختياري" value="${v('doctor')}" onchange="p2Field('doctor', this.value); this.value = bill.doctor"></label>
        <label>التاريخ (ثابت)<input type="date" value="${posEsc(bill.date || todayLocalISO())}" disabled></label>
        <label>ملاحظات<textarea rows="2" onchange="p2Field('notes', this.value)">${v('notes')}</textarea></label>
        ${['to', 'customer', 'doctor'].map(k => qiDl(k)).join('')}</div>` : `<div class="p2-fsm">${sm || 'لا توجد بيانات'}</div>`);
}
async function p2SaveEdit(print) {
    if (p2.busy || !p2EditLive()) return;
    p2.busy = true; document.querySelectorAll('.p2-btns .pos-big').forEach(b => { b.disabled = true; });
    try { await p2SaveEdit_(print); }
    finally { p2.busy = false; document.querySelectorAll('.p2-btns .pos-big').forEach(b => { b.disabled = false; }); }
}
async function p2SaveEdit_(print) {
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'لا يمكن حفظ فاتورة بلا مواد. استعمل «إلغاء الفاتورة» بدلاً من ذلك.', confirmButtonColor: '#0f1c38' }); return; }
    writeInvoiceFields();
    const L = posLimits(), d = parseFloat(bill.discount) || 0, msg = t => { const e = p2El('p2Val'); if (e) { e.textContent = t || ''; e.style.display = t ? '' : 'none'; } };
    msg('');
    if (userRole !== 'owner' && d > L.allow) { msg(L.allow > 0 ? 'الخصم يتجاوز الحد المسموح' : 'لا يُسمح بخصم على هذه المواد'); return; }
    if (d > 0 && L.own && !L.unknown && d > L.allow) {
        const w = await Swal.fire({ icon: 'warning', title: 'تحذير: بيع بخسارة', html: `الخصم <b>${fmtNum(d)} د.ع</b> أعلى من الحد الآمن <b>${fmtNum(L.allow)} د.ع</b>.<br>هذه الفاتورة ستُباع <b style="color:#b91c1c">بخسارة تقارب ${fmtNum(d - L.allow)} د.ع</b>.<br>هل تريد حفظها رغم ذلك؟`, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، حفظ بخسارة', cancelButtonText: 'رجوع' });
        if (!w.isConfirmed) return;
    }
    p2CrSync(); const t = billTotals();
    bill.paid = p2.credit ? String(Math.min(p2.paidEff, t.total)) : '';
    if (p2.credit && !bill.customer) { msg('اسم الزبون مطلوب للبيع الآجل: أدخله في «بيانات الفاتورة»'); p2.extra = true; p2Render(); return; }
    writeInvoiceFields(); billChanged(); try { qiRemember(); } catch (e) { /* تجاهل */ }
    const ok = await saveInvoiceEdit(false);
    if (!bill.editing) { p2Close(); if (ok && print) printInvoice(); }   // انتهى التعديل (حُفظ أو حُدّثت الفاتورة من السحابة): نعود لعرض الفاتورة
}
// نافذة بيانات الفاتورة قبل الطباعة: تظهر إن كان أحد حقول (الشركة، الزبون، الطبيب) فارغاً. تُرجع false عند الإلغاء.
async function p2AskInfo(needCu) {
    if (!needCu && bill.to && bill.customer && bill.doctor) return true;
    const v = x => posEsc(bill[x] || '');
    const r = await Swal.fire({
        title: needCu ? 'بيانات الزبون (بيع آجل)' : 'بيانات الفاتورة', showCancelButton: true, showDenyButton: !needCu, confirmButtonText: 'متابعة', denyButtonText: 'تخطي', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="pos-fields" style="text-align:right">
            <label>إلى السيد / الشركة<input id="p2qTo" list="qiDl_to" autocomplete="off" placeholder="اختياري" value="${v('to')}"></label>
            <label>اسم الزبون<input id="p2qCu" list="qiDl_customer" autocomplete="off" placeholder="${needCu ? 'مطلوب للبيع الآجل' : 'اختياري'}" value="${v('customer')}"></label>
            <label>اسم الطبيب المعالج<input id="p2qDo" list="qiDl_doctor" autocomplete="off" placeholder="اختياري" value="${v('doctor')}"></label>
            <label>التاريخ<input id="p2qDt" type="date" value="${posEsc(bill.date || todayLocalISO())}"></label>
            <label>ملاحظات<textarea id="p2qNo" rows="2">${v('notes')}</textarea></label>
            ${['to', 'customer', 'doctor'].map(k => qiDl(k)).join('')}</div>`,
        preConfirm: () => { const g = id => document.getElementById(id); if (needCu && !g('p2qCu').value.trim()) { Swal.showValidationMessage('اسم الزبون مطلوب للبيع الآجل'); return false; } return { to: g('p2qTo').value.trim(), customer: g('p2qCu').value.trim(), doctor: g('p2qDo').value.trim(), date: g('p2qDt').value, notes: g('p2qNo').value.trim() }; }
    });
    if (r.isDismissed) return false;
    if (r.isConfirmed && r.value) { const o = r.value; bill.to = o.to; bill.customer = o.customer; bill.doctor = fmtDoctor(o.doctor); bill.notes = o.notes; bill.date = o.date || todayLocalISO(); try { qiRemember(); } catch (e) { /* */ } }
    return true;
}
// نافذة اختيار طريقة الطباعة: pdf / normal / thermal. تُرجع '' عند الإلغاء.
async function p2AskMode() {
    window.__p2pm = '';
    const b = (k, ic, t, d) => `<button type="button" class="p2-pm" onclick="window.__p2pm='${k}';Swal.clickConfirm()"><span class="p2-pm-i">${p2Ic(ic)}</span><span><b>${t}</b><small>${d}</small></span></button>`;
    const r = await Swal.fire({
        title: 'طريقة الطباعة', showConfirmButton: false, showCancelButton: true, cancelButtonText: 'إلغاء',
        html: `<div class="p2-pms">${b('pdf', 'file-text', 'ملف PDF', 'حفظ الفاتورة كملف PDF')}${b('normal', 'printer', 'طابعة عادية', 'طباعة A4 عبر نافذة الطباعة')}${b('thermal', 'receipt-text', 'طابعة حرارية', 'طباعة إيصال عبر البلوتوث')}</div>`
    });
    return r.isConfirmed ? window.__p2pm : '';
}
function p2PrintBy(mode) {
    if (mode === 'thermal') {
        if (window.NAT && NAT.is && typeof NAT.printBill === 'function') { try { readInvoiceFields(); } catch (e) { /* */ } NAT.printBill(); }
        else Swal.fire({ icon: 'info', title: 'الطباعة الحرارية تعمل داخل تطبيق الأندرويد فقط', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return;
    }
    printInvoice();
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
function p2BatchRow(g, p) {   // كل دفعة في سطر مستقل بكامل العرض، ولكل سطر أسهمه
    if (!g.pid || !p) return '';
    const bats = p2Batches(p, g.unit), multi = g.lines.length > 1;
    const rows = g.lines.map((it, i) => {
        const cur = bats.findIndex(b => spKey(b.e, b.pr) === spKey(it.exp, it.bpr)), av = cur >= 0 ? bats[cur].av : null;
        const arrows = bats.length > 1 && cur >= 0;
        const prev = arrows ? `<button type="button" class="p2-arr" onclick="p2BatchStep('${g.key}',${i},-1)" ${cur <= 0 ? 'disabled' : ''} aria-label="الدفعة السابقة">${p2Ic('chevron-right')}</button>` : '';
        const next = arrows ? `<button type="button" class="p2-arr" onclick="p2BatchStep('${g.key}',${i},1)" ${cur >= bats.length - 1 ? 'disabled' : ''} aria-label="الدفعة التالية">${p2Ic('chevron-left')}</button>` : '';
        return `<div class="p2-brow">${prev}${p2ChipHtml(it, multi ? null : av, g.key, true)}${next}</div>`;
    }).join('');
    return `<div class="p2-batches">${rows}</div>`;
}
function p2BatchStep(key, idx, d) {
    const g = posGroup(key); if (!g) return;
    const p = products.find(x => x.id === g.pid); if (!p) return;
    const it = g.lines[idx]; if (!it) return;
    const bats = p2Batches(p, g.unit), cur = bats.findIndex(b => spKey(b.e, b.pr) === spKey(it.exp, it.bpr)), nx = bats[cur + d];
    if (cur < 0 || !nx) return;
    const q = parseFloat(it.qty) || 0;
    const twin = g.lines.find(o => o !== it && spKey(o.exp, o.bpr) === spKey(nx.e, nx.pr));   // سطر آخر على نفس الدفعة الهدف
    const cap = nx.av - (twin ? (parseFloat(twin.qty) || 0) : 0);   // المتاح فعلياً في الدفعة الهدف
    if (cap <= 0) { Swal.fire({ icon: 'warning', title: 'لا يوجد متاح في هذه الدفعة', toast: true, position: 'top', showConfirmButton: false, timer: 2000 }); return; }
    const take = Math.min(q, cap);   // الكمية المنقولة؛ والباقي يبقى على الدفعة الحالية (توزيع تلقائي)
    const apply = o => {   // ضبط دفعة وسعر السطر على الدفعة الهدف
        const hadBP = o.bpr > 0;
        if (nx.e) o.exp = nx.e; else delete o.exp;
        if (nx.pr) o.bpr = nx.pr; else delete o.bpr;
        if (nx.pr > 0) o.price = g.unit === 'part' ? (subPriceCalc(nx.pr, btSc(p)) || 0) : nx.pr;
        else if (hadBP) o.price = g.unit === 'part' ? subPriceOf(p) : (parseFloat(p.price) || 0);   // رجوع للسعر العادي بعد سعر دفعة خاص
    };
    if (take >= q) {   // نقل كامل
        apply(it);
        if (twin) { it.qty = q + (parseFloat(twin.qty) || 0); bill.items = bill.items.filter(x => x !== twin); }
    } else {   // نقل جزئي: يبقى الباقي على الدفعة الحالية
        it.qty = q - take;
        if (twin) twin.qty = (parseFloat(twin.qty) || 0) + take;
        else { const n = { ...it, qty: take }; apply(n); bill.items.splice(bill.items.indexOf(it) + 1, 0, n); }
    }
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
// ===== واجهة الموبايل المضغوطة (< 900px): أزرار مطوية بدل الأقسام المفتوحة. للرجوع للوضع السابق اجعل P2_COMPACT = false =====
const P2_COMPACT = true;
function p2Acc(k) { p2.acc = p2.acc === k ? null : k; p2Render(); }
function p2Pills(hasRnd) {
    if (!P2_COMPACT) return '';
    const bd = (id, on, txt) => `<i class="p2-bd" id="${id}" ${on ? '' : 'hidden'}>${txt || ''}</i>`;
    const b = (k, lbl, badge, cls) => `<button type="button" class="p2-pill${cls || ''}${p2.acc === k ? ' on' : ''}" onclick="p2Acc('${k}')"><span>${lbl}</span>${badge}</button>`;
    return `<div class="p2-pills"><div class="p2-pr">${b('disc', 'خصم', bd('p2BdD', false))}${hasRnd ? b('rnd', 'تسوية الألف', '') : ''}${b('cr', 'بيع آجل', bd('p2BdR', p2.credit, '✓'))}</div>${b('calc', 'حاسبة الباقي', bd('p2BdC', p2Calc(), '✓'), ' p2-pill-wide')}</div>`;
}
function p2Fit() {   // ارتفاع التذييل الثابت والقسم المفتوح: لإزاحة المحتوى ووضع شريط الصافي فوقهما
    const ov = p2El('p2Ov'), a = ov && ov.querySelector('.p2-act'); if (!a) return;
    const op = ov.querySelector('.p2-acc-b.open'), sb = ov.querySelector('.p2-sumbar');
    const set = () => { ov.style.setProperty('--p2fh', a.offsetHeight + 'px'); ov.style.setProperty('--p2oh', (op && getComputedStyle(op).position === 'fixed' ? op.offsetHeight : 0) + 'px'); ov.style.setProperty('--p2sh', (sb ? sb.offsetHeight : 44) + 'px'); };
    set();
    if (window.ResizeObserver) { if (p2.ro) p2.ro.disconnect(); p2.ro = new ResizeObserver(set); p2.ro.observe(a); if (op) p2.ro.observe(op); }
}
window.addEventListener('resize', () => { try { p2Fit(); } catch (e) { /* */ } });
function p2Panel() {
    const el = typeof qiEligible === 'function' ? qiEligible() : [];
    if (!el.includes(p2.rcur)) p2.rcur = el[0];
    const o = k => p2.acc === k ? ' open' : '', t = billTotals(), L = posLimits(), showLim = userRole === 'owner' || (typeof can === 'function' && can('scanDisc')), n = posGroups().length;
    return `<div class="p2-sec p2-hm">ملخص الفاتورة</div>
        <div class="p2-row p2-hm"><span>عدد المواد</span><b>${n}</b></div>
        <div class="p2-row p2-hm"><span>المجموع قبل الخصم</span><b id="p2Sub"></b></div>
        <div class="p2-row p2-hm"><span>الخصم</span><b id="p2Dsc"></b></div>
        <div class="p2-acc-b${o('disc')}"><div class="p2-sec">الخصم</div>
        <div class="px-row"><label><span>نسبة الخصم ٪</span><input id="p2P" type="number" inputmode="decimal" min="0" step="any" oninput="p2DiscPct(this)"></label><label><span>مبلغ الخصم (د.ع)</span><input id="p2A" type="number" inputmode="numeric" min="0" oninput="p2DiscAmt(this)"></label></div>
        <div class="px-chips p2-chips1" id="p2Chips"><button type="button" data-p="0" class="clr" onclick="p2Chip('0')" aria-label="بدون خصم">0٪</button>${[5, 10, 15, 20].map(k => `<button type="button" data-p="${k}" onclick="p2Chip('${k}')">${k}٪</button>`).join('')}${posCostChipOn() ? '<button type="button" data-p="cost" class="cost" onclick="p2Chip(\'cost\')">سعر الكلفة</button>' : ''}</div>
        ${showLim ? '<button type="button" class="px-max" id="p2Max" onclick="p2DiscMax()"></button>' : ''}
        <div id="p2Msg" class="px-msg"></div></div>
        <div class="p2-acc-b${o('rnd')}">${el.length ? `<div id="p2Round" class="p2-rnd"><div class="px-sec">تسوية المجموع إلى ألف كاملة</div>
            <div class="px-rl">${el.map(i => `<label class="px-rr"><input type="radio" name="p2RI" value="${i}" ${i === p2.rcur ? 'checked' : ''} onchange="p2.rcur=${i}"><span class="px-rn" dir="ltr">${posEsc(bill.items[i].name)}</span><b id="p2RP${i}"></b></label>`).join('')}</div>
            <div class="px-st">${[250, 500, 750].map(n => `<div class="px-sc"><button type="button" class="up" onclick="p2RStep(${n})" aria-label="زيادة ${n}">+</button><b>${n}</b><button type="button" class="dn" onclick="p2RStep(-${n})" aria-label="نقص ${n}">−</button></div>`).join('')}</div></div>` : ''}</div>
        <div class="p2-netbox p2-hm"><span>الصافي</span><b id="p2Net"></b><i>د.ع</i></div>
        <div class="p2-acc-b${o('calc')}"><div class="p2-sec p2-sec-sw"><span>حاسبة الباقي (بيع نقدي)</span><label class="setup-sw"><input type="checkbox" ${p2Calc() ? 'checked' : ''} onchange="p2CalcToggle(this.checked)" aria-label="حاسبة الباقي"><i></i></label></div>
        ${p2Calc() ? `<label class="p2-recv"><span>المبلغ المستلم (د.ع)</span><input id="p2R" type="number" inputmode="numeric" min="0" value="${posEsc(p2.recv)}" oninput="p2.recv=this.value;p2CalcRefresh()"></label>
            <div class="p2-quick" id="p2Quick"></div><div id="p2Chg" class="p2-chg"></div>` : ''}</div>
        <div class="p2-acc-b${o('cr')}"><div class="p2-sec">بيع آجل</div>
            <button type="button" id="p2CrZ" class="p2-crfull${p2.zero ? ' on' : ''}" onclick="p2CrZero()">لم يُدفع شيء (كامل المبلغ آجل)</button>
            <label class="p2-recv"><span>المبلغ المدفوع (د.ع)</span><input id="p2Paid" type="number" inputmode="numeric" min="0" value="${posEsc(p2.paid)}" placeholder="اتركه فارغاً إن لم يكن البيع آجلاً" oninput="p2CrPaid(this.value)"></label>
            <div id="p2CrInfo" class="p2-crinfo"></div></div>
        <div class="p2-sumbar" id="p2SumBar"><span class="p2-sb-l">الصافي <small id="p2FSum"></small></span><b><span id="p2NetBar2"></span> <i>د.ع</i></b></div>
        <div class="p2-act"><div class="px-val" id="p2Val" style="display:none" role="alert"></div>
            ${p2Pills(el.length > 0)}<div class="p2-netbar"><span>الصافي</span><b id="p2NetBar">${fmtNum(t.total)}</b><i>د.ع</i></div>
            <div class="p2-btns">${bill.editing ? '<button type="button" class="pos-big alt" onclick="p2SaveEdit(false)">حفظ التعديل</button><button type="button" class="pos-big go" onclick="p2SaveEdit(true)">حفظ وطباعة</button>' : '<button type="button" class="pos-big alt" onclick="p2Issue(false)">إصدار فقط</button><button type="button" class="pos-big go" onclick="p2Issue(true)">إصدار وطباعة</button>'}</div></div>`;
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
    const ex = p2El('p2Extra'); if (ex) ex.innerHTML = bill.editing ? p2EditFold() : '';
    p2El('p2Panel').classList.toggle('p2c', P2_COMPACT);
    p2El('p2Panel').innerHTML = p2Panel();
    p2Sync(); p2Fit();
}

// كل مداخل شاشة البيع (البطاقة، F2، أيقونة الأندرويد، زر الفاتورة) تفتح هذه الشاشة
window.posOpen = p2Open; window.posClose = p2Close;
