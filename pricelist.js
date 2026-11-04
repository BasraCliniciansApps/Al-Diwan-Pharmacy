// قائمة التسعير: كل المواد مع طريقة التسعير وسعر الشراء وسعر البيع والتجزئة، مع تصفية بطريقة التسعير وغيرها
let plQ = '', plOpen = false, plAll = false;
const plSet = new Set();
const PL_METHODS = [['m:ministry', 'تسعيرة وزارة الصحة'], ['m:syndicate', 'كتاب النقابة'], ['m:percent', 'نسبة إضافة'], ['m:free', 'تسعير يدوي']];
const PL_OTHER = [['nocost', 'بلا سعر شراء'], ['noprice', 'بلا سعر بيع'], ['retail', 'تُباع بالتجزئة'], ['loss', 'سعر البيع أقل من الشراء']];
const plMethodOf = p => p.pricing === 'syndicate' ? 'syndicate' : p.pricing === 'percent' ? 'percent' : p.pricing === 'free' ? 'free' : 'ministry';
const plMethodName = k => (PL_METHODS.find(m => m[0] === 'm:' + k) || [0, ''])[1];
const plOwner = () => typeof userRole !== 'undefined' && userRole === 'owner';
function plEnsure() {
    if (document.getElementById('plOv')) return;
    const d = document.createElement('div'); d.id = 'plOv'; d.className = 'lg-ov'; d.style.display = 'none';
    d.innerHTML = `<div class="lg-card pl-card" dir="rtl"><div class="lg-h"><b>💲 قائمة التسعير</b><button type="button" onclick="plClose()" aria-label="إغلاق">✕</button></div>
        <div class="pl-top"><div class="bill-search-wrap"><input type="search" id="plSearch" autocomplete="off" placeholder="🔍 ابحث عن مادة..." oninput="plQ=this.value;plAll=false;plRender()"></div><div id="plFilter"></div></div>
        <div class="lg-body pl-body" id="plList"></div>
        <div class="lg-f"><span id="plCount"></span><button type="button" class="bill-tb-btn" onclick="plCsv()">⬇️ Excel</button></div></div>`;
    document.body.appendChild(d);
}
function plShow() { plEnsure(); document.getElementById('plSearch').value = plQ; document.getElementById('plOv').style.display = 'flex'; plRender(); }
function plClose() { const m = document.getElementById('plOv'); if (m) m.style.display = 'none'; }
function plToggle(k) { if (plSet.has(k)) plSet.delete(k); else plSet.add(k); plAll = false; plRender(); }
function plClear() { plSet.clear(); plAll = false; plRender(); }
function plData() {
    const act = products.filter(p => !p.arch), qn = normSearch(plQ), toks = qn.split(' '), owner = plOwner();
    const ms = PL_METHODS.map(m => m[0]).filter(k => plSet.has(k)), others = PL_OTHER.map(o => o[0]).filter(k => plSet.has(k));
    const cnt = {};
    const flags = p => ({ 'nocost': !(parseFloat(p.costPrice) > 0), 'noprice': !(parseFloat(p.price) > 0), 'retail': hasRetail(p), 'loss': (parseFloat(p.price) > 0) && (parseFloat(p.costPrice) > 0) && parseFloat(p.price) < parseFloat(p.costPrice) });
    act.forEach(p => { const f = flags(p); cnt['m:' + plMethodOf(p)] = (cnt['m:' + plMethodOf(p)] || 0) + 1; Object.keys(f).forEach(k => { if (f[k]) cnt[k] = (cnt[k] || 0) + 1; }); });
    let arr = act.filter(p => {
        if (qn && searchScore(p, qn, toks) <= 0) return false;
        if (ms.length && !ms.includes('m:' + plMethodOf(p))) return false;
        const f = flags(p); return others.every(k => f[k]);
    });
    arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en'));
    return { act, arr, cnt, owner };
}
function plRow(p, owner) {
    const price = parseFloat(p.price) || 0, cost = parseFloat(p.costPrice) || 0, k = plMethodOf(p);
    let formula = '';
    if (k === 'syndicate') { const r = syndCalc(cost); if (r) formula = ' · +' + r.pct + '٪'; }
    else if (k === 'percent') formula = ' · +' + (Number(p.markupPct) || 0) + '٪';
    const profit = price > 0 && cost > 0 ? price - cost : null;
    let ret = '';
    if (hasRetail(p)) { const sp = Number(p.subPrice) || subPriceCalc(price, subCountOf(p)); ret = `<div class="pl-ret">تجزئة: ${fmtNum(subCountOf(p))} ${escapeHtml(subTypeOf(p) || 'جزء')} بالعبوة · سعر الجزء <b>${sp > 0 ? fmtNum(sp) : '—'}</b></div>`; }
    const can_ = typeof can === 'function' && can('stockEdit');
    return `<div class="pl-row${can_ ? ' pl-ed' : ''}"${can_ ? ` onclick="plEdit(${p.id})"` : ''}><div class="pl-head"><div class="pl-name" dir="ltr">${dispNameHtml(p)}</div>${can_ ? '<span class="pl-pen" aria-hidden="true">✏️</span>' : ''}</div>
        <div class="pl-meth"><span class="pl-chip m-${k}">${plMethodName(k)}</span>${formula}</div>
        <div class="pl-nums">${owner ? `<div><small>الشراء</small><b class="${cost > 0 ? '' : 'bad'}">${cost > 0 ? fmtNum(cost) : '—'}</b></div>` : ''}<div><small>البيع</small><b class="${price > 0 ? '' : 'bad'}">${price > 0 ? fmtNum(price) : 'غير مسعّر'}</b></div>${owner ? `<div><small>الربح</small><b class="${profit === null ? '' : profit < 0 ? 'bad' : 'good'}">${profit === null ? '—' : fmtNum(profit)}</b></div>` : ''}</div>${ret}</div>`;
}
// التعديل بنفس نافذة «تسعير وتعديل سريع» في سجل الأدوية: يُحفظ بنفس مسار الحفظ فينتقل السعر وطريقة التسعير والتجزئة لكل أجزاء التطبيق
async function plEdit(id) {
    try { await catPrice(id); } finally { plRender(); }
}
function plRender() {
    if (!document.getElementById('plList')) return;
    const { act, arr, cnt, owner } = plData();
    const rowsF = (list) => list.filter(o => owner || (o[0] !== 'nocost' && o[0] !== 'loss')).map(o => `<button type="button" class="cat-frow ${plSet.has(o[0]) ? 'on' : ''}" onclick="plToggle('${o[0]}')" aria-pressed="${plSet.has(o[0])}"><u>${plSet.has(o[0]) ? '✓' : ''}</u><b>${o[1]}</b><em>${fmtNum(cnt[o[0]] || 0)}</em></button>`).join('');
    const on = [...plSet].map(k => (PL_METHODS.concat(PL_OTHER).find(x => x[0] === k) || [0, ''])[1]).filter(Boolean), lab = on.length ? on[0] + (on.length > 1 ? ' +' + (on.length - 1) : '') : 'الكل';
    document.getElementById('plFilter').innerHTML = `<div class="cat-fwrap"><div class="cat-fline"><button type="button" class="cat-fbtn ${on.length ? 'has' : ''}" onclick="plOpen=!plOpen;plRender()" aria-expanded="${plOpen}"><b>تصفية</b><em>${lab}</em><i>${plOpen ? '▴' : '▾'}</i></button></div>`
        + (plOpen ? `<div class="cat-fpanel"><div class="pl-fh">طريقة التسعير</div>${rowsF(PL_METHODS)}<div class="pl-fh">حالة الأسعار</div>${rowsF(PL_OTHER)}<div class="cat-ffoot"><button type="button" onclick="plClear()" ${on.length ? '' : 'disabled'}>مسح الكل</button><button type="button" class="ok" onclick="plOpen=false;plRender()">تم</button></div></div>` : '') + '</div>';
    const SHOW = plAll ? arr.length : 150, part = arr.slice(0, SHOW);
    document.getElementById('plList').innerHTML = part.map(p => plRow(p, owner)).join('') + (arr.length > SHOW ? `<button type="button" class="bill-tb-btn pl-more" onclick="plAll=true;plRender()">عرض الباقي (${fmtNum(arr.length - SHOW)})</button>` : '') || '<div class="bill-none">لا توجد مواد مطابقة.</div>';
    document.getElementById('plCount').textContent = fmtNum(arr.length) + ' مادة من ' + fmtNum(act.length);
}
function plCsv() {
    const { arr, owner } = plData();
    const H = ['المادة', 'الشركة', 'طريقة التسعير'].concat(owner ? ['سعر الشراء'] : [], ['سعر البيع'], owner ? ['الربح'] : [], ['تجزئة: عدد الأجزاء', 'نوع الجزء', 'سعر الجزء']);
    const rows = arr.map(p => {
        const price = parseFloat(p.price) || 0, cost = parseFloat(p.costPrice) || 0, r = hasRetail(p);
        return [dispName(p), p.brand || '', plMethodName(plMethodOf(p))].concat(owner ? [cost || ''] : [], [price || ''], owner ? [price > 0 && cost > 0 ? price - cost : ''] : [], [r ? subCountOf(p) : '', r ? (subTypeOf(p) || '') : '', r ? (Number(p.subPrice) || subPriceCalc(price, subCountOf(p)) || '') : '']);
    });
    downloadFile('diwan-pricelist-' + todayStamp() + '.csv', '﻿' + [H, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
