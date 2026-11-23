// اختبار وحدة susync.js بـ Firestore وهمي (بلا إنترنت): node tools/test_susync.js
'use strict';
const path = require('path'), assert = require('assert');
const { makeSu } = require(path.join(__dirname, '..', 'susync.js'));

// ---------------- Firestore وهمي مختصر (واجهة compat) ----------------
class TS { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } static fromMillis(ms) { return new TS(ms); } }
const FV = { serverTimestamp: () => ({ __sv: 1 }), increment: n => ({ __inc: n }), delete: () => ({ __del: 1 }) };
function makeFake() {
    const db = { cols: {}, clock: 1e12, listeners: [], billed: 0, by: {}, bill(c, n) { this.billed += n; this.by[c] = (this.by[c] || 0) + n; }, denyColl: new Set(), failListen: new Set(), cacheOnly: false };
    const F = { Timestamp: TS, FieldValue: FV };
    const tick = () => (db.clock += 1000);
    const col = n => db.cols[n] || (db.cols[n] = {});
    const isPlain = o => o && typeof o === 'object' && !(o instanceof TS) && !o.__sv && !o.__inc && !o.__del && !Array.isArray(o);
    function applyField(cur, k, v, now) { if (v && v.__del) { delete cur[k]; } else if (v && v.__sv) cur[k] = new TS(now); else if (v && v.__inc) cur[k] = (cur[k] || 0) + v.__inc; else cur[k] = v; }
    function writeSet(ref, data, opts) {
        const now = tick(), cur = col(ref.parent.id)[ref.id]; let out;
        if (opts && (opts.merge || opts.mergeFields)) { out = Object.assign({}, cur || {}); const keys = opts.mergeFields ? opts.mergeFields.filter(k => typeof k === 'string') : Object.keys(data); keys.forEach(k => { if (k in data) applyField(out, k, data[k], now); }); }
        else { out = {}; Object.keys(data).forEach(k => applyField(out, k, data[k], now)); }
        col(ref.parent.id)[ref.id] = out;
    }
    function writeUpdate(ref, args) {
        const cur = col(ref.parent.id)[ref.id]; if (!cur) throw Object.assign(new Error('not-found'), { code: 'not-found' });
        const now = tick(), out = Object.assign({}, cur);
        if (typeof args[0] === 'string') { for (let i = 0; i < args.length; i += 2) applyField(out, args[i], args[i + 1], now); }
        else Object.keys(args[0]).forEach(k => applyField(out, k, args[0][k], now));
        col(ref.parent.id)[ref.id] = out;
    }
    const matches = (q, d) => (q.filters || []).every(f => { const v = d[f.f]; if (!(v instanceof TS)) return false; return f.op === '>' ? v.ms > f.v.ms : v.ms < f.v.ms; });
    function evalQuery(q) { const c = col(q.coll), out = {}; let n = 0; Object.keys(c).forEach(id => { if ((!q.lim || n < q.lim) && matches(q, c[id])) { out[id] = c[id]; n++; } }); return out; }
    function mkSnap(q, res, changes, fromCache) {
        const ids = Object.keys(res), mkDoc = id => ({ id, ref: new F.DocumentReference(q.coll, id), data: () => Object.assign({}, res[id] || changes.find(c => c.id === id).data), metadata: { hasPendingWrites: false } });
        const docs = ids.map(mkDoc);
        return { size: docs.length, empty: !docs.length, docs, metadata: { fromCache: !!fromCache }, forEach: f => docs.forEach(f), docChanges: () => changes.map(c => ({ type: c.type, doc: mkDoc(c.id) })), query: q };
    }
    class Query {
        constructor(coll, filters, lim) { this.coll = coll; this.filters = filters || []; this.lim = lim || 0; this.parent = { id: coll }; }
        where(f, op, v) { return new Query(this.coll, this.filters.concat([{ f, op, v }]), this.lim); }
        limit(n) { return new Query(this.coll, this.filters, n); }
        async get() { if (db.denyColl.has(this.coll)) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); const res = evalQuery(this); if (!db.cacheOnly) db.bill(this.coll, Math.max(1, Object.keys(res).length)); return mkSnap(this, res, Object.keys(res).map(id => ({ type: 'added', id })), db.cacheOnly); }
        onSnapshot(cb, err) {
            if (db.denyColl.has(this.coll) || db.failListen.has(this.coll)) { setTimeout(() => err && err(Object.assign(new Error('denied'), { code: 'permission-denied' })), 0); return () => { }; }
            const L = { q: this, cb, last: evalQuery(this), on: true }; db.listeners.push(L);
            const res = L.last; db.bill(this.coll, Object.keys(res).length);
            cb(mkSnap(this, res, Object.keys(res).map(id => ({ type: 'added', id })), false));
            return () => { L.on = false; };
        }
    }
    class CollectionReference extends Query { constructor(n) { super(n, []); } doc(id) { return new F.DocumentReference(this.coll, String(id)); } }
    class DocumentReference {
        constructor(coll, id) { this.id = id; this.parent = { id: coll }; this.firestore = fdb; }
        set(data, opts) { writeSet(this, data, opts); notify(); return Promise.resolve(); }
        update() { writeUpdate(this, Array.prototype.slice.call(arguments)); notify(); return Promise.resolve(); }
        delete() { delete col(this.parent.id)[this.id]; notify(); return Promise.resolve(); }
        async get() { if (db.denyColl.has(this.parent.id)) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); const d = col(this.parent.id)[this.id]; db.bill(this.parent.id, 1); return { exists: !!d, data: () => d && Object.assign({}, d) }; }
        onSnapshot(cb) { const get = () => { const d = col(this.parent.id)[this.id]; return { exists: !!d, data: () => d && Object.assign({}, d) }; }; const L = { doc: this, cb: () => cb(get()), on: true, last: JSON.stringify(col(this.parent.id)[this.id] || null) }; db.listeners.push(L); db.bill(this.parent.id, 1); cb(get()); return () => { L.on = false; }; }
    }
    class WriteBatch {
        constructor() { this.ops = []; }
        set(ref, data, opts) { this.ops.push(['set', ref, data, opts]); return this; }
        update(ref) { this.ops.push(['update', ref, Array.prototype.slice.call(arguments, 1)]); return this; }
        delete(ref) { this.ops.push(['delete', ref]); return this; }
        async commit() { this.ops.forEach(o => { if (o[0] === 'set') writeSet(o[1], o[2], o[3]); else if (o[0] === 'update') writeUpdate(o[1], o[2]); else delete col(o[1].parent.id)[o[1].id]; }); notify(); }
    }
    class Transaction { set(ref, d, o) { writeSet(ref, d, o); } update(ref) { writeUpdate(ref, Array.prototype.slice.call(arguments, 1)); } delete(ref) { delete col(ref.parent.id)[ref.id]; } }
    function notify() {
        db.listeners.forEach(L => {
            if (!L.on) return;
            if (L.doc) { const cur = JSON.stringify(col(L.doc.parent.id)[L.doc.id] || null); if (cur !== L.last) { L.last = cur; L.cb(); } return; }
            const now = evalQuery(L.q), changes = [];
            Object.keys(now).forEach(id => { if (!L.last[id]) changes.push({ type: 'added', id }); else if (JSON.stringify(L.last[id]) !== JSON.stringify(now[id])) changes.push({ type: 'modified', id }); });
            Object.keys(L.last).forEach(id => { if (!now[id]) changes.push({ type: 'removed', id, data: L.last[id] }); });
            L.last = now; if (changes.length) { db.bill(L.q.coll, changes.filter(c => c.type !== 'removed').length); L.cb(mkSnap(L.q, now, changes, false)); }
        });
    }
    F.DocumentReference = DocumentReference; F.WriteBatch = WriteBatch; F.Transaction = Transaction;
    F.Query = Query; F.CollectionReference = CollectionReference;
    const fdb = { collection: n => new CollectionReference(n), batch: () => new WriteBatch() };
    db.F = F; db.fdb = fdb; db.col = col; db.seed = (coll, id, data) => { col(coll)[id] = data; };
    return db;
}

if (typeof module !== 'undefined') module.exports = { makeFake, TS, FV };
// ---------------- بيئة التطبيق الوهمية (تحاكي data.js) ----------------
const STOCK_FIELDS = ['qty', 'loose', 'counted', 'bt', 'minQty', 'expiryDate', 'expiryDates', 'costPrice', 'lastPurchase', 'markupPct'], COST_FIELDS = ['costPrice', 'lastPurchase', 'markupPct'];
function makeApp(fake, ls, opt) {
    opt = opt || {};
    const A = { cloudPub: [], stockMap: {}, costMap: {}, setupMode: false, costSplitOn: false, stockReady: false, products: opt.products || [], legacy: [], now: opt.now || (() => fake.clock), flagChanges: [], grants: 0, progs: [] };
    A.env = {
        db: () => fake.fdb, F: fake.F, ls, now: () => A.now(), uid: () => opt.uid || 'u1', products: () => A.products, STOCK_FIELDS, COST_FIELDS,
        getStock: () => A.stockMap, getCost: () => A.costMap, setPub: a => { A.cloudPub = a; }, setStockReady: () => { A.stockReady = true; }, isStockReady: () => A.stockReady,
        setSetupMode: v => { A.setupMode = v; }, setCostSplit: v => { A.costSplitOn = v; }, rebuild: () => { A.rebuildNow(); },
        legacyStart: k => A.legacy.push(k), prog: t => { const p = { ok: m => { p.state = 'ok'; }, fail: m => { p.state = 'fail'; p.msg = m; }, tick() { }, state: 'run' }; A.progs.push(p); return p; },
        grantWrites: n => { A.grants += n; }, log: () => { }, onFlagChange: on => A.flagChanges.push(on)
    };
    A.su = makeSu(A.env);
    A.rebuildNow = () => {   // مثل rebuildProducts + حفظ النسخة المحلية
        const merged = A.cloudPub.map(d => { const o = Object.assign({}, d, A.stockMap[String(d.id)] || {}, A.costMap[String(d.id)] || {}); delete o._su; return o; });
        A.products = merged.sort((a, b) => b.id - a.id);
        if (A.su.on()) A.su.rebuilt();
        A.persist();
    };
    A.persist = () => { ls.setItem('diwanProducts', JSON.stringify(A.products)); A.su.commit(); };
    return A;
}
function makeLS() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
function seedProducts(fake, n) {
    for (let i = 1; i <= n; i++) {
        fake.seed('pharmacy_products', String(i), { id: i, name: 'P' + i, price: 1000 + i, _su: new TS(1e12 + i) });
        fake.seed('pharmacy_stock', String(i), { id: i, qty: 10, _su: new TS(1e12 + i) });
    }
    fake.clock = 1e12 + 1e6;
}
const flush = () => new Promise(r => setTimeout(r, 5));
const T = []; const test = (n, f) => T.push([n, f]);

// ---------------- الاختبارات ----------------
test('الختم التلقائي: set/update/batch/merge/mergeFields وحذف المادة يكتب سجل محذوفات', async () => {
    const fk = makeFake(), ls = makeLS(), A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); A.su.installStamp(fk.F);
    const db = fk.fdb, ref = db.collection('pharmacy_stock').doc('5');
    await ref.set({ id: 5, qty: 3 }); assert(fk.col('pharmacy_stock')['5']._su instanceof TS, 'set');
    await ref.update({ qty: FV.increment(-1) }); assert.strictEqual(fk.col('pharmacy_stock')['5'].qty, 2); const t1 = fk.col('pharmacy_stock')['5']._su.ms;
    await ref.update('loose', 2); assert(fk.col('pharmacy_stock')['5']._su.ms > t1, 'update string form');
    const b = db.batch(); b.set(db.collection('pharmacy_products').doc('5'), { id: 5, name: 'x', price: 2 }, { mergeFields: ['price'] }); fk.seed('pharmacy_cost', '5', { id: 5 }); b.update(db.collection('pharmacy_cost').doc('5'), { costPrice: 1 }); b.set(db.collection('pharmacy_cost').doc('5'), { id: 5, costPrice: 1 }, { merge: true });
    fk.seed('pharmacy_products', '5', { id: 5, name: 'old', price: 1 }); await b.commit();
    assert.strictEqual(fk.col('pharmacy_products')['5'].name, 'old', 'mergeFields لا يمس غير الحقول'); assert(fk.col('pharmacy_products')['5']._su, 'mergeFields + _su');
    assert(fk.col('pharmacy_cost')['5']._su, 'merge');
    const b2 = db.batch(); b2.delete(db.collection('pharmacy_products').doc('5')); b2.delete(db.collection('pharmacy_stock').doc('5')); await b2.commit();
    assert(!fk.col('pharmacy_products')['5'] && fk.col('pharmacy_tomb')['5'] && fk.col('pharmacy_tomb')['5']._su, 'tombstone في نفس الدفعة'); assert.strictEqual(Object.keys(fk.col('pharmacy_tomb')).length, 1, 'سجل واحد لكل مادة');
    await db.collection('pharmacy_products').doc('6').set({ id: 6 }); await db.collection('pharmacy_products').doc('6').delete(); assert(fk.col('pharmacy_tomb')['6'], 'DocumentReference.delete');
    await db.collection('pharmacy_stock').doc('_setup').set({ on: true }); assert(!fk.col('pharmacy_stock')['_setup']._su, 'المعرّف الخاص لا يُختم');
    await db.collection('pharmacy_invoices').doc('i').set({ id: 'i' }); assert(!fk.col('pharmacy_invoices')['i']._su, 'غير الهدف لا يُختم');
});
test('بدون قواعد منشورة: لا ختم ولا سجل محذوفات (لا يكسر الحفظ)', async () => {
    const fk = makeFake(), ls = makeLS(), A = makeApp(fk, ls); A.su.installStamp(fk.F); const db = fk.fdb;
    await db.collection('pharmacy_stock').doc('1').set({ id: 1, qty: 1 }); assert(!fk.col('pharmacy_stock')['1']._su);
    await db.collection('pharmacy_products').doc('1').set({ id: 1 }); await db.collection('pharmacy_products').doc('1').delete(); assert.strictEqual(Object.keys(fk.col('pharmacy_tomb')).length, 0);
});
test('أول تشغيل: تحميل كامل ثم استماع مفلتر حيّ يلتقط التعديل والإضافة والحذف', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 50); const A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1'); A.su.installStamp(fk.F);
    assert(A.su.on()); await A.su.startProducts(); await A.su.startStock();
    assert.strictEqual(A.cloudPub.length, 50); assert.strictEqual(Object.keys(A.stockMap).length, 50); assert(A.stockReady); assert(!('_su' in A.cloudPub[0]));
    const b0 = fk.billed; await fk.fdb.collection('pharmacy_stock').doc('7').update({ qty: 99 }); await flush();
    assert.strictEqual(A.stockMap['7'].qty, 99, 'تحديث حيّ'); assert.strictEqual(fk.billed - b0, 1, 'قراءة واحدة فقط للتغيير');
    await fk.fdb.collection('pharmacy_products').doc('77').set({ id: 77, name: 'new' }); assert.strictEqual(A.cloudPub.length, 51);
    await fk.fdb.collection('pharmacy_products').doc('77').delete(); assert.strictEqual(A.cloudPub.length, 50, 'حذف حيّ');
});
test('فتح بارد بعد إعادة التشغيل: لا تحميل كامل، يقرأ المتغيّر فقط (وفر القراءات)', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 1200);
    let A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1');
    await A.su.startProducts(); await A.su.startStock(); await flush(); A.rebuildNow(); const full = fk.billed; assert(full >= 2400);
    A.su.stop(); A.su.stopPrivate();
    // الجهاز مغلق: تتغير 3 مواد ويُحذف صنف
    A.su.installStamp(fk.F);
    for (const id of ['3', '4', '5']) await fk.fdb.collection('pharmacy_stock').doc(id).update({ qty: 5 });
    await fk.fdb.collection('pharmacy_products').doc('9').delete(); fk.clock += 3 * 3600e3;
    fk.billed = 0; const B = makeApp(fk, ls, { products: A.products, now: () => fk.clock }); await B.su.startProducts(); await B.su.startStock(); await B.su.startCost().catch(() => { });
    assert(fk.billed < 20, 'قراءات الفتح البارد قليلة: ' + fk.billed);
    assert.strictEqual(B.stockMap['3'].qty, 5, 'التعديل وصل'); assert.strictEqual(Object.keys(B.stockMap).length, 1200);
});
test('المحذوفات أثناء إغلاق الجهاز تصله عبر سجل المحذوفات، وإعادة الإنشاء بعد الحذف لا تُحذف', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 30); fk.seed('pharmacy', 'susync', { on: true }); let A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1');
    A.su.installStamp(fk.F); await A.su.startProducts(); await A.su.startStock(); await A.su.afterAuth(); await flush(); A.rebuildNow(); A.su.stop(); A.su.stopPrivate();
    const db = fk.fdb;
    let b = db.batch(); b.delete(db.collection('pharmacy_products').doc('10')); b.delete(db.collection('pharmacy_stock').doc('10')); await b.commit();
    b = db.batch(); b.delete(db.collection('pharmacy_products').doc('11')); b.delete(db.collection('pharmacy_stock').doc('11')); await b.commit();
    await db.collection('pharmacy_products').doc('11').set({ id: 11, name: 'restored' }); await db.collection('pharmacy_stock').doc('11').set({ id: 11, qty: 4 });
    fk.clock += 3600e3; const B = makeApp(fk, ls, { products: A.products, now: () => fk.clock });
    await B.su.startProducts(); await B.su.startStock(); await B.su.afterAuth(); await flush();
    assert(!B.cloudPub.find(p => p.id === 10), 'المحذوفة اختفت'); assert(B.cloudPub.find(p => p.id === 11 && p.name === 'restored'), 'المُعادة بقيت'); assert(!B.stockMap['10']);
});
test('خلل المستمع المفلتر: يرجع للنمط القديم ويوقف النمط الجديد 24 ساعة', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 5); const A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1');
    fk.failListen.add('pharmacy_stock'); await A.su.startStock(); await flush(); await flush();
    assert.deepStrictEqual(A.legacy, ['stock']); assert(A.su.killed()); assert(!A.su.on());
});
test('تحميل كامل من الكاش فقط (بلا اتصال): لا يُعتمد أساساً ويرجع للقديم', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 5); const A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1'); fk.cacheOnly = true;
    await A.su.startProducts(); assert.deepStrictEqual(A.legacy, ['pub']); assert(!ls.getItem('diwanSuB_pub'));
});
test('مؤشر قديم أكثر من 30 يوماً أو بلا أساس: تحميل كامل', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 20); let A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1');
    await A.su.startProducts(); await flush(); A.rebuildNow(); A.su.stop();
    fk.clock += 31 * 864e5; fk.billed = 0; const B = makeApp(fk, ls, { products: A.products, now: () => fk.clock }); await B.su.startProducts(); assert(fk.billed >= 20, 'full ' + fk.billed);
});
test('المطابقة الكاملة تصلح مستنداً كُتب بلا ختم (جهاز بنسخة قديمة) وحذفاً غير مسجّل', async () => {
    const fk = makeFake(), ls = makeLS(); seedProducts(fk, 10); const A = makeApp(fk, ls); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1');
    await A.su.startProducts(); await flush();
    fk.col('pharmacy_products')['3'] = { id: 3, name: 'edited-no-stamp', _su: fk.col('pharmacy_products')['3']._su }; delete fk.col('pharmacy_products')['4'];
    assert.strictEqual(A.cloudPub.find(p => p.id === 3).name, 'P3', 'قبل المطابقة لا يراه');
    const h = A.env.prog('x'); assert(await A.su.reconcile(h)); assert.strictEqual(A.cloudPub.find(p => p.id === 3).name, 'edited-no-stamp'); assert(!A.cloudPub.find(p => p.id === 4)); assert.strictEqual(h.state, 'ok');
    ls.setItem('diwanSuFull', String(fk.clock - 3 * 864e5)); assert(A.su.needRecon());
});
test('التفعيل: يختم المستندات القديمة فقط ويرفع المفتاح ويمنح سماح الكتابات', async () => {
    const fk = makeFake(), ls = makeLS(); const A = makeApp(fk, ls); fk.seed('pharmacy_products', '1', { id: 1 }); fk.seed('pharmacy_products', '2', { id: 2, _su: new TS(5) }); fk.seed('pharmacy_stock', '1', { id: 1, qty: 1 }); fk.seed('pharmacy_stock', '_setup', { on: false });
    const b0 = Object.keys(fk.col('pharmacy_stock')).length; const n = await A.su.enable({ tick() { } });
    assert.strictEqual(n, 2); assert(fk.col('pharmacy_products')['1']._su && fk.col('pharmacy_stock')['1']._su); assert(!fk.col('pharmacy_stock')['_setup']._su); assert(fk.col('pharmacy')['susync'].on === true);
    assert.strictEqual(ls.getItem('diwanSuOn'), '1'); assert(A.grants >= 2); assert.strictEqual(fk.col('pharmacy_products')['1'].id, 1, 'لم يُمسح شيء');
    await A.su.disable(); assert.strictEqual(fk.col('pharmacy')['susync'].on, false);
});
test('فحص القواعد: غير منشورة تعطّل الوضع، والمنشورة تفعّل الختم', async () => {
    const fk = makeFake(), ls = makeLS(); const A = makeApp(fk, ls);
    fk.denyColl.add('pharmacy_tomb'); assert.strictEqual(await A.su.probe(), false); assert.strictEqual(ls.getItem('diwanSuRules'), '0');
    fk.denyColl.delete('pharmacy_tomb'); assert.strictEqual(await A.su.probe(), true); assert.strictEqual(ls.getItem('diwanSuRules'), '1');
    await assert.rejects(async () => { fk.denyColl.add('pharmacy_tomb'); await A.su.enable({ tick() { } }); }, /rules-missing/);
});
test('مفتاح الإيقاف الحي: تغيير المفتاح يُحدّث المحلي ويُنبّه', async () => {
    const fk = makeFake(), ls = makeLS(); const A = makeApp(fk, ls); fk.seed('pharmacy', 'susync', { on: true }); A.su.watchFlag();
    assert.strictEqual(ls.getItem('diwanSuOn'), '1'); assert.deepStrictEqual(A.flagChanges, [true]); await fk.fdb.collection('pharmacy').doc('susync').set({ on: false }); assert.deepStrictEqual(A.flagChanges, [true, false]); assert.strictEqual(ls.getItem('diwanSuOn'), '0');
});
test('الأساس المشتق: المخزون بلا حقول التكلفة عند فصلها، وبها عند عدمه', async () => {
    const fk = makeFake(), ls = makeLS(); const prods = [{ id: 1, name: 'a', price: 5, qty: 2, costPrice: 3, markupPct: 10, inStock: true }];
    const A = makeApp(fk, ls, { products: prods }); ls.setItem('diwanSuRules', '1'); ls.setItem('diwanSuOn', '1'); ls.setItem('diwanSuB_pub', 'pub'); ls.setItem('diwanSuC_pub', String(fk.clock)); ls.setItem('diwanSuB_stock', 'u1'); ls.setItem('diwanSuC_stock', String(fk.clock)); ls.setItem('diwanSuB_cost', 'u1'); ls.setItem('diwanSuC_cost', String(fk.clock));
    ls.setItem('diwanSuSplit', '1'); ls.setItem('diwanSuUid', 'u1'); await A.su.startProducts();
    assert.strictEqual(A.products[0].qty, 2, 'إعادة البناء بعد الأصناف وقبل المخزون لا تُفقد الكمية'); assert.strictEqual(A.products[0].costPrice, 3);
    await A.su.startProducts(); await A.su.startStock(); await A.su.startCost();
    const eq = (x, y, m) => assert.strictEqual(JSON.stringify(x), JSON.stringify(y), m + ' ' + JSON.stringify(x));
    eq(A.cloudPub[0], { id: 1, name: 'a', price: 5, inStock: true }, 'pub'); eq(A.stockMap['1'], { id: 1, qty: 2 }, 'stock'); eq(A.costMap['1'], { id: 1, costPrice: 3, markupPct: 10 }, 'cost');
});
test('تنظيف المحذوفات القديمة', async () => {
    const fk = makeFake(), ls = makeLS(); const A = makeApp(fk, ls); fk.seed('pharmacy_tomb', 'a', { id: 'a', _su: new TS(fk.clock - 50 * 864e5) }); fk.seed('pharmacy_tomb', 'b', { id: 'b', _su: new TS(fk.clock - 1000) });
    fk.fdb.batch = () => { const b = new fk.F.WriteBatch(); return b; };
    const orig = fk.fdb.collection; fk.fdb.collection = n => { const c = orig(n); const g = c.where.bind(c); c.where = (f, o, v) => { const q = g(f, o, v); const gg = q.get.bind(q); q.get = async () => { const s = await gg(); s.forEach(d => { d.ref = d.ref; }); return s; }; return q; }; return c; };
    assert.strictEqual(await A.su.purgeTomb(), 1); assert(!fk.col('pharmacy_tomb')['a'] && fk.col('pharmacy_tomb')['b']);
});

if (require.main === module) (async () => {
    let fail = 0;
    for (const [n, f] of T) { try { await f(); console.log('✓', n); } catch (e) { fail++; console.log('✗', n, '\n   ', e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n    ') : e); } }
    console.log(fail ? '\nفشل ' + fail + ' من ' + T.length : '\nنجحت كل الاختبارات (' + T.length + ')');
    process.exit(fail ? 1 : 0);
})();
