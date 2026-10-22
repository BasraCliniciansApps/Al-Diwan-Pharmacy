// =====================================================================
// فاتورة الصيدلية (للصيدلي فقط) — جاهزة للطباعة A4
// =====================================================================
const BILL_LS = { list: 'diwanInvoicesLocal', draft: 'diwanInvoiceDraft', seq: 'diwanInvoiceSeq', meta: 'diwanInvoiceMeta', sig: 'diwanInvoiceSig', stamp: 'diwanInvoiceStamp' };
let bill = null;
let billSaveTimer = null;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* تجاهل */ } }

function todayLocalISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDateDMY(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
function fmtNum(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function nextInvoiceNumber(peek) {
    const n = (parseInt(lsGet(BILL_LS.seq)) || 0) + 1;
    if (!peek) lsSet(BILL_LS.seq, String(n));
    return 'INV-' + String(n).padStart(4, '0');
}
function emptyInvoice() {
    return { id: '', no: nextInvoiceNumber(true), to: '', date: todayLocalISO(), items: [], discount: '', paid: '', customer: '', doctor: '', notes: '', issued: false, deduct: true };
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
    const v = id => document.getElementById(id).value;
    bill.no = v('billNo'); bill.to = v('billTo'); bill.date = v('billDate');
    bill.discount = v('billDiscount'); bill.paid = v('billPaid');
    bill.customer = v('billCustomer'); bill.doctor = v('billDoctor'); bill.notes = v('billNotes');
    bill.deduct = document.getElementById('billDeduct').checked;
}
function writeInvoiceFields() {
    const set = (id, val) => { document.getElementById(id).value = val == null ? '' : val; };
    set('billNo', bill.no); set('billTo', bill.to); set('billDate', bill.date);
    set('billDiscount', bill.discount); set('billPaid', bill.paid);
    set('billCustomer', bill.customer); set('billDoctor', bill.doctor); set('billNotes', bill.notes);
    autoGrow(document.getElementById('billNotes'));
    document.getElementById('billDeduct').checked = bill.deduct !== false;
    updateIssuedUI();
}
function updateIssuedUI() {
    const note = document.getElementById('billIssuedNote'), btn = document.getElementById('billIssueBtn'), chk = document.getElementById('billDeduct');
    if (bill.issued) {
        note.style.display = 'block';
        note.innerText = '✅ صدرت هذه الفاتورة' + (bill.issuedAt ? ' بتاريخ ' + fmtDateDMY(String(bill.issuedAt).slice(0, 10)) : '') + (bill.deducted ? ' وتم خصم الكميات من المخزون.' : ' (بدون خصم من المخزون).');
        btn.innerText = '🖨️ طباعة نسخة'; chk.disabled = true;
    } else {
        note.style.display = 'none'; btn.innerText = '✅ إصدار وطباعة'; chk.disabled = false;
    }
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
    document.getElementById('billSub').innerText = fmtNum(t.sub) + ' د.ع';
    document.getElementById('billTotal').innerText = fmtNum(t.total) + ' د.ع';
    document.getElementById('billRemRow').style.display = t.paid === null ? 'none' : 'flex';
    document.getElementById('billRem').innerText = fmtNum(t.rem || 0) + ' د.ع';
    document.getElementById('billDateTxt').innerText = fmtDateDMY(bill.date);
    const w = numberToArabicWords(t.total);
    document.getElementById('billWords').innerHTML = (t.total > 0 && w) ? `<span>المبلغ كتابةً:</span> ${escapeHtml(w)} دينار عراقي فقط لا غير` : '';
    bill.items.forEach((it, i) => {
        const el = document.getElementById('billSum' + i);
        if (el) el.innerText = fmtNum((parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0));
        const pv = document.getElementById('billPv' + i);
        if (pv) pv.innerText = it.price === '' ? '' : fmtNum(it.price);
    });
    document.getElementById('billDiscTxt').innerText = t.disc ? fmtNum(t.disc) + ' د.ع' : '';
    document.getElementById('billPaidTxt').innerText = t.paid === null ? '' : fmtNum(t.paid) + ' د.ع';
    document.getElementById('billDiscRow').classList.toggle('bill-empty', !t.disc);
}
function renderInvoiceRows() {
    const body = document.getElementById('billRows');
    if (!bill.items.length) {
        body.innerHTML = `<tr class="bill-empty no-print"><td colspan="6">لم تُضف مواد بعد. ابحث عن مادة بالأسفل أو أضف سطراً فارغاً.</td></tr>`;
    } else {
        body.innerHTML = bill.items.map((it, i) => `
            <tr>
                <td class="c-n">${i + 1}</td>
                <td class="c-name"><textarea rows="1" dir="auto" oninput="billItemEdit(${i}, 'name', this.value); autoGrow(this)">${escapeHtml(it.name)}</textarea></td>
                <td class="c-qty"><input type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(String(it.qty))}" oninput="billItemEdit(${i}, 'qty', this.value)"></td>
                <td class="c-price has-pv"><input type="number" inputmode="decimal" min="0" value="${escapeHtml(String(it.price))}" oninput="billItemEdit(${i}, 'price', this.value)"><span class="bill-pv" id="billPv${i}"></span></td>
                <td class="c-sum" id="billSum${i}">0</td>
                <td class="c-del no-print"><button type="button" aria-label="حذف السطر" onclick="billRemoveRow(${i})">✕</button></td>
            </tr>`).join('');
        body.querySelectorAll('textarea').forEach(autoGrow);
    }
    recalcInvoice();
}
function billItemEdit(i, field, val) {
    if (!bill.items[i]) return;
    bill.items[i][field] = val;
    billChanged();
}
function billRemoveRow(i) { bill.items.splice(i, 1); renderInvoiceRows(); billChanged(); }
function billAddBlank() { bill.items.push({ name: '', qty: 1, price: '' }); renderInvoiceRows(); billChanged(); const t = document.querySelectorAll('#billRows textarea'); if (t.length) t[t.length - 1].focus(); }
function billAddProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const existing = bill.items.find(it => it.pid === id);
    if (existing) existing.qty = (parseFloat(existing.qty) || 0) + 1;
    else bill.items.push({ pid: id, name: p.name, qty: 1, price: p.price || '' });
    document.getElementById('billSearch').value = '';
    document.getElementById('billResults').style.display = 'none';
    renderInvoiceRows(); billChanged();
}
let billFound = [];
function billSearchInput() {
    const q = document.getElementById('billSearch').value;
    const box = document.getElementById('billResults');
    const qn = normSearch(q);
    if (!qn) { box.style.display = 'none'; billFound = []; return; }
    const toks = qn.split(' ');
    billFound = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    box.innerHTML = billFound.length
        ? billFound.map(p => `<button type="button" onclick="billAddProduct(${p.id})"><span dir="ltr">${escapeHtml(p.name)}</span><small>${escapeHtml(p.brand || '')}${p.price ? ' · ' + fmtNum(p.price) + ' د.ع' : ''}</small></button>`).join('')
        : `<div class="bill-noresult">لا توجد نتائج — يمكنك إضافة سطر فارغ وكتابة الاسم يدوياً</div>`;
    box.style.display = 'block';
}
function billAddFirstResult() { if (billFound.length) billAddProduct(billFound[0].id); }

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
function billClearImages() { lsDel(BILL_LS.sig); lsDel(BILL_LS.stamp); renderInvImages(); }

// ---------- فتح/إغلاق/طباعة ----------
function openInvoice() {
    if (!currentUser) {
        Swal.fire({ icon: 'info', title: 'سجّل الدخول أولاً', text: 'الفاتورة متاحة للصيدلي بعد تسجيل الدخول.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return;
    }
    try { bill = JSON.parse(lsGet(BILL_LS.draft)); } catch (e) { bill = null; }
    if (!bill || !Array.isArray(bill.items)) bill = emptyInvoice();
    const m = getInvMeta();
    document.getElementById('setAddr').value = m.addr; document.getElementById('setPhone').value = m.phone;
    document.getElementById('setLic').value = m.lic; document.getElementById('setFoot').value = m.foot; document.getElementById('setRet').value = m.ret;
    writeInvoiceFields(); renderInvoiceRows(); renderInvMeta(); renderInvImages();
    const pg = document.getElementById('invoicePage');
    pg.classList.add('open'); pg.setAttribute('aria-hidden', 'false');
    document.body.classList.add('invoice-open');
}
function closeInvoice() {
    readInvoiceFields(); lsSet(BILL_LS.draft, JSON.stringify(bill));
    const pg = document.getElementById('invoicePage');
    pg.classList.remove('open'); pg.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('invoice-open');
}
function newInvoice() {
    const hasData = bill && !bill.issued && (bill.items.length || bill.to || bill.customer || bill.doctor);
    const go = () => {
        bill = emptyInvoice();
        lsSet(BILL_LS.draft, JSON.stringify(bill));
        writeInvoiceFields(); renderInvoiceRows();
    };
    if (!hasData) return go();
    Swal.fire({ icon: 'question', title: 'فاتورة جديدة؟', text: 'سيتم مسح الفاتورة الحالية.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، جديدة', cancelButtonText: 'إلغاء' })
        .then(r => { if (r.isConfirmed) go(); });
}
function printInvoice(draftOnly) {
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'أضف مادة واحدة على الأقل قبل الطباعة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    document.body.classList.add('printing-invoice');
    document.querySelectorAll('#billRows textarea, #billNotes').forEach(autoGrow);
    const done = () => { document.body.classList.remove('printing-invoice'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { window.print(); setTimeout(done, 1500); }, 50);
}

// ---------- إصدار الفاتورة: حفظ + خصم من المخزون + طباعة ----------
function billSeqBump(no) {
    const n = parseInt(String(no).replace(/\D/g, '')) || 0;
    if (n > (parseInt(lsGet(BILL_LS.seq)) || 0)) lsSet(BILL_LS.seq, String(n));
}
function billStockLines() {
    const lines = [];
    bill.items.forEach(it => {
        const need = parseFloat(it.qty) || 0;
        const p = it.pid ? products.find(x => x.id === it.pid) : null;
        if (p && need > 0) lines.push({ p, need, have: parseInt(p.qty) || 0 });
    });
    return lines;
}
async function issueInvoice() {
    readInvoiceFields();
    if (bill.issued) { printInvoice(); return; }
    if (!bill.items.length) { printInvoice(); return; }   // يعرض تنبيه القائمة الفارغة
    const t = billTotals();
    const deduct = bill.deduct !== false;
    const lines = deduct ? billStockLines() : [];
    const short = lines.filter(l => l.have < l.need);
    const manual = bill.items.filter(it => !it.pid).length;
    const r = await Swal.fire({
        icon: 'question', title: 'إصدار الفاتورة ' + escapeHtml(bill.no),
        html: `المبلغ الكلي: <b>${fmtNum(t.total)} د.ع</b><br>` +
            (deduct ? `سيتم خصم الكميات من المخزون (${lines.length} مادة).` : 'بدون خصم من المخزون.') +
            (manual && deduct ? `<br><small>${manual} سطر مكتوب يدوياً لن يُخصم لأنه غير مرتبط بصنف.</small>` : '') +
            (short.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.85rem;">⚠️ كميات غير كافية في المخزون:<br>${short.map(l => escapeHtml(l.p.name) + ' (المتوفر ' + l.have + '، المطلوب ' + l.need + ')').join('<br>')}<br><small>ستصبح الكمية 0.</small></div>` : ''),
        showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'إصدار وطباعة', cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;
    if (deduct && lines.length) {
        if (!requireOnline()) return;
        const changed = [];
        lines.forEach(l => { const to = Math.max(0, l.have - l.need); if (to !== l.have) changed.push({ p: l.p, from: l.have, to }); });
        changed.forEach(c => { c.p.qty = c.to; });
        const ok = await saveProductsBatch(changed.map(c => c.p));
        if (!ok) { changed.forEach(c => { c.p.qty = c.from; }); renderAll(); return; }
        changed.forEach(c => logAction('qty', c.p, [{ f: 'الكمية (فاتورة ' + bill.no + ')', from: String(c.from), to: String(c.to) }]));
        renderAll();
    }
    bill.issued = true; bill.issuedAt = new Date().toISOString(); bill.deducted = !!(deduct && lines.length);
    bill.id = bill.id || String(Date.now());
    billSeqBump(bill.no);
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    await saveInvoiceRecord(bill);
    updateIssuedUI();
    printInvoice();
}

// ---------- أرشيف الفواتير ----------
async function saveInvoiceRecord(b) {
    const t = billTotals();
    const rec = JSON.parse(JSON.stringify({ ...b, total: t.total }));
    let list = [];
    try { list = JSON.parse(lsGet(BILL_LS.list)) || []; } catch (e) { list = []; }
    list = list.filter(x => x.id !== rec.id); list.unshift(rec);
    lsSet(BILL_LS.list, JSON.stringify(list.slice(0, 200)));
    if (cloudReady() && navigator.onLine) {
        try { await db.collection('pharmacy_invoices').doc(rec.id).set(rec); }
        catch (e) { Swal.fire({ icon: 'warning', title: 'حُفظت الفاتورة على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_invoices إلى قواعد Firestore لتُحفظ في السحابة أيضاً.', confirmButtonColor: '#0f1c38' }); }
    }
}
async function openInvoicesList() {
    const map = new Map();
    try { (JSON.parse(lsGet(BILL_LS.list)) || []).forEach(x => x && x.id && map.set(x.id, x)); } catch (e) { /* تجاهل */ }
    if (cloudReady() && navigator.onLine) {
        try { const snap = await db.collection('pharmacy_invoices').orderBy('issuedAt', 'desc').limit(100).get(); snap.forEach(d => { const x = d.data(); if (x && x.id) map.set(x.id, x); }); } catch (e) { /* تجاهل */ }
    }
    const arr = [...map.values()].sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
    window.__bills = arr;
    const rows = arr.map((b, i) => `
        <div class="sec-row" onclick="billOpenSaved(${i})" style="cursor:pointer;">
            <div class="sec-main"><b dir="ltr">${escapeHtml(b.no || '')}</b> — ${escapeHtml(b.to || b.customer || 'بدون اسم')}<small>${escapeHtml(fmtDateDMY(b.date))} • ${fmtNum(b.total)} د.ع • ${(b.items || []).length} مادة</small></div>
            <span class="sec-btn">فتح</span>
        </div>`).join('');
    Swal.fire({ title: '📚 الفواتير المحفوظة', html: `<div class="sec-list">${rows || '<div class="sec-empty">لا توجد فواتير صادرة بعد.</div>'}</div>`, confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' });
}
function billOpenSaved(i) {
    const b = (window.__bills || [])[i];
    if (!b) return;
    if (typeof Swal !== 'undefined' && Swal.close) Swal.close();
    bill = JSON.parse(JSON.stringify(b));
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    writeInvoiceFields(); renderInvoiceRows();
}
