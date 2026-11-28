// =====================================================================
// مخزن القوائم الكبيرة على الجهاز (IndexedDB): الواردات، الدفتر، المذاخر، ونسخة احتياطية للمواد.
// يعترض lsGet/lsSet لهذه المفاتيح فقط، فلا يتغير أي كود آخر؛ البيانات تُحفظ في IndexedDB بلا سقف
// وتُزال من localStorage (5 ميغا) بعد التأكد من نجاح الحفظ. إن تعذّر IndexedDB يعود كل شيء إلى localStorage كما كان.
// =====================================================================
const BigStore = (() => {
    const KEYS = new Set(['diwanPurchasesLocal', 'diwanLedgerLocal', 'diwanSuppliers', 'diwanMissed']);
    const mem = new Map(), dirty = new Set(); let ready = false, failed = false, dbp = null, timer = 0, lastErr = '';
    const open = () => dbp || (dbp = new Promise((ok, no) => {
        try { const r = indexedDB.open('diwanBig', 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); r.onblocked = () => no(new Error('blocked')); } catch (e) { no(e); }
    }));
    const tx = (mode, fn) => open().then(d => new Promise((ok, no) => { const t = d.transaction('kv', mode), s = t.objectStore('kv'); const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }));
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: k => { try { localStorage.removeItem(k); } catch (e) { /* تجاهل */ } } };
    async function flush() {
        timer = 0; if (failed) { dirty.forEach(k => ls.set(k, mem.get(k))); dirty.clear(); return; }
        const ks = [...dirty]; if (!ks.length) return; dirty.clear();
        try { await tx('readwrite', s => { ks.forEach(k => s.put(mem.get(k), k)); }); ks.forEach(k => ls.del(k)); }   // لا يُمسح من localStorage إلا بعد نجاح الحفظ
        catch (e) { lastErr = (e && (e.name || e.message)) || 'خطأ'; ks.forEach(k => { dirty.add(k); ls.set(k, mem.get(k)); }); }
    }
    const soon = () => { if (!timer) timer = setTimeout(flush, 400); };
    function get(k) { if (mem.has(k)) return mem.get(k); return ls.get(k); }   // قبل اكتمال التحميل: النسخة القديمة في localStorage
    function set(k, v) { mem.set(k, v); if (failed) { ls.set(k, v); return; } dirty.add(k); soon(); }
    async function init() {
        try {
            const rows = {}; await tx('readonly', s => { const rq = s.openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { rows[c.key] = c.value; c.continue(); } }; return rq; });
            for (const k of KEYS) {
                if (dirty.has(k)) continue;   // كُتبت في هذه الجلسة قبل اكتمال التحميل: هي الأحدث
                if (rows[k] != null) { mem.set(k, rows[k]); ls.del(k); }
                else { const legacy = ls.get(k); if (legacy != null) { mem.set(k, legacy); dirty.add(k); } }   // ترحيل لمرة واحدة من localStorage
            }
            ready = true; if (dirty.size) await flush();
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* تجاهل */ }
        } catch (e) { failed = true; lastErr = (e && (e.name || e.message)) || 'خطأ'; flush(); }
    }
    // نسخة احتياطية للمواد (تُستعمل إذا امتلأ localStorage فتُمسح نسخته)
    const mirror = (k, v) => { if (failed) return; tx('readwrite', s => { s.put(v, 'mirror:' + k); }).catch(() => { }); };
    const mirrorGet = k => tx('readonly', s => s.get('mirror:' + k)).catch(() => null);
    async function diag() {
        /* lsBytes يُحسب بعدد الحروف: حد المتصفح نحو 5 ملايين حرف */ let usage = 0, quota = 0, persisted = null, lsBytes = 0;
        try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usage = e.usage || 0; quota = e.quota || 0; } } catch (e) { /* تجاهل */ }
        try { if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted(); } catch (e) { /* تجاهل */ }
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsBytes += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* تجاهل */ }
        return { usage, quota, persisted, lsBytes, lsLimit: 5e6, ready, failed, err: lastErr, big: [...KEYS].map(k => [k, (mem.get(k) || '').length]) };
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty.size) flush(); });
    window.addEventListener('pagehide', () => { if (dirty.size) flush(); });
    const api = { KEYS, get, set, init, flush, mirror, mirrorGet, diag, isReady: () => ready, isFailed: () => failed };
    return api;
})();
(function () {   // اعتراض lsGet/lsSet لمفاتيح القوائم الكبيرة فقط
    const g = window.lsGet, s = window.lsSet;
    window.lsGet = function (k) { return BigStore.KEYS.has(k) ? BigStore.get(k) : g(k); };
    window.lsSet = function (k, v) { if (BigStore.KEYS.has(k)) BigStore.set(k, v); else s(k, v); };
})();
window.bigReady = BigStore.init();
window.BigStore = BigStore;
