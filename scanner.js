// ============================================================================
// 🔎 فاحص المادة: مسح باركود أو بحث ← سعر البيع، سعر الشراء (أقل/أعلى)، الهامش، تواريخ الانتهاء (مع حذفها)، حاسبة الخصم.
// حد الخصم للبائعين: «محمي» (هامش أمان + تقريب، لا يكشف الكلفة) أو «كامل» (أعلى خصم بدون خسارة). يُخزَّن مع المادة (dlim) بدون سعر الشراء.
// ============================================================================
const SC_LS = 'diwanScan';
const SC_DEF = { on: true, mode: 'safe', margin: 5, step: 5, show: { price: true, cost: true, margin: true, expiry: true, del: true, calc: true, limit: true } };
function scCfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(SC_LS)) || {}; } catch (e) { c = {}; } return { ...SC_DEF, ...c, show: { ...SC_DEF.show, ...(c.show || {}) } }; }
let scPushT = null, scPend = false;
function scPending() { return scPend; }
function scSave(c) {
    try { localStorage.setItem(SC_LS, JSON.stringify(c)); } catch (e) { /* تجاهل */ }
    clearTimeout(scPushT); scPend = true;
    scPushT = setTimeout(() => {
        scPend = false;
        try { if (typeof isFirebaseReady === 'undefined' || !isFirebaseReady || !currentUser || !navigator.onLine) return; fsSet(db.collection('pharmacy').doc('metadata'), { scan: scCfg() }, { mergeFields: ['scan'] }).catch(() => { }); } catch (e) { /* تجاهل */ }
    }, 1500);
    scApplyHome();
}
function scExport() { return scCfg(); }
function scImport(o) { if (!o || typeof o !== 'object' || scPend) return; try { localStorage.setItem(SC_LS, JSON.stringify(o)); } catch (e) { /* تجاهل */ } scApplyHome(); }
function scApplyHome() { document.body.classList.toggle('sc-off', !scCfg().on); }
// ---- حد الخصم ----
function scExact(p) { const pr = Number(p.price) || 0, c = Number(p.costPrice) || 0; return pr > 0 && c > 0 ? Math.max(0, (pr - c) / pr * 100) : null; }
function scLimitFor(p) {   // القيمة التي تُخزَّن مع المادة للبائعين (undefined = لا تتغير)
    const ex = scExact(p); if (ex === null) return undefined;
    const c = scCfg();
    if (c.mode === 'exact') return Math.floor(ex * 10) / 10;
    const st = Math.max(1, Number(c.step) || 5);
    return Math.max(0, Math.floor((ex - (Number(c.margin) || 0)) / st) * st);
}
async function scRecalcAll() {
    if (userRole !== 'owner') return;
    const list = []; products.forEach(p => { const v = scLimitFor(p); if (v !== undefined && p.dlim !== v) { p.dlim = v; list.push(p); } });
    if (!list.length) { Swal.fire({ icon: 'info', title: 'كل الحدود محدّثة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 }); return; }
    const h = Prog.start('إعادة حساب حد الخصم', { text: fmtNum(list.length) + ' مادة...' });
    const ok = await saveProductsBatch(list);
    if (ok) h.ok('تم تحديث ' + fmtNum(list.length) + ' مادة'); else h.fail('تعذر الحفظ');
}
// ---- سجلات الشراء للمالك ----
function scBuyLines(p) {
    const src = (typeof puAll !== 'undefined' && puAll && puAll.length) ? puAll : (typeof puLocalList === 'function' ? puLocalList() : []), out = [];
    src.filter(r => r && !r.cancelled).forEach(r => (r.items || []).forEach(l => { if ((l.pid === p.id || (!l.pid && puKey(l.name) === puKey(p.name))) && puNum(l.cost) > 0 && puNum(l.qty) > 0) out.push({ r, l, c: puNum(l.cost) }); }));
    return out.sort((a, b) => String(b.r.date).localeCompare(String(a.r.date)));
}
// ---- الشاشة ----
let scCur = null;
const scE = id => document.getElementById(id);
function scInit() { scApplyHome(); const q = scE('scQ'); if (q) { q.value = ''; } scList([]); scCur = null; scE('scCard').innerHTML = '<div class="sc-hint">امسح باركود المادة أو ابحث باسمها 👆</div>'; }
function scScan() { openBarcodeScanner(code => { const p = findByBarcode(code); if (p) { scPick(p.id); } else Swal.fire({ icon: 'info', title: 'لم يتم العثور على المادة', text: 'هذا الباركود غير مسجّل بأي مادة.', confirmButtonColor: '#0f1c38' }); }); }
function scSearch(v) {
    const qn = normSearch(v || ''), qt = qn ? qn.split(' ') : [];
    if (!qn) { scList([]); return; }
    const res = products.map(p => ({ p, s: searchScore(p, qn, qt) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map(x => x.p);
    scList(res);
    if (/^\d{6,}$/.test(String(v).trim())) { const p = findByBarcode(v.trim()); if (p) scPick(p.id); }
}
function scList(arr) { const b = scE('scRes'); if (!b) return; b.innerHTML = arr.map(p => `<button type="button" class="sc-res" onclick="scPick(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand || '')}</small><span>${fmtNum(p.price || 0)}</span></button>`).join(''); }
function scPick(id) { scCur = id; scList([]); const q = scE('scQ'); if (q) q.value = ''; scRender(); const b = document.querySelector('#scanView .sc-ovb'); if (b) b.scrollTop = 0; }
const scFmtD = ym => { const [y, m] = String(ym).split('-'); return m ? m + '/' + y : ym; };
function scRender() {
    const box = scE('scCard'), p = products.find(x => x.id === scCur); if (!box || !p) return;
    const cfg = scCfg(), sh = cfg.show, own = userRole === 'owner', price = Number(p.price) || 0;
    let h = `<div class="sc-head">${p.img ? `<img src="${escapeHtml(p.img)}" alt="" onerror="this.style.display='none'">` : '<span class="sc-noimg">💊</span>'}<div><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml([p.brand, fixMetaOrder(p.meta || '')].filter(Boolean).join(' · '))}</small><small>بالمخزن: ${escapeHtml(stockLabel(p))}</small></div></div>`;
    if (sh.price) h += `<div class="sc-sec sc-price"><span>سعر البيع</span><b>${price > 0 ? fmtNum(price) + ' د.ع' : '— غير مسعّرة'}</b>${hasRetail(p) ? `<small>سعر <bdi>${escapeHtml(subTypeOf(p))}</bdi>: <bdi>${fmtNum(subPriceOf(p))} د.ع</bdi></small>` : ''}</div>`;
    let refCost = Number(p.costPrice) || 0;
    if (own && sh.cost) {
        const L = scBuyLines(p);
        if (L.length || refCost > 0) {
            const cs = L.map(x => x.c), lo = L.length ? L.reduce((a, b) => b.c < a.c ? b : a) : null, hi = L.length ? L.reduce((a, b) => b.c > a.c ? b : a) : null, last = L[0];
            if (!refCost && last) refCost = last.c;
            h += `<div class="sc-sec"><h4>سعر الشراء</h4><div class="sc-grid3">
                <div><small>أقل سعر</small><b>${lo ? fmtNum(lo.c) : '—'}</b>${lo ? `<small>${escapeHtml(lo.r.supplier)} · ${escapeHtml(fmtDateDMY(lo.r.date))}</small>` : ''}</div>
                <div><small>أعلى سعر</small><b>${hi ? fmtNum(hi.c) : '—'}</b>${hi ? `<small>${escapeHtml(hi.r.supplier)} · ${escapeHtml(fmtDateDMY(hi.r.date))}</small>` : ''}</div>
                <div><small>آخر سعر</small><b>${last ? fmtNum(last.c) : fmtNum(refCost)}</b>${last ? `<small>${escapeHtml(last.r.supplier)} · ${escapeHtml(fmtDateDMY(last.r.date))}</small>` : '<small>من بطاقة المادة</small>'}</div></div>`;
            if (sh.margin && price > 0 && refCost > 0) {
                const pf = price - refCost, mp = pf / price * 100, worst = hi ? price - hi.c : null;
                h += `<div class="sc-mrg ${pf < 0 ? 'bad' : ''}">الربح على آخر سعر شراء: <b>${fmtNum(pf)} د.ع (${mp.toFixed(1)}٪)</b>${worst !== null && hi.c !== refCost ? `<br><small>على أعلى سعر شراء: ${fmtNum(worst)} د.ع (${(worst / price * 100).toFixed(1)}٪)</small>` : ''}</div>`;
            }
            h += '</div>';
        } else h += '<div class="sc-sec"><h4>سعر الشراء</h4><small class="sc-mut">لا يوجد سعر شراء مسجّل لهذه المادة.</small></div>';
    }
    if (sh.expiry) {
        const ex = getProductExpiryDates(p), canDel = sh.del && can('stockEdit') && (own || can('scanDel'));
        h += `<div class="sc-sec"><h4>تواريخ الانتهاء</h4>${ex.length ? `<div class="sc-exps">${ex.map(e => { const st = getExpiryStatus(e); const lv = st ? st.level : 'ok'; return `<span class="sc-exp ${lv}"><b dir="ltr">${scFmtD(e)}</b><small>${st ? (lv === 'expired' ? 'منتهي' : lv === '3m' ? 'أقل من 3 أشهر' : 'أقل من 6 أشهر') : 'بعيد'}</small>${canDel ? `<button type="button" aria-label="حذف" onclick="scDelExp(${p.id},'${e}')">✕</button>` : ''}</span>`; }).join('')}</div>` : '<small class="sc-mut">لا توجد تواريخ مسجّلة.</small>'}</div>`;
    }
    const lim = (p.dlim !== undefined && p.dlim !== null && p.dlim !== '') ? Number(p.dlim) : null, ownLim = own ? scLimitFor(p) : undefined;
    const showLim = lim !== null || ownLim !== undefined;
    if (sh.calc && can('scanDisc') && price > 0) {
        const eff = own && ownLim !== undefined ? ownLim : lim;
        h += `<div class="sc-sec sc-calc"><h4>حاسبة الخصم</h4>${sh.limit ? `<div class="sc-lim">${eff !== null && eff !== undefined ? `${own ? 'حد البائعين' : 'أعلى خصم' + (cfg.mode === 'safe' ? ' آمن' : ' بدون خسارة')}: <b>${eff}٪</b>${own && scExact(p) !== null ? ` <small>(بدون خسارة فعلياً ${scExact(p).toFixed(1)}٪)</small>` : ''}` : 'حد الخصم غير محسوب لهذه المادة'}</div>` : ''}
            <div class="sc-row"><label><span>نسبة الخصم %</span><input id="scD" type="number" min="0" step="any" inputmode="decimal" oninput="scCalc('d')"></label><label><span>السعر بعد الخصم</span><input id="scP" type="number" min="0" inputmode="numeric" oninput="scCalc('p')"></label></div>
            <div class="sc-chips">${[5, 10, 15, 20].map(n => `<button type="button" onclick="scSetD(${n})">${n}٪</button>`).join('')}${eff ? `<button type="button" class="mx" onclick="scSetD(${eff})">أقصى خصم ${eff}٪</button>` : ''}</div><div id="scOut" class="sc-out"></div></div>`;
    } else if (sh.limit && showLim && can('scanDisc')) h += `<div class="sc-sec"><div class="sc-lim">أعلى خصم: <b>${lim}٪</b></div></div>`;
    box.innerHTML = h;
}
function scSetD(n) { const d = scE('scD'); if (d) { d.value = n; scCalc('d'); } }
function scCalc(from) {
    const p = products.find(x => x.id === scCur); if (!p) return; const price = Number(p.price) || 0, out = scE('scOut'), D = scE('scD'), P = scE('scP'); if (!out || !(price > 0)) return;
    let d, fin;
    if (from === 'd') { d = parseFloat(D.value); if (!(d >= 0)) { out.innerHTML = ''; P.value = ''; return; } fin = price * (1 - d / 100); P.value = Math.round(fin); }
    else { fin = parseFloat(P.value); if (!(fin >= 0)) { out.innerHTML = ''; D.value = ''; return; } d = (price - fin) / price * 100; D.value = Math.round(d * 10) / 10; }
    const own = userRole === 'owner', cfg = scCfg();
    let cls = 'ok', msg = '', det = '';
    if (own) {
        const L = scBuyLines(p), cost = Number(p.costPrice) || (L[0] ? L[0].c : 0), lim = scLimitFor(p);
        if (cost > 0) {
            const pf = fin - cost, pp = fin > 0 ? pf / fin * 100 : -100;
            if (pf < 0) { cls = 'bad'; msg = '🔴 خسارة'; } else if (pp < (Number(cfg.margin) || 0)) { cls = 'mid'; msg = '🟡 هامش ضعيف'; } else { cls = 'ok'; msg = '🟢 رابح'; }
            det = `ربحك بعد الخصم: <b>${fmtNum(pf)} د.ع (${pp.toFixed(1)}٪)</b>`;
        } else { cls = 'mid'; msg = '⚪ لا توجد كلفة'; }
        if (lim !== undefined && d > lim) det += `<br><small>أعلى من حد البائعين (${lim}٪)</small>`;
    } else {
        const lim = (p.dlim !== undefined && p.dlim !== null && p.dlim !== '') ? Number(p.dlim) : null;
        if (lim === null) { cls = 'mid'; msg = '⚪ حد الخصم غير محسوب'; }
        else if (lim <= 0) { cls = 'bad'; msg = '🔴 لا يسمح بخصم'; }
        else if (d <= lim + 1e-9) { cls = 'ok'; msg = '🟢 آمن'; }
        else { cls = 'bad'; msg = cfg.mode === 'safe' ? '🔴 يتجاوز الحد الآمن' : '🔴 خسارة'; }
    }
    out.className = 'sc-out ' + cls;
    out.innerHTML = `<b>${msg}</b><span>خصم ${(Math.round(d * 10) / 10)}٪ ← ${fmtNum(Math.round(fin))} د.ع</span>${det ? `<div>${det}</div>` : ''}`;
}
async function scDelExp(pid, ym) {
    const p = products.find(x => x.id === pid); if (!p || !can('stockEdit') || !(userRole === 'owner' || can('scanDel'))) return;
    const r = await Swal.fire({ title: 'حذف تاريخ النفاذ؟', icon: 'warning', showCancelButton: true, confirmButtonText: 'نعم، احذفه', cancelButtonText: 'رجوع', confirmButtonColor: '#b91c1c',
        html: `<div class="sw-form" style="text-align:center"><div class="sw-info" dir="ltr"><b>${escapeHtml(p.name)}</b></div><div>تاريخ <b dir="ltr">${scFmtD(ym)}</b></div><small>يُحذف من المادة ومن المخزن (للعبوات المنتهية أو المباعة).</small></div>` });
    if (!r.isConfirmed) return;
    const snap = { qty: p.qty, loose: p.loose, costPrice: p.costPrice, expiryDates: (p.expiryDates || []).slice(), expiryDate: p.expiryDate, lastPurchase: p.lastPurchase };
    const left = getProductExpiryDates(p).filter(e => e !== ym); p.expiryDates = left; p.expiryDate = left[0] || '';
    const ok = await saveProductsDelta([deltaFromSnap(p, snap)]);
    if (ok) { logAction('expdel', p, [{ f: 'حذف تاريخ نفاذ', from: scFmtD(ym), to: '—' }]); scRender(); Swal.fire({ icon: 'success', title: 'تم حذف التاريخ', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 }); }
    else { Object.assign(p, snap); scRender(); }
}
// ---- صفحة الإعدادات ----
const SC_SHOW_LABELS = { price: ['سعر البيع', 'يظهر لكل من يملك الأداة'], cost: ['سعر الشراء (أقل/أعلى/آخر سعر)', 'للمالك فقط — لا يصل إلى البائعين'], margin: ['الربح والهامش', 'للمالك فقط'], expiry: ['تواريخ الانتهاء', 'مع حالة كل تاريخ'], del: ['زر حذف تاريخ الانتهاء', 'للصيدلي، وللمستخدم إذا مُنح صلاحية الحذف'], calc: ['حاسبة الخصم', 'نسبة أو سعر نهائي مع إشارة آمن/خطر'], limit: ['حد الخصم (أعلى خصم)', 'الرقم الأقصى المسموح'] };
function shScanHtml() {
    const c = scCfg(), s = c.show;
    const opt = (k, ic, t, d) => `<button type="button" class="sc-opt ${c.mode === k ? 'on' : ''}" onclick="scSetMode('${k}')"><span>${ic}</span><span><b>${t}</b><small>${d}</small></span></button>`;
    return `<small style="display:block;color:var(--text-sub);margin:0 0 8px">إعدادات فاحص المادة تتزامن بين أجهزتك. صلاحية كل مستخدم (تشغيل الأداة، حد الخصم، حذف التواريخ) من إدارة المستخدمين.</small>
    <div class="qk-row"><div><b>تشغيل فاحص المادة</b><small>إيقافه يخفي الأداة من الرئيسية للجميع</small></div><label class="setup-sw"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="scSetOn(this.checked)"><i></i></label></div>
    <h5 class="sc-h">طريقة حد الخصم للبائعين</h5>
    ${opt('safe', '🔒', 'الخصم المحمي', 'يعرض للبائع حدّاً آمناً أقل من الحد الحقيقي، ولا يكشف سعر الشراء')}
    ${opt('exact', '📊', 'الخصم الكامل', 'يعرض أعلى خصم بدون خسارة بالضبط (يمكن للبائع أن يستنتج سعر الشراء منه)')}
    <div class="sc-set" ${c.mode === 'safe' ? '' : 'style="opacity:.5"'}>
        <label><span>هامش الأمان (٪ ربح)</span><input type="number" min="0" step="any" inputmode="decimal" value="${c.margin}" onchange="scSetNum('margin',this.value)"></label>
        <label><span>التقريب لأقل مضاعف</span><input type="number" min="1" step="1" inputmode="numeric" value="${c.step}" onchange="scSetNum('step',this.value)"></label>
    </div>
    <div class="qk-row"><div><b>إعادة حساب حد الخصم لكل المواد</b><small>اضغط عليه بعد تغيير الطريقة أو الهامش. بعدها يتحدّث تلقائياً مع كل تعديل في السعر أو الكلفة</small></div><button type="button" class="ln-btn" onclick="scRecalcAll()">إعادة حساب</button></div>
    <h5 class="sc-h">الخصائص الظاهرة</h5>
    ${Object.keys(SC_SHOW_LABELS).map(k => `<div class="qk-row"><div><b>${SC_SHOW_LABELS[k][0]}</b><small>${SC_SHOW_LABELS[k][1]}</small></div><label class="setup-sw"><input type="checkbox" ${s[k] ? 'checked' : ''} onchange="scSetShow('${k}',this.checked)"><i></i></label></div>`).join('')}`;
}
function scReSet() { const q = document.getElementById('shQuick'), card = typeof shCard === 'function' ? shCard() : null; if (!q) return; const sc = card ? card.scrollTop : 0; q.innerHTML = shScanHtml(); if (card) card.scrollTop = sc; }
function scSetOn(v) { const c = scCfg(); c.on = !!v; scSave(c); }
function scSetMode(m) { const c = scCfg(); c.mode = m; scSave(c); scReSet(); }
function scSetNum(k, v) { const c = scCfg(); const n = parseFloat(v); if (n >= 0) c[k] = n; scSave(c); }
function scSetShow(k, v) { const c = scCfg(); c.show[k] = !!v; scSave(c); }
document.addEventListener('DOMContentLoaded', scApplyHome);

// من الرئيسية: نافذة فوق الصفحة تفتح الكاميرا مباشرة؛ زر «بحث يدوي» أو مرور 8 ثوانٍ بلا باركود يحوّلان للبحث بالاسم في النافذة نفسها
const SC_SCAN_WAIT_MS = 8000;
let scTimer = 0;
function scOvEl() { return document.getElementById('scanView'); }
function scGo() { const el = scOvEl(); scApplyHome(); el.style.display = 'flex'; document.body.classList.add('sc-open'); scInit(); scScanTimed(); }
function scClose() { clearTimeout(scTimer); try { if (document.getElementById('barcodeModal').style.display === 'flex') closeBarcodeScanner(); } catch (e) { /* تجاهل */ } const el = scOvEl(); if (el) el.style.display = 'none'; document.body.classList.remove('sc-open'); scCur = null; }
function scManual() { clearTimeout(scTimer); const q = scE('bcName'); if (q) q.focus(); }
function scModalSearch(v) {
    const qn = normSearch(v || ''), qt = qn ? qn.split(' ') : [], b = scE('bcRes'); if (!b) return;
    if (/^\d{6,}$/.test(String(v).trim())) { const p = findByBarcode(v.trim()); if (p) { scModalPick(p.id); return; } }
    const res = qn ? products.map(p => ({ p, s: searchScore(p, qn, qt) })).filter(x => x.s > 0).sort((a, c) => c.s - a.s).slice(0, 6).map(x => x.p) : [];
    b.innerHTML = res.map(p => `<button type="button" class="sc-res" onclick="scModalPick(${p.id})"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand || '')}</small><span>${fmtNum(p.price || 0)}</span></button>`).join('');
}
function scModalPick(id) { clearTimeout(scTimer); closeBarcodeScanner(); scPick(id); }
function scScanTimed() {
    clearTimeout(scTimer);
    const cb = code => { clearTimeout(scTimer); const p = findByBarcode(code); if (p) scPick(p.id); else Swal.fire({ icon: 'info', title: 'لم يتم العثور على المادة', text: 'هذا الباركود غير مسجّل بأي مادة.', confirmButtonColor: '#0f1c38' }); };
    scTimer = setTimeout(() => {
        if (typeof barcodeCallback === 'undefined' || barcodeCallback !== cb) return;
        const m = scE('bcName'); if (m && (m.value || document.activeElement === m)) return;
        scManual();
        Swal.fire({ icon: 'info', title: 'لم يُقرأ باركود — ابحث بالاسم', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    }, SC_SCAN_WAIT_MS);
    openBarcodeScanner(cb);
    { const b = scE('bcSearchBox'), mr = scE('bcManualRow'), q = scE('bcName'), r = scE('bcRes'); if (b) b.style.display = ''; if (mr) mr.style.display = 'none'; if (q) q.value = ''; if (r) r.innerHTML = ''; }
}
// عند الرجوع من البطاقة: ارجع للكاميرا ثم أغلق
function scBack() { if (scCur) { scInit(); scScanTimed(); } else scClose(); }
