// =====================================================================
// واجهة الإعدادات: صفحة رئيسية ببطاقات + صفحات منفصلة لكل موضوع + بحث داخل الإعدادات + ملخص حالة لكل بطاقة.
// ما تغيّر محتوى الإعدادات القديمة، بس ترتّبه (تعرض صناديق كل صفحة وتخفي الباقي).
// =====================================================================
const SH_PAGES = [
    { id: 'hub', ico: '🧰', t: 'مركز تجهيز البيانات', boxes: [], act: 'dhOpen', kw: 'تجهيز بيانات مادة فعالة تصنيف مكرر نواقص قواعد اكتمال data hub ingredient' },
    { id: 'catalog', ico: '📋', t: 'سجل الأدوية', boxes: [], act: 'openCatalog', kw: 'سجل ادوية كتالوج دليل مواد catalog' },
    { id: 'tax', ico: '🗂️', t: 'الأقسام والتصنيفات', boxes: [0, 1, 2], kw: 'قسم اقسام تصنيف تصنيفات فرعية جاهزة مراجعة الأقسام الرئيسية departments categories' },
    { id: 'price', ico: '💰', t: 'التسعير', boxes: [5], kw: 'سعر تسعير نقابة صرف دولار دينار نسبة ربح فصل سعر الشراء كلفة pricing' },
    { id: 'tabs', ico: '🔔', t: 'التبويبات والتنبيهات', boxes: [3, 4], kw: 'تبويب تبويبات الشريط السفلي تنبيه تنبيهات نقص كمية صلاحية انتهاء مدة نفاذ alerts tabs' },
    { id: 'quick', ico: '🧩', t: 'الإدخال السريع والتعلّم', boxes: [], kw: 'ادخال سريع تعلم قواعدي تلقائي شكل دوائي تصنيف تلقائي quick learn' },
    { id: 'scanner', ico: '🔎', t: 'فاحص المادة', boxes: [], kw: 'فاحص المادة مسح باركود سعر خصم حد الخصم اكسباير نفاذ هامش ربح scanner discount' },
    { id: 'sec', ico: '🔐', t: 'الحسابات والأمان', boxes: [8], kw: 'مستخدم مستخدمين صلاحيات حساب بصمة كلمة سر باسورد حماية أمان سجل اجراءات تعديلات سلة محذوفات استعادة نسخ سحابية users permissions security log trash' },
    { id: 'sys', ico: '⚙️', t: 'النظام والأدوات', boxes: [6, 7, 9], kw: 'نسخ احتياطي استرجاع تصدير جرد تثبيت التطبيق تحديث المواد من الوارد إكمال مواد فعالة بحث فاشل ذكاء صناعي مسح عبوة gemini ocr backup restore tools ai' }
];
let shCur = null;
const shNorm = s => String(s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
function shBoxes() { return [...document.querySelectorAll('#catModal .cat-manager-box:not(#shQuick)')]; }
function shCard() { return document.querySelector('#catModal .modal-card'); }
function shBuzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* تجاهل */ } }
function shSummary(p) {
    try {
        if (p.id === 'tax') { const n = (typeof taxSeeded === 'function' && taxSeeded()) ? taxMissingSubs().length + taxPendingRenames().length + taxPendingMoves().length : 0; return { s: `${fmtNum(departments.length)} قسم · ${fmtNum(subCategories.length)} تصنيف`, badge: n ? fmtNum(n) + ' جديد' : '' }; }
        if (p.id === 'hub') return { s: 'المواد الفعالة والتصنيف والنواقص' };
        if (p.id === 'doctor') { const n = (typeof docData !== 'undefined' && docData) ? Object.keys(docData.items).length : 0; return { s: n ? fmtNum(n) + ' مادة معروضة للأطباء' : 'اختر المواد وحالاتها للأطباء' }; }
        if (p.id === 'rx') { const n = (typeof rxNewN === 'function') ? rxNewN() : 0; return { s: n ? fmtNum(n) + ' وصفة جديدة' : 'وصفات الأطباء وحالات التجهيز' }; }
        if (p.id === 'catalog') return { s: 'دليل المواد الدوائية' };
        if (p.id === 'hub') return { s: 'المواد الفعالة والتصنيف والنواقص' };
        if (p.id === 'tabs') return { s: `حد النقص ${fmtNum(lowStockThreshold)} · الصلاحية ${alertMonths.join('/')} أشهر` };
        if (p.id === 'price') return { s: `سعر الصرف ${fmtNum(pricingCfg.rate)}` };
        if (p.id === 'quick') { const c = qkCfg(), on = ['form', 'dept', 'like'].filter(k => c[k]).length, r = typeof learnRules === 'function' ? learnRules().length : 0; return { s: `الإدخال ${on}/3 · التعلّم ${learnOn() ? 'مفعّل' : 'متوقف'}${r ? ' · ' + fmtNum(r) + ' قاعدة' : ''}` }; }
        if (p.id === 'scanner') { const c = typeof scCfg === 'function' ? scCfg() : null; return { s: c ? (c.on ? 'مشغّل · ' : 'متوقف · ') + (c.mode === 'safe' ? 'خصم محمي' : 'خصم كامل') : '' }; }
        if (p.id === 'sec') return { s: 'المستخدمون · السجل · السلة' };
        if (p.id === 'sys') return { s: 'النسخ الاحتياطي · الجرد · الذكاء' };
    } catch (e) { /* تجاهل */ }
    return { s: '' };
}
const SH_FAV_LS = 'diwanShFav', SH_FAV_MAX = 8;
// مفتاح الأداة = نص onclick للزر (ثابت). المفضلة تقبل بطاقات (معرّف الصفحة) وأدوات (t:المفتاح)
function shToolKey(b) { return 't:' + (b.getAttribute('onclick') || '').replace(/\s+/g, ' ').trim(); }
function shToolBtns() { return [...document.querySelectorAll('#catModal .tools-grid > button.icon-btn')]; }
function shToolByKey(k) { return shToolBtns().find(b => shToolKey(b) === k); }
function shToolLabel(b) { const c = b.cloneNode(true); c.querySelectorAll('.sh-star').forEach(x => x.remove()); return c.textContent.trim(); }
function shFav() { try { const a = JSON.parse(localStorage.getItem(SH_FAV_LS)); return Array.isArray(a) ? a.filter(id => id.startsWith('t:') ? !!shToolByKey(id) : SH_PAGES.some(p => p.id === id)).slice(0, SH_FAV_MAX) : []; } catch (e) { return []; } }
function shFavToggle(id) {
    let a = shFav();
    if (a.includes(id)) a = a.filter(x => x !== id);
    else { if (a.length >= SH_FAV_MAX) { shToast('أقصى حد ' + SH_FAV_MAX + ' مفضّلات'); return; } a.push(id); }
    try { localStorage.setItem(SH_FAV_LS, JSON.stringify(a)); } catch (e) { /* تجاهل */ }
    if (shCur) { shStarSync(); return; }
    const sc = shCard() ? shCard().scrollTop : 0; shHome(false); if (shCard()) shCard().scrollTop = sc;
}
// نجمة على كل أداة داخل الصفحات (تُلتقط بمرحلة capture حتى لا ينفّذ الزر أمرَه)
function shStarSync() { const f = shFav(); shToolBtns().forEach(b => { const st = b.querySelector('.sh-star'); if (!st) return; const on = f.includes(shToolKey(b)); st.classList.toggle('on', on); st.innerHTML = SH_STAR(on); }); }
function shDecorate() {
    shToolBtns().forEach(b => { if (b.querySelector('.sh-star')) return; const st = document.createElement('i'); st.className = 'sh-star sh-tstar'; st.dataset.star = shToolKey(b); st.setAttribute('role', 'button'); st.setAttribute('aria-label', 'تثبيت في المفضلة'); b.appendChild(st); });
    shStarSync();
}
const SH_STAR = on => `<svg viewBox="0 0 24 24" width="16" height="16" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>`;
function shHubHtml() {
    const fav = shFav();
    const chip = id => { if (id.startsWith('t:')) { const b = shToolByKey(id), lab = shToolLabel(b), m = lab.match(/^(\S+)\s+(.*)$/); return `<button type="button" class="sh-chip" data-t="${id.replace(/"/g, '&quot;')}"><span class="sh-ico">${m ? m[1] : '⭐'}</span>${m ? m[2] : lab}</button>`; } const p = SH_PAGES.find(x => x.id === id); return `<button type="button" class="sh-chip" data-p="${p.id}"><span class="sh-ico">${p.ico}</span>${p.t}</button>`; };
    const favRow = fav.length ? `<div class="sh-fav"><span class="sh-fav-t">${SH_STAR(true)} المفضلة</span>${fav.map(chip).join('')}</div>` : '';
    return favRow + `<div class="sh-search"><input type="search" id="shQ" placeholder="ابحث في الإعدادات…" autocomplete="off" aria-label="بحث في الإعدادات"></div>
    <div class="sh-grid" id="shGrid">${SH_PAGES.map(p => { const m = shSummary(p); return `<button type="button" class="sh-card" data-p="${p.id}"><span class="sh-ico">${p.ico}</span><span class="sh-tx"><b>${p.t}</b><small>${m.s}</small></span>${m.badge ? `<em class="sh-badge">${m.badge}</em>` : ''}<i class="sh-star ${shFav().includes(p.id) ? 'on' : ''}" data-star="${p.id}" role="button" aria-label="تثبيت في المفضلة">${SH_STAR(shFav().includes(p.id))}</i></button>`; }).join('')}</div>
    <div class="sh-res" id="shRes" hidden></div>`;
}
function shQuickHtml() {
    const c = qkCfg(), rows = Object.keys(QK_LABELS).map(k => `<div class="qk-row"><div><b>${QK_LABELS[k][0]}</b><small>${QK_LABELS[k][1]}</small></div><label class="setup-sw"><input type="checkbox" ${c[k] ? 'checked' : ''} onchange="qkSet('${k}', this.checked)" aria-label="${QK_LABELS[k][0]}"><i></i></label></div>`).join('');
    const lr = typeof learnRules === 'function' ? learnRules().length : 0;
    return `<small style="display:block;color:var(--text-sub);margin:0 0 6px">إعدادات الإدخال السريع محفوظة على هذا الجهاز</small>${rows}
    <div class="qk-row"><div><b>التعلّم من اختياراتي بصمت</b><small>يتذكّر تصنيفاتك وأشكالك ويطبّقها لاحقاً (يتزامن بين الأجهزة)</small></div><label class="setup-sw"><input type="checkbox" ${learnOn() ? 'checked' : ''} onchange="learnToggle(this.checked)" aria-label="التعلّم"><i></i></label></div>
    <div class="qk-row"><div><b>قواعدي</b><small>${fmtNum(lr)} قاعدة كلمات · اعرضها واحذف ما لا تريده</small></div><button type="button" class="ln-btn" onclick="learnOpen()">فتح</button></div>
    <div class="sh-danger"><h5>⚠️ منطقة الخطر</h5><p>يمسح كل ما تعلّمه التطبيق من اختياراتك (المواد لا تتأثر).</p><button type="button" class="sh-dbtn" onclick="learnClear()">🗑️ مسح كل التعلّم</button></div>`;
}
function shInit() {
    const card = shCard(); if (!card || card.dataset.sh) return; card.dataset.sh = '1';
    card.insertAdjacentHTML('afterbegin', '<div class="sh-grab" aria-hidden="true"></div>');
    const h3 = card.querySelector('h3'); if (h3) { h3.id = 'shTitle'; }
    h3.insertAdjacentHTML('afterend', '<div id="shBar" class="sh-bar" hidden><button type="button" class="sh-back" id="shBack"><i>›</i> الإعدادات</button><b id="shPT"></b></div><div id="shHub"></div><div id="shQuick" class="cat-manager-box sh-quick" hidden></div>');
    document.getElementById('shBack').addEventListener('click', () => { shBuzz(); shHome(true); });
    card.addEventListener('click', e => { const tc = e.target.closest('.sh-chip[data-t]'); if (tc) { shBuzz(); const b = shToolByKey(tc.dataset.t); if (b) b.click(); return; } const st = e.target.closest('.sh-star'); if (st) { e.stopPropagation(); shBuzz(); shFavToggle(st.dataset.star); return; } const ch = e.target.closest('.sh-chip'); if (ch) { shBuzz(); shOpen(ch.dataset.p); return; } const b = e.target.closest('.sh-card'); if (b) { shBuzz(); shOpen(b.dataset.p); } const r = e.target.closest('.sh-r'); if (r) { shBuzz(); shOpen(r.dataset.p, r.dataset.b === '' ? null : +r.dataset.b); } });
    card.addEventListener('input', e => { if (e.target.id === 'shQ') shSearch(e.target.value); });
    card.addEventListener('click', e => { const st = e.target.closest('.sh-tstar'); if (st) { e.stopPropagation(); e.preventDefault(); shBuzz(); shFavToggle(st.dataset.star); } }, true);
    shDecorate();
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
function shOpen(id, boxIdx) {
    const card = shCard(), p = SH_PAGES.find(x => x.id === id); if (!card || !p) return;
    if (p.act) { if (typeof window[p.act] === 'function') window[p.act](); return; }   // بطاقات تفتح نافذتها مباشرة
    shInit(); shCur = id; card.classList.add('sh-on');
    document.getElementById('shHub').hidden = true;
    const t = document.getElementById('shTitle'); if (t) t.textContent = '';
    document.getElementById('shBar').hidden = false; document.getElementById('shPT').textContent = p.ico + ' ' + p.t;
    if (typeof setupSettingsAccordion === 'function') setupSettingsAccordion();
    const all = shBoxes(), q = document.getElementById('shQuick');
    all.forEach(b => { b.classList.remove('sh-show', 'sh-single'); });
    if (id === 'quick' || id === 'scanner') { q.innerHTML = id === 'quick' ? shQuickHtml() : shScanHtml(); q.hidden = false; q.classList.add('sh-show'); q.classList.remove('sh-pg'); void q.offsetWidth; q.classList.add('sh-pg'); }
    else {
        q.hidden = true;
        p.boxes.forEach((i, k) => { const b = all[i]; if (!b) return; b.classList.add('sh-show'); if (p.boxes.length === 1) b.classList.add('sh-single'); b.classList.remove('sh-pg'); void b.offsetWidth; b.classList.add('sh-pg'); if (p.boxes.length === 1 || (boxIdx != null ? i === boxIdx : k === (id === 'tax' ? 99 : 0))) b.classList.add('open'); });
        if (boxIdx != null && all[boxIdx]) { const b = all[boxIdx]; b.classList.add('open'); setTimeout(() => { b.scrollIntoView({ behavior: 'smooth', block: 'start' }); b.classList.add('sh-flash'); setTimeout(() => b.classList.remove('sh-flash'), 1600); }, 120); }
        else card.scrollTop = 0;
    }
}
function shSearch(v) {
    const q = shNorm(v).trim(), grid = document.getElementById('shGrid'), res = document.getElementById('shRes');
    if (q.length < 2) { res.hidden = true; grid.hidden = false; return; }
    const all = shBoxes(), out = [];
    SH_PAGES.forEach(p => {
        const pk = shNorm(p.t + ' ' + p.kw);
        if (p.boxes.length === 0) { if (pk.includes(q)) out.push({ p, b: null, title: p.t }); return; }
        p.boxes.forEach(i => {
            const b = all[i]; if (!b) return;
            const h = b.querySelector('h4'), title = h ? h.textContent.replace(/^\s*\d+\.\s*/, '').replace('▾', '').trim() : p.t;
            if (shNorm(b.textContent).includes(q) || pk.includes(q)) out.push({ p, b: i, title });
        });
    });
    grid.hidden = true; res.hidden = false;
    res.innerHTML = out.length ? out.map(r => `<button type="button" class="sh-r" data-p="${r.p.id}" data-b="${r.b == null ? '' : r.b}"><span class="sh-ico">${r.p.ico}</span><span class="sh-tx"><b>${r.title}</b><small>${r.p.t}</small></span></button>`).join('') : '<div class="ln-empty">لا يوجد ما يطابق هذا الاسم</div>';
}
if (typeof openCategoryManager === 'function') {
    const _oc = openCategoryManager;
    openCategoryManager = function () { _oc.apply(this, arguments); try { shInit(); shHome(false); } catch (e) { /* تجاهل */ } };
    const _os = openSettingsSection;
    openSettingsSection = function (id) { try { shInit(); const all = shBoxes(), b = document.getElementById(id), i = all.indexOf(b), p = SH_PAGES.find(x => x.boxes.includes(i)); if (p) { shOpen(p.id, i); return; } } catch (e) { /* تجاهل */ } return _os(id); };
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
// مفاتيح الإدخال السريع والتعلّم: حفظ فوري + تراجع
if (typeof qkSet === 'function') { const _q = qkSet; qkSet = function (k, v) { _q(k, v); shToast('تم الحفظ ✓', () => { _q(k, !v); if (shCur === 'quick') shOpen('quick'); shToast('تم التراجع'); }); }; }
if (typeof learnToggle === 'function') { const _l = learnToggle; learnToggle = function (v) { _l(v); shToast('تم الحفظ ✓', () => { _l(!v); if (shCur === 'quick') shOpen('quick'); shToast('تم التراجع'); }); }; }
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
