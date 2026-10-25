// =====================================================================
// قوائم قابلة للبحث: الشكل الدوائي والقسم والتصنيف في نافذة الصنف. اكتب جزء من الاسم (عربي/إنكليزي) فتتصفّى القائمة فوراً.
// القائمة الأصلية (select) تبقى موجودة ومخفية، فكل الكود القديم يشتغل كما هو؛ نكتفي بتغيير القيمة وإطلاق حدث change.
// =====================================================================
const SS_IDS = ['fForm', 'fDepartment', 'fCategory'];
const ssNorm = s => String(s || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const ssEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function ssTxt(sel) { const o = sel.options[sel.selectedIndex]; return o ? o.textContent.trim() : ''; }
function ssSync(sel) {
    const b = document.querySelector(`.ss-btn[data-for="${sel.id}"]`); if (!b) return;
    const t = ssTxt(sel), empty = !sel.value; b.dataset.v = sel.value + '|' + sel.options.length;
    b.querySelector('.ss-t').textContent = empty && !t ? 'اختر…' : (t || 'اختر…'); b.classList.toggle('ss-empty', empty);
    b.disabled = sel.disabled;
}
function ssInit() {
    SS_IDS.forEach(id => {
        const sel = document.getElementById(id); if (!sel || sel.dataset.ss) return; sel.dataset.ss = '1';
        sel.classList.add('ss-native'); sel.tabIndex = -1;
        sel.insertAdjacentHTML('afterend', `<button type="button" class="ss-btn" data-for="${id}" aria-haspopup="listbox"><span class="ss-t"></span><i>▾</i></button>`);
        const b = sel.nextElementSibling; b.addEventListener('click', () => ssOpen(sel));
        sel.addEventListener('change', () => ssSync(sel)); ssSync(sel);
        const lab = sel.closest('.form-group') && sel.closest('.form-group').querySelector('label'); if (lab) lab.addEventListener('click', e => { e.preventDefault(); ssOpen(sel); });
    });
}
setInterval(() => { SS_IDS.forEach(id => { const sel = document.getElementById(id), b = sel && document.querySelector(`.ss-btn[data-for="${id}"]`); if (sel && b && b.dataset.v !== sel.value + '|' + sel.options.length) ssSync(sel); }); }, 350);   // يلتقط التغيير البرمجي (التعبئة التلقائية)
function ssItems(sel) {
    const out = []; let grp = '';
    [...sel.children].forEach(ch => {
        if (ch.tagName === 'OPTGROUP') { [...ch.children].forEach(o => out.push({ v: o.value, t: o.textContent.trim(), g: ch.label || '' })); }
        else if (ch.tagName === 'OPTION') out.push({ v: ch.value, t: ch.textContent.trim(), g: '' });
    });
    return out;
}
let ssCur = null;
const SS_PAL = [['#2563eb', 'rgba(37,99,235,.13)'], ['#0d9488', 'rgba(13,148,136,.13)'], ['#7c3aed', 'rgba(124,58,237,.13)'], ['#ea580c', 'rgba(234,88,12,.13)'], ['#db2777', 'rgba(219,39,119,.13)'], ['#16a34a', 'rgba(22,163,74,.13)'], ['#ca8a04', 'rgba(202,138,4,.15)'], ['#475569', 'rgba(71,85,105,.14)']];
function ssOpen(sel) {
    if (sel.disabled) return;
    ssClose(); ssCur = sel;
    const items = ssItems(sel), lab = sel.closest('.form-group') && sel.closest('.form-group').querySelector('label');
    const title = lab ? lab.textContent.replace(/\(.*?\)/g, '').replace(/[:：]\s*$/, '').trim() : 'اختر';
    const el = document.createElement('div'); el.className = 'ss-ov'; el.id = 'ssOv';
    el.innerHTML = `<div class="ss-bd"></div><div class="ss-sheet" role="dialog" aria-label="${ssEsc(title)}"><div class="ss-hd"><b>${ssEsc(title)}</b><button type="button" class="ss-x" aria-label="إغلاق">✕</button></div><div class="ss-sr"><input type="text" inputmode="search" id="ssQ" placeholder="ابحث…" autocomplete="off" enterkeyhint="done"><span id="ssN"></span></div><div class="ss-list" id="ssList" role="listbox"></div></div>`;
    document.body.appendChild(el); document.body.classList.add('ss-lock');
    const list = el.querySelector('#ssList'), q = el.querySelector('#ssQ'), cnt = el.querySelector('#ssN');
    const render = () => {
        const toks = ssNorm(q.value).split(' ').filter(Boolean);
        const rows = items.filter(i => { const h = ssNorm(i.t + ' ' + i.g); return toks.every(t => h.includes(t)); });
        let html = '', last = null, open = false;
        const gi = {}; items.forEach(i => { if (i.g && !(i.g in gi)) gi[i.g] = Object.keys(gi).length; });
        rows.forEach(i => {
            if (i.g !== last) {
                if (open) { html += '</div>'; open = false; }
                last = i.g;
                if (i.g) { const c = SS_PAL[gi[i.g] % SS_PAL.length]; html += `<div class="ss-grp" style="--gc:${c[0]};--gt:${c[1]}"><div class="ss-gh"><span class="ss-dot"></span>${ssEsc(i.g)}</div>`; open = true; }
            }
            html += `<button type="button" class="ss-row${i.v === sel.value ? ' on' : ''}" role="option" data-v="${ssEsc(i.v)}"><span>${ssEsc(i.t || '— بدون —')}</span>${i.v === sel.value ? '<i>✓</i>' : ''}</button>`;
        });
        if (open) html += '</div>';
        list.innerHTML = html || '<div class="ss-none">ما لقيت شي بهذا الاسم</div>';
        cnt.textContent = toks.length ? rows.length + ' نتيجة' : '';
    };
    render();
    q.addEventListener('input', render);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const f = list.querySelector('.ss-row'); if (f && q.value.trim()) f.click(); else q.blur(); } });
    list.addEventListener('click', e => { const r = e.target.closest('.ss-row'); if (!r) return; ssPick(sel, r.dataset.v); });
    el.querySelector('.ss-bd').addEventListener('click', ssClose); el.querySelector('.ss-x').addEventListener('click', ssClose);
    const on = list.querySelector('.ss-row.on'); if (on) setTimeout(() => on.scrollIntoView({ block: 'center' }), 30);
    requestAnimationFrame(() => el.classList.add('on')); setTimeout(() => { try { q.focus({ preventScroll: true }); } catch (e) { /* تجاهل */ } }, 220);
}
function ssPick(sel, v) {
    ssClose();
    if (sel.value !== v) { sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); try { sel.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { /* تجاهل */ } }
    ssSync(sel);
}
function ssClose() { const el = document.getElementById('ssOv'); if (el) el.remove(); document.body.classList.remove('ss-lock'); ssCur = null; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('ssOv')) { e.stopPropagation(); ssClose(); } }, true);
document.addEventListener('DOMContentLoaded', ssInit);
if (typeof openFormModal === 'function') { const _o = openFormModal; openFormModal = function () { _o.apply(this, arguments); ssInit(); SS_IDS.forEach(id => { const s = document.getElementById(id); if (s) ssSync(s); }); }; }
