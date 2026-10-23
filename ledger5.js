// =====================================================================
// سجل طلبات البونص (ما طُلب من المذاخر/المندوبين ولم يُستلم بعد) + تسلسل الأسطر القابل للتعديل
// kind: breq في pharmacy_ledger. يعتمد على ledger.js و purchase.js
// =====================================================================
LG_REGS.push('breq');
LG_HUB.splice(LG_HUB.length - 1, 0, ['breq', '🙋', 'طلبات البونص', 'ما طلبته من المذاخر والمندوبين']);

const lgBreqs = () => lgAll.filter(e => e.kind === 'breq' && !e.del);
function lgInitBreq() { lgFillSupSelect('lgqSup'); lgRenderBreq(); }
function lgBreqFiltered() {
    const q = puKey(($b('lgqQ') || {}).value), sup = ($b('lgqSup') || {}).value;
    return lgBreqs().filter(e => (!sup || puKey(e.supplier) === puKey(sup)) && (!q || [e.name, e.company, e.supplier, e.rep, e.listNo].some(x => puKey(x).includes(q))))
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
function lgRenderBreq() {
    if (!$b('lgq-list')) return;
    const all = lgBreqs(), arr = lgBreqFiltered();
    $b('lgq-sum').innerHTML = `<span>طلبات البونص</span><b>${arr.length} طلب</b><small>الإجمالي ${all.length} • البونص المسجَّل يُعدّ مستلماً دائماً، وهذا سجل لما طُلب فقط</small>`;
    $b('lgq-list').innerHTML = arr.map(e => `<div class="bill-card"><div class="bill-card-main"><b dir="ltr">${escapeHtml(e.name)}</b><small>${escapeHtml(e.company || '')} • ${fmtNum(e.qty)} عبوة • ${escapeHtml(e.supplier || '')}${e.listNo ? ' • قائمة ' + escapeHtml(e.listNo) : ''}${e.date ? ' • ' + escapeHtml(fmtDateDMY(e.date)) : ''}${e.rep ? ' • المندوب ' + escapeHtml(e.rep) : ''}${e.received ? ' • ' + escapeHtml(e.received) : ''}</small></div>` +
        `<button type="button" class="bill-tb-btn bill-danger" onclick="lgBreqDel('${e.id}')">🗑</button></div>`).join('') || '<div class="bill-none">لا توجد طلبات هنا.</div>';
}
async function lgBreqDel(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا الطلب؟', text: e.name, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return; e.del = true; await lgSave(e); lgRenderBreq();
}
async function lgBreqAdd() {
    const inp = (id, label, extra) => `<label style="display:block;text-align:right;font-size:.8rem;font-weight:800;margin-top:6px">${label}<input id="${id}" class="swal2-input" style="margin:4px 0 0;width:100%" ${extra || ''}></label>`;
    const r = await Swal.fire({ title: 'طلب بونص جديد', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: inp('swQN', 'المادة', 'dir="ltr"') + inp('swQC', 'الشركة', 'dir="ltr"') + inp('swQQ', 'الكمية', 'type="number" inputmode="numeric"') + inp('swQS', 'المذخر', 'list="puSupList"') + inp('swQL', 'رقم القائمة', 'dir="ltr"') + inp('swQD', 'التاريخ', `type="date" value="${todayLocalISO()}"`) + inp('swQR', 'المندوب'),
        preConfirm: () => { const g = id => (document.getElementById(id).value || '').trim(); if (!g('swQN')) { Swal.showValidationMessage('اكتب اسم المادة'); return false; } return { name: g('swQN'), company: g('swQC'), qty: parseInt(g('swQQ')) || 0, supplier: g('swQS'), listNo: g('swQL'), date: g('swQD'), rep: g('swQR'), received: '' }; } });
    if (!r.isConfirmed || !r.value) return;
    await lgSave({ id: lgId(), kind: 'breq', ...r.value, createdTs: new Date().toISOString() }); lgRenderBreq();
}
function lgBreqCsv() {
    const L = [['المادة', 'الشركة', 'الكمية', 'المذخر', 'رقم القائمة', 'التاريخ', 'المندوب', 'الاستلام']];
    lgBreqFiltered().forEach(e => L.push([e.name, e.company || '', e.qty, e.supplier || '', e.listNo || '', e.date || '', e.rep || '', e.received || '']));
    lgCsvDownload('bonus-requests-' + todayLocalISO() + '.csv', L);
}
(function () { const o = puTab; puTab = function (n) { o(n); if (n === 'breq') Promise.all([puLoad(), lgLoad()]).then(lgInitBreq); }; })();

// =====================================================================
// تسلسل الأسطر القابل للتعديل: اضغط على رقم السطر (#) واكتب الرقم الذي تريده فينتقل إليه
// يُحفظ كحقل ord في السجل نفسه، ويطبَّق على الكشف الشهري وسجلات المردود والتسديد والبونص والمناقلة والمنتهي
// =====================================================================
function lgSeqRec(kind, id) { return kind === 'pu' ? puAll.find(x => x.id === id) : lgAll.find(x => x.id === id); }
async function lgSeqSave(kind, rec) { if (kind === 'pu') await puSaveRecord(rec); else await lgSave(rec); }
// مقارِن: من له رقم تسلسل مخصَّص (ord_<ctx>) يأتي أولاً بحسب رقمه، ثم الباقي بترتيبهم الأصلي
const lgOrdCmp = (ctx, get) => (a, b) => { const x = get(a), y = get(b), f = 'ord_' + ctx, oa = !!x && x[f] != null, ob = !!y && y[f] != null; if (oa && ob) return x[f] - y[f]; if (oa !== ob) return oa ? -1 : 1; return 0; };
async function lgSeqMove(ctx, from) {
    const list = (window.lgSeqCtx || {})[ctx]; if (!list || !list.length) return;
    const r = await Swal.fire({ title: 'تغيير تسلسل السطر', text: 'الرقم الحالي ' + from + ' من ' + list.length, input: 'number', inputValue: from, inputAttributes: { min: 1, max: list.length, step: 1 }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'انقل', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    let to = Math.round(parseFloat(r.value)); if (!(to >= 1)) return; if (to > list.length) to = list.length; if (to === from) return;
    const order = list.slice(); const [m] = order.splice(from - 1, 1); order.splice(to - 1, 0, m);
    const f = 'ord_' + ctx, changed = [];
    order.forEach((x, i) => { const rec = lgSeqRec(x.kind, x.id); if (rec && rec[f] !== i + 1) { rec[f] = i + 1; changed.push([x.kind, rec]); } });
    for (const [k, rec] of changed) await lgSeqSave(k, rec);
    Swal.fire({ icon: 'success', title: 'تم تغيير التسلسل', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
    lgSeqRefresh();
}
function lgSeqRefresh() {
    try { if (typeof renderPuMonth === 'function' && $b('puMonthSup')) renderPuMonth(); } catch (e) { /* تجاهل */ }
    [['lgRenderRet', 'ret'], ['lgRenderRet', 'unrec']].forEach(([n, a]) => { try { if (typeof window[n] === 'function') window[n](a); } catch (e) { /* تجاهل */ } });
    ['lgPayRender', 'lgRenderXfer'].forEach(n => { try { if (typeof window[n] === 'function') window[n](); } catch (e) { /* تجاهل */ } });
}
// يُستدعى من الجداول: يسجّل ترتيب الأسطر المعروضة ويعيد خلية الرقم القابلة للضغط
function lgSeqSet(ctx, items) { window.lgSeqCtx = window.lgSeqCtx || {}; window.lgSeqCtx[ctx] = items; }
const lgSeqCell = (ctx, i) => `<td class="pu-n pu-seq" onclick="lgSeqMove('${ctx}',${i})" title="اضغط لتغيير التسلسل">${i}</td>`;
