// ============================================================================
// 1. إعدادات FIREBASE (ضع بيانات مشروعك المجاني هنا)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDimxdd2vaKdOFw-IDYfWaivslosGMFVh4",
  authDomain: "al-d1-pharmacy.firebaseapp.com",
  projectId: "al-d1-pharmacy",
  storageBucket: "al-d1-pharmacy.firebasestorage.app",
  messagingSenderId: "670194103463",
  appId: "1:670194103463:web:ab22898112c5a5b9a69782",
  measurementId: "G-MHG8XCN3M8"
};

// ============================================================================
// 2. الأقسام والتصنيفات الافتراضية (قابلة للتعديل من داخل التطبيق)
// ============================================================================
const defaultDepartments = ["قسم الجلدية"];

const defaultSubCategories = [
    "واقيات الشمس",
    "العناية بالشعر والشامبو",
    "غسولات وعلاجات حب الشباب",
    "المرطبات والترميم",
    "التفتيح والتقشير",
    "المضادات الموضعية (بكتيريا/فطريات/طفيليات)",
    "الكورتيزونات والمراهم الموضعية",
    "الأدوية الفموية والشرابات"
];

// (الأصناف الافتراضية في ملف seed.js)

// ============================================================================
// 4. منطق التطبيق، المزامنة الفورية مع Firebase، وإدارة الجلسة الدائمة
// ============================================================================
let products = JSON.parse(localStorage.getItem('diwanProducts')) || defaultProducts;
let departments = JSON.parse(localStorage.getItem('diwanDepts')) || defaultDepartments;
let subCategories = JSON.parse(localStorage.getItem('diwanSubCats')) || defaultSubCategories;

// أسماء تبويبات الشريط السفلي (قابلة للتعديل من إعدادات ⚙️)
const defaultTabLabels = { all: 'كل القسم', rx: 'الادوية', cosmetic: 'كوزمتك', out: 'النواقص' };
let tabLabels = { ...defaultTabLabels, ...(JSON.parse(localStorage.getItem('diwanTabLabels')) || {}) };

// تبويبات إضافية يضيفها الصيدلي: [{id, name, icon}]
const MAX_CUSTOM_TABS = 2;
let customTabs = JSON.parse(localStorage.getItem('diwanCustomTabs')) || [];

// حد تنبيه الكمية القليلة العام (يمكن تخصيصه لكل صنف من نموذج الصنف)
const DEFAULT_SUB_TYPES = ['Strip', 'Tablet', 'Vial', 'Ampoule'];
let subTypes = (() => { try { const a = JSON.parse(localStorage.getItem('diwanSubTypes')); return Array.isArray(a) && a.length ? a : DEFAULT_SUB_TYPES.slice(); } catch (e) { return DEFAULT_SUB_TYPES.slice(); } })();
let lowStockThreshold = parseInt(localStorage.getItem('diwanLowThreshold'));
if (isNaN(lowStockThreshold)) lowStockThreshold = 2;
let alertMonths = (() => { try { const a = JSON.parse(localStorage.getItem('diwanAlertMonths')); return Array.isArray(a) && a.length === 3 && a.every(n => n > 0) ? a : [1, 3, 6]; } catch (e) { return [1, 3, 6]; } })();

const ALL_DEPTS = '__all__';
const ALL_DEPTS_LABEL = 'كل الأقسام';
let activeDept = ALL_DEPTS;   // تفتح الصفحة على كل الأصناف من كل الأقسام
let mainTab = 'all';
// فلاتر متعددة الاختيار (تُدار من نافذة التصفية)
const filCats = new Set();
const filBrands = new Set();
const filForms = new Set();
let filInStock = false;
function clearFilterState() { filCats.clear(); filBrands.clear(); filForms.clear(); filInStock = false; }

// رقم واتساب الصيدلية (مع مفتاح العراق 964 بدون الصفر الأول) ويوزر صفحة الانستغرام:
const PHARMACY_WHATSAPP = "9647805261843"; 
const PHARMACY_INSTAGRAM = "ald1_pharmacy"; 

let currentOpenId = null;
let db = null;
let auth = null;
let isFirebaseReady = false;
let currentUser = null;

// دالة إصلاح انقلاب الأرقام والوحدات تلقائياً
function fixMetaOrder(metaStr) {
    if (!metaStr) return '';
    let fixed = metaStr.replace(/^(Tablets|Capsules|Capsule|Drops|Syrup|ml|g)\s*\|\s*([A-Za-z\s]+)\s+(\d+)$/i, '$3 $1 | $2');
    fixed = fixed.replace(/^(Syrup|Drops|Solution|Cream|Gel|Ointment)\s*\|\s*(\d+\s*(?:ml|g))$/i, '$2 | $1');
    return fixed;
}

// تنظيف أي بيانات مخزنة مسبقاً في المتصفح
products = products.map(p => ({
    ...p,
    department: p.department || "قسم الجلدية",
    meta: fixMetaOrder(p.meta)
}));

// ============================================================================
// وضع الصفحة: 'admin' (الصيدلي) أو 'customer' (الزبائن، الافتراضي)
// بيانات المخزون الحساسة (الكمية، الحد الأدنى، الصلاحية) تُحفظ في مجموعة خاصة بالصيدلي
// ============================================================================
const IS_ADMIN_PAGE = window.APP_MODE === 'admin';
const STOCK_FIELDS = ['qty', 'loose', 'minQty', 'expiryDate', 'expiryDates', 'costPrice', 'lastPurchase'];
let cloudPub = [];          // الأصناف العامة كما تصل من السحابة
let stockMap = {};          // بيانات المخزون الخاصة (للصيدلي فقط)
let unsubStock = null;

function splitProduct(p) {
    const full = JSON.parse(JSON.stringify(p));
    const pub = {};
    const stock = { id: full.id };
    Object.keys(full).forEach(k => { if (STOCK_FIELDS.includes(k)) stock[k] = full[k]; else pub[k] = full[k]; });
    pub.inStock = (parseInt(full.qty) || 0) > 0 || (parseInt(full.loose) || 0) > 0;
    return { pub, stock };
}
// هل الصنف متوفر؟ (يعمل في الصفحتين)
function isInStock(p) {
    if (p.qty !== undefined && p.qty !== null) return (parseInt(p.qty) || 0) > 0 || (parseInt(p.loose) || 0) > 0;
    return p.inStock === true;
}
function normalizeStockFields(o) {   // يُصلح الأجزاء المفتوحة والكميات بعد دمج تغييرات أجهزة مختلفة
    if (o.qty === undefined) return o;
    let q = parseInt(o.qty) || 0, l = parseInt(o.loose) || 0;
    const sc = parseInt(o.subCount) || 0;
    if (sc >= 2) { let tot = q * sc + l; if (tot < 0) tot = 0; q = Math.floor(tot / sc); l = tot % sc; }
    else { if (q < 0) q = 0; l = 0; }
    o.qty = q; if (sc >= 2 || o.loose !== undefined) o.loose = l;
    return o;
}
function rebuildProducts() {
    const merged = cloudPub.map(d => {
        const s = stockMap[String(d.id)];
        const o = s ? { ...d, ...s } : { ...d };
        o.meta = fixMetaOrder(o.meta);
        return normalizeStockFields(o);
    });
    products = merged.sort((a, b) => b.id - a.id);
}
function writeProductBatch(batch, p) {
    const { pub, stock } = splitProduct(p);
    batch.set(db.collection('pharmacy_products').doc(String(p.id)), pub);
    batch.set(db.collection('pharmacy_stock').doc(String(p.id)), stock);
}
function startStockListener() {
    if (!IS_ADMIN_PAGE || unsubStock || !db) return;
    unsubStock = db.collection('pharmacy_stock').onSnapshot(snap => {
        const m = {};
        snap.forEach(doc => { m[doc.id] = doc.data(); });
        stockMap = m;
        if (cloudPub.length) { rebuildProducts(); saveLocal(); renderAll(); }
    }, err => { console.warn('Stock listener:', err.message); if (unsubStock) { try { unsubStock(); } catch (e) { /* تجاهل */ } } unsubStock = null; setTimeout(() => { if (currentUser) startStockListener(); }, 4000); });   // إعادة التشغيل إن انقطع
}
function syncStockLocal(list) {   // بعد نجاح الحفظ نحدّث نسخة المخزون محلياً فوراً (لا ننتظر المراقب)
    (list || []).forEach(p => { stockMap[String(p.id)] = splitProduct(p).stock; });
}
function stopStockListener() {
    if (unsubStock) { unsubStock(); unsubStock = null; }
    stockMap = {};
}

// مؤشر المزامنة: نقطة صغيرة بدون كلمات (أخضر متزامن، برتقالي جارٍ الحفظ، أحمر خطأ، رمادي بدون إنترنت/محلي)
let syncState = 'ok';
function setSyncText(txt) {
    const s = String(txt || '');
    const state = /جاري/.test(s) ? 'busy' : /خطأ|فشل/.test(s) ? 'err' : /إنترنت/.test(s) ? 'off' : /محلي/.test(s) ? 'local' : 'ok';
    if (isFirebaseReady && (state === 'ok' || state === 'busy')) return syncRefresh();   // الحالة الحقيقية من العدّادات
    syncState = state;
    document.querySelectorAll('.sync-dot').forEach(d => { d.dataset.state = state; d.title = s.replace(/^[^\u0600-\u06FF]+/, ''); });
}

// ============================================================================
// الحفظ بدون إنترنت والمزامنة التلقائية (تخزين Firestore المحلي)
// الكتابة تُحفظ على الجهاز فوراً وتُرسل للسحابة لوحدها عند رجوع الاتصال، حتى بعد إغلاق التطبيق.
// ============================================================================
let persistenceOn = false;      // هل التخزين المحلي للكتابات مفعّل؟
let pendingOps = 0;             // عدد عمليات الكتابة التي لم تصل للسحابة بعد (في هذه الجلسة)
let startupPending = false;     // كتابات من جلسة سابقة ما زالت بانتظار الإرسال
let syncErrMsg = '';
let lastSyncAt = (() => { try { return localStorage.getItem('diwanLastSync') || ''; } catch (e) { return ''; } })();
function fv() { try { return (window.firebase && firebase.firestore && firebase.firestore.FieldValue) || null; } catch (e) { return null; } }
function writesAllowed() { if (navigator.onLine || persistenceOn) return true; return requireOnline(); }
function markSynced() { lastSyncAt = new Date().toISOString(); try { localStorage.setItem('diwanLastSync', lastSyncAt); } catch (e) { /* تجاهل */ } }
function syncRefresh() {
    let state, txt;
    if (!isFirebaseReady) { state = 'local'; txt = 'محلي'; }
    else if (!navigator.onLine) { state = 'off'; txt = 'بدون إنترنت' + (pendingOps ? ' — ' + pendingOps + ' بانتظار الإرسال' : '') + ' (يُحفظ على الجهاز وسيُرسل عند الاتصال)'; }
    else if (pendingOps > 0 || startupPending) { state = 'busy'; txt = 'جاري الإرسال للسحابة' + (pendingOps ? ' (' + pendingOps + ')' : '') + '...'; }
    else if (syncErrMsg) { state = 'err'; txt = 'خطأ في الحفظ: ' + syncErrMsg; }
    else { state = 'ok'; txt = 'متزامن'; }
    syncState = state;
    document.querySelectorAll('.sync-dot').forEach(d => { d.dataset.state = state; d.dataset.pend = (pendingOps || startupPending) ? '1' : '0'; d.title = txt + ' — اضغط للتفاصيل'; });
}
function asyncWriteFailed(e) {
    syncErrMsg = (e && e.message) || 'فشل الكتابة'; syncRefresh();
    try { Swal.fire({ icon: 'error', title: 'تعذّر إرسال بعض التغييرات للسحابة', text: syncErrMsg, confirmButtonColor: '#0f1c38' }); } catch (x) { /* تجاهل */ }
}
// ننتظر تأكيد السحابة إن كان الاتصال سريعاً، وإلا نعتبرها «في الطابور» ونكمل بدون تعليق الشاشة
async function fsWrite(promise) {
    pendingOps++; syncRefresh();
    const settle = ok => { pendingOps = Math.max(0, pendingOps - 1); if (ok) { syncErrMsg = ''; markSynced(); } syncRefresh(); };
    promise.then(() => settle(true), () => settle(false));
    if (!navigator.onLine) { promise.catch(asyncWriteFailed); return 'queued'; }
    const r = await Promise.race([promise.then(() => 'ok'), new Promise(res => setTimeout(() => res('slow'), 7000))]);
    if (r === 'slow') promise.catch(asyncWriteFailed);
    return r;
}
function fsCommit(batch) { return fsWrite(batch.commit()); }
function fsSet(ref, data, opts) { return fsWrite(opts ? ref.set(data, opts) : ref.set(data)); }
function checkPending() {   // كتابات قديمة من جلسة سابقة؟
    if (!db || !isFirebaseReady || typeof db.waitForPendingWrites !== 'function') return;
    const t = setTimeout(() => { startupPending = true; syncRefresh(); }, 600);
    db.waitForPendingWrites().then(() => { clearTimeout(t); if (startupPending) markSynced(); startupPending = false; syncRefresh(); }).catch(() => clearTimeout(t));
}
async function syncNow() {
    if (!isFirebaseReady || !db) return;
    try { await db.enableNetwork(); } catch (e) { /* تجاهل */ }
    let n = 0;
    try { if (typeof syncLocalRecords === 'function') n = await syncLocalRecords(false); } catch (e) { /* تجاهل */ }
    checkPending();
    try { Swal.fire({ icon: 'success', title: n ? 'رُفع ' + n + ' سجل محفوظ محلياً' : 'تمت المزامنة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 }); } catch (e) { /* تجاهل */ }
}
function showSyncStatus() {
    if (!IS_ADMIN_PAGE) return;
    const online = navigator.onLine;
    const dups = (typeof billDuplicateNumbers === 'function') ? billDuplicateNumbers() : [];
    const loc = (typeof localOnlyCounts === 'function') ? localOnlyCounts() : '';
    const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #e5e7eb;"><span style="color:#64748b">${k}</span><b>${v}</b></div>`;
    const html = `<div style="text-align:right;font-size:.9rem">` +
        row('الاتصال', online ? '🟢 متصل' : '🔴 بدون إنترنت') +
        row('بانتظار الإرسال', (pendingOps ? pendingOps + ' عملية' : (startupPending ? 'يوجد (من جلسة سابقة)' : 'لا شيء')) ) +
        row('الحفظ بدون إنترنت', persistenceOn ? '✅ مفعّل' : '⚠️ غير مدعوم في هذا المتصفح') +
        row('آخر مزامنة ناجحة', lastSyncAt ? new Date(lastSyncAt).toLocaleString('ar-IQ') : '—') +
        (syncErrMsg ? row('آخر خطأ', escapeHtml(syncErrMsg)) : '') + loc +
        (dups.length ? `<div style="margin-top:10px;color:#b45309;font-weight:700;font-size:.82rem">⚠️ أرقام فواتير مكررة (أُصدرت من أجهزة مختلفة بدون إنترنت): ${dups.map(escapeHtml).join('، ')}</div>` : '') + `</div>`;
    Swal.fire({ title: 'حالة المزامنة', html, showCancelButton: true, confirmButtonText: '🔄 مزامنة الآن', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' }).then(r => { if (r.isConfirmed) syncNow(); });
}
document.addEventListener('click', e => { if (IS_ADMIN_PAGE && e.target && e.target.closest && e.target.closest('.brand-logo')) showSyncStatus(); });

async function initFirebase() {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "PUT_YOUR_API_KEY_HERE") {
        setSyncText("💾 محلي");
        setTimeout(() => { if (typeof onAdminAuth === 'function') onAdminAuth(null); }, 400);
        return;
    }
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        auth = firebase.auth();
        db = firebase.firestore();
        isFirebaseReady = true;
        try { await db.enablePersistence({ synchronizeTabs: true }); persistenceOn = true; } catch (e) { persistenceOn = false; console.warn('Offline persistence:', e && e.code); }
        syncRefresh();

        // الفرض الصارم لبقاء تسجيل الدخول دائماً
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        if (IS_ADMIN_PAGE) auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            const authBtn = document.getElementById('authBtn');
            if (user) {
                document.body.classList.add('admin-mode');
                authBtn.innerHTML = ICONS.lock;
                authBtn.title = 'خروج الصيدلي';
                
                // فحص ما إذا كانت قاعدة منتجات السحابة فارغة لرفع الـ 166 منتجاً لأول مرة
                try {
                    const snap = await db.collection('pharmacy_products').limit(1).get();
                    if (snap.empty && products.length > 0 && navigator.onLine) pushToCloud(false);
                } catch (e) { /* بدون اتصال: نكمل من النسخة المحلية */ }
                startStockListener();
                checkPending();
                setTimeout(() => { if (typeof syncLocalRecords === 'function') syncLocalRecords(true).catch(() => {}); }, 4000);
                setTimeout(autoMaintenance, 9000);   // نسخة احتياطية أسبوعية + تنظيف السلة والسجل
            } else {
                document.body.classList.remove('admin-mode');
                authBtn.innerHTML = ICONS.user;
                authBtn.title = 'دخول الصيدلي';
                stopStockListener();
                if (cloudPub.length) { rebuildProducts(); renderAll(); }
            }
            if (currentOpenId) openSheet(currentOpenId);
            if (typeof onAdminAuth === 'function') onAdminAuth(user);
        });

        // 1. مراقبة الأقسام والتصنيفات من السحابة
        db.collection('pharmacy').doc('metadata').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.departments) departments = data.departments;
                if (data.subCategories) subCategories = data.subCategories;
                if (data.tabLabels) tabLabels = { ...defaultTabLabels, ...data.tabLabels };
                if (Array.isArray(data.customTabs)) customTabs = data.customTabs;
                if (typeof data.lowStockThreshold === 'number') lowStockThreshold = data.lowStockThreshold;
                if (Array.isArray(data.alertMonths) && data.alertMonths.length === 3) alertMonths = data.alertMonths;
                if (Array.isArray(data.subTypes) && data.subTypes.length) subTypes = data.subTypes;
                saveLocal();
                renderAll();
            }
        });

        // 2. مراقبة المنتجات والصور من السحابة (تحديث فوري لكل الأجهزة)
        db.collection('pharmacy_products').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                cloudPub = [];
                snapshot.forEach(doc => { cloudPub.push(doc.data()); });
                rebuildProducts();
                saveLocal();
                renderAll();
                checkSharedProductUrl(); // ✅ يفتح المنتج المشارك فور وصوله من السحابة
                setSyncText("☁️ متزامن");
            }
        }, err => {
            console.error("Cloud Sync Error:", err);
            setSyncText("⚠️ خطأ مزامنة");
        });
    } catch (e) {
        console.warn("Firebase Error:", e);
    }
}

function saveLocal() {
    try {
        localStorage.setItem('diwanDepts', JSON.stringify(departments));
        localStorage.setItem('diwanSubCats', JSON.stringify(subCategories));
        localStorage.setItem('diwanTabLabels', JSON.stringify(tabLabels));
        localStorage.setItem('diwanCustomTabs', JSON.stringify(customTabs));
        localStorage.setItem('diwanLowThreshold', String(lowStockThreshold));
        localStorage.setItem('diwanAlertMonths', JSON.stringify(alertMonths));
        localStorage.setItem('diwanSubTypes', JSON.stringify(subTypes));
        localStorage.setItem('diwanProducts', JSON.stringify(products));
    } catch (e) {
        // إذا امتلأت ذاكرة المتصفح، نمسح النسخة المحلية القديمة لكي يقرأ المتصفح من السحابة المحدثة دائماً!
        localStorage.removeItem('diwanProducts');
    }
}

// 2. دالة حفظ المنتج الواحد في Firebase (خفيفة وسريعة جداً لأنها تحفظ الرابط فقط)
async function saveSingleProductToCloud(product) {
    saveLocal();
    if (isFirebaseReady && currentUser && !writesAllowed()) return false;
    
    if (!isFirebaseReady || !currentUser) {
        await Swal.fire({
            icon: 'error',
            title: 'أنت غير مسجل الدخول!',
            text: 'اضغط على أيقونة الصيدلي (👤) في الأعلى وسجل الدخول أولاً ليتم الحفظ في الإنترنت.',
            confirmButtonColor: '#0f1c38',
            confirmButtonText: 'حسناً'
        });
        return false;
    }
    setSyncText("⏳ جاري الحفظ...");
    
    try {
        const wb = db.batch();
        writeProductBatch(wb, product);
        await fsCommit(wb);
        syncStockLocal([product]);
        setSyncText("☁️ تم الحفظ");
        return true;
    } catch (err) {
        setSyncText("❌ فشل الحفظ");
        await Swal.fire({
            icon: 'error',
            title: 'خطأ في السحابة',
            text: err.message,
            confirmButtonColor: '#0f1c38'
        });
        return false;
    }
}
// دالة حفظ الأقسام والتصنيفات (أو الرفع التأسيسي الأول)
async function pushToCloud(onlyMetadata = false) {
    saveLocal();
    if (isFirebaseReady && currentUser && !writesAllowed()) return;
    if (isFirebaseReady && currentUser) {
        setSyncText("⏳ جاري الحفظ...");
        try {
            await fsSet(db.collection('pharmacy').doc('metadata'), {
                departments,
                subCategories,
                tabLabels,
                customTabs,
                lowStockThreshold,
                alertMonths,
                subTypes,
                updatedAt: new Date().toISOString()
            });

            if (!onlyMetadata) {
                for (let i = 0; i < products.length; i += 20) {
                    const batch = db.batch();
                    const chunk = products.slice(i, i + 20);
                    chunk.forEach(p => {
                        writeProductBatch(batch, p);
                    });
                    await fsCommit(batch);
                }
            }

            setSyncText("☁️ تم الحفظ");
        } catch (err) {
            setSyncText("❌ خطأ");
            alert("خطأ في الحفظ السحابي: " + err.message);
        }
    }
}

// ============================================================================
// 5. تسجيل الدخول الآمن عبر Firebase
// ============================================================================
function handleAuthClick() {
    if (!isFirebaseReady) {
        return Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى وضع مفاتيح firebaseConfig أولاً لتفعيل الحماية السحابية.',
            confirmButtonColor: '#0f1c38',
            confirmButtonText: 'حسناً'
        });
    }

    if (currentUser) {
        Swal.fire({
            title: 'تسجيل الخروج؟',
            text: "هل أنت متأكد أنك تود تسجيل الخروج من وضع الصيدلي؟",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0f1c38',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'نعم، تسجيل خروج',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                auth.signOut();
                Swal.fire({
                    icon: 'success',
                    title: 'تم تسجيل الخروج بنجاح',
                    toast: true,
                    position: 'bottom',
                    showConfirmButton: false,
                    timer: 2000
                });
            }
        });
    } else {
        document.getElementById('loginError').style.display = 'none';
        document.getElementById('loginModal').style.display = 'flex';
    }
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

async function performLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errBox = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');

    if (!email || !pass) {
        errBox.innerText = "يرجى إدخال البريد الإلكتروني وكلمة المرور";
        errBox.style.display = 'block';
        return;
    }

    btn.innerText = "جاري التحقق...";
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeLoginModal();
    } catch (e) {
        errBox.innerText = "بيانات الدخول غير صحيحة أو الحساب غير مسجل في Firebase Auth";
        errBox.style.display = 'block';
    } finally {
        btn.innerText = "تسجيل الدخول";
    }
}

// ============================================================================
// 6. إدارة الأقسام الكبرى والتصنيفات الفرعية
// ============================================================================
function openCategoryManager() {
    renderManagerLists();
    const lowInput = document.getElementById('lowThresholdInput');
    if (lowInput) lowInput.value = lowStockThreshold;
    alertMonths.forEach((m, i) => { const el = document.getElementById('alertM' + (i + 1)); if (el) el.value = m; });
    loadAiSettingsToForm();
    document.getElementById('catModal').style.display = 'flex';
}

function closeCategoryManager() {
    document.getElementById('catModal').style.display = 'none';
    document.getElementById('catModal').style.zIndex = '';
}

function renderManagerLists() {
    const deptContainer = document.getElementById('deptListManager');
    deptContainer.innerHTML = departments.map((d, i) => `
        <div class="manager-item">
            <span>${d}</span>
            <div style="display:flex; gap:6px;">
                <button class="icon-btn" onclick="renameDepartment(${i})">✏️ تعديل الاسم</button>
                <button class="icon-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="deleteManagerItem('dept', ${i})">🗑️</button>
            </div>
        </div>
    `).join('');

    const subContainer = document.getElementById('subCatListManager');
    subContainer.innerHTML = subCategories.map((c, i) => `
        <div class="manager-item">
            <span>${c}</span>
            <div style="display:flex; gap:6px;">
                <button class="icon-btn" onclick="renameSubCategory(${i})">✏️ تعديل الاسم</button>
                <button class="icon-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="deleteManagerItem('cat', ${i})">🗑️</button>
            </div>
        </div>
    `).join('');

    const tabContainer = document.getElementById('tabListManager');
    if (tabContainer) {
        const builtin = (key, note = '') => `
            <div class="manager-item">
                <span>${escTab(tabLabels[key])}<small style="color:var(--text-sub); font-weight:500;">${note}</small></span>
                <div style="display:flex; gap:6px;">
                    <button class="icon-btn" onclick="renameTab('${key}')">✏️ تعديل الاسم</button>
                </div>
            </div>`;
        const custom = customTabs.map(t => `
            <div class="manager-item">
                <span>${escTab(t.icon || '🏷️')} ${escTab(t.name)}</span>
                <div style="display:flex; gap:6px;">
                    <button class="icon-btn" onclick="renameCustomTab('${t.id}')">✏️ تعديل</button>
                    <button class="icon-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="deleteCustomTab('${t.id}')">🗑️</button>
                </div>
            </div>`).join('');
        tabContainer.innerHTML = builtin('all') + builtin('rx') + builtin('cosmetic') + custom + builtin('out', ' (تلقائي: الكمية = 0)');
    }
}

function renameTab(key) {
    const oldName = tabLabels[key];
    const newName = prompt("تعديل اسم التبويب:", oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        tabLabels[key] = newName.trim();
        pushToCloud(true);
        renderManagerLists();
        renderAll();
    }
}

function escTab(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// تبويب غير المتوفر: «النواقص» للصيدلي، «غير متوفر» للزبون والطبيب
function outTabLabel() { return IS_ADMIN_PAGE ? tabLabels.out : 'غير متوفر'; }

function getTabTitle() {
    if (mainTab === 'all') return 'جميع الأصناف';
    if (mainTab === 'rx') return tabLabels.rx;
    if (mainTab === 'cosmetic') return tabLabels.cosmetic;
    if (mainTab === 'out') return outTabLabel();
    const t = customTabs.find(x => x.id === mainTab);
    return t ? t.name : 'جميع الأصناف';
}

// رسم الشريط السفلي: الثابتة + المخصصة (النواقص دائماً في الآخر)
function renderBottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const tabs = [
        { key: 'all', icon: '📦', name: tabLabels.all },
        { key: 'rx', icon: '💊', name: tabLabels.rx },
        { key: 'cosmetic', icon: '✨', name: tabLabels.cosmetic },
        ...customTabs.map(t => ({ key: t.id, icon: t.icon || '🏷️', name: t.name })),
        { key: 'out', icon: IS_ADMIN_PAGE ? '⚠️' : '🚫', name: outTabLabel() }
    ];
    if (!tabs.some(t => t.key === mainTab)) mainTab = 'all';   // تبويب محذوف
    nav.innerHTML = tabs.map(t => `
        <button class="nav-tab ${mainTab === t.key ? 'active' : ''}" onclick="setMainTab('${t.key}')">
            <span class="nav-ico">${t.icon}</span>
            <span>${escTab(t.name)}</span>
        </button>
    `).join('');
}

function addCustomTab() {
    const nameEl = document.getElementById('newTabInput');
    const iconEl = document.getElementById('newTabIcon');
    const name = nameEl.value.trim();
    if (!name) return;
    if (customTabs.length >= MAX_CUSTOM_TABS) {
        alert('الحد الأقصى ' + MAX_CUSTOM_TABS + ' تبويبات إضافية حتى يبقى الشريط واضحاً على الهاتف. احذف تبويباً لإضافة آخر.');
        return;
    }
    const used = [...Object.values(tabLabels), ...customTabs.map(t => t.name)];
    if (used.includes(name)) { alert('هذا الاسم مستخدم مسبقاً.'); return; }
    const icon = Array.from(iconEl.value.trim())[0] || '🏷️';
    customTabs.push({ id: 'c' + Date.now(), name, icon });
    nameEl.value = '';
    iconEl.value = '';
    pushToCloud(true);
    renderManagerLists();
    renderAll();
}

function renameCustomTab(id) {
    const t = customTabs.find(x => x.id === id);
    if (!t) return;
    const newName = prompt("تعديل اسم التبويب:", t.name);
    if (newName && newName.trim() && newName.trim() !== t.name) {
        t.name = newName.trim();
        pushToCloud(true);
        renderManagerLists();
        renderAll();
    }
}

function deleteCustomTab(id) {
    const t = customTabs.find(x => x.id === id);
    if (!t) return;
    const count = products.filter(p => p.type === id || inExtraTab(p, id)).length;
    const msg = count
        ? `حذف تبويب "${t.name}"؟ سيتم إرجاع ${count} صنف إلى التصنيف التلقائي (أدوية/كوزمتك). لن يُحذف أي صنف.`
        : `حذف تبويب "${t.name}"؟`;
    if (!confirm(msg)) return;
    customTabs = customTabs.filter(x => x.id !== id);
    products.forEach(p => {
        if (p.type === id) p.type = '';
        if (inExtraTab(p, id)) p.extraTypes = p.extraTypes.filter(x => x !== id);
    });
    if (mainTab === id) mainTab = 'all';
    pushToCloud(count > 0 ? false : true);
    renderManagerLists();
    renderAll();
}

function renameDepartment(index) {
    const oldName = departments[index];
    const newName = prompt("تعديل اسم القسم الرئيسي:", oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        const clean = newName.trim();
        departments[index] = clean;
        products.forEach(p => {
            if (p.department === oldName) p.department = clean;
            if (extrasOf(p.extraDepartments).includes(oldName)) p.extraDepartments = p.extraDepartments.map(x => x === oldName ? clean : x);
        });
        if (activeDept === oldName) activeDept = clean;
        pushToCloud(false);
        renderManagerLists();
        renderAll();
    }
}

function addDepartment() {
    const val = document.getElementById('newDeptInput').value.trim();
    if (val && !departments.includes(val)) {
        departments.push(val);
        document.getElementById('newDeptInput').value = '';
        pushToCloud(true);
        renderManagerLists();
        renderAll();
    }
}

function renameSubCategory(index) {
    const oldName = subCategories[index];
    const newName = prompt("تعديل تسمية التصنيف الفرعي:", oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        const clean = newName.trim();
        subCategories[index] = clean;
        products.forEach(p => {
            if (p.category === oldName) p.category = clean;
            if (extrasOf(p.extraCategories).includes(oldName)) p.extraCategories = p.extraCategories.map(x => x === oldName ? clean : x);
        });
        if (filCats.has(oldName)) { filCats.delete(oldName); filCats.add(clean); }
        pushToCloud(false);
        renderManagerLists();
        renderAll();
    }
}

function addSubCategory() {
    const val = document.getElementById('newSubCatInput').value.trim();
    if (val && !subCategories.includes(val)) {
        subCategories.push(val);
        document.getElementById('newSubCatInput').value = '';
        pushToCloud(true);
        renderManagerLists();
        renderAll();
    }
}

// ============================================================================
// 7. العرض والفلترة
// ============================================================================
// ---- بحث ذكي: يتجاهل التشكيل وفروق الهمزات/التاء المربوطة، ويتحمل الأخطاء الإملائية البسيطة ----
function normSearch(s) {
    return String(s === null || s === undefined ? '' : s)
        .toLowerCase()
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
        .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
        .replace(/(^| )ال(?=\S{3,})/g, '$1')   // حذف "ال" التعريف من أول الكلمة
        .trim();
}

const SEARCH_IDX = new WeakMap();
function searchIndexOf(p) {
    let x = SEARCH_IDX.get(p);
    if (!x) {
        const all = normSearch(`${p.name} ${p.brand} ${p.details} ${p.meta} ${catsOf(p).join(' ')} ${p.keywords || ''} ${p.activeIngredient || ''} ${barcodesOf(p).join(' ')}`);
        x = { name: normSearch(p.name), all, words: all.split(' ').filter(Boolean) };
        SEARCH_IDX.set(p, x);
    }
    return x;
}

// مسافة التحرير (Levenshtein) مع حد أعلى للتوقف المبكر
function editDistanceWithin(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (cur[j] < rowMin) rowMin = cur[j];
        }
        if (rowMin > max) return max + 1;
        prev = cur;
    }
    return prev[b.length];
}

// 0 = لا يطابق، 2 = يطابق نصاً، 1 = يطابق بخطأ إملائي بسيط
function tokenMatchScore(tok, x) {
    if (x.all.includes(tok)) return 2;
    if (tok.length < 5) return 0;
    const max = tok.length >= 8 ? 2 : 1;
    for (const w of x.words) {
        if (w.length >= 3 && editDistanceWithin(tok, w, max) <= max) return 1;
    }
    return 0;
}

// يعيد درجة الصنف (0 = لا يطابق). كل كلمات البحث يجب أن تتطابق.
function searchScore(p, qNorm, qTokens) {
    if (!qTokens.length) return 1;
    const x = searchIndexOf(p);
    let score = 0;
    for (const t of qTokens) {
        const s = tokenMatchScore(t, x);
        if (!s) return 0;
        score += s;
    }
    if (x.name === qNorm) score += 8;
    else if (x.name.startsWith(qNorm)) score += 5;
    else if (x.name.includes(qNorm)) score += 3;
    return score;
}

// ---- أقسام/تصنيفات/تبويبات متعددة للصنف الواحد ----
// الحقول القديمة department/category/type تبقى "الأساسية"، والإضافية تُخزَّن في مصفوفات منفصلة
function extrasOf(v) { return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : []; }
function deptsOf(p) { return [p.department || 'قسم الجلدية'].concat(extrasOf(p.extraDepartments)); }
function catsOf(p) { return [p.category].concat(extrasOf(p.extraCategories)).filter(Boolean); }
function typesOf(p) { return [p.type].concat(extrasOf(p.extraTypes)).filter(Boolean); }
function inExtraTab(p, id) { return extrasOf(p.extraTypes).includes(id); }

function isRxItem(item) {
    // الاختيار اليدوي من نموذج الصنف له الأولوية، وإن لم يُحدَّد يُستخدم التخمين القديم
    if (item.type === 'rx') return true;
    if (item.type) return false;   // كوزمتك أو تبويب مخصص
    const rxKeywords = ['مضادات', 'كورتيزون', 'فموية', 'شرابات', 'rx'];
    if (rxKeywords.some(k => String(item.category || '').toLowerCase().includes(k))) return true;
    const rxNames = ['acretin', 'azaderm', 'peroduo', 'ben-oxide', 'clinaderm', 'minoxidil', 'beta-salic', 'kenazole', 'naxoral', 'selerex', 'hiquin', 'benoquin'];
    return rxNames.some(k => item.name.toLowerCase().includes(k));
}

function isCustomItem(item) {
    return !!item.type && customTabs.some(t => t.id === item.type);
}

function getFormBadge(item) {
    const str = `${item.name} ${item.meta}`.toLowerCase();
    if (str.includes('tablet') || str.includes('capsule')) return {txt: 'أقراص / كبسول', cls: 'badge-oral'};
    if (str.includes('syrup') || str.includes('suspension') || str.includes('drops')) return {txt: 'شراب / قطرات', cls: 'badge-syrup'};
    if (str.includes('ointment') || str.includes('مرهم')) return {txt: 'مرهم (Oint)', cls: 'badge-oint'};
    if (str.includes('gel') || str.includes('جل')) return {txt: 'جل (Gel)', cls: 'badge-gel'};
    if (str.includes('shampoo') || str.includes('wash') || str.includes('cleanser') || str.includes('soap') || str.includes('bar')) return {txt: 'غسول / شامبو', cls: 'badge-wash'};
    if (str.includes('spray') || str.includes('solution') || str.includes('lotion') || str.includes('serum')) return {txt: 'محلول / بخاخ', cls: 'badge-spray'};
    return {txt: 'كريم (Cream)', cls: 'badge-cream'};
}

function renderDepartmentsBar() {
    const bar = document.getElementById('departmentsBar');
    if (activeDept !== ALL_DEPTS && !departments.includes(activeDept)) activeDept = ALL_DEPTS;
    bar.innerHTML = `<button class="dept-chip ${activeDept === ALL_DEPTS ? 'active' : ''}" onclick="selectDepartment('${ALL_DEPTS}')">🗂️ ${ALL_DEPTS_LABEL}</button>` +
        departments.map(d => `
        <button class="dept-chip ${activeDept === d ? 'active' : ''}" onclick="selectDepartment(this.dataset.d)" data-d="${escapeHtml(d)}">
            🏥 ${escapeHtml(d)}
        </button>
    `).join('');
}

function selectDepartment(d) {
    activeDept = d;
    clearFilterState();
    renderAll();
}

function setMainTab(tab) {
    mainTab = tab;
    clearFilterState();
    renderAll();   // الشريط السفلي يُعاد رسمه ويحدّد التبويب النشط تلقائياً
}

function getBaseFilteredByTab() {
    return products.filter(p => {
        const matchDept = activeDept === ALL_DEPTS || deptsOf(p).includes(activeDept);
        if (!matchDept) return false;
        if (mainTab === 'out') return !isInStock(p);
        if (mainTab === 'rx') return isRxItem(p) || inExtraTab(p, 'rx');
        if (mainTab === 'cosmetic') return (!isRxItem(p) && !isCustomItem(p)) || inExtraTab(p, 'cosmetic');
        if (customTabs.some(t => t.id === mainTab)) return p.type === mainTab || inExtraTab(p, mainTab);
        return true;
    });
}

// ---------------- نافذة التصفية الموحدة ----------------
function brandOf(p) { return (p.brand || 'GENERIC').trim(); }
function formOf(p) { return getFormBadge(p).txt; }
function activeFilterCount() { return filCats.size + filBrands.size + filForms.size + (filInStock ? 1 : 0); }

// الأصناف بعد تطبيق القسم/التبويب والفلاتر والبحث (مرتبة بالأقرب أولاً عند البحث)
function getFiltered(skipFilters) {
    const qNorm = normSearch(document.getElementById('searchInput').value);
    const qTokens = qNorm ? qNorm.split(' ') : [];
    const scored = [];
    getBaseFilteredByTab().forEach(p => {
        if (!skipFilters) {
            if (filCats.size && !catsOf(p).some(x => filCats.has(x))) return;
            if (filBrands.size && !filBrands.has(brandOf(p))) return;
            if (filForms.size && !filForms.has(formOf(p))) return;
            if (filInStock && !isInStock(p)) return;
        }
        const s = searchScore(p, qNorm, qTokens);
        if (s > 0) scored.push([p, s]);
    });
    if (qTokens.length) scored.sort((a, b) => b[1] - a[1]);
    return scored.map(x => x[0]);
}

function renderFilterChips() {
    const wrap = document.getElementById('activeFilters');
    const btn = document.getElementById('filterBtnCount');
    const n = activeFilterCount();
    if (btn) { btn.innerText = n; btn.style.display = n ? 'flex' : 'none'; }
    if (!wrap) return;
    if (!n) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    const chip = (kind, v) => `<button type="button" class="af-chip" onclick="removeFilter('${kind}', this.dataset.v)" data-v="${escapeHtml(v)}"><span>${escapeHtml(v)}</span><b>✕</b></button>`;
    wrap.innerHTML = [...filCats].map(v => chip('cat', v)).join('') + [...filBrands].map(v => chip('brand', v)).join('') + [...filForms].map(v => chip('form', v)).join('') +
        (filInStock ? `<button type="button" class="af-chip" onclick="removeFilter('stock')"><span>متوفر فقط</span><b>✕</b></button>` : '') +
        `<button type="button" class="af-clear" onclick="resetFilters()">مسح الكل</button>`;
    wrap.style.display = 'flex';
}
function removeFilter(kind, v) {
    if (kind === 'cat') filCats.delete(v); else if (kind === 'brand') filBrands.delete(v); else if (kind === 'form') filForms.delete(v); else filInStock = false;
    renderAll(); if (isFilterSheetOpen()) renderFilterSheet();
}
function resetFilters() { clearFilterState(); renderAll(); if (isFilterSheetOpen()) renderFilterSheet(); }
function isFilterSheetOpen() { const s = document.getElementById('filterSheet'); return !!(s && s.classList.contains('open')); }
function toggleFilter(kind, v) {
    const set = kind === 'cat' ? filCats : kind === 'brand' ? filBrands : filForms;
    if (set.has(v)) set.delete(v); else set.add(v);
    renderAll(); renderFilterSheet();
}
function toggleInStockFilter() { filInStock = !filInStock; renderAll(); renderFilterSheet(); }
let ddOpen = '';                       // القائمة المنسدلة المفتوحة حالياً في نافذة التصفية
const ddQuery = { cat: '', brand: '', form: '' };
function openFilterSheet() {
    ddOpen = ''; ddQuery.cat = ddQuery.brand = ddQuery.form = '';
    renderFilterSheet();
    document.getElementById('filterBackdrop').classList.add('open');
    document.getElementById('filterSheet').classList.add('open');
}
function closeFilterSheet() {
    document.getElementById('filterBackdrop').classList.remove('open');
    document.getElementById('filterSheet').classList.remove('open');
}
function toggleDD(kind) { ddOpen = ddOpen === kind ? '' : kind; ddQuery[kind] = ''; renderFilterSheet(); }
function onDDSearch(kind, v) { ddQuery[kind] = v; renderFilterSheet(kind); }
function renderFilterSheet(focusKind) {
    const box = document.getElementById('filterContent');
    if (!box) return;
    const oldBody = box.querySelector('.fs-body');
    const scroll = oldBody ? oldBody.scrollTop : 0;
    const base = getBaseFilteredByTab();
    const count = (arr, fn) => { const m = new Map(); arr.forEach(p => { const ks = fn(p); (Array.isArray(ks) ? ks : [ks]).forEach(k => m.set(k, (m.get(k) || 0) + 1)); }); return m; };
    const lists = {
        cat: [...count(base, catsOf)].filter(([k]) => k).sort((a, b) => subCategories.indexOf(a[0]) - subCategories.indexOf(b[0])),
        brand: [...count(base, brandOf)].sort((a, b) => a[0].localeCompare(b[0])),
        form: [...count(base, formOf)].sort((a, b) => b[1] - a[1])
    };
    const sets = { cat: filCats, brand: filBrands, form: filForms };
    const titles = { cat: 'التصنيف', brand: 'الشركة', form: 'الشكل الدوائي' };
    const dd = kind => {
        const items = lists[kind], set = sets[kind];
        if (!items.length) return '';
        const open = ddOpen === kind;
        const q = ddQuery[kind].trim().toLowerCase();
        const shown = q ? items.filter(([k]) => k.toLowerCase().includes(q)) : items;
        const summary = set.size === 0 ? 'الكل' : set.size === 1 ? [...set][0] : set.size + ' مختارة';
        return `<div class="fs-dd ${open ? 'open' : ''}">
            <button type="button" class="fs-dd-trigger ${set.size ? 'has' : ''}" onclick="toggleDD('${kind}')" aria-expanded="${open}">
                <span class="fs-dd-title">${titles[kind]}</span><em dir="auto">${escapeHtml(summary)}</em><i>▾</i>
            </button>
            ${open ? `<div class="fs-dd-panel">
                ${items.length > 8 ? `<input type="search" class="fs-search" data-kind="${kind}" placeholder="ابحث..." value="${escapeHtml(ddQuery[kind])}" oninput="onDDSearch('${kind}', this.value)">` : ''}
                <div class="fs-dd-list">${shown.map(([name, n]) => `
                    <label class="fs-dd-row ${set.has(name) ? 'on' : ''}"><input type="checkbox" ${set.has(name) ? 'checked' : ''} data-v="${escapeHtml(name)}" onchange="toggleFilter('${kind}', this.dataset.v)"><span ${kind === 'brand' ? 'dir="ltr"' : ''}>${escapeHtml(name)}</span><b>${n}</b></label>`).join('') || '<div class="fs-none">لا نتائج</div>'}</div>
            </div>` : ''}
        </div>`;
    };
    const total = getFiltered().length;
    box.innerHTML = `
        <div class="fs-head"><h3>تصفية الأصناف</h3><button type="button" class="fs-x" onclick="closeFilterSheet()" aria-label="إغلاق">✕</button></div>
        <div class="fs-body">
            <button type="button" class="fs-switch ${filInStock ? 'on' : ''}" onclick="toggleInStockFilter()"><span>المتوفر فقط</span><i></i></button>
            ${dd('cat')}${dd('brand')}${dd('form')}
        </div>
        <div class="fs-foot">
            <button type="button" class="icon-btn" onclick="resetFilters()" ${activeFilterCount() ? '' : 'disabled'}>مسح الكل</button>
            <button type="button" class="icon-btn primary-btn fs-apply" onclick="closeFilterSheet()">عرض ${total} صنف</button>
        </div>`;
    const nb = box.querySelector('.fs-body'); if (nb) nb.scrollTop = scroll;
    if (focusKind) { const i = box.querySelector('.fs-search[data-kind="' + focusKind + '"]'); if (i) { i.focus(); const l = i.value.length; try { i.setSelectionRange(l, l); } catch (e) {} } }
}

function handleSearch() {
    const q = document.getElementById('searchInput').value;
    document.getElementById('clearSearchBtn').style.display = q.length > 0 ? 'flex' : 'none';
    renderAll();
    scheduleMissCheck(q);   // تسجيل البحث الفاشل (بعد توقف المستخدم عن الكتابة)
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderAll();
}

function productCardHtml(p, tagHtml) {
    const badge = getFormBadge(p);
        const dotCls = isInStock(p) ? ((IS_ADMIN_PAGE && isLowStock(p)) ? 'status-dot low' : 'status-dot') : 'status-dot out';
        const cleanMeta = fixMetaOrder(p.meta);
        return `
            <div class="bento-card" onclick="openSheet(${p.id})">
                <div class="bento-img-wrap">
                    <span class="${dotCls}" id="qd_${p.id}" style="top:10px; right:10px;"></span>
                    <span class="form-badge ${badge.cls} bento-badge-top">${badge.txt}</span>${tagHtml || ''}
                    <img src="${p.img}" alt="" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%221.5%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%224%22/><circle cx=%228.5%22 cy=%228.5%22 r=%221.5%22/><path d=%22M21 15l-5-5L5 21%22/></svg>'">
                </div>
                <div class="bento-body">
                    <div class="bento-brand">${p.brand}</div>
                    <div class="bento-title">${p.name}</div>
                    <div style="font-weight: 900; color: #b45309; font-size: 0.9rem; margin-bottom: 5px;">${p.price ? Number(p.price).toLocaleString() + ' د.ع' : (IS_ADMIN_PAGE ? '0 د.ع' : '')}</div>
                    <div class="bento-sub" dir="ltr">&lrm;${cleanMeta}</div>
                    ${!IS_ADMIN_PAGE ? '' : `<div class="quick-qty" onclick="event.stopPropagation()">
                        <button type="button" aria-label="إنقاص الكمية" onclick="quickQty(${p.id}, -1, event)">−</button>
                        <span class="qs-num" id="qs_${p.id}">${Number(p.qty) || 0}</span>
                        <button type="button" aria-label="زيادة الكمية" onclick="quickQty(${p.id}, 1, event)">+</button>
                    </div>`}
                </div>
            </div>
        `;
}

function renderAll() {
    renderBottomNav();
    renderDepartmentsBar();
    renderFilterChips();
    updateExpiryBadge(); // تحديث عداد جرس الصلاحية للصيدلي

    const tabTitle = getTabTitle();
    document.getElementById('sectionLabel').innerText = `${activeDept === ALL_DEPTS ? ALL_DEPTS_LABEL : activeDept} • ${tabTitle}`;

    const filtered = getFiltered();

    document.getElementById('countLabel').innerText = `${filtered.length} صنف`;
    const container = document.getElementById('itemsContainer');

    if (!filtered.length) {
        const rawQ = document.getElementById('searchInput').value.trim();
        const outTab = mainTab === 'out' && !rawQ;
        container.innerHTML = `<div class="empty-state empty-wide">
            <div class="empty-ico">${outTab ? '🎉' : '🔎'}</div>
            <div>${outTab ? (IS_ADMIN_PAGE ? 'لا توجد نواقص الآن' : 'كل الأصناف متوفرة حالياً') : rawQ ? 'لا توجد نتائج لـ «' + escapeHtml(rawQ) + '»' : activeFilterCount() ? 'لا توجد أصناف تطابق الفلاتر المختارة' : 'لا توجد أصناف هنا بعد'}</div>
            ${rawQ ? '<button type="button" class="empty-btn" onclick="clearSearch()">مسح البحث</button>' : (activeFilterCount() ? '<button type="button" class="empty-btn" onclick="resetFilters()">مسح الفلاتر</button>' : '')}
        </div>`;
        return;
    }

    container.innerHTML = filtered.map(p => productCardHtml(p)).join('');
}
function openSheet(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentOpenId = id;
    const badge = getFormBadge(p);
    const cleanMeta = fixMetaOrder(p.meta);
    const formattedPrice = p.price ? Number(p.price).toLocaleString() : 0;
    const priceTxt = p.price ? ' | ' + formattedPrice + ' د.ع' : (IS_ADMIN_PAGE ? ' | 0 د.ع' : '');
    const stockTag = isInStock(p)
        ? `<span class="form-badge" style="background:#dcfce7; color:#15803d;">متوفر${IS_ADMIN_PAGE ? ' (' + p.qty + ')' : ''}${priceTxt}</span>`
        : `<span class="form-badge" style="background:#fee2e2; color:#b91c1c;">${IS_ADMIN_PAGE ? 'نافذ (0)' : 'غير متوفر'}${priceTxt}</span>`;

    // سطر تاريخ النفاذ داخل لوحة الصيدلي فقط
    const expDates = getProductExpiryDates(p);
    const expiryInfo = expDates.length
        ? `<div style="font-size:0.78rem; font-weight:700; color:#475569; margin-bottom:8px;">📅 ${expDates.length > 1 ? 'تواريخ النفاذ' : 'تاريخ النفاذ'}: ${expDates.map(dt => {
            const st = getExpiryStatus(dt);
            return `<span dir="ltr" style="display:inline-block; margin:0 0 3px 4px; padding:1px 8px; border-radius:6px; background:${st ? st.bg : '#f1f5f9'}; color:${st ? st.color : '#334155'};">${dt}</span>`;
        }).join('')}</div>`
        : `<div style="font-size:0.75rem; color:#94a3b8; margin-bottom:8px;">📅 تاريخ النفاذ: غير محدد</div>`;

    const lowInfo = isLowStock(p)
        ? `<div style="font-size:0.78rem; font-weight:800; color:#c2410c; margin-bottom:6px;">⚠️ كمية قليلة (حد التنبيه: ${getMinQty(p)})</div>`
        : '';
    const retailInfo = hasRetail(p)
        ? `<div class="sheet-section" style="font-size:0.84rem; font-weight:700;">🧩 تُباع بالتجزئة: <b>${escapeHtml(subTypeOf(p))}</b> بسعر <b>${fmtMoney(subPriceOf(p))} د.ع</b> <span style="color:var(--text-sub); font-weight:600;">(العبوة = ${subCountOf(p)} ${escapeHtml(subTypeOf(p))})</span></div>` : '';
    const altHtml = buildAlternativesHtml(p);
    const activeLine = p.activeIngredient
        ? `<p dir="ltr" style="font-size:0.82rem; font-weight:800; color:var(--primary-dark); text-align:left; margin-bottom:6px;">${escapeHtml(p.activeIngredient)}</p>`
        : '';

    document.getElementById('sheetContent').innerHTML = `
        <div class="sheet-header">
            <div class="sheet-img-box" onclick="zoomImage('${p.img}')">
                <img src="${p.img}" alt="" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%221.5%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%224%22/></svg>'">
            </div>
            <div class="sheet-title-area">
                <div class="sheet-brand">${p.brand}</div>
                <div class="sheet-name" dir="ltr" style="text-align:right;">${p.name}</div>
                <div class="sheet-badges">
                    ${stockTag}
                    <span class="form-badge ${badge.cls}">${badge.txt}</span>
                </div>
            </div>
        </div>

        <div class="sheet-section">
            <h4>التركيب والاستخدام الطبي</h4>
            ${activeLine}
            <p>${p.details}</p>
        </div>

        <div class="sheet-section" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div>
                <h4>القسم والتصنيف</h4>
                <p style="font-size:0.86rem; font-weight:700;">${deptsOf(p).map(escapeHtml).join(' + ')} - ${catsOf(p).map(escapeHtml).join(' + ')}</p>
            </div>
            <div style="text-align:left;">
                <h4>العبوة / الشكل الدوائي</h4>
                <p dir="ltr" style="font-size:0.92rem; font-weight:800; color:var(--primary-dark); text-align:left;">&lrm;${cleanMeta}</p>
            </div>
        </div>

        ${retailInfo}
        ${altHtml}

        <!-- أزرار مشاركة المنتج إلى واتساب أو دايركت انستغرام -->
        <div class="share-row">
            <button class="share-btn share-wa" onclick="shareProduct(${p.id}, 'whatsapp')">
                <span>💬</span> <span>مشاركة واتساب</span>
            </button>
            <button class="share-btn share-ig" onclick="shareProduct(${p.id}, 'instagram')">
                <span>📸</span> <span>دايركت انستغرام</span>
            </button>
        </div>

        ${!IS_ADMIN_PAGE ? '' : `<div class="sheet-admin-box">
            <div style="font-size:0.8rem; font-weight:800; color:#b45309; margin-bottom:4px;">⚙️ تحكم الصيدلي المباشر</div>
            ${lowInfo}${expiryInfo}${typeof lastPurchaseHtml === 'function' ? lastPurchaseHtml(p) : ''}
            <div class="admin-row">
                <div class="qty-control-lg">
                    <button onclick="updateItemQty(${p.id}, -1)">-</button>
                    <span style="font-weight:800; min-width:28px; text-align:center;">${stockLabel(p)}</span>
                    <button onclick="updateItemQty(${p.id}, 1)">+</button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="icon-btn" onclick="closeSheet(); openFormModal(${p.id});">✏️ تعديل الصنف</button>
                    <button class="icon-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="deleteItem(${p.id})">🗑️ حذف</button>
                </div>
            </div>
        </div>`}
    `;

    document.getElementById('sheetBackdrop').classList.add('open');
    document.getElementById('bottomSheet').classList.add('open');
}

function closeSheet() {
    document.getElementById('sheetBackdrop').classList.remove('open');
    document.getElementById('bottomSheet').classList.remove('open');
    currentOpenId = null;
    // تنظيف الرابط في الأعلى بعد إغلاق نافذة الدواء
    if (window.location.search.includes('product=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function updateItemQty(id, delta) {
    if (!writesAllowed()) return;
    const p = products.find(x => x.id === id);
    if (!p) return;
    const oldQty = parseInt(p.qty) || 0;
    p.qty = Math.max(0, oldQty + delta);
    saveProductsDelta([{ p, dq: p.qty - oldQty, dl: 0 }]);
    logAction('qty', p, [{ f: 'الكمية', from: String(oldQty), to: String(p.qty) }]);
    renderAll();
    openSheet(id);
}

function populateModalSelects() {
    refreshActiveDatalist();
    const typeSel = document.getElementById('fType');
    if (typeSel) {
        typeSel.innerHTML = `
            <option value="">تلقائي (حسب الاسم والتصنيف)</option>
            <option value="rx">${escTab(tabLabels.rx)}</option>
            <option value="cosmetic">${escTab(tabLabels.cosmetic)}</option>` +
            customTabs.map(t => `<option value="${t.id}">${escTab(t.name)}</option>`).join('');
    }
    document.getElementById('fDepartment').innerHTML = departments.map(d => `<option value="${d}">${d}</option>`).join('');
    document.getElementById('fCategory').innerHTML = subCategories.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ---- الاختيار المتعدد في نموذج الصنف ----
// القسم والتصنيف: قائمة منسدلة واحدة (بحث + إضافة + تعديل + حذف). التبويبات: شرائح بسيطة.
const EXTRA_KINDS = {
    dept: { box: 'fExtraDepts', primary: 'fDepartment', combo: true,  list: () => departments,   noun: 'قسم',    placeholder: 'اختر أقساماً إضافية...' },
    cat:  { box: 'fExtraCats',  primary: 'fCategory',   combo: true,  list: () => subCategories, noun: 'تصنيف',  placeholder: 'اختر تصنيفات إضافية...' },
    type: { box: 'fExtraTypes', primary: 'fType',       combo: false, options: () => [['rx', tabLabels.rx], ['cosmetic', tabLabels.cosmetic]].concat(customTabs.map(t => [t.id, t.name])) }
};
const extraSel = { dept: new Set(), cat: new Set() };
const xcState = { dept: { open: false, q: '' }, cat: { open: false, q: '' } };

function primaryOf(kind) { return (document.getElementById(EXTRA_KINDS[kind].primary) || {}).value || ''; }

function getExtraSelection(kind) {
    const k = EXTRA_KINDS[kind];
    if (k.combo) {
        const prim = primaryOf(kind);
        return k.list().filter(x => extraSel[kind].has(x) && x !== prim);
    }
    const box = document.getElementById(k.box);
    if (!box) return [];
    return Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
}

function renderXcTags(kind) {
    const el = document.getElementById('xcTags_' + kind);
    if (!el) return;
    const sel = getExtraSelection(kind);
    el.innerHTML = (sel.length
        ? sel.map(n => `<span class="xc-tag">${escapeHtml(n)}</span>`).join('')
        : `<span class="xc-ph">${EXTRA_KINDS[kind].placeholder}</span>`) + '<span class="xc-caret">▾</span>';
}

function renderExtraCombo(kind) {
    const k = EXTRA_KINDS[kind];
    const box = document.getElementById(k.box);
    if (!box) return;
    const prim = primaryOf(kind);
    const q = xcState[kind].q;
    const items = k.list().map((name, i) => ({ name, i })).filter(o => o.name !== prim);
    box.innerHTML = `
        <button type="button" class="xc-trigger" id="xcTags_${kind}" onclick="toggleXc('${kind}')"></button>
        <div class="xc-panel" id="xcPanel_${kind}" ${xcState[kind].open ? '' : 'hidden'}>
            <input type="search" class="xc-search" id="xcSearch_${kind}" placeholder="🔍 ابحث..." value="${escapeHtml(q)}" oninput="filterXc('${kind}', this.value)">
            <div class="xc-list">
                ${items.map(o => `
                    <div class="xc-item" data-name="${escapeHtml(o.name.toLowerCase())}">
                        <label class="xc-check"><input type="checkbox" ${extraSel[kind].has(o.name) ? 'checked' : ''} onchange="toggleXcOpt('${kind}', ${o.i}, this.checked)"><span>${escapeHtml(o.name)}</span></label>
                        <button type="button" class="xc-mini" title="تعديل الاسم" onclick="xcRename('${kind}', ${o.i})">✏️</button>
                        <button type="button" class="xc-mini xc-del" title="حذف" onclick="xcDelete('${kind}', ${o.i})">🗑️</button>
                    </div>`).join('') || '<div class="xc-empty">لا توجد خيارات أخرى</div>'}
                <div class="xc-empty" id="xcNone_${kind}" hidden>لا توجد نتائج</div>
            </div>
            <div class="xc-add">
                <input type="text" id="xcNew_${kind}" placeholder="➕ ${k.noun} جديد..." onkeydown="if(event.key==='Enter'){event.preventDefault();xcAdd('${kind}');}">
                <button type="button" onclick="xcAdd('${kind}')">إضافة</button>
            </div>
        </div>`;
    renderXcTags(kind);
    if (q) filterXc(kind, q);
}

function toggleXc(kind) {
    xcState[kind].open = !xcState[kind].open;
    const p = document.getElementById('xcPanel_' + kind);
    if (p) p.hidden = !xcState[kind].open;
}

function filterXc(kind, text) {
    const q = String(text || '').trim().toLowerCase();
    xcState[kind].q = text || '';
    const box = document.getElementById(EXTRA_KINDS[kind].box);
    if (!box) return;
    let shown = 0;
    box.querySelectorAll('.xc-item').forEach(it => {
        const ok = !q || (it.dataset.name || '').includes(q);
        it.style.display = ok ? '' : 'none';
        if (ok) shown++;
    });
    const none = document.getElementById('xcNone_' + kind);
    if (none) none.hidden = shown > 0 || !box.querySelector('.xc-item');
}

function toggleXcOpt(kind, index, checked) {
    const name = EXTRA_KINDS[kind].list()[index];
    if (name === undefined) return;
    if (checked) extraSel[kind].add(name); else extraSel[kind].delete(name);
    renderXcTags(kind);
}

// إعادة بناء قوائم الاختيار في النموذج مع الاحتفاظ بالقيم الأساسية
function repopulateFormSelects(keepDept, keepCat) {
    populateModalSelects();
    const dsel = document.getElementById('fDepartment'), csel = document.getElementById('fCategory');
    if (dsel) dsel.value = departments.includes(keepDept) ? keepDept : departments[0];
    if (csel) csel.value = subCategories.includes(keepCat) ? keepCat : subCategories[0];
    ['dept', 'cat'].forEach(k => {
        extraSel[k] = new Set(Array.from(extraSel[k]).filter(x => EXTRA_KINDS[k].list().includes(x)));
        renderExtraCombo(k);
    });
}

function xcAdd(kind) {
    const inp = document.getElementById('xcNew_' + kind);
    const val = ((inp && inp.value) || '').trim();
    if (!val) return;
    const list = EXTRA_KINDS[kind].list();
    const keepD = primaryOf('dept'), keepC = primaryOf('cat');
    if (list.includes(val)) { extraSel[kind].add(val); }
    else { list.push(val); extraSel[kind].add(val); pushToCloud(true); }
    renderManagerLists();
    repopulateFormSelects(keepD, keepC);
    renderAll();
    const again = document.getElementById('xcNew_' + kind);
    if (again) again.value = '';
}

function xcRename(kind, index) {
    const list = EXTRA_KINDS[kind].list();
    const old = list[index];
    const keepD = primaryOf('dept'), keepC = primaryOf('cat');
    if (kind === 'dept') renameDepartment(index); else renameSubCategory(index);
    const now = list[index];
    if (now !== old) {
        if (extraSel[kind].has(old)) { extraSel[kind].delete(old); extraSel[kind].add(now); }
    }
    repopulateFormSelects(keepD === old ? now : keepD, keepC === old ? now : keepC);
}

// حذف قسم/تصنيف: الأصناف التي كان أساسياً لها تنتقل لأول خيار إضافي لها، وإلا لأول عنصر متبقٍ
async function removeListItem(kind, index) {
    const list = EXTRA_KINDS[kind].list();
    const name = list[index];
    if (name === undefined) return false;
    if (list.length <= 1) {
        await Swal.fire({ icon: 'info', title: 'لا يمكن الحذف', text: 'يجب أن يبقى ' + EXTRA_KINDS[kind].noun + ' واحد على الأقل.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return false;
    }
    const field = kind === 'dept' ? 'department' : 'category';
    const extra = kind === 'dept' ? 'extraDepartments' : 'extraCategories';
    const fallback = list.find(x => x !== name);
    const affected = products.filter(p => p[field] === name || extrasOf(p[extra]).includes(name));
    const moved = products.filter(p => p[field] === name && !extrasOf(p[extra]).some(x => x !== name && list.includes(x)));
    const r = await Swal.fire({
        icon: 'warning',
        title: 'حذف ' + EXTRA_KINDS[kind].noun + ' «' + name + '»؟',
        html: `<div style="font-size:0.9rem; line-height:1.8;">${affected.length ? `يؤثر على ${affected.length} صنف. ${moved.length ? `${moved.length} منها ستنتقل إلى «${escapeHtml(fallback)}».` : ''} لن يُحذف أي صنف.` : 'لا توجد أصناف مرتبطة به.'}</div>`,
        showCancelButton: true,
        confirmButtonText: 'حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#b91c1c'
    });
    if (!r.isConfirmed) return false;
    products.forEach(p => {
        const ex = extrasOf(p[extra]).filter(x => x !== name);
        if (p[field] === name) {
            const next = ex.find(x => x !== name && list.includes(x));
            p[field] = next || fallback;
            p[extra] = ex.filter(x => x !== p[field]);
        } else if (extrasOf(p[extra]).length) {
            p[extra] = ex;
        }
    });
    list.splice(index, 1);
    if (kind === 'cat') filCats.delete(name);
    if (kind === 'dept' && activeDept === name) activeDept = ALL_DEPTS;
    return true;
}

async function xcDelete(kind, index) {
    const old = EXTRA_KINDS[kind].list()[index];
    const keepD = primaryOf('dept'), keepC = primaryOf('cat');
    if (!(await removeListItem(kind, index))) return;
    extraSel[kind].delete(old);
    pushToCloud(false);
    renderManagerLists();
    repopulateFormSelects(keepD, keepC);
    renderAll();
}

// من نافذة الإعدادات
async function deleteManagerItem(kind, index) {
    if (!(await removeListItem(kind, index))) return;
    pushToCloud(false);
    renderManagerLists();
    renderAll();
}

function renderExtraChips(kind, selected) {
    const k = EXTRA_KINDS[kind];
    if (k.combo) {
        extraSel[kind] = new Set(selected || []);
        xcState[kind] = { open: false, q: '' };
        renderExtraCombo(kind);
        return;
    }
    const box = document.getElementById(k.box);
    if (!box) return;
    const prim = primaryOf(kind);
    const sel = new Set(selected || []);
    const opts = k.options().filter(o => o[0] !== prim);
    box.innerHTML = opts.map(o => `<label class="chip-opt"><input type="checkbox" value="${escapeHtml(o[0])}" ${sel.has(o[0]) ? 'checked' : ''}><span>${escapeHtml(o[1])}</span></label>`).join('');
    box.parentElement.style.display = opts.length ? '' : 'none';
}

// عند تغيير الخيار الأساسي: نعيد الرسم مع الإبقاء على ما اختير سابقاً
function refreshExtraChips(kind) {
    const kinds = kind ? [kind] : Object.keys(EXTRA_KINDS);
    kinds.forEach(k => {
        if (EXTRA_KINDS[k].combo) renderExtraCombo(k);
        else renderExtraChips(k, getExtraSelection(k));
    });
}

function setExtraSelections(p) {
    renderExtraChips('dept', p ? extrasOf(p.extraDepartments) : []);
    renderExtraChips('cat', p ? extrasOf(p.extraCategories) : []);
    renderExtraChips('type', p ? extrasOf(p.extraTypes) : []);
}

function openFormModal(id = null) {
    populateModalSelects();
    const modal = document.getElementById('formModal');
    if (id) {
        const p = products.find(x => x.id === id);
        document.getElementById('formModalTitle').innerText = 'تعديل بيانات الصنف';
        document.getElementById('editId').value = p.id;
        document.getElementById('fDepartment').value = p.department || departments[0];
        document.getElementById('fCategory').value = p.category;
        if (document.getElementById('fType')) document.getElementById('fType').value = p.type || (isRxItem(p) ? 'rx' : 'cosmetic');
        if (document.getElementById('fActive')) document.getElementById('fActive').value = p.activeIngredient || '';
        if (document.getElementById('fMinQty')) document.getElementById('fMinQty').value = (p.minQty === null || p.minQty === undefined) ? '' : p.minQty;
        document.getElementById('fBrand').value = p.brand;
        document.getElementById('fName').value = p.name;
        document.getElementById('fDetails').value = p.details;
        document.getElementById('fMeta').value = fixMetaOrder(p.meta);
        document.getElementById('fQty').value = p.qty;
        document.getElementById('fImg').value = p.img || '';
        if (document.getElementById('fPrice')) document.getElementById('fPrice').value = p.price || 0;
        if (document.getElementById('fCost')) document.getElementById('fCost').value = p.costPrice || '';
        fillRetailForm(p);
        if (document.getElementById('fKeywords')) document.getElementById('fKeywords').value = p.keywords || '';
        if (document.getElementById('fBarcode')) document.getElementById('fBarcode').value = '';
        formBarcodes = barcodesOf(p); renderBarcodeChips();
        setExpiryDatesInForm(getProductExpiryDates(p));
        setExtraSelections(p);
    } else {
        document.getElementById('formModalTitle').innerText = 'إضافة صنف جديد';
        document.getElementById('editId').value = '';
        document.getElementById('fDepartment').value = activeDept === ALL_DEPTS ? (departments[0] || '') : activeDept;
        if (document.getElementById('fType')) document.getElementById('fType').value = '';
        if (document.getElementById('fActive')) document.getElementById('fActive').value = '';
        if (document.getElementById('fMinQty')) document.getElementById('fMinQty').value = '';
        if (document.getElementById('scanStatus')) document.getElementById('scanStatus').innerText = '';
        document.getElementById('fBrand').value = '';
        document.getElementById('fName').value = '';
        document.getElementById('fDetails').value = '';
        document.getElementById('fMeta').value = '';
        document.getElementById('fQty').value = 5;
        document.getElementById('fImg').value = '';
        if (document.getElementById('fPrice')) document.getElementById('fPrice').value = 0;
        fillRetailForm(null);
        if (document.getElementById('fKeywords')) document.getElementById('fKeywords').value = '';
        if (document.getElementById('fBarcode')) document.getElementById('fBarcode').value = '';
        formBarcodes = []; renderBarcodeChips();
        setExpiryDatesInForm([]);
        setExtraSelections(null);
    }
    refreshScanEngineLabel();
    modal.style.display = 'flex';
    formSnapshot = formSerialize();
}
let formSnapshot = '';
function formSerialize() {
    const parts = [];
    document.querySelectorAll('#formModal input, #formModal select, #formModal textarea').forEach(el => { if (el.type === 'file') return; parts.push((el.id || el.name || '') + '=' + (el.type === 'checkbox' ? el.checked : el.value)); });
    return parts.join('|') + '|bc=' + JSON.stringify(formBarcodes || []);
}
async function requestCloseForm() {   // إغلاق ذكي: يسأل إن كانت هناك تعديلات غير محفوظة
    const m = document.getElementById('formModal');
    if (!m || m.style.display === 'none' || !m.style.display) return;
    if (formSerialize() === formSnapshot) { closeFormModal(); return; }
    const isEdit = !!document.getElementById('editId').value;
    const r = await Swal.fire({ icon: 'question', title: 'توجد تعديلات غير محفوظة', text: isEdit ? 'ماذا تريد أن تفعل بتعديلات الصنف؟' : 'ماذا تريد أن تفعل بالصنف الجديد؟', showCancelButton: true, showDenyButton: true, confirmButtonText: isEdit ? '💾 حفظ التعديل' : '💾 حفظ الصنف', denyButtonText: 'تجاهل وإغلاق', cancelButtonText: 'متابعة التحرير', confirmButtonColor: '#0f1c38', denyButtonColor: '#b91c1c', reverseButtons: false });
    if (r.isConfirmed) saveFormProduct();
    else if (r.isDenied) closeFormModal();
}

function closeFormModal() {
    document.getElementById('formModal').style.display = 'none';
}

// 1. دالة رفع الصورة مباشرة داخل مجلد (images) في مستودع GitHub
async function uploadImgBase64(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        return Swal.fire({
            icon: 'warning',
            title: 'صيغة غير مدعومة',
            text: 'يرجى اختيار صورة صحيحة!',
            confirmButtonColor: '#0f1c38'
        });
    }

    // بيانات مستودع صيدلية الديوان على GitHub
    const GITHUB_USERNAME = "BasraCliniciansApps";
    const GITHUB_REPO = "Al-Diwan-Pharmacy";
    const GITHUB_BRANCH = "main";
    const IMAGES_FOLDER = "images"; // 📁 اسم الفولدر المخصص للصور لمنع الهوسة

    // جلب المفتاح من ذاكرة الهاتف
    let githubToken = localStorage.getItem('diwan_gh_token');
    if (!githubToken) {
        const { value: tokenInput } = await Swal.fire({
            title: 'إعداد مفتاح GitHub (لأول مرة فقط)',
            text: 'الصق مفتاح التوكن (الذي يبدأ بـ ghp_) ليتم حفظه في جهازك بأمان لرفع الصور:',
            input: 'text',
            inputPlaceholder: 'ghp_...',
            confirmButtonColor: '#0f1c38',
            confirmButtonText: 'حفظ المفتاح ومتابعة الرفع',
            showCancelButton: true,
            cancelButtonText: 'إلغاء'
        });

        if (!tokenInput || !tokenInput.trim()) {
            event.target.value = "";
            return;
        }
        githubToken = tokenInput.trim();
        localStorage.setItem('diwan_gh_token', githubToken);
    }

    const imgInput = document.getElementById('fImg');
    imgInput.value = "⏳ جاري رفع الصورة إلى مجلد الصور...";

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const max = 600;
            let w = img.width, h = img.height;
            if (w > h && w > max) { h *= max / w; w = max; }
            else if (h > max) { w *= max / h; h = max; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            const base64Content = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
            const fileName = `med_${Date.now()}.jpg`;
            
            // المسار الكامل داخل فولدر الصور: images/med_123456.jpg
            const filePath = `${IMAGES_FOLDER}/${fileName}`;

            try {
                const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;
                const response = await fetch(apiUrl, {
                    method: "PUT",
                    headers: {
                        "Authorization": `token ${githubToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: `إضافة صورة دواء في مجلد الصور: ${fileName}`,
                        content: base64Content,
                        branch: GITHUB_BRANCH
                    })
                });

                const result = await response.json();

                if (response.ok && result.content) {
                    // الرابط المباشر يشير إلى داخل فولدر images
                    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;
                    imgInput.value = rawUrl;

                    Swal.fire({
                        icon: 'success',
                        title: 'تم حفظ الصورة في فولدر (images) بنجاح!',
                        toast: true,
                        position: 'bottom',
                        showConfirmButton: false,
                        timer: 2000
                    });
                } else {
                    if (response.status === 401) {
                        localStorage.removeItem('diwan_gh_token');
                    }
                    throw new Error(result.message || "فشل الرفع إلى GitHub");
                }
            } catch (err) {
                imgInput.value = "";
                Swal.fire({
                    icon: 'error',
                    title: 'تعذر رفع الصورة إلى GitHub',
                    text: 'السبب: ' + err.message,
                    confirmButtonColor: '#0f1c38'
                });
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 3. دالة زر "حفظ" داخل نافذة إضافة/تعديل الصنف
async function saveFormProduct() {
    if (!writesAllowed()) return;
    const imgVal = document.getElementById('fImg').value.trim();
    if (imgVal.includes("⏳")) {
        return Swal.fire({
            icon: 'info',
            title: 'انتظر لحظة...',
            text: 'جاري رفع الصورة إلى GitHub، انتظر ثانية حتى يظهر الرابط ثم اضغط حفظ.',
            confirmButtonColor: '#0f1c38'
        });
    }

    const nameVal = document.getElementById('fName').value.trim();
    if (!nameVal) {
        return Swal.fire({
            icon: 'warning',
            title: 'تنبيه',
            text: 'يرجى إدخال اسم الصنف أولاً!',
            confirmButtonColor: '#0f1c38'
        });
    }

    const expiryDates = getExpiryDatesFromForm();
    const pendingBc = cleanBarcode((document.getElementById('fBarcode') || {}).value);
    if (pendingBc && !formBarcodes.includes(pendingBc)) formBarcodes.push(pendingBc);
    const editId = document.getElementById('editId').value;
    const obj = {
        id: editId ? parseInt(editId) : Date.now(),
        department: document.getElementById('fDepartment').value,
        category: document.getElementById('fCategory').value,
        type: document.getElementById('fType') ? document.getElementById('fType').value : '',
        extraDepartments: getExtraSelection('dept').filter(x => x !== document.getElementById('fDepartment').value),
        extraCategories: getExtraSelection('cat').filter(x => x !== document.getElementById('fCategory').value),
        extraTypes: getExtraSelection('type').filter(x => x !== (document.getElementById('fType').value || '')),
        activeIngredient: document.getElementById('fActive') ? document.getElementById('fActive').value.trim() : '',
        minQty: (document.getElementById('fMinQty') && document.getElementById('fMinQty').value !== '') ? (parseInt(document.getElementById('fMinQty').value) || 0) : null,
        brand: document.getElementById('fBrand').value.trim() || 'GENERIC',
        name: nameVal,
        details: document.getElementById('fDetails').value.trim(),
        meta: fixMetaOrder(document.getElementById('fMeta').value.trim()),
        qty: parseInt(document.getElementById('fQty').value) || 0,
        price: document.getElementById('fPrice') ? (parseFloat(document.getElementById('fPrice').value) || 0) : 0,
        costPrice: document.getElementById('fCost') ? (parseFloat(document.getElementById('fCost').value) || 0) : 0,
        ...readRetailForm(),
        ...((() => { const o = editId ? products.find(x => x.id === parseInt(editId)) : null; return o && o.lastPurchase ? { lastPurchase: o.lastPurchase } : {}; })()),
        expiryDates: expiryDates,
        expiryDate: expiryDates[0] || '',   // الأقرب نفاذاً (للتوافق مع الأكواد القديمة)
        keywords: document.getElementById('fKeywords') ? document.getElementById('fKeywords').value.trim() : '',
        barcode: formBarcodes[0] || '',
        barcodes: formBarcodes.slice(),
        img: imgVal
      
    };

    let oldProduct = null;
    if (editId) {
        const idx = products.findIndex(x => x.id === parseInt(editId));
        if (idx > -1) { oldProduct = JSON.parse(JSON.stringify(products[idx])); products[idx] = obj; }
    } else {
        products.unshift(obj);
    }
    
    closeFormModal();
    renderAll();

    const success = await saveSingleProductToCloud(obj);
    if (typeof onProductSaved === 'function') onProductSaved(obj);
    if (success) {
        logAction(oldProduct ? 'edit' : 'add', obj, oldProduct ? diffProduct(oldProduct, obj) : []);
        Swal.fire({
            icon: 'success',
            title: 'تم حفظ الصنف وصورته بنجاح!',
            toast: true,
            position: 'bottom',
            showConfirmButton: false,
            timer: 2000
        });
    }
}
// دالة الحذف المصححة
function deleteItem(id) {
    if (!writesAllowed()) return;
    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "سينتقل الصنف إلى «سلة المحذوفات» ويمكنك استعادته خلال 30 يوماً.",
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف!',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const doomed = products.find(x => x.id === id);
            if (doomed) { await moveToTrash(doomed); logAction('delete', doomed, []); }
            products = products.filter(x => x.id !== id);
            saveLocal();
            
            if (isFirebaseReady && currentUser) {
                try {
                    const delB = db.batch();
                    delB.delete(db.collection('pharmacy_products').doc(id.toString()));
                    delB.delete(db.collection('pharmacy_stock').doc(id.toString()));
                    await fsCommit(delB);
                } catch (e) {
                    console.warn("Delete Cloud Error:", e);
                }
            }
            
            closeSheet();
            renderAll();
            
            Swal.fire({
                icon: 'success',
                title: 'تم الحذف بنجاح',
                toast: true,
                position: 'bottom',
                showConfirmButton: false,
                timer: 2000
            });
        }
    });
}

function zoomImage(src) {
    if (!src) return;
    document.getElementById('zoomImg').src = src;
    document.getElementById('zoomModal').style.display = 'flex';
}
// ============================================================================
// 8. نظام مراقبة تواريخ النفاذ (قبل 6 أشهر وقبل 3 أشهر) - خاص بالصيدلي
// ============================================================================
// كل تواريخ نفاذ المنتج (يدعم الصيغة القديمة: تاريخ واحد فقط)
function getProductExpiryDates(p) {
    const arr = (Array.isArray(p.expiryDates) && p.expiryDates.length) ? p.expiryDates : (p.expiryDate ? [p.expiryDate] : []);
    return [...new Set(arr.filter(Boolean))].sort();   // الأقرب أولاً (YYYY-MM)
}

function addExpiryRow(value = '') {
    const wrap = document.getElementById('expiryDatesWrap');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'expiry-row';
    row.innerHTML = `<input type="month" dir="ltr" class="expiry-input" value="${value}">
        <button type="button" class="icon-btn expiry-remove" title="حذف هذا التاريخ">✕</button>`;
    row.querySelector('.expiry-remove').onclick = () => {
        row.remove();
        if (!wrap.children.length) addExpiryRow();   // دائماً يبقى حقل واحد على الأقل
    };
    wrap.appendChild(row);
}

function setExpiryDatesInForm(dates) {
    const wrap = document.getElementById('expiryDatesWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    (dates && dates.length ? dates : ['']).forEach(dt => addExpiryRow(dt));
}

function getExpiryDatesFromForm() {
    const inputs = document.querySelectorAll('#expiryDatesWrap .expiry-input');
    return [...new Set([...inputs].map(i => i.value).filter(Boolean))].sort();
}

function getExpiryStatus(expiryDateStr) {
    if (!expiryDateStr) return null; // الصيغة قادمة كـ "YYYY-MM"
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // تثبيت اليوم على أنه الأول من الشهر الحالي (اليوم 01)
    const [year, month] = expiryDateStr.split('-');
    if (!year || !month) return null;
    
    // إنشاء تاريخ لليوم الأول من الشهر المختار
    const exp = new Date(parseInt(year), parseInt(month) - 1, 1);
    if (isNaN(exp.getTime())) return null;

    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        return { level: 'expired', days: diffDays, label: 'منتهي الصلاحية!', bg: '#fee2e2', color: '#991b1b', border: '#f87171' };
    } else if (diffDays <= 90) { // أقل من 3 أشهر
        return { level: '3m', days: diffDays, label: `أقل من 3 أشهر (يبدأ نفاذه في ${expiryDateStr}-01)`, bg: '#ffedd5', color: '#c2410c', border: '#fb923c' };
    } else if (diffDays <= 180) { // بين 3 إلى 6 أشهر
        return { level: '6m', days: diffDays, label: `أقل من 6 أشهر (يبدأ نفاذه في ${expiryDateStr}-01)`, bg: '#fef9c3', color: '#854d0e', border: '#facc15' };
    }
    return null; 
}

function getExpiringProducts() {
    const list = [];
    products.forEach(p => {
        getProductExpiryDates(p).forEach(date => {
            const status = getExpiryStatus(date);
            if (status) list.push({ product: p, status, date });
        });
    });
    return list.sort((a, b) => a.status.days - b.status.days);   // الأقرب للانتهاء أولاً
}

function updateExpiryBadge() {
    const badge = document.getElementById('expiryBadgeCount');
    if (!badge) return;
    const total = getExpiringProducts().length + getLowStockProducts().length;
    if (total > 0) {
        badge.innerText = total;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function closeExpiryModal() {
    document.getElementById('expiryModal').style.display = 'none';
}

// ============================================================================
// 9. مشاركة رابط مباشر للمنتج (Deep Link) إلى واتساب أو دايركت إنستغرام
// ============================================================================
async function shareProduct(id, platform) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    // توليد الرابط المباشر الذي يفتح هذا المنتج تحديداً عند النقر عليه
    const baseUrl = window.location.origin + window.location.pathname;
    const productLink = `${baseUrl}?product=${p.id}`;

    const msg = `🏥 *صيدلية الديوان*\n💊 *${p.name}*\n🔗 اضغط على الرابط لعرض المنتج:\n${productLink}`;

    if (platform === 'whatsapp') {
        const waUrl = `https://wa.me/${PHARMACY_WHATSAPP}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    } else if (platform === 'instagram') {
        try {
            await navigator.clipboard.writeText(msg);
            await Swal.fire({
                icon: 'success',
                title: 'تم نسخ رابط المنتج!',
                text: 'سيتم الآن فتح محادثة إنستغرام الصيدلية، فقط اضغط (لصق / Paste) لإرسال الرابط.',
                confirmButtonColor: '#0f1c38',
                confirmButtonText: 'فتح إنستغرام'
            });
        } catch (e) {}
        window.open(`https://ig.me/m/${PHARMACY_INSTAGRAM}`, '_blank');
    }
}

// دالة تفحص الرابط عند فتح الموقع: إذا كان يحتوي على (?product=ID) تفتح بطاقة الدواء فوراً
function checkSharedProductUrl() {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('product');
    if (sharedId) {
        const idNum = parseInt(sharedId);
        const found = products.find(x => x.id === idNum);
        if (found && currentOpenId !== idNum) {
            openSheet(idNum);
        }
    }
}

window.onload = function() {
    renderAll();
    initFirebase();
    checkSharedProductUrl();
    setTimeout(updateConnectionBadge, 1500);
};

// ============================================================================
// 9. مسح العبوة بالكاميرا (قراءة الاسم والتركيز والشكل الدوائي والصلاحية)
// ============================================================================
let tesseractPromise = null;

function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    if (!tesseractPromise) {
        tesseractPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
            s.onload = resolve;
            s.onerror = () => {
                tesseractPromise = null;
                reject(new Error('تعذر تحميل مكتبة القراءة. تأكد من اتصال الإنترنت وحاول مرة أخرى.'));
            };
            document.head.appendChild(s);
        });
    }
    return tesseractPromise;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// تصغير الصورة وتحسين التباين لرفع دقة القراءة
function prepareImageForOcr(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const maxSide = 1800;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const px = imgData.data;
            for (let i = 0; i < px.length; i += 4) {
                const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
                px[i] = px[i + 1] = px[i + 2] = v;
            }
            ctx.putImageData(imgData, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذر فتح الصورة.')); };
        img.src = url;
    });
}

const SCAN_FORMS = [
    [/\btablets?\b|\btabs?\b/i, 'Tablets'],
    [/\bcapsules?\b|\bcaps\b/i, 'Capsules'],
    [/\bsyrup\b/i, 'Syrup'],
    [/\bsuspension\b/i, 'Suspension'],
    [/\bdrops?\b/i, 'Drops'],
    [/\bointment\b/i, 'Ointment'],
    [/\bcream\b/i, 'Cream'],
    [/\bgel\b/i, 'Gel'],
    [/\blotion\b/i, 'Lotion'],
    [/\bshampoo\b/i, 'Shampoo'],
    [/\bserum\b/i, 'Serum'],
    [/\bspray\b/i, 'Spray'],
    [/\bsolution\b/i, 'Solution'],
    [/\bcleanser\b|\bwash\b/i, 'Wash'],
    [/\bsoap\b/i, 'Soap'],
    [/\binjection\b|\bampoules?\b|\bvials?\b/i, 'Injection'],
    [/\bsachets?\b/i, 'Sachets'],
    [/\bsuppositor(?:y|ies)\b/i, 'Suppositories']
];

function normalizeUnit(num, unit) {
    const n = num.replace(',', '.');
    const u = unit.toLowerCase().replace('µg', 'mcg').replace('gm', 'g');
    return u === '%' ? `${n}%` : `${n} ${u === 'iu' ? 'IU' : u}`;
}

function parseExpiryFromText(text) {
    const lead = '(?:exp(?:iry)?|use\\s*before|best\\s*before)\\.?\\s*(?:date)?\\s*[:\\-]?\\s*';
    let m = text.match(new RegExp(lead + '(\\d{1,2})\\s*[\\/\\-. ]\\s*(\\d{4}|\\d{2})\\b', 'i'));
    let month, year;
    if (m) { month = parseInt(m[1]); year = parseInt(m[2]); }
    else {
        m = text.match(new RegExp(lead + '(\\d{4})\\s*[\\/\\-. ]\\s*(\\d{1,2})\\b', 'i'));
        if (m) { year = parseInt(m[1]); month = parseInt(m[2]); }
    }
    if (!month) return '';
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || year < 2020 || year > 2045) return '';
    return `${year}-${String(month).padStart(2, '0')}`;
}

function toTitleIfAllCaps(s) {
    if (s !== s.toUpperCase()) return s;
    return s.split(/\s+/).map(w => /\d/.test(w) || w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

// استخراج الحقول من النص المقروء (lines اختياري: أسطر مع ارتفاع الخط لمعرفة أكبر نص = الاسم التجاري)
function parseProductText(text, lines) {
    const clean = (text || '').replace(/[|_]/g, ' ');

    // --- التركيز (potency) ---
    let potency = '';
    const compound = clean.match(/(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|g|iu)\s?\/\s?(\d+(?:[.,]\d+)?)?\s?(ml|g)\b/i);
    if (compound) {
        potency = `${normalizeUnit(compound[1], compound[2])}/${compound[3] ? compound[3] + ' ' : ''}${compound[4].toLowerCase()}`;
    } else {
        const found = [];
        const re = /(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|iu|%)/gi;
        let m;
        while ((m = re.exec(clean)) !== null) {
            const v = normalizeUnit(m[1], m[2]);
            if (!found.includes(v)) found.push(v);
        }
        potency = found.slice(0, 3).join(' / ');
    }

    // --- العبوة والشكل ---
    let form = '';
    for (const [re, name] of SCAN_FORMS) { if (re.test(clean)) { form = name; break; } }

    // التركيز بالغرام (1 g) للأقراص والكبسول والحقن فقط، لأن g في الكريمات تعني حجم العبوة
    if (!potency && /^(Tablets|Capsules|Sachets|Injection|Suppositories)$/.test(form)) {
        const g = clean.match(/(\d+(?:[.,]\d+)?)\s?g\b/i);
        if (g) potency = normalizeUnit(g[1], 'g');
    }

    let pack = '';
    const count = clean.match(/(\d{1,4})\s*(?:film[-\s]?coated\s+|coated\s+|chewable\s+|effervescent\s+)?(tablets?|capsules?|caps|sachets?|ampoules?|vials?|suppositor(?:y|ies))\b/i);
    const countAfter = !count && clean.match(/\b(tablets?|capsules?|caps|sachets?|ampoules?|vials?|suppositor(?:y|ies))\s*[x×:\-]?\s*(\d{1,4})\b/i);
    if (count) {
        pack = `${count[1]} ${count[2].charAt(0).toUpperCase() + count[2].slice(1).toLowerCase()}`;
    } else if (countAfter) {
        pack = `${countAfter[2]} ${countAfter[1].charAt(0).toUpperCase() + countAfter[1].slice(1).toLowerCase()}`;
    } else {
        const vol = clean.replace(compound ? compound[0] : '', ' ').match(/(\d+(?:[.,]\d+)?)\s?(ml|g)\b/i);
        if (vol) pack = normalizeUnit(vol[1], vol[2]);
    }
    let meta = '';
    if (count || countAfter) meta = pack;
    else meta = [pack, form].filter(Boolean).join(' | ');

    // --- الاسم التجاري: أكبر سطر نصي ---
    let name = '';
    const candidates = (lines || [])
        .map(l => ({ text: (l.text || '').replace(/\s+/g, ' ').trim(), h: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0, conf: l.confidence || 0 }))
        .filter(l => {
            const letters = (l.text.match(/[A-Za-z]/g) || []).length;
            return letters >= 3 && letters / l.text.length >= 0.6 && l.conf >= 40;
        });
    if (candidates.length) {
        candidates.sort((a, b) => b.h - a.h);
        name = candidates[0].text;
    } else {
        const first = clean.split('\n').map(s => s.trim()).find(s => (s.match(/[A-Za-z]/g) || []).length >= 3);
        name = first || '';
    }
    name = name
        .replace(/(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|iu|ml|g|%)\b.*$/i, '')
        .replace(/[^A-Za-z0-9 .+\-&()]/g, ' ')
        .replace(/\s+/g, ' ').trim();
    name = toTitleIfAllCaps(name);

    // --- الشركة: مطابقة مع الشركات الموجودة عندك ---
    let brand = '';
    const upper = clean.toUpperCase();
    const brands = [...new Set((typeof products !== 'undefined' ? products : []).map(p => (p.brand || '').trim()).filter(b => b && b !== 'GENERIC'))];
    brand = brands.find(b => upper.includes(b.toUpperCase())) || '';

    return { name, potency, meta, form, brand, expiry: parseExpiryFromText(clean) };
}

async function scanWithOcr(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const status = document.getElementById('scanStatus');
    const setStatus = (t) => { if (status) status.innerText = t; };

    try {
        setStatus('⏳ جاري تجهيز الصورة...');
        const canvas = await prepareImageForOcr(file);

        setStatus('⏳ تحميل أداة القراءة (أول مرة فقط)...');
        await loadTesseract();

        setStatus('⏳ جاري القراءة... 0%');
        const result = await Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') setStatus(`⏳ جاري القراءة... ${Math.round(m.progress * 100)}%`);
            }
        });
        const data = result.data || {};
        const parsed = parseProductText(data.text || '', data.lines || []);
        setStatus('');

        const fullName = [parsed.name, parsed.potency].filter(Boolean).join(' ');
        const rows = [
            ['الاسم والتركيز', fullName],
            ['العبوة / الشكل', parsed.meta],
            ['الشركة', parsed.brand],
            ['تاريخ النفاذ', parsed.expiry]
        ];

        if (!rows.some(r => r[1])) {
            await Swal.fire({
                icon: 'warning',
                title: 'لم أتمكن من قراءة نص واضح',
                html: '<div style="font-size:0.9rem; line-height:1.7;">جرّب صورة أقرب، بإضاءة جيدة، والعبوة مسطحة وغير لامعة، مع إظهار الاسم بوضوح.</div>',
                confirmButtonColor: '#0f1c38',
                confirmButtonText: 'حسناً'
            });
            return;
        }

        const html = `
            <div style="text-align:right; font-size:0.9rem;">
                ${rows.map(([k, v]) => `
                    <div style="display:flex; justify-content:space-between; gap:10px; padding:7px 0; border-bottom:1px solid var(--border);">
                        <b>${k}</b>
                        <span dir="ltr" style="color:${v ? 'var(--text-main)' : 'var(--text-sub)'};">${v ? escapeHtml(v) : 'لم يُقرأ'}</span>
                    </div>`).join('')}
                <p style="margin-top:12px; color:#b91c1c; font-weight:700; font-size:0.82rem;">راجع التركيز بدقة قبل الحفظ (مثل 5 mg أو 50 mg).</p>
                <details style="margin-top:8px; font-size:0.78rem; color:var(--text-sub);">
                    <summary>النص الذي قرأه التطبيق</summary>
                    <pre dir="ltr" style="white-space:pre-wrap; text-align:left; margin-top:6px;">${escapeHtml((data.text || '').trim())}</pre>
                </details>
            </div>`;

        const choice = await Swal.fire({
            title: 'نتيجة المسح',
            html,
            showCancelButton: true,
            confirmButtonText: 'تعبئة الحقول',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#0f1c38'
        });

        if (choice.isConfirmed) {
            if (fullName) document.getElementById('fName').value = fullName;
            if (parsed.meta) document.getElementById('fMeta').value = parsed.meta;
            if (parsed.brand) document.getElementById('fBrand').value = parsed.brand;
            if (parsed.expiry) setExpiryDatesInForm([...getExpiryDatesFromForm(), parsed.expiry]);
        }
    } catch (err) {
        setStatus('');
        Swal.fire({ icon: 'error', title: 'تعذر المسح', text: err.message || String(err), confirmButtonColor: '#0f1c38' });
    } finally {
        input.value = ''; // للسماح باختيار نفس الصورة مرة أخرى
    }
}

// ============================================================================
// 10. العمل بدون إنترنت: التصفح يعمل دائماً، أما الحفظ في السحابة فيحتاج اتصالاً
// ============================================================================
function requireOnline() {
    if (navigator.onLine) return true;
    Swal.fire({
        icon: 'warning',
        title: 'لا يوجد اتصال بالإنترنت',
        text: 'التصفح والبحث يعملان بدون إنترنت، لكن الإضافة والتعديل والحذف تحتاج اتصالاً حتى تُحفظ في السحابة.',
        confirmButtonColor: '#0f1c38',
        confirmButtonText: 'حسناً'
    });
    return false;
}

function updateConnectionBadge() { syncRefresh(); }
window.addEventListener('offline', updateConnectionBadge);
window.addEventListener('online', () => {
    syncRefresh(); checkPending();
    try { if (typeof syncLocalRecords === 'function') syncLocalRecords(true).catch(() => {}); } catch (e) { /* تجاهل */ }
});

// ============================================================================
// 11. تنبيه الكمية القليلة
// ============================================================================
function getMinQty(p) {
    const v = parseInt(p.minQty);
    return isNaN(v) ? lowStockThreshold : v;   // حد الصنف إن وُجد، وإلا الحد العام من الإعدادات
}

function isLowStock(p) {
    const q = parseInt(p.qty) || 0;
    return q > 0 && q <= getMinQty(p);
}

function getLowStockProducts() {
    return products.filter(isLowStock).sort((a, b) => (parseInt(a.qty) || 0) - (parseInt(b.qty) || 0));
}

function buildLowStockSection() {
    const list = getLowStockProducts();
    const title = '<div class="alert-title">📉 كمية قليلة</div>';
    if (!list.length) {
        return title + `<div style="text-align:center; padding:18px; color:#15803d; font-weight:700;">✅ لا توجد أصناف وصلت للحد الأدنى.</div>`;
    }
    return title + list.map(p => `
        <div onclick="closeExpiryModal(); openSheet(${p.id});" style="cursor:pointer; padding:10px 12px; border-radius:10px; background:#fff7ed; border:1px solid #fdba74; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
                <div style="font-weight:800; font-size:0.88rem; color:#0f172a;" dir="ltr">${escapeHtml(p.name)}</div>
                <div style="font-size:0.75rem; color:#475569;">الشركة: ${escapeHtml(p.brand || '')}</div>
            </div>
            <div style="text-align:left; flex-shrink:0;">
                <div style="font-size:0.78rem; font-weight:800; color:#c2410c;">الكمية: ${p.qty}</div>
                <div style="font-size:0.72rem; font-weight:700; color:#334155;">الحد: ${getMinQty(p)}</div>
            </div>
        </div>
    `).join('');
}

function saveAlertMonths() {
    const a = ['alertM1', 'alertM2', 'alertM3'].map(id => parseInt(document.getElementById(id).value));
    if (a.some(n => isNaN(n) || n < 1) || !(a[0] < a[1] && a[1] < a[2])) {
        Swal.fire({ icon: 'warning', title: 'أدخل ثلاث مدد بالأشهر مرتبة تصاعدياً (مثال 1 ثم 3 ثم 6)', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return;
    }
    alertMonths = a;
    pushToCloud(true);
    if (typeof refreshHome === 'function') refreshHome();
    Swal.fire({ icon: 'success', title: 'تم حفظ مدد التنبيه', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
}

function saveLowThreshold() {
    const v = parseInt(document.getElementById('lowThresholdInput').value);
    if (isNaN(v) || v < 0) {
        Swal.fire({ icon: 'warning', title: 'أدخل رقماً صحيحاً (0 أو أكثر)', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return;
    }
    lowStockThreshold = v;
    pushToCloud(true);
    renderAll();
    Swal.fire({ icon: 'success', title: 'تم حفظ حد التنبيه', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
}

// ============================================================================
// 12. البدائل بنفس المادة الفعالة
// ============================================================================
function ingredientKey(str) {
    return (str || '')
        .toLowerCase()
        .replace(/\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|iu|%)/g, ' ')   // نتجاهل التركيز لو كُتب بالخطأ
        .split(/[+,\/،&]|\band\b/)
        .map(s => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .sort()
        .join('+');
}

function getAlternatives(p) {
    const key = ingredientKey(p.activeIngredient);
    if (!key) return [];
    return products
        .filter(x => x.id !== p.id && ingredientKey(x.activeIngredient) === key)
        .sort((a, b) => {
            const sa = isInStock(a) ? 0 : 1;
            const sb = isInStock(b) ? 0 : 1;
            if (sa !== sb) return sa - sb;                                  // المتوفر أولاً
            return (Number(a.price) || 1e12) - (Number(b.price) || 1e12);   // ثم الأرخص
        });
}

function buildAlternativesHtml(p) {
    const alts = getAlternatives(p);
    if (!alts.length) return '';
    return `
        <div class="sheet-section alt-section">
            <h4>بدائل بنفس المادة الفعالة (${alts.length})</h4>
            <div class="alt-list">
                ${alts.map(a => {
                    const inStock = isInStock(a);
                    const price = a.price ? Number(a.price).toLocaleString() + ' د.ع' : '';
                    return `
                    <div class="alt-item ${inStock ? '' : 'alt-out'}" onclick="openSheet(${a.id}); document.getElementById('bottomSheet').scrollTop = 0;">
                        <span class="alt-dot ${inStock ? '' : 'out'}"></span>
                        <div class="alt-main">
                            <div class="alt-name" dir="ltr">${escapeHtml(a.name)}</div>
                            <div class="alt-sub">${escapeHtml(a.brand || '')}${price ? ' | ' + price : ''}${inStock ? '' : ' | نافذ'}</div>
                        </div>
                        <div class="alt-meta" dir="ltr">${escapeHtml(fixMetaOrder(a.meta))}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
}

// قائمة اقتراحات المواد الفعالة المكتوبة سابقاً (لتوحيد الكتابة)
function refreshActiveDatalist() {
    const dl = document.getElementById('activeList');
    if (!dl) return;
    const seen = new Map();
    products.forEach(p => {
        const v = (p.activeIngredient || '').trim();
        if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    });
    dl.innerHTML = [...seen.values()].sort().map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
}

// حفظ عدة أصناف دفعة واحدة في السحابة
async function saveProductsBatch(list) {
    saveLocal();
    if (!isFirebaseReady || !currentUser) {
        await Swal.fire({ icon: 'error', title: 'أنت غير مسجل الدخول!', text: 'سجّل دخول الصيدلي أولاً ليتم الحفظ في الإنترنت.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return false;
    }
    if (!writesAllowed()) return false;
    setSyncText('⏳ جاري الحفظ...');
    try {
        for (let i = 0; i < list.length; i += 20) {
            const batch = db.batch();
            list.slice(i, i + 20).forEach(p => {
                writeProductBatch(batch, p);
            });
            await fsCommit(batch);
        }
        syncStockLocal(list);
        setSyncText('☁️ تم الحفظ');
        return true;
    } catch (err) {
        setSyncText('❌ فشل الحفظ');
        await Swal.fire({ icon: 'error', title: 'خطأ في السحابة', text: err.message, confirmButtonColor: '#0f1c38' });
        return false;
    }
}

// حفظ تغييرات المخزون كـ«فروقات» (increment) بدل الأرقام النهائية، حتى لا يضيع تغيير جهاز بتغيير جهاز آخر
function deltaFromSnap(p, s) {
    const d = { p, dq: (parseInt(p.qty) || 0) - (parseInt(s.qty) || 0), dl: (parseInt(p.loose) || 0) - (parseInt(s.loose) || 0) };
    const a = getProductExpiryDates({ expiryDates: s.expiryDates, expiryDate: s.expiryDate }), b = getProductExpiryDates(p);
    d.expAdd = b.filter(x => !a.includes(x)); d.expRemove = a.filter(x => !b.includes(x)); d.expChanged = !!(d.expAdd.length || d.expRemove.length);
    if ((s.costPrice || 0) !== (p.costPrice || 0)) d.cost = p.costPrice || 0;
    if (JSON.stringify(s.lastPurchase || null) !== JSON.stringify(p.lastPurchase || null)) { d.lastSet = true; d.last = p.lastPurchase || null; }
    return d;
}
async function saveProductsDelta(entries) {
    entries = (entries || []).filter(Boolean);
    saveLocal();
    if (!isFirebaseReady || !currentUser) {
        await Swal.fire({ icon: 'error', title: 'أنت غير مسجل الدخول!', text: 'سجّل دخول الصيدلي أولاً ليتم الحفظ في الإنترنت.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return false;
    }
    if (!writesAllowed()) return false;
    const F = fv();
    setSyncText('⏳ جاري الحفظ...');
    try {
        for (let i = 0; i < entries.length; i += 15) {
            const batch = db.batch();
            entries.slice(i, i + 15).forEach(e => {
                const { pub, stock } = splitProduct(e.p);
                batch.set(db.collection('pharmacy_products').doc(String(e.p.id)), pub);
                const ref = db.collection('pharmacy_stock').doc(String(e.p.id));
                const cur = stockMap[String(e.p.id)];
                if (!F || !cur) { batch.set(ref, stock); return; }
                const u = { id: e.p.id };
                if (e.dq) u.qty = F.increment(e.dq);
                if (e.dl) u.loose = F.increment(e.dl);
                if (e.cost !== undefined) u.costPrice = e.cost;
                if (e.lastSet) u.lastPurchase = e.last;
                if (e.expChanged) {
                    if (e.expAdd.length && !e.expRemove.length && Array.isArray(cur.expiryDates)) u.expiryDates = F.arrayUnion(...e.expAdd);
                    else if (e.expRemove.length && !e.expAdd.length && Array.isArray(cur.expiryDates)) u.expiryDates = F.arrayRemove(...e.expRemove);
                    else u.expiryDates = getProductExpiryDates(e.p);
                    u.expiryDate = getProductExpiryDates(e.p)[0] || '';
                }
                batch.set(ref, u, { merge: true });
            });
            await fsCommit(batch);
        }
        syncStockLocal(entries.map(e => e.p));
        setSyncText('☁️ تم الحفظ');
        return true;
    } catch (err) {
        setSyncText('❌ فشل الحفظ');
        await Swal.fire({ icon: 'error', title: 'خطأ في السحابة', text: err.message, confirmButtonColor: '#0f1c38' });
        return false;
    }
}

// ---------- نافذة إكمال المواد الفعالة للأصناف القديمة ----------
function openIngredientModal() {
    refreshActiveDatalist();
    const missing = products.filter(p => !(p.activeIngredient || '').trim());
    document.getElementById('ingSummary').innerText = missing.length
        ? `${missing.length} صنف بدون مادة فعالة من أصل ${products.length}. اكتب المادة الفعالة فقط (بدون التركيز)، وللمركّب افصل بـ +`
        : 'كل الأصناف لها مادة فعالة ✅';
    document.getElementById('ingFilter').value = '';
    document.getElementById('ingListContainer').innerHTML = missing.map(p => `
        <div class="ing-row" data-name="${escapeHtml((p.name + ' ' + (p.brand || '')).toLowerCase())}">
            <div class="ing-name">
                <span dir="ltr">${escapeHtml(p.name)}</span>
                <small dir="ltr">${escapeHtml(p.brand || '')} | ${escapeHtml(fixMetaOrder(p.meta))}</small>
            </div>
            <input type="text" class="ing-input" data-id="${p.id}" list="activeList" dir="ltr" placeholder="مثال: Tretinoin">
        </div>
    `).join('');
    document.getElementById('ingModal').style.display = 'flex';
}

function closeIngredientModal() {
    document.getElementById('ingModal').style.display = 'none';
}

function filterIngredientRows() {
    const q = document.getElementById('ingFilter').value.toLowerCase().trim();
    document.querySelectorAll('#ingListContainer .ing-row').forEach(row => {
        row.style.display = row.dataset.name.includes(q) ? '' : 'none';
    });
}

async function saveIngredients() {
    if (!writesAllowed()) return;
    const changed = [];
    document.querySelectorAll('#ingListContainer .ing-input').forEach(inp => {
        const v = inp.value.trim();
        if (!v) return;
        const p = products.find(x => x.id === parseInt(inp.dataset.id));
        if (p) { p.activeIngredient = v; changed.push(p); }
    });
    if (!changed.length) { closeIngredientModal(); return; }
    const ok = await saveProductsBatch(changed);
    if (ok) {
        closeIngredientModal();
        renderAll();
        Swal.fire({ icon: 'success', title: `تم حفظ المادة الفعالة لـ ${changed.length} صنف`, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    }
}

// ============================================================================
// 13. سجل البحث الفاشل (ما يبحث عنه الزبائن ولا يجدونه)
// ============================================================================
const MISS_KEY = 'diwanSearchMisses';
const missSeenThisSession = new Set();
let missTimer = null;
let currentMissList = [];

function normalizeQuery(q) {
    return (q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function loadLocalMisses() {
    try { return JSON.parse(localStorage.getItem(MISS_KEY)) || {}; } catch (e) { return {}; }
}

function saveLocalMisses(obj) {
    const keys = Object.keys(obj);
    if (keys.length > 200) {   // نحتفظ بآخر 200 عملية بحث فقط
        keys.sort((a, b) => (obj[a].last || '').localeCompare(obj[b].last || ''))
            .slice(0, keys.length - 200)
            .forEach(k => delete obj[k]);
    }
    try { localStorage.setItem(MISS_KEY, JSON.stringify(obj)); } catch (e) { /* ذاكرة ممتلئة */ }
}

function productSearchText(p) {
    return `${p.name} ${p.brand} ${p.details} ${p.meta} ${catsOf(p).join(' ')} ${p.keywords || ''} ${p.activeIngredient || ''}`.toLowerCase();
}

function scheduleMissCheck(rawQuery) {
    clearTimeout(missTimer);
    const q = normalizeQuery(rawQuery);
    if (q.length < 2 || missSeenThisSession.has(q)) return;
    missTimer = setTimeout(() => {
        const qn = normSearch(q), qt = qn ? qn.split(' ') : [];
        if (products.some(p => searchScore(p, qn, qt) > 0)) return;   // وُجد في أي قسم: ليس بحثاً فاشلاً
        missSeenThisSession.add(q);
        recordFailedSearch(q);
    }, 1800);
}

function recordFailedSearch(q) {
    const misses = loadLocalMisses();
    const entry = misses[q] || { count: 0, last: '' };
    entry.count += 1;
    entry.last = new Date().toISOString();
    misses[q] = entry;
    saveLocalMisses(misses);

    // محاولة تسجيله في السحابة (تنجح فقط إذا سمحت قواعد Firestore بذلك)
    if (isFirebaseReady && db && navigator.onLine) {
        try {
            db.collection('pharmacy_search_misses').doc(encodeURIComponent(q).slice(0, 200)).set({
                query: q,
                count: firebase.firestore.FieldValue.increment(1),
                lastAt: entry.last
            }, { merge: true }).catch(() => {});
        } catch (e) { /* تجاهل */ }
    }
}

async function openMissModal() {
    document.getElementById('missModal').style.display = 'flex';
    const box = document.getElementById('missListContainer');
    box.innerHTML = '<div class="miss-empty">⏳ جاري التحميل...</div>';

    const merged = {};
    Object.entries(loadLocalMisses()).forEach(([q, v]) => { merged[q] = { query: q, count: v.count || 0, last: v.last || '', cloudId: null }; });

    if (isFirebaseReady && currentUser && navigator.onLine) {
        try {
            const snap = await db.collection('pharmacy_search_misses').orderBy('count', 'desc').limit(200).get();
            snap.forEach(doc => {
                const d = doc.data();
                if (!d.query) return;
                const q = normalizeQuery(d.query);
                const prev = merged[q];
                merged[q] = {
                    query: q,
                    count: Math.max(d.count || 0, prev ? prev.count : 0),   // نتجنب العد المزدوج لبحث هذا الجهاز
                    last: (d.lastAt || '') > (prev ? prev.last : '') ? (d.lastAt || '') : (prev ? prev.last : ''),
                    cloudId: doc.id
                };
            });
        } catch (e) { /* القواعد لا تسمح بالقراءة: نعرض السجل المحلي فقط */ }
    }

    currentMissList = Object.values(merged).sort((a, b) => b.count - a.count || (b.last || '').localeCompare(a.last || ''));
    renderMissList();
}

function renderMissList() {
    const box = document.getElementById('missListContainer');
    if (!currentMissList.length) {
        box.innerHTML = '<div class="miss-empty">لا توجد عمليات بحث فاشلة مسجّلة بعد.<br><small>يُسجَّل هنا أي اسم يُبحث عنه ولا يوجد في أي قسم.</small></div>';
        return;
    }
    box.innerHTML = currentMissList.map(m => `
        <div class="miss-row">
            <span class="miss-q" dir="auto">${escapeHtml(m.query)}</span>
            <span class="miss-count">${m.count}×</span>
            <span class="miss-date">${m.last ? new Date(m.last).toLocaleDateString('ar') : ''}</span>
        </div>
    `).join('');
}

function closeMissModal() {
    document.getElementById('missModal').style.display = 'none';
}

async function copyMissList() {
    if (!currentMissList.length) return;
    const text = currentMissList.map(m => `${m.query} (${m.count})`).join('\n');
    try {
        await navigator.clipboard.writeText(text);
        Swal.fire({ icon: 'success', title: 'تم نسخ القائمة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر النسخ', text: 'انسخ القائمة يدوياً.', confirmButtonColor: '#0f1c38' });
    }
}

async function clearMissList() {
    const res = await Swal.fire({
        title: 'مسح سجل البحث الفاشل؟',
        text: 'سيُحذف السجل من هذا الجهاز ومن السحابة (إن كان مسجلاً دخولك).',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'نعم، امسح',
        cancelButtonText: 'إلغاء'
    });
    if (!res.isConfirmed) return;
    localStorage.removeItem(MISS_KEY);
    missSeenThisSession.clear();
    const cloudIds = currentMissList.filter(m => m.cloudId).map(m => m.cloudId);
    if (cloudIds.length && isFirebaseReady && currentUser && navigator.onLine) {
        try {
            for (let i = 0; i < cloudIds.length; i += 400) {
                const batch = db.batch();
                cloudIds.slice(i, i + 400).forEach(id => batch.delete(db.collection('pharmacy_search_misses').doc(id)));
                await batch.commit();
            }
        } catch (e) { console.warn('Clear misses error:', e); }
    }
    currentMissList = [];
    renderMissList();
}

// ============================================================================
// 14. النسخ الاحتياطي (تصدير / استرجاع)
// ============================================================================
function buildBackupObject() {
    return {
        app: 'diwan-pharmacy',
        version: 1,
        exportedAt: new Date().toISOString(),
        departments,
        subCategories,
        tabLabels,
        customTabs,
        lowStockThreshold,
        alertMonths,
        subTypes,
        products
    };
}

function todayStamp() {
    return new Date().toISOString().slice(0, 10);
}

async function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    // على الهواتف: قائمة المشاركة تتيح الحفظ في الملفات أو الإرسال لنفسك
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.share) {
        try {
            const file = new File([blob], filename, { type: mime });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: filename });
                return;
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return;   // أغلق المستخدم القائمة
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportBackupJson() {
    downloadFile(`diwan-backup-${todayStamp()}.json`, JSON.stringify(buildBackupObject(), null, 2), 'application/json');
}

function csvCell(v) {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv() {
    const headers = ['القسم', 'التصنيف', 'الشركة', 'الاسم التجاري', 'المادة الفعالة', 'العبوة', 'السعر', 'الكمية', 'حد التنبيه', 'تواريخ النفاذ', 'الكلمات المفتاحية', 'الوصف'];
    const rows = products.map(p => [
        deptsOf(p).join(' + '), catsOf(p).join(' + '), p.brand || '', p.name || '', p.activeIngredient || '',
        fixMetaOrder(p.meta), p.price || 0, p.qty || 0,
        isNaN(parseInt(p.minQty)) ? '' : p.minQty,
        getProductExpiryDates(p).join(' ; '),
        p.keywords || '', p.details || ''
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');   // BOM ليقرأ Excel العربية صحيحة
    downloadFile(`diwan-products-${todayStamp()}.csv`, csv, 'text/csv;charset=utf-8');
}

function validateBackup(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.products)) return 'الملف ليس نسخة احتياطية لهذا التطبيق.';
    if (data.products.length === 0) return 'النسخة الاحتياطية لا تحتوي أي أصناف.';
    const bad = data.products.find(p => !p || typeof p !== 'object' || p.id === undefined || p.id === null || !p.name);
    if (bad) return 'بعض الأصناف في الملف ناقصة (بدون رقم أو اسم).';
    return null;
}

async function restoreBackup(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
        if (!currentUser) {
            await Swal.fire({ icon: 'error', title: 'سجّل دخول الصيدلي أولاً', text: 'الاسترجاع يكتب في السحابة، لذلك يحتاج تسجيل الدخول.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
            return;
        }
        if (!requireOnline()) return;

        let data;
        try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
        const problem = validateBackup(data);
        if (problem) {
            await Swal.fire({ icon: 'error', title: 'ملف غير صالح', text: problem, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
            return;
        }

        await applyBackupData(data);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'تعذر الاسترجاع', text: err.message || String(err), confirmButtonColor: '#0f1c38' });
    } finally {
        input.value = '';
    }
}

async function applyBackupData(data) {
    try {
        if (!currentUser) {
            await Swal.fire({ icon: 'error', title: 'سجّل دخول الصيدلي أولاً', text: 'الاسترجاع يكتب في السحابة، لذلك يحتاج تسجيل الدخول.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
            return;
        }
        if (!requireOnline()) return;
        const existingIds = new Set(products.map(p => p.id));
        const replaced = data.products.filter(p => existingIds.has(p.id)).length;
        const added = data.products.length - replaced;
        const when = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('ar') : 'غير معروف';

        const ok = await Swal.fire({
            title: 'استرجاع النسخة الاحتياطية؟',
            html: `<div style="text-align:right; line-height:1.9; font-size:0.92rem;">
                تاريخ النسخة: <b>${escapeHtml(when)}</b><br>
                أصناف جديدة ستُضاف: <b>${added}</b><br>
                أصناف موجودة ستُستبدل بنسختها القديمة: <b>${replaced}</b><br>
                <span style="color:#64748b;">لن يُحذف أي صنف موجود حالياً غير موجود في النسخة. والصور لا تتأثر (هي محفوظة في GitHub).</span>
            </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0f1c38',
            confirmButtonText: 'نعم، استرجع',
            cancelButtonText: 'إلغاء'
        });
        if (!ok.isConfirmed) return;

        const byId = new Map(products.map(p => [p.id, p]));
        data.products.forEach(p => byId.set(p.id, p));
        products = [...byId.values()].sort((a, b) => b.id - a.id);

        if (Array.isArray(data.departments)) departments = [...new Set([...departments, ...data.departments])];
        if (Array.isArray(data.subCategories)) subCategories = [...new Set([...subCategories, ...data.subCategories])];
        if (data.tabLabels && typeof data.tabLabels === 'object') tabLabels = { ...defaultTabLabels, ...data.tabLabels };
        if (Array.isArray(data.customTabs)) customTabs = data.customTabs;
        if (typeof data.lowStockThreshold === 'number') lowStockThreshold = data.lowStockThreshold;
                if (Array.isArray(data.alertMonths) && data.alertMonths.length === 3) alertMonths = data.alertMonths;
        if (Array.isArray(data.subTypes) && data.subTypes.length) subTypes = data.subTypes;

        await pushToCloud(false);
        renderAll();
        Swal.fire({ icon: 'success', title: 'تم الاسترجاع', text: `${data.products.length} صنف`, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'تعذر الاسترجاع', text: err.message || String(err), confirmButtonColor: '#0f1c38' });
    }
}

// ============================================================================
// 15. مسح العبوة بالذكاء الصناعي: Gemini API أو Firebase AI Logic (مع رجوع احتياطي للقارئ العادي)
// ============================================================================
// ---- إعدادات Firebase AI Logic (تُضبط مرة واحدة هنا، وليست أسراراً) ----
const FIREBASE_MODULAR_VERSION = '13.0.0';   // نسخة مكتبة Firebase التي تحمّل AI Logic
const APP_CHECK_SITE_KEY = '';               // مفتاح reCAPTCHA للويب (عام وليس سرياً) — مطلوب لـ Firebase AI Logic
const APP_CHECK_PROVIDER = 'enterprise';     // 'enterprise' (reCAPTCHA Enterprise) أو 'v3' (reCAPTCHA v3)

const AI_DEFAULT_MODEL = 'gemini-3.8-flash';
const AI_TIMEOUT_MS = 90000;
const AI_ENGINES = { local: 'قراءة عادية (بدون ذكاء)', gemini: 'Gemini API', firebase: 'Firebase AI Logic' };
// إعدادات المحرك تُحفظ على هذا الجهاز فقط (لا تُرفع للسحابة ولا تدخل النسخة الاحتياطية)
const AI_LS = { engine: 'diwanAiEngine', key: 'diwanGeminiKey', gModel: 'diwanGeminiModel', fModel: 'diwanFbAiModel' };

function aiGet(k, d) {
    const def = (d === undefined) ? '' : d;
    try {
        const v = localStorage.getItem(AI_LS[k]);
        return (v === null || v === undefined) ? def : v;
    } catch (err) { return def; }
}
function aiSet(k, v) {
    try { localStorage.setItem(AI_LS[k], v); return true; } catch (err) { return false; }
}
function aiVal(id) { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function aiSetVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function getAiEngine() { const eng = aiGet('engine', 'local'); return AI_ENGINES[eng] ? eng : 'local'; }
function cleanAiModel(v) { return String(v || '').trim().replace(/^models\//, '').replace(/[^A-Za-z0-9._\-]/g, ''); }
function cleanAiKey(v) { return String(v || '').replace(/\s+/g, ''); }

// ---------------------------------------------------------------------------
// أخطاء مفهومة بالعربية
// ---------------------------------------------------------------------------
async function aiHttpError(res) {
    let msg = '';
    try { const j = await res.json(); msg = (j && j.error && j.error.message) || ''; } catch (err) { /* لا يوجد جسم */ }
    const e = new Error(msg || ('HTTP ' + res.status));
    e.status = res.status;
    return e;
}

function friendlyAiError(err) {
    const raw = String((err && err.message) || err || '');
    const low = raw.toLowerCase();
    const st = err && err.status;
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) return 'لم يصل رد من جوجل خلال 90 ثانية (الإنترنت يعمل لكن النموذج بطيء أو محجوب). جرّب نموذجاً أسرع مثل gemini-2.5-flash-lite من «جلب القائمة».';
    if (/dynamically imported module|importing a module script failed|error loading dynamically/.test(low)) return 'تعذر تحميل مكتبة Firebase AI Logic. تحقق من الإنترنت ومن رقم النسخة FIREBASE_MODULAR_VERSION في data.js.';
    if (st === 429 || /quota|rate.?limit|resource.?exhausted|\b429\b/.test(low)) return 'انتهت الحصة المجانية الحالية أو الطلبات كثيرة. انتظر قليلاً أو جرّب نموذجاً آخر (مثل Flash-Lite).';
    if (isBusyAiError(err)) return 'نماذج جوجل مزدحمة الآن (جرّبنا عدة محاولات ونماذج بديلة). أعد المحاولة بعد دقائق.';
    if (/api key not valid|api_key_invalid|api key expired/.test(low) || (st === 400 && /api key/.test(low))) return 'مفتاح Gemini API غير صحيح أو منتهي.';
    if (/app.?check/.test(low)) return 'رفض Firebase الطلب بسبب App Check. أضف APP_CHECK_SITE_KEY في data.js وتأكد من تسجيل التطبيق في App Check.';
    if (st === 404 || /not found|not_found|is not supported for/.test(low)) return 'اسم النموذج غير صحيح أو غير متاح لحسابك. اختره من قائمة «جلب القائمة».';
    if (st === 403 || /permission|forbidden|\b403\b/.test(low)) return 'الوصول مرفوض (403). في Firebase تحقق من تفعيل AI Logic وApp Check، وفي Gemini تحقق من قيود المفتاح.';
    if (st === 413 || /too large|\b413\b/.test(low)) return 'الصورة كبيرة جداً على الطلب.';
    if (!navigator.onLine || /failed to fetch|networkerror|load failed|network error/.test(low)) return 'تعذر الاتصال بالإنترنت أو بخدمة جوجل.';
    return raw.slice(0, 180) || 'خطأ غير معروف';
}

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { const e = new Error('timeout'); e.name = 'TimeoutError'; reject(e); }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// تجهيز الصورة: ملوّنة ومصغّرة (عكس الصورة المخصصة للقارئ العادي)
// ---------------------------------------------------------------------------
function prepareImageForAi(file, maxSide, quality) {
    const MAX = maxSide || 1600;
    const Q = quality || 0.85;
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve({ mimeType: 'image/jpeg', data: c.toDataURL('image/jpeg', Q).split(',')[1] });
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذر فتح الصورة.')); };
        img.src = url;
    });
}

function makeAiTestImage() {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 120;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 320, 120);
    x.fillStyle = '#000000'; x.font = 'bold 64px Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('DIWAN', 160, 62);
    return { mimeType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.9).split(',')[1] };
}

// ---------------------------------------------------------------------------
// الطلب (Prompt)
// ---------------------------------------------------------------------------
function buildAiPrompt(typedName) {
    const cats = subCategories.join(' | ');
    const brands = [...new Set(products.map(p => (p.brand || '').trim()).filter(b => b && b !== 'GENERIC'))].slice(0, 120).join(', ');
    const intro = typedName
        ? `You are assisting a pharmacist in Iraq who is adding one product to a pharmacy / dermatology catalogue.
There is NO photo. The pharmacist typed only this product name (it may include a strength or form): "${String(typedName).replace(/["\\]/g, ' ').slice(0, 120)}".
Identify the product from your general pharmaceutical knowledge and fill the data. Because nothing is read from a package:
- strength: copy it ONLY if the pharmacist typed it; otherwise return "" (many products exist in several strengths).
- pack_size and expiry: always "".
- brand_company, dosage_form and active ingredients: fill them only if you are confident this is a real, known product; otherwise "".
- If you do not recognise the name, return empty strings, an empty array and confidence "low". Never invent a product.
`
        : `You are assisting a pharmacist in Iraq who is adding one product to a pharmacy / dermatology catalogue.
Look at the photo of the product package (box, tube, bottle, blister or vial) and extract the data.
`;
    return `${intro}
STRICT RULES
- "printed" fields must contain ONLY what is actually readable on the package. If you cannot read it clearly, return an empty string. Never guess a strength, a number or a date.
- Strength digits are safety-critical (5 mg vs 50 mg): copy them exactly as printed, with the unit.
- "suggested" fields come from your general pharmaceutical knowledge of this product. If you are not confident, return an empty string (or an empty array).
- Never invent prices, quantities or batch numbers.
- Expiry: return YYYY-MM only if an expiry date (EXP / Exp / use before) is clearly printed, otherwise "". Ignore manufacturing dates (MFG).

Return ONE JSON object with exactly these keys:
{
  "printed": { "brand_company": "", "trade_name": "", "strength": "", "dosage_form": "", "pack_size": "", "expiry": "", "active_ingredient": "" },
  "suggested": { "active_ingredient": "", "details_ar": "", "keywords": [], "category": "", "tab": "" },
  "confidence": "high | medium | low",
  "notes": ""
}

Field definitions:
- brand_company: the manufacturer / company name printed on the pack (e.g. ISISPHARMA). If it matches one of these existing companies, use that exact spelling: ${brands || '(none yet)'}.
- trade_name: the product brand name only, without strength (e.g. "Differin").
- strength: e.g. "0.1%", "500 mg", "500 mg/65 mg".
- dosage_form: one English word or phrase: Tablets, Capsules, Cream, Gel, Ointment, Syrup, Drops, Solution, Lotion, Shampoo, Serum, Spray, Foam, Wash, Injection ...
- pack_size: e.g. "30 g", "60 ml", "24 Tablets".
- printed.active_ingredient: active ingredient(s) in English ONLY if printed on the pack (use " + " between several).
- suggested.active_ingredient: active ingredient(s) in English if you know them (use " + " between several).
- suggested.details_ar: one or two sentences in Arabic: what the product is and its main use. No dosing advice.
- suggested.keywords: up to 8 short search words in Arabic and English (e.g. "حب الشباب", "acne").
- suggested.category: exactly one value from this list, or "": ${cats}
- suggested.tab: "rx" for prescription / medicinal products, "cosmetic" for cosmetics and skin-care, or "".
- confidence: how sure you are about the printed fields.
- notes: a short note about anything unreadable or uncertain.`;
}

// المخطط الإلزامي لـ Firebase AI Logic (Schema من مكتبة Firebase)
function buildAiSchema(S) {
    const str = () => S.string();
    return S.object({
        properties: {
            printed: S.object({
                properties: {
                    brand_company: str(), trade_name: str(), strength: str(), dosage_form: str(),
                    pack_size: str(), expiry: str(), active_ingredient: str()
                }
            }),
            suggested: S.object({
                properties: {
                    active_ingredient: str(), details_ar: str(), keywords: S.array({ items: str() }),
                    category: str(), tab: str()
                }
            }),
            confidence: str(),
            notes: str()
        },
        optionalProperties: ['notes']
    });
}

// ---------------------------------------------------------------------------
// المحرك 1: Gemini API مباشرة (مفتاح من Google AI Studio)
// ---------------------------------------------------------------------------
function extractGeminiText(data) {
    if (data && data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error('حُجب الطلب من النموذج (' + data.promptFeedback.blockReason + ').');
    }
    const cand = data && data.candidates && data.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    if (!parts || !parts.length) {
        const why = (cand && cand.finishReason) ? ' (' + cand.finishReason + ')' : '';
        throw new Error('لم يُرجع النموذج نتيجة' + why + '. جرّب صورة أوضح.');
    }
    return parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
}

// عند ازدحام النموذج (503) نعيد المحاولة ثم ننتقل لنماذج بديلة أخف
const AI_FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
function isBusyAiError(e) {
    return !!e && (e.status === 503 || /high demand|overloaded|unavailable/i.test(String(e.message || '')));
}
const aiSleep = ms => new Promise(r => setTimeout(r, ms));

async function callGeminiRest(opts) {
    const first = cleanAiModel(aiGet('gModel', AI_DEFAULT_MODEL)) || AI_DEFAULT_MODEL;
    const models = [first].concat(AI_FALLBACK_MODELS.filter(m => m !== first));
    let lastErr = null;
    for (let i = 0; i < models.length; i++) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const out = await callGeminiRestOnce(opts, models[i]);
                if (i > 0) setScanStatusText('ℹ️ تم استعمال النموذج البديل ' + models[i]);
                return out;
            } catch (e) {
                lastErr = e;
                if (e && e.code === 'NO_KEY') throw e;
                if (isBusyAiError(e)) { if (attempt === 0) await aiSleep(2500); continue; }
                if (i > 0 && e && e.status === 404) break;   // نموذج بديل غير متاح لهذا الحساب: ننتقل للتالي
                throw e;
            }
        }
    }
    throw lastErr;
}

async function callGeminiRestOnce(opts, modelName) {
    const key = cleanAiKey(aiGet('key'));
    if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
    const model = modelName;
    const parts = [{ text: opts.prompt }];
    if (opts.img) parts.push({ inlineData: { mimeType: opts.img.mimeType, data: opts.img.data } });
    const body = { contents: [{ role: 'user', parts }] };
    if (opts.json) body.generationConfig = { responseMimeType: 'application/json', temperature: 0.1 };

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    const send = async (payload) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
        try {
            return await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },   // المفتاح في الترويسة وليس في الرابط
                body: JSON.stringify(payload),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timer);
        }
    };
    // نماذج Gemini الحديثة "تفكر" قبل الرد فتبطؤ؛ نطلب أقل تفكير ممكن، وإن رفضه النموذج نعيد بدونه
    const fast = JSON.parse(JSON.stringify(body));
    fast.generationConfig = Object.assign({}, fast.generationConfig, { thinkingConfig: { thinkingBudget: 0 } });
    let res = await send(fast);
    if (res.status === 400) {
        const err = await aiHttpError(res);
        if (/thinking/i.test(err.message)) res = await send(body);
        else throw err;
    }
    if (!res.ok) throw await aiHttpError(res);
    return extractGeminiText(await res.json());
}

// ---------------------------------------------------------------------------
// المحرك 2: Firebase AI Logic (بدون مفتاح داخل التطبيق)
// ---------------------------------------------------------------------------
let fbSdkPromise = null;
function aiImport(url) { return import(url); }   // غلاف بسيط ليسهل اختبار التحميل

function loadFirebaseAiSdk() {
    if (!fbSdkPromise) {
        fbSdkPromise = (async () => {
            const base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_MODULAR_VERSION + '/';
            const mods = await Promise.all([aiImport(base + 'firebase-app.js'), aiImport(base + 'firebase-ai.js')]);
            const appMod = mods[0];
            const aiMod = mods[1];
            const NAME = 'diwan-ai';   // نسخة مستقلة عن تطبيق Firebase القديم الذي يخدم قاعدة البيانات
            const app = appMod.getApps().find(a => a.name === NAME) || appMod.initializeApp(firebaseConfig, NAME);
            if (APP_CHECK_SITE_KEY) {
                if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                const ac = await aiImport(base + 'firebase-app-check.js');
                const provider = APP_CHECK_PROVIDER === 'v3'
                    ? new ac.ReCaptchaV3Provider(APP_CHECK_SITE_KEY)
                    : new ac.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY);
                ac.initializeAppCheck(app, { provider: provider, isTokenAutoRefreshEnabled: true });
            }
            const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
            return { aiMod, ai };
        })().catch(err => { fbSdkPromise = null; throw err; });
    }
    return fbSdkPromise;
}

async function callFirebaseAi(opts) {
    const modelName = cleanAiModel(aiGet('fModel', AI_DEFAULT_MODEL)) || AI_DEFAULT_MODEL;
    const sdk = await loadFirebaseAiSdk();
    const cfg = { model: modelName };
    if (opts.json) {
        cfg.generationConfig = { responseMimeType: 'application/json', responseSchema: buildAiSchema(sdk.aiMod.Schema), temperature: 0.1 };
    }
    const model = sdk.aiMod.getGenerativeModel(sdk.ai, cfg);
    const parts = [opts.prompt];
    // الشكل مطابق لمثال توثيق Firebase الحالي لإرسال الصور
    if (opts.img) parts.push({ type: 'inlineData', inlineData: { data: opts.img.data, mimeType: opts.img.mimeType } });
    const result = await withTimeout(model.generateContent(parts), AI_TIMEOUT_MS);
    return result.response.text();
}

function callAiEngine(engine, opts) {
    return engine === 'firebase' ? callFirebaseAi(opts) : callGeminiRest(opts);
}

// ---------------------------------------------------------------------------
// تحليل النتيجة وتنظيفها
// ---------------------------------------------------------------------------
function parseAiJson(text) {
    let t = String(text || '').trim();
    t = t.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(t); } catch (err1) { /* نجرّب استخراج الكائن */ }
    const s = t.indexOf('{');
    const f = t.lastIndexOf('}');
    if (s >= 0 && f > s) {
        try { return JSON.parse(t.slice(s, f + 1)); } catch (err2) { /* تابع */ }
    }
    throw new Error('لم يُرجع النموذج نتيجة مفهومة. جرّب مرة أخرى.');
}

function aiClean(v, max) {
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    return String(v).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
}

function normalizeAiExpiry(v) {
    const s = aiClean(v, 30);
    if (!s) return '';
    let y, mo;
    let m = s.match(/^(\d{4})\s*[-\/.]\s*(\d{1,2})/);
    if (m) { y = parseInt(m[1], 10); mo = parseInt(m[2], 10); }
    else {
        m = s.match(/(\d{1,2})\s*[\/\-. ]\s*(\d{4}|\d{2})\b/);
        if (m) { mo = parseInt(m[1], 10); y = parseInt(m[2], 10); if (y < 100) y += 2000; }
    }
    if (!y || !mo || mo < 1 || mo > 12 || y < 2020 || y > 2050) return '';
    return y + '-' + String(mo).padStart(2, '0');
}

function canonicalBrand(b) {
    const name = aiClean(b, 60);
    if (!name) return '';
    const key = name.toLowerCase();
    const hit = products.map(p => (p.brand || '').trim()).find(x => x && x.toLowerCase() === key);
    return hit || name;
}

function canonicalCategory(c) {
    const name = aiClean(c, 80);
    if (!name) return '';
    const key = name.toLowerCase();
    return subCategories.find(x => x === name) || subCategories.find(x => String(x).trim().toLowerCase() === key) || '';
}

function normalizeAiResult(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    const p = (r.printed && typeof r.printed === 'object') ? r.printed : r;      // يتسامح إن أرجع النموذج بنية مسطحة
    const s = (r.suggested && typeof r.suggested === 'object') ? r.suggested : r;

    const tradeName = aiClean(p.trade_name, 80);
    const strength = aiClean(p.strength, 60);
    let form = aiClean(p.dosage_form, 40);
    if (form) form = form.charAt(0).toUpperCase() + form.slice(1);
    const pack = aiClean(p.pack_size, 40);

    // العبوة / الشكل بنفس صيغة بقية الأصناف (مثل: "30 g | Gel" أو "24 Tablets")
    let meta = '';
    if (pack && form && pack.toLowerCase().includes(form.toLowerCase())) meta = pack;
    else meta = [pack, form].filter(Boolean).join(' | ');
    meta = fixMetaOrder(meta);

    const activePrinted = aiClean(p.active_ingredient, 120);
    const activeSuggested = aiClean(s.active_ingredient, 120);

    const keywords = [];
    (Array.isArray(s.keywords) ? s.keywords : []).forEach(k => {
        const w = aiClean(k, 30);
        if (w && !keywords.includes(w) && keywords.length < 8) keywords.push(w);
    });

    const tab = aiClean(s.tab, 20).toLowerCase();
    const conf = aiClean(r.confidence, 12).toLowerCase();

    return {
        brand: canonicalBrand(p.brand_company),
        tradeName,
        strength,
        form,
        pack,
        meta,
        expiry: normalizeAiExpiry(p.expiry),
        active: activePrinted || activeSuggested,
        activeFromPack: !!activePrinted,
        detailsAr: aiClean(s.details_ar, 400),
        keywords,
        category: canonicalCategory(s.category),
        tab: (tab === 'rx' || tab === 'cosmetic') ? tab : '',
        confidence: ['high', 'medium', 'low'].includes(conf) ? conf : '',
        notes: aiClean(r.notes, 200)
    };
}

// ---------------------------------------------------------------------------
// صفوف النتيجة + التعبئة (الحقول الفارغة فقط افتراضياً)
// ---------------------------------------------------------------------------
function buildAiRows(res) {
    const fullName = [res.tradeName, res.strength].filter(Boolean).join(' ');
    const tabLabel = res.tab === 'rx' ? tabLabels.rx : (res.tab === 'cosmetic' ? tabLabels.cosmetic : '');
    return [
        { key: 'name', label: 'الاسم التجاري والتركيز', value: fullName, raw: fullName, field: 'fName', src: 'printed', ltr: true },
        { key: 'brand', label: 'الشركة', value: res.brand, raw: res.brand, field: 'fBrand', src: 'printed', ltr: true },
        { key: 'meta', label: 'العبوة / الشكل الدوائي', value: res.meta, raw: res.meta, field: 'fMeta', src: 'printed', ltr: true },
        { key: 'expiry', label: 'تاريخ النفاذ', value: res.expiry, raw: res.expiry, field: 'expiry', src: 'printed', ltr: true },
        { key: 'active', label: 'المادة الفعالة', value: res.active, raw: res.active, field: 'fActive', src: res.activeFromPack ? 'printed' : 'suggested', ltr: true },
        { key: 'details', label: 'الوصف والاستخدام', value: res.detailsAr, raw: res.detailsAr, field: 'fDetails', src: 'suggested', ltr: false },
        { key: 'keywords', label: 'كلمات البحث', value: res.keywords.join('، '), raw: res.keywords.join('، '), field: 'fKeywords', src: 'suggested', ltr: false },
        { key: 'category', label: 'التصنيف الفرعي', value: res.category, raw: res.category, field: 'fCategory', src: 'suggested', newOnly: true, ltr: false },
        { key: 'tab', label: 'التبويب', value: tabLabel, raw: res.tab, field: 'fType', src: 'suggested', newOnly: true, ltr: false }
    ];
}

function isAiRowTargetEmpty(row, isEdit) {
    if (!row.value) return false;
    if (row.key === 'expiry') return !getExpiryDatesFromForm().includes(row.value);   // إضافة وليست استبدالاً
    if (row.newOnly) return !isEdit;                                                    // التصنيف والتبويب: للصنف الجديد فقط
    const el = document.getElementById(row.field);
    return !el || !String(el.value || '').trim();
}

function applyAiRows(rows, selectedKeys) {
    selectedKeys.forEach(k => {
        const r = rows.find(x => x.key === k);
        if (!r || !r.value) return;
        if (r.key === 'expiry') {
            setExpiryDatesInForm([...getExpiryDatesFromForm(), r.value]);
            return;
        }
        aiSetVal(r.field, r.raw);
    });
    refreshExtraChips();
}

function normAiName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ''); }

function findSimilarProducts(res) {
    const t = normAiName(res.tradeName);
    const st = normAiName(res.strength);
    if (t.length < 3) return [];
    const editId = parseInt(aiVal('editId'), 10);
    return products.filter(p => {
        if (!isNaN(editId) && p.id === editId) return false;
        const hay = normAiName((p.name || '') + ' ' + (p.meta || ''));
        return hay.includes(t) && (!st || hay.includes(st));
    });
}

function setScanStatusText(t) {
    const el = document.getElementById('scanStatus');
    if (el) el.innerText = t;
}

async function showAiScanResult(res, mode) {
    const byName = mode === 'name';
    const isEdit = !!aiVal('editId');
    const rows = buildAiRows(res);

    if (!rows.some(r => r.value)) {
        await Swal.fire({
            icon: 'warning',
            title: byName ? 'لم يتعرف الذكاء الصناعي على هذا الاسم' : 'لم يتعرف الذكاء الصناعي على العبوة',
            html: '<div style="font-size:0.9rem; line-height:1.7;">' + (byName ? 'جرّب كتابة الاسم التجاري بالإنجليزية كما هو مطبوع على العبوة.' : 'جرّب صورة أقرب بإضاءة جيدة تُظهر الاسم بوضوح.') + '</div>',
            confirmButtonColor: '#0f1c38',
            confirmButtonText: 'حسناً'
        });
        return;
    }

    rows.forEach(r => { r.empty = isAiRowTargetEmpty(r, isEdit); r.checked = !!r.value && r.empty; });

    const dups = findSimilarProducts(res);
    const conf = { high: ['عالية', '#15803d', '#dcfce7'], medium: ['متوسطة', '#b45309', '#fef3c7'], low: ['منخفضة', '#b91c1c', '#fee2e2'] }[res.confidence];

    const rowHtml = r => r.value ? `
        <label style="display:flex; align-items:flex-start; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); cursor:pointer;">
            <input type="checkbox" id="aiRow_${r.key}" ${r.checked ? 'checked' : ''} style="margin-top:4px; width:18px; height:18px; flex-shrink:0;">
            <span style="flex:1; min-width:0;">
                <b style="display:block; font-size:0.8rem; color:var(--text-sub);">${r.label}${r.empty ? '' : ' <small style="color:#b45309; font-weight:700;">(الحقل معبأ — علّم لاستبداله)</small>'}</b>
                <span dir="${r.ltr ? 'ltr' : 'rtl'}" style="display:block; color:var(--text-main); word-break:break-word; text-align:${r.ltr ? 'left' : 'right'};">${escapeHtml(r.value)}</span>
            </span>
        </label>` : `<div style="padding:7px 0; border-bottom:1px solid var(--border); color:var(--text-sub); font-size:0.82rem;">${r.label}: لم يُقرأ</div>`;

    const section = (title, color, src) => `
        <div style="margin-top:12px;">
            <div style="font-weight:800; font-size:0.82rem; color:${color}; margin-bottom:2px;">${title}</div>
            ${rows.filter(r => r.src === src).map(rowHtml).join('')}
        </div>`;

    const html = `
        <div style="text-align:right; font-size:0.9rem;">
            ${conf ? `<div style="display:inline-block; padding:2px 10px; border-radius:8px; background:${conf[2]}; color:${conf[1]}; font-weight:800; font-size:0.78rem;">${byName ? 'ثقة النموذج بالتعرف' : 'دقة القراءة'}: ${conf[0]}</div>` : ''}
            ${dups.length ? `<div style="margin-top:10px; padding:8px 10px; border-radius:10px; background:#fef3c7; color:#92400e; font-size:0.82rem; line-height:1.7;">⚠️ قد يكون هذا الصنف موجوداً عندك: <b dir="ltr">${dups.slice(0, 3).map(d => escapeHtml(d.name)).join(' ، ')}</b></div>` : ''}
            ${byName ? '<div style="margin-top:10px; padding:8px 10px; border-radius:10px; background:#fee2e2; color:#991b1b; font-size:0.82rem; line-height:1.7;">⚠️ هذه المعلومات من معرفة النموذج وليست من العبوة. تحقق من الشركة والتركيز والشكل من المنتج نفسه قبل الحفظ.</div>' : ''}
            ${section(byName ? '🏷️ التعرف على الاسم' : '📖 مقروء من العبوة', '#0f1c38', 'printed')}
            ${section('💡 مقترح من الذكاء الصناعي — راجعه جيداً', '#b45309', 'suggested')}
            ${res.notes ? `<p style="margin-top:10px; color:var(--text-sub); font-size:0.78rem;">ملاحظة النموذج: ${escapeHtml(res.notes)}</p>` : ''}
            <p style="margin-top:12px; color:#b91c1c; font-weight:700; font-size:0.82rem;">راجع التركيز بدقة قبل الحفظ (مثل 5 mg أو 50 mg). لن يُحفظ شيء قبل أن تضغط «حفظ».</p>
        </div>`;

    const choice = await Swal.fire({
        title: byName ? 'نتيجة البحث بالاسم' : 'نتيجة المسح بالذكاء الصناعي',
        html,
        showCancelButton: true,
        confirmButtonText: 'تعبئة المحدد',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#0f1c38',
        preConfirm: () => rows.filter(r => {
            const cb = document.getElementById('aiRow_' + r.key);
            return cb && cb.checked;
        }).map(r => r.key)
    });

    if (choice.isConfirmed) {
        const keys = Array.isArray(choice.value) ? choice.value : [];
        applyAiRows(rows, keys);
        setScanStatusText(keys.length ? '✅ تمت التعبئة — راجع الحقول قبل الحفظ' : '');
    }
}

// ---------------------------------------------------------------------------
// زر المسح: يوزّع حسب المحرك المختار
// ---------------------------------------------------------------------------
async function scanProductImage(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const engine = getAiEngine();

    try {
        if (engine === 'local') { await scanWithOcr(event); return; }
        if (!navigator.onLine) {
            setScanStatusText('📴 بدون إنترنت — قراءة عادية');
            await scanWithOcr(event);
            return;
        }

        let res;
        try {
            setScanStatusText('⏳ جاري تجهيز الصورة...');
            const img = await prepareImageForAi(file);
            setScanStatusText('🤖 ' + AI_ENGINES[engine] + ' يقرأ العبوة...');
            const text = await callAiEngine(engine, { prompt: buildAiPrompt(), img, json: true });
            res = normalizeAiResult(parseAiJson(text));
        } catch (err) {
            setScanStatusText('');
            await handleAiScanError(err, file);
            return;
        }
        setScanStatusText('');
        await showAiScanResult(res);
    } finally {
        input.value = '';   // للسماح باختيار نفس الصورة مرة أخرى
    }
}

async function handleAiScanError(err, file) {
    if (err && err.code === 'NO_KEY') {
        const r = await Swal.fire({
            icon: 'info',
            title: 'مفتاح Gemini API غير مُدخل',
            html: '<div style="font-size:0.9rem; line-height:1.8;">أدخل المفتاح من ⚙️ الإعدادات ← قسم «الذكاء الصناعي»، أو اقرأ العبوة الآن بالقراءة العادية.</div>',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '⚙️ فتح الإعدادات',
            denyButtonText: 'قراءة عادية الآن',
            cancelButtonText: 'إغلاق',
            confirmButtonColor: '#0f1c38'
        });
        if (r.isConfirmed) openAiSettingsOverForm();
        else if (r.isDenied) await scanWithOcr({ target: { files: [file], value: '' } });
        return;
    }
    const raw = aiClean((err && err.message) || err, 300);
    const r = await Swal.fire({
        icon: 'error',
        title: 'تعذر القراءة بالذكاء الصناعي',
        html: `<div style="font-size:0.9rem; line-height:1.8;">${escapeHtml(friendlyAiError(err))}</div>
               <details style="margin-top:8px; font-size:0.75rem; color:var(--text-sub); text-align:left;" dir="ltr"><summary>technical details</summary><pre style="white-space:pre-wrap;">${escapeHtml(raw)}</pre></details>`,
        showCancelButton: true,
        confirmButtonText: 'جرّب القراءة العادية',
        cancelButtonText: 'إغلاق',
        confirmButtonColor: '#0f1c38'
    });
    if (r.isConfirmed) await scanWithOcr({ target: { files: [file], value: '' } });
}

// ---------------------------------------------------------------------------
// الإعدادات (⚙️ → 6. الذكاء الصناعي) — تُحفظ على هذا الجهاز فقط
// ---------------------------------------------------------------------------
function setAiEngine(v) {
    const eng = AI_ENGINES[v] ? v : 'local';
    aiSet('engine', eng);
    aiSetVal('scanEngineSelect', eng);
    aiSetVal('aiEngineSelect', eng);
    updateAiSettingsVisibility();
    refreshScanEngineLabel();
}

function updateAiSettingsVisibility() {
    const eng = getAiEngine();
    const g = document.getElementById('aiGeminiBox');
    const f = document.getElementById('aiFirebaseBox');
    if (g) g.style.display = eng === 'gemini' ? '' : 'none';
    if (f) f.style.display = eng === 'firebase' ? '' : 'none';
}

function refreshScanEngineLabel() {
    const eng = getAiEngine();
    aiSetVal('scanEngineSelect', eng);
    const hint = document.getElementById('scanHint');
    if (hint) {
        hint.innerText = eng === 'local'
            ? 'قراءة عادية على جهازك بدون ذكاء. راجع القيم قبل الحفظ.'
            : 'الصورة تُرسل إلى جوجل ويُملأ الفارغ فقط. راجع قبل الحفظ.';
    }
}

function renderAppCheckNote() {
    const el = document.getElementById('aiAppCheckNote');
    if (!el) return;
    if (APP_CHECK_SITE_KEY) {
        el.innerText = '✅ App Check مضبوط (' + (APP_CHECK_PROVIDER === 'v3' ? 'reCAPTCHA v3' : 'reCAPTCHA Enterprise') + ').';
        el.style.color = '#15803d';
    } else {
        el.innerText = '⚠️ APP_CHECK_SITE_KEY فارغ في data.js. تفعيل App Check مطلوب لـ Firebase AI Logic، وبدونه قد يرفض Firebase الطلب (403).';
        el.style.color = '#b45309';
    }
}

function loadAiSettingsToForm() {
    aiSetVal('aiEngineSelect', getAiEngine());
    aiSetVal('aiGeminiKey', aiGet('key'));
    aiSetVal('aiGeminiModel', aiGet('gModel', AI_DEFAULT_MODEL));
    aiSetVal('aiFbModel', aiGet('fModel', AI_DEFAULT_MODEL));
    const keyEl = document.getElementById('aiGeminiKey');
    if (keyEl) keyEl.type = 'password';
    setAiTestMsg('');
    updateAiSettingsVisibility();
    renderAppCheckNote();
}

function setAiTestMsg(msg, isErr) {
    const el = document.getElementById('aiTestResult');
    if (!el) return;
    el.innerText = msg || '';
    el.style.color = isErr ? '#b91c1c' : '#334155';
}

function saveAiSettings(silent) {
    const key = cleanAiKey(aiVal('aiGeminiKey'));
    const gModel = cleanAiModel(aiVal('aiGeminiModel')) || AI_DEFAULT_MODEL;
    const fModel = cleanAiModel(aiVal('aiFbModel')) || AI_DEFAULT_MODEL;
    const ok = aiSet('key', key) && aiSet('gModel', gModel) && aiSet('fModel', fModel);
    aiSetVal('aiGeminiKey', key);
    aiSetVal('aiGeminiModel', gModel);
    aiSetVal('aiFbModel', fModel);
    if (!ok) {
        Swal.fire({ icon: 'error', title: 'تعذر الحفظ على هذا الجهاز', text: 'المتصفح يمنع التخزين (ربما وضع التصفح الخاص).', confirmButtonColor: '#0f1c38' });
        return false;
    }
    if (!silent) Swal.fire({ icon: 'success', title: 'تم حفظ إعدادات الذكاء الصناعي على هذا الجهاز', toast: true, position: 'bottom', showConfirmButton: false, timer: 2000 });
    return true;
}

function toggleAiKeyVisible() {
    const el = document.getElementById('aiGeminiKey');
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

async function loadGeminiModels() {
    const key = cleanAiKey(aiVal('aiGeminiKey'));
    if (!key) { setAiTestMsg('أدخل مفتاح Gemini API أولاً.', true); return; }
    setAiTestMsg('⏳ جاري جلب النماذج...');
    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
        if (!res.ok) throw await aiHttpError(res);
        const data = await res.json();
        const names = (data.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => String(m.name || '').replace(/^models\//, ''))
            .filter(n => /^gemini/.test(n) && !/(tts|image|live|embedding|audio|transcribe|translate|robotics|computer-use)/i.test(n));
        names.sort((a, b) => (/flash/.test(b) ? 1 : 0) - (/flash/.test(a) ? 1 : 0) || a.localeCompare(b));
        const dl = document.getElementById('aiModelList');
        if (dl) dl.innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
        const pick = document.getElementById('aiModelPick');
        if (pick) {
            pick.innerHTML = '<option value="">— اختر نموذجاً من القائمة (' + names.length + ') —</option>' + names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
            pick.style.display = names.length ? 'block' : 'none';
        }
        setAiTestMsg('✅ تم جلب ' + names.length + ' نموذجاً. اختر من القائمة المنسدلة تحت خانة النموذج (يُفضّل Flash-Lite).');
    } catch (err) {
        setAiTestMsg('❌ ' + friendlyAiError(err), true);
    }
}

// اختبار حقيقي: يرسل صورة صغيرة فيها كلمة ويتأكد أن النموذج يقرؤها (يختبر المفتاح والنموذج ودعم الصور)
async function testAiConnection() {
    if (!saveAiSettings(true)) return;
    const eng = aiVal('aiEngineSelect') || getAiEngine();
    if (eng === 'local') { setAiTestMsg('القراءة العادية لا تحتاج اختباراً.'); return; }
    if (!navigator.onLine) { setAiTestMsg('لا يوجد اتصال بالإنترنت.', true); return; }
    setAiTestMsg('⏳ جاري الاختبار...');
    const t0 = Date.now();
    try {
        const out = await callAiEngine(eng, {
            prompt: 'Read the word written in this image. Reply with that single word only.',
            img: makeAiTestImage(),
            json: false
        });
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        if (/diwan/i.test(out)) setAiTestMsg('✅ يعمل بشكل صحيح (' + secs + ' ثانية) — قرأ الصورة والنموذج جاهز.');
        else setAiTestMsg('⚠️ الاتصال يعمل لكن القراءة لم تطابق المتوقع. ردّ النموذج: ' + aiClean(out, 60), true);
    } catch (err) {
        if (err && err.code === 'NO_KEY') setAiTestMsg('أدخل مفتاح Gemini API أولاً.', true);
        else setAiTestMsg('❌ ' + friendlyAiError(err), true);
    }
}

// فتح الإعدادات فوق نموذج الصنف دون إغلاقه (حتى لا تضيع البيانات المُدخلة)
function openAiSettingsOverForm() {
    openCategoryManager();
    const modal = document.getElementById('catModal');
    if (modal) modal.style.zIndex = '1100';
    const box = document.getElementById('aiSettingsBox');
    if (box && box.scrollIntoView) box.scrollIntoView({ block: 'start' });
}


// ---------------------------------------------------------------------------
// ملء المعلومات من اسم المنتج المكتوب (بدون صورة)
// ---------------------------------------------------------------------------
async function fillFromTypedName() {
    const box = document.getElementById('nameLookupInput');
    const name = ((box && box.value) || '').trim();
    if (!name) { setScanStatusText('اكتب اسم المنتج أولاً.'); if (box) box.focus(); return; }
    const engine = getAiEngine();
    if (engine === 'local') {
        await Swal.fire({ icon: 'info', title: 'اختر محركاً ذكياً', html: '<div style="font-size:0.9rem; line-height:1.8;">البحث بالاسم يحتاج Gemini API أو Firebase AI Logic. اخترهما من القائمة المجاورة لزر الكاميرا.</div>', confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38' });
        return;
    }
    if (!navigator.onLine) { setScanStatusText('📴 يحتاج إنترنت'); return; }
    let res;
    try {
        setScanStatusText('🤖 ' + AI_ENGINES[engine] + ' يبحث عن المنتج...');
        const text = await callAiEngine(engine, { prompt: buildAiPrompt(name), json: true });
        res = normalizeAiResult(parseAiJson(text));
        // التركيز والعبوة والصلاحية لا تُؤخذ إلا مما كتبه الصيدلاني
        res.expiry = '';
        if (!/\d/.test(name)) { res.strength = ''; }
        res.pack = '';
        res.meta = res.form || '';
    } catch (err) {
        setScanStatusText('');
        if (err && err.code === 'NO_KEY') {
            const r = await Swal.fire({ icon: 'info', title: 'مفتاح Gemini API غير مُدخل', html: '<div style="font-size:0.9rem;">أدخله من ⚙️ الإعدادات ← قسم الذكاء الصناعي.</div>', showCancelButton: true, confirmButtonText: '⚙️ فتح الإعدادات', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' });
            if (r.isConfirmed) openAiSettingsOverForm();
        } else {
            await Swal.fire({ icon: 'error', title: 'تعذر البحث بالذكاء الصناعي', html: `<div style="font-size:0.9rem; line-height:1.8;">${escapeHtml(friendlyAiError(err))}</div>`, confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' });
        }
        return;
    }
    setScanStatusText('');
    await showAiScanResult(res, 'name');
}

// ============================================================================
// 16. الأمان: سلة المحذوفات، سجل التعديلات، ونسخ احتياطية سحابية تلقائية
// ============================================================================
const TRASH_DAYS = 30;
const LOG_KEEP_LOCAL = 200;
const LOG_KEEP_CLOUD_DAYS = 90;
const AUTO_BACKUP_DAYS = 7;
const AUTO_BACKUP_KEEP = 4;
const LS_TRASH = 'diwanTrashLocal';
const LS_LOG = 'diwanLogLocal';
const LS_AUTOBK = 'diwanLastAutoBackup';

function lsJson(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
function lsPut(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ممتلئ أو ممنوع */ } }
function actorName() { return (currentUser && currentUser.email) || 'غير معروف'; }
function cloudReady() { return !!(isFirebaseReady && db && currentUser); }
function fmtDateTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('ar-IQ') + ' ' + d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

// ---------------- سلة المحذوفات ----------------
async function moveToTrash(p) {
    const entry = { id: p.id, product: JSON.parse(JSON.stringify(p)), deletedAt: new Date().toISOString(), deletedBy: actorName() };
    const local = lsJson(LS_TRASH, []).filter(x => x && x.id !== p.id);
    local.unshift(entry);
    lsPut(LS_TRASH, local.slice(0, 200));
    if (cloudReady()) {
        try { await fsSet(db.collection('pharmacy_trash').doc(String(p.id)), entry); }
        catch (e) { console.warn('Trash cloud write failed (محفوظ محلياً):', e && e.message); }
    }
}

async function getTrashList() {
    const byId = new Map();
    lsJson(LS_TRASH, []).forEach(x => { if (x && x.product) byId.set(x.id, x); });
    if (cloudReady() && navigator.onLine) {
        try {
            const snap = await db.collection('pharmacy_trash').orderBy('deletedAt', 'desc').limit(200).get();
            snap.forEach(doc => { const d = doc.data(); if (d && d.product) byId.set(d.id, d); });
        } catch (e) { console.warn('Trash read failed:', e && e.message); }
    }
    const limit = Date.now() - TRASH_DAYS * 864e5;
    return [...byId.values()].filter(x => new Date(x.deletedAt).getTime() >= limit)
        .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

async function removeTrashEntry(id) {
    lsPut(LS_TRASH, lsJson(LS_TRASH, []).filter(x => x && x.id !== id));
    if (cloudReady()) { try { await db.collection('pharmacy_trash').doc(String(id)).delete(); } catch (e) { /* تجاهل */ } }
}

async function purgeOldTrash() {
    const limit = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
    lsPut(LS_TRASH, lsJson(LS_TRASH, []).filter(x => x && String(x.deletedAt) >= limit));
    if (!cloudReady() || !navigator.onLine) return;
    try {
        const snap = await db.collection('pharmacy_trash').where('deletedAt', '<', limit).limit(50).get();
        const batch = db.batch(); let n = 0;
        snap.forEach(doc => { batch.delete(doc.ref); n++; });
        if (n) await batch.commit();
    } catch (e) { /* تجاهل */ }
}

async function restoreFromTrash(id) {
    if (!requireOnline()) return;
    const list = await getTrashList();
    const entry = list.find(x => x.id === id);
    if (!entry) return;
    const p = entry.product;
    if (products.some(x => x.id === p.id)) {
        Swal.fire({ icon: 'info', title: 'الصنف موجود أصلاً', confirmButtonColor: '#0f1c38' });
        await removeTrashEntry(id);
        return;
    }
    products.unshift(p);
    products.sort((a, b) => b.id - a.id);
    saveLocal();
    renderAll();
    await saveSingleProductToCloud(p);
    await removeTrashEntry(id);
    logAction('restore', p, []);
    await openTrashModal();
    Swal.fire({ icon: 'success', title: 'تمت الاستعادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1800 });
}

async function deleteTrashForever(id) {
    const r = await Swal.fire({ icon: 'warning', title: 'حذف نهائي؟', text: 'لن يمكن استرجاعه بعد ذلك.', showCancelButton: true, confirmButtonText: 'حذف نهائي', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c' });
    if (!r.isConfirmed) return;
    await removeTrashEntry(id);
    await openTrashModal();
}

async function openTrashModal() {
    const list = await getTrashList();
    const rows = list.map(x => `
        <div class="sec-row">
            <div class="sec-main"><b>${escapeHtml(x.product.name || '')}</b>
                <small>${escapeHtml(x.product.brand || '')} • حُذف ${escapeHtml(fmtDateTime(x.deletedAt))}</small></div>
            <button type="button" class="sec-btn" onclick="restoreFromTrash(${Number(x.id)})">↩️ استعادة</button>
            <button type="button" class="sec-btn sec-del" onclick="deleteTrashForever(${Number(x.id)})">🗑️</button>
        </div>`).join('');
    Swal.fire({
        title: '🗑️ سلة المحذوفات',
        html: `<div class="sec-list">${rows || '<div class="sec-empty">السلة فارغة</div>'}</div>
               <p class="sec-note">تُحذف الأصناف نهائياً بعد ${TRASH_DAYS} يوماً.</p>`,
        showConfirmButton: true, confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38'
    });
}

// ---------------- سجل التعديلات ----------------
const LOG_FIELDS = { name: 'الاسم', brand: 'الشركة', qty: 'الكمية', price: 'السعر', category: 'التصنيف', department: 'القسم', meta: 'العبوة', activeIngredient: 'المادة الفعالة', minQty: 'حد التنبيه', details: 'التفاصيل', keywords: 'الكلمات', img: 'الصورة', barcode: 'الباركود', subCount: 'أجزاء العبوة', subType: 'نوع الجزء', subPrice: 'سعر الجزء', loose: 'أجزاء مفتوحة', costPrice: 'سعر الشراء' };

function diffProduct(a, b) {
    const out = [];
    Object.keys(LOG_FIELDS).forEach(f => {
        const x = a[f] === undefined || a[f] === null ? '' : a[f];
        const y = b[f] === undefined || b[f] === null ? '' : b[f];
        if (String(x) !== String(y)) out.push({ f: LOG_FIELDS[f], from: String(x).slice(0, 60), to: String(y).slice(0, 60) });
    });
    const ea = (a.expiryDates || (a.expiryDate ? [a.expiryDate] : [])).join(', ');
    const eb = (b.expiryDates || (b.expiryDate ? [b.expiryDate] : [])).join(', ');
    if (ea !== eb) out.push({ f: 'النفاذ', from: ea, to: eb });
    ['extraDepartments', 'extraCategories', 'extraTypes'].forEach(f => {
        const x = extrasOf(a[f]).join(', '), y = extrasOf(b[f]).join(', ');
        if (x !== y) out.push({ f: f === 'extraDepartments' ? 'أقسام إضافية' : f === 'extraCategories' ? 'تصنيفات إضافية' : 'تبويبات إضافية', from: x, to: y });
    });
    return out;
}

function logAction(action, p, changes) {
    try {
        const e = { at: new Date().toISOString(), by: actorName(), action, productId: p.id, name: String(p.name || '').slice(0, 120), changes: (changes || []).slice(0, 12) };
        const local = lsJson(LS_LOG, []);
        local.unshift(e);
        lsPut(LS_LOG, local.slice(0, LOG_KEEP_LOCAL));
        if (cloudReady() && navigator.onLine) db.collection('pharmacy_log').add(e).catch(() => {});
    } catch (err) { /* السجل لا يجب أن يكسر العملية الأصلية */ }
}

const LOG_ACTION_LABEL = { add: '➕ إضافة', edit: '✏️ تعديل', qty: '📦 كمية', delete: '🗑️ حذف', restore: '↩️ استعادة' };

async function openLogModal() {
    let list = lsJson(LS_LOG, []);
    if (cloudReady() && navigator.onLine) {
        try {
            const snap = await db.collection('pharmacy_log').orderBy('at', 'desc').limit(100).get();
            const cloud = []; snap.forEach(d => cloud.push(d.data()));
            if (cloud.length) list = cloud;
        } catch (e) { /* نعرض المحلي */ }
    }
    const rows = list.slice(0, 100).map(e => `
        <div class="sec-row sec-log">
            <div class="sec-main">
                <b>${LOG_ACTION_LABEL[e.action] || escapeHtml(e.action)} — ${escapeHtml(e.name || '')}</b>
                ${(e.changes || []).map(c => `<small>${escapeHtml(c.f)}: ${escapeHtml(c.from || '—')} ← ${escapeHtml(c.to || '—')}</small>`).join('')}
                <small class="sec-meta">${escapeHtml(fmtDateTime(e.at))} • ${escapeHtml(e.by || '')}</small>
            </div>
        </div>`).join('');
    Swal.fire({
        title: '📜 سجل التعديلات',
        html: `<div class="sec-list">${rows || '<div class="sec-empty">لا توجد تعديلات مسجلة بعد</div>'}</div>`,
        confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38'
    });
}

async function purgeOldLog() {
    if (!cloudReady() || !navigator.onLine) return;
    try {
        const limit = new Date(Date.now() - LOG_KEEP_CLOUD_DAYS * 864e5).toISOString();
        const snap = await db.collection('pharmacy_log').where('at', '<', limit).limit(100).get();
        const batch = db.batch(); let n = 0;
        snap.forEach(doc => { batch.delete(doc.ref); n++; });
        if (n) await batch.commit();
    } catch (e) { /* تجاهل */ }
}

// ---------------- نسخ احتياطية سحابية تلقائية ----------------
async function createCloudBackup(force) {
    if (!cloudReady() || !navigator.onLine || !products.length) return false;
    const json = JSON.stringify(buildBackupObject());
    if (json.length > 900000) { console.warn('النسخة أكبر من حد المستند (1MB)'); return false; }
    const id = todayStamp();
    await db.collection('pharmacy_backups').doc(id).set({ id, at: new Date().toISOString(), count: products.length, json, by: actorName() });
    lsPut(LS_AUTOBK, Date.now());
    // نُبقي آخر N نسخ فقط
    try {
        const snap = await db.collection('pharmacy_backups').orderBy('at', 'desc').limit(AUTO_BACKUP_KEEP + 6).get();
        const docs = []; snap.forEach(d => docs.push(d.ref));
        for (const ref of docs.slice(AUTO_BACKUP_KEEP)) { await ref.delete(); }
    } catch (e) { /* تجاهل */ }
    return true;
}

async function autoMaintenance() {
    if (!cloudReady() || !navigator.onLine) return;
    try {
        const last = Number(lsJson(LS_AUTOBK, 0)) || 0;
        if (Date.now() - last >= AUTO_BACKUP_DAYS * 864e5) await createCloudBackup(false);
        await purgeOldTrash();
        await purgeOldLog();
    } catch (e) { console.warn('Auto maintenance:', e && e.message); }
}

async function backupNowCloud() {
    if (!requireOnline()) return;
    if (!cloudReady()) { Swal.fire({ icon: 'error', title: 'سجّل دخول الصيدلي أولاً', confirmButtonColor: '#0f1c38' }); return; }
    try {
        const ok = await createCloudBackup(true);
        Swal.fire({ icon: ok ? 'success' : 'warning', title: ok ? 'تم حفظ نسخة سحابية' : 'تعذر حفظ النسخة (حجمها كبير أو لا توجد أصناف)', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر حفظ النسخة', text: 'تأكد أن قواعد Firestore تسمح بمجموعة pharmacy_backups. ' + (e && e.message || ''), confirmButtonColor: '#0f1c38' });
    }
}

async function openCloudBackupsModal() {
    if (!cloudReady()) { Swal.fire({ icon: 'error', title: 'سجّل دخول الصيدلي أولاً', confirmButtonColor: '#0f1c38' }); return; }
    let docs = [];
    try {
        const snap = await db.collection('pharmacy_backups').orderBy('at', 'desc').limit(AUTO_BACKUP_KEEP + 2).get();
        snap.forEach(d => docs.push(d.data()));
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر قراءة النسخ', text: 'تأكد أن قواعد Firestore تسمح بمجموعة pharmacy_backups.', confirmButtonColor: '#0f1c38' });
        return;
    }
    window.__cloudBackups = docs;
    const rows = docs.map((b, i) => `
        <div class="sec-row">
            <div class="sec-main"><b>${escapeHtml(b.id || '')}</b><small>${Number(b.count) || 0} صنف • ${escapeHtml(fmtDateTime(b.at))}</small></div>
            <button type="button" class="sec-btn" onclick="restoreCloudBackup(${i})">↩️ استرجاع</button>
            <button type="button" class="sec-btn" onclick="downloadCloudBackup(${i})">⬇️</button>
        </div>`).join('');
    Swal.fire({
        title: '☁️ النسخ السحابية',
        html: `<div class="sec-list">${rows || '<div class="sec-empty">لا توجد نسخ بعد. تُنشأ تلقائياً كل ${AUTO_BACKUP_DAYS} أيام عند دخولك.</div>'}</div>
               <button type="button" class="sec-btn sec-wide" onclick="backupNowCloud()">➕ نسخة الآن</button>`,
        confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38'
    });
}

function parseCloudBackup(i) {
    const b = (window.__cloudBackups || [])[i];
    if (!b) return null;
    try { return JSON.parse(b.json); } catch (e) { return null; }
}

async function restoreCloudBackup(i) {
    const data = parseCloudBackup(i);
    const problem = validateBackup(data);
    if (problem) { Swal.fire({ icon: 'error', title: 'نسخة غير صالحة', text: problem, confirmButtonColor: '#0f1c38' }); return; }
    await applyBackupData(data);
}

function downloadCloudBackup(i) {
    const b = (window.__cloudBackups || [])[i];
    if (b) downloadFile(`diwan-cloud-backup-${b.id}.json`, b.json, 'application/json');
}

// ============================================================================
// 17. تحسينات الاستخدام: تعديل الكمية السريع، فلاتر النفاذ، وضع الجرد، الباركود، التثبيت
// ============================================================================

// ---------------- تعديل الكمية السريع من بطاقة الصنف ----------------
const qtyTimers = {};
const qtyStart = {};

function quickQty(id, delta, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    if (!writesAllowed()) return;
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (qtyStart[id] === undefined) qtyStart[id] = parseInt(p.qty) || 0;
    p.qty = Math.max(0, (parseInt(p.qty) || 0) + delta);
    const num = document.getElementById('qs_' + id);
    if (num) num.innerText = p.qty;
    const dot = document.getElementById('qd_' + id);
    if (dot) dot.className = p.qty > 0 ? (isLowStock(p) ? 'status-dot low' : 'status-dot') : 'status-dot out';
    saveLocal();
    clearTimeout(qtyTimers[id]);
    qtyTimers[id] = setTimeout(() => flushQty(id), 900);   // نجمع الضغطات المتتالية في كتابة واحدة
}

async function flushQty(id) {
    const p = products.find(x => x.id === id);
    const from = qtyStart[id];
    delete qtyStart[id];
    if (!p || from === undefined) return;
    const to = parseInt(p.qty) || 0;
    if (from === to) return;
    const ok = await saveProductsDelta([{ p, dq: to - from, dl: 0 }]);
    if (ok) logAction('qty', p, [{ f: 'الكمية', from: String(from), to: String(to) }]);
    updateExpiryBadge();
}

// ---------------- فلاتر "قرب النفاذ" ----------------
let expiryFilter = 'all';

function setExpiryFilter(f) {
    expiryFilter = f;
    openExpiryModal();
}

function openExpiryModal() {
    const listContainer = document.getElementById('expiryListContainer');
    const all = getExpiringProducts();
    const count = lv => all.filter(x => x.status.level === lv).length;
    const chips = [['all', 'الكل', all.length], ['expired', 'منتهية', count('expired')], ['3m', 'أقل من 3 أشهر', count('3m')], ['6m', '3–6 أشهر', count('6m')]]
        .map(([k, label, n]) => `<button type="button" class="ex-chip ${expiryFilter === k ? 'active' : ''}" onclick="setExpiryFilter('${k}')">${label} <b>${n}</b></button>`).join('');
    const list = expiryFilter === 'all' ? all : all.filter(x => x.status.level === expiryFilter);

    let body;
    if (list.length === 0) {
        body = `<div class="empty-state"><div class="empty-ico">✅</div><div>${all.length ? 'لا توجد أصناف في هذا الفلتر.' : 'لا توجد مواد منتهية أو قريبة النفاذ (خلال 6 أشهر).'}</div></div>`;
    } else {
        body = list.map(({ product, status, date }) => `
            <div onclick="closeExpiryModal(); openSheet(${product.id});" style="cursor:pointer; padding:10px 12px; border-radius:10px; background:${status.bg}; border:1px solid ${status.border}; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                    <div style="font-weight:800; font-size:0.88rem; color:#0f172a;" dir="ltr">${escapeHtml(product.name)}</div>
                    <div style="font-size:0.75rem; color:#475569;">الشركة: ${escapeHtml(product.brand)} | العدد: ${Number(product.qty) || 0}</div>
                </div>
                <div style="text-align:left; flex-shrink:1; max-width:46%; word-break:break-word;">
                    <div style="font-size:0.74rem; font-weight:800; color:${status.color};">${status.label}</div>
                    <div style="font-size:0.72rem; font-weight:700; color:#334155;" dir="ltr">📅 ${date}</div>
                </div>
            </div>`).join('');
    }
    listContainer.innerHTML = '<div class="alert-title">📅 قرب نفاذ الصلاحية</div><div class="ex-chips">' + chips + '</div>' + body + buildLowStockSection();
    document.getElementById('expiryModal').style.display = 'flex';
}

// ---------------- وضع الجرد ----------------
let invCounts = {};
let invQuery = '';

function openInventory() {
    invCounts = {};
    invQuery = '';
    const q = document.getElementById('invSearch');
    if (q) q.value = '';
    renderInventory();
    document.getElementById('inventoryModal').style.display = 'flex';
}

function closeInventory() {
    document.getElementById('inventoryModal').style.display = 'none';
}

function invVisibleItems() {
    const qn = normSearch(invQuery), qt = qn ? qn.split(' ') : [];
    return getBaseFilteredByTab()
        .filter(p => searchScore(p, qn, qt) > 0)
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function invChangedCount() {
    return Object.keys(invCounts).filter(id => {
        const p = products.find(x => String(x.id) === id);
        return p && invCounts[id] !== (parseInt(p.qty) || 0);
    }).length;
}

function renderInventory() {
    const items = invVisibleItems();
    const box = document.getElementById('invList');
    if (!box) return;
    box.innerHTML = items.length ? items.map(p => {
        const cur = parseInt(p.qty) || 0;
        const val = invCounts[p.id] !== undefined ? invCounts[p.id] : cur;
        const changed = val !== cur;
        return `<div class="inv-row ${changed ? 'changed' : ''}" id="inv_${p.id}">
            <div class="inv-info"><b dir="ltr">${escapeHtml(p.name)}</b><small>${escapeHtml(p.brand || '')} • المسجّل: ${cur}</small></div>
            <div class="inv-step">
                <button type="button" onclick="invStep(${p.id}, -1)">−</button>
                <input type="number" inputmode="numeric" min="0" value="${val}" onchange="invSet(${p.id}, this.value)" id="invIn_${p.id}">
                <button type="button" onclick="invStep(${p.id}, 1)">+</button>
            </div>
        </div>`;
    }).join('') : '<div class="empty-state"><div class="empty-ico">🔎</div><div>لا توجد أصناف مطابقة.</div></div>';
    refreshInvFooter();
}

function refreshInvFooter() {
    const n = invChangedCount();
    const btn = document.getElementById('invSaveBtn');
    const lab = document.getElementById('invCount');
    if (lab) lab.innerText = n ? `${n} صنف تغيّرت كميته` : 'لا تغييرات بعد';
    if (btn) btn.disabled = n === 0;
}

function invSet(id, v) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const n = Math.max(0, parseInt(v) || 0);
    invCounts[id] = n;
    const row = document.getElementById('inv_' + id);
    if (row) row.classList.toggle('changed', n !== (parseInt(p.qty) || 0));
    const inp = document.getElementById('invIn_' + id);
    if (inp) inp.value = n;
    refreshInvFooter();
}

function invStep(id, d) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const cur = invCounts[id] !== undefined ? invCounts[id] : (parseInt(p.qty) || 0);
    invSet(id, cur + d);
}

function invFilter(v) {
    invQuery = v || '';
    renderInventory();
}

async function saveInventory() {
    const changed = [];
    Object.keys(invCounts).forEach(id => {
        const p = products.find(x => String(x.id) === id);
        if (p && invCounts[id] !== (parseInt(p.qty) || 0)) changed.push({ p, from: parseInt(p.qty) || 0, to: invCounts[id] });
    });
    if (!changed.length) return;
    const r = await Swal.fire({
        title: 'تطبيق نتائج الجرد؟',
        html: `<div style="font-size:0.9rem; line-height:1.8;">سيتم تعديل كمية <b>${changed.length}</b> صنف.</div>`,
        icon: 'question', showCancelButton: true, confirmButtonText: 'نعم، طبّق', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38'
    });
    if (!r.isConfirmed) return;
    changed.forEach(c => { c.p.qty = c.to; });
    const ok = await saveProductsBatch(changed.map(c => c.p));
    if (ok) {
        changed.forEach(c => logAction('qty', c.p, [{ f: 'الكمية (جرد)', from: String(c.from), to: String(c.to) }]));
        closeInventory();
        renderAll();
        Swal.fire({ icon: 'success', title: `تم تحديث ${changed.length} صنف`, toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
    } else {
        changed.forEach(c => { c.p.qty = c.from; });   // نُرجع القيم القديمة عند فشل الحفظ
        saveLocal();
        renderInventory();
    }
}

// ---------------- الباركود ----------------
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
let barcodeStream = null;
let barcodeRaf = 0;
let barcodeCallback = null;
let zxingReader = null;
let zxingPromise = null;

function cleanBarcode(v) { return String(v || '').replace(/[^0-9A-Za-z\-]/g, '').slice(0, 40); }

function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingPromise) {
        zxingPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = ZXING_URL;
            s.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing not found'));
            s.onerror = () => { zxingPromise = null; reject(new Error('تعذر تحميل مكتبة قراءة الباركود')); };
            document.head.appendChild(s);
        });
    }
    return zxingPromise;
}

function setBarcodeStatus(t, isErr) {
    const el = document.getElementById('bcStatus');
    if (el) { el.innerText = t || ''; el.style.color = isErr ? '#b91c1c' : ''; }
}

function openBarcodeScanner(cb) {
    barcodeCallback = cb;
    document.getElementById('barcodeModal').style.display = 'flex';
    const m = document.getElementById('bcManual');
    if (m) m.value = '';
    setBarcodeStatus('');
    startBarcodeCamera();
}

function closeBarcodeScanner() {
    stopBarcodeCamera();
    document.getElementById('barcodeModal').style.display = 'none';
    barcodeCallback = null;
}

function stopBarcodeCamera() {
    cancelAnimationFrame(barcodeRaf);
    barcodeRaf = 0;
    if (zxingReader) { try { zxingReader.reset(); } catch (e) { /* تجاهل */ } zxingReader = null; }
    if (barcodeStream) { barcodeStream.getTracks().forEach(t => t.stop()); barcodeStream = null; }
    const v = document.getElementById('bcVideo');
    if (v) { try { v.srcObject = null; } catch (e) { /* تجاهل */ } }
}

function barcodeFound(code) {
    const g = parseGS1(code);                       // باركود GS1: نحفظ GTIN فقط (الرقم التسلسلي يتغير لكل علبة)
    const c = g ? g.gtin : cleanBarcode(code);
    if (!c) return;
    const cb = barcodeCallback;
    closeBarcodeScanner();
    if (cb) cb(c, g);
}

async function startBarcodeCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setBarcodeStatus('الكاميرا غير متاحة في هذا المتصفح. اكتب الرقم يدوياً أو صوّر الباركود.', true);
        return;
    }
    const video = document.getElementById('bcVideo');
    try {
        let det = null;
        if ('BarcodeDetector' in window) {   // نستعمل الصيغ التي يدعمها الجهاز فعلاً (بعضها يرمي خطأ إن لم يُدعم)
            try {
                const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'];
                const sup = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : want;
                const use = want.filter(f => sup.includes(f));
                if (use.length) det = new BarcodeDetector({ formats: use });
            } catch (e) { det = null; }
        }
        if (det) {
            barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
            video.srcObject = barcodeStream;
            await video.play();
            try { const tr = barcodeStream.getVideoTracks()[0]; await tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* غير مدعوم */ }
            setBarcodeStatus('وجّه الكاميرا نحو الباركود (قرّب واثبت قليلاً)...');
            setTimeout(() => { if (barcodeStream && document.getElementById('barcodeModal').style.display === 'flex') setBarcodeStatus('لم يُقرأ بعد: حسّن الإضاءة وقرّب أو ابعد قليلاً، أو التقط صورة، أو اكتب الرقم.'); }, 7000);
            let last = 0;
            const tick = async (t) => {
                if (!barcodeStream) return;
                if (t - last > 220) {
                    last = t;
                    try {
                        const found = await det.detect(video);
                        if (found && found.length) { barcodeFound(found[0].rawValue); return; }
                    } catch (e) { /* إطار غير جاهز */ }
                }
                barcodeRaf = requestAnimationFrame(tick);
            };
            barcodeRaf = requestAnimationFrame(tick);
        } else {
            setBarcodeStatus('جاري تحميل قارئ الباركود...');
            const Z = await loadZXing();
            const hints = new Map();
            try { hints.set(Z.DecodeHintType.TRY_HARDER, true); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF]); } catch (e) { /* تجاهل */ }
            zxingReader = new Z.BrowserMultiFormatReader(hints);
            setBarcodeStatus('وجّه الكاميرا نحو الباركود...');
            zxingReader.decodeFromVideoDevice(null, 'bcVideo', (result) => {
                if (result) barcodeFound(result.getText());
            }).catch(err => setBarcodeStatus('تعذر تشغيل الكاميرا: ' + (err && err.message || err), true));
        }
    } catch (err) {
        setBarcodeStatus('تعذر تشغيل الكاميرا (اسمح للتطبيق باستخدامها). يمكنك الكتابة يدوياً أو تصوير الباركود.', true);
    }
}

async function barcodeFromPhoto(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;
    setBarcodeStatus('⏳ جاري قراءة الصورة...');
    try {
        let code = '';
        if ('BarcodeDetector' in window) {
            const bmp = await createImageBitmap(file);
            const det = new BarcodeDetector();
            const found = await det.detect(bmp);
            if (found && found.length) code = found[0].rawValue;
        } else {
            const Z = await loadZXing();
            const url = URL.createObjectURL(file);
            try { code = (await new Z.BrowserMultiFormatReader().decodeFromImageUrl(url)).getText(); }
            finally { URL.revokeObjectURL(url); }
        }
        if (code) barcodeFound(code); else setBarcodeStatus('لم أجد باركوداً في الصورة. جرّب صورة أقرب أو اكتب الرقم.', true);
    } catch (err) {
        setBarcodeStatus('لم أستطع قراءة الباركود من الصورة. اكتب الرقم يدوياً.', true);
    } finally {
        input.value = '';
    }
}

function submitManualBarcode() {
    const v = (document.getElementById('bcManual') || {}).value;
    if (!cleanBarcode(v)) { setBarcodeStatus('اكتب رقم الباركود.', true); return; }
    barcodeFound(v);
}

// ---- GS1 (DataMatrix/GS1-128 على علب الأدوية): (01)GTIN (17)انتهاء (10)دفعة (21)رقم تسلسلي لكل علبة ----
function parseGS1(raw) {
    let s = String(raw || '').replace(/^\]d2|^\]C1|^\]Q3/, '');
    if (s.includes('(')) { const m = {}; s.replace(/\((\d{2,4})\)([^(]*)/g, (_, k, v) => { m[k] = v.replace(/[\x00-\x1f]/g, ''); }); if (!m['01']) return null; return { gtin: m['01'].slice(0, 14), batch: m['10'] || '', exp: gs1Exp(m['17']), serial: m['21'] || '' }; }
    if (!/^01\d{14}/.test(s)) return null;
    const out = { gtin: s.slice(2, 16), batch: '', exp: '', serial: '' };
    let i = 16; const fixed = { '11': 6, '12': 6, '13': 6, '15': 6, '16': 6, '17': 6, '20': 2 };
    while (i < s.length) {
        const ai = s.substr(i, 2);
        if (ai === '10' || ai === '21') { let j = i + 2; while (j < s.length && s[j] !== '\x1d') j++; const v = s.slice(i + 2, j); if (ai === '10') out.batch = v; else out.serial = v; i = j + 1; }
        else if (fixed[ai]) { if (ai === '17') out.exp = gs1Exp(s.substr(i + 2, 6)); i += 2 + fixed[ai]; }
        else break;
    }
    return out;
}
function gs1Exp(v) { const m = /^(\d{2})(\d{2})/.exec(v || ''); return m && +m[2] >= 1 && +m[2] <= 12 ? '20' + m[1] + '-' + m[2] : ''; }
function barcodeKeys(code) {   // مفاتيح مطابقة: النص كاملاً، GTIN، ونواة الرقم (تتجاوز اختلاف EAN-13/GTIN-14)
    const keys = new Set(), c = cleanBarcode(code);
    if (!c) return keys;
    keys.add(c);
    const g = parseGS1(c);
    const d = g ? g.gtin : (/^\d{8,14}$/.test(c) ? c : '');
    if (g) keys.add(g.gtin);
    let core = '';
    if (d.length === 14) core = d.slice(1, 13); else if (d.length === 13) core = d.slice(0, 12); else if (d.length === 12) core = '0' + d.slice(0, 11);
    if (core) keys.add('core:' + core);
    return keys;
}
function barcodesOf(p) {   // كل باركودات الصنف (الأول هو الأساسي)
    const set = [];
    [p && p.barcode].concat(Array.isArray(p && p.barcodes) ? p.barcodes : []).forEach(b => { const c = cleanBarcode(b); if (c && !set.includes(c)) set.push(c); });
    return set;
}
function findByBarcode(code) {
    const ck = barcodeKeys(code);
    if (!ck.size) return undefined;
    return products.find(p => barcodesOf(p).some(b => { for (const k of barcodeKeys(b)) if (ck.has(k)) return true; return false; }));
}
// ---- قائمة الباركودات في نموذج الصنف ----
let formBarcodes = [];
function renderBarcodeChips() {
    const box = document.getElementById('fBarcodeChips');
    if (!box) return;
    box.innerHTML = formBarcodes.map((b, i) => `<span class="bc-chip" dir="ltr">${i === 0 ? '★ ' : ''}${escapeHtml(b)}<button type="button" aria-label="حذف" onclick="removeFormBarcode(${i})">✕</button></span>`).join('');
}
function removeFormBarcode(i) { formBarcodes.splice(i, 1); renderBarcodeChips(); }
async function addFormBarcode(code) {
    const f = document.getElementById('fBarcode');
    const c = cleanBarcode(code !== undefined ? code : (f ? f.value : ''));
    if (!c) return;
    if (formBarcodes.includes(c)) { if (f) f.value = ''; return; }
    const dup = findByBarcode(c);
    const editId = parseInt((document.getElementById('editId') || {}).value, 10);
    if (dup && dup.id !== editId) {
        await Swal.fire({ icon: 'warning', title: 'الباركود مستعمل', html: `هذا الباركود مسجّل للصنف: <b dir="ltr">${escapeHtml(dup.name)}</b>`, confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        return;
    }
    formBarcodes.push(c); if (f) f.value = '';
    renderBarcodeChips();
}

// من شريط البحث: امسح باركوداً لفتح الصنف
function scanBarcodeToSearch() {
    openBarcodeScanner(async (code) => {
        const p = findByBarcode(code);
        if (p) { openSheet(p.id); return; }
        if (document.body.classList.contains('admin-mode')) {
            const r = await Swal.fire({
                icon: 'question', title: 'باركود غير مسجّل',
                html: `<div dir="ltr" style="font-weight:800; margin-bottom:6px;">${escapeHtml(code)}</div><div style="font-size:0.9rem;">لا يوجد صنف بهذا الباركود. هل تريد إضافة صنف جديد به؟</div>`,
                showCancelButton: true, confirmButtonText: 'إضافة صنف', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38'
            });
            if (r.isConfirmed) { openFormModal(); formBarcodes = [cleanBarcode(code)]; renderBarcodeChips(); }
        } else {
            Swal.fire({ icon: 'info', title: 'لم يتم العثور على الصنف', text: 'هذا الباركود غير موجود في قائمتنا. اسأل الصيدلي.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        }
    });
}

// من نموذج الصنف: امسح باركوداً لتعبئة الحقل
function scanBarcodeToForm() {
    openBarcodeScanner(code => addFormBarcode(code));
}

// ---------------- تثبيت التطبيق ----------------
let deferredInstall = null;
const LS_INSTALL_DISMISSED = 'diwanInstallDismissed';

function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

function showInstallBanner() {
    const b = document.getElementById('installBanner');
    if (!b || isStandalone()) return;
    try { if (localStorage.getItem(LS_INSTALL_DISMISSED)) return; } catch (e) { /* تجاهل */ }
    b.style.display = 'flex';
}

function dismissInstallBanner() {
    const b = document.getElementById('installBanner');
    if (b) b.style.display = 'none';
    try { localStorage.setItem(LS_INSTALL_DISMISSED, '1'); } catch (e) { /* تجاهل */ }
}

async function installApp() {
    if (deferredInstall) {
        deferredInstall.prompt();
        try { await deferredInstall.userChoice; } catch (e) { /* تجاهل */ }
        deferredInstall = null;
        dismissInstallBanner();
        return;
    }
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    Swal.fire({
        icon: 'info', title: 'تثبيت التطبيق',
        html: `<div style="font-size:0.92rem; line-height:1.9; text-align:right;">${isStandalone() ? 'التطبيق مثبّت ويعمل بالفعل ✅' : ios
            ? 'في Safari: اضغط زر المشاركة <b>⬆️</b> ثم اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.'
            : 'من قائمة المتصفح (⋮) اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.'}</div>`,
        confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38'
    });
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; showInstallBanner(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; dismissInstallBanner(); });

// ============================================================================
// 18. المظهر: وضع داكن (يتبع النظام افتراضياً) وأيقونات موحّدة
// ============================================================================
const LS_THEME = 'diwanTheme';   // 'light' | 'dark' | (فارغ = حسب النظام)

function currentTheme() {
    let saved = '';
    try { saved = localStorage.getItem(LS_THEME) || ''; } catch (e) { /* تجاهل */ }
    if (saved === 'light' || saved === 'dark') return saved;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0a1020' : '#0f1c38');
    const btn = document.getElementById('themeBtn');
    if (btn) { btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon; btn.title = t === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'; }
}

function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(LS_THEME, next); } catch (e) { /* تجاهل */ }
    applyTheme(next);
}

const svgIcon = (p) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
    user: svgIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
    lock: svgIcon('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    bell: svgIcon('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    gear: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
    list: svgIcon('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    moon: svgIcon('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
};

function initIcons() {
    const map = { authBtn: ICONS.user, bellIco: ICONS.bell, gearBtn: ICONS.gear, addBtn: ICONS.plus, invBtn: ICONS.list };
    Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = map[id]; });
    applyTheme(currentTheme());
}
initIcons();


// ============================================================================
// حماية بيانات المخزون: نقل الكمية والصلاحية إلى مجموعة خاصة بالصيدلي
// ============================================================================
function publicStockLeakCount() { return cloudPub.filter(d => STOCK_FIELDS.some(f => f in d)).length; }
async function migrateStockPrivate() {
    if (!cloudReady()) { Swal.fire({ icon: 'error', title: 'سجّل دخول الصيدلي أولاً', confirmButtonColor: '#0f1c38' }); return; }
    if (!requireOnline()) return;
    const leak = publicStockLeakCount();
    const r = await Swal.fire({
        icon: 'question', title: 'حماية بيانات المخزون',
        html: `سيتم نقل <b>الكمية وحد التنبيه وتواريخ الصلاحية</b> إلى مجموعة خاصة بك فقط، ويبقى الزبون يرى «متوفر / غير متوفر» فقط.<br><br>عدد الأصناف التي ما زالت كمياتها ظاهرة للعامة: <b>${leak}</b> من ${products.length}.<br><small>تُنشأ نسخة احتياطية سحابية قبل البدء.</small>`,
        showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'ابدأ الآن', cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;
    try {
        const ok = await createCloudBackup(true);
        if (!ok) { await Swal.fire({ icon: 'error', title: 'تعذر إنشاء النسخة الاحتياطية', text: 'لن نبدأ النقل بدون نسخة احتياطية. تأكد من قواعد Firestore ثم أعد المحاولة.', confirmButtonColor: '#0f1c38' }); return; }
        const saved = await saveProductsBatch(products.slice());
        if (saved) await Swal.fire({ icon: 'success', title: 'تمت الحماية', text: 'صارت الكميات والصلاحيات خاصة بك. تحقق أن الأصناف ما زالت تظهر بشكل سليم.', confirmButtonColor: '#0f1c38' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'تعذر إكمال النقل', text: (e && e.message) || '', confirmButtonColor: '#0f1c38' });
    }
}


// ============================================================================
// البيع بالتجزئة: عدد الأجزاء في العبوة + نوع الجزء + سعر الجزء
// المخزون = عبوات كاملة (qty) + أجزاء مفتوحة من عبوة (loose)
// ============================================================================
function subCountOf(p) { const n = parseInt(p && p.subCount); return n > 1 ? n : 0; }
function hasRetail(p) { return subCountOf(p) > 1; }
function subTypeOf(p) { return (p && p.subType) || 'جزء'; }
function subPriceOf(p) {
    const sp = parseFloat(p && p.subPrice);
    if (sp > 0) return sp;
    return hasRetail(p) ? Math.round((parseFloat(p.price) || 0) / subCountOf(p)) : 0;
}
function totalParts(p) { return (parseInt(p.qty) || 0) * subCountOf(p) + (parseInt(p.loose) || 0); }
// يحسب المخزون بعد بيع كمية: unit = 'pack' عبوات كاملة، أو 'part' أجزاء (يفتح عبوة عند الحاجة)
function stockAfterSale(p, n, unit) {
    const qty = parseInt(p.qty) || 0, loose = parseInt(p.loose) || 0, sc = subCountOf(p);
    n = Math.max(0, parseFloat(n) || 0);
    if (unit === 'part' && sc) {
        const left = Math.max(0, qty * sc + loose - n);
        return { qty: Math.floor(left / sc), loose: left % sc };
    }
    return { qty: Math.max(0, qty - n), loose };
}
function stockLabel(p) {
    const q = parseInt(p.qty) || 0, l = parseInt(p.loose) || 0;
    if (hasRetail(p) && l > 0) return `${q} عبوة + ${l} ${subTypeOf(p)}`;
    return String(q);
}
function renderSubTypeSelect(selected) {
    const sel = document.getElementById('fSubType');
    if (!sel) return;
    const list = subTypes.slice();
    if (selected && !list.includes(selected)) list.push(selected);
    sel.innerHTML = list.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    sel.value = selected || list[0];
}
async function addSubType() {
    const r = await Swal.fire({ title: 'نوع جزء جديد', input: 'text', inputPlaceholder: 'مثال: Sachet أو Pen', showCancelButton: true, confirmButtonText: 'إضافة', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
    const v = r && r.value ? String(r.value).trim() : '';
    if (!v) return;
    if (!subTypes.some(t => t.toLowerCase() === v.toLowerCase())) { subTypes.push(v); saveLocal(); pushToCloud(true); }
    renderSubTypeSelect(v);
}
function retailAutoPrice() {
    const sp = document.getElementById('fSubPrice'), cnt = parseInt(document.getElementById('fSubCount').value) || 0;
    if (!sp || sp.dataset.manual === '1') return;
    const price = parseFloat(document.getElementById('fPrice').value) || 0;
    sp.value = cnt > 1 && price > 0 ? Math.round(price / cnt) : '';
}
function fillRetailForm(p) {
    const cnt = document.getElementById('fSubCount'); if (!cnt) return;
    cnt.value = p && subCountOf(p) ? subCountOf(p) : '';
    renderSubTypeSelect(p && p.subType);
    const sp = document.getElementById('fSubPrice');
    const auto = p && hasRetail(p) && Math.round((parseFloat(p.price) || 0) / subCountOf(p)) === (parseFloat(p.subPrice) || 0);
    sp.dataset.manual = (p && p.subPrice && !auto) ? '1' : '';
    sp.value = p && parseFloat(p.subPrice) ? p.subPrice : '';
    document.getElementById('fLoose').value = p && p.loose ? p.loose : 0;
    if (p && hasRetail(p) && !sp.value) retailAutoPrice();
}
function readRetailForm() {
    const cnt = parseInt(document.getElementById('fSubCount').value) || 0;
    if (cnt < 2) return { subCount: 0, subType: '', subPrice: 0, loose: 0 };
    const price = parseFloat(document.getElementById('fPrice').value) || 0;
    const sp = parseFloat(document.getElementById('fSubPrice').value);
    return {
        subCount: cnt,
        subType: document.getElementById('fSubType').value || 'جزء',
        subPrice: sp > 0 ? sp : Math.round(price / cnt),
        loose: Math.min(Math.max(parseInt(document.getElementById('fLoose').value) || 0, 0), cnt - 1)
    };
}

function fmtMoney(n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

// ============================================================================
// تنقّل الجوال: سحب النافذة للأسفل لإغلاقها، وزر الرجوع لا يُخرج من التطبيق بدون تأكيد
// ============================================================================
(function setupMobileNav() {
    // 1) سحب النوافذ السفلية للأسفل
    function swipeClose(sheetId, closeFn) {
        const sh = document.getElementById(sheetId); if (!sh) return;
        let y0 = 0, dy = 0, track = false;
        sh.addEventListener('touchstart', e => {
            if (e.touches.length !== 1) { track = false; return; }
            track = sh.scrollTop <= 0; y0 = e.touches[0].clientY; dy = 0;
        }, { passive: true });
        sh.addEventListener('touchmove', e => {
            if (!track) return;
            dy = e.touches[0].clientY - y0;
            if (dy > 0 && sh.scrollTop <= 0) {
                if (e.cancelable) e.preventDefault();          // يمنع «السحب للتحديث» في المتصفح
                sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)';
            } else if (dy < 0) { track = false; sh.style.transition = ''; sh.style.transform = ''; }
        }, { passive: false });
        const end = () => {
            if (!track) return; track = false;
            sh.style.transition = '';
            if (dy > 90) { closeFn(); sh.style.transform = ''; }
            else sh.style.transform = '';
            dy = 0;
        };
        sh.addEventListener('touchend', end, { passive: true });
        sh.addEventListener('touchcancel', end, { passive: true });
    }
    swipeClose('bottomSheet', () => closeSheet());
    swipeClose('filterSheet', () => closeFilterSheet());
    const fc = document.querySelector('#formModal .modal-card'); if (fc) { fc.id = fc.id || 'formCard'; swipeClose(fc.id, () => requestCloseForm()); }

    // 2) زر الرجوع
    let exiting = false, asking = false;
    try { history.replaceState({ g: 0 }, ''); history.pushState({ g: 1 }, ''); } catch (e) { return; }
    function closeTopLayer() {
        if (window.Swal && Swal.isVisible && Swal.isVisible()) { Swal.close(); return true; }
        const z = document.getElementById('zoomModal');
        if (z && z.style.display && z.style.display !== 'none') { z.style.display = 'none'; return true; }
        const fm = document.getElementById('formModal');
        if (fm && fm.style.display === 'flex') { requestCloseForm(); return true; }
        const sb = document.getElementById('sheetBackdrop');
        if (sb && sb.classList.contains('open')) { closeSheet(); return true; }
        const fs = document.getElementById('filterSheet');
        if (fs && fs.classList.contains('open')) { closeFilterSheet(); return true; }
        return false;
    }
    window.addEventListener('popstate', async () => {
        if (exiting) return;
        try { history.pushState({ g: 1 }, ''); } catch (e) { /* تجاهل */ }
        if (closeTopLayer()) return;
        if (IS_ADMIN_PAGE && typeof currentView !== 'undefined' && !['home', 'login', 'splash'].includes(currentView)) {
            if (currentView === 'bill' && typeof bill !== 'undefined' && bill && bill.editing) { try { cancelInvoiceEdit(); } catch (e) { /* تجاهل */ } }
            showView('home'); return;
        }
        if (asking) return; asking = true;
        let ok = false;
        try { ok = (await Swal.fire({ icon: 'question', title: 'الخروج من التطبيق؟', showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'خروج', cancelButtonText: 'البقاء' })).isConfirmed; } catch (e) { /* تجاهل */ }
        asking = false;
        if (ok) { exiting = true; history.go(-2); }
    });
})();
