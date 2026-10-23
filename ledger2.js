// =====================================================================
// التسديد والحسابات: مقبوض من الحسابات (kind=recv) + مسدَّد للمذاخر مع الخصم (kind=pay) + أرصدة المذاخر
// يستخدم نفس مجموعة pharmacy_ledger ودوال ledger.js
// =====================================================================
let lgPaySeg = 'recv';
const LG_BY = { accounts: 'الحسابات', me: 'أنا' };
const lgRecvs = () => lgAll.filter(e => e.kind === 'recv' && !e.del);
const lgPays = () => lgAll.filter(e => e.kind === 'pay' && !e.del);

function lgPayRange() {
    const t = $b('lgpType').value;
    if (t === 'all') return { from: '0000-01', to: '9999-12', label: 'كل الفترات', file: 'all' };
    if (t === 'year') { const y = String($b('lgpYear').value || new Date().getFullYear()); return { from: y + '-01', to: y + '-12', label: y, file: y, year: true }; }
    const m = $b('lgpMonth').value || lgNowMonth(); return { from: m, to: m, label: lgMonthLabel(m), file: m };
}
function lgInitPay() {
    if (!$b('lgpMonth').value) $b('lgpMonth').value = lgNowMonth();
    if (!$b('lgpYear').value) $b('lgpYear').value = new Date().getFullYear();
    lgFillSupSelect('lgpSup');
    lgPaySegSet(lgPaySeg);
}
function lgPaySegSet(seg) {
    lgPaySeg = seg;
    document.querySelectorAll('#lgpSeg button').forEach(b => b.classList.toggle('active', b.dataset.seg === seg));
    $b('lgpSW').style.display = seg === 'recv' ? 'none' : '';
    $b('lgpFilters').style.display = seg === 'bal' ? 'none' : '';
    $b('lgpAdd').style.display = seg === 'bal' ? 'none' : '';
    $b('lgpAdd').textContent = seg === 'recv' ? '＋ تسجيل وصل مقبوض' : '＋ تسجيل تسديد لمذخر';
    lgPayRender();
}
function lgPayFilter() {
    const rg = lgPayRange(), t = $b('lgpType').value;
    $b('lgpMW').style.display = t === 'month' ? '' : 'none'; $b('lgpYW').style.display = t === 'year' ? '' : 'none';
    const sup = $b('lgpSup').value, inR = e => { const m = lgMonthOfDate(e.date); return m >= rg.from && m <= rg.to; };
    const srt = (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdTs).localeCompare(String(b.createdTs));
    if (lgPaySeg === 'recv') return { rg, arr: lgRecvs().filter(inR).sort(srt) };
    return { rg, arr: lgPays().filter(e => inR(e) && (!sup || puKey(e.supplier) === puKey(sup))).sort(srt) };
}
function lgMonthBreak(arr, key) {   // مجاميع شهرية لعمود رقمي
    const by = new Map(); arr.forEach(e => { const m = lgMonthOfDate(e.date); by.set(m, (by.get(m) || 0) + puNum(e[key])); });
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function lgPayRender() {
    if (!$b('lgp-list')) return;
    if (lgPaySeg === 'bal') return lgRenderBalances();
    const { rg, arr } = lgPayFilter(), isRecv = lgPaySeg === 'recv';
    let sum, cards, sheet;
    if (isRecv) {
        const tot = arr.reduce((s, e) => s + puNum(e.amount), 0);
        sum = `<span>مقبوض من الحسابات — ${escapeHtml(rg.label)}</span><b>${fmtNum(tot)} د.ع</b><small>${arr.length} وصل</small>`;
        cards = arr.map(e => `<div class="bill-card"><div class="bill-card-main" onclick="lgPayOpen('${e.id}')"><b>وصل ${escapeHtml(e.no || '—')}</b>${e.stmt ? ' <em class="tg">✓</em>' : ''}<small>${escapeHtml(fmtDateDMY(e.date))}${e.note ? ' • ' + escapeHtml(e.note) : ''}</small></div><div class="bill-card-amt">${fmtNum(e.amount)}<small>د.ع</small></div></div>`).join('');
        let rows = '', lastM = null, run = 0, i = 0;
        const flush = () => { if (lastM !== null) rows += `<tr class="pu-grp"><td colspan="3">مجموع شهر ${lgMonthLabel(lastM)}</td><td>${fmtNum(run)}</td><td></td></tr>`; run = 0; };
        arr.forEach(e => { const m = lgMonthOfDate(e.date); if (m !== lastM) { flush(); lastM = m; } run += puNum(e.amount); rows += `<tr><td class="pu-n">${++i}</td><td dir="ltr">${escapeHtml(e.no || '')}</td><td>${escapeHtml(fmtDateDMY(e.date))}</td><td>${fmtNum(e.amount)}</td><td>${escapeHtml(e.note || '')}</td></tr>`; });
        flush();
        const mb = rg.year || $b('lgpType').value === 'all' ? `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>المقبوض</th></tr></thead><tbody>${lgMonthBreak(arr, 'amount').map(([m, v]) => `<tr><td>${lgMonthLabel(m)}</td><td>${fmtNum(v)}</td></tr>`).join('')}</tbody></table></div>` : '';
        sheet = lgLetterhead('وصولات التسديد المقبوضة من الحسابات', escapeHtml(rg.label)) + mb + `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th>رقم الوصل</th><th>التاريخ</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>${rows || '<tr><td colspan="5">لا توجد وصولات.</td></tr>'}</tbody>${arr.length ? `<tfoot><tr><td colspan="3">المجموع</td><td>${fmtNum(tot)}</td><td></td></tr></tfoot>` : ''}</table></div>`;
    } else {
        const g = arr.reduce((s, e) => s + puNum(e.gross), 0), d = arr.reduce((s, e) => s + puNum(e.disc), 0), net = g - d;
        sum = `<span>مسدَّد للمذاخر — ${escapeHtml(rg.label)}</span><b>${fmtNum(g)} د.ع</b><small>الخصم (ربحك): <b style="color:#fbbf24">${fmtNum(d)}</b> • الصافي المدفوع: ${fmtNum(net)} • ${arr.length} تسديد</small>`;
        cards = arr.map(e => `<div class="bill-card"><div class="bill-card-main" onclick="lgPayOpen('${e.id}')"><b>${escapeHtml(e.supplier)}</b> <em class="tg">${LG_BY[e.by] || ''}</em>${puNum(e.disc) > 0 ? `<em class="tg warn">خصم ${fmtNum(e.disc)}</em>` : ''}${e.stmt ? ' <em class="tg">✓</em>' : ''}<small>${escapeHtml(fmtDateDMY(e.date))}${e.no ? ' • وصل/قيد ' + escapeHtml(e.no) : ''}${e.note ? ' • ' + escapeHtml(e.note) : ''}</small></div><div class="bill-card-amt">${fmtNum(e.gross)}<small>د.ع</small></div></div>`).join('');
        const mb = rg.year || $b('lgpType').value === 'all' ? `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>المسدَّد</th><th>الخصم</th></tr></thead><tbody>${[...new Set(arr.map(e => lgMonthOfDate(e.date)))].sort().map(m => { const l = arr.filter(e => lgMonthOfDate(e.date) === m); return `<tr><td>${lgMonthLabel(m)}</td><td>${fmtNum(l.reduce((s, e) => s + puNum(e.gross), 0))}</td><td>${fmtNum(l.reduce((s, e) => s + puNum(e.disc), 0))}</td></tr>`; }).join('')}</tbody></table></div>` : '';
        sheet = lgLetterhead('التسديد للمذاخر والخصومات', escapeHtml(rg.label) + ($b('lgpSup').value ? ' — ' + escapeHtml($b('lgpSup').value) : '')) + mb + `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th class="pu-ckh">✓</th><th>التاريخ</th><th>المذخر</th><th>من سدّد</th><th>الوصل/القيد</th><th>المبلغ</th><th>%</th><th>الخصم</th></tr></thead><tbody>${arr.map((e, i) => `<tr><td class="pu-n">${i + 1}</td><td class="pu-ck">${e.stmt ? '✓' : ''}</td><td>${escapeHtml(fmtDateDMY(e.date))}</td><td>${escapeHtml(e.supplier)}</td><td>${LG_BY[e.by] || ''}</td><td dir="ltr">${escapeHtml(e.no || '')}</td><td>${fmtNum(e.gross)}</td><td>${puNum(e.pct) ? fmtNum(e.pct) : ''}</td><td>${puNum(e.disc) ? fmtNum(e.disc) : ''}</td></tr>`).join('') || '<tr><td colspan="9">لا توجد تسديدات.</td></tr>'}</tbody>${arr.length ? `<tfoot><tr><td colspan="6">المجموع</td><td>${fmtNum(g)}</td><td></td><td>${fmtNum(d)}</td></tr></tfoot>` : ''}</table></div>`;
    }
    $b('lgp-sum').innerHTML = sum;
    $b('lgp-list').innerHTML = cards || `<div class="bill-none">${isRecv ? 'لا توجد وصولات في هذه الفترة.' : 'لا توجد تسديدات في هذه الفترة.'}</div>`;
    $b('lgp-sheet').innerHTML = sheet;
}

// ---------- أرصدة المذاخر (تقديرية) ----------
function lgBalances() {
    const names = puSupplierNames(), out = [];
    names.forEach(n => {
        const k = puKey(n), invs = puAll.filter(r => !r.cancelled && puKey(r.supplier) === k);
        const buy = invs.reduce((s, r) => s + puTotalOf(r), 0);
        const ret = invs.reduce((s, r) => s + puNum(r.returnAmt) + lgLinkedRet(r.id, 'all'), 0) + lgRets().filter(e => !e.listId && puKey(e.supplier) === k).reduce((s, e) => s + puNum(e.amount), 0);
        const paidInv = invs.reduce((s, r) => s + puNum(r.paid), 0);
        const pays = lgPays().filter(e => puKey(e.supplier) === k), gross = pays.reduce((s, e) => s + puNum(e.gross), 0), disc = pays.reduce((s, e) => s + puNum(e.disc), 0);
        if (!buy && !gross && !ret) return;
        out.push({ name: n, buy, ret, paid: paidInv + gross, disc, bal: buy - ret - paidInv - gross });
    });
    return out.sort((a, b) => b.bal - a.bal);
}
function lgRenderBalances() {
    const arr = lgBalances(), t = k => arr.reduce((s, x) => s + x[k], 0);
    $b('lgp-sum').innerHTML = `<span>المتبقي على المذاخر (تقديري)</span><b>${fmtNum(t('bal'))} د.ع</b><small>يعتمد على التسديدات التي سجّلتها. سجّل التسديدات من كشوف المذاخر لتصبح الأرصدة أدق.</small>`;
    $b('lgp-list').innerHTML = arr.map(x => `<div class="bill-card"><div class="bill-card-main"><b>${escapeHtml(x.name)}</b>${x.disc > 0 ? `<em class="tg warn">خصم ${fmtNum(x.disc)}</em>` : ''}<small>مشتريات ${fmtNum(x.buy)} − مردود ${fmtNum(x.ret)} − مسدَّد ${fmtNum(x.paid)}</small></div><div class="bill-card-amt" style="${x.bal > 0 ? 'color:#b45309' : ''}">${fmtNum(x.bal)}<small>د.ع</small></div></div>`).join('') || '<div class="bill-none">لا توجد بيانات بعد.</div>';
    $b('lgp-sheet').innerHTML = lgLetterhead('أرصدة المذاخر (تقديرية)', escapeHtml(fmtDateDMY(todayLocalISO()))) + `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>المذخر</th><th>المشتريات</th><th>المردود</th><th>المسدَّد</th><th>الخصم</th><th>المتبقي</th></tr></thead><tbody>${arr.map(x => `<tr><td>${escapeHtml(x.name)}</td><td>${fmtNum(x.buy)}</td><td>${fmtNum(x.ret)}</td><td>${fmtNum(x.paid)}</td><td>${x.disc ? fmtNum(x.disc) : ''}</td><td>${fmtNum(x.bal)}</td></tr>`).join('')}</tbody><tfoot><tr><td>المجموع</td><td>${fmtNum(t('buy'))}</td><td>${fmtNum(t('ret'))}</td><td>${fmtNum(t('paid'))}</td><td>${fmtNum(t('disc'))}</td><td>${fmtNum(t('bal'))}</td></tr></tfoot></table></div>`;
}

// ---------- إضافة / تعديل ----------
function lgPayAdd() { lgPayForm(lgPaySeg === 'recv' ? 'recv' : 'pay', null); }
function lgPayCalc() {
    const g = parseFloat((document.getElementById('swPG') || {}).value) || 0, pct = parseFloat((document.getElementById('swPP') || {}).value), d = document.getElementById('swPD');
    if (d && !d.dataset.manual && pct >= 0) d.value = Math.round(g * pct / 100);
    const n = document.getElementById('swPN'); if (n) n.textContent = fmtNum(g - (parseFloat(d && d.value) || 0));
}
async function lgPayForm(kind, ev) {
    const e = ev || {}, isRecv = kind === 'recv';
    const inp = (id, label, extra) => `<label style="display:block;text-align:right;font-size:.8rem;font-weight:800;margin-top:6px">${label}<input id="${id}" class="swal2-input" style="margin:4px 0 0;width:100%" ${extra || ''}></label>`;
    const html = isRecv
        ? inp('swPDt', 'التاريخ', `type="date" value="${escapeHtml(e.date || todayLocalISO())}"`) + inp('swPNo', 'رقم الوصل', `dir="ltr" value="${escapeHtml(e.no || '')}"`) + inp('swPA', 'مبلغ الوصل (د.ع)', `type="number" inputmode="decimal" value="${e.amount || ''}"`) + inp('swPNote', 'ملاحظات', `value="${escapeHtml(e.note || '')}"`)
        : inp('swPS', 'المذخر', `list="puSupList" value="${escapeHtml(e.supplier || '')}"`) + inp('swPDt', 'التاريخ', `type="date" value="${escapeHtml(e.date || todayLocalISO())}"`) +
          inp('swPG', 'المبلغ المسدَّد (قبل الخصم)', `type="number" inputmode="decimal" value="${e.gross || ''}" oninput="lgPayCalc()"`) +
          `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${inp('swPP', 'نسبة الخصم %', `type="number" step="any" inputmode="decimal" value="${e.pct != null && e.pct !== '' ? e.pct : ''}" oninput="document.getElementById('swPD').dataset.manual='';lgPayCalc()"`)}${inp('swPD', 'مبلغ الخصم', `type="number" inputmode="decimal" value="${e.disc || ''}" oninput="this.dataset.manual='1';lgPayCalc()"`)}</div>` +
          `<div style="text-align:right;margin-top:6px;font-weight:800">الصافي المدفوع: <span id="swPN">${fmtNum(puNum(e.gross) - puNum(e.disc))}</span> د.ع</div>` +
          `<label style="display:block;text-align:right;font-size:.8rem;font-weight:800;margin-top:6px">من سدّد<select id="swPBy" class="swal2-input" style="margin:4px 0 0;width:100%"><option value="accounts" ${e.by !== 'me' ? 'selected' : ''}>الحسابات</option><option value="me" ${e.by === 'me' ? 'selected' : ''}>أنا</option></select></label>` +
          inp('swPNo', 'رقم الوصل / القيد (اختياري)', `dir="ltr" value="${escapeHtml(e.no || '')}"`) + inp('swPNote', 'ملاحظات', `value="${escapeHtml(e.note || '')}"`) +
          `<label class="pu-chk" style="margin-top:8px"><input type="checkbox" id="swPSt" ${e.stmt ? 'checked' : ''}><span>✓ استلمتُ كشف المذخر</span></label>`;
    const r = await Swal.fire({ title: (ev ? 'تعديل ' : 'تسجيل ') + (isRecv ? 'وصل مقبوض من الحسابات' : 'تسديد لمذخر'), html, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        didOpen: () => { const d = document.getElementById('swPD'); if (d && e.disc) d.dataset.manual = '1'; },
        preConfirm: () => { const g = id => (document.getElementById(id) || {}).value;
            if (isRecv) { const a = parseFloat(g('swPA')); if (!(a > 0)) { Swal.showValidationMessage('أدخل مبلغ الوصل'); return false; } return { date: g('swPDt'), no: (g('swPNo') || '').trim(), amount: a, note: (g('swPNote') || '').trim() }; }
            const s = (g('swPS') || '').trim(), gr = parseFloat(g('swPG')); if (!s) { Swal.showValidationMessage('اكتب اسم المذخر'); return false; } if (!(gr > 0)) { Swal.showValidationMessage('أدخل المبلغ المسدَّد'); return false; }
            const pct = parseFloat(g('swPP')), disc = parseFloat(g('swPD')) || 0; if (disc > gr) { Swal.showValidationMessage('الخصم أكبر من المبلغ'); return false; }
            return { supplier: s, date: g('swPDt'), gross: gr, pct: pct >= 0 ? pct : '', disc, by: g('swPBy'), no: (g('swPNo') || '').trim(), note: (g('swPNote') || '').trim(), stmt: !!document.getElementById('swPSt').checked }; } });
    if (!r.isConfirmed || !r.value) return;
    const v = r.value, rec = ev ? { ...ev } : { id: lgId(), kind, createdTs: new Date().toISOString() };
    Object.assign(rec, v, { date: v.date || todayLocalISO() });
    if (!isRecv) { rec.net = rec.gross - rec.disc; await puUpsertSupplier(rec.supplier); }
    await lgSave(rec); lgPayRender();
}
function lgPayOpen(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const btn = (label, fn, cls) => `<button type="button" class="bill-tb-btn ${cls || ''}" onclick="Swal.close();${fn}">${label}</button>`;
    const isRecv = e.kind === 'recv';
    Swal.fire({ title: isRecv ? 'وصل ' + escapeHtml(e.no || '—') + ' — ' + fmtNum(e.amount) : escapeHtml(e.supplier) + ' — ' + fmtNum(e.gross), showConfirmButton: false, showCloseButton: true,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(e.date))}${isRecv ? '' : ' • ' + (LG_BY[e.by] || '') + (e.no ? ' • وصل/قيد ' + escapeHtml(e.no) : '')}</div>${isRecv ? '' : `<div class="pu-d-tot"><div>المسدَّد: <b>${fmtNum(e.gross)}</b></div><div>الخصم${e.pct !== '' && e.pct != null ? ' (' + e.pct + '%)' : ''}: <b>${fmtNum(e.disc)}</b></div><div>الصافي المدفوع: <b>${fmtNum(puNum(e.gross) - puNum(e.disc))}</b></div></div>`}${e.note ? `<div class="pu-d-pays">${escapeHtml(e.note)}</div>` : ''}<div class="pu-d-btns">${btn('✏️ تعديل', `lgPayForm('${e.kind}',lgAll.find(x=>x.id==='${e.id}'))`)}${isRecv ? '' : btn(e.stmt ? '☑ إلغاء علامة الكشف' : '✓ استلمت الكشف', `lgPayToggle('${e.id}')`)}${btn('🗑️ حذف', `lgPayDel('${e.id}')`, 'bill-danger')}</div></div>` });
}
async function lgPayToggle(id) { const e = lgAll.find(x => x.id === id); if (!e) return; e.stmt = !e.stmt; await lgSave(e); lgPayRender(); }
async function lgPayDel(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف هذا السجل؟', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    e.del = true; await lgSave(e); lgPayRender();
}
function lgPayCsv() {
    if (lgPaySeg === 'bal') { const L = [['المذخر', 'المشتريات', 'المردود', 'المسدَّد', 'الخصم', 'المتبقي (تقديري)']]; lgBalances().forEach(x => L.push([x.name, x.buy, x.ret, x.paid, x.disc, x.bal])); return lgCsvDownload('supplier-balances-' + todayLocalISO() + '.csv', L); }
    const { rg, arr } = lgPayFilter();
    if (lgPaySeg === 'recv') { const L = [['رقم الوصل', 'التاريخ', 'المبلغ', 'ملاحظات']]; arr.forEach(e => L.push([e.no || '', e.date, e.amount, e.note || ''])); L.push(['المجموع', '', arr.reduce((s, e) => s + puNum(e.amount), 0), '']); return lgCsvDownload('received-from-accounts-' + rg.file + '.csv', L); }
    const L = [['الكشف', 'التاريخ', 'المذخر', 'من سدّد', 'رقم الوصل/القيد', 'المبلغ المسدَّد', 'نسبة الخصم', 'مبلغ الخصم', 'الصافي المدفوع', 'ملاحظات']];
    arr.forEach(e => L.push([e.stmt ? '✓' : '', e.date, e.supplier, LG_BY[e.by] || '', e.no || '', e.gross, e.pct, e.disc, puNum(e.gross) - puNum(e.disc), e.note || '']));
    L.push(['المجموع', '', '', '', '', arr.reduce((s, e) => s + puNum(e.gross), 0), '', arr.reduce((s, e) => s + puNum(e.disc), 0), arr.reduce((s, e) => s + puNum(e.gross) - puNum(e.disc), 0), '']);
    lgCsvDownload('supplier-payments-' + rg.file + '.csv', L);
}
