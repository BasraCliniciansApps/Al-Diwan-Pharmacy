// =====================================================================
// سجل ربط البونص: البونص المستورد (kind: bimp) غير المربوط بقائمة وارد، ويُربط يدوياً بقائمته إن وُجدت
// يعتمد على ledger.js و purchase.js
// =====================================================================
const blAll = () => lgAll.filter(e => e.kind === 'bimp' && !e.del);
function lgInitBlink() { lgFillSupSelect('blSup'); lgRenderBlink(); }
function lgRenderBlink() {
    const box = $b('bl-list'); if (!box) return;
    const st = $b('blSt').value, sup = $b('blSup').value, q = ($b('blQ').value || '').trim().toLowerCase();
    const all = blAll(), isDone = e => !!(e.linkRid || e.rep), unl = all.filter(e => !isDone(e)).length;
    const rows = all.filter(e => (st === 'all' || (st === 'linked') === isDone(e)) && (!sup || puKey(e.supplier) === puKey(sup)) && (!q || String(e.name).toLowerCase().includes(q)))
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.name).localeCompare(String(b.name)));
    $b('bl-sum').innerHTML = `<span>سجل ربط البونص</span><b>${fmtNum(unl)}</b><small>بدون ربط من أصل ${fmtNum(all.length)} • المربوط ${fmtNum(all.length - unl)}</small>`;
    box.innerHTML = rows.map(e => `<div class="bn-card"><div class="bn-r1"><b class="bn-n" dir="ltr">${escapeHtml(e.name)}</b><span class="bn-v ${puNum(e.sale) > 0 ? '' : 'none'}">${puNum(e.sale) > 0 ? fmtNum(puNum(e.sale)) : '—'}</span></div>
        <div class="bn-r2"><em class="tg">🎁 ${fmtNum(e.qty)} مجاني</em>${e.expiry ? `<em class="bn-tag" dir="ltr">${escapeHtml(e.expiry)}</em>` : ''}${e.linkRid ? `<em class="tg">🔗 قائمة ${escapeHtml(e.linkNo || '')}</em>` : e.rep ? `<em class="tg">🤝 هدية مندوب: ${escapeHtml(e.rep)}</em>` : '<em class="tg warn">غير مربوط</em>'}</div>
        <div class="bn-r3">${escapeHtml(e.supplier || 'بدون مذخر')}${e.date ? ' • استُلم ' + escapeHtml(fmtDateDMY(e.date)) : ''}</div>
        <div class="bn-r2" style="margin-top:4px;gap:6px"><button type="button" class="bill-tb-btn" onclick="blLink('${e.id}')">${e.linkRid || e.rep ? 'تغيير الربط' : '🔗 ربط'}</button>${e.linkRid || e.rep ? `<button type="button" class="bill-tb-btn" onclick="blUnlink('${e.id}')">إلغاء الربط</button>` : ''}<button type="button" class="bill-tb-btn bill-danger" style="margin-inline-start:auto" onclick="blDel('${e.id}')">🗑</button></div></div>`).join('') || '<div class="bill-none">لا توجد سجلات بهذه الحالة.</div>';
}
function blCands(e) {
    const t = Date.parse(e.date || '') || 0;
    return puAll.filter(r => !r.cancelled && !puIsBonusOnly(r)).map(r => ({ r, same: puKey(r.supplier) === puKey(e.supplier), d: t ? Math.abs((Date.parse(r.date) || 0) - t) : 0 }))
        .sort((a, b) => (b.same - a.same) || (a.d - b.d));
}
function blMode(m) { window.__blMode = m; document.getElementById('blP1').style.display = m === 1 ? '' : 'none'; document.getElementById('blP2').style.display = m === 2 ? '' : 'none'; document.getElementById('blM1').classList.toggle('bill-tb-primary', m === 1); document.getElementById('blM2').classList.toggle('bill-tb-primary', m === 2); }
async function blLink(id) {
    window.__blMode = 1;
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const c = blCands(e).slice(0, 400);
    const row = x => `<label class="bl-opt" data-k="${escapeHtml((x.r.supplier + ' ' + x.r.no).toLowerCase())}" style="display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid #e5eaf2;text-align:right"><input type="radio" name="blPick" value="${x.r.id}" style="width:auto"><span style="flex:1"><b dir="ltr">${escapeHtml(x.r.no)}</b> • ${escapeHtml(x.r.supplier)}${x.same ? ' ✓' : ''}<br><small style="color:#64748b">${escapeHtml(fmtDateDMY(x.r.date))} • ${fmtNum(puTotalOf(x.r))} د.ع</small></span></label>`;
    const reps = [...new Set(lgAll.filter(x => (x.kind === 'bimp' || x.kind === 'breq') && x.rep).map(x => x.rep))];
    const r = await Swal.fire({ title: 'ربط البونص', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<div style="text-align:right;font-size:.85rem"><b dir="ltr">${escapeHtml(e.name)}</b> — ${fmtNum(e.qty)} مجاني${e.supplier ? ' • ' + escapeHtml(e.supplier) : ''}</div>
        <div style="display:flex;gap:6px;margin:8px 0"><button type="button" id="blM1" class="bill-tb-btn bill-tb-primary" style="flex:1" onclick="blMode(1)">🔗 بقائمة وارد</button><button type="button" id="blM2" class="bill-tb-btn" style="flex:1" onclick="blMode(2)">🤝 هدية مندوب (بدون فاتورة)</button></div>
        <div id="blP1"><input id="blS" class="swal2-input" style="width:100%;margin:0 0 8px" placeholder="ابحث برقم القائمة أو المذخر..." oninput="document.querySelectorAll('.bl-opt').forEach(o=>o.style.display=o.dataset.k.includes(this.value.trim().toLowerCase())?'flex':'none')"><div style="max-height:42vh;overflow-y:auto">${c.map(row).join('')}</div></div>
        <div id="blP2" style="display:none;text-align:right"><label style="font-size:.8rem;font-weight:800">اسم المندوب<input id="blRep" class="swal2-input" list="blRepL" style="width:100%;margin:4px 0 0" value="${escapeHtml(e.rep || '')}"></label><datalist id="blRepL">${reps.map(x => `<option value="${escapeHtml(x)}">`).join('')}</datalist></div>`,
        preConfirm: () => { if (window.__blMode === 2) { const v = (document.getElementById('blRep').value || '').trim(); if (!v) { Swal.showValidationMessage('اكتب اسم المندوب'); return false; } return { rep: v }; } const v = document.querySelector('input[name=blPick]:checked'); if (!v) { Swal.showValidationMessage('اختر قائمة'); return false; } return { rid: v.value }; } });
    window.__blMode = 1;
    if (!r.isConfirmed || !r.value) return;
    if (r.value.rep) { e.rep = r.value.rep; e.linkRid = ''; e.linkNo = ''; e.linkSup = ''; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink(); return; }
    const rec = puAll.find(x => x.id === r.value.rid); if (!rec) return;
    e.rep = ''; e.linkRid = rec.id; e.linkNo = rec.no; e.linkSup = rec.supplier; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink();
}
async function blUnlink(id) { const e = lgAll.find(x => x.id === id); if (!e) return; e.rep = ''; e.linkRid = ''; e.linkNo = ''; e.linkSup = ''; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink(); }
async function blDel(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا البونص؟', text: e.name, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return; e.del = true; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink();
}
