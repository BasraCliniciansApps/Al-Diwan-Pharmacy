/* =====================================================
   صيدلية الديوان — Service Worker (العمل بدون إنترنت)
   - ملفات التطبيق: الشبكة أولاً (تصلك التحديثات فوراً) ثم الكاش عند انقطاع الإنترنت
   - المكتبات والخطوط: من الكاش أولاً مع تحديث بالخلفية
   - صور المنتجات: من الكاش أولاً
   - طلبات Firebase وGitHub API لا يتدخل فيها أبداً
   لإجبار كل الأجهزة على تحديث الكاش: غيّر رقم VERSION
   ===================================================== */
const VERSION = 'diwan-v507';
const SHELL_CACHE = VERSION + '-shell';
const LIB_CACHE = VERSION + '-lib';
const IMG_CACHE = VERSION + '-img';
const MAX_IMAGES = 600;
const NETWORK_TIMEOUT_MS = 1500;      // يوجد نسخة بالكاش: لا ننتظر الشبكة أكثر من هذا
const NETWORK_TIMEOUT_NOCACHE_MS = 12000; // لا توجد نسخة: ننتظر أطول

const SHELL_FILES = ['./style.css', './prog.js', './data.js', './icons.js', './swal-skin.js', './seed.js', './admin.html', './invoice.js', './sellpop.js', './quickinv.js', './pos.js', './formsmgr.js', './pricelist.js', './purchase-xlsx.js', './desktop.js', './vendor/html-to-image.js', './vendor/pdf-lib.min.js', './purchase.js', './purchase2.js', './ledger.js', './ledger2.js', './ledger3.js', './ledger4.js', './ledger5.js', './blink.js', './unify.js', './catalog.js', './taxmap.js', './taxonomy.js', './datahub.js', './docpage.js', './rxprint.js', './fonts/ArefRuqaa-Bold.ttf', './fonts/aref-ruqaa-arabic-700-normal.woff2', './fonts/aref-ruqaa-latin-700-normal.woff2', './fonts/tajawal-arabic-400-normal.woff2', './fonts/tajawal-latin-400-normal.woff2', './fonts/tajawal-arabic-500-normal.woff2', './fonts/tajawal-latin-500-normal.woff2', './fonts/tajawal-arabic-700-normal.woff2', './fonts/tajawal-latin-700-normal.woff2', './fonts/tajawal-arabic-800-normal.woff2', './fonts/tajawal-latin-800-normal.woff2', './taxfilter.js', './rx.js', './doctor.html', './navtabs.js', './count.js', './customers.js', './formtabs.js', './expenses.js', './smartpo.js', './native.js', './recon.js', './homeplus.js', './bidi.js', './quick.js', './learn.js', './settings.js', './sselect.js', './scanner.js', './formsec.js', './security.js', './backup.js', './admin.js', './progsave.js', './pricefix.js', './labels.js', './help.js', './manifest-admin.json', './icon.jpg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

const CDN_FILES = [
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
];

const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&family=Tajawal:wght@400;500;700;800&display=swap';

// المواقع التي يتعامل معها الـ Service Worker (غيرها يمر مباشرة للشبكة)
const LIB_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tessdata.projectnaptha.com'];
const IMG_HOSTS = ['raw.githubusercontent.com'];

async function putIfOk(cacheName, request, response) {
    if (response && response.status === 200) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
    }
    return response;
}

// جلب بصيغة CORS حتى لا تكون الاستجابة "opaque" (لأن opaque تستهلك مساحة كبيرة جداً من الكاش)
function corsFetch(url) {
    return fetch(new Request(url, { mode: 'cors', credentials: 'omit' }));
}

async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
        await Promise.all(keys.slice(0, keys.length - maxItems).map(k => cache.delete(k)));
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shell = await caches.open(SHELL_CACHE);
        await Promise.allSettled(SHELL_FILES.map(async (f) => {
            const res = await fetch(f, { cache: 'reload' });
            if (res.status === 200) await shell.put(f, res);
        }));

        const lib = await caches.open(LIB_CACHE);
        await Promise.allSettled(CDN_FILES.map(async (u) => {
            const res = await corsFetch(u);
            if (res.status === 200) await lib.put(u, res);
        }));

        // الخطوط: نحفظ ملف الـ CSS وملفات الخط التي يشير إليها
        try {
            const cssRes = await corsFetch(FONTS_CSS);
            if (cssRes.status === 200) {
                const cssText = await cssRes.clone().text();
                await lib.put(FONTS_CSS, cssRes);
                const fontUrls = [...cssText.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
                await Promise.allSettled(fontUrls.map(async (u) => {
                    const r = await corsFetch(u);
                    if (r.status === 200) await lib.put(u, r);
                }));
            }
        } catch (e) { /* الخطوط اختيارية */ }

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(n => !n.startsWith(VERSION)).map(n => caches.delete(n)));
        await self.clients.claim();
    })());
});

// الشبكة أولاً مع مهلة، ثم الكاش
async function networkFirst(request, cacheName, cacheKey) {
    const key = cacheKey || request;
    try {
        const had = await caches.match(key, { ignoreSearch: request.mode === 'navigate' });
        const ms = had ? NETWORK_TIMEOUT_MS : NETWORK_TIMEOUT_NOCACHE_MS;
        const net = fetch(request);
        net.then(r => putIfOk(cacheName, key, r)).catch(() => {});   // يكمل التحديث بالخلفية حتى لو تجاوز المهلة
        const res = await Promise.race([
            net,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
        ]);
        return res;
    } catch (err) {
        const cached = await caches.match(key, { ignoreSearch: request.mode === 'navigate' });
        if (cached) return cached;
        throw err;
    }
}

// الكاش أولاً مع تحديث بالخلفية (للمكتبات والخطوط)
async function staleWhileRevalidate(request, cacheName) {
    const cached = await caches.match(request.url);
    const update = corsFetch(request.url)
        .then(res => putIfOk(cacheName, request.url, res))
        .catch(() => null);
    if (cached) { update.catch(() => {}); return cached; }
    const fresh = await update;
    return fresh || fetch(request);
}

// الكاش أولاً (للصور)
async function cacheFirstImage(request) {
    const cached = await caches.match(request.url);
    if (cached) return cached;
    try {
        const sameOrigin = new URL(request.url).origin === self.location.origin;
        const res = sameOrigin ? await fetch(request) : await corsFetch(request.url);
        if (res.status === 200) {
            await putIfOk(IMG_CACHE, request.url, res);
            trimCache(IMG_CACHE, MAX_IMAGES);
        }
        return res;
    } catch (err) {
        return fetch(request);   // آخر محاولة (قد تكون opaque ولا تُحفظ)
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;

    // صفحة التطبيق (بما فيها روابط المشاركة ?product=...)
    if (req.mode === 'navigate' && sameOrigin) {
        event.respondWith((async () => {
            try {
                return await networkFirst(req, SHELL_CACHE, './admin.html');
            } catch (e) {
                const fallback = await caches.match('./admin.html', { ignoreSearch: true });
                return fallback || Response.error();
            }
        })());
        return;
    }

    if (sameOrigin) {
        const isImage = req.destination === 'image' || /\.(jpe?g|png|webp|gif|svg)$/i.test(url.pathname);
        event.respondWith(isImage ? cacheFirstImage(req) : networkFirst(req, SHELL_CACHE));
        return;
    }

    if (IMG_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirstImage(req));
        return;
    }

    // سكربتات reCAPTCHA (لـ App Check) تمر مباشرة: لا نخزّنها حتى لا تتقادم
    if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/recaptcha') === 0) return;

    if (LIB_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(req, LIB_CACHE));
        return;
    }
    // أي موقع آخر (Firebase, GitHub API ...) يمر مباشرة بدون تدخل
});
