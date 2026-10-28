// =====================================================================
// واجهة الصيدلي: دخول ← الرئيسية (فاتورة / مخزن) ← الصفحات
// =====================================================================
let currentView = 'splash';
let splashTimer = null;

const VIEW_PERM = { bill: 'sell', stock: 'stockView', purch: 'purchases', alerts: 'stockView', catalog: 'catalog', scan: 'scan' };
function showView(v) {
    if (VIEW_PERM[v] && typeof can === 'function' && !can(VIEW_PERM[v])) v = 'home';
    const _vs = window.__viewStack = window.__viewStack || [];
    if (v === 'home') _vs.length = 0;
    else if (!window.__navBack && currentView && currentView !== v && !['splash', 'login', 'home'].includes(currentView)) { if (_vs[_vs.length - 1] !== currentView) _vs.push(currentView); }
    currentView = v;
    document.body.dataset.view = v;
    window.scrollTo(0, 0);
    if (v === 'home') refreshHome();
    else if (v === 'stock') { renderAll(); }
    else if (v === 'bill') { onShowBill(); }
    else if (v === 'purch') { onShowPurch(); }
    else if (v === 'alerts') { renderAlerts(); }
    else if (v === 'catalog') { renderCatalog(); }
    else if (v === 'scan') { if (typeof scInit === 'function') scInit(); }
}

// يُستدعى من data.js عند تغيّر حالة الدخول
function onAdminAuth(user) {
    clearTimeout(splashTimer);
    if (user) { if (currentView === 'splash' || currentView === 'login') showView('home'); }
    else showView('login');
}

async function gateLogin() {
    let email = document.getElementById('gateEmail').value.trim();
    const pass = document.getElementById('gatePass').value;
    const err = document.getElementById('gateError'), btn = document.getElementById('gateBtn');
    const fail = m => { err.innerText = m; err.style.display = 'block'; };
    err.style.display = 'none';
    if (!email || !pass) return fail('أدخل اسم المستخدم (أو البريد) وكلمة المرور');
    if (!isFirebaseReady || !auth) return fail('الاتصال بـ Firebase غير جاهز. تأكد من الإنترنت ثم أعد تحميل الصفحة.');
    btn.disabled = true; btn.innerText = 'جاري التحقق...';
    try {
        if (!email.includes('@')) {   // اسم مستخدم: نجلب بريده الداخلي
            let em = '';
            try { const ld = await db.collection('pharmacy_logins').doc(loginKey(email)).get(); em = ld.exists ? (ld.data() || {}).email : ''; } catch (e) { /* تجاهل */ }
            if (!em) return fail('بيانات الدخول غير صحيحة');
            email = em;
        }
        await auth.signInWithEmailAndPassword(email, pass);
        document.getElementById('gatePass').value = '';
    } catch (e) {
        fail('بيانات الدخول غير صحيحة');
    } finally { btn.disabled = false; btn.innerText = 'تسجيل الدخول'; }
}

async function gateLogout() {
    const r = await Swal.fire({ title: 'تسجيل الخروج؟', icon: 'question', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء' });
    if (!r || !r.isConfirmed) return;
    try { if (typeof stopStockListener === 'function') stopStockListener(); } catch (e) { /* تجاهل */ }
    try { if (auth) await Promise.race([auth.signOut(), new Promise(res => setTimeout(res, 4000))]); } catch (e) { console.warn('signOut:', e && e.message); }
    // نضمن الخروج من الواجهة حتى لو تأخر رد Firebase
    currentUser = null; document.body.classList.remove('admin-mode');
    showView('login');
}

function goStock(tab) { showView('stock'); setMainTab(tab || 'all'); }
function goAddProduct() { showView('stock'); openFormModal(); }

async function refreshHome() {
    const out = products.filter(p => !isInStock(p)).length;
    const low = products.filter(isLowStock).length;
    let exp = 0; try { exp = getExpiringProducts().length; } catch (e) { /* تجاهل */ }
    const kpi = (cls, label, val, onclick) => `<button type="button" class="kpi ${cls}" onclick="${onclick}"><b>${val}</b><span>${label}</span></button>`;
    const alertsTotal = products.filter(p => alertKinds(p).any).length;
    if (typeof puLoad === 'function' && can('purchases')) puLoad().then(puHomeBadge).catch(() => {});
    const hb = document.getElementById('homeAlertCount');
    if (hb) { hb.innerText = alertsTotal; hb.style.display = alertsTotal ? 'flex' : 'none'; }
    const sb = document.getElementById('stockAlertCount');
    if (sb) { sb.innerText = alertsTotal; sb.style.display = alertsTotal ? 'flex' : 'none'; }
    const render = (sales) => {
        document.getElementById('homeKpis').innerHTML =
            kpi('k-out', 'غير متوفر', out, "goStock('out')") +
            kpi('k-low', 'كمية قليلة', low, "goAlerts('low')") +
            kpi('k-exp', 'قريب الانتهاء', exp, "goAlerts('m6')") +
            kpi('k-sales', 'مبيعات اليوم', fmtNum(sales), "showView('bill'); billTab('reports')");
    };
    render(salesTodayTotal());
    try { await loadInvoices(); render(salesTodayTotal()); } catch (e) { /* تجاهل */ }
}

// ---------------- شاشة التنبيهات ----------------
let alertFilterV = 'all';
const monthsTxt = n => n === 1 ? 'شهر' : n === 2 ? 'شهرين' : n + (n <= 10 ? ' أشهر' : ' شهراً');
const ALERT_LABELS = {
    get all() { return 'كل التنبيهات'; },
    get expired() { return 'منتهية الصلاحية'; },
    get m1() { return 'تنتهي خلال ' + monthsTxt(alertMonths[0]); },
    get m3() { return 'تنتهي خلال ' + monthsTxt(alertMonths[1]); },
    get m6() { return 'تنتهي خلال ' + monthsTxt(alertMonths[2]); },
    get low() { return 'مخزون منخفض'; }
};
function expiryDaysOf(dateStr) {   // نفس حساب التطبيق: اعتبار تاريخ النفاذ هو أول يوم من الشهر
    const m = /^(\d{4})-(\d{2})/.exec(dateStr || '');
    if (!m) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(parseInt(m[1]), parseInt(m[2]) - 1, 1) - today) / 864e5);
}
// يحدد حالات التنبيه للصنف حسب أقرب تاريخ نفاذ (التصنيف تراكمي: خلال شهر ⊂ خلال 3 أشهر ⊂ خلال 6 أشهر)
function alertKinds(p) {
    let days = null, date = '';
    getProductExpiryDates(p).forEach(d => { const n = expiryDaysOf(d); if (n !== null && (days === null || n < days)) { days = n; date = d; } });
    const k = { days, date, expired: days !== null && days <= 0, m1: days !== null && days <= alertMonths[0] * 30, m3: days !== null && days <= alertMonths[1] * 30, m6: days !== null && days <= alertMonths[2] * 30, low: isLowStock(p) };
    k.any = k.m6 || k.low;
    return k;
}
let alTab = 'ph';
function alUpdateTabs() {
    const ph = document.getElementById('alNPh'), dr = document.getElementById('alNDr'); if (!ph || !dr) return;
    ph.textContent = typeof alPhN === 'number' ? alPhN : 0;
    dr.textContent = (typeof docReqList !== 'undefined' ? docReqList.length : 0) + (typeof rxNewN === 'function' ? rxNewN() : 0);
}
let alPhN = 0;
function alSetTab(t) {
    alTab = t === 'dr' ? 'dr' : 'ph';
    document.getElementById('alTabPh').classList.toggle('on', alTab === 'ph'); document.getElementById('alTabDr').classList.toggle('on', alTab === 'dr');
    document.getElementById('alPanePh').style.display = alTab === 'ph' ? '' : 'none'; document.getElementById('alPaneDr').style.display = alTab === 'dr' ? '' : 'none';
    if (alTab === 'dr') { try { docRenderAlertBox(true); } catch (e) { /* تجاهل */ } }
    alUpdateTabs();
}
function goAlerts(f) { alertFilterV = f || 'all'; showView('alerts'); }
function setAlertFilter(v) { alertFilterV = v; renderAlerts(); }
let alertListIds = [];
function alertsToPO() {
    if (!alertListIds.length) { Swal.fire({ icon: 'info', title: 'القائمة فارغة', confirmButtonColor: '#0f1c38' }); return; }
    alertListIds.forEach(id => { poExtra.add(id); if (poState[id]) poState[id].on = true; });
    showView('bill'); billTab('po');
    Swal.fire({ icon: 'success', title: 'أضيف ' + alertListIds.length + ' صنف إلى طلب الشراء', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
}
function renderAlerts() {
    const sel = document.getElementById('alertFilter');
    const all = products.map(p => ({ p, k: alertKinds(p) }));
    const cnt = key => all.filter(x => key === 'all' ? x.k.any : x.k[key]).length;
    const opt = key => `<option value="${key}" ${alertFilterV === key ? 'selected' : ''}>${ALERT_LABELS[key]} (${cnt(key)})</option>`;
    sel.innerHTML = opt('all') + `<optgroup label="الصلاحية">${opt('expired')}${opt('m1')}${opt('m3')}${opt('m6')}</optgroup><optgroup label="المخزون">${opt('low')}</optgroup>`;
    const q = normSearch(document.getElementById('alertSearch').value);
    const toks = q ? q.split(' ') : [];
    let list = all.filter(x => (alertFilterV === 'all' ? x.k.any : x.k[alertFilterV]) && (!q || searchScore(x.p, q, toks) > 0));
    list.sort((a, b) => (a.k.days === null ? 1e9 : a.k.days) - (b.k.days === null ? 1e9 : b.k.days) || (parseInt(a.p.qty) || 0) - (parseInt(b.p.qty) || 0));
    alertListIds = list.map(x => x.p.id);
    document.getElementById('alertPoBtn').style.display = list.length ? '' : 'none';
    document.getElementById('alertTitle').innerText = ALERT_LABELS[alertFilterV];
    document.getElementById('alertCount').innerText = list.length + ' صنف';
    const tag = ({ p, k }) => {
        if (alertFilterV === 'low' || (k.days === null || !k.m6)) return `<span class="exp-tag t-low">📉 كمية قليلة: ${escapeHtml(stockLabel(p))}</span>`;
        if (k.expired) return `<span class="exp-tag t-exp">⛔ منتهية · ${k.date}</span>`;
        const cls = k.m1 ? 't-m1' : k.m3 ? 't-m3' : 't-m6';
        return `<span class="exp-tag ${cls}">⏳ ${k.date} · ${k.days} يوم</span>`;
    };
    document.getElementById('alertsContainer').innerHTML = list.map(x => productCardHtml(x.p, tag(x))).join('') ||
        `<div class="empty-state empty-wide"><div class="empty-ico">✅</div><div>لا توجد أصناف ضمن هذا التنبيه</div></div>`;
    alPhN = all.filter(x => x.k.any).length;
    try { if (typeof docRenderAlertBox === 'function') docRenderAlertBox(alTab === 'dr'); } catch (e) { /* تجاهل */ }
    alUpdateTabs();
}

// الشاشة الأولى: انتظر حالة الدخول، وإلا اذهب لشاشة الدخول
document.body.dataset.view = 'splash';
splashTimer = setTimeout(() => { if (currentView === 'splash') showView('login'); }, 3500);

// ============================================================================
// سحب للأسفل للتحديث (بدون إعادة تحميل التطبيق): يجلب أحدث البيانات ويبقى بنفس الشاشة والتبويب
// ============================================================================
let ptrBusy = false;
async function softRefresh() {
    if (ptrBusy) return; ptrBusy = true;
    const y = window.scrollY;
    try {
        if (typeof syncLocalRecords === 'function' && isFirebaseReady && navigator.onLine) { try { await syncLocalRecords(false); } catch (e) { /* تجاهل */ } }
        const jobs = [];
        if (typeof puLoad === 'function' && can('purchases')) jobs.push(puLoad());
        if (typeof loadInvoices === 'function' && can('sell')) jobs.push(loadInvoices());
        if (typeof lgLoad === 'function' && can('purchases')) jobs.push(lgLoad());
        await Promise.allSettled(jobs);
        const editing = (currentView === 'purch' && (puTabName || 'new') === 'new') || (currentView === 'bill' && (currentBillTab || 'new') === 'new');
        if (!editing && currentView !== 'splash' && currentView !== 'login') showView(currentView);   // يبقى بنفس الشاشة والتبويب
        window.scrollTo(0, y);
        try { Swal.fire({ icon: 'success', title: 'تم التحديث', toast: true, position: 'bottom', showConfirmButton: false, timer: 1200 }); } catch (e) { /* تجاهل */ }
    } catch (e) { /* تجاهل */ }
    ptrBusy = false;
}
(function setupPullToRefresh() {
    const ind = document.createElement('div'); ind.id = 'ptrInd'; ind.innerHTML = '<span>↓</span>'; document.body.appendChild(ind);
    const BLOCK = '#bottomSheet, .bottom-sheet, .modal-card, .swal2-container, #barcodeModal, #zoomModal, #formModal, input, textarea, select, .pu-d-scroll, .no-ptr';
    let sy = 0, dy = 0, on = false, sc = null;
    const scrollParent = el => { for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) return e; } return null; };
    document.addEventListener('touchstart', ev => {
        on = false; if (ptrBusy || ev.touches.length !== 1 || currentView === 'splash' || currentView === 'login') return;
        if (ev.target.closest && ev.target.closest(BLOCK)) return;
        sc = scrollParent(ev.target);
        if ((sc ? sc.scrollTop : window.scrollY) > 0) return;
        sy = ev.touches[0].clientY; dy = 0; on = true;
    }, { passive: true });
    document.addEventListener('touchmove', ev => {
        if (!on) return;
        dy = ev.touches[0].clientY - sy;
        if (dy <= 0 || (sc ? sc.scrollTop : window.scrollY) > 0) { ind.className = ''; ind.style.transform = ''; if (dy <= 0) on = false; return; }
        const t = Math.min(dy * 0.5, 64);
        ind.className = 'pull' + (dy > 80 ? ' ready' : ''); ind.style.transform = 'translate(-50%,' + t + 'px)'; ind.firstChild.textContent = dy > 80 ? '⟳' : '↓';
    }, { passive: true });
    const end = () => {
        if (!on) return; on = false;
        const go = dy > 80; ind.className = go ? 'pull spin' : ''; ind.style.transform = go ? 'translate(-50%,48px)' : '';
        if (go) softRefresh().finally(() => { ind.className = ''; ind.style.transform = ''; });
    };
    document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', end, { passive: true });
})();
