// ===== الفاتورة السريعة: معالج خطوات (بيانات → مسح المواد → إنهاء) فوق صفحة الفاتورة =====
let qi = null;                 // حالة المعالج (null = غير مفعّل)
const QI_NAMES_KEY = 'diwan_qi_names';
function qiNames(kind) { try { return (JSON.parse(lsGet(QI_NAMES_KEY)) || {})[kind] || []; } catch (e) { return []; } }
function qiRemember() {
    try {
        const all = JSON.parse(lsGet(QI_NAMES_KEY)) || {};
        [['to', bill.to], ['customer', bill.customer], ['doctor', bill.doctor]].forEach(([k, v]) => {
            v = String(v || '').trim(); if (!v) return;
            all[k] = [v, ...(all[k] || []).filter(x => x !== v)].slice(0, 60);
        });
        lsSet(QI_NAMES_KEY, JSON.stringify(all));
    } catch (e) { /* تجاهل */ }
}
const QI_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M10.5 5.5h3M9.5 10h5M9.5 13h5M9.5 16h3"/></svg>';
function qiEnsureFab() {
    const v = document.getElementById('billView'); if (!v || document.getElementById('qiFab')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'qiFab'; b.className = 'qi-fab no-print';
    b.setAttribute('aria-label', 'فاتورة سريعة'); b.title = 'فاتورة سريعة'; b.innerHTML = QI_ICON; b.onclick = qiStart;
    v.appendChild(b);
}
function qiFabSync() {
    qiEnsureFab();
    const b = document.getElementById('qiFab'); if (!b) return;
    const show = (typeof currentBillTab === 'undefined' || currentBillTab === 'new') && !qi;
    b.style.display = show ? '' : 'none';
}
// ربط بدوال الفاتورة الحالية دون تعديل منطقها
(function () {
    const wrap = (name, after) => { const o = window[name] || eval(name); const f = function () { const r = o.apply(this, arguments); try { after(); } catch (e) { /* تجاهل */ } return r; }; try { window[name] = f; } catch (e) { /* تجاهل */ } return f; };
    billTab = wrap('billTab', qiFabSync);
    renderInvoiceRows = wrap('renderInvoiceRows', () => { if (qi) qiStrip(); });
    const oc = spCommit;
    spCommit = function (next) {
        if (!qi) return oc.apply(this, arguments);
        if (sp && !sp.edit && !(parseFloat(sp.price) > 0)) {   // مادة بلا سعر: لا يُنتقل للخطوة التالية قبل إدخاله
            const pi = document.querySelector('#spCard .sp-price');
            if (pi) { pi.focus(); pi.classList.add('qi-need'); }
            Swal.fire({ icon: 'warning', title: 'أدخل سعر المادة أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 2000 });
            return;
        }
        oc.call(this, false);
        if (sp) return;                                    // لم تُضف (رسالة تنبيه)
        qiStrip();
        if (next) setTimeout(qiScan, 250);
    };
})();

function qiClean(s) { return String(s || '').trim(); }
async function qiStart() {
    if (typeof userRole !== 'undefined' && userRole === 'guest') return;
    readInvoiceFields();
    const dirty = bill && !bill.issued && (bill.items.length || bill.to || bill.customer || bill.doctor);
    let keep = false;
    if (bill && bill.issued) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); billTab('new'); }
    else if (dirty) {
        const r = await Swal.fire({ icon: 'question', title: 'في الفاتورة الحالية بيانات', text: 'هل تريد الإضافة عليها أم البدء بفاتورة جديدة؟', showCancelButton: true, showDenyButton: true,
            confirmButtonText: 'الإضافة عليها', denyButtonText: 'فاتورة جديدة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', denyButtonColor: '#b45309' });
        if (r.isDismissed) return;
        if (r.isDenied) { bill = emptyInvoice(); lsSet(BILL_LS.draft, JSON.stringify(bill)); billTab('new'); } else keep = true;
    }
    qi = { keep };
    qiFabSync();
    qiStep1();
}
function qiHost() {
    let h = document.getElementById('qiPanel');
    if (!h) { h = document.createElement('div'); h.id = 'qiPanel'; h.className = 'qi-ov'; h.dir = 'rtl'; document.body.appendChild(h); }
    h.style.display = 'flex'; return h;
}
function qiDl(kind) { return `<datalist id="qiDl_${kind}">${qiNames(kind).map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`; }
function qiStep1() {
    const h = qiHost();
    h.innerHTML = `<div class="qi-card" role="dialog" aria-label="الفاتورة السريعة">
        <div class="qi-head"><b>⚡ فاتورة سريعة</b><span class="qi-step">الخطوة ١ من ٢</span><button type="button" class="qi-x" onclick="qiAbandon()" aria-label="إغلاق">✕</button></div>
        <label class="qi-l">اسم الشركة<input id="qiTo" list="qiDl_to" autocomplete="off" value="${escapeHtml(bill.to || '')}" placeholder="اختياري"></label>
        <label class="qi-l">اسم الزبون<input id="qiCust" list="qiDl_customer" autocomplete="off" value="${escapeHtml(bill.customer || '')}" placeholder="اختياري"></label>
        <label class="qi-l">اسم الطبيب<input id="qiDoc" list="qiDl_doctor" autocomplete="off" value="${escapeHtml(bill.doctor || '')}" placeholder="اختياري"></label>
        <label class="qi-l">التاريخ<input id="qiDate" type="date" value="${escapeHtml(bill.date || todayLocalISO())}"></label>
        ${qiDl('to')}${qiDl('customer')}${qiDl('doctor')}
        <button type="button" class="qi-go" onclick="qiNext()">التالي ◀</button>
    </div>`;
}
function qiNext() {
    const g = id => qiClean(document.getElementById(id).value);
    bill.to = g('qiTo'); bill.customer = g('qiCust'); bill.doctor = g('qiDoc'); bill.date = document.getElementById('qiDate').value || todayLocalISO();
    writeInvoiceFields(); billChanged(); qiRemember();
    qiStep2(); qiScan();
}
function qiStep2() {
    const h = qiHost();
    h.innerHTML = `<div class="qi-card" role="dialog" aria-label="مسح المواد">
        <div class="qi-head"><b>⚡ فاتورة سريعة</b><span class="qi-step">الخطوة ٢ من ٢</span><button type="button" class="qi-x" onclick="qiAbandon()" aria-label="إغلاق">✕</button></div>
        <div class="qi-strip" id="qiStrip"></div>
        <button type="button" class="qi-go" onclick="qiScan()">📷 مسح مادة</button>
        <input type="search" id="qiQ" class="qi-q" placeholder="🔍 أو اكتب اسم المادة..." autocomplete="off" oninput="qiSearch(this.value)">
        <div id="qiRes" class="qi-res"></div>
        <div class="qi-row"><button type="button" class="qi-sec" id="qiUndo" onclick="qiUndo()">↩ تراجع عن آخر مادة</button>
        <button type="button" class="qi-fin" onclick="qiFinish()">✓ إنهاء</button></div>
    </div>`;
    qiStrip();
}
function qiStrip() {
    const el = document.getElementById('qiStrip'); if (!el) return;
    const n = bill.items.length, t = billTotals();
    el.innerHTML = n ? `<b>${n} ${n === 1 ? 'مادة' : n === 2 ? 'مادتان' : n <= 10 ? 'مواد' : 'مادة'}</b> · <span>${fmtNum(t.total)} د.ع</span><small>${escapeHtml(bill.items[n - 1].name)}</small>` : '<small>لم تُضف مواد بعد</small>';
    const u = document.getElementById('qiUndo'); if (u) u.disabled = !n;
}
function qiScan() {
    if (!qi) return;
    let t = 0;
    const cb = (code, gs1) => { clearTimeout(t); billAddByBarcode(code, gs1); };
    t = setTimeout(() => {
        if (typeof barcodeCallback === 'undefined' || barcodeCallback !== cb) return;
        const m = document.getElementById('bcManual'); if (m && (m.value || document.activeElement === m)) return;
        closeBarcodeScanner();
        const q = document.getElementById('qiQ'); if (q) q.focus();
        Swal.fire({ icon: 'info', title: 'لم يُقرأ باركود — ابحث بالاسم', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    }, BILL_SCAN_WAIT_MS);
    openBarcodeScanner(cb);
}
function qiSearch(v) {
    const b = document.getElementById('qiRes'); if (!b) return;
    const qn = normSearch(v || ''), qt = qn ? qn.split(' ') : [];
    const res = qn ? products.map(p => ({ p, s: searchScore(p, qn, qt) })).filter(x => x.s > 0).sort((a, c) => c.s - a.s).slice(0, 6).map(x => x.p) : [];
    b.innerHTML = res.map(p => `<button type="button" class="sc-res" onclick="qiPick(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand || '')}</small><span>${fmtNum(p.price || 0)}</span></button>`).join('');
}
function qiPick(id) {
    const q = document.getElementById('qiQ'); if (q) q.value = ''; const b = document.getElementById('qiRes'); if (b) b.innerHTML = '';
    if (typeof spOpen === 'function') spOpen(id, { scan: true }); else { billAddProduct(id); }
}
async function qiUndo() {
    if (!bill.items.length) return;
    const last = bill.items[bill.items.length - 1];
    const ok = await askSure('حذف آخر مادة؟', last.name, 'نعم، احذف');
    if (!ok) return;
    bill.items.pop(); renderInvoiceRows(); billChanged();
}
async function qiAbandon() {
    const ok = await askSure('الخروج من الفاتورة السريعة؟', 'ستبقى المعلومات والمواد المضافة في الفاتورة الحالية.', 'نعم، خروج');
    if (ok) qiClose();
}
function qiClose() {
    qi = null; const h = document.getElementById('qiPanel'); if (h) h.style.display = 'none';
    qiFabSync(); try { window.scrollTo(0, 0); } catch (e) { /* تجاهل */ }
}
// ---- الإنهاء ----
function qiEligible() {   // مواد غير مسعّرة بملصق الوزارة (نقابة/نسبة) وكميتها تقبل خطوة 250
    const out = [];
    bill.items.forEach((it, i) => {
        const p = it.pid && products.find(x => x.id === it.pid);
        const qty = parseFloat(it.qty) || 0;
        if (!p || !qty || !['syndicate', 'percent'].includes(p.pricing)) return;
        if (!Number.isInteger(250 / qty)) return;
        out.push(i);
    });
    return out;
}
async function qiRound() {   // false = رجوع
    const rem = () => Math.round(billTotals().total) % 1000;
    if (rem() === 0) return true;
    const el = qiEligible();
    if (!el.length) { await Swal.fire({ icon: 'info', title: 'المجموع ليس ألفاً كاملة', text: 'لا توجد مواد غير مسعّرة بالملصق يمكن تعديل سعرها.', confirmButtonText: 'متابعة', confirmButtonColor: '#0f1c38' }); return true; }
    let cur = el[0];
    const r = await Swal.fire({ title: 'تسوية المجموع إلى ألف كاملة', showCancelButton: true, confirmButtonText: 'تم', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38',
        html: `<div class="qi-sum">المجموع: <b id="qiRT"></b></div>
            <div class="qi-rl">${el.map(i => `<label class="qi-rr"><input type="radio" name="qiRI" value="${i}" ${i === cur ? 'checked' : ''}><span dir="ltr">${escapeHtml(bill.items[i].name)}</span><b id="qiRP${i}"></b></label>`).join('')}</div>
            <div class="qi-rb"><button type="button" id="qiRm">− 250</button><button type="button" id="qiRp">+ 250</button></div>`,
        didOpen: () => {
            const upd = () => { document.getElementById('qiRT').innerText = fmtNum(billTotals().total) + ' د.ع'; el.forEach(i => { const e = document.getElementById('qiRP' + i); if (e) e.innerText = fmtNum(bill.items[i].price); }); };
            const step = d => { const it = bill.items[cur], np = (parseFloat(it.price) || 0) + d / (parseFloat(it.qty) || 1); if (np <= 0) return; it.price = np; renderInvoiceRows(); billChanged(); upd(); };
            document.querySelectorAll('input[name=qiRI]').forEach(x => x.onchange = () => { cur = +x.value; });
            document.getElementById('qiRm').onclick = () => step(-250); document.getElementById('qiRp').onclick = () => step(250); upd();
        } });
    return !r.isDismissed;
}
async function qiFinish() {
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'أضف مادة واحدة على الأقل', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 }); return; }
    if (!(await qiRound())) return;
    const t = billTotals();
    const r2 = await Swal.fire({ icon: 'success', title: 'جاهزة للإصدار', confirmButtonText: 'عرض الفاتورة', showCancelButton: true, cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38',
        html: `<div class="qi-final"><small>السعر النهائي</small><b>${fmtNum(t.total)} د.ع</b></div>
            <label class="qi-credit"><input type="checkbox" id="qiCredit"> بيع آجل (دفع جزء من المبلغ)</label>
            <div id="qiPaidBox" style="display:none"><input id="qiPaid" type="number" inputmode="numeric" min="0" class="swal2-input" placeholder="المبلغ المدفوع (اتركه 0 إن لم يُدفع شيء)"></div>`,
        didOpen: () => { const c = document.getElementById('qiCredit'); c.onchange = () => { document.getElementById('qiPaidBox').style.display = c.checked ? '' : 'none'; }; },
        preConfirm: () => { const c = document.getElementById('qiCredit').checked; return { credit: c, paid: c ? (parseFloat(document.getElementById('qiPaid').value) || 0) : null }; } });
    if (r2.isDismissed) return;
    bill.paid = r2.value.credit ? String(Math.min(r2.value.paid, t.total)) : '';
    writeInvoiceFields(); billChanged(); renderInvoiceRows();
    lsSet(BILL_LS.draft, JSON.stringify(bill));
    qiClose();
}

// ===== مشاركة الفاتورة كملف PDF (واتساب وغيره) =====
function qiLoadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(x => x.src && x.src.endsWith(src))) return res(); const e = document.createElement('script'); e.src = src; e.onload = res; e.onerror = () => rej(new Error('تعذر تحميل ' + src)); document.head.appendChild(e); }); }
async function billSharePdf() {
    readInvoiceFields();
    if (!bill.items.length) { Swal.fire({ icon: 'warning', title: 'القائمة فارغة', text: 'أضف مادة واحدة على الأقل قبل المشاركة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
    const h = Prog.start('تجهيز ملف الفاتورة', { text: 'تحميل الأدوات...' });
    try {
        await qiLoadScript('vendor/html-to-image.js'); await qiLoadScript('vendor/pdf-lib.min.js');
        h.set(25, 'تصوير الفاتورة...');
        const sheet = document.getElementById('billSheet');
        document.body.classList.add('capturing-bill'); document.querySelectorAll('#billPane-new textarea').forEach(autoGrow); await new Promise(r => setTimeout(r, 60));
        let png; try { png = await htmlToImage.toPng(sheet, { pixelRatio: 2.5, backgroundColor: '#ffffff', cacheBust: true, filter: n => !(n.classList && n.classList.contains('no-print')) }); } finally { document.body.classList.remove('capturing-bill'); }
        h.set(65, 'إنشاء ملف PDF...');
        const { PDFDocument } = PDFLib, doc = await PDFDocument.create(), img = await doc.embedPng(png);
        const W = 595.28, H = 841.89, M = 24, usable = H - 2 * M; let iw = W - 2 * M, ih = img.height * iw / img.width;
        if (ih > usable && ih <= usable * 1.3) { iw = iw * usable / ih; ih = usable; }   // تُضغط لتتسع بصفحة واحدة إن كانت قريبة من حجمها
        const pages = Math.max(1, Math.ceil(ih / usable - 0.02));
        for (let i = 0; i < pages; i++) { const pg = doc.addPage([W, H]); pg.drawImage(img, { x: (W - iw) / 2, y: H - M - ih + i * usable, width: iw, height: ih }); if (i > 0 || pages > 1) { pg.drawRectangle({ x: 0, y: H - M, width: W, height: M, color: PDFLib.rgb(1, 1, 1) }); pg.drawRectangle({ x: 0, y: 0, width: W, height: M, color: PDFLib.rgb(1, 1, 1) }); } }
        const bytes = await doc.save(), name = (bill.no || 'invoice') + '.pdf';
        const file = new File([bytes], name, { type: 'application/pdf' });
        h.ok('الملف جاهز');
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'فاتورة ' + (bill.no || '') }); } catch (e) { if (e && e.name !== 'AbortError') throw e; }
        } else {
            const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
            Swal.fire({ icon: 'info', title: 'نُزّل الملف', text: 'المشاركة المباشرة غير مدعومة في هذا المتصفح؛ أرفق الملف من التنزيلات في واتساب.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        }
    } catch (e) { h.fail('تعذّر تجهيز الملف', String(e && e.message || e)); }
}
