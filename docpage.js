// =====================================================================
// صفحة الطبيب (الإعدادات): تختار المواد التي تظهر للأطباء وحالة كل مادة.
// تُحفظ في وثيقة pharmacy/doctor (قراءة عامة، كتابة للمالك فقط) وتقرأها الصفحة العامة doctor.html بقراءة واحدة.
// لا تلمس المخزن ولا الجرد ولا وضع التأسيس.
// =====================================================================
const DOC_ST = { ok: 'متوفر', noph: 'غير متوفر بالصيدلية', nosup: 'غير متوفر بالمذخر', back: 'عاد بعد انقطاع' };
const DOC_LS = 'diwanDocData';
let docReqList = [], docReqUnsub = null, docData = null, docLoadP = null, docPubT = null, docWatchT = null, docQ = '', docFil = 'all', docShown = 60, docMenu = false, docSel = { d: new Set(), c: new Set() }, docTreeCfg = null;
const docEsc = s => escapeHtml(String(s == null ? '' : s));
const docDefault = () => ({ cfg: { auto: false, prices: true, detect: true, days: 7 }, items: {}, upd: 0, sig: '' });
function docNorm(d) { const b = docDefault(); d = d || {}; return { cfg: { ...b.cfg, ...(d.cfg || {}) }, items: d.items || {}, upd: d.upd || 0, sig: d.sig || '' }; }
// الحالة الفعلية (نفس المنطق في doctor.html)
function docEff(it, cfg, now) {
    now = now || Date.now();
    if (it.s === 'back' && now - (it.t || 0) <= (cfg.days || 7) * 864e5) return 'back';
    if (it.s === 'nosup') return 'nosup';
    if (cfg.auto && it.k != null) return it.k ? 'ok' : 'noph';
    return it.s === 'noph' ? 'noph' : 'ok';
}
async function docLoad() {
    if (docData) return docData;
    if (docLoadP) return docLoadP;
    docLoadP = (async () => {
        let loaded = false;
        try { if (typeof cloudReady === 'function' && cloudReady()) { const d = await db.collection('pharmacy').doc('doctor').get(); if (d.exists) { docData = docNorm(d.data()); loaded = true; } } } catch (e) { /* تجاهل */ }
        if (!loaded) { try { const c = JSON.parse(localStorage.getItem(DOC_LS)); if (c) docData = docNorm(c); } catch (e) { /* تجاهل */ } }
        if (!docData) docData = docDefault();
        docLoadP = null; return docData;
    })();
    return docLoadP;
}
const docProd = id => products.find(p => String(p.id) === String(id));
// لقطة المادة التي تقرؤها الصفحة العامة (بدون أي كمية)
const DOC_IMG = 'https://raw.githubusercontent.com/BasraCliniciansApps/Al-Diwan-Pharmacy/main/';
function docSnap(p) {
    const o = { n: p.name || '', a: p.activeIngredient || '', p: Number(p.price) || 0 };
    const im = String(p.img || '').trim(); if (im && !im.startsWith('data:')) o.i = im.replace(DOC_IMG, '');
    if (p.brand && String(p.brand).trim().toUpperCase() !== 'GENERIC') o.b = String(p.brand).trim();
    try { if (p.form) o.f = formOf(p); } catch (e) { /* تجاهل */ }
    o.dn = deptsOf(p).filter(Boolean); o.cn = catsOf(p);
    o.k = (typeof setupSkip === 'function' && setupSkip(p)) ? null : (isInStock(p) ? 1 : 0);
    return o;
}
function docSigOf(d) { return Object.keys(d.items).sort().map(id => { const p = docProd(id), x = p ? docSnap(p) : {}; return id + '|' + (x.n || '') + '|' + (x.p || 0) + '|' + (x.i || '') + (x.b || '') + (x.f || '') + (x.dn || []).join(',') + (x.cn || []).join(',') + (d.items[id].nt || '') + '|' + x.k + '|' + d.items[id].s + '|' + d.items[id].t; }).join('~') + '|' + JSON.stringify(d.cfg); }
async function docPublish() {
    const d = await docLoad();
    Object.keys(d.items).forEach(id => {
        const p = docProd(id), it = d.items[id]; if (!p) return;
        const sn = docSnap(p);
        if (it.p != null && Number(it.p) !== sn.p && sn.p) { it.pp = Number(it.p); it.pt = Date.now(); }   // تغيّر السعر (تظهر الشارة أسبوعاً)
        delete it.i; delete it.b; delete it.f; Object.assign(it, sn);
    });
    // أقسام وتصنيفات المواد المعروضة (فهارس مضغوطة) لفلتر صفحة الطبيب
    const dIdx = new Map(), cIdx = new Map(), tx = { d: [], c: [] }, own = c => Object.keys(deptSubs).find(k => (deptSubs[k] || []).includes(c));
    Object.keys(d.items).forEach(id => {
        const it = d.items[id]; if (!it.dn) return;
        it.d = it.dn.map(n => { if (!dIdx.has(n)) { dIdx.set(n, tx.d.length); tx.d.push(n); } return dIdx.get(n); });
        it.c = (it.cn || []).map(n => { if (!cIdx.has(n)) { cIdx.set(n, tx.c.length); tx.c.push({ n, d: -1 }); } return cIdx.get(n); });
        (it.cn || []).forEach((n, j) => { const k = cIdx.get(n); if (tx.c[k].d < 0) { const o = own(n), oi = o != null ? dIdx.get(o) : undefined; tx.c[k].d = oi != null ? oi : (it.d[0] != null ? it.d[0] : -1); } });
    });
    Object.keys(d.items).forEach(id => { delete d.items[id].dn; delete d.items[id].cn; });
    d.tx = tx;
    d.upd = Date.now(); d.sig = docSigOf(d);
    try { localStorage.setItem(DOC_LS, JSON.stringify(d)); } catch (e) { /* تجاهل */ }
    try { if (typeof cloudReady === 'function' && cloudReady() && userRole === 'owner') { await fsSet(db.collection('pharmacy').doc('doctor'), JSON.parse(JSON.stringify(d))); return true; } } catch (e) { console.warn('docPublish', e); }
    return false;
}
async function docPublishNow() {
    const ok = await docPublish();
    Swal.fire(ok ? { icon: 'success', title: 'تم نشر التحديث للأطباء', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 } : { icon: 'error', title: 'تعذر النشر', text: 'تحقق من الاتصال بالسحابة وأنك مسجل كمالك.', confirmButtonColor: '#0f1c38' });
}
function docSaveSoon() { clearTimeout(docPubT); docPubT = setTimeout(docPublish, 700); }
// مراقبة تغيّر الأسعار والتوفر وتحديث صفحة الطبيب تلقائياً
function docOnProducts() {
    try { const h = document.getElementById('docHub'); if (h && h.style.display === 'flex' && typeof docRenderList === 'function' && docData) docRenderList(); } catch (e) { /* تجاهل */ }
    if (typeof IS_ADMIN_PAGE === 'undefined' || !IS_ADMIN_PAGE || userRole !== 'owner') return;
    docStartWatch();
    clearTimeout(docWatchT);
    docWatchT = setTimeout(async () => {
        try { const d = await docLoad(); if (!Object.keys(d.items).length) return; if (docSigOf(d) !== d.sig || !d.tx) docPublish(); } catch (e) { /* تجاهل */ }
    }, 6000);
}
// اكتشاف العودة بعد الانقطاع من قوائم الوارد/البونص
async function docOnArrive(pids, src) {
    try {
        const d = await docLoad(); if (!d.cfg.detect) return;
        let ch = false;
        (pids || []).forEach(pid => {
            const it = d.items[String(pid)]; if (!it) return;
            const was = it.s === 'noph' || it.s === 'nosup' || (d.cfg.auto && it.k === 0 && it.s !== 'back');
            if (was) { it.pv = it.s === 'back' ? 'ok' : it.s; it.s = 'back'; it.t = Date.now(); it.src = src || ''; ch = true; }
        });
        if (ch) { await docPublish(); if (document.getElementById('docHub') && document.getElementById('docHub').style.display === 'flex') docRenderList(); }
    } catch (e) { /* تجاهل */ }
}
async function docOnRevert(src) {
    try {
        const d = await docLoad(); let ch = false;
        Object.values(d.items).forEach(it => { if (it.src && it.src === src && it.s === 'back') { it.s = it.pv || 'ok'; delete it.pv; delete it.src; delete it.t; ch = true; } });
        if (ch) await docPublish();
    } catch (e) { /* تجاهل */ }
}

// ---------- الواجهة ----------
function docEl() { return document.getElementById('docHub'); }
async function docOpen() {
    let el = docEl();
    if (!el) { el = document.createElement('div'); el.id = 'docHub'; el.className = 'tax-rv'; document.body.appendChild(el); }
    document.body.classList.add('doc-open'); el.style.display = 'flex'; el.innerHTML = '<div class="tr-head"><b>🩺 صفحة الطبيب</b><button type="button" class="tr-x" onclick="docClose()">✕</button></div><div class="dh-body"><div class="dh-note">جارٍ التحميل…</div></div>';
    await docLoad(); docQ = ''; docFil = 'all'; docShown = 60; docMenu = false; docSel.d.clear(); docSel.c.clear(); docRender();
}
function docSyncOpen() { const on = ['docHub', 'rxHub'].some(i => { const e = document.getElementById(i); return e && e.style.display === 'flex'; }); document.body.classList.toggle('doc-open', on); }
function docClose() { const el = docEl(); if (el) el.style.display = 'none'; docSyncOpen(); }
function docLink() { try { return new URL('doctor.html', location.href).href; } catch (e) { return 'doctor.html'; } }
function docSw(label, sub, key) {
    return `<div class="qk-row"><div><b>${label}</b><small>${sub}</small></div><label class="setup-sw"><input type="checkbox" ${docData.cfg[key] ? 'checked' : ''} onchange="docCfg('${key}',this.checked)"><i></i></label></div>`;
}
function docRender() {
    const el = docEl(); if (!el) return;
    const c = docData.cfg;
    el.innerHTML = `<div class="tr-head"><b>🩺 صفحة الطبيب</b><button type="button" class="tr-x" onclick="docClose()" aria-label="إغلاق">✕</button></div>
    <div class="dh-body">
        <div class="dc-card">
            <div class="dc-link2"><button type="button" class="home-quick-link" onclick="docCopy()">📋 نسخ رابط الصفحة</button><a href="doctor.html" class="home-quick-link">👁 معاينة صفحة الطبيب</a><button type="button" class="home-quick-link" onclick="docPublishNow()">🔄 نشر التحديث الآن</button></div>
            ${docSw('تحديث تلقائي من المخزن', 'تُحسب الحالة من كمية المخزن (المواد غير المجرودة تبقى يدوية). إذا كان مطفياً تتحكم بالحالة يدوياً.', 'auto')}
            ${docSw('إظهار الأسعار للطبيب', 'إطفاؤه يخفي أسعار كل المواد في صفحة الطبيب.', 'prices')}
            ${docSw('اكتشاف العودة من الوارد تلقائياً', 'المادة غير المتوفرة التي تدخل في قائمة وارد أو بونص تصير «عاد بعد انقطاع».', 'detect')}
            <div class="qk-row"><div><b>مدة بقاء «عاد بعد انقطاع»</b><small>بعدها تعود المادة إلى «متوفر».</small></div>
                <select class="dc-days" onchange="docCfg('days',+this.value)">${[3, 7, 14, 30].map(n => `<option value="${n}" ${c.days === n ? 'selected' : ''}>${n} أيام</option>`).join('')}</select></div>
        </div>
        <div class="dc-card" id="docReq"><div class="dh-note">جارٍ تحميل طلبات الأطباء…</div></div>
        <div class="dc-bar">
            <input id="docQ" type="search" placeholder="ابحث باسم المادة أو المادة الفعالة" value="${docEsc(docQ)}" oninput="docSearch(this.value)">
            <button type="button" class="dc-fbtn ${docFil !== 'all' || tfCount(docSel) ? 'on' : ''}" onclick="docToggleMenu()" aria-label="فلتر"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M7 12h10M10 18h4"/></svg></button>
        </div>
        <div id="docMenu"></div>
        <div id="docList"></div>
    </div>`;
    docRenderMenu(); docRenderList(); docLoadReq();
}
const DOC_FILTERS = [['all', 'كل المواد'], ['sel', 'المعروضة للطبيب'], ['unsel', 'غير المعروضة'], ['ok', 'متوفر'], ['noph', 'غير متوفر بالصيدلية'], ['nosup', 'غير متوفر بالمذخر'], ['back', 'عاد بعد انقطاع']];
function docFbtn() {
    const b = document.querySelector('.dc-fbtn'); if (!b) return; const n = tfCount(docSel) + (docFil !== 'all' ? 1 : 0);
    b.classList.toggle('on', n > 0); let i = b.querySelector('.fb-n'); if (!i) { i = document.createElement('i'); i.className = 'fb-n'; b.appendChild(i); } i.textContent = n; i.style.display = n ? '' : 'none';
}
function docRenderMenu() {
    const m = document.getElementById('docMenu'); if (!m) return;
    docFbtn();
    if (!docMenu) { m.innerHTML = ''; return; }
    m.innerHTML = `<div class="dc-drop"><div id="docTree"></div></div>`;
    docTreeCfg = docTreeCfg || { open: new Set(), q: '' };
    Object.assign(docTreeCfg, { tree: tfAdminTree(), sel: docSel, count: tfAdminCounter(products), onChange() { docShown = 60; docRenderList(); docFbtn(); }, onDone() { docMenu = false; docRenderMenu(); } });
    tfMount(document.getElementById('docTree'), docTreeCfg);
}
function docToggleMenu() { docMenu = !docMenu; docRenderMenu(); }
function docSetFil(k) { docFil = k; docShown = 60; docRenderMenu(); docRenderList(); }
let docSearchT = null;
function docSearch(v) { docQ = v; clearTimeout(docSearchT); docSearchT = setTimeout(() => { docShown = 60; docRenderList(); }, 180); }
const docNormS = s => String(s || '').toLowerCase();
function docFiltered() {
    const q = docNormS(docQ.trim());
    return products.filter(p => {
        const it = docData.items[String(p.id)];
        if (q && !(docNormS(p.name).includes(q) || docNormS(p.activeIngredient).includes(q))) return false;
        if ((docSel.d.size || docSel.c.size) && !tfMatch(docSel, deptsOf(p), catsOf(p))) return false;
        if (docFil === 'sel') return !!it;
        if (docFil === 'unsel') return !it;
        if (docFil === 'all') return true;
        { const e = docEff({ ...it, ...docSnap(p) }, docData.cfg); return !!it && (e === docFil || (docFil === 'noph' && e === 'nosup')); }
    });
}
function docRenderList() {
    const box = document.getElementById('docList'); if (!box) return;
    const all = docFiltered(), shown = all.slice(0, docShown), selN = Object.keys(docData.items).length;
    const selShown = all.filter(p => docData.items[String(p.id)]).length;
    const rows = shown.map(p => {
        const id = String(p.id), it = docData.items[id], sel = !!it, st = it ? docEff({ ...it, ...docSnap(p) }, docData.cfg) : '';
        return `<div class="dc-row ${sel ? 'on' : ''}">
            <button type="button" class="sel-ck ${sel ? 'on' : ''}" onclick="docToggle('${id}')" aria-label="تحديد">${sel ? '✓' : ''}</button>
            <div class="dc-nm" onclick="docDetail('${id}')" role="button"><b dir="auto">${docEsc(p.name)}</b>${p.brand && String(p.brand).trim().toUpperCase() !== 'GENERIC' ? `<small class="dc-co">${docEsc(String(p.brand).trim())}</small>` : ''}${p.activeIngredient ? `<small class="dc-ai" dir="auto">${docEsc(p.activeIngredient)}</small>` : ''}<small class="dc-pr">${p.price ? fmtNum(p.price) + ' د.ع' : 'بلا سعر'}</small></div>
            ${sel ? `<span class="dc-dot ${st}" title="${DOC_ST[st]}"></span>` : ''}
            <select class="dc-st" ${sel ? '' : 'disabled'} onchange="docSetSt('${id}',this.value)">${Object.keys(DOC_ST).map(k => `<option value="${k}" ${it && it.s === k ? 'selected' : ''}>${DOC_ST[k]}</option>`).join('')}</select>
            ${sel ? `<input type="text" class="dc-note" maxlength="80" placeholder="ملاحظة للطبيب (اختياري): مثل يُحفظ في الثلاجة" value="${docEsc(it.nt || '')}" onchange="docSetNote('${id}',this.value)">` : ''}
        </div>`;
    }).join('');
    box.innerHTML = `<div class="dc-count">معروض للطبيب <b>${fmtNum(selN)}</b> من ${fmtNum(products.length)} مادة${all.length !== products.length ? ' · نتائج الفلتر ' + fmtNum(all.length) : ''}</div>
    <div class="dc-actions">
        <button type="button" onclick="docSelAll()">☑ تحديد نتائج الفلتر</button>
        <button type="button" ${selShown ? '' : 'disabled'} onclick="docClearAll()">✕ إلغاء تحديد النتائج</button>
        <select id="docBulk" onchange="docBulkSet(this.value)" ${selShown ? '' : 'disabled'}><option value="">تغيير حالة المحدد…</option>${Object.keys(DOC_ST).map(k => `<option value="${k}">${DOC_ST[k]}</option>`).join('')}</select>
    </div>
    ${rows || '<div class="dh-note">لا توجد مواد مطابقة.</div>'}
    ${all.length > shown.length ? `<button type="button" class="dc-more" onclick="docMore()">عرض المزيد (${fmtNum(all.length - shown.length)})</button>` : ''}`;
}
function docLiftModals() {
    ['sheetBackdrop', 'bottomSheet'].forEach(i => { const e = document.getElementById(i); if (e && e.parentNode !== document.body) document.body.appendChild(e); });
    document.querySelectorAll('#stockView .modal-overlay').forEach(e => document.body.appendChild(e));   // نماذج التعديل والتصنيفات تظهر فوق الإعدادات
}
function docDetail(id) {
    const p = docProd(id); if (!p || typeof openSheet !== 'function') return;
    // نافذة التفاصيل داخل عرض المخزن المخفي؛ ننقلها إلى جذر الصفحة لتظهر فوق الإعدادات
    docLiftModals();
    openSheet(p.id);
}
function docMore() { docShown += 80; docRenderList(); }
function docCopy() { try { navigator.clipboard.writeText(docLink()); Swal.fire({ icon: 'success', title: 'تم نسخ الرابط', toast: true, position: 'bottom', showConfirmButton: false, timer: 1500 }); } catch (e) { /* تجاهل */ } }
function docCfg(k, v) { docData.cfg[k] = v; docSaveSoon(); docRenderList(); }
function docToggle(id) {
    if (docData.items[id]) delete docData.items[id]; else docData.items[id] = { s: 'ok', ad: Date.now() };
    docSaveSoon(); docRenderList();
}
function docSetSt(id, v) {
    const it = docData.items[id]; if (!it) return;
    it.s = v; if (v === 'back') { it.t = Date.now(); delete it.src; delete it.pv; } else { delete it.t; delete it.src; delete it.pv; }
    docSaveSoon(); docRenderList();
}
function docSetNote(id, v) { const it = docData.items[id]; if (!it) return; v = String(v || '').trim(); if (v) it.nt = v; else delete it.nt; docSaveSoon(); }
function docSelAll() { docFiltered().forEach(p => { const id = String(p.id); if (!docData.items[id]) docData.items[id] = { s: 'ok', ad: Date.now() }; }); docSaveSoon(); docRenderList(); }
async function docClearAll() {
    const ids = docFiltered().filter(p => docData.items[String(p.id)]).map(p => String(p.id));
    if (!ids.length) return;
    if (!(await askSure('إلغاء تحديد ' + fmtNum(ids.length) + ' مادة؟', 'ستختفي هذه المواد من صفحة الطبيب.', 'إلغاء التحديد'))) return;
    ids.forEach(id => delete docData.items[id]); docSaveSoon(); docRenderList();
}
function docBulkSet(v) {
    if (!v) return;
    docFiltered().forEach(p => { const id = String(p.id); if (docData.items[id]) docSetStQuiet(id, v); });
    docSaveSoon(); docRenderList();
}
function docSetStQuiet(id, v) { const it = docData.items[id]; it.s = v; if (v === 'back') { it.t = Date.now(); } else delete it.t; delete it.src; delete it.pv; }

// ---------- طلبات الأطباء (من «أحتاج هذه المادة» و«اطلب هذه المادة») ----------
async function docLoadReq() {
    const box = document.getElementById('docReq'); if (!box) return;
    try {
        if (!(typeof cloudReady === 'function' && cloudReady())) { box.innerHTML = '<div class="dh-note">طلبات الأطباء تحتاج اتصالاً بالسحابة.</div>'; return; }
        const snap = await db.collection('pharmacy_search_misses').where('dr', '==', 1).get();
        docReqList = docMapReq(snap); docReqList.sort((a, b) => b.count - a.count || String(b.at).localeCompare(String(a.at)));
        docRenderReq();
    } catch (e) { box.innerHTML = '<div class="dh-note">تعذر تحميل طلبات الأطباء.</div>'; }
}
function docRenderReq() {
    const box = document.getElementById('docReq'); if (!box) return;
    if (!docReqList.length) { box.innerHTML = '<div class="qk-row"><div><b>طلبات الأطباء</b><small>لا توجد طلبات بعد. تظهر هنا المواد التي يحتاجها الأطباء، مرتبة بالأكثر طلباً.</small></div></div>'; return; }
    box.innerHTML = `<div class="qk-row"><div><b>طلبات الأطباء (${fmtNum(docReqList.length)})</b><small>مرتبة بالأكثر طلباً؛ استفد منها في قرارات الشراء.</small></div><button type="button" class="dc-mini" onclick="docReqClear()">مسح الكل</button></div>`
        + docReqList.slice(0, 40).map(r => `<div class="qk-row"><div><b dir="auto">${docEsc(r.name)}</b><small>${DOC_KIND[r.kind] || 'طلب'}${r.qty ? ' · الكمية: <b>' + fmtNum(r.qty) + '</b>' : ''}${r.note ? ' — ' + docEsc(r.note) : ''}${r.at ? ' · <bdi>' + docEsc(String(r.at).slice(0, 10)) + '</bdi>' : ''}</small></div><span class="dc-cnt">${fmtNum(r.count)}</span><button type="button" class="dc-mini" onclick="docReqDel('${docEsc(r.id)}')" aria-label="حذف">✕</button></div>`).join('');
}
async function docReqDel(id) {
    if (!(await askSure('حذف هذا الطلب؟', 'سيُحذف الطلب من القائمة.', 'حذف'))) return;
    try { await db.collection('pharmacy_search_misses').doc(id).delete(); docReqList = docReqList.filter(r => r.id !== id); docRenderReq(); docRenderAlertBox(false); docBadges(); } catch (e) { /* تجاهل */ }
}
async function docReqClear() {
    if (!(await askSure('مسح كل طلبات الأطباء؟', 'ستُحذف ' + fmtNum(docReqList.length) + ' طلباً نهائياً.', 'مسح الكل'))) return;
    try { for (let i = 0; i < docReqList.length; i += 400) { const b = db.batch(); docReqList.slice(i, i + 400).forEach(r => b.delete(db.collection('pharmacy_search_misses').doc(r.id))); await b.commit(); } docReqList = []; docRenderReq(); } catch (e) { /* تجاهل */ }
}

// ---------- مراقبة طلبات الأطباء لحظياً وإظهارها كتنبيه ----------
const DOC_SEEN = 'diwanDocSeen';
const DOC_KIND = { n: 'طلب توفر لمادة معروضة', q: 'طلب مادة غير موجودة في القائمة', s: 'بحث دون نتيجة' };
function docMapReq(snap) {
    const a = []; rxRaw = [];
    snap.forEach(d => { const x = d.data(); if (x.kind === 'r') { rxRaw.push({ id: d.id, rid: x.rid || d.id.replace(/^rx_/, ''), num: x.num || '', doctor: x.doctor || '', patient: x.patient || '', dx: x.dx || '', note: x.note || '', items: x.items || [], st: x.st || 'new', is: x.is || {}, msgs: x.msgs || [], ts: Date.parse(x.lastAt) || 0 }); return; } a.push({ id: d.id, name: x.name || '', note: x.note || '', qty: x.qty || 0, kind: x.kind, count: x.count || 1, at: x.lastAt || '' }); });
    return a.sort((p, q) => String(q.at).localeCompare(String(p.at)));
}
function docSeen() { try { return localStorage.getItem(DOC_SEEN) || ''; } catch (e) { return ''; } }
function docBadges() {
    const s = docSeen(), n = docReqList.filter(r => String(r.at) > s).length;
    document.querySelectorAll('.doc-badge').forEach(e => { e.textContent = n; e.style.display = n ? 'flex' : 'none'; });
}
function docMarkSeen() {
    const m = docReqList.reduce((a, r) => String(r.at) > a ? String(r.at) : a, '');
    if (m) { try { localStorage.setItem(DOC_SEEN, m); } catch (e) { /* تجاهل */ } }
    docBadges();
}
function docStartWatch() {
    if (docReqUnsub || typeof IS_ADMIN_PAGE === 'undefined' || !IS_ADMIN_PAGE || userRole !== 'owner' || !(typeof cloudReady === 'function' && cloudReady())) return;
    try {
        docReqUnsub = db.collection('pharmacy_search_misses').where('dr', '==', 1).onSnapshot(snap => {
            docReqList = docMapReq(snap); docBadges(); if (typeof rxChanged === 'function') rxChanged();
            const v = document.getElementById('alertsView'); if (v && v.classList.contains('active')) docRenderAlertBox(false);
            if (document.getElementById('docReq')) docRenderReq();
        }, () => { docReqUnsub = null; });
    } catch (e) { docReqUnsub = null; }
}
function docRenderAlertBox(markSeen) {
    const box = document.getElementById('docAlertBox'); if (!box) return;
    if (!docReqList.length) { box.innerHTML = typeof rxAlertRow === 'function' ? rxAlertRow() : ''; return; }
    const s = docSeen(), nNew = docReqList.filter(r => String(r.at) > s).length;
    box.innerHTML = (typeof rxAlertRow === 'function' ? rxAlertRow() : '') + `<div class="da-card"><div class="da-head">🩺 تنبيهات الأطباء${nNew ? ` <em>${fmtNum(nNew)} جديد</em>` : ''}</div>`
        + docReqList.slice(0, 15).map(r => `<div class="da-row ${String(r.at) > s ? 'new' : ''}"><div><b dir="auto">${docEsc(r.name)}</b><small>${DOC_KIND[r.kind] || 'طلب'}${r.qty ? ' · الكمية: <b>' + fmtNum(r.qty) + '</b>' : ''}${r.note ? ' — ' + docEsc(r.note) : ''}${r.at ? ' · <bdi>' + docEsc(String(r.at).slice(0, 10)) + '</bdi>' : ''}</small></div>${r.count > 1 ? `<span class="da-cnt">${fmtNum(r.count)}×</span>` : ''}<button type="button" class="da-x" onclick="docReqDel('${docEsc(r.id)}')" aria-label="حذف">✕</button></div>`).join('')
        + (docReqList.length > 15 ? `<div class="da-more">و ${fmtNum(docReqList.length - 15)} طلباً آخر في إعدادات صفحة الطبيب</div>` : '') + '</div>';
    if (markSeen) docMarkSeen();
}
