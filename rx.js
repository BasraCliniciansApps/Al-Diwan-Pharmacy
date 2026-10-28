// =====================================================================
// الوصفات الإلكترونية (جهة الصيدلية): تصل من صفحة الطبيب إلى pharmacy_search_misses (kind:'r').
// كل إجراء هنا يُحدّث الوثيقة الخاصة ووثيقة عامة pharmacy/rx_<id> يتابعها جهاز الطبيب (بدون اسم المريض).
// =====================================================================
let rxRaw = [], rxFil = 'act', rxCurId = null;
const RX_ST = { new: 'جديدة', prep: 'قيد التجهيز', ready: 'جاهزة', done: 'مُسلَّمة' };
const RX_FIL = [['act', 'النشطة'], ['new', 'جديدة'], ['prep', 'قيد التجهيز'], ['ready', 'جاهزة'], ['done', 'مُسلَّمة']];
const rxE = s => escapeHtml(String(s == null ? '' : s));
const rxEl = () => document.getElementById('rxHub');
const rxSt = r => r.st || 'new';
function rxNewN() { return rxRaw.filter(r => rxSt(r) === 'new').length; }
function rxBadges() { const n = rxNewN(); document.querySelectorAll('.rx-badge').forEach(e => { e.textContent = n; e.style.display = n ? 'flex' : 'none'; }); }
function rxChanged() { rxBadges(); if (rxEl() && rxEl().style.display === 'flex') rxRender(); if (typeof docRenderAlertBox === 'function') { const v = document.getElementById('alertsView'); if (v && v.classList.contains('active')) docRenderAlertBox(false); } }
function rxAlertRow() {
    const n = rxNewN(), act = rxRaw.filter(r => rxSt(r) !== 'done').length; if (!act) return '';
    return `<button type="button" class="da-rx" onclick="rxOpen()"><span>📝 ${n ? 'لديك <b>' + fmtNum(n) + '</b> وصفة جديدة' : fmtNum(act) + ' وصفة قيد المتابعة'}</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>`;
}
function rxOpen() {
    let el = rxEl(); if (!el) { el = document.createElement('div'); el.id = 'rxHub'; el.className = 'tax-rv'; document.body.appendChild(el); }
    document.body.classList.add('doc-open'); el.style.display = 'flex'; rxCurId = null; rxFil = rxNewN() ? 'new' : 'act';
    if (typeof docStartWatch === 'function') docStartWatch();
    rxRender();
}
function rxClose() { document.body.classList.remove('doc-open'); const el = rxEl(); if (el) el.style.display = 'none'; rxCurId = null; }
const rxTime = t => { const d = new Date(t), h = d.getHours(); return d.getDate() + '/' + (d.getMonth() + 1) + ' ' + ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' ص' : ' م'); };
const rxLine = i => [i.dose, i.freq, i.dur, i.ins].filter(Boolean).join(' · ');
function rxRender() {
    const el = rxEl(); if (!el) return;
    const r = rxCurId && rxRaw.find(x => x.id === rxCurId);
    if (r) { rxDetail(el, r); return; }
    rxCurId = null;
    const cnt = k => k === 'act' ? rxRaw.filter(x => rxSt(x) !== 'done').length : rxRaw.filter(x => rxSt(x) === k).length;
    const rows = rxRaw.filter(x => rxFil === 'act' ? rxSt(x) !== 'done' : rxSt(x) === rxFil).sort((a, b) => b.ts - a.ts);
    el.innerHTML = `<div class="tr-head"><b>📝 الوصفات الإلكترونية</b><button type="button" class="tr-x" onclick="rxClose()" aria-label="إغلاق">✕</button></div>
    <div class="dh-body"><div class="rx-fs">${RX_FIL.map(f => `<button type="button" class="${rxFil === f[0] ? 'on' : ''}" onclick="rxSetFil('${f[0]}')">${f[1]} <em>${fmtNum(cnt(f[0]))}</em></button>`).join('')}</div>
    ${rows.map(x => `<button type="button" class="rx-c st-${rxSt(x)}" onclick="rxShow('${rxE(x.id)}')"><div><b dir="auto">${rxE(x.doctor)}</b><small>المريض: <bdi>${rxE(x.patient)}</bdi> · ${fmtNum((x.items || []).length)} ${(x.items || []).length > 2 && (x.items || []).length < 11 ? 'أدوية' : 'دواء'} · ${rxTime(x.ts)}</small></div><span class="rx-p">${RX_ST[rxSt(x)]}</span></button>`).join('') || '<div class="dh-note">لا توجد وصفات في هذا القسم.</div>'}</div>`;
}
function rxSetFil(k) { rxFil = k; rxRender(); }
function rxShow(id) { rxCurId = id; rxRender(); const b = document.querySelector('#rxHub .dh-body'); if (b) b.scrollTop = 0; }
function rxBack() { rxCurId = null; rxRender(); }
function rxDetail(el, r) {
    const is = r.is || {}, st = rxSt(r);
    el.innerHTML = `<div class="tr-head"><b>📝 وصفة ${rxE(r.num)}</b><button type="button" class="tr-x" onclick="rxBack()" aria-label="رجوع"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button></div>
    <div class="dh-body">
    <div class="dc-card"><div class="qk-row"><div><b dir="auto">${rxE(r.doctor)}</b><small>المريض: <bdi>${rxE(r.patient)}</bdi> · ${rxTime(r.ts)}</small></div><span class="rx-p">${RX_ST[st]}</span></div>
        ${r.dx ? `<div class="rx-note"><b>التشخيص: </b>${rxE(r.dx)}</div>` : ''}${r.note ? `<div class="rx-note">${rxE(r.note)}</div>` : ''}
        <div class="rx-bt"><button type="button" class="${st === 'prep' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','prep')">قيد التجهيز</button><button type="button" class="${st === 'ready' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','ready')">جاهزة</button><button type="button" class="${st === 'done' ? 'on' : ''}" onclick="rxSetSt('${rxE(r.id)}','done')">سُلِّمت</button></div></div>
    ${(r.items || []).map((i, k) => {
        const p = !i.ext && i.p ? products.find(x => String(x.id) === String(i.p)) : null, sk = is[k], stock = p ? (typeof isInStock === 'function' && isInStock(p)) : null;
        return `<div class="dc-card rx-i"><div class="qk-row"><div><b dir="auto">${rxE(i.n)}</b><small>${rxLine(i) ? rxE(rxLine(i)) : 'بلا جرعة'}</small></div>${i.ext ? '<span class="rx-p ex">خارج الصيدلية</span>' : stock === true ? '<span class="rx-p ok">في المخزن</span>' : stock === false ? '<span class="rx-p no">غير متوفر</span>' : ''}</div>
        <div class="rx-bt s"><button type="button" class="${sk && sk.s === 'ok' ? 'on ok' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'ok')">جاهز</button><button type="button" class="${sk && sk.s === 'no' ? 'on no' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'no')">غير متوفر</button><button type="button" class="${sk && sk.s === 'sub' ? 'on sub' : ''}" onclick="rxItem('${rxE(r.id)}',${k},'sub')">بديل${sk && sk.s === 'sub' ? ': ' + rxE(sk.sub) : ''}</button></div></div>`;
    }).join('')}
    <div class="dc-card"><div class="qk-row"><div><b>رد للطبيب</b><small>رسالة حرة تصله كإشعار.</small></div></div><div class="rx-rp"><input type="text" id="rxMsg" placeholder="اكتب الرد…" maxlength="160"><button type="button" onclick="rxReply('${rxE(r.id)}')">إرسال</button></div>
        ${(r.msgs || []).length ? `<div class="rx-ms">${(r.msgs || []).slice().reverse().slice(0, 12).map(m => `<div><span>${rxE(m.t)}</span><small>${rxTime(m.at)}</small></div>`).join('')}</div>` : ''}</div>
    <div class="dc-actions"><button type="button" onclick="rxPrint('${rxE(r.id)}')">🖨 طباعة</button><button type="button" onclick="rxDel('${rxE(r.id)}')">🗑 حذف الوصفة</button></div></div>`;
}
async function rxApply(id, fn) {
    const r = rxRaw.find(x => x.id === id); if (!r) return false;
    const ps = { st: rxSt(r), is: { ...(r.is || {}) }, msgs: [...(r.msgs || [])] }; fn(ps, r); ps.msgs = ps.msgs.slice(-40);
    try {
        await fsSet(db.collection('pharmacy_search_misses').doc(id), { st: ps.st, is: ps.is, msgs: ps.msgs }, { merge: true });
        await fsSet(db.collection('pharmacy').doc('rx_' + r.rid), { num: r.num, st: ps.st, is: ps.is, msgs: ps.msgs, upd: Date.now() });
        Object.assign(r, ps); rxBadges(); rxRender(); return true;
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر حفظ الإجراء', text: 'تحقق من الاتصال وحاول مرة أخرى.', confirmButtonColor: '#0f1c38' }); return false; }
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
function rxPrint(id) { const r = rxRaw.find(x => x.id === id); if (r) rxPrintNow({ num: r.num, doctor: r.doctor, patient: r.patient, dx: r.dx, items: r.items || [], note: r.note, at: r.ts }); }
async function rxDel(id) {
    const r = rxRaw.find(x => x.id === id); if (!r) return;
    if (!(await askSure('حذف الوصفة ' + r.num + '؟', 'ستُحذف الوصفة نهائياً ولن يصل الطبيب أي تحديث عنها.', 'حذف'))) return;
    try { await db.collection('pharmacy_search_misses').doc(id).delete(); try { await db.collection('pharmacy').doc('rx_' + r.rid).delete(); } catch (e) { /* تجاهل */ } rxRaw = rxRaw.filter(x => x.id !== id); rxCurId = null; rxBadges(); rxRender(); } catch (e) { /* تجاهل */ }
}
