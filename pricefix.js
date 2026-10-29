// أداة: مواد بدون سعر بيع — تعرض آخر سعر شراء من الوارد وتسعّرها دفعة وحدة
let pzRows = [];
let pzScroll = 0;   // موضع التمرير في القائمة عند فتح تفاصيل مادة، ليرجع المستخدم لنفس المكان
const pzDraft = new Map();   // أسعار مكتوبة في القائمة وتُحفظ مؤقتاً عند فتح تفاصيل مادة
function pzLastCost(p) {
    let best = null;
    (puAll || []).filter(r => !r.cancelled).forEach(r => (r.items || []).forEach(l => {
        if (!(puNum(l.cost) > 0)) return;
        if (l.pid !== p.id && puKey(l.name) !== puKey(p.name)) return;
        if (!best || String(r.date) >= String(best.date)) best = { cost: puNum(l.cost), date: r.date, sup: r.supplier };
    }));
    return best ? best.cost : (puNum(p.costPrice) > 0 ? puNum(p.costPrice) : 0);
}
let pzLoss = false;   // false: مواد بلا سعر بيع • true: مواد سعر بيعها أقل من الكلفة أو يساويها
function pzBuild() {
    pzRows = products.map(p => ({ p, cost: pzLastCost(p) })).filter(x => x.cost > 0 && (pzLoss ? (Number(x.p.price) > 0 && Number(x.p.price) <= x.cost) : !(Number(x.p.price) > 0)))
        .sort((a, b) => String(a.p.name).localeCompare(String(b.p.name)));
    return pzRows;
}
async function pzOpen(loss, keep) {
    pzLoss = !!loss; if (!keep) { pzDraft.clear(); pzScroll = 0; }
    const rows = pzBuild();
    if (!rows.length) { Swal.fire({ icon: 'info', title: pzLoss ? 'لا توجد مواد سعر بيعها أقل من الكلفة' : 'كل المواد المشتراة مسعّرة', confirmButtonColor: '#0f1c38' }); return; }
    const html = `<div class="pz-wrap"><div class="pz-hint">${fmtNum(rows.length)} ${pzLoss ? 'مادة سعر بيعها أقل من سعر شرائها أو يساويه (خسارة). اكتب' : 'مادة بدون سعر بيع. اكتب'} السعر أو اضغط «تعبئة حسب النقابة».</div>
        <div class="pz-list">${rows.map((x, i) => `<div class="pz-row"><button type="button" class="pz-n" dir="ltr" onclick="pzDetail(${i})">${escapeHtml(x.p.name)}<i>›</i></button><div class="pz-c">سعر الشراء <b>${fmtNum(x.cost)}</b>${pzLoss ? ' • البيع الحالي <b style="color:#b91c1c">' + fmtNum(x.p.price) + '</b>' : ''} • النقابة <b>${fmtNum(syndPrice(x.cost))}</b></div><input type="number" inputmode="numeric" min="0" id="pzIn${i}" placeholder="سعر البيع" value="${pzDraft.get(x.p.id) || ''}"></div>`).join('')}</div>
        <button type="button" class="pz-fill" onclick="pzFill()">✨ ${pzLoss ? 'تعبئة حسب النقابة للكل' : 'تعبئة حسب النقابة للفارغ'}</button></div>`;
    const r = await Swal.fire({ title: pzLoss ? 'مواد تُباع بخسارة' : 'مواد بدون سعر بيع', html, width: 640, showCancelButton: true, confirmButtonText: 'حفظ الأسعار', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', customClass: { popup: 'pz-pop' }, didOpen: () => { const l = document.querySelector('.pz-list'); if (l && pzScroll) l.scrollTop = pzScroll; } });
    if (!r.isConfirmed) return;
    const upd = [];
    pzRows.forEach((x, i) => { const el = document.getElementById('pzIn' + i); const v = el ? puNum(el.value) : 0; if (v > 0) { x.p.price = v; x.p.pricing = 'manual'; x.p.markupPct = null; if (!(puNum(x.p.costPrice) > 0)) x.p.costPrice = x.cost; upd.push(x.p); } });
    pzDraft.clear();
    if (!upd.length) return;
    const h = Prog.open('حفظ أسعار المواد', { text: fmtNum(upd.length) + ' مادة' });
    const ok = await saveProductsBatch(upd);
    Prog.end(h, ok ? 'ok' : 'err', ok ? 'تم تسعير ' + fmtNum(upd.length) + ' مادة' : 'فشل الحفظ');
    if (ok) renderAll();
}
function pzFill() { pzRows.forEach((x, i) => { const el = document.getElementById('pzIn' + i); if (el && (pzLoss || !el.value)) el.value = syndPrice(x.cost) || ''; }); }

function pzStash() { { const l = document.querySelector('.pz-list'); if (l) pzScroll = l.scrollTop; } pzRows.forEach((x, i) => { const el = document.getElementById('pzIn' + i); if (el) { if (el.value) pzDraft.set(x.p.id, el.value); else pzDraft.delete(x.p.id); } }); }
function pzDetailHtml(x) {
    const p = x.p, sub = subCountOf(p) ? p : null, types = subTypes.slice(); if (sub && sub.subType && !types.includes(sub.subType)) types.push(sub.subType);
    return `<div class="qp">
        <div class="qf"><span>المادة</span><div class="qin ltr" dir="ltr" style="display:flex;align-items:center;font-weight:800">${escapeHtml(p.name)}</div></div>
        <div class="qf qrow"><span>طريقة التسعير</span><select id="qpMode" class="qin"><option value="manual">يدوي — ملصق الوزارة</option><option value="syndicate">حسب كتاب النقابة (سعر المذخر + نسبة)</option><option value="percent">بنسبة مئوية أدخلها أنا</option></select></div>
        <div class="qg2 qrow">
            <div class="qf"><span>سعر الشراء (د.ع)</span><input id="qpCost" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${x.cost || ''}"></div>
            <div class="qf"><span>سعر البيع (د.ع)</span><input id="qpPrice" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${Number(p.price) > 0 ? p.price : (pzDraft.get(p.id) || '')}"></div>
        </div>
        <div class="qf qrow" id="qpMkW"><span>نسبة الإضافة على سعر الشراء (%)</span><input id="qpMk" type="number" inputmode="decimal" min="0" step="any" class="qin ltr" dir="ltr" value="${p.markupPct != null ? p.markupPct : ''}"></div>
        <div class="qnote" id="qpHint"></div>
        <div class="qsec"><h4>🧩 البيع بالتجزئة (اختياري)</h4>
            <div class="qg3">
                <div class="qf"><span>عدد الأجزاء</span><input id="qpSc" type="number" inputmode="numeric" min="0" class="qin ltr" dir="ltr" value="${sub ? subCountOf(sub) : ''}"></div>
                <div class="qf"><span>نوع الجزء</span><select id="qpSt" class="qin ltr" dir="ltr">${types.map(t => `<option value="${escapeHtml(t)}"${sub && sub.subType === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></div>
                <div class="qf"><span>سعر الجزء</span><input id="qpSp" type="number" inputmode="decimal" min="0" class="qin ltr" dir="ltr" value="${sub && sub.subPrice ? sub.subPrice : ''}" data-manual="${sub && sub.subPrice ? '1' : ''}"></div>
            </div>
        </div></div>`;
}
async function pzDetail(i) {
    pzStash(); const x = pzRows[i]; if (!x) return; const p = x.p;
    const r = await Swal.fire({ title: 'تفاصيل التسعير', html: pzDetailHtml(x), showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'رجوع للقائمة', confirmButtonColor: '#0f1c38', customClass: { popup: 'qp-pop' }, didOpen: () => catPriceWire(p),
        preConfirm: () => {
            const $ = id => document.getElementById(id), mode = $('qpMode').value, cost = parseFloat($('qpCost').value) || 0, price = parseFloat($('qpPrice').value) || 0, mk = parseFloat($('qpMk').value);
            if (mode === 'percent' && (!(cost > 0) || !(mk >= 0))) { Swal.showValidationMessage('التسعير بنسبة يحتاج سعر الشراء ونسبة الإضافة'); return false; }
            if (mode === 'syndicate' && !(cost > 0)) { Swal.showValidationMessage('أدخل سعر الشراء (سعر المذخر) لحساب السعر'); return false; }
            const sc = parseInt($('qpSc').value) || 0, sp = parseFloat($('qpSp').value);
            return { pricing: mode, costPrice: cost, price, markupPct: mode === 'percent' ? mk : null, retail: sc < 2 ? { subCount: 0, subType: '', subPrice: 0 } : { subCount: sc, subType: $('qpSt').value || 'جزء', subPrice: sp > 0 ? sp : subPriceCalc(price, sc) } };
        } });
    if (r.isConfirmed && r.value) {
        const v = r.value, old = JSON.parse(JSON.stringify(p));
        Object.assign(p, { price: v.price, costPrice: v.costPrice, pricing: v.pricing, markupPct: v.markupPct, ...v.retail });
        const h = Prog.open('حفظ تسعير المادة', { text: p.name });
        const ok = await saveProductsBatch([p]);
        Prog.end(h, ok ? 'ok' : 'err', ok ? 'تم الحفظ' : 'فشل الحفظ');
        if (!ok) Object.assign(p, old); else { pzDraft.delete(p.id); try { const ch = diffProduct(old, p); if (ch.length) logAction('edit', p, ch); } catch (e) { /* تجاهل */ } renderAll(); }
    }
    pzOpen(pzLoss, true);
}
