// ============================================================================
// النسخة الاحتياطية الكاملة (v2): الأصناف + المخزون + الوارد + المذاخر + الفواتير + السجلات + الإعدادات
// ============================================================================
const BK_LS = 'diwanLastFullBackup';
const BK_REMIND_DAYS = 7;

function bkInvExtras() {   // إعدادات الفواتير المحلية (ترقيم، معلومات، توقيع، ختم)
    const o = {};
    ['meta', 'seq', 'sig', 'stamp'].forEach(k => { const v = lsGet(BILL_LS[k]); if (v !== null && v !== undefined) o[k] = v; });
    return o;
}
async function bkRefresh() {   // نقرأ أحدث نسخة من السحابة قبل التصدير حتى لا يفوت شيء
    progTick(0, 3, 'قراءة الوارد من السحابة...');
    try { if (typeof puLoad === 'function') await puLoad(); } catch (e) { /* تجاهل */ }
    progTick(1, 3, 'قراءة الفواتير من السحابة...');
    try { if (typeof loadInvoices === 'function') await loadInvoices(); } catch (e) { /* تجاهل */ }
    progTick(2, 3, 'قراءة السجلات من السحابة...');
    try { if (typeof lgLoad === 'function') await lgLoad(); } catch (e) { /* تجاهل */ }
    progTick(3, 3);
}
function buildFullBackup() {
    const base = buildBackupObject();
    return Object.assign(base, {
        version: 2, full: true,
        purchases: typeof puAll !== 'undefined' ? puAll : [],
        suppliers: typeof puSuppliers !== 'undefined' ? puSuppliers : [],
        invoices: typeof billAll !== 'undefined' ? billAll : [],
        ledger: typeof lgAll !== 'undefined' ? lgAll : [],
        trash: lsJson(LS_TRASH, []),
        invoiceSettings: bkInvExtras(),
        counts: { products: products.length, purchases: (typeof puAll !== 'undefined' ? puAll : []).length, suppliers: (typeof puSuppliers !== 'undefined' ? puSuppliers : []).length, invoices: (typeof billAll !== 'undefined' ? billAll : []).length, ledger: (typeof lgAll !== 'undefined' ? lgAll : []).length }
    });
}
function bkCountsLine(c) {
    return `${c.products || 0} صنف • ${c.purchases || 0} وارد • ${c.suppliers || 0} مذخر • ${c.invoices || 0} فاتورة • ${c.ledger || 0} سجل`;
}
async function exportFullBackup() {
    const h = Prog.start('تجهيز النسخة الكاملة', { text: 'بدء...' });
    try {
        if (cloudReady() && navigator.onLine) { h.span(0, 60); await bkRefresh(); }
        h.set(65, 'جمع البيانات...'); h.span(65, 100);
        const data = buildFullBackup();
        h.set(80, 'تحويل الملف...');
        await downloadFile(`diwan-full-backup-${todayStamp()}.json`, JSON.stringify(data), 'application/json');
        lsPut(BK_LS, Date.now());
        bkRenderReminder();
        h.ok('النسخة جاهزة — ' + bkCountsLine(data.counts));
    } catch (e) { h.fail('تعذر إنشاء النسخة', e.message || String(e)); }
}

// ---------- الدمج الآمن: لا نستبدل سجلاً أحدث ----------
const BK_COLS = [
    { key: 'purchases', label: 'وارد', coll: 'pharmacy_purchases', ts: r => String(r.editedAt || r.cancelledAt || r.createdTs || '') },
    { key: 'suppliers', label: 'مذخر', coll: 'pharmacy_suppliers', ts: () => '' },
    { key: 'invoices', label: 'فاتورة', coll: 'pharmacy_invoices', ts: r => String(r.editedAt || r.cancelledAt || r.issuedTs || '') },
    { key: 'ledger', label: 'سجل', coll: 'pharmacy_ledger', ts: r => String(r.upd || '') }
];
function bkCurrent(key) {
    return key === 'purchases' ? puAll : key === 'suppliers' ? puSuppliers : key === 'invoices' ? billAll : lgAll;
}
function bkPlan(data) {   // لكل مجموعة: ما سيُضاف وما سيُحدَّث وما يبقى لأنه أحدث
    return BK_COLS.map(c => {
        const arr = Array.isArray(data[c.key]) ? data[c.key].filter(x => x && x.id) : [];
        const cur = new Map((bkCurrent(c.key) || []).map(x => [x.id, x]));
        const add = [], upd = []; let keep = 0;
        arr.forEach(x => {
            const e = cur.get(x.id);
            if (!e) add.push(x);
            else if (c.ts(x) > c.ts(e)) upd.push(x);
            else keep++;
        });
        return { c, total: arr.length, add, upd, keep };
    });
}
async function bkApplyPlan(plan) {
    const totalItems = plan.reduce((s, p) => s + p.add.length + p.upd.length, 0); let doneItems = 0;
    for (const p of plan) {
        const items = p.add.concat(p.upd); if (!items.length) continue;
        const map = new Map((bkCurrent(p.c.key) || []).map(x => [x.id, x]));
        items.forEach(x => map.set(x.id, x));
        const merged = [...map.values()];
        if (p.c.key === 'purchases') { puAll = merged.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdTs).localeCompare(String(a.createdTs))); lsSet(PU_LS.list, JSON.stringify(puAll.slice(0, 1500))); }
        else if (p.c.key === 'suppliers') { puSuppliers = merged; lsSet(PU_LS.sup, JSON.stringify(puSuppliers)); }
        else if (p.c.key === 'invoices') { billAll = merged.sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt))); lsSet(BILL_LS.list, JSON.stringify(billAll)); }
        else { lgAll = merged; lsSet(LG_LS.list, JSON.stringify(lgAll)); }
        if (cloudReady()) {
            for (let i = 0; i < items.length; i += 20) {
                await Promise.all(items.slice(i, i + 20).map(x => fsSet(db.collection(p.c.coll).doc(String(x.id)), JSON.parse(JSON.stringify(x)))));
                doneItems += Math.min(20, items.length - i);
                progTick(doneItems, totalItems, 'رفع ' + p.c.label + ': ' + fmtNum(doneItems) + ' من ' + fmtNum(totalItems));
            }
        }
    }
}
function bkApplyExtras(data) {
    const s = data.invoiceSettings; if (!s || typeof s !== 'object') return;
    if (s.seq !== undefined) { const a = parseInt(lsGet(BILL_LS.seq)) || 0, b = parseInt(s.seq) || 0; if (b > a) lsSet(BILL_LS.seq, String(s.seq)); }
    ['meta', 'sig', 'stamp'].forEach(k => { if (s[k] && !lsGet(BILL_LS[k])) lsSet(BILL_LS[k], s[k]); });
}
// تُستدعى من applyBackupData بعد استرجاع الأصناف (للنسخ الكاملة فقط)
async function bkRestoreRest(data) {
    if (!data || data.version < 2) return '';
    const plan = bkPlan(data);
    await bkApplyPlan(plan);
    bkApplyExtras(data);
    return plan.filter(p => p.total).map(p => `${p.c.label}: +${p.add.length} جديد، ${p.upd.length} محدَّث، ${p.keep} بقي كما هو`).join('\n');
}
function bkPreviewHtml(data) {
    if (!data || data.version < 2) return '';
    const rows = bkPlan(data).filter(p => p.total).map(p => `${p.c.label}: <b>${p.add.length}</b> جديد، <b>${p.upd.length}</b> أحدث من الحالي، ${p.keep} موجود/أحدث (يُترك)`).join('<br>');
    return `<hr style="margin:8px 0;border:none;border-top:1px solid #e2e8f0;"><b>باقي السجلات:</b><br>${rows}<br><span style="color:#64748b;">لا يُستبدل أي سجل أحدث من نسخته في الملف، ولا يُحذف شيء.</span>`;
}

// ---------- تذكير الصفحة الرئيسية ----------
function bkLast() {
    const t = Number(lsJson(BK_LS, 0)) || 0;
    return t;
}
function bkRenderReminder() {
    const el = document.getElementById('bkReminder'); if (!el) return;
    if (!(typeof IS_ADMIN_PAGE !== 'undefined' && IS_ADMIN_PAGE)) { el.innerHTML = ''; return; }
    const last = bkLast(), days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    if (last && days < BK_REMIND_DAYS) { el.innerHTML = `<div class="bk-rem ok">💾 آخر نسخة كاملة: ${escapeHtml(new Date(last).toLocaleDateString('ar-IQ'))}</div>`; return; }
    const txt = last ? `مضى ${days} يوماً على آخر نسخة كاملة (${escapeHtml(new Date(last).toLocaleDateString('ar-IQ'))})` : 'لم تُحمَّل نسخة كاملة بعد';
    el.innerHTML = `<div class="bk-rem warn"><span>⚠️ ${txt}</span><button type="button" onclick="exportFullBackup()">تحميل الآن</button></div>`;
}
document.addEventListener('DOMContentLoaded', () => { bkRenderReminder(); setInterval(bkRenderReminder, 600000); });

// ---------- استيراد السجل التاريخي (وارد/مردود/تسديد/...) من الإكسل: لا يمس المخزن أبداً ----------
async function applyHistoryImport(data) {
    const plan = bkPlan(data).filter(p => p.total);
    // السجلات المستوردة سابقاً لا تُستبدل؛ يُكمَّل فقط رقم «ت» الشهري الناقص عندها، وأما حركات السجل فتبقى كما هي
    plan.forEach(pl => {
        if (pl.c.key === 'purchases') {
            const cur = new Map((puAll || []).map(x => [x.id, x]));
            pl.upd = []; pl.fill = 0;
            (data.purchases || []).forEach(x => { const e = cur.get(x && x.id); if (e && x.seq && !e.seq) { pl.upd.push({ ...e, seq: x.seq }); pl.fill++; } });
            pl.keep = Math.max(pl.total - pl.add.length - pl.upd.length, 0);
        } else { pl.keep += pl.upd.length; pl.upd = []; }
    });
    const rows = plan.map(p => `${p.c.label}: <b>${p.add.length}</b> جديد${p.fill ? '، ' + p.fill + ' يُضاف لها رقم «ت»' : ''}، ${p.keep} موجود بحاله`).join('<br>');
    const nAdd = plan.reduce((s, p) => s + p.add.length + p.upd.length, 0);
    const ok = await Swal.fire({ title: 'استيراد السجل التاريخي؟', icon: 'question', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، استورد', cancelButtonText: 'إلغاء',
        html: `<div style="text-align:right;line-height:1.9;font-size:.92rem">${rows}<br><span style="color:#64748b">لا يتغير المخزن ولا كميات الأصناف ولا أسعارها. لا يُستبدل أي سجل موجود. تُنزَّل نسخة احتياطية كاملة قبل الاستيراد.</span></div>` });
    if (!ok.isConfirmed) return;
    if (!nAdd) { Swal.fire({ icon: 'info', title: 'لا جديد للاستيراد', text: 'كل هذه السجلات موجودة أصلاً ولا ينقصها رقم «ت».', confirmButtonColor: '#0f1c38' }); return; }
    const h = Prog.start('استيراد السجل التاريخي', { text: 'نسخة احتياطية قبل الاستيراد...' });
    try {
        h.span(0, 15); await downloadFile(`diwan-before-history-import-${todayStamp()}.json`, JSON.stringify(buildFullBackup()), 'application/json');
        h.set(15, 'رفع السجلات...'); h.span(15, 95);
        await bkApplyPlan(plan);
        h.set(96, 'تحديث السجل...');
        if (typeof lgLoad === 'function') { try { await lgLoad(); } catch (e) { /* تجاهل */ } }
        renderAll(); h.ok('تم استيراد ' + fmtNum(nAdd) + ' سجل');
        Swal.fire({ icon: 'success', title: 'تم استيراد السجل', text: plan.filter(p => p.add.length || p.upd.length).map(p => `${p.c.label}: +${p.add.length}` + (p.fill ? ` (ترقيم ${p.fill})` : '')).join('\n'), confirmButtonColor: '#0f1c38' });
    } catch (e) { h.fail('تعذر الاستيراد', e.message || String(e)); Swal.fire({ icon: 'error', title: 'تعذر الاستيراد', text: e.message || String(e), confirmButtonColor: '#0f1c38' }); }
}
