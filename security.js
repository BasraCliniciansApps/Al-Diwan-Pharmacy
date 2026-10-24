// الأمان: فصل التكلفة إلى مجموعة pharmacy_cost المقفلة على المالك (ثم الأدوار والمستخدمون)
const COST_RULE = `match /pharmacy_cost/{id} {
  allow read, write: if request.auth != null && request.auth.uid == "VrZUN6AMvTPMklvhlZcwKlqJciY2";
}`;
function costLeftovers() { return Object.entries(stockMap).filter(([, s]) => s && COST_FIELDS.some(f => f in s)).map(([id]) => id); }
async function openCostSplit() {
    try { closeCategoryManager(); } catch (e) { /* تجاهل */ }
    if (!currentUser || !isFirebaseReady) { Swal.fire({ icon: 'error', title: 'سجّل الدخول أولاً', confirmButtonColor: '#0f1c38' }); return; }
    const withCost = products.filter(p => parseFloat(p.costPrice) > 0 || p.lastPurchase || parseFloat(p.markupPct) > 0).length;
    const left = costLeftovers().length;
    const state = !costSplitOn ? 'غير مفعّل' : left ? 'مفعّل — بقي ' + left + ' مستند فيه تكلفة في المكان القديم' : 'مفعّل ومؤمَّن ✅';
    const r = await Swal.fire({
        title: 'فصل سعر الشراء (التكلفة)', showCancelButton: true, cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38',
        showConfirmButton: !costSplitOn || left > 0, confirmButtonText: !costSplitOn ? '① نسخ وتفعيل' : '② تأمين: حذف من المكان القديم',
        html: `<div class="sw-form"><div class="sw-info">الحالة: <b>${state}</b><br>أصناف لها تكلفة: <b>${fmtNum(withCost)}</b></div>
            <small>الخطوة ①: تُنزَّل نسخة كاملة، ثم تُنسخ التكلفة وآخر وارد ونسبة الربح إلى مجموعة مقفلة عليك. لا يتغير شيء في عملك.<br>الخطوة ②: بعد أن تتأكد أن كل شيء ظاهر كما كان، تُحذف هذه الحقول من المكان القديم، فلا يراها أي مستخدم آخر مستقبلاً.</small>
            ${costSplitOn ? '' : '<small>تحتاج أولاً أن تضيف هذه القاعدة في Firebase ← Firestore ← Rules داخل match /databases/{database}/documents، ثم Publish:</small><div class="sw-info" dir="ltr" style="font-size:.7rem;white-space:pre-wrap;text-align:left">' + escapeHtml(COST_RULE) + '</div>'}</div>` });
    if (!r.isConfirmed) return;
    if (!costSplitOn) await costSplitStep1(); else await costSplitStep2();
}
async function costSplitStep1() {
    if (!requireOnline() || !writesAllowed()) return;
    Swal.fire({ title: 'جاري النسخ...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        await downloadFile('diwan-before-cost-split-' + todayStamp() + '.json', JSON.stringify(buildFullBackup()), 'application/json');
        try { await db.collection('pharmacy_cost').doc('_meta').set({ on: false, test: true }); }
        catch (e) { Swal.fire({ icon: 'error', title: 'القاعدة غير مضافة بعد', html: 'أضف هذه القاعدة في Firebase ثم أعد المحاولة:<div class="sw-info" dir="ltr" style="font-size:.7rem;white-space:pre-wrap;text-align:left">' + escapeHtml(COST_RULE) + '</div>', confirmButtonColor: '#0f1c38' }); return; }
        const docs = products.map(p => { const o = { id: p.id }; COST_FIELDS.forEach(f => { if (p[f] !== undefined && p[f] !== null) o[f] = p[f]; }); return o; });
        for (let i = 0; i < docs.length; i += 20) {
            const b = db.batch();
            docs.slice(i, i + 20).forEach(o => b.set(db.collection('pharmacy_cost').doc(String(o.id)), JSON.parse(JSON.stringify(o))));
            await fsCommit(b);
        }
        const snap = await db.collection('pharmacy_cost').get();
        const n = snap.docs.filter(d => d.id !== '_meta').length;
        if (n < docs.length) throw new Error('عدد المستندات المنسوخة ' + n + ' أقل من المتوقع ' + docs.length);
        await db.collection('pharmacy_cost').doc('_meta').set({ on: true, at: new Date().toISOString(), count: n });
        costSplitOn = true; docs.forEach(o => { costMap[String(o.id)] = o; });
        Swal.fire({ icon: 'success', title: 'تم نسخ التكلفة', html: 'نُسخ <b>' + fmtNum(n) + '</b> صنفاً إلى المكان المقفل.<br>تصفّح التطبيق وتأكد أن الأسعار وآخر وارد كما هي، ثم نفّذ الخطوة ② من نفس الزر.', confirmButtonColor: '#0f1c38' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الإكمال', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
}
async function costSplitStep2() {
    if (!requireOnline() || !writesAllowed()) return;
    const ids = costLeftovers(), F = fv(); if (!F) return;
    const c = await Swal.fire({ icon: 'warning', title: 'تأمين التكلفة؟', text: 'ستُحذف التكلفة من المكان القديم لـ ' + ids.length + ' مستند. تأكد أنك رأيت الأسعار وآخر وارد سليمة في التطبيق.', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، أمّن', cancelButtonText: 'إلغاء' });
    if (!c.isConfirmed) return;
    Swal.fire({ title: 'جاري التأمين...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        for (let i = 0; i < ids.length; i += 20) {
            const b = db.batch();
            ids.slice(i, i + 20).forEach(id => { const u = {}; COST_FIELDS.forEach(f => { u[f] = F.delete(); }); b.update(db.collection('pharmacy_stock').doc(id), u); });
            await fsCommit(b);
        }
        ids.forEach(id => { if (stockMap[id]) COST_FIELDS.forEach(f => { delete stockMap[id][f]; }); });
        Swal.fire({ icon: 'success', title: 'تم التأمين', text: 'صارت التكلفة في مجموعة مقفلة عليك فقط.', confirmButtonColor: '#0f1c38' });
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر التأمين', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
}

// ============================================================================
// المستخدمون والصلاحيات
// كل موظف حساب Firebase حقيقي (بريد داخلي + رمز سري)، وصلاحياته في pharmacy_users/{uid}،
// وقواعد Firestore (firestore.rules) هي التي تفرضها فعلاً، والواجهة تُخفي الأزرار فقط.
// ============================================================================
const PERM_LABELS = { sell: 'إصدار الفواتير (البيع)', stockView: 'عرض المخزن والكميات', stockEdit: 'تعديل المواد والكميات والجرد', purchases: 'الوارد والمذاخر والسجلات', catalog: 'سجل الأدوية (تسعير وكميات وإضافة سريعة — يشمل تعديل المواد)' };
const PERM_PRESETS = { seller: { sell: true, stockView: true }, manager: { sell: true, stockView: true, stockEdit: true, catalog: true } };
function loginKey(n) { return String(n || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[\/#?\[\]\.]/g, ''); }

async function resolveRole(user) {
    userRole = 'staff'; userPerms = {}; userName = '';
    if (user.uid === OWNER_UID) { userRole = 'owner'; userName = 'المالك'; return true; }
    let doc = null;
    try { const s = await db.collection('pharmacy_users').doc(user.uid).get(); doc = s.exists ? s.data() : null; } catch (e) { doc = null; }
    if (!doc || doc.active === false) {
        try { await auth.signOut(); } catch (e) { /* تجاهل */ }
        currentUser = null; document.body.classList.remove('admin-mode', 'role-staff');
        showView('login');
        const err = document.getElementById('gateError'); if (err) { err.innerText = doc ? 'هذا الحساب معطّل. راجع المالك.' : 'هذا الحساب غير مفعّل في النظام. راجع المالك.'; err.style.display = 'block'; }
        return false;
    }
    userPerms = doc.perms || {}; userName = doc.name || '';
    return true;
}
function applyRoleUI() {
    const b = document.body;
    b.classList.toggle('role-staff', userRole !== 'owner');
    Object.keys(PERM_LABELS).forEach(p => b.classList.toggle('can-' + p.toLowerCase(), can(p)));
    const t = document.querySelector('#homeView .page-title');
    if (t) t.textContent = userRole === 'owner' ? '🏠 الرئيسية' : '👤 ' + userName;
}

// ---------- إدارة المستخدمين (للمالك) ----------
function secAuth() {
    const app = firebase.apps.find(a => a.name === 'sec') || firebase.initializeApp(firebaseConfig, 'sec');
    return app.auth();
}
const permBoxes = (cur) => Object.keys(PERM_LABELS).map(p => `<label class="pu-chk"><input type="checkbox" class="uPerm" data-p="${p}" ${cur && cur[p] ? 'checked' : ''}><span>${PERM_LABELS[p]}</span></label>`).join('');
const readPerms = () => { const o = {}; document.querySelectorAll('.uPerm').forEach(c => { if (c.checked) o[c.dataset.p] = true; }); if (o.catalog) o.stockEdit = true; if (o.sell || o.stockEdit || o.purchases) o.stockView = true; return o; };
let usersCache = [];
async function openUsers() {
    try { closeCategoryManager(); } catch (e) { /* تجاهل */ }
    if (userRole !== 'owner') return;
    if (!requireOnline()) return;
    let rows = '';
    try {
        const snap = await db.collection('pharmacy_users').get(); usersCache = [];
        snap.forEach(d => usersCache.push({ uid: d.id, ...d.data() }));
        rows = usersCache.map(u => `<div class="bill-card ${u.active === false ? 'is-closed' : ''}" style="text-align:right"><div class="bill-card-main" onclick="Swal.close();userEdit('${u.uid}')"><b>${escapeHtml(u.name)}</b>${u.active === false ? '<em class="tg bad">معطّل</em>' : ''}<small>${Object.keys(u.perms || {}).filter(p => PERM_LABELS[p] && p !== 'stockView').map(p => PERM_LABELS[p]).join(' • ') || 'عرض فقط'}</small></div><button type="button" class="bill-tb-btn" onclick="Swal.close();userEdit('${u.uid}')">تعديل</button></div>`).join('') || '<div class="bill-none">لا يوجد مستخدمون بعد.</div>';
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر قراءة المستخدمين', html: 'أضف قواعد المستخدمين في Firebase أولاً (ملف firestore.rules).<br><small>' + escapeHtml(e.message || '') + '</small>', confirmButtonColor: '#0f1c38' }); return; }
    Swal.fire({ title: 'المستخدمون والصلاحيات', showConfirmButton: true, confirmButtonText: '➕ إضافة مستخدم', showCancelButton: true, cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', html: '<div class="sw-form">' + rows + '</div>' }).then(r => { if (r.isConfirmed) userAdd(); });
}
async function userAdd() {
    const r = await Swal.fire({ title: 'مستخدم جديد', showCancelButton: true, confirmButtonText: 'إنشاء', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><label>الاسم (يدخل به)<input id="uName" class="swal2-input"></label><label>الرمز السري (6 خانات فأكثر)<input id="uPin" class="swal2-input" dir="ltr" autocomplete="off"></label><small>الصلاحيات:</small>${permBoxes(PERM_PRESETS.seller)}</div>`,
        preConfirm: () => { const n = document.getElementById('uName').value.trim(), pin = document.getElementById('uPin').value.trim(); if (!n) { Swal.showValidationMessage('اكتب الاسم'); return false; } if (pin.length < 6) { Swal.showValidationMessage('الرمز 6 خانات على الأقل'); return false; } return { n, pin, perms: readPerms() }; } });
    if (!r.isConfirmed || !r.value) return;
    await userCreate(r.value.n, r.value.pin, r.value.perms);
    openUsers();
}
async function userCreate(name, pin, perms, replaceUid) {
    const key = loginKey(name);
    Swal.fire({ title: 'جاري الإنشاء...', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
    try {
        const ex = await db.collection('pharmacy_logins').doc(key).get();
        if (ex.exists && !replaceUid) throw new Error('الاسم مستخدم. اختر اسماً آخر.');
        const email = Math.random().toString(36).slice(2, 10) + Date.now().toString(36) + '@diwan.local';
        const sa = secAuth();
        const cred = await sa.createUserWithEmailAndPassword(email, pin);
        const uid = cred.user.uid; await sa.signOut();
        await db.collection('pharmacy_users').doc(uid).set({ name, login: key, email, perms, active: true, createdAt: new Date().toISOString() });
        await db.collection('pharmacy_logins').doc(key).set({ email });
        if (replaceUid) { try { await db.collection('pharmacy_users').doc(replaceUid).delete(); } catch (e) { /* تجاهل */ } }
        Swal.close();
        Swal.fire({ icon: 'success', title: 'تم', text: 'يدخل ' + name + ' من نفس صفحة الدخول باسمه ورمزه.', toast: true, position: 'bottom', showConfirmButton: false, timer: 2500 });
        return true;
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر الإنشاء', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' });
        return false;
    }
}
async function userEdit(uid) {
    const u = usersCache.find(x => x.uid === uid); if (!u) return;
    const r = await Swal.fire({ title: 'تعديل ' + escapeHtml(u.name), showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ', denyButtonText: '🗑 حذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38',
        html: `<div class="sw-form"><small>الصلاحيات:</small>${permBoxes(u.perms)}<label class="pu-chk"><input type="checkbox" id="uActive" ${u.active === false ? '' : 'checked'}><span>الحساب فعّال</span></label><label>رمز سري جديد (اتركه فارغاً بلا تغيير)<input id="uPin" class="swal2-input" dir="ltr" autocomplete="off"></label></div>`,
        preConfirm: () => { const pin = document.getElementById('uPin').value.trim(); if (pin && pin.length < 6) { Swal.showValidationMessage('الرمز 6 خانات على الأقل'); return false; } return { pin, perms: readPerms(), active: document.getElementById('uActive').checked }; } });
    if (r.isDenied) {
        const c = await Swal.fire({ icon: 'warning', title: 'حذف ' + escapeHtml(u.name) + '؟', text: 'لن يستطيع الدخول بعد الآن.', showCancelButton: true, confirmButtonColor: '#b91c1c', confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' });
        if (c.isConfirmed) { try { await db.collection('pharmacy_users').doc(uid).delete(); if (u.login) await db.collection('pharmacy_logins').doc(u.login).delete(); } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحذف', text: e.message, confirmButtonColor: '#0f1c38' }); } }
        return openUsers();
    }
    if (!r.isConfirmed || !r.value) return openUsers();
    try {
        if (r.value.pin) { if (await userCreate(u.name, r.value.pin, r.value.perms, uid)) { if (r.value.active === false) { /* الحساب الجديد فعّال دائماً */ } } return openUsers(); }
        await db.collection('pharmacy_users').doc(uid).update({ perms: r.value.perms, active: r.value.active });
        if (u.login) { if (r.value.active) await db.collection('pharmacy_logins').doc(u.login).set({ email: u.email }); else await db.collection('pharmacy_logins').doc(u.login).delete(); }
    } catch (e) { Swal.fire({ icon: 'error', title: 'تعذر الحفظ', text: (e && e.message) || String(e), confirmButtonColor: '#0f1c38' }); }
    openUsers();
}
