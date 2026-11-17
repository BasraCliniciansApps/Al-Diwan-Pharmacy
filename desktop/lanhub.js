// خادم المزامنة عبر الشبكة المحلية (يعمل داخل برنامج الحاسوب فقط، ولا يمس السحابة)
// الجوال يرسل "عمليات" (فاتورة بيع، حركة مخزون، وارد) وليس نسخة كاملة من البيانات.
// كل عملية لها معرّف فريد، فإرسالها مرتين لا يكررها. العمليات تُحفظ على القرص فوراً وتبقى بانتظار موافقة المستخدم على الحاسوب.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TYPES = ['invoice', 'stock', 'purchase', 'snapshot', 'pinfo', 'cfg', 'rec', 'qset'];
const OWNER_TYPES = ['pinfo', 'cfg', 'rec', 'purchase', 'snapshot'];   // لا يقبلها الخادم إلا من جهاز يقدّم نفسه مالكاً
const STAFF_HIDE = ['pinfo.cost', 'rec', 'purchase', 'snapshot'];
const MAX_BODY = 8 * 1024 * 1024;
const MAX_OPS_PER_REQ = 200;
const CODE_TTL = 10 * 60 * 1000;

function lanIps() {
    const out = [];
    const nets = os.networkInterfaces();
    Object.keys(nets).forEach(n => (nets[n] || []).forEach(a => { if (a.family === 'IPv4' && !a.internal) out.push(a.address); }));
    // عناوين الشبكات المنزلية أولاً
    return out.sort((a, b) => (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(b) ? 1 : 0) - (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a) ? 1 : 0));
}

function createHub(opts) {
    const dir = opts.dir;
    const name = opts.name || 'Diwan-PC';
    const opsFile = path.join(dir, 'lan-ops.jsonl');
    const stFile = path.join(dir, 'lan-state.json');
    fs.mkdirSync(dir, { recursive: true });

    let st = { devices: {}, done: {}, seq: 0, doneSeq: {}, dseq: 0 };       // done: opId -> 'applied' | 'rejected'
    try { const s = JSON.parse(fs.readFileSync(stFile, 'utf8')); if (s && typeof s === 'object') st = Object.assign(st, s); if (!st.doneSeq) st.doneSeq = {}; if (!st.dseq) st.dseq = 0; } catch (e) { /* أول تشغيل */ }
    const ops = new Map();                             // opId -> سجل العملية
    try {
        fs.readFileSync(opsFile, 'utf8').split('\n').forEach(l => { if (!l.trim()) return; try { const r = JSON.parse(l); if (r && r.id) ops.set(r.id, r); } catch (e) { /* سطر ناقص من انقطاع كهرباء: يُتجاهل */ } });
    } catch (e) { /* لا ملف بعد */ }

    function saveState() { const tmp = stFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(st)); fs.renameSync(tmp, stFile); }
    function emit() { try { opts.onChange && opts.onChange(); } catch (e) { /* تجاهل */ } }

    let code = '', codeRole = 'staff', codeAt = 0, bad = 0, lockUntil = 0;
    function newCode(role) { codeRole = role === 'owner' ? 'owner' : 'staff'; code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); codeAt = Date.now(); bad = 0; return code; }
    function activeCode() { return code && Date.now() - codeAt < CODE_TTL ? code : ''; }

    function authDev(req) {
        const t = String(req.headers['x-diwan-token'] || '');
        if (!t) return null;
        const tb = Buffer.from(t);
        for (const id of Object.keys(st.devices)) {
            const d = st.devices[id], b = Buffer.from(d.token || '');
            if (b.length === tb.length && crypto.timingSafeEqual(b, tb)) return { id, d };
        }
        return null;
    }

    function validOp(o) {
        if (!o || typeof o !== 'object') return false;
        if (typeof o.id !== 'string' || !/^[\w:.\-]{6,80}$/.test(o.id)) return false;
        if (TYPES.indexOf(o.type) < 0) return false;
        if (typeof o.ts !== 'string' || isNaN(Date.parse(o.ts))) return false;
        if (!o.data || typeof o.data !== 'object') return false;
        return true;
    }

    // الدور الفعلي: مالك فقط إذا ربط الجهاز برمز المالك (إن وُجد دور محفوظ) وكان حساب التطبيق مالكاً
    const digests = {}, qtyMap = {}; let qLoaded = false;
    function noteQ(r) { if (r && r.type === 'qset' && r.data && r.data.st) qtyMap[String(r.data.pid)] = { q: parseInt(r.data.st.qty) || 0, l: parseInt(r.data.st.loose) || 0, at: r.ts }; }
    function loadQ() { if (!qLoaded) { qLoaded = true; ops.forEach(noteQ); } }
    function effRole(dev, req) { const claim = String(req.headers['x-diwan-role'] || '') === 'owner'; return claim && (dev.d.role === undefined || dev.d.role === 'owner') ? 'owner' : 'staff'; }
    const STAFF_KINDS = ['sale', 'cancel', 'edit', 'ret'];
    function ingest(dev, list, role) {
        const stored = [], dup = [], invalid = [];
        const lines = [];
        list.forEach(o => {
            if (!validOp(o) || o.type === 'qset' || (role !== 'owner' && o.type === 'stock' && STAFF_KINDS.indexOf(String(o.data && o.data.op && o.data.op.kind || '')) < 0) || (role !== 'owner' && OWNER_TYPES.indexOf(o.type) >= 0 && o.type !== 'purchase' && o.type !== 'snapshot')) { invalid.push(o && o.id || ''); return; }
            if (ops.has(o.id)) { dup.push(o.id); return; }
            const rec = { id: o.id, type: o.type, ts: o.ts, data: o.data, dev: dev.id, devName: dev.d.name, recvAt: new Date().toISOString(), seq: ++st.seq };
            ops.set(rec.id, rec); lines.push(JSON.stringify(rec)); stored.push(rec.id);
        });
        if (lines.length) {
            const fd = fs.openSync(opsFile, 'a');
            try { fs.writeSync(fd, lines.join('\n') + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }   // لا نؤكد الاستلام قبل أن يصير على القرص
            dev.d.lastSeen = Date.now(); saveState(); emit();
        } else { dev.d.lastSeen = Date.now(); }
        return { stored, dup, invalid };
    }

    function readBody(req, res, cb) {
        let size = 0; const chunks = [];
        req.on('data', c => { size += c.length; if (size > MAX_BODY) { res.writeHead(413); res.end(); req.destroy(); return; } chunks.push(c); });
        req.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return send(res, 400, { error: 'bad-json' }); } cb(j); });
    }
    function send(res, status, obj) {
        const b = JSON.stringify(obj);
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(b), 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-diwan-role,x-diwan-token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' });
        res.end(b);
    }

    const server = http.createServer((req, res) => {
        const url = (req.url || '').split('?')[0];
        if (req.method === 'OPTIONS') return send(res, 204, {});
        if (req.method === 'GET' && url === '/v1/ping') return send(res, 200, { app: 'diwan-hub', v: 1, name, time: new Date().toISOString() });
        if (req.method === 'POST' && url === '/v1/pair') {
            return readBody(req, res, j => {
                if (Date.now() < lockUntil) return send(res, 429, { error: 'locked' });
                const c = activeCode();
                const given = String(j.code || '');
                const ok = c && given.length === c.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(c));
                if (!ok) { if (++bad >= 5) { lockUntil = Date.now() + 60000; bad = 0; } return send(res, 403, { error: 'bad-code' }); }
                const did = String(j.deviceId || '').replace(/[^\w\-]/g, '').slice(0, 40) || crypto.randomBytes(6).toString('hex');
                const prev = st.devices[did];
                const used = Object.keys(st.devices).map(k => st.devices[k].prefix);
                const prefix = prev ? prev.prefix : 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').find(x => used.indexOf(x) < 0) || 'Z';
                const token = crypto.randomBytes(24).toString('hex');
                st.devices[did] = { name: String(j.deviceName || 'جهاز').slice(0, 40), role: codeRole, token, prefix, pairedAt: Date.now(), lastSeen: Date.now() };
                code = ''; saveState(); emit();
                send(res, 200, { token, prefix, hub: name });
            });
        }
        const dev = authDev(req);
        if (!dev) return send(res, 401, { error: 'unauthorized' });
        if (req.method === 'POST' && url === '/v1/digest') {   // بصمة كميات الجهاز: يقارنها الحاسوب ويصحح الفروقات
            return readBody(req, res, j => { if (j && j.m && typeof j.m === 'object') digests[dev.id] = { ts: Date.now(), m: j.m }; send(res, 200, { ok: true }); });
        }
        if (req.method === 'POST' && url === '/v1/ops') {
            return readBody(req, res, j => {
                const list = Array.isArray(j.ops) ? j.ops : [];
                if (!list.length || list.length > MAX_OPS_PER_REQ) return send(res, 400, { error: 'bad-count' });
                try { send(res, 200, ingest(dev, list, effRole(dev, req))); } catch (e) { send(res, 500, { error: 'disk' }); }
            });
        }
        if (req.method === 'GET' && url === '/v1/status') {
            let mine = 0, applied = 0; ops.forEach(r => { if (r.dev === dev.id) { if (st.done[r.id]) applied++; else mine++; } });
            return send(res, 200, { waiting: mine, applied, prefix: dev.d.prefix, name, need: !!dev.d.needSnap, head: st.dseq });
        }
        if (req.method === 'GET' && url === '/v1/qty') {   // الكمية النهائية عند الحاسوب (لفحص التوفر قبل البيع)
            const q = new URLSearchParams((req.url.split('?')[1]) || ''); loadQ();
            const out = {}; String(q.get('ids') || '').split(',').slice(0, 60).forEach(id => { if (qtyMap[id]) out[id] = qtyMap[id]; });
            return send(res, 200, { q: out, at: Date.now() });
        }
        if (req.method === 'GET' && url === '/v1/feed') {   // عمليات الأجهزة الأخرى التي وافق عليها الحاسوب (الاتجاه الثاني)
            const q = new URLSearchParams((req.url.split('?')[1]) || ''); const after = parseInt(q.get('after')) || 0, wait = Math.min(25, parseInt(q.get('wait')) || 0);
            const owner = effRole(dev, req) === 'owner';
            const build = () => {
                const list = [...ops.values()].filter(r => r.dev !== dev.id && r.type !== 'snapshot' && r.type !== 'stock' && st.done[r.id] === 'applied' && (st.doneSeq[r.id] || 0) > after).sort((a, b) => st.doneSeq[a.id] - st.doneSeq[b.id]).slice(0, 100);
                const outL = list.filter(r => owner || (r.type !== 'rec' && r.type !== 'purchase')).map(r => { let d = r.data; if (!owner && r.type === 'pinfo' && d && d.cost) { d = Object.assign({}, d); delete d.cost; } return { id: r.id, type: r.type, ts: r.ts, data: d, dev: r.dev, devName: r.devName, fseq: st.doneSeq[r.id] }; });
                const acked = [...ops.values()].filter(r => r.dev === dev.id && st.done[r.id] === 'applied').slice(-600).map(r => r.id);
                return { n: list.length, body: { acked, ops: outL, last: list.length ? st.doneSeq[list[list.length - 1].id] : after, head: st.dseq } };
            };
            let r = build();
            if (r.n || !wait) return send(res, 200, r.body);
            let alive = true; req.on('close', () => { alive = false; }); const t0 = Date.now();   // انتظار طويل: يُجاب فور وصول جديد
            const again = () => { if (!alive) return; r = build(); if (r.n || Date.now() - t0 > wait * 1000) return send(res, 200, r.body); setTimeout(again, 250); };
            return setTimeout(again, 250);
        }
        send(res, 404, { error: 'not-found' });
    });

    return {
        start(port) {
            return new Promise((resolve, reject) => {
                const tryPort = (p, left) => {
                    const onErr = e => { server.removeListener('listening', onOk); if (e.code === 'EADDRINUSE' && left > 0) tryPort(p + 1, left - 1); else reject(e); };
                    const onOk = () => { server.removeListener('error', onErr); resolve(server.address().port); };
                    server.once('error', onErr); server.once('listening', onOk);
                    server.listen(p, '0.0.0.0');
                };
                tryPort(port || 8765, 10);
            });
        },
        stop() { return new Promise(r => { try { server.close(() => r()); if (server.closeAllConnections) server.closeAllConnections(); } catch (e) { r(); } }); },
        newCode, activeCode,
        info() { const a = server.address(); return { port: a && a.port, ips: lanIps(), name, code: activeCode(), codeRole, codeLeft: code ? Math.max(0, CODE_TTL - (Date.now() - codeAt)) : 0, devices: Object.keys(st.devices).map(id => ({ id, name: st.devices[id].name, prefix: st.devices[id].prefix, lastSeen: st.devices[id].lastSeen })), pending: this.pending().length }; },
        pending() { return [...ops.values()].filter(r => !st.done[r.id]).sort((a, b) => a.seq - b.seq); },
        mark(ids, status) { ids.forEach(id => { if (ops.has(id) && st.done[id] !== status) { st.done[id] = status; if (status === 'applied') st.doneSeq[id] = ++st.dseq; } }); saveState(); emit(); },
        takeDigests() { const o = Object.assign({}, digests); Object.keys(digests).forEach(k => delete digests[k]); return o; },
        addLocal(list) {   // تغييرات الحاسوب نفسه: تُسجَّل مطبَّقة وتوزَّع على الجوالات
            const lines = [];
            (list || []).forEach(o => { if (!validOp(o) || ops.has(o.id)) return; const rec = { id: o.id, type: o.type, ts: o.ts, data: o.data, dev: 'pc', devName: name, recvAt: new Date().toISOString(), seq: ++st.seq }; ops.set(rec.id, rec); lines.push(JSON.stringify(rec)); st.done[rec.id] = 'applied'; st.doneSeq[rec.id] = ++st.dseq; });
            loadQ(); (list || []).forEach(o => { if (o && o.type === 'qset') noteQ(ops.get(o.id)); });
            if (lines.length) { const fd = fs.openSync(opsFile, 'a'); try { fs.writeSync(fd, lines.join('\n') + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } saveState(); }
            return lines.length;
        },
        setNeed(devId, on) { if (st.devices[devId]) { st.devices[devId].needSnap = !!on; saveState(); } },
        forget(devId) { delete st.devices[devId]; saveState(); emit(); }
    };
}

module.exports = { createHub, lanIps };
