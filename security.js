// الأمان: فصل التكلفة إلى مجموعة pharmacy_cost المقفلة على المالك (ثم الأدوار والمستخدمون)
const COST_RULE = `match /pharmacy_cost/{id} {
  allow read, write: if request.auth != null && request.auth.uid == "VrZUN6AMvTPMklvhlZcwKlqJciY2";
}`;
function costLeftovers() { return Object.entries(stockMap).filter(([, s]) => s && COST_FIELDS.some(f => f in s)).map(([id]) => id); }
async function openCostSplit() {
    try { closeCategoryManager(); } catch (e) { /* تجاهل */ }
    if (!currentUser || !isFirebaseReady) { Swal.fire({ icon: 'error', title: 'سجّل الدخول أولاً', confirmButtonColor: '#0f1c38' }); return; }
    const withCost = products.filter(p => parseFloat(p.costPrice) > 0 || p.lastPurchase || parseFloat(p.markupPct) > 0).length;
    const left = costLeftovers().length;
    const state = !costSplitOn ? 'غير مفعّل' : left ? 'مفعّل — بقي ' + left + ' مستند فيه تكلفة في المكان القديم' : 'مفعّل ومؤمَّن ✅';
    const r = await Swal.fire({
        title: 'فصل سعر الشراء (التكلفة)', showCancelButton: true, cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38',
        showConfirmButton: !costSplitOn || left > 0, confirmButtonText: !costSplitOn ? '① نسخ وتفعيل' : '② تأمين: حذف من المكان القديم',
        html: `<div class="sw-form"><div class="sw-info">الحالة: <b>${state}</b><br>أصناف لها تكلفة: <b>${fmtNum(withCost)}</b></div>
            <small>الخطوة ①: تُنزَّل نسخة كاملة، ثم تُنسخ التكلفة وآخر وارد ونسبة الربح إلى مجموعة مقفلة عليك. لا يتغير شيء في عملك.<br>الخطوة ②: بعد أن تتأكد أن كل شيء ظاهر كما كان، تُحذف هذه الحقول من المكان القديم، فلا يراها أي مستخدم آخر مستقبلاً.</small>
            ${costSplitOn ? '' : '<small>تحتاج أولاً أن تضيف هذه القاعدة في Firebase ← Firestore ← Rules داخل match /databases/{database}/documents، ثم Publish:</small><div class="sw-info" dir="ltr" style="font-size:.7rem;white-space:pre-wrap;text-align:left">' + escapeHtml(COST_RULE) + '</div>'}</div>` });
    if (!r.isConfirmed) return;
    if (!costSplitOn) await costSplitStep1(); else await costSplitStep2();
}
async function costSplitStep1() {
    if (!requireOnline() || !writesAllowed()) return;
    Swal.fire({ title: 'جاري النسخ...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        await downloadFile('diwan-before-cost-split-' + todayStamp() + '.json', JSON.stringify(buildFullBackup()), 'application/json');
        try { await db.collection('pharmacy_cost').doc('_meta').set({ on: false, test: true }); }
        catch (e) { Swal.fire({ icon: 'error', title: 'القاعدة غير مضافة بعد', html: 'أضف هذه القاعدة في Firebase ثم أعد المحاولة:<div class="sw-info" dir="ltr" style="font-size:.7rem;white-space:pre-wrap;text-align:left">' + escapeHtml(COST_RULE) + '</div>', confirmButtonColor: '#0f1c38' }); return; }
        const docs = products.map(p => { const o = { id: p.id }; COST_FIELDS.forEach(f => { if (p[f] !== undefined && p[f] !== null) o[f] = p[f]; }); return o; });
        for (let i = 0; i < docs.length; i += 20) {
            const b = db.batch();
            docs.slice(i, i + 20).forEach(o => b.set(db.collection('pharmacy_cost').doc(String(o.id)), JSON.parse(JSON.stringify(o))));
            await fsCommit(b);
        }
        const snap = await db.collection('pharmacy_cost').get();
        const n = snap.docs.filter(d => d.id !== '_meta').length;
        if (n < docs.length) throw new Error('عدد المستندات المنسوخة ' + n + ' أقل من المتوقع ' + docs.length);
        await db.collection('pharmacy_cost').doc('_meta').set({ on: true, at: new Date().toISOString(), count: n });
        costSplitOn = true; docs.forEach(o => { costMap[String(o.id)] = o; });
        Swal.fire({ icon: 'success', title: 'تم نسخ التكلفة', html: 'نُسخ <b>' + fmtNum(n) + '</b> صنفاً إلى المكان المقفل.<br>تصفّح التطبيق وتأكد أن الأسعار وآخر وارد كما هي، ثم نفّذ الخطوة ② من نفس الزر.', confirmButtonColor: '#0f1c38' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الإكمال', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
}
async function costSplitStep2() {
    if (!requireOnline() || !writesAllowed()) return;
    const ids = costLeftovers(), F = fv(); if (!F) return;
    const c = await Swal.fire({ icon: 'warning', title: 'تأمين التكلفة؟', text: 'ستُحذف التكلفة من المكان القديم لـ ' + ids.length + ' مستند. تأكد أنك رأيت الأسعار وآخر وارد سليمة في التطبيق.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، أمّن', cancelButtonText: 'إلغاء' });
    if (!c.isConfirmed) return;
    Swal.fire({ title: 'جاري التأمين...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        for (let i = 0; i < ids.length; i += 20) {
            const b = db.batch();
            ids.slice(i, i + 20).forEach(id => { const u = {}; COST_FIELDS.forEach(f => { u[f] = F.delete(); }); b.update(db.collection('pharmacy_stock').doc(id), u); });
            await fsCommit(b);
        }
        ids.forEach(id => { if (stockMap[id]) COST_FIELDS.forEach(f => { delete stockMap[id][f]; }); });
        Swal.fire({ icon: 'success', title: 'تم التأمين', text: 'صارت التكلفة في مجموعة مقفلة عليك فقط.', confirmButtonColor: '#0f1c38' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر التأمين', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
}
