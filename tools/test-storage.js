// اختبار آلي للتخزين المحلي (IndexedDB). التشغيل: python3 -m http.server 8765 ثم NODE_PATH=$(npm root -g) node tools/test-storage.js
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/admin.html';
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x) : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  // T1: legacy data in localStorage (as on a real phone before this update)
  await p.evaluate(() => {
    const mk = (n, f) => JSON.stringify(Array.from({ length: n }, (_, i) => f(i)));
    localStorage.setItem('diwanPurchasesLocal', mk(2500, i => ({ id: 'p' + i, supplier: 'S' + (i % 50), no: 'N' + i, date: '2026-01-' + String(1 + i % 28).padStart(2, '0'), createdTs: 'x' + i, items: [{ n: 'item', qty: 1, cost: 1000 }] })));
    localStorage.setItem('diwanLedgerLocal', mk(4000, i => ({ id: 'l' + i, kind: 'pay', amount: i, upd: 'u' + i })));
    localStorage.setItem('diwanSuppliers', mk(600, i => ({ id: 's' + i, name: 'Sup' + i })));
  });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  let r = await p.evaluate(async () => ({ ready: BigStore.isReady(), failed: BigStore.isFailed(), pu: puLocalList().length, lg: lgLocal().length, sup: JSON.parse(lsGet(PU_LS.sup)).length, lsP: localStorage.getItem('diwanPurchasesLocal'), lsL: localStorage.getItem('diwanLedgerLocal'), lsS: localStorage.getItem('diwanSuppliers') }));
  ok('T1 migrated without cap (2500/4000/600) and cleared localStorage', r.ready && !r.failed && r.pu === 2500 && r.lg === 4000 && r.sup === 600 && !r.lsP && !r.lsL && !r.lsS, r);
  // T2: restart again -> data comes from IndexedDB only
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  r = await p.evaluate(() => ({ pu: puLocalList().length, lg: lgLocal().length, lsP: localStorage.getItem('diwanPurchasesLocal') }));
  ok('T2 persisted across restart from IndexedDB', r.pu === 2500 && r.lg === 4000 && !r.lsP, r);
  // T3: write new ledger entry + purchase, restart, still there; no 1500 cap
  await p.evaluate(async () => { userRole = 'owner'; await lgLoad(); await lgSave({ id: 'lgNEW', kind: 'pay', amount: 5 }); puAll = puLocalList(); await puSaveRecord({ id: 'puNEW', supplier: 'Z', no: 'ZZ', date: '2026-02-01', createdTs: 'zz', items: [] }); });
  await p.waitForTimeout(900);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  r = await p.evaluate(() => ({ lg: lgLocal().some(x => x.id === 'lgNEW'), lgN: lgLocal().length, pu: puLocalList().some(x => x.id === 'puNEW'), puN: puLocalList().length }));
  ok('T3 new records survive restart, no cap', r.lg && r.pu && r.puN === 2501 && r.lgN === 4001, r);
  // T4: 1200 invoices into IndexedDB, restart, all present
  await p.evaluate(async () => {
    userRole = 'owner'; await invDbLoad();
    billAll = Array.from({ length: 1200 }, (_, i) => ({ id: 'inv' + i, no: String(i + 1), date: '2026-10-' + String(1 + i % 28).padStart(2, '0'), issued: true, issuedTs: '2026-10-01T10:' + String(i % 60).padStart(2, '0') + ':' + String(Math.floor(i / 60)).padStart(2, '0'), issuedAt: 'x', items: [{ n: 'a', q: 1, price: 1000 }], total: 1000 }));
    window.__saved = await InvDB.save();
  });
  await p.waitForTimeout(500);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  r = await p.evaluate(async () => { userRole = 'owner'; InvDB.isLoaded(); const n = await InvDB.load(); return { n, bill: billAll.length }; });
  ok('T4 1200 invoices persisted + loaded (no 300 cap)', r.n === 1200 && r.bill >= 1200, r);
  // T5: explicit delete persists
  await p.evaluate(async () => { await InvDB.del('inv5'); billAll = billAll.filter(x => x.id !== 'inv5'); });
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
  r = await p.evaluate(async () => { userRole = 'owner'; const n = await InvDB.load(); return { n, has5: billAll.some(x => x.id === 'inv5') }; });
  ok('T5 deleted invoice stays deleted', r.n === 1199 && !r.has5, r);
  // T6: products mirror survives localStorage loss
  await p.evaluate(async () => { products = JSON.parse(JSON.stringify(defaultProducts)).slice(0, 7).concat([{ id: 'zz-test', name: 'MIRROR-TEST', price: 1 }]); flushProductsLocal(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => localStorage.removeItem('diwanProducts'));
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  r = await p.evaluate(() => ({ has: products.some(x => x.id === 'zz-test'), n: products.length, def: defaultProducts.length }));
  ok('T6 products restored from IndexedDB mirror when localStorage lost them', r.has, r);
  // T7: localStorage completely full -> big lists still save (IndexedDB), nothing lost
  await p.evaluate(() => { try { const f = 'x'.repeat(1024 * 256); for (let i = 0; i < 100; i++) localStorage.setItem('fill' + i, f); } catch (e) { } });
  await p.evaluate(async () => { await lgLoad(); await lgSave({ id: 'lgFULL', kind: 'pay', amount: 9 }); });
  await p.waitForTimeout(800);
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  r = await p.evaluate(() => ({ has: lgLocal().some(x => x.id === 'lgFULL'), n: lgLocal().length }));
  ok('T7 saved even with localStorage full', r.has, r);
  // T8: diagnostics
  r = await p.evaluate(() => BigStore.diag());
  ok('T8 diagnostics available', r.usage > 0 && r.quota > 0 && r.lsBytes > 0, { usageMB: (r.usage / 1048576).toFixed(1), lsMB: (r.lsBytes / 1048576).toFixed(1), persisted: r.persisted });
  // T9: speed of loading everything from IndexedDB at startup
  const t0 = Date.now(); await p.reload({ waitUntil: 'domcontentloaded' }); await p.evaluate(async () => { await window.bigReady; userRole = 'owner'; await InvDB.load(); }); const dt = Date.now() - t0;
  ok('T9 cold start incl. 1199 invoices + 2501 purchases + 4002 ledger < 4s', dt < 4000, dt + 'ms');
  console.log('page errors:', errs.length, errs.slice(0, 3));
  await b.close(); process.exit(fails ? 1 : 0);
})();
