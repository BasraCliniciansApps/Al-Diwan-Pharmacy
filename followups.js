// ============================================================================
// المتابعات: وعود مندوبي الإعلام الدوائي (بونص على طلب) والمواد المأخوذة للتبديل (أمانات).
// للمدير دائماً، ولغيره بصلاحية «followups». التخزين: pharmacy_followups (سحابة تدريجية) + نسخة محلية.
// ============================================================================
const FU_LS = 'diwanFollowups', FU_DAYS_LS = 'diwanFuDays', FU_SEEN_LS = 'diwanFuSeen';
let fuAll = [], fuTab = 'promise', fuSeg = 'open', fuScr = 'list', fuOpenFlag = false, fuForm = null, fuRepQ = '', fuFound = [];
const fuEsc = s => escapeHtml(String(s == null ? '' : s));
const fuId = () => 'fu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fuNum = v => parseFloat(String(v || '').replace(/[,،\s]/g, '')) || 0;
const fuInt = v => parseInt(v) || 0;
function fuAllowed() { return userRole === 'owner' || (typeof can === 'function' && can('followups')); }
function fuStockOk() { return userRole === 'owner' || can('stockEdit') || can('sell'); }
function fuDays() { const n = parseInt(lsGet(FU_DAYS_LS)); return n > 0 ? n : 7; }
function fuDaysSet(v) { const n = parseInt(v); if (n > 0 && n <= 365) { lsSet(FU_DAYS_LS, String(n)); fuBadge(); if (fuOpenFlag && fuScr === 'list') fuListRender(); } }
function fuAgo(iso) { if (!iso) return 0; const a = new Date(String(iso).slice(0, 10) + 'T00:00:00'), b = new Date(todayLocalISO() + 'T00:00:00'); return Math.max(0, Math.round((b - a) / 864e5)); }

// ---------- الحالات ----------
const FU_PST = { wait_pull: ['بانتظار السحب', 'wp'], wait_bonus: ['بانتظار البونص', 'wb'], received: ['تم الاستلام', 'ok'], failed: ['لم يُوفِ', 'bad'] };
const FU_LST = { open: ['غير مُعادة', 'wb'], returned: ['أُعيدت', 'ok'], settled: ['سُوّيت بتعويض', 'ok'] };
const fuIsOpen = r => r.type === 'promise' ? (r.status === 'wait_pull' || r.status === 'wait_bonus') : r.status === 'open';
const fuSince = r => r.type === 'promise' ? (r.status === 'wait_bonus' ? (r.pulledAt || r.date) : r.date) : r.date;
const fuOverdue = r => fuIsOpen(r) && fuAgo(fuSince(r)) >= fuDays();
function fuOverdueCount() { fuLoadLocal(); return fuAll.filter(fuOverdue).length; }

// ---------- التخزين ----------
function fuLocal() { try { return (JSON.parse(lsGet(FU_LS)) || []).filter(x => x && x.id); } catch (e) { return []; } }
function fuLoadLocal() { if (!fuAll.length || !fuOpenFlag) fuAll = fuLocal(); }
function fuStore() { lsSet(FU_LS, JSON.stringify(fuAll)); }
function fuSort() { fuAll.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.ts || '').localeCompare(String(a.ts || ''))); }
async function fuLoad() {
    const m = new Map(fuLocal().map(x => [x.id, x]));
    if (cloudReady() && navigator.onLine) {
        try {
            const r1 = await cloudDelta('fu', 'pharmacy_followups', m.size > 0, 3, 24, c => c);
            if (r1) {
                const seen = new Set();
                r1.snap.forEach(d => { const x = d.data(); if (!x || !x.id) return; seen.add(x.id); const l = m.get(x.id); if (!l || String(x.upd || '') >= String(l.upd || '')) { delete x._su; m.set(x.id, { ...x, sy: 1 }); } });
                if (r1.full) [...m.values()].forEach(l => { if (l.sy && !seen.has(l.id)) m.delete(l.id); });   // حُذف من جهاز آخر
            }
        } catch (e) { /* القاعدة قد لا تكون مضافة بعد */ }
    }
    fuAll = [...m.values()]; fuSort(); fuStore();
}
async function fuPut(rec) {
    rec.upd = new Date().toISOString(); delete rec.sy;
    fuAll = fuAll.filter(x => x.id !== rec.id); fuAll.unshift(rec); fuSort(); fuStore();
    if (cloudReady()) { try { const { sy, ...c } = rec; await fsSet(db.collection('pharmacy_followups').doc(rec.id), c); rec.sy = 1; fuStore(); } catch (e) { lsSet('diwanNeedsPush', '1'); return false; } }
    return true;
}
async function fuRemove(id) {
    fuAll = fuAll.filter(x => x.id !== id); fuStore();
    if (cloudReady()) { try { await fsWrite(db.collection('pharmacy_followups').doc(id).delete()); } catch (e) { return false; } }
    return true;
}

// ---------- الشارة والتنبيه ----------
function fuBadge() {
    const el = document.getElementById('homeFuCount'); if (!el) return;
    if (!fuAllowed()) { el.style.display = 'none'; return; }
    const n = fuOverdueCount(); el.innerText = n; el.style.display = n ? 'flex' : 'none';
}
function fuRemind() {   // تنبيه مرة باليوم عند فتح التطبيق
    try {
        if (!fuAllowed()) return; const n = fuOverdueCount(); if (!n) return;
        const t = todayLocalISO(); if (lsGet(FU_SEEN_LS) === t) return; lsSet(FU_SEEN_LS, t);
        Swal.fire({ icon: 'warning', title: 'متابعات متأخرة', html: `لديك <b>${fmtNum(n)}</b> من المتابعات تجاوزت مدة التذكير.`, showCancelButton: true, confirmButtonText: 'عرضها', cancelButtonText: 'لاحقاً', confirmButtonColor: '#0f1c38' }).then(r => { if (r.isConfirmed) fuOpen(true); });
    } catch (e) { /* تجاهل */ }
}
setTimeout(() => { try { fuLoadLocal(); fuBadge(); } catch (e) { /* تجاهل */ } }, 2500);
setTimeout(() => { try { if (typeof isFirebaseReady !== 'undefined') fuRemind(); } catch (e) { /* تجاهل */ } }, 9000);
setInterval(() => { try { fuBadge(); } catch (e) { /* تجاهل */ } }, 60000);

// ---------- الإطار ----------
function fuEnsureDom() {
    if (document.getElementById('fuOv')) return;
    const d = document.createElement('div'); d.id = 'fuOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="fuBox"></div>'; document.body.appendChild(d);
}
async function fuOpen(onlyLate) {
    if (!fuAllowed()) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'لا تملك صلاحية المتابعات.', confirmButtonColor: '#0f1c38' }); return; }
    fuEnsureDom(); fuAll = fuLocal(); fuSort();
    document.getElementById('fuOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); fuOpenFlag = true;
    fuScr = 'list'; fuSeg = onlyLate ? 'late' : 'open'; fuRepQ = ''; fuListRender();
    const h = Prog.start('تحميل المتابعات', { text: 'جارٍ التحديث...' });
    try { await fuLoad(); h.ok('تم التحديث'); } catch (e) { h.fail('تعذر التحديث', e.message || String(e)); }
    if (fuOpenFlag && fuScr === 'list') fuListRender();
    fuBadge();
}
function fuClose() {
    const ov = document.getElementById('fuOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); fuOpenFlag = false; fuForm = null; fuScr = 'list';
    fuBadge();
}
async function fuBack() {
    if (fuScr === 'form') {
        if (fuForm && fuForm.dirty) { const ok = await Swal.fire({ icon: 'warning', title: 'تجاهل التغييرات؟', text: 'لن تُحفظ البيانات المدخلة.', showCancelButton: true, confirmButtonText: 'نعم، تجاهل', cancelButtonText: 'متابعة التعديل', confirmButtonColor: '#b91c1c', reverseButtons: true }); if (!ok.isConfirmed) return; }
        fuForm = null; fuListRender();
    } else fuClose();
}

// ---------- القائمة ----------
function fuRows() {
    const q = fuNormQ(fuRepQ);
    return fuAll.filter(r => (fuTab === 'loan' ? r.type === 'loan' : r.type === 'promise')).filter(r => {
        if (fuSeg === 'open' && !fuIsOpen(r)) return false;
        if (fuSeg === 'late' && !fuOverdue(r)) return false;
        if (fuSeg === 'done' && fuIsOpen(r)) return false;
        if (q) { const t = fuNormQ([r.rep, r.company, r.person, r.item, r.supplier, r.note].join(' ')); if (!t.includes(q)) return false; }
        return true;
    });
}
const fuNormQ = s => String(s || '').toLowerCase().replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
function fuCardHtml(r) {
    const st = r.type === 'promise' ? FU_PST[r.status] : FU_LST[r.status], late = fuOverdue(r), d = fuAgo(fuSince(r));
    const who = r.type === 'promise' ? [r.rep, r.company].filter(Boolean).join(' • ') : r.person;
    const qty = r.type === 'promise' ? (r.bonus ? 'بونص: ' + r.bonus : '') : (r.mode === 'amount' ? 'مبلغ: ' + fmtNum(r.amount) + ' د.ع' : [r.qty ? fuInt(r.qty) + ' علبة' : '', r.loose ? fuInt(r.loose) + ' جزء' : ''].filter(Boolean).join(' + '));
    return `<div class="cu-row fu-row ${late ? 'fu-late' : ''}" onclick="fuDetail('${r.id}')"><div class="cu-av fu-av ${st ? st[1] : ''}">${r.type === 'promise' ? '🎁' : '↔'}</div>
        <div><b>${fuEsc(r.item || (r.type === 'loan' && r.mode === 'amount' ? 'تعويض بمبلغ' : '—'))}</b><small>${fuEsc(who)}${qty ? ' • ' + fuEsc(qty) : ''}</small><small>${fuEsc(fmtDateDMY(r.date))}${fuIsOpen(r) && d ? ' • منذ ' + fmtNum(d) + ' يوم' : ''}</small></div>
        <div class="fu-st ${st ? st[1] : ''}">${late ? '⚠ متأخرة' : (st ? st[0] : '')}</div></div>`;
}
function fuListRender() {
    fuScr = 'list'; fuLoadLocal();
    const late = fuAll.filter(fuOverdue).length;
    const tabs = `<div class="cu-seg"><button type="button" class="${fuTab === 'promise' ? 'on' : ''}" onclick="fuTab='promise';fuListRender()">وعود المندوبين</button><button type="button" class="${fuTab === 'loan' ? 'on' : ''}" onclick="fuTab='loan';fuListRender()">المواد المأخوذة</button><button type="button" class="${fuTab === 'rep' ? 'on' : ''}" onclick="fuTab='rep';fuListRender()">المندوبون</button></div>`;
    let body;
    if (fuTab === 'rep') body = fuRepsHtml();
    else {
        const segs = [['open', 'المفتوحة'], ['late', 'المتأخرة' + (late ? ' (' + fmtNum(late) + ')' : '')], ['done', 'المنتهية'], ['all', 'الكل']];
        const rows = fuRows();
        body = `<button type="button" class="cn-new" onclick="fuNew('${fuTab}')">${fuTab === 'loan' ? '+ مادة مأخوذة جديدة' : '+ وعد جديد من مندوب'}</button>
            <div class="cn-chips fu-chips">${segs.map(([k, l]) => `<button type="button" class="cn-chip ${fuSeg === k ? 'on' : ''}" onclick="fuSeg='${k}';fuListRender()">${l}</button>`).join('')}</div>
            <div class="fu-q"><input type="search" autocomplete="off" placeholder="بحث بالمندوب أو الشركة أو المادة" value="${fuEsc(fuRepQ)}" oninput="fuRepQ=this.value;fuListRows()"></div>
            <div id="fuRows">${rows.map(fuCardHtml).join('') || '<div class="cu-none">لا توجد عناصر.</div>'}</div>`;
    }
    const days = userRole === 'owner' ? `<div class="fu-days"><span>مدة التذكير (أيام)</span><input type="number" inputmode="numeric" min="1" max="365" value="${fuDays()}" onchange="fuDaysSet(this.value)"></div>` : '';
    document.getElementById('fuBox').innerHTML = `<div class="cn-head"><b>🔔 المتابعات</b><span>${late ? fmtNum(late) + ' متأخرة' : ''}</span></div><div class="cn-body">${tabs}${body}${days}</div>`;
}
function fuListRows() { const b = document.getElementById('fuRows'); if (b) b.innerHTML = fuRows().map(fuCardHtml).join('') || '<div class="cu-none">لا توجد عناصر.</div>'; }

// ---------- المندوبون ----------
function fuReps() {
    const m = new Map();
    fuAll.filter(r => r.type === 'promise' && r.rep).forEach(r => {
        const k = fuNormQ(r.rep), g = m.get(k) || { key: k, name: r.rep, company: '', phone: '', n: 0, ok: 0, bad: 0, open: 0, late: 0 };
        if (!g.company && r.company) g.company = r.company; if (!g.phone && r.phone) g.phone = r.phone;
        g.n++; if (r.status === 'received') g.ok++; else if (r.status === 'failed') g.bad++; else { g.open++; if (fuOverdue(r)) g.late++; }
        m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.bad - a.bad || b.late - a.late || b.n - a.n);
}
function fuRepsHtml() {
    const reps = fuReps();
    return reps.map(g => `<div class="cu-row fu-row" onclick="fuRepOpen('${fuEsc(g.key).replace(/'/g, '')}')"><div class="cu-av">${fuEsc([...g.name][0] || '؟')}</div>
        <div><b>${fuEsc(g.name)}</b><small>${fuEsc(g.company || 'شركة غير مسجّلة')}${g.phone ? ' • ' + fuEsc(g.phone) : ''}</small><small>وعود: ${fmtNum(g.n)} • وفّى: ${fmtNum(g.ok)} • لم يُوفِ: ${fmtNum(g.bad)} • مفتوحة: ${fmtNum(g.open)}</small></div>
        <div class="fu-st ${g.bad ? 'bad' : g.late ? 'wb' : 'ok'}">${g.bad ? 'خلف ' + fmtNum(g.bad) : g.late ? 'متأخر' : 'جيد'}</div></div>`).join('') || '<div class="cu-none">يظهر المندوبون هنا بعد تسجيل أول وعد.</div>';
}
function fuRepOpen(key) {
    const g = fuReps().find(x => x.key === key); if (!g) return;
    fuTab = 'promise'; fuSeg = 'all'; fuRepQ = g.name; fuListRender();
}

// ---------- البحث عن مادة ----------
function fuSearch() {
    const q = document.getElementById('fuQ').value, qn = normSearch(q), box = document.getElementById('fuRes');
    if (!qn) { box.innerHTML = ''; box.style.display = 'none'; return; }
    const toks = qn.split(' ');
    fuFound = products.filter(p => !p.arch).map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    box.innerHTML = fuFound.map(p => `<button type="button" class="cn-res" onclick="fuPick(${p.id})"><span dir="ltr">${dispNameHtml(p)}</span><em>${fuInt(p.qty)}${hasRetail(p) ? ' + ' + fuInt(p.loose) : ''}</em></button>`).join('') + `<button type="button" class="cn-res cn-newitem" onclick="fuPickFree()">استخدام «${fuEsc(q.trim())}» كاسم حر (غير مسجّلة)</button>`;
    box.style.display = 'block';
}
function fuPick(id) { const p = products.find(x => x.id === id); if (!p) return; fuForm.d.pid = p.id; fuForm.d.item = dispName(p); fuForm.dirty = true; fuFormRender(); }
function fuPickFree() { const q = document.getElementById('fuQ').value.trim(); if (!q) return; fuForm.d.pid = null; fuForm.d.item = q; fuForm.dirty = true; fuFormRender(); }
function fuClearItem() { fuForm.d.pid = null; fuForm.d.item = ''; fuFormRender(); }

// ---------- النموذج ----------
function fuNew(type) {
    const d = type === 'loan' ? { type: 'loan', person: '', pid: null, item: '', mode: 'item', qty: '', loose: '', amount: '', date: todayLocalISO(), note: '' }
        : { type: 'promise', rep: '', company: '', phone: '', pid: null, item: '', qty: '', supplier: '', bonus: '', date: todayLocalISO(), pulled: false, note: '' };
    fuForm = { d, dirty: false, editId: null }; fuFormRender();
}
function fuEdit(id) { const r = fuAll.find(x => x.id === id); if (!r) return; fuForm = { d: { ...r, pulled: r.status === 'wait_bonus' }, dirty: false, editId: id, old: r }; fuFormRender(); }
function fuFld(k, v) { fuForm.d[k] = v; fuForm.dirty = true; }
function fuRepPick(v) {   // اختيار مندوب سابق يملأ الشركة والهاتف
    fuFld('rep', v); const g = fuReps().find(x => x.key === fuNormQ(v));
    if (g) { const c = document.getElementById('fuCo'), p = document.getElementById('fuPh'); if (c && !c.value) { c.value = g.company || ''; fuForm.d.company = g.company || ''; } if (p && !p.value) { p.value = g.phone || ''; fuForm.d.phone = g.phone || ''; } }
}
function fuFormRender() {
    fuScr = 'form'; const d = fuForm.d, isP = d.type === 'promise', edit = !!fuForm.editId, p = d.pid ? products.find(x => x.id === d.pid) : null;
    const reps = fuReps(), sups = typeof puSupplierNames === 'function' ? puSupplierNames(false) : [];
    const itemBox = d.item ? `<div class="fu-item"><span dir="ltr">${p ? dispNameHtml(p) : fuEsc(d.item)}</span>${edit && d.type === 'loan' && fuForm.old && fuForm.old.stockOut ? '' : '<button type="button" class="cn-x" onclick="fuClearItem()" aria-label="إزالة">✕</button>'}</div>`
        : `<input id="fuQ" class="fu-in" type="search" autocomplete="off" placeholder="ابحث عن المادة بالاسم أو اكتب اسمها" oninput="fuSearch()"><div id="fuRes" class="cn-resbox" style="display:none"></div>`;
    let fields;
    if (isP) fields = `
        <label class="fu-l">المندوب<input class="fu-in" list="fuReps" value="${fuEsc(d.rep)}" oninput="fuFld('rep',this.value)" onchange="fuRepPick(this.value)" placeholder="اسم المندوب"></label><datalist id="fuReps">${reps.map(g => `<option value="${fuEsc(g.name)}">`).join('')}</datalist>
        <div class="fu-two"><label class="fu-l">الشركة<input id="fuCo" class="fu-in" value="${fuEsc(d.company)}" oninput="fuFld('company',this.value)" placeholder="شركة الأدوية"></label>
        <label class="fu-l">الهاتف (اختياري)<input id="fuPh" class="fu-in" type="tel" inputmode="tel" value="${fuEsc(d.phone)}" oninput="fuFld('phone',this.value)"></label></div>
        <div class="fu-l">المادة المطلوب سحبها${itemBox}</div>
        <div class="fu-two"><label class="fu-l">الكمية المطلوب سحبها<input class="fu-in" type="number" inputmode="numeric" min="0" value="${fuEsc(d.qty)}" oninput="fuFld('qty',this.value)"></label>
        <label class="fu-l">المذخر الذي تسحب منه<input class="fu-in" list="fuSups" value="${fuEsc(d.supplier)}" oninput="fuFld('supplier',this.value)"></label></div><datalist id="fuSups">${sups.map(s => `<option value="${fuEsc(s)}">`).join('')}</datalist>
        <label class="fu-l">البونص الموعود<input class="fu-in" value="${fuEsc(d.bonus)}" oninput="fuFld('bonus',this.value)" placeholder="مثال: 2 علبة، أو خصم 10٪"></label>
        <div class="fu-two"><label class="fu-l">تاريخ الوعد<input class="fu-in" type="date" value="${fuEsc(d.date)}" onchange="fuFld('date',this.value)"></label>
        <div class="fu-l fu-sw"><span>تم سحب المادة بالفعل</span><label class="setup-sw"><input type="checkbox" ${d.pulled ? 'checked' : ''} onchange="fuFld('pulled',this.checked)"><i></i></label></div></div>`;
    else {
        const locked = edit && fuForm.old && fuForm.old.stockOut;
        fields = `
        <label class="fu-l">اسم الشخص أو الصيدلية<input class="fu-in" value="${fuEsc(d.person)}" oninput="fuFld('person',this.value)" placeholder="من أخذ المادة؟"></label>
        <div class="cu-seg fu-mode"><button type="button" class="${d.mode === 'item' ? 'on' : ''}" ${locked ? 'disabled' : ''} onclick="fuFld('mode','item');fuFormRender()">مادة بمادة</button><button type="button" class="${d.mode === 'amount' ? 'on' : ''}" ${locked ? 'disabled' : ''} onclick="fuFld('mode','amount');fuFormRender()">بمبلغ أو مواد مكافئة</button></div>
        <div class="fu-l">المادة المأخوذة${locked ? `<div class="fu-item"><span dir="ltr">${p ? dispNameHtml(p) : fuEsc(d.item)}</span></div>` : itemBox}</div>
        ${locked ? `<div class="bill-set-hint">الكمية والمادة مقفلتان لأنها خُصمت من المخزن. احذف السجل لإعادة الكمية ثم أنشئ غيره.</div>` : ''}
        <div class="fu-two"><label class="fu-l">العلب<input class="fu-in" type="number" inputmode="numeric" min="0" value="${fuEsc(d.qty)}" ${locked ? 'disabled' : ''} oninput="fuFld('qty',this.value)"></label>
        <label class="fu-l">الأجزاء${p && !hasRetail(p) ? ' (غير متاحة)' : ''}<input class="fu-in" type="number" inputmode="numeric" min="0" value="${fuEsc(d.loose)}" ${locked || (p && !hasRetail(p)) ? 'disabled' : ''} oninput="fuFld('loose',this.value)"></label></div>
        ${d.mode === 'amount' ? `<label class="fu-l">مبلغ المادة المتفق عليه (د.ع)<input class="fu-in" type="number" inputmode="decimal" min="0" value="${fuEsc(d.amount)}" oninput="fuFld('amount',this.value)"></label>` : ''}
        <label class="fu-l">التاريخ<input class="fu-in" type="date" value="${fuEsc(d.date)}" onchange="fuFld('date',this.value)"></label>
        ${!locked && d.pid && fuStockOk() ? `<div class="fu-l fu-sw"><span>خصم الكمية من المخزن الآن (وتعود عند الإعادة)</span><label class="setup-sw"><input type="checkbox" ${d.deduct !== false ? 'checked' : ''} onchange="fuFld('deduct',this.checked)"><i></i></label></div>` : ''}`;
    }
    document.getElementById('fuBox').innerHTML = `<div class="cn-head"><b>${isP ? (edit ? 'تعديل وعد' : 'وعد جديد') : (edit ? 'تعديل مادة مأخوذة' : 'مادة مأخوذة جديدة')}</b><span></span></div>
        <div class="cn-body fu-form">${fields}<label class="fu-l">ملاحظة (اختياري)<textarea class="fu-in fu-ta" rows="2" oninput="fuFld('note',this.value)">${fuEsc(d.note)}</textarea></label>
        <button type="button" class="cn-new" id="fuSaveBtn" onclick="fuSave()">حفظ</button></div>`;
}

// ---------- الحفظ ----------
const fuWarn = t => Swal.fire({ icon: 'warning', title: t, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
async function fuSave() {
    if (window.__fuSaving) return; window.__fuSaving = true; const sb = document.getElementById('fuSaveBtn'); if (sb) sb.disabled = true;
    try { await fuSave0(); } finally { window.__fuSaving = false; const b = document.getElementById('fuSaveBtn'); if (b) b.disabled = false; }
}
async function fuSave0() {
    const d = fuForm.d, isP = d.type === 'promise', old = fuForm.old || null;
    if (isP) { if (!String(d.rep).trim()) return fuWarn('اكتب اسم المندوب'); if (!String(d.item).trim()) return fuWarn('اختر المادة أو اكتب اسمها'); }
    else {
        if (!String(d.person).trim()) return fuWarn('اكتب اسم من أخذ المادة');
        if (d.mode === 'item' && !String(d.item).trim()) return fuWarn('اختر المادة المأخوذة');
        if (!(fuInt(d.qty) > 0 || fuInt(d.loose) > 0) && !(fuNum(d.amount) > 0)) return fuWarn('أدخل عدد العلب أو الأجزاء أو المبلغ');
    }
    if (!d.date) return fuWarn('اختر التاريخ');
    let rec;
    if (isP) {
        rec = { ...(old || {}), id: old ? old.id : fuId(), type: 'promise', rep: String(d.rep).trim(), company: String(d.company || '').trim(), phone: String(d.phone || '').trim(), pid: d.pid || null, item: String(d.item).trim(), qty: fuInt(d.qty), supplier: String(d.supplier || '').trim(), bonus: String(d.bonus || '').trim(), date: d.date, note: String(d.note || '').trim() };
        if (!old) { rec.status = d.pulled ? 'wait_bonus' : 'wait_pull'; if (d.pulled) rec.pulledAt = todayLocalISO(); rec.ts = new Date().toISOString(); rec.by = (typeof userName !== 'undefined' && userName) || 'المدير'; }
        else if (d.pulled && rec.status === 'wait_pull') { rec.status = 'wait_bonus'; rec.pulledAt = todayLocalISO(); }
        else if (!d.pulled && rec.status === 'wait_bonus') { rec.status = 'wait_pull'; delete rec.pulledAt; }
    } else {
        const p = d.pid ? products.find(x => x.id === d.pid) : null;
        rec = { ...(old || {}), id: old ? old.id : fuId(), type: 'loan', person: String(d.person).trim(), mode: d.mode, pid: d.pid || null, item: String(d.item || '').trim(), qty: fuInt(d.qty), loose: p && !hasRetail(p) ? 0 : fuInt(d.loose), amount: fuNum(d.amount), date: d.date, note: String(d.note || '').trim() };
        if (!old) { rec.status = 'open'; rec.ts = new Date().toISOString(); rec.by = (typeof userName !== 'undefined' && userName) || 'المدير'; }
        if (!old && p && d.deduct !== false && fuStockOk() && (rec.qty > 0 || rec.loose > 0)) {   // خصم من المخزن
            if (rec.qty > fuInt(p.qty)) { const c = await Swal.fire({ icon: 'warning', title: 'الكمية أكبر من المتوفر', text: `المتوفر ${fmtNum(fuInt(p.qty))} علبة. متابعة وجعل الرصيد سالباً؟`, showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38' }); if (!c.isConfirmed) return; }
            if (rec.loose > fuInt(p.loose)) return fuWarn('الأجزاء المتوفرة غير كافية');
            if (!(await fuStock(rec, -1))) return;
            rec.stockOut = true;
        }
    }
    const h = Prog.start('حفظ المتابعة', { text: 'جارٍ الحفظ...' });
    const ok = await fuPut(rec);
    ok ? h.ok('تم الحفظ') : h.fail('حُفظت على هذا الجهاز فقط', 'أضف قاعدة pharmacy_followups إلى قواعد Firestore.');
    fuForm = null; fuListRender(); fuBadge();
}
async function fuStock(rec, sign) {   // sign=-1 خصم، +1 إعادة
    const p = products.find(x => x.id === rec.pid); if (!p) return true;
    if (!writesAllowed()) return false;
    const q = fuInt(rec.qty) * sign, l = fuInt(rec.loose) * sign, from = { qty: p.qty, loose: p.loose };
    p.qty = fuInt(p.qty) + q; p.loose = fuInt(p.loose) + l;
    const ok = await saveProductsDelta([{ p, dq: q, dl: l }], { key: 'fu:' + rec.id + ':' + (sign < 0 ? 'out' : 'in') + ':' + Date.now().toString(36), kind: sign < 0 ? 'loan' : 'loan-return', inv: rec.id, no: rec.person || '' });
    if (!ok) { p.qty = from.qty; p.loose = from.loose; return false; }
    try { logAction('qty', p, [{ f: (sign < 0 ? 'مادة مأخوذة للتبديل: ' : 'إعادة مادة مأخوذة: ') + (rec.person || ''), from: String(fuInt(from.qty)), to: String(fuInt(p.qty)) }]); } catch (e) { /* تجاهل */ }
    return true;
}

// ---------- التفاصيل والإجراءات ----------
function fuDetail(id) {
    const r = fuAll.find(x => x.id === id); if (!r) return;
    const isP = r.type === 'promise', st = isP ? FU_PST[r.status] : FU_LST[r.status], late = fuOverdue(r);
    const rows = isP ? [['المندوب', r.rep], ['الشركة', r.company], ['الهاتف', r.phone ? `<a href="tel:${fuEsc(r.phone)}" dir="ltr">${fuEsc(r.phone)}</a>` : ''], ['المادة', r.item], ['الكمية المطلوب سحبها', r.qty ? fmtNum(r.qty) : ''], ['المذخر', r.supplier], ['البونص الموعود', r.bonus], ['تاريخ الوعد', fmtDateDMY(r.date)], ['تاريخ السحب', r.pulledAt ? fmtDateDMY(r.pulledAt) : ''], ['تاريخ الإنهاء', r.doneAt ? fmtDateDMY(r.doneAt) : ''], ['ملاحظة', r.note]]
        : [['الشخص', r.person], ['المادة', r.item], ['العلب', r.qty ? fmtNum(r.qty) : ''], ['الأجزاء', r.loose ? fmtNum(r.loose) : ''], ['المبلغ المتفق عليه', r.amount ? fmtNum(r.amount) + ' د.ع' : ''], ['خُصمت من المخزن', r.stockOut ? (r.status === 'open' ? 'نعم' : 'نعم وأُعيدت/سُوّيت') : 'لا'], ['التاريخ', fmtDateDMY(r.date)], ['تاريخ الإنهاء', r.doneAt ? fmtDateDMY(r.doneAt) : ''], ['التسوية', r.settle], ['ملاحظة', r.note]];
    const acts = [];
    if (isP) {
        if (r.status === 'wait_pull') acts.push(['pulled', 'تم سحب المادة', 'ok']);
        if (r.status === 'wait_pull' || r.status === 'wait_bonus') { if (r.status === 'wait_bonus') acts.push(['received', 'تم استلام البونص', 'ok']); acts.push(['failed', 'لم يُوفِ بالوعد', 'bad']); }
        else acts.push(['reopen', 'إعادة فتح', '']);
    } else {
        if (r.status === 'open') { acts.push(['returned', 'أُعيدت المادة', 'ok']); acts.push(['settled', 'سُوّيت بمبلغ أو مواد مكافئة', 'ok']); }
        else acts.push(['reopen', 'إعادة فتح', '']);
    }
    acts.push(['edit', 'تعديل', '']); acts.push(['del', 'حذف', 'bad']);
    Swal.fire({
        title: isP ? 'وعد بونص' : 'مادة مأخوذة', showConfirmButton: false, showCloseButton: true,
        html: `<div class="fu-det" dir="rtl"><div class="fu-st ${st ? st[1] : ''} fu-det-st">${late ? '⚠ متأخرة — ' : ''}${st ? st[0] : ''}</div>${rows.filter(x => x[1]).map(([k, v]) => `<div class="fu-dr"><span>${k}</span><b>${k === 'الهاتف' ? v : fuEsc(v)}</b></div>`).join('')}
        <div class="fu-acts">${acts.map(([k, l, c]) => `<button type="button" class="fu-ab ${c}" onclick="Swal.close();fuAct('${id}','${k}')">${l}</button>`).join('')}</div></div>`
    });
}
async function fuAct(id, a) {
    const r = fuAll.find(x => x.id === id); if (!r) return;
    const today = todayLocalISO(), sure = (title, text, btn, danger) => Swal.fire({ icon: 'warning', title, html: text, showCancelButton: true, confirmButtonText: btn, cancelButtonText: 'إلغاء', confirmButtonColor: danger ? '#b91c1c' : '#0f1c38', reverseButtons: true }).then(x => x.isConfirmed);
    if (a === 'edit') { fuScr = 'form'; return fuEdit(id); }
    const save = async rec => { const h = Prog.start('حفظ المتابعة', { text: 'جارٍ الحفظ...' }); const ok = await fuPut(rec); ok ? h.ok('تم الحفظ') : h.fail('حُفظت على هذا الجهاز فقط', 'أضف قاعدة pharmacy_followups إلى قواعد Firestore.'); if (fuOpenFlag && fuScr === 'list') fuListRender(); fuBadge(); };
    if (a === 'pulled') return save({ ...r, status: 'wait_bonus', pulledAt: today });
    if (a === 'received') return save({ ...r, status: 'received', doneAt: today });
    if (a === 'failed') { if (!(await sure('تسجيل أنه لم يُوفِ؟', `ستُسجَّل على المندوب <b>${fuEsc(r.rep)}</b> كوعد لم يتحقق.`, 'نعم، لم يُوفِ', true))) return; return save({ ...r, status: 'failed', doneAt: today }); }
    if (a === 'reopen') {
        if (r.type === 'loan' && r.stockOut && (r.status === 'returned') ) { if (!(await sure('إعادة فتح المادة؟', 'ستُخصم الكمية من المخزن مرة أخرى.', 'إعادة الفتح'))) return; if (!(await fuStock(r, -1))) return; }
        const n = { ...r, status: r.type === 'promise' ? (r.pulledAt ? 'wait_bonus' : 'wait_pull') : 'open' }; delete n.doneAt; delete n.settle; return save(n);
    }
    if (a === 'returned') {
        if (!(await sure('تأكيد إعادة المادة؟', r.stockOut ? 'ستُضاف الكمية إلى المخزن.' : 'لن تتغير كمية المخزن (لم تُخصم عند التسجيل).', 'تأكيد الإعادة'))) return;
        if (r.stockOut && !(await fuStock(r, +1))) return;
        return save({ ...r, status: 'returned', doneAt: today });
    }
    if (a === 'settled') {
        const x = await Swal.fire({ title: 'كيف تمت التسوية؟', input: 'text', inputValue: r.amount ? fmtNum(r.amount) + ' د.ع' : '', inputPlaceholder: 'مبلغ أو مواد مكافئة', showCancelButton: true, confirmButtonText: 'تأكيد التسوية', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', inputValidator: v => !String(v || '').trim() && 'اكتب طريقة التسوية' });
        if (!x.isConfirmed) return; return save({ ...r, status: 'settled', doneAt: today, settle: String(x.value).trim() });
    }
    if (a === 'del') {
        const back = r.type === 'loan' && r.stockOut && r.status === 'open';
        const x = await Swal.fire({ icon: 'warning', title: 'حذف هذا السجل؟', html: back ? 'المادة ما زالت مخصومة من المخزن. اختر ما تريد.' : 'لا يمكن التراجع عن الحذف.', showCancelButton: true, showDenyButton: back, confirmButtonText: back ? 'حذف وإعادة الكمية' : 'نعم، احذف', denyButtonText: 'حذف دون إعادة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', denyButtonColor: '#b45309', reverseButtons: true });
        if (!x.isConfirmed && !x.isDenied) return;
        if (back && x.isConfirmed && !(await fuStock(r, +1))) return;
        const h = Prog.start('حذف السجل', { text: 'جارٍ الحذف...' }); const ok = await fuRemove(id); ok ? h.ok('تم الحذف') : h.fail('تعذر الحذف من السحابة', 'سيُحذف عند توفر الاتصال.');
        if (fuOpenFlag && fuScr === 'list') fuListRender(); fuBadge();
    }
}

// ---------- الربط بالوارد ----------
// بعد حفظ فاتورة وارد جديدة: إن كان فيها مادة عليها وعد مفتوح نسأل عن تحديثه.
async function fuAfterPurchase(rec) {
    try {
        if (!fuAllowed() || !rec) return; fuLoadLocal();
        const lines = (rec.items || []).filter(l => l.applied !== false);
        const hit = [];
        fuAll.filter(r => r.type === 'promise' && fuIsOpen(r)).forEach(r => {
            const l = lines.find(x => r.pid ? x.pid === r.pid : false);
            if (l) hit.push({ r, l });
        });
        for (const { r, l } of hit) {
            const got = fuInt(l.bonus), isBonusInv = !!rec.gift;
            const askRecv = r.status === 'wait_bonus' || isBonusInv || got > 0;
            const html = `المادة: <b dir="ltr">${fuEsc(r.item)}</b><br>المندوب: <b>${fuEsc(r.rep)}</b>${r.company ? ' (' + fuEsc(r.company) + ')' : ''}<br>البونص الموعود: <b>${fuEsc(r.bonus || '—')}</b><br>في هذا الوارد: كمية <b>${fmtNum(fuInt(l.qty))}</b>${got ? ' + بونص <b>' + fmtNum(got) + '</b>' : ''}`;
            const x = await Swal.fire({ icon: 'info', title: 'هذه المادة عليها وعد بونص', html, showCancelButton: true, showDenyButton: true, confirmButtonText: askRecv && r.status === 'wait_bonus' ? 'تم استلام البونص' : 'تم السحب (بانتظار البونص)', denyButtonText: 'لم يُوفِ', cancelButtonText: 'تجاهل الآن', confirmButtonColor: '#0f766e', denyButtonColor: '#b91c1c' });
            if (x.isConfirmed) await fuPut({ ...r, ...(r.status === 'wait_bonus' ? { status: 'received', doneAt: todayLocalISO() } : { status: 'wait_bonus', pulledAt: todayLocalISO() }) });
            else if (x.isDenied) { const c = await Swal.fire({ icon: 'warning', title: 'تسجيل أنه لم يُوفِ؟', showCancelButton: true, confirmButtonText: 'نعم', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true }); if (c.isConfirmed) await fuPut({ ...r, status: 'failed', doneAt: todayLocalISO() }); }
        }
        fuBadge();
    } catch (e) { /* تجاهل */ }
}
