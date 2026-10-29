// ===== إدارة الأشكال الدوائية: إضافة، نقل بين المجموعات، تغيير الاسم، إخفاء/حذف (مثل التصنيفات) =====
let formCfg = (() => { try { const o = JSON.parse(localStorage.getItem('diwanFormCfg')) || {}; return { added: o.added || [], ren: o.ren || {}, mov: o.mov || {}, hid: o.hid || [], groups: o.groups || [] }; } catch (e) { return { added: [], ren: {}, mov: {}, hid: [], groups: [] }; } })();
let fmQ = '';
function formCfgApply() {
    (formCfg.groups || []).forEach(g => { if (!FORM_GROUPS.includes(g)) FORM_GROUPS.splice(Math.max(FORM_GROUPS.indexOf('Other'), 0), 0, g); });
    FORMS.forEach(f => { if (f._t0 === undefined) { f._t0 = f.txt; f._g0 = f.g; } });
    (formCfg.added || []).forEach(a => { if (!FORMS.some(f => f.id === a.id)) { const i = FORMS.findIndex(f => f.id === 'other'); FORMS.splice(i < 0 ? FORMS.length : i, 0, { id: a.id, txt: a.txt, cls: 'badge-other', g: a.g, re: null, custom: true, _t0: a.txt, _g0: a.g }); } });
    FORMS.forEach(f => {
        if (f.custom) { const a = (formCfg.added || []).find(x => x.id === f.id); if (a) { f.txt = a.txt; f.g = a.g; } }
        else { f.txt = (formCfg.ren || {})[f.id] || f._t0; f.g = (formCfg.mov || {})[f.id] !== undefined ? formCfg.mov[f.id] : f._g0; }
        f.hidden = (formCfg.hid || []).includes(f.id);
    });
    const el = document.getElementById('fForm'); if (el) { const v = el.value; el.innerHTML = ''; try { fillFormSelect(); } catch (e) { /* تجاهل */ } el.value = v; }
}
function formCfgImport(c) { if (c && typeof c === 'object') { formCfg = { added: c.added || [], ren: c.ren || {}, mov: c.mov || {}, hid: c.hid || [], groups: c.groups || [] }; formCfgApply(); } }
async function formCfgSave(touched) {
    try { localStorage.setItem('diwanFormCfg', JSON.stringify(formCfg)); } catch (e) { /* تجاهل */ }
    formCfgApply();
    await pushToCloud(true);
    if (touched && touched.length) await saveProductsDelta(touched.map(p => ({ p, dq: 0, dl: 0 })));
    renderFormManager();
}
function fmCount(id) { return products.filter(p => p.form === id).length; }
function renderFormManager() {
    const box = document.getElementById('formListManager'); if (!box) return;
    const gs = document.getElementById('newFormGroup');
    if (gs) { const v = gs.value; gs.innerHTML = FORM_GROUPS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join(''); if (FORM_GROUPS.includes(v)) gs.value = v; }
    const qn = normSearch(fmQ);
    const list = FORMS.filter(f => f.id !== 'other' && (!qn || normSearch(f.txt + ' ' + f.g).includes(qn)));
    box.innerHTML = list.map(f => {
        const n = fmCount(f.id);
        return `<div class="manager-item${f.hidden ? ' fm-off' : ''}"><span><span dir="ltr">${escapeHtml(f.txt)}</span><small>${escapeHtml(f.g || 'بدون مجموعة')}${n ? ' · ' + fmtNum(n) + ' مادة' : ''}${f.hidden ? ' · مخفي' : ''}${f.custom ? ' · مضاف' : ''}</small></span>
            <div style="display:flex; gap:6px;">
                ${f.hidden ? `<button class="icon-btn mi-edit" aria-label="إظهار" onclick="fmShow('${f.id}')">↩<span class="mi-t"> إظهار</span></button>` : `
                <button class="icon-btn mi-edit" aria-label="نقل إلى مجموعة" onclick="fmMove('${f.id}')">📂<span class="mi-t"> نقل</span></button>
                <button class="icon-btn mi-edit" aria-label="تعديل الاسم" onclick="fmRename('${f.id}')">✏️<span class="mi-t"> تعديل الاسم</span></button>
                <button class="icon-btn mi-del" aria-label="حذف" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="fmDelete('${f.id}')">🗑️</button>`}
            </div></div>`;
    }).join('') || '<div class="bill-none">لا توجد أشكال مطابقة.</div>';
}
function fmSearch(v) { fmQ = v || ''; renderFormManager(); }
async function fmAdd() {
    const inp = document.getElementById('newFormInput'), g = document.getElementById('newFormGroup').value, name = (inp.value || '').trim();
    if (!name) return;
    if (FORMS.some(f => f.txt.toLowerCase() === name.toLowerCase() && !f.hidden)) { askNotice('الشكل موجود', 'هذا الشكل موجود مسبقاً.', 'info'); return; }
    formCfg.added.push({ id: 'cf' + Date.now().toString(36), txt: name, g });
    inp.value = '';
    await formCfgSave();
    Swal.fire({ icon: 'success', title: 'أُضيف الشكل', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
}
async function fmAddGroup() {
    const n = await askText('إضافة مجموعة أشكال', 'اسم المجموعة');
    if (!n) return;
    if (FORM_GROUPS.some(g => g.toLowerCase() === n.toLowerCase())) { askNotice('المجموعة موجودة', 'هذه المجموعة موجودة مسبقاً.', 'info'); return; }
    formCfg.groups.push(n); await formCfgSave();
}
async function fmRename(id) {
    const f = FORMS.find(x => x.id === id); if (!f) return;
    const n = await askText('تعديل اسم الشكل الدوائي', 'الاسم الجديد', f.txt);
    if (!n || n === f.txt) return;
    if (f.custom) { const a = formCfg.added.find(x => x.id === id); if (a) a.txt = n; } else formCfg.ren[id] = n;
    await formCfgSave();
}
async function fmMove(id) {
    const f = FORMS.find(x => x.id === id); if (!f) return;
    const opts = {}; FORM_GROUPS.forEach(g => { opts[g] = g; });
    const r = await Swal.fire({ title: 'نقل الشكل إلى مجموعة', text: f.txt, input: 'select', inputOptions: opts, inputValue: f.g || '', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نقل', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed || !r.value || r.value === f.g) return;
    if (f.custom) { const a = formCfg.added.find(x => x.id === id); if (a) a.g = r.value; } else formCfg.mov[id] = r.value;
    await formCfgSave();
}
async function fmDelete(id) {
    const f = FORMS.find(x => x.id === id); if (!f) return;
    const n = fmCount(id);
    const ok = await askSure(f.custom ? 'حذف الشكل؟' : 'إخفاء الشكل؟', f.custom ? 'سيُحذف «' + f.txt + '»' + (n ? ' وتعود ' + fmtNum(n) + ' مادة إلى الاكتشاف التلقائي للشكل.' : '.')
        : 'سيُخفى «' + f.txt + '» من قوائم الاختيار' + (n ? '، وتبقى ' + fmtNum(n) + ' مادة محتفظة به.' : '.') + ' يمكنك إظهاره لاحقاً.', f.custom ? 'نعم، احذف' : 'نعم، أخفِ');
    if (!ok) return;
    let touched = [];
    if (f.custom) {
        formCfg.added = formCfg.added.filter(x => x.id !== id);
        touched = products.filter(p => p.form === id); touched.forEach(p => { p.form = ''; });
        const i = FORMS.findIndex(x => x.id === id); if (i >= 0) FORMS.splice(i, 1);
    } else if (!formCfg.hid.includes(id)) formCfg.hid.push(id);
    await formCfgSave(touched);
}
async function fmShow(id) { formCfg.hid = formCfg.hid.filter(x => x !== id); await formCfgSave(); }
formCfgApply();
