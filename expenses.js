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
// ذاكرة محلية لمبيعات آخر الأشهر على الجهاز: تقدير الاحتياج وغيره يقرأ منها فوراً، والسحابة تُجلب منها الفرق الجديد فقط
const SALES_CACHE_KEY = 'diwanSalesCache', SALES_KEEP_DAYS = 120;
function salesCacheRead() { try { const c = JSON.parse(lsGet(SALES_CACHE_KEY)); return c && Array.isArray(c.inv) ? c : null; } catch (e) { return null; } }
function salesCacheWrite(list, fromISO) {
    if (invOwnOnly()) return;
    const cut = sdAdd(todayLocalISO(), -SALES_KEEP_DAYS), inv = list.filter(b => b && b.issued && !b.cancelled && String(b.date || '') >= cut);
    const put = a => { try { localStorage.setItem(SALES_CACHE_KEY, JSON.stringify({ at: Date.now(), from: fromISO < cut ? cut : fromISO, inv: a })); return true; } catch (e) { return false; } };
    if (!put(inv)) put(inv.filter(b => String(b.date || '') >= sdAdd(todayLocalISO(), -90)));   // امتلاء التخزين: نقتصر على 90 يوماً
}
function salesCacheMerge(fromISO) {   // يدمج الذاكرة المحلية في billAll فوراً؛ يرجع الكاش للتحقق من تغطيته
    const c = salesCacheRead(); if (!c) return null;
    const m = new Map(); (billAll || []).forEach(x => x && x.id && m.set(x.id, x)); c.inv.forEach(x => x && x.id && !m.has(x.id) && m.set(x.id, x));
    billAll = invScope([...m.values()]).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
    return c;
}
async function invEnsureSince(fromISO) {   // تحميل الفواتير من تاريخ معيّن (الافتراضي يحمّل آخر 300 فقط)
    const c = salesCacheMerge(fromISO);
    const m = new Map(); (billAll || []).forEach(x => x && x.id && m.set(x.id, x));
    try { (JSON.parse(lsGet(BILL_LS.list)) || []).forEach(x => x && x.id && !m.has(x.id) && m.set(x.id, x)); } catch (e) { /* تجاهل */ }
    if (cloudReady() && navigator.onLine) {
        // الكاش يغطي الفترة وحديث (أقل من 7 أيام) ⇒ نجلب الفرق فقط (آخر 3 أيام قبل أحدث فاتورة محفوظة)، وإلا الفترة كاملة
        let since = fromISO;
        if (c && c.from <= fromISO && Date.now() - c.at < 7 * 864e5 && !invOwnOnly()) { const newest = c.inv.reduce((a, b) => (String(b.date || '') > a ? String(b.date) : a), ''); if (newest) { const d = sdAdd(newest, -3); if (d > since) since = d; } }
        try {
            const snap = invOwnOnly() ? await invOwnCloud() : await db.collection('pharmacy_invoices').where('date', '>=', since).get();
            snap.forEach(d => { const x = d.data(); if (x && x.id) m.set(x.id, x); });
        } catch (e) { window.__invErr = (e && (e.code || e.message)) || 'خطأ'; if (!c) throw e; /* عند فشل الشبكة نكتفي بالبيانات المحفوظة على الجهاز */ }
    }
    if (!window.__invErr || (cloudReady() && navigator.onLine)) { /* يبقى أثر آخر خطأ للعرض */ }
    billAll = invScope([...m.values()]).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt)));
    salesCacheWrite(billAll, fromISO);
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
// أيقونات عناوين الصفحات = نفس أيقونة زر الصفحة في الرئيسية
const PG_IC = {
    need: '<path d="M3 20h18"/><path d="M6 16v-5M11 16V6M16 16v-8M21 16v-3"/><path d="M5 8l5-4 4 3 6-4"/>',
    ndc: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><rect x="8" y="5.5" width="8" height="3.5" rx="1"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/>',
    xf: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    lbl: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14"/>',
    lb: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'
};
function pgIc(k) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PG_IC[k] + '</svg> '; }
function exEnsureDom() {
    if (document.getElementById('exOv')) return;
    const d = document.createElement('div'); d.id = 'exOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="exBox"></div>'; document.body.appendChild(d);
}
async function exOpen(tab) {
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'هذه الصفحة للمدير فقط.', confirmButtonColor: '#0f1c38' }); return; }
    exEnsureDom(); ndZeroSnap(); exTab = tab || 'rep'; exAll = exLocal(); try { cuLoadLocal(); } catch (e) { /* تجاهل */ }
    document.getElementById('exOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); exOpenFlag = true;
    exRender();
    await exRefresh();
}
function exClose() { const ov = document.getElementById('exOv'); if (ov) ov.style.display = 'none'; document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); exOpenFlag = false; }
async function exRefresh() {
    const r = exRange(), h = Prog.start('تحميل البيانات', { text: 'المصروفات والفواتير...', indeterminate: false });
    try { salesCacheMerge(); if (exOpenFlag && salesCacheRead()) exRender(); } catch (e) { /* تجاهل */ }   // عرض فوري من المبيعات المحفوظة قبل أي تحميل
    try { await exLoad(); h.set(40); if ((exTab === 'need' || exTab === 'need2' || exTab === 'xf') && typeof puLoad === 'function') { try { await puLoad(); } catch (e) { /* تجاهل */ } if ((exTab === 'need2' || exTab === 'xf') && typeof lgLoad === 'function') { try { await lgLoad(); } catch (e) { /* تجاهل */ } } }
    const fr = exTab === 'dash' ? sdFrom() : (exTab === 'need' || exTab === 'xf') ? ndmFrom() : exTab === 'need2' ? todayLocalISO() : r.from; if (!(window.__exInvFrom && window.__exInvFrom <= fr && Date.now() - (window.__exInvAt || 0) < 30 * 60000)) { await invEnsureSince(fr); window.__exInvFrom = fr; window.__exInvAt = Date.now(); } h.ok('تم التحميل'); } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); }
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
    const tabs = `<div class="cu-seg"><button type="button" class="${exTab === 'dash' ? 'on' : ''}" onclick="exTab='dash';exRefresh()">المبيعات</button><button type="button" class="${exTab === 'rep' ? 'on' : ''}" onclick="exTab='rep';exRefresh()">صافي الربح</button><button type="button" class="${exTab === 'list' ? 'on' : ''}" onclick="exTab='list';exRender()">المصروفات</button></div>`;
    let body;
    if (exTab === 'need' || exTab === 'need2' || exTab === 'xf') {
        const sub = `<div class="ndw-tabs"><button type="button" class="${exTab === 'need' ? 'on' : ''}" onclick="exTab='need';exRefresh()">من المبيعات</button><button type="button" class="${exTab === 'need2' ? 'on' : ''}" onclick="exTab='need2';exRefresh()">من الوارد</button><button type="button" class="${exTab === 'xf' ? 'on' : ''}" onclick="exTab='xf';exRefresh()">مناقلة مقترحة</button></div>`;
        document.getElementById('exBox').innerHTML = `<div class="cn-head"><b>${exTab === 'xf' ? pgIc('xf') + 'الصلاحية والمناقلة' : pgIc('need') + 'تقدير الاحتياج'}</b></div><div class="cn-body">${sub}${exTab === 'need' ? ndmHtml() : exTab === 'need2' ? ndwHtml() : xfHtml()}</div>`; return;
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
    const out = { expired: 0, nearBoxes: 0, nearDays: null, risk: 0, riskY: 0, riskDays: null, batches: [], flag: false };
    try {
        if (!(p.bt && typeof p.bt === 'object')) {   // مادة بلا دفعات مسجلة: كمية كل تاريخ مجهولة، فلا تُنسب كل الكمية لأقرب تاريخ
            const d0 = getProductExpiryDates(p)[0]; if (d0) out.unk = { e: d0, d: expiryDaysOf(d0) };
            return out;
        }
        const sc = btSc(p), nearD = (alertMonths[0] || 1) * 30, riskD = (alertMonths[2] || 6) * 30; let cum = 0;
        getBatches(p).filter(b => b.e).forEach(b => {
            const boxes = (b.q || 0) + (sc > 1 ? (b.l || 0) / sc : 0), d = expiryDaysOf(b.e); if (d === null || !(boxes > 0)) return;
            if (d <= 0) { out.expired += boxes; return; }
            if (d <= nearD) { out.nearBoxes += boxes; out.nearDays = out.nearDays === null ? d : Math.min(out.nearDays, d); }
            const w = Math.max(0, boxes - Math.max(0, rate * d - cum));
            if (d <= riskD) out.risk += w;
            out.riskY += w; if (w > 0.5) out.riskDays = out.riskDays === null ? d : Math.min(out.riskDays, d);   // بلا أفق: كل دفعة تُقارَن بما يُتوقع بيعه حتى نفاذها
            out.batches.push({ e: b.e, d, boxes, sold: boxes - w, waste: w });
            cum += boxes;
        });
        out.flag = out.expired > 0 || out.nearBoxes > 0 || out.risk > 0.5;
    } catch (e) { /* تجاهل */ }
    return out;
}
function ndxTag(ex) {
    if (ex && !ex.flag && ex.unk && ex.unk.d !== null && ex.unk.d <= 365) return `<small>أقرب تاريخ نفاذ مسجل (${escapeHtml(ex.unk.e.slice(5, 7) + '/' + ex.unk.e.slice(0, 4))}) بلا تحديد كمية دفعته، فلم يُحسب التلف. سجّل الدفعات لتفعيله.</small>`;
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
// حد «الفائض»: تُعدّ المادة فائضة إذا كان المتوفر يكفي أكثر من هذا العدد من الأيام (الافتراضي 90 يوماً)، ويُعدَّل من القسم المطوي في أعلى الصفحة
function ndOverDays() { try { const v = parseInt(localStorage.getItem('diwanOverDays')); return v >= 7 && v <= 730 ? v : 90; } catch (e) { return 90; } }
function ndOverSet(v) { const n = Math.min(730, Math.max(7, parseInt(v) || 90)); try { localStorage.setItem('diwanOverDays', String(n)); } catch (e) { /* تجاهل */ } exRender(); }
function ndOverRow() { return `<div class="fu-dr"><span>حد الفائض: يكفي أكثر من (يوماً)</span><input type="number" inputmode="numeric" min="7" max="730" value="${ndOverDays()}" onchange="ndOverSet(this.value)" style="width:80px;height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;text-align:center;box-sizing:border-box"></div>`; }

// ===== أدوات مشتركة لطريقتي التقدير =====
const ND_ZERO = 'diwanNdZero', ND_OPEN = 'diwanNdOpen', ND_Z = { A: 2.05, B: 1.65, C: 1.28 };
function ndZeroLoad() { try { return JSON.parse(localStorage.getItem(ND_ZERO)) || {}; } catch (e) { return {}; } }
// لقطة يومية: المواد المجرودة التي رصيدها صفر اليوم، لتُستبعد أيام نفادها من حساب المعدل لاحقاً
function ndZeroSnap() {
    try {
        if (!Array.isArray(products) || !products.length) return; const t = todayLocalISO(), o = ndZeroLoad(); if (o.__d === t) return;
        const cut = sdAdd(t, -120);
        Object.keys(o).forEach(k => { if (k !== '__d') { o[k] = (o[k] || []).filter(d => d >= cut); if (!o[k].length) delete o[k]; } });
        products.forEach(p => { if (!p || p.arch || p.counted !== true) return; const st = (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0); if (st <= 0) { const a = o[p.id] || (o[p.id] = []); if (!a.includes(t)) a.push(t); } });
        o.__d = t; localStorage.setItem(ND_ZERO, JSON.stringify(o));
    } catch (e) { /* تجاهل */ }
}
function ndZeroSet(pid) { const a = ndZeroLoad()[pid]; return new Set(Array.isArray(a) ? a : []); }
function ndOpenLoad() { try { return JSON.parse(localStorage.getItem(ND_OPEN)) || {}; } catch (e) { return {}; } }
function ndOpenSave(pid, v) { const o = ndOpenLoad(), n = parseFloat(v); if (isFinite(n) && n > 0) o[pid] = n; else delete o[pid]; try { localStorage.setItem(ND_OPEN, JSON.stringify(o)); } catch (e) { /* تجاهل */ } ndwDetRefresh(); }
// فئات ABC بحسب إيراد آخر 12 أسبوعاً (A حتى 80% من الإيراد، B حتى 95%)
function ndAbcMap() {
    const today = todayLocalISO(), from = sdAdd(today, -83), rev = new Map(); let tot = 0;
    (billAll || []).forEach(b => { if (!b || !b.issued || b.cancelled) return; const d = String(b.date || ''); if (d < from || d > today) return; (b.items || []).forEach(it => { if (!it.pid) return; const v = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0); if (v > 0) { rev.set(it.pid, (rev.get(it.pid) || 0) + v); tot += v; } }); });
    const m = new Map(); let cum = 0; [...rev.entries()].sort((a, b) => b[1] - a[1]).forEach(([pid, v]) => { const before = cum / (tot || 1); cum += v; m.set(pid, before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C'); });
    return m;
}
// قاعدة موحّدة للطلب: حد إعادة الطلب (أو الحد الأدنى للتغطية إن كان أكبر) والكمية = الهدف المحسوب − المتاح
function ndwOrderCore(rate, rop, tgt, pos, hasMin, mq) {
    const st0 = ndwSet(), thr = Math.max(rop, rate * st0.urgent), goal = Math.max(tgt, rate * st0.target, hasMin ? mq : 0);
    return { need: (hasMin && pos <= mq) || (rate > 0 && pos <= thr), sug: Math.max(0, Math.ceil(goal - pos - 1e-9)) };
}
function ndmCalc() {
    const cfg = ndmCfg(), today = todayLocalISO(), from = sdAdd(today, -(cfg.weeks * 7 - 1)), Z = { A: 2.05, B: 1.65, C: 1.28 };
    const sales = new Map(), rev = new Map(); let totRev = 0, gs = today;   // gs: أقدم يوم فيه مبيعات مسجلة (بداية البيانات)
    (billAll || []).forEach(b => {
        if (!b || !b.issued || b.cancelled) return; const d = String(b.date || ''); if (d < from || d > today) return; if (d < gs) gs = d;
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
    const rows = [], manM = ndwManualMap(), pids = new Set([...sales.keys(), ...miss.keys()]), zAll = ndZeroLoad();
    pids.forEach(pid => {
        const p = products.find(x => x.id === pid); if (!p || p.arch) return;
        const sm = sales.get(pid) || new Map(), mm = miss.get(pid) || new Map(), ds = [...sm.keys(), ...mm.keys()].sort(), first = ds[0], last = ds[ds.length - 1];
        const hm = p.counted !== true && manM[pid] !== undefined && manM[pid] !== '' && isFinite(parseFloat(manM[pid])), stock = hm ? parseFloat(manM[pid]) : (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0);
        let st = gs < from ? from : gs; if (st > sdAdd(today, -13)) st = sdAdd(today, -13); if (first < st) st = first; let en = stock <= 0 && last < today ? last : today;
        if (en < sdAdd(st, 6)) en = sdAdd(st, 6) > today ? today : sdAdd(st, 6);
        const n = Math.max(7, Math.round((new Date(en + 'T12:00:00') - new Date(st + 'T12:00:00')) / 864e5) + 1), x = new Array(n).fill(0);
        const put = (d, v) => { let i = Math.round((new Date(d + 'T12:00:00') - new Date(st + 'T12:00:00')) / 864e5); i = Math.min(n - 1, Math.max(0, i)); x[i] += v; };
        sm.forEach((v, d) => put(d, v)); mm.forEach((v, d) => put(d, v));
        const nz = x.filter(v => v > 0); if (!nz.length) return;
        const zs = new Set(Array.isArray(zAll[pid]) ? zAll[pid] : []); let xc = x, zdays = 0;   // استبعاد أيام النفاد المسجلة (بلا بيع) من الحساب
        if (zs.size) { const f = x.filter((v, i) => v > 0 || !zs.has(sdAdd(st, i))); if (f.length >= 7) { xc = f; zdays = n - f.length; } }
        const nc = xc.length;
        const adi = nc / nz.length, mean = nz.reduce((a, b) => a + b, 0) / nz.length, cv2 = nz.length > 1 ? nz.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nz.length / (mean * mean) : 0, pat = ndmPattern(adi, cv2);
        let rate;
        if (adi < 1.32) { let sw = 0, sv = 0; xc.forEach((v, i) => { const w = Math.pow(0.5, (nc - 1 - i) / 21); sw += w; sv += w * v; }); rate = sv / sw; }
        else { const al = 0.1; let z = 0, pp = 0, q = 1, init = false; xc.forEach((v, i) => { if (v > 0) { if (!init) { z = v; pp = Math.max(1, nc / nz.length); init = true; } else { z = al * v + (1 - al) * z; pp = al * q + (1 - al) * pp; } q = 1; } else q++; }); rate = (1 - al / 2) * z / pp; }
        const wk = []; for (let e = nc; e - 7 >= 0; e -= 7) wk.push(xc.slice(e - 7, e).reduce((a, b) => a + b, 0));
        let sdw; if (wk.length >= 3) { const mw = wk.reduce((a, b) => a + b, 0) / wk.length; sdw = Math.sqrt(wk.reduce((a, b) => a + (b - mw) * (b - mw), 0) / (wk.length - 1)); } else sdw = Math.sqrt(Math.max(rate * 7, 0));
        const mw = rate * 7, ci = { w80: [Math.max(0, mw - 1.28 * sdw), mw + 1.28 * sdw], w95: [Math.max(0, mw - 1.96 * sdw), mw + 1.96 * sdw], m80: [Math.max(0, rate * 30 - 1.28 * sdw * Math.sqrt(30 / 7)), rate * 30 + 1.28 * sdw * Math.sqrt(30 / 7)], m95: [Math.max(0, rate * 30 - 1.96 * sdw * Math.sqrt(30 / 7)), rate * 30 + 1.96 * sdw * Math.sqrt(30 / 7)] };
        const cls = abc.get(pid) || 'C', T = cfg.lead + cfg.rev, sdc = Math.min(sdw, Math.sqrt(Math.max(rate * 7, 0) * 3)), ss = Z[cls] * sdc * Math.sqrt(T / 7), rop = rate * cfg.lead + ss, tgt = rate * T + ss, ex = ndxExpiry(p, rate), pos = stock - ex.expired + (onOrd.get(pid) || 0);
        const st0 = ndwSet(), mq = parseInt(p.minQty), hasMin = isFinite(mq) && mq > 0, cover = rate > 0 ? pos / rate : null, rare = (rate * 30 < 1 || nz.length < 3) && !hasMin, oc = ndwOrderCore(rate, rop, tgt, pos, hasMin, mq);   // أقل من 3 أيام بيع = دليل غير كافٍ للطلب
        const cntd = p.counted === true || hm, status = !cntd ? 'wait' : (hasMin && pos <= mq) ? 'order' : rare ? 'rare' : oc.need ? 'order' : (cover !== null && cover > ndOverDays()) ? 'over' : 'ok';
        const sold = x.reduce((a, b) => a + b, 0);
        rows.push({ src: 's', method: 'sales', counted: cntd, manual: hm, p, ex, ci, wks: wk.length, cls, pat, rate, stock, ord: onOrd.get(pid) || 0, ss, rop, tgt, sdw: sdc, status, zdays, sug: cntd ? oc.sug : 0, minQ: hasMin ? mq : 0, cover, pos, nz: nz.length, n, x, st, miss: [...mm.values()].reduce((a, b) => a + b, 0), conf: nz.length >= 8 ? 'جيدة' : nz.length >= 4 ? 'متوسطة' : 'منخفضة', consumed: sold, demand: sold, span: n, ev: [], first: first, last, since: ndmDays(last, today), units: sold, nEv: nz.length, nsE: 0, nsO: 0, w80: ci.w80, sups: [], sup: '' });
    });
    const ord = { order: 0, ok: 1, over: 2, rare: 3, wait: 4 }, sm = ndwSupMap();
    rows.forEach(r => { r.sups = sm.get(r.p.id) || []; r.sup = ndwSupPick(r.sups, r.p.id); });
    return { cfg, rows: rows.sort((a, b) => ord[a.status] - ord[b.status] || (a.cover == null ? 1e9 : a.cover) - (b.cover == null ? 1e9 : b.cover)) };
}
let ndmRows = [], ndmSetShow = false;
// سطر توضيحي لمصدر بيانات المبيعات المعتمدة في التقدير (عددها ومداها وآخر خطأ تحميل)
function ndmSrcLine() {
    const f = ndmFrom(), t = todayLocalISO(), a = (billAll || []).filter(b => b && b.issued && !b.cancelled && String(b.date || '') >= f && String(b.date || '') <= t), ds = a.map(b => String(b.date)).sort();
    const rng = ds.length ? `من ${fmtDateDMY(ds[0])} إلى ${fmtDateDMY(ds[ds.length - 1])}` : 'لا توجد فواتير في المدة';
    return `<div class="bill-set-hint" style="margin:6px 2px">المبيعات المعتمدة: ${fmtNum(a.length)} فاتورة (${rng}).${window.__invErr ? '<br>تعذّر تحديثها من السحابة: ' + escapeHtml(String(window.__invErr)) : ''}</div>`;
}
function ndmHtml() {
    ndwSup = ''; const c = ndmCalc(); ndmRows = c.rows; const cfg = c.cfg, vc = k => c.rows.filter(r => r.status === k).length, nOrd = c.rows.filter(r => r.status === 'order' && r.sug > 0).length, nExp = c.rows.filter(r => r.ex && r.ex.flag).length;
    const main = [['order', 'اطلب الآن', vc('order')], ['over', 'زائد', vc('over')], ['rare', 'حسب الطلب', vc('rare')], ['all', 'الكل', null]];
    const seg = `<div class="ndw-seg">${main.map(([k, l, n]) => `<button type="button" class="${ndmF === k ? 'on' : ''}" onclick="ndmF='${k}';ndmShow=60;exRender()">${l}${n !== null ? '<b>' + fmtNum(n) + '</b>' : ''}</button>`).join('')}</div>`;
    const oth = `<select class="ndw-sel" onchange="if(this.value){ndmF=this.value;ndmShow=60;exRender()}" aria-label="حالات أخرى"><option value="" ${['wait', 'exp'].includes(ndmF) ? '' : 'selected'}>حالات أخرى</option><option value="wait" ${ndmF === 'wait' ? 'selected' : ''}>بانتظار الجرد (${fmtNum(vc('wait'))})</option><option value="exp" ${ndmF === 'exp' ? 'selected' : ''}>نفاذ قريب (${fmtNum(nExp)})</option></select>`;
    return `<div class="ndw-tb"><input type="search" id="ndmSearch" autocomplete="off" placeholder="ابحث عن مادة" value="${escapeHtml(ndmQ)}" oninput="ndmQ=this.value;ndmShow=60;ndmRowsRedraw()"><button type="button" class="ndw-ib" onclick="ndmSetShow=!ndmSetShow;exRender()" aria-label="الإعدادات"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button></div>
        ${ndmSrcLine()}${seg}<div class="ndw-fr">${oth}</div>
        <details class="nd-set" ${ndmSetShow ? 'open' : 'style="display:none"'}><summary>الإعدادات وطريقة الحساب</summary><div class="nd-set-b">${ndwSetRows()}
        <div class="nd-hint">طريقة الحساب:<br>• الأساس المبيعات الفعلية (الصادر) خلال آخر 12 أسبوعاً، لا الوارد.<br>• تُستبعد فترة النفاد الحالية فقط (إن كان الرصيد صفراً)، ويُضاف ما سُجّل في «المطلوبة وغير المتوفرة».<br>• المواد غير المجرودة تظهر «بانتظار الجرد» ولا يُقترح لها طلب حتى يُعرف رصيدها.<br>• لا يُقترح طلب لمادة بيعت في أقل من 3 أيام مختلفة.<br>• يُصنَّف نمط الطلب (منتظم، متذبذب، متقطع، كتلي) ويُختار نموذج مناسب له.<br>• الكمية المقترحة تغطي «مدة الهدف» بعد خصم المتوفر وما قيد الطلب.<br>• الحد الأدنى المسجل في بطاقة المادة يُعتمد إن وُجد.<br>• المادة التي تقل مبيعاتها عن علبة شهرياً تُصنَّف «حسب الطلب» ولا يُقترح لها شراء.<br>• المذخر المقترح هو الأرخص بآخر سعر شراء، وإلا الأكثر شراءً منه.<br>• مدة وصول الطلبية ${fmtNum(cfg.lead)} ${cfg.lead === 1 ? 'يوم' : 'أيام'} ودورة الطلب ${fmtNum(cfg.rev)} ${cfg.rev === 1 ? 'يوم' : 'أيام'} (تلقائياً من سجل المخزن).</div>
        <div class="bill-set-hint">حدود هذه الطريقة:<br>• دقتها مرتبطة باكتمال تسجيل فواتير البيع.<br>• المواد التي لم تُسجَّل لها مبيعات خلال المدة لا تظهر هنا.<br>• الموسمية لا تُرصد قبل مرور سنة من البيانات.</div></div></details>
        <div id="ndmList">${ndmListHtml()}</div>
        ${nOrd ? `<div class="ndw-bar"><button type="button" class="cn-new" onclick="ndwToList('s')">إضافة المواد المطلوبة (${fmtNum(nOrd)}) إلى النواقص</button></div>` : ''}`;
}
function ndmListHtml() {
    const q = ndmQ ? normSearch(ndmQ) : '', toks = q ? q.split(' ') : [];
    const list = ndmRows.map((r, i) => [r, i]).filter(([r]) => q ? searchScore(r.p, q, toks) > 0 : ((!ndwSup || r.sup === ndwSup) && (ndmF === 'all' || (ndmF === 'exp' ? r.ex && r.ex.flag : r.status === ndmF))));
    return (list.slice(0, ndmShow).map(([r, i]) => ndwRow(r, i, 'ndmDetail')).join('') || `<div class="cu-none">${q ? 'لا توجد مبيعات مسجلة لهذه المادة خلال المدة، فلا يمكن تقدير احتياجها.' : 'لا توجد مواد في هذا التصنيف.'}</div>`)
        + (list.length > ndmShow ? `<button type="button" class="ex-cat" onclick="ndmShow+=60;ndmRowsRedraw()">عرض المزيد (${fmtNum(list.length - ndmShow)})</button>` : '');
}
function ndmRowsRedraw() { const b = document.getElementById('ndmList'); if (b) b.innerHTML = ndmListHtml(); }
function ndmDetail(i) {
    const r = ndmRows[i]; if (!r) return;
    ndwSrc = 's'; ndwCur = r.p.id; if (ndwOffer) { ndwOffer = false; ndwOpenSec = { plan: true }; }
    Swal.fire({ title: 'تقدير الاحتياج من المبيعات', showConfirmButton: false, showCloseButton: true, width: 'min(94vw, 520px)', html: `<div id="ndwDet" class="fu-det" dir="rtl" style="text-align:right">${ndwDetBody(r)}</div>` });
}
// رسم المبيعات الأسبوعية: أعمدة أسبوعية + خط المتوسط المقدّر، مع محور تواريخ وشبكة
function ndmChartSvg(r) {
    const wk = [], n = r.x.length; for (let e = n; e > 0; e -= 7) wk.unshift({ d: sdAdd(r.st, Math.max(0, e - 7)), v: r.x.slice(Math.max(0, e - 7), e).reduce((a, b) => a + b, 0), len: Math.min(7, e) });
    const avg = r.rate * 7, raw = Math.max(1, avg, ...wk.map(w => w.v)), mag = Math.pow(10, Math.floor(Math.log10(raw))), ym = [1, 2, 2.5, 5, 10].map(k => k * mag).find(v => v >= raw * 1.05) || raw * 1.1;
    const W = 360, H = 210, L = 36, R = 12, Tp = 18, B = 34, k = wk.length, bw = Math.min(26, (W - L - R) / Math.max(1, k) * 0.7), x = i => L + (i + 0.5) / k * (W - L - R), y = v => Tp + (1 - v / ym) * (H - Tp - B), base = y(0), dm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    const every = Math.max(1, Math.ceil(k / 6));
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:100%;direction:ltr" role="img" aria-label="المبيعات الأسبوعية" font-family="inherit">
        ${[0, .25, .5, .75, 1].map(q => `<line x1="${L}" y1="${y(ym * q).toFixed(1)}" x2="${W - R}" y2="${y(ym * q).toFixed(1)}" stroke="${q === 0 ? '#94a3b8' : '#e2e8f0'}" ${q === 0 ? '' : 'stroke-dasharray="3 3"'}/><text x="${L - 5}" y="${(y(ym * q) + 3).toFixed(1)}" font-size="9" fill="#64748b" text-anchor="end">${fmtNum(Math.round(ym * q * 10) / 10)}</text>`).join('')}
        <text x="${L}" y="${Tp - 6}" font-size="9" fill="#64748b">علبة أسبوعياً</text>
        ${wk.map((w, i) => `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${y(w.v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(base - y(w.v)).toFixed(1)}" rx="2" fill="#0f766e" opacity=".85"/>${i % every === 0 ? `<line x1="${x(i).toFixed(1)}" y1="${base}" x2="${x(i).toFixed(1)}" y2="${base + 4}" stroke="#94a3b8"/><text x="${x(i).toFixed(1)}" y="${base + 16}" font-size="9" fill="#64748b" text-anchor="middle">${dm(w.d)}</text>` : ''}`).join('')}
        <line x1="${L}" y1="${y(avg).toFixed(1)}" x2="${W - R}" y2="${y(avg).toFixed(1)}" stroke="#b45309" stroke-width="1.6" stroke-dasharray="4 3"/></svg>
        <div class="ndw-lg"><span><i style="background:#0f766e"></i>المبيعات الأسبوعية</span><span><i style="background:#b45309"></i>المتوسط المقدّر ${fmtNum(Math.round(avg * 10) / 10)}</span></div>`;
}


// ============================================================================
// تقدير الاحتياج من الوارد: طريقة إضافية حين تكون المبيعات غير مسجّلة بالكامل.
// الفكرة: ما اشتُري (مع البونص وبعد المردود) قبل آخر شراء قد استُهلك قبل ذلك الشراء، فمعدل الاستهلاك =
// مجموع ما اشتُري قبل آخر شراء ÷ المدة بين أول وآخر شراء. تحتاج المادة 3 مرات شراء بمدة 14 يوماً فأكثر.
// ثم تُقارن نقطة إعادة الطلب بالرصيد المجرود (والمواد غير المجرودة تُعرض بمعدلها فقط).
// ============================================================================
let ndwSrc = 'i', ndwF = 'order', ndwSup = '', ndwOffer = false, ndwGrp = [], ndwShow = 60, ndwQ = '', ndwRows = [], ndwCur = null, ndwOpenSec = { sum: true, need: true };
let ndwPer = (() => { try { const o = JSON.parse(localStorage.getItem('diwanNdwPer')); if (o && o.n > 0 && o.u > 0) return o; } catch (e) { /* تجاهل */ } return { n: 1, u: 30, ss: true }; })();
const ndwManualMap = () => { try { return JSON.parse(localStorage.getItem('diwanNdwManual')) || {}; } catch (e) { return {}; } };   // أرصدة يدوية للحساب فقط (لا تُسجَّل في الجرد)
const ndwManualSave = m => { try { localStorage.setItem('diwanNdwManual', JSON.stringify(m)); } catch (e) { /* تجاهل */ } };
const NDW_ST = { order: ['اطلب الآن', 'bad'], ok: ['كافٍ', 'ok'], over: ['زائد', 'wb'], still: ['راكد', ''], rare: ['حسب الطلب', ''], wait: ['بانتظار الجرد', ''], low: ['بيانات غير كافية', ''] };
// إعدادات تقدير الوارد (على هذا الجهاز): مدة الهدف للطلب، وحد «اطلب الآن» بالأيام
function ndwSet() { let o = {}; try { o = JSON.parse(localStorage.getItem('diwanNdwSet')) || {}; } catch (e) { o = {}; } const g = (v, d, a, b) => { v = parseInt(v); return v >= a && v <= b ? v : d; }; return { target: g(o.target, 7, 1, 365), urgent: g(o.urgent, 3, 1, 120) }; }
function ndwSetSave(k, v) { const o = ndwSet(); o[k] = parseInt(v); try { localStorage.setItem('diwanNdwSet', JSON.stringify(o)); } catch (e) { /* تجاهل */ } exRender(); }
function ndwSetRows() {
    const o = ndwSet(), inp = (k, v, a, b) => `<input type="number" inputmode="numeric" min="${a}" max="${b}" value="${v}" onchange="ndwSetSave('${k}',this.value)" style="width:80px;height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;text-align:center;box-sizing:border-box">`;
    return `<div class="fu-dr"><span>أدنى مدة تغطية بعد الطلب (يوماً)</span>${inp('target', o.target, 1, 365)}</div><div class="fu-dr"><span>أدنى تغطية قبل «اطلب الآن» (يوماً)</span>${inp('urgent', o.urgent, 1, 120)}</div>${ndOverRow()}`;
}
// المذاخر: لكل مادة المذاخر التي اشتُريت منها (عدد المرات، آخر تاريخ، آخر سعر فعلي)، والأنسب = الأرخص بآخر سعر ثم الأكثر شراءً
function ndwSupMap() {
    const mp = new Map(), key = x => String(x || '').trim().toLowerCase();
    (typeof puAll !== 'undefined' ? puAll : []).forEach(r => {
        if (!r || r.cancelled || r.gift || !String(r.supplier || '').trim()) return; const d = String(r.date || '').slice(0, 10), nm = String(r.supplier).trim();
        (r.items || []).forEach(it => {
            if (!it.pid) return; let m = mp.get(it.pid); if (!m) { m = new Map(); mp.set(it.pid, m); }
            let e = m.get(key(nm)); if (!e) { e = { name: nm, n: 0, last: '', cost: 0 }; m.set(key(nm), e); }
            e.n++; const c = typeof puEffCost === 'function' ? puEffCost(it) : 0; if (d >= e.last) { e.last = d; if (c > 0) e.cost = c; else if (!e.cost) e.cost = 0; }
        });
    });
    const out = new Map(); mp.forEach((m, pid) => out.set(pid, [...m.values()].sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1))));
    return out;
}
function ndwSupPick(sups, pid) {   // المذخر الأنسب: اختيار المدير ثم الأرخص بآخر سعر (إن توفر سعران) ثم الأكثر شراءً
    if (!sups || !sups.length) return '';
    let ov = {}; try { ov = JSON.parse(localStorage.getItem('diwanNdwSup')) || {}; } catch (e) { ov = {}; }
    if (ov[pid] && sups.some(x => x.name === ov[pid])) return ov[pid];
    const priced = sups.filter(x => x.cost > 0);
    return priced.length >= 2 ? priced.slice().sort((a, b) => a.cost - b.cost || b.n - a.n)[0].name : sups[0].name;
}
function ndwSupChoose(pid, name) { let ov = {}; try { ov = JSON.parse(localStorage.getItem('diwanNdwSup')) || {}; } catch (e) { ov = {}; } if (name) ov[pid] = name; else delete ov[pid]; try { localStorage.setItem('diwanNdwSup', JSON.stringify(ov)); } catch (e) { /* تجاهل */ } ndwDetRefresh(); }
function ndwTopSups(n) { const c = new Map(); (typeof puAll !== 'undefined' ? puAll : []).forEach(r => { if (!r || r.cancelled || r.gift) return; const nm = String(r.supplier || '').trim(); if (!nm) return; const k = nm.toLowerCase(), e = c.get(k) || { name: nm, n: 0 }; e.n++; c.set(k, e); }); return [...c.values()].sort((a, b) => b.n - a.n).slice(0, n).map(x => x.name); }
function ndwCalc() {
    const cfg = ndmCfg(), today = todayLocalISO(), T = cfg.lead + cfg.rev, ev = new Map();
    (typeof puAll !== 'undefined' ? puAll : []).forEach(r => {
        if (!r || r.cancelled) return; const d = String(r.date || '').slice(0, 10); if (!d) return;
        (r.items || []).forEach(it => {
            if (!it.pid) return; const u = (parseInt(it.qty) || 0) + (parseInt(it.bonus) || 0) - (parseFloat(it.ret) || 0); if (!(u > 0)) return;
            let m = ev.get(it.pid); if (!m) { m = new Map(); ev.set(it.pid, m); } m.set(d, (m.get(d) || 0) + u);
        });
    });
    // المنتهي/التالف والمناقلة الخارجة (إن كانت أثّرت على المخزن) ليست طلباً: تُستبعد من الطلب. المناقلة الواردة تُعدّ وارداً.
    const nsExp = new Map(), nsOut = new Map();
    try {
        const add = (mp, pid, d, q) => { const o = mp.get(pid) || []; o.push({ d, q }); mp.set(pid, o); };
        (typeof lgExps === 'function' ? lgExps() : []).forEach(e => { if (!e.stockApplied) return; (e.items || []).forEach(l => { const q = puNum(l.qty) || 0; if (q > 0) add(nsExp, l.pid, String(e.date || '').slice(0, 10), q); }); });
        (typeof lgXfers === 'function' ? lgXfers() : []).forEach(e => { if (!e.stockApplied) return; const d = String(e.date || '').slice(0, 10); (e.items || []).forEach(l => { const q = puNum(l.qty) || 0; if (!(q > 0) || !d) return; if (e.dir === 'in') { let m = ev.get(l.pid); if (!m) { m = new Map(); ev.set(l.pid, m); } m.set(d, (m.get(d) || 0) + q); } else add(nsOut, l.pid, d, q); }); });
    } catch (e) { /* تجاهل */ }
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
    const rows = [], man = ndwManualMap(), sMap = new Map(), abcM = ndAbcMap(), zAll = ndZeroLoad(), obAll = ndOpenLoad();
    try { ndmCalc().rows.forEach(r => sMap.set(r.p.id, r)); } catch (e) { /* تجاهل */ }
    ev.forEach((m, pid) => {
        const p = products.find(x => x.id === pid); if (!p || p.arch) return;
        const hasMan = p.counted !== true && man[pid] !== undefined && man[pid] !== '' && isFinite(parseFloat(man[pid]));   // رصيد يدوي لمادة غير مجرودة: للحساب فقط
        const ds = [...m.keys()].sort(), span = ndmDays(ds[0], ds[ds.length - 1]), counted = p.counted === true || hasMan;
        const stock = hasMan ? parseFloat(man[pid]) : (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0);
        const total = [...m.values()].reduce((a, b) => a + b, 0), since0 = ndmDays(ds[0], today);
        const okA = ds.length >= 3 && span >= 14, okB = counted && since0 >= 14;   // ب: طريقة الرصيد (أثر رجعي) للمواد المجرودة
        if (!okA && !okB) {   // بيانات غير كافية: تُعرض في «الكل» وبالبحث ليُدخَل رصيدها اليدوي
            const exL = ndxExpiry(p, 0), oL = onOrd.get(pid) || 0;
            rows.push({ p, ex: exL, rate: 0, stock, ord: oL, ss: 0, rop: 0, tgt: 0, status: 'low', counted, manual: hasMan, method: 'none', consumed: 0, nEv: ds.length, span: since0, last: ds[ds.length - 1], since: ndmDays(ds[ds.length - 1], today), first: ds[0], units: total, w80: [0, 0], sug: 0, conf: 'منخفضة', sdw: 0, demand: 0, nsE: 0, nsO: 0, pos: stock - exL.expired + oL, ev: ds.map(d => ({ d, u: m.get(d) })) });
            return;
        }
        let usedA = 0; const rates = []; for (let k = 0; k < ds.length - 1; k++) { usedA += m.get(ds[k]); const g = ndmDays(ds[k], ds[k + 1]); if (g > 0) rates.push(m.get(ds[k]) / g); }
        let useRec = false, usedR = 0, spanR = 0;   // وارد قديم جداً: اعتماد آخر 120 يوماً بدل متوسط كل المدة
        if (okB && since0 > 180) { const rc = ds.filter(d => ndmDays(d, today) <= 120); if (rc.length >= 3) { spanR = ndmDays(rc[0], rc[rc.length - 1]); if (spanR >= 21) { for (let k = 0; k < rc.length - 1; k++) usedR += m.get(rc[k]); useRec = true; } } }
        const okBe = okB && !useRec, rateA = okA ? usedA / span : 0, method = okBe ? 'bal' : 'int';
        const ob = Math.max(0, parseFloat(obAll[pid]) || 0), consumed = Math.max(0, ob + total - stock), sumNs = mp => (mp.get(pid) || []).filter(x => x.d >= ds[0]).reduce((a, x) => a + x.q, 0), nsE = sumNs(nsExp), nsO = sumNs(nsOut);
        const zc = okBe ? [...(Array.isArray(zAll[pid]) ? zAll[pid] : [])].filter(d => d >= ds[0]).length : 0, effDays = Math.max(14, since0 - zc);   // أيام النفاد المسجلة لا تُحتسب
        const demand = useRec ? usedR : okBe ? Math.max(0, consumed - nsE - nsO) : usedA;
        let rate = useRec ? usedR / spanR : okBe ? demand / effDays : rateA; const period = useRec ? spanR : okBe ? since0 : span;
        const sr0 = sMap.get(pid), fromS = !!(sr0 && sr0.counted && sr0.nz >= 8 && sr0.n >= 28);   // المبيعات الفعلية أدق متى توفرت
        if (fromS) rate = sr0.rate;
        let phi = 2; { const iv = []; for (let k = 0; k < ds.length - 1; k++) { const g = ndmDays(ds[k], ds[k + 1]); if (g > 0) iv.push({ u: m.get(ds[k]), g }); } if (iv.length >= 3) { const lm = iv.reduce((a, x) => a + x.u, 0) / iv.reduce((a, x) => a + x.g, 0); if (lm > 0) phi = Math.min(3, Math.max(1, iv.reduce((a, x) => a + Math.pow(x.u - lm * x.g, 2) / (lm * x.g), 0) / (iv.length - 1))); } }
        let sdw = Math.sqrt(Math.max(rate * 7, 0) * phi); if (fromS) sdw = sr0.sdw; const mw = rate * 7; // انحراف أسبوعي بنموذج بواسون المتشتت (φ بين 1 و3) بدل تباين فترات الشراء المضخَّم
        const ex = ndxExpiry(p, rate), ord = onOrd.get(pid) || 0, pos = stock - ex.expired + ord;
        const cls = abcM.get(pid) || 'B', ss = ND_Z[cls] * sdw * Math.sqrt(T / 7), rop = rate * cfg.lead + ss, tgt = rate * T + ss;
        const st0 = ndwSet(), mq = parseInt(p.minQty), hasMin = isFinite(mq) && mq > 0, cover = rate > 0 ? pos / rate : null, rare = rate * 30 < 1 && !hasMin, oc = ndwOrderCore(rate, rop, tgt, pos, hasMin, mq);
        const status = !counted ? 'wait' : (hasMin && pos <= mq) ? 'order' : (rate === 0 && pos > 0 && since0 >= 90 && !hasMin) ? 'still' : rare ? 'rare' : oc.need ? 'order' : (cover !== null && cover > ndOverDays()) ? 'over' : 'ok';
        const sugQ = counted ? oc.sug : 0;
        const conf = fromS ? sr0.conf : okBe ? (since0 >= 90 && ds.length >= 2 ? 'جيدة' : since0 >= 45 ? 'متوسطة' : 'منخفضة') : (ds.length >= 8 ? 'جيدة' : ds.length >= 5 ? 'متوسطة' : 'منخفضة');
        rows.push({ p, ex, rate, stock, ord, ss, rop, tgt, status, counted, method, consumed: okBe ? consumed : useRec ? usedR : usedA, nEv: ds.length, span: period, last: ds[ds.length - 1], since: ndmDays(ds[ds.length - 1], today), first: ds[0], units: total, w80: [Math.max(0, mw - 1.28 * sdw), mw + 1.28 * sdw], cls, fromS, ob, zc, sug: sugQ, minQ: hasMin ? mq : 0, cover, conf, manual: hasMan, sdw, pos, demand, nsE, nsO, ev: ds.map(d => ({ d, u: m.get(d) })) });
    });
    const ord = { order: 0, ok: 1, over: 2, still: 3, rare: 4, wait: 5, low: 6 }, sm = ndwSupMap();
    rows.forEach(r => { r.sups = sm.get(r.p.id) || []; r.sup = ndwSupPick(r.sups, r.p.id); });
    return { cfg, rows: rows.sort((a, b) => ord[a.status] - ord[b.status] || (a.rate > 0 ? a.stock / a.rate : 1e9) - (b.rate > 0 ? b.stock / b.rate : 1e9)) };
}
let ndcSynth = null;
const ndwFind = pid => ndwSrc === 'y' ? ndcSynth : (ndwSrc === 's' ? ndmRows : ndwRows).find(x => x.p.id === pid);
function ndwCoverTxt(d) { return d === null || d === undefined ? 'بلا استهلاك' : d < 1 ? 'أقل من يوم' : d < 60 ? fmtNum(Math.floor(d)) + ' يوماً' : d < 365 ? fmtNum(Math.round(d / 30 * 10) / 10) + ' شهر' : 'أكثر من سنة'; }
function ndwRow(r, i, fn) {
    const st = NDW_ST[r.status], mo = r.rate * 30, f = v => fmtNum(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
    const l2 = r.status === 'low' ? 'بيانات غير كافية • افتح المادة لإدخال الرصيد' : 'الشهري ' + f(mo) + ' • ' + (r.counted ? 'يكفي ' + ndwCoverTxt(r.cover) : 'غير مجرودة');
    const tags = (r.fromS ? '<small class="ndw-tg">محسوب من المبيعات</small>' : '') + (r.conf === 'منخفضة' && r.status !== 'low' && !r.fromS ? '<small class="ndw-tg">تقدير أولي لقلة البيانات</small>' : '') + ndxTag(r.ex);
    const cvc = { order: '#dc2626', over: '#d97706', ok: '#16a34a' }[r.status], bar = cvc && r.counted && r.rate > 0 && r.cover != null ? `<div class="ndw-cv"><i style="width:${Math.max(3, Math.min(100, Math.round(r.cover / ndOverDays() * 100)))}%;background:${cvc}"></i></div>` : '';
    return `<div class="cu-row fu-row ndw-rw" onclick="${fn || 'ndwDetail'}(${i})"><div><b dir="ltr">${dispNameHtml(r.p)}</b><small class="ndw-l2">${l2}</small>${tags}${bar}</div>
        <div class="fu-st ${st[1]}">${r.status === 'order' && r.sug ? 'اطلب ' + fmtNum(r.sug) : st[0]}</div></div>`;
}
let ndwIdle = false, ndwSetShow = false;
function ndwListHtml() {
    const q = ndwQ ? normSearch(ndwQ) : '', toks = q ? q.split(' ') : [];
    let list = ndwRows.map((r, i) => [r, i]).filter(([r]) => q ? searchScore(r.p, q, toks) > 0 : (!ndwSup || r.sup === ndwSup) && (ndwF === 'all' || (ndwF === 'exp' ? r.ex && r.ex.flag : r.status === ndwF)));
    let idle = [];
    if (!q && ndwF === 'all') { idle = list.filter(([r]) => ['still', 'rare', 'wait'].includes(r.status)); if (idle.length) list = list.filter(([r]) => !['still', 'rare', 'wait'].includes(r.status)); }
    const idleBox = idle.length ? `<button type="button" class="ndw-idle" onclick="ndwIdle=!ndwIdle;ndwRowsRedraw()"><span>مواد بلا حركة كافية للتقدير (${fmtNum(idle.length)})</span><span>${ndwIdle ? 'إخفاء' : 'عرض'}</span></button>` + (ndwIdle ? idle.slice(0, ndwShow).map(([r, i]) => ndwRow(r, i)).join('') + (idle.length > ndwShow ? `<button type="button" class="ex-cat" onclick="ndwShow+=60;ndwRowsRedraw()">عرض المزيد (${fmtNum(idle.length - ndwShow)})</button>` : '') : '') : '';
    return (list.slice(0, ndwShow).map(([r, i]) => ndwRow(r, i)).join('') || (idle.length ? '' : `<div class="cu-none">${q ? 'لا يتوفر لهذه المادة سجل وارد كافٍ للتقدير.<br>للمجرودة: وارد مسجل منذ 14 يوماً فأكثر.<br>لغير المجرودة: 3 مرات شراء على الأقل.' : 'لا توجد مواد في هذا التصنيف.'}</div>`))
        + (list.length > ndwShow ? `<button type="button" class="ex-cat" onclick="ndwShow+=60;ndwRowsRedraw()">عرض المزيد (${fmtNum(list.length - ndwShow)})</button>` : '') + idleBox;
}
function ndwTools() {
    Swal.fire({ title: 'الأدوات', showConfirmButton: false, showCloseButton: true, width: 'min(92vw, 420px)', html: `<div dir="rtl" class="ndw-menu"><button type="button" class="ln-btn" onclick="Swal.close();ndwSetShow=!ndwSetShow;exRender();if(ndwSetShow){const d=document.getElementById('ndwSetBox');if(d)d.scrollIntoView({block:'start'})}">${ndwSetShow ? 'إخفاء الإعدادات وطريقة الحساب' : 'الإعدادات وطريقة الحساب'}</button></div>` });
}
function ndwRowsRedraw() { const b = document.getElementById('ndwList'); if (b) b.innerHTML = ndwListHtml(); }
function ndwHtml() {
    const c = ndwCalc(); ndwRows = c.rows; const cnt = k => c.rows.filter(r => r.status === k).length, vis = c.rows.filter(r => !ndwSup || r.sup === ndwSup), nOrd = vis.filter(r => r.status === 'order' && r.sug > 0).length;
    const vc = k => vis.filter(r => r.status === k).length, nExp = vis.filter(r => r.ex && r.ex.flag).length, main = [['order', 'اطلب الآن', vc('order')], ['over', 'زائد', vc('over')], ['still', 'راكد', vc('still')], ['all', 'الكل', null]];
    const seg = `<div class="ndw-seg">${main.map(([k, l, n]) => `<button type="button" class="${ndwF === k ? 'on' : ''}" onclick="ndwF='${k}';ndwShow=60;exRender()">${l}${n !== null ? '<b>' + fmtNum(n) + '</b>' : ''}</button>`).join('')}</div>`;
    const oth = `<select class="ndw-sel" onchange="if(this.value){ndwF=this.value;ndwShow=60;exRender()}" aria-label="حالات أخرى"><option value="" ${['wait', 'exp'].includes(ndwF) ? '' : 'selected'}>حالات أخرى</option><option value="wait" ${ndwF === 'wait' ? 'selected' : ''}>بانتظار الجرد (${fmtNum(vc('wait'))})</option><option value="exp" ${ndwF === 'exp' ? 'selected' : ''}>نفاذ قريب (${fmtNum(nExp)})</option></select>`;
    ndwSup = '';
    return `<details class="nd-set" id="ndwSetBox" ${ndwSetShow ? 'open' : 'style="display:none"'}><summary>الإعدادات وطريقة الحساب</summary><div class="nd-set-b">${ndwSetRows()}
        <div class="nd-hint">طريقة الحساب:<br>• الأساس سجل الوارد، لأن المبيعات غير مسجلة بالكامل.<br>• المواد المجرودة: المستهلك = الوارد − الرصيد الحالي، مقسوماً على المدة منذ أول وارد.<br>• المواد غير المجرودة: تُقدَّر من الفترات بين مرات الشراء (ثلاث مرات فأكثر).<br>• الكمية المقترحة تغطي «مدة الهدف» بعد خصم المتوفر وما قيد الطلب.<br>• الحد الأدنى المسجل في بطاقة المادة يُعتمد إن وُجد.<br>• المادة التي يقل استهلاكها عن علبة شهرياً تُصنَّف «حسب الطلب» ولا يُقترح لها شراء.<br>• المذخر المقترح هو الأرخص بآخر سعر شراء، وإلا الأكثر شراءً منه.</div>
        <div class="bill-set-hint">حدود هذه الطريقة:<br>• قد يقلّ التقدير إن كان لديك رصيد قبل أول وارد مسجل أو وارد غير مسجل.<br>• يعكس الاستهلاك الكلي (بيعاً وتحويلاً وإتلافاً) لا المبيعات وحدها.<br>• نفاد المادة بين مرتين يخفض التقدير.<br>• تتحسن الدقة مع تراكم السجل، وتصبح «من المبيعات» أدق متى سُجلت المبيعات يومياً.</div></div></details>
        <div class="ndw-tb"><input type="search" id="ndwSearch" autocomplete="off" placeholder="ابحث عن مادة" value="${escapeHtml(ndwQ)}" oninput="ndwQ=this.value;ndwShow=60;ndwRowsRedraw()"><button type="button" class="ndw-ib" onclick="ndwTools()" aria-label="الأدوات"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></button></div>
        ${seg}<div class="ndw-fr">${oth}</div>
        <div id="ndwList">${ndwListHtml()}</div>
        ${nOrd ? `<div class="ndw-bar"><button type="button" class="cn-new" onclick="ndwToList()">إضافة المواد المطلوبة (${fmtNum(nOrd)}) إلى النواقص</button></div>` : ''}`;
}
function ndwSupSel(k) { ndwSup = k >= 0 ? (ndwTopSups(3)[k] || '') : ''; ndwShow = 60; exRender(); }
function ndwOfferMode() { ndcOpen(); }
// تجميع الطلب حسب المذخر: المواد «اطلب الآن» موزعة على مذاخرها الأنسب مع التكلفة التقديرية
function ndwSupSheet(src) {
    const rows = (src === 's' ? ndmRows : ndwRows).filter(r => r.status === 'order' && r.sug > 0); if (!rows.length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد مطلوبة الآن', confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38' }); return; }
    const g = new Map(), f = v => fmtNum(Math.round(v * 10) / 10);
    rows.forEach(r => { const k = r.sup || ''; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    const keys = [...g.keys()].sort((a, b) => (a === '') - (b === '') || g.get(b).length - g.get(a).length); ndwGrp = keys.map(k => g.get(k));
    const cost = rs => rs.reduce((t, r) => { const e = r.sups.find(x => x.name === r.sup); return t + (e && e.cost > 0 ? e.cost * r.sug : 0); }, 0);
    const html = keys.map((k, i) => { const rs = g.get(k), c = cost(rs); return `<div class="nd-set" style="padding:10px 12px"><div class="fu-dr" style="border:0"><span style="font-weight:800;color:#0f1c38">${k ? escapeHtml(k) : 'بلا مذخر مسجل'}</span><b>${fmtNum(rs.length)} مادة</b></div>
        ${rs.map(r => `<div class="fu-dr"><span dir="ltr">${dispNameHtml(r.p)}</span><b>${f(r.sug)}</b></div>`).join('')}
        ${c > 0 ? `<div class="fu-dr ndw-sub"><span>التكلفة التقديرية بآخر سعر</span><b>${fmtNum(Math.round(c))} د.ع</b></div>` : ''}
        <button type="button" class="cn-new" style="margin:10px 0 0;min-height:44px" onclick="ndwToListGrp(${i})">إضافة إلى قائمتي</button></div>`; }).join('');
    Swal.fire({ title: 'الطلب حسب المذخر', showConfirmButton: false, showCloseButton: true, width: 'min(94vw, 520px)', html: `<div id="ndwSupBox" class="fu-det" dir="rtl" style="text-align:right">${html}</div>` });
}
function ndwPushList(rows) {
    const st = ndState(); rows.forEach(r => { delete st.off[r.p.id]; delete st.ordered[r.p.id]; if (!st.extra.includes(r.p.id)) st.extra.push(r.p.id); st.qty[r.p.id] = r.sug; if (r.sup) st.sup[r.p.id] = r.sup; else delete st.sup[r.p.id]; }); ndSave(st);
    Swal.fire({ icon: 'success', title: 'أُضيفت ' + fmtNum(rows.length) + ' مادة إلى «قائمتي» في النواقص والطلبية', toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 });
    try { ndBadge(); } catch (e) { /* تجاهل */ }
}
function ndwToListGrp(i) { const rs = ndwGrp[i]; if (rs && rs.length) ndwPushList(rs); }

// ============================================================================
// الأساس الإحصائي لتقدير الوارد (نموذج بويسون-غاما بايزي مع معامل تشتت):
// - عدد الوحدات المسحوبة خلال المدة يُعامل كعدّ بويسون بمعدل غير معروف λ، وتُحسب سلسلة λ اللاحقة من توزيع غاما (قبْليّ جيفريز 0.5).
//   فالبيانات القليلة تعطي مدى واسعاً بدل رقم مضلِّل، وتضيق الثقة كلما زادت المدة والكمية.
// - معامل التشتت φ من فترات الشراء (مربع كاي بيرسون ÷ درجات الحرية، بين 1 و3؛ 2 إن قلّت الفترات) يوسّع المدى عند تذبذب السحب.
// - الشراء الكبير (بونص/خصم) لا يؤثر لأن الأساس مجموع الوارد − الرصيد، والمردود والمنتهي/التالف والمناقلة الخارجة مستبعدة.
// - المحاكاة (مونت كارلو) بمولّد ثابت البذرة: النتيجة نفسها لنفس المدخلات.
// ============================================================================
function ndsRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function ndsNorm(rng) { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
function ndsGamma(k, rng) {   // مارساغليا-تسانغ
    if (k < 1) return ndsGamma(k + 1, rng) * Math.pow(rng(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) { let x, v; do { x = ndsNorm(rng); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rng(); if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
function ndsPois(m, rng) { if (m <= 0) return 0; if (m < 30) { const L = Math.exp(-m); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; } return Math.max(0, Math.round(m + Math.sqrt(m) * ndsNorm(rng))); }
const ndsQ = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))] : 0; };
function ndsSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ndsModel(r) {
    const C = r.method === 'bal' ? r.demand : r.consumed, T = Math.max(1, r.span), ivs = [];
    for (let k = 0; k < r.ev.length - 1; k++) { const g = ndmDays(r.ev[k].d, r.ev[k + 1].d); if (g > 0) ivs.push({ u: r.ev[k].u, g }); }
    let phi = 2, chi = 0;
    if (ivs.length >= 3) { const lam = ivs.reduce((a, x) => a + x.u, 0) / ivs.reduce((a, x) => a + x.g, 0); if (lam > 0) { chi = ivs.reduce((a, x) => a + Math.pow(x.u - lam * x.g, 2) / (lam * x.g), 0); phi = Math.min(3, Math.max(1, chi / (ivs.length - 1))); } }
    const a = C / phi + 0.5, b = T / phi, rng = ndsRng(ndsSeed('lam' + r.p.id + '|' + C + '|' + T)), ls = [];
    for (let i = 0; i < 2000; i++) ls.push(ndsGamma(a, rng) / b);
    const lo = ndsQ(ls, 0.025), hi = ndsQ(ls, 0.975), mean = a / b, rel = mean > 0 ? (hi - lo) / (2 * mean) : 9;
    // اتجاه الاستهلاك: اختبار كندال على معدلات الفترات (5 فترات فأكثر)
    let trend = null; const cr = ivs.map(x => x.u / x.g);
    if (cr.length >= 5) { let S = 0; for (let i = 0; i < cr.length; i++) for (let j = i + 1; j < cr.length; j++) S += Math.sign(cr[j] - cr[i]); const n = cr.length, tau = S / (n * (n - 1) / 2), z = 3 * tau * Math.sqrt(n * (n - 1)) / Math.sqrt(2 * (2 * n + 5)); trend = { tau, z, sig: Math.abs(z) >= 1.645 }; }
    return { C, T, a, b, phi, K: ivs.length, lam: C / T, mean, lo, hi, rel, rely: rel < 0.3 ? 'عالية' : rel < 0.6 ? 'متوسطة' : 'منخفضة', trend };
}
// محاكاة توريد مخطط: متى ينفد المخزون؟ وهل تُباع الدفعة قبل نفاذ صلاحيتها (الأقدم نفاذاً يُباع أولاً)؟
function ndsPlan(r, Q, expYM) {
    const mo = ndsModel(r), N = 3000, rng = ndsRng(ndsSeed('plan' + r.p.id + '|' + Q + '|' + expYM)), S0 = Math.max(0, r.stock - (r.ex ? r.ex.expired : 0)), S = S0 + Q, out = { mo, S0, S };
    const draw = (units, lam) => units > 0 ? Math.min(3650, ndsGamma(Math.max(1, Math.ceil(units)), rng) / lam) : 0, t0 = [], t1 = [];
    let D = null, ahead = 0; const nd = [], waste = [], tAll = [];
    if (expYM) {
        D = expiryDaysOf(expYM + '-01');
        try { const sc = btSc(r.p); getBatches(r.p).forEach(b => { if (!b.e) return; const d = expiryDaysOf(b.e); if (d !== null && d > 0 && b.e <= expYM + '-31') ahead += (b.q || 0) + (sc > 1 ? (b.l || 0) / sc : 0); }); } catch (e) { /* تجاهل */ }
        out.ahead = ahead;
    }
    for (let i = 0; i < N; i++) {
        const lam = Math.max(1e-9, ndsGamma(mo.a, rng) / mo.b);
        t0.push(draw(S0, lam)); t1.push(draw(S, lam));
        if (D !== null && D > 0 && Q > 0) { const c = ndsPois(lam * D, rng); nd.push(c); waste.push(Math.min(Q, Math.max(0, ahead + Q - c))); tAll.push(draw(ahead + Q, lam)); }
    }
    out.t0 = [ndsQ(t0, 0.1), ndsQ(t0, 0.5), ndsQ(t0, 0.9)]; out.t1 = [ndsQ(t1, 0.1), ndsQ(t1, 0.5), ndsQ(t1, 0.9)];
    if (D !== null) {
        out.D = D;
        if (D > 0 && Q > 0) {
            out.pWaste = waste.filter(x => x > 0).length / N; out.meanWaste = waste.reduce((a, x) => a + x, 0) / N; out.qSafe = Math.max(0, Math.floor(ndsQ(nd, 0.1) - ahead)); out.sell = [ndsQ(tAll, 0.1), ndsQ(tAll, 0.5), ndsQ(tAll, 0.9)];
            out.verdict = out.pWaste <= 0.1 ? 'ok' : out.pWaste <= 0.3 ? 'warn' : 'bad';
        }
    }
    return out;
}
let ndwOf = [{ s: '', q: '', b: '', c: '', e: '', cr: '' }], ndwOfRef = '', ndwOfPid = null, ndwOfTm = null;
function ndwDay(d) { return d >= 3650 ? 'أكثر من 10 سنوات' : fmtDateDMY(sdAdd(todayLocalISO(), Math.round(d))); }
function ndwCapPct() { try { const v = parseFloat(localStorage.getItem('diwanCapPct')); return v >= 0 && v <= 20 ? v : 2; } catch (e) { return 2; } }
function ndwOfRefPrice(r) { const m = parseFloat(ndwOfRef); if (m > 0) return m; const best = (r.sups || []).filter(x => x.cost > 0).sort((a, b) => a.cost - b.cost)[0]; return best ? best.cost : (parseFloat(r.p.costPrice) || 0); }
// تقييم عرض: صافي الربح = الوفر على المباع − خسارة التلف − كلفة تجميد المبلغ، ويُقارَن الكامل بالكمية الآمنة ونصف الكمية
function ndwOfEval(r, o) {
    const Q0 = Math.max(0, parseFloat(o.q) || 0); if (!(Q0 > 0)) return null;
    const b = Math.max(0, parseFloat(o.b) || 0), Q = Math.max(1, Math.round(Q0 * (1 + b / 100))), c = parseFloat(o.c) || 0, ceff = c > 0 ? c * Q0 / Q : 0, cr = Math.max(0, parseInt(o.cr) || 0), c0 = ndwOfRefPrice(r), cap = ndwCapPct(), hasD = !!o.e, ok = ceff > 0 && c0 > 0;
    const one = Qc => {
        const p = ndsPlan(r, Qc, o.e || ''), dead = hasD && p.D !== undefined && p.D !== null && p.D <= 0, waste = dead ? Qc : (hasD && p.D > 0 ? (p.meanWaste || 0) : 0), sold = Math.max(0, Qc - waste), rd = p.mo.mean, avg = rd > 0 ? Math.min(3650, (p.S0 + sold / 2) / rd) : 3650, u = ceff > 0 ? ceff : c0;
        const saving = ok ? sold * (c0 - ceff) : 0, loss = waste * u, hold = u * sold * cap / 100 / 30 * Math.max(0, avg - cr);
        return { Qc, p, dead, waste, sold, saving, loss, hold, net: saving - loss - hold, paid: Math.max(1, Math.round(Qc / (1 + b / 100))) };
    };
    const full = one(Q), cands = [full];
    if (hasD && full.p.qSafe > 0 && full.p.qSafe < Q) cands.push(one(full.p.qSafe));
    if (Q >= 4) cands.push(one(Math.round(Q / 2)));
    const best = cands.reduce((a, x) => x.net > a.net ? x : a, cands[0]);
    const verdict = !ok ? null : best.net <= 0 ? 'reject' : (best.Qc === Q || full.net >= best.net * 0.95) ? 'take' : 'less';
    return { Q0, b, Q, c, ceff, c0, cap, cr, full, best, verdict, ok, hasD };
}
function ndwOfOne(r, i) {
    if (r.method === 'none' || r.status === 'low') return '<div class="of-v mid"><b>يلزم تقدير الاستهلاك أولاً</b><small>أدخل الرصيد الحالي ليتوفر وارد مسجل منذ 14 يوماً فأكثر.</small></div>';
    const o = ndwOf[i], ev = ndwOfEval(r, o), f = v => fmtNum(Math.round(v * 10) / 10), iqd = v => fmtNum(Math.round(v)) + ' د.ع', dr = (t, v, st) => `<div class="fu-dr"><span>${t}</span><b${st ? ' style="' + st + '"' : ''}>${v}</b></div>`;
    if (!ev) return '<div class="of-v mid"><b>أدخل كمية العرض</b><small>ثم السعر والبونص لتظهر النتيجة.</small></div>';
    const fl = ev.full, p = fl.p;
    let top;
    if (!ev.ok) top = '<div class="of-v mid"><b>أدخل سعر العلبة</b><small>لحساب الربح وتقييم العرض.</small></div>';
    else if (ev.verdict === 'take') top = `<div class="of-v ok"><b>اطلبها: العرض مربح</b><small>تُباع كلها قبل النفاذ بصافي ربح ${iqd(ev.best.net)}</small></div>`;
    else if (ev.verdict === 'less') top = `<div class="of-v mid"><b>اطلب ${fmtNum(ev.best.paid)} علبة فقط${ev.b > 0 ? ' والبونص يتبعها' : ''}</b><small>الكمية الأكبر قد يتلف جزء منها. صافي الربح ${iqd(ev.best.net)}</small></div>`;
    else top = `<div class="of-v bad"><b>لا تطلبها</b><small>${fl.dead ? 'تاريخ النفاذ المُدخل منتهٍ.' : 'لا تحقق ربحاً بعد التلف وتجميد المبلغ.'}</small></div>`;
    let tiles = '';
    if (ev.ok) {
        const d = Math.round((1 - ev.ceff / ev.c0) * 100), good = v => v >= 0 ? 'g' : 'r';
        tiles = `<div class="of-k"><div><span>سعر العلبة الفعلي</span><b>${fmtNum(Math.round(ev.ceff))}</b></div><div class="${d >= 0 ? 'g' : 'r'}"><span>مقارنة بالمعتاد</span><b>${Math.abs(d)}% ${d >= 0 ? 'أرخص' : 'أغلى'}</b></div><div class="${good(fl.net)}"><span>صافي الربح</span><b>${fmtNum(Math.round(fl.net))}</b></div>
            <div><span>تنفد بعد</span><b>${p.t1[1] >= 3650 ? '10 سنوات+' : fmtNum(Math.round(p.t1[1])) + ' يوماً'}</b></div><div class="${ev.hasD ? (fl.waste > 0.5 ? 'r' : 'g') : ''}"><span>التلف المتوقع</span><b>${ev.hasD ? f(fl.waste) + ' علبة' : '—'}</b></div><div class="${ev.hasD ? 'g' : ''}"><span>أكبر كمية آمنة</span><b>${ev.hasD ? fmtNum(p.qSafe) + ' علبة' : '—'}</b></div></div>`;
    }
    let h = '';
    if (ev.b > 0) h += dr('إجمالي الدفعة مع البونص', fmtNum(ev.Q) + ' علبة');
    if (ev.ceff > 0 && ev.c0 <= 0) h += '<small>أدخل «السعر المعتاد للعلبة» لحساب الوفر وصافي الربح.</small>';
    h += dr('ينفد بعد التوريد', ndwDay(p.t1[1])) + `<div class="fu-dr ndw-sub"><span>المدى المتوقع</span><b>${ndwDay(p.t1[0])} – ${ndwDay(p.t1[2])}</b></div>`;
    if (ev.hasD && !fl.dead) h += dr('احتمال بقاء كمية بلا بيع', fmtNum(Math.round(p.pWaste * 100)) + '%');
    if (!ev.hasD) h += '<small>أدخل تاريخ النفاذ ليُحسب التلف المتوقع.</small>';
    if (ev.ok) h += dr('الوفر على المباع', iqd(fl.saving)) + dr('خسارة التلف المتوقع', iqd(-fl.loss)) + dr('كلفة تجميد المبلغ', iqd(-fl.hold)) + dr('صافي الربح', iqd(fl.net));
    return top + tiles + `<details class="of-det"><summary>تفاصيل الحساب</summary>${h}</details>`;
}
function ndwOfHtml(r) {
    const e = escapeHtml, names = [...new Set([...(r.sups || []).map(x => x.name), ...ndwTopSups(3)])], ref = ndwOfRefPrice(r);
    const fld = (t, id, o) => `<label class="of-f"><span>${t}</span>${o}</label>`;
    const card = (o, i) => `<div class="of-card"><div class="of-h"><b>العرض ${i + 1}</b><select id="ndwOS${i}" onchange="ndwOfRunSoon()" aria-label="المذخر أو الشركة"><option value="">المذخر (اختياري)</option>${names.map(n => `<option ${o.s === n ? 'selected' : ''}>${e(n)}</option>`).join('')}</select></div>
        <div class="of-grid">${fld('الكمية (علب)', '', `<input id="ndwOQ${i}" type="number" inputmode="decimal" min="0" value="${e(String(o.q))}" oninput="ndwOfRunSoon()">`)}${fld('سعر العلبة', '', `<input id="ndwOC${i}" type="number" inputmode="decimal" min="0" value="${e(String(o.c))}" oninput="ndwOfRunSoon()">`)}${fld('البونص (%)', '', `<input id="ndwOB${i}" type="number" inputmode="decimal" min="0" value="${e(String(o.b))}" oninput="ndwOfRunSoon()">`)}${fld('تاريخ النفاذ', '', `<input id="ndwOE${i}" type="month" value="${e(String(o.e))}" onchange="ndwOfRunSoon()">`)}${fld('أيام الآجل', '', `<input id="ndwOR${i}" type="number" inputmode="numeric" min="0" value="${e(String(o.cr))}" oninput="ndwOfRunSoon()">`)}</div>
        <div id="ndwOfOut${i}" class="of-out">${ndwOfOne(r, i)}</div></div>`;
    return `<div class="of-intro">يجيبك المندوب بعرض؟ أدخل الكمية والسعر والبونص وتاريخ النفاذ، والنتيجة تخبرك: اطلب أو لا تطلب.</div>
        ${ndwOf.map(card).join('')}
        ${ndwOf.length < 3 ? '<button type="button" class="ln-btn" style="width:100%;height:42px" onclick="ndwOfAdd()">إضافة عرض آخر للمقارنة</button>' : ''}<div id="ndwOfBest">${ndwOfBestHtml(r)}</div>
        <details class="of-det of-set"><summary>إعدادات الحساب</summary><div class="of-grid">${fld('السعر المعتاد للعلبة', '', `<input id="ndwOfRef" type="number" inputmode="decimal" min="0" value="${e(String(ndwOfRef))}" placeholder="${ref > 0 ? fmtNum(ref) : 'غير متوفر'}" oninput="ndwOfRunSoon()">`)}${fld('تكلفة المال شهرياً (%)', '', `<input id="ndwOfCap" type="number" inputmode="decimal" min="0" max="20" step="any" value="${ndwCapPct()}" oninput="ndwOfRunSoon()">`)}</div><small>السعر المعتاد هو أرخص آخر سعر شراء مسجل ما لم تدخل غيره.</small></details>`;
}
function ndwOfBestHtml(r) {
    if (ndwOf.length < 2 || r.method === 'none') return '';
    const evs = ndwOf.map((o, i) => [i, ndwOfEval(r, o)]).filter(x => x[1] && x[1].ok); if (evs.length < 2) return '<small>أدخل السعر والكمية لعرضين أو أكثر لتظهر المقارنة.</small>';
    evs.sort((a, b) => b[1].best.net - a[1].best.net); const [i, ev] = evs[0], nm = ndwOf[i].s ? ' (' + escapeHtml(ndwOf[i].s) + ')' : '';
    return ev.best.net > 0 ? `<div style="margin-top:8px;padding:10px;border-radius:10px;background:#ecfdf5;color:#0f766e;font-weight:800;text-align:center;line-height:1.7">الأفضل: العرض ${i + 1}${nm}<br>بصافي ${fmtNum(Math.round(ev.best.net))} د.ع</div>` : '<div style="margin-top:8px;padding:10px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-weight:800;text-align:center">لا يحقق أي من العروض ربحاً صافياً.</div>';
}
function ndwOfAdd() { ndwOfRead(); if (ndwOf.length < 3) ndwOf.push({ s: '', q: '', b: '', c: '', e: '', cr: '' }); ndwDetRefresh(); }
function ndwOfRead() {
    const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    ndwOf = ndwOf.map((o, i) => ({ s: g('ndwOS' + i), q: g('ndwOQ' + i), b: g('ndwOB' + i), c: g('ndwOC' + i), e: g('ndwOE' + i), cr: g('ndwOR' + i) }));
    const rf = document.getElementById('ndwOfRef'); if (rf) ndwOfRef = rf.value;
    const cp = document.getElementById('ndwOfCap'); if (cp) { try { localStorage.setItem('diwanCapPct', String(Math.max(0, Math.min(20, parseFloat(cp.value) || 0)))); } catch (e) { /* تجاهل */ } }
}
function ndwOfRunSoon() { clearTimeout(ndwOfTm); ndwOfTm = setTimeout(ndwOfRun, 250); }
function ndwOfRun() {
    ndwOfRead(); const r = ndwFind(ndwCur); if (!r) return;
    ndwOf.forEach((o, i) => { const el = document.getElementById('ndwOfOut' + i); if (el) el.innerHTML = ndwOfOne(r, i); });
    const bs = document.getElementById('ndwOfBest'); if (bs) bs.innerHTML = ndwOfBestHtml(r);
}
function ndwStatHtml(r) {
    if (r.method === 'none') return '<small>لا تتوفر بيانات كافية للإحصاء.</small>';
    const m = ndsModel(r), f = v => fmtNum(Math.round(v * 100) / 100), dr = (t, v) => `<div class="fu-dr"><span>${t}</span><b>${v}</b></div>`;
    return dr('معدل السحب اليومي (تقدير)', f(m.mean)) + dr('مجال الثقة 95% (شهرياً)', f(m.lo * 30) + ' – ' + f(m.hi * 30)) + dr('الشهري المتوقع', f(m.mean * 30))
        + dr('الأساس', fmtNum(Math.round(m.C * 10) / 10) + ' وحدة خلال ' + fmtNum(m.T) + ' يوماً') + dr('معامل التشتت', f(m.phi) + (m.K >= 3 ? ' (من ' + fmtNum(m.K) + ' فترات)' : ' (افتراضي)')) + dr('موثوقية التقدير', m.rely)
        + dr('اتجاه الاستهلاك', m.trend ? (m.trend.sig ? (m.trend.tau > 0 ? 'يميل للارتفاع' : 'يميل للانخفاض') : 'لا اتجاه واضح') : 'غير كافٍ (يلزم 5 فترات)')
        + dr('الموسمية', m.T >= 365 ? 'ممكن رصدها' : 'غير ممكنة (أقل من سنة)')
        + (r.nsE > 0 ? dr('منتهي/تالف مستبعد', fmtNum(Math.round(r.nsE * 10) / 10)) : '') + (r.nsO > 0 ? dr('مناقلة خارجة مستبعدة', fmtNum(Math.round(r.nsO * 10) / 10)) : '')
        + `<small style="display:block;margin-top:6px">المعالجات المطبّقة:<br>${r.src === 's' ? '• الأساس مبيعات فعلية، فلا يتأثر بالشراء الكبير لأجل البونص أو الخصم.<br>• أيام نفاد المادة لا تُحتسب ضمن الطلب.<br>' : '• المردود يُخصم من الوارد.<br>• الشراء الكبير (بونص أو خصم) لا يؤثر لأن الأساس مجموع الوارد − الرصيد.<br>'}• البيانات القليلة تعطي مدى أوسع (نموذج بايزي) بدل رقم مضلِّل.<br>• تذبذب السحب يوسّع المدى (معامل التشتت).<br>تبقى حدود لا تعالجها البيانات: نفاد المادة يخفّض التقدير، والطلب غير الملبّى غير مسجل.</small>`;
}
function ndwDetail(i) { const r = ndwRows[i]; if (r) ndwOpen(r.p.id); }
function ndwOpen(pid) {
    ndwSrc = 'i'; ndwCur = pid; const r = ndwRows.find(x => x.p.id === pid); if (!r) return;
    if (ndwOffer) { ndwOffer = false; ndwOpenSec = { plan: true }; }
    Swal.fire({ title: 'تقدير الاحتياج من الوارد', showConfirmButton: false, showCloseButton: true, width: 'min(94vw, 520px)', html: `<div id="ndwDet" class="fu-det" dir="rtl" style="text-align:right">${ndwDetBody(r)}</div>` });
}
function ndwDetRefresh() {
    if (ndwSrc === 's') { ndmRows = ndmCalc().rows; ndmRowsRedraw(); } else if (ndwSrc !== 'y') { ndwRows = ndwCalc().rows; ndwRowsRedraw(); }
    const r = ndwFind(ndwCur), el = document.getElementById('ndwDet'); if (r && el) el.innerHTML = ndwDetBody(r);
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
        + (c.buy === null ? '<small>الرصيد غير معتمد: أدخل العدد الحالي لحساب المطلوب شراؤه.</small>' : row('المطلوب شراؤه لتغطية المدة', fmtNum(c.buy) + ' علبة', 'color:#0f766e;font-size:1.1em'));
}
function ndwPerSet() {
    const n = Math.max(1, parseInt(document.getElementById('ndwPn').value) || 1), u = parseInt(document.getElementById('ndwPu').value) || 30, ss = !!document.getElementById('ndwSs').checked;
    ndwPer = { n, u, ss }; try { localStorage.setItem('diwanNdwPer', JSON.stringify(ndwPer)); } catch (e) { /* تجاهل */ }
    const r = ndwFind(ndwCur), o = document.getElementById('ndwNeedOut'), so = document.getElementById('ndwSumOut'); if (r && o) o.innerHTML = ndwNeedHtml(r); if (r && so) so.innerHTML = ndwSumHtml(r);
}
function ndwAddOne() {
    const r = ndwFind(ndwCur); if (!r) return; const c = ndwNeedCalc(r); if (!(c.buy > 0)) return;
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
// رسم سحب المادة: أعمدة الوارد + خط الرصيد التقديري + نقطة الرصيد الحالي + إسقاط حتى النفاد، مع محور تواريخ وشبكة
function ndwChartSvg(r) {
    const today = todayLocalISO(), T = Math.max(1, ndmDays(r.first, today)), rate = r.rate, Hz = rate > 0 ? Math.min(120, Math.max(0, r.stock / rate)) : 0, X = T + Hz;
    let s = 0, tp = 0; const pts = [[0, 0]], bars = [];
    r.ev.forEach(e => { const t = ndmDays(r.first, e.d); s = Math.max(0, s - rate * (t - tp)); pts.push([t, s]); s += e.u; pts.push([t, s]); tp = t; bars.push([t, e.u]); });
    s = Math.max(0, s - rate * (T - tp)); pts.push([T, s]);
    const raw = Math.max(1, ...pts.map(p => p[1]), r.stock), mag = Math.pow(10, Math.floor(Math.log10(raw))), nice = [1, 2, 2.5, 5, 10].map(k => k * mag).find(v => v >= raw * 1.05) || raw * 1.1, ym = nice;
    const W = 360, H = 232, L = 36, R = 14, Tp = 26, B = 52, x = t => L + t / X * (W - L - R), y = v => Tp + (1 - v / ym) * (H - Tp - B), base = y(0), f1 = v => fmtNum(Math.round(v * 10) / 10);
    const line = pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ');
    // محور التواريخ: بداية الأشهر (أو الأسابيع للمدى القصير) بعدد لا يتجاوز 6
    const ticks = [], d0 = new Date(r.first + 'T12:00:00'), end = sdAdd(r.first, Math.ceil(X));
    const stepM = [1, 2, 3, 6, 12].find(k => X / (30 * k) <= 5) || 12;
    if (X < 60) { const stepD = X <= 28 ? 7 : 14; for (let t = 0; t <= X; t += stepD) { const d = sdAdd(r.first, t); ticks.push([t, d.slice(8, 10) + '/' + d.slice(5, 7)]); } }
    else { let yy = d0.getFullYear(), mm = d0.getMonth() + 1; for (let i = 0; i < 80; i++) { const iso = yy + '-' + String(mm).padStart(2, '0') + '-01', t = ndmDays(r.first, iso); if (iso > end) break; if (t >= 0) ticks.push([t, String(mm).padStart(2, '0') + '/' + String(yy).slice(2)]); mm += stepM; while (mm > 12) { mm -= 12; yy++; } } }
    const yt = [0, ym / 4, ym / 2, ym * 3 / 4, ym], dm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:100%;direction:ltr" role="img" aria-label="رسم سحب المادة" font-family="inherit">
        ${yt.map(v => `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}" stroke="${v === 0 ? '#94a3b8' : '#e2e8f0'}" ${v === 0 ? '' : 'stroke-dasharray="3 3"'}/><text x="${L - 5}" y="${(y(v) + 3).toFixed(1)}" font-size="9" fill="#64748b" text-anchor="end">${fmtNum(Math.round(v * 10) / 10)}</text>`).join('')}
        ${ticks.map(k => `<line x1="${x(k[0]).toFixed(1)}" y1="${base}" x2="${x(k[0]).toFixed(1)}" y2="${base + 4}" stroke="#94a3b8"/><text x="${x(k[0]).toFixed(1)}" y="${base + 16}" font-size="9" fill="#64748b" text-anchor="middle">${k[1]}</text>`).join('')}
        <text x="${L}" y="${Tp - 12}" font-size="9" fill="#64748b" text-anchor="start">علبة</text>
        ${bars.map(b => `<rect x="${(x(b[0]) - 3.5).toFixed(1)}" y="${y(b[1]).toFixed(1)}" width="7" height="${(base - y(b[1])).toFixed(1)}" rx="1.5" fill="#cbd5e1"/><text x="${x(b[0]).toFixed(1)}" y="${(y(b[1]) - 4).toFixed(1)}" font-size="9" fill="#475569" text-anchor="middle">${f1(b[1])}</text>`).join('')}
        <path d="${line}" fill="none" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/>
        ${Hz > 0 ? `<line x1="${x(T).toFixed(1)}" y1="${y(r.stock).toFixed(1)}" x2="${x(T + Hz).toFixed(1)}" y2="${base}" stroke="#b45309" stroke-width="1.6" stroke-dasharray="4 3"/>` : ''}
        <line x1="${x(T).toFixed(1)}" y1="${Tp - 4}" x2="${x(T).toFixed(1)}" y2="${base}" stroke="#b91c1c" stroke-width="1" stroke-dasharray="2 3"/>
        <circle cx="${x(T).toFixed(1)}" cy="${y(r.stock).toFixed(1)}" r="4.5" fill="#b91c1c" stroke="#fff" stroke-width="1.5"/>
        <text x="${x(T).toFixed(1)}" y="${Tp - 8}" font-size="9.5" font-weight="700" fill="#b91c1c" text-anchor="${x(T) > W - 60 ? 'end' : 'middle'}">اليوم ${dm(today)}</text>
        ${Hz > 0 ? `<text x="${Math.min(W - R, x(T + Hz)).toFixed(1)}" y="${base + 32}" font-size="9.5" font-weight="700" fill="#b45309" text-anchor="end">ينفد ${dm(sdAdd(today, Math.floor(Hz)))}/${String(sdAdd(today, Math.floor(Hz))).slice(2, 4)}</text>` : ''}</svg>
        <div class="ndw-lg"><span><i style="background:#cbd5e1"></i>الوارد</span><span><i style="background:#0f766e"></i>الرصيد التقديري</span><span><i style="background:#b91c1c;border-radius:50%"></i>الرصيد الحالي ${f1(r.stock)}</span><span><i style="background:#b45309"></i>النفاد المتوقع</span></div>`;
}
function ndwSumHtml(r) {
    const f = v => fmtNum(v >= 10 ? Math.round(v) : Math.round(v * 10) / 10), tile = (t, v, sub, cls) => `<div class="ndw-kt${cls ? ' ' + cls : ''}"><span>${t}</span><b>${v}</b>${sub ? '<small>' + sub + '</small>' : ''}</div>`;
    if (r.method === 'none') return '<div class="ndw-nt">لا يتوفر تقدير لهذه المادة بعد.<br>أدخل الرصيد الحالي في قسم «الرصيد الحالي» (يلزم وارد مسجل منذ 14 يوماً فأكثر).</div>';
    const c = ndwNeedCalc(r), known = r.counted || r.manual, cur = Math.max(0, r.stock - (r.ex ? r.ex.expired : 0)), days = r.rate > 0 ? cur / r.rate : null;
    let run = '—', cov = '—', covSub = '', runSub = '';
    if (!known) { runSub = 'أدخل الرصيد في القسم أدناه'; covSub = 'أدخل الرصيد في القسم أدناه'; }
    else if (days === null) { run = 'بلا استهلاك'; cov = 'بلا استهلاك'; runSub = covSub = cur > 0 ? 'لم يُستهلك شيء منذ أول وارد' : ''; }
    else {
        run = cur <= 0 ? 'نفدت' : days >= 3650 ? 'بعد أكثر من 10 سنوات' : fmtDateDMY(sdAdd(todayLocalISO(), Math.floor(days)));
        cov = cur <= 0 ? 'لا تكفي ليوم' : days >= 3650 ? 'أكثر من 10 سنوات' : days < 1 ? 'أقل من يوم' : days < 30 ? fmtNum(Math.floor(days)) + ' يوماً' : fmtNum(Math.round(days / 30 * 10) / 10) + ' شهر <em>(' + fmtNum(Math.floor(days)) + ' يوماً)</em>';
    }
    const per = ndwPer.n + ' ' + (ndwPer.u === 1 ? 'يوم' : ndwPer.u === 7 ? 'أسبوع' : 'شهر');
    const ord = c.buy === null ? tile('اطلب هذا العدد', '—', 'أدخل الرصيد الحالي في القسم أدناه', 'wide') : tile('اطلب هذا العدد', fmtNum(c.buy) + ' علبة', 'لتغطية ' + per + (ndwPer.ss ? ' مع مخزون أمان' : ''), 'wide ok');
    const rk = r.ex && r.ex.riskY > 0.5 ? tile('قد يتلف قبل بيعه', f(r.ex.riskY) + ' علبة', (r.ex.riskDays ? 'أقرب نفاذ بعد ' + fmtNum(r.ex.riskDays) + ' يوماً • ' : '') + 'يُنصح بمناقلتها', 'wide bad') : '';
    return `<div class="ndw-k">${rk}${tile('الاحتياج الشهري', f(r.rate * 30) + ' علبة')}${tile('الاحتياج السنوي', f(r.rate * 365) + ' علبة')}${ord}${tile('تنفد الكمية الحالية بتاريخ', run, runSub)}${tile('تغطي الكمية الحالية', cov, covSub)}</div>`
        + (c.buy > 0 ? '<button type="button" class="cn-new" style="margin-top:10px" onclick="ndwAddOne()">إضافة ' + fmtNum(c.buy) + ' إلى قائمة النواقص</button>' : '');
}
function ndwDetBody(r) {
    const S = r.src === 's', offerTab = ndcMode && ndcTab === 'offer';
    if (offerTab) ndwOpenSec.plan = true;
    const f = v => fmtNum(Math.round(v * 10) / 10), dr = (t, v) => `<div class="fu-dr"><span>${t}</span><b>${v}</b></div>`;
    const sec = (k, t, body) => `<details class="nd-set" ${(ndwOpenSec[k] !== undefined ? ndwOpenSec[k] : (k === 'bal' && r.p.counted !== true && !r.manual)) ? 'open' : ''} ontoggle="ndwOpenSec['${k}']=this.open"><summary>${t}</summary><div class="nd-set-b">${body}</div></details>`;
    const manV = ndwManualMap()[r.p.id], inp = 'height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;text-align:center;box-sizing:border-box';
    const bal = r.p.counted === true ? dr('الرصيد المعتمد (جرد)', f(r.stock)) + '<small>المادة مجرودة، فيُعتمد رصيد الجرد.</small>'
        : dr('الرصيد المعتمد في الحساب', r.manual ? f(r.stock) + ' (يدوي)' : 'غير مجرودة') + `<div style="display:flex;gap:6px;margin-top:6px"><input id="ndwMan" type="number" inputmode="decimal" min="0" value="${manV !== undefined ? escapeHtml(String(manV)) : ''}" placeholder="العدد الحالي بالعلب" style="flex:1;${inp}"><button type="button" class="ln-btn" style="height:38px" onclick="ndwManSet()">اعتماد للحساب</button>${r.manual ? '<button type="button" class="ln-btn" style="height:38px" onclick="ndwManClear()">حذف</button>' : ''}</div><small id="ndwManErr" style="color:#b91c1c;display:block"></small><small style="display:block">للحساب فقط.<br>لا يُسجَّل في الجرد ولا يغيّر رصيد المادة.</small>`;
    const unitOpt = [[1, 'يوم'], [7, 'أسبوع'], [30, 'شهر']].map(([v, l]) => `<option value="${v}" ${ndwPer.u === v ? 'selected' : ''}>${l}</option>`).join('');
    const need = `<div class="fu-dr"><span>المدة المراد توفيرها</span><span style="display:flex;gap:6px"><input id="ndwPn" type="number" inputmode="numeric" min="1" value="${ndwPer.n}" oninput="ndwPerSet()" style="width:70px;${inp}"><select id="ndwPu" onchange="ndwPerSet()" style="${inp};background:#fff">${unitOpt}</select></span></div>
        <div class="qk-row"><div><b>إضافة مخزون أمان</b><small>احتياط فوق الاستهلاك المتوقع.</small></div><label class="setup-sw"><input type="checkbox" id="ndwSs" ${ndwPer.ss ? 'checked' : ''} onchange="ndwPerSet()" aria-label="مخزون الأمان"><i></i></label></div><div id="ndwNeedOut">${ndwNeedHtml(r)}</div>`;
    if (ndwOfPid !== r.p.id) { ndwOfPid = r.p.id; ndwOf = [{ s: '', q: '', b: '', c: '', e: '', cr: '' }]; ndwOfRef = ''; }
    const plan = ndwOfHtml(r);
    const ivRows = r.ev.map((e, k) => { const nx = r.ev[k + 1], g = ndmDays(e.d, nx ? nx.d : todayLocalISO()); return `<tr><td>${fmtDateDMY(e.d)}${nx ? '' : ' <em>(جارية)</em>'}</td><td>${fmtNum(g)} يوماً</td><td>${f(e.u)}</td><td>${nx ? f(g > 0 ? e.u / g * 7 : 0) : '—'}</td></tr>`; }).join('');
    const ivs = `<table class="ndw-t"><thead><tr><th>بداية الفترة</th><th>المدة</th><th>الوارد</th><th>السحب أسبوعياً</th></tr></thead><tbody>${ivRows}</tbody></table>` + dr('الرصيد الآن', f(r.stock));
    const supB = (r.sups && r.sups.length) ? `<table class="ndw-t"><thead><tr><th>المذخر</th><th>آخر سعر</th><th>آخر شراء</th><th>المرات</th></tr></thead><tbody>${r.sups.map(x => `<tr><td>${escapeHtml(x.name)}${x.name === r.sup ? ' <em>(المقترح)</em>' : ''}</td><td>${x.cost > 0 ? fmtNum(x.cost) : '—'}</td><td>${fmtDateDMY(x.last)}</td><td>${fmtNum(x.n)}</td></tr>`).join('')}</tbody></table><div class="cn-chips fu-chips" style="padding:8px 0 0;flex-wrap:wrap">${r.sups.map(x => `<button type="button" class="cn-chip ${x.name === r.sup ? 'on' : ''}" data-s="${escapeHtml(x.name)}" onclick="ndwSupChoose(${r.p.id},this.dataset.s)">اطلب من ${escapeHtml(x.name)}</button>`).join('')}</div><small>المقترح هو الأرخص بآخر سعر، وإلا الأكثر شراءً منه.</small>` : '<small>لا يوجد مذخر مسجل في وارد هذه المادة.</small>';
    const bt = r.ex && r.ex.batches ? r.ex.batches : [], expB = bt.length ? `<table class="ndw-t"><thead><tr><th>تاريخ النفاذ</th><th>الكمية</th><th>يُباع قبله</th><th>يتلف</th></tr></thead><tbody>${bt.map(x => `<tr><td>${x.e.slice(5, 7)}/${x.e.slice(0, 4)}</td><td>${f(x.boxes)}</td><td>${f(x.sold)}</td><td style="${x.waste > 0.5 ? 'color:#b91c1c;font-weight:700' : ''}">${f(x.waste)}</td></tr>`).join('')}</tbody></table><small>تُباع الدفعة الأقدم نفاذاً أولاً بمعدل الاستهلاك المقدّر، وهو تقدير تقريبي كلما بعد تاريخ النفاذ.</small>` : '<small>لا توجد دفعات بتواريخ نفاذ مسجلة لهذه المادة.</small>';
    const calcIn = dr('الطريقة', r.fromS ? 'المبيعات الفعلية (متوفرة وكافية)' : r.method === 'bal' ? 'رصيد الجرد (أثر رجعي)' : r.method === 'int' ? 'فترات الشراء' : 'غير كافية') + (r.method === 'none' ? '' : dr(r.method === 'bal' ? 'المستهلك (الوارد − الرصيد)' : 'المستهلك قبل آخر شراء', f(r.consumed) + ' خلال ' + fmtNum(r.span) + ' يوماً') + dr('الاستهلاك اليومي المقدّر', fmtNum(Math.round(r.rate * 100) / 100)) + dr('الشهري المتوقع', f(r.rate * 30)) + dr('المدى الأسبوعي (ثقة 80%)', f(r.w80[0]) + ' – ' + f(r.w80[1])))
        + dr('مرات الشراء', fmtNum(r.nEv) + ' • أولها ' + fmtDateDMY(r.first)) + dr('مجموع الوارد', f(r.units)) + dr('آخر شراء', 'قبل ' + fmtNum(r.since) + ' يوماً') + dr('المتوفر', f(r.stock)) + (r.ord ? dr('قيد الطلب', f(r.ord)) : '') + ndxDetailRows(r.ex)
        + (r.method === 'none' ? '' : dr('مخزون الأمان', f(r.ss)) + dr('نقطة إعادة الطلب', f(r.rop)) + dr('المستوى المستهدف', f(r.tgt)) + dr('الكمية المقترحة', r.counted ? fmtNum(r.sug) : '—')) + (r.minQ ? dr('الحد الأدنى (من بطاقة المادة)', fmtNum(r.minQ)) : '') + dr('درجة الثقة', r.conf);
    const calcS = !S || r.synth ? '' : dr('الطريقة', 'المبيعات الفعلية') + dr('فئة الإيراد', r.cls) + dr('نمط الطلب', r.pat[0]) + dr('مدة التحليل', fmtNum(r.n) + ' يوماً') + dr('أيام فيها بيع', fmtNum(r.nz) + ' من ' + fmtNum(r.n)) + (r.miss ? dr('طلبات غير ملبّاة', fmtNum(r.miss)) : '') + (r.zdays ? dr('أيام نفاد مستبعدة', fmtNum(r.zdays)) : '')
        + dr('الطلب اليومي المقدّر', fmtNum(Math.round(r.rate * 100) / 100)) + dr('الطلب الشهري المتوقع', f(r.rate * 30)) + dr('المدى الأسبوعي (ثقة 80%)', f(r.ci.w80[0]) + ' – ' + f(r.ci.w80[1])) + dr('المتوفر', f(r.stock)) + (r.ord ? dr('قيد الطلب', f(r.ord)) : '') + ndxDetailRows(r.ex)
        + dr('مخزون الأمان', f(r.ss)) + dr('نقطة إعادة الطلب', f(r.rop)) + dr('المستوى المستهدف', f(r.tgt)) + dr('الكمية المقترحة', fmtNum(r.sug)) + (r.minQ ? dr('الحد الأدنى (من بطاقة المادة)', fmtNum(r.minQ)) : '') + dr('جودة البيانات', r.conf);
    const obRow = S || r.synth || r.method === 'none' || !r.counted ? '' : `<div class="fu-dr"><span>رصيد قبل أول وارد مسجل (علب)</span><input type="number" inputmode="decimal" min="0" value="${r.ob || ''}" placeholder="0" onchange="ndOpenSave(${r.p.id},this.value)" style="width:90px;height:38px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit;text-align:center;box-sizing:border-box"></div>` + (r.zc ? dr('أيام نفاد مستبعدة', fmtNum(r.zc)) : '');
    const calc = (S ? calcS : calcIn) + obRow;
    return `<div class="ndw-h" dir="ltr">${dispNameHtml(r.p)}</div>${ndxTag(r.ex)}${r.synth && r.note ? '<div class="nd-hint" style="margin:6px 0">' + escapeHtml(r.note) + '</div>' : ''}`
        + (offerTab ? plan : (sec('sum', 'الخلاصة', '<div id="ndwSumOut">' + ndwSumHtml(r) + '</div>') + ((S && r.p.counted === true) || r.synth ? '' : sec('bal', r.p.counted === true ? 'الرصيد الحالي' : 'الرصيد الحالي (إدخال للحساب)', bal)) + sec('need', 'الاحتياج لمدة محددة', need) + (r.synth ? '' : sec('chart', S ? 'رسم المبيعات' : 'رسم سحب المادة', S ? ndmChartSvg(r) : ndwChartSvg(r))) + sec('exp', 'الصلاحية والدفعات', expB) + sec('sup', 'المذخر والأسعار', supB) + (S ? '' : sec('iv', 'فترات السحب', ivs)) + (r.synth ? '' : sec('stat', 'الإحصاءات والجودة', ndwStatHtml(r)) + sec('calc', 'الحسابات الحالية', calc))));
}
// ---------- مناقلة مقترحة: المواد المتوقع تلف جزء منها قبل بيعه، مرتبة بالأقرب نفاذاً ----------
let xfF = 'all', xfRows = [];
function xfCalc() {
    const sm = ndmCalc().rows, im = ndwCalc().rows; ndmRows = sm; ndwRows = im;
    const rt = new Map(); im.forEach(r => { if (r.method !== 'none') rt.set(r.p.id, { rate: r.rate, conf: r.conf }); }); sm.forEach(r => rt.set(r.p.id, { rate: r.rate, conf: r.conf }));   // المبيعات أولى من الوارد
    const rows = [];
    (products || []).forEach(p => {
        if (!p || p.arch) return; const t = rt.get(p.id), ex = ndxExpiry(p, t ? t.rate : 0), waste = t ? ex.riskY : ex.nearBoxes;
        if (!(waste > 0.5)) return;
        const b = (ex.batches || []).find(x => x.waste > 0.5), d = t ? (ex.riskDays !== null ? ex.riskDays : ex.nearDays) : ex.nearDays;
        rows.push({ p, ex, waste, qty: Math.ceil(waste - 1e-9), d, e: b ? b.e : '', known: !!t, conf: t ? t.conf : '' });
    });
    return rows.sort((a, b) => (a.d === null ? 1e9 : a.d) - (b.d === null ? 1e9 : b.d));
}
function xfVisible() { const lim = xfF === 'all' ? 1e9 : parseInt(xfF); return xfRows.filter(r => r.d === null || r.d <= lim); }
function xfRow(r) {
    const f = v => fmtNum(Math.round(v * 10) / 10), dt = r.e ? r.e.slice(5, 7) + '/' + r.e.slice(0, 4) : '';
    const l2 = 'يتلف ' + f(r.waste) + ' علبة' + (r.d !== null ? ' • بعد ' + fmtNum(r.d) + ' يوماً' + (dt ? ' (' + dt + ')' : '') : '');
    const tg = !r.known ? '<small class="ndw-tg">بلا تقدير استهلاك: تُعرض القريبة النفاذ فقط</small>' : r.conf === 'منخفضة' ? '<small class="ndw-tg">تقدير أولي لقلة البيانات</small>' : '';
    return `<div class="cu-row fu-row ndw-rw" onclick="xfOpen(${r.p.id})"><div><b dir="ltr">${dispNameHtml(r.p)}</b><small class="ndw-l2">${l2}</small>${tg}</div><div class="fu-st bad">ناقل ${fmtNum(r.qty)}</div></div>`;
}
function xfHtml() {
    xfRows = xfCalc(); const v = xfVisible(), tot = v.reduce((a, r) => a + r.waste, 0), chips = [['all', 'الكل'], ['90', 'خلال 3 أشهر'], ['180', 'خلال 6 أشهر'], ['365', 'خلال سنة']];
    return `<div class="sd-cards sd-c3"><div><span>مواد معرضة</span><b>${fmtNum(v.length)}</b></div><div><span>علب متوقع تلفها</span><b>${fmtNum(Math.round(tot))}</b></div><div><span>أقرب نفاذ</span><b>${v.length && v[0].d !== null ? fmtNum(v[0].d) + ' يوماً' : '—'}</b></div></div>
        <details class="nd-set"><summary>طريقة الحساب</summary><div class="nd-set-b"><div class="nd-hint">• تُقارَن كل دفعة بتاريخ نفاذها مع ما يُتوقع بيعه منها حتى ذلك التاريخ.<br>• الدفعة الأقدم نفاذاً تُباع أولاً.<br>• الاستهلاك من المبيعات إن توفرت، وإلا من الوارد.<br>• الكمية المقترحة للمناقلة هي المتوقع تلفه مقرَّباً للأعلى.<br>• كلما بعد النفاذ قلّت دقة التقدير.</div></div></details>
        ${v.length ? `<button type="button" class="cn-new" onclick="xfGo()">فتح مناقلة بهذه المواد (${fmtNum(v.length)})</button>` : ''}
        <div class="cn-chips fu-chips">${chips.map(([k, l]) => `<button type="button" class="cn-chip ${xfF === k ? 'on' : ''}" onclick="xfF='${k}';exRender()">${l}</button>`).join('')}</div>
        <div id="xfList">${v.map(xfRow).join('') || '<div class="cu-none">لا توجد مواد متوقع تلفها ضمن هذا النطاق.</div>'}</div>`;
}
function xfOpen(pid) { const i = ndmRows.findIndex(x => x.p.id === pid); if (i >= 0) { ndmDetail(i); return; } if (ndwRows.some(x => x.p.id === pid)) ndwOpen(pid); }
function xfGo() {
    const v = xfVisible(); if (!v.length) return;
    try { exClose(); showView('purch'); puTab('xfer'); lgxOpen('xfer', { items: v.map(r => ({ pid: r.p.id, qty: r.qty })) }); } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر فتح شاشة المناقلة', confirmButtonText: 'حسناً' }); }
}
// ---------- حاسبة الاحتياج: اختيار مادة ثم حساب المطلوب وتقييم عرض المندوب ----------
async function ndcEnsure() {
    const h = Prog.start('تحميل البيانات', { text: 'سجل الوارد والفواتير...', indeterminate: false });
    try {
        if (typeof puLoad === 'function') { try { await puLoad(); } catch (e) { /* تجاهل */ } } h.set(40);
        if (typeof lgLoad === 'function') { try { await lgLoad(); } catch (e) { /* تجاهل */ } } h.set(70);
        const fr = ndmFrom(); if (!(window.__exInvFrom && window.__exInvFrom <= fr && Date.now() - (window.__exInvAt || 0) < 30 * 60000)) { await invEnsureSince(fr); window.__exInvFrom = fr; window.__exInvAt = Date.now(); }
        h.ok('تم التحميل');
    } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); }
}
function ndcEnsureDom() {
    if (document.getElementById('ndcOv')) return;
    const d = document.createElement('div'); d.id = 'ndcOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="ndcBox"><div class="cn-head"><b>' + pgIc('ndc') + 'حاسبة الاحتياج</b></div><div class="cn-body"><div id="ndcTabs"></div><div id="ndcMain"></div></div></div>'; document.body.appendChild(d);
}
function ndcClose() { const ov = document.getElementById('ndcOv'); if (ov) ov.style.display = 'none'; document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); ndcMode = false; ndwCur = null; }
function ndcSearchHtml() { return `<div class="fu-q"><input type="search" id="ndcQ" autocomplete="off" placeholder="ابحث عن المادة" oninput="ndcSearch(this.value)"></div><div id="ndcRes"></div><div class="nd-hint" style="margin-top:10px">اختر المادة ثم طريقة التقدير (حسب المبيعات أو حسب الوارد)، وبعدها تظهر الحاسبة وتقييم العروض.</div>`; }
function ndcShowSearch() { ndwCur = null; const m = document.getElementById('ndcMain'); if (m) m.innerHTML = ndcSearchHtml(); const el = document.getElementById('ndcQ'); if (el) el.focus(); }
async function ndcOpen() {
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'هذه الصفحة للمدير فقط.', confirmButtonColor: '#0f1c38' }); return; }
    ndcEnsureDom(); ndZeroSnap(); ndcTab = 'calc'; ndcMode = true; ndcAlt = null;
    document.getElementById('ndcTabs').innerHTML = ndcTabsHtml(); ndcShowSearch();
    document.getElementById('ndcOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open');
    await ndcEnsure();
}
function ndcSearch(v) {
    const q = normSearch(v || ''), toks = q ? q.split(' ') : [], box = document.getElementById('ndcRes'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    const list = (products || []).filter(p => p && !p.arch && searchScore(p, q, toks) > 0).slice(0, 8);
    box.innerHTML = list.map(p => `<div class="cu-row fu-row ndw-rw" onclick="ndcPick(${p.id})"><div><b dir="ltr">${dispNameHtml(p)}</b></div></div>`).join('') || '<div class="cu-none">لا توجد نتائج.</div>';
}
async function ndcPick(pid) {
    const p = (products || []).find(x => x.id === pid); if (!p) return;
    ndmRows = ndmCalc().rows; ndwRows = ndwCalc().rows;
    const rS = ndmRows.find(x => x.p.id === pid), rI = ndwRows.find(x => x.p.id === pid && x.method !== 'none');
    let r = rS || rI, src = rS ? 's' : 'i'; ndcAlt = null;
    if (rS && rI) { src = 's'; r = rS; ndcAlt = { s: rS, i: rI }; }   // المبيعات الفعلية أدق، وللتبديل شريط في الصفحة
    if (!r) {
        const cur = (parseInt(p.qty) || 0) + (hasRetail(p) ? (parseInt(p.loose) || 0) / subCountOf(p) : 0);
        const ch = await Swal.fire({ title: 'لا يتوفر تقدير لهذه المادة', html: '<div dir="rtl" style="text-align:right" class="nd-hint">اختر طريقة تقدير الاستهلاك:<br>• مادة مشابهة: يؤخذ استهلاكها الفعلي مع نسبة تعديل.<br>• إدخال يدوي: تكتب الاستهلاك الشهري المتوقع.</div>', showDenyButton: true, showCancelButton: true, confirmButtonText: 'مادة مشابهة', denyButtonText: 'إدخال الاستهلاك يدوياً', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', denyButtonColor: '#334155', reverseButtons: true });
        if (ch.isDismissed) return;
        const inp = 'width:100%;height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font:inherit;text-align:center;box-sizing:border-box';
        if (ch.isDenied) {
            const o = await Swal.fire({ title: 'الاستهلاك المتوقع', html: `<div dir="rtl" style="text-align:right;display:grid;gap:10px"><div class="nd-hint">أدخل أرقاماً تقريبية للحساب فقط.</div><label class="fu-l">الاستهلاك الشهري المتوقع (علب)<input id="ndcM" type="number" inputmode="decimal" min="0" step="any" style="${inp}"></label><label class="fu-l">الرصيد الحالي (علب)<input id="ndcS" type="number" inputmode="decimal" min="0" step="any" value="${cur}" style="${inp}"></label></div>`, showCancelButton: true, confirmButtonText: 'حساب', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', reverseButtons: true, preConfirm: () => { const m = parseFloat(document.getElementById('ndcM').value), st = parseFloat(document.getElementById('ndcS').value); if (!(m >= 0)) { Swal.showValidationMessage('أدخل الاستهلاك الشهري'); return false; } return { m, st: st >= 0 ? st : 0 }; } });
            if (!o.isConfirmed) return;
            r = ndcSynthRow(p, o.value.m, o.value.st, 'استهلاك مُدخل يدوياً');
        } else {
            ndcSimSel = null; ndcSimPid = pid;
            const o = await Swal.fire({ title: 'اختر المادة المشابهة', html: `<div dir="rtl" style="text-align:right;display:grid;gap:10px"><input type="search" id="ndcSimQ" autocomplete="off" placeholder="ابحث عن المادة المشابهة" oninput="ndcSimSearch(this.value)" style="${inp}"><div id="ndcSimRes"></div><div id="ndcSimSelBox" class="nd-hint"></div><label class="fu-l">نسبة التعديل (%) من استهلاكها<input id="ndcSimP" type="number" inputmode="decimal" min="1" step="any" value="100" style="${inp}"></label><label class="fu-l">الرصيد الحالي للمادة الجديدة (علب)<input id="ndcSimS" type="number" inputmode="decimal" min="0" step="any" value="${cur}" style="${inp}"></label></div>`, showCancelButton: true, confirmButtonText: 'حساب', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f766e', reverseButtons: true, preConfirm: () => { const pc = parseFloat(document.getElementById('ndcSimP').value), st = parseFloat(document.getElementById('ndcSimS').value); if (!ndcSimSel) { Swal.showValidationMessage('اختر المادة المشابهة'); return false; } if (!(pc > 0)) { Swal.showValidationMessage('أدخل نسبة التعديل'); return false; } return { pc, st: st >= 0 ? st : 0 }; } });
            if (!o.isConfirmed || !ndcSimSel) return;
            const sr = ndcSimSel, pc = o.value.pc; r = ndcSynthRow(p, sr.rate * 30 * pc / 100, o.value.st, 'مبني على مادة مشابهة: ' + (sr.p.name || '') + ' بنسبة ' + fmtNum(pc) + '%');
        }
        ndcSynth = r; src = 'y';
    }
    ndwSrc = src; ndwCur = pid; ndwOpenSec = { sum: true, need: true, plan: true };
    ndcMode = true; ndcInline(r);
}
let ndcAlt = null, ndcMode = false, ndcTab = 'calc';
function ndcInline(r) {
    const m = document.getElementById('ndcMain'); if (!m) return;
    m.innerHTML = `<button type="button" class="ln-btn" style="margin-bottom:10px;width:100%" onclick="ndcShowSearch()">تغيير المادة</button><div id="ndcSeg">${ndcSegHtml()}</div><div id="ndwDet" class="fu-det">${ndwDetBody(r)}</div>`;
    const b = document.querySelector('#ndcOv .cn-body'); if (b) b.scrollTop = 0;
}
function ndcTabsHtml() { return `<div class="ndw-tabs">${[['calc', 'حاسبة الاحتياج'], ['offer', 'تقييم العروض']].map(([k, l]) => `<button type="button" class="${ndcTab === k ? 'on' : ''}" onclick="ndcGo('${k}')">${l}</button>`).join('')}</div>`; }
function ndcGo(k) {
    if (ndcTab === k) return; if (document.getElementById('ndwDet')) ndwOfRead(); ndcTab = k;
    const t = document.getElementById('ndcTabs'); if (t) t.innerHTML = ndcTabsHtml();
    const r = ndwFind(ndwCur), el = document.getElementById('ndwDet'); if (r && el) el.innerHTML = ndwDetBody(r);
}
function ndcSegHtml() { return ndcAlt ? `<div class="ndw-seg" style="margin-bottom:10px">${[['s', 'حسب المبيعات'], ['i', 'حسب الوارد']].map(([k, l]) => `<button type="button" class="${ndwSrc === k ? 'on' : ''}" onclick="ndcSwitch('${k}')">${l}</button>`).join('')}</div>` : ''; }
function ndcSwitch(k) {
    if (!ndcAlt || !ndcAlt[k] || ndwSrc === k) return; ndwOfRead(); ndwSrc = k;
    const sg = document.getElementById('ndcSeg'); if (sg) sg.innerHTML = ndcSegHtml(); ndwDetRefresh();
}
let ndcSimSel = null, ndcSimPid = null;
function ndcSimSearch(v) {
    const q = normSearch(v || ''), toks = q ? q.split(' ') : [], box = document.getElementById('ndcSimRes'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    const rates = new Map(); [...ndwRows, ...ndmRows].forEach(x => { if (x.method !== 'none' && x.rate > 0 && (!rates.has(x.p.id) || x.src === 's')) rates.set(x.p.id, x); });
    const list = (products || []).filter(p => p && !p.arch && p.id !== ndcSimPid && rates.has(p.id) && searchScore(p, q, toks) > 0).slice(0, 6);
    box.innerHTML = list.map(p => { const x = rates.get(p.id); return `<div class="cu-row fu-row ndw-rw" onclick="ndcSimUse(${p.id})"><div><b dir="ltr">${dispNameHtml(p)}</b></div><small>${fmtNum(Math.round(x.rate * 300) / 10)} علبة شهرياً</small></div>`; }).join('') || '<div class="cu-none">لا توجد مادة لها استهلاك مسجل بهذا الاسم.</div>';
    ndcSimMap = rates;
}
let ndcSimMap = null;
function ndcSimUse(id) {
    const x = ndcSimMap && ndcSimMap.get(id); if (!x) return; ndcSimSel = x;
    const b = document.getElementById('ndcSimSelBox'); if (b) b.innerHTML = 'المختارة: <b dir="ltr">' + escapeHtml(x.p.name || '') + '</b> • استهلاكها ' + fmtNum(Math.round(x.rate * 300) / 10) + ' علبة شهرياً';
    const r = document.getElementById('ndcSimRes'); if (r) r.innerHTML = '';
}
function ndcSynthRow(p, monthly, stock, note) {
    const rate = monthly / 30, ex = ndxExpiry(p, rate), cfg = ndmCfg(), T = cfg.lead + cfg.rev, sdw = Math.sqrt(rate * 7 * 2), ss = 1.65 * sdw * Math.sqrt(T / 7), today = todayLocalISO(), pos = stock - ex.expired, sm = ndwSupMap();
    const sups = sm.get(p.id) || [];
    return { src: 's', synth: true, note: note || '', method: 'sales', counted: true, manual: true, p, ex, rate, stock, ord: 0, ss, rop: rate * cfg.lead + ss, tgt: rate * T + ss, sdw, status: 'ok', sug: 0, minQ: 0, cover: rate > 0 ? pos / rate : null, pos, conf: 'منخفضة', consumed: rate * 90, demand: rate * 90, span: 90, ev: [], first: today, last: today, since: 0, units: 0, nEv: 0, nsE: 0, nsO: 0, w80: [Math.max(0, rate * 7 - 1.28 * sdw), rate * 7 + 1.28 * sdw], sups, sup: ndwSupPick(sups, p.id) };
}
function ndwToList(src) {
    const rows = (src === 's' ? ndmRows : ndwRows).filter(r => r.status === 'order' && r.sug > 0 && (!ndwSup || r.sup === ndwSup)); if (!rows.length) return;
    ndwPushList(rows);
}

// لقطة النفاد اليومية تعمل أيضاً في الخلفية بعد تحميل البيانات
setTimeout(ndZeroSnap, 20000); document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(ndZeroSnap, 3000); });
