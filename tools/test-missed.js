// اختبار آلي لصفحة المطلوبة. التشغيل: python3 -m http.server 8765 ثم NODE_PATH=$(npm root -g) node tools/test-missed.js
const { chromium } = require('playwright');
let fails = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 220) : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto('http://localhost:8765/admin.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  let r = await p.evaluate(async () => {
    userRole = 'owner'; fmPer = 30; const today = todayLocalISO(), pr = products.filter(x => !x.arch).slice(0, 3); pr.forEach(x => { x.price = 10000; x.qty = 0; x.loose = 0; });
    const P = pr[0], P2 = pr[1], nm = dispName(P), day = n => sdAdd(today, -n);
    fmAll = [];
    const mk = (o, d) => Object.assign({ id: 'fm' + Math.random().toString(36).slice(2), type: 'miss', alt: 'none', date: day(d), ts: day(d) + 'T10:00:00Z', qty: 1 }, o);
    // same product: 2 with pid, 2 free text of exact catalog name (should unify), on 4 distinct days
    fmAll.push(mk({ pid: P.id, item: nm }, 1), mk({ pid: P.id, item: nm }, 2), mk({ pid: null, item: nm }, 3), mk({ pid: null, item: nm.toUpperCase() }, 5, ));
    // a free-text misspelling group + a twin to be detected as duplicates
    fmAll.push(mk({ pid: null, item: 'Zyloric tablet 100mg' }, 1), mk({ pid: null, item: 'Zyloric tablet 100 mg' }, 2), mk({ pid: null, item: "Dr's Cough o'clock" }, 1));
    fmAll.push(mk({ pid: P2.id, item: dispName(P2), qty: 3 }, 1));
    fmStore();
    const gs = fmGroups(), g = gs.find(x => x.key === 'p' + P.id);
    const html = fmStatsHtml();
    return { n: gs.length, g: g && { n: g.n, d: g.d, v: g.verdict[0], lost: g.lost }, hasSec: html.includes('يستحق التوفير'), pl: [fmPl(1, 'مرة واحدة', 'مرتين', 'مرات', 'مرة'), fmPl(2, 'مرة واحدة', 'مرتين', 'مرات', 'مرة'), fmPl(5, 'يوم واحد', 'يومين', 'أيام', 'يوماً'), fmPl(12, 'يوم واحد', 'يومين', 'أيام', 'يوماً')], dup: html.includes('أسماء قد تكون مكررة'), noOldPhrase: !html.includes('في 1 يوماً'), tiles: html.includes('fm-tiles'), inStock: isInStock(P) };
  });
  ok('A1 unify pid + free-text exact name into one group (4 requests/4 days -> يستحق)', r.g && r.g.n === 4 && r.g.d === 4 && r.g.v === 'يستحق التوفير', r);
  ok('A2 plurals MSA', r.pl.join('|') === 'مرة واحدة|مرتين|5 أيام|12 يوماً', r.pl);
  ok('A3 duplicate-name suggestions + summary tiles + sections', r.dup && r.tiles && r.hasSec && r.noOldPhrase);
  ok('A4 lost value = price x qty', r.g && r.g.lost === 40000, r.g);
  // apostrophe key opens detail
  r = await p.evaluate(async () => { const g = fmGroups().find(x => x.name.includes("o'clock")); fmDetail(g.key); await new Promise(r => setTimeout(r, 400)); const ok = !!document.querySelector('.swal2-popup .fu-det'); Swal.close(); const enc = fmEnc(g.key); return { ok, enc, dec: decodeURIComponent(enc) === g.key }; });
  ok('B1 apostrophe in name: detail opens + key round-trips', r.ok && r.dec, r);
  // trend arrow hidden under 3 requests
  r = await p.evaluate(() => { const h = fmStatsHtml(); const g = fmGroups().find(x => x.n === 1); return { has: !!g, html: h.includes('fu-av ') }; });
  ok('B2 render ok', r.has && r.html);
  // quick-entry suggestions: typing a near name suggests catalog + earlier wanted
  r = await p.evaluate(async () => {
    const P = products.filter(x => !x.arch)[0]; fmQuick(null, ''); await new Promise(r => setTimeout(r, 400));
    const inp = document.getElementById('fmItem'); inp.value = dispName(P).slice(0, 7); inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
    const n1 = document.querySelectorAll('#fmSug .cn-res').length;
    inp.value = 'Zyloric tablet 100mgg'; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
    const wanted = [...document.querySelectorAll('#fmSug .cn-res em')].some(e => e.textContent.includes('مطلوبة سابقاً'));
    // pick the catalog suggestion by typing the product name then selecting first result
    inp.value = dispName(P).slice(0, 7); inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
    document.querySelector('#fmSug .cn-res').click();
    document.querySelector('#fmWhy button[data-w="price"]').click(); document.getElementById('fmQty').value = '3'; document.getElementById('fmRx').checked = true;
    const picked = !!window.__fmPick;
    document.querySelector('.swal2-confirm').click(); await new Promise(r => setTimeout(r, 800));
    const rec = fmAll[0];
    return { n1, wanted, picked, rec: rec && { why: rec.reason, qty: rec.qty, rx: rec.rx, pid: rec.pid } };
  });
  ok('C1 catalog suggestions appear while typing', r.n1 > 0, r);
  ok('C2 earlier free-text wanted names suggested (misspelling)', r.wanted);
  ok('C3 saved record carries pid from catalog + reason + qty + rx', r.picked && r.rec && r.rec.why === 'price' && r.rec.qty === 3 && r.rec.rx === true && r.rec.pid, r.rec);
  // near-duplicate warning blocks first save of unpicked similar text
  r = await p.evaluate(async () => {
    fmQuick(null, ''); await new Promise(r => setTimeout(r, 400)); const inp = document.getElementById('fmItem'); inp.value = 'Zyloric tablet 100mgg'; inp.dispatchEvent(new Event('input')); await new Promise(r => setTimeout(r, 200));
    document.querySelector('.swal2-confirm').click(); await new Promise(r => setTimeout(r, 400)); const warn = (document.querySelector('.swal2-validation-message') || {}).textContent || '', still = !!document.querySelector('.swal2-popup .fm-q');
    document.querySelector('.swal2-confirm').click(); await new Promise(r => setTimeout(r, 800)); return { warn: warn.slice(0, 40), still, saved: fmAll.some(x => x.item === 'Zyloric tablet 100mgg') };
  });
  ok('C4 similar-name warning first, saves on second press', r.still && r.warn.length > 0 && r.saved, r);
  // merge by link
  r = await p.evaluate(async () => {
    const P = products.filter(x => !x.arch)[2], gz = fmGroups().filter(x => !x.pid && x.name.startsWith('Zyloric')), before = fmGroups().length;
    for (const g of gz) await fmApplyMerge(g.key, P.id, dispName(P)); const after = fmGroups(), g2 = after.find(x => x.key === 'p' + P.id);
    return { before, after: after.length, merged: g2 && g2.n, aliasKeep: Object.keys(fmAliases()).length };
  });
  ok('D1 merge links names to catalog item (groups reduce, aliases saved)', r.after < r.before && r.merged >= 3 && r.aliasKeep > 0, r);
  // future entries of aliased text unify
  r = await p.evaluate(() => { const P = products.filter(x => !x.arch)[2]; return fmCanon({ item: 'Zyloric tablet 100mg' }).key === 'p' + P.id; });
  ok('D2 alias applies to future free-text entries', r);
  // order list
  r = await p.evaluate(() => { const P = products.filter(x => !x.arch)[0]; const okk = fmToOrder('p' + P.id, true); return { okk, extra: ndState().extra.includes(P.id) }; });
  ok('E1 add to order list', r.okk && r.extra, r);
  r = await p.evaluate(() => { const okk = fmToOrder(fmGroups().find(x => !x.pid).key, true); return { okk, c: ndState().custom.length }; });
  ok('E2 uncatalogued item added as custom order line', r.okk && r.c > 0, r);
  // trial evaluation
  r = await p.evaluate(() => {
    const P = products.filter(x => !x.arch)[1], today = todayLocalISO(); const t = { id: 'trT', key: 'p' + P.id, pid: P.id, name: dispName(P), start: sdAdd(today, -31), base: 2 };
    billAll = [{ id: 'b1', issued: true, date: sdAdd(today, -10), items: [{ pid: P.id, qty: 3, unit: 'box' }] }, { id: 'b2', issued: true, cancelled: true, date: sdAdd(today, -9), items: [{ pid: P.id, qty: 9 }] }, { id: 'b3', issued: true, date: sdAdd(today, -40), items: [{ pid: P.id, qty: 9 }] }];
    const a = fmTrialStat(t), t2 = { ...t, start: sdAdd(today, -5), base: 2 }, b = fmTrialStat(t2); fmTrialsSave([t2]); const h = fmStatsHtml();
    return { a: [a.sold, a.v[0]], b: [b.sold, b.v[0]], shown: h.includes('قيد التجربة') };
  });
  ok('F1 trial: counts only valid sales after start (3), verdict نجحت after 30d', r.a[0] === 3 && r.a[1] === 'نجحت' && r.b[1] === 'جارية' && r.shown, r);
  // needs estimation still runs with canonical miss
  r = await p.evaluate(() => { try { const c = ndmCalc(); return { ok: true, rows: c.rows.length }; } catch (e) { return { ok: false, e: String(e) }; } });
  ok('G1 needs estimation still works with new miss records', r.ok, r);
  // persistence: BigStore holds diwanMissed
  await p.waitForTimeout(700); await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
  r = await p.evaluate(() => ({ n: fmLocal().length, ls: localStorage.getItem('diwanMissed') }));
  ok('H1 missed requests persist in IndexedDB (no 4000 cap, out of localStorage)', r.n >= 8 && !r.ls, r);
  console.log('page errors:', errs.length, errs.slice(0, 4)); await b.close(); process.exit(fails ? 1 : 0);
})();
