#!/usr/bin/env node
// يشغّل صفحة الويب الأصلية محلياً (بدون سحابة) بنفس بيانات seed_products.json ويلتقط لقطات مرجعية
// للمقارنة البصرية مع تطبيق Flutter:  node tools/parity/web_shots.js <outDir> [screens...]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..');
const out = process.argv[2] || path.join(root, 'docs', 'parity', 'web');
const only = process.argv.slice(3);
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_products.json'), 'utf8'));
const stub = fs.readFileSync(path.join(__dirname, 'firebase_stub.js'), 'utf8');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, u === '/' ? 'admin.html' : u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + '/admin.html';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, locale: 'ar', serviceWorkers: 'block' });
  await ctx.addInitScript(({ seed }) => {
    window.__SEED__ = seed;
    try { localStorage.setItem('diwanHadSess', 'owner'); localStorage.setItem('diwanTheme', window.__THEME__ || 'light'); localStorage.setItem('diwanProducts', JSON.stringify(seed)); } catch (e) {}
  }, { seed });
  await ctx.route('**/*firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('app-compat') ? stub : '' }));
  await ctx.route('**/sweetalert2**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Swal={fire:()=>Promise.resolve({isConfirmed:false}),mixin:()=>window.Swal,close(){},isVisible:()=>false};' }));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message.slice(0, 160)));
  await page.goto(base); await page.waitForTimeout(2500);
  const shot = async n => { if (only.length && !only.includes(n)) return; await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, n + '.png') }); console.log('shot', n); };
  await shot('home');
  await page.evaluate(() => showView('stock')); await page.waitForTimeout(800); await shot('stock');
  await page.evaluate(() => openSheet(8)); await page.waitForTimeout(600); await shot('sheet');
  await page.evaluate(() => closeSheet());
  await page.evaluate(() => openFilterSheet()); await page.waitForTimeout(600); await shot('filter');
  await page.evaluate(() => closeFilterSheet());
  await page.evaluate(() => goAlerts('all')); await page.waitForTimeout(800); await shot('alerts');
  await page.evaluate(() => { try { goHome && showView('home'); } catch (e) {} });
  await page.evaluate(() => { scGo(); }); await page.waitForTimeout(900); await shot('scan_cam');
  await page.evaluate(() => { try { closeBarcodeScanner(); } catch (e) {} scClose && scClose(); });
  await page.evaluate(() => { scInit(); scPick(8); }); await page.waitForTimeout(900); await shot('scan_card');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
