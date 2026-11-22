// برنامج صيدلية الديوان لسطح المكتب: نافذة تفتح التطبيق نفسه (نفس بيانات فايربيس ونفس الموبايل)
// + تخزين مستقل عن المتصفح (مجلد البرنامج) + نسخ احتياطية كاملة على قرص الحاسبة.
const { app, BrowserWindow, ipcMain, Menu, shell, dialog, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const { createHub } = require('./lanhub');

const DEFAULT_URL = 'https://basracliniciansapps.github.io/Al-Diwan-Pharmacy/admin.html';   // الحروف الكبيرة مهمة في مسار GitHub Pages
let APP_URL = DEFAULT_URL;
let APP_ORIGIN = new URL(APP_URL).origin;
const KEEP_DAILY = 30;                       // عدد النسخ اليومية المحفوظة
const AUTH_HOSTS = ['accounts.google.com', 'firebaseapp.com', 'googleapis.com', 'gstatic.com'];

if (!app.requestSingleInstanceLock()) { app.quit(); }

// ملفات تبادل واتساب (.dwsync): تُفتح بالنقر المزدوج، فيستوردها التطبيق بمعاينة (حتى 12 ميغابايت)
let pendingFile = null;
function fileFromArgv(argv) {
    try {
        const a = (argv || []).find(x => typeof x === 'string' && /\.dwsync$/i.test(x)); if (!a) return null;
        const st = fs.statSync(a); if (!st.isFile() || st.size > 12 * 1024 * 1024) return null;
        return fs.readFileSync(a, 'utf8');
    } catch (e) { return null; }
}
function deliverFile(t) { if (!t) return; pendingFile = t; try { if (win) win.webContents.send('diwan:fileReady'); } catch (e) { /* تجاهل */ } }
ipcMain.handle('diwan:takeFile', () => { const t = pendingFile; pendingFile = null; return t; });
pendingFile = fileFromArgv(process.argv);

let win = null;
const cfgFile = () => path.join(app.getPath('userData'), 'desktop-config.json');
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) || {}; } catch (e) { return {}; } }
function writeCfg(c) { try { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c)); } catch (e) { /* تجاهل */ } }
function backupDir() {
    const c = readCfg();
    const d = c.backupDir || path.join(app.getPath('documents'), 'Diwan-Backup');
    fs.mkdirSync(d, { recursive: true });
    return d;
}
const pad = n => String(n).padStart(2, '0');
const dayStamp = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function atomicWrite(file, text) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);     // الكتابة عبر ملف مؤقت: لا يتلف الملف إن انقطعت الكهرباء أثناء الحفظ
}
function pruneDaily(dir) {
    try {
        const list = fs.readdirSync(dir).filter(f => /^diwan-full-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
        list.slice(0, Math.max(0, list.length - KEEP_DAILY)).forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* تجاهل */ } });
    } catch (e) { /* تجاهل */ }
}

ipcMain.handle('diwan:writeBackup', (_e, text) => {
    try {
        if (typeof text !== 'string' || text.length < 20 || text.length > 400 * 1024 * 1024) return { ok: false, error: 'بيانات غير صالحة' };
        JSON.parse(text);   // لا نكتب فوق نسخة سليمة بنسخة تالفة
        const dir = backupDir();
        atomicWrite(path.join(dir, 'diwan-latest.json'), text);
        atomicWrite(path.join(dir, 'diwan-full-backup-' + dayStamp() + '.json'), text);   // نسخة اليوم تُحدَّث طوال اليوم
        pruneDaily(dir);
        const c = readCfg(); c.lastBackupTs = Date.now(); writeCfg(c);
        return { ok: true, dir, ts: c.lastBackupTs, bytes: text.length };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});
ipcMain.handle('diwan:backupInfo', () => { try { const c = readCfg(); return { dir: backupDir(), ts: c.lastBackupTs || 0, keepDaily: KEEP_DAILY }; } catch (e) { return { dir: '', ts: 0 }; } });
ipcMain.handle('diwan:chooseBackupDir', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'اختر مجلد النسخ الاحتياطية', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    const c = readCfg(); c.backupDir = r.filePaths[0]; writeCfg(c);
    return { ok: true, dir: r.filePaths[0] };
});
ipcMain.handle('diwan:openBackupDir', async () => { try { await shell.openPath(backupDir()); return true; } catch (e) { return false; } });

// ---- المزامنة عبر الشبكة المحلية (خيار إضافي؛ لا يتعارض مع فايربيس) ----
let hub = null, hubPort = 0;
async function lanStart() {
    if (hub) return;
    try {
        hub = createHub({ dir: path.join(app.getPath('userData'), 'lan'), name: require('os').hostname(), onChange: () => { try { win && win.webContents.send('diwan:lan:changed'); } catch (e) { /* تجاهل */ } } });
        hubPort = await hub.start(8765);
        try { if (psb === null) psb = powerSaveBlocker.start('prevent-app-suspension'); } catch (e) { /* تجاهل */ }   // الحاسوب لا ينام ما دام يستقبل من الهواتف
    } catch (e) { hub = null; hubPort = 0; throw e; }
}
let psb = null;
async function lanStop() { try { if (psb !== null) { powerSaveBlocker.stop(psb); psb = null; } } catch (e) { /* تجاهل */ } if (!hub) return; const h = hub; hub = null; hubPort = 0; await h.stop(); }
const lanInfo = () => hub ? Object.assign({ on: true }, hub.info()) : { on: false };
ipcMain.handle('diwan:lan:info', () => lanInfo());
ipcMain.handle('diwan:lan:enable', async (_e, on) => {
    try { if (on) await lanStart(); else await lanStop(); const c = readCfg(); c.lanOn = !!on; writeCfg(c); return lanInfo(); }
    catch (e) { return { on: false, error: String(e && e.message || e) }; }
});
ipcMain.handle('diwan:lan:code', (_e, role) => { if (!hub) return { on: false }; hub.newCode(role); return lanInfo(); });
ipcMain.handle('diwan:lan:pending', () => hub ? hub.pending() : []);
ipcMain.handle('diwan:lan:mark', (_e, ids, status) => { if (hub && Array.isArray(ids) && (status === 'applied' || status === 'rejected')) hub.mark(ids.map(String), status); return lanInfo(); });
ipcMain.handle('diwan:lan:local', (_e, list) => (hub && Array.isArray(list) ? hub.addLocal(list) : 0));
ipcMain.handle('diwan:version', () => app.getVersion());
ipcMain.handle('diwan:lan:digests', () => (hub ? hub.takeDigests() : {}));
ipcMain.handle('diwan:autostart:get', () => { try { return !!app.getLoginItemSettings().openAtLogin; } catch (e) { return false; } });
ipcMain.handle('diwan:autostart:set', (_e, on) => { try { app.setLoginItemSettings({ openAtLogin: !!on }); } catch (e) { /* تجاهل */ } return !!app.getLoginItemSettings().openAtLogin; });
ipcMain.handle('diwan:lan:need', (_e, id, on) => { if (hub) hub.setNeed(String(id), !!on); return true; });
ipcMain.handle('diwan:lan:forget', (_e, id) => { if (hub) hub.forget(String(id)); return lanInfo(); });

function sameApp(u) { try { return new URL(u).origin === APP_ORIGIN; } catch (e) { return false; } }
function authHost(u) { try { const h = new URL(u).hostname; return AUTH_HOSTS.some(x => h === x || h.endsWith('.' + x)); } catch (e) { return false; } }

function loadAppUrl() {   // يمكن تغيير العنوان من desktop-config.json (المفتاح appUrl) دون إعادة بناء البرنامج
    try { const u = readCfg().appUrl; if (typeof u === 'string' && /^https:\/\//i.test(u)) { APP_URL = u; APP_ORIGIN = new URL(u).origin; } } catch (e) { /* تجاهل */ }
}
function createWindow() {
    loadAppUrl();
    win = new BrowserWindow({
        width: (readCfg().bounds || {}).width || 1366, height: (readCfg().bounds || {}).height || 860, x: (readCfg().bounds || {}).x, y: (readCfg().bounds || {}).y, minWidth: 1100, minHeight: 680,
        title: 'صيدلية الديوان', backgroundColor: '#0f1c38', show: false, autoHideMenuBar: true,
        icon: path.join(__dirname, 'build', 'icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
    });
    win.once('ready-to-show', () => win.show());
    win.setMenu(null);
    win.webContents.setZoomFactor(1);
    win.webContents.on('before-input-event', (e, input) => {   // لا تكبير بالضغط على Ctrl وعجلة الفأرة (الصفحات ثابتة)
        if ((input.control || input.meta) && ['+', '-', '=', '0'].includes(input.key)) e.preventDefault();
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (sameApp(url) || authHost(url)) return { action: 'allow' };   // نوافذ تسجيل الدخول وما شابه
        if (/^https?:/i.test(url)) shell.openExternal(url);              // أي رابط خارجي يفتح في المتصفح
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
        if (!sameApp(url) && !authHost(url) && !url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
        if (!isMain || code === -3) return;   // -3 = إلغاء التحميل
        win.loadFile(path.join(__dirname, 'offline.html'), { query: { u: APP_URL } });
    });
    win.webContents.on('did-navigate', (_e, url, code) => {   // صفحة 404 من الموقع: عرض صفحة الخطأ بدل صفحة GitHub
        if (code === 404 && sameApp(url)) win.loadFile(path.join(__dirname, 'offline.html'), { query: { u: APP_URL } });
    });
    let bt = null; const saveB = () => { clearTimeout(bt); bt = setTimeout(() => { try { if (win && !win.isMinimized() && !win.isMaximized()) { const c = readCfg(); c.bounds = win.getBounds(); writeCfg(c); } } catch (e) { /* تجاهل */ } }, 600); };
    win.on('resize', saveB); win.on('move', saveB);
    win.loadURL(APP_URL);
    win.on('closed', () => { win = null; });
}

app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } deliverFile(fileFromArgv(argv)); });
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); if (readCfg().lanOn) lanStart().catch(() => { /* المنفذ مشغول أو الجدار الناري: يظهر الخطأ عند فتح الإعداد */ }); });
app.on('window-all-closed', () => app.quit());
