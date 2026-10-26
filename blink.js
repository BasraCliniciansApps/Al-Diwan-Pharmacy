// =====================================================================
// سجل ربط البونص: البونص المستورد (kind: bimp) غير المربوط بقائمة وارد، ويُربط يدوياً بقائمته إن وُجدت
// يعتمد على ledger.js و purchase.js
// =====================================================================
const blAll = () => lgAll.filter(e => e.kind === 'bimp' && !e.del);
function lgInitBlink() { lgFillSupSelect('blSup'); lgRenderBlink(); }
function lgRenderBlink() {
    const box = $b('bl-list'); if (!box) return;
    const st = $b('blSt').value, sup = $b('blSup').value, q = ($b('blQ').value || '').trim().toLowerCase();
    const all = blAll(), unl = all.filter(e => !e.linkRid).length;
    const rows = all.filter(e => (st === 'all' || (st === 'linked') === !!e.linkRid) && (!sup || puKey(e.supplier) === puKey(sup)) && (!q || String(e.name).toLowerCase().includes(q)))
        .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.name).localeCompare(String(b.name)));
    $b('bl-sum').innerHTML = `<span>سجل ربط البونص</span><b>${fmtNum(unl)}</b><small>غير مربوط من أصل ${fmtNum(all.length)} • المربوط ${fmtNum(all.length - unl)}</small>`;
    box.innerHTML = rows.map(e => `<div class="bn-card"><div class="bn-r1"><b class="bn-n" dir="ltr">${escapeHtml(e.name)}</b><span class="bn-v ${puNum(e.sale) > 0 ? '' : 'none'}">${puNum(e.sale) > 0 ? fmtNum(puNum(e.sale)) : '—'}</span></div>
        <div class="bn-r2"><em class="tg">🎁 ${fmtNum(e.qty)} مجاني</em>${e.expiry ? `<em class="bn-tag" dir="ltr">${escapeHtml(e.expiry)}</em>` : ''}${e.linkRid ? `<em class="tg">🔗 قائمة ${escapeHtml(e.linkNo || '')}</em>` : '<em class="tg warn">غير مربوط</em>'}</div>
        <div class="bn-r3">${escapeHtml(e.supplier || 'بدون مذخر')}${e.date ? ' • استُلم ' + escapeHtml(fmtDateDMY(e.date)) : ''}</div>
        <div class="bn-r2" style="margin-top:4px;gap:6px"><button type="button" class="bill-tb-btn" onclick="blLink('${e.id}')">${e.linkRid ? 'تغيير الربط' : '🔗 ربط بقائمة'}</button>${e.linkRid ? `<button type="button" class="bill-tb-btn" onclick="blUnlink('${e.id}')">إلغاء الربط</button>` : ''}<button type="button" class="bill-tb-btn bill-danger" style="margin-inline-start:auto" onclick="blDel('${e.id}')">🗑</button></div></div>`).join('') || '<div class="bill-none">لا توجد سجلات بهذه الحالة.</div>';
}
function blCands(e) {
    const t = Date.parse(e.date || '') || 0;
    return puAll.filter(r => !r.cancelled && !puIsBonusOnly(r)).map(r => ({ r, same: puKey(r.supplier) === puKey(e.supplier), d: t ? Math.abs((Date.parse(r.date) || 0) - t) : 0 }))
        .sort((a, b) => (b.same - a.same) || (a.d - b.d));
}
async function blLink(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const c = blCands(e).slice(0, 400);
    const row = x => `<label class="bl-opt" data-k="${escapeHtml((x.r.supplier + ' ' + x.r.no).toLowerCase())}" style="display:flex;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid #e5eaf2;text-align:right"><input type="radio" name="blPick" value="${x.r.id}" style="width:auto"><span style="flex:1"><b dir="ltr">${escapeHtml(x.r.no)}</b> • ${escapeHtml(x.r.supplier)}${x.same ? ' ✓' : ''}<br><small style="color:#64748b">${escapeHtml(fmtDateDMY(x.r.date))} • ${fmtNum(puTotalOf(x.r))} د.ع</small></span></label>`;
    const r = await Swal.fire({ title: 'ربط البونص بقائمة', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'ربط', cancelButtonText: 'إلغاء',
        html: `<div style="text-align:right;font-size:.85rem"><b dir="ltr">${escapeHtml(e.name)}</b> — ${fmtNum(e.qty)} مجاني${e.supplier ? ' • ' + escapeHtml(e.supplier) : ''}</div><input id="blS" class="swal2-input" style="width:100%;margin:8px 0" placeholder="ابحث برقم القائمة أو المذخر..." oninput="document.querySelectorAll('.bl-opt').forEach(o=>o.style.display=o.dataset.k.includes(this.value.trim().toLowerCase())?'flex':'none')"><div style="max-height:46vh;overflow-y:auto">${c.map(row).join('')}</div>`,
        preConfirm: () => { const v = document.querySelector('input[name=blPick]:checked'); if (!v) { Swal.showValidationMessage('اختر قائمة'); return false; } return v.value; } });
    if (!r.isConfirmed || !r.value) return;
    const rec = puAll.find(x => x.id === r.value); if (!rec) return;
    e.linkRid = rec.id; e.linkNo = rec.no; e.linkSup = rec.supplier; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink();
}
async function blUnlink(id) { const e = lgAll.find(x => x.id === id); if (!e) return; e.linkRid = ''; e.linkNo = ''; e.linkSup = ''; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink(); }
async function blDel(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا البونص؟', text: e.name, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return; e.del = true; e.upd = new Date().toISOString(); await lgSave(e); lgRenderBlink();
}
