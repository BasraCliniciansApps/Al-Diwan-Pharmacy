// =====================================================================
// الجرد: زر واحد يضم كل ما يخص الجرد. قوائم جرد بمجموعات (رفوف)، إدخال سريع (باركود/اسم)، سطر للعلبة وسطر للجزء،
// الأعداد المدخلة تُحدّث المخزن مباشرة (يمكن إيقافه لكل قائمة) وتجعل المادة «مجرودة»، طباعة (مع الأعداد أو فارغة) وتصدير Excel.
// =====================================================================
const CN_LS = 'diwanCountLists';
let cnLists = [], cnCur = null, cnView = 'all', cnTarget = '', cnQueue = Promise.resolve(), cnSaveT = null, cnOpenFlag = false, cnFound = [];
const cnEsc = s => escapeHtml(String(s == null ? '' : s));
const cnId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const cnInt = v => parseInt(v) || 0;
const cnNum = v => { const n = parseFloat(v); return n >= 0 ? n : 0; };
function cnAllowed() { return userRole === 'owner' || can('invList'); }

// ---------- التخزين (محلي + سحابة) ----------
function cnLocal() { try { return JSON.parse(lsGet(CN_LS)) || []; } catch (e) { return []; } }
function cnStoreLocal() { lsSet(CN_LS, JSON.stringify(cnLists)); }
function cnSort() { cnLists.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdTs || '').localeCompare(String(a.createdTs || ''))); }
async function cnLoad() {
    cnLists = cnLocal();
    if (cloudReady() && navigator.onLine) {
        try {
            const snap = await db.collection('pharmacy_counts').limit(100).get(), m = new Map(cnLists.map(x => [x.id, x]));
            snap.forEach(d => { const x = d.data(); if (!x || !x.id) return; const l = m.get(x.id); if (!l || String(x.upd || '') > String(l.upd || '')) m.set(x.id, x); });
            cnLists = [...m.values()]; cnStoreLocal();
        } catch (e) { /* القواعد غير مضافة */ }
    }
    cnSort();
}
function cnTouch() {
    if (!cnCur) return;
    cnCur.upd = new Date().toISOString(); cnStoreLocal();
    clearTimeout(cnSaveT); cnSaveT = setTimeout(cnPush, 800);
}
async function cnPush(list) {
    list = list || cnCur; if (!list) return;
    if (cloudReady()) { try { await fsSet(db.collection('pharmacy_counts').doc(list.id), list); } catch (e) { lsSet('diwanNeedsPush', '1'); } }
}
const cnGroupName = (l, gid) => { const g = (l.groups || []).find(x => x.id === gid); return g ? g.name : 'بدون مجموعة'; };
const cnRowTotal = r => (r.cnt === '' || r.cnt == null) ? null : cnNum(r.cnt) * cnNum(r.price);
function cnSum(rows) { return rows.reduce((s, r) => s + (cnRowTotal(r) || 0), 0); }

// ---------- القائمة الرئيسية للجرد ----------
function cnHub() {
    if (!cnAllowed() && !can('stockEdit')) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'لا تملك صلاحية الجرد.', confirmButtonColor: '#0f1c38' }); return; }
    cnEnsureDom();
    const ov = document.getElementById('cnOv'); ov.style.display = 'flex'; document.documentElement.classList.add('lk'); cnOpenFlag = true;
    cnHubRender();
}
function cnHubRender() {
    cnCur = null;
    const own = userRole === 'owner', c = typeof scCfg === 'function' ? scCfg() : {};
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnClose()" aria-label="رجوع">→</button><b>الجرد</b><span></span></div>
        <div class="cn-body"><div class="cn-hub">
        ${cnAllowed() ? `<button type="button" class="cn-card" onclick="cnIndex()"><i>📋</i><span><b>قوائم الجرد</b><small>قوائم بمجموعات (رفوف)، إدخال سريع، طباعة وExcel. الأعداد تحدّث المخزن.</small></span></button>` : ''}
        ${can('stockEdit') ? `<button type="button" class="cn-card" onclick="cnLegacy()"><i>🧮</i><span><b>الجرد الشامل</b><small>جرد كل المواد دفعة واحدة (الطريقة السابقة).</small></span></button>` : ''}
        ${own ? `<div class="cn-card cn-set"><i>⚙️</i><span><b>الإعدادات</b>
            <label class="cn-sw"><input type="checkbox" ${setupMode ? 'checked' : ''} onchange="cnToggleSetup(this)"><span>وضع التأسيس (المواد غير المجرودة لا تتأثر بالحركة)</span></label>
            <label class="cn-sw"><input type="checkbox" ${c.posCount ? 'checked' : ''} onchange="posCountSet(this.checked)"><span>طلب جرد المادة عند أول بيع (شاشة البيع)</span></label>
            <small>يُحدَّد من صفحة المستخدمين من يحق له الدخول إلى قوائم الجرد وتعديلها (الافتراضي: ممنوع).</small></span></div>` : ''}
        </div></div>`;
}
function cnLegacy() { cnClose(); if (typeof cnOrigInventory === 'function') cnOrigInventory(); }
async function cnToggleSetup(el) { const on = el.checked; el.checked = !on; await toggleSetupMode(on); if (cnOpenFlag && !cnCur) cnHubRender(); }
function cnClose() {
    const ov = document.getElementById('cnOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); cnOpenFlag = false; cnCur = null;
}
function cnEnsureDom() {
    if (document.getElementById('cnOv')) return;
    const d = document.createElement('div'); d.id = 'cnOv'; d.className = 'cn-ov no-print'; d.setAttribute('dir', 'rtl'); d.style.display = 'none';
    d.innerHTML = '<div class="cn-box" id="cnBox"></div>';
    document.body.appendChild(d);
}

// ---------- قائمة القوائم ----------
async function cnIndex() {
    cnLists = cnLocal(); cnSort(); cnIndexRender();
    const before = JSON.stringify(cnLists.map(x => x.id + (x.upd || '')));
    await cnLoad(); if (cnOpenFlag && !cnCur && JSON.stringify(cnLists.map(x => x.id + (x.upd || ''))) !== before) cnIndexRender();
}
function cnIndexRender() {
    cnCur = null;
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnHubRender()" aria-label="رجوع">→</button><b>قوائم الجرد</b><span></span></div>
        <div class="cn-body"><button type="button" class="cn-new" onclick="cnNewList()">➕ قائمة جرد جديدة</button>
        ${cnLists.map(l => `<div class="cn-li" onclick="cnOpenList('${l.id}')"><div><b>${cnEsc(l.name)}</b><small>${cnEsc(fmtDateDMY(l.date))} • ${(l.rows || []).length} سطر • ${(l.groups || []).length} مجموعة</small></div><div class="cn-lt">${fmtNum(cnSum(l.rows || []))}<small>د.ع</small></div></div>`).join('') || '<div class="cn-empty">لا توجد قوائم بعد.</div>'}</div>`;
}
async function cnNewList() {
    const r = await Swal.fire({ title: 'قائمة جرد جديدة', showCancelButton: true, confirmButtonText: 'إنشاء', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><label>اسم القائمة<input id="cnNm" class="swal2-input" placeholder="مثال: جرد نهاية 2026"></label><label>التاريخ<input id="cnDt" type="date" class="swal2-input" value="${todayLocalISO()}"></label></div>`,
        preConfirm: () => { const n = document.getElementById('cnNm').value.trim(); if (!n) { Swal.showValidationMessage('اكتب اسم القائمة'); return false; } return { n, d: document.getElementById('cnDt').value || todayLocalISO() }; } });
    if (!r.isConfirmed || !r.value) return;
    const l = { id: cnId(), name: r.value.n, date: r.value.d, groups: [], rows: [], apply: true, createdTs: new Date().toISOString(), by: typeof actorName === 'function' ? actorName() : '' };
    cnLists.unshift(l); cnCur = l; cnTouch(); cnPush(l); cnOpenList(l.id);
}
function cnOpenList(id) {
    const l = cnLists.find(x => x.id === id); if (!l) return;
    cnCur = l; cnView = 'all'; cnTarget = ''; cnFound = []; cnListRender();
    setTimeout(() => { const q = document.getElementById('cnQ'); if (q && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) q.focus(); }, 60);
}

// ---------- المجموعات ----------
async function cnGroupAdd() {
    const r = await Swal.fire({ title: 'مجموعة جديدة', input: 'text', inputPlaceholder: 'مثال: رف الجلدية', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', inputValidator: v => !String(v || '').trim() ? 'اكتب اسم المجموعة' : null });
    if (!r.isConfirmed) return;
    const g = { id: cnId(), name: String(r.value).trim() }; cnCur.groups.push(g); cnView = g.id; cnTarget = g.id; cnTouch(); cnListRender();
}
async function cnGroupEdit(gid) {
    const g = cnCur.groups.find(x => x.id === gid); if (!g) return;
    const r = await Swal.fire({ title: 'المجموعة', input: 'text', inputValue: g.name, showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ الاسم', denyButtonText: 'حذف المجموعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c', inputValidator: v => !String(v || '').trim() ? 'اكتب اسم المجموعة' : null });
    if (r.isConfirmed) { g.name = String(r.value).trim(); cnTouch(); cnListRender(); }
    else if (r.isDenied) {
        const n = cnCur.rows.filter(x => x.gid === gid).length;
        if (!(await askSure('حذف المجموعة «' + g.name + '»؟', n ? 'ستنتقل مواد المجموعة (' + n + ') إلى «بدون مجموعة» ولا تُحذف.' : '', 'حذف'))) return;
        cnCur.rows.forEach(x => { if (x.gid === gid) x.gid = ''; }); cnCur.groups = cnCur.groups.filter(x => x.id !== gid);
        if (cnView === gid) cnView = 'all'; if (cnTarget === gid) cnTarget = ''; cnTouch(); cnListRender();
    }
}
function cnPickGroup(v) { cnView = v; cnTarget = v === 'all' ? cnTarget : (v === '_' ? '' : v); cnListRender(); }

// ---------- الإضافة والبحث ----------
function cnDefPrice(p, unit) { return unit === 'part' ? subPriceOf(p) : (parseFloat(p.price) || 0); }
function cnAddProduct(pid) {
    const p = products.find(x => x.id === pid); if (!p || !cnCur) return;
    if (cnCur.rows.length >= 5000) { Swal.fire({ icon: 'warning', title: 'بلغت القائمة الحد الأقصى (5000 سطر)', text: 'أنشئ قائمة جديدة للمتابعة.', confirmButtonColor: '#0f1c38' }); return; }
    const units = hasRetail(p) ? ['pack', 'part'] : ['pack'], tgt = cnView !== 'all' && cnView !== '_' ? cnView : (cnView === '_' ? '' : cnTarget);
    const have = cnCur.rows.filter(r => r.pid === pid);
    let focusId = '';
    if (have.length) {
        const gn = cnGroupName(cnCur, have[0].gid);
        Swal.fire({ icon: 'info', title: 'المادة موجودة في القائمة', text: 'ضمن: ' + gn, toast: true, position: 'top', showConfirmButton: false, timer: 1800 });
        focusId = (have.find(r => r.unit === 'pack') || have[0]).id; cnView = cnView === 'all' ? 'all' : have[0].gid === '' ? '_' : have[0].gid;
    } else {
        const rows = units.map(u => ({ id: cnId(), gid: tgt, pid, unit: u, cnt: '', price: cnDefPrice(p, u) || '', ts: Date.now() }));
        cnCur.rows.unshift(...rows); focusId = rows[0].id; cnTouch();
    }
    const q = document.getElementById('cnQ'); if (q) q.value = ''; cnFound = [];
    cnListRender(focusId);
}
function cnSearchInput() {
    const q = document.getElementById('cnQ').value, qn = normSearch(q);
    if (!qn) { cnFound = []; return cnResults(); }
    const toks = qn.split(' ');
    cnFound = products.filter(p => !p.arch).map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    cnResults(true);
}
function cnResults(show) {
    const box = document.getElementById('cnRes'); if (!box) return;
    const q = document.getElementById('cnQ');
    if (!show) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.innerHTML = cnFound.map(p => `<button type="button" class="cn-res" onclick="cnAddProduct(${p.id})"><span dir="ltr">${dispNameHtml(p)}</span><em>${p.price ? fmtNum(p.price) + ' د.ع' : ''}</em></button>`).join('')
        + (q && q.value.trim() && can('newItem') ? `<button type="button" class="cn-res cn-newitem" onclick="cnNewItem()">➕ مادة غير موجودة؟ أضفها كصنف جديد</button>` : '') || '<div class="cn-none">لا توجد نتائج</div>';
    box.style.display = 'block';
}
function cnNewItem() {
    const q = document.getElementById('cnQ'); if (q) q.value = ''; cnResults();
    if (typeof catPrice === 'function') catPrice(0, {}, p2 => { if (p2) cnAddProduct(p2.id); });
}
function cnByCode(code) {
    const p = findByBarcode(code);
    if (p) { cnAddProduct(p.id); return true; }
    offerUnknownBarcode(code, p2 => { cnAddProduct(p2.id); });
    return false;
}
function cnEnter() {
    const raw = document.getElementById('cnQ').value.trim(), code = cleanBarcode(raw);
    if (code && code.length >= 4 && /\d/.test(code) && /^[0-9A-Za-z\-]+$/.test(raw)) { const p = findByBarcode(code); if (p) return cnAddProduct(p.id); if (/^\d{6,}$/.test(code)) return cnByCode(code); }
    if (cnFound.length) cnAddProduct(cnFound[0].id);
}
function cnScan() {
    const cb = code => { if (!cnOpenFlag || !cnCur) return; cnByCode(code); setTimeout(() => { if (cnOpenFlag && cnCur && !document.querySelector('.swal2-container') && !document.querySelector('.cn-cnt:focus')) cnScan(); }, 700); };
    openBarcodeScanner(cb);
}

// ---------- العرض ----------
function cnRowHtml(r) {
    const p = products.find(x => x.id === r.pid); if (!p) return '';
    const part = r.unit === 'part', t = cnRowTotal(r), sys = part ? cnInt(p.loose) : cnInt(p.qty);
    return `<div class="cn-row" id="cnr-${r.id}"><div class="cn-nm"><b dir="ltr">${cnEsc(dispName(p, part))}</b><small>${part ? cnEsc(subTypeOf(p)) : 'قطعة كاملة'} • بالنظام: ${sys}</small></div>
        <label class="cn-f"><span>العدد</span><input class="cn-cnt" type="number" inputmode="numeric" min="0" value="${cnEsc(r.cnt)}" oninput="cnSetCnt('${r.id}',this.value)" onchange="cnCommit('${r.id}','cnt')" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();var q=document.getElementById('cnQ');if(q)q.focus();}"></label>
        <label class="cn-f"><span>السعر</span><input class="cn-pr" type="number" inputmode="numeric" min="0" value="${cnEsc(r.price)}" oninput="cnSetPrice('${r.id}',this.value)" onchange="cnCommit('${r.id}','price')"></label>
        <div class="cn-f cn-tt"><span>المجموع</span><b id="cnt-${r.id}">${t === null ? '' : fmtNum(t)}</b></div>
        <button type="button" class="cn-x" onclick="cnDelRow('${r.id}')" aria-label="حذف">✕</button></div>`;
}
function cnListRender(focusId) {
    const l = cnCur; if (!l) return;
    const rows = l.rows.filter(r => cnView === 'all' || (cnView === '_' ? r.gid === '' : r.gid === cnView));
    const gids = [...l.groups.map(g => g.id), ''];
    const sections = gids.map(gid => { const rr = rows.filter(r => r.gid === gid); if (!rr.length) return ''; return `<div class="cn-gh"><b>${cnEsc(cnGroupName(l, gid))}</b><small>${rr.length} سطر • ${fmtNum(cnSum(rr))} د.ع</small></div>${rr.map(cnRowHtml).join('')}`; }).join('');
    const chip = (v, label, on) => `<button type="button" class="cn-chip ${on ? 'on' : ''}" onclick="cnPickGroup('${v}')">${cnEsc(label)}</button>`;
    const has0 = l.rows.some(r => r.gid === '');
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnIndex()" aria-label="رجوع">→</button><b>${cnEsc(l.name)}</b><span>${cnEsc(fmtDateDMY(l.date))}</span></div>
        <div class="cn-bar"><input id="cnQ" type="search" autocomplete="off" placeholder="امسح الباركود أو اكتب اسم المادة" oninput="cnSearchInput()" onkeydown="if(event.key==='Enter'){event.preventDefault();cnEnter();}"><button type="button" class="cn-cam" onclick="cnScan()" aria-label="كاميرا">📷</button></div>
        <div id="cnRes" class="cn-resbox" style="display:none"></div>
        <div class="cn-chips">${chip('all', 'الكل', cnView === 'all')}${l.groups.map(g => chip(g.id, g.name, cnView === g.id)).join('')}${has0 ? chip('_', 'بدون مجموعة', cnView === '_') : ''}<button type="button" class="cn-chip add" onclick="cnGroupAdd()">＋ مجموعة</button>${cnView !== 'all' && cnView !== '_' ? `<button type="button" class="cn-chip add" onclick="cnGroupEdit('${cnView}')">✎ المجموعة</button>` : ''}</div>
        <div class="cn-body" id="cnList">${sections || '<div class="cn-empty">امسح باركود أو ابحث عن مادة لإضافتها.</div>'}</div>
        <div class="cn-foot"><div class="cn-tot"><span>المجموع</span><b id="cnTotal">${fmtNum(cnSum(l.rows))}</b><i>د.ع</i></div>
        <div class="cn-acts"><button type="button" onclick="cnPrintDialog()">🖨️ طباعة</button><button type="button" onclick="cnExcel()">⬇️ Excel</button><button type="button" onclick="cnSettings()">⚙️</button></div></div>`;
    if (focusId) { const row = document.getElementById('cnr-' + focusId); if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'center' }); const i = row.querySelector('.cn-cnt'); if (i) { i.focus(); i.select(); } } }
}
function cnRefreshTotals(r) {
    const e = document.getElementById('cnt-' + r.id), t = cnRowTotal(r); if (e) e.textContent = t === null ? '' : fmtNum(t);
    const tt = document.getElementById('cnTotal'); if (tt) tt.textContent = fmtNum(cnSum(cnCur.rows));
}
function cnRow(id) { return cnCur && cnCur.rows.find(r => r.id === id); }
function cnSetCnt(id, v) { const r = cnRow(id); if (!r) return; r.cnt = v === '' ? '' : String(Math.max(0, cnInt(v))); cnRefreshTotals(r); cnTouch(); }
function cnSetPrice(id, v) { const r = cnRow(id); if (!r) return; r.price = v === '' ? '' : String(cnNum(v)); cnRefreshTotals(r); cnTouch(); }
async function cnDelRow(id) {
    const r = cnRow(id); if (!r) return; const p = products.find(x => x.id === r.pid);
    if (!(await askSure('حذف هذا السطر من القائمة؟', (p ? p.name : '') + ' (لا يتأثر المخزن)', 'حذف'))) return;
    cnCur.rows = cnCur.rows.filter(x => x.id !== id); cnTouch(); cnListRender();
}

// ---------- اعتماد العدد/السعر على المخزن ----------
function cnCommit(id, what) {
    const r = cnRow(id); if (!r || !cnCur.apply) return;
    cnQueue = cnQueue.then(() => cnApplyRow(r, what)).catch(() => { });
}
async function cnApplyRow(r, what) {
    const p = products.find(x => x.id === r.pid); if (!p) return;
    const part = r.unit === 'part', retail = hasRetail(p), sc = btSc(p);
    if (!(writesAllowed())) return;
    const from = { qty: cnInt(p.qty), loose: cnInt(p.loose) }, to = { ...from }, ch = [];
    let priceChanged = false;
    if (what === 'cnt' && r.cnt !== '') {
        const n = Math.max(0, cnInt(r.cnt));
        if (part) { if (!retail) return; if (n >= sc) { Swal.fire({ icon: 'warning', title: 'عدد الأجزاء يجب أن يكون أقل من ' + sc, toast: true, position: 'top', showConfirmButton: false, timer: 2200 }); return; } to.loose = n; }
        else to.qty = n;
        if (r.sys === undefined) r.sys = part ? from.loose : from.qty;   // الرصيد بالنظام قبل الجرد (لحساب الفرق)
    }
    if (what === 'price' && r.price !== '') {
        const pr = cnNum(r.price);
        if (part) { if (pr > 0 && pr !== (parseFloat(p.subPrice) || subPriceOf(p))) { p.subPrice = pr; p.subManual = true; priceChanged = true; } }
        else if (pr > 0 && pr !== (parseFloat(p.price) || 0)) { p.price = pr; p.pricing = 'manual'; p.markupPct = null; if (retail && !p.subManual) p.subPrice = subPriceCalc(pr, subCountOf(p)); priceChanged = true; }
    }
    const qtyChanged = to.qty !== from.qty || to.loose !== from.loose, markNeeded = what === 'cnt' && r.cnt !== '' && p.counted !== true;
    if (!qtyChanged && !priceChanged && !markNeeded) return;
    p.qty = to.qty; p.loose = to.loose;
    const dates = typeof btDateOnly === 'function' ? btDateOnly(p).sort() : [];
    const entry = { p, priceFields: priceChanged, dq: to.qty - from.qty, dl: to.loose - from.loose, ...(what === 'cnt' ? { mark: true } : {}), ...(dates.length && qtyChanged ? { expAdd: [dates[0]] } : {}) };
    const ok = await saveProductsDelta([entry]);
    if (!ok) { p.qty = from.qty; p.loose = from.loose; return; }
    if (what === 'cnt') p.counted = true;
    if (qtyChanged) { try { logAction('qty', p, [{ f: 'الكمية (قائمة جرد: ' + cnCur.name + ')', from: stockTxt(p, from), to: stockTxt(p, to) }]); } catch (e) { /* تجاهل */ } }
    if (priceChanged && !part) { const sib = cnCur.rows.find(x => x.pid === r.pid && x.unit === 'part'); if (sib && !p.subManual) { sib.price = String(subPriceOf(p)); const i = document.querySelector('#cnr-' + sib.id + ' .cn-pr'); if (i) i.value = sib.price; cnRefreshTotals(sib); } }
    r.applied = new Date().toISOString(); cnTouch();
    const row = document.getElementById('cnr-' + r.id); if (row) { const s = row.querySelector('.cn-nm small'); if (s) s.textContent = (part ? subTypeOf(p) : 'قطعة كاملة') + ' • بالنظام: ' + (part ? to.loose : to.qty) + ' ✓'; }
}

// ---------- إعدادات القائمة ----------
async function cnSettings() {
    const l = cnCur; if (!l) return;
    const r = await Swal.fire({ title: 'إعدادات القائمة', showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ', denyButtonText: 'حذف القائمة', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c',
        html: `<div class="sw-form"><label>اسم القائمة<input id="cnSn" class="swal2-input" value="${cnEsc(l.name)}"></label><label>التاريخ<input id="cnSd" type="date" class="swal2-input" value="${cnEsc(l.date || todayLocalISO())}"></label>
            <label class="cn-sw" style="margin-top:8px"><input type="checkbox" id="cnSa" ${l.apply !== false ? 'checked' : ''}><span>اعتماد الأعداد والأسعار على المخزن</span></label>
            <small style="display:block;color:#64748b;margin-top:6px">عند الإيقاف تبقى الأعداد في القائمة فقط ولا تغيّر المخزن.</small></div>`,
        preConfirm: () => ({ n: document.getElementById('cnSn').value.trim() || l.name, d: document.getElementById('cnSd').value || l.date, a: document.getElementById('cnSa').checked }) });
    if (r.isConfirmed && r.value) { l.name = r.value.n; l.date = r.value.d; l.apply = r.value.a; cnTouch(); cnListRender(); }
    else if (r.isDenied) {
        if (!(await askSure('حذف قائمة الجرد «' + l.name + '»؟', 'لا يتأثر المخزن، لكن القائمة تُحذف نهائياً.', 'حذف'))) return;
        cnLists = cnLists.filter(x => x.id !== l.id); cnStoreLocal();
        if (cloudReady()) { try { await db.collection('pharmacy_counts').doc(l.id).delete(); } catch (e) { /* تجاهل */ } }
        cnCur = null; cnIndexRender();
    }
}

// ---------- الطباعة وExcel ----------
function cnUnitLabel(p, r) { return r.unit === 'part' ? subTypeOf(p) : 'قطعة'; }
async function cnPrintDialog() {
    const l = cnCur; if (!l) return;
    const r = await Swal.fire({ title: 'طباعة قائمة الجرد', showCancelButton: true, confirmButtonText: 'معاينة وطباعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><label>المجموعة<select id="cnPg" class="swal2-input"><option value="all">كل المجموعات</option>${l.groups.map(g => `<option value="${g.id}">${cnEsc(g.name)}</option>`).join('')}${l.rows.some(x => x.gid === '') ? '<option value="_">بدون مجموعة</option>' : ''}</select></label>
            <label class="cn-sw"><input type="checkbox" id="cnPb"><span>بدون أعداد (لأملأها بخط اليد)</span></label>
            <label class="cn-sw"><input type="checkbox" id="cnPp"><span>كل مجموعة في صفحة جديدة</span></label></div>`,
        preConfirm: () => ({ g: document.getElementById('cnPg').value, blank: document.getElementById('cnPb').checked, pg: document.getElementById('cnPp').checked }) });
    if (!r.isConfirmed || !r.value) return;
    cnPrint(r.value);
}
function cnSections(l, gsel) {
    const gids = [...l.groups.map(g => g.id), ''];
    return gids.filter(g => gsel === 'all' || (gsel === '_' ? g === '' : g === gsel)).map(g => ({ gid: g, name: cnGroupName(l, g), rows: l.rows.filter(r => r.gid === g && products.some(p => p.id === r.pid)) })).filter(s => s.rows.length);
}
function cnPrint(o) {
    const l = cnCur, secs = cnSections(l, o.g);
    if (!secs.length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد للطباعة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); return; }
    let html = '', grand = 0, k = 0;
    secs.forEach((s, si) => {
        const rowsHtml = s.rows.map(r => { const p = products.find(x => x.id === r.pid), t = o.blank ? null : cnRowTotal(r); if (t) grand += t; k++;
            return `<tr><td class="num">${k}</td><td dir="ltr" style="text-align:left">${cnEsc(dispName(p, r.unit === 'part'))}</td><td>${cnEsc(cnUnitLabel(p, r))}</td><td class="num">${o.blank || r.cnt === '' ? '' : cnEsc(r.cnt)}</td><td class="num">${cnNum(r.price) ? fmtNum(r.price) : ''}</td><td class="num">${t === null || t === 0 && r.cnt === '' ? '' : fmtNum(t)}</td></tr>`; }).join('');
        const gsum = o.blank ? '' : `<tr class="tot"><td colspan="5">مجموع ${cnEsc(s.name)}</td><td class="num">${fmtNum(cnSum(s.rows))}</td></tr>`;
        html += `<h3 class="cn-ph ${o.pg && si > 0 ? 'cn-pg' : ''}">${cnEsc(s.name)}</h3><table class="rv-tb"><thead><tr><th>ت</th><th>اسم المادة</th><th>الوحدة</th><th>العدد</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>${rowsHtml}${gsum}</tbody></table>`;
    });
    if (!o.blank && secs.length > 1) html += `<table class="rv-tb"><tbody><tr class="tot"><td>المجموع الكلي للقائمة</td><td class="num">${fmtNum(grand)}</td></tr></tbody></table>`;
    openReport({ title: l.name, html, lines: [], csvName: 'x', fileName: 'Al-Diwan-Pharmacy_Inventory_' + (l.date || todayLocalISO()), xlsx: () => cnExcel() });
}
function cnExcelBuild(l) {
    const C = { al: 'center', fill: true }, rows = []; let k = 0;
    const secs = cnSections(l, 'all');
    secs.forEach(s => s.rows.forEach(r => {
        const p = products.find(x => x.id === r.pid); k++; const n = k + 1;
        rows.push([{ v: k, s: C }, { v: dispName(p, r.unit === 'part'), s: { al: 'left', fill: true } }, { v: cnUnitLabel(p, r), s: C }, r.cnt === '' ? { v: '', s: { ...C, fmt: '0' } } : { v: cnInt(r.cnt), s: { ...C, fmt: '0' } },
            { v: cnNum(r.price), s: { ...C, fmt: '#,##0' } }, { v: cnRowTotal(r) === null ? '' : cnRowTotal(r), f: 'IF(D' + n + '="","",D' + n + '*E' + n + ')', s: { ...C, fmt: '#,##0' } }, { v: s.name, s: C }]);
    }));
    const w = [5, 64, 14, 12, 16, 18, 22];
    return xlBuild({ name: 'قائمة الجرد', tab: 'FF00B0F0', zoom: 85, freeze: true, defH: 16, cols: w.map(x => ({ w: x })), head: ['ت', 'اسم المادة', 'الوحدة', 'العدد', 'السعر', 'المجموع', 'المجموعة'], hdr: {}, rows, table: 'Table_Inventory' });
}
async function cnExcel() {
    const l = cnCur; if (!l) return;
    if (!l.rows.length) { Swal.fire({ icon: 'info', title: 'القائمة فارغة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); return; }
    const b = cnExcelBuild(l); return downloadFile('Al-Diwan-Pharmacy_Inventory_' + (l.date || todayLocalISO()) + '.xlsx', b, b.type);
}

// ---------- ربط الزر الحالي (الجرد) بالقائمة الجديدة ----------
var cnOrigInventory = openInventory;
openInventory = function () { cnHub(); };
