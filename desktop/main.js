// برنامج صيدلية الديوان لسطح المكتب: نافذة تفتح التطبيق نفسه (نفس بيانات فايربيس ونفس الموبايل)
// + تخزين مستقل عن المتصفح (مجلد البرنامج) + نسخ احتياطية كاملة على قرص الحاسبة.
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_URL = 'https://basracliniciansapps.github.io/Al-Diwan-Pharmacy/admin.html';   // الحروف الكبيرة مهمة في مسار GitHub Pages
let APP_URL = DEFAULT_URL;
let APP_ORIGIN = new URL(APP_URL).origin;
const KEEP_DAILY = 30;                       // عدد النسخ اليومية المحفوظة
const AUTH_HOSTS = ['accounts.google.com', 'firebaseapp.com', 'googleapis.com', 'gstatic.com'];

if (!app.requestSingleInstanceLock()) { app.quit(); }

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

function sameApp(u) { try { return new URL(u).origin === APP_ORIGIN; } catch (e) { return false; } }
function authHost(u) { try { const h = new URL(u).hostname; return AUTH_HOSTS.some(x => h === x || h.endsWith('.' + x)); } catch (e) { return false; } }

function loadAppUrl() {   // يمكن تغيير العنوان من desktop-config.json (المفتاح appUrl) دون إعادة بناء البرنامج
    try { const u = readCfg().appUrl; if (typeof u === 'string' && /^https:\/\//i.test(u)) { APP_URL = u; APP_ORIGIN = new URL(u).origin; } } catch (e) { /* تجاهل */ }
}
function createWindow() {
    loadAppUrl();
    win = new BrowserWindow({
        width: 1366, height: 860, minWidth: 900, minHeight: 600,
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
    win.loadURL(APP_URL);
    win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => app.quit());
