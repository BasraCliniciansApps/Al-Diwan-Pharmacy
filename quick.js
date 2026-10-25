// =====================================================================
// الإدخال السريع: وأنت تكتب الاسم يختار التطبيق الشكل الدوائي والقسم والتصنيف، ويعبّي الشركة والمادة الفعالة من مادة مشابهة.
// كل ميزة لها مفتاح (Switch) تشغّله وتطفيه من داخل نافذة الصنف، والإعداد محفوظ على هذا الجهاز (الأصل: شغّال).
// ما يغيّر شي اخترته أنت يدوياً، ويطبّق على الأصناف الجديدة (القسم/الشركة/المادة)، والشكل يطبَّق حتى عند التعديل إذا ما اخترته.
// =====================================================================
const QK_LS = 'diwanQuick';
const QK_DEF = { form: true, dept: true, like: true };
const QK_LABELS = { form: ['الشكل الدوائي تلقائياً', 'من الاسم والعبوة، مثل Tablet أو Gummies'], dept: ['القسم والتصنيف تلقائياً', 'يقترحهم من اسم الدواء (للصنف الجديد)'], like: ['تعبئة الشركة والمادة الفعالة', 'من مادة مشابهة موجودة عندك (للصنف الجديد)'] };
function qkCfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(QK_LS)) || {}; } catch (e) { c = {}; } return Object.assign({}, QK_DEF, c); }
function qkSet(k, v) { const c = qkCfg(); c[k] = !!v; try { localStorage.setItem(QK_LS, JSON.stringify(c)); } catch (e) { /* تجاهل */ } qkHint(); }
const qkUser = { form: false, dept: false, brand: false, active: false };
let qkLast = '';
function qkEl(id) { return document.getElementById(id); }
function qkDetectForm(s) { const t = String(s || '').toLowerCase(), f = FORMS.find(x => x.re && x.re.test(t)); return f ? f : null; }
function qkIsNew() { const e = qkEl('editId'); return !e || !e.value; }
function qkApply() {
    const c = qkCfg(), name = (qkEl('fName') || {}).value || '', meta = (qkEl('fMeta') || {}).value || '', brand = (qkEl('fBrand') || {}).value || '';
    const done = [];
    if (c.form && !qkUser.form && qkEl('fForm')) {
        const f = qkDetectForm(name + ' ' + meta + ' ' + brand), sel = qkEl('fForm');
        if (f && sel.value !== f.id && [...sel.options].some(o => o.value === f.id)) { sel.value = f.id; try { onFormChange(); } catch (e) { /* تجاهل */ } }
        else if (!f && sel.dataset.qk === '1') { sel.value = ''; try { onFormChange(); } catch (e) { /* تجاهل */ } }
        sel.dataset.qk = f ? '1' : '';
        if (f) done.push(f.txt);
    }
    if (qkIsNew() && name.trim().length >= 3) {
        if (c.dept && !qkUser.dept && typeof taxSuggest === 'function' && typeof TAX_MAP !== 'undefined') {
            const sg = taxSuggest({ name, category: '' });
            if (sg) {
                const d = TAX_DEPTS[sg.d - 1], s = (TAX_SEED[d] || [])[sg.s - 1], dsel = qkEl('fDepartment');
                if (dsel && deptList().includes(d)) {
                    if (dsel.value !== d) { dsel.value = d; try { onDeptChanged(); } catch (e) { /* تجاهل */ } }
                    const csel = qkEl('fCategory'); if (csel && s && [...csel.options].some(o => o.value === s)) { csel.value = s; try { refreshExtraChips('cat'); } catch (e) { /* تجاهل */ } }
                    done.push(d + (s ? ' › ' + s : ''));
                }
            }
        }
        if (c.like && typeof taxKey === 'function') {
            const k = taxKey(name);
            if (k.length >= 3) {
                const sim = products.find(p => taxKey(p.name) === k && (p.activeIngredient || p.brand));
                if (sim) {
                    const a = qkEl('fActive'), b = qkEl('fBrand');
                    if (a && !qkUser.active && !a.value.trim() && sim.activeIngredient) { a.value = sim.activeIngredient; done.push('المادة الفعالة'); }
                    if (b && !qkUser.brand && !b.value.trim() && sim.brand) { b.value = sim.brand; done.push('الشركة'); }
                }
            }
        }
    }
    qkLast = done.join(' · '); qkHint();
}
function qkHint() {
    const h = qkEl('qkHint'); if (!h) return;
    const c = qkCfg(), any = c.form || c.dept || c.like;
    h.textContent = any && qkLast ? '⚡ اختير تلقائياً: ' + qkLast : '';
}
function qkInit() {
    const brand = qkEl('fBrand'); if (!brand || qkEl('qkBox')) return;
    const grp = brand.closest('.form-group'); if (!grp) return;
    const c = qkCfg();
    const rows = Object.keys(QK_LABELS).map(k => `<div class="qk-row"><div><b>${QK_LABELS[k][0]}</b><small>${QK_LABELS[k][1]}</small></div><label class="setup-sw"><input type="checkbox" ${c[k] ? 'checked' : ''} onchange="qkSet('${k}', this.checked)" aria-label="${QK_LABELS[k][0]}"><i></i></label></div>`).join('');
    grp.insertAdjacentHTML('beforebegin', `<details class="qk-box" id="qkBox"><summary>⚡ الإدخال السريع <em>إعدادات هذا الجهاز</em></summary>${rows}</details><div class="qk-hint" id="qkHint" aria-live="polite"></div>`);
    ['fName', 'fMeta', 'fBrand'].forEach(id => { const e = qkEl(id); if (e) { e.addEventListener('input', () => { if (id === 'fBrand') qkUser.brand = true; clearTimeout(qkTimer); qkTimer = setTimeout(qkApply, 250); }); e.addEventListener('blur', qkApply); } });
    const a = qkEl('fActive'); if (a) a.addEventListener('input', () => { qkUser.active = true; });
    const f = qkEl('fForm'); if (f) f.addEventListener('change', () => { qkUser.form = true; f.dataset.qk = ''; });
    ['fDepartment', 'fCategory'].forEach(id => { const e = qkEl(id); if (e) e.addEventListener('change', () => { qkUser.dept = true; }); });
}
let qkTimer = null;
function qkReset() { qkUser.form = qkUser.dept = qkUser.brand = qkUser.active = false; qkLast = ''; const f = qkEl('fForm'); if (f) f.dataset.qk = ''; qkHint(); }
{ const _o = openFormModal; openFormModal = function () { _o.apply(this, arguments); qkInit(); qkReset(); const f = qkEl('fForm'); if (f && !qkIsNew() && f.value) qkUser.form = true; }; }   // صنف قديم له شكل محدد: ما نغيّره
document.addEventListener('DOMContentLoaded', qkInit);
