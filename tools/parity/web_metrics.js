#!/usr/bin/env node
// يستخرج أبعاد وأنماط عناصر الويب (من المتصفح) كمرجع دقيق للبناء: node tools/parity/web_metrics.js <view> <js-to-open> <selectors-json>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', '..');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_products.json'), 'utf8'));
const stub = fs.readFileSync(path.join(__dirname, 'firebase_stub.js'), 'utf8');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(root, u === '/' ? 'admin.html' : u); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  const [open, sels] = [process.argv[2], JSON.parse(process.argv[3])];
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  await ctx.addInitScript(({ seed }) => { window.__SEED__ = seed; localStorage.setItem('diwanHadSess', 'owner'); localStorage.setItem('diwanTheme', 'light'); localStorage.setItem('diwanProducts', JSON.stringify(seed)); }, { seed });
  await ctx.route('**/*firebasejs/**', r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('app-compat') ? stub : '' }));
  await ctx.route('**/sweetalert2**', r => r.fulfill({ contentType: 'text/javascript', body: 'window.Swal={fire:()=>Promise.resolve({}),mixin:()=>window.Swal,close(){},isVisible:()=>false};' }));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const page = await ctx.newPage(); await page.goto('http://localhost:' + srv.address().port + '/admin.html'); await page.waitForTimeout(2200);
  if (open) { await page.evaluate(open); await page.waitForTimeout(900); }
  const res = await page.evaluate(sels => sels.map(s => { const e = document.querySelector(s); if (!e) return { s, missing: true }; const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return { s, x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), font: c.fontSize + ' ' + c.fontWeight + ' ' + c.fontFamily.split(',')[0], color: c.color, bg: c.backgroundColor + (c.backgroundImage !== 'none' ? ' | ' + c.backgroundImage.slice(0, 90) : ''), rad: c.borderRadius, bd: c.border.slice(0, 40), pad: c.padding, shadow: c.boxShadow.slice(0, 70), text: (e.innerText || '').slice(0, 30).replace(/\n/g, '/') }; }), sels);
  console.log(JSON.stringify(res, null, 0).replace(/\},\{/g, '},\n{'));
  await browser.close(); srv.close();
})();
