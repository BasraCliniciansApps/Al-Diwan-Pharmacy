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
        const snap = invOwnOnly() ? await invOwnCloud() : await db.collection('pharmacy_invoices').where('date', '>=', fromISO).get();
        snap.forEach(d => { const x = d.data(); if (x && x.id) m.set(x.id, x); });
    }
    billAll = invScope([...m.values()]).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
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
    try { await exLoad(); h.set(40); if ((exTab === 'need' || exTab === 'need2') && typeof puLoad === 'function') { try { await puLoad(); } catch (e) { /* تجاهل */ } if (exTab === 'need2' && typeof lgLoad === 'function') { try { await lgLoad(); } catch (e) { /* تجاهل */ } } }
    const fr = exTab === 'dash' ? sdFrom() : exTab === 'need' ? ndmFrom() : exTab === 'need2' ? todayLocalISO() : r.from; if (!(window.__exInvFrom && window.__exInvFrom <= fr && Date.now() - (window.__exInvAt || 0) < 30 * 60000)) { await invEnsureSince(fr); window.__exInvFrom = fr; window.__exInvAt = Date.now(); } h.ok('تم التحميل'); } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); }
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
    const tabs = `<div class="cu-seg"><button type="button" class="${exTab === 'dash' ? 'on' : ''}" onclick="exTab='dash';exRefresh()">المبيعات</button><button type="button" class="${exTab === 'need' || exTab === 'need2' ? 'on' : ''}" onclick="exTab='need';exRefresh()">تقدير الاحتياج</button><button type="button" class="${exTab === 'rep' ? 'on' : ''}" onclick="exTab='rep';exRefresh()">صافي الربح</button><button type="button" class="${exTab === 'list' ? 'on' : ''}" onclick="exTab='list';exRender()">المصروفات</button></div>`;
    let body;
    if (exTab === 'need' || exTab === 'need2') {
        const sub = `<div class="cu-seg"><button type="button" class="${exTab === 'need' ? 'on' : ''}" onclick="exTab='need';exRefresh()">من المبيعات</button><button type="button" class="${exTab === 'need2' ? 'on' : ''}" onclick="exTab='need2';exRefresh()">من الوارد</button></div>`;
        document.getElementById('exBox').innerHTML = `<div class="cn-head"><b>📦 تقدير الاحتياج</b></div><div class="cn-body">${tabs}${sub}${exTab === 'need' ? ndmHtml() : ndwHtml()}</div>`; return;
    }
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


// ============================================================================
// تقدير الاحتياج (للمدير): معدل طلب كل مادة من المبيعات الفعلية (الصادر) مع تصحيح نفاد المخزون وإضافة الطلبات غير الملبّاة.
// الأسلوب: تصنيف نمط الطلب (Syntetos–Boylan: ADI وCV²)؛ للمنتظم والمتذبذب متوسط مرجّح بالحداثة (نصف عمر 3 أسابيع)،
// وللمتقطع والكتلي Croston بتصحيح SBA؛ ثم مخزون أمان بحسب فئة ABC، ونقطة إعادة الطلب = الطلب خلال (التوريد + دورة الطلب) + الأمان.
// الوارد يدخل في «قيد الطلب» وفي تصحيح النفاد؛ مدة التوريد ودورة الطلب إعدادان قابلان للتعديل.
// ============================================================================
let ndmF = 'order', ndmShow = 60, ndmQ = '';
const ndmMed = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const ndmDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
function ndmAuto() {   // مدة التوريد ودورة الطلب من سجلات المخزن نفسها (يوم الإدخال هو يوم الاستلام): بلا إدخال يدوي
    const recs = (typeof puAll !== 'undefined' ? puAll : []).filter(r => r && !r.cancelled && !r.gift && !r.stmt && (r.items || []).length), day = r => String(r.createdTs || r.date || '').slice(0, 10);
    const ds = [...new Set(recs.map(day).filter(Boolean))].sort(), gaps = []; for (let i = 1; i < ds.length; i++) { const g = ndmDays(ds[i - 1], ds[i]); if (g > 0) gaps.push(g); }
    const rev = gaps.length >= 4 ? Math.min(30, Math.max(1, Math.round(ndmMed(gaps)))) : 7, lead = [];
    try { if (typeof ndOrders === 'function') ndOrders().forEach(o => { const pids = new Set((o.items || []).map(x => x.pid)), od = String(o.date || '').slice(0, 10); let best = null; recs.forEach(r => { const d = day(r); if (d >= od && ndmDays(od, d) <= 30 && (r.items || []).some(l => pids.has(l.pid)) && (!best || d < best)) best = d; }); if (best) lead.push(ndmDays(od, best)); }); } catch (e) { /* تجاهل */ }
    const L = lead.length >= 3 ? Math.min(30, Math.max(0, Math.round(ndmMed(lead)))) : 3;
    return { lead: L, rev, nLead: lead.length, nRev: gaps.length, leadAuto: lead.length >= 3, revAuto: gaps.length >= 4 };
}
function ndmCfg() { return { weeks: 12, ...ndmAuto() }; }
function ndmFrom() { return sdAdd(todayLocalISO(), -(12 * 7 - 1)); }
function ndmPattern(adi, cv2) { return adi < 1.32 ? (cv2 < 0.49 ? ['منتظم', 'smooth'] : ['متذبذب', 'erratic']) : (cv2 < 0.49 ? ['متقطع', 'inter'] : ['كتلي', 'lumpy']); }
// ---------- الصلاحية في تقدير الاحتياج ----------
// المنتهية لا تُحتسب من المتوفر. القريبة: ضمن أقصر مدة تنبيه (شهر افتراضياً). المهدّدة بالتلف: كمية لن تُباع قبل نفاذ دفعتها بمعدل الاستهلاك المقدّر (الأقدم نفاذاً يُباع أولاً).
function ndxExpiry(p, rate) {
    const out = { expired: 0, nearBoxes: 0, nearDays: null, risk: 0, flag: false };
    try {
        const sc = btSc(p), nearD = (alertMonths[0] || 1) * 30, riskD = (alertMonths[2] || 6) * 30; let cum = 0;
        getBatches(p).filter(b => b.e).forEach(b => {
            const boxes = (b.q || 0) + (sc > 1 ? (b.l || 0) / sc : 0), d = expiryDaysOf(b.e); if (d === null || !(boxes > 0)) return;
            if (d <= 0) { out.expired += boxes; return; }
            if (d <= nearD) { out.nearBoxes += boxes; out.nearDays = out.nearDays === null ? d : Math.min(out.nearDays, d); }
            if (d <= riskD) out.risk += Math.max(0, boxes - Math.max(0, rate * d - cum));
            cum += boxes;
        });
        out.flag = out.expired > 0 || out.nearBoxes > 0 || out.risk > 0.5;
    } catch (e) { /* تجاهل */ }
    return out;
}
function ndxTag(ex) {
    if (!ex || !ex.flag) return '';
    const f = v => fmtNum(Math.round(v * 10) / 10), t = [];
    if (ex.expired > 0) t.push(`<small style="color:#b91c1c">منتهية الصلاحية: ${f(ex.expired)} علبة (لا تُحتسب من المتوفر)</small>`);
    if (ex.nearBoxes > 0) t.push(`<small style="color:#b91c1c">تنتهي خلال ${fmtNum(ex.nearDays)} يوماً: ${f(ex.nearBoxes)} علبة</small>`);
    if (ex.risk > 0.5) t.push(`<small style="color:#b45309">قد يتلف ${f(ex.risk)} علبة قبل بيعها بمعدل الاستهلاك المقدّر</small>`);
    return t.join('');
}
function ndxDetailRows(ex) {
    if (!ex || !ex.flag) return '';
    const f = v => fmtNum(Math.round(v * 10) / 10);
    return (ex.expired > 0 ? `<div class="fu-dr"><span>منتهية الصلاحية</span><b>${f(ex.expired)}</b></div>` : '') + (ex.nearBoxes > 0 ? `<div class="fu-dr"><span>تنتهي قريباً</span><b>${f(ex.nearBoxes)} خلال ${fmtNum(ex.nearDays)} يوماً</b></div>` : '') + (ex.risk > 0.5 ? `<div class="fu-dr"><span>مهدّدة بالتلف</span><b>${f(ex.risk)}</b></div>` : '');
}
function ndmCalc() {
    const cfg = ndmCfg(), today = todayLocalISO(), from = sdAdd(today, -(cfg.weeks * 7 - 1)), Z = { A: 2.05, B: 1.65, C: 1.28 };
    const sales = new Map(), rev = new Map(); let totRev = 0;
    (billAll || []).forEach(b => {
        if (!b || !b.issued || b.cancelled) return; const d = String(b.date || ''); if (d < from || d > today) return;
        (b.items || []).forEach(it => {
            if (!it.pid) return; const p = products.find(x => x.id === it.pid), q = parseFloat(it.qty) || 0; if (!(q > 0)) return;
            const boxes = it.unit === 'part' && p && hasRetail(p) ? q / subCountOf(p) : q;
            let m = sales.get(it.pid); if (!m) { m = new Map(); sales.set(it.pid, m); } m.set(d, (m.get(d) || 0) + boxes);
            const v = q * (parseFloat(it.price) || 0); rev.set(it.pid, (rev.get(it.pid) || 0) + v); totRev += v;
        });
    });
    const miss = new Map(); try { (fmAll.length ? fmAll : fmLocal()).forEach(r => { const d = String(r.date || ''); if (r.pid && d >= from && d <= today) { let m = miss.get(r.pid); if (!m) { m = new Map(); miss.set(r.pid, m); } m.set(d, (m.get(d) || 0) + 1); } }); } catch (e) { /* تجاهل */ }
    const onOrd = new Map(); try { if (typeof ndOrders === 'function') ndOrders().filter(o => o.status !== 'received').forEach(o => (o.items || []).forEach(x => onOrd.set(x.pid, (onOrd.get(x.pid) || 0) + (parseFloat(x.qty) || 0)))); } catch (e) { /* تجاهل */ }
    // فئات ABC بحسب الإيراد
    const abc = new Map(); let cum = 0; [...rev.entries()].sort((a, b) => b[1] - a[1]).forEach(([pid, v]) => { const before = cum / (totRev || 1); cum += v; abc.set(pid, before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C'); });
    const rows = [], pids = new Set([...sales.keys(), ...miss.keys()]);
    pids.forEach(pid => {
        const p = products.find(x => x.id === pid); if (!p || p.arch) return;
        const sm = sales.get(pid) || new Map(), mm = miss.get(pid) || new Map(), ds = [...sm.keys(), ...mm.keys()].sort(), first = ds[0], last = ds[ds.length - 1];
        const stock = (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0);
        let st = first < sdAdd(today, -13) ? (first > from ? first : from) : sdAdd(today, -13), en = stock <= 0 && last < today ? last : today;
        if (en < sdAdd(st, 6)) en = sdAdd(st, 6) > today ? today : sdAdd(st, 6);
        const n = Math.max(7, Math.round((new Date(en + 'T12:00:00') - new Date(st + 'T12:00:00')) / 864e5) + 1), x = new Array(n).fill(0);
        const put = (d, v) => { let i = Math.round((new Date(d + 'T12:00:00') - new Date(st + 'T12:00:00')) / 864e5); i = Math.min(n - 1, Math.max(0, i)); x[i] += v; };
        sm.forEach((v, d) => put(d, v)); mm.forEach((v, d) => put(d, v));
        const nz = x.filter(v => v > 0); if (!nz.length) return;
        const adi = n / nz.length, mean = nz.reduce((a, b) => a + b, 0) / nz.length, cv2 = nz.length > 1 ? nz.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nz.length / (mean * mean) : 0, pat = ndmPattern(adi, cv2);
        let rate;
        if (adi < 1.32) { let sw = 0, sv = 0; x.forEach((v, i) => { const w = Math.pow(0.5, (n - 1 - i) / 21); sw += w; sv += w * v; }); rate = sv / sw; }
        else { const al = 0.1; let z = 0, pp = 0, q = 1, init = false; x.forEach((v, i) => { if (v > 0) { if (!init) { z = v; pp = i + 1; init = true; } else { z = al * v + (1 - al) * z; pp = al * q + (1 - al) * pp; } q = 1; } else q++; }); rate = (1 - al / 2) * z / pp; }
        const wk = []; for (let e = n; e - 7 >= 0; e -= 7) wk.push(x.slice(e - 7, e).reduce((a, b) => a + b, 0));
        let sdw; if (wk.length >= 3) { const mw = wk.reduce((a, b) => a + b, 0) / wk.length; sdw = Math.sqrt(wk.reduce((a, b) => a + (b - mw) * (b - mw), 0) / (wk.length - 1)); } else sdw = Math.sqrt(Math.max(rate * 7, 0));
        const mw = rate * 7, ci = { w80: [Math.max(0, mw - 1.28 * sdw), mw + 1.28 * sdw], w95: [Math.max(0, mw - 1.96 * sdw), mw + 1.96 * sdw], m80: [Math.max(0, rate * 30 - 1.28 * sdw * Math.sqrt(30 / 7)), rate * 30 + 1.28 * sdw * Math.sqrt(30 / 7)], m95: [Math.max(0, rate * 30 - 1.96 * sdw * Math.sqrt(30 / 7)), rate * 30 + 1.96 * sdw * Math.sqrt(30 / 7)] };
        const cls = abc.get(pid) || 'C', T = cfg.lead + cfg.rev, ss = Z[cls] * sdw * Math.sqrt(T / 7), rop = rate * cfg.lead + ss, tgt = rate * T + ss, ex = ndxExpiry(p, rate), pos = stock - ex.expired + (onOrd.get(pid) || 0);
        const status = pos <= rop ? 'order' : pos <= rop + rate * cfg.rev ? 'soon' : (rate > 0 && pos > tgt + rate * 30) ? 'over' : 'ok';
        rows.push({ p, ex, ci, wks: wk.length, cls, pat, rate, stock, ord: onOrd.get(pid) || 0, ss, rop, tgt, status, sug: Math.max(0, Math.ceil(tgt - pos - 1e-9)), cover: rate > 0 ? stock / rate : null, nz: nz.length, n, miss: [...mm.values()].reduce((a, b) => a + b, 0), conf: nz.length >= 8 ? 'جيدة' : nz.length >= 4 ? 'متوسطة' : 'ضعيفة' });
    });
    const ord = { order: 0, soon: 1, ok: 2, over: 3 };
    return { cfg, rows: rows.sort((a, b) => ord[a.status] - ord[b.status] || (a.cover == null ? 1e9 : a.cover) - (b.cover == null ? 1e9 : b.cover)) };
}
const NDM_ST = { order: ['اطلب الآن', 'bad'], soon: ['قريباً', 'wb'], ok: ['كافٍ', 'ok'], over: ['فائض', ''] };
function ndmRow(r, i) {
    const st = NDM_ST[r.status], wk = Math.round(r.rate * 70) / 10;
    return `<div class="cu-row fu-row" onclick="ndmDetail(${i})"><div class="cu-av fu-av ${r.cls === 'A' ? 'ok' : r.cls === 'B' ? 'wb' : ''}">${r.cls}</div>
        <div><b dir="ltr">${dispNameHtml(r.p)}</b><small>${r.pat[0]} • الطلب ${fmtNum(wk)} علبة/أسبوع (${fmtNum(Math.round(r.ci.w80[0]))}–${fmtNum(Math.round(r.ci.w80[1]))}) • المتوفر ${fmtNum(Math.round(r.stock * 10) / 10)}${r.ord ? ' + قيد الطلب ' + fmtNum(r.ord) : ''}</small><small>${r.cover == null ? '' : 'يكفي ' + (r.cover < 1 ? 'أقل من يوم' : fmtNum(Math.floor(r.cover)) + ' يوماً')} • البيانات ${r.conf}</small>${ndxTag(r.ex)}</div>
        <div class="fu-st ${st[1]}">${r.status === 'order' || r.status === 'soon' ? (r.sug ? 'اطلب ' + fmtNum(r.sug) : st[0]) : st[0]}</div></div>`;
}
let ndmRows = [];
function ndmHtml() {
    const c = ndmCalc(); ndmRows = c.rows; const cfg = c.cfg, cnt = k => c.rows.filter(r => r.status === k).length;
    const opt = (arr, cur, f) => arr.map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${f(x)}</option>`).join('');
    const chips = [['order', 'اطلب الآن'], ['soon', 'قريباً'], ['over', 'فائض'], ['exp', 'نفاذ قريب (' + fmtNum(c.rows.filter(r => r.ex && r.ex.flag).length) + ')'], ['all', 'الكل']];
    const nOrd = cnt('order');
    return `<div class="sd-cards sd-c3"><div><span>اطلب الآن</span><b>${fmtNum(nOrd)}</b></div><div><span>قريباً</span><b>${fmtNum(cnt('soon'))}</b></div><div><span>فائض</span><b>${fmtNum(cnt('over'))}</b></div></div>
        <details class="nd-set"><summary>ⓘ طريقة الحساب والقيم المستخدمة</summary><div class="nd-set-b">
        <div class="bill-set-hint">القيم التالية تُحسب تلقائياً من سجل المخزن، ولا تحتاج إدخالاً:<br>مدة وصول الطلبية: ${fmtNum(cfg.lead)} ${cfg.lead === 1 ? 'يوم' : 'أيام'} ${cfg.leadAuto ? '(من ' + fmtNum(cfg.nLead) + ' طلبية)' : '(قيمة افتراضية لعدم كفاية الطلبيات المسجّلة)'}<br>دورة الطلب: ${fmtNum(cfg.rev)} ${cfg.rev === 1 ? 'يوم' : 'أيام'} ${cfg.revAuto ? '(من ' + fmtNum(cfg.nRev + 1) + ' وارداً)' : '(قيمة افتراضية لعدم كفاية الواردات)'}<br>مدة قياس المبيعات: 12 أسبوعاً</div>
        <div class="nd-hint">كيف يُحسب التقدير:<br>١) الأساس هو المبيعات الفعلية (الصادر)، لا الوارد، لأن الوارد يعكس قرارات الشراء وليس حاجة الزبائن.<br>٢) لا تُحتسب أيام نفاد المادة ضمن الطلب، ويُضاف إليه ما سُجّل في «المطلوبة وغير المتوفرة».<br>٣) يُصنَّف نمط الطلب (منتظم، متذبذب، متقطع، كتلي) بمؤشرَي ADI وCV².<br>٤) للمنتظم والمتذبذب: متوسط يوزن بالحداثة، وللمتقطع والكتلي: طريقة Croston بتصحيح SBA.<br>٥) مخزون الأمان بحسب فئة المادة بالإيراد: A بمستوى خدمة 98%، وB بمستوى 95%، وC بمستوى 90%.<br>٦) نقطة إعادة الطلب = الطلب خلال مدة الوصول + مخزون الأمان، والكمية المقترحة تصل بالمخزون إلى الطلب خلال (مدة الوصول + دورة الطلب) + الأمان، مطروحاً منها المتوفر وما هو قيد الطلب.<br>٧) البيانات القليلة تعطي تقديراً ضعيفاً، ولا يحسب النموذج الموسمية لأن مدة القياس قصيرة.<br>٨) الرقم بين قوسين بجانب الطلب الأسبوعي هو المدى المتوقع بثقة 80%، أي أن الأسبوع القادم يقع غالباً ضمنه.</div></div></details>
        ${nOrd ? `<button type="button" class="cn-new" onclick="ndmToList()">إضافة المواد المطلوبة (${fmtNum(nOrd)}) إلى قائمة النواقص</button>` : ''}
        <div class="cn-chips fu-chips">${chips.map(([k, l]) => `<button type="button" class="cn-chip ${ndmF === k ? 'on' : ''}" onclick="ndmF='${k}';ndmShow=60;exRender()">${l}</button>`).join('')}</div>
        <div class="fu-q"><input type="search" autocomplete="off" placeholder="ابحث عن مادة لتقدير احتياجها" value="${escapeHtml(ndmQ)}" oninput="ndmQ=this.value;ndmShow=60;ndmRowsRedraw()"></div>
        <div id="ndmList">${ndmListHtml()}</div>`;
}
function ndmListHtml() {
    const q = ndmQ ? normSearch(ndmQ) : '', toks = q ? q.split(' ') : [];
    const list = ndmRows.map((r, i) => [r, i]).filter(([r]) => q ? searchScore(r.p, q, toks) > 0 : (ndmF === 'all' || (ndmF === 'exp' ? r.ex && r.ex.flag : r.status === ndmF)));
    return (list.slice(0, ndmShow).map(([r, i]) => ndmRow(r, i)).join('') || `<div class="cu-none">${q ? 'لا توجد مبيعات مسجلة لهذه المادة خلال المدة، فلا يمكن تقدير احتياجها.' : 'لا توجد مواد في هذا التصنيف.'}</div>`)
        + (list.length > ndmShow ? `<button type="button" class="ex-cat" onclick="ndmShow+=60;ndmRowsRedraw()">عرض المزيد (${fmtNum(list.length - ndmShow)})</button>` : '');
}
function ndmRowsRedraw() { const b = document.getElementById('ndmList'); if (b) b.innerHTML = ndmListHtml(); }
function ndmDetail(i) {
    const r = ndmRows[i]; if (!r) return; const f = v => fmtNum(Math.round(v * 10) / 10);
    Swal.fire({ title: 'تفاصيل التقدير', showConfirmButton: false, showCloseButton: true, html: `<div class="fu-det" dir="rtl">
        <div class="fu-dr"><span>المادة</span><b dir="ltr">${dispNameHtml(r.p)}</b></div>
        <div class="fu-dr"><span>فئة الإيراد</span><b>${r.cls}</b></div><div class="fu-dr"><span>نمط الطلب</span><b>${r.pat[0]}</b></div>
        <div class="fu-dr"><span>الطلب اليومي المقدّر</span><b>${fmtNum(Math.round(r.rate * 100) / 100)}</b></div><div class="fu-dr"><span>الطلب الشهري المتوقع</span><b>${f(r.rate * 30)}</b></div>
        <div class="fu-dr"><span>المدى الأسبوعي (ثقة 80%)</span><b>${f(r.ci.w80[0])} – ${f(r.ci.w80[1])}</b></div><div class="fu-dr"><span>المدى الأسبوعي (ثقة 95%)</span><b>${f(r.ci.w95[0])} – ${f(r.ci.w95[1])}</b></div>
        <div class="fu-dr"><span>المدى الشهري (ثقة 80%)</span><b>${f(r.ci.m80[0])} – ${f(r.ci.m80[1])}</b></div><div class="fu-dr"><span>المدى الشهري (ثقة 95%)</span><b>${f(r.ci.m95[0])} – ${f(r.ci.m95[1])}</b></div>
        <div class="fu-dr"><span>المتوفر</span><b>${f(r.stock)}</b></div>${r.ord ? `<div class="fu-dr"><span>قيد الطلب</span><b>${f(r.ord)}</b></div>` : ''}
        ${ndxDetailRows(r.ex)}<div class="fu-dr"><span>مخزون الأمان</span><b>${f(r.ss)}</b></div><div class="fu-dr"><span>نقطة إعادة الطلب</span><b>${f(r.rop)}</b></div>
        <div class="fu-dr"><span>المستوى المستهدف</span><b>${f(r.tgt)}</b></div><div class="fu-dr"><span>الكمية المقترحة</span><b>${fmtNum(r.sug)}</b></div>
        <div class="fu-dr"><span>أيام فيها بيع</span><b>${fmtNum(r.nz)} من ${fmtNum(r.n)}</b></div>${r.miss ? `<div class="fu-dr"><span>طلبات غير ملبّاة</span><b>${fmtNum(r.miss)}</b></div>` : ''}
        <div class="fu-dr"><span>جودة البيانات</span><b>${r.conf}</b></div></div>` });
}
function ndmToList() {
    const rows = ndmRows.filter(r => r.status === 'order' && r.sug > 0); if (!rows.length) return;
    if (typeof ndState !== 'function') return;
    const st = ndState(); rows.forEach(r => { delete st.off[r.p.id]; delete st.ordered[r.p.id]; if (!st.extra.includes(r.p.id)) st.extra.push(r.p.id); st.qty[r.p.id] = r.sug; }); ndSave(st);
    Swal.fire({ icon: 'success', title: 'أُضيفت ' + fmtNum(rows.length) + ' مادة إلى «قائمتي» في النواقص والطلبية', toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 });
    try { ndBadge(); } catch (e) { /* تجاهل */ }
}


// ============================================================================
// تقدير الاحتياج من الوارد: طريقة إضافية حين تكون المبيعات غير مسجّلة بالكامل.
// الفكرة: ما اشتُري (مع البونص وبعد المردود) قبل آخر شراء قد استُهلك قبل ذلك الشراء، فمعدل الاستهلاك =
// مجموع ما اشتُري قبل آخر شراء ÷ المدة بين أول وآخر شراء. تحتاج المادة 3 مرات شراء بمدة 14 يوماً فأكثر.
// ثم تُقارن نقطة إعادة الطلب بالرصيد المجرود (والمواد غير المجرودة تُعرض بمعدلها فقط).
// ============================================================================
let ndwF = 'order', ndwShow = 60, ndwQ = '', ndwRows = [], ndwCur = null, ndwOpenSec = { need: true };
let ndwPer = (() => { try { const o = JSON.parse(localStorage.getItem('diwanNdwPer')); if (o && o.n > 0 && o.u > 0) return o; } catch (e) { /* تجاهل */ } return { n: 1, u: 30, ss: true }; })();
const ndwManualMap = () => { try { return JSON.parse(localStorage.getItem('diwanNdwManual')) || {}; } catch (e) { return {}; } };   // أرصدة يدوية للحساب فقط (لا تُسجَّل في الجرد)
const ndwManualSave = m => { try { localStorage.setItem('diwanNdwManual', JSON.stringify(m)); } catch (e) { /* تجاهل */ } };
const NDW_ST = { order: ['اطلب الآن', 'bad'], soon: ['قريباً', 'wb'], ok: ['كافٍ', 'ok'], over: ['فائض', ''], wait: ['بانتظار الجرد', ''], low: ['بيانات غير كافية', ''] };
function ndwCalc() {
    const cfg = ndmCfg(), today = todayLocalISO(), T = cfg.lead + cfg.rev, ev = new Map();
    (typeof puAll !== 'undefined' ? puAll : []).forEach(r => {
        if (!r || r.cancelled) return; const d = String(r.date || '').slice(0, 10); if (!d) return;
        (r.items || []).forEach(it => {
            if (!it.pid) return; const u = (parseInt(it.qty) || 0) + (parseInt(it.bonus) || 0) - (parseFloat(it.ret) || 0); if (!(u > 0)) return;
            let m = ev.get(it.pid); if (!m) { m = new Map(); ev.set(it.pid, m); } m.set(d, (m.get(d) || 0) + u);
        });
    });
    // المردود للمذخر (من سجل المردود) يُخصم من وارد القائمة التي رُدّ منها (علب + بونص)، فلا يُعدّ استهلاكاً
    try {
        const dOf = new Map((typeof puAll !== 'undefined' ? puAll : []).map(r => [r.id, String(r.date || '').slice(0, 10)]));
        (typeof lgRets === 'function' ? lgRets() : []).forEach(e => (e.items || []).forEach(l => {
            const m = ev.get(l.pid), d = dOf.get(e.listId) || String(e.date || '').slice(0, 10), q = (puNum(l.qty) || 0) + (puNum(l.bq) || 0);
            if (m && d && q > 0) m.set(d, (m.get(d) || 0) - q);
        }));
        ev.forEach((m, pid) => { m.forEach((v, d) => { if (!(v > 0)) m.delete(d); }); if (!m.size) ev.delete(pid); });
    } catch (e) { /* تجاهل */ }
    const onOrd = new Map(); try { if (typeof ndOrders === 'function') ndOrders().filter(o => o.status !== 'received').forEach(o => (o.items || []).forEach(x => onOrd.set(x.pid, (onOrd.get(x.pid) || 0) + (parseFloat(x.qty) || 0)))); } catch (e) { /* تجاهل */ }
    const rows = [], man = ndwManualMap();
    ev.forEach((m, pid) => {
        const p = products.find(x => x.id === pid); if (!p || p.arch) return;
        const hasMan = p.counted !== true && man[pid] !== undefined && man[pid] !== '' && isFinite(parseFloat(man[pid]));   // رصيد يدوي لمادة غير مجرودة: للحساب فقط
        const ds = [...m.keys()].sort(), span = ndmDays(ds[0], ds[ds.length - 1]), counted = p.counted === true || hasMan;
        const stock = hasMan ? parseFloat(man[pid]) : (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0);
        const total = [...m.values()].reduce((a, b) => a + b, 0), since0 = ndmDays(ds[0], today);
        const okA = ds.length >= 3 && span >= 14, okB = counted && since0 >= 14;   // ب: طريقة الرصيد (أثر رجعي) للمواد المجرودة
        if (!okA && !okB) {   // بيانات غير كافية: تُعرض في «الكل» وبالبحث ليُدخَل رصيدها اليدوي
            const exL = ndxExpiry(p, 0), oL = onOrd.get(pid) || 0;
            rows.push({ p, ex: exL, rate: 0, stock, ord: oL, ss: 0, rop: 0, tgt: 0, status: 'low', counted, manual: hasMan, method: 'none', consumed: 0, nEv: ds.length, span: since0, last: ds[ds.length - 1], since: ndmDays(ds[ds.length - 1], today), first: ds[0], units: total, w80: [0, 0], sug: 0, conf: 'منخفضة', sdw: 0, pos: stock - exL.expired + oL, ev: ds.map(d => ({ d, u: m.get(d) })) });
            return;
        }
        let usedA = 0; const rates = []; for (let k = 0; k < ds.length - 1; k++) { usedA += m.get(ds[k]); const g = ndmDays(ds[k], ds[k + 1]); if (g > 0) rates.push(m.get(ds[k]) / g); }
        const rateA = okA ? usedA / span : 0, method = okB ? 'bal' : 'int';
        const consumed = Math.max(0, total - stock), rate = okB ? consumed / since0 : rateA, period = okB ? since0 : span;
        const sdw = okA && rates.length >= 3 ? Math.sqrt(rates.reduce((a, b) => a + (b - rateA) * (b - rateA), 0) / (rates.length - 1)) * 7 : Math.sqrt(Math.max(rate * 7, 0)), mw = rate * 7;
        const ex = ndxExpiry(p, rate), ord = onOrd.get(pid) || 0, pos = stock - ex.expired + ord;
        const ss = 1.65 * sdw * Math.sqrt(T / 7), rop = rate * cfg.lead + ss, tgt = rate * T + ss;
        const status = !counted ? 'wait' : pos <= rop ? 'order' : pos <= rop + rate * cfg.rev ? 'soon' : (rate > 0 && pos > tgt + rate * 30) ? 'over' : 'ok';
        const conf = okB ? (since0 >= 90 && ds.length >= 2 ? 'جيدة' : since0 >= 45 ? 'متوسطة' : 'منخفضة') : (ds.length >= 8 ? 'جيدة' : ds.length >= 5 ? 'متوسطة' : 'منخفضة');
        rows.push({ p, ex, rate, stock, ord, ss, rop, tgt, status, counted, method, consumed: okB ? consumed : usedA, nEv: ds.length, span: period, last: ds[ds.length - 1], since: ndmDays(ds[ds.length - 1], today), first: ds[0], units: total, w80: [Math.max(0, mw - 1.28 * sdw), mw + 1.28 * sdw], sug: counted ? Math.max(0, Math.ceil(tgt - pos - 1e-9)) : 0, conf, manual: hasMan, sdw, pos, ev: ds.map(d => ({ d, u: m.get(d) })) });
    });
    const ord = { order: 0, soon: 1, ok: 2, over: 3, wait: 4, low: 5 };
    return { cfg, rows: rows.sort((a, b) => ord[a.status] - ord[b.status] || (a.rate > 0 ? a.stock / a.rate : 1e9) - (b.rate > 0 ? b.stock / b.rate : 1e9)) };
}
function ndwRow(r, i) {
    const st = NDW_ST[r.status], wk = Math.round(r.rate * 70) / 10;
    if (r.status === 'low') return `<div class="cu-row fu-row" onclick="ndwDetail(${i})"><div class="cu-av fu-av">${fmtNum(r.nEv)}</div><div><b dir="ltr">${dispNameHtml(r.p)}</b><small>بيانات غير كافية: ${fmtNum(r.nEv)} مرات شراء خلال ${fmtNum(r.span)} يوماً</small><small>افتح المادة لإدخال الرصيد الحالي للحساب.</small>${ndxTag(r.ex)}</div><div class="fu-st">${st[0]}</div></div>`;
    return `<div class="cu-row fu-row" onclick="ndwDetail(${i})"><div class="cu-av fu-av ${r.conf === 'جيدة' ? 'ok' : r.conf === 'متوسطة' ? 'wb' : ''}">${fmtNum(r.nEv)}</div>
        <div><b dir="ltr">${dispNameHtml(r.p)}</b><small>الشراء ${fmtNum(wk)} علبة/أسبوع (${fmtNum(Math.round(r.w80[0]))}–${fmtNum(Math.round(r.w80[1]))}) • ${r.method === 'bal' ? 'استُهلك ' + fmtNum(Math.round(r.consumed * 10) / 10) + ' من ' + fmtNum(Math.round(r.units * 10) / 10) + ' وارد خلال ' : fmtNum(r.nEv) + ' مرات شراء خلال '}${fmtNum(r.span)} يوماً • ${r.counted ? 'المتوفر ' + fmtNum(Math.round(r.stock * 10) / 10) : 'غير مجرودة'}${r.ord ? ' • قيد الطلب ' + fmtNum(r.ord) : ''}</small>${ndxTag(r.ex)}</div>
        <div class="fu-st ${st[1]}">${(r.status === 'order' || r.status === 'soon') && r.sug ? 'اطلب ' + fmtNum(r.sug) : st[0]}</div></div>`;
}
function ndwListHtml() {
    const q = ndwQ ? normSearch(ndwQ) : '', toks = q ? q.split(' ') : [];
    const list = ndwRows.map((r, i) => [r, i]).filter(([r]) => q ? searchScore(r.p, q, toks) > 0 : (ndwF === 'all' || (ndwF === 'exp' ? r.ex && r.ex.flag : r.status === ndwF)));
    return (list.slice(0, ndwShow).map(([r, i]) => ndwRow(r, i)).join('') || `<div class="cu-none">${q ? 'لا يتوفر لهذه المادة سجل وارد كافٍ للتقدير.<br>للمجرودة: وارد مسجل منذ 14 يوماً فأكثر.<br>لغير المجرودة: 3 مرات شراء على الأقل.' : 'لا توجد مواد في هذا التصنيف.'}</div>`)
        + (list.length > ndwShow ? `<button type="button" class="ex-cat" onclick="ndwShow+=60;ndwRowsRedraw()">عرض المزيد (${fmtNum(list.length - ndwShow)})</button>` : '');
}
function ndwRowsRedraw() { const b = document.getElementById('ndwList'); if (b) b.innerHTML = ndwListHtml(); }
function ndwHtml() {
    const c = ndwCalc(); ndwRows = c.rows; const cfg = c.cfg, cnt = k => c.rows.filter(r => r.status === k).length, nOrd = cnt('order');
    const chips = [['order', 'اطلب الآن'], ['soon', 'قريباً'], ['over', 'فائض'], ['wait', 'بانتظار الجرد'], ['exp', 'نفاذ قريب (' + fmtNum(c.rows.filter(r => r.ex && r.ex.flag).length) + ')'], ['all', 'الكل']];
    return `<div class="sd-cards sd-c3"><div><span>اطلب الآن</span><b>${fmtNum(nOrd)}</b></div><div><span>قريباً</span><b>${fmtNum(cnt('soon'))}</b></div><div><span>بانتظار الجرد</span><b>${fmtNum(cnt('wait'))}</b></div></div>
        <details class="nd-set"><summary>ⓘ طريقة الحساب وحدودها</summary><div class="nd-set-b">
        <div class="nd-hint">كيف يُحسب التقدير:<br>١) الأساس سجل الوارد (مع البونص) لأن المبيعات غير مسجلة بالكامل.<br>٢) المردود للمذخر يُخصم من وارد القائمة التي رُدّ منها.<br>٣) المواد المجرودة: المستهلك = مجموع الوارد − الرصيد الحالي، ÷ المدة من أول وارد حتى اليوم (14 يوماً فأكثر).<br>٤) غير المجرودة: ما اشتُري قبل آخر شراء ÷ المدة بين أول وآخر شراء (3 مرات شراء فأكثر).<br>يُعدّ رصيد المادة قبل أول وارد مسجل صفراً.<br>٥) مدة وصول الطلبية ${fmtNum(cfg.lead)} ودورة الطلب ${fmtNum(cfg.rev)} (تُحسبان من سجلات المخزن نفسها).<br>٦) الصلاحية: الدفعات المنتهية لا تُحتسب من المتوفر، وتُنبَّه الدفعات القريبة والكميات التي لن تُباع قبل نفاذها.<br>٧) الكمية المقترحة تُحسب للمواد المجرودة فقط، وغير المجرودة تظهر بمعدلها دون اقتراح.<br>٨) لغير المجرودة: يمكن إدخال العدد الحالي داخل تفاصيل المادة ليُستعمل في الحساب فقط دون تسجيله في الجرد.</div>
        <div class="bill-set-hint">حدود هذه الطريقة:<br>• قد يقلّ التقدير إن كان لديك رصيد قبل أول وارد مسجل أو وارد غير مسجل.<br>• يعكس الاستهلاك الكلي (بيعاً وتحويلاً وإتلافاً) لا المبيعات وحدها.<br>• الشراء الكبير لأجل البونص أو الخصم يرفع التقدير.<br>• نفاد المادة بين مرتين يخفضه.<br>• الرقم داخل الدائرة هو عدد مرات الشراء، وكلما زاد زادت الثقة.<br>• تتحسن الدقة مع تراكم سجل الوارد، وتبقى «من المبيعات» أدق متى سُجلت المبيعات.</div></div></details>
        ${nOrd ? `<button type="button" class="cn-new" onclick="ndwToList()">إضافة المواد المطلوبة (${fmtNum(nOrd)}) إلى قائمة النواقص</button>` : ''}
        <div class="cn-chips fu-chips">${chips.map(([k, l]) => `<button type="button" class="cn-chip ${ndwF === k ? 'on' : ''}" onclick="ndwF='${k}';ndwShow=60;exRender()">${l}</button>`).join('')}</div>
        <div class="fu-q"><input type="search" autocomplete="off" placeholder="ابحث عن مادة لتقدير احتياجها" value="${escapeHtml(ndwQ)}" oninput="ndwQ=this.value;ndwShow=60;ndwRowsRedraw()"></div>
        <div id="ndwList">${ndwListHtml()}</div>`;
}
function ndwDetail(i) { const r = ndwRows[i]; if (r) ndwOpen(r.p.id); }
function ndwOpen(pid) {
    ndwCur = pid; const r = ndwRows.find(x => x.p.id === pid); if (!r) return;
    Swal.fire({ title: 'تقدير الاحتياج من الوارد', showConfirmButton: false, showCloseButton: true, width: 'min(94vw, 520px)', html: `<div id="ndwDet" class="fu-det" dir="rtl" style="text-align:right">${ndwDetBody(r)}</div>` });
}
function ndwDetRefresh() {
    ndwRows = ndwCalc().rows; ndwRowsRedraw();
    const r = ndwRows.find(x => x.p.id === ndwCur), el = document.getElementById('ndwDet'); if (r && el) el.innerHTML = ndwDetBody(r);
}
function ndwNeedCalc(r) {
    const days = ndwPer.n * ndwPer.u, cons = r.rate * days, ss = ndwPer.ss ? 1.65 * r.sdw * Math.sqrt(days / 7) : 0, need = cons + ss;
    return { days, cons, ss, need, buy: r.counted ? Math.max(0, Math.ceil(need - r.pos - 1e-9)) : null, lo: r.w80[0] * days / 7, hi: r.w80[1] * days / 7, cover: r.rate > 0 ? r.pos / r.rate : null };
}
function ndwNeedHtml(r) {
    const f = v => fmtNum(Math.round(v * 10) / 10), row = (t, v, st) => `<div class="fu-dr"><span>${t}</span><b${st ? ' style="' + st + '"' : ''}>${v}</b></div>`;
    if (r.method === 'none') return '<small>لا يتوفر تقدير لهذه المادة بعد.<br>أدخل الرصيد الحالي في القسم الأعلى (يلزم وارد مسجل منذ 14 يوماً فأكثر).</small>';
    const c = ndwNeedCalc(r);
    return row('الاستهلاك المتوقع للمدة', f(c.cons) + ' (' + f(c.lo) + ' – ' + f(c.hi) + ')') + (ndwPer.ss ? row('مخزون الأمان المضاف', f(c.ss)) : '') + row('المتوفر + قيد الطلب', f(r.pos))
        + (c.cover !== null ? row('يكفي المتوفر', fmtNum(Math.floor(c.cover)) + ' يوماً (حتى ' + fmtDateDMY(sdAdd(todayLocalISO(), Math.floor(c.cover))) + ')') : '')
        + (c.buy === null ? '<small>الرصيد غير معتمد: أدخل العدد الحالي لحساب المطلوب شراؤه.</small>' : row('المطلوب شراؤه لتغطية المدة', fmtNum(c.buy) + ' علبة', 'color:#0f766e;font-size:1.1em') + (c.buy > 0 ? '<button type="button" class="cn-new" style="margin-top:8px" onclick="ndwAddOne()">إضافة ' + fmtNum(c.buy) + ' إلى قائمة النواقص</button>' : ''));
}
function ndwPerSet() {
    const n = Math.max(1, parseInt(document.getElementById('ndwPn').value) || 1), u = parseInt(document.getElementById('ndwPu').value) || 30, ss = !!document.getElementById('ndwSs').checked;
    ndwPer = { n, u, ss }; try { localStorage.setItem('diwanNdwPer', JSON.stringify(ndwPer)); } catch (e) { /* تجاهل */ }
    const r = ndwRows.find(x => x.p.id === ndwCur), o = document.getElementById('ndwNeedOut'); if (r && o) o.innerHTML = ndwNeedHtml(r);
}
function ndwAddOne() {
    const r = ndwRows.find(x => x.p.id === ndwCur); if (!r) return; const c = ndwNeedCalc(r); if (!(c.buy > 0)) return;
    const st = ndState(); delete st.off[r.p.id]; delete st.ordered[r.p.id]; if (!st.extra.includes(r.p.id)) st.extra.push(r.p.id); st.qty[r.p.id] = c.buy; ndSave(st);
    Swal.fire({ icon: 'success', title: 'أُضيفت ' + fmtNum(c.buy) + ' إلى «قائمتي» في النواقص والطلبية', toast: true, position: 'bottom', showConfirmButton: false, timer: 2400 });
    try { ndBadge(); } catch (e) { /* تجاهل */ }
}
function ndwManSet() {
    const v = parseFloat(document.getElementById('ndwMan').value);
    if (!isFinite(v) || v < 0) { document.getElementById('ndwManErr').innerText = 'أدخل رقماً صحيحاً (0 أو أكثر)'; return; }
    const m = ndwManualMap(); m[ndwCur] = v; ndwManualSave(m); ndwDetRefresh();
}
async function ndwManClear() {
    const pid = ndwCur;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف الرصيد اليدوي؟', text: 'يُحذف من الحساب فقط، ولا يتأثر الجرد.', showCancelButton: true, confirmButtonText: 'نعم، حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true });
    if (r.isConfirmed) { const m = ndwManualMap(); delete m[pid]; ndwManualSave(m); ndwRows = ndwCalc().rows; ndwRowsRedraw(); }
    ndwOpen(pid);
}
// رسم سحب المادة: أعمدة الوارد + خط الرصيد التقديري بمعدل ثابت + نقطة الرصيد الحالي + إسقاط حتى النفاد
function ndwChartSvg(r) {
    const today = todayLocalISO(), T = Math.max(1, ndmDays(r.first, today)), rate = r.rate, Hz = rate > 0 ? Math.min(120, Math.max(0, r.stock / rate)) : 0, X = T + Hz;
    let s = 0, tp = 0; const pts = [[0, 0]], bars = [];
    r.ev.forEach(e => { const t = ndmDays(r.first, e.d); s = Math.max(0, s - rate * (t - tp)); pts.push([t, s]); s += e.u; pts.push([t, s]); tp = t; bars.push([t, e.u]); });
    s = Math.max(0, s - rate * (T - tp)); pts.push([T, s]);
    const ym = Math.max(1, ...pts.map(p => p[1]), r.stock) * 1.12, W = 340, H = 170, L = 34, R = 10, Tp = 12, B = 26, x = t => L + t / X * (W - L - R), y = v => Tp + (1 - v / ym) * (H - Tp - B), base = y(0);
    const line = pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
    const lbl = (t, anchor, txt) => `<text x="${x(t).toFixed(1)}" y="${H - 8}" font-size="9" fill="#64748b" text-anchor="${anchor}">${txt}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:100%" role="img" aria-label="رسم سحب المادة">
        <line x1="${L}" y1="${base}" x2="${W - R}" y2="${base}" stroke="#cbd5e1"/><line x1="${L}" y1="${Tp}" x2="${L}" y2="${base}" stroke="#cbd5e1"/>
        <text x="${L - 4}" y="${base + 3}" font-size="9" fill="#64748b" text-anchor="end">0</text><text x="${L - 4}" y="${Tp + 8}" font-size="9" fill="#64748b" text-anchor="end">${fmtNum(Math.round(ym))}</text>
        ${bars.map(b => `<rect x="${(x(b[0]) - 3).toFixed(1)}" y="${y(b[1]).toFixed(1)}" width="6" height="${(base - y(b[1])).toFixed(1)}" fill="#cbd5e1"/><text x="${x(b[0]).toFixed(1)}" y="${(y(b[1]) - 3).toFixed(1)}" font-size="8" fill="#475569" text-anchor="middle">${fmtNum(Math.round(b[1] * 10) / 10)}</text>`).join('')}
        <path d="${line}" fill="none" stroke="#0f766e" stroke-width="1.8"/>
        ${Hz > 0 ? `<line x1="${x(T).toFixed(1)}" y1="${y(r.stock).toFixed(1)}" x2="${x(T + Hz).toFixed(1)}" y2="${base}" stroke="#0f766e" stroke-width="1.4" stroke-dasharray="4 3"/>` : ''}
        <circle cx="${x(T).toFixed(1)}" cy="${y(r.stock).toFixed(1)}" r="4" fill="#b91c1c"/>
        ${lbl(0, 'start', fmtDateDMY(r.first))}${lbl(T, Hz > 0 ? 'middle' : 'end', 'اليوم')}${Hz > 0 ? lbl(T + Hz, 'end', fmtDateDMY(sdAdd(today, Math.floor(Hz)))) : ''}</svg>
        <small style="display:block;margin-top:4px">الأعمدة: الوارد بتاريخه • الخط الأخضر: رصيد تقديري بمعدل سحب ثابت (نموذج تقريبي) • النقطة الحمراء: الرصيد الحالي ${fmtNum(Math.round(r.stock * 10) / 10)} • الخط المتقطع: النفاد المتوقع.</small>`;
}
function ndwDetBody(r) {
    const f = v => fmtNum(Math.round(v * 10) / 10), dr = (t, v) => `<div class="fu-dr"><span>${t}</span><b>${v}</b></div>`;
    const sec = (k, t, body) => `<details class="nd-set" ${ndwOpenSec[k] ? 'open' : ''} ontoggle="ndwOpenSec['${k}']=this.open"><summary>${t}</summary><div class="nd-set-b">${body}</div></details>`;
    const manV = ndwManualMap()[r.p.id], inp = 'height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;text-align:center;box-sizing:border-box';
    const bal = r.p.counted === true ? dr('الرصيد المعتمد (جرد)', f(r.stock)) + '<small>المادة مجرودة، فيُعتمد رصيد الجرد.</small>'
        : dr('الرصيد المعتمد في الحساب', r.manual ? f(r.stock) + ' (يدوي)' : 'غير مجرودة') + `<div style="display:flex;gap:6px;margin-top:6px"><input id="ndwMan" type="number" inputmode="decimal" min="0" value="${manV !== undefined ? escapeHtml(String(manV)) : ''}" placeholder="العدد الحالي بالعلب" style="flex:1;${inp}"><button type="button" class="ln-btn" style="height:38px" onclick="ndwManSet()">اعتماد للحساب</button>${r.manual ? '<button type="button" class="ln-btn" style="height:38px" onclick="ndwManClear()">حذف</button>' : ''}</div><small id="ndwManErr" style="color:#b91c1c;display:block"></small><small style="display:block">للحساب فقط.<br>لا يُسجَّل في الجرد ولا يغيّر رصيد المادة.</small>`;
    const unitOpt = [[1, 'يوم'], [7, 'أسبوع'], [30, 'شهر']].map(([v, l]) => `<option value="${v}" ${ndwPer.u === v ? 'selected' : ''}>${l}</option>`).join('');
    const need = `<div class="fu-dr"><span>المدة المراد توفيرها</span><span style="display:flex;gap:6px"><input id="ndwPn" type="number" inputmode="numeric" min="1" value="${ndwPer.n}" oninput="ndwPerSet()" style="width:70px;${inp}"><select id="ndwPu" onchange="ndwPerSet()" style="${inp};background:#fff">${unitOpt}</select></span></div>
        <div class="qk-row"><div><b>إضافة مخزون أمان</b><small>احتياط فوق الاستهلاك المتوقع.</small></div><label class="setup-sw"><input type="checkbox" id="ndwSs" ${ndwPer.ss ? 'checked' : ''} onchange="ndwPerSet()" aria-label="مخزون الأمان"><i></i></label></div><div id="ndwNeedOut">${ndwNeedHtml(r)}</div>`;
    const ivs = r.ev.map((e, k) => { const nx = r.ev[k + 1]; if (!nx) return `<div class="fu-dr"><span>${fmtDateDMY(e.d)} ← اليوم</span><b>وارد ${f(e.u)} • الرصيد الآن ${f(r.stock)}</b></div>`; const g = ndmDays(e.d, nx.d); return `<div class="fu-dr"><span>${fmtDateDMY(e.d)} ← ${fmtDateDMY(nx.d)} (${fmtNum(g)} يوماً)</span><b>وارد ${f(e.u)} • السحب ≈ ${f(g > 0 ? e.u / g * 7 : 0)}/أسبوع</b></div>`; }).join('');
    const calc = dr('الطريقة', r.method === 'bal' ? 'رصيد الجرد (أثر رجعي)' : r.method === 'int' ? 'فترات الشراء' : 'غير كافية') + (r.method === 'none' ? '' : dr(r.method === 'bal' ? 'المستهلك (الوارد − الرصيد)' : 'المستهلك قبل آخر شراء', f(r.consumed) + ' خلال ' + fmtNum(r.span) + ' يوماً') + dr('الاستهلاك اليومي المقدّر', fmtNum(Math.round(r.rate * 100) / 100)) + dr('الشهري المتوقع', f(r.rate * 30)) + dr('المدى الأسبوعي (ثقة 80%)', f(r.w80[0]) + ' – ' + f(r.w80[1])))
        + dr('مرات الشراء', fmtNum(r.nEv) + ' • أولها ' + fmtDateDMY(r.first)) + dr('مجموع الوارد', f(r.units)) + dr('آخر شراء', 'قبل ' + fmtNum(r.since) + ' يوماً') + dr('المتوفر', f(r.stock)) + (r.ord ? dr('قيد الطلب', f(r.ord)) : '') + ndxDetailRows(r.ex)
        + (r.method === 'none' ? '' : dr('مخزون الأمان', f(r.ss)) + dr('نقطة إعادة الطلب', f(r.rop)) + dr('المستوى المستهدف', f(r.tgt)) + dr('الكمية المقترحة', r.counted ? fmtNum(r.sug) : '—')) + dr('درجة الثقة', r.conf);
    return `<div class="fu-dr"><span>المادة</span><b dir="ltr">${dispNameHtml(r.p)}</b></div>${ndxTag(r.ex)}`
        + sec('bal', 'الرصيد الحالي', bal) + sec('need', 'الاحتياج لمدة محددة', need) + sec('chart', 'رسم سحب المادة', r.method === 'none' && !(r.rate > 0) ? ndwChartSvg(r) : ndwChartSvg(r)) + sec('iv', 'فترات السحب', ivs) + sec('calc', 'الحسابات الحالية', calc);
}
function ndwToList() {
    const rows = ndwRows.filter(r => r.status === 'order' && r.sug > 0); if (!rows.length) return;
    const st = ndState(); rows.forEach(r => { delete st.off[r.p.id]; delete st.ordered[r.p.id]; if (!st.extra.includes(r.p.id)) st.extra.push(r.p.id); st.qty[r.p.id] = r.sug; }); ndSave(st);
    Swal.fire({ icon: 'success', title: 'أُضيفت ' + fmtNum(rows.length) + ' مادة إلى «قائمتي» في النواقص والطلبية', toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 });
    try { ndBadge(); } catch (e) { /* تجاهل */ }
}
