// =====================================================================
// واجهة الصيدلي: دخول ← الرئيسية (فاتورة / مخزن) ← الصفحات
// =====================================================================
let currentView = 'splash';
let splashTimer = null;

function showView(v) {
    currentView = v;
    document.body.dataset.view = v;
    window.scrollTo(0, 0);
    if (v === 'home') refreshHome();
    else if (v === 'stock') { renderAll(); }
    else if (v === 'bill') { onShowBill(); }
}

// يُستدعى من data.js عند تغيّر حالة الدخول
function onAdminAuth(user) {
    clearTimeout(splashTimer);
    if (user) { if (currentView === 'splash' || currentView === 'login') showView('home'); }
    else showView('login');
}

async function gateLogin() {
    const email = document.getElementById('gateEmail').value.trim();
    const pass = document.getElementById('gatePass').value;
    const err = document.getElementById('gateError'), btn = document.getElementById('gateBtn');
    const fail = m => { err.innerText = m; err.style.display = 'block'; };
    err.style.display = 'none';
    if (!email || !pass) return fail('أدخل البريد الإلكتروني وكلمة المرور');
    if (!isFirebaseReady || !auth) return fail('الاتصال بـ Firebase غير جاهز. تأكد من الإنترنت ثم أعد تحميل الصفحة.');
    btn.disabled = true; btn.innerText = 'جاري التحقق...';
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        document.getElementById('gatePass').value = '';
    } catch (e) {
        fail('بيانات الدخول غير صحيحة');
    } finally { btn.disabled = false; btn.innerText = 'تسجيل الدخول'; }
}

function gateLogout() {
    Swal.fire({ title: 'تسجيل الخروج؟', icon: 'question', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، خروج', cancelButtonText: 'إلغاء' })
        .then(r => { if (r.isConfirmed && auth) auth.signOut(); });
}

function goStock(tab) { showView('stock'); if (tab) setMainTab(tab); }
function goAddProduct() { showView('stock'); openFormModal(); }

async function refreshHome() {
    const out = products.filter(p => !isInStock(p)).length;
    const low = products.filter(isLowStock).length;
    let exp = 0; try { exp = getExpiringProducts().length; } catch (e) { /* تجاهل */ }
    const kpi = (cls, label, val, onclick) => `<button type="button" class="kpi ${cls}" onclick="${onclick}"><b>${val}</b><span>${label}</span></button>`;
    const render = (sales) => {
        document.getElementById('homeKpis').innerHTML =
            kpi('k-out', 'غير متوفر', out, "goStock('out')") +
            kpi('k-low', 'كمية قليلة', low, "showView('stock'); openExpiryModal()") +
            kpi('k-exp', 'قريب الانتهاء', exp, "showView('stock'); openExpiryModal()") +
            kpi('k-sales', 'مبيعات اليوم', fmtNum(sales), "showView('bill'); billTab('reports')");
    };
    render(salesTodayTotal());
    try { await loadInvoices(); render(salesTodayTotal()); } catch (e) { /* تجاهل */ }
}

// الشاشة الأولى: انتظر حالة الدخول، وإلا اذهب لشاشة الدخول
document.body.dataset.view = 'splash';
splashTimer = setTimeout(() => { if (currentView === 'splash') showView('login'); }, 3500);
