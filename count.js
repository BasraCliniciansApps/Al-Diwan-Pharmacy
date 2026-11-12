// =====================================================================
// الجرد: زر واحد يضم كل ما يخص الجرد. قوائم جرد بمجموعات (رفوف)، إدخال سريع (باركود/اسم)، سطر للعلبة وسطر للجزء،
// الأعداد المدخلة تُحدّث المخزن مباشرة (يمكن إيقافه لكل قائمة) وتجعل المادة «مجرودة»، طباعة (مع الأعداد أو فارغة) وتصدير Excel.
// =====================================================================
const CN_LS = 'diwanCountLists';
let cnScr = 'hub', cnLists = [], cnCur = null, cnSel = new Set(), cnDd = false, cnTarget = '', cnQueue = Promise.resolve(), cnSaveT = null, cnOpenFlag = false, cnFound = [];
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
    const ov = document.getElementById('cnOv'); ov.style.display = 'flex'; document.documentElement.classList.add('lk'); document.body.classList.add('ov-open'); cnOpenFlag = true;
    cnHubRender();
}
function cnHubRender() {
    cnCur = null; cnScr = 'hub'; cnPendOpen = false;
    const own = userRole === 'owner', c = typeof scCfg === 'function' ? scCfg() : {};
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnClose()" aria-label="رجوع">→</button><b>الجرد</b><span></span></div>
        <div class="cn-body"><div class="cn-hub">
        ${cnAllowed() ? `<button type="button" class="cn-card" onclick="cnIndex()"><i>📋</i><span><b>قوائم الجرد</b><small>قوائم بمجموعات (رفوف)، إدخال سريع، طباعة وExcel. الأعداد تحدّث المخزن.</small></span></button>` : ''}
        ${cnAllowed() ? `<button type="button" class="cn-card" onclick="cnPending()"><i>🗃️</i><span><b>مواد لم تدخل قوائم الجرد</b><small>مواد المخزن غير الموجودة في أي قائمة: حذف، ضم، أو إضافة إلى قائمة جرد.</small></span></button>` : ''}
        ${can('stockEdit') ? `<button type="button" class="cn-card" onclick="cnLegacy()"><i>🧮</i><span><b>الجرد الشامل</b><small>جرد كل المواد دفعة واحدة (الطريقة السابقة).</small></span></button>` : ''}
        ${own ? `<div class="cn-card cn-set"><i>⚙️</i><span><b>الإعدادات</b>
            <label class="cn-sw"><input type="checkbox" ${setupMode ? 'checked' : ''} onchange="cnToggleSetup(this)"><span>وضع التأسيس (المواد غير المجرودة لا تتأثر بالحركة)</span></label>
            <label class="cn-sw"><input type="checkbox" ${c.posCount ? 'checked' : ''} onchange="posCountSet(this.checked)"><span>طلب جرد المادة عند أول بيع (شاشة البيع)</span></label>
            <small>يُحدَّد من صفحة المستخدمين من يحق له الدخول إلى قوائم الجرد وتعديلها (الافتراضي: ممنوع).</small></span></div>` : ''}
        </div></div>`;
}
function cnLegacy() { cnClose(); if (typeof cnOrigInventory === 'function') cnOrigInventory(); }
async function cnToggleSetup(el) { const on = el.checked; el.checked = !on; await toggleSetupMode(on); if (cnOpenFlag && !cnCur) cnHubRender(); }
// زر الرجوع (النظام): خطوة واحدة للخلف داخل شاشات الجرد
function cnBack() {
    if (cnDd && cnCur) { cnDd = false; cnDdRender(); return; }
    if (cnScr === 'list') { cnIndex(); return; }
    if (cnScr === 'index') { cnHubRender(); return; }
    if (cnScr === 'pend') { cnPendClose(); return; }
    cnClose();
}
function cnClose() {
    const ov = document.getElementById('cnOv'); if (ov) ov.style.display = 'none';
    document.documentElement.classList.remove('lk'); document.body.classList.remove('ov-open'); cnOpenFlag = false; cnCur = null;
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
    cnCur = null; cnScr = 'index'; cnPendOpen = false;
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
    cnCur = l; cnSel = new Set(); cnDd = false; cnTarget = ''; cnFound = []; cnListRender();
    setTimeout(() => { const q = document.getElementById('cnQ'); if (q && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) q.focus(); }, 60);
}

// ---------- نقل مواد بين المجموعات ----------
async function cnMovePick(what) {
    const l = cnCur; if (!l) return;
    const pids = typeof what === 'string' ? [...new Set(l.rows.filter(r => r.gid === what.slice(2)).map(r => r.pid))] : what;
    if (!pids.length) return;
    const cur = typeof what === 'string' ? what.slice(2) : (l.rows.find(r => r.pid === pids[0]) || {}).gid;
    const opts = { '': 'بدون مجموعة' }; l.groups.forEach(g => { opts[g.id] = g.name; });
    const r = await Swal.fire({ title: pids.length > 1 ? 'نقل ' + pids.length + ' مادة إلى مجموعة' : 'نقل المادة إلى مجموعة', input: 'select', inputOptions: opts, inputValue: cur || '', showCancelButton: true, confirmButtonText: 'نقل', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
    if (!r.isConfirmed) return;
    const to = r.value || '', n = l.rows.filter(x => pids.includes(x.pid) && x.gid !== to).length;
    if (!n) return;
    l.rows.forEach(x => { if (pids.includes(x.pid)) x.gid = to; });
    cnTouch(); cnListRender();
    Swal.fire({ icon: 'success', title: 'تم النقل إلى «' + cnGroupName(l, to) + '»', toast: true, position: 'bottom', showConfirmButton: false, timer: 1500 });
}

// ---------- المجموعات ----------
async function cnGroupAdd() {
    const r = await Swal.fire({ title: 'مجموعة جديدة', input: 'text', inputPlaceholder: 'مثال: رف الجلدية', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', inputValidator: v => !String(v || '').trim() ? 'اكتب اسم المجموعة' : null });
    if (!r.isConfirmed) return;
    const g = { id: cnId(), name: String(r.value).trim() }; cnCur.groups.push(g); cnSel = new Set([g.id]); cnTarget = g.id; cnTouch(); cnListRender();
}
async function cnGroupEdit(gid) {
    const g = cnCur.groups.find(x => x.id === gid); if (!g) return;
    const r = await Swal.fire({ title: 'المجموعة', input: 'text', inputValue: g.name, showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ الاسم', denyButtonText: 'حذف المجموعة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c', inputValidator: v => !String(v || '').trim() ? 'اكتب اسم المجموعة' : null });
    if (r.isConfirmed) { g.name = String(r.value).trim(); cnTouch(); cnListRender(); }
    else if (r.isDenied) {
        const n = cnCur.rows.filter(x => x.gid === gid).length;
        if (!(await askSure('حذف المجموعة «' + g.name + '»؟', n ? 'ستنتقل مواد المجموعة (' + n + ') إلى «بدون مجموعة» ولا تُحذف.' : '', 'حذف'))) return;
        cnCur.rows.forEach(x => { if (x.gid === gid) x.gid = ''; }); cnCur.groups = cnCur.groups.filter(x => x.id !== gid);
        cnSel.delete(gid); if (cnTarget === gid) cnTarget = ''; cnTouch(); cnListRender();
    }
}
function cnInView(gid) { return cnSel.size === 0 || cnSel.has(gid === '' ? '_' : gid); }
function cnDdToggle() { cnDd = !cnDd; cnDdRender(); }
function cnDdPick(v, on) {
    if (v === 'all') cnSel = new Set(); else if (on) cnSel.add(v); else cnSel.delete(v);
    if (cnSel.size === 1) { const k = [...cnSel][0]; cnTarget = k === '_' ? '' : k; }
    cnListRender(); cnDd = true; cnDdRender();
}
async function cnGroupDel(gid) {
    const g = cnCur.groups.find(x => x.id === gid); if (!g) return;
    const n = cnCur.rows.filter(x => x.gid === gid).length;
    if (!(await askSure('حذف المجموعة «' + g.name + '»؟', n ? 'ستنتقل مواد المجموعة (' + n + ') إلى «بدون مجموعة» ولا تُحذف.' : '', 'حذف'))) return;
    cnCur.rows.forEach(x => { if (x.gid === gid) x.gid = ''; }); cnCur.groups = cnCur.groups.filter(x => x.id !== gid);
    cnSel.delete(gid); if (cnTarget === gid) cnTarget = ''; cnTouch(); cnListRender(); cnDd = true; cnDdRender();
}
function cnDdLabel() { const l = cnCur; if (!cnSel.size) return 'كل المجموعات'; const n = [...cnSel].map(k => k === '_' ? 'بدون مجموعة' : cnGroupName(l, k)); return n.length > 2 ? n.length + ' مجموعات' : n.join('، '); }
function cnDdRender() {
    const box = document.getElementById('cnDd'); if (!box) return; const l = cnCur; if (!l) return;
    box.style.display = cnDd ? 'block' : 'none'; if (!cnDd) return;
    const q = (document.getElementById('cnDdQ') || {}).value || '', has0 = l.rows.some(r => r.gid === '');
    const cnt = gid => l.rows.filter(r => r.gid === gid).length;
    const items = [...l.groups.map(g => ({ k: g.id, n: g.name, c: cnt(g.id) })), ...(has0 ? [{ k: '_', n: 'بدون مجموعة', c: cnt('') }] : [])].filter(x => !q || normSearch(x.n).includes(normSearch(q)));
    box.innerHTML = `${l.groups.length > 6 ? `<input id="cnDdQ" type="search" placeholder="ابحث عن مجموعة" value="${cnEsc(q)}" oninput="cnDdRender()">` : ''}
        <label class="cn-dd-i"><input type="checkbox" ${cnSel.size === 0 ? 'checked' : ''} onchange="cnDdPick('all',true)"><span>كل المجموعات</span></label>
        ${items.map(x => `<label class="cn-dd-i"><input type="checkbox" ${cnSel.has(x.k) ? 'checked' : ''} onchange="cnDdPick('${x.k}',this.checked)"><span>${cnEsc(x.n)}</span><small>${x.c}</small>${x.k !== '_' ? `<button type="button" class="cn-dd-x" onclick="event.preventDefault();event.stopPropagation();cnGroupDel('${x.k}')" aria-label="حذف المجموعة"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button>` : ''}</label>`).join('') || '<div class="cn-none">لا توجد مجموعات</div>'}
        <button type="button" class="cn-dd-ok" onclick="cnDd=false;cnDdRender()">تم</button>`;
    const i = document.getElementById('cnDdQ'); if (i && q) { i.focus(); i.setSelectionRange(q.length, q.length); }
}
// مزامنة: كل مادة فيها أجزاء يجب أن يكون لها سطر جزء بجانب سطر العلبة
// الترتيب: الأقدم إدخالاً أولاً (رقم 1)، وسطر الجزء يلي سطر علبته مباشرة
function cnNormalize(l) {
    const pk = new Map(); l.rows.forEach(r => { const t = r.ts || 0; if (!pk.has(r.pid) || t < pk.get(r.pid)) pk.set(r.pid, t); });
    const key = r => pk.has(r.pid) ? pk.get(r.pid) : (r.ts || 0);
    const first = r => { const p = products.find(x => x.id === r.pid); return p ? cnUnits(p)[0] : 'pack'; };
    const arr = l.rows.map((r, i) => [r, i]);
    arr.sort((a, b) => key(a[0]) - key(b[0]) || a[0].pid - b[0].pid || (a[0].unit === first(a[0]) ? -1 : 1) - (b[0].unit === first(b[0]) ? -1 : 1) || a[1] - b[1]);
    l.rows = arr.map(x => x[0]);
}
function cnSyncParts(l) {
    let ch = false;
    l.rows.forEach(r => { if (r.pe) return; const p = products.find(x => x.id === r.pid); if (!p) return; const v = cnDefPrice(p, r.unit) || ''; if (String(r.price) !== String(v)) { r.price = v === '' ? '' : String(v); ch = true; } });   // السعر يُسحب من المادة ما لم يُعدَّل يدوياً
    [...new Set(l.rows.map(r => r.pid))].forEach(pid => {
        const p = products.find(x => x.id === pid); if (!p) return;
        const want = cnUnits(p), mine = l.rows.filter(r => r.pid === pid), base = mine[0], ts = Math.min(...mine.map(r => r.ts || Date.now()));
        want.forEach(u => { if (!mine.some(r => r.unit === u)) { l.rows.splice(l.rows.indexOf(mine[mine.length - 1]) + 1, 0, { id: cnId(), gid: base.gid, pid, unit: u, cnt: '', price: cnDefPrice(p, u) || '', ts }); ch = true; } });
        l.rows = l.rows.filter(r => r.pid !== pid || want.includes(r.unit) || r.cnt !== '' || (ch = true, false));
    });
    if (ch) cnTouch();
}

// ---------- الإضافة والبحث ----------
function cnUnits(p) { const m = sellMode(p); return m === 'partOnly' ? ['part'] : m === 'packOnly' || !hasRetail(p) ? ['pack'] : m === 'part' ? ['part', 'pack'] : ['pack', 'part']; }
function cnDefPrice(p, unit) { return unit === 'part' ? subPriceOf(p) : (parseFloat(p.price) || 0); }
function cnAddProduct(pid) {
    const p = products.find(x => x.id === pid); if (!p || !cnCur) return;
    if (cnCur.rows.length >= 5000) { Swal.fire({ icon: 'warning', title: 'بلغت القائمة الحد الأقصى (5000 سطر)', text: 'أنشئ قائمة جديدة للمتابعة.', confirmButtonColor: '#0f1c38' }); return; }
    const units = cnUnits(p), tgt = cnSel.size === 1 ? ([...cnSel][0] === '_' ? '' : [...cnSel][0]) : cnTarget;
    const have = cnCur.rows.filter(r => r.pid === pid);
    let focusId = '';
    if (have.length) {
        const gn = cnGroupName(cnCur, have[0].gid);
        Swal.fire({ icon: 'info', title: 'المادة موجودة في القائمة', text: 'ضمن: ' + gn, toast: true, position: 'top', showConfirmButton: false, timer: 1800 });
        focusId = (have.find(r => r.unit === 'pack') || have[0]).id; if (!cnInView(have[0].gid)) cnSel = new Set();
    } else {
        const rows = units.map(u => ({ id: cnId(), gid: tgt, pid, unit: u, cnt: '', price: cnDefPrice(p, u) || '', ts: Date.now() }));
        cnCur.rows.push(...rows); focusId = rows[0].id; cnTouch();
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
function cnRowHtml(r, n) {
    const p = products.find(x => x.id === r.pid); if (!p) return '';
    const part = r.unit === 'part', t = cnRowTotal(r), sys = part ? cnInt(p.loose) : cnInt(p.qty);
    return `<div class="cn-row" id="cnr-${r.id}"><div class="cn-n">${n || ''}</div><div class="cn-nm"><b dir="ltr" class="cn-nmb"><span onclick="cnEditProduct(${r.pid})">${cnEsc(dispName(p, part))}</span></b><small>${part ? cnEsc(subTypeOf(p)) : 'قطعة كاملة'} • بالنظام: ${sys}</small><button type="button" class="cn-gm" onclick="cnMovePick([${r.pid}])">📁 ${cnEsc(cnGroupName(cnCur, r.gid))} ▾</button></div>
        <label class="cn-f"><span>العدد</span><input class="cn-cnt" type="number" inputmode="numeric" min="0" value="${cnEsc(r.cnt)}" oninput="cnSetCnt('${r.id}',this.value)" onchange="cnCommit('${r.id}','cnt')" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();var q=document.getElementById('cnQ');if(q)q.focus();}"></label>
        <label class="cn-f"><span>السعر</span><input class="cn-pr" type="number" inputmode="numeric" min="0" value="${cnEsc(r.price)}" oninput="cnSetPrice('${r.id}',this.value)" onchange="cnCommit('${r.id}','price')"></label>
        <div class="cn-f cn-tt"><span>المجموع</span><b id="cnt-${r.id}">${t === null ? '' : fmtNum(t)}</b></div>
        <div class="cn-sd"><button type="button" class="cn-bc ${barcodesOf(p).length ? 'has' : 'none'}" onclick="cnBarcode(${r.pid})" aria-label="باركود" title="${barcodesOf(p).length ? 'للمادة باركود' : 'بلا باركود'}">▦</button><button type="button" class="cn-mg" onclick="cnMergeOpen(${r.pid})" aria-label="ضم" title="ضم مواد">⇄</button><button type="button" class="cn-x" onclick="cnDelRow('${r.id}')" aria-label="حذف">✕</button></div></div>`;
}
// العدد المجرود يتبع المخزن: إن كان مطابقاً له وقت الجرد فإنه ينقص تلقائياً مع أي بيع (حتى من جهاز آخر)
function cnSysOf(r) { const p = products.find(x => x.id === r.pid); return p ? (r.unit === 'part' ? cnInt(p.loose) : cnInt(p.qty)) : null; }
function cnFollow(l) {
    const out = [];
    if (!l || !l.apply) return out;
    l.rows.forEach(r => {
        if (r.cnt === '') return; const cur = cnSysOf(r); if (cur === null) return;
        if (r.sq === undefined) r.sq = r.applied ? cnInt(r.cnt) : (cnInt(r.cnt) === cur ? cur : undefined);   // سطر معتمد سابقاً: كان المخزن مطابقاً للعدد وقتها
        if (r.sq === undefined) return;
        if (cur === r.sq) return;
        if (cnInt(r.cnt) === r.sq) { r.cnt = String(cur); out.push(r); }
        r.sq = cur;
    });
    if (out.length) cnTouch();
    return out;
}
function cnLiveSync() {
    if (!cnCur || !cnOpenFlag || cnScr !== 'list') return;
    const ch = cnFollow(cnCur); if (!ch.length) return;
    ch.forEach(r => {
        const row = document.getElementById('cnr-' + r.id); if (!row) return;
        const i = row.querySelector('.cn-cnt'); if (i && document.activeElement !== i) i.value = r.cnt;
        const p = products.find(x => x.id === r.pid), sm = row.querySelector('.cn-nm small'); if (sm && p) sm.textContent = (r.unit === 'part' ? subTypeOf(p) : 'قطعة كاملة') + ' • بالنظام: ' + cnSysOf(r) + ' ✓';
        cnRefreshTotals(r);
    });
}
function cnListRender(focusId) {
    const l = cnCur; if (!l) return;
    // نحفظ موضع التمرير الحالي حتى لا تقفز القائمة للأعلى عند أي إعادة رسم (حذف، نقل، ضم، تغيير مجموعة...)
    const _old = document.getElementById('cnList'), _top = _old && document.getElementById('cnBox') && cnScr === 'list' && !focusId ? _old.scrollTop : null;
    cnScr = 'list'; cnSyncParts(l); cnNormalize(l); cnFollow(l);
    const rows = l.rows.filter(r => cnInView(r.gid));
    const gids = [...l.groups.map(g => g.id), ''];
    const sections = gids.map(gid => { const rr = rows.filter(r => r.gid === gid); if (!rr.length) return ''; return `<div class="cn-gh"><b>${cnEsc(cnGroupName(l, gid))}</b><small>${rr.length} سطر • ${fmtNum(cnSum(rr))} د.ع</small><button type="button" class="cn-gm" onclick="cnMovePick('g:${gid}')">نقل الكل ▾</button></div>${rr.map(r => cnRowHtml(r, l.rows.indexOf(r) + 1)).join('')}`; }).join('');
    const chip = (v, label, on) => `<button type="button" class="cn-chip ${on ? 'on' : ''}" onclick="cnPickGroup('${v}')">${cnEsc(label)}</button>`;
    const has0 = l.rows.some(r => r.gid === '');
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnIndex()" aria-label="رجوع">→</button><b>${cnEsc(l.name)}</b><span>${cnEsc(fmtDateDMY(l.date))}</span></div>
        <div class="cn-bar"><input id="cnQ" type="search" autocomplete="off" placeholder="امسح الباركود أو اكتب اسم المادة" oninput="cnSearchInput()" onkeydown="if(event.key==='Enter'){event.preventDefault();cnEnter();}"><button type="button" class="cn-cam" onclick="cnScan()" aria-label="كاميرا">📷</button></div>
        <div id="cnRes" class="cn-resbox" style="display:none"></div>
        <div class="cn-chips"><button type="button" class="cn-dd-b" onclick="cnDdToggle()">🗂️ <span>${cnEsc(cnDdLabel())}</span> ▾</button><button type="button" class="cn-chip add" onclick="cnGroupAdd()">＋ مجموعة</button>${cnSel.size === 1 && [...cnSel][0] !== '_' ? `<button type="button" class="cn-chip add" onclick="cnGroupEdit('${[...cnSel][0]}')">✎ المجموعة</button>` : ''}</div>
        <div id="cnDd" class="cn-dd" style="display:none"></div>
        <div class="cn-body" id="cnList">${sections || '<div class="cn-empty">امسح باركود أو ابحث عن مادة لإضافتها.</div>'}</div>
        <div class="cn-foot"><div class="cn-tot"><span>المجموع</span><b id="cnTotal">${fmtNum(cnSum(l.rows))}</b><i>د.ع</i></div>
        <div class="cn-acts"><button type="button" onclick="cnPrintDialog()">🖨️ طباعة</button><button type="button" onclick="cnExcel()">⬇️ Excel</button><button type="button" onclick="cnSettings()">⚙️</button></div></div>`;
    if (_top !== null) { const rs = () => { const b = document.getElementById('cnList'); if (b) b.scrollTop = _top; }; rs(); requestAnimationFrame(rs); setTimeout(rs, 120); }
    if (focusId) {
        const go = (focus) => { const row = document.getElementById('cnr-' + focusId); if (!row) return; row.classList.add('flash'); row.scrollIntoView({ block: 'center' }); if (focus) { const i = row.querySelector('.cn-cnt'); if (i) { i.focus({ preventScroll: true }); i.select(); } } };
        go(true); requestAnimationFrame(() => go(false)); setTimeout(() => go(false), 350);   // بعد ظهور لوحة المفاتيح
    }
}
function cnRefreshTotals(r) {
    const e = document.getElementById('cnt-' + r.id), t = cnRowTotal(r); if (e) e.textContent = t === null ? '' : fmtNum(t);
    const tt = document.getElementById('cnTotal'); if (tt) tt.textContent = fmtNum(cnSum(cnCur.rows));
}
function cnRow(id) { return cnCur && cnCur.rows.find(r => r.id === id); }
function cnSetCnt(id, v) { const r = cnRow(id); if (!r) return; r.cnt = v === '' ? '' : String(Math.max(0, cnInt(v))); cnRefreshTotals(r); cnTouch(); }
function cnSetPrice(id, v) { const r = cnRow(id); if (!r) return; r.pe = true; r.price = v === '' ? '' : String(cnNum(v)); cnRefreshTotals(r); cnTouch(); }
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
        else if (pr > 0 && pr !== (parseFloat(p.price) || 0)) { p.price = pr; p.pricing = 'free'; p.markupPct = null; if (retail && !p.subManual) p.subPrice = subPriceCalc(pr, subCountOf(p)); priceChanged = true; }
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
    if (what === 'cnt') r.sq = part ? to.loose : to.qty;
    r.applied = new Date().toISOString(); cnTouch();
    const row = document.getElementById('cnr-' + r.id); if (row) { const s = row.querySelector('.cn-nm small'); if (s) s.textContent = (part ? subTypeOf(p) : 'قطعة كاملة') + ' • بالنظام: ' + (part ? to.loose : to.qty) + ' ✓'; }
}


// ---------- ضم مادتين أو أكثر تحت اسم واحد ----------
let cnMg = null;
function cnMgDraw() {
    const box = document.getElementById('cnMgSel'); if (!box) return;
    box.innerHTML = cnMg.ids.map(id => { const p = products.find(x => x.id === id); if (!p) return '';
        return `<div class="cn-mgr"><label><input type="radio" name="cnKeep" value="${id}" ${cnMg.keep === id ? 'checked' : ''} onchange="cnMg.keep=${id}"><span dir="ltr">${cnEsc(p.name)}<small>${cnEsc(stockLabel(p))}</small></span></label>${id !== cnMg.first ? `<button type="button" onclick="cnMgRemove(${id})" aria-label="إزالة">✕</button>` : ''}</div>`; }).join('');
}
function cnMgRemove(id) { cnMg.ids = cnMg.ids.filter(x => x !== id); if (cnMg.keep === id) cnMg.keep = cnMg.first; cnMgDraw(); }
function cnMgAdd(id) {
    if (!cnMg.ids.includes(id)) cnMg.ids.push(id);
    const q = document.getElementById('cnMgQ'); if (q) { q.value = ''; q.focus(); }
    document.getElementById('cnMgRes').innerHTML = ''; cnMgDraw();
}
async function cnMergeOpen(pid) {
    if (!can('stockEdit') && userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'الضم يحتاج صلاحية تعديل المواد.', confirmButtonColor: '#0f1c38' }); return; }
    cnMg = { ids: [pid], keep: pid, first: pid };
    const r = await Swal.fire({ title: 'ضم مواد', showCancelButton: true, confirmButtonText: 'ضمّ', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38', width: 'min(94vw, 520px)',
        html: `<div class="sw-form" style="text-align:right"><div class="bcp-search"><span>🔍</span><input id="cnMgQ" placeholder="ابحث عن مادة لإضافتها إلى الضم" autocomplete="off"></div><div id="cnMgRes" class="bcp-res"></div>
            <small>اختر الاسم الذي يبقى في المخزن (تنتقل إليه الكميات والباركودات والسجلات، وتُحذف البقية إلى سلة المحذوفات).</small><div id="cnMgSel"></div></div>`,
        didOpen: () => {
            cnMgDraw(); const inp = document.getElementById('cnMgQ'), res = document.getElementById('cnMgRes');
            inp.addEventListener('input', () => { const qn = normSearch(inp.value); if (!qn) { res.innerHTML = ''; return; } const toks = qn.split(' ');
                const list = products.filter(x => !cnMg.ids.includes(x.id)).map(x => [x, searchScore(x, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
                res.innerHTML = list.map(x => `<button type="button" class="cn-res" onclick="cnMgAdd(${x.id})"><span dir="ltr">${dispNameHtml(x)}</span><em>＋</em></button>`).join('') || '<div class="cn-none">لا توجد نتائج</div>'; }); },
        preConfirm: () => { if (cnMg.ids.length < 2) { Swal.showValidationMessage('أضف مادة واحدة على الأقل للضم'); return false; } return { ids: cnMg.ids.slice(), keep: cnMg.keep }; } });
    if (!r.isConfirmed || !r.value) return;
    const keep = products.find(x => x.id === r.value.keep), srcs = r.value.ids.filter(id => id !== r.value.keep).map(id => products.find(x => x.id === id)).filter(Boolean);
    if (!keep || !srcs.length) return;
    if (!(await askSure('تأكيد الضم', 'سيبقى «' + keep.name + '» وتُحذف ' + srcs.length + ' مادة بعد نقل كمياتها وسجلاتها إليه.', 'نعم، ضمّ'))) return;
    let ok = 0;
    for (const s of srcs) { if (await catMerge(s, keep, true)) { ok++; cnRepoint(s.id, keep.id); } else break; }
    cnTouch(); if (cnCur) cnListRender(); else if (cnPendOpen) cnPendRender();
    Swal.fire({ icon: ok === srcs.length ? 'success' : 'warning', title: ok === srcs.length ? 'تم الضم' : 'تم ضم ' + ok + ' من ' + srcs.length, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
}
function cnRepoint(from, to) {
    cnLists.forEach(l => {
        let ch = false; l.rows.forEach(r => { if (r.pid === from) { r.pid = to; ch = true; } });
        if (!ch) return;
        const seen = new Map();
        l.rows = l.rows.filter(r => { if (r.pid !== to) return true; const k = r.unit; const prev = seen.get(k); if (!prev) { seen.set(k, r); return true; } if (prev.cnt === '' && r.cnt !== '') { prev.cnt = r.cnt; prev.price = r.price || prev.price; } return false; });
        l.upd = new Date().toISOString(); if (l !== cnCur) cnPush(l);
    });
    cnStoreLocal();
}


// ---------- تعديل المادة وباركودها من سطر الجرد ----------
function cnCanEdit() { return userRole === 'owner' || can('stockEdit'); }
async function cnEditProduct(pid) {
    if (!cnCanEdit()) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'تعديل المادة يحتاج صلاحية تعديل المواد.', confirmButtonColor: '#0f1c38' }); return; }
    await catPrice(pid);
    if (cnCur) cnListRender(); else if (cnPendOpen) cnPendRender();
}
function cnRedraw() { if (cnCur) cnListRender(); else if (cnPendOpen) cnPendRender(); }
async function cnBarcode(pid) {
    const p = products.find(x => x.id === pid); if (!p) return;
    if (!cnCanEdit()) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'ربط الباركود يحتاج صلاحية تعديل المواد.', confirmButtonColor: '#0f1c38' }); return; }
    const add = () => openBarcodeScanner(async code => { await catAddCode(p, code); cnRedraw(); });
    const list = barcodesOf(p);
    if (!list.length) { add(); return; }
    const r = await Swal.fire({ title: 'باركودات المادة', showCancelButton: true, showDenyButton: true, confirmButtonText: '📷 إضافة باركود', denyButtonText: '🗑 حذف الباركودات', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><div class="sw-info" dir="ltr"><b>${cnEsc(p.name)}</b></div>${list.map(b => `<div class="sw-info" dir="ltr">▦ ${cnEsc(b)}</div>`).join('')}</div>` });
    if (r.isConfirmed) add();
    else if (r.isDenied) {
        if (!(await askSure('حذف باركودات المادة؟', p.name, 'حذف'))) return;
        const old = { barcodes: p.barcodes, barcode: p.barcode }; p.barcodes = []; p.barcode = '';
        if (!(await saveProductsDelta([{ p, dq: 0, dl: 0 }]))) { p.barcodes = old.barcodes; p.barcode = old.barcode; return; }
        logAction('edit', p, [{ f: 'باركود', from: list.join(' | '), to: '' }]); cnRedraw();
    }
}
async function cnDelProduct(pid) {
    const p = products.find(x => x.id === pid); if (!p) return;
    if (!cnCanEdit()) { Swal.fire({ icon: 'info', title: 'غير مصرّح', text: 'حذف المادة يحتاج صلاحية تعديل المواد.', confirmButtonColor: '#0f1c38' }); return; }
    if (!writesAllowed()) return;
    if (!(await askSure('حذف المادة من المخزن؟', p.name + ' — تنتقل إلى سلة المحذوفات ويمكن استعادتها خلال 30 يوماً.', 'نعم، احذف'))) return;
    try {
        await moveToTrash(p); logAction('delete', p, []);
        products = products.filter(x => x.id !== pid); saveLocal();
        if (isFirebaseReady && currentUser) { const b = db.batch(); b.delete(db.collection('pharmacy_products').doc(String(pid))); b.delete(db.collection('pharmacy_stock').doc(String(pid))); if (costSplitOn) b.delete(db.collection('pharmacy_cost').doc(String(pid))); await fsCommit(b); }
        try { renderAll(); } catch (e) { /* تجاهل */ }
        Swal.fire({ icon: 'success', title: 'حُذفت المادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1500 });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحذف', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
    cnRedraw();
}

// ---------- مواد المخزن التي لم تدخل قوائم الجرد ----------
let cnPendOpen = false, cnPendQ = '';
async function cnPending() {
    cnLists = cnLocal(); cnPendOpen = true; cnPendQ = ''; cnCur = null; cnPendRender();
    const before = cnLists.length; await cnLoad(); if (cnPendOpen && cnLists.length !== before) cnPendRender();
}
function cnPendItems() {
    const used = new Set(); cnLists.forEach(l => (l.rows || []).forEach(r => used.add(r.pid)));
    let arr = products.filter(p => !p.arch && !used.has(p.id));
    const qn = normSearch(cnPendQ);
    if (qn) { const toks = qn.split(' '); arr = arr.map(p => [p, searchScore(p, qn, toks)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
    else arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return arr;
}
function cnPendRender() {
    cnScr = 'pend';
    const arr = cnPendItems(), SHOW = 100, canE = cnCanEdit();
    const prevQ = document.getElementById('cnPQ'), keep = prevQ && document.activeElement === prevQ;
    document.getElementById('cnBox').innerHTML = `<div class="cn-head"><button type="button" class="cn-back" onclick="cnPendClose()" aria-label="رجوع">→</button><b>مواد لم تدخل قوائم الجرد</b><span>${fmtNum(arr.length)}</span></div>
        <div class="cn-bar"><input id="cnPQ" type="search" autocomplete="off" placeholder="ابحث عن مادة" value="${cnEsc(cnPendQ)}" oninput="cnPendQ=this.value;cnPendRender()"></div>
        <div class="cn-body">${arr.slice(0, SHOW).map(p => `<div class="cn-prow">
            <div class="cn-nm"><b dir="ltr">${dispNameHtml(p)}</b><small>بالمخزن: ${cnEsc(stockLabel(p))}${p.counted === true ? ' • <em class="cn-ok">مجرودة</em>' : ' • غير مجرودة'}</small></div>
            <div class="cn-pb"><button type="button" class="cn-pa" onclick="cnPendAdd(${p.id})">➕ للجرد</button><button type="button" class="cn-pm" ${canE ? '' : 'disabled'} onclick="cnMergeOpen(${p.id})">⇄ ضم</button><button type="button" class="cn-pd" ${canE ? '' : 'disabled'} onclick="cnDelProduct(${p.id})">🗑 حذف</button></div></div>`).join('') || '<div class="cn-empty">كل المواد دخلت قوائم الجرد.</div>'}
            ${arr.length > SHOW ? `<div class="cn-empty">يظهر أول ${SHOW} من ${fmtNum(arr.length)} — استعمل البحث.</div>` : ''}</div>`;
    if (keep) { const q = document.getElementById('cnPQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function cnPendClose() { cnPendOpen = false; cnHubRender(); }
async function cnPendAdd(pid) {
    const p = products.find(x => x.id === pid); if (!p) return;
    if (!cnLists.length) { Swal.fire({ icon: 'info', title: 'أنشئ قائمة جرد أولاً', text: 'ادخل «قوائم الجرد» وأنشئ قائمة ثم عد هنا.', confirmButtonColor: '#0f1c38' }); return; }
    if (p.counted === true && !(await askSure('المادة مجرودة سابقاً', 'هل تريد إضافتها إلى قائمة جرد رغم ذلك؟', 'نعم، أضفها'))) return;
    const retail = hasRetail(p);
    const r = await Swal.fire({ title: 'إضافة إلى قائمة جرد', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form" style="text-align:right"><div class="sw-info" dir="ltr"><b>${cnEsc(p.name)}</b></div>
            <label>القائمة<select id="cnAl" class="swal2-input" onchange="cnAlGroups()">${cnLists.map(l => `<option value="${l.id}">${cnEsc(l.name)}</option>`).join('')}</select></label>
            <label>المجموعة<select id="cnAg" class="swal2-input"></select></label>
            <label>عدد العلب<input id="cnAq" type="number" inputmode="numeric" min="0" class="swal2-input" value="${parseInt(p.qty) || 0}"></label>
            ${retail ? `<label>عدد الأجزاء (${cnEsc(subTypeOf(p))})<input id="cnAp" type="number" inputmode="numeric" min="0" class="swal2-input" value="${parseInt(p.loose) || 0}"></label>` : ''}</div>`,
        didOpen: () => cnAlGroups(),
        preConfirm: () => { const q = document.getElementById('cnAq').value, pp = retail ? document.getElementById('cnAp').value : ''; if (q === '') { Swal.showValidationMessage('أدخل عدد العلب'); return false; } return { lid: document.getElementById('cnAl').value, gid: document.getElementById('cnAg').value, q, pp }; } });
    if (!r.isConfirmed || !r.value) return;
    const l = cnLists.find(x => x.id === r.value.lid); if (!l) return;
    const prev = cnCur; cnCur = l;
    const rows = cnUnits(p).map(u => ({ id: cnId(), gid: r.value.gid, pid, unit: u, cnt: String(Math.max(0, cnInt(u === 'part' ? r.value.pp : r.value.q))), price: cnDefPrice(p, u) || '', ts: Date.now() }));
    l.rows.push(...rows); cnTouch();
    if (l.apply !== false) for (const row of rows) { await cnApplyRow(row, 'cnt'); }
    await cnPush(l); cnCur = prev;
    Swal.fire({ icon: 'success', title: 'أُضيفت إلى «' + l.name + '»', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
    cnPendRender();
}
function cnAlGroups() {
    const l = cnLists.find(x => x.id === document.getElementById('cnAl').value), g = document.getElementById('cnAg'); if (!l || !g) return;
    g.innerHTML = '<option value="">بدون مجموعة</option>' + (l.groups || []).map(x => `<option value="${x.id}">${cnEsc(x.name)}</option>`).join('');
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
    cnNormalize(l);
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
