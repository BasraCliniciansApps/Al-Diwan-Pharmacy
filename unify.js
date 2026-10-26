// =====================================================================
// سجل توحيد الوارد: كل مواد فواتير الوارد مرتبة أبجدياً، تُحدَّد مجموعة منها وتُوحَّد باسم مادة من المخزن
// أو باسم موحد جديد يُدخل إلى المخزن، ثم يُطبَّق الاسم والربط على فواتير الوارد (والمردود والبونص) دون المساس بالأسعار
// يعتمد على ledger.js و purchase.js
// =====================================================================
const unSel = new Set();
let unLimit = 200;
const unNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
const unSkip = n => !n || n === 'المواد مفقودة' || /^مواد القائمة/.test(n);
function lgInitUnify() { unLimit = 200; lgRenderUnify(); }
function unRows() {
    const map = new Map(), byId = new Map(products.map(p => [String(p.id), p]));
    puAll.filter(r => !r.cancelled).forEach(r => (r.items || []).forEach((l, i) => {
        if (unSkip(l.name)) return;
        const k = unNorm(l.name) + '|' + unNorm(l.company);
        let g = map.get(k); if (!g) { g = { key: k, names: {}, company: l.company || '', refs: [], pids: new Set(), unlinked: 0, costs: [], last: '', lastCost: 0, uni: 0 }; map.set(k, g); }
        g.names[l.name] = (g.names[l.name] || 0) + 1; g.refs.push([r, i]);
        const pr = l.pid != null && l.pid !== '' ? byId.get(String(l.pid)) : null;
        if (pr) g.pids.add(pr.id); else g.unlinked++;
        if (puNum(l.cost) > 0) g.costs.push(puNum(l.cost));
        if (String(r.date || '') >= g.last) { g.last = String(r.date || ''); if (puNum(l.cost) > 0) g.lastCost = puNum(l.cost); }
        if (l.uni) g.uni++;
    }));
    return [...map.values()].map(g => { g.name = Object.entries(g.names).sort((a, b) => b[1] - a[1])[0][0]; g.n = g.refs.length; g.prod = g.pids.size === 1 && !g.unlinked ? byId.get(String([...g.pids][0])) : null; g.state = g.unlinked || !g.pids.size ? (g.pids.size ? 'part' : 'none') : g.pids.size > 1 ? 'multi' : 'ok'; return g; })
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}
function lgRenderUnify() {
    const box = $b('un-list'); if (!box) return;
    const st = $b('unSt').value, q = ($b('unQ').value || '').trim().toLowerCase();
    const all = unRows(), pend = all.filter(g => g.state !== 'ok').length;
    const rows = all.filter(g => (st === 'all' || (st === 'todo' ? g.state !== 'ok' : g.state === 'ok')) && (!q || g.name.toLowerCase().includes(q) || String(g.company).toLowerCase().includes(q)));
    $b('un-sum').innerHTML = `<span>سجل توحيد الوارد</span><b>${fmtNum(pend)}</b><small>مادة بحاجة لربط أو توحيد من أصل ${fmtNum(all.length)} • المعروض ${fmtNum(rows.length)}</small>`;
    const stTxt = g => g.state === 'ok' ? `<em class="tg">✓ ${escapeHtml(g.prod ? g.prod.name : '')}</em>` : g.state === 'none' ? '<em class="tg warn">بدون ربط</em>' : g.state === 'multi' ? '<em class="tg warn">مرتبطة بأكثر من مادة</em>' : '<em class="tg warn">ربط جزئي</em>';
    box.innerHTML = rows.slice(0, unLimit).map(g => `<label class="un-row${unSel.has(g.key) ? ' on' : ''}"><input type="checkbox" ${unSel.has(g.key) ? 'checked' : ''} onchange="unTog('${escapeHtml(g.key).replace(/'/g, '&#39;')}',this.checked)"><span class="un-t"><b dir="ltr">${escapeHtml(g.name)}</b><small dir="ltr">${escapeHtml(g.company || '—')}</small><span>${stTxt(g)}</span></span><span class="un-p"><b>${g.lastCost ? fmtNum(g.lastCost) : '—'}</b><small>${fmtNum(g.n)} فاتورة</small></span></label>`).join('') || '<div class="bill-none">لا توجد مواد بهذه الحالة.</div>'
        + (rows.length > unLimit ? `<button type="button" class="bill-tb-btn" style="width:100%;margin:8px 0" onclick="unLimit+=200;lgRenderUnify()">عرض المزيد (${fmtNum(rows.length - unLimit)})</button>` : '');
    unBar();
}
function unBar() {
    const b = $b('un-bar'); if (!b) return;
    b.style.display = unSel.size ? 'flex' : 'none';
    b.innerHTML = `<b>${fmtNum(unSel.size)} محددة</b><button type="button" class="bill-tb-btn bill-tb-primary" onclick="unApply()">🧩 توحيد المحدد</button><button type="button" class="bill-tb-btn" onclick="unSel.clear();lgRenderUnify()">مسح</button>`;
}
function unTog(k, on) { if (on) unSel.add(k); else unSel.delete(k); const row = event && event.target && event.target.closest('.un-row'); if (row) row.classList.toggle('on', on); unBar(); }
function unSelAll() { const st = $b('unSt').value, q = ($b('unQ').value || '').trim().toLowerCase(); unRows().filter(g => (st === 'all' || (st === 'todo' ? g.state !== 'ok' : g.state === 'ok')) && (!q || g.name.toLowerCase().includes(q) || String(g.company).toLowerCase().includes(q))).forEach(g => unSel.add(g.key)); lgRenderUnify(); }
function unMode(m) { window.__unMode = m; $b('unP1').style.display = m === 1 ? '' : 'none'; $b('unP2').style.display = m === 2 ? '' : 'none'; $b('unM1').classList.toggle('bill-tb-primary', m === 1); $b('unM2').classList.toggle('bill-tb-primary', m === 2); }
function unFind() {
    const qn = normSearch($b('unS').value), box = $b('unSR'); if (!qn) { box.innerHTML = ''; return; }
    const toks = qn.split(' ');
    box.innerHTML = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => `<label style="display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid #e5eaf2;text-align:right"><input type="radio" name="unPick" value="${p.id}" style="width:auto"><span style="flex:1"><b dir="ltr">${escapeHtml(p.name)}</b><br><small style="color:#64748b" dir="ltr">${escapeHtml(p.brand || '')}</small></span></label>`).join('') || '<div style="padding:8px;color:#64748b;font-size:.82rem">لا توجد نتائج</div>';
}
async function unApply() {
    const sel = unRows().filter(g => unSel.has(g.key)); if (!sel.length) return;
    window.__unMode = 1;
    const first = sel[0], nRefs = sel.reduce((s, g) => s + g.n, 0);
    const r = await Swal.fire({ title: 'توحيد ' + fmtNum(sel.length) + ' مادة', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'توحيد', cancelButtonText: 'إلغاء',
        html: `<div style="text-align:right;font-size:.82rem;line-height:1.7;max-height:90px;overflow-y:auto;color:#475569" dir="ltr">${sel.slice(0, 8).map(g => escapeHtml(g.name)).join('<br>')}${sel.length > 8 ? '<br>...' : ''}</div>
        <div style="display:flex;gap:6px;margin:8px 0"><button type="button" id="unM1" class="bill-tb-btn bill-tb-primary" style="flex:1" onclick="unMode(1)">من المخزن</button><button type="button" id="unM2" class="bill-tb-btn" style="flex:1" onclick="unMode(2)">اسم موحد جديد</button></div>
        <div id="unP1"><input id="unS" class="swal2-input" style="width:100%;margin:0 0 6px" placeholder="ابحث عن المادة بالمخزن..." oninput="unFind()"><div id="unSR" style="max-height:34vh;overflow-y:auto"></div></div>
        <div id="unP2" style="display:none;text-align:right"><label style="font-size:.8rem;font-weight:800">الاسم الموحد<input id="unN" class="swal2-input" dir="ltr" style="width:100%;margin:4px 0 8px" value="${escapeHtml(first.name)}"></label><label style="font-size:.8rem;font-weight:800">الشركة<input id="unC" class="swal2-input" dir="ltr" style="width:100%;margin:4px 0 0" value="${escapeHtml(first.company || '')}"></label><small style="display:block;color:#64748b;margin-top:6px">تُنشأ كمادة جديدة بالمخزن بكمية صفر وبدون سعر بيع.</small></div>
        <small style="display:block;text-align:right;color:#64748b;margin-top:8px">يُطبَّق على ${fmtNum(nRefs)} سطراً في فواتير الوارد. أسعار الفواتير لا تتغير.</small>`,
        preConfirm: () => {
            if (window.__unMode === 2) { const n = (document.getElementById('unN').value || '').trim(); if (!n) { Swal.showValidationMessage('اكتب الاسم الموحد'); return false; } return { name: n, company: (document.getElementById('unC').value || '').trim() }; }
            const v = document.querySelector('input[name=unPick]:checked'); if (!v) { Swal.showValidationMessage('اختر مادة من المخزن'); return false; } return { pid: v.value };
        } });
    window.__unMode = 1;
    if (!r.isConfirmed || !r.value) return;
    const h = Prog.start('توحيد الوارد', { text: 'تجهيز...' });
    try {
        let p;
        if (r.value.pid != null) p = products.find(x => String(x.id) === String(r.value.pid));
        else {
            const lc = Math.max(...sel.map(g => g.lastCost || 0));
            p = { id: Date.now(), department: 'قسم غير مصنّف', category: 'غير مصنّف', type: '', extraDepartments: [], extraCategories: [], extraTypes: [], activeIngredient: '', minQty: null, brand: r.value.company, name: r.value.name, details: '', meta: '', qty: 0, price: 0, costPrice: lc, pricing: 'manual', markupPct: null, expiryDates: [], expiryDate: '', keywords: '', barcode: '', barcodes: [], img: '', inStock: false, subPrice: 0, subCount: 0, subType: '', lastPurchase: null };
            products.push(p); h.set(10, 'إنشاء المادة بالمخزن...');
            if ((await saveProductsBatch([p])) === false) { products.splice(products.indexOf(p), 1); h.fail('تعذر إنشاء المادة'); return; }
        }
        if (!p) { h.fail('المادة غير موجودة'); return; }
        h.set(30, 'تطبيق الاسم على الفواتير...');
        const keys = new Set(sel.map(g => g.key)), names = new Set(sel.flatMap(g => Object.keys(g.names).map(unNorm))), recs = new Map();
        sel.forEach(g => g.refs.forEach(([rec, i]) => { const l = rec.items[i]; l.name = p.name; l.pid = p.id; if (!l.company && p.brand) l.company = p.brand; l.uni = 1; recs.set(rec.id, rec); }));
        const led = [];
        lgAll.forEach(e => {
            let ch = false;
            if (e.kind === 'ret') (e.items || []).forEach(it => { if (names.has(unNorm(it.name))) { it.name = p.name; it.pid = p.id; ch = true; } });
            else if (e.kind === 'bimp' && names.has(unNorm(e.name))) { e.name = p.name; e.pid = p.id; ch = true; }
            if (ch) { e.upd = new Date().toISOString(); led.push(e); }
        });
        lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500))); lsSet(LG_LS.list, JSON.stringify(lgAll));
        if (cloudReady()) {
            const jobs = [...recs.values()].map(x => ['pharmacy_purchases', x]).concat(led.map(x => ['pharmacy_ledger', x]));
            for (let i = 0; i < jobs.length; i += 20) { await Promise.all(jobs.slice(i, i + 20).map(([c, x]) => fsSet(db.collection(c).doc(String(x.id)), JSON.parse(JSON.stringify(x))))); progTick(Math.min(i + 20, jobs.length), jobs.length, 'حُفظ ' + fmtNum(Math.min(i + 20, jobs.length)) + ' من ' + fmtNum(jobs.length)); }
        }
        unSel.clear(); renderAll(); lgRenderUnify(); h.ok('تم التوحيد');
        Swal.fire({ icon: 'success', title: 'تم التوحيد', text: `${fmtNum(sel.length)} مادة ← «${p.name}» (${fmtNum(recs.size)} فاتورة)`, confirmButtonColor: '#0f1c38' });
    } catch (e) { h.fail('تعذر التوحيد', e.message || String(e)); Swal.fire({ icon: 'error', title: 'تعذر التوحيد', text: e.message || String(e), confirmButtonColor: '#0f1c38' }); }
}
