// =====================================================================
// الوارد السريع (جدول): إدخال سطر بسطر بالكيبورد — اسم ← عدد ← بونص ← سعر ← انتهاء ← Enter
// يعمل على نفس القائمة pu.items التي تعرضها البطاقات، فأي تعديل بإحداهما يظهر بالثانية عند التبديل.
// المادة غير الموجودة تُنشأ من نفس السطر (اسم + شركة + سعر شراء) وتُعلَّم «ناقصة التفاصيل» لتكمل بياناتها لاحقاً.
// =====================================================================
let ptSel = null, ptNewMode = false, ptFound = [];
const ptEsc = s => escapeHtml(String(s === undefined || s === null ? '' : s));
function ptView() { try { return localStorage.getItem('puView') || 'table'; } catch (e) { return 'table'; } }
function puSetView(v) { try { localStorage.setItem('puView', v); } catch (e) { /* تجاهل */ } puRenderItems(); }
function ptApplyView() {
    const t = ptView() === 'table', f = $b('puFast'), c = $b('puItems');
    if (f) f.style.display = t ? '' : 'none';
    if (c) c.style.display = t ? 'none' : '';
    document.querySelectorAll('#puViewBar button').forEach(b => b.classList.toggle('active', b.dataset.v === (t ? 'table' : 'cards')));
}
function ptExpParse(s) {   // 0627 أو 06/27 أو 6/2027 ← 2027-06
    const d = String(s || '').replace(/\D/g, ''); let m, y;
    if (d.length === 4) { m = d.slice(0, 2); y = '20' + d.slice(2); }
    else if (d.length === 6) { m = d.slice(0, 2); y = d.slice(2); }
    else if (d.length === 3) { m = '0' + d[0]; y = '20' + d.slice(1); }
    else return '';
    const mi = parseInt(m); return mi >= 1 && mi <= 12 ? y + '-' + String(mi).padStart(2, '0') : '';
}
function ptExpShow(e) { return /^\d{4}-\d{2}$/.test(e || '') ? e.slice(5) + '/' + e.slice(2, 4) : ''; }
function ptExpEdit(i, v) { const it = pu.items[i]; if (!it) return; const e = ptExpParse(v); it.expiry = e; const inp = $b('ptx-' + i); if (inp) inp.classList.toggle('bad', !!v.trim() && !e); puChanged(); }
function ptToggle(i) { const it = pu.items[i]; if (!it) return; it.open = !it.open; puRenderTable(); if (it.open) { const el = $b('ptr-' + i); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
function puRenderTable() {
    const box = $b('puTable'); if (!box) return;
    box.innerHTML = pu.items.map((it, i) => `<div class="pt-row ${it.open ? 'open' : 'closed'}" id="ptr-${i}">
        <div class="pt-top" onclick="ptToggle(${i})"><span class="pu-chev">${it.open ? '▾' : '▸'}</span><b dir="ltr" class="pt-nm">${ptEsc(it.name)}</b>
            <span class="pt-mini"><span id="ptq-${i}">${ptEsc(it.qty)}</span> × <span id="ptc-${i}">${puNum(it.cost) > 0 ? fmtNum(it.cost) : '⚠'}</span> = <b class="pt-sum" id="pts-${i}"></b></span>
            <button type="button" class="pt-ret ${puNum(it.ret) > 0 ? 'on' : ''}" onclick="event.stopPropagation();ptRet(${i})" title="مردود لهذه المادة">↩️${puNum(it.ret) > 0 ? ' ' + puNum(it.ret) : ''}</button><button type="button" class="pu-x" onclick="event.stopPropagation();puRemoveItem(${i})" aria-label="حذف">✕</button></div>
        <div class="pt-in" style="display:${it.open ? 'grid' : 'none'}">
            <label><span>عدد</span><input type="number" min="1" inputmode="numeric" value="${ptEsc(it.qty)}" oninput="puItemEdit(${i},'qty',this.value)" onfocus="this.select()"></label>
            <label><span>بونص</span><input type="number" min="0" inputmode="numeric" placeholder="0" value="${ptEsc(it.bonus || '')}" oninput="puItemEdit(${i},'bonus',this.value)" onfocus="this.select()"></label>
            <label><span>سعر الشراء</span><input type="number" min="0" inputmode="decimal" value="${ptEsc(it.cost)}" oninput="puItemEdit(${i},'cost',this.value)" onfocus="this.select()"></label>
            <label><span>انتهاء</span><input id="ptx-${i}" type="text" inputmode="numeric" dir="ltr" placeholder="MMYY" value="${ptEsc(ptExpShow(it.expiry))}" onchange="ptExpEdit(${i},this.value)" onfocus="this.select()"></label>
        </div></div>`).join('') || '<div class="bill-none">اكتب اسم المادة فوق، وبعدها العدد والسعر، واضغط Enter.</div>';
    puRecalc();
}
function ptRecalc() { pu.items.forEach((it, i) => { const el = $b('pts-' + i); if (el) el.innerText = fmtNum(puNum(it.qty) * puNum(it.cost)); const q = $b('ptq-' + i), c = $b('ptc-' + i); if (q) q.innerText = it.qty; if (c) c.innerText = puNum(it.cost) > 0 ? fmtNum(it.cost) : '⚠'; }); }
// نلفّ الدوال الموجودة بدل تغييرها
{ const _pri = puRenderItems; puRenderItems = function () { _pri(); puRenderTable(); ptApplyView(); }; }
{ const _prc = puRecalc; puRecalc = function () { _prc(); ptRecalc(); }; }

function ptNameInput() {
    ptNewMode = false; ptSel = null; const br = $b('ptBrand'); if (br) br.style.display = 'none';
    const q = $b('ptName').value.trim(), qn = normSearch(q), box = $b('ptRes');
    if (!qn) { box.style.display = 'none'; ptFound = []; return; }
    const toks = qn.split(' ');
    ptFound = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    box.innerHTML = ptFound.map(p => productPickHtml(p, 'ptPick', 'بالمخزن ' + stockLabel(p) + (p.costPrice ? ' · آخر شراء ' + fmtNum(p.costPrice) : ''))).join('')
        + `<button type="button" class="pu-newprod" onclick="ptNew()">➕ مادة جديدة «${ptEsc(q)}»${ptFound.length ? ' (تأكد أنها ليست من المواد أعلاه)' : ''}</button>`;
    box.style.display = 'block';
}
function ptPick(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    ptSel = p; ptNewMode = false; $b('ptName').value = p.name; $b('ptRes').style.display = 'none'; $b('ptBrand').style.display = 'none';
    if (p.costPrice && !$b('ptCost').value) $b('ptCost').value = p.costPrice;
    $b('ptQty').focus();
}
function ptNew() { ptSel = null; ptNewMode = true; $b('ptRes').style.display = 'none'; const br = $b('ptBrand'); br.style.display = ''; br.focus(); }
function ptKey(e, f) {
    if (e.key !== 'Enter') return; e.preventDefault();
    if (f === 'name') { if (ptSel || ptNewMode) return $b(ptNewMode ? 'ptBrand' : 'ptQty').focus(); if (ptFound.length) return ptPick(ptFound[0].id); if ($b('ptName').value.trim()) return ptNew(); return; }
    const order = ['brand', 'qty', 'bonus', 'cost', 'exp'], i = order.indexOf(f);
    if (i >= 0 && i < order.length - 1) return $b('pt' + order[i + 1].charAt(0).toUpperCase() + order[i + 1].slice(1)).focus();
    ptCommit();
}
async function ptCommit() {
    const name = $b('ptName').value.trim(), warn = t => Swal.fire({ icon: 'warning', title: t, toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
    if (!name) return warn('اكتب اسم المادة');
    const qty = parseInt($b('ptQty').value) || 0; if (qty < 1) { $b('ptQty').focus(); return warn('اكتب العدد'); }
    const bonus = parseInt($b('ptBonus').value) || 0, cost = $b('ptCost').value.trim(), expRaw = $b('ptExp').value.trim(), expiry = ptExpParse(expRaw);
    if (expRaw && !expiry) { $b('ptExp').focus(); return warn('الانتهاء غير صحيح — اكتبه بصيغة 0627'); }
    let p = ptSel;
    if (!p && ptNewMode) {
        if (!writesAllowed()) return;
        const brand = $b('ptBrand').value.trim();
        const dept = (activeDept && activeDept !== ALL_DEPTS) ? activeDept : (deptList()[0] || departments[0] || ''), cat = (subsFor(dept)[0]) || '';
        p = { id: Date.now(), department: dept, category: cat, type: '', extraDepartments: [], extraCategories: [], extraTypes: [], form: '', activeIngredient: '', minQty: null, brand: brand || 'GENERIC', name, details: '', meta: '',
            qty: 0, loose: 0, price: 0, costPrice: parseFloat(cost) || 0, pricing: 'manual', markupPct: null, expiryDates: [], expiryDate: '', keywords: '', barcode: '', barcodes: [], img: '', incomplete: true };
        products.unshift(p); renderAll();
        if (!(await saveSingleProductToCloud(p))) { products.shift(); renderAll(); return; }
        logAction('add', p, []);
    }
    if (!p) return warn('اختر مادة من القائمة أو اضغط «مادة جديدة»');
    const ex = pu.items.find(it => it.pid === p.id);
    if (ex) { ex.qty = (parseInt(ex.qty) || 0) + qty; ex.bonus = (parseInt(ex.bonus) || 0) + bonus || ''; if (cost) ex.cost = cost; if (expiry) ex.expiry = expiry; }
    else pu.items.push({ pid: p.id, name: p.name, qty, bonus: bonus || '', cost: cost || p.costPrice || '', expiry, batch: '', open: false });
    ['ptName', 'ptBrand', 'ptQty', 'ptBonus', 'ptCost', 'ptExp'].forEach(i => { $b(i).value = ''; });
    ptSel = null; ptNewMode = false; ptFound = []; $b('ptBrand').style.display = 'none'; $b('ptRes').style.display = 'none';
    puRenderItems(); puChanged();
    $b('ptName').focus();
}

// ↩️ مردود لسطر: يُحدَّد العدد المراد إرجاعه، وبعد حفظ الوارد تفتح نافذة المردود معبّأة تلقائياً (تُسجَّل بسجل المردود بضغطة تأكيد)
async function ptRet(i) {
    const it = pu.items[i]; if (!it) return;
    const r = await Swal.fire({ title: 'مردود «' + escapeHtml(it.name) + '»', input: 'number', inputValue: puNum(it.ret) > 0 ? puNum(it.ret) : (parseInt(it.qty) || 1), inputAttributes: { min: 0, inputmode: 'numeric' },
        inputLabel: 'العدد المراد إرجاعه للمذخر (0 = إلغاء الإرجاع)', showCancelButton: true, confirmButtonText: 'تعيين', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38',
        inputValidator: v => (parseInt(v) || 0) > (parseInt(it.qty) || 0) ? 'أكبر من عدد الفاتورة' : undefined });
    if (!r.isConfirmed) return;
    it.ret = Math.max(parseInt(r.value) || 0, 0) || ''; puRenderItems(); puChanged();
}
function ptOpenReturnFor(rec, retMap) {
    try {
        lgOpenReturn({ listId: rec.id });
        (lgr.lines || []).forEach(l => { if (retMap[l.pid]) l.qty = Math.min(retMap[l.pid], l.max); });
        lgrRender(); lgrAutoMode();
        Swal.fire({ icon: 'info', title: 'راجع المردود واضغط حفظ', text: 'عبّأنا المواد التي علّمتها «مردود». تأكد من الأعداد والسعر ثم احفظ.', toast: true, position: 'bottom', showConfirmButton: false, timer: 3500 });
    } catch (e) { /* إن لم تتوفر شاشة المردود يبقى الوارد محفوظاً */ }
}
