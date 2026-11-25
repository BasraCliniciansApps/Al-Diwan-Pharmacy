// ============================================================================
// النواقص والطلبية: قائمة مستقلة تماماً عن الفواتير. تقترح المواد الناقصة (نفاد/قلة/بيع سريع)،
// تحدد منها ما تريد، ثم تُصدر طلب شراء بمفرده (رقم، مذخر، تاريخ) ويُرسَل واتساب أو يُطبع.
// الحالة والطلبات الصادرة محفوظة على الجهاز (لا تلمس الفواتير ولا المخزن).
// ============================================================================
const ND_ST = 'diwanNeedState', ND_OR = 'diwanNeedOrders', ND_NO = 'diwanNeedNo', ND_HOLD_DAYS = 14;
const ND_CNT = 'diwanNdCounted';
const ndCountedOnly = () => { try { return localStorage.getItem(ND_CNT) !== '0'; } catch (e) { return true; } };
let ndOpenFlag = false, ndScr = 'list', ndTab = 'list', ndSupF = '', ndQ = '', ndSel = new Set(), ndAddRes = [], ndView = null;
const ndEsc = s => escapeHtml(String(s == null ? '' : s));
function ndState() { let s = {}; try { s = JSON.parse(lsGet(ND_ST)) || {}; } catch (e) { s = {}; } return { qty: s.qty || {}, off: s.off || {}, extra: s.extra || [], ordered: s.ordered || {}, custom: s.custom || [], cseq: s.cseq || 0 }; }
function ndSave(s) { lsSet(ND_ST, JSON.stringify(s)); }
function ndOrders() { try { return (JSON.parse(lsGet(ND_OR)) || []).filter(x => x && x.id); } catch (e) { return []; } }
function ndOrdersSave(a) { lsSet(ND_OR, JSON.stringify(a)); }
const ndAgo = iso => Math.max(0, Math.round((new Date(todayLocalISO() + 'T00:00:00') - new Date(String(iso).slice(0, 10) + 'T00:00:00')) / 864e5));

// ---------- بناء القائمة ----------
function ndList() {
    ndList.hid = 0; const cntOnly = ndCountedOnly();
    const st = ndState(), c = typeof spoCfg === 'function' ? spoCfg() : { on: false, weeks: 4, cover: 14 }, sold = c.on && typeof spoSold === 'function' ? spoSold(c) : new Map(), out = [], seen = new Set();
    const held = pid => { const o = st.ordered[pid]; return o && ndAgo(o.at) < ND_HOLD_DAYS; };
    products.forEach(p => {
        if (p.arch || st.off[p.id] || held(p.id)) return;
        const i = c.on && typeof spoInfo === 'function' ? spoInfo(p, sold, c) : { rate: 0, left: null, sug: 0 };
        const low = !isInStock(p) || isLowStock(p), fast = i.sug > 0 && i.left !== null && i.left < c.cover, manual = st.extra.includes(p.id);
        if (!low && !fast && !manual) return;
        if (!manual && cntOnly && p.counted !== true) { ndList.hid++; return; }   // غير مجرودة: كميتها غير موثوقة فلا تدخل القائمة التلقائية
        const dflt = i.sug > 0 ? i.sug : Math.max(getMinQty(p) * 2 - (parseInt(p.qty) || 0), 1);
        out.push({ p, i, qty: Math.max(1, parseInt(st.qty[p.id]) || dflt), manual: manual && !low && !fast, mine: manual, auto: (low || fast) && (!cntOnly || p.counted === true), out: !isInStock(p) });
        seen.add(p.id);
    });
    // مواد أضفتها يدوياً وهي غير موجودة بالمخزن (معرّفها سالب كي لا تتعارض مع معرّفات المخزن)
    st.custom.forEach(c => {
        if (st.off[c.id]) return;
        out.push({ p: { id: c.id, custom: true, name: c.name, brand: '' }, i: { rate: 0, left: null, sug: 0 }, qty: Math.max(1, parseInt(st.qty[c.id]) || 1), manual: true, mine: true, auto: false, out: false });
    });
    out.sort((a, b) => (b.out - a.out) || ((a.i.left === null ? 1e9 : a.i.left) - (b.i.left === null ? 1e9 : b.i.left)) || (parseInt(a.p.qty) || 0) - (parseInt(b.p.qty) || 0));
    return out;
}
const ndSupOf = p => (p.lastPurchase && p.lastPurchase.supplier) || '';
function ndBadge() {
    try {
        const el = document.getElementById('homePoCount'); if (!el) return;
        if (userRole !== 'owner' || currentView !== 'home') { el.style.display = 'none'; return; }
        const n = ndList().length; el.innerText = n; el.style.display = n ? 'flex' : 'none';
    } catch (e) { /* تجاهل */ }
}

// ---------- الإطار ----------
function ndEnsureDom() {
    if (document.getElementById('ndOv')) return;
    const d = document.createElement('div'); d.id = 'ndOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="ndBox"></div>'; document.body.appendChild(d);
    const pa = document.createElement('div'); pa.id = 'needPrint'; pa.setAttribute('dir', 'rtl'); document.body.appendChild(pa);
}
async function ndOpen() {
    if (userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'قائمة النواقص للمدير فقط.', confirmButtonColor: '#0f1c38' }); return; }
    ndEnsureDom(); document.getElementById('ndOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open');
    ndOpenFlag = true; ndScr = 'list'; ndTab = 'list'; ndSel = new Set(); ndQ = ''; ndSupF = '';
    ndRender();
    try { if (typeof puLoad === 'function' && !puSuppliers.length) await puLoad(); } catch (e) { /* تجاهل */ }
    try { if (typeof spoEnsure === 'function') { const c = spoCfg(); if (c.on) { await spoEnsure(c); if (ndOpenFlag && ndScr === 'list') ndRender(); } } } catch (e) { /* تجاهل */ }
}
function ndClose() {
    const ov = document.getElementById('ndOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); ndOpenFlag = false; ndScr = 'list'; ndView = null;
    ndBadge();
}
function ndBack() { if (ndScr !== 'list') { ndScr = 'list'; ndView = null; ndRender(); } else ndClose(); }
function ndRender() { if (ndScr === 'order') return ndOrderRender(); if (ndScr === 'add') return ndAddRender(); ndListRender(); }

// ---------- شاشة القائمة ----------
function ndRowsHtml(list) {
    return list.map(({ p, i, qty, manual, out }) => {
        const info = i.rate > 0 ? `يُباع ${Math.round(i.rate * 10) / 10} علبة/يوم • يكفي ${i.left < 1 ? 'أقل من يوم' : Math.floor(i.left) + ' يوماً'}` : (out ? 'نافدة' : 'كمية قليلة');
        return `<div class="nd-row ${ndSel.has(p.id) ? 'on' : ''}" data-id="${p.id}">
            <label class="nd-chk"><input type="checkbox" ${ndSel.has(p.id) ? 'checked' : ''} onchange="ndToggle(${p.id},this.checked)"><i></i></label>
            <div class="nd-main">${p.custom ? `<b dir="auto">${ndEsc(p.name)}</b><small>مادة خارج المخزن • مضافة يدوياً</small>` : `<b dir="ltr">${dispNameHtml(p)}</b><small>المتوفر: ${ndEsc(stockLabel(p))} • ${info}${ndSupOf(p) ? ' • ' + ndEsc(ndSupOf(p)) : ''}${manual && ndTab !== 'mine' ? ' • مضافة يدوياً' : ''}</small>`}</div>
            <div class="nd-qty"><button type="button" onclick="ndStep(${p.id},-1)" aria-label="إنقاص">−</button><input type="number" inputmode="numeric" min="1" value="${qty}" oninput="ndQty(${p.id},this.value)" onfocus="this.select()"><button type="button" onclick="ndStep(${p.id},1)" aria-label="زيادة">+</button></div>
            <button type="button" class="nd-x" onclick="${ndTab === 'mine' ? 'ndUnmine' : 'ndRemove'}(${p.id})" aria-label="إزالة من القائمة">✕</button></div>`;
    }).join('');
}
function ndFiltered() {
    let list = ndList().filter(x => ndTab === 'mine' ? x.mine : x.auto); const q = ndQ ? normSearch(ndQ) : '', toks = q ? q.split(' ') : [];
    if (ndSupF) list = list.filter(x => (ndSupF === '__none' ? !ndSupOf(x.p) : ndSupOf(x.p) === ndSupF));
    if (q) list = list.filter(x => x.p.custom ? toks.every(t => normSearch(x.p.name).includes(t)) : searchScore(x.p, q, toks) > 0);
    return list;
}
function ndListRender() {
    ndScr = 'list'; const all = ndList(), sups = [...new Set(all.map(x => ndSupOf(x.p)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), noSup = all.some(x => !ndSupOf(x.p));
    const orders = ndOrders(), openOrd = orders.filter(o => o.status !== 'received').length;
    const tabs = `<div class="cu-seg"><button type="button" class="${ndTab === 'list' ? 'on' : ''}" onclick="ndTab='list';ndRender()">النواقص (${fmtNum(all.filter(x => x.auto).length)})</button><button type="button" class="${ndTab === 'mine' ? 'on' : ''}" onclick="ndTab='mine';ndRender()">قائمتي (${fmtNum(all.filter(x => x.mine).length)})</button><button type="button" class="${ndTab === 'orders' ? 'on' : ''}" onclick="ndTab='orders';ndRender()">الطلبات الصادرة${openOrd ? ' (' + fmtNum(openOrd) + ')' : ''}</button></div>`;
    let body, bar = '';
    if (ndTab === 'orders') body = ndOrdersHtml(orders);
    else {
        const list = ndFiltered(), allOn = list.length && list.every(x => ndSel.has(x.p.id)), nSel = [...ndSel].filter(id => all.some(x => x.p.id === id)).length;
        const hid = ndTab === 'list' ? ndList.hid : 0;
        body = (ndTab === 'list' ? ndSetHtml(hid) : '<div class="bill-set-hint">قائمة تختار موادها بنفسك: لا تتغير تلقائياً.<br>أضف المادة بالزر ثم حدّد الكمية وأصدر الطلب.<br>يمكنك أيضاً إضافة مادة غير موجودة في المخزن.</div>') + `<div class="nd-tools"><select class="fu-in" onchange="ndSupF=this.value;ndRender()"><option value="">كل المذاخر</option>${sups.map(s => `<option value="${ndEsc(s)}" ${ndSupF === s ? 'selected' : ''}>${ndEsc(s)}</option>`).join('')}${noSup ? `<option value="__none" ${ndSupF === '__none' ? 'selected' : ''}>بلا مذخر معروف</option>` : ''}</select>
            <button type="button" class="nd-add" onclick="ndAddOpen()">+ إضافة مادة</button></div>
            <div class="fu-q"><input type="search" autocomplete="off" placeholder="بحث في القائمة" value="${ndEsc(ndQ)}" oninput="ndQ=this.value;ndRowsRedraw()"></div>
            <div class="nd-selall"><label class="nd-chk"><input type="checkbox" id="ndAll" ${allOn ? 'checked' : ''} onchange="ndSelAll(this.checked)"><i></i></label><span>تحديد الكل (${fmtNum(list.length)})</span></div>
            <div id="ndRows">${ndRowsHtml(list) || (ndTab === 'mine' ? '<div class="cu-none">قائمتك فارغة. أضف موادك بالزر أعلاه.</div>' : '<div class="cu-none">لا توجد مواد ناقصة 🎉</div>')}</div><div style="height:78px"></div>`;
        bar = `<div class="nd-bar"><button type="button" class="cn-new" id="ndIssueBtn" onclick="ndIssue()" ${nSel ? '' : 'disabled'}>${nSel ? 'إصدار طلب بـ ' + fmtNum(nSel) + ' مادة' : 'حدّد المواد لإصدار الطلب'}</button></div>`;
    }
    document.getElementById('ndBox').innerHTML = `<div class="cn-head"><b>🛒 النواقص والطلبية</b><span></span></div><div class="cn-body">${tabs}${body}</div>${bar}`;
}
function ndRowsRedraw() { const b = document.getElementById('ndRows'); if (b) b.innerHTML = ndRowsHtml(ndFiltered()) || '<div class="cu-none">لا توجد نتائج.</div>'; }
function ndBarRefresh() {
    const all = new Set(ndList().map(x => x.p.id)), n = [...ndSel].filter(id => all.has(id)).length, b = document.getElementById('ndIssueBtn');
    if (b) { b.disabled = !n; b.innerText = n ? 'إصدار طلب بـ ' + fmtNum(n) + ' مادة' : 'حدّد المواد لإصدار الطلب'; }
    const a = document.getElementById('ndAll'); if (a) { const l = ndFiltered(); a.checked = !!l.length && l.every(x => ndSel.has(x.p.id)); }
}
function ndToggle(id, on) { on ? ndSel.add(id) : ndSel.delete(id); const r = document.querySelector('.nd-row[data-id="' + id + '"]'); if (r) r.classList.toggle('on', on); ndBarRefresh(); }
function ndSelAll(on) { ndFiltered().forEach(x => on ? ndSel.add(x.p.id) : ndSel.delete(x.p.id)); ndRowsRedraw(); ndBarRefresh(); }
function ndQty(id, v) { const s = ndState(); s.qty[id] = Math.max(1, parseInt(v) || 1); ndSave(s); }
function ndStep(id, d) { const s = ndState(), row = document.querySelector('.nd-row[data-id="' + id + '"] input[type=number]'), cur = Math.max(1, parseInt(row ? row.value : s.qty[id]) || 1), n = Math.max(1, cur + d); s.qty[id] = n; ndSave(s); if (row) row.value = n; }
async function ndRemove(id) {
    const p = products.find(x => x.id === id);
    const r = await Swal.fire({ icon: 'warning', title: 'إزالة من القائمة؟', html: `<span dir="ltr">${p ? ndEsc(dispName(p)) : ''}</span><br><small>لن تُقترح مرة أخرى حتى تعيدها بالإضافة اليدوية.</small>`, showCancelButton: true, confirmButtonText: 'نعم، إزالة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true });
    if (!r.isConfirmed) return;
    const s = ndState(); s.off[id] = 1; s.extra = s.extra.filter(x => x !== id); ndSave(s); ndSel.delete(id); ndRender(); ndBadge();
}

// ---------- إعدادات اعتبار المادة ناقصة ----------
function ndSetHtml(hid) {
    const c = typeof spoCfg === 'function' ? spoCfg() : null, opt = (arr, cur, f) => arr.map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${f(x)}</option>`).join('');
    return `<details class="nd-set"><summary>⚙ متى تُعدّ المادة ناقصة؟</summary>
        <div class="nd-set-b">
        <div class="fu-l fu-sw"><span>إظهار المواد المجرودة فقط</span><label class="setup-sw"><input type="checkbox" ${ndCountedOnly() ? 'checked' : ''} onchange="ndCountedSet(this.checked)"><i></i></label></div>
        ${hid ? `<div class="bill-set-hint">${ndCountedOnly() ? 'مخفية الآن: ' + fmtNum(hid) + ' مادة غير مجرودة، لأن كمياتها غير موثوقة.' : ''}</div>` : ''}
        <label class="fu-l">الحد العام: المادة ناقصة إذا بقي منها (علب) أو أقل
        <input class="fu-in" type="number" inputmode="numeric" min="0" value="${fuIntSafe(lowStockThreshold)}" onchange="ndLowSet(this.value)"></label>
        <div class="nd-hint">لمادة بعينها حدّ خاص بها: افتح المادة وعدّل حقل «تنبيه عند (علب)».</div>
        ${c ? `<div class="nd-hint">وتُعدّ ناقصة أيضاً إذا كان رصيدها يكفي أقل من المدة التالية بحسب سرعة بيعها:</div>
        <div class="fu-two"><label class="fu-l">مدة التغطية<select class="fu-in" onchange="ndSpoSet('cover',+this.value)">${opt([7, 14, 21, 30], c.cover, x => x + ' يوماً')}</select></label>
        <label class="fu-l">قياس المبيعات<select class="fu-in" onchange="ndSpoSet('weeks',+this.value)">${opt([2, 4, 8, 12], c.weeks, x => 'آخر ' + x + ' أسابيع')}</select></label></div>` : ''}
        </div></details>`;
}
const fuIntSafe = v => parseInt(v) || 0;
function ndCountedSet(on) { try { localStorage.setItem(ND_CNT, on ? '1' : '0'); } catch (e) { /* تجاهل */ } ndSel = new Set(); ndRender(); ndBadge(); }
function ndLowSet(v) {
    const n = parseInt(v); if (isNaN(n) || n < 0) { Swal.fire({ icon: 'warning', title: 'أدخل رقماً صحيحاً (0 أو أكثر)', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); ndRender(); return; }
    const el = document.getElementById('lowThresholdInput'); if (el) el.value = n;
    lowStockThreshold = n; try { localStorage.setItem('diwanLowThreshold', String(n)); } catch (e) { /* تجاهل */ }
    try { pushToCloud(true); } catch (e) { /* تجاهل */ }
    Swal.fire({ icon: 'success', title: 'تم حفظ الحد العام', toast: true, position: 'bottom', showConfirmButton: false, timer: 1500 });
    ndRender(); ndBadge();
}
async function ndSpoSet(k, v) {
    const c = spoCfg(); c[k] = v; spoSave(c);
    const h = Prog.start('تحديث النواقص', { text: 'جارٍ احتساب المبيعات...' });
    try { await spoEnsure(c); h.ok('تم التحديث'); } catch (e) { h.fail('تعذر التحديث', e.message || String(e)); }
    if (ndOpenFlag && ndScr === 'list') ndRender(); ndBadge();
}
async function ndUnmine(id) {
    const p = products.find(x => x.id === id), cu = ndState().custom.find(x => x.id === id);
    const r = await Swal.fire({ icon: 'warning', title: 'إزالة من قائمتك؟', html: `<span dir="auto">${cu ? ndEsc(cu.name) : (p ? ndEsc(dispName(p)) : '')}</span>`, showCancelButton: true, confirmButtonText: 'نعم، إزالة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true });
    if (!r.isConfirmed) return;
    const s = ndState(); s.extra = s.extra.filter(x => x !== id); s.custom = s.custom.filter(x => x.id !== id); delete s.qty[id]; ndSave(s); ndSel.delete(id); ndRender(); ndBadge();
}

// ---------- إضافة مادة يدوياً ----------
function ndAddOpen() { ndScr = 'add'; ndAddRes = []; ndAddRender(); }
function ndAddRender() {
    document.getElementById('ndBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="ndBack()" aria-label="رجوع">→</button><b>إضافة مادة للقائمة</b><span></span></div><div class="cn-body">
        <input id="ndAddQ" class="fu-in" type="search" autocomplete="off" placeholder="ابحث بالاسم أو الباركود" oninput="ndAddSearch()"><div id="ndAddRes" style="margin-top:10px"></div></div>`;
    setTimeout(() => { const i = document.getElementById('ndAddQ'); if (i) i.focus(); }, 80);
}
function ndAddSearch() {
    const q = normSearch(document.getElementById('ndAddQ').value), box = document.getElementById('ndAddRes'); if (!q) { box.innerHTML = ''; return; }
    const toks = q.split(' '), st = ndState();
    ndAddRes = products.filter(p => !p.arch).map(p => [p, searchScore(p, q, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 15).map(x => x[0]);
    box.innerHTML = ndAddRes.map(p => `<button type="button" class="cn-res" onclick="ndAddPick(${p.id})"><span dir="ltr">${dispNameHtml(p)}</span><em>${ndEsc(stockLabel(p))}</em></button>`).join('') || `<div class="bill-noresult">المادة غير موجودة في المخزن<button type="button" class="pu-newprod" onclick="ndAddCustom(decodeURIComponent('${encodeURIComponent(document.getElementById('ndAddQ').value.trim())}'))">➕ إضافة «${ndEsc(document.getElementById('ndAddQ').value.trim())}» إلى القائمة</button></div>`;
}
function ndAddPick(id) {
    const s = ndState(); delete s.off[id]; delete s.ordered[id]; if (!s.extra.includes(id)) s.extra.push(id); ndSave(s); ndSel.add(id);
    Swal.fire({ icon: 'success', title: 'أُضيفت إلى القائمة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
    ndScr = 'list'; ndTab = 'mine'; ndSupF = ''; ndQ = ''; ndRender();
}

// إضافة مادة غير موجودة في المخزن: اسم وكمية فقط، وتبقى في «قائمتي» حتى تُصدر في طلب
async function ndAddCustom(name) {
    name = String(name || '').trim().replace(/\s+/g, ' '); if (!name) return;
    const s = ndState(), key = normSearch(name); let c = s.custom.find(x => normSearch(x.name) === key);
    if (!c) { s.cseq = (s.cseq || 0) + 1; c = { id: -s.cseq, name }; s.custom.push(c); }
    delete s.off[c.id]; if (!s.qty[c.id]) s.qty[c.id] = 1; ndSave(s); ndSel.add(c.id);
    Swal.fire({ icon: 'success', title: 'أُضيفت إلى القائمة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 });
    ndScr = 'list'; ndTab = 'mine'; ndSupF = ''; ndQ = ''; ndRender(); ndBadge();
}

// ---------- إصدار الطلب ----------
async function ndIssue() {
    const ids = new Set(ndSel), items = ndList().filter(x => ids.has(x.p.id)); if (!items.length) return;
    const sups = typeof puSupplierNames === 'function' ? puSupplierNames(true) : [];
    const guess = ndSupF && ndSupF !== '__none' ? ndSupF : (() => { const c = new Map(); items.forEach(x => { const s = ndSupOf(x.p); if (s) c.set(s, (c.get(s) || 0) + 1); }); return [...c.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || ''; })();
    const r = await Swal.fire({
        title: 'إصدار طلب شراء', confirmButtonText: 'إصدار الطلب', showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', reverseButtons: true,
        html: `<div dir="rtl" style="text-align:right;display:grid;gap:10px"><div style="font-size:.86rem;color:#475569">عدد المواد: <b>${fmtNum(items.length)}</b></div>
            <label class="fu-l">المذخر<input id="ndSupIn" class="fu-in" list="ndSupDl" value="${ndEsc(guess)}" placeholder="اسم المذخر"></label><datalist id="ndSupDl">${sups.map(s => `<option value="${ndEsc(s)}">`).join('')}</datalist>
            <label class="fu-l">ملاحظة (اختياري)<input id="ndNoteIn" class="fu-in" placeholder="مثال: التوصيل صباحاً"></label></div>`,
        preConfirm: () => ({ supplier: document.getElementById('ndSupIn').value.trim(), note: document.getElementById('ndNoteIn').value.trim() })
    });
    if (!r.isConfirmed) return;
    const no = (parseInt(lsGet(ND_NO)) || 0) + 1; lsSet(ND_NO, String(no));
    const o = { id: 'nd' + Date.now().toString(36), no: 'ط-' + String(no).padStart(4, '0'), date: todayLocalISO(), at: new Date().toISOString(), supplier: r.value.supplier, note: r.value.note, status: 'sent', items: items.map(x => ({ pid: x.p.id, name: x.p.custom ? x.p.name : dispName(x.p), brand: x.p.brand || '', qty: x.qty })) };
    const all = ndOrders(); all.unshift(o); ndOrdersSave(all);
    const s = ndState(); items.forEach(x => { s.ordered[x.p.id] = { oid: o.id, at: o.at }; s.extra = s.extra.filter(e => e !== x.p.id); s.custom = s.custom.filter(e => e.id !== x.p.id); delete s.qty[x.p.id]; ndSel.delete(x.p.id); }); ndSave(s);
    ndView = o.id; ndScr = 'order'; ndRender(); ndBadge();
}

// ---------- عرض الطلب ----------
function ndSupPhone(name) {
    try { const k = typeof puKey === 'function' ? puKey(name) : String(name).trim(); const s = (puSuppliers || []).find(x => (typeof puKey === 'function' ? puKey(x.name) : x.name) === k); let d = String((s && s.phone) || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '964' + d.slice(1); return d; } catch (e) { return ''; }
}
function ndText(o) {
    const m = typeof getInvMeta === 'function' ? getInvMeta() : {};
    return `طلب شراء — صيدلية الديوان\nرقم الطلب: ${o.no}\nالتاريخ: ${fmtDateDMY(o.date)}${o.supplier ? '\nإلى: ' + o.supplier : ''}\n\n` + o.items.map((x, i) => `${i + 1}) ${x.name} × ${x.qty}`).join('\n') + (o.note ? '\n\nملاحظة: ' + o.note : '') + (m.phone ? '\n\nهاتف الصيدلية: ' + m.phone : '');
}
function ndOrderRender() {
    const o = ndOrders().find(x => x.id === ndView); if (!o) { ndScr = 'list'; return ndListRender(); }
    const done = o.status === 'received';
    document.getElementById('ndBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="ndBack()" aria-label="رجوع">→</button><b>${ndEsc(o.no)}</b><span>${done ? 'مستلم' : 'بانتظار الاستلام'}</span></div>
        <div class="cn-body"><div class="nd-ohead"><div><span>المذخر</span><b>${ndEsc(o.supplier || '—')}</b></div><div><span>التاريخ</span><b>${ndEsc(fmtDateDMY(o.date))}</b></div><div><span>المواد</span><b>${fmtNum(o.items.length)}</b></div></div>
        ${o.note ? `<div class="bill-set-hint">ملاحظة: ${ndEsc(o.note)}</div>` : ''}
        <div class="nd-items">${o.items.map((x, i) => `<div class="nd-it"><em>${i + 1}</em><b dir="ltr">${ndEsc(x.name)}</b><span>× ${fmtNum(x.qty)}</span></div>`).join('')}</div>
        <div class="fu-acts"><button type="button" class="fu-ab ok" onclick="ndSendWa('${o.id}')">إرسال واتساب</button><button type="button" class="fu-ab" onclick="ndPrint('${o.id}')">طباعة</button>
        <button type="button" class="fu-ab" onclick="ndCopy('${o.id}')">نسخ النص</button>${done ? `<button type="button" class="fu-ab" onclick="ndReopen('${o.id}')">إعادة فتح</button>` : `<button type="button" class="fu-ab ok" onclick="ndReceive('${o.id}')">تم الاستلام</button>`}
        <button type="button" class="fu-ab bad" style="grid-column:1/3" onclick="ndDelOrder('${o.id}')">حذف الطلب</button></div></div>`;
}
function ndOrdersHtml(orders) {
    return orders.map(o => `<div class="cu-row fu-row" onclick="ndView='${o.id}';ndScr='order';ndRender()"><div class="cu-av fu-av ${o.status === 'received' ? 'ok' : 'wb'}">🛒</div>
        <div><b>${ndEsc(o.no)} • ${ndEsc(o.supplier || 'بلا مذخر')}</b><small>${ndEsc(fmtDateDMY(o.date))} • ${fmtNum(o.items.length)} مادة</small></div><div class="fu-st ${o.status === 'received' ? 'ok' : 'wb'}">${o.status === 'received' ? 'مستلم' : 'بانتظار الاستلام'}</div></div>`).join('') || '<div class="cu-none">لم تُصدر أي طلبات بعد.</div>';
}
function ndSendWa(id) {
    const o = ndOrders().find(x => x.id === id); if (!o) return; const ph = ndSupPhone(o.supplier);
    window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(ndText(o)), '_blank');
}
async function ndCopy(id) {
    const o = ndOrders().find(x => x.id === id); if (!o) return;
    try { await navigator.clipboard.writeText(ndText(o)); Swal.fire({ icon: 'success', title: 'تم النسخ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1400 }); }
    catch (e) { Swal.fire({ title: 'انسخ النص', html: `<textarea class="fu-in fu-ta" rows="8" readonly>${ndEsc(ndText(o))}</textarea>`, confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' }); }
}
function ndPrint(id) {
    const o = ndOrders().find(x => x.id === id); if (!o) return; const m = typeof getInvMeta === 'function' ? getInvMeta() : {};
    document.getElementById('needPrint').innerHTML = `<div class="np-sheet"><h1>طلب شراء</h1><div class="np-meta"><div>صيدلية الديوان${m.addr ? ' — ' + ndEsc(m.addr) : ''}${m.phone ? '<br>هاتف: <bdi dir="ltr">' + ndEsc(m.phone) + '</bdi>' : ''}</div>
        <div>رقم الطلب: <b>${ndEsc(o.no)}</b><br>التاريخ: ${ndEsc(fmtDateDMY(o.date))}${o.supplier ? '<br>إلى: <b>' + ndEsc(o.supplier) + '</b>' : ''}</div></div>
        <table><thead><tr><th>#</th><th>المادة</th><th>الشركة</th><th>الكمية</th></tr></thead><tbody>${o.items.map((x, i) => `<tr><td>${i + 1}</td><td dir="ltr" style="text-align:left">${ndEsc(x.name)}</td><td dir="ltr">${ndEsc(x.brand)}</td><td>${fmtNum(x.qty)}</td></tr>`).join('')}</tbody></table>
        ${o.note ? `<p>ملاحظة: ${ndEsc(o.note)}</p>` : ''}</div>`;
    document.body.classList.add('printing-need');
    const PEV = (window.NAT && NAT.is) ? 'diwan-afterprint' : 'afterprint';
    const done = () => { document.body.classList.remove('printing-need'); window.removeEventListener(PEV, done); };
    window.addEventListener(PEV, done);
    setTimeout(() => { window.print(); if (!(window.NAT && NAT.is)) setTimeout(done, 1500); }, 60);
}
function ndFree(o) { const s = ndState(); o.items.forEach(x => { if (s.ordered[x.pid] && s.ordered[x.pid].oid === o.id) delete s.ordered[x.pid]; }); ndSave(s); }
async function ndReceive(id) {
    const all = ndOrders(), o = all.find(x => x.id === id); if (!o) return;
    const r = await Swal.fire({ icon: 'question', title: 'تأكيد الاستلام؟', text: 'تُعتبر المواد مستلمة، وتعود للقائمة إن بقيت ناقصة.', showCancelButton: true, confirmButtonText: 'تم الاستلام', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', reverseButtons: true });
    if (!r.isConfirmed) return; o.status = 'received'; ndOrdersSave(all); ndFree(o); ndRender(); ndBadge();
}
function ndReopen(id) { const all = ndOrders(), o = all.find(x => x.id === id); if (!o) return; o.status = 'sent'; ndOrdersSave(all); const s = ndState(); o.items.forEach(x => { s.ordered[x.pid] = { oid: o.id, at: new Date().toISOString() }; }); ndSave(s); ndRender(); }
async function ndDelOrder(id) {
    const all = ndOrders(), o = all.find(x => x.id === id); if (!o) return;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا الطلب؟', html: `${ndEsc(o.no)} — ${ndEsc(o.supplier || '')}<br><small>تعود مواده للقائمة إن بقيت ناقصة. لا يمكن التراجع.</small>`, showCancelButton: true, confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true });
    if (!r.isConfirmed) return; ndFree(o); ndOrdersSave(all.filter(x => x.id !== id)); ndScr = 'list'; ndView = null; ndTab = 'orders'; ndRender(); ndBadge();
}
// عند حفظ وارد جديد: المواد الواصلة تخرج من «قيد الطلب» وتُغلق الطلبات المكتملة
function ndAfterPurchase(rec) {
    try {
        const pids = new Set((rec.items || []).map(l => l.pid).filter(Boolean)); if (!pids.size) return;
        const s = ndState(); let ch = false; Object.keys(s.ordered).forEach(k => { if (pids.has(parseInt(k))) { delete s.ordered[k]; ch = true; } }); if (ch) ndSave(s);
        const all = ndOrders(); let c2 = false;
        all.forEach(o => { if (o.status !== 'received' && o.items.every(x => !s.ordered[x.pid])) { o.status = 'received'; c2 = true; } });
        if (c2) ndOrdersSave(all);
    } catch (e) { /* تجاهل */ }
}
setTimeout(() => { try { ndBadge(); } catch (e) { /* تجاهل */ } }, 3000);
setInterval(() => { try { ndBadge(); } catch (e) { /* تجاهل */ } }, 60000);
