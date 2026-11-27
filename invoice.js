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
// ترقيم الفواتير: بادئة فريدة لكل (مستخدم + جهاز) فلا يتكرر الرقم حتى عند البيع دون إنترنت من جهازين
function billDevTag() {
    let t = ''; try { t = localStorage.getItem('diwanDevTag') || ''; } catch (e) { /* تجاهل */ }
    if (!/^[A-Z2-9]{3}$/.test(t)) {
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; t = ''; for (let i = 0; i < 3; i++) t += A[Math.floor(Math.random() * A.length)];
        try { localStorage.setItem('diwanDevTag', t); } catch (e) { /* تجاهل */ }
    }
    return t;
}
function billUserCode() {   // المدير = 1، والمستخدمون بحسب أقدمية إنشاء حسابهم (2، 3، ...)
    if (typeof userRole !== 'undefined' && userRole === 'owner') return '1';
    const o = parseInt(window.userOrd) || 0; if (o > 0) return String(o);
    const u = (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) || '';
    return u ? 'X' + u.slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, 'X') : 'X';
}
function billPrefix() { return 'INV-' + billUserCode() + billDevTag() + '-'; }
function billSplitNo(no) { const m = /^(.*?)(\d+)$/.exec(String(no || '')); return m ? { pre: m[1], n: parseInt(m[2]) || 0 } : { pre: String(no || ''), n: 0 }; }
function billSeqKey(pre) { return pre === 'INV-' ? BILL_LS.seq : BILL_LS.seq + ':' + pre; }
function nextInvoiceNumber() { const pre = billPrefix(); return pre + String((parseInt(lsGet(billSeqKey(pre))) || 0) + 1).padStart(4, '0'); }
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
// اسم الطبيب المعالج: تُضاف «د. » تلقائياً أمام الاسم (ويُوحَّد «د» و«دكتور» و«Dr» إلى «د. »)
function fmtDoctor(v) {
    v = String(v == null ? '' : v).trim().replace(/\s+/g, ' '); if (!v || v === 'د') return '';
    const rest = v.replace(/^(?:د\.\s*|د\s+|(?:ال)?دكتور\s+|dr\.?\s+)/i, '');
    return rest ? 'د. ' + rest : '';
}
function readInvoiceFields() {
    const v = id => $b(id).value;
    bill.no = v('billNo'); bill.to = v('billTo'); bill.date = v('billDate');
    bill.discount = v('billDiscount'); bill.paid = v('billPaid');
    bill.customer = v('billCustomer'); bill.doctor = fmtDoctor(v('billDoctor')); bill.notes = v('billNotes');
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
const BILL_DIRECT_KEY = 'diwanBillDirect';
function billDirectOn() { return lsGet(BILL_DIRECT_KEY) === '1'; }
function billDirectSet(on) {
    try { localStorage.setItem(BILL_DIRECT_KEY, on ? '1' : '0'); } catch (e) { /* تجاهل */ }
    document.querySelectorAll('.im-bd').forEach(c => { c.checked = !!on; });
    billApplyRO();
}
// الفاتورة للعرض فقط ما لم يُفعَّل التعديل المباشر من الإعدادات (أو كنا في وضع تعديل فاتورة صادرة)
function billStickySync() {
    try { const t = document.getElementById('billTabs'), tb = document.querySelector('.bill-toolbar'); if (t && tb) document.documentElement.style.setProperty('--bt', (tb.offsetHeight + t.offsetHeight) + 'px'); } catch (e) { /* تجاهل */ }
}
function billApplyRO() {
    billStickySync();
    const sheet = document.getElementById('billSheet'); if (!sheet) return;
    const ro = !billDirectOn() && !(typeof bill !== 'undefined' && bill && bill.editing);
    sheet.classList.toggle('bill-ro', ro);
    sheet.querySelectorAll('input:not([type=checkbox]), textarea').forEach(e => { e.readOnly = ro; if (ro) e.tabIndex = -1; else e.removeAttribute('tabindex'); });
    sheet.querySelectorAll('select').forEach(e => { e.disabled = ro; });
}
function updateIssuedUI() {
    const note = $b('billIssuedNote'), chk = $b('billDeduct'), sheet = $b('billSheet');
    const show = (id, on) => { $b(id).style.display = on ? '' : 'none'; };
    const issued = !!bill.issued, cancelled = !!bill.cancelled, editing = issued && !!bill.editing;
    sheet.classList.toggle('locked', issued && !editing);
    sheet.classList.toggle('cancelled', cancelled);
    show('billNewBtn', !editing);
    show('billPrintOnlyBtn', !issued); show('billIssueOnlyBtn', !issued); show('billIssueBtn', !issued);
    show('billReprintBtn', issued && !editing && !cancelled); show('billEditBtn', issued && !editing && !cancelled); show('billInfoBtn', issued && !editing && !cancelled); show('billCancelBtn', issued && !editing && !cancelled && invCanOwn(bill, 'cancelOwn')); show('billDeleteBtn', issued && cancelled && invCanOwn(bill, 'deleteOwn'));
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
    billApplyRO();
}
function autoGrow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 28) + 'px'; }

// وحدة الجزء المعروضة في الفاتورة: إن كان حجم الجزء رقماً فاسم المادة يحمله أصلاً (مثل 10 Capsule) فيُكتب العدد وحده كالعبوة الكاملة
function billPartLbl(it) { const p = it.pid && products.find(x => x.id === it.pid); if (p && /^\d+(\.\d+)?$/.test(String(subSizeOf(p)).trim())) return ''; return it.partType === 'جزء' && !p ? '' : (it.partType || ''); }
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
        const qv = $b('billQv' + i); if (qv) qv.innerText = fmtNum(it.qty) + (it.unit === 'part' && billPartLbl(it) ? ' ' + billPartLbl(it) : '');
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
            const unitSel = p && hasRetail(p) && !sellLocked(p)
                ? `<select class="bill-unit no-print" onchange="billSetUnit(${i}, this.value)"><option value="pack" ${it.unit !== 'part' ? 'selected' : ''}>عبوة</option><option value="part" ${it.unit === 'part' ? 'selected' : ''}>${escapeHtml(subTypeOf(p))} (جزء)</option></select>` : '';
            return `
            <tr>
                <td class="c-n">${i + 1}</td>
                <td class="c-name"><textarea rows="1" dir="auto" oninput="billItemEdit(${i}, 'name', this.value); autoGrow(this)">${escapeHtml(it.name)}</textarea>${it.exp ? `<small class="bill-exp">📅 ${escapeHtml(it.exp)}</small>` : ''}${unitSel}${it.pid && typeof spOpen === 'function' ? `<button type="button" class="bill-bt no-print" onclick="spOpen(${it.pid}, { edit: true })">📅 الدفعات والسعر</button>` : ''}</td>
                <td class="c-qty has-pv"><div class="bill-stepper"><button type="button" class="bill-step" onclick="billStep(${i}, -1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(String(it.qty))}" oninput="billItemEdit(${i}, 'qty', this.value)"><button type="button" class="bill-step" onclick="billStep(${i}, 1)" aria-label="زيادة">+</button></div><span class="bill-pv" id="billQv${i}"></span></td>
                <td class="c-price has-pv"><input type="number" inputmode="decimal" min="0" value="${escapeHtml(String(it.price))}" oninput="billItemEdit(${i}, 'price', this.value)"><span class="bill-pv" id="billPv${i}"></span></td>
                <td class="c-sum" id="billSum${i}">0</td>
                <td class="c-del no-print"><button type="button" aria-label="حذف السطر" onclick="billRemoveRow(${i})">✕</button></td>
            </tr>`;
        }).join('');
        body.querySelectorAll('textarea').forEach(autoGrow);
    }
    recalcInvoice();
    billApplyRO();
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
    const oldAuto = [dispName(p, it.unit === 'part'), p.name].includes(String(it.name || '').trim());   // الاسم لم يُعدَّل يدوياً
    it.unit = unit; it.partType = unit === 'part' ? subTypeOf(p) : '';
    if (oldAuto) it.name = dispName(p, unit === 'part');
    it.price = unit === 'part' ? subPriceOf(p) : (p.price || '');
    renderInvoiceRows(); billChanged();
}
async function billRemoveRow(i) { const it = bill.items[i]; if (!it) return; if (!(await askSure('حذف هذا السطر من الفاتورة؟', it.name || '', 'حذف'))) return; bill.items.splice(i, 1); renderInvoiceRows(); billChanged(); }
function billAddBlank() { bill.items.push({ name: '', qty: 1, price: '', unit: 'pack' }); renderInvoiceRows(); billChanged(); const t = document.querySelectorAll('#billRows textarea'); if (t.length) t[t.length - 1].focus(); }
function billAddProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (typeof spOpen === 'function') { $b('billSearch').value = ''; $b('billResults').style.display = 'none'; spOpen(id, { scan: true }); return; }   // نافذة البيع تفرض كتابة السعر
    const existing = bill.items.find(it => it.pid === id && it.unit !== 'part' && !it.exp);
    if (existing) existing.qty = (parseFloat(existing.qty) || 0) + 1;
    else bill.items.push({ pid: id, name: dispName(p), qty: 1, price: p.price || '', unit: 'pack' });
    $b('billSearch').value = ''; $b('billResults').style.display = 'none';
    renderInvoiceRows(); billChanged();
}
function productPickHtml(p, fn, extra) {   // سطر نتيجة بحث: صورة + اسم + شركة + عبوة
    const img = p.img ? `<img class="pk-img" src="${escapeHtml(p.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="pk-img pk-noimg">💊</span>';
    const meta = fixMetaOrder(p.meta || '');
    return `<button type="button" class="pk-row" onclick="${fn}(${p.id})">${img}<span class="pk-info"><b dir="ltr">${dispNameHtml(p)}</b>${extra ? `<em>${extra}</em>` : ''}</span></button>`;
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
        if (p) { if (typeof spOpen === 'function') { $b('billSearch').value = ''; $b('billResults').style.display = 'none'; spOpen(p.id, { scan: true }); } else billAddProduct(p.id); return; }
    }
    if (billFound.length) billAddProduct(billFound[0].id);
}
const BILL_SCAN_WAIT_MS = 8000;   // إن لم يُقرأ باركود خلال هذه المدة تُغلق الكاميرا ويُفتح البحث بالاسم تلقائياً
function billScan() {
    let t = 0;
    const cb = (code, gs1) => { clearTimeout(t); billAddByBarcode(code, gs1); };
    t = setTimeout(() => {
        if (typeof barcodeCallback === 'undefined' || barcodeCallback !== cb) return;   // أُغلق الماسح يدوياً أو قُرئ باركود
        const m = document.getElementById('bcManual');
        if (m && (m.value || document.activeElement === m)) return;                    // المستخدم يكتب الباركود بنفسه
        closeBarcodeScanner('found');
        const s = $b('billSearch');
        if (s) { s.scrollIntoView({ block: 'center' }); s.focus(); }
        Swal.fire({ icon: 'info', title: 'لم يُقرأ باركود — ابحث بالاسم', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    }, BILL_SCAN_WAIT_MS);
    openBarcodeScanner(cb);
}
function billAddByBarcode(code) {
    const p = findByBarcode(code);
    if (!p) { offerUnknownBarcode(code, p2 => billAddProduct(p2.id)); return; }
    if (typeof spOpen === 'function') { spOpen(p.id, { scan: true }); return; }
    billAddProduct(p.id);
    Swal.fire({ icon: 'success', title: 'أُضيف: ' + p.name, toast: true, position: 'bottom', showConfirmButton: false, timer: 1200 });
}

// ---------- بيانات الصيدلية والصور ----------
function defaultInvMeta() {
    const w = String(typeof PHARMACY_WHATSAPP !== 'undefined' ? PHARMACY_WHATSAPP : '').replace(/^964/, '0');
    return { addr: '', phone: w.length === 11 ? `${w.slice(0, 4)} ${w.slice(4, 7)} ${w.slice(7)}` : w, lic: '', ret: 'الأدوية المباعة لا تُرد ولا تُستبدل بعد الاستلام', foot: 'شكراً لثقتكم بصيدلية الديوان' };
}
function getInvMeta() { try { return { ...defaultInvMeta(), ...(JSON.parse(lsGet(BILL_LS.meta)) || {}) }; } catch (e) { return defaultInvMeta(); } }
const imField = k => document.querySelector('.im-f[data-k="' + k + '"]');
function billSaveMeta(src) {
    if (src && src.dataset && src.dataset.k) document.querySelectorAll('.im-f[data-k="' + src.dataset.k + '"]').forEach(e => { if (e !== src) e.value = src.value; });   // مزامنة النسختين فوراً
    const v = k => (imField(k) || { value: '' }).value;
    lsSet(BILL_LS.meta, JSON.stringify({ addr: v('addr'), phone: v('phone'), lic: v('lic'), ret: v('ret'), foot: v('foot') }));
    renderInvMeta();
}
function renderInvMeta() {
    const m = getInvMeta();
    document.getElementById('billPhLine1').innerText = m.addr || '';
    document.getElementById('billPhLine2').innerHTML = [m.phone ? 'هاتف: <bdi dir="ltr">' + escapeHtml(m.phone) + '</bdi>' : '', escapeHtml(m.lic || '')].filter(Boolean).join('  |  ');
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
    else {   // عرض فوري من المخزن المحلي ثم تحديث من السحابة بالخلفية (يُعاد الرسم فقط إن تغيّرت البيانات)
        const draw = () => { if (name === 'issued') renderIssuedList(); else if (name === 'debt') renderDebt(); else if (name === 'reports') renderReport(); };
        const sig = () => (billAll || []).map(b => b.id + '|' + (b.editedAt || b.cancelledAt || b.issuedTs || '') + '|' + (b.paid || 0) + '|' + (b.cancelled ? 1 : 0)).join(',');
        if (!billAll.length) { try { billAll = (JSON.parse(lsGet(BILL_LS.list)) || []).filter(x => x && x.id).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt))); } catch (e) { /* تجاهل */ } }
        const warm = billAll.length > 0, before = warm ? sig() : '';
        if (warm) draw();
        loadInvoices().then(() => { if (!warm || sig() !== before) draw(); });
    }
}
function initBillEditor() {
    if (!bill) { try { bill = JSON.parse(lsGet(BILL_LS.draft)); } catch (e) { bill = null; } if (!bill || !Array.isArray(bill.items)) bill = emptyInvoice(); }
    if (bill && !bill.issued && !bill.id && !String(bill.no || '').startsWith(billPrefix())) bill.no = nextInvoiceNumber();   // مسودة قديمة: رقم جديد بالبادئة الحالية
    if (bill.editing && !billEditBase) bill.editing = false;
    writeInvoiceFields(); renderInvoiceRows(); renderInvMeta(); renderInvImages();
}
// مصدر واحد لإعدادات الفواتير: يُرسم في صفحة الفواتير وفي الإعدادات معاً، فأي حقل يُضاف هنا يظهر في الاثنين ويتزامن تلقائياً (data-k للنصوص، im-pc للخيارات)
const INV_SET_HTML = `<div class="bill-set-title im-main-title">⚙️ بيانات الصيدلية على الفاتورة <small>(تُحفظ على هذا الجهاز)</small></div>
<label class="bill-field"><span>العنوان</span><input class="im-f" data-k="addr" oninput="billSaveMeta(this)" placeholder="مثال: البصرة - ..."></label>
<label class="bill-field"><span>الهاتف</span><input class="im-f" data-k="phone" dir="ltr" oninput="billSaveMeta(this)"></label>
<label class="bill-field"><span>الصيدلاني / رقم الإجازة</span><input class="im-f" data-k="lic" oninput="billSaveMeta(this)" placeholder="اختياري"></label>
<label class="bill-field"><span>سياسة الإرجاع</span><input class="im-f" data-k="ret" oninput="billSaveMeta(this)" placeholder="مثال: الأدوية المباعة لا تُرد ولا تُستبدل بعد الاستلام"></label>
<label class="bill-field"><span>سطر أسفل الفاتورة</span><input class="im-f" data-k="foot" oninput="billSaveMeta(this)" placeholder="مثال: شكراً لثقتكم"></label>
<div class="bill-set-imgs">
<label class="bill-tb-btn">🖋️ صورة التوقيع<input type="file" accept="image/*" hidden onchange="billPickImage('sig', this)"></label>
<label class="bill-tb-btn">🔵 صورة الختم<input type="file" accept="image/*" hidden onchange="billPickImage('stamp', this)"></label>
<button type="button" class="bill-tb-btn" onclick="billClearImages()">إزالة الصورتين</button>
</div>
<div class="bill-set-hint">إن تركت الصورتين فارغتين يبقى مكان التوقيع والختم فارغاً لتوقّع وتختم بيدك بعد الطباعة.</div>
<div class="bill-set-title" style="margin-top:18px">✏️ تعديل الفاتورة</div>
<label class="bill-field" style="flex-direction:row;align-items:center;gap:12px"><input type="checkbox" class="im-bd" onchange="billDirectSet(this.checked)"><span>السماح بالتعديل المباشر على الفاتورة</span></label>
<div class="bill-set-hint">الافتراضي: الفاتورة للعرض فقط. الفاتورة الصادرة تُعدَّل بزر «تعديل الفاتورة».</div>
<div class="bill-set-title" style="margin-top:18px">🧮 شاشة البيع الجديدة</div>
<label class="bill-field" style="flex-direction:row;align-items:center;gap:12px"><input type="checkbox" class="im-pc" onchange="posCountSet(this.checked)"><span>طلب جرد المادة عند أول بيع (للمواد غير المجرودة في وضع التأسيس)</span></label>
<div class="bill-set-hint">عند التفعيل يظهر تنبيه على المادة غير المجرودة داخل شاشة البيع؛ بالضغط عليه تُدخل عدد العلب وعدد الأجزاء والسعر فتصبح المادة مجرودة. الخيار متوقف افتراضياً، ويتطلب صلاحية تعديل المواد.</div>`;
function invSettingsRender() { document.querySelectorAll('[data-inv-set]').forEach(c => { if (!c.dataset.r) { c.innerHTML = INV_SET_HTML; c.dataset.r = '1'; } }); }
function initBillSettings() {
    invSettingsRender();
    const m = getInvMeta();
    document.querySelectorAll('.im-bd').forEach(c => { c.checked = billDirectOn(); });
    try { const on = !!scCfg().posCount; document.querySelectorAll('.im-pc').forEach(c => { c.checked = on; }); } catch (e) { /* تجاهل */ }
    ['addr', 'phone', 'lic', 'ret', 'foot'].forEach(k => document.querySelectorAll('.im-f[data-k="' + k + '"]').forEach(e => { e.value = m[k] || ''; }));
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
    const done = () => { document.body.classList.remove('printing-bill'); if (sheet) { sheet.style.zoom = ''; sheet.style.width = ''; } window.removeEventListener(PEV, done); };
    const PEV = (window.NAT && NAT.is) ? 'diwan-afterprint' : 'afterprint';   // في التطبيق: حدث خاص يُطلق عند انتهاء مهمة الطباعة فقط
    window.addEventListener(PEV, done);
    setTimeout(() => { fitSheetToPage(sheet); window.print(); if (!(window.NAT && NAT.is)) setTimeout(done, 1500); }, 50);   // في التطبيق ينتهي بحدث afterprint بعد إغلاق نافذة الطباعة
}

// ---------- خطة الخصم من المخزن (تدعم العبوة والتجزئة) ----------
function billPlan() {
    const map = new Map();
    bill.items.forEach(it => {
        const p = itemProduct(it); const n = parseFloat(it.qty) || 0;
        if (!p || n <= 0 || setupSkip(p)) return;   // وضع التأسيس: المادة غير المجرودة لا يُخصم منها
        let e = map.get(p.id);
        if (!e) { e = { p, from: { qty: parseInt(p.qty) || 0, loose: parseInt(p.loose) || 0 }, to: null, short: false, lines: [], hints: [], bat: getBatches(p).map(b => ({ e: b.e, pr: b.pr || 0, u: b.q * btSc(p) + b.l })), track: !!p.bt || !getBatches(p).some(b => b.legacy) }; e.to = { ...e.from }; map.set(p.id, e); }
        const unit = it.unit === 'part' && hasRetail(p) ? 'part' : 'pack';
        const sc = subCountOf(p);
        const avail = unit === 'part' ? e.to.qty * sc + e.to.loose : e.to.qty;
        if (avail < n) e.short = true;
        e.to = stockAfterSale({ ...p, qty: e.to.qty, loose: e.to.loose }, n, unit);
        billAllocate(e, p, unit, n, it.exp, it.bpr).forEach(a => {   // توزيع الكمية على الدفعات: الدفعة المحددة أولاً ثم الأقرب نفاذاً
            e.lines.push({ pid: p.id, unit, n: a.n, exp: a.e, ...(a.pr ? { pr: a.pr } : {}), ...(a.over ? { over: true } : {}) });
            if (e.track && !a.over) e.hints.push({ e: a.e, pr: a.pr, q: unit === 'pack' ? -a.n : 0, l: unit === 'part' ? -a.n : 0 });
        });
    });
    return [...map.values()];
}
function billExpired(e) { if (!e) return false; const d = typeof expiryDaysOf === 'function' ? expiryDaysOf(e) : null; return d !== null && d <= 0; }
function billAllocate(en, p, unit, n, prefer, preferPr) {   // يرجع [{e, n}]؛ المنتهية لا تُباع (ما لا يُغطّى يُعدّ زائداً over)
    const sc = btSc(p), per = unit === 'part' ? 1 : sc, out = [];
    const rank = b => (prefer && b.e === prefer && (b.pr || 0) === (preferPr || 0) ? 0 : 1) * 10 + (billExpired(b.e) ? 3 : (b.e ? 0 : 1));
    const order = en.bat.slice().sort((a, b) => rank(a) - rank(b) || String(a.e).localeCompare(String(b.e)) || (a.pr || 0) - (b.pr || 0));
    let need = n;
    for (const b of order) {
        if (need <= 0) break;
        if (billExpired(b.e)) continue;
        const avail = Math.floor(b.u / per), take = Math.min(need, avail);
        if (take > 0) { b.u -= take * per; need -= take; out.push({ e: b.e, n: take, pr: b.pr || 0 }); }
    }
    if (need > 0) out.push({ e: '', n: need, over: true });
    return out;
}
function stockTxt(p, s) { return hasRetail(p) && s.loose ? `${s.qty}+${s.loose}` : String(s.qty); }

// ---------- إصدار الفاتورة ----------
async function issueInvoice(doPrintAfter, skipConfirm) {   // true/undefined: إصدار وطباعة، false: إصدار فقط
    readInvoiceFields();
    if (bill.issued) { printInvoice(); return; }
    if (!bill.items.length) { printInvoice(); return; }
    if (billHasExpired()) return;
    const t = billTotals();
    const deduct = bill.deduct !== false;
    const plan = deduct ? billPlan() : [];
    const short = plan.filter(e => e.short);
    if (short.length && !(await sgGate(short))) return;   // مواد مجرودة فوق المتوفر: منع أو تجاوز بتأكيد
    let hubWarn = '';
    try { if (deduct && plan.length && window.LAN && LAN.preSale) { const hs = await LAN.preSale(plan); if (hs.length) hubWarn = `<div style="margin-top:10px;color:#b91c1c;font-weight:700;font-size:.85rem;">⚠️ المتوفر حسب الحاسوب أقل من المطلوب (قد بيعت من جهاز آخر):<br>${hs.map(x => escapeHtml(x.name) + ' (المتوفر ' + x.av + ')').join('<br>')}</div>`; } } catch (e) { /* لا يعطّل البيع */ }
    const manual = bill.items.filter(it => !it.pid).length;
    const r = skipConfirm ? (hubWarn ? await Swal.fire({ icon: 'warning', title: 'تنبيه التوفر', html: hubWarn, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة البيع', cancelButtonText: 'إلغاء' }) : { isConfirmed: true }) : await Swal.fire({
        icon: 'question', title: 'إصدار الفاتورة ' + escapeHtml(bill.no),
        html: `المبلغ الكلي: <b>${fmtNum(t.total)} د.ع</b><br>` +
            (deduct ? `سيتم خصم الكميات من المخزن (${plan.length} مادة).` : 'بدون خصم من المخزن.') +
            (manual && deduct ? `<br><small>${manual} سطر مكتوب يدوياً لن يُخصم لأنه غير مرتبط بصنف.</small>` : '') +
            hubWarn + (short.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.85rem;">⚠️ كميات غير كافية في المخزن:<br>${short.map(e => escapeHtml(e.p.name) + ' (المتوفر ' + stockLabel(e.p) + ')').join('<br>')}<br><small>ستصبح الكمية 0.</small></div>` : ''),
        showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: doPrintAfter === false ? 'إصدار' : 'إصدار وطباعة', cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;
    billSnapCosts();
    let lines = [];
    if (deduct && plan.length) {
        if (!writesAllowed()) return;
        plan.forEach(e => { e.p.qty = e.to.qty; e.p.loose = e.to.loose; e.p._badd = (e.p._badd || []).concat(e.hints); });
        bill.id = bill.id || (String(Date.now()) + Math.random().toString(36).slice(2, 6));   // المعرّف قبل الخصم ليكون مفتاح العملية ثابتاً
        const ok = await saveProductsDelta(plan.map(e => ({ p: e.p, dq: e.to.qty - e.from.qty, dl: e.to.loose - e.from.loose })), { key: bill.id + ':sale', kind: 'sale', inv: bill.id, no: bill.no });
        if (!ok) { plan.forEach(e => { e.p.qty = e.from.qty; e.p.loose = e.from.loose; delete e.p._badd; }); renderAll(); return; }
        plan.forEach(e => { logAction('qty', e.p, [{ f: 'الكمية (فاتورة ' + bill.no + ')', from: stockTxt(e.p, e.from), to: stockTxt(e.p, e.to) }]); lines = lines.concat(e.lines); });
        renderAll();
    }
    bill.issued = true; bill.issuedAt = todayLocalISO(); bill.issuedTs = new Date().toISOString(); bill.deducted = lines.length > 0; bill.deductedLines = lines;
    bill.id = bill.id || (String(Date.now()) + Math.random().toString(36).slice(2, 6));
    billEnsureUniqueNo();
    billSeqBump(bill.no);
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    await saveInvoiceRecord(bill);
    updateIssuedUI();
    if (doPrintAfter === false) Swal.fire({ icon: 'success', title: 'صدرت الفاتورة ' + bill.no, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    else printInvoice();
}
function billHasExpired() {   // بيع دفعة منتهية ممنوع نهائياً
    const bad = bill.items.filter(it => it.exp && billExpired(it.exp));
    if (!bad.length) return false;
    Swal.fire({ icon: 'error', title: 'دفعة منتهية الصلاحية', html: 'لا يمكن بيع دفعة منتهية:<br>' + bad.map(it => escapeHtml(it.name) + ' (' + escapeHtml(it.exp) + ')').join('<br>') + '<br><small>احذف السطر أو غيّر الدفعة.</small>', confirmButtonColor: '#0f1c38' });
    return true;
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
        if (l.exp !== undefined && !l.over && (p.bt || !getBatches(p).some(b => b.legacy))) p._badd = (p._badd || []).concat([{ e: l.exp, pr: l.pr, q: l.unit === 'part' ? 0 : l.n, l: l.unit === 'part' ? l.n : 0 }]);   // يرجع للدفعة نفسها
    });
}
function invMayEdit() {   // المدير يعدّل كل الفواتير، وغيره فاتورته فقط
    if (userRole !== 'owner' && bill.byUid && typeof currentUser !== 'undefined' && currentUser && bill.byUid !== ((window.__actAs && window.__actAs.uid) || currentUser.uid)) { Swal.fire({ icon: 'info', title: 'لا يمكن تعديل هذه الفاتورة', text: 'هذه الفاتورة أصدرها مستخدم آخر. يعدّلها صاحبها أو المدير.', confirmButtonColor: '#0f1c38' }); return false; }
    return true;
}
function editIssuedInvoice() {   // يفتح شاشة البيع بوضع التعديل محمّلةً بمواد الفاتورة
    if (!bill || !bill.issued || bill.cancelled || bill.editing) return;
    if (!invMayEdit()) return;
    billEditBase = JSON.parse(JSON.stringify(bill));
    bill.editing = true; $b('billDeduct').checked = bill.deducted !== false;
    updateIssuedUI(); renderInvoiceRows(); recalcInvoice();
    if (typeof posOpen === 'function') posOpen();
}
// تعديل سريع لبيانات الفاتورة الصادرة (الشركة، الزبون، الطبيب، الملاحظات، الخصم، المدفوع) دون المساس بالمواد أو المخزن
async function quickEditInvoice() {
    if (!bill || !bill.issued || bill.cancelled || bill.editing) return;
    if (!invMayEdit()) return;
    const v = k => escapeHtml(String(bill[k] == null ? '' : bill[k]));
    const sub = (bill.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0);
    const credit = !(bill.paid === '' || bill.paid == null);
    const r = await Swal.fire({
        title: 'تعديل بيانات الفاتورة ' + escapeHtml(bill.no), showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="pos-fields" style="text-align:right">
            <label>إلى السيد / الشركة<input id="qeTo" list="qiDl_to" autocomplete="off" value="${v('to')}"></label>
            <label>اسم الزبون<input id="qeCu" list="qiDl_customer" autocomplete="off" value="${v('customer')}"></label>
            <label>اسم الطبيب المعالج<input id="qeDo" list="qiDl_doctor" autocomplete="off" value="${v('doctor')}"></label>
            <label>ملاحظات<textarea id="qeNo" rows="2">${v('notes')}</textarea></label>
            <label>الخصم (د.ع)<input id="qeDi" type="number" inputmode="numeric" min="0" value="${v('discount')}"></label>
            <label>المبلغ المدفوع (د.ع)<input id="qePa" type="number" inputmode="numeric" min="0" value="${credit ? v('paid') : ''}" placeholder="اتركه فارغاً إن كانت الفاتورة مدفوعة كاملة"></label>
            ${['to', 'customer', 'doctor'].map(k => (typeof qiDl === 'function' ? qiDl(k) : '')).join('')}</div>
            <div style="margin-top:8px;font-size:.8rem;color:#64748b;text-align:right">لا يؤثر هذا التعديل على المواد ولا على المخزن. لتعديل المواد أو الكميات استعمل «تعديل الفاتورة».</div>`,
        preConfirm: () => {
            const g = id => document.getElementById(id), d = g('qeDi').value.trim(), pa = g('qePa').value.trim();
            const disc = d === '' ? 0 : parseFloat(d), paid = pa === '' ? null : parseFloat(pa);
            if (!(disc >= 0) || disc > sub) { Swal.showValidationMessage('الخصم يجب أن يكون بين صفر ومجموع الفاتورة'); return false; }
            if (paid !== null && !(paid >= 0)) { Swal.showValidationMessage('المبلغ المدفوع غير صالح'); return false; }
            const total = sub - disc, isCr = paid !== null && paid < total, cu = g('qeCu').value.trim();
            if (isCr && !cu) { Swal.showValidationMessage('اسم الزبون مطلوب للبيع الآجل'); return false; }
            if (userRole !== 'owner' && disc > (parseFloat(bill.discount) || 0) && typeof posLimits === 'function') { const L = posLimits(); if (disc > L.allow) { Swal.showValidationMessage(L.allow > 0 ? 'الخصم يتجاوز الحد المسموح' : 'لا يُسمح بخصم على هذه المواد'); return false; } }
            return { to: g('qeTo').value.trim(), customer: cu, doctor: g('qeDo').value.trim(), notes: g('qeNo').value.trim(), disc, paid: isCr ? paid : null, total };
        }
    });
    if (!r.isConfirmed || !r.value) return;
    const o = r.value, fr = await invFresh(bill);
    if (fr && fr.cancelled) { await invAdoptFresh(bill, fr); lsSet(BILL_LS.draft, JSON.stringify(bill)); try { writeInvoiceFields(); updateIssuedUI(); } catch (e) { /* تجاهل */ } Swal.fire({ icon: 'warning', title: 'الفاتورة ملغاة', text: 'أُلغيت هذه الفاتورة من جهاز آخر، فلم يُحفظ التعديل.', confirmButtonColor: '#0f1c38' }); return; }
    const oldPaid = (bill.paid === '' || bill.paid == null) ? null : (parseFloat(bill.paid) || 0);
    bill.to = o.to; bill.customer = o.customer; bill.doctor = fmtDoctor(o.doctor); bill.notes = o.notes; bill.discount = o.disc ? String(o.disc) : '';
    bill.paid = o.paid === null ? '' : String(o.paid);
    if (oldPaid !== null && o.paid !== null && Math.abs(o.paid - oldPaid) > 0.001) (bill.payments = bill.payments || []).push({ at: todayLocalISO(), amount: o.paid - oldPaid, adj: true });
    bill.editedAt = new Date().toISOString();
    try { qiRemember(); } catch (e) { /* تجاهل */ }
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    await saveInvoiceRecord(bill);
    writeInvoiceFields(); renderInvoiceRows(); recalcInvoice(); updateIssuedUI();
    Swal.fire({ icon: 'success', title: 'حُفظت بيانات الفاتورة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
}
async function cancelInvoiceEdit() {
    if (!(await askSure('إلغاء التعديل؟', 'ستضيع كل التغييرات غير المحفوظة على هذه الفاتورة.', 'إلغاء التعديل'))) return;
    cancelInvoiceEditNow();
}
function cancelInvoiceEditNow() {
    if (!billEditBase) { if (bill) bill.editing = false; updateIssuedUI(); return; }
    bill = billEditBase; billEditBase = null; bill.editing = false;
    lsSet(BILL_LS.draft, JSON.stringify(bill)); writeInvoiceFields(); renderInvoiceRows(); recalcInvoice();
}
async function saveInvoiceEdit(doPrintAfter) {
    if (!bill || !bill.issued || !bill.editing) return;
    if (!invMayEdit()) return;
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'لا يمكن حفظ فاتورة بلا مواد. استعمل «إلغاء الفاتورة» بدلاً من ذلك.', confirmButtonColor: '#0f1c38' }); return; }
    if (billHasExpired()) return;
    const fr = await invFresh(billEditBase || bill);
    if (fr && (fr.cancelled || invStable(fr.deductedLines || []) !== invStable((billEditBase || bill).deductedLines || []))) {
        billEditBase = null; bill.editing = false; await invAdoptFresh(bill, fr);
        lsSet(BILL_LS.draft, JSON.stringify(bill)); try { writeInvoiceFields(); renderInvoiceRows(); recalcInvoice(); updateIssuedUI(); } catch (e) { /* تجاهل */ }
        Swal.fire({ icon: 'warning', title: fr.cancelled ? 'الفاتورة ملغاة' : 'الفاتورة معدَّلة من جهاز آخر', text: 'لم يُحفظ تعديلك حتى لا تتكرر حركة المخزون. حُدّثت الفاتورة بآخر نسخة، أعد التعديل إن لزم.', confirmButtonColor: '#0f1c38' });
        return;
    }
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
    if (short.length && !(await sgGate(short))) { snaps.forEach(s => { s.p.qty = s.qty; s.p.loose = s.loose; delete s.p._badd; }); return; }
    const r = await Swal.fire({ icon: 'question', title: 'حفظ تعديل الفاتورة ' + escapeHtml(bill.no) + '؟', html: `المبلغ الكلي: <b>${fmtNum(billTotals().total)} د.ع</b>` + (hadDeduct ? '<br>سيُصحَّح المخزن بالفرق عن الفاتورة السابقة.' : '') + (short.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.85rem;">⚠️ كميات غير كافية:<br>${short.map(e => escapeHtml(e.p.name) + ' (المتوفر ' + stockLabel(e.p) + ')').join('<br>')}</div>` : ''), showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'رجوع' });
    const rollback = () => { snaps.forEach(s => { s.p.qty = s.qty; s.p.loose = s.loose; delete s.p._badd; }); };
    if (!r.isConfirmed) { rollback(); return; }
    if (hadDeduct) {
        if (!writesAllowed()) { rollback(); return; }
        plan.forEach(e => { e.p.qty = e.to.qty; e.p.loose = e.to.loose; lines = lines.concat(e.lines); e.p._badd = (e.p._badd || []).concat(e.hints); });
        const ok = await saveProductsDelta([...snaps.values()].map(s => ({ p: s.p, dq: (parseInt(s.p.qty) || 0) - (parseInt(s.qty) || 0), dl: (parseInt(s.p.loose) || 0) - (parseInt(s.loose) || 0) })), { key: bill.id + ':edit:' + Date.now(), kind: 'edit', inv: bill.id, no: bill.no });
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
    return true;
}
function billSeqBump(no) {
    const x = billSplitNo(no), k = billSeqKey(x.pre);
    if (x.n > (parseInt(lsGet(k)) || 0)) lsSet(k, String(x.n));
}

// ---------- إلغاء فاتورة وإرجاع الكميات ----------
// آخر نسخة من الفاتورة في السحابة (إن توفر اتصال): تمنع إرجاع/خصم المخزون مرتين عند الإلغاء أو التعديل من جهاز آخر بنسخة قديمة
async function invFresh(b) {
    try {
        if (!b || !b.id || typeof cloudReady !== 'function' || !cloudReady() || !navigator.onLine) return null;
        const s = await Promise.race([db.collection('pharmacy_invoices').doc(b.id).get({ source: 'server' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
        return s.exists ? s.data() : null;
    } catch (e) { return null; }
}
const invStable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);   // مقارنة لا تتأثر بترتيب الحقول
async function invAdoptFresh(b, fr) {   // يحدّث النسخة المحلية بما في السحابة
    Object.assign(b, fr);
    try { await saveInvoiceRecord(b); } catch (e) { /* تجاهل */ }
}
// صلاحية البائع على فاتورة: يلزم تفعيلها من المدير وأن تكون فاتورته هو
function invCanOwn(b, perm) {
    if (userRole === 'owner') return true;
    return can(perm) && !!b && !!b.byUid && typeof currentUser !== 'undefined' && !!currentUser && b.byUid === ((window.__actAs && window.__actAs.uid) || currentUser.uid);
}
async function cancelInvoice(target) {
    const b = target || bill;
    if (!b || !b.issued || b.cancelled) return;
    if (!invCanOwn(b, 'cancelOwn')) { Swal.fire({ icon: 'info', title: 'لا يمكن إلغاء هذه الفاتورة', text: can('cancelOwn') ? 'هذه الفاتورة أصدرها مستخدم آخر. يلغيها صاحبها أو المدير.' : 'لا تملك صلاحية إلغاء الفواتير. راجع المدير.', confirmButtonColor: '#0f1c38' }); return; }
    const r = await Swal.fire({ icon: 'warning', title: 'إلغاء الفاتورة ' + escapeHtml(b.no) + '؟', text: b.deducted ? 'ستُرجَع الكميات المخصومة إلى المخزن.' : 'لم تُخصم كميات بهذه الفاتورة.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، ألغِ', cancelButtonText: 'رجوع' });
    if (!r.isConfirmed) return;
    const fr = await invFresh(b);
    if (fr && fr.cancelled) {
        await invAdoptFresh(b, fr);
        if (b === bill) { lsSet(BILL_LS.draft, JSON.stringify(bill)); updateIssuedUI(); }
        if (currentBillTab !== 'new') billTab(currentBillTab);
        Swal.fire({ icon: 'info', title: 'الفاتورة ملغاة مسبقاً', text: 'أُلغيت من جهاز آخر وأُرجعت كمياتها إلى المخزن، فلم تُرجَع مرة ثانية.', confirmButtonColor: '#0f1c38' });
        return;
    }
    if (fr) { b.deducted = fr.deducted; b.deductedLines = fr.deductedLines; }   // نعتمد أحدث خصم مسجّل
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
            if (l.exp !== undefined && !l.over && (p.bt || !getBatches(p).some(x => x.legacy))) p._badd = (p._badd || []).concat([{ e: l.exp, pr: l.pr, q: l.unit === 'part' ? 0 : l.n, l: l.unit === 'part' ? l.n : 0 }]);
        });
        const ok = await saveProductsDelta([...touched.values()].map(e => ({ p: e.p, dq: (parseInt(e.p.qty) || 0) - e.from.qty, dl: (parseInt(e.p.loose) || 0) - e.from.loose })), { key: b.id + ':cancel', kind: 'cancel', inv: b.id, no: b.no });
        if (!ok) { touched.forEach(e => { e.p.qty = e.from.qty; e.p.loose = e.from.loose; delete e.p._badd; }); renderAll(); return; }
        if (window.__opAlready) { touched.forEach(e => { delete e.p._badd; }); renderAll(); Swal.fire({ icon: 'info', title: 'أُرجعت كميات هذه الفاتورة مسبقاً', text: 'لن تتكرر الكميات في المخزن.', confirmButtonColor: '#0f1c38' }); }
        else touched.forEach(e => logAction('qty', e.p, [{ f: 'الكمية (إلغاء فاتورة ' + b.no + ')', from: stockTxt(e.p, e.from), to: stockTxt(e.p, { qty: parseInt(e.p.qty) || 0, loose: parseInt(e.p.loose) || 0 }) }]));
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
    if (b && !invCanOwn(b, 'deleteOwn')) { Swal.fire({ icon: 'info', title: 'لا يمكن حذف هذه الفاتورة', text: can('deleteOwn') ? 'هذه الفاتورة أصدرها مستخدم آخر.' : 'لا تملك صلاحية حذف الفواتير. راجع المدير.', confirmButtonColor: '#0f1c38' }); return; }
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
    if (!rec.byUid && typeof currentUser !== 'undefined' && currentUser) { rec.byUid = (window.__actAs && window.__actAs.uid) || currentUser.uid; rec.by = (typeof userName !== 'undefined' && userName) || (userRole === 'owner' ? 'المدير' : ''); }
    let list = [];
    try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
    list = list.filter(x => x.id !== rec.id); list.unshift(rec);
    lsSet(BILL_LS.list, JSON.stringify(list.slice(0, 300)));
    billAll = billAll.filter(x => x.id !== rec.id); billAll.unshift(rec);
    try { if (window.WA && WA.tapRecord) WA.tapRecord('invoice', rec); } catch (e) { /* تجاهل */ }
    if (window.LAN && LAN.active()) { LAN.captureRecord('invoice', rec); return; }
    if (cloudReady() && (navigator.onLine || persistenceOn)) {
        try { await fsSet(db.collection('pharmacy_invoices').doc(rec.id), rec); setTimeout(invCheckUnsent, 7000); }
        catch (e) { window.INV_ERR = (e && (e.code || e.message)) || 'خطأ'; setTimeout(invCheckUnsent, 1500); lsSet('diwanNeedsPush', '1'); Swal.fire({ icon: 'warning', title: 'حُفظت الفاتورة على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_invoices إلى قواعد Firestore لتُحفظ في السحابة أيضاً. ستُعاد المحاولة تلقائياً.', confirmButtonColor: '#0f1c38' }); }
    } else lsSet('diwanNeedsPush', '1');
}
// ---------- إعادة إرسال ما حُفظ محلياً فقط + ترقيم فريد ----------
function billKnownNos(exceptId) { const m = new Map(); (billAll || []).concat((() => { try { return JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { return []; } })()).forEach(x => { if (x && x.issued && x.id !== exceptId && x.no) m.set(String(x.no), x.id); }); return m; }
function billEnsureUniqueNo() {
    if (!bill.issued && !String(bill.no || '').startsWith(billPrefix())) bill.no = nextInvoiceNumber();   // مسودة برقم قديم أو من مستخدم/جهاز آخر
    const known = billKnownNos(bill.id);
    let guard = 0;
    while (known.has(String(bill.no)) && guard++ < 500) {
        const x = billSplitNo(bill.no);
        bill.no = x.pre + String(x.n + 1).padStart(4, '0');
    }
    if ($b('billNo')) $b('billNo').value = bill.no;
}
function billDuplicateNumbers() {
    const seen = new Map(), dup = new Set();
    (billAll || []).forEach(x => { if (!x || !x.issued || x.cancelled || !x.no) return; if (seen.has(x.no) && seen.get(x.no) !== x.id) dup.add(x.no); else seen.set(x.no, x.id); });
    return [...dup];
}
// ---------- «فواتيره فقط»: موظف يحدده المدير لا يرى إلا الفواتير التي أصدرها بنفسه ----------
const invMyUid = () => (window.__actAs && window.__actAs.uid) || (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) || '';
const invOwnOnly = () => typeof userRole !== 'undefined' && userRole !== 'owner' && can('ownInv') && !can('customers');   // صلاحية الزبائن تعني رؤية الآجل لكل الفواتير فتُستثنى
function invScope(arr) {
    if (!invOwnOnly()) return arr;
    let ids = new Set(); try { ids = new Set((JSON.parse(lsGet(BILL_LS.list)) || []).map(x => x && x.id)); } catch (e) { /* تجاهل */ }
    const me = invMyUid(); return arr.filter(b => b && (b.byUid === me || ids.has(b.id)));
}
async function invOwnCloud() { return db.collection('pharmacy_invoices').where('byUid', '==', invMyUid()).get(); }
async function pushLocalInvoices() {
    if (!cloudReady()) return 0;
    let local = []; try { local = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { return 0; }
    if (!local.length) return 0;
    let cloud = new Map();
    const snap = invOwnOnly() ? await invOwnCloud() : await db.collection('pharmacy_invoices').orderBy('issuedTs', 'desc').limit(300).get();
    snap.forEach(d => { const x = d.data(); if (x && x.id) cloud.set(x.id, x); });
    let n = 0;
    for (const r of local) {
        const c = cloud.get(r.id);
        const newer = !c || String(r.editedAt || r.cancelledAt || '') > String(c.editedAt || c.cancelledAt || '') || (!!r.cancelled && !c.cancelled);
        if (newer) { try { await fsSet(db.collection('pharmacy_invoices').doc(r.id), r); n++; } catch (e) { window.INV_ERR = (e && (e.code || e.message)) || 'خطأ'; } }
    }
    return n;
}
// فواتير السحابة (فواتير المستخدمين) تُحفظ محلياً في مفتاح مستقل diwanInvCloud (لا تُدمج في قائمة فواتير الجهاز حتى لا يُعاد رفع نسخة قديمة منها)
const INV_CK = 'diwanInvCloud';
async function loadInvoices(ttl) {   // ttl: مهلة إعادة الجلب بالدقائق (الافتراضي 3، و0 يفرض الجلب)
    try { if (lsGet('diwanInvFix') !== '675') { lsDel('diwanFull_inv'); lsDel('diwanLd_inv'); lsSet('diwanInvFix', '675'); } } catch (e) { /* تجاهل */ }   // مرة واحدة: تحميل كامل بالاستعلام الجديد (بالتاريخ) بدل انتظار الدورة الكاملة كل 24 ساعة
    let cached = [], own = []; const hasCache = lsGet(INV_CK) != null;
    try { cached = (JSON.parse(lsGet(INV_CK)) || []).filter(x => x && x.id); } catch (e) { cached = []; }
    try { own = (JSON.parse(lsGet(BILL_LS.list)) || []).filter(x => x && x.id); } catch (e) { own = []; }
    const map = new Map();
    cached.forEach(x => map.set(x.id, x));   // ما حُمّل سابقاً من السحابة يبقى بعد إغلاق التطبيق
    (billAll || []).forEach(x => x && x.id && map.set(x.id, x));   // ما حُمّل سابقاً (مثل الأقدم من تاريخ) لا يُفقد عند التحديث
    own.forEach(x => map.set(x.id, x));
    if (invOwnOnly()) {   // استعلام واحد بشرط byUid (تفرضه القواعد)، بمهلة 10 دقائق، دون فهارس مركّبة
        let ids = new Set(own.map(x => x.id)); const me = invMyUid();
        [...map.keys()].forEach(k => { const x = map.get(k); if (!(x.byUid === me || ids.has(k))) map.delete(k); });
        let last = 0; try { last = +lsGet('diwanInvOwnAt') || 0; } catch (e) { /* تجاهل */ }
        if (cloudReady() && navigator.onLine && (ttl === 0 || Date.now() - last > 10 * 60000)) {
            try { const snap = await invOwnCloud(); snap.forEach(d => { const x = d.data(); if (x && x.id) map.set(x.id, x); }); lsSet('diwanInvOwnAt', String(Date.now())); } catch (e) { /* تجاهل */ }
        }
        billAll = [...map.values()].sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
        try { lsSet(INV_CK, JSON.stringify(billAll.slice(0, 300))); } catch (e) { /* تجاهل */ }
        return billAll;
    }
    // الترتيب بالتاريخ: كل فاتورة لها تاريخ، أما الفاتورة بلا issuedTs فكانت تُستبعد من الاستعلام
    if (cloudReady() && navigator.onLine) {
        try {
            const r1 = await cloudDelta('inv', 'pharmacy_invoices', map.size > 0 && hasCache, ttl == null ? 3 : ttl, 24, c => c.orderBy('date', 'desc').limit(300));
            if (r1) {
                const ids = new Set(); let minD = '9999';
                r1.snap.forEach(d => { const x = d.data(); if (x && x.id) { map.set(x.id, x); ids.add(x.id); if (String(x.date || '') < minD) minD = String(x.date || ''); } });
                if (r1.full) { const ownIds = new Set(own.map(x => x.id)); cached.forEach(c => { if (!ids.has(c.id) && !ownIds.has(c.id) && (r1.snap.size < 300 || String(c.date || '') >= minD)) map.delete(c.id); }); }   // حُذفت من السحابة
                billAll = [...map.values()].sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
                try { lsSet(INV_CK, JSON.stringify(billAll.slice(0, 300))); lsSet('diwanInvAt', String(Date.now())); } catch (e) { /* تجاهل */ }
            }
        } catch (e) { /* تجاهل */ }
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
        ${extra || (b.cancelled && invCanOwn(b, 'deleteOwn') ? `<button type="button" class="bill-tb-btn bill-danger" onclick="deleteInvoicePermanently('${b.id}')">🗑 حذف</button>` : '')}
    </div>`;
}
function renderIssuedList() {
    const q = ($b('billListSearch').value || '').trim().toLowerCase();
    const arr = billAll.filter(b => !q || [b.no, b.to, b.customer, b.doctor].some(x => String(x || '').toLowerCase().includes(q)) || (b.items || []).some(l => String(l.name || '').toLowerCase().includes(q)));
    $b('billList').innerHTML = arr.map(b => billCardHtml(b)).join('') || '<div class="bill-none">لا توجد فواتير صادرة بعد.</div>';
    const nt = document.getElementById('billOlderNote'); if (nt) nt.textContent = 'المعروض ' + arr.length + ' فاتورة' + (billAll.length >= 300 ? ' — القائمة الافتراضية آخر 300 فاتورة، ولعرض الأقدم اختر تاريخاً.' : '.');
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
        (b.items || []).forEach(it => { const k = (it.name || '—') + (it.unit === 'part' && billPartLbl(it) ? ' (' + billPartLbl(it) + ')' : ''); const e = items.get(k) || { q: 0, v: 0 }; e.q += parseFloat(it.qty) || 0; e.v += (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0); items.set(k, e); });
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
function poCandidates() { return products.filter(p => !p.arch && (!isInStock(p) || isLowStock(p) || poExtra.has(p.id))).sort((a, b) => (parseInt(a.qty) || 0) - (parseInt(b.qty) || 0) || String(a.brand).localeCompare(String(b.brand))); }
function renderPO() {
    const m = getInvMeta();
    $b('poPhLine').innerHTML = [escapeHtml(m.addr || ''), m.phone ? 'هاتف: <bdi dir="ltr">' + escapeHtml(m.phone) + '</bdi>' : ''].filter(Boolean).join('  |  ');
    $b('poDateTxt').innerText = fmtDateDMY(todayLocalISO());
    $b('poFoot').innerText = m.foot || '';
    $b('poSupplier').value = lsGet(BILL_LS.supplier) || '';
    const list = poCandidates();
    list.forEach(p => { if (!poState[p.id]) poState[p.id] = { on: true, qty: Math.max(getMinQty(p) * 2 - (parseInt(p.qty) || 0), 1) }; });
    $b('poRows').innerHTML = list.map(p => `
        <tr class="${poState[p.id].on ? '' : 'po-off'}">
            <td class="c-n no-print"><input type="checkbox" class="chk-real" ${poState[p.id].on ? 'checked' : ''} onchange="poToggle(${p.id}, this.checked)"></td>
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

// تحميل الفواتير الأقدم من تاريخ يختاره المدير (القائمة الافتراضية آخر 300 فاتورة فقط)
async function billLoadOlder() {
    const inp = document.getElementById('billOlderFrom'), from = inp && inp.value;
    if (!from) { Swal.fire({ icon: 'info', title: 'اختر التاريخ أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 1600 }); return; }
    const h = Prog.start('تحميل الفواتير', { text: 'من ' + fmtDateDMY(from) + '...' });
    try { await invEnsureSince(from); renderIssuedList(); h.ok('تم التحميل'); } catch (e) { h.fail('تعذر التحميل', e && e.message); }
}

// ---------- فواتير لم تصل للسحابة: عدّاد وإعادة إرسال وتشخيص ----------
window.INV_UNSENT = [];
const INV_SENT_K = 'diwanInvSent';
const invSig = r => String(r.editedAt || r.cancelledAt || r.issuedTs || '') + '|' + (r.cancelled ? 1 : 0);
let invChecking = false;
async function invCheckUnsent() {
    if (invChecking || typeof IS_ADMIN_PAGE === 'undefined' || !IS_ADMIN_PAGE || !cloudReady() || !navigator.onLine || usagePaused || (typeof recvOnly === 'function' && recvOnly())) return;   // الاستقبال فقط: لا فواتير لترسل
    invChecking = true;
    try {
        let list = []; try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
        let sent = {}; try { sent = JSON.parse(lsGet(INV_SENT_K)) || {}; } catch (e) { sent = {}; }
        const cand = list.filter(r => r && r.id && r.issued && sent[r.id] !== invSig(r)).slice(0, 40);
        const bad = []; let firstErr = '';
        for (const r of cand) {
            try {
                const d = await Promise.race([db.collection('pharmacy_invoices').doc(r.id).get({ source: 'server' }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
                const c = d.exists ? d.data() : null;
                if (c && invSig(c) >= invSig(r)) sent[r.id] = invSig(r); else bad.push(r);
            } catch (e) { if (!firstErr) firstErr = (e && (e.code || e.message)) || 'خطأ'; bad.push(r); }
        }
        const keep = {}; list.forEach(r => { if (sent[r.id]) keep[r.id] = sent[r.id]; });
        lsSet(INV_SENT_K, JSON.stringify(keep));
        window.INV_UNSENT = bad.map(r => ({ id: r.id, no: r.no, total: invTotalOf(r) }));
        if (firstErr) window.INV_ERR = firstErr;
        if (!bad.length) window.INV_ERR = '';
        syncRefresh();
    } finally { invChecking = false; }
}
function invUnsentHtml() {
    const u = window.INV_UNSENT || []; if (!u.length) return '';
    const e = String(window.INV_ERR || '');
    const hint = /permission|denied/i.test(e) ? 'قواعد Firestore ترفض حفظ الفواتير: انشر آخر نسخة من firestore.rules وتأكد أن صلاحية «المبيعات» مفعّلة لهذا المستخدم.' : /timeout|unavailable|network/i.test(e) ? 'الاتصال ضعيف أو متقطع.' : e ? 'سبب الخطأ: ' + escapeHtml(e) : '';
    return `<div class="ss-warn"><b>${fmtNum(u.length)} فاتورة لم تصل إلى السحابة</b> (محفوظة على هذا الجهاز فقط):<br>${u.slice(0, 12).map(x => escapeHtml(String(x.no)) + ' (' + fmtNum(x.total) + ')').join('، ')}${u.length > 12 ? ' ...' : ''}${hint ? '<br><small>' + hint + '</small>' : ''}<br><button type="button" class="ss-link" style="margin-top:8px" onclick="Swal.close();invResendUnsent()">إعادة إرسال الفواتير الآن</button></div>`;
}
async function invResendUnsent() {
    if (!writesAllowed() || !cloudReady()) return;
    const h = Prog.start('إعادة إرسال الفواتير', { text: 'جارٍ الإرسال...', indeterminate: false });
    let list = []; try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
    const ids = new Set((window.INV_UNSENT || []).map(x => x.id)); const todo = list.filter(r => ids.has(r.id));
    let ok = 0, err = '';
    for (let i = 0; i < todo.length; i++) {
        try { await fsSet(db.collection('pharmacy_invoices').doc(todo[i].id), todo[i]); ok++; } catch (e) { err = (e && (e.code || e.message)) || 'خطأ'; }
        h.tick(i + 1, todo.length, fmtNum(i + 1) + ' من ' + fmtNum(todo.length));
    }
    if (err) window.INV_ERR = err;
    await invCheckUnsent();
    const left = (window.INV_UNSENT || []).length;
    left ? h.fail('تعذّر إرسال ' + fmtNum(left) + ' فاتورة', window.INV_ERR || '') : h.ok('وصلت كل الفواتير (' + fmtNum(ok) + ')');
}
window.addEventListener('online', () => setTimeout(invCheckUnsent, 3000));
setTimeout(invCheckUnsent, 9000);
setInterval(invCheckUnsent, 5 * 60000);
