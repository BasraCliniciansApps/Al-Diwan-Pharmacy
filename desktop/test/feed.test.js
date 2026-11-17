const assert = require('assert'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { createHub } = require('../lanhub');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hubf-'));
const J = (port, method, url, body, tok) => fetch('http://127.0.0.1:' + port + url, { method, headers: { 'content-type': 'application/json', ...(tok ? { 'x-diwan-token': tok, 'x-diwan-role': 'owner' } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, j: await r.json() }));
(async () => {
  const h = createHub({ dir, name: 't' }); const port = await h.start(18780);
  const pair = async (id, role) => (await J(port, 'POST', '/v1/pair', { code: h.newCode(role || 'owner'), deviceId: id, deviceName: id })).j.token;
  const ta = await pair('phoneA'), tb = await pair('phoneB');
  const op = (id, type) => ({ id, type, ts: new Date().toISOString(), data: { x: 1 } });
  await J(port, 'POST', '/v1/ops', { ops: [op('inv-aaaaaa', 'invoice'), op('stk-aaaaaa', 'stock'), op('snap:s1:0', 'snapshot')] }, ta);
  assert.equal((await J(port, 'GET', '/v1/feed?after=0', null, tb)).j.ops.length, 0, 'لا يُعطى شيء قبل موافقة الحاسوب');
  h.mark(['inv-aaaaaa', 'snap:s1:0'], 'applied');
  let f = (await J(port, 'GET', '/v1/feed?after=0', null, tb)).j;
  assert.deepEqual(f.ops.map(o => o.id), ['inv-aaaaaa'], 'الفاتورة فقط، لا نسخة كاملة');
  assert.equal((await J(port, 'GET', '/v1/feed?after=0', null, ta)).j.ops.length, 0, 'لا يرجع للجهاز نفسه ما أرسله');
  h.mark(['stk-aaaaaa'], 'applied');
  const f2 = (await J(port, 'GET', '/v1/feed?after=' + f.last, null, tb)).j;
  assert.deepEqual(f2.ops.map(o => o.id), [], 'عمليات المخزن لا تُمرَّر: الكمية النهائية تأتي من الحاسوب');
  assert.ok((await J(port, 'GET', '/v1/feed?after=0', null, ta)).j.acked.includes('stk-aaaaaa'), 'تأكيد استلام عمليات الجهاز');
  assert.equal((await J(port, 'GET', '/v1/feed?after=' + f2.last, null, tb)).j.ops.length, 0);
  h.setNeed('phoneA', true); assert.equal((await J(port, 'GET', '/v1/status', null, ta)).j.need, true);
  h.setNeed('phoneA', false); assert.equal((await J(port, 'GET', '/v1/status', null, ta)).j.need, false);
  // انتظار طويل: يُجاب فور وصول جديد
  await J(port, 'POST', '/v1/ops', { ops: [op('inv-lp-0001', 'invoice')] }, ta);
  const lastSeq = (await J(port, 'GET', '/v1/feed?after=0', null, tb)).j.last; const t0 = Date.now();
  const lp = J(port, 'GET', '/v1/feed?wait=10&after=' + lastSeq, null, tb);
  setTimeout(() => h.mark(['inv-lp-0001'], 'applied'), 500);
  const lr = (await lp).j; assert.deepEqual(lr.ops.map(o => o.id), ['inv-lp-0001']); assert.ok(Date.now() - t0 < 3000, 'وصل بسرعة: ' + (Date.now() - t0));
  // كمية الحاسوب النهائية
  h.addLocal([{ id: 'qs:7:abcdef', type: 'qset', ts: new Date().toISOString(), data: { pid: 7, st: { qty: 4, loose: 1 } } }]);
  const qr = (await J(port, 'GET', '/v1/qty?ids=7,8', null, tb)).j; assert.equal(qr.q['7'].q, 4); assert.equal(qr.q['7'].l, 1); assert.ok(!qr.q['8']);
  // دور مرتبط بالرمز: جهاز ربط برمز المستخدم لا يصير مالكاً حتى لو ادّعى
  const ts = await pair('phoneS', 'staff'); const o2 = (id, type, data) => ({ id, type, ts: new Date().toISOString(), data });
  const rs = (await J(port, 'POST', '/v1/ops', { ops: [o2('evil-pi', 'pinfo', { pid: 1, info: { name: 'x' } }), o2('stk-in-1', 'stock', { op: { kind: 'in' }, entries: [] }), o2('stk-sale-1', 'stock', { op: { kind: 'sale' }, entries: [] })] }, ts)).j;
  assert.deepEqual(rs.invalid.sort(), ['evil-pi', 'stk-in-1'], 'المستخدم: لا معلومات ولا وارد'); assert.deepEqual(rs.stored, ['stk-sale-1'], 'المستخدم: البيع مسموح');
  await h.stop(); console.log('feed tests OK');
})().catch(e => { console.error(e); process.exit(1); });
