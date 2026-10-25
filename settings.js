// =====================================================================
// واجهة الإعدادات: صفحة رئيسية ببطاقات + صفحات منفصلة لكل موضوع + بحث داخل الإعدادات + ملخص حالة لكل بطاقة.
// ما تغيّر محتوى الإعدادات القديمة، بس ترتّبه (تعرض صناديق كل صفحة وتخفي الباقي).
// =====================================================================
const SH_PAGES = [
    { id: 'tax', ico: '🗂️', t: 'الأقسام والتصنيفات', boxes: [0, 1, 2], kw: 'قسم اقسام تصنيف تصنيفات فرعية جاهزة مراجعة الأقسام الرئيسية departments categories' },
    { id: 'tabs', ico: '🔔', t: 'التبويبات والتنبيهات', boxes: [3, 4], kw: 'تبويب تبويبات الشريط السفلي تنبيه تنبيهات نقص كمية صلاحية انتهاء أدوات الصيدلي alerts tabs' },
    { id: 'price', ico: '💰', t: 'التسعير', boxes: [5], kw: 'سعر تسعير نقابة صرف دولار دينار نسبة ربح pricing' },
    { id: 'quick', ico: '🧩', t: 'الإدخال السريع والتعلّم', boxes: [], kw: 'ادخال سريع تعلم قواعدي تلقائي شكل دوائي تصنيف تلقائي quick learn' },
    { id: 'backup', ico: '💾', t: 'النسخ الاحتياطي', boxes: [6], kw: 'نسخ نسخة احتياطي استرجاع استعادة تصدير backup restore' },
    { id: 'tools', ico: '🛠️', t: 'أدوات سريعة', boxes: [7], kw: 'أدوات جرد طباعة سريعة tools inventory' },
    { id: 'sec', ico: '🔐', t: 'الأمان والسجلات', boxes: [8], kw: 'أمان سجل سجلات بصمة كلمة سر باسورد حماية security log' },
    { id: 'ai', ico: '🤖', t: 'الذكاء الصناعي', boxes: [9], kw: 'ذكاء صناعي مسح عبوة gemini ocr مفتاح ai' }
];
let shCur = null;
const shNorm = s => String(s || '').toLowerCase().replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
function shBoxes() { return [...document.querySelectorAll('#catModal .cat-manager-box:not(#shQuick)')]; }
function shCard() { return document.querySelector('#catModal .modal-card'); }
function shBuzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* تجاهل */ } }
function shSummary(p) {
    try {
        if (p.id === 'tax') { const n = (typeof taxSeeded === 'function' && taxSeeded()) ? taxMissingSubs().length + taxPendingRenames().length : 0; return { s: `${fmtNum(departments.length)} قسم · ${fmtNum(subCategories.length)} تصنيف`, badge: n ? fmtNum(n) + ' جديد' : '' }; }
        if (p.id === 'tabs') return { s: `حد النقص ${fmtNum(lowStockThreshold)} · الصلاحية ${alertMonths.join('/')} أشهر` };
        if (p.id === 'price') return { s: `سعر الصرف ${fmtNum(pricingCfg.rate)}` };
        if (p.id === 'quick') { const c = qkCfg(), on = ['form', 'dept', 'like'].filter(k => c[k]).length, r = typeof learnRules === 'function' ? learnRules().length : 0; return { s: `الإدخال ${on}/3 · التعلّم ${learnOn() ? 'شغّال' : 'متوقف'}${r ? ' · ' + fmtNum(r) + ' قاعدة' : ''}` }; }
        if (p.id === 'backup') return { s: 'نسخ واسترجاع وتصدير' };
        if (p.id === 'tools') return { s: 'جرد وأدوات الصيدلي' };
        if (p.id === 'sec') return { s: 'الدخول والسجلات' };
        if (p.id === 'ai') return { s: 'مسح العبوة بالذكاء' };
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
    <div class="qk-row"><div><b>قواعدي</b><small>${fmtNum(lr)} قاعدة كلمات · شوفها واحذف اللي ما تريده</small></div><button type="button" class="ln-btn" onclick="learnOpen()">فتح</button></div>`;
}
function shInit() {
    const card = shCard(); if (!card || card.dataset.sh) return; card.dataset.sh = '1';
    const h3 = card.querySelector('h3'); if (h3) { h3.id = 'shTitle'; }
    h3.insertAdjacentHTML('afterend', '<div id="shBar" class="sh-bar" hidden><button type="button" class="sh-back" id="shBack"><i>›</i> الإعدادات</button><b id="shPT"></b></div><div id="shHub"></div><div id="shQuick" class="cat-manager-box sh-quick" hidden></div>');
    document.getElementById('shBack').addEventListener('click', () => { shBuzz(); shHome(true); });
    card.addEventListener('click', e => { const b = e.target.closest('.sh-card'); if (b) { shBuzz(); shOpen(b.dataset.p); } const r = e.target.closest('.sh-r'); if (r) { shBuzz(); shOpen(r.dataset.p, r.dataset.b === '' ? null : +r.dataset.b); } });
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
function shOpen(id, boxIdx) {
    const card = shCard(), p = SH_PAGES.find(x => x.id === id); if (!card || !p) return;
    shInit(); shCur = id; card.classList.add('sh-on');
    document.getElementById('shHub').hidden = true;
    const t = document.getElementById('shTitle'); if (t) t.textContent = '';
    document.getElementById('shBar').hidden = false; document.getElementById('shPT').textContent = p.ico + ' ' + p.t;
    if (typeof setupSettingsAccordion === 'function') setupSettingsAccordion();
    const all = shBoxes(), q = document.getElementById('shQuick');
    all.forEach(b => b.classList.remove('sh-show'));
    if (id === 'quick') { q.innerHTML = shQuickHtml(); q.hidden = false; q.classList.add('sh-show'); q.classList.remove('sh-pg'); void q.offsetWidth; q.classList.add('sh-pg'); }
    else {
        q.hidden = true;
        p.boxes.forEach((i, k) => { const b = all[i]; if (!b) return; b.classList.add('sh-show'); b.classList.remove('sh-pg'); void b.offsetWidth; b.classList.add('sh-pg'); if (p.boxes.length === 1 || (boxIdx != null ? i === boxIdx : k === (id === 'tax' ? 99 : 0))) b.classList.add('open'); });
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
    res.innerHTML = out.length ? out.map(r => `<button type="button" class="sh-r" data-p="${r.p.id}" data-b="${r.b == null ? '' : r.b}"><span class="sh-ico">${r.p.ico}</span><span class="sh-tx"><b>${r.title}</b><small>${r.p.t}</small></span></button>`).join('') : '<div class="ln-empty">ما لقيت شي بهذا الاسم</div>';
}
if (typeof openCategoryManager === 'function') {
    const _oc = openCategoryManager;
    openCategoryManager = function () { _oc.apply(this, arguments); try { shInit(); shHome(false); } catch (e) { /* تجاهل */ } };
    const _os = openSettingsSection;
    openSettingsSection = function (id) { try { shInit(); const all = shBoxes(), b = document.getElementById(id), i = all.indexOf(b), p = SH_PAGES.find(x => x.boxes.includes(i)); if (p) { shOpen(p.id, i); return; } } catch (e) { /* تجاهل */ } return _os(id); };
}
