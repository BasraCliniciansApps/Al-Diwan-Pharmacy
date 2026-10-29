// =====================================================================
// نافذة البيع المنبثقة (بعد مسح الباركود أو من سطر الفاتورة): العدد، الدفعات (تاريخ النفاذ)، الأجزاء، السعر
// الافتراضي: توزيع الكمية تلقائياً على الأقرب نفاذاً مع إمكانية تغيير الدفعة؛ الدفعة المنتهية ممنوعة؛ وتحذير لما تبقى أقل من 30 يوماً
// =====================================================================
let sp = null;   // { pid, unit, qty, rows:[{e,n}], price, edit, scan, short }

function spDays(e) { return e && typeof expiryDaysOf === 'function' ? expiryDaysOf(e) : null; }
function spSim(p, unit, editing) {   // الدفعات المتاحة بعد خصم ما أُضيف أصلاً للفاتورة (عدا السطور قيد التعديل)
    const sc = btSc(p), sim = { bat: getBatches(p).map(b => ({ e: b.e, u: b.q * sc + b.l })) };
    (bill ? bill.items : []).forEach(it => {
        if (it.pid !== p.id) return;
        if (editing && (it.unit === 'part' ? 'part' : 'pack') === unit) return;
        const u = it.unit === 'part' && hasRetail(p) ? 'part' : 'pack', n = parseFloat(it.qty) || 0;
        if (n > 0) billAllocate(sim, p, u, n, it.exp);
    });
    return sim;
}
function spAvail(b, p, unit) { const sc = btSc(p); return unit === 'part' ? b.u : Math.floor(b.u / sc); }
function spAutoRows() {
    const p = products.find(x => x.id === sp.pid); if (!p) return;
    const sim = spSim(p, sp.unit, sp.edit);
    sp.sim = sim.bat.map(b => ({ ...b }));
    const out = billAllocate(sim, p, sp.unit, sp.qty);
    sp.rows = out.filter(a => !a.over).map(a => ({ e: a.e, n: a.n }));
    sp.short = out.filter(a => a.over).reduce((s, a) => s + a.n, 0);
}
function spOpen(pid, opts) {
    opts = opts || {};
    const p = products.find(x => x.id === pid); if (!p) return;
    if (!bill) { try { initBillEditor(); } catch (e) { /* تجاهل */ } }
    if (bill && bill.issued && !bill.editing) { Swal.fire({ icon: 'info', title: 'الفاتورة صادرة', text: 'اضغط «تعديل» أولاً ثم أضف المواد.', confirmButtonColor: '#0f1c38' }); return; }
    const own = bill.items.filter(it => it.pid === pid);
    let unit = 'pack';
    if (opts.edit && own.length) unit = own[0].unit === 'part' && hasRetail(p) ? 'part' : 'pack';
    sp = { pid, unit, qty: 1, rows: [], price: '', edit: !!(opts.edit && own.length), scan: !!opts.scan, short: 0 };
    if (sp.edit) {
        const mine = own.filter(it => (it.unit === 'part' ? 'part' : 'pack') === unit);
        sp.qty = mine.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0) || 1;
        sp.price = mine[0] ? mine[0].price : '';
        const sim = spSim(p, unit, true); sp.sim = sim.bat.map(b => ({ ...b }));
        sp.rows = mine.map(it => ({ e: it.exp || '', n: parseFloat(it.qty) || 0 }));
        const cov = sp.rows.reduce((s, r) => s + r.n, 0);
        sp.short = Math.max(sp.qty - cov, 0);
    } else {
        sp.price = unit === 'part' ? subPriceOf(p) : (p.price || '');
        spAutoRows();
    }
    spEnsureDom(); spRender();
    document.getElementById('spModal').style.display = 'flex';
    document.documentElement.classList.add('lk');
    if (!sp.edit && !(parseFloat(sp.price) > 0)) setTimeout(() => { const pi = document.querySelector('#spCard .sp-price'); if (pi) pi.focus(); }, 80);
}
function spClose() { const m = document.getElementById('spModal'); if (m) m.style.display = 'none'; document.documentElement.classList.remove('lk'); sp = null; }
function spEnsureDom() {
    if (document.getElementById('spModal')) return;
    const d = document.createElement('div'); d.id = 'spModal'; d.className = 'modal-overlay sp-ov'; d.style.display = 'none';
    d.innerHTML = '<div class="modal-card sp-card" id="spCard" role="dialog" aria-label="إضافة مادة للفاتورة"></div>';
    d.addEventListener('click', ev => { if (ev.target === d) spClose(); });
    document.body.appendChild(d);
}
function spUnitSwitch(u) { if (!sp || sp.unit === u) return; const p = products.find(x => x.id === sp.pid); sp.unit = u; sp.price = u === 'part' ? subPriceOf(p) : (p.price || ''); sp.qty = 1; spAutoRows(); spRender(); }
function spQty(d) { if (!sp) return; sp.qty = Math.max(1, (sp.qty || 0) + d); spAutoRows(); spRender(); }
function spQtySet(v) { if (!sp) return; sp.qty = Math.max(1, parseInt(v) || 1); spAutoRows(); spRender(); }
function spPrice(v) { if (!sp) return; sp.price = v; spTotalRefresh(); }
function spRowSet(i, f, v) {
    if (!sp || !sp.rows[i]) return;
    const p = products.find(x => x.id === sp.pid), r = sp.rows[i];
    if (f === 'e') { r.e = v; }
    else {
        const b = (sp.sim || []).find(x => x.e === r.e), max = b ? spAvail(b, p, sp.unit) : 0;
        r.n = Math.max(0, Math.min(parseInt(v) || 0, max));
    }
    const b2 = (sp.sim || []).find(x => x.e === r.e); if (b2) r.n = Math.min(r.n, spAvail(b2, p, sp.unit));   // الحد الأعلى للدفعة الجديدة
    sp.qty = sp.rows.reduce((s, x) => s + x.n, 0) || 1; sp.short = 0;
    spRender();
}
function spRowDel(i) { if (!sp) return; sp.rows.splice(i, 1); sp.qty = sp.rows.reduce((s, x) => s + x.n, 0) || 1; spRender(); }
function spRowAdd() {
    if (!sp) return; const p = products.find(x => x.id === sp.pid);
    const used = new Set(sp.rows.map(r => r.e));
    const b = (sp.sim || []).find(x => !used.has(x.e) && !billExpired(x.e) && spAvail(x, p, sp.unit) > 0);
    if (!b) { Swal.fire({ icon: 'info', title: 'لا توجد دفعة أخرى متاحة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); return; }
    sp.rows.push({ e: b.e, n: 1 }); sp.qty = sp.rows.reduce((s, x) => s + x.n, 0); spRender();
}
function spDayTag(e) {
    if (!e) return '<em class="sp-nd">بدون تاريخ</em>';
    const d = spDays(e);
    if (d !== null && d <= 0) return '<em class="sp-exp">منتهية</em>';
    if (d !== null && d <= 30) return `<em class="sp-warn">تنتهي خلال ${d} يوم</em>`;
    return '';
}
function spTotalRefresh() {
    const el = document.getElementById('spTot'); if (!el || !sp) return;
    const n = sp.rows.reduce((s, r) => s + r.n, 0) + (sp.short || 0);
    el.innerText = fmtNum(n * (parseFloat(sp.price) || 0)) + ' د.ع';
}
function spRender() {
    const card = document.getElementById('spCard'); if (!card || !sp) return;
    const p = products.find(x => x.id === sp.pid), sc = btSc(p), retail = hasRetail(p);
    const img = p.img ? `<img class="sp-img" src="${escapeHtml(p.img)}" alt="" onerror="this.style.visibility='hidden'">` : '<span class="sp-img sp-noimg">💊</span>';
    const total = sp.rows.reduce((s, r) => s + r.n, 0) + (sp.short || 0);
    const unitName = sp.unit === 'part' ? (subTypeOf(p) || 'جزء') : 'علبة';
    const rowsHtml = sp.rows.map((r, i) => {
        const opts = (sp.sim || []).filter(b => !billExpired(b.e) && (spAvail(b, p, sp.unit) > 0 || b.e === r.e)).map(b => `<option value="${escapeHtml(b.e)}" ${b.e === r.e ? 'selected' : ''}>${escapeHtml(b.e || 'بدون تاريخ')} · ${spAvail(b, p, sp.unit)}</option>`).join('');
        return `<div class="sp-row"><select onchange="spRowSet(${i}, 'e', this.value)" aria-label="الدفعة">${opts}</select>
            <div class="sp-st"><button type="button" onclick="spRowSet(${i}, 'n', ${r.n - 1})" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="0" value="${r.n}" onchange="spRowSet(${i}, 'n', this.value)"><button type="button" onclick="spRowSet(${i}, 'n', ${r.n + 1})" aria-label="زيادة">+</button></div>
            <button type="button" class="sp-x" onclick="spRowDel(${i})" aria-label="حذف الدفعة">✕</button>${spDayTag(r.e) ? `<div class="sp-tag">${spDayTag(r.e)}</div>` : ''}</div>`;
    }).join('');
    const expiredHave = (sp.sim || []).filter(b => billExpired(b.e) && b.u > 0);
    card.innerHTML = `
        <div class="sp-head">${img}<div class="sp-ti"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml([p.brand, fixMetaOrder(p.meta || '')].filter(Boolean).join(' · '))}</small><span class="sp-stock">المتوفر: ${escapeHtml(stockLabel(p))}</span></div>
            <button type="button" class="sp-close" onclick="spClose()" aria-label="إغلاق">✕</button></div>
        ${retail ? `<div class="sp-unit"><button type="button" class="${sp.unit === 'pack' ? 'on' : ''}" onclick="spUnitSwitch('pack')">علب</button><button type="button" class="${sp.unit === 'part' ? 'on' : ''}" onclick="spUnitSwitch('part')">${escapeHtml(subTypeOf(p))} (${sc} بالعبوة)</button></div>` : ''}
        <div class="sp-line"><span>العدد (${escapeHtml(unitName)})</span><div class="sp-st big"><button type="button" onclick="spQty(-1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="1" value="${total}" onchange="spQtySet(this.value)"><button type="button" onclick="spQty(1)" aria-label="زيادة">+</button></div></div>
        <div class="sp-sec">الدفعات (تاريخ النفاذ)</div>
        ${rowsHtml || '<div class="sp-empty">لا توجد دفعات متاحة</div>'}
        ${sp.short ? `<div class="sp-alert">⚠️ المطلوب أكبر من المتاح بـ ${sp.short} — تُضاف كمية بلا دفعة.</div>` : ''}
        ${expiredHave.length ? `<div class="sp-alert">⛔ دفعات منتهية لا تُباع: ${expiredHave.map(b => escapeHtml(b.e)).join('، ')}</div>` : ''}
        <button type="button" class="sp-add" onclick="spRowAdd()">＋ دفعة أخرى</button>
        <div class="sp-line"><span>سعر ${escapeHtml(unitName)}</span><input class="sp-price" type="number" inputmode="decimal" min="0" value="${escapeHtml(String(sp.price))}" oninput="spPrice(this.value)"></div>
        <div class="sp-sum"><span>المجموع</span><b id="spTot"></b></div>
        <div class="sp-act"><button type="button" class="sp-go" onclick="spCommit(false)">${sp.edit ? 'حفظ التعديل' : 'إضافة للفاتورة'}</button>${sp.edit ? '' : '<button type="button" class="sp-go next" onclick="spCommit(true)">إضافة ومسح التالي</button>'}</div>`;
    spTotalRefresh();
}
function spCommit(next) {
    if (!sp) return;
    const p = products.find(x => x.id === sp.pid); if (!p) return;
    if (!(parseFloat(sp.price) > 0)) {   // لا تنزل مادة للفاتورة قبل كتابة سعرها
        const pi = document.querySelector('#spCard .sp-price');
        if (pi) { pi.focus(); pi.classList.add('qi-need'); }
        Swal.fire({ icon: 'warning', title: 'أدخل سعر المادة أولاً', toast: true, position: 'top', showConfirmButton: false, timer: 2000 });
        return;
    }
    const rows = sp.rows.filter(r => r.n > 0 && !billExpired(r.e));
    const lines = rows.map(r => ({ e: r.e, n: r.n }));
    if (sp.short > 0) lines.push({ e: '', n: sp.short });
    if (!lines.length) { Swal.fire({ icon: 'warning', title: 'حدد العدد أولاً', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); return; }
    const unit = sp.unit, price = sp.price === '' ? '' : (parseFloat(sp.price) || 0);
    if (sp.edit) bill.items = bill.items.filter(it => !(it.pid === p.id && (it.unit === 'part' ? 'part' : 'pack') === unit));
    lines.forEach(l => {
        const ex = bill.items.find(it => it.pid === p.id && (it.unit === 'part' ? 'part' : 'pack') === unit && (it.exp || '') === l.e);
        if (ex) { ex.qty = (parseFloat(ex.qty) || 0) + l.n; ex.price = price; }
        else bill.items.push({ pid: p.id, name: p.name, qty: l.n, price, unit, partType: unit === 'part' ? subTypeOf(p) : '', ...(l.e ? { exp: l.e } : {}) });
    });
    const name = p.name, edit = sp.edit;
    spClose();
    renderInvoiceRows(); billChanged();
    Swal.fire({ icon: 'success', title: (edit ? 'عُدّلت: ' : 'أُضيفت: ') + name, toast: true, position: 'bottom', showConfirmButton: false, timer: 1100 });
    if (next) setTimeout(() => billScan(), 250);
}
