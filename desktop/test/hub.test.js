const assert = require('assert'); const fs = require('fs'); const os = require('os'); const path = require('path');
const { createHub } = require('../lanhub');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-'));
const J = (port, method, url, body, tok) => fetch('http://127.0.0.1:' + port + url, { method, headers: { 'content-type': 'application/json', ...(tok ? { 'x-diwan-token': tok } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, j: await r.json() }));
(async () => {
  let h = createHub({ dir, name: 't' }); const port = await h.start(18765);
  assert.equal((await J(port, 'GET', '/v1/ping')).j.app, 'diwan-hub');
  assert.equal((await J(port, 'POST', '/v1/ops', { ops: [] })).s, 401);
  assert.equal((await J(port, 'POST', '/v1/pair', { code: '000000' })).s, 403);   // لا رمز نشط
  const c = h.newCode();
  let p = await J(port, 'POST', '/v1/pair', { code: c, deviceId: 'phoneA', deviceName: 'جوال المالك' });
  assert.equal(p.s, 200); assert.equal(p.j.prefix, 'A'); const tok = p.j.token;
  assert.equal((await J(port, 'POST', '/v1/pair', { code: c, deviceId: 'x' })).s, 403, 'الرمز يُستعمل مرة واحدة');
  const op = (id, type = 'invoice') => ({ id, type, ts: new Date().toISOString(), data: { x: 1 } });
  let r = await J(port, 'POST', '/v1/ops', { ops: [op('inv-000001'), op('inv-000002')] }, tok);
  assert.deepEqual(r.j.stored, ['inv-000001', 'inv-000002']);
  r = await J(port, 'POST', '/v1/ops', { ops: [op('inv-000001'), op('inv-000003'), { id: 'bad' }] }, tok);
  assert.deepEqual(r.j.dup, ['inv-000001']); assert.deepEqual(r.j.stored, ['inv-000003']); assert.equal(r.j.invalid.length, 1);
  assert.equal(h.pending().length, 3);
  h.mark(['inv-000001'], 'applied'); assert.equal(h.pending().length, 2);
  // إعادة تشغيل: لا يضيع شي ولا يتكرر
  await h.stop(); fs.appendFileSync(path.join(dir, 'lan-ops.jsonl'), '{"id":"cut'); // سطر ناقص
  h = createHub({ dir, name: 't' }); const port2 = await h.start(18770);
  assert.equal(h.pending().length, 2);
  r = await J(port2, 'POST', '/v1/ops', { ops: [op('inv-000002'), op('inv-000004')] }, tok);
  assert.deepEqual(r.j.dup, ['inv-000002']); assert.deepEqual(r.j.stored, ['inv-000004']);
  // قفل التخمين
  h.newCode(); for (let i = 0; i < 5; i++) await J(port2, 'POST', '/v1/pair', { code: '999999' });
  assert.equal((await J(port2, 'POST', '/v1/pair', { code: h.activeCode() })).s, 429);
  assert.equal((await J(port2, 'POST', '/v1/ops', { ops: [op('inv-000005')] }, 'wrong')).s, 401);
  await h.stop(); console.log('hub tests OK');
})().catch(e => { console.error(e); process.exit(1); });
