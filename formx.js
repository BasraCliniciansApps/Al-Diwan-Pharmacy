// =====================================================================
// نموذج الصنف: باركود مطوي عند وجوده، إضافة عنصر جديد من داخل البحث (قسم/تصنيف/شكل)،
// تنبيه المواد المشابهة مطوي، ومعاينة حيّة لبطاقة المادة أثناء الكتابة.
// لا يغيّر أي حقل أو معرّف؛ يضيف فقط فوق ما هو موجود.
// =====================================================================
(function () {
    const $ = id => document.getElementById(id);
    // ---------- 1) إضافة عنصر جديد من نافذة البحث ----------
    const ADD = {
        fDepartment: { noun: 'قسم', exists: n => departments.find(d => ssNorm(d) === ssNorm(n)), add(n) { departments.push(n); try { pushToCloud(true); } catch (e) { /* تجاهل */ } populateModalSelects(); } },
        fCategory: { noun: 'تصنيف', exists: n => subCategories.find(d => ssNorm(d) === ssNorm(n)), add(n) { const dep = ($('fDepartment') || {}).value; subCategories.push(n); if (dep) deptSubs[dep] = (deptSubs[dep] || []).concat(n); try { pushToCloud(true); } catch (e) { /* تجاهل */ } refreshCatSelect(n); } },
        fForm: { noun: 'شكل دوائي', exists: n => { const f = FORMS.find(x => x.id !== 'other' && !x.hidden && ssNorm(x.txt) === ssNorm(n)); return f ? f.id : ''; }, add(n) { /* يُضاف عبر مسار Other الموجود: يتحول لشكل حقيقي عند الحفظ */ } }
    };
    function fxAddPick(sel, name) {
        const a = ADD[sel.id]; if (!a) return;
        name = name.trim().replace(/\s+/g, ' '); if (!name) return;
        const ex = a.exists(name);
        if (sel.id === 'fForm') {
            if (ex) { ssPick(sel, ex); return; }
            ssClose(); sel.value = 'other'; sel.dispatchEvent(new Event('change', { bubbles: true })); ssSync(sel);
            const o = $('fFormOther'); if (o) { o.value = name; o.dispatchEvent(new Event('input', { bubbles: true })); }
            return;
        }
        if (ex) { ssPick(sel, ex); return; }
        a.add(name);
        ssClose(); sel.value = name; sel.dispatchEvent(new Event('change', { bubbles: true })); ssSync(sel);
        Swal.fire({ icon: 'success', title: 'أُضيف ' + a.noun + ' «' + name + '»', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
    }
    window.fxAddPick = fxAddPick;
    if (typeof ssOpen === 'function') {
        const _so = ssOpen;
        ssOpen = function (sel) {
            _so.apply(this, arguments);
            const a = ADD[sel && sel.id]; if (!a || !(typeof can === 'function' ? can('stockEdit') || userRole === 'owner' : true)) return;
            const q = $('ssQ'), list = $('ssList'); if (!q || !list) return;
            const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ss-add'; btn.hidden = true;
            list.insertAdjacentElement('afterend', btn);
            const upd = () => {
                const v = q.value.trim(); const same = v && a.exists(v);
                btn.hidden = !v || !!same; if (v && !same) btn.textContent = '＋ إضافة ' + a.noun + ' جديد: «' + v + '»';
            };
            q.addEventListener('input', upd); upd();
            btn.addEventListener('click', () => fxAddPick(sel, q.value));
        };
    }
    // ---------- 2) الباركود: مطوي إن وُجد ----------
    function fxBcSum() {
        const g = document.querySelector('#formModal .fs-bcTop'); if (!g) return;
        const n = (typeof formBarcodes !== 'undefined' ? formBarcodes : []).length, s = g.querySelector('.fx-bcs');
        if (s) s.textContent = n ? n + (n === 1 ? ' باركود · ' : ' باركودات · ') + formBarcodes[0] : 'لا يوجد';
    }
    function fxBcInit() {
        const g = document.querySelector('#formModal .fs-bcTop'); if (!g) return;
        const lab = g.querySelector('label');
        if (lab && !lab.dataset.fx) {
            lab.dataset.fx = '1'; lab.classList.add('fx-bch');
            lab.innerHTML = '▦ الباركود <span class="fx-bcs"></span><i>▾</i>';
            lab.addEventListener('click', () => g.classList.toggle('fx-closed'));
        }
        g.classList.toggle('fx-closed', (typeof formBarcodes !== 'undefined' ? formBarcodes : []).length > 0);
        fxBcSum();
    }
    // ---------- 3) المعاينة الحيّة ----------
    function fxPrev() {
        const card = document.querySelector('#formModal .modal-card'); if (!card) return;
        let p = $('fxPrev');
        if (!p) { p = document.createElement('div'); p.id = 'fxPrev'; p.className = 'fx-prev'; const t = $('formModalTitle'); t.insertAdjacentElement('afterend', p); }
        const v = id => ((($(id) || {}).value) || '').trim(), sel = id => { const e = $(id); const o = e && e.options && e.options[e.selectedIndex]; return o ? o.textContent.trim() : ''; };
        const price = parseFloat(v('fPrice')) || 0, qty = parseInt(v('fQty')) || 0;
        const form = v('fForm') === 'other' ? v('fFormOther') : (v('fForm') ? sel('fForm') : '');
        const meta = [v('fMeta'), form].filter(Boolean).join(' | ');
        const img = v('fImg');
        p.innerHTML = `<div class="fx-pi">${img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.replaceWith(document.createTextNode('💊'))">` : '💊'}</div><div class="fx-pt"><small>${escapeHtml(v('fBrand') || 'الشركة')}</small><b dir="ltr">${escapeHtml(v('fName') || 'اسم المادة')}</b><em dir="ltr">${escapeHtml(meta) || '—'}</em><span>${escapeHtml([sel('fDepartment'), sel('fCategory')].filter(Boolean).join(' › '))}</span></div><div class="fx-pp"><b>${price ? fmtNum(price) : '—'}</b><small>د.ع</small><span class="${qty > 0 ? 'ok' : 'no'}">${qty > 0 ? fmtNum(qty) + ' علبة' : 'غير متوفر'}</span></div>`;
    }
    let fxT = null;
    function fxStart() {
        fxBcInit(); fxPrev();
        const card = document.querySelector('#formModal .modal-card');
        if (card && !card.dataset.fx) { card.dataset.fx = '1'; ['input', 'change'].forEach(ev => card.addEventListener(ev, () => { fxPrev(); fxBcSum(); })); card.addEventListener('click', e => { const b = e.target.closest('#fsDup > b'); if (b) b.parentElement.classList.toggle('open'); }); }
        clearInterval(fxT); fxT = setInterval(() => { const m = $('formModal'); if (!m || !m.style.display || m.style.display === 'none') { clearInterval(fxT); return; } fxPrev(); fxBcSum(); }, 600);
    }
    if (typeof openFormModal === 'function') { const _o = openFormModal; openFormModal = function () { const r = _o.apply(this, arguments); try { setTimeout(fxStart, 0); } catch (e) { /* تجاهل */ } return r; }; window.openFormModal = openFormModal; }
})();
