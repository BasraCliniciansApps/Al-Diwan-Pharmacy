// =====================================================================
// التعلّم من اختياراتك: كل ما تختار أو تصحّح قسم/تصنيف/شكل دوائي لمادة (وتحفظها) يتذكّر التطبيق اختيارك.
// • المطابقة التامة للاسم (بدون الجرعة) تُطبَّق فوراً. • الكلمة المشتركة تصير قاعدة فقط بعد ما تتأكد على مادتين مختلفتين بنفس الاختيار وبدون تعارض.
// قواعدك أعلى أولوية من الجدول الجاهز والقواعد الثابتة. تنحفظ بالسحابة (تظهر على كل الأجهزة) وتقدر تعرضها وتحذفها.
// =====================================================================
const LN_LS = 'diwanLearn';
const LN_STOP = new Set(['tablet', 'tablets', 'capsule', 'capsules', 'cream', 'syrup', 'sachet', 'sachets', 'count', 'pieces', 'piece', 'with', 'plus', 'extra', 'forte', 'drops', 'spray', 'gel', 'ointment', 'solution', 'injection', 'lotion', 'shampoo', 'women', 'woman', 'kids', 'baby', 'adult', 'pack', 'size', 'large', 'small', 'medium', 'original', 'natural', 'ultra', 'from', 'that', 'this', 'your', 'free', 'daily', 'strength', 'relief', 'night', 'care']);
let learnData = { ex: {}, tk: {}, off: false };
try { const d = JSON.parse(localStorage.getItem(LN_LS)); if (d && typeof d === 'object') learnData = Object.assign({ ex: {}, tk: {}, off: false }, d); } catch (e) { /* تجاهل */ }
function learnOn() { return !learnData.off; }
function learnSave() { try { localStorage.setItem(LN_LS, JSON.stringify(learnData)); } catch (e) { /* تجاهل */ } }
function learnExport() { return learnData; }
function learnImport(o, merge) {   // دمج قواعد من السحابة/النسخة الاحتياطية
    if (!o || typeof o !== 'object') return;
    const ex = o.ex || {}, tk = o.tk || {};
    if (!merge) { learnData.ex = ex; learnData.tk = tk; }
    else {
        Object.keys(ex).forEach(k => { if (!learnData.ex[k] || (ex[k].t || 0) > (learnData.ex[k].t || 0)) learnData.ex[k] = ex[k]; });
        Object.keys(tk).forEach(t => {
            const a = learnData.tk[t] = learnData.tk[t] || { c: {}, f: {} };
            ['c', 'f'].forEach(w => Object.keys((tk[t] || {})[w] || {}).forEach(ch => { a[w][ch] = [...new Set([...(a[w][ch] || []), ...tk[t][w][ch]])].slice(-6); }));
        });
    }
    if (typeof o.off === 'boolean' && !merge) learnData.off = o.off;
    learnSave();
}
function learnTokens(name) {
    const k = typeof taxKey === 'function' ? taxKey(name) : String(name || '').toLowerCase();
    return [...new Set(k.split(/[^a-z؀-ۿ]+/).filter(w => w.length >= 4 && !LN_STOP.has(w)))].slice(0, 6);
}
function learnNameKey(name) { return typeof taxKey === 'function' ? taxKey(name) : String(name || '').toLowerCase().trim(); }
let learnPushT = null, learnPend = false;
function learnPending() { return learnPend; }
function learnPush() {   // رفع القواعد للسحابة بصمت (بدون شريط تقدم)
    clearTimeout(learnPushT); learnPend = true;
    learnPushT = setTimeout(() => {
        learnPend = false;
        try {
            if (typeof isFirebaseReady === 'undefined' || !isFirebaseReady || !currentUser || !navigator.onLine) return;
            fsSet(db.collection('pharmacy').doc('metadata'), { learn: learnData }, { mergeFields: ['learn'] }).catch(() => { });
        } catch (e) { /* تجاهل */ }
    }, 2500);
}
// يسجّل اختياراً مؤكَّداً: d=القسم s=التصنيف f=الشكل (أي منها اختياري)
function learnAdd(name, d, s, f) {
    if (!learnOn()) return;
    const nk = learnNameKey(name); if (nk.length < 3) return;
    const taxOk = d && s && typeof TAX_SEED !== 'undefined' && (TAX_SEED[d] || []).includes(s);
    if (!taxOk && !f) return;
    const e = learnData.ex[nk] = learnData.ex[nk] || { t: 0 };
    if (taxOk) { e.d = d; e.s = s; } if (f) e.f = f; e.t = Date.now();
    learnTokens(name).forEach(tok => {
        const a = learnData.tk[tok] = learnData.tk[tok] || { c: {}, f: {} };
        if (taxOk) { const ch = d + '›' + s; a.c[ch] = [...new Set([...(a.c[ch] || []), nk])].slice(-6); }
        if (f) a.f[f] = [...new Set([...(a.f[f] || []), nk])].slice(-6);
    });
    const keys = Object.keys(learnData.ex); if (keys.length > 4000) keys.sort((x, y) => (learnData.ex[x].t || 0) - (learnData.ex[y].t || 0)).slice(0, keys.length - 4000).forEach(k => delete learnData.ex[k]);
    learnSave(); learnPush();
}
// التوقّع: {d, s, f} بالأسماء، أو null
function learnPredict(name) {
    if (!learnOn()) return null;
    const nk = learnNameKey(name), out = {};
    const e = learnData.ex[nk]; if (e) { if (e.d && e.s) { out.d = e.d; out.s = e.s; } if (e.f) out.f = e.f; }
    if (!(out.d && out.s) || !out.f) {
        const cs = {}, fs = {};
        learnTokens(name).forEach(tok => {
            const a = learnData.tk[tok]; if (!a) return;
            const ck = Object.keys(a.c || {}); if (ck.length === 1 && a.c[ck[0]].length >= 2) cs[ck[0]] = (cs[ck[0]] || 0) + a.c[ck[0]].length;
            const fk = Object.keys(a.f || {}); if (fk.length === 1 && a.f[fk[0]].length >= 2) fs[fk[0]] = (fs[fk[0]] || 0) + a.f[fk[0]].length;
        });
        const best = o => { const k = Object.keys(o).sort((x, y) => o[y] - o[x]); return k.length && (k.length === 1 || o[k[0]] > o[k[1]]) ? k[0] : null; };
        if (!(out.d && out.s)) { const b = best(cs); if (b) { const i = b.indexOf('›'); out.d = b.slice(0, i); out.s = b.slice(i + 1); } }
        if (!out.f) { const b = best(fs); if (b) out.f = b; }
    }
    return out.d || out.f ? out : null;
}
// ===== ربط بالمقترِح والكاشف =====
if (typeof taxSuggest === 'function' && typeof taxFormOf === 'function') {
    const _ts = taxSuggest;
    taxSuggest = function (p) {
        const l = learnPredict(p && p.name);
        if (l && l.d) { const di = TAX_DEPTS.indexOf(l.d), si = di < 0 ? -1 : TAX_SEED[l.d].indexOf(l.s); if (si >= 0) return { d: di + 1, s: si + 1, guess: false, learned: true }; }
        return _ts(p);
    };
    const _tf = taxFormOf;
    taxFormOf = function (p) { if (p && p.form) return p.form; const l = learnPredict(p && p.name); if (l && l.f && FORMS.some(x => x.id === l.f)) return l.f; return _tf(p); };
    if (typeof qkDetectForm === 'function') {
        const _qd = qkDetectForm;
        qkDetectForm = function (s) { const l = learnPredict(String(s || '').split(/\s{1}(?=\d)/)[0]); if (l && l.f) { const f = FORMS.find(x => x.id === l.f); if (f) return f; } return _qd(s); };
    }
}
// ===== التعلّم من حفظ الصنف =====
const lnTouch = { tax: false, form: false };
function lnBind() {
    ['fDepartment', 'fCategory'].forEach(id => { const e = document.getElementById(id); if (e && !e.dataset.ln) { e.dataset.ln = '1'; e.addEventListener('change', () => { lnTouch.tax = true; }); } });
    const f = document.getElementById('fForm'); if (f && !f.dataset.ln) { f.dataset.ln = '1'; f.addEventListener('change', () => { lnTouch.form = true; }); }
}
if (typeof openFormModal === 'function') { const _o = openFormModal; openFormModal = function () { _o.apply(this, arguments); lnTouch.tax = lnTouch.form = false; lnBind(); }; }
document.addEventListener('DOMContentLoaded', lnBind);
if (typeof onProductSaved === 'function') {
    const _s = onProductSaved;
    onProductSaved = function (obj) {
        try { if (obj && (lnTouch.tax || lnTouch.form)) learnAdd(obj.name, lnTouch.tax ? obj.department : '', lnTouch.tax ? obj.category : '', lnTouch.form && obj.form && obj.form !== 'other' ? obj.form : ''); lnTouch.tax = lnTouch.form = false; } catch (e) { /* تجاهل */ }
        return _s.apply(this, arguments);
    };
}
// ===== التعلّم من مراجعة التصنيف (التعديلات اليدوية فقط) =====
if (typeof taxRvApply === 'function' && typeof taxRvList === 'function') {
    const _a = taxRvApply;
    taxRvApply = async function () {
        const ed = taxRvList().filter(p => { const e = taxRv[p.id]; return e && e.st === 'edit' && e.d; }).map(p => ({ id: p.id, name: p.name, e: taxRv[p.id] }));
        const r = await _a.apply(this, arguments);
        try { ed.forEach(x => { const p = products.find(q => q.id === x.id); if (p && p.department === x.e.d) learnAdd(p.name, x.e.d, x.e.s, x.e.f && x.e.f !== 'other' ? x.e.f : ''); }); } catch (e) { /* تجاهل */ }
        return r;
    };
}
// ===== شاشة «قواعدي» =====
function learnRules() {
    const rows = [];
    Object.keys(learnData.tk).forEach(tok => {
        const a = learnData.tk[tok];
        const ck = Object.keys(a.c || {}); if (ck.length === 1 && a.c[ck[0]].length >= 2) rows.push({ tok, kind: 'c', ch: ck[0], n: a.c[ck[0]].length });
        const fk = Object.keys(a.f || {}); if (fk.length === 1 && a.f[fk[0]].length >= 2) { const f = FORMS.find(x => x.id === fk[0]); rows.push({ tok, kind: 'f', ch: f ? f.txt : fk[0], n: a.f[fk[0]].length }); }
    });
    return rows.sort((x, y) => y.n - x.n);
}
function learnOpen() {
    const ex = Object.keys(learnData.ex).length, rows = learnRules();
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const html = `<div style="text-align:right;font-size:.86rem;line-height:1.8">
        <label class="ln-sw"><span><b>التعلّم من اختياراتي</b><small>يتذكّر القسم/التصنيف/الشكل الذي تختاره ويطبّقه على المواد المشابهة</small></span><span class="setup-sw"><input type="checkbox" id="lnOn" ${learnOn() ? 'checked' : ''}><i></i></span></label>
        <div class="ln-stat">مواد محفوظة بالاسم: <b>${ex}</b> · قواعد كلمات مفعّلة: <b>${rows.length}</b></div>
        <div class="ln-list">${rows.length ? rows.map(r => `<div class="ln-row"><span><b dir="ltr">${esc(r.tok)}</b> ← ${esc(r.ch)}${r.kind === 'f' ? ' <em>(شكل)</em>' : ''}<small>تأكّدت في ${r.n} مواد</small></span><button type="button" onclick="learnDel('${esc(r.tok)}','${r.kind}')" aria-label="حذف">✕</button></div>`).join('') : '<div class="ln-empty">لا توجد قواعد كلمات بعد. تتكوّن عندما تختار التصنيف نفسه لمادتين تشتركان في كلمة.</div>'}</div>
        <button type="button" class="ln-clear" onclick="learnClear()">مسح كل ما تعلّمه</button></div>`;
    Swal.fire({ title: 'قواعدي', html, width: 'min(94vw, 520px)', confirmButtonColor: '#0f1c38', confirmButtonText: 'تم', didOpen: () => { const c = document.getElementById('lnOn'); if (c) c.addEventListener('change', () => { learnData.off = !c.checked; learnSave(); learnPush(); }); } });
}
function learnDel(tok, kind) {
    const a = learnData.tk[tok]; if (!a) return;
    a[kind === 'c' ? 'c' : 'f'] = {}; if (!Object.keys(a.c).length && !Object.keys(a.f).length) delete learnData.tk[tok];
    learnSave(); learnPush(); learnOpen();
}
async function learnClear() {
    const r = await Swal.fire({ icon: 'warning', title: 'مسح كل التعلّم؟', text: 'تُحذف كل القواعد المحفوظة (المواد لا تتأثر).', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'مسح', cancelButtonText: 'رجوع' });
    if (!r.isConfirmed) return;
    learnData.ex = {}; learnData.tk = {}; learnSave();
    try { if (isFirebaseReady && currentUser) await fsSet(db.collection('pharmacy').doc('metadata'), { learn: { ex: {}, tk: {}, off: !!learnData.off } }, { mergeFields: ['learn'] }); } catch (e) { /* تجاهل */ }
    learnOpen();
}
// زر «قواعدي» داخل صندوق الإدخال السريع وإدارة الأقسام
if (typeof qkInit === 'function') {
    const _qi = qkInit;
    qkInit = function () { _qi(); const b = document.getElementById('qkBox'); if (b && !document.getElementById('lnBtn')) b.insertAdjacentHTML('beforeend', `<div class="qk-row"><div><b>التعلّم من اختياراتي بصمت</b><small>يتذكّر تصنيفاتك وأشكالك ويطبّقها لاحقاً <a href="#" id="lnBtn" onclick="learnOpen();return false" style="color:#0369a1;font-weight:700">قواعدي</a></small></div><label class="setup-sw"><input type="checkbox" id="lnSw" ${learnOn() ? 'checked' : ''} onchange="learnToggle(this.checked)" aria-label="التعلّم من اختياراتي"><i></i></label></div>`); const sw = document.getElementById('lnSw'); if (sw) sw.checked = learnOn(); };
}
function learnToggle(v) { learnData.off = !v; learnSave(); learnPush(); const sw = document.getElementById('lnSw'); if (sw) sw.checked = !!v; }
if (typeof renderTaxSeedBox === 'function') {
    const _rb = renderTaxSeedBox;
    renderTaxSeedBox = function () { _rb(); const box = document.getElementById('taxSeedBox'); if (box && !box.querySelector('.ln-btn2')) box.insertAdjacentHTML('beforeend', '<button type="button" class="ln-btn2" onclick="learnOpen()">🧠 قواعدي — ما تعلّمه التطبيق من اختياراتك</button>'); };
}

// =====================================================================
// حفظ قرارات «مراجعة التصنيف» (✓/✕/التعديلات) بالسحابة حتى ما تضيع لو انمسح المتصفح أو انحذف التطبيق.
// تنحفظ بوثيقة pharmacy/taxreview وتُدمج بين الأجهزة (الأحدث لكل مادة يفوز).
// =====================================================================
if (typeof taxRvSave === 'function' && typeof taxRv !== 'undefined') {
    let rvSnap = {}, rvT = null, rvLoaded = false, rvTries = 0;
    const rvKey = e => JSON.stringify([e.d, e.s, e.f, e.x, e.st]);
    Object.keys(taxRv).forEach(id => { rvSnap[id] = rvKey(taxRv[id]); });
    const rvPush = () => {
        clearTimeout(rvT);
        rvT = setTimeout(() => {
            try {
                if (!rvLoaded || typeof isFirebaseReady === 'undefined' || !isFirebaseReady || !currentUser || !navigator.onLine) return;
                fsSet(db.collection('pharmacy').doc('taxreview'), { rv: taxRv, updatedAt: new Date().toISOString() }).catch(() => { });
            } catch (e) { /* تجاهل */ }
        }, 3000);
    };
    const _rs = taxRvSave;
    taxRvSave = function () {
        try { const now = Date.now(); Object.keys(taxRv).forEach(id => { const k = rvKey(taxRv[id]); if (rvSnap[id] !== k) { rvSnap[id] = k; taxRv[id].t = now; } }); } catch (e) { /* تجاهل */ }
        _rs.apply(this, arguments); rvPush();
    };
    const rvLoad = () => {
        if (rvLoaded || ++rvTries > 40) return;
        try {
            if (typeof isFirebaseReady === 'undefined' || !isFirebaseReady || !currentUser) { setTimeout(rvLoad, 3000); return; }
            db.collection('pharmacy').doc('taxreview').get().then(snap => {
                const c = snap.exists ? ((snap.data() || {}).rv || {}) : {}; let n = 0;
                Object.keys(c).forEach(id => { const l = taxRv[id]; if (!l || (c[id].t || 0) > (l.t || 0)) { taxRv[id] = c[id]; rvSnap[id] = rvKey(c[id]); n++; } });
                rvLoaded = true; try { _rs(); } catch (e) { /* تجاهل */ }
                if (n) { try { if (document.getElementById('taxRv') && document.getElementById('taxRv').style.display !== 'none') taxRvRender(true); } catch (e) { /* تجاهل */ } }
                if (Object.keys(taxRv).some(id => !c[id] || (taxRv[id].t || 0) > (c[id].t || 0))) rvPush();   // ما عند السحابة يُرفع
            }).catch(() => { setTimeout(rvLoad, 5000); });
        } catch (e) { setTimeout(rvLoad, 5000); }
    };
    setTimeout(rvLoad, 2500);
}
