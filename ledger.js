// =====================================================================
// السجلات المحاسبية للصيدلي: المردود للمذاخر، المردود غير المقطوع، إغلاق الأشهر، سجل الطلبيات الشهري/السنوي
// مجموعة Firestore واحدة: pharmacy_ledger (أحداث kind = ret | close ...). تعتمد على purchase.js و invoice.js و data.js
// =====================================================================
const LG_LS = { list: 'diwanLedgerLocal', days: 'diwanRetDays' };
const LG_REASONS = ['قريب الانتهاء', 'منتهي الصلاحية', 'تالف', 'مشكلة في التسعيرة', 'لا يطابق المطلوب', 'ملصق ممزق', 'خطأ في الطلبية', 'أخرى'];
let lgAll = [];
let lgWarned = false;
const lgPad = n => String(n).padStart(2, '0');
const lgNowMonth = () => todayLocalISO().slice(0, 7);
const lgMonthOfDate = d => String(d || '').slice(0, 7);
const lgMonthLabel = m => { const [y, mm] = String(m).split('-'); return mm + '/' + y; };
const lgId = () => 'lg' + Date.now() + Math.floor(Math.random() * 999);

// ---------- التخزين (محلي + سحابة) ----------
function lgLocal() { try { return JSON.parse(lsGet(LG_LS.list)) || []; } catch (e) { return []; } }
async function lgLoad() {
    const map = new Map();
    lgLocal().forEach(x => x && x.id && map.set(x.id, x));
    if (cloudReady() && navigator.onLine) {
        try {
            const snap = await db.collection('pharmacy_ledger').limit(3000).get();
            snap.forEach(d => { const x = d.data(); if (!x || !x.id) return; const c = map.get(x.id); if (!c || String(x.upd || '') >= String(c.upd || '')) map.set(x.id, x); });
        } catch (e) { /* القاعدة غير مضافة بعد */ }
    }
    lgAll = [...map.values()];
    lsSet(LG_LS.list, JSON.stringify(lgAll));
    return lgAll;
}
async function lgSave(ev) {
    ev.upd = new Date().toISOString();
    lgAll = lgAll.filter(x => x.id !== ev.id); lgAll.push(ev);
    lsSet(LG_LS.list, JSON.stringify(lgAll));
    if (cloudReady() && (navigator.onLine || persistenceOn)) {
        try { await fsSet(db.collection('pharmacy_ledger').doc(ev.id), JSON.parse(JSON.stringify(ev))); }
        catch (e) {
            lsSet('diwanNeedsPush', '1');
            if (!lgWarned) { lgWarned = true; Swal.fire({ icon: 'warning', title: 'حُفظ السجل على هذا الجهاز فقط', text: 'أضف قاعدة pharmacy_ledger إلى قواعد Firestore (للصيدلي فقط) ثم أعد المحاولة.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); }
        }
    } else lsSet('diwanNeedsPush', '1');
}
async function lgSyncLocal() {
    if (!cloudReady() || !navigator.onLine) return 0;
    const snap = await db.collection('pharmacy_ledger').limit(3000).get(); const have = new Map(); snap.forEach(d => have.set(d.id, d.data()));
    let n = 0;
    for (const e of lgLocal()) { const c = have.get(e.id); if (!c || String(e.upd || '') > String(c.upd || '')) { await fsSet(db.collection('pharmacy_ledger').doc(e.id), e); n++; } }
    return n;
}
const lgRets = () => lgAll.filter(e => e.kind === 'ret' && !e.del);
function lgLinkedRet(pid, mode) { return lgRets().filter(e => e.listId === pid && (mode === 'all' || e.mode === mode)).reduce((s, e) => s + puNum(e.amount), 0); }
function lgReturnedQty(pid, productId) { let n = 0; lgRets().filter(e => e.listId === pid).forEach(e => (e.items || []).forEach(l => { if (l.pid === productId) n += puNum(l.qty); })); return n; }
function lgClosedSet() { return new Set(lgAll.filter(e => e.kind === 'close' && !e.del).map(e => e.month)); }
function puMonthOf(r) {   // شهر القائمة: تاريخ القائمة، أو تاريخ الإدخال إن اختار الصيدلي ذلك
    if (r && r.useEntry) { const d = r.createdTs ? new Date(r.createdTs) : new Date(); return d.getFullYear() + '-' + lgPad(d.getMonth() + 1); }
    return String((r && r.date) || '').slice(0, 7);
}
async function lgGuardClosed(months) {
    const cl = lgClosedSet(), hit = [...new Set(months)].filter(m => cl.has(m));
    if (!hit.length) return true;
    const r = await Swal.fire({ icon: 'warning', title: 'الشهر مُغلق', text: 'شهر ' + hit.map(lgMonthLabel).join('، ') + ' مُغلق (أُرسل للحسابات). تعديله يغيّر ما أُرسل. هل تريد المتابعة؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'إلغاء' });
    return r.isConfirmed;
}
function lgDays() { const n = parseInt(lsGet(LG_LS.days)); return n >= 1 ? n : 30; }
function lgSaveDays(v) { const n = parseInt(v); if (n >= 1) { lsSet(LG_LS.days, String(n)); lgRenderRet('ret'); } }
const lgDaysSince = d => Math.max(Math.floor((Date.now() - new Date((d || todayLocalISO()) + 'T00:00:00').getTime()) / 864e5), 0);
const lgStatus = e => e.cnNo ? 'done' : 'pending';

// ---------- تبديل علامة «الكشف» ----------
async function lgToggleStmt(kind, id) {
    if (kind === 'inv') { const r = puAll.find(x => x.id === id); if (!r) return; r.stmt = !r.stmt; await puSaveRecord(r); }
    else { const e = lgAll.find(x => x.id === id); if (!e) return; e.stmt = !e.stmt; await lgSave(e); }
    puRefreshCurrent();
}

// =====================================================================
// سجل الطلبيات (شهري / سنوي)
// =====================================================================
function puMonthNow() { return lgNowMonth(); }
function puInitMonth(typeChanged) {
    if (!$b('puMonth').value) $b('puMonth').value = puMonthNow();
    if (!$b('puYear').value) $b('puYear').value = new Date().getFullYear();
    const isY = $b('puPType').value === 'year';
    $b('puMonthWrap').style.display = isY ? 'none' : ''; $b('puYearWrap').style.display = isY ? '' : 'none';
    if (typeChanged === true) $b('puDetail').checked = !isY;
    const sel = $b('puMonthSup'), cur = sel.value;
    sel.innerHTML = '<option value="">كل المذاخر</option>' + puSupplierNames().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    sel.value = cur; renderPuMonth();
}
function puStmtRange() {
    if ($b('puPType').value === 'year') { const y = String($b('puYear').value || new Date().getFullYear()); return { year: true, from: y + '-01', to: y + '-12', label: y, file: y }; }
    const m = $b('puMonth').value || puMonthNow();
    return { year: false, from: m, to: m, label: lgMonthLabel(m), file: m, month: m };
}
function lgStmtData(from, to, sup, group) {
    const inR = m => m >= from && m <= to, okSup = s => !sup || puKey(s) === puKey(sup), rets = lgRets(), rows = [];
    puAll.filter(r => !r.cancelled && inR(puMonthOf(r)) && okSup(r.supplier)).forEach(r => {
        const subs = rets.filter(e => e.listId === r.id && e.mode === 'net');
        const ret = puNum(r.returnAmt) + subs.reduce((s, e) => s + puNum(e.amount), 0), total = puTotalOf(r);
        rows.push({ t: 'inv', m: puMonthOf(r), date: r.date, ts: r.createdTs || '', sup: r.supplier, no: r.no, total, ret, net: total - ret, r, subs });
    });
    rets.filter(e => !e.listId && e.mode === 'net' && inR(lgMonthOfDate(e.date)) && okSup(e.supplier)).forEach(e => rows.push({ t: 'ret', m: lgMonthOfDate(e.date), date: e.date, ts: e.createdTs || '', sup: e.supplier, no: e.cnNo || '', total: 0, ret: puNum(e.amount), net: -puNum(e.amount), ev: e }));
    rets.filter(e => e.mode === 'unrec' && e.deductMonth && inR(e.deductMonth) && okSup(e.supplier)).forEach(e => rows.push({ t: 'ded', m: e.deductMonth, date: e.date, ts: e.createdTs || '', sup: e.supplier, no: e.cnNo || '', total: 0, ret: puNum(e.amount), net: -puNum(e.amount), ev: e }));
    rows.sort((a, b) => (group ? puKey(a.sup).localeCompare(puKey(b.sup), 'ar') : 0) || lgOrdCmp('stmt', x => x.r || x.ev)(a, b) || String(a.date).localeCompare(String(b.date)) || String(a.ts).localeCompare(String(b.ts)));
    const sum = list => ({ total: list.reduce((s, x) => s + x.total, 0), ret: list.reduce((s, x) => s + x.ret, 0), net: list.reduce((s, x) => s + x.net, 0), n: list.filter(x => x.t === 'inv').length });
    return { rows, sum: sum(rows), sumOf: sum };
}
function lgRowLabel(x) { return x.t === 'inv' ? '' : x.t === 'ret' ? 'مردود عام' + (x.ev.reason ? ' — ' + x.ev.reason : '') : 'اقتطاع مردود غير مقطوع' + (x.ev.listNo ? ' (قائمة ' + x.ev.listNo + ')' : ''); }
function lgStmtRowHtml(x, i, detail) {
    const ck = (kind, id, on) => `<td class="pu-ck" onclick="lgToggleStmt('${kind}','${id}')">${on ? '✓' : ''}</td>`;
    if (x.t === 'inv') {
        let h = `<tr>${lgSeqCell('stmt', i)}${ck('inv', x.r.id, x.r.stmt)}<td>${escapeHtml(x.sup)}</td><td dir="ltr">${escapeHtml(x.no)}</td><td>${escapeHtml(fmtDateDMY(x.date))}${x.r.useEntry ? ' <sup title="شهرها بتاريخ الإدخال">*</sup>' : ''}</td><td>${fmtNum(x.total)}</td><td>${x.ret ? fmtNum(x.ret) : ''}</td><td>${fmtNum(x.net)}</td></tr>`;
        if (detail) x.subs.forEach(e => { h += `<tr class="pu-sub"><td></td><td></td><td colspan="3">↩️ مردود: ${escapeHtml(e.reason || '')}${e.cnNo ? ' — فاتورة مردود ' + escapeHtml(e.cnNo) : ''}</td><td></td><td>${fmtNum(e.amount)}</td><td></td></tr>`; });
        return h;
    }
    return `<tr class="pu-adj">${lgSeqCell('stmt', i)}${ck('ev', x.ev.id, x.ev.stmt)}<td>${escapeHtml(x.sup)}</td><td colspan="2">${escapeHtml(lgRowLabel(x))}${x.no ? ' — ' + escapeHtml(x.no) : ''}</td><td></td><td>${fmtNum(x.ret)}</td><td>${fmtNum(x.net)}</td></tr>`;
}
function lgLetterhead(title, sub) {
    const meta = getInvMeta();
    return `<div class="bill-letterhead"><img src="icon.jpg" alt="" class="bill-logo"><div class="bill-ph"><div class="bill-ph-name">صيدلية الديوان</div><div class="bill-ph-line">${escapeHtml(meta.addr || '')}</div><div class="bill-ph-line">${meta.phone ? 'هاتف: ' + escapeHtml(meta.phone) : ''}</div></div><div class="bill-title-box"><div class="bill-title">${title}</div><div class="pu-mtitle">${sub}</div></div></div>`;
}
function renderPuMonth() {
    const rg = puStmtRange(), sup = $b('puMonthSup').value, detail = $b('puDetail').checked, group = $b('puGroup').checked;
    const d = lgStmtData(rg.from, rg.to, sup, group), s = d.sum;
    let body = '';
    if (rg.year) {
        const months = []; for (let k = 1; k <= 12; k++) months.push(rg.label + '-' + lgPad(k));
        body += `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>الشهر</th><th>عدد القوائم</th><th>المبلغ</th><th>المردود</th><th>الصافي</th><th>الحالة</th></tr></thead><tbody>` +
            months.map(m => { const l = d.rows.filter(x => x.m === m), t = d.sumOf(l); return `<tr><td>${lgMonthLabel(m)}</td><td>${t.n}</td><td>${fmtNum(t.total)}</td><td>${t.ret ? fmtNum(t.ret) : ''}</td><td>${fmtNum(t.net)}</td><td>${lgClosedSet().has(m) ? '🔒 مُغلق' : ''}</td></tr>`; }).join('') +
            `</tbody><tfoot><tr><td>المجموع السنوي</td><td>${s.n}</td><td>${fmtNum(s.total)}</td><td>${fmtNum(s.ret)}</td><td>${fmtNum(s.net)}</td><td></td></tr></tfoot></table></div>`;
        if (!sup) {
            const by = new Map(); d.rows.forEach(x => { const k = puKey(x.sup); if (!by.has(k)) by.set(k, { name: x.sup, rows: [] }); by.get(k).rows.push(x); });
            body += `<h4 class="rep-h">حسب المذخر</h4><div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th>المذخر</th><th>عدد القوائم</th><th>المبلغ</th><th>المردود</th><th>الصافي</th></tr></thead><tbody>` +
                [...by.values()].sort((a, b) => d.sumOf(b.rows).net - d.sumOf(a.rows).net).map(g => { const t = d.sumOf(g.rows); return `<tr><td>${escapeHtml(g.name)}</td><td>${t.n}</td><td>${fmtNum(t.total)}</td><td>${t.ret ? fmtNum(t.ret) : ''}</td><td>${fmtNum(t.net)}</td></tr>`; }).join('') + '</tbody></table></div>';
        }
    }
    if (!rg.year || detail) {
        let i = 0, lastSup = null, rowsHtml = '';
        lgSeqSet('stmt', d.rows.map(x => x.t === 'inv' ? { kind: 'pu', id: x.r.id } : { kind: 'lg', id: x.ev.id }));
        d.rows.forEach(x => {
            if (group && lastSup !== puKey(x.sup)) { lastSup = puKey(x.sup); const t = d.sumOf(d.rows.filter(y => puKey(y.sup) === lastSup)); rowsHtml += `<tr class="pu-grp"><td colspan="5">${escapeHtml(x.sup)}</td><td>${fmtNum(t.total)}</td><td>${t.ret ? fmtNum(t.ret) : ''}</td><td>${fmtNum(t.net)}</td></tr>`; }
            rowsHtml += lgStmtRowHtml(x, ++i, detail);
        });
        if (rg.year) body += '<h4 class="rep-h">تفصيل القوائم</h4>';
        body += `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th class="pu-ckh" title="استلام الكشف">✓</th><th>المذخر</th><th>القائمة</th><th>التاريخ</th><th>المبلغ</th><th>المردود</th><th>الصافي</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="8">لا توجد قوائم في هذه الفترة.</td></tr>'}</tbody>` +
            (d.rows.length ? `<tfoot><tr><td colspan="5">المجموع</td><td>${fmtNum(s.total)}</td><td>${fmtNum(s.ret)}</td><td>${fmtNum(s.net)}</td></tr></tfoot>` : '') + '</table></div>';
    }
    $b('puMonthSheet').innerHTML = lgLetterhead(rg.year ? 'سجل الطلبيات السنوي' : 'سجل الطلبيات الشهري', escapeHtml(rg.label) + (sup ? ' — ' + escapeHtml(sup) : '')) + body +
        `<div class="bill-bottom"><div class="bill-totals"><div class="bill-trow bill-grand"><span>${rg.year ? 'المجموع السنوي' : 'التوتل الشهري'}</span><b>${fmtNum(s.net)} د.ع</b></div></div></div>` +
        `<div class="bill-words">${s.net > 0 ? 'المبلغ كتابةً: ' + escapeHtml(numberToArabicWords(s.net)) + ' دينار عراقي فقط لا غير' : ''}</div>`;
    lgRenderCloseBar(rg, sup);
}
function lgRenderCloseBar(rg, sup) {
    const bar = $b('puCloseBar'); if (!bar) return;
    if (rg.year) { bar.innerHTML = ''; return; }
    const closed = lgClosedSet().has(rg.month);
    const unrec = lgRets().filter(e => e.mode === 'unrec' && ((e.listId && (puAll.find(r => r.id === e.listId) ? puMonthOf(puAll.find(r => r.id === e.listId)) : lgMonthOfDate(e.date)) === rg.month) || (!e.listId && lgMonthOfDate(e.date) === rg.month))).reduce((s, e) => s + puNum(e.amount), 0);
    bar.innerHTML = `<div class="lg-close ${closed ? 'is-closed' : ''}"><span>${closed ? '🔒 هذا الشهر مُغلق (أُرسل للحسابات)' : '🔓 هذا الشهر مفتوح'}</span><button type="button" class="bill-tb-btn" onclick="lgToggleClose('${rg.month}')">${closed ? 'إعادة فتح الشهر' : '🔒 إغلاق الشهر بعد الإرسال'}</button>${unrec > 0 ? `<small>مردود غير مقطوع يخص هذا الشهر: <b>${fmtNum(unrec)}</b> (لا يدخل في الكشف)</small>` : ''}</div>`;
}
async function lgToggleClose(m) {
    const closed = lgClosedSet().has(m);
    const r = await Swal.fire({ icon: 'question', title: closed ? 'إعادة فتح شهر ' + lgMonthLabel(m) + '؟' : 'إغلاق شهر ' + lgMonthLabel(m) + '؟', text: closed ? 'سيعود الشهر قابلاً للتعديل دون تنبيه.' : 'بعد الإغلاق، أي مردود جديد على قوائم هذا الشهر يذهب تلقائياً إلى «غير المقطوع» ولا يغيّر الكشف المُرسل.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: closed ? 'إعادة فتح' : 'إغلاق', cancelButtonText: 'إلغاء' });
    if (!r.isConfirmed) return;
    await lgSave({ id: 'close-' + m, kind: 'close', month: m, date: todayLocalISO(), del: closed, createdTs: new Date().toISOString() });
    renderPuMonth();
}
function lgCsvDownload(name, lines) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    downloadFile(name, '﻿' + lines.map(l => l.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function puMonthCsv() {
    const rg = puStmtRange(), sup = $b('puMonthSup').value, d = lgStmtData(rg.from, rg.to, sup, $b('puGroup').checked), s = d.sum;
    const L = [['الكشف', 'المذخر', 'رقم القائمة', 'التاريخ', 'المبلغ', 'المردود', 'الصافي', 'ملاحظة']];
    d.rows.forEach(x => {
        L.push([x.t === 'inv' ? (x.r.stmt ? '✓' : '') : (x.ev.stmt ? '✓' : ''), x.sup, x.t === 'inv' ? x.no : lgRowLabel(x), x.date, x.total, x.ret, x.net, x.t === 'inv' ? (x.r.useEntry ? 'الشهر بتاريخ الإدخال' : '') : (x.no ? 'فاتورة مردود ' + x.no : '')]);
        if (x.t === 'inv') x.subs.forEach(e => L.push(['', '', '↩️ ' + (e.reason || 'مردود'), e.date, '', e.amount, '', e.cnNo ? 'فاتورة مردود ' + e.cnNo : '']));
    });
    L.push(['المجموع', '', '', '', s.total, s.ret, s.net, '']);
    if (rg.year) {
        L.push([]); L.push(['الشهر', 'عدد القوائم', 'المبلغ', 'المردود', 'الصافي']);
        for (let k = 1; k <= 12; k++) { const m = rg.label + '-' + lgPad(k), t = d.sumOf(d.rows.filter(x => x.m === m)); L.push([lgMonthLabel(m), t.n, t.total, t.ret, t.net]); }
        L.push(['المجموع السنوي', s.n, s.total, s.ret, s.net]);
    }
    lgCsvDownload('orders-' + rg.file + (sup ? '-' + sup : '') + '.csv', L);
}

// =====================================================================
// سجل المردود + المردود غير المقطوع
// =====================================================================
function lgFillSupSelect(id) { const sel = $b(id); if (!sel) return; const cur = sel.value; sel.innerHTML = '<option value="">كل المذاخر</option>' + puSupplierNames().map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join(''); sel.value = cur; }
function lgInitRet(kind) {
    lgFillSupSelect('lg' + kind + '-sup');
    if (kind === 'ret' && $b('lgret-days')) $b('lgret-days').value = lgDays();
    lgRenderRet(kind);
}
function lgRetFiltered(kind) {
    const sup = $b('lg' + kind + '-sup').value;
    let arr = lgRets().filter(e => (kind === 'unrec' ? e.mode === 'unrec' : true) && (!sup || puKey(e.supplier) === puKey(sup)));
    if (kind === 'ret') {
        const st = $b('lgret-st').value, m = $b('lgret-m').value;
        if (st === 'pending') arr = arr.filter(e => lgStatus(e) === 'pending'); else if (st === 'done') arr = arr.filter(e => lgStatus(e) === 'done'); else if (st === 'nostmt') arr = arr.filter(e => !e.stmt);
        if (m) arr = arr.filter(e => lgMonthOfDate(e.date) === m);
    } else {
        const y = $b('lgunrec-y').value; if (y) arr = arr.filter(e => String(e.date).slice(0, 4) === String(y));
    }
    return arr.sort((a, b) => lgOrdCmp(kind, e => e)(a, b) || String(b.date).localeCompare(String(a.date)) || String(b.createdTs).localeCompare(String(a.createdTs)));
}
function lgRetChips(e) {
    const th = lgDays(), age = lgDaysSince(e.date);
    return (lgStatus(e) === 'done' ? `<em class="tg">فاتورة مردود ${escapeHtml(e.cnNo)}</em>` : `<em class="tg ${age > th ? 'bad' : 'warn'}">بانتظار فاتورة المردود · ${age} يوم</em>`) +
        (e.mode === 'unrec' ? `<em class="tg warn">${e.deductMonth ? 'سيُقتطع في ' + lgMonthLabel(e.deductMonth) : 'غير مقطوع'}</em>` : '') + (e.stmt ? '<em class="tg">✓ كشف</em>' : '');
}
function lgRenderRet(kind) {
    if (!$b('lg' + kind + '-list')) return;
    const arr = lgRetFiltered(kind), total = arr.reduce((s, e) => s + puNum(e.amount), 0);
    lgSeqSet(kind, arr.map(e => ({ kind: 'lg', id: e.id })));
    if (kind === 'ret') {
        const pend = arr.filter(e => lgStatus(e) === 'pending'), late = pend.filter(e => lgDaysSince(e.date) > lgDays());
        $b('lgret-sum').innerHTML = `<span>مجموع المردود</span><b>${fmtNum(total)} د.ع</b><small>${arr.length} مردود • بانتظار فاتورة: ${pend.length}${late.length ? ' • <u style="color:#b91c1c">متأخر: ' + late.length + '</u>' : ''}</small>`;
    } else {
        const open = arr.filter(e => !e.deductMonth), ded = arr.filter(e => e.deductMonth);
        $b('lgunrec-sum').innerHTML = `<span>مجموع المردود غير المقطوع</span><b>${fmtNum(total)} د.ع</b><small>متراكم: ${fmtNum(open.reduce((s, e) => s + puNum(e.amount), 0))} • مُحدَّد اقتطاعه: ${fmtNum(ded.reduce((s, e) => s + puNum(e.amount), 0))}</small>`;
    }
    $b('lg' + kind + '-list').innerHTML = arr.map(e => `<div class="bill-card"><div class="bill-card-main" onclick="lgRetOpen('${e.id}')"><b>${escapeHtml(e.supplier)}</b> ${lgRetChips(e)}<small>${escapeHtml(fmtDateDMY(e.date))} • ${e.listNo ? 'قائمة ' + escapeHtml(e.listNo) : 'مردود عام'}${e.reason ? ' • ' + escapeHtml(e.reason) : ''}${(e.items || []).length ? ' • ' + e.items.length + ' مادة' : ''}</small></div><div class="bill-card-amt">${fmtNum(e.amount)}<small>د.ع</small></div></div>`).join('') || `<div class="bill-none">${kind === 'unrec' ? 'لا يوجد مردود غير مقطوع.' : 'لا يوجد مردود مسجّل بعد.'}</div>`;
    $b('lg' + kind + '-sheet').innerHTML = lgLetterhead(kind === 'unrec' ? 'المردود غير المقطوع' : 'سجل المردود إلى المذاخر', escapeHtml($b('lg' + kind + '-sup').value || 'كل المذاخر')) +
        `<div class="pu-tw"><table class="bill-table pu-mtable"><thead><tr><th class="pu-n">#</th><th class="pu-ckh">الكشف</th><th>التاريخ</th><th>المذخر</th><th>قائمة الشراء</th><th>السبب</th><th>فاتورة المردود</th><th>المبلغ</th></tr></thead><tbody>` +
        arr.map((e, i) => `<tr>${lgSeqCell(kind, i + 1)}<td class="pu-ck">${e.stmt ? '✓' : ''}</td><td>${escapeHtml(fmtDateDMY(e.date))}</td><td>${escapeHtml(e.supplier)}</td><td dir="ltr">${escapeHtml(e.listNo || 'عام')}</td><td>${escapeHtml(e.reason || '')}</td><td dir="ltr">${e.cnNo ? escapeHtml(e.cnNo) + (e.cnDate ? ' / ' + escapeHtml(fmtDateDMY(e.cnDate)) : '') : '—'}</td><td>${fmtNum(e.amount)}</td></tr>`).join('') +
        `</tbody>${arr.length ? `<tfoot><tr><td colspan="7">المجموع</td><td>${fmtNum(total)}</td></tr></tfoot>` : ''}</table></div>`;
    lgTabBadge();
}
function lgRetCsv(kind) {
    const arr = lgRetFiltered(kind), L = [['الكشف', 'التاريخ', 'المذخر', 'قائمة الشراء', 'السبب', 'المواد', 'رقم فاتورة المردود', 'تاريخ فاتورة المردود', 'نوع الاحتساب', 'شهر الاقتطاع', 'المبلغ']];
    arr.forEach(e => L.push([e.stmt ? '✓' : '', e.date, e.supplier, e.listNo || 'عام', e.reason || '', (e.items || []).map(l => l.name + ' ×' + l.qty).join(' | '), e.cnNo || '', e.cnDate || '', e.mode === 'unrec' ? 'غير مقطوع' : 'يخصم من الكشف', e.deductMonth || '', e.amount]));
    L.push(['المجموع', '', '', '', '', '', '', '', '', '', arr.reduce((s, e) => s + puNum(e.amount), 0)]);
    lgCsvDownload((kind === 'unrec' ? 'unrecovered-returns-' : 'returns-') + todayLocalISO() + '.csv', L);
}
function lgLinkedHtml(pid) {
    const arr = lgRets().filter(e => e.listId === pid);
    if (!arr.length) return '';
    return '<div class="pu-d-pays"><b>مردود مرتبط بهذه القائمة:</b>' + arr.map(e => `<div>${escapeHtml(fmtDateDMY(e.date))} — ${fmtNum(e.amount)} د.ع${e.reason ? ' — ' + escapeHtml(e.reason) : ''}${e.mode === 'unrec' ? ' <em class="tg warn">غير مقطوع</em>' : ''}${e.cnNo ? ' — فاتورة مردود ' + escapeHtml(e.cnNo) : ' — <span style="color:#b45309">بانتظار فاتورة مردود</span>'}</div>`).join('') + '</div>';
}
function lgRetOpen(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const btn = (label, fn, cls) => `<button type="button" class="bill-tb-btn ${cls || ''}" onclick="Swal.close();${fn}">${label}</button>`;
    const rows = (e.items || []).map(l => `<tr><td dir="ltr">${escapeHtml(l.name)}</td><td>${fmtNum(l.qty)}</td><td>${fmtNum(l.cost)}</td><td>${fmtNum(puNum(l.qty) * puNum(l.cost))}</td></tr>`).join('');
    Swal.fire({
        title: escapeHtml(e.supplier) + ' — ' + fmtNum(e.amount) + ' د.ع', showConfirmButton: false, showCloseButton: true, width: 620,
        html: `<div class="pu-detail"><div class="pu-d-meta">${escapeHtml(fmtDateDMY(e.date))} • ${e.listNo ? 'قائمة ' + escapeHtml(e.listNo) : 'مردود عام'}${e.reason ? ' • ' + escapeHtml(e.reason) : ''}</div>
            ${rows ? `<div class="pu-d-scroll"><table class="bill-table"><thead><tr><th>المادة</th><th>العدد</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
            <div class="pu-d-pays">${lgRetChips(e)}${e.cnDate ? `<div>تاريخ فاتورة المردود: ${escapeHtml(fmtDateDMY(e.cnDate))}</div>` : ''}${e.note ? `<div><b>ملاحظات:</b> ${escapeHtml(e.note)}</div>` : ''}</div>
            <div class="pu-d-btns">${btn(e.cnNo ? '🧾 تعديل فاتورة المردود' : '🧾 تسجيل فاتورة المردود', `lgSetCn('${e.id}')`, 'bill-pay')}${btn(e.stmt ? '☑ إلغاء علامة الكشف' : '✓ استلمت الكشف', `lgToggleStmt('ev','${e.id}')`)}${e.mode === 'unrec' ? btn(e.deductMonth ? '📅 تغيير شهر الاقتطاع' : '📅 اقتطاع في شهر…', `lgSetDeduct('${e.id}')`) : ''}${btn('✏️ تعديل', `lgEditRet('${e.id}')`)}${btn('🗑️ حذف', `lgDelRet('${e.id}')`, 'bill-danger')}</div></div>`
    });
}
async function lgSetCn(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ title: 'فاتورة مردود المذخر', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<input id="swCnNo" class="swal2-input" dir="ltr" placeholder="رقم فاتورة المردود" value="${escapeHtml(e.cnNo || '')}"><input id="swCnDate" type="date" class="swal2-input" value="${escapeHtml(e.cnDate || todayLocalISO())}"><small>اترك الرقم فارغاً لإرجاع الحالة إلى «بانتظار فاتورة المردود».</small>`,
        preConfirm: () => ({ no: document.getElementById('swCnNo').value.trim(), date: document.getElementById('swCnDate').value }) });
    if (!r.isConfirmed || !r.value) return;
    e.cnNo = r.value.no; e.cnDate = r.value.no ? r.value.date : '';
    await lgSave(e); lgRenderRet('ret'); lgRenderRet('unrec');
}
async function lgSetDeduct(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const r = await Swal.fire({ title: 'شهر اقتطاع المردود غير المقطوع', showCancelButton: true, showDenyButton: !!e.deductMonth, denyButtonText: 'إلغاء الاقتطاع', confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إغلاق',
        html: `<div style="margin-bottom:6px">المبلغ: <b>${fmtNum(e.amount)}</b> د.ع</div><input id="swDedM" type="month" class="swal2-input" value="${escapeHtml(e.deductMonth || lgNowMonth())}"><small>يظهر هذا المبلغ مطروحاً في سجل الطلبيات لهذا الشهر. اتركه بلا شهر ليتراكم لحسابات نهاية السنة.</small>`,
        preConfirm: () => document.getElementById('swDedM').value });
    if (r.isDenied) e.deductMonth = ''; else if (r.isConfirmed && r.value) e.deductMonth = r.value; else return;
    await lgSave(e); lgRenderRet('ret'); lgRenderRet('unrec');
}
async function lgEditRet(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const hasItems = (e.items || []).length > 0;
    const r = await Swal.fire({ title: 'تعديل المردود', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'حفظ', cancelButtonText: 'إلغاء',
        html: `<div style="text-align:right;display:grid;gap:6px"><label>التاريخ<input id="swRDate" type="date" class="swal2-input" value="${escapeHtml(e.date)}"></label>
            <label>السبب<select id="swRReason" class="swal2-input">${LG_REASONS.map(x => `<option ${x === e.reason ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            <label>المبلغ${hasItems ? ' (من المواد، غير قابل للتعديل)' : ''}<input id="swRAmt" type="number" class="swal2-input" value="${e.amount}" ${hasItems ? 'disabled' : ''}></label>
            <label>الاحتساب<select id="swRMode" class="swal2-input"><option value="net" ${e.mode !== 'unrec' ? 'selected' : ''}>يُخصم من كشف الشهر</option><option value="unrec" ${e.mode === 'unrec' ? 'selected' : ''}>مردود غير مقطوع</option></select></label>
            <label>ملاحظات<input id="swRNote" class="swal2-input" value="${escapeHtml(e.note || '')}"></label>
            ${hasItems ? '<small>لتعديل المواد احذف المردود وسجّله من جديد.</small>' : ''}</div>`,
        preConfirm: () => ({ date: document.getElementById('swRDate').value, reason: document.getElementById('swRReason').value, amount: parseFloat(document.getElementById('swRAmt').value), mode: document.getElementById('swRMode').value, note: document.getElementById('swRNote').value.trim() }) });
    if (!r.isConfirmed || !r.value) return;
    const v = r.value;
    if (!hasItems && !(v.amount > 0)) return Swal.fire({ icon: 'warning', title: 'أدخل مبلغاً صحيحاً', confirmButtonColor: '#0f1c38' });
    e.date = v.date || e.date; e.reason = v.reason; e.note = v.note; if (!hasItems) e.amount = v.amount; e.mode = v.mode; if (v.mode !== 'unrec') e.deductMonth = '';
    await lgSave(e); puRefreshCurrent(); lgTabBadge();
}
async function lgDelRet(id) {
    const e = lgAll.find(x => x.id === id); if (!e) return;
    const hasStock = !!e.stockOut && (e.items || []).length;
    const r = await Swal.fire({ icon: 'warning', title: 'حذف المردود؟', text: 'سيُحذف من السجلات ويعود المبلغ إلى القائمة.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء', input: hasStock ? 'checkbox' : undefined, inputValue: 1, inputPlaceholder: 'إعادة الكميات إلى المخزن' });
    if (!r.isConfirmed) return;
    if (hasStock && r.value) {
        if (!writesAllowed()) return;
        const snaps = new Map(), touched = [];
        e.items.forEach(l => { const p = products.find(x => x.id === l.pid); if (!p) return; if (!snaps.has(p.id)) snaps.set(p.id, { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase }); p.qty = (parseInt(p.qty) || 0) + puNum(l.qty); touched.push(p); });
        if (touched.length && !(await saveProductsDelta([...new Set(touched)].map(p => deltaFromSnap(p, snaps.get(p.id)))))) { touched.forEach(p => { p.qty = snaps.get(p.id).qty; }); return; }
        renderAll();
    }
    e.del = true; await lgSave(e); puRefreshCurrent(); lgTabBadge();
}

// =====================================================================
// نافذة تسجيل مردود (إرجاع مواد إلى المذخر)
// =====================================================================
let lgr = null;
function lgrEnsure() {
    if ($b('lgRet')) return;
    const d = document.createElement('div'); d.id = 'lgRet'; d.className = 'lg-ov'; d.style.display = 'none';
    d.innerHTML = `<div class="lg-card" dir="rtl">
        <div class="lg-h"><b>↩️ إرجاع إلى المذخر</b><button type="button" onclick="lgrClose()" aria-label="إغلاق">✕</button></div>
        <div class="lg-body">
            <div class="lg-grid">
                <label><span>المذخر</span><input id="lgrSup" list="puSupList" autocomplete="off" placeholder="اسم المذخر" oninput="lgrSupChanged()"></label>
                <label><span>تاريخ الإرجاع</span><input type="date" id="lgrDate" onchange="lgrAutoMode()"></label>
                <label class="lg-wide"><span>قائمة الشراء</span><select id="lgrList" onchange="lgrListChanged()"></select></label>
            </div>
            <div id="lgrLines"></div>
            <div class="bill-search-wrap"><input type="search" id="lgrSearch" autocomplete="off" placeholder="🔍 أضف مادة أخرى من المخزن..." oninput="lgrSearchInput()"><div class="bill-results" id="lgrResults" style="display:none"></div></div>
            <div class="lg-grid">
                <label><span>السبب</span><select id="lgrReason"></select></label>
                <label><span>المبلغ الكلي (د.ع)</span><input type="number" id="lgrAmount" min="0" inputmode="decimal" oninput="lgrRecalc()"></label>
                <label class="lg-wide"><span>ملاحظات</span><input id="lgrNote"></label>
                <label><span>رقم فاتورة المردود (إن وُجدت)</span><input id="lgrCn" dir="ltr"></label>
                <label><span>تاريخها</span><input type="date" id="lgrCnDate"></label>
                <label class="lg-wide"><span>طريقة الاحتساب</span><select id="lgrMode" onchange="lgr.modeAuto=false;lgrHint()"><option value="net">يُخصم من كشف شهر القائمة</option><option value="unrec">مردود غير مقطوع (يتراكم)</option></select></label>
            </div>
            <div class="lg-hint" id="lgrHint"></div>
            <label class="pu-chk"><input type="checkbox" id="lgrDeduct" checked><span>إنقاص الكميات من المخزن</span></label>
            <label class="pu-chk"><input type="checkbox" id="lgrStmt"><span>✓ استلمتُ الكشف</span></label>
        </div>
        <div class="lg-f"><span id="lgrTotal"></span><button type="button" class="bill-tb-btn bill-tb-primary" onclick="lgrSave()">💾 حفظ المردود</button></div>
    </div>`;
    document.body.appendChild(d);
    $b('lgrReason').innerHTML = LG_REASONS.map(x => `<option>${x}</option>`).join('');
}
function lgrClose() { const m = $b('lgRet'); if (m) m.style.display = 'none'; lgr = null; }
function lgOpenReturn(opts) {
    opts = opts || {};
    lgrEnsure();
    lgr = { listId: opts.listId || '', lines: [], modeAuto: true };
    const r = lgr.listId ? puAll.find(x => x.id === lgr.listId) : null;
    $b('lgrSup').value = r ? r.supplier : (opts.supplier || '');
    $b('lgrDate').value = todayLocalISO(); $b('lgrAmount').value = ''; $b('lgrNote').value = ''; $b('lgrCn').value = ''; $b('lgrCnDate').value = '';
    $b('lgrReason').selectedIndex = 0; $b('lgrDeduct').checked = true; $b('lgrStmt').checked = false; $b('lgrSearch').value = ''; $b('lgrResults').style.display = 'none'; $b('lgrMode').value = 'net';
    lgrFillLists(lgr.listId);
    if (r) lgrLoadListLines(r);
    if (opts.pid) { const pp = products.find(x => x.id === opts.pid); if (pp) lgr.lines.push({ pid: pp.id, name: pp.name, qty: 1, cost: pp.costPrice || 0, max: parseInt(pp.qty) || 0, fromList: false }); }
    lgrRender(); lgrAutoMode();
    $b('lgRet').style.display = 'flex';
    if (typeof Swal !== 'undefined' && Swal.close) Swal.close();
}
function lgrFillLists(sel) {
    const sup = $b('lgrSup').value.trim(), arr = sup ? puAll.filter(r => !r.cancelled && puKey(r.supplier) === puKey(sup)).sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
    $b('lgrList').innerHTML = '<option value="">بدون قائمة — مردود عام للمذخر</option>' + arr.map(r => `<option value="${r.id}">${escapeHtml(r.no)} — ${escapeHtml(fmtDateDMY(r.date))} — ${fmtNum(puTotalOf(r))}</option>`).join('');
    $b('lgrList').value = sel && arr.some(r => r.id === sel) ? sel : '';
    lgr.listId = $b('lgrList').value;
}
function lgrLoadListLines(r) {
    lgr.lines = lgr.lines.filter(l => !l.fromList);
    const add = (r.items || []).map(l => ({ pid: l.pid, name: l.name, qty: 0, cost: l.cost, max: Math.max(puNum(l.qty) - lgReturnedQty(r.id, l.pid), 0), fromList: true }));
    lgr.lines = add.concat(lgr.lines);
}
function lgrSupChanged() { lgrFillLists(''); lgr.lines = lgr.lines.filter(l => !l.fromList); lgrRender(); lgrAutoMode(); }
function lgrListChanged() {
    lgr.listId = $b('lgrList').value;
    const r = lgr.listId ? puAll.find(x => x.id === lgr.listId) : null;
    if (r) lgrLoadListLines(r); else lgr.lines = lgr.lines.filter(l => !l.fromList);
    lgrRender(); lgrAutoMode();
}
function lgrAutoMode() {
    if (!lgr) return;
    const r = lgr.listId ? puAll.find(x => x.id === lgr.listId) : null, m = r ? puMonthOf(r) : lgMonthOfDate($b('lgrDate').value);
    lgr.refMonth = m; lgr.closed = lgClosedSet().has(m);
    if (lgr.modeAuto) $b('lgrMode').value = lgr.closed ? 'unrec' : 'net';
    lgrHint();
}
function lgrHint() {
    if (!lgr) return;
    const unrec = $b('lgrMode').value === 'unrec';
    $b('lgrHint').innerHTML = lgr.closed ? `🔒 شهر ${lgMonthLabel(lgr.refMonth)} مُغلق، لذلك يُسجَّل تلقائياً «غير مقطوع» ولا يغيّر الكشف المُرسل.` : unrec ? 'سيُسجَّل في «غير المقطوع» ولن يُخصم من أي كشف.' : `سيُطرح من كشف شهر ${lgMonthLabel(lgr.refMonth || lgNowMonth())}.`;
}
function lgrRender() {
    const box = $b('lgrLines');
    box.innerHTML = lgr.lines.length ? `<div class="lg-lines">${lgr.lines.map((l, i) => `<div class="lg-line"><div class="lg-ln"><b dir="ltr">${escapeHtml(l.name)}</b>${l.fromList ? `<small>المتاح للإرجاع من القائمة: ${fmtNum(l.max)}</small>` : '<small>من المخزن</small>'}</div>
        <input type="number" min="0" ${l.fromList ? 'max="' + l.max + '"' : ''} inputmode="numeric" placeholder="العدد" value="${l.qty || ''}" oninput="lgr.lines[${i}].qty=parseInt(this.value)||0;lgrRecalc()">
        <input type="number" min="0" inputmode="decimal" placeholder="السعر" value="${l.cost || ''}" oninput="lgr.lines[${i}].cost=parseFloat(this.value)||0;lgrRecalc()">
        ${l.fromList ? '' : `<button type="button" class="pu-x" onclick="lgr.lines.splice(${i},1);lgrRender()" aria-label="حذف">✕</button>`}</div>`).join('')}</div>` : '<div class="bill-none">اختر قائمة شراء لإظهار موادها، أو ابحث عن مادة لإضافتها.</div>';
    lgrRecalc();
}
const lgrAuto = () => lgr.lines.filter(l => l.qty > 0).reduce((s, l) => s + l.qty * (l.cost || 0), 0);
function lgrRecalc() { if (!lgr) return; const a = lgrAuto(); $b('lgrAmount').placeholder = a ? String(a) : '0'; $b('lgrTotal').innerHTML = 'مجموع المواد: <b>' + fmtNum(a) + '</b>'; }
function lgrSearchInput() {
    const qn = normSearch($b('lgrSearch').value), box = $b('lgrResults');
    if (!qn) { box.style.display = 'none'; return; }
    const toks = qn.split(' '), found = products.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    box.innerHTML = found.map(p => productPickHtml(p, 'lgrAddProd', 'بالمخزن ' + stockLabel(p) + (p.costPrice ? ' · شراء ' + fmtNum(p.costPrice) : ''))).join('') || '<div class="bill-noresult">لا توجد نتائج</div>';
    box.style.display = 'block';
}
function lgrAddProd(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    const ex = lgr.lines.find(l => l.pid === id);
    if (ex) ex.qty = (ex.qty || 0) + 1; else lgr.lines.push({ pid: id, name: p.name, qty: 1, cost: p.costPrice || 0, max: parseInt(p.qty) || 0, fromList: false });
    $b('lgrSearch').value = ''; $b('lgrResults').style.display = 'none'; lgrRender();
}
async function lgrSave() {
    if (!lgr) return;
    const sup = $b('lgrSup').value.trim(), date = $b('lgrDate').value || todayLocalISO(), lines = lgr.lines.filter(l => l.qty > 0);
    const amt = parseFloat($b('lgrAmount').value) > 0 ? parseFloat($b('lgrAmount').value) : lgrAuto();
    const warn = t => Swal.fire({ icon: 'warning', title: t, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    if (!sup) return warn('اكتب اسم المذخر');
    if (!(amt > 0)) return warn('أدخل مواداً بأسعارها أو اكتب المبلغ الكلي');
    const list = lgr.listId ? puAll.find(x => x.id === lgr.listId) : null;
    if (list) { const over = lines.find(l => l.fromList && l.qty > l.max); if (over) return warn('الكمية أكبر من المتاح للإرجاع في «' + over.name + '»'); }
    const deduct = $b('lgrDeduct').checked && lines.length > 0;
    if (deduct) {
        if (!writesAllowed()) return;
        const short = lines.filter(l => { const p = products.find(x => x.id === l.pid); return p && l.qty > (parseInt(p.qty) || 0); });
        if (short.length) { const r = await Swal.fire({ icon: 'question', title: 'الكمية أكبر من الموجود في المخزن', text: short.map(l => l.name).join('، ') + ' — سيصبح رصيدها صفراً. متابعة؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'متابعة', cancelButtonText: 'رجوع' }); if (!r.isConfirmed) return; }
        const snaps = new Map(), touched = [];
        lines.forEach(l => { const p = products.find(x => x.id === l.pid); if (!p) return; if (!snaps.has(p.id)) snaps.set(p.id, { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: p.expiryDates, expiryDate: p.expiryDate, lastPurchase: p.lastPurchase }); p.qty = Math.max((parseInt(p.qty) || 0) - l.qty, 0); touched.push(p); });
        if (touched.length && !(await saveProductsDelta([...new Set(touched)].map(p => deltaFromSnap(p, snaps.get(p.id)))))) { touched.forEach(p => { p.qty = snaps.get(p.id).qty; }); renderAll(); return; }
        lines.forEach(l => { const p = products.find(x => x.id === l.pid); const o = snaps.get(l.pid); if (p && o) logAction('qty', p, [{ f: 'الكمية (مردود إلى ' + sup + ')', from: String(o.qty), to: String(p.qty) }]); });
        renderAll();
    }
    const ev = { id: lgId(), kind: 'ret', date, supplier: sup, listId: list ? list.id : '', listNo: list ? list.no : '', items: lines.map(l => ({ pid: l.pid, name: l.name, qty: l.qty, cost: l.cost || 0 })), amount: amt, reason: $b('lgrReason').value, note: $b('lgrNote').value.trim(), mode: $b('lgrMode').value, cnNo: $b('lgrCn').value.trim(), cnDate: $b('lgrCn').value.trim() ? ($b('lgrCnDate').value || date) : '', stmt: $b('lgrStmt').checked, stockOut: deduct, deductMonth: '', createdTs: new Date().toISOString() };
    await lgSave(ev);
    await puUpsertSupplier(sup);
    lgrClose();
    Swal.fire({ icon: 'success', title: 'سُجّل المردود' + (ev.mode === 'unrec' ? ' (غير مقطوع)' : ''), toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    puRefreshCurrent(); lgTabBadge();
}
