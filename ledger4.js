// =====================================================================
// الملخص المالي (شهري + سنوي، ربح بطريقتين ونمو) + شاشة «السجلات» التي تجمع كل التبويبات
// =====================================================================
const LG_REGS = ['month', 'ret', 'unrec', 'pay', 'bonus', 'blink', 'unify', 'xfer', 'exp', 'sum'];
const LG_HUB = [
    ['month', '📑', 'سجل الطلبيات', 'الكشف الشهري والسنوي للحسابات'],
    ['ret', '↩️', 'المردود للمذاخر', 'متابعة فواتير المردود'],
    ['unrec', '📌', 'المردود غير المقطوع', 'ما لم يُقتطع من الكشوف'],
    ['pay', '💳', 'التسديد والحسابات', 'المقبوض والمسدَّد والخصم والأرصدة'],
    ['bonus', '🎁', 'البونص', 'المواد المجانية وربحها'],
    ['blink', '🔗', 'سجل ربط البونص', 'ربط البونص المستلم بقوائمه'],
    ['unify', '🧩', 'سجل توحيد الوارد', 'توحيد أسماء مواد الوارد وربطها بالمخزن'],
    ['xfer', '🔁', 'المناقلة بين الصيدليات', 'كشف لكل صيدلية'],
    ['exp', '🗑️', 'المنتهي والتالف', 'خسارة ما لم يُبَع'],
    ['sum', '📊', 'الملخص المالي', 'الربح والنمو والحساب الختامي']
];
function lgHubInit() {   // شريط رجوع داخل كل سجل
    LG_REGS.forEach(id => {
        const p = $b('puPane-' + id), h = LG_HUB.find(x => x[0] === id);
        if (p && h && !p.querySelector('.lg-head')) {
            const d = document.createElement('div'); d.className = 'lg-head no-print';
            d.innerHTML = '<button type="button" class="lg-back" onclick="puTab(\'hub\')">‹ كل السجلات</button><div class="lg-title"><span class="lg-title-ic">' + h[1] + '</span><div><b>' + h[2] + '</b><small>' + h[3] + '</small></div></div>';
            p.insertBefore(d, p.firstChild);
        }
    });
}
function lgRenderHub() {
    const pend = lgRets().filter(e => lgStatus(e) === 'pending').length, late = lgRets().filter(e => lgStatus(e) === 'pending' && lgDaysSince(e.date) > lgDays()).length;
    const unrec = lgRets().filter(e => e.mode === 'unrec').reduce((s, e) => s + puNum(e.amount), 0);
    const badge = { ret: pend ? `<em class="tg ${late ? 'bad' : 'warn'}">${pend} بانتظار فاتورة${late ? ' • ' + late + ' متأخر' : ''}</em>` : '', unrec: unrec ? `<em class="tg warn">${fmtNum(unrec)}</em>` : '' };
    $b('lgHub').innerHTML = LG_HUB.map(([id, ic, t, s]) => `<button type="button" class="lg-hub-card" onclick="puTab('${id}')"><span class="lg-hub-ic">${ic}</span><b>${t}</b><small>${s}</small>${badge[id] || ''}</button>`).join('');
}
function lgTabBadge() {
    const n = lgRets().filter(e => lgStatus(e) === 'pending').length, b = $b('puTabHub');
    if (b) b.textContent = '🗂️ السجلات والكشوف' + (n ? ' (' + n + ')' : '');
    if ($b('lgHub') && puTabName === 'hub') lgRenderHub();
}

// ---------- الإعدادات (تُحفظ في pharmacy_ledger كوثيقة finset) ----------
function lgFin() { const e = lgAll.find(x => x.id === 'finset' && !x.del); return e || { id: 'finset', kind: 'finset', margin: 30, byYear: {} }; }
async function lgFinSaveField(year, k, v) {
    const f = JSON.parse(JSON.stringify(lgFin())); f.byYear = f.byYear || {};
    if (k === 'margin') f.margin = v; else { f.byYear[year] = f.byYear[year] || {}; f.byYear[year][k] = v; }
    await lgSave(f); lgRenderSum(true);
}
function lgStockSaleValue() { return products.reduce((s, p) => s + Math.max(parseInt(p.qty) || 0, 0) * (parseFloat(p.price) || 0), 0); }
function lgStockCostValue() { return products.reduce((s, p) => s + Math.max(parseInt(p.qty) || 0, 0) * (parseFloat(p.costPrice) || 0), 0); }
function lgInitSum() { if (!$b('lgsYear').value) $b('lgsYear').value = new Date().getFullYear(); lgRenderSum(); }

function lgSalesByMonth(year) {   // الطريقة الفعلية: فواتير البيع الصادرة (سعر الشراء المحفوظ وقت الإصدار)
    const by = new Map(); let miss = 0, cnt = 0;
    (typeof billAll !== 'undefined' ? billAll : []).filter(b => b.issued && !b.cancelled && String(b.date).slice(0, 4) === String(year)).forEach(b => {
        cnt++;
        const sub = (b.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0), t = invTotalOf(b), m = String(b.date).slice(0, 7);
        const e = by.get(m) || { rev: 0, cost: 0, costRev: 0 };
        e.rev += t;
        (b.items || []).forEach(it => { if (it.cost > 0) { const q = parseFloat(it.qty) || 0; e.cost += it.cost * q; e.costRev += q * (parseFloat(it.price) || 0) * (sub > 0 ? t / sub : 1); } else miss++; });
        by.set(m, e);
    });
    return { by, miss, cnt };
}
function lgSumData(year) {
    const from = year + '-01', to = year + '-12', d = lgStmtData(from, to, '', false), months = [];
    const sales = lgSalesByMonth(year);
    for (let k = 1; k <= 12; k++) {
        const m = year + '-' + lgPad(k), inM = e => lgMonthOfDate(e.date) === m;
        const rows = d.rows.filter(x => x.m === m), sm = sales.by.get(m);
        months.push({
            m, ord: d.sumOf(rows).net, recv: lgRecvs().filter(inM).reduce((s, e) => s + puNum(e.amount), 0),
            unrec: lgRets().filter(e => e.mode === 'unrec' && inM(e)).reduce((s, e) => s + puNum(e.amount), 0),
            xfer: lgXfers().filter(inM).reduce((s, e) => s + (e.dir === 'out' ? 1 : -1) * puNum(e.amount), 0),
            exp: lgExps().filter(inM).reduce((s, e) => s + puNum(e.amount), 0),
            bonus: puAll.filter(r => !r.cancelled && puMonthOf(r) === m).reduce((s, r) => s + (r.items || []).reduce((a, l) => a + puNum(l.bonusSale), 0), 0) + lgAll.filter(e => e.kind === 'bimp' && !e.del && String(e.date || '').slice(0, 7) === m).reduce((s, e) => s + puNum(e.sale), 0),
            disc: lgPays().filter(inM).reduce((s, e) => s + puNum(e.disc), 0), paid: lgPays().filter(inM).reduce((s, e) => s + puNum(e.gross), 0),
            profitB: sm ? sm.costRev - sm.cost : 0
        });
    }
    const T = k => months.reduce((s, x) => s + x[k], 0);
    return { months, T, sales };
}
function lgSumCalc(year, D) {
    const f = lgFin(), y = (f.byYear && f.byYear[year]) || {}, m = (f.margin >= 0 ? f.margin : 30) / 100;
    const prev = (f.byYear && f.byYear[year - 1]) || {};
    const opening = y.opening !== undefined && y.opening !== '' ? Number(y.opening) : (prev.closing !== undefined && prev.closing !== '' ? Number(prev.closing) : 0);
    const autoClosing = lgStockSaleValue(), closing = y.closing !== undefined && y.closing !== '' ? Number(y.closing) : autoClosing;
    const P = D.T('ord'), R = D.T('recv'), openCost = opening / (1 + m), closeCost = closing / (1 + m);
    let cogs = openCost + P - closeCost;
    if (y.incUnrec) cogs -= D.T('unrec');
    if (y.incXfer) cogs -= D.T('xfer');
    const disc = D.T('disc'); let profit = R - cogs; if (y.incDisc) profit += disc;
    return { y, m, opening, closing, autoClosing, P, R, openCost, closeCost, cogs, profit, pct: R > 0 ? profit / R : 0, growth: closeCost - openCost, growthPct: openCost > 0 ? (closeCost - openCost) / openCost : 0, disc };
}
function lgRenderSum(keepInputs) {
    if (!$b('lgsBody')) return;
    const year = parseInt($b('lgsYear').value) || new Date().getFullYear(), D = lgSumData(year), C = lgSumCalc(year, D), f = lgFin(), y = C.y;
    const sb = D.sales, profB = D.T('profitB'), revB = [...sb.by.values()].reduce((s, e) => s + e.rev, 0);
    const arrow = n => n > 0 ? '▲' : n < 0 ? '▼' : '■', col = n => n > 0 ? '#047857' : n < 0 ? '#b91c1c' : '#64748b';
    const inp = (id, label, val, ph, onch) => `<label class="pu-mfield"><span>${label}</span><input type="number" id="${id}" inputmode="decimal" value="${val === undefined || val === '' ? '' : val}" placeholder="${ph || ''}" onchange="${onch}"></label>`;
    const chk = (k, label) => `<label class="pu-chk"><input type="checkbox" ${y[k] ? 'checked' : ''} onchange="lgFinSaveField(${year},'${k}',this.checked)"><span>${label}</span></label>`;
    if (!keepInputs || !$b('lgsSet').innerHTML) $b('lgsSet').innerHTML = `<div class="lg-sethead">إعدادات حساب الربح لسنة ${year}</div><div class="lg-grid">${inp('lgsMargin', 'هامش الربح %', f.margin, '30', `lgFinSaveField(${year},'margin',parseFloat(this.value)||0)`)}${inp('lgsOpen', 'الرصيد السابق (بسعر البيع)', y.opening, C.opening ? String(Math.round(C.opening)) : '0', `lgFinSaveField(${year},'opening',this.value===''?'':parseFloat(this.value))`)}${inp('lgsClose', 'مبلغ الجرد الأخير (بسعر البيع)', y.closing, 'تلقائي: ' + fmtNum(Math.round(C.autoClosing)), `lgFinSaveField(${year},'closing',this.value===''?'':parseFloat(this.value))`)}</div>${chk('incDisc', 'احتساب خصومات التسديد كربح')}${chk('incUnrec', 'طرح المردود غير المقطوع من كلفة المباع')}${chk('incXfer', 'طرح المواد المرسلة للصيدليات الأخرى (الصافي) من كلفة المباع')}<small class="lg-note">اترك «مبلغ الجرد الأخير» فارغاً ليُحسب تلقائياً من المخزن الحالي (الكمية × سعر البيع). الرصيد السابق يؤخذ تلقائياً من جرد السنة السابقة إن كان محفوظاً.</small>`;
    const rowsM = D.months.map(x => `<tr><td>${lgMonthLabel(x.m)}</td><td>${fmtNum(x.ord)}</td><td>${fmtNum(x.recv)}</td><td>${x.unrec ? fmtNum(x.unrec) : ''}</td><td>${x.xfer ? fmtNum(x.xfer) : ''}</td><td>${x.exp ? fmtNum(x.exp) : ''}</td><td>${x.bonus ? fmtNum(x.bonus) : ''}</td></tr>`).join('');
    const verdict = C.R <= 0 && !C.P ? '' : `<div class="lg-verdict" style="border-color:${col(C.profit)};color:${col(C.profit)}">${C.profit > 0 ? '✅ الصيدلية رابحة' : C.profit < 0 ? '⚠️ الصيدلية خاسرة' : 'متعادلة'} — ${arrow(C.profit)} ${fmtNum(Math.abs(Math.round(C.profit)))} د.ع (${(C.pct * 100).toFixed(1)}% من المقبوض)</div>`;
    $b('lgsBody').innerHTML = lgLetterhead('الملخص المالي السنوي', String(year)) +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>الطلبيات الصافية</th><th>المقبوض</th><th>غير مقطوع</th><th>مرسل</th><th>تالف</th><th>بونص</th></tr></thead><tbody>${rowsM}</tbody><tfoot><tr><td>المجموع</td><td>${fmtNum(D.T('ord'))}</td><td>${fmtNum(D.T('recv'))}</td><td>${fmtNum(D.T('unrec'))}</td><td>${fmtNum(D.T('xfer'))}</td><td>${fmtNum(D.T('exp'))}</td><td>${fmtNum(D.T('bonus'))}</td></tr></tfoot></table></div><small class="lg-note">المقبوض = وصولات الحسابات • غير مقطوع = مردود لم يُخصم من كشف • مرسل = صافي المواد المرسلة لصيدليات أخرى • تالف = منتهي وتالف بسعر الشراء • بونص = بسعر البيع.</small>` +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th colspan="2">نتائج السنة — طريقة الجرد (معادلة الإكسل)</th></tr></thead><tbody>
            <tr><td>الرصيد السابق (بسعر البيع) ÷ (1 + ${(C.m * 100).toFixed(0)}%) = بالكلفة</td><td>${fmtNum(Math.round(C.openCost))}</td></tr>
            <tr><td>+ الطلبيات الصافية (المشتريات)</td><td>${fmtNum(C.P)}</td></tr>
            <tr><td>− مبلغ الجرد الأخير ÷ (1 + ${(C.m * 100).toFixed(0)}%) = بالكلفة</td><td>${fmtNum(Math.round(C.closeCost))}</td></tr>
            <tr><td><b>كلفة البضاعة المباعة</b>${y.incUnrec || y.incXfer ? ' (بعد التعديلات)' : ''}</td><td><b>${fmtNum(Math.round(C.cogs))}</b></td></tr>
            <tr><td>المقبوض من الحسابات (الإيراد)${y.incDisc ? ' + خصومات التسديد ' + fmtNum(C.disc) : ''}</td><td>${fmtNum(C.R + (y.incDisc ? C.disc : 0))}</td></tr>
            <tr><td><b>الربح</b></td><td style="color:${col(C.profit)}"><b>${fmtNum(Math.round(C.profit))}</b></td></tr>
            <tr><td>نسبة الربح</td><td>${(C.pct * 100).toFixed(2)}%</td></tr>
            <tr><td>مقدار النمو في المخزون (بالكلفة)</td><td style="color:${col(C.growth)}">${arrow(C.growth)} ${fmtNum(Math.round(C.growth))}</td></tr>
            <tr><td>نسبة النمو</td><td style="color:${col(C.growth)}">${(C.growthPct * 100).toFixed(1)}%</td></tr></tbody></table></div>` +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th colspan="2">الربح الفعلي من فواتير البيع المسجّلة في التطبيق</th></tr></thead><tbody>${sb.cnt ? `<tr><td>عدد الفواتير</td><td>${sb.cnt}</td></tr><tr><td>صافي المبيعات</td><td>${fmtNum(revB)}</td></tr><tr><td><b>الربح (سعر البيع − سعر الشراء وقت الإصدار)</b></td><td style="color:${col(profB)}"><b>${fmtNum(Math.round(profB))}</b></td></tr>${sb.miss ? `<tr><td colspan="2"><small>${sb.miss} سطر بلا سعر شراء لم يدخل في الربح.</small></td></tr>` : ''}` : '<tr><td colspan="2">لا توجد فواتير بيع صادرة في هذه السنة.</td></tr>'}</tbody></table></div>` + verdict;
}
function lgSumCsv() {
    const year = parseInt($b('lgsYear').value) || new Date().getFullYear(), D = lgSumData(year), C = lgSumCalc(year, D);
    const L = [['الشهر', 'الطلبيات الصافية', 'المقبوض من الحسابات', 'مردود غير مقطوع', 'مرسل لصيدلية أخرى', 'منتهي/تالف', 'بونص بسعر البيع', 'المسدَّد للمذاخر', 'خصم التسديد']];
    D.months.forEach(x => L.push([lgMonthLabel(x.m), x.ord, x.recv, x.unrec, x.xfer, x.exp, x.bonus, x.paid, x.disc]));
    L.push(['المجموع', D.T('ord'), D.T('recv'), D.T('unrec'), D.T('xfer'), D.T('exp'), D.T('bonus'), D.T('paid'), D.T('disc')]);
    L.push([]); L.push(['نتائج السنة — طريقة الجرد']); L.push(['الرصيد السابق بسعر البيع', C.opening]); L.push(['هامش الربح %', C.m * 100]); L.push(['الرصيد السابق بالكلفة', Math.round(C.openCost)]); L.push(['المشتريات', C.P]); L.push(['مبلغ الجرد الأخير بسعر البيع', C.closing]); L.push(['الجرد بالكلفة', Math.round(C.closeCost)]);
    L.push(['كلفة البضاعة المباعة', Math.round(C.cogs)]); L.push(['المقبوض من الحسابات', C.R]); L.push(['الربح', Math.round(C.profit)]); L.push(['نسبة الربح %', +(C.pct * 100).toFixed(2)]); L.push(['مقدار النمو', Math.round(C.growth)]); L.push(['نسبة النمو %', +(C.growthPct * 100).toFixed(1)]);
    L.push([]); L.push(['الربح الفعلي من فواتير البيع', Math.round(D.T('profitB'))]);
    lgCsvDownload('financial-summary-' + year + '.csv', L);
}
