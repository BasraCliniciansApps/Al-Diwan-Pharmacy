// أداة: مواد بدون سعر بيع — تعرض آخر سعر شراء من الوارد وتسعّرها دفعة وحدة
let pzRows = [];
function pzLastCost(p) {
    let best = null;
    (puAll || []).filter(r => !r.cancelled).forEach(r => (r.items || []).forEach(l => {
        if (!(puNum(l.cost) > 0)) return;
        if (l.pid !== p.id && puKey(l.name) !== puKey(p.name)) return;
        if (!best || String(r.date) >= String(best.date)) best = { cost: puNum(l.cost), date: r.date, sup: r.supplier };
    }));
    return best ? best.cost : (puNum(p.costPrice) > 0 ? puNum(p.costPrice) : 0);
}
function pzBuild() {
    pzRows = products.filter(p => !(Number(p.price) > 0)).map(p => ({ p, cost: pzLastCost(p) })).filter(x => x.cost > 0)
        .sort((a, b) => String(a.p.name).localeCompare(String(b.p.name)));
    return pzRows;
}
async function pzOpen() {
    const rows = pzBuild();
    if (!rows.length) { Swal.fire({ icon: 'info', title: 'كل المواد المشتراة مسعّرة', confirmButtonColor: '#0f1c38' }); return; }
    const html = `<div class="pz-wrap"><div class="pz-hint">${fmtNum(rows.length)} مادة بدون سعر بيع. اكتب السعر أو اضغط «تعبئة حسب النقابة».</div>
        <div class="pz-list">${rows.map((x, i) => `<div class="pz-row"><div class="pz-n" dir="ltr">${escapeHtml(x.p.name)}</div><div class="pz-c">سعر الشراء <b>${fmtNum(x.cost)}</b> • النقابة <b>${fmtNum(syndPrice(x.cost))}</b></div><input type="number" inputmode="numeric" min="0" id="pzIn${i}" placeholder="سعر البيع"></div>`).join('')}</div>
        <button type="button" class="pz-fill" onclick="pzFill()">✨ تعبئة حسب النقابة للفارغ</button></div>`;
    const r = await Swal.fire({ title: 'مواد بدون سعر بيع', html, width: 640, showCancelButton: true, confirmButtonText: 'حفظ الأسعار', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', customClass: { popup: 'pz-pop' } });
    if (!r.isConfirmed) return;
    const upd = [];
    pzRows.forEach((x, i) => { const el = document.getElementById('pzIn' + i); const v = el ? puNum(el.value) : 0; if (v > 0) { x.p.price = v; x.p.pricing = 'manual'; x.p.markupPct = null; if (!(puNum(x.p.costPrice) > 0)) x.p.costPrice = x.cost; upd.push(x.p); } });
    if (!upd.length) return;
    const h = Prog.open('حفظ أسعار المواد', { text: fmtNum(upd.length) + ' مادة' });
    const ok = await saveProductsBatch(upd);
    Prog.end(h, ok ? 'ok' : 'err', ok ? 'تم تسعير ' + fmtNum(upd.length) + ' مادة' : 'فشل الحفظ');
    if (ok) renderAll();
}
function pzFill() { pzRows.forEach((x, i) => { const el = document.getElementById('pzIn' + i); if (el && !el.value) el.value = syndPrice(x.cost) || ''; }); }
