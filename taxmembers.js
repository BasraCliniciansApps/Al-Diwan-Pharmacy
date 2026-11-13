// =====================================================================
// مواد كل تصنيف: بالضغط على اسم (قسم / تصنيف فرعي / شكل دوائي / تبويب / نوع جزء) تُعرض موادّه،
// ومن كل مادة: تعديل الصنف، أو إزالتها من هذا التصنيف، أو نقلها إلى تصنيف آخر من النوع نفسه.
// =====================================================================
const TM = {
    dept: { t: 'القسم', f: 'department', ex: 'extraDepartments', name: r => departments[r], list: () => departments.map(d => [d, d]), has: (p, k) => p.department === k || extrasOf(p.extraDepartments).includes(k) },
    cat: { t: 'التصنيف', f: 'category', ex: 'extraCategories', name: r => subCategories[r], list: () => subCategories.map(d => [d, d]), has: (p, k) => p.category === k || extrasOf(p.extraCategories).includes(k) },
    form: { t: 'الشكل الدوائي', name: r => { const f = FORMS.find(x => x.id === r); return f ? f.txt : ''; }, list: () => FORMS.filter(f => f.id !== 'other' && !f.hidden).map(f => [f.id, f.txt]), has: (p, k) => { const f = FORMS.find(x => x.id === k); return !!f && fmOwns(p, f); } },
    part: { t: 'نوع الجزء', f: 'subType', name: r => subTypes[r], list: () => subTypes.map(d => [d, d]), has: (p, k) => p.subType === k }
};
// المفتاح الداخلي للعنصر: الاسم للأقسام والتصنيفات وأنواع الجزء، والمعرّف للأشكال والتبويبات
function tmKey(kind, ref) { return (kind === 'dept' || kind === 'cat') ? TM[kind].name(ref) : kind === 'part' ? TM.part.name(ref) : ref; }
function tmApply(kind, p, key, to) {   // to = '' للإزالة، وإلا المفتاح الجديد
    const d = TM[kind];
    if (kind === 'form') { p.form = to; p.formOther = ''; return; }
    if (kind === 'part') { p.subType = to; return; }
    if (p[d.f] === key) p[d.f] = to;
    else { const cur = extrasOf(p[d.ex]).filter(x => x !== key); p[d.ex] = to && !cur.includes(to) && p[d.f] !== to ? cur.concat(to) : cur; }
    if (to && extrasOf(p[d.ex]).includes(to) && p[d.f] === to) p[d.ex] = extrasOf(p[d.ex]).filter(x => x !== to);
}
let tmQ = '';
function taxMembers(kind, ref) {
    const d = TM[kind]; if (!d) return;
    const key = tmKey(kind, ref), label = d.name(kind === 'form' || kind === 'tab' ? ref : ref);
    if (label === undefined || label === '') return;
    window.__tmCur = { kind, key, label };
    const mem = () => products.filter(p => d.has(p, key)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const html = () => {
        const list = mem(), q = normSearch(tmQ), vis = q ? list.filter(p => normSearch(p.name + ' ' + (p.brand || '')).includes(q)) : list;
        return `<div class="tm-box"><p class="tm-sub">${d.t}: <b>${escapeHtml(label)}</b> — ${fmtNum(list.length)} مادة</p>
        ${list.length > 8 ? `<input type="search" class="tm-q" id="tmQ" placeholder="بحث في المواد…" value="${escapeHtml(tmQ)}" autocomplete="off">` : ''}
        <div class="tm-list">${vis.map(p => `<div class="tm-row"><span dir="ltr">${escapeHtml(p.name)}${p.brand ? `<small>${escapeHtml(p.brand)}</small>` : ''}</span><div class="tm-act">
            <button type="button" class="icon-btn mi-edit" data-a="edit" data-id="${p.id}" aria-label="فتح وتعديل الصنف" title="فتح وتعديل الصنف">✏️</button>
            <button type="button" class="icon-btn mi-edit" data-a="move" data-id="${p.id}" aria-label="نقل إلى تصنيف آخر" title="نقل إلى تصنيف آخر">📂</button>
            <button type="button" class="icon-btn mi-del" data-a="rm" data-id="${p.id}" aria-label="إزالة من هذا التصنيف" title="إزالة من هذا التصنيف">➖</button></div></div>`).join('') || '<div class="bill-none">لا توجد مواد في هذا التصنيف.</div>'}</div></div>`;
    };
    const open = () => Swal.fire({
        title: escapeHtml(label), html: html(), showConfirmButton: false, showCancelButton: true, cancelButtonText: 'رجوع', customClass: { popup: 'tm-pop' },
        didOpen: () => {
            const c = Swal.getHtmlContainer(); if (!c) return;
            const redraw = () => { c.innerHTML = html(); const qi = c.querySelector('#tmQ'); if (qi) { qi.addEventListener('input', () => { tmQ = qi.value; const p = qi.selectionStart; redraw(); const n = c.querySelector('#tmQ'); if (n) { n.focus(); n.setSelectionRange(p, p); } }); } };
            redraw();
            c.addEventListener('click', async ev => {
                const b = ev.target.closest('button[data-a]'); if (!b) return;
                const p = products.find(x => String(x.id) === b.dataset.id); if (!p) return;
                if (b.dataset.a === 'edit') { Swal.close(); setTimeout(() => { try { openFormModal(p.id); } catch (e) { /* تجاهل */ } }, 150); return; }
                if (!writesAllowed() || !can('stockEdit')) { Swal.showValidationMessage('لا تملك صلاحية تعديل المواد.'); return; }
                if (b.dataset.a === 'rm') {
                    const ok = await askSure('إزالة المادة من التصنيف؟', '«' + p.name + '» ستُزال من «' + label + '» ولا تُحذف المادة.', 'نعم، أزل');
                    if (ok) await tmSave(kind, p, key, ''); tmQ = ''; open(); return;
                }
                const opts = {}; d.list().filter(x => x[0] !== key).forEach(x => { opts[x[0]] = x[1]; });
                if (!Object.keys(opts).length) { Swal.showValidationMessage('لا يوجد تصنيف آخر للنقل إليه.'); return; }
                const r = await Swal.fire({ title: 'نقل «' + escapeHtml(p.name) + '»', text: 'من «' + label + '» إلى:', input: 'select', inputOptions: opts, inputPlaceholder: 'اختر…', showCancelButton: true, confirmButtonText: 'نقل', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', inputValidator: v => v ? undefined : 'اختر تصنيفاً' });
                if (r.isConfirmed && r.value) await tmSave(kind, p, key, r.value);
                tmQ = ''; open();
            });
        }
    });
    tmQ = ''; open();
}
async function tmSave(kind, p, key, to) {
    const before = JSON.stringify([p.department, p.extraDepartments, p.category, p.extraCategories, p.type, p.extraTypes, p.form, p.formOther, p.subType]);
    tmApply(kind, p, key, to);
    const h = Prog.start('حفظ التغيير', { text: 'جاري الحفظ...' });
    const ok = await saveProductsDelta([{ p, dq: 0, dl: 0 }]);
    if (!ok) { const o = JSON.parse(before);['department', 'extraDepartments', 'category', 'extraCategories', 'type', 'extraTypes', 'form', 'formOther', 'subType'].forEach((k, i) => { p[k] = o[i]; }); h.fail('لم يُحفظ التغيير', 'أُعيدت القيمة السابقة'); return; }
    h.ok(to ? 'نُقلت المادة' : 'أُزيلت المادة من التصنيف');
    try { logAction('edit', p, [{ f: 'التصنيف (' + TM[kind].t + ')', from: String(key), to: to ? String(TM[kind].list().find(x => x[0] === to)?.[1] || to) : '—' }]); } catch (e) { /* تجاهل */ }
    try { renderManagerLists(); renderAll(); } catch (e) { /* تجاهل */ }
}
