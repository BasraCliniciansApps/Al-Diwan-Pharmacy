// بديل خفيف لـ Firebase compat لتشغيل صفحة الويب محلياً بلا سحابة (لقطات تكافؤ بصري).
(function () {
  const SEED = window.__SEED__ || [];
  const pub = SEED.map(p => { const o = { ...p }; ['qty','loose','bt','expiryDate','expiryDates','minQty','costPrice'].forEach(k => delete o[k]); return o; });
  const stock = {}; SEED.forEach(p => { const o = {}; ['qty','loose','bt','expiryDate','expiryDates','minQty'].forEach(k => { if (p[k] !== undefined) o[k] = p[k]; }); stock[String(p.id)] = o; });
  const mkSnap = docs => ({ empty: !docs.length, size: docs.length, docs: docs.map(d => ({ id: d.id, data: () => d.data, exists: true })), forEach(f) { this.docs.forEach(f); }, metadata: { fromCache: false, hasPendingWrites: false } });
  const data = {
    pharmacy_products: pub.map(p => ({ id: String(p.id), data: p })),
    pharmacy_stock: Object.keys(stock).map(k => ({ id: k, data: stock[k] })),
  };
  const noop = () => {};
  const chain = name => {
    const q = {
      get: () => Promise.resolve(mkSnap(data[name] || [])),
      onSnapshot: (cb) => { setTimeout(() => cb(mkSnap(data[name] || [])), 0); return noop; },
      where: () => q, orderBy: () => q, limit: () => q, startAfter: () => q,
      doc: id => ({ id, get: () => Promise.resolve({ exists: false, data: () => undefined, id }), set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve(),
        onSnapshot: cb => { setTimeout(() => cb({ exists: false, data: () => undefined, id }), 0); return noop; }, collection: n => chain(name + '/' + id + '/' + n) }),
      add: () => Promise.resolve({ id: 'x' }),
    };
    return q;
  };
  const fs = { collection: chain, batch: () => ({ set: noop, update: noop, delete: noop, commit: () => Promise.resolve() }), runTransaction: f => Promise.resolve(), enablePersistence: () => Promise.resolve(), settings: noop, enableNetwork: () => Promise.resolve(), disableNetwork: () => Promise.resolve() };
  const OWNER = 'VrZUN6AMvTPMklvhlZcwKlqJciY2';
  const authObj = { currentUser: { uid: OWNER, email: 'owner@diwan.test', getIdToken: () => Promise.resolve('t') },
    onAuthStateChanged(cb) { setTimeout(() => cb(authObj.currentUser), 0); return noop; }, setPersistence: () => Promise.resolve(), signOut: () => Promise.resolve(), signInWithEmailAndPassword: () => Promise.resolve() };
  const firestoreFn = () => fs; firestoreFn.FieldValue = { increment: n => n, serverTimestamp: () => new Date(), delete: noop, arrayUnion: noop, arrayRemove: noop }; firestoreFn.Timestamp = { now: () => new Date(), fromDate: d => d };
  const authFn = () => authObj; authFn.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  window.firebase = { apps: [], initializeApp() { this.apps.push({}); return {}; }, auth: authFn, firestore: firestoreFn };
})();
