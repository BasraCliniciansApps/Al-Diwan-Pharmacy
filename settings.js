// =====================================================================
// واجهة الإعدادات: صفحة رئيسية ببطاقات + صفحات منفصلة لكل موضوع + بحث داخل الإعدادات + ملخص حالة لكل بطاقة.
// ما تغيّر محتوى الإعدادات القديمة، بس ترتّبه (تعرض صناديق كل صفحة وتخفي الباقي).
// =====================================================================
const SH_PAGES = [
    { id: 'invset', ico: '🧾', t: 'الفواتير والبيع', boxes: ['invoice'], kw: 'فاتورة فواتير عنوان الصيدلية هاتف ختم توقيع سياسة الإرجاع شاشة البيع جرد عند أول بيع طباعة invoice print' },
    { id: 'inv', ico: '📦', t: 'المخزون والتنبيهات', boxes: ['alerts'], kw: 'مخزون تنبيه تنبيهات نقص كمية قليلة صلاحية انتهاء مدة نفاذ تواريخ الوارد inventory alerts' },
    { id: 'price', ico: '💰', t: 'التسعير', boxes: ['pricing'], kw: 'سعر تسعير نقابة كتاب صرف دولار دينار نسبة شرائح تقريب إعادة تسعير pricing' },
    { id: 'tax', ico: '🗂️', t: 'الأقسام والتصنيف', boxes: ['depts', 'cats', 'forms', 'types', 'parts'], quick: true, kw: 'قسم اقسام تصنيف تصنيفات فرعية اشكال الاشكال الدوائية مجموعة تبويب تبويبات انواع المواد نوع الجزء اجزاء الإدخال السريع تعلم تلقائي ما تعلمه التطبيق forms categories departments' },
    { id: 'maint', ico: '🧰', t: 'صيانة البيانات', boxes: ['maint-hub', 'seed', 'maint-exp'], kw: 'مركز تجهيز البيانات مواد فعالة مراجعة التصنيف مكررة ناقصة تعبئة الشركات قواعد تصنيفي الأقسام الجاهزة استيراد تواريخ الانتهاء الفواتير المؤجلة صيانة' },
    { id: 'scanner', ico: '🔎', t: 'فاحص المادة', boxes: [], scan: true, kw: 'فاحص المادة مسح باركود حد الخصم الخصم المحمي الكامل هامش الامان اكسباير حاسبة الخصم scanner discount' },
    { id: 'ai', ico: '✨', t: 'الذكاء الصناعي', boxes: ['ai'], kw: 'ذكاء صناعي مسح عبوة gemini firebase groq openrouter مفتاح نموذج بحث بالاسم قراءة العبوة ocr' },
    { id: 'docset', ico: '🩺', t: 'صفحة الأطباء', boxes: ['docs'], kw: 'طبيب اطباء صفحة الاطباء رابط الصفحة اظهار الاسعار العدد تحديث تلقائي طلبات الأطباء doctor' },
    { id: 'device', ico: '📱', t: 'هذا الجهاز', boxes: ['install', 'device'], kw: 'تثبيت التطبيق بصمة قفل تذكير طباعة ورق طابعة اسماء الاطباء المحفوظة الجهاز install' },
    { id: 'sec', ico: '🔐', t: 'المستخدمون والأمان', boxes: ['users', 'protect'], kw: 'مستخدم مستخدمين صلاحيات حساب بائع حماية بيانات المخزون فصل سعر الشراء كلفة اخفاء أمان خصوصية users permissions security' },
    { id: 'sys', ico: '💾', t: 'النسخ والاسترجاع', boxes: ['backup', 'restore'], kw: 'نسخ احتياطي استرجاع تصدير اكسل csv نسخ سحابية سلة محذوفات backup restore export trash' }
];
// الرجوع الصحيح: النافذة التي تُفتح من الإعدادات (اختصار/أداة) تغلق الإعدادات مؤقتًا؛ عند الرجوع منها نعيد الإعدادات
// في الصفحة التي كنت فيها، لا أن نتركك في الرئيسية. kind: 'layer' نافذة (تُراقَب) أو 'view' شاشة (تُعاد بزر الرجوع).
let shRet = null;
function shLeave(kind) {
    const m = document.getElementById('catModal');
    if (!m || !m.style.display || m.style.display === 'none') { shRet = null; return; }   // لم نأتِ من الإعدادات (مثلاً من الرئيسية): لا نعيدك إليها
    shRet = { page: typeof shCur !== 'undefined' ? shCur : null, kind, seen: false, t: Date.now() };
    try { closeCategoryManager(); } catch (e) { /* تجاهل */ }
}
function shReturn(src) {
    const r = shRet; if (!r) return;
    const d = typeof window.__backDepth === 'function' ? window.__backDepth() : 0;
    if (d > 0) { r.seen = true; return; }
    if (!r.seen) { if (Date.now() - r.t > 60000) shRet = null; return; }
    if (r.kind === 'view' && src !== 'back') return;
    shRet = null;
    try { openCategoryManager(); if (r.page) shOpen(r.page); } catch (e) { /* تجاهل */ }
}
window.__shRetClear = () => { shRet = null; };
window.__shStale = () => { if (shRet && shRet.kind === 'view' && shRet.seen) shRet = null; };   // انتقلتَ لشاشة أخرى بنفسك بعد مغادرة الإعدادات: لا تُعاد الإعدادات لاحقاً
window.__shReturn = shReturn;
window.__shSnap = () => (shRet ? { page: shRet.page } : null);   // لمعرفة صفحة الإعدادات التي جئنا منها
setInterval(() => { if (shRet) shReturn(); }, 350);
function shGoDataHub() { dhOpen(); }
let shCur = null;
const shNorm = s => String(s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
// الصناديق تُعرَّف بمعرّف ثابت data-k (لا بأرقام ترتيب)، فلا تنزاح الصفحات مهما تغيّرت المحتويات
function shBoxes() { return [...document.querySelectorAll('#catModal .cat-manager-box[data-k]')]; }
function shBox(k) { return document.querySelector('#catModal .cat-manager-box[data-k="' + k + '"]'); }
function shCard() { return document.querySelector('#catModal .modal-card'); }
function shBuzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* تجاهل */ } }
function shSummary(p) {
    try {
        if (p.id === 'tax') { const n = (typeof taxSeeded === 'function' && taxSeeded()) ? taxMissingSubs().length + taxPendingRenames().length + taxPendingMoves().length : 0; return { s: `${fmtNum(departments.length)} قسم · ${fmtNum(subCategories.length)} تصنيف · الأشكال والتبويبات`, badge: n ? fmtNum(n) + ' جديد' : '' }; }
        if (p.id === 'inv') return { s: `حد الكمية ${fmtNum(lowStockThreshold)} · الصلاحية ${alertMonths.join('/')} أشهر` };
        if (p.id === 'price') return { s: `سعر الصرف ${fmtNum(pricingCfg.rate)} · الشرائح والتقريب` };
        if (p.id === 'invset') return { s: 'هوية الفاتورة · الختم والتوقيع · شاشة البيع · الطباعة' };
        if (p.id === 'maint') return { s: 'مركز تجهيز البيانات · الأقسام الجاهزة · استيراد التواريخ' };
        if (p.id === 'scanner') { const c = typeof scCfg === 'function' ? scCfg() : null; return { s: c ? (c.on ? 'مشغّل · ' : 'متوقف · ') + (c.mode === 'safe' ? 'خصم محمي' : 'خصم كامل') : '' }; }
        if (p.id === 'ai') return { s: 'محرك القراءة · المفتاح · اختبار الاتصال' };
        if (p.id === 'docset') return { s: 'الرابط · الأسعار والعدد · طلبات الأطباء' };
        if (p.id === 'device') return { s: 'التثبيت · البصمة · التذكيرات · الطباعة' };
        if (p.id === 'sec') return { s: 'المستخدمون · الصلاحيات · حماية البيانات' };
        if (p.id === 'sys') return { s: 'نسخ احتياطي · تصدير · استرجاع · السلة' };
    } catch (e) { /* تجاهل */ }
    return { s: '' };
}
function shHubHtml() {
    return `<div class="sh-search"><input type="search" id="shQ" placeholder="ابحث في الإعدادات…" autocomplete="off" aria-label="بحث في الإعدادات"></div>
    <div class="sh-grid" id="shGrid">${SH_PAGES.map(p => { const m = shSummary(p); return `<button type="button" class="sh-card" data-p="${p.id}"><span class="sh-ico">${p.ico}</span><span class="sh-tx"><b>${p.t}</b><small>${m.s}</small></span>${m.badge ? `<em class="sh-badge">${m.badge}</em>` : ''}</button>`; }).join('')}</div>
    <div class="sh-res" id="shRes" hidden></div>`;
}
function shQuickHtml() {
    const c = qkCfg(), rows = Object.keys(QK_LABELS).map(k => `<div class="qk-row"><div><b>${QK_LABELS[k][0]}</b><small>${QK_LABELS[k][1]}</small></div><label class="setup-sw"><input type="checkbox" ${c[k] ? 'checked' : ''} onchange="qkSet('${k}', this.checked)" aria-label="${QK_LABELS[k][0]}"><i></i></label></div>`).join('');
    const lr = typeof learnRules === 'function' ? learnRules().length : 0;
    return `<small style="display:block;color:var(--text-sub);margin:0 0 6px">إعدادات الإدخال السريع محفوظة على هذا الجهاز</small>${rows}
    <div class="qk-row"><div><b>التعلّم من اختياراتي بصمت</b><small>يتذكّر تصنيفاتك وأشكالك ويطبّقها لاحقاً (يتزامن بين الأجهزة)</small></div><label class="setup-sw"><input type="checkbox" ${learnOn() ? 'checked' : ''} onchange="learnToggle(this.checked)" aria-label="التعلّم"><i></i></label></div>
    <div class="qk-row"><div><b>ما تعلّمه التطبيق</b><small>${fmtNum(lr)} قاعدة متعلَّمة من اختياراتك · اعرضها واحذف ما لا تريده</small></div><button type="button" class="ln-btn" onclick="learnOpen()">فتح</button></div>
    <div class="sh-danger"><h5>⚠️ منطقة الخطر</h5><p>يمسح كل ما تعلّمه التطبيق من اختياراتك (المواد لا تتأثر).</p><button type="button" class="sh-dbtn" onclick="learnClear()">🗑️ مسح كل التعلّم</button></div>`;
}
function shTaxExtraHtml() {   // أسفل صفحة «الأقسام والتصنيف»: الإدخال السريع والتعلّم
    return `<div class="cat-manager-box sh-show" id="shQkBox"><h4>🧩 الإدخال السريع والتعلّم</h4><p class="set-desc"><i class="set-scope">هذا الجهاز</i> اقتراحات تلقائية تختصر إدخال المواد الجديدة، وتتعلّم من اختياراتك.</p>${shQuickHtml()}</div>`;
}
function shInit() {
    const card = shCard(); if (!card || card.dataset.sh) return; card.dataset.sh = '1';
    card.insertAdjacentHTML('afterbegin', '<div class="sh-grab" aria-hidden="true"></div>');
    const h3 = card.querySelector('h3'); if (h3) { h3.id = 'shTitle'; }
    h3.insertAdjacentHTML('afterend', '<div id="shBar" class="sh-bar" hidden><button type="button" class="sh-back" id="shBack"><i>›</i> الإعدادات</button><b id="shPT"></b></div><div id="shHub"></div><div id="shQuick" class="cat-manager-box sh-quick" hidden></div>');
    document.getElementById('shBack').addEventListener('click', () => { shBuzz(); shHome(true); });
    card.addEventListener('click', e => { const b = e.target.closest('.sh-card'); if (b) { shBuzz(); shOpen(b.dataset.p); return; } const r = e.target.closest('.sh-r'); if (r) { shBuzz(); shOpen(r.dataset.p, r.dataset.b || null); } });
    card.addEventListener('input', e => { if (e.target.id === 'shQ') shSearch(e.target.value); });
    card.classList.add('sh');
}
function shHome(anim) {
    const card = shCard(); if (!card) return; shCur = null;
    card.classList.remove('sh-on');
    shBoxes().forEach(b => b.classList.remove('sh-show'));
    const q = document.getElementById('shQuick'); if (q) q.hidden = true;
    document.getElementById('shBar').hidden = true;
    const t = document.getElementById('shTitle'); if (t) t.textContent = '⚙️ الإعدادات';
    const hub = document.getElementById('shHub'); hub.hidden = false; hub.innerHTML = shHubHtml();
    if (anim) { hub.classList.remove('sh-in-back'); void hub.offsetWidth; hub.classList.add('sh-in-back'); }
    card.scrollTop = 0;
}
// صفوف الجهاز: خيارات التطبيق الأصلي (أندرويد) فقط
function shDeviceRows() {
    const host = document.getElementById('devNativeRows'); if (!host) return;
    const app = !!(window.NAT && NAT.is);
    host.innerHTML = app ? `<div class="qk-row"><div><b>البصمة والتذكيرات</b><small>قفل التطبيق بالبصمة وتذكيرات الدوام والنسخ الاحتياطي.</small></div><button type="button" class="dc-mini" onclick="NAT.openSettings()">فتح</button></div>
        <div class="qk-row"><div><b>الطباعة</b><small>حجم الورق الافتراضي واتجاهه والطابعة الحرارية.</small></div><button type="button" class="dc-mini" onclick="NAT.printSettings()">فتح</button></div>` : '';
}
function shOpen(id, boxKey) {
    if (id === 'invset') { try { initBillSettings(); } catch (e) { /* تجاهل */ } }
    if (id === 'docset') { try { docSetMount(); } catch (e) { /* تجاهل */ } }
    if (id === 'device') { try { shDeviceRows(); } catch (e) { /* تجاهل */ } }
    const card = shCard(), p = SH_PAGES.find(x => x.id === id); if (!card || !p) return;
    if (p.act) { if (typeof window[p.act] === 'function') window[p.act](); return; }
    shInit(); shCur = id; card.classList.add('sh-on');
    document.getElementById('shHub').hidden = true;
    const t = document.getElementById('shTitle'); if (t) t.textContent = '';
    document.getElementById('shBar').hidden = false; document.getElementById('shPT').textContent = p.ico + ' ' + p.t;
    if (typeof setupSettingsAccordion === 'function') setupSettingsAccordion();
    shBoxes().forEach(b => { b.classList.remove('sh-show', 'sh-single'); });
    const q = document.getElementById('shQuick'), hub = document.getElementById('shHub');
    q.hidden = true; q.innerHTML = ''; q.classList.remove('sh-show', 'sh-pg', 'cat-manager-box'); hub.after(q);
    if (p.scan) { q.innerHTML = shScanHtml(); q.hidden = false; q.classList.add('cat-manager-box', 'sh-show'); q.classList.remove('sh-pg'); void q.offsetWidth; q.classList.add('sh-pg'); }
    const els = p.boxes.map(shBox).filter(Boolean);
    let anchor = q; els.forEach(b => { anchor.after(b); anchor = b; });   // ترتيب الصناديق كما هو معرَّف للصفحة
    if (p.quick) { q.innerHTML = shTaxExtraHtml(); if (typeof setupSettingsAccordion === 'function') { const qb = document.getElementById('shQkBox'); if (qb) delete qb.dataset.acc; setupSettingsAccordion(); } q.hidden = false; q.classList.add('sh-show', 'sh-pg'); anchor.after(q); }
    const firstVis = els.find(b => !b.hidden);
    els.forEach(b => { b.classList.add('sh-show'); if (els.length === 1) b.classList.add('sh-single'); b.classList.remove('sh-pg'); void b.offsetWidth; b.classList.add('sh-pg'); if (els.length === 1 || (boxKey ? b.dataset.k === boxKey : b === firstVis)) b.classList.add('open'); });
    const tb = boxKey && shBox(boxKey);
    if (tb) { tb.classList.add('open'); setTimeout(() => { tb.scrollIntoView({ behavior: 'smooth', block: 'start' }); tb.classList.add('sh-flash'); setTimeout(() => tb.classList.remove('sh-flash'), 1600); }, 120); }
    else card.scrollTop = 0;
}
function shSearch(v) {
    const q = shNorm(v).trim(), grid = document.getElementById('shGrid'), res = document.getElementById('shRes');
    if (q.length < 2) { res.hidden = true; grid.hidden = false; return; }
    const out = [];
    SH_PAGES.forEach(p => {
        const pk = shNorm(p.t + ' ' + p.kw);
        if (!p.boxes.length) { if (pk.includes(q)) out.push({ p, b: '', title: p.t }); return; }
        p.boxes.forEach(k => {
            const b = shBox(k); if (!b) return;
            const h = b.querySelector('h4'), title = h ? h.textContent.replace('▾', '').trim() : p.t;
            if (shNorm(b.textContent).includes(q) || pk.includes(q)) out.push({ p, b: k, title });
        });
    });
    grid.hidden = true; res.hidden = false;
    res.innerHTML = out.length ? out.map(r => `<button type="button" class="sh-r" data-p="${r.p.id}" data-b="${r.b}"><span class="sh-ico">${r.p.ico}</span><span class="sh-tx"><b>${r.title}</b><small>${r.p.t}</small></span></button>`).join('') : '<div class="ln-empty">لا يوجد ما يطابق هذا البحث</div>';
}
if (typeof openCategoryManager === 'function') {
    const _oc = openCategoryManager;
    openCategoryManager = function () { _oc.apply(this, arguments); try { shInit(); shHome(false); } catch (e) { /* تجاهل */ } };
    const _os = openSettingsSection;
    openSettingsSection = function (id) { try { shInit(); const b = document.getElementById(id), k = b && b.dataset.k, p = k && SH_PAGES.find(x => x.boxes.includes(k)); if (p) { shOpen(p.id, k); return; } } catch (e) { /* تجاهل */ } return _os(id); };
}

// ===== إشعار صغير مع «تراجع» =====
let shToastT = null;
function shToast(msg, undo) {
    let el = document.getElementById('shToast');
    if (!el) { el = document.createElement('div'); el.id = 'shToast'; el.className = 'sh-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<span>${msg}</span>${undo ? '<button type="button">تراجع</button>' : ''}`;
    if (undo) el.querySelector('button').onclick = () => { clearTimeout(shToastT); el.classList.remove('on'); try { undo(); } catch (e) { /* تجاهل */ } };
    void el.offsetWidth; el.classList.add('on'); clearTimeout(shToastT); shToastT = setTimeout(() => el.classList.remove('on'), 4200);
}
function shSilent(fn) { const o = Swal.fire; Swal.fire = function (a) { if (a && a.toast) return Promise.resolve({}); return o.apply(this, arguments); }; try { return fn(); } finally { Swal.fire = o; } }
// ===== حفظ تلقائي للقيم الرقمية =====
const SH_AUTO = {
    lowThresholdInput: { ids: ['lowThresholdInput'], ok: v => Number.isInteger(+v[0]) && v[0] !== '' && +v[0] >= 0, save: () => saveLowThreshold(), get: () => [String(lowStockThreshold)] },
    alertM: { ids: ['alertM1', 'alertM2', 'alertM3'], ok: v => v.every(x => x !== '' && +x >= 1) && +v[0] < +v[1] && +v[1] < +v[2], save: () => saveAlertMonths(), get: () => alertMonths.map(String) },
    puWindowInput: { ids: ['puWindowInput'], ok: v => v[0] !== '' && +v[0] >= 1 && +v[0] <= 60, save: () => savePuWindow(), get: () => [String(typeof puWindowMonths === 'function' ? puWindowMonths() : '')] }
};
function shAutoBind() {
    const card = shCard(); if (!card || card.dataset.shA) return; card.dataset.shA = '1';
    card.addEventListener('change', e => {
        const id = e.target && e.target.id; if (!id) return;
        const g = Object.values(SH_AUTO).find(x => x.ids.includes(id)); if (!g) return;
        const vals = g.ids.map(i => document.getElementById(i).value);
        g.ids.forEach(i => document.getElementById(i).classList.remove('sh-bad'));
        if (!g.ok(vals)) { if (g.ids.every(i => document.getElementById(i).value !== '')) g.ids.forEach(i => document.getElementById(i).classList.add('sh-bad')); return; }
        const before = g.prev || g.get(); const prevVals = before.slice();
        shSilent(g.save);
        const now = g.get(); g.prev = now.slice();
        shToast('تم الحفظ ✓', () => { g.ids.forEach((i, k) => { const el = document.getElementById(i); if (el) el.value = prevVals[k]; }); shSilent(g.save); g.prev = g.get(); shToast('تم التراجع'); });
    });
    Object.values(SH_AUTO).forEach(g => { g.prev = null; });
}
{ const _si = shInit; shInit = function () { _si(); shAutoBind(); }; }
{ const _so = shOpen; shOpen = function () { Object.values(SH_AUTO).forEach(g => { try { g.prev = g.get(); } catch (e) { g.prev = null; } }); return _so.apply(this, arguments); }; }
// حفظ تلقائي لإعدادات التسعير (بدون إعادة تسعير المواد) وإعدادات الذكاء الصناعي
{
    let pT = null, aT = null;
    document.addEventListener('change', e => {
        const t = e.target, id = t && t.id || '';
        if (/^pc(Rate|BookNo|BookDate|Round|Boundary|Max\d+|Pct\d+)$/.test(id) && t.closest('#pricingBox')) {
            clearTimeout(pT); pT = setTimeout(async () => { const ok = await savePricingSettings(true); t.classList.toggle('sh-bad', ok === false); if (ok) shToast('تم الحفظ ✓ — لتغيير أسعار المواد اضغط «تطبيق الأسعار على المواد»'); }, 250);
        } else if (t && t.closest && t.closest('#aiSettingsBox') && /^(INPUT|SELECT)$/.test(t.tagName) && t.id !== 'aiEngineSelect' && !/Pick$/.test(t.id)) {
            clearTimeout(aT); aT = setTimeout(() => { if (saveAiSettings(true)) shToast('تم الحفظ ✓'); }, 400);
        }
    });
}
// مفاتيح الإدخال السريع والتعلّم: حفظ فوري + تراجع
if (typeof qkSet === 'function') { const _q = qkSet; qkSet = function (k, v) { _q(k, v); shToast('تم الحفظ ✓', () => { _q(k, !v); if (shCur === 'tax') shOpen('tax'); shToast('تم التراجع'); }); }; }
if (typeof learnToggle === 'function') { const _l = learnToggle; learnToggle = function (v) { _l(v); shToast('تم الحفظ ✓', () => { _l(!v); if (shCur === 'tax') shOpen('tax'); shToast('تم التراجع'); }); }; }
// ===== منطقة الخطر =====
async function shRestore() {
    const r = await Swal.fire({ icon: 'warning', title: 'استرجاع من نسخة احتياطية', html: '<div style="text-align:right;font-size:.88rem;line-height:1.9">الاسترجاع يدمج النسخة مع بياناتك الحالية ويرفعها للسحابة.<br><b>يُنصح بأخذ نسخة كاملة قبله.</b><br>اكتب كلمة <b>استرجاع</b> للمتابعة:</div>', input: 'text', inputPlaceholder: 'استرجاع', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'متابعة', cancelButtonText: 'رجوع', preConfirm: v => (String(v || '').trim() === 'استرجاع') || (Swal.showValidationMessage('اكتب الكلمة بالضبط'), false) });
    if (r.isConfirmed) { const f = document.getElementById('restoreInput'); if (f) f.click(); }
}
function shDangerInit() {
    const lab = document.querySelector('#catModal label[for="restoreInput"]'); if (!lab || document.getElementById('shDangerBk')) return;
    const box = lab.closest('.cat-manager-box'), host = box && (box.querySelector('.cmb-body') || box);
    lab.remove();
    host.insertAdjacentHTML('beforeend', '<div class="sh-danger" id="shDangerBk"><h5>⚠️ منطقة الخطر</h5><p>إجراءات تغيّر بياناتك الحالية وتحتاج إلى تأكيد.</p><button type="button" class="sh-dbtn" onclick="shRestore()">♻️ استرجاع من نسخة احتياطية</button></div>');
}
{ const _si2 = shInit; shInit = function () { _si2(); shDangerInit(); shBoxes().forEach(b => { const sp = b.querySelector('.cmb-head span'); if (sp) sp.innerHTML = sp.innerHTML.replace(/^\s*\d+\.\s*/, ''); }); }; }

// الشاشات الكاملة (مركز تجهيز البيانات، مراجعة التصنيف) تُفتح داخل نافذة الإعدادات إن فُتحت منها، وإلا تبقى فوق الصفحة
function shMountHub(el) {
    const cm = document.getElementById('catModal'), card = shCard();
    if (card && cm && cm.style.display && cm.style.display !== 'none') { if (el.parentNode !== card) card.appendChild(el); el.classList.add('in-settings'); card.scrollTop = 0; card.classList.add('sh-subopen'); }
    else { if (el.parentNode !== document.body) document.body.appendChild(el); el.classList.remove('in-settings'); }
}
function shUnmountHub(el) {
    if (!el) return;
    const card = shCard(); el.style.display = 'none';
    if (card && !card.querySelector('.tax-rv.in-settings[style*="flex"]')) card.classList.remove('sh-subopen');
}

// ترويسة الشاشات المفتوحة داخل الإعدادات: نفس شريط الإعدادات (زر رجوع + عنوان) بدل الشريط الداكن وزر الإغلاق
function shHubHead(el, back, label) {
    if (!el || !el.classList.contains('in-settings')) return;
    const head = el.querySelector(':scope > .tr-head'); if (!head) return;
    const b = head.querySelector('b'), title = b ? b.innerHTML : '';
    head.className = 'sh-bar sh-bar-in';
    head.innerHTML = `<button type="button" class="sh-back" onclick="${back}"><i>›</i> ${label}</button><b>${title}</b>`;
}

// صلاحيات تظهر/تخفي أزرار حسب الدور: زر الملصقات في المخزن، وتقارير النظام للمالك فقط
setInterval(() => { try { document.body.classList.toggle('can-stockedit', can('stockEdit')); const r = document.getElementById('repSys'); if (r) r.hidden = userRole !== 'owner'; } catch (e) { /* تجاهل */ } }, 1000);
