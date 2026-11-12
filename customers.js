// ============================================================================
// الزبائن: أرصدة الآجل لكل زبون (مستخرجة من الفواتير الصادرة، حسب اسم الزبون)، كشف حساب، تسديد دفعة واحدة
// تتوزع تلقائياً على أقدم الفواتير، وطباعة الكشف. للمالك فقط (مثل تبويب الآجل).
// ============================================================================
let cuScr = 'list', cuSeg = 'owe', cuQ = '', cuKeys = [], cuCur = null, cuOpenFlag = false;
const cuNorm = s => String(s || '').replace(/\s+/g, ' ').trim();
const cuKeyOf = b => cuNorm(b.customer || b.to).toLowerCase();
const cuNameOf = b => cuNorm(b.customer || b.to) || 'بدون اسم';
const cuR2 = n => Math.round((Number(n) || 0) * 100) / 100;

function cuLoadLocal() {
    if (billAll && billAll.length) return;
    try { billAll = (JSON.parse(lsGet(BILL_LS.list)) || []).filter(x => x && x.id).sort((a, b) => String(b.issuedTs || b.issuedAt).localeCompare(String(a.issuedTs || a.issuedAt))); } catch (e) { billAll = billAll || []; }
}
function cuGroups() {
    const m = new Map();
    (billAll || []).filter(b => b && b.issued && !b.cancelled).forEach(b => {
        const k = cuKeyOf(b), g = m.get(k) || { key: k, name: cuNameOf(b), invs: [], owed: 0, total: 0, last: '' };
        g.invs.push(b); g.owed += invRemaining(b); g.total += invTotalOf(b); if (String(b.date) > g.last) g.last = String(b.date);
        m.set(k, g);
    });
    const cmp = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.issuedTs || a.issuedAt || '').localeCompare(String(b.issuedTs || b.issuedAt || ''));
    m.forEach(g => { g.invs.sort(cmp); g.owed = cuR2(g.owed); });
    return m;
}
function cuBadge() {
    const el = document.getElementById('homeCusCount'); if (!el) return;
    cuLoadLocal(); let n = 0; cuGroups().forEach(g => { if (g.owed > 0) n++; });
    el.innerText = n; el.style.display = n ? 'flex' : 'none';
}

function cuEnsureDom() {
    if (document.getElementById('cuOv')) return;
    const d = document.createElement('div'); d.id = 'cuOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="cuBox"></div>';
    document.body.appendChild(d);
}
async function cuOpen() {
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'صفحة الزبائن للمالك فقط.', confirmButtonColor: '#0f1c38' }); return; }
    cuEnsureDom(); cuLoadLocal();
    document.getElementById('cuOv').style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); cuOpenFlag = true;
    cuScr = 'list'; cuCur = null; cuSeg = 'owe'; cuQ = ''; cuListRender();
    const h = Prog.start('تحميل الفواتير', { text: 'جارٍ التحديث من السحابة...' });
    try { await loadInvoices(); h.ok('تم التحديث'); } catch (e) { h.fail('تعذر التحديث', e.message || String(e)); }
    if (cuOpenFlag) { if (cuScr === 'list') cuListRender(true); else cuDetailRender(); }
    cuBadge();
}
function cuClose() {
    const ov = document.getElementById('cuOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); cuOpenFlag = false; cuCur = null; cuScr = 'list';
    cuBadge();
}
function cuBack() { if (cuScr === 'detail') { cuCur = null; cuScr = 'list'; cuListRender(); } else cuClose(); }

// ---------- قائمة الزبائن ----------
function cuListRender(keepQ) {
    cuScr = 'list';
    const g = cuGroups(); let owedAll = 0, cnt = 0; g.forEach(x => { if (x.owed > 0) { owedAll += x.owed; cnt++; } });
    document.getElementById('cuBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cuClose()" aria-label="رجوع">→</button><b>الزبائن</b><span></span></div>
        <div class="cn-bar"><input id="cuQ" type="search" autocomplete="off" placeholder="ابحث باسم الزبون" value="${escapeHtml(keepQ ? cuQ : '')}" oninput="cuQ=this.value;cuRows()"></div>
        <div class="cn-body"><div class="cu-sum"><span>إجمالي الآجل على الزبائن</span><b>${fmtNum(owedAll)} د.ع</b><small>${cnt} زبون عليهم آجل</small></div>
        <div class="cu-seg"><button type="button" id="cuSegOwe" onclick="cuSeg='owe';cuRows()">عليهم آجل</button><button type="button" id="cuSegAll" onclick="cuSeg='all';cuRows()">كل الزبائن</button></div>
        <div id="cuRows"></div></div>`;
    if (!keepQ) cuQ = '';
    cuRows();
}
function cuRows() {
    const box = document.getElementById('cuRows'); if (!box) return;
    document.getElementById('cuSegOwe').classList.toggle('on', cuSeg === 'owe'); document.getElementById('cuSegAll').classList.toggle('on', cuSeg === 'all');
    const q = cuNorm(cuQ).toLowerCase();
    let arr = [...cuGroups().values()].filter(g => (cuSeg === 'all' || g.owed > 0) && (!q || g.name.toLowerCase().includes(q)));
    arr.sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name, 'ar'));
    cuKeys = arr.map(g => g.key);
    box.innerHTML = arr.map((g, i) => `<div class="cu-row" onclick="cuDetail(${i})"><div class="cu-av">${escapeHtml([...g.name][0] || '؟')}</div>
        <div><b>${escapeHtml(g.name)}</b><small>${g.invs.length} فاتورة • آخر فاتورة ${escapeHtml(fmtDateDMY(g.last))}</small></div>
        <div class="cu-amt ${g.owed > 0 ? 'owe' : 'ok'}">${g.owed > 0 ? fmtNum(g.owed) : 'مسدَّد'}${g.owed > 0 ? '<small>د.ع</small>' : ''}</div></div>`).join('')
        || `<div class="cu-none">${cuSeg === 'owe' ? 'لا يوجد زبائن عليهم آجل.' : 'لا يوجد زبائن بعد.'}</div>`;
}
function cuDetail(i) { cuCur = cuKeys[i]; if (cuCur === undefined) return; cuDetailRender(); }

// ---------- كشف حساب الزبون ----------
function cuStmt(g) {   // أسطر الكشف مرتبة بالتاريخ مع الرصيد الجاري (الفاتورة قبل دفعاتها في نفس اليوم)
    const ev = [];
    g.invs.forEach((b, bi) => {
        const tot = invTotalOf(b), pays = (b.payments || []).filter(p => p && Number(p.amount) > 0);
        const paySum = pays.reduce((s, p) => s + Number(p.amount), 0);
        const first = b.paid === '' || b.paid == null ? tot : Math.max(0, (parseFloat(b.paid) || 0) - paySum);
        ev.push({ date: String(b.date), o: 0, bi, kind: 'inv', no: b.no, debit: tot, credit: first, id: b.id });
        pays.forEach((p, pi) => ev.push({ date: String(p.at || b.date), o: 1, bi: pi, kind: 'pay', no: b.no, debit: 0, credit: Number(p.amount) }));
    });
    ev.forEach((x, i) => { x.i = i; });
    ev.sort((a, b) => a.date.localeCompare(b.date) || a.o - b.o || a.i - b.i);
    let bal = 0; ev.forEach(x => { bal += x.debit - x.credit; x.bal = cuR2(bal); });
    return ev;
}
function cuDetailRender() {
    const g = cuGroups().get(cuCur); if (!g) { cuBack(); return; }
    cuScr = 'detail';
    const debts = g.invs.filter(b => invRemaining(b) > 0), pays = [];
    g.invs.forEach(b => (b.payments || []).forEach(p => p && pays.push({ at: p.at || b.date, amount: Number(p.amount) || 0, no: b.no })));
    pays.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    document.getElementById('cuBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cuBack()" aria-label="رجوع">→</button><b>${escapeHtml(g.name)}</b><span></span></div>
        <div class="cn-body"><div class="cu-hd"><span>المتبقي على الزبون</span><div class="big ${g.owed > 0 ? '' : 'ok'}">${g.owed > 0 ? fmtNum(g.owed) + ' د.ع' : 'لا يوجد آجل'}</div><small>إجمالي المشتريات ${fmtNum(g.total)} د.ع • ${g.invs.length} فاتورة</small></div>
        <div class="cu-acts"><button type="button" class="pay" onclick="cuPay()" ${g.owed > 0 ? '' : 'disabled'}>تسديد دفعة</button><button type="button" class="prt" onclick="cuPrint()">طباعة كشف الحساب</button></div>
        <div class="cu-h">الفواتير (الأحدث أولاً)</div>
        ${g.invs.slice().reverse().map(b => { const r = invRemaining(b); return `<div class="cu-inv" onclick="cuGoInv('${b.id}')"><div><b dir="ltr">${escapeHtml(b.no || '')}</b><small>${escapeHtml(fmtDateDMY(b.date))} • ${(b.items || []).length} مادة</small></div><div class="cu-amt ${r > 0 ? 'owe' : 'ok'}">${fmtNum(invTotalOf(b))}<small>${r > 0 ? 'متبقٍ ' + fmtNum(r) : 'مسدَّدة'}</small></div></div>`; }).join('')}
        ${pays.length ? `<div class="cu-h">الدفعات المسجَّلة</div>` + pays.map(p => `<div class="cu-pay"><span>${escapeHtml(fmtDateDMY(p.at))} • فاتورة <bdi dir="ltr">${escapeHtml(p.no || '')}</bdi></span><b>${fmtNum(p.amount)}</b></div>`).join('') : ''}
        </div>`;
}
function cuGoInv(id) { cuClose(); try { showView('bill'); } catch (e) { /* تجاهل */ } billOpenSaved(id); }

// ---------- تسديد دفعة موزعة على أقدم الفواتير ----------
async function cuPay() {
    const g = cuGroups().get(cuCur); if (!g || !(g.owed > 0)) return;
    const debts = g.invs.filter(b => invRemaining(b) > 0);
    const r = await Swal.fire({ title: 'تسديد دفعة — ' + g.name, html: `المتبقي على الزبون: <b>${fmtNum(g.owed)} د.ع</b><br><small>تُوزَّع الدفعة على أقدم الفواتير أولاً.</small>`, input: 'number', inputValue: g.owed, inputAttributes: { min: 0, max: g.owed, step: 'any', inputmode: 'decimal' }, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء' });
    const amt = cuR2(Math.min(parseFloat(r && r.value) || 0, g.owed));
    if (!r.isConfirmed || !(amt > 0)) return;
    const plan = []; let left = amt;
    for (const b of debts) { if (left <= 0.004) break; const take = cuR2(Math.min(left, invRemaining(b))); if (take > 0) { plan.push({ b, take }); left = cuR2(left - take); } }
    const c = await Swal.fire({ title: 'تأكيد تسجيل الدفعة', html: `سيُسجَّل <b>${fmtNum(amt)} د.ع</b> موزَّعاً على ${plan.length} فاتورة:<div style="margin-top:8px;text-align:right;font-size:.88rem">${plan.map(x => `<div style="display:flex;justify-content:space-between;gap:8px"><span dir="ltr">${escapeHtml(x.b.no || '')}</span><b>${fmtNum(x.take)}</b></div>`).join('')}</div>`, showCancelButton: true, confirmButtonColor: '#0f766e', confirmButtonText: 'تسجيل الدفعة', cancelButtonText: 'إلغاء' });
    if (!c.isConfirmed) return;
    const h = Prog.start('تسجيل الدفعة', { text: 'حفظ ' + plan.length + ' فاتورة...', indeterminate: false });
    try {
        for (let i = 0; i < plan.length; i++) {
            const { b, take } = plan[i];
            b.paid = cuR2((parseFloat(b.paid) || 0) + take);
            (b.payments = b.payments || []).push({ at: todayLocalISO(), amount: take });
            await saveInvoiceRecord(b);
            if (bill && bill.id === b.id) bill = JSON.parse(JSON.stringify(b));
            h.tick(i + 1, plan.length);
        }
        h.ok('تم تسجيل الدفعة');
    } catch (e) { h.fail('تعذر حفظ الدفعة', e.message || String(e)); }
    if (cuOpenFlag) cuDetailRender();
    cuBadge();
}

// ---------- طباعة كشف الحساب ----------
function cuPrint() {
    const g = cuGroups().get(cuCur); if (!g) return;
    const rows = cuStmt(g);
    const body = rows.map(x => `<tr><td>${escapeHtml(fmtDateDMY(x.date))}</td><td>${x.kind === 'inv' ? 'فاتورة' : 'دفعة'} <bdi dir="ltr">${escapeHtml(x.no || '')}</bdi></td><td>${x.debit ? fmtNum(x.debit) : ''}</td><td>${x.credit ? fmtNum(x.credit) : ''}</td><td>${fmtNum(x.bal)}</td></tr>`).join('');
    const tD = rows.reduce((s, x) => s + x.debit, 0), tC = rows.reduce((s, x) => s + x.credit, 0);
    const html = lgLetterhead('كشف حساب زبون', escapeHtml(fmtDateDMY(todayLocalISO()))) +
        `<div class="pu-mtitle" style="margin:8px 0;font-weight:800">الزبون: ${escapeHtml(g.name)}</div>
        <div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين (فاتورة)</th><th>دائن (مسدَّد)</th><th>الرصيد</th></tr></thead><tbody>${body}</tbody>
        <tfoot><tr><td colspan="2">المجموع</td><td>${fmtNum(tD)}</td><td>${fmtNum(tC)}</td><td>${fmtNum(g.owed)}</td></tr></tfoot></table></div>
        <div style="margin-top:10px;font-weight:800">المتبقي على الزبون: ${fmtNum(g.owed)} د.ع</div>`;
    openReport({ title: 'كشف حساب — ' + g.name, html, fileName: 'customer-statement-' + todayLocalISO() });
}

(function () {
    if (typeof refreshHome === 'function') { const o = refreshHome; refreshHome = async function () { const r = await o.apply(this, arguments); try { cuBadge(); } catch (e) { /* تجاهل */ } return r; }; }
})();
