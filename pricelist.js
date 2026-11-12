// قائمة التسعير: كل المواد مع طريقة التسعير وسعر الشراء وسعر البيع والتجزئة، مع تصفية بطريقة التسعير وغيرها
let plQ = '', plOpen = false, plAll = false;
const plSet = new Set();
const PL_METHODS = [['m:ministry', 'تسعيرة وزارة الصحة'], ['m:syndicate', 'كتاب النقابة'], ['m:percent', 'نسبة إضافة'], ['m:free', 'تسعير يدوي']];
const PL_OTHER = [['nocost', 'بلا سعر شراء'], ['noprice', 'بلا سعر بيع'], ['retail', 'تُباع بالتجزئة'], ['loss', 'سعر البيع أقل من الشراء']];
const plMethodOf = p => p.pricing === 'syndicate' ? 'syndicate' : p.pricing === 'percent' ? 'percent' : p.pricing === 'free' ? 'free' : 'ministry';
const plMethodName = k => (PL_METHODS.find(m => m[0] === 'm:' + k) || [0, ''])[1];
const plOwner = () => typeof userRole !== 'undefined' && userRole === 'owner';
function plEnsure() {
    const host = document.getElementById('plPane'); if (!host || document.getElementById('plSearch')) return;
    host.innerHTML = `<div class="pl-top"><div class="bill-search-wrap"><input type="search" id="plSearch" autocomplete="off" placeholder="🔍 ابحث عن مادة..." oninput="plQ=this.value;plAll=false;plRender()"></div><div id="plFilter"></div></div>
        <div class="pl-body" id="plList"></div>
        <div class="pl-foot"><span id="plCount"></span><button type="button" class="bill-tb-btn" onclick="plCsv()">⬇️ Excel</button></div>`;
}
// قائمة التسعير تبويب داخل شاشة سجل الأدوية (لا نافذة منبثقة)
function plShow() {
    const v = document.getElementById('catalogView');
    if (!v || getComputedStyle(v).display === 'none') { try { openCatalog(); } catch (e) { /* تجاهل */ } }
    plEnsure();
    const lp = document.querySelector('#catalogView .bill-scroll > .bill-panel:not(.pl-inline)'), pp = document.getElementById('plPane');
    if (lp) lp.style.display = 'none'; if (pp) pp.style.display = '';
    const tl = document.getElementById('catTabList'), tp = document.getElementById('catTabPrice'); if (tl) tl.classList.remove('on'); if (tp) tp.classList.add('on');
    const s = document.getElementById('plSearch'); if (s) s.value = plQ;
    plRender();
}
function plClose() {
    const lp = document.querySelector('#catalogView .bill-scroll > .bill-panel:not(.pl-inline)'), pp = document.getElementById('plPane');
    if (lp) lp.style.display = ''; if (pp) pp.style.display = 'none';
    const tl = document.getElementById('catTabList'), tp = document.getElementById('catTabPrice'); if (tl) tl.classList.add('on'); if (tp) tp.classList.remove('on');
}
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
const PL_MODES = [['manual', 'تسعيرة وزارة الصحة'], ['free', 'تسعير يدوي'], ['syndicate', 'كتاب النقابة'], ['percent', 'نسبة إضافة']];
const plModeOf = p => ['free', 'syndicate', 'percent'].includes(p.pricing) ? p.pricing : 'manual';
function plRow(p, owner) {
    const can_ = typeof can === 'function' && can('stockEdit'), id = p.id;
    const price = parseFloat(p.price) || 0, cost = parseFloat(p.costPrice) || 0, mode = plModeOf(p);
    if (!can_) {   // بلا صلاحية تعديل: عرض فقط
        const k = plMethodOf(p), profit = price > 0 && cost > 0 ? price - cost : null;
        let ret = '';
        if (hasRetail(p)) { const sp = Number(p.subPrice) || subPriceCalc(price, subCountOf(p)); ret = `<div class="pl-ret">تجزئة: ${fmtNum(subCountOf(p))} ${escapeHtml(subTypeOf(p) || 'جزء')} بالعبوة · سعر الجزء <b>${sp > 0 ? fmtNum(sp) : '—'}</b></div>`; }
        return `<div class="pl-row" id="plr-${id}"><div class="pl-head"><div class="pl-name" dir="ltr">${dispNameHtml(p)}</div></div><div class="pl-meth"><span class="pl-chip m-${k}">${plMethodName(k)}</span></div><div class="pl-nums">${owner ? `<div><small>الشراء</small><b>${cost > 0 ? fmtNum(cost) : '—'}</b></div>` : ''}<div><small>البيع</small><b>${price > 0 ? fmtNum(price) : 'غير مسعّر'}</b></div>${owner ? `<div><small>الربح</small><b>${profit === null ? '—' : fmtNum(profit)}</b></div>` : ''}</div>${ret}</div>`;
    }
    const ro = mode === 'syndicate' || mode === 'percent', sc = hasRetail(p) ? subCountOf(p) : 0, sp = hasRetail(p) ? (Number(p.subPrice) || subPriceCalc(price, sc)) : '';
    const types = subTypes.slice(); const curT = hasRetail(p) ? (subTypeOf(p) || '') : ''; if (curT && !types.includes(curT)) types.push(curT);
    const inp = (f, v, extra) => `<input type="number" inputmode="decimal" min="0" class="pl-in" data-f="${f}" value="${v === '' || v === 0 || v == null ? '' : v}" ${extra || ''} oninput="plLive(${id})" onchange="plSave(${id})" onfocus="this.select()">`;
    const profit = price > 0 && cost > 0 ? price - cost : null;
    return `<div class="pl-row pl-ed" id="plr-${id}"><div class="pl-head"><div class="pl-name" dir="ltr">${dispNameHtml(p)}</div><span class="pl-st" data-st></span></div>
        <div class="pl-grid">
            <label class="pl-f pl-w"><span>طريقة التسعير</span><select class="pl-in" data-f="mode" onchange="plLive(${id});plSave(${id})">${PL_MODES.map(m => `<option value="${m[0]}"${m[0] === mode ? ' selected' : ''}>${m[1]}</option>`).join('')}</select></label>
            ${owner ? `<label class="pl-f"><span>سعر الشراء</span>${inp('cost', cost)}</label>` : ''}
            <label class="pl-f"><span>سعر البيع</span>${inp('price', price, ro ? 'readonly' : '')}</label>
            <label class="pl-f" data-mkw style="${mode === 'percent' ? '' : 'display:none'}"><span>نسبة الإضافة ٪</span>${inp('mk', p.markupPct != null ? p.markupPct : '')}</label>
            ${owner ? `<div class="pl-f"><span>الربح</span><b class="pl-prof ${profit === null ? '' : profit < 0 ? 'bad' : 'good'}" data-prof>${profit === null ? '—' : fmtNum(profit)}</b></div>` : ''}
            <label class="pl-f"><span>عدد الأجزاء</span>${inp('sc', sc || '', 'step="1"')}</label>
            <label class="pl-f"><span>نوع الجزء</span><select class="pl-in" data-f="st" onchange="plSave(${id})"><option value=""></option>${types.map(t => `<option value="${escapeHtml(t)}"${t === curT ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select></label>
            <label class="pl-f"><span>سعر الجزء</span>${inp('sp', sp || '')}</label>
        </div></div>`;
}
const plRowEl = id => document.getElementById('plr-' + id);
const plVal = (el, f) => { const x = el.querySelector('[data-f="' + f + '"]'); return x ? x.value : ''; };
// حساب حيّ أثناء الكتابة: النقابة/النسبة تحسب سعر البيع تلقائياً
function plLive(id) {
    const el = plRowEl(id); if (!el) return;
    const mode = plVal(el, 'mode'), cost = parseFloat(plVal(el, 'cost')), mk = parseFloat(plVal(el, 'mk')), pr = el.querySelector('[data-f="price"]');
    el.querySelector('[data-mkw]').style.display = mode === 'percent' ? '' : 'none';
    pr.readOnly = mode === 'syndicate' || mode === 'percent';
    if (mode === 'syndicate') { const r = syndCalc(Number.isFinite(cost) ? cost : (parseFloat((products.find(x => x.id === id) || {}).costPrice) || 0)); if (r) pr.value = r.price; }
    else if (mode === 'percent') { const c = Number.isFinite(cost) ? cost : (parseFloat((products.find(x => x.id === id) || {}).costPrice) || 0); if (c > 0 && mk >= 0) pr.value = markupCalc(c, mk); }
    const pv = parseFloat(pr.value) || 0, c2 = Number.isFinite(cost) ? cost : (parseFloat((products.find(x => x.id === id) || {}).costPrice) || 0), pf = el.querySelector('[data-prof]');
    if (pf) { const d = pv > 0 && c2 > 0 ? pv - c2 : null; pf.textContent = d === null ? '—' : fmtNum(d); pf.className = 'pl-prof ' + (d === null ? '' : d < 0 ? 'bad' : 'good'); }
}
const plBusy = new Set();
async function plSave(id) {
    const el = plRowEl(id), p = products.find(x => x.id === id); if (!el || !p || plBusy.has(id)) return;
    if (typeof writesAllowed === 'function' && !writesAllowed()) { plRender(); return; }
    plLive(id);
    const owner = plOwner(), mode = plVal(el, 'mode'), price = parseFloat(plVal(el, 'price')) || 0;
    const cost = owner ? (parseFloat(plVal(el, 'cost')) || 0) : (parseFloat(p.costPrice) || 0), mk = parseFloat(plVal(el, 'mk'));
    const st = el.querySelector('[data-st]'), say = (t, c) => { if (st) { st.textContent = t; st.className = 'pl-st ' + (c || ''); } };
    if (mode === 'percent' && (!(cost > 0) || !(mk >= 0))) { say('أدخل سعر الشراء والنسبة', 'bad'); return; }
    if (mode === 'syndicate' && !(cost > 0)) { say('أدخل سعر الشراء', 'bad'); return; }
    const sc = parseInt(plVal(el, 'sc')) || 0, spIn = parseFloat(plVal(el, 'sp')), stype = plVal(el, 'st') || (subTypes[0] || 'جزء');
    // سعر الجزء: إن لم يُكتب يدوياً (أو كان محسوباً تلقائياً من السعر القديم) يُعاد حسابه من السعر الجديد
    const oldSc = hasRetail(p) ? subCountOf(p) : 0, oldAuto = oldSc > 1 && (!(Number(p.subPrice) > 0) || Number(p.subPrice) === subPriceCalc(p.price, oldSc));
    const retail = sc < 2 ? { subCount: 0, subType: '', subPrice: 0 } : { subCount: sc, subType: stype, subPrice: (spIn > 0 && !(oldAuto && sc === oldSc && price !== (parseFloat(p.price) || 0))) ? spIn : subPriceCalc(price, sc) };
    const old = JSON.parse(JSON.stringify(p));
    const same = (parseFloat(old.price) || 0) === price && (parseFloat(old.costPrice) || 0) === cost && plModeOf(old) === mode && (mode !== 'percent' || Number(old.markupPct) === mk) && (hasRetail(old) ? subCountOf(old) : 0) === (retail.subCount || 0) && (!retail.subCount || (subTypeOf(old) === retail.subType && (Number(old.subPrice) || subPriceCalc(old.price, subCountOf(old))) === retail.subPrice));
    if (same) { say('', ''); return; }
    plBusy.add(id); say('جارٍ الحفظ...', 'busy');
    Object.assign(p, { price, costPrice: cost, pricing: mode, markupPct: mode === 'percent' ? mk : null, ...retail });
    let ok = false;
    try { ok = await saveProductsDelta([{ p, dq: 0, dl: 0, cost: p.costPrice }]); } catch (e) { ok = false; }
    plBusy.delete(id);
    if (!ok) { Object.assign(p, old); const fresh = plRowEl(id); if (fresh) { fresh.outerHTML = plRow(p, plOwner()); } return; }
    try { const ch = diffProduct(old, p); if (ch.length) logAction('edit', p, ch); } catch (e) { /* تجاهل */ }
    try { renderAll(); } catch (e) { /* تجاهل */ }
    const el2 = plRowEl(id); if (el2) { const spx = el2.querySelector('[data-f="sp"]'); if (spx && hasRetail(p)) spx.value = Number(p.subPrice) || ''; const st2 = el2.querySelector('[data-st]'); if (st2) { st2.textContent = '✓ تم الحفظ'; st2.className = 'pl-st ok'; setTimeout(() => { if (st2.isConnected) st2.textContent = ''; }, 1800); } }
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
