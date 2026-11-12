// ============================================================================
// المصروفات وصافي الربح (للمالك فقط)
// صافي الربح = الربح الإجمالي (من كلفة المواد المسجَّلة بالفواتير) − المصروفات.
// المصروفات في Firestore: pharmacy_expenses (للمالك فقط)، مع نسخة محلية.
// ============================================================================
const EX_LS = 'diwanExpenses', EX_CATS_LS = 'diwanExpCats';
const EX_DEF_CATS = ['إيجار', 'رواتب', 'كهرباء وماء', 'نقل وتوصيل', 'صيانة', 'مستلزمات', 'أخرى'];
let exAll = [], exTab = 'rep', exMode = 'month', exVal = '', exOpenFlag = false, exBusy = false;

const exNum = v => parseFloat(String(v || '').replace(/[,،\s]/g, '')) || 0;
function exCats() {
    let c = []; try { c = JSON.parse(lsGet(EX_CATS_LS)) || []; } catch (e) { c = []; }
    if (!c.length) c = EX_DEF_CATS.slice();
    exAll.forEach(e => { if (e.cat && !c.includes(e.cat)) c.push(e.cat); });
    return c;
}
function exCatsSave(c) { lsSet(EX_CATS_LS, JSON.stringify(c)); }
function exLocal() { try { return (JSON.parse(lsGet(EX_LS)) || []).filter(x => x && x.id); } catch (e) { return []; } }
function exStore() { lsSet(EX_LS, JSON.stringify(exAll)); }
async function exLoad() {
    const m = new Map(); exLocal().forEach(x => m.set(x.id, x));
    if (cloudReady() && navigator.onLine) {
        try { const snap = await db.collection('pharmacy_expenses').get(); snap.forEach(d => { const x = d.data(); if (x && x.id) m.set(x.id, x); }); } catch (e) { /* قد لا تكون القاعدة مضافة بعد */ }
    }
    exAll = [...m.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.ts || '').localeCompare(String(a.ts || '')));
    exStore();
}

// ---------- الفترة ----------
function exRange() {
    const t = todayLocalISO();
    if (!exVal) exVal = exMode === 'day' ? t : exMode === 'month' ? t.slice(0, 7) : t.slice(0, 4);
    if (exMode === 'day') return { from: exVal, to: exVal, label: fmtDateDMY(exVal) };
    if (exMode === 'month') { const [y, m] = exVal.split('-'); return { from: exVal + '-01', to: exVal + '-31', label: m + '/' + y }; }
    return { from: exVal + '-01-01', to: exVal + '-12-31', label: exVal };
}
function exInRange(d, r) { d = String(d || ''); return d >= r.from && d <= r.to; }

// ---------- حساب التقرير ----------
async function invEnsureSince(fromISO) {   // تحميل الفواتير من تاريخ معيّن (الافتراضي يحمّل آخر 300 فقط)
    const m = new Map(); (billAll || []).forEach(x => x && x.id && m.set(x.id, x));
    try { (JSON.parse(lsGet(BILL_LS.list)) || []).forEach(x => x && x.id && !m.has(x.id) && m.set(x.id, x)); } catch (e) { /* تجاهل */ }
    if (cloudReady() && navigator.onLine) {
        const snap = await db.collection('pharmacy_invoices').where('date', '>=', fromISO).get();
        snap.forEach(d => { const x = d.data(); if (x && x.id) m.set(x.id, x); });
    }
    billAll = [...m.values()].sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
}
function exCalc(r) {
    let sales = 0, cost = 0, costRev = 0, noCost = 0, n = 0; const days = new Map();
    (billAll || []).filter(b => b && b.issued && !b.cancelled && exInRange(b.date, r)).forEach(b => {
        n++; const sub = (b.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0), t = invTotalOf(b);
        sales += t; const d = days.get(b.date) || { sales: 0, profit: 0, exp: 0 }; d.sales += t;
        (b.items || []).forEach(it => {
            if (it.cost > 0) { const q = parseFloat(it.qty) || 0, rev = q * (parseFloat(it.price) || 0) * (sub > 0 ? t / sub : 1); cost += it.cost * q; costRev += rev; d.profit += rev - it.cost * q; } else noCost++;
        });
        days.set(b.date, d);
    });
    const exps = exAll.filter(e => exInRange(e.date, r)); let expTot = 0; const cats = new Map();
    exps.forEach(e => { const a = Number(e.amount) || 0; expTot += a; cats.set(e.cat || 'أخرى', (cats.get(e.cat || 'أخرى') || 0) + a); const d = days.get(e.date) || { sales: 0, profit: 0, exp: 0 }; d.exp += a; days.set(e.date, d); });
    const gross = costRev - cost;
    return { n, sales, cost, gross, noCost, expTot, net: gross - expTot, cats: [...cats.entries()].sort((a, b) => b[1] - a[1]), days: [...days.entries()].sort((a, b) => b[0].localeCompare(a[0])), exps };
}

// ---------- الواجهة ----------
function exEnsureDom() {
    if (document.getElementById('exOv')) return;
    const d = document.createElement('div'); d.id = 'exOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="exBox"></div>'; document.body.appendChild(d);
}
async function exOpen(tab) {
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'هذه الصفحة للمالك فقط.', confirmButtonColor: '#0f1c38' }); return; }
    exEnsureDom(); exTab = tab || 'rep'; exAll = exLocal();
    document.getElementById('exOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); exOpenFlag = true;
    exRender();
    await exRefresh();
}
function exClose() { const ov = document.getElementById('exOv'); if (ov) ov.style.display = 'none'; document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); exOpenFlag = false; }
async function exRefresh() {
    const r = exRange(), h = Prog.start('تحميل البيانات', { text: 'المصروفات والفواتير...', indeterminate: false });
    try { await exLoad(); h.set(40); await invEnsureSince(r.from); h.ok('تم التحميل'); } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); }
    if (exOpenFlag) exRender();
}
function exSetMode(m) { exMode = m; exVal = ''; exRefresh(); }
function exSetVal(v) { if (!v) return; exVal = v; exRefresh(); }
function exPeriodHtml() {
    const r = exRange(), t = todayLocalISO(), yrs = []; for (let y = +t.slice(0, 4); y >= +t.slice(0, 4) - 5; y--) yrs.push(y);
    const inp = exMode === 'day' ? `<input type="date" value="${exVal}" onchange="exSetVal(this.value)">` : exMode === 'month' ? `<input type="month" value="${exVal}" onchange="exSetVal(this.value)">` : `<select onchange="exSetVal(this.value)">${yrs.map(y => `<option ${String(y) === exVal ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
    return `<div class="cu-seg">${[['day', 'يومي'], ['month', 'شهري'], ['year', 'سنوي']].map(([k, l]) => `<button type="button" class="${exMode === k ? 'on' : ''}" onclick="exSetMode('${k}')">${l}</button>`).join('')}</div><div class="ex-per">${inp}</div>`;
}
function exRender() {
    const r = exRange(), c = exCalc(r);
    const tabs = `<div class="cu-seg"><button type="button" class="${exTab === 'rep' ? 'on' : ''}" onclick="exTab='rep';exRender()">صافي الربح</button><button type="button" class="${exTab === 'list' ? 'on' : ''}" onclick="exTab='list';exRender()">المصروفات</button></div>`;
    let body;
    if (exTab === 'rep') {
        const mx = Math.max(1, ...c.cats.map(x => x[1]));
        body = `<div class="ex-cards">
            <div><span>المبيعات (${c.n} فاتورة)</span><b>${fmtNum(c.sales)}</b></div>
            <div><span>كلفة البضاعة</span><b>${fmtNum(c.cost)}</b></div>
            <div><span>الربح الإجمالي</span><b>${fmtNum(c.gross)}</b></div>
            <div><span>المصروفات</span><b>${fmtNum(c.expTot)}</b></div>
            <div class="ex-net ${c.net >= 0 ? 'pos' : 'neg'}"><span>صافي الربح</span><b>${fmtNum(c.net)}</b></div></div>
            ${c.noCost ? `<div class="bill-set-hint">الربح الإجمالي محسوب من المواد التي لها سعر شراء فقط (${c.noCost} سطر بلا سعر شراء).</div>` : ''}
            ${c.cats.length ? `<div class="cu-h">المصروفات حسب التصنيف</div>` + c.cats.map(([k, v]) => `<div class="rep-bar"><span>${escapeHtml(k)}</span><i style="width:${Math.max(4, Math.round(v / mx * 100))}%"></i><b>${fmtNum(v)}</b></div>`).join('') : ''}
            ${exMode !== 'day' && c.days.length ? `<div class="cu-h">تفصيل الأيام</div><div class="ex-days"><div class="ex-dh"><span>اليوم</span><span>المبيعات</span><span>الربح</span><span>المصروف</span></div>${c.days.map(([d, v]) => `<div><span>${escapeHtml(fmtDateDMY(d))}</span><span>${fmtNum(v.sales)}</span><span>${fmtNum(v.profit)}</span><span>${v.exp ? fmtNum(v.exp) : ''}</span></div>`).join('')}</div>` : ''}
            <button type="button" class="cn-new ex-prt" onclick="exPrint()">طباعة التقرير</button>`;
    } else {
        body = `<button type="button" class="cn-new" onclick="exEdit('')">+ مصروف جديد</button>
            <div class="cu-sum"><span>مجموع المصروفات (${escapeHtml(r.label)})</span><b>${fmtNum(c.expTot)} د.ع</b><small>${c.exps.length} مصروف</small></div>
            ${c.exps.map(e => `<div class="cu-row" onclick="exEdit('${e.id}')"><div class="cu-av">${escapeHtml([...(e.cat || '؟')][0])}</div><div><b>${escapeHtml(e.cat || '')}</b><small>${escapeHtml(fmtDateDMY(e.date))}${e.note ? ' • ' + escapeHtml(e.note) : ''}</small></div><div class="cu-amt owe">${fmtNum(e.amount)}<small>د.ع</small></div></div>`).join('') || '<div class="cu-none">لا توجد مصروفات في هذه الفترة.</div>'}
            <button type="button" class="ex-cat" onclick="exCatsManage()">إدارة التصنيفات</button>`;
    }
    document.getElementById('exBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="exClose()" aria-label="رجوع">→</button><b>المصروفات وصافي الربح</b><span></span></div>
        <div class="cn-body">${tabs}${exPeriodHtml()}${body}</div>`;
}

// ---------- إضافة وتعديل وحذف ----------
async function exEdit(id) {
    const cur = id ? exAll.find(e => e.id === id) : null, cats = exCats();
    const r = await Swal.fire({
        title: cur ? 'تعديل مصروف' : 'مصروف جديد', showCancelButton: true, showDenyButton: !!cur, confirmButtonText: 'حفظ', denyButtonText: 'حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', denyButtonColor: '#b91c1c',
        html: `<div class="sw-form"><label>التاريخ<input id="exD" type="date" class="swal2-input" value="${escapeHtml(cur ? cur.date : (exMode === 'day' ? exVal : todayLocalISO()))}"></label>
            <label>التصنيف<select id="exC" class="swal2-input">${cats.map(c => `<option ${cur && cur.cat === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}<option value="__new">+ تصنيف جديد…</option></select></label>
            <label>المبلغ (د.ع)<input id="exA" type="number" inputmode="decimal" class="swal2-input" value="${cur ? cur.amount : ''}"></label>
            <label>ملاحظة (اختياري)<input id="exN" class="swal2-input" value="${escapeHtml(cur ? cur.note || '' : '')}"></label></div>`,
        preConfirm: () => {
            const a = exNum(document.getElementById('exA').value), d = document.getElementById('exD').value; let c = document.getElementById('exC').value;
            if (!(a > 0)) { Swal.showValidationMessage('أدخل مبلغاً صحيحاً'); return false; }
            if (!d) { Swal.showValidationMessage('اختر التاريخ'); return false; }
            return { a, d, c, n: document.getElementById('exN').value.trim() };
        }
    });
    if (r.isDenied) return exDel(id);
    if (!r.isConfirmed) return;
    if (r.value.c === '__new') {
        const n = await Swal.fire({ title: 'اسم التصنيف الجديد', input: 'text', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e' });
        const v = n.isConfirmed ? String(n.value || '').trim() : ''; if (!v) return; r.value.c = v;
    }
    const rec = cur ? { ...cur } : { id: 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), by: (typeof userName !== 'undefined' && userName) || 'المالك' };
    rec.date = r.value.d; rec.cat = r.value.c; rec.amount = r.value.a; rec.note = r.value.n; rec.upd = new Date().toISOString();
    const h = Prog.start('حفظ المصروف', { text: 'جارٍ الحفظ...' });
    try {
        exAll = exAll.filter(e => e.id !== rec.id); exAll.unshift(rec); exStore();
        const cs = exCats(); if (!cs.includes(rec.cat)) { cs.push(rec.cat); exCatsSave(cs); }
        if (cloudReady()) await fsSet(db.collection('pharmacy_expenses').doc(rec.id), rec);
        h.ok('تم الحفظ');
    } catch (e) { h.fail('حُفظ على هذا الجهاز فقط', 'أضف قاعدة pharmacy_expenses إلى قواعد Firestore. ' + (e.message || '')); }
    if (exOpenFlag) exRender();
}
async function exDel(id) {
    const cur = exAll.find(e => e.id === id); if (!cur) return;
    const c = await Swal.fire({ icon: 'warning', title: 'حذف المصروف؟', html: `${escapeHtml(cur.cat || '')} — <b>${fmtNum(cur.amount)} د.ع</b><br>لا يمكن التراجع عن الحذف.`, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء', reverseButtons: true });
    if (!c.isConfirmed) return;
    const h = Prog.start('حذف المصروف', { text: 'جارٍ الحذف...' });
    try { exAll = exAll.filter(e => e.id !== id); exStore(); if (cloudReady()) await fsWrite(db.collection('pharmacy_expenses').doc(id).delete()); h.ok('تم الحذف'); } catch (e) { h.fail('تعذر الحذف من السحابة', e.message || String(e)); }
    if (exOpenFlag) exRender();
}
async function exCatsManage() {
    const cats = exCats();
    const r = await Swal.fire({ title: 'تصنيفات المصروفات', showCancelButton: true, showDenyButton: true, confirmButtonText: 'إغلاق', denyButtonText: 'حذف تصنيف', cancelButtonText: 'إضافة تصنيف', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c', html: `<div class="ex-chips">${cats.map(c => `<span>${escapeHtml(c)}</span>`).join('')}</div>` });
    if (r.isDismissed && r.dismiss === Swal.DismissReason.cancel) {
        const n = await Swal.fire({ title: 'تصنيف جديد', input: 'text', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e' });
        const v = n.isConfirmed ? String(n.value || '').trim() : ''; if (v && !cats.includes(v)) { cats.push(v); exCatsSave(cats); }
        return exCatsManage();
    }
    if (r.isDenied) {
        const p = await Swal.fire({ title: 'اختر التصنيف للحذف', input: 'select', inputOptions: Object.fromEntries(cats.map((c, i) => [i, c])), showCancelButton: true, confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' });
        if (p.isConfirmed) {
            const name = cats[+p.value], used = exAll.filter(e => e.cat === name).length;
            const c = await Swal.fire({ icon: 'warning', title: 'حذف التصنيف؟', text: used ? `«${name}» مستخدم في ${used} مصروف؛ تبقى هذه المصروفات كما هي.` : `سيُحذف التصنيف «${name}».`, showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء', reverseButtons: true });
            if (c.isConfirmed) { const left = cats.filter(x => x !== name); exCatsSave(left.length ? left : EX_DEF_CATS.slice()); }
        }
        return exCatsManage();
    }
}

// ---------- الطباعة ----------
function exPrint() {
    const r = exRange(), c = exCalc(r);
    const html = lgLetterhead('تقرير صافي الربح', escapeHtml(r.label)) + `<div class="pu-tw"><table class="bill-table pu-mtable"><tbody>
        <tr><td>المبيعات (${c.n} فاتورة)</td><td>${fmtNum(c.sales)}</td></tr><tr><td>كلفة البضاعة</td><td>${fmtNum(c.cost)}</td></tr><tr><td>الربح الإجمالي</td><td>${fmtNum(c.gross)}</td></tr>
        <tr><td>المصروفات</td><td>${fmtNum(c.expTot)}</td></tr><tr><td><b>صافي الربح</b></td><td><b>${fmtNum(c.net)}</b></td></tr></tbody></table></div>` +
        (c.cats.length ? `<div class="pu-tw" style="margin-top:10px"><table class="bill-table pu-mtable"><thead><tr><th>التصنيف</th><th>المبلغ</th></tr></thead><tbody>${c.cats.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${fmtNum(v)}</td></tr>`).join('')}</tbody></table></div>` : '');
    openReport({ title: 'صافي الربح — ' + r.label, html, fileName: 'Al-Diwan-Pharmacy_Net-Profit_' + r.label.replace(/\//g, '-') });
}
