// =====================================================================
// نظام الفواتير (للصيدلي فقط): جديدة، صادرة، آجل، تقارير، طلب شراء، إعدادات
// =====================================================================
const BILL_LS = { list: 'diwanInvoicesLocal', draft: 'diwanInvoiceDraft', seq: 'diwanInvoiceSeq', meta: 'diwanInvoiceMeta', sig: 'diwanInvoiceSig', stamp: 'diwanInvoiceStamp', supplier: 'diwanPoSupplier' };
let bill = null;
let billSaveTimer = null;
let billAll = [];            // كل الفواتير الصادرة (محلي + سحابي)
let currentBillTab = 'new';

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* تجاهل */ } }
const $b = id => document.getElementById(id);

function todayLocalISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDateDMY(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
function fmtNum(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function nextInvoiceNumber() { return 'INV-' + String((parseInt(lsGet(BILL_LS.seq)) || 0) + 1).padStart(4, '0'); }
function emptyInvoice() {
    return { id: '', no: nextInvoiceNumber(), to: '', date: todayLocalISO(), items: [], discount: '', paid: '', customer: '', doctor: '', notes: '', issued: false, cancelled: false, deduct: true };
}

// ---------- تفقيط المبلغ بالعربية ----------
const AR_UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUND = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function arBelow100(n) {
    if (n < 20) return AR_UNITS[n];
    const u = n % 10, t = Math.floor(n / 10);
    return (u ? AR_UNITS[u] + ' و' : '') + AR_TENS[t];
}
function arGroup(n) {   // 1..999
    const h = Math.floor(n / 100), r = n % 100;
    const parts = [];
    if (h) parts.push(AR_HUND[h]);
    if (r) parts.push(arBelow100(r));
    return parts.join(' و');
}
function arScale(n, one, two, few, many) {   // n بين 1 و 999
    if (n === 1) return one;
    if (n === 2) return two;
    if (n >= 3 && n <= 10) return arGroup(n) + ' ' + few;
    return arGroup(n) + ' ' + many;
}
function numberToArabicWords(num) {
    num = Math.round(Number(num) || 0);
    if (num <= 0) return num === 0 ? 'صفر' : '';
    if (num >= 1e12) return '';
    const bil = Math.floor(num / 1e9), mil = Math.floor(num / 1e6) % 1000, th = Math.floor(num / 1e3) % 1000, rest = num % 1000;
    const parts = [];
    if (bil) parts.push(arScale(bil, 'مليار', 'ملياران', 'مليارات', 'مليار'));
    if (mil) parts.push(arScale(mil, 'مليون', 'مليونان', 'ملايين', 'مليون'));
    if (th) parts.push(arScale(th, 'ألف', 'ألفان', 'آلاف', 'ألف'));
    if (rest) parts.push(arGroup(rest));
    return parts.join(' و');
}


// ---------- الحالة والحفظ ----------
function billChanged() {
    readInvoiceFields();
    recalcInvoice();
    clearTimeout(billSaveTimer);
    billSaveTimer = setTimeout(() => lsSet(BILL_LS.draft, JSON.stringify(bill)), 300);
}
function readInvoiceFields() {
    const v = id => $b(id).value;
    bill.no = v('billNo'); bill.to = v('billTo'); bill.date = v('billDate');
    bill.discount = v('billDiscount'); bill.paid = v('billPaid');
    bill.customer = v('billCustomer'); bill.doctor = v('billDoctor'); bill.notes = v('billNotes');
    bill.deduct = $b('billDeduct').checked;
}
function writeInvoiceFields() {
    const set = (id, val) => { $b(id).value = val == null ? '' : val; };
    set('billNo', bill.no); set('billTo', bill.to); set('billDate', bill.date);
    set('billDiscount', bill.discount); set('billPaid', bill.paid);
    set('billCustomer', bill.customer); set('billDoctor', bill.doctor); set('billNotes', bill.notes);
    autoGrow($b('billNotes'));
    $b('billDeduct').checked = bill.deduct !== false;
    updateIssuedUI();
}
function updateIssuedUI() {
    const note = $b('billIssuedNote'), chk = $b('billDeduct'), sheet = $b('billSheet');
    const show = (id, on) => { $b(id).style.display = on ? '' : 'none'; };
    const issued = !!bill.issued, cancelled = !!bill.cancelled, editing = issued && !!bill.editing;
    sheet.classList.toggle('locked', issued && !editing);
    sheet.classList.toggle('cancelled', cancelled);
    show('billNewBtn', !editing);
    show('billPrintOnlyBtn', !issued); show('billIssueOnlyBtn', !issued); show('billIssueBtn', !issued);
    show('billReprintBtn', issued && !editing && !cancelled); show('billEditBtn', issued && !editing && !cancelled); show('billCancelBtn', issued && !editing && !cancelled); show('billDeleteBtn', issued && cancelled);
    show('billEditBackBtn', editing); show('billSaveEditBtn', editing); show('billSaveEditPrintBtn', editing);
    if (issued) {
        note.style.display = 'block';
        note.className = 'bill-issued no-print' + (cancelled ? ' bad' : '');
        note.innerText = editing ? '✏️ وضع التعديل: عدّل ما تشاء ثم احفظ — سيُصحَّح المخزن تلقائياً بالفرق.'
            : cancelled
            ? '✖ هذه الفاتورة ملغاة' + (bill.cancelledAt ? ' بتاريخ ' + fmtDateDMY(bill.cancelledAt) : '') + (bill.deducted ? ' وأُرجعت الكميات للمخزن.' : '.')
            : '✅ صدرت هذه الفاتورة' + (bill.issuedAt ? ' بتاريخ ' + fmtDateDMY(bill.issuedAt) : '') + (bill.deducted ? ' وتم خصم الكميات من المخزن.' : ' (بدون خصم من المخزن).') + (bill.editedAt ? ' • عُدّلت بتاريخ ' + fmtDateDMY(bill.editedAt.slice(0, 10)) : '');
        chk.disabled = true;
    } else { note.style.display = 'none'; chk.disabled = false; }
}
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 28) + 'px'; }

function billTotals() {
    const sub = bill.items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    let disc = parseFloat(bill.discount) || 0;
    disc = Math.min(Math.max(disc, 0), sub);
    const total = sub - disc;
    const paidRaw = bill.paid === '' || bill.paid == null ? null : (parseFloat(bill.paid) || 0);
    return { sub, disc, total, paid: paidRaw, rem: paidRaw === null ? null : Math.max(total - paidRaw, 0) };
}
function recalcInvoice() {
    const t = billTotals();
    $b('billSub').innerText = fmtNum(t.sub) + ' د.ع';
    $b('billTotal').innerText = fmtNum(t.total) + ' د.ع';
    $b('billRemRow').style.display = t.paid === null ? 'none' : 'flex';
    $b('billRem').innerText = fmtNum(t.rem || 0) + ' د.ع';
    $b('billDateTxt').innerText = fmtDateDMY(bill.date);
    const w = numberToArabicWords(t.total);
    $b('billWords').innerHTML = (t.total > 0 && w) ? `<span>المبلغ كتابةً:</span> ${escapeHtml(w)} دينار عراقي فقط لا غير` : '';
    bill.items.forEach((it, i) => {
        const el = $b('billSum' + i);
        if (el) el.innerText = fmtNum((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0));
        const pv = $b('billPv' + i); if (pv) pv.innerText = it.price === '' ? '' : fmtNum(it.price);
        const qv = $b('billQv' + i); if (qv) qv.innerText = fmtNum(it.qty) + (it.unit === 'part' && it.partType ? ' ' + it.partType : '');
    });
    $b('billDiscTxt').innerText = t.disc ? fmtNum(t.disc) + ' د.ع' : '';
    $b('billPaidTxt').innerText = t.paid === null ? '' : fmtNum(t.paid) + ' د.ع';
    $b('billDiscRow').classList.toggle('bill-empty', !t.disc);
}
function itemProduct(it) { return it.pid ? products.find(x => x.id === it.pid) : null; }
function renderInvoiceRows() {
    const body = $b('billRows');
    if (!bill.items.length) {
        body.innerHTML = `<tr class="bill-empty-row no-print"><td colspan="6">لم تُضف مواد بعد. ابحث بالاسم أو امسح الباركود أو أضف سطراً.</td></tr>`;
    } else {
        body.innerHTML = bill.items.map((it, i) => {
            const p = itemProduct(it);
            const unitSel = p && hasRetail(p)
                ? `<select class="bill-unit no-print" onchange="billSetUnit(${i}, this.value)"><option value="pack" ${it.unit !== 'part' ? 'selected' : ''}>عبوة</option><option value="part" ${it.unit === 'part' ? 'selected' : ''}>${escapeHtml(subTypeOf(p))} (جزء)</option></select>` : '';
            return `
            <tr>
                <td class="c-n">${i + 1}</td>
                <td class="c-name"><textarea rows="1" dir="auto" oninput="billItemEdit(${i}, 'name', this.value); autoGrow(this)">${escapeHtml(it.name)}</textarea>${unitSel}</td>
                <td class="c-qty has-pv"><div class="bill-stepper"><button type="button" class="bill-step" onclick="billStep(${i}, -1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(String(it.qty))}" oninput="billItemEdit(${i}, 'qty', this.value)"><button type="button" class="bill-step" onclick="billStep(${i}, 1)" aria-label="زيادة">+</button></div><span class="bill-pv" id="billQv${i}"></span></td>
                <td class="c-price has-pv"><input type="number" inputmode="decimal" min="0" value="${escapeHtml(String(it.price))}" oninput="billItemEdit(${i}, 'price', this.value)"><span class="bill-pv" id="billPv${i}"></span></td>
                <td class="c-sum" id="billSum${i}">0</td>
                <td class="c-del no-print"><button type="button" aria-label="حذف السطر" onclick="billRemoveRow(${i})">✕</button></td>
            </tr>`;
        }).join('');
        body.querySelectorAll('textarea').forEach(autoGrow);
    }
    recalcInvoice();
}
function billItemEdit(i, field, val) { if (!bill.items[i]) return; bill.items[i][field] = val; billChanged(); }
function billStep(i, d) {
    const it = bill.items[i]; if (!it) return;
    it.qty = Math.max(0, (parseFloat(it.qty) || 0) + d);
    const inp = $b('billRows').querySelectorAll('tr')[i].querySelector('.c-qty input'); if (inp) inp.value = it.qty;
    billChanged();
}
function billSetUnit(i, unit) {
    const it = bill.items[i], p = itemProduct(it); if (!it || !p) return;
    it.unit = unit; it.partType = unit === 'part' ? subTypeOf(p) : '';
    it.price = unit === 'part' ? subPriceOf(p) : (p.price || '');
    renderInvoiceRows(); billChanged();
}
async function billRemoveRow(i) { const it = bill.items[i]; if (!it) return; if (!(await askSure('حذف هذا السطر من الفاتورة؟', it.name || '', 'حذف'))) return; bill.items.splice(i, 1); renderInvoiceRows(); billChanged(); }
function billAddBlank() { bill.items.push({ name: '', qty: 1, price: '', unit: 'pack' }); renderInvoiceRows(); billChanged(); const t = document.querySelectorAll('#billRows textarea'); if (t.length) t[t.length - 1].focus(); }
function billAddProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const existing = bill.items.find(it => it.pid === id && it.unit !== 'part');
    if (existing) existing.qty = (parseFloat(existing.qty) || 0) + 1;
    else bill.items.push({ pid: id, name: p.name, qty: 1, price: p.price || '', unit: 'pack' });
    $b('billSearch').value = ''; $b('billResults').style.display = 'none';
    renderInvoiceRows(); billChanged();
}
function productPickHtml(p, fn, extra) {   // سطر نتيجة بحث: صورة + اسم + شركة + عبوة
    const img = p.img ? `<img class="pk-img" src="${escapeHtml(p.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="pk-img pk-noimg">💊</span>';
    const meta = fixMetaOrder(p.meta || '');
    return `<button type="button" class="pk-row" onclick="${fn}(${p.id})">${img}<span class="pk-info"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml([p.brand, meta].filter(Boolean).join(' · '))}</small>${extra ? `<em>${extra}</em>` : ''}</span></button>`;
}
let billFound = [];
function billSearchInput() {
    const q = $b('billSearch').value;
    const box = $b('billResults');
    const qn = normSearch(q);
    if (!qn) { box.style.display = 'none'; billFound = []; return; }
    const toks = qn.split(' ');
    billFound = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    box.innerHTML = billFound.length
        ? billFound.map(p => productPickHtml(p, 'billAddProduct', (p.price ? fmtNum(p.price) + ' د.ع' : '') + (isInStock(p) ? ' · المتوفر ' + stockLabel(p) : ' · غير متوفر'))).join('')
        : `<div class="bill-noresult">لا توجد نتائج — يمكنك إضافة سطر وكتابة الاسم يدوياً</div>`;
    box.style.display = 'block';
}
// Enter: باركود مكتوب/ممسوح بقارئ USB → الصنف المطابق، وإلا أول نتيجة بحث
function billSearchEnter() {
    const raw = $b('billSearch').value.trim();
    const code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code)) {
        const p = findByBarcode(code);
        if (p) { billAddProduct(p.id); return; }
    }
    if (billFound.length) billAddProduct(billFound[0].id);
}
function billScan() { openBarcodeScanner(billAddByBarcode); }
function billAddByBarcode(code) {
    const p = findByBarcode(code);
    if (!p) { offerUnknownBarcode(code, p2 => billAddProduct(p2.id), { onNew: c => { openFormModal(); formBarcodes = [cleanBarcode(c)]; renderBarcodeChips(); } }); return; }
    billAddProduct(p.id);
    Swal.fire({ icon: 'success', title: 'أُضيف: ' + p.name, toast: true, position: 'bottom', showConfirmButton: false, timer: 1200 });
}

// ---------- بيانات الصيدلية والصور ----------
function defaultInvMeta() {
    const w = String(typeof PHARMACY_WHATSAPP !== 'undefined' ? PHARMACY_WHATSAPP : '').replace(/^964/, '0');
    return { addr: '', phone: w.length === 11 ? `${w.slice(0, 4)} ${w.slice(4, 7)} ${w.slice(7)}` : w, lic: '', ret: 'الأدوية المباعة لا تُرد ولا تُستبدل بعد الاستلام', foot: 'شكراً لثقتكم بصيدلية الديوان' };
}
function getInvMeta() { try { return { ...defaultInvMeta(), ...(JSON.parse(lsGet(BILL_LS.meta)) || {}) }; } catch (e) { return defaultInvMeta(); } }
function billSaveMeta() {
    lsSet(BILL_LS.meta, JSON.stringify({ addr: document.getElementById('setAddr').value, phone: document.getElementById('setPhone').value, lic: document.getElementById('setLic').value, ret: document.getElementById('setRet').value, foot: document.getElementById('setFoot').value }));
    renderInvMeta();
}
function renderInvMeta() {
    const m = getInvMeta();
    document.getElementById('billPhLine1').innerText = m.addr || '';
    document.getElementById('billPhLine2').innerText = [m.phone ? 'هاتف: ' + m.phone : '', m.lic].filter(Boolean).join('  |  ');
    document.getElementById('billFootTxt').innerText = m.foot || '';
    document.getElementById('billRetTxt').innerText = m.ret ? 'سياسة الإرجاع: ' + m.ret : '';
}
function renderInvImages() {
    const put = (boxId, key) => {
        const src = lsGet(BILL_LS[key]);
        document.getElementById(boxId).innerHTML = src ? `<img src="${src}" alt="">` : '';
    };
    put('billSigBox', 'sig'); put('billStampBox', 'stamp');
}
function billPickImage(key, input) {
    const f = input.files && input.files[0];
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
        const max = 420, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        lsSet(BILL_LS[key], c.toDataURL('image/png'));
        URL.revokeObjectURL(url); renderInvImages(); input.value = '';
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}
async function billClearImages() { if (!(await askSure('إزالة الصورتين؟', 'سيُحذف التوقيع والختم المحفوظان.', 'إزالة'))) return; lsDel(BILL_LS.sig); lsDel(BILL_LS.stamp); renderInvImages(); }


// ---------- فتح الصفحات ----------
function billTab(name) {
    if (typeof userRole !== 'undefined' && userRole !== 'owner' && !['new', 'issued'].includes(name)) name = 'new';
    currentBillTab = name;
    document.querySelectorAll('#billTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.bill-pane').forEach(p => { p.classList.toggle('active', p.id === 'billPane-' + name); p.classList.remove('print-active'); });
    const pane = $b('billPane-' + name); if (pane && (name === 'new' || name === 'po')) pane.classList.add('print-active');
    if (name === 'new') initBillEditor();
    else if (name === 'settings') initBillSettings();
    else if (name === 'po') renderPO();
    else loadInvoices().then(() => { if (name === 'issued') renderIssuedList(); else if (name === 'debt') renderDebt(); else if (name === 'reports') renderReport(); });
}
function initBillEditor() {
    if (!bill) { try { bill = JSON.parse(lsGet(BILL_LS.draft)); } catch (e) { bill = null; } if (!bill || !Array.isArray(bill.items)) bill = emptyInvoice(); }
    if (bill.editing && !billEditBase) bill.editing = false;
    writeInvoiceFields(); renderInvoiceRows(); renderInvMeta(); renderInvImages();
}
function initBillSettings() {
    const m = getInvMeta();
    $b('setAddr').value = m.addr; $b('setPhone').value = m.phone; $b('setLic').value = m.lic; $b('setRet').value = m.ret; $b('setFoot').value = m.foot;
}
function onShowBill() { billTab(currentBillTab || 'new'); }
function newInvoice() {
    const hasData = bill && !bill.issued && (bill.items.length || bill.to || bill.customer || bill.doctor);
    const go = () => { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); billTab('new'); };
    if (!hasData) return go();
    Swal.fire({ icon: 'question', title: 'فاتورة جديدة؟', text: 'سيتم مسح الفاتورة الحالية.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، جديدة', cancelButtonText: 'إلغاء' })
        .then(r => { if (r.isConfirmed) go(); });
}
function printInvoice(draftOnly) {
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'أضف مادة واحدة على الأقل قبل الطباعة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    doPrint('billPane-new');
}
function fitSheetToPage(sheet) {   // يضبط المحتوى على ورقة A4 واحدة (هامش 12مم)
    if (!sheet) return;
    sheet.style.zoom = ''; sheet.style.width = '186mm';
    const avail = 270 / 25.4 * 96;                 // الارتفاع المتاح بالبكسل
    const h = sheet.getBoundingClientRect().height;
    if (h > avail) { const z = Math.max(0.35, avail / h); sheet.style.zoom = z.toFixed(3); sheet.style.width = (186 / z).toFixed(1) + 'mm'; }
}
function doPrint(paneId) {
    document.querySelectorAll('.bill-pane').forEach(p => p.classList.toggle('print-active', p.id === paneId));
    document.body.classList.add('printing-bill');
    document.querySelectorAll('#' + paneId + ' textarea').forEach(autoGrow);
    const sheet = document.querySelector('#' + paneId + ' .bill-sheet');
    const done = () => { document.body.classList.remove('printing-bill'); if (sheet) { sheet.style.zoom = ''; sheet.style.width = ''; } window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { fitSheetToPage(sheet); window.print(); setTimeout(done, 1500); }, 50);
}

// ---------- خطة الخصم من المخزن (تدعم العبوة والتجزئة) ----------
function billPlan() {
    const map = new Map();
    bill.items.forEach(it => {
        const p = itemProduct(it); const n = parseFloat(it.qty) || 0;
        if (!p || n <= 0 || setupSkip(p)) return;   // وضع التأسيس: المادة غير المجرودة لا يُخصم منها
        let e = map.get(p.id);
        if (!e) { e = { p, from: { qty: parseInt(p.qty) || 0, loose: parseInt(p.loose) || 0 }, to: null, short: false, lines: [] }; e.to = { ...e.from }; map.set(p.id, e); }
        const unit = it.unit === 'part' && hasRetail(p) ? 'part' : 'pack';
        const sc = subCountOf(p);
        const avail = unit === 'part' ? e.to.qty * sc + e.to.loose : e.to.qty;
        if (avail < n) e.short = true;
        e.to = stockAfterSale({ ...p, qty: e.to.qty, loose: e.to.loose }, n, unit);
        e.lines.push({ pid: p.id, unit, n });
    });
    return [...map.values()];
}
function stockTxt(p, s) { return hasRetail(p) && s.loose ? `${s.qty}+${s.loose}` : String(s.qty); }

// ---------- إصدار الفاتورة ----------
async function issueInvoice(doPrintAfter) {   // true/undefined: إصدار وطباعة، false: إصدار فقط
    readInvoiceFields();
    if (bill.issued) { printInvoice(); return; }
    if (!bill.items.length) { printInvoice(); return; }
    const t = billTotals();
    const deduct = bill.deduct !== false;
    const plan = deduct ? billPlan() : [];
    const short = plan.filter(e => e.short);
    const manual = bill.items.filter(it => !it.pid).length;
    const r = await Swal.fire({
        icon: 'question', title: 'إصدار الفاتورة ' + escapeHtml(bill.no),
        html: `المبلغ الكلي: <b>${fmtNum(t.total)} د.ع</b><br>` +
            (deduct ? `سيتم خصم الكميات من المخزن (${plan.length} مادة).` : 'بدون خصم من المخزن.') +
            (manual && deduct ? `<br><small>${manual} سطر مكتوب يدوياً لن يُخصم لأنه غير مرتبط بصنف.</small>` : '') +
            (short.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.85rem;">⚠️ كميات غير كافية في المخزن:<br>${short.map(e => escapeHtml(e.p.name) + ' (المتوفر ' + stockLabel(e.p) + ')').join('<br>')}<br><small>ستصبح الكمية 0.</small></div>` : ''),
        showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: doPrintAfter === false ? 'إصدار' : 'إصدار وطباعة', cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;
    billSnapCosts();
    let lines = [];
    if (deduct && plan.length) {
        if (!writesAllowed()) return;
        plan.forEach(e => { e.p.qty = e.to.qty; e.p.loose = e.to.loose; });
        const ok = await saveProductsDelta(plan.map(e => ({ p: e.p, dq: e.to.qty - e.from.qty, dl: e.to.loose - e.from.loose })));
        if (!ok) { plan.forEach(e => { e.p.qty = e.from.qty; e.p.loose = e.from.loose; }); renderAll(); return; }
        plan.forEach(e => { logAction('qty', e.p, [{ f: 'الكمية (فاتورة ' + bill.no + ')', from: stockTxt(e.p, e.from), to: stockTxt(e.p, e.to) }]); lines = lines.concat(e.lines); });
        renderAll();
    }
    bill.issued = true; bill.issuedAt = todayLocalISO(); bill.issuedTs = new Date().toISOString(); bill.deducted = lines.length > 0; bill.deductedLines = lines;
    bill.id = bill.id || String(Date.now());
    billEnsureUniqueNo();
    billSeqBump(bill.no);
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    await saveInvoiceRecord(bill);
    updateIssuedUI();
    if (doPrintAfter === false) Swal.fire({ icon: 'success', title: 'صدرت الفاتورة ' + bill.no, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    else printInvoice();
}
function billSnapCosts() {   // سعر الشراء وقت الإصدار (لحساب الربح لاحقاً)
    bill.items.forEach(it => { const p = itemProduct(it); const c = p ? parseFloat(p.costPrice) || 0 : 0; if (c > 0) { const sc = subCountOf(p); it.cost = it.unit === 'part' && hasRetail(p) ? c / sc : c; } else delete it.cost; });
}

// ---------- تعديل فاتورة صادرة (مع تصحيح المخزن بالفرق) ----------
let billEditBase = null;
function restoreDeducted(lines, snap) {
    (lines || []).forEach(l => {
        const p = products.find(x => x.id === l.pid); if (!p) return; snap(p);
        if (l.unit === 'part' && hasRetail(p)) { const tot = totalParts(p) + l.n, sc = subCountOf(p); p.qty = Math.floor(tot / sc); p.loose = tot % sc; }
        else p.qty = (parseInt(p.qty) || 0) + l.n;
    });
}
function editIssuedInvoice() {
    if (!bill || !bill.issued || bill.cancelled) return;
    billEditBase = JSON.parse(JSON.stringify(bill));
    bill.editing = true; $b('billDeduct').checked = bill.deducted !== false;
    updateIssuedUI(); renderInvoiceRows(); recalcInvoice();
}
async function cancelInvoiceEdit() {
    if (!(await askSure('إلغاء التعديل؟', 'ستضيع كل التغييرات غير المحفوظة على هذه الفاتورة.', 'إلغاء التعديل'))) return;
    if (!billEditBase) { if (bill) bill.editing = false; updateIssuedUI(); return; }
    bill = billEditBase; billEditBase = null; bill.editing = false;
    lsSet(BILL_LS.draft, JSON.stringify(bill)); writeInvoiceFields(); renderInvoiceRows(); recalcInvoice();
}
async function saveInvoiceEdit(doPrintAfter) {
    if (!bill || !bill.issued || !bill.editing) return;
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'لا يمكن حفظ فاتورة بلا مواد. استعمل «إلغاء الفاتورة» بدلاً من ذلك.', confirmButtonColor: '#0f1c38' }); return; }
    const old = billEditBase || bill;
    const hadDeduct = !!old.deducted;
    const snaps = new Map(), snap = p => { if (!snaps.has(p.id)) snaps.set(p.id, { p, qty: p.qty, loose: p.loose }); };
    let lines = [], plan = [];
    if (hadDeduct) {
        restoreDeducted(old.deductedLines, snap);      // 1) إرجاع ما خُصم سابقاً
        plan = billPlan();                              // 2) خصم الفاتورة الجديدة
        plan.forEach(e => { snap(e.p); });
    }
    const short = plan.filter(e => e.short);
    const r = await Swal.fire({ icon: 'question', title: 'حفظ تعديل الفاتورة ' + escapeHtml(bill.no) + '؟', html: `المبلغ الكلي: <b>${fmtNum(billTotals().total)} د.ع</b>` + (hadDeduct ? '<br>سيُصحَّح المخزن بالفرق عن الفاتورة السابقة.' : '') + (short.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.85rem;">⚠️ كميات غير كافية:<br>${short.map(e => escapeHtml(e.p.name) + ' (المتوفر ' + stockLabel(e.p) + ')').join('<br>')}</div>` : ''), showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'رجوع' });
    const rollback = () => { snaps.forEach(s => { s.p.qty = s.qty; s.p.loose = s.loose; }); };
    if (!r.isConfirmed) { rollback(); return; }
    if (hadDeduct) {
        if (!writesAllowed()) { rollback(); return; }
        plan.forEach(e => { e.p.qty = e.to.qty; e.p.loose = e.to.loose; lines = lines.concat(e.lines); });
        const ok = await saveProductsDelta([...snaps.values()].map(s => ({ p: s.p, dq: (parseInt(s.p.qty) || 0) - (parseInt(s.qty) || 0), dl: (parseInt(s.p.loose) || 0) - (parseInt(s.loose) || 0) })));
        if (!ok) { rollback(); renderAll(); return; }
        snaps.forEach(s => { const from = { qty: parseInt(s.qty) || 0, loose: parseInt(s.loose) || 0 }, to = { qty: parseInt(s.p.qty) || 0, loose: parseInt(s.p.loose) || 0 }; if (from.qty !== to.qty || from.loose !== to.loose) logAction('qty', s.p, [{ f: 'الكمية (تعديل فاتورة ' + bill.no + ')', from: stockTxt(s.p, from), to: stockTxt(s.p, to) }]); });
        renderAll();
    }
    billSnapCosts();
    bill.deducted = lines.length > 0; bill.deductedLines = lines;
    bill.editing = false; bill.editedAt = new Date().toISOString(); billEditBase = null;
    billSeqBump(bill.no);
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    await saveInvoiceRecord(bill);
    updateIssuedUI(); renderInvoiceRows(); recalcInvoice();
    if (doPrintAfter) printInvoice();
    else Swal.fire({ icon: 'success', title: 'حُفظ تعديل الفاتورة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
}
function billSeqBump(no) {
    const n = parseInt(String(no).replace(/\D/g, '')) || 0;
    if (n > (parseInt(lsGet(BILL_LS.seq)) || 0)) lsSet(BILL_LS.seq, String(n));
}

// ---------- إلغاء فاتورة وإرجاع الكميات ----------
async function cancelInvoice(target) {
    const b = target || bill;
    if (!b || !b.issued || b.cancelled) return;
    const r = await Swal.fire({ icon: 'warning', title: 'إلغاء الفاتورة ' + escapeHtml(b.no) + '؟', text: b.deducted ? 'ستُرجَع الكميات المخصومة إلى المخزن.' : 'لم تُخصم كميات بهذه الفاتورة.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، ألغِ', cancelButtonText: 'رجوع' });
    if (!r.isConfirmed) return;
    if (b.deducted && (b.deductedLines || []).length) {
        if (!writesAllowed()) return;
        const touched = new Map();
        (b.deductedLines || []).forEach(l => {
            const p = products.find(x => x.id === l.pid); if (!p) return;
            if (!touched.has(p.id)) touched.set(p.id, { p, from: { qty: parseInt(p.qty) || 0, loose: parseInt(p.loose) || 0 } });
            if (l.unit === 'part' && hasRetail(p)) {
                const tot = totalParts(p) + l.n, sc = subCountOf(p);
                p.qty = Math.floor(tot / sc); p.loose = tot % sc;
            } else p.qty = (parseInt(p.qty) || 0) + l.n;
        });
        const ok = await saveProductsDelta([...touched.values()].map(e => ({ p: e.p, dq: (parseInt(e.p.qty) || 0) - e.from.qty, dl: (parseInt(e.p.loose) || 0) - e.from.loose })));
        if (!ok) { touched.forEach(e => { e.p.qty = e.from.qty; e.p.loose = e.from.loose; }); renderAll(); return; }
        touched.forEach(e => logAction('qty', e.p, [{ f: 'الكمية (إلغاء فاتورة ' + b.no + ')', from: stockTxt(e.p, e.from), to: stockTxt(e.p, { qty: parseInt(e.p.qty) || 0, loose: parseInt(e.p.loose) || 0 }) }]));
        renderAll();
    }
    b.cancelled = true; b.cancelledAt = todayLocalISO();
    await saveInvoiceRecord(b);
    if (b === bill) { lsSet(BILL_LS.draft, JSON.stringify(bill)); updateIssuedUI(); }
    if (currentBillTab !== 'new') billTab(currentBillTab);
    Swal.fire({ icon: 'success', title: 'أُلغيت الفاتورة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 });
}

// حذف نهائي لفاتورة ملغاة فقط (لا يمكن التراجع عنه)؛ الكميات أُرجعت أصلاً عند الإلغاء
async function deleteInvoicePermanently(id) {
    id = id || (bill && bill.id);
    const b = billAll.find(x => x.id === id) || (bill && bill.id === id ? bill : null);
    if (!b || !b.cancelled) { Swal.fire({ icon: 'info', title: 'الحذف النهائي للفواتير الملغاة فقط', text: 'ألغِ الفاتورة أولاً ثم احذفها.', confirmButtonColor: '#0f1c38' }); return; }
    const r = await Swal.fire({ icon: 'warning', title: 'حذف الفاتورة ' + escapeHtml(b.no || '') + ' نهائياً؟', html: 'ستُحذف من هذا الجهاز ومن السحابة ولا يمكن استرجاعها.<br>لا يتأثر المخزون ولا حسابات المبيعات (فهي ملغاة أصلاً).', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'احذف نهائياً', cancelButtonText: 'تراجع' });
    if (!r.isConfirmed) return;
    if (cloudReady() && !navigator.onLine && !persistenceOn) { Swal.fire({ icon: 'error', title: 'لا يوجد اتصال', text: 'الحذف النهائي يحتاج اتصالاً حتى لا تعود الفاتورة من السحابة.', confirmButtonColor: '#0f1c38' }); return; }
    try {
        if (cloudReady()) await fsWrite(db.collection('pharmacy_invoices').doc(b.id).delete());
        let list = []; try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
        lsSet(BILL_LS.list, JSON.stringify(list.filter(x => x.id !== b.id)));
        billAll = billAll.filter(x => x.id !== b.id);
        if (bill && bill.id === b.id) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); }
        billTab(currentBillTab === 'new' ? 'issued' : (currentBillTab || 'issued'));
        Swal.fire({ icon: 'success', title: 'حُذفت الفاتورة نهائياً', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحذف', text: e.message || String(e), confirmButtonColor: '#0f1c38' }); }
}

// ---------- أرشيف الفواتير ----------
function invRemaining(b) {
    if (!b.issued || b.cancelled || b.paid === '' || b.paid == null) return 0;
    const sub = (b.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    const disc = Math.min(Math.max(parseFloat(b.discount) || 0, 0), sub);
    return Math.max(sub - disc - (parseFloat(b.paid) || 0), 0);
}
function invTotalOf(b) {
    const sub = (b.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    return sub - Math.min(Math.max(parseFloat(b.discount) || 0, 0), sub);
}
async function saveInvoiceRecord(b) {
    const rec = JSON.parse(JSON.stringify({ ...b, total: invTotalOf(b) }));
    if (!rec.byUid && typeof currentUser !== 'undefined' && currentUser) { rec.byUid = currentUser.uid; rec.by = (typeof userName !== 'undefined' && userName) || (userRole === 'owner' ? 'المالك' : ''); }
    let list = [];
    try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
    list = list.filter(x => x.id !== rec.id); list.unshift(rec);
    lsSet(BILL_LS.list, JSON.stringify(list.slice(0, 300)));
    billAll = billAll.filter(x => x.id !== rec.id); billAll.unshift(rec);
    if (cloudReady() && (navigator.onLine || persistenceOn)) {
        try { await fsSet(db.collection('pharmacy_invoices').doc(rec.id), rec); }
        catch (e) { lsSet('diwanNeedsPush', '1'); Swal.fire({ icon: 'warning', title: 'حُفظت الفاتورة على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_invoices إلى قواعد Firestore لتُحفظ في السحابة أيضاً. ستُعاد المحاولة تلقائياً.', confirmButtonColor: '#0f1c38' }); }
    } else lsSet('diwanNeedsPush', '1');
}
// ---------- إعادة إرسال ما حُفظ محلياً فقط + ترقيم فريد ----------
function billKnownNos(exceptId) { const m = new Map(); (billAll || []).concat((() => { try { return JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { return []; } })()).forEach(x => { if (x && x.issued && x.id !== exceptId && x.no) m.set(String(x.no), x.id); }); return m; }
function billEnsureUniqueNo() {
    const known = billKnownNos(bill.id);
    let guard = 0;
    while (known.has(String(bill.no)) && guard++ < 500) {
        const n = (parseInt(String(bill.no).replace(/\D/g, '')) || 0) + 1;
        bill.no = 'INV-' + String(n).padStart(4, '0');
    }
    if ($b('billNo')) $b('billNo').value = bill.no;
}
function billDuplicateNumbers() {
    const seen = new Map(), dup = new Set();
    (billAll || []).forEach(x => { if (!x || !x.issued || x.cancelled || !x.no) return; if (seen.has(x.no) && seen.get(x.no) !== x.id) dup.add(x.no); else seen.set(x.no, x.id); });
    return [...dup];
}
async function pushLocalInvoices() {
    if (!cloudReady()) return 0;
    let local = []; try { local = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { return 0; }
    if (!local.length) return 0;
    let cloud = new Map();
    const snap = await db.collection('pharmacy_invoices').orderBy('issuedTs', 'desc').limit(300).get();
    snap.forEach(d => { const x = d.data(); if (x && x.id) cloud.set(x.id, x); });
    let n = 0;
    for (const r of local) {
        const c = cloud.get(r.id);
        const newer = !c || String(r.editedAt || r.cancelledAt || '') > String(c.editedAt || c.cancelledAt || '') || (!!r.cancelled && !c.cancelled);
        if (newer) { await fsSet(db.collection('pharmacy_invoices').doc(r.id), r); n++; }
    }
    return n;
}
async function loadInvoices() {
    const map = new Map();
    try { (JSON.parse(lsGet(BILL_LS.list)) || []).forEach(x => x && x.id && map.set(x.id, x)); } catch (e) { /* تجاهل */ }
    if (cloudReady() && navigator.onLine) {
        try { const snap = await db.collection('pharmacy_invoices').orderBy('issuedTs', 'desc').limit(300).get(); snap.forEach(d => { const x = d.data(); if (x && x.id) map.set(x.id, x); }); } catch (e) { /* تجاهل */ }
    }
    billAll = [...map.values()].sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
    return billAll;
}
function billCardHtml(b, extra) {
    const rem = invRemaining(b);
    const tags = (b.cancelled ? '<em class="tg bad">ملغاة</em>' : '') + (rem > 0 ? `<em class="tg warn">آجل ${fmtNum(rem)}</em>` : '');
    return `<div class="bill-card ${b.cancelled ? 'cancelled' : ''}">
        <div class="bill-card-main" onclick="billOpenSaved('${b.id}')">
            <b dir="ltr">${escapeHtml(b.no || '')}</b> <span>${escapeHtml(b.to || b.customer || 'بدون اسم')}</span> ${tags}
            <small>${escapeHtml(fmtDateDMY(b.date))} • ${(b.items || []).length} مادة${b.by ? ' • ' + escapeHtml(b.by) : ''}</small>
        </div>
        <div class="bill-card-amt">${fmtNum(invTotalOf(b))}<small>د.ع</small></div>
        ${extra || (b.cancelled ? `<button type="button" class="bill-tb-btn bill-danger" onclick="deleteInvoicePermanently('${b.id}')">🗑 حذف</button>` : '')}
    </div>`;
}
function renderIssuedList() {
    const q = ($b('billListSearch').value || '').trim().toLowerCase();
    const arr = billAll.filter(b => !q || [b.no, b.to, b.customer, b.doctor].some(x => String(x || '').toLowerCase().includes(q)));
    $b('billList').innerHTML = arr.map(b => billCardHtml(b)).join('') || '<div class="bill-none">لا توجد فواتير صادرة بعد.</div>';
}
function billOpenSaved(id) {
    const b = billAll.find(x => x.id === id); if (!b) return;
    bill = JSON.parse(JSON.stringify(b));
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    billTab('new');
    window.scrollTo(0, 0);
}
function renderDebt() {
    const arr = billAll.filter(b => invRemaining(b) > 0);
    const total = arr.reduce((s, b) => s + invRemaining(b), 0);
    $b('debtSummary').innerHTML = `<span>إجمالي الآجل</span><b>${fmtNum(total)} د.ع</b><small>${arr.length} فاتورة</small>`;
    $b('debtList').innerHTML = arr.map(b => billCardHtml(b, `<button type="button" class="bill-tb-btn bill-pay" onclick="payDebt('${b.id}')">تسديد</button>`)).join('') || '<div class="bill-none">لا توجد ديون 🎉</div>';
}
async function payDebt(id) {
    const b = billAll.find(x => x.id === id); if (!b) return;
    const rem = invRemaining(b);
    const r = await Swal.fire({ title: 'تسديد دفعة — ' + escapeHtml(b.no), html: `المتبقي: <b>${fmtNum(rem)} د.ع</b>`, input: 'number', inputValue: rem, inputAttributes: { min: 0, max: rem }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'تسجيل الدفعة', cancelButtonText: 'إلغاء' });
    const amt = parseFloat(r && r.value);
    if (!r.isConfirmed || !(amt > 0)) return;
    const pay = Math.min(amt, rem);
    b.paid = (parseFloat(b.paid) || 0) + pay;
    (b.payments = b.payments || []).push({ at: todayLocalISO(), amount: pay });
    await saveInvoiceRecord(b);
    if (bill && bill.id === b.id) bill = JSON.parse(JSON.stringify(b));
    renderDebt();
}

// ---------- التقارير ----------
let reportRange = 'today';
function setReportRange(r) { reportRange = r; document.querySelectorAll('#reportRange button').forEach(x => x.classList.toggle('active', x.dataset.r === r)); renderReport(); }
function reportInvoices() {
    const today = todayLocalISO();
    const d = new Date(); const ago = new Date(d.getTime() - 6 * 864e5);
    const weekStart = ago.getFullYear() + '-' + String(ago.getMonth() + 1).padStart(2, '0') + '-' + String(ago.getDate()).padStart(2, '0');
    return billAll.filter(b => b.issued && !b.cancelled && (reportRange === 'all' || (reportRange === 'today' && b.date === today) || (reportRange === 'week' && b.date >= weekStart) || (reportRange === 'month' && String(b.date).slice(0, 7) === today.slice(0, 7))));
}
function renderReport() {
    const arr = reportInvoices();
    let gross = 0, disc = 0, net = 0, owed = 0, cost = 0, costRev = 0, noCost = 0; const items = new Map(), days = new Map();
    arr.forEach(b => {
        const sub = (b.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
        const t = invTotalOf(b); gross += sub; disc += sub - t; net += t; owed += invRemaining(b);
        days.set(b.date, (days.get(b.date) || 0) + t);
        (b.items || []).forEach(it => { if (it.cost > 0) { const q = parseFloat(it.qty) || 0; cost += it.cost * q; costRev += q * (parseFloat(it.price) || 0) * (sub > 0 ? t / sub : 1); } else noCost++; });
        (b.items || []).forEach(it => { const k = (it.name || '—') + (it.unit === 'part' && it.partType ? ' (' + it.partType + ')' : ''); const e = items.get(k) || { q: 0, v: 0 }; e.q += parseFloat(it.qty) || 0; e.v += (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0); items.set(k, e); });
    });
    const top = [...items.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 10);
    const dayRows = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
    const maxDay = Math.max(1, ...dayRows.map(x => x[1]));
    $b('reportBody').innerHTML = `
        <div class="rep-cards">
            <div><span>الفواتير</span><b>${arr.length}</b></div>
            <div><span>صافي المبيعات</span><b>${fmtNum(net)}</b></div>
            <div><span>الخصومات</span><b>${fmtNum(disc)}</b></div>
            <div><span>الآجل</span><b>${fmtNum(owed)}</b></div>
            ${cost > 0 ? `<div class="rep-profit"><span>الربح التقديري</span><b>${fmtNum(costRev - cost)}</b></div>` : ''}
        </div>
        ${cost > 0 && noCost ? `<div class="bill-set-hint">الربح محسوب من المواد التي لها سعر شراء فقط (${noCost} سطر بلا سعر شراء).</div>` : (cost <= 0 ? `<div class="bill-set-hint">أضف «سعر الشراء» لأصنافك لتظهر أرباحك هنا.</div>` : '')}
        ${dayRows.length > 1 ? `<h4 class="rep-h">المبيعات اليومية</h4>` + dayRows.map(([d, v]) => `<div class="rep-bar"><span>${escapeHtml(fmtDateDMY(d))}</span><i style="width:${Math.max(4, Math.round(v / maxDay * 100))}%"></i><b>${fmtNum(v)}</b></div>`).join('') : ''}
        <h4 class="rep-h">الأكثر مبيعاً</h4>
        ${top.map(([n, e]) => `<div class="rep-row"><span dir="auto">${escapeHtml(n)}</span><small>× ${fmtNum(e.q)}</small><b>${fmtNum(e.v)}</b></div>`).join('') || '<div class="bill-none">لا مبيعات في هذه الفترة.</div>'}`;
}
function salesTodayTotal() { const t = todayLocalISO(); return billAll.filter(b => b.issued && !b.cancelled && b.date === t).reduce((s, b) => s + invTotalOf(b), 0); }

// ---------- طلب الشراء ----------
let poState = {};
const poExtra = new Set();   // أصناف أُضيفت يدوياً من صفحة التنبيهات
function poCandidates() { return products.filter(p => !isInStock(p) || isLowStock(p) || poExtra.has(p.id)).sort((a, b) => (parseInt(a.qty) || 0) - (parseInt(b.qty) || 0) || String(a.brand).localeCompare(String(b.brand))); }
function renderPO() {
    const m = getInvMeta();
    $b('poPhLine').innerText = [m.addr, m.phone ? 'هاتف: ' + m.phone : ''].filter(Boolean).join('  |  ');
    $b('poDateTxt').innerText = fmtDateDMY(todayLocalISO());
    $b('poFoot').innerText = m.foot || '';
    $b('poSupplier').value = lsGet(BILL_LS.supplier) || '';
    const list = poCandidates();
    list.forEach(p => { if (!poState[p.id]) poState[p.id] = { on: true, qty: Math.max(getMinQty(p) * 2 - (parseInt(p.qty) || 0), 1) }; });
    $b('poRows').innerHTML = list.map(p => `
        <tr class="${poState[p.id].on ? '' : 'po-off'}">
            <td class="c-n no-print"><input type="checkbox" ${poState[p.id].on ? 'checked' : ''} onchange="poToggle(${p.id}, this.checked)"></td>
            <td class="c-name"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand || '')}</small></td>
            <td class="c-qty">${escapeHtml(stockLabel(p))}</td>
            <td class="c-qty has-pv"><input type="number" min="1" value="${poState[p.id].qty}" oninput="poQty(${p.id}, this.value)"><span class="bill-pv">${poState[p.id].qty}</span></td>
        </tr>`).join('') || `<tr><td colspan="4" class="bill-empty-row">لا توجد مواد ناقصة 🎉</td></tr>`;
}
function poToggle(id, on) { poState[id].on = on; renderPO(); }
function poQty(id, v) { poState[id].qty = Math.max(1, parseInt(v) || 1); const row = [...$b('poRows').querySelectorAll('input[type=number]')]; /* بدون إعادة رسم لتبقى لوحة المفاتيح */ }
function poSelectAll(on) { poCandidates().forEach(p => { poState[p.id].on = on; }); renderPO(); }
function poSaveSupplier() { lsSet(BILL_LS.supplier, $b('poSupplier').value); }
function poSelected() { return poCandidates().filter(p => poState[p.id] && poState[p.id].on).map(p => ({ p, qty: poState[p.id].qty })); }
function poPrint() {
    if (!poSelected().length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد محددة', confirmButtonColor: '#0f1c38' }); return; }
    document.querySelectorAll('#poRows tr').forEach((tr, i) => { const inp = tr.querySelector('input[type=number]'); const pv = tr.querySelector('.bill-pv'); if (inp && pv) pv.innerText = inp.value; });
    doPrint('billPane-po');
}
function poShareWhatsApp() {
    const sel = poSelected();
    if (!sel.length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد محددة', confirmButtonColor: '#0f1c38' }); return; }
    const sup = ($b('poSupplier').value || '').trim();
    const txt = `طلب شراء — صيدلية الديوان${sup ? '\nإلى: ' + sup : ''}\n${fmtDateDMY(todayLocalISO())}\n\n` + sel.map((x, i) => `${i + 1}) ${x.p.name}${x.p.brand ? ' (' + x.p.brand + ')' : ''} × ${x.qty}`).join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}
