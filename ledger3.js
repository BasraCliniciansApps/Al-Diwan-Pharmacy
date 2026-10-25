// =====================================================================
// البونص، المناقلة بين الصيدليات، المنتهي والتالف (كلها في pharmacy_ledger)
// kind: pharm (صيدلية) | xfer (مناقلة) | xpay (دفعة بين الصيدليات) | exp (منتهي/تالف)
// =====================================================================
const LG_EXP_REASONS = ['منتهي الصلاحية', 'تالف', 'كسر', 'تلف تخزين', 'أخرى'];
const lgXfers = () => lgAll.filter(e => e.kind === 'xfer' && !e.del);
const lgXpays = () => lgAll.filter(e => e.kind === 'xpay' && !e.del);
const lgExps = () => lgAll.filter(e => e.kind === 'exp' && !e.del);
function lgPharmacies() {
    const m = new Map();
    lgAll.filter(e => e.kind === 'pharm' && !e.del).forEach(e => m.set(puKey(e.name), e.name));
    [...lgXfers(), ...lgXpays()].forEach(e => { if (e.pharmacy && !m.has(puKey(e.pharmacy))) m.set(puKey(e.pharmacy), e.pharmacy); });
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'ar'));
}
// ---------- فترة عامة لتقارير هذه الملفات: بادئة عناصر + (شهر|سنة|الكل) ----------
function lgRg(pfx) {
    const t = $b(pfx + 'Type').value;
    $b(pfx + 'MW').style.display = t === 'month' ? '' : 'none'; $b(pfx + 'YW').style.display = t === 'year' ? '' : 'none';
    if (t === 'all') return { from: '0000-01', to: '9999-12', label: 'كل الفترات', file: 'all', year: false, all: true };
    if (t === 'year') { const y = String($b(pfx + 'Year').value || new Date().getFullYear()); return { from: y + '-01', to: y + '-12', label: y, file: y, year: true }; }
    const m = $b(pfx + 'Month').value || lgNowMonth(); return { from: m, to: m, label: lgMonthLabel(m), file: m, year: false };
}
function lgRgInit(pfx) { if (!$b(pfx + 'Month').value) $b(pfx + 'Month').value = lgNowMonth(); if (!$b(pfx + 'Year').value) $b(pfx + 'Year').value = new Date().getFullYear(); }
const lgInR = (rg, date) => { const m = lgMonthOfDate(date); return m >= rg.from && m <= rg.to; };
const lgSortD = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdTs || '').localeCompare(String(b.createdTs || ''));
const lgItemsTxt = e => (e.items || []).map(l => l.name + ' ×' + l.qty).join('، ');

// =====================================================================
// البونص
// =====================================================================
function lgInitBonus() { lgRgInit('lgb'); lgFillSupSelect('lgbSup'); lgRenderBonus(); }
function lgBonusRows() {
    const rg = lgRg('lgb'), sup = $b('lgbSup').value, rows = [];
    puAll.filter(r => !r.cancelled && lgInR(rg, r.useEntry ? puMonthOf(r) + '-01' : r.date) && (!sup || puKey(r.supplier) === puKey(sup))).forEach(r => (r.items || []).filter(l => parseInt(l.bonus) > 0).forEach(l => {
        const q = parseInt(l.bonus) || 0, cost = puNum(l.cost);
        rows.push({ date: r.date, sup: r.supplier, no: r.no, name: l.name, qty: q, cost, vCost: q * cost, vSale: puNum(l.bonusSale) || (q * (Number((products.find(x => x.id === l.pid) || {}).price) || 0)), createdTs: r.createdTs });
    }));
    lgAll.filter(e => e.kind === 'breq' && !e.del && (!sup || puKey(e.supplier) === puKey(sup)) && (e.date ? lgInR(rg, e.date) : rg.all)).forEach(e => rows.push({ date: e.date || '', sup: e.supplier || (e.rep ? 'مندوب ' + e.rep : 'بدون مذخر'), no: e.listNo || '', name: e.name, qty: puNum(e.qty), cost: 0, vCost: 0, vSale: 0, createdTs: e.createdTs, xid: e.id, rep: e.rep }));
    return { rg, rows: rows.sort(lgSortD) };
}
function lgRenderBonus() {
    if (!$b('lgb-list')) return;
    const { rg, rows } = lgBonusRows(), t = k => rows.reduce((s, x) => s + x[k], 0);
    $b('lgb-sum').innerHTML = `<span>البونص — ${escapeHtml(rg.label)}</span><b>${fmtNum(t('vSale'))} د.ع</b><small>قيمته بسعر البيع (ربحك المتوقع) • بالكلفة (توفيرك): ${fmtNum(t('vCost'))} • ${fmtNum(t('qty'))} عبوة</small>`;
    const sorted = rows.slice().sort((p, q) => String(p.date || '').localeCompare(String(q.date || ''))); let lastD = null;
    $b('lgb-list').innerHTML = sorted.map(x => {
        const dk = x.date || '', head = dk !== lastD ? `<div class="bn-day">${x.date ? escapeHtml(fmtDateDMY(x.date)) : 'بلا تاريخ'}</div>` : ''; lastD = dk;
        const val = x.xid ? `<button type="button" class="bill-tb-btn bill-danger bn-del" onclick="lgBreqDel('${x.xid}')">🗑</button>` : `<span class="bn-v ${x.vSale > 0 ? '' : 'none'}">${x.vSale > 0 ? fmtNum(x.vSale) : '—'}</span>`;
        return head + `<div class="bn-card"><div class="bn-r1"><b class="bn-n" dir="ltr">${escapeHtml(x.name)}</b>${val}</div><div class="bn-r2"><em class="tg">🎁 ${fmtNum(x.qty)} مجاني</em>${x.xid ? '<em class="bn-tag">هدية/عرض</em>' : ''}</div><div class="bn-r3">${escapeHtml(x.sup)}${x.no ? ' • قائمة ' + escapeHtml(x.no) : ''}</div></div>`;
    }).join('') || '<div class="bill-none">لا يوجد بونص في هذه الفترة. أضفه من خانة «بونص» عند إدخال الوارد.</div>';
    const mb = (rg.year || rg.all) ? `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>العدد</th><th>بالكلفة</th><th>بسعر البيع</th></tr></thead><tbody>${[...new Set(rows.map(x => lgMonthOfDate(x.date)))].sort().map(m => { const l = rows.filter(x => lgMonthOfDate(x.date) === m), s = k => l.reduce((a, x) => a + x[k], 0); return `<tr><td>${lgMonthLabel(m)}</td><td>${fmtNum(s('qty'))}</td><td>${fmtNum(s('vCost'))}</td><td>${fmtNum(s('vSale'))}</td></tr>`; }).join('')}</tbody></table></div>` : '';
    $b('lgb-sheet').innerHTML = lgLetterhead('سجل البونص (المواد المجانية)', escapeHtml(rg.label) + ($b('lgbSup').value ? ' — ' + escapeHtml($b('lgbSup').value) : '')) + mb +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th>التاريخ</th><th>المذخر</th><th>القائمة</th><th>المادة</th><th>العدد</th><th>سعر الشراء</th><th>بالكلفة</th><th>بسعر البيع</th></tr></thead><tbody>${rows.map((x, i) => `<tr><td class="pu-n">${i + 1}</td><td>${escapeHtml(fmtDateDMY(x.date))}</td><td>${escapeHtml(x.sup)}</td><td dir="ltr">${escapeHtml(x.no)}</td><td dir="ltr">${escapeHtml(x.name)}</td><td>${fmtNum(x.qty)}</td><td>${fmtNum(x.cost)}</td><td>${fmtNum(x.vCost)}</td><td>${fmtNum(x.vSale)}</td></tr>`).join('') || '<tr><td colspan="9">لا يوجد بونص.</td></tr>'}</tbody>${rows.length ? `<tfoot><tr><td colspan="5">المجموع</td><td>${fmtNum(t('qty'))}</td><td></td><td>${fmtNum(t('vCost'))}</td><td>${fmtNum(t('vSale'))}</td></tr></tfoot>` : ''}</table></div>`;
}
function lgBonusCsv() {
    const { rg, rows } = lgBonusRows(), L = [['التاريخ', 'المذخر', 'رقم القائمة', 'المادة', 'العدد', 'سعر الشراء', 'القيمة بالكلفة', 'القيمة بسعر البيع']];
    rows.forEach(x => L.push([x.date, x.sup, x.no, x.name, x.qty, x.cost, x.vCost, x.vSale]));
    L.push(['المجموع', '', '', '', rows.reduce((s, x) => s + x.qty, 0), '', rows.reduce((s, x) => s + x.vCost, 0), rows.reduce((s, x) => s + x.vSale, 0)]);
    lgCsvDownload('bonus-' + rg.file + '.csv', L);
}

// =====================================================================
// نافذة موحّدة: مناقلة / منتهي وتالف
// =====================================================================
let lgx = null;
function lgxEnsure() {
    if ($b('lgX')) return;
    const d = document.createElement('div'); d.id = 'lgX'; d.className = 'lg-ov'; d.style.display = 'none';
    d.innerHTML = `<div class="lg-card" dir="rtl">
        <div class="lg-h"><b id="lgxTitle"></b><button type="button" onclick="lgxClose()" aria-label="إغلاق">✕</button></div>
        <div class="lg-body">
            <div class="lg-grid">
                <label class="lg-wide" id="lgxPhW"><span>الصيدلية</span><select id="lgxPh"></select></label>
                <label id="lgxDirW"><span>الاتجاه</span><select id="lgxDir"><option value="out">إرسال إلى الصيدلية</option><option value="in">استلام من الصيدلية</option></select></label>
                <label id="lgxModeW"><span>نوع المناقلة</span><select id="lgxMode"><option value="credit">بالآجل</option><option value="consign">على التصريف</option><option value="cash">نقداً</option></select></label>
                <label id="lgxReasonW"><span>السبب</span><select id="lgxReason"></select></label>
                <label><span>التاريخ</span><input type="date" id="lgxDate"></label>
            </div>
            <div id="lgxLines"></div>
            <div class="bill-search-wrap"><input type="search" id="lgxSearch" autocomplete="off" placeholder="🔍 ابحث عن مادة من المخزن لإضافتها..." oninput="lgxSearchInput()"><div class="bill-results" id="lgxResults" style="display:none"></div></div>
            <label class="lg-wide lg-grid" style="display:flex;flex-direction:column;gap:4px;font-size:.76rem;font-weight:800;color:#475569"><span>ملاحظات</span><input id="lgxNote" style="min-height:42px;padding:0 10px;border:1.5px solid #cbd5e1;border-radius:10px;font-family:inherit"></label>
            <label class="pu-chk"><input type="checkbox" id="lgxStock" checked><span id="lgxStockTxt">تعديل المخزن</span></label>
        </div>
        <div class="lg-f"><span id="lgxTotal"></span><button type="button" class="bill-tb-btn bill-tb-primary" onclick="lgxSave()">💾 حفظ</button></div>
    </div>`;
    document.body.appendChild(d);
    $b('lgxReason').innerHTML = LG_EXP_REASONS.map(x => `<option>${x}</option>`).join('');
}
function lgxClose() { const m = $b('lgX'); if (m) m.style.display = 'none'; lgx = null; }
function lgxFillPh(sel) { const arr = lgPharmacies(); $b('lgxPh').innerHTML = (arr.length ? '' : '<option value="">— أضف صيدلية أولاً —</option>') + arr.map(n => `<option>${escapeHtml(n)}</option>`).join(''); if (sel) $b('lgxPh').value = sel; }
function lgxOpen(kind, opts) {
    opts = opts || {}; lgxEnsure();
    lgx = { kind, lines: [] };
    const isX = kind === 'xfer';
    $b('lgxTitle').textContent = isX ? '🔁 مناقلة بين الصيدليات' : '🗑️ تسجيل مادة منتهية / تالفة';
    $b('lgxPhW').style.display = $b('lgxDirW').style.display = $b('lgxModeW').style.display = isX ? '' : 'none';
    $b('lgxReasonW').style.display = isX ? 'none' : '';
    $b('lgxDate').value = todayLocalISO(); $b('lgxNote').value = ''; $b('lgxSearch').value = ''; $b('lgxResults').style.display = 'none'; $b('lgxStock').checked = true;
    $b('lgxStockTxt').textContent = isX ? 'تعديل المخزن (إنقاص عند الإرسال / زيادة عند الاستلام)' : 'إنقاص الكميات من المخزن';
    if (isX) { lgxFillPh(opts.pharmacy || ''); $b('lgxDir').value = 'out'; $b('lgxMode').value = 'credit'; }
    else $b('lgxReason').selectedIndex = 0;
    if (opts.pid) lgxAddProd(opts.pid, true);
    lgxRender();
    $b('lgX').style.display = 'flex';
    if (typeof Swal !== 'undefined' && Swal.close) Swal.close();
}
function lgxAddProd(id, silent) {
    const p = products.find(x => x.id === id); if (!p) return;
    const ex = lgx.lines.find(l => l.pid === id);
    if (ex) ex.qty = (ex.qty || 0) + 1;
    else { const dates = getProductExpiryDates(p); lgx.lines.push({ pid: id, name: p.name, qty: 1, cost: p.costPrice || 0, expiry: lgx.kind === 'exp' ? (dates[0] || '') : '' }); }
    if (!silent) { $b('lgxSearch').value = ''; $b('lgxResults').style.display = 'none'; lgxRender(); }
}
function lgxSearchInput() {
    const qn = normSearch($b('lgxSearch').value), box = $b('lgxResults');
    if (!qn) { box.style.display = 'none'; return; }
    const toks = qn.split(' '), found = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    box.innerHTML = found.map(p => productPickHtml(p, 'lgxAddProd', 'بالمخزن ' + stockLabel(p) + (p.costPrice ? ' · شراء ' + fmtNum(p.costPrice) : ''))).join('') || '<div class="bill-noresult">لا توجد نتائج</div>';
    box.style.display = 'block';
}
function lgxRender() {
    $b('lgxLines').innerHTML = lgx.lines.length ? `<div class="lg-lines">${lgx.lines.map((l, i) => `<div class="lg-line lg-line3"><div class="lg-ln"><b dir="ltr">${escapeHtml(l.name)}</b></div>
        <input type="number" min="0" inputmode="numeric" placeholder="العدد" value="${l.qty || ''}" oninput="lgx.lines[${i}].qty=parseInt(this.value)||0;lgxRecalc()">
        <input type="number" min="0" inputmode="decimal" placeholder="${lgx.kind === 'xfer' ? 'سعر المناقلة' : 'سعر الشراء'}" value="${l.cost || ''}" oninput="lgx.lines[${i}].cost=parseFloat(this.value)||0;lgxRecalc()">
        <button type="button" class="pu-x" onclick="lgx.lines.splice(${i},1);lgxRender()" aria-label="حذف">✕</button>
        <input type="month" dir="ltr" class="lg-exp" title="تاريخ النفاذ" value="${escapeHtml(l.expiry || '')}" oninput="lgx.lines[${i}].expiry=this.value"></div>`).join('')}</div>` : '<div class="bill-none">ابحث عن مادة لإضافتها.</div>';
    lgxRecalc();
}
const lgxSum = () => lgx.lines.filter(l => l.qty > 0).reduce((s, l) => s + l.qty * (l.cost || 0), 0);
function lgxRecalc() { if (lgx) $b('lgxTotal').innerHTML = 'المبلغ: <b>' + fmtNum(lgxSum()) + '</b> د.ع'; }
async function lgxSave() {
    if (!lgx) return;
    const isX = lgx.kind === 'xfer', lines = lgx.lines.filter(l => l.qty > 0), date = $b('lgxDate').value || todayLocalISO();
    const warn = t => Swal.fire({ icon: 'warning', title: t, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    const ph = isX ? $b('lgxPh').value : '', dir = isX ? $b('lgxDir').value : 'out';
    if (isX && !ph) return warn('اختر الصيدلية، أو أضف صيدلية جديدة من تبويب المناقلة');
    if (!lines.length) return warn('أضف مادة واحدة على الأقل بعدد صحيح');
    const touch = $b('lgxStock').checked, dec = isX ? dir === 'out' : true;
    if (touch) {
        if (!writesAllowed()) return;
        if (dec) {
            const short = lines.filter(l => { const p = products.find(x => x.id === l.pid); return p && !setupSkip(p) && l.qty > (parseInt(p.qty) || 0); });
            if (short.length) { const r = await Swal.fire({ icon: 'question', title: 'الكمية أكبر من الموجود في المخزن', text: short.map(l => l.name).join('، ') + ' — سيصبح رصيدها صفراً. متابعة؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'رجوع' }); if (!r.isConfirmed) return; }
        }
        const snaps = new Map(), touched = [];
        lines.forEach(l => {
            const p = products.find(x => x.id === l.pid); if (!p || setupSkip(p)) return;
            if (!snaps.has(p.id)) snaps.set(p.id, { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase });
            if (dec) {
                p.qty = Math.max((parseInt(p.qty) || 0) - l.qty, 0);
                if (!isX && l.expiry && getProductExpiryDates(p).includes(l.expiry)) { p.expiryDates = getProductExpiryDates(p).filter(e => e !== l.expiry); p.expiryDate = p.expiryDates[0] || ''; }
            } else { p.qty = (parseInt(p.qty) || 0) + l.qty; if (l.expiry) puExpiryPush(p, l.expiry); }
            touched.push(p);
        });
        if (touched.length && !(await saveProductsDelta([...new Set(touched)].map(p => deltaFromSnap(p, snaps.get(p.id)))))) { touched.forEach(p => { Object.assign(p, snaps.get(p.id)); }); renderAll(); return; }
        lines.forEach(l => { const p = products.find(x => x.id === l.pid), o = snaps.get(l.pid); if (p && o) logAction('qty', p, [{ f: 'الكمية (' + (isX ? (dir === 'out' ? 'مناقلة إلى ' : 'مناقلة من ') + ph : $b('lgxReason').value) + ')', from: String(o.qty), to: String(p.qty) }]); });
        renderAll();
    }
    const ev = { id: lgId(), kind: lgx.kind, date, items: lines.map(l => ({ pid: l.pid, name: l.name, qty: l.qty, cost: l.cost || 0, expiry: l.expiry || '' })), amount: lgxSum(), note: $b('lgxNote').value.trim(), stockApplied: touch, createdTs: new Date().toISOString() };
    if (isX) Object.assign(ev, { pharmacy: ph, dir, mode: $b('lgxMode').value }); else ev.reason = $b('lgxReason').value;
    await lgSave(ev); const kind = lgx.kind; lgxClose();
    Swal.fire({ icon: 'success', title: 'تم الحفظ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
    if (kind === 'xfer') lgRenderXfer(); else lgRenderExp();
}

// =====================================================================
// المناقلة بين الصيدليات
// =====================================================================
function lgInitXfer() { lgRgInit('lgf'); lgFillXferSel(); lgRenderXfer(); }
function lgFillXferSel() { const sel = $b('lgxfSel'), cur = sel.value; sel.innerHTML = '<option value="">كل الصيدليات</option>' + lgPharmacies().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''); sel.value = cur; }
async function lgAddPharmacy() {
    const r = await Swal.fire({ title: 'إضافة صيدلية', input: 'text', inputPlaceholder: 'اسم الصيدلية', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', inputValidator: v => !String(v || '').trim() ? 'اكتب الاسم' : undefined });
    if (!r.isConfirmed) return; const name = String(r.value || '').trim(); if (!name) return;
    if (lgPharmacies().some(n => puKey(n) === puKey(name))) { $b('lgxfSel').value = lgPharmacies().find(n => puKey(n) === puKey(name)); return lgRenderXfer(); }
    await lgSave({ id: lgId(), kind: 'pharm', name, createdTs: new Date().toISOString() });
    lgFillXferSel(); $b('lgxfSel').value = name; lgRenderXfer();
}
function lgXferData() {
    const rg = lgRg('lgf'), ph = $b('lgxfSel').value, okP = e => !ph || puKey(e.pharmacy) === puKey(ph);
    const xs = lgXfers().filter(e => lgInR(rg, e.date) && okP(e)), ps = lgXpays().filter(e => lgInR(rg, e.date) && okP(e));
    const t = (arr, f) => arr.filter(f).reduce((s, e) => s + puNum(e.amount), 0);
    const out = t(xs, e => e.dir === 'out'), inn = t(xs, e => e.dir === 'in'), recv = t(ps, e => e.dir === 'recv'), paid = t(ps, e => e.dir === 'paid');
    return { rg, ph, xs, ps, out, inn, recv, paid, bal: out - inn - recv + paid, all: [...xs.map(e => ({ ...e, _t: 'x' })), ...ps.map(e => ({ ...e, _t: 'p' }))].sort((a, b) => lgOrdCmp('xfer', e => e)(a, b) || lgSortD(a, b)) };
}
const lgXLabel = e => e._t === 'p' ? (e.dir === 'recv' ? 'دفعة مستلمة' : 'دفعة مدفوعة') : (e.dir === 'out' ? 'إرسال' : 'استلام') + ({ credit: ' (بالآجل)', consign: ' (على التصريف)', cash: ' (نقداً)' }[e.mode] || '');
function lgRenderXfer() {
    if (!$b('lgxf-list')) return;
    const d = lgXferData();
    lgSeqSet('xfer', d.all.map(e => ({ kind: 'lg', id: e.id })));
    $b('lgxf-sum').innerHTML = `<span>${d.ph ? escapeHtml(d.ph) + ' — ' : ''}الصافي ${d.bal >= 0 ? 'لك' : 'عليك'}</span><b>${fmtNum(Math.abs(d.bal))} د.ع</b><small>مُرسل ${fmtNum(d.out)} • مُستلَم ${fmtNum(d.inn)} • دفعات مستلمة ${fmtNum(d.recv)} • مدفوعة ${fmtNum(d.paid)}</small>`;
    $b('lgxf-list').innerHTML = d.all.map(e => `<div class="bill-card"><div class="bill-card-main" onclick="lgXferOpen('${e.id}')"><b>${escapeHtml(e.pharmacy || '')}</b> <em class="tg ${e._t === 'x' && e.dir === 'out' ? 'warn' : ''}">${lgXLabel(e)}</em><small>${escapeHtml(fmtDateDMY(e.date))}${e.items ? ' • ' + e.items.length + ' مادة' : ''}${e.note ? ' • ' + escapeHtml(e.note) : ''}</small></div><div class="bill-card-amt">${fmtNum(e.amount)}<small>د.ع</small></div></div>`).join('') || '<div class="bill-none">لا توجد مناقلات. أضف صيدلية ثم سجّل أول مناقلة.</div>';
    $b('lgxf-sheet').innerHTML = lgLetterhead('كشف المناقلة بين الصيدليات', escapeHtml(d.ph || 'كل الصيدليات') + ' — ' + escapeHtml(d.rg.label)) +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th>التاريخ</th>${d.ph ? '' : '<th>الصيدلية</th>'}<th>النوع</th><th>المواد</th><th>المبلغ</th></tr></thead><tbody>${d.all.map((e, i) => `<tr>${lgSeqCell('xfer', i + 1)}<td>${escapeHtml(fmtDateDMY(e.date))}</td>${d.ph ? '' : `<td>${escapeHtml(e.pharmacy || '')}</td>`}<td>${lgXLabel(e)}</td><td dir="ltr" style="text-align:right">${escapeHtml(e.items ? lgItemsTxt(e) : (e.note || ''))}</td><td>${fmtNum(e.amount)}</td></tr>`).join('') || `<tr><td colspan="${d.ph ? 5 : 6}">لا توجد مناقلات.</td></tr>`}</tbody>` +
        `<tfoot><tr><td colspan="${d.ph ? 4 : 5}">مُرسل ${fmtNum(d.out)} − مُستلَم ${fmtNum(d.inn)} − دفعات مستلمة ${fmtNum(d.recv)} + دفعات مدفوعة ${fmtNum(d.paid)}</td><td>${fmtNum(d.bal)}</td></tr></tfoot></table></div>` +
        `<div class="bill-bottom"><div class="bill-totals"><div class="bill-trow bill-grand"><span>الصافي ${d.bal >= 0 ? 'المستحق لنا' : 'المستحق علينا'}</span><b>${fmtNum(Math.abs(d.bal))} د.ع</b></div></div></div>`;
}
async function lgXpayForm() {
    const ph = $b('lgxfSel').value; if (!ph && !lgPharmacies().length) return Swal.fire({ icon: 'info', title: 'أضف صيدلية أولاً', confirmButtonColor: '#0f1c38' });
    const opts = lgPharmacies().map(n => `<option ${n === ph ? 'selected' : ''}>${escapeHtml(n)}</option>`).join('');
    const r = await Swal.fire({ title: 'دفعة بين الصيدليات', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<div class="sw-form"><label>الصيدلية<select id="swXP" class="swal2-input">${opts}</select></label><label>نوع الحركة<select id="swXD" class="swal2-input"><option value="recv">استلمتُ منهم مبلغاً</option><option value="paid">دفعتُ لهم مبلغاً</option></select></label><label>المبلغ (د.ع)<input id="swXA" type="number" inputmode="decimal" class="swal2-input"></label><label>التاريخ<input id="swXT" type="date" class="swal2-input" value="${todayLocalISO()}"></label><label>ملاحظات<textarea id="swXN" class="swal2-textarea" rows="3"></textarea></label></div>`,
        preConfirm: () => { const a = parseFloat(document.getElementById('swXA').value); if (!(a > 0)) { Swal.showValidationMessage('أدخل المبلغ'); return false; } return { pharmacy: document.getElementById('swXP').value, dir: document.getElementById('swXD').value, amount: a, date: document.getElementById('swXT').value || todayLocalISO(), note: document.getElementById('swXN').value.trim() }; } });
    if (!r.isConfirmed || !r.value) return;
    await lgSave({ id: lgId(), kind: 'xpay', ...r.value, createdTs: new Date().toISOString() }); lgRenderXfer();
}
function lgXferOpen(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const rows = (e.items || []).map(l => `<tr><td dir="ltr">${escapeHtml(l.name)}</td><td>${fmtNum(l.qty)}</td><td>${fmtNum(l.cost)}</td><td dir="ltr">${escapeHtml(l.expiry || '—')}</td></tr>`).join('');
    Swal.fire({ title: escapeHtml(e.pharmacy) + ' — ' + fmtNum(e.amount) + ' د.ع', showConfirmButton: false, showCloseButton: true, width: 560,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(e.date))} • ${lgXLabel({ ...e, _t: e.kind === 'xpay' ? 'p' : 'x' })}</div>${rows ? `<div class="pu-d-scroll"><table class="bill-table"><thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>النفاذ</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}${e.note ? `<div class="pu-d-pays">${escapeHtml(e.note)}</div>` : ''}<div class="pu-d-btns"><button type="button" class="bill-tb-btn bill-danger" onclick="Swal.close();lgDelEvent('${e.id}')">🗑️ حذف</button></div></div>` });
}
async function lgDelEvent(id) {   // حذف مناقلة / منتهي / دفعة، مع خيار عكس أثرها على المخزن
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const hasStock = !!e.stockApplied && (e.items || []).length;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا السجل؟', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء', input: hasStock ? 'checkbox' : undefined, inputValue: 1, inputPlaceholder: 'عكس أثره على المخزن' });
    if (!r.isConfirmed) return;
    if (hasStock && r.value) {
        if (!writesAllowed()) return;
        const wasDec = e.kind === 'exp' || e.dir === 'out', snaps = new Map(), touched = [];
        e.items.forEach(l => { const p = products.find(x => x.id === l.pid); if (!p || setupSkip(p)) return; if (!snaps.has(p.id)) snaps.set(p.id, { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase }); p.qty = Math.max((parseInt(p.qty) || 0) + (wasDec ? 1 : -1) * puNum(l.qty), 0); if (wasDec && l.expiry) puExpiryPush(p, l.expiry); touched.push(p); });
        if (touched.length && !(await saveProductsDelta([...new Set(touched)].map(p => deltaFromSnap(p, snaps.get(p.id)))))) { touched.forEach(p => Object.assign(p, snaps.get(p.id))); return; }
        renderAll();
    }
    e.del = true; await lgSave(e); puRefreshCurrent();
}
function lgXferCsv() {
    const d = lgXferData(), L = [['التاريخ', 'الصيدلية', 'النوع', 'المواد', 'المبلغ', 'ملاحظات']];
    d.all.forEach(e => L.push([e.date, e.pharmacy || '', lgXLabel(e), e.items ? lgItemsTxt(e) : '', e.amount, e.note || '']));
    L.push(['الصافي ' + (d.bal >= 0 ? 'لنا' : 'علينا'), '', '', '', Math.abs(d.bal), '']);
    lgCsvDownload('transfers-' + (d.ph || 'all') + '-' + d.rg.file + '.csv', L);
}

// =====================================================================
// المنتهي والتالف
// =====================================================================
function lgInitExp() { lgRgInit('lge'); lgRenderExp(); }
function lgExpData() {
    const rg = lgRg('lge'), why = $b('lgeWhy').value;
    return { rg, arr: lgExps().filter(e => lgInR(rg, e.date) && (!why || e.reason === why)).sort(lgSortD) };
}
function lgRenderExp() {
    if (!$b('lge-list')) return;
    const { rg, arr } = lgExpData(), tot = arr.reduce((s, e) => s + puNum(e.amount), 0), qty = arr.reduce((s, e) => s + (e.items || []).reduce((a, l) => a + puNum(l.qty), 0), 0);
    $b('lge-sum').innerHTML = `<span>خسارة المنتهي والتالف — ${escapeHtml(rg.label)}</span><b>${fmtNum(tot)} د.ع</b><small>${fmtNum(qty)} عبوة • ${arr.length} سجل (بسعر الشراء)</small>`;
    $b('lge-list').innerHTML = arr.map(e => `<div class="bill-card"><div class="bill-card-main" onclick="lgExpOpen('${e.id}')"><b dir="ltr">${escapeHtml((e.items || []).map(l => l.name).slice(0, 2).join('، '))}${(e.items || []).length > 2 ? '…' : ''}</b> <em class="tg warn">${escapeHtml(e.reason || '')}</em><small>${escapeHtml(fmtDateDMY(e.date))} • ${(e.items || []).length} مادة${e.note ? ' • ' + escapeHtml(e.note) : ''}</small></div><div class="bill-card-amt">${fmtNum(e.amount)}<small>د.ع</small></div></div>`).join('') || '<div class="bill-none">لا توجد مواد منتهية مسجّلة في هذه الفترة.</div>';
    const flat = []; arr.forEach(e => (e.items || []).forEach(l => flat.push({ e, l })));
    const mb = (rg.year || rg.all) ? `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>العدد</th><th>الخسارة</th></tr></thead><tbody>${[...new Set(arr.map(e => lgMonthOfDate(e.date)))].sort().map(m => { const l = arr.filter(e => lgMonthOfDate(e.date) === m); return `<tr><td>${lgMonthLabel(m)}</td><td>${fmtNum(l.reduce((s, e) => s + (e.items || []).reduce((a, x) => a + puNum(x.qty), 0), 0))}</td><td>${fmtNum(l.reduce((s, e) => s + puNum(e.amount), 0))}</td></tr>`; }).join('')}</tbody></table></div>` : '';
    $b('lge-sheet').innerHTML = lgLetterhead('سجل الأدوية المنتهية والتالفة', escapeHtml(rg.label)) + mb + `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th>التاريخ</th><th>المادة</th><th>السبب</th><th>العدد</th><th>النفاذ</th><th>سعر المفرد</th><th>المجموع</th></tr></thead><tbody>${flat.map((x, i) => `<tr><td class="pu-n">${i + 1}</td><td>${escapeHtml(fmtDateDMY(x.e.date))}</td><td dir="ltr">${escapeHtml(x.l.name)}</td><td>${escapeHtml(x.e.reason || '')}</td><td>${fmtNum(x.l.qty)}</td><td dir="ltr">${escapeHtml(x.l.expiry || '')}</td><td>${fmtNum(x.l.cost)}</td><td>${fmtNum(puNum(x.l.qty) * puNum(x.l.cost))}</td></tr>`).join('') || '<tr><td colspan="8">لا توجد سجلات.</td></tr>'}</tbody>${flat.length ? `<tfoot><tr><td colspan="4">المجموع</td><td>${fmtNum(qty)}</td><td colspan="2"></td><td>${fmtNum(tot)}</td></tr></tfoot>` : ''}</table></div>`;
}
function lgExpOpen(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const rows = (e.items || []).map(l => `<tr><td dir="ltr">${escapeHtml(l.name)}</td><td>${fmtNum(l.qty)}</td><td>${fmtNum(l.cost)}</td><td dir="ltr">${escapeHtml(l.expiry || '—')}</td></tr>`).join('');
    Swal.fire({ title: fmtNum(e.amount) + ' د.ع — ' + escapeHtml(e.reason || ''), showConfirmButton: false, showCloseButton: true, width: 560,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(e.date))}</div><div class="pu-d-scroll"><table class="bill-table"><thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>النفاذ</th></tr></thead><tbody>${rows}</tbody></table></div>${e.note ? `<div class="pu-d-pays">${escapeHtml(e.note)}</div>` : ''}<div class="pu-d-btns"><button type="button" class="bill-tb-btn bill-danger" onclick="Swal.close();lgDelEvent('${e.id}')">🗑️ حذف</button></div></div>` });
}
function lgExpCsv() {
    const { rg, arr } = lgExpData(), L = [['التاريخ', 'المادة', 'السبب', 'العدد', 'النفاذ', 'سعر المفرد', 'المجموع', 'ملاحظات']];
    arr.forEach(e => (e.items || []).forEach(l => L.push([e.date, l.name, e.reason || '', l.qty, l.expiry || '', l.cost, puNum(l.qty) * puNum(l.cost), e.note || ''])));
    L.push(['المجموع', '', '', '', '', '', arr.reduce((s, e) => s + puNum(e.amount), 0), '']);
    lgCsvDownload('expired-' + rg.file + '.csv', L);
}
