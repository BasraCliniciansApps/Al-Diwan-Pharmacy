// اختبار: ظهور أجزاء المادة في قائمة الجرد بعد تعديلها. التشغيل: python3 -m http.server 8765 ثم NODE_PATH=$(npm root -g) node tools/test-count-parts.js
const { chromium } = require('playwright');
let fails=0; const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?'  '+JSON.stringify(x):''));if(!c)fails++;};
(async () => { const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs=[]; p.on('pageerror', e => errs.push(String(e).slice(0,200)));
  await p.goto('http://localhost:8765/admin.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  const r = await p.evaluate(async () => {
    userRole='owner'; const P = products.find(x => !x.arch && !hasRetail(x)); P.qty = 10; P.loose = 0; delete P.sellMode;
    cnListRender = () => {}; cnOpenFlag = true; cnScr = 'list';
    cnCur = { id: 'cl1', name: 't', rows: [{ id: 'r1', gid: '', pid: P.id, unit: 'pack', cnt: '10', price: 1, ts: 1 }], upd: '', apply: true }; cnLists = [cnCur];
    const out = {};
    // 1) تفعيل التجزئة + 3 أجزاء مفتوحة من نموذج «مفصل»، ثم وصول تحديث المواد
    P.subCount = 4; P.subType = 'قرص'; P.subPrice = 500; P.loose = 3; cnLiveSync();
    out.a = cnCur.rows.map(r => r.unit + ':' + r.cnt);
    // 2) تعديل الأجزاء لاحقاً 3 -> 2
    P.loose = 2; cnLiveSync(); out.b = cnCur.rows.map(r => r.unit + ':' + r.cnt);
    // 3) مادة مجرودة، تفعيل التجزئة بدون أجزاء (0)، ثم إضافة أجزاء لاحقاً
    const P2 = products.find(x => !x.arch && !hasRetail(x) && x.id !== P.id); P2.qty = 5; P2.loose = 0; delete P2.sellMode;
    cnCur.rows.push({ id: 'r2', gid: '', pid: P2.id, unit: 'pack', cnt: '5', price: 1, ts: 2 });
    P2.subCount = 6; P2.subType = 'قرص'; P2.subPrice = 300; cnLiveSync(); out.c1 = cnCur.rows.filter(r => r.pid === P2.id).map(r => r.unit + ':' + JSON.stringify(r.cnt));
    P2.loose = 4; cnLiveSync(); out.c2 = cnCur.rows.filter(r => r.pid === P2.id).map(r => r.unit + ':' + r.cnt);
    // 4) مادة غير مجرودة (سطرها فارغ): لا يُملأ شيء تلقائياً
    const P3 = products.find(x => !x.arch && !hasRetail(x) && x.id !== P.id && x.id !== P2.id); P3.qty = 7; P3.loose = 0; delete P3.sellMode;
    cnCur.rows.push({ id: 'r3', gid: '', pid: P3.id, unit: 'pack', cnt: '', price: 1, ts: 3 });
    P3.subCount = 5; P3.subType = 'قرص'; P3.subPrice = 200; P3.loose = 2; cnLiveSync(); out.d = cnCur.rows.filter(r => r.pid === P3.id).map(r => r.unit + ':' + JSON.stringify(r.cnt));
    return out; });
  console.log(JSON.stringify(r));
  ok('1 part row appears with the saved loose count', r.a.includes('part:3') && r.a.includes('pack:10'), r.a);
  ok('2 later change 3->2 follows', r.b.includes('part:2'), r.b);
  ok('3 part row empty while loose=0, fills when parts added', r.c1.includes('part:""') && r.c2.includes('part:4'), [r.c1, r.c2]);
  ok('4 uncounted item stays empty', r.d.every(x => x.endsWith(':""')), r.d);
  console.log(errs); await b.close(); process.exit(fails?1:0); })();
