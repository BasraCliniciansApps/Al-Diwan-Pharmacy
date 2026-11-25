// ============================================================================
// المصروفات وصافي الربح (للمدير فقط)
// صافي الربح = الربح الإجمالي (من كلفة المواد المسجَّلة بالفواتير) − المصروفات.
// المصروفات في Firestore: pharmacy_expenses (للمدير فقط)، مع نسخة محلية.
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
        try { const r1 = await cloudDelta('ex', 'pharmacy_expenses', m.size > 0, 3, 24, c => c); if (r1) r1.snap.forEach(d => { const x = d.data(); if (x && x.id) m.set(x.id, x); }); } catch (e) { /* قد لا تكون القاعدة مضافة بعد */ }
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
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'هذه الصفحة للمدير فقط.', confirmButtonColor: '#0f1c38' }); return; }
    exEnsureDom(); exTab = tab || 'rep'; exAll = exLocal(); try { cuLoadLocal(); } catch (e) { /* تجاهل */ }
    document.getElementById('exOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); exOpenFlag = true;
    exRender();
    await exRefresh();
}
function exClose() { const ov = document.getElementById('exOv'); if (ov) ov.style.display = 'none'; document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); exOpenFlag = false; }
async function exRefresh() {
    const r = exRange(), h = Prog.start('تحميل البيانات', { text: 'المصروفات والفواتير...', indeterminate: false });
    try { await exLoad(); h.set(40); await invEnsureSince(exTab === 'dash' ? sdFrom() : r.from); h.ok('تم التحميل'); } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); }
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
    const tabs = `<div class="cu-seg"><button type="button" class="${exTab === 'dash' ? 'on' : ''}" onclick="exTab='dash';exRefresh()">لوحة المبيعات</button><button type="button" class="${exTab === 'rep' ? 'on' : ''}" onclick="exTab='rep';exRefresh()">صافي الربح</button><button type="button" class="${exTab === 'list' ? 'on' : ''}" onclick="exTab='list';exRender()">المصروفات</button></div>`;
    let body;
    if (exTab === 'dash') {
        document.getElementById('exBox').innerHTML = `<div class="cn-head"><b>📊 لوحة المبيعات</b></div><div class="cn-body">${tabs}${sdHtml()}</div>`; return;
    }
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
    document.getElementById('exBox').innerHTML = `<div class="cn-head"><b>💰 المصروفات وصافي الربح</b></div>
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
    const rec = cur ? { ...cur } : { id: 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), by: (typeof userName !== 'undefined' && userName) || 'المدير' };
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


// ============================================================================
// لوحة المبيعات (للمدير): بطاقات مع مقارنة بالفترة السابقة، رسوم SVG محلية، وقوائم قرار.
// الربح من كلفة المواد المسجَّلة بالفاتورة فقط (المواد بلا كلفة لا تدخل حساب الربح).
// ============================================================================
let sdN = 30;
const SD_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
function sdAdd(iso, n) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function sdFrom() { return sdAdd(todayLocalISO(), -(2 * sdN - 1)); }
function sdSet(n) { sdN = n; exRefresh(); }
function sdCalc() {
    const today = todayLocalISO(), curFrom = sdAdd(today, -(sdN - 1)), prevFrom = sdAdd(today, -(2 * sdN - 1)), prevTo = sdAdd(today, -sdN);
    const mk = () => ({ sales: 0, n: 0, profit: 0, costRev: 0, owed: 0, noCost: 0, days: new Map(), hours: new Array(24).fill(0), wd: new Array(7).fill(0), items: new Map(), sold: new Set(), emp: new Map(), dept: new Map(), gross: 0, disc: 0, discN: 0 });
    const cur = mk(), prev = mk();
    (billAll || []).forEach(b => {
        if (!b || !b.issued || b.cancelled) return; const d = String(b.date || '');
        const g = d >= curFrom && d <= today ? cur : d >= prevFrom && d <= prevTo ? prev : null; if (!g) return;
        const sub = (b.items || []).reduce((a, it) => a + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0), t = invTotalOf(b);
        g.sales += t; g.n++; g.owed += invRemaining(b); g.days.set(d, (g.days.get(d) || { s: 0, p: 0 })); g.days.get(d).s += t;
        if (g === cur) {
            const nm = String(b.by || 'غير معروف'), e = g.emp.get(nm) || { name: nm, n: 0, sales: 0, disc: 0, gross: 0, dn: 0 }; e.n++; e.sales += t; e.gross += sub; e.disc += sub - t; if (sub - t > 0.5) e.dn++; g.emp.set(nm, e);
            g.gross += sub; g.disc += sub - t; if (sub - t > 0.5) g.discN++;
        }
        if (g === cur) { const dt = b.issuedTs ? new Date(b.issuedTs) : null; if (dt && !isNaN(dt)) g.hours[dt.getHours()] += 1; g.wd[(new Date(d + 'T12:00:00').getDay() + 1) % 7] += t; }
        (b.items || []).forEach(it => {
            const q = parseFloat(it.qty) || 0, rev = q * (parseFloat(it.price) || 0) * (sub > 0 ? t / sub : 1);
            if (it.pid) g.sold.add(it.pid);
            if (it.cost > 0) { const pr = rev - it.cost * q; g.profit += pr; g.costRev += rev; g.days.get(d).p += pr; } else g.noCost++;
            if (g === cur) { const pp = it.pid ? products.find(x => x.id === it.pid) : null, dn = (pp && pp.department) || 'غير مصنّف', de = g.dept.get(dn) || { name: dn, rev: 0, profit: 0, costRev: 0 }; de.rev += rev; if (it.cost > 0) { de.profit += rev - it.cost * q; de.costRev += rev; } g.dept.set(dn, de); }
            if (g === cur) { const k = it.pid ? 'p' + it.pid : 'n' + (it.name || ''), e = g.items.get(k) || { name: it.name || '—', pid: it.pid || null, q: 0, rev: 0, profit: 0, costRev: 0, costed: 0 }; e.q += q; e.rev += rev; if (it.cost > 0) { e.profit += rev - it.cost * q; e.costRev += rev; e.costed++; } g.items.set(k, e); }
        });
    });
    return { cur, prev, curFrom, today };
}
const sdDelta = (a, b) => { if (!(b > 0)) return a > 0 ? '<i class="sd-d up">جديد</i>' : ''; const p = Math.round((a - b) / b * 100); return p === 0 ? '<i class="sd-d">0%</i>' : `<i class="sd-d ${p > 0 ? 'up' : 'dn'}">${p > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(p))}%</i>`; };
function sdLine(c, pr) {   // خط المبيعات (يومياً) مع خط الربح ومنقّط للفترة السابقة
    const days = []; for (let i = 0; i < sdN; i++) days.push(sdAdd(c.today, -(sdN - 1 - i)));
    const sv = days.map(d => (c.cur.days.get(d) || { s: 0 }).s), pv = days.map(d => (c.cur.days.get(d) || { p: 0 }).p), qv = days.map((d, i) => (c.prev.days.get(sdAdd(d, -sdN)) || { s: 0 }).s);
    const mx = Math.max(1, ...sv, ...qv), W = 340, H = 150, L = 6, R = 6, T = 10, B = 20, x = i => W - R - (W - L - R) * (sdN > 1 ? i / (sdN - 1) : 0.5), y = v => T + (H - T - B) * (1 - Math.max(0, v) / mx);
    const path = a => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const area = path(sv) + ` L${x(sdN - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
    const top = sv.indexOf(Math.max(...sv));
    return `<svg class="sd-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="مبيعات يومية"><defs><linearGradient id="sdG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f766e" stop-opacity=".28"/><stop offset="1" stop-color="#0f766e" stop-opacity="0"/></linearGradient></defs>
        ${[0, 1, 2].map(k => `<line class="sd-grid" x1="${L}" x2="${W - R}" y1="${T + (H - T - B) * k / 2}" y2="${T + (H - T - B) * k / 2}"/>`).join('')}
        <path d="${area}" fill="url(#sdG)"/><path class="sd-prev" d="${path(qv)}"/><path class="sd-ln" d="${path(sv)}"/>${pv.some(v => v) ? `<path class="sd-pr" d="${path(pv.map(v => Math.max(0, v)))}"/>` : ''}
        ${sv[top] > 0 ? `<circle class="sd-dot" cx="${x(top).toFixed(1)}" cy="${y(sv[top]).toFixed(1)}" r="3.4"/>` : ''}
        <text class="sd-tx" x="${W - R}" y="${H - 5}" text-anchor="end">${escapeHtml(fmtDateDMY(days[0]))}</text><text class="sd-tx" x="${L}" y="${H - 5}" text-anchor="start">${escapeHtml(fmtDateDMY(days[sdN - 1]))}</text></svg>
        <div class="sd-leg"><span><i class="l1"></i>المبيعات</span>${pv.some(v => v) ? '<span><i class="l2"></i>الربح</span>' : ''}<span><i class="l3"></i>الفترة السابقة</span></div>
        ${sv[top] > 0 ? `<div class="sd-note">أعلى يوم: ${escapeHtml(fmtDateDMY(days[top]))} بمبلغ ${fmtNum(sv[top])} د.ع</div>` : ''}`;
}
function sdBars(vals, labels, fmt) {   // أعمدة عمودية: الأعلى 3 بلون مميّز
    const mx = Math.max(1, ...vals), rank = [...vals].map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(x => x[0] > 0).map(x => x[1]);
    return `<div class="sd-bars" style="--n:${vals.length}">${vals.map((v, i) => `<div class="sd-bc"><b>${v ? fmt(v) : ''}</b><i class="${rank.includes(i) ? 'hi' : ''}" style="height:${Math.max(v ? 4 : 1, Math.round(v / mx * 100))}%"></i><span>${labels[i]}</span></div>`).join('')}</div>`;
}
function sdHBar(name, v, mx, sub) { return `<div class="sd-hb"><div class="sd-hh"><span dir="auto">${escapeHtml(name)}</span><b>${fmtNum(Math.round(v))}</b></div><div class="sd-ht"><i style="width:${Math.max(3, Math.round(v / mx * 100))}%"></i></div>${sub ? `<small>${escapeHtml(sub)}</small>` : ''}</div>`; }
function sdHtml() {
    const c = sdCalc(), A = c.cur, P = c.prev, pers = [7, 30, 90];
    const avg = A.n ? A.sales / A.n : 0, avgP = P.n ? P.sales / P.n : 0, mar = A.costRev > 0 ? A.profit / A.costRev * 100 : null;
    const cash = Math.max(0, A.sales - A.owed), cashPct = A.sales > 0 ? Math.round(cash / A.sales * 100) : 0;
    const items = [...A.items.values()];
    const topProfit = items.filter(e => e.costed).sort((a, b) => b.profit - a.profit).slice(0, 8);
    const low = items.filter(e => e.costed && e.costRev > 0 && e.profit / e.costRev < 0.1 && e.rev > 0).sort((a, b) => a.profit / a.costRev - b.profit / b.costRev).slice(0, 6);
    const dead = products.filter(p => !p.arch && (parseInt(p.qty) || 0) > 0 && !A.sold.has(p.id)).map(p => ({ p, v: (parseInt(p.qty) || 0) * (parseFloat(p.costPrice) || 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 8);
    const hrs = A.hours, h0 = hrs.findIndex(v => v > 0), h1 = hrs.length - 1 - [...hrs].reverse().findIndex(v => v > 0), hv = h0 < 0 ? [] : hrs.slice(h0, h1 + 1), hl = hv.map((_, i) => { const h = h0 + i, ap = h >= 12 ? 'م' : 'ص'; return fmtNum(h % 12 === 0 ? 12 : h % 12) + ap; });
    const peak = hv.length ? h0 + hv.indexOf(Math.max(...hv)) : -1;
    const nWd = new Array(7).fill(0); for (let i = 0; i < sdN; i++) nWd[(new Date(sdAdd(c.today, -i) + 'T12:00:00').getDay() + 1) % 7]++;
    const wdAvg = A.wd.map((v, i) => nWd[i] ? v / nWd[i] : 0), bestWd = wdAvg.indexOf(Math.max(...wdAvg));
    const emps = [...A.emp.values()].sort((a, b) => b.sales - a.sales), empMx = Math.max(1, ...emps.map(e => e.sales));
    const depts = [...A.dept.values()].filter(d => d.rev > 0).sort((a, b) => b.rev - a.rev).slice(0, 8), deptMx = Math.max(1, ...depts.map(d => d.rev));
    const row = (n, a, b) => `<div class="rep-row"><span dir="auto">${escapeHtml(n)}</span><small>${a}</small><b>${b}</b></div>`;
    return `<div class="cn-chips fu-chips">${pers.map(n => `<button type="button" class="cn-chip ${sdN === n ? 'on' : ''}" onclick="sdSet(${n})">${n === 7 ? '7 أيام' : n + ' يوماً'}</button>`).join('')}</div>
        <div class="sd-cards">
        <div><span>صافي المبيعات</span><b>${fmtNum(A.sales)}</b>${sdDelta(A.sales, P.sales)}</div>
        <div><span>الربح التقديري</span><b>${A.costRev > 0 ? fmtNum(A.profit) : '—'}</b>${A.costRev > 0 ? sdDelta(A.profit, P.profit) : ''}${mar !== null ? `<small>هامش ${fmtNum(Math.round(mar * 10) / 10)}%</small>` : ''}</div>
        <div><span>عدد الفواتير</span><b>${fmtNum(A.n)}</b>${sdDelta(A.n, P.n)}</div>
        <div><span>متوسط الفاتورة</span><b>${fmtNum(Math.round(avg))}</b>${sdDelta(avg, avgP)}</div></div>
        ${A.noCost ? `<div class="bill-set-hint">الربح محسوب من المواد التي لها سعر شراء فقط (${fmtNum(A.noCost)} سطر بلا سعر شراء).</div>` : ''}
        <div class="cu-h">المبيعات اليومية</div><div class="sd-box">${sdLine(c)}</div>
        <div class="cu-h">النقد والآجل</div><div class="sd-box"><div class="sd-pay"><i style="width:${cashPct}%"></i></div><div class="sd-leg"><span><i class="l1"></i>نقد ${fmtNum(cash)} (${fmtNum(cashPct)}%)</span><span><i class="l4"></i>آجل ${fmtNum(A.owed)}</span></div></div>
        ${hv.length ? `<div class="cu-h">ساعات الازدحام (عدد الفواتير)</div><div class="sd-box">${sdBars(hv, hl, v => fmtNum(v))}<div class="sd-note">ذروة الازدحام: ${fmtNum(peak % 12 === 0 ? 12 : peak % 12)} ${peak >= 12 ? 'مساءً' : 'صباحاً'}</div></div>` : ''}
        ${A.sales > 0 ? `<div class="cu-h">متوسط المبيعات حسب اليوم</div><div class="sd-box">${sdBars(wdAvg.map(Math.round), SD_DAYS.map(d => d.replace('ال', '')), v => v >= 1e6 ? fmtNum(Math.round(v / 1e5) / 10) + ' مليون' : fmtNum(Math.round(v / 1000)) + ' ألف')}<div class="sd-note">أفضل يوم: ${SD_DAYS[bestWd]}</div></div>` : ''}
        ${emps.length ? `<div class="cu-h">مبيعات الموظفين</div><div class="sd-box">${emps.map(e => sdHBar(e.name, e.sales, empMx, fmtNum(e.n) + ' فاتورة • متوسط ' + fmtNum(Math.round(e.sales / e.n)))).join('')}</div>` : ''}
        ${depts.length ? `<div class="cu-h">المبيعات حسب القسم</div><div class="sd-box">${depts.map(d => sdHBar(d.name, d.rev, deptMx, (A.sales > 0 ? fmtNum(Math.round(d.rev / A.sales * 100)) + '% من المبيعات' : '') + (d.costRev > 0 ? ' • ربح ' + fmtNum(Math.round(d.profit)) : ''))).join('')}</div>` : ''}
        ${A.disc > 0.5 ? `<div class="cu-h">الخصومات</div><div class="sd-cards sd-c3"><div><span>إجمالي الخصومات</span><b>${fmtNum(Math.round(A.disc))}</b>${sdDelta(A.disc, P.disc)}</div><div><span>نسبتها من المبيعات</span><b>${fmtNum(Math.round(A.disc / A.gross * 1000) / 10)}%</b></div><div><span>فواتير بخصم</span><b>${fmtNum(A.discN)}</b><small>من ${fmtNum(A.n)}</small></div></div>${emps.filter(e => e.disc > 0.5).length > 1 ? '<div class="sd-box">' + emps.filter(e => e.disc > 0.5).sort((a, b) => b.disc / b.gross - a.disc / a.gross).map(e => sdHBar(e.name, e.disc, Math.max(...emps.map(x => x.disc)), fmtNum(Math.round(e.disc / e.gross * 1000) / 10) + '% من مبيعاته • ' + fmtNum(e.dn) + ' فاتورة')).join('') + '</div>' : ''}` : ''}
        ${topProfit.length ? `<div class="cu-h">الأكثر ربحاً (الربح بالدينار)</div>${topProfit.map(e => row(e.name, '× ' + fmtNum(Math.round(e.q * 10) / 10), fmtNum(Math.round(e.profit)))).join('')}` : ''}
        ${low.length ? `<div class="cu-h">هامش منخفض (أقل من 10%)</div>${low.map(e => row(e.name, fmtNum(Math.round(e.profit / e.costRev * 1000) / 10) + '%', fmtNum(Math.round(e.profit)))).join('')}<div class="sd-note">الهامش السالب يعني البيع بأقل من سعر الشراء.</div>` : ''}
        ${dead.length ? `<div class="cu-h">راكدة: لم تُبع خلال ${fmtNum(sdN)} يوماً</div>${dead.map(x => row(dispName(x.p), 'المتوفر: ' + escapeHtml(stockLabel(x.p)), fmtNum(Math.round(x.v)))).join('')}<div class="sd-note">الرقم الأخير قيمة المخزون الراكد بسعر الشراء.</div>` : ''}
        ${!A.n ? '<div class="cu-none">لا توجد مبيعات في هذه المدة.</div>' : ''}`;
}
