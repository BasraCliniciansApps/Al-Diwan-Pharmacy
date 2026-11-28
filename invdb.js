// =====================================================================
// مخزن الفواتير الكامل على الجهاز (IndexedDB): بلا سقف 300 ولا حدود localStorage.
// billAll في الذاكرة = كل ما في المخزن؛ الحفظ بالفرق فقط (توقيع لكل فاتورة)، والحذف صريح.
// الملف المصدَّر (واتساب/نسخة احتياطية) يُبنى من billAll فيحمل كل الفواتير.
// البائع بصلاحية «فواتيره فقط» لا يستخدمه (قائمته خاصة به).
// =====================================================================
const InvDB = (() => {
    let dbp = null, loaded = false; const SIG = new Map();
    const open = () => dbp || (dbp = new Promise((ok, no) => {
        try { const r = indexedDB.open('diwanInv', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('inv')) d.createObjectStore('inv', { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); }
    }));
    const sigOf = x => String(x.editedAt || x.cancelledAt || x.issuedTs || '') + '|' + (x.cancelled ? 1 : 0) + '|' + JSON.stringify(x).length;
    const tsOf = x => String(x.editedAt || x.cancelledAt || x.issuedTs || '');
    const tx = (mode, fn) => open().then(d => new Promise((ok, no) => { const t = d.transaction('inv', mode), s = t.objectStore('inv'); const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }));
    const on = () => typeof invOwnOnly !== 'function' || !invOwnOnly();
    async function load() {   // يدمج المخزن في billAll (الأحدث تعديلاً يفوز)
        if (!on()) return 0;
        let rows = []; try { rows = (await tx('readonly', s => s.getAll())) || []; } catch (e) { return 0; }
        const m = new Map(); (billAll || []).forEach(x => x && x.id && m.set(x.id, x));
        rows.forEach(x => { if (!x || !x.id) return; SIG.set(x.id, sigOf(x)); const c = m.get(x.id); if (!c || tsOf(x) > tsOf(c)) m.set(x.id, x); });
        billAll = [...m.values()].sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
        loaded = true;
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* تجاهل */ }
        return rows.length;
    }
    async function save() {   // يحفظ المتغيّر فقط؛ لا يحذف شيئاً (الحذف صريح)
        if (!on() || !loaded) return 0;
        const ch = []; (billAll || []).forEach(x => { if (!x || !x.id) return; const s = sigOf(x); if (SIG.get(x.id) !== s) ch.push([x, s]); });
        if (!ch.length) return 0;
        try { await tx('readwrite', s => { ch.forEach(([x]) => s.put(x)); }); ch.forEach(([x, s]) => SIG.set(x.id, s)); } catch (e) { return 0; }
        return ch.length;
    }
    async function del(id) { try { await tx('readwrite', s => { s.delete(id); }); SIG.delete(id); } catch (e) { /* تجاهل */ } }
    const known = () => new Set(SIG.keys());
    async function prune() {   // استعادة «مطابقة تماماً»: يُحذف من المخزن ما ليس في billAll
        if (!on() || !loaded) return; const keep = new Set((billAll || []).map(x => x && x.id));
        for (const id of [...SIG.keys()]) if (!keep.has(id)) await del(id);
    }
    return { load, save, del, known, prune, isLoaded: () => loaded };
})();
let invDbP = null;
function invDbLoad() { return invDbP || (invDbP = InvDB.load().catch(() => 0)); }
function invDbSave() { return InvDB.save().catch(() => 0); }
// تغليف تحميل الفواتير: المخزن المحلي أولاً، ثم الفرق من السحابة، ثم حفظ الجديد وحذف ما حُذف من السحابة
(function () {
    const core = loadInvoices;
    loadInvoices = async function (ttl) {
        await invDbLoad();
        const before = InvDB.known();
        const r = await core(ttl);
        if (before.size) { const now = new Set((billAll || []).map(x => x && x.id)); for (const id of before) if (!now.has(id)) await InvDB.del(id); }
        await invDbSave();
        return r;
    };
})();
setInterval(() => { invDbSave(); }, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') invDbSave(); });
window.addEventListener('pagehide', () => { invDbSave(); });
try { localStorage.removeItem('diwanSalesCache'); } catch (e) { /* تجاهل */ }   // ذاكرة قديمة (v910) تستهلك localStorage بلا فائدة
invDbLoad();   // تحميل مبكر عند الإقلاع
// تحميل فواتير آخر 12 أسبوعاً من السحابة مرة واحدة (صفحات 400) وحفظها في الجهاز
async function invDbBackfill() {
    if (!cloudReady() || !navigator.onLine) { Swal.fire({ icon: 'info', title: 'لا يوجد اتصال', text: 'التحميل الأول يحتاج اتصالاً بالإنترنت.', confirmButtonColor: '#0f1c38' }); return; }
    const from = typeof ndmFrom === 'function' ? ndmFrom() : sdAdd(todayLocalISO(), -83), h = Prog.start('تحميل الفواتير', { text: 'مرة واحدة وتُحفظ على الجهاز...', indeterminate: true });
    try {
        await invDbLoad(); let last = null, n = 0; const m = new Map((billAll || []).map(x => [x.id, x]));
        for (;;) {
            let q = db.collection('pharmacy_invoices').where('date', '>=', from).orderBy('date').limit(400); if (last) q = q.startAfter(last);
            const snap = await q.get(); if (snap.empty) break;
            snap.forEach(d => { const x = d.data(); if (x && x.id) { m.set(x.id, x); n++; } }); last = snap.docs[snap.docs.length - 1];
            if (snap.size < 400) break;
        }
        billAll = invScope([...m.values()]).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
        await invDbSave(); h.ok('تم: ' + fmtNum(n) + ' فاتورة'); if (typeof exRender === 'function') exRender();
    } catch (e) { h.fail('تعذر التحميل', (e && (e.code || e.message)) || ''); }
}
