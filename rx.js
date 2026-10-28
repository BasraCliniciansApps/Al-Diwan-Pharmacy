// =====================================================================
// الوصفات الإلكترونية (جهة الصيدلية): تصل من صفحة الطبيب إلى pharmacy_search_misses (kind:'r').
// كل إجراء هنا يُحدّث الوثيقة الخاصة ووثيقة عامة pharmacy/rx_<id> يتابعها جهاز الطبيب (بدون اسم المريض).
// =====================================================================
let rxRaw = [], rxRs = [], rxFil = 'act', rxCurId = null, rxTop = 'rx', rxDrKey = null;
const rxCleaned = new Set();
const RX_ST = { new: 'جديدة', prep: 'قيد التجهيز', ready: 'جاهزة', done: 'مُسلَّمة' };
const RX_FIL = [['act', 'النشطة'], ['new', 'جديدة'], ['prep', 'قيد التجهيز'], ['ready', 'جاهزة'], ['done', 'مُسلَّمة'], ['arch', 'المؤرشفة']];
const rxE = s => escapeHtml(String(s == null ? '' : s));
const rxEl = () => document.getElementById('rxHub');
const rxSt = r => r.st || 'new';
function rxPendRs() { return rxRs.filter(x => !x.issued && !x.claimed).length; }
function rxNewN() { return rxRaw.filter(r => !r.arch && rxSt(r) === 'new').length + rxPendRs(); }
function rxBadges() { const n = rxNewN(); document.querySelectorAll('.rx-badge').forEach(e => { e.textContent = n; e.style.display = n ? 'flex' : 'none'; }); }
function rxChanged() { rxClean(); rxBadges(); if (rxEl() && rxEl().style.display === 'flex') rxRender(); if (typeof docRenderAlertBox === 'function') { const v = document.getElementById('alertsView'); if (v && v.classList.contains('active')) docRenderAlertBox(false); } }
function rxAlertRow() {
    const n = rxNewN(), act = rxRaw.filter(r => !r.arch && rxSt(r) !== 'done').length; if (!act && !n) return '';
    return `<button type="button" class="da-rx" onclick="rxOpen()"><span>📝 ${n ? 'لديك <b>' + fmtNum(n) + '</b> وصفة جديدة' : fmtNum(act) + ' وصفة قيد المتابعة'}</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>`;
}
function rxOpen() {
    let el = rxEl(); if (!el) { el = document.createElement('div'); el.id = 'rxHub'; el.className = 'tax-rv'; document.body.appendChild(el); }
    document.body.classList.add('doc-open'); el.style.display = 'flex'; rxCurId = null; rxFil = rxNewN() ? 'new' : 'act';
    if (typeof docStartWatch === 'function') docStartWatch();
    rxRender();
}
function rxClose() { const el = rxEl(); if (el) el.style.display = 'none'; rxCurId = null; if (typeof docSyncOpen === 'function') docSyncOpen(); }
const rxTime = t => { const d = new Date(t), h = d.getHours(); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' ص' : ' م'); };
const rxLine = i => [i.dose, i.freq, i.dur, i.ins].filter(Boolean).join(' · ');
function rxRender() {
    const el = rxEl(); if (!el) return;
    const r = rxCurId && rxRaw.find(x => x.id === rxCurId);
    if (r) { rxDetail(el, r); return; }
    rxCurId = null;
    if (rxTop === 'dr') { rxDrRender(el); return; }
    const cnt = k => k === 'arch' ? rxRaw.filter(x => x.arch).length : k === 'act' ? rxRaw.filter(x => !x.arch && rxSt(x) !== 'done').length : rxRaw.filter(x => !x.arch && rxSt(x) === k).length;
    const rows = rxRaw.filter(x => rxFil === 'arch' ? x.arch : (!x.arch && (rxFil === 'act' ? rxSt(x) !== 'done' : rxSt(x) === rxFil))).sort((a, b) => b.ts - a.ts);
    el.innerHTML = `<div class="tr-head"><b>📝 الوصفات الإلكترونية</b><button type="button" class="tr-x" onclick="rxClose()" aria-label="إغلاق">✕</button></div>
    <div class="dh-body">${rxTopBar()}<div class="rx-fs">${RX_FIL.map(f => `<button type="button" class="${rxFil === f[0] ? 'on' : ''}" onclick="rxSetFil('${f[0]}')">${f[1]} <em>${fmtNum(cnt(f[0]))}</em></button>`).join('')}</div>
    ${rows.map(x => `<button type="button" class="rx-c st-${rxSt(x)}" onclick="rxShow('${rxE(x.id)}')"><div><b dir="auto">${rxE(x.doctor)}</b><small>المريض: <bdi>${rxE(x.patient)}</bdi> · ${fmtNum((x.items || []).length)} ${(x.items || []).length > 2 && (x.items || []).length < 11 ? 'أدوية' : 'دواء'} · ${rxTime(x.ts)}</small></div><span class="rx-p">${RX_ST[rxSt(x)]}</span></button>`).join('') || '<div class="dh-note">لا توجد وصفات في هذا القسم.</div>'}</div>`;
}
function rxSetFil(k) { rxFil = k; rxRender(); }
function rxShow(id) { rxCurId = id; rxRender(); const b = document.querySelector('#rxHub .dh-body'); if (b) b.scrollTop = 0; }
function rxBack() { rxCurId = null; rxRender(); }
function rxDetail(el, r) {
    const is = r.is || {}, st = rxSt(r);
    el.innerHTML = `<div class="tr-head"><b>📝 وصفة ${rxE(r.num)}</b><button type="button" class="tr-x" onclick="rxBack()" aria-label="رجوع"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button></div>
    <div class="dh-body">
    <div class="dc-card"><div class="qk-row"><div><b dir="auto">${rxE(r.doctor)}</b><small>المريض: <bdi>${rxE(r.patient)}</bdi>${r.phone ? ' · <bdi dir="ltr">' + rxE(r.phone) + '</bdi>' : ''} · ${rxTime(r.ts)}</small></div><span class="rx-p">${RX_ST[st]}</span></div>
        ${r.dx ? `<div class="rx-note"><b>التشخيص: </b>${rxE(r.dx)}</div>` : ''}${r.note ? `<div class="rx-note">${rxE(r.note)}</div>` : ''}
        <div class="rx-bt"><button type="button" class="${st === 'prep' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','prep')">قيد التجهيز</button><button type="button" class="${st === 'ready' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','ready')">جاهزة</button><button type="button" class="${st === 'done' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','done')">سُلِّمت</button></div></div>
    ${(r.items || []).map((i, k) => {
        const p = !i.ext && i.p ? products.find(x => String(x.id) === String(i.p)) : null, sk = is[k], stock = p ? (typeof isInStock === 'function' && isInStock(p)) : null;
        return `<div class="dc-card rx-i"><div class="qk-row"><div><b dir="auto">${rxE(i.n)}</b><small>${rxLine(i) ? rxE(rxLine(i)) : 'بلا جرعة'}</small></div>${i.ext ? '<span class="rx-p ex">خارج الصيدلية</span>' : stock === true ? '<span class="rx-p ok">في المخزن</span>' : stock === false ? '<span class="rx-p no">غير متوفر</span>' : ''}</div>
        <div class="rx-bt s"><button type="button" class="${sk && sk.s === 'ok' ? 'on ok' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'ok')">جاهز</button><button type="button" class="${sk && sk.s === 'no' ? 'on no' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'no')">غير متوفر</button><button type="button" class="${sk && sk.s === 'sub' ? 'on sub' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'sub')">بديل${sk && sk.s === 'sub' ? ': ' + rxE(sk.sub) : ''}</button></div></div>`;
    }).join('')}
    <div class="dc-card"><div class="qk-row"><div><b>رد للطبيب</b><small>رسالة حرة تصله كإشعار.</small></div></div><div class="rx-rp"><input type="text" id="rxMsg" placeholder="اكتب الرد…" maxlength="160"><button type="button" onclick="rxReply('${rxE(r.id)}')">إرسال</button></div>
        ${(r.msgs || []).length ? `<div class="rx-ms">${(r.msgs || []).slice().reverse().slice(0, 12).map(m => `<div><span>${rxE(m.t)}</span><small>${rxTime(m.at)}</small></div>`).join('')}</div>` : ''}</div>
    <div class="dc-actions"><button type="button" onclick="rxPrint('${rxE(r.id)}')">🖨 طباعة</button>${r.phone ? `<button type="button" onclick="rxWa('${rxE(r.id)}')" aria-label="إرسال واتساب" title="إرسال PDF عبر واتساب" style="display:inline-grid;place-items:center;color:#128c4a">${RX_WA_ICON.replace('<svg ','<svg width="20" height="20" ')}</button>` : ''}${r.arch ? `<button type="button" onclick="rxArchive('${rxE(r.id)}',false)">↩ إرجاع من الأرشيف</button><button type="button" onclick="rxDel('${rxE(r.id)}')">🗑 حذف نهائي</button>` : `<button type="button" onclick="rxArchive('${rxE(r.id)}',true)">🗄 أرشفة الوصفة</button>`}</div></div>`;
}
async function rxApply(id, fn) {
    const r = rxRaw.find(x => x.id === id); if (!r) return false;
    const ps = { st: rxSt(r), is: { ...(r.is || {}) }, msgs: [...(r.msgs || [])] }; fn(ps, r); ps.msgs = ps.msgs.slice(-40);
    const h = Prog.start('تحديث الوصفة ' + (r.num || ''), { text: 'حفظ في السحابة...' });
    try {
        await fsSet(db.collection('pharmacy_search_misses').doc(id), { st: ps.st, is: ps.is, msgs: ps.msgs }, { merge: true }); h.set(55, 'إشعار الطبيب...');
        await fsSet(db.collection('pharmacy').doc('rx_' + r.rid), { num: r.num, st: ps.st, is: ps.is, msgs: ps.msgs, upd: Date.now() });
        Object.assign(r, ps); rxBadges(); rxRender(); h.ok('تم حفظ الإجراء'); return true;
    } catch (e) { h.fail('تعذر حفظ الإجراء', 'تحقق من الاتصال وحاول مرة أخرى.'); return false; }
}
const rxMsg = (ps, k, t) => ps.msgs.push({ at: Date.now(), k, t });
function rxSetSt(id, st) {
    rxApply(id, (ps, r) => { if (ps.st === st) return; ps.st = st; rxMsg(ps, st, st === 'prep' ? 'الوصفة ' + r.num + ' قيد التجهيز' : st === 'ready' ? 'الوصفة ' + r.num + ' جاهزة للاستلام' : 'سُلِّمت الوصفة ' + r.num + ' للمريض'); });
}
async function rxItem(id, k, s) {
    const r = rxRaw.find(x => x.id === id); if (!r) return; const it = r.items[k]; let sub = '';
    if (s === 'sub') {
        const a = await Swal.fire({ title: 'اسم البديل', input: 'text', inputPlaceholder: 'اسم الدواء البديل', showCancelButton: true, confirmButtonText: 'حفظ', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38', inputValidator: v => (v || '').trim() ? null : 'اكتب اسم البديل' });
        if (!a.isConfirmed) return; sub = a.value.trim();
    }
    rxApply(id, (ps) => {
        ps.is[k] = s === 'sub' ? { s, sub } : { s };
        if (ps.st === 'new') { ps.st = 'prep'; }
        rxMsg(ps, s, s === 'ok' ? 'تم تجهيز «' + it.n + '»' : s === 'no' ? 'لم يُجهَّز «' + it.n + '» لعدم توفره' : 'تم تجهيز بديل عن «' + it.n + '»: «' + sub + '»');
    });
}
async function rxReply(id) {
    const i = document.getElementById('rxMsg'), t = i ? i.value.trim() : ''; if (!t) return;
    if (await rxApply(id, ps => rxMsg(ps, 'msg', 'رد الصيدلية: ' + t))) { /* تم */ }
}
function rxPrint(id) { const r = rxRaw.find(x => x.id === id); if (r) rxPrintNow({ num: r.num, doctor: r.doctor, patient: r.patient, phone: r.phone, clinic: r.clinic, dx: r.dx, items: r.items || [], note: r.note, at: r.ts }); }
async function rxDel(id) {
    const x = rxRaw.find(q => q.id === id); if (!x) return;
    if (!(await askSure('حذف الوصفة ' + x.num + ' نهائياً؟', 'ستُحذف من سجل الطبيب عندك نهائياً ولا يمكن استرجاعها. الأفضل الأرشفة.', 'حذف نهائي'))) return;
    const h = Prog.start('حذف الوصفة ' + (x.num || ''), { text: 'حذف من السحابة...' });
    try { await db.collection('pharmacy_search_misses').doc(id).delete(); try { await db.collection('pharmacy').doc('rx_' + x.rid).delete(); } catch (e) { /* تجاهل */ } rxRaw = rxRaw.filter(q => q.id !== id); rxCurId = null; rxBadges(); rxRender(); h.ok('تم حذف الوصفة'); } catch (e) { h.fail('تعذر الحذف', 'تحقق من الاتصال وحاول مرة أخرى.'); }
}
async function rxArchive(id, on) {
    const x = rxRaw.find(q => q.id === id); if (!x) return;
    if (on && !(await askSure('أرشفة الوصفة ' + x.num + '؟', 'تختفي من القائمة وتبقى محفوظة في سجل الطبيب وتُرجَع له عند الاسترجاع.', 'أرشفة'))) return;
    const h = Prog.start(on ? 'أرشفة الوصفة ' + (x.num || '') : 'إرجاع الوصفة من الأرشيف', { text: 'حفظ في السحابة...' });
    try { await fsSet(db.collection('pharmacy_search_misses').doc(id), { arch: !!on }, { merge: true }); x.arch = !!on; rxCurId = null; rxBadges(); rxRender(); h.ok(on ? 'تمت الأرشفة' : 'تم الإرجاع من الأرشيف'); } catch (e) { h.fail('تعذر الحفظ', 'تحقق من الاتصال وحاول مرة أخرى.'); }
}

// ---------- الأطباء وسجلاتهم + استرجاع السجل ----------
const rxNormN = s => String(s || '').replace(/^\s*د\.?\s*/, '').trim().toLowerCase();
const rxKeyOf = r => r.did || 'n:' + rxNormN(r.doctor);
function rxDoctors() {
    const m = new Map(); rxRaw.forEach(r => { const k = rxKeyOf(r); if (!m.has(k)) m.set(k, { key: k, did: r.did || '', list: [] }); m.get(k).list.push(r); });
    return [...m.values()].map(g => { g.list.sort((a, b) => b.ts - a.ts); g.name = g.list[0].doctor; g.last = g.list[0].ts; return g; }).sort((a, b) => b.last - a.last);
}
const RX_IC_EXP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>', RX_IC_IMP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M5 21h14"/></svg>';
function rxExport() {
    if (!rxRaw.length) { Swal.fire({ icon: 'info', title: 'لا توجد وصفات لتصديرها', confirmButtonColor: '#0f1c38' }); return; }
    const h = Prog.start('تصدير نسخة الوصفات', { text: 'تجهيز الملف...' });
    const d = new Date(), f = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const blob = new Blob([JSON.stringify({ app: 'diwan-rx-admin', v: 1, recs: rxRaw })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'diwan-rx-pharmacy-backup-' + f + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); h.ok('تم تصدير ' + fmtNum(rxRaw.length) + ' وصفة');
}
async function rxImportFile(file) {
    const h = Prog.start('استيراد الوصفات', { indeterminate: false, text: 'قراءة الملف...' });
    try {
        const o = JSON.parse(await file.text());
        if (!o || o.app !== 'diwan-rx-admin' || !Array.isArray(o.recs)) { h.fail('الملف ليس نسخة احتياطية صالحة'); return; }
        const have = new Set(rxRaw.map(x => x.rid)), add = o.recs.filter(x => x && x.rid && x.patient && !have.has(x.rid));
        if (!add.length) { h.ok('لا توجد وصفات جديدة في الملف'); return; }
        for (let i = 0; i < add.length; i += 400) { const b = db.batch(); add.slice(i, i + 400).forEach(x => b.set(db.collection('pharmacy_search_misses').doc('rx_' + x.rid), { dr: 1, kind: 'r', rid: x.rid, did: x.did || '', num: x.num || '', doctor: x.doctor || '', patient: x.patient, clinic: x.clinic || null, dx: x.dx || '', note: x.note || '', items: x.items || [], st: x.st || 'new', is: x.is || {}, msgs: x.msgs || [], arch: !!x.arch, count: 1, name: x.patient, lastAt: new Date(x.ts || Date.now()).toISOString() })); await b.commit(); h.tick(Math.min(i + 400, add.length), add.length, 'رفع الوصفات...'); }
        h.ok('تم استيراد ' + fmtNum(add.length) + ' وصفة');
    } catch (e) { h.fail('تعذر الاستيراد', 'تحقق من الملف والاتصال.'); }
}
function rxBackupBtns() {
    return `<div class="rx-bk"><button type="button" onclick="rxExport()" aria-label="نسخ احتياطي (تصدير)" title="نسخ احتياطي (تصدير)">${RX_IC_EXP}</button><button type="button" onclick="document.getElementById('rxImpF').value='';document.getElementById('rxImpF').click()" aria-label="استرجاع (استيراد)" title="استرجاع (استيراد)">${RX_IC_IMP}</button><input type="file" id="rxImpF" accept=".json,application/json" hidden onchange="if(this.files[0])rxImportFile(this.files[0])"></div>`;
}
function rxTopBar() {
    const pn = rxPendRs();
    return `<div class="rx-tr">${rxBackupBtns()}<div class="rx-top"><button type="button" class="${rxTop === 'rx' ? 'on' : ''}" onclick="rxSetTop('rx')">الوصفات</button><button type="button" class="${rxTop === 'dr' ? 'on' : ''}" onclick="rxSetTop('dr')">الأطباء${pn ? ` <i>${fmtNum(pn)}</i>` : ''}</button></div></div>`;
}
function rxSetTop(t) { rxTop = t; rxDrKey = null; rxCurId = null; rxRender(); }
function rxCard(x) { return `<button type="button" class="rx-c st-${rxSt(x)}" onclick="rxShow('${rxE(x.id)}')"><div><b dir="auto">${rxE(x.patient)}</b><small>${fmtNum((x.items || []).length)} ${(x.items || []).length > 2 && (x.items || []).length < 11 ? 'أدوية' : 'دواء'} · ${rxTime(x.ts)}${x.arch ? ' · مؤرشفة' : ''}</small></div><span class="rx-p">${RX_ST[rxSt(x)]}</span></button>`; }
function rxDrRender(el) {
    const docs = rxDoctors(), g = rxDrKey && docs.find(d => d.key === rxDrKey);
    if (g) {
        el.innerHTML = `<div class="tr-head"><b>🩺 ${rxE(g.name)}</b><button type="button" class="tr-x" onclick="rxDrBack()" aria-label="رجوع"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button></div>
        <div class="dh-body"><div class="dc-card"><div class="qk-row"><div><b>سجل الطبيب</b><small>${fmtNum(g.list.length)} وصفة · آخر وصفة ${rxTime(g.last)}${g.did ? '' : ' · بلا رقم سجل (وصفات قديمة)'}</small></div></div>
        <div class="dc-actions"><button type="button" onclick="rxMerge('${rxE(g.key)}')">🔗 دمج مع طبيب آخر</button></div></div>${g.list.map(rxCard).join('')}</div>`;
        return;
    }
    const pend = rxRs.filter(x => !x.claimed).sort((a, b) => b.ts - a.ts);
    el.innerHTML = `<div class="tr-head"><b>📝 الوصفات الإلكترونية</b><button type="button" class="tr-x" onclick="rxClose()" aria-label="إغلاق">✕</button></div>
    <div class="dh-body">${rxTopBar()}
    ${pend.length ? `<div class="dc-card"><div class="qk-row"><div><b>طلبات استرجاع السجل (${fmtNum(pend.length)})</b><small>اختر سجل الطبيب ثم «إرجاع السجل» ليظهر لك رمز تعطيه له.</small></div></div>${pend.map(q => {
        const nn = rxNormN(q.name), best = (docs.find(d => rxNormN(d.name) === nn) || docs.find(d => rxNormN(d.name).includes(nn) || nn.includes(rxNormN(d.name))) || {}).key;
        return `<div class="rx-rs"><div><b dir="auto">${rxE(q.name)}</b><small>${rxTime(q.ts)} · ${q.issued ? 'صدر الرمز، بانتظار الاستلام' : 'بانتظار الإرجاع'}</small></div>
        <select id="rsSel_${rxE(q.rid)}">${docs.map(d => `<option value="${rxE(d.key)}" ${d.key === best ? 'selected' : ''}>${rxE(d.name)} (${fmtNum(d.list.length)})</option>`).join('')}</select>
        <div class="rx-bt s" style="grid-template-columns:2fr 1fr"><button type="button" class="on" onclick="rxIssue('${rxE(q.rid)}')">${q.issued ? 'رمز جديد' : 'إرجاع السجل'}</button><button type="button" onclick="rxRsDel('${rxE(q.rid)}')">حذف</button></div></div>`; }).join('')}</div>` : ''}
    ${docs.map(d => `<button type="button" class="rx-c" onclick="rxDrOpen('${rxE(d.key)}')"><div><b dir="auto">${rxE(d.name)}</b><small>${fmtNum(d.list.length)} وصفة · آخر وصفة ${rxTime(d.last)}</small></div><span class="rx-p">سجل</span></button>`).join('') || '<div class="dh-note">لا توجد سجلات أطباء بعد. تظهر هنا بعد أول وصفة.</div>'}</div>`;
}
function rxDrOpen(k) { rxDrKey = k; rxRender(); const b = document.querySelector('#rxHub .dh-body'); if (b) b.scrollTop = 0; }
function rxDrBack() { rxDrKey = null; rxRender(); }
const rxNewDid = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(36).padStart(2, '0')).join('') + Date.now().toString(36);
async function rxSetDid(list, did) {
    for (let i = 0; i < list.length; i += 400) { const b = db.batch(); list.slice(i, i + 400).forEach(x => b.set(db.collection('pharmacy_search_misses').doc(x.id), { did }, { merge: true })); await b.commit(); }
    list.forEach(x => { x.did = did; });
}
async function rxIssue(rid) {
    const sel = document.getElementById('rsSel_' + rid), g = sel && rxDoctors().find(d => d.key === sel.value), q = rxRs.find(x => x.rid === rid); if (!g || !q) return;
    const h = Prog.start('تجهيز سجل الطبيب ' + g.name, { text: 'تجهيز الوصفات...' });
    try {
        let did = g.did; if (!did) { did = rxNewDid(); await rxSetDid(g.list, did); }
        h.set(25, 'تشفير السجل...');
        let recs = g.list.map(x => ({ rid: x.rid, num: x.num, doctor: x.doctor, patient: x.patient, phone: x.phone, clinic: x.clinic, dx: x.dx, note: x.note, items: x.items || [], at: x.ts }));
        const code = String(100000 + Math.floor(Math.random() * 900000));
        let enc = await rxEncrypt(code, rid, { did, name: g.name, recs });
        while (enc.data.length > 900000 && recs.length > 10) { recs = recs.slice(0, Math.floor(recs.length * 0.8)); enc = await rxEncrypt(code, rid, { did, name: g.name, recs }); }
        h.set(60, 'رفع النسخة المشفّرة...');
        await fsSet(db.collection('pharmacy').doc('rxh_' + rid), { iv: enc.iv, data: enc.data, name: g.name, upd: Date.now() });
        await fsSet(db.collection('pharmacy_search_misses').doc(q.id), { issued: true }, { merge: true }); q.issued = true;
        rxBadges(); rxRender(); h.ok('تم تجهيز السجل');
        Swal.fire({ icon: 'success', title: 'رمز الاسترجاع', html: `<div style="font-size:2.4rem;font-weight:900;letter-spacing:8px;direction:ltr;margin:6px 0">${code}</div><div style="font-size:.85rem;color:#475569;line-height:1.7">أعطِ هذا الرمز للطبيب (<b>${rxE(g.name)}</b>) ليدخله بجهازه الجديد.<br>يحتوي ${fmtNum(recs.length)} وصفة.</div>`, confirmButtonColor: '#0f1c38', confirmButtonText: 'تم' });
    } catch (e) { h.fail('تعذر إرجاع السجل', 'تحقق من الاتصال وحاول مرة أخرى.'); }
}
async function rxRsDel(rid) {
    const q = rxRs.find(x => x.rid === rid); if (!q) return;
    if (!(await askSure('حذف طلب الاسترجاع؟', 'سيُحذف الطلب وأي رمز صادر له.', 'حذف'))) return;
    const h = Prog.start('حذف طلب الاسترجاع', { text: 'حذف من السحابة...' });
    try { await db.collection('pharmacy_search_misses').doc(q.id).delete(); try { await db.collection('pharmacy').doc('rxh_' + rid).delete(); } catch (e) { /* تجاهل */ } rxRs = rxRs.filter(x => x.rid !== rid); rxBadges(); rxRender(); h.ok('تم حذف الطلب'); } catch (e) { h.fail('تعذر الحذف', 'تحقق من الاتصال وحاول مرة أخرى.'); }
}
async function rxMerge(key) {
    const docs = rxDoctors(), g = docs.find(d => d.key === key), others = docs.filter(d => d.key !== key); if (!g) return;
    if (!others.length) { Swal.fire({ icon: 'info', title: 'لا يوجد طبيب آخر للدمج', confirmButtonColor: '#0f1c38' }); return; }
    const a = await Swal.fire({ title: 'دمج مع طبيب آخر', text: 'ستنتقل وصفات «' + g.name + '» إلى السجل المختار.', input: 'select', inputOptions: Object.fromEntries(others.map(d => [d.key, d.name + ' (' + fmtNum(d.list.length) + ')'])), inputPlaceholder: 'اختر السجل', showCancelButton: true, confirmButtonText: 'دمج', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38', inputValidator: v => v ? null : 'اختر السجل' });
    if (!a.isConfirmed) return;
    if (!(await askSure('تأكيد الدمج؟', 'لا يمكن فصل السجلين بعد الدمج.', 'دمج'))) return;
    const t = others.find(d => d.key === a.value); if (!t) return;
    const h = Prog.start('دمج سجلات الأطباء', { text: 'تحديث الوصفات...' });
    try { let did = t.did; if (!did) { did = rxNewDid(); await rxSetDid(t.list, did); } await rxSetDid(g.list, did); rxDrKey = null; rxRender(); h.ok('تم دمج السجلين'); } catch (e) { h.fail('تعذر الدمج', 'تحقق من الاتصال وحاول مرة أخرى.'); }
}
// تنظيف طلبات الاسترجاع بعد استلام الطبيب لسجله
async function rxClean() {
    for (const q of rxRs.filter(x => x.claimed && !rxCleaned.has(x.id))) {
        rxCleaned.add(x0 = q.id);
        try { await db.collection('pharmacy').doc('rxh_' + q.rid).delete(); } catch (e) { /* تجاهل */ }
        try { await db.collection('pharmacy_search_misses').doc(q.id).delete(); } catch (e) { /* تجاهل */ }
    }
}
let x0 = '';

function rxWa(id) { const r = rxRaw.find(q => q.id === id); if (r) rxShareWa({ num: r.num, doctor: r.doctor, patient: r.patient, phone: r.phone, clinic: r.clinic, dx: r.dx, items: r.items || [], note: r.note, at: r.ts }, () => { }); }
