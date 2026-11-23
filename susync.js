// ============================================================================
// المزامنة الموفِّرة للقراءات (المرحلة 2)
// بدل المستمعات الكاملة على pharmacy_products وpharmacy_stock وpharmacy_cost (التي تعيد قراءة كل المستندات بعد كل غياب أكثر من 30 دقيقة)،
// نستمع فقط إلى المستندات التي تغيّرت بعد مؤشر محلي: where('_su', '>', المؤشر). الاستماع يبقى حياً (تحديث فوري)،
// لكن الفتح البارد يقرأ المتغيّر فقط. القاعدة الكاملة (الأساس) تُحمَّل مرة واحدة لكل جهاز ثم من النسخة المحلية.
// شبكات الأمان: ختم _su يُضاف تلقائياً لكل كتابة على المجموعات الثلاث، وتُسجَّل المحذوفات في pharmacy_tomb،
// ومطابقة كاملة كل 48 ساعة وبزر يدوي، ومفتاح إيقاف (pharmacy/susync)، وأي خطأ في المستمع يعيد النمط القديم لتلك المجموعة.
// ============================================================================
(function (root) {
    'use strict';
    const KIND = { pharmacy_products: 'pub', pharmacy_stock: 'stock', pharmacy_cost: 'cost' };
    const COLL = { pub: 'pharmacy_products', stock: 'pharmacy_stock', cost: 'pharmacy_cost' };
    const OVERLAP_MS = 120000, MAX_AGE_MS = 30 * 864e5, RECON_MS = 48 * 3600e3, HEAD_MS = 300000, LOAD_TIMEOUT = 45000;
    const tsMs = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v && typeof v.seconds === 'number') ? v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6) : 0;

    function makeSu(env) {
        const S = {};
        const L = {
            get: k => { try { return env.ls.getItem(k); } catch (e) { return null; } },
            set: (k, v) => { try { env.ls.setItem(k, String(v)); } catch (e) { /* تجاهل */ } },
            del: k => { try { env.ls.removeItem(k); } catch (e) { /* تجاهل */ } }
        };
        const maps = { pub: {}, stock: {}, cost: {}, tomb: {} };
        const cur = { pub: 0, stock: 0, cost: 0, tomb: 0 };     // أعلى ختم _su وصلنا (يُحفَظ بعد حفظ النسخة المحلية)
        const stampMs = {};                                       // آخر ختم طُبّق لكل مادة (لترتيب المحذوفات مع إعادة الإنشاء)
        const active = {};                                        // أي أنواع نستمع لها الآن
        const unsubs = {}; let pend = null, uid = '', stopped = false;
        const addUn = (key, fn) => { try { if (unsubs[key]) unsubs[key](); } catch (e) { /* تجاهل */ } unsubs[key] = fn; };
        const dropUn = key => { try { if (unsubs[key]) unsubs[key](); } catch (e) { /* تجاهل */ } delete unsubs[key]; };
        // نسخة المواد المحفوظة محلياً وقت التشغيل: منها يُشتق الأساس، وتُؤخذ قبل أول إعادة بناء (التي قد تحذف حقول المخزون مؤقتاً قبل وصول المخزون)
        let baseList = null; const getBase = () => (baseList || (baseList = (env.products() || []).slice()));
        const log = (...a) => { try { if (env.log) env.log(...a); } catch (e) { /* تجاهل */ } };

        // ---- المفاتيح ----
        S.rulesOk = () => L.get('diwanSuRules') === '1';
        S.flagOn = () => L.get('diwanSuOn') === '1';
        S.killed = () => { const k = +L.get('diwanSuKill') || 0; return k > env.now() - 24 * 3600e3; };
        S.on = () => S.rulesOk() && S.flagOn() && !S.killed();
        S.lastFull = () => +L.get('diwanSuFull') || 0;
        function kill(why) { L.set('diwanSuKill', env.now()); log('susync fallback:', why); }

        // ---- الأساس المحلي ----
        const bKey = k => 'diwanSuB_' + k, cKey = k => 'diwanSuC_' + k;
        function baseValid(kind) {
            const who = kind === 'pub' ? 'pub' : uid;
            const m = L.get(bKey(kind)), c = +L.get(cKey(kind)) || 0;
            if (!m || m !== who || !c || env.now() - c > MAX_AGE_MS) return false;
            const list = getBase(); return !!(list && list.length);
        }
        function derive(kind, list) {
            const SF = env.STOCK_FIELDS, CF = env.COST_FIELDS, split = L.get('diwanSuSplit') === '1', out = {};
            list.forEach(p => {
                if (!p || p.id === undefined) return; const id = String(p.id), o = {};
                if (kind === 'pub') { Object.keys(p).forEach(k => { if (SF.indexOf(k) < 0 && k.charAt(0) !== '_') o[k] = p[k]; }); }
                else if (kind === 'stock') { o.id = p.id; SF.forEach(k => { if (p[k] !== undefined && !(split && CF.indexOf(k) >= 0)) o[k] = p[k]; }); }
                else { if (!split) return; o.id = p.id; CF.forEach(k => { if (p[k] !== undefined) o[k] = p[k]; }); }
                out[id] = o;
            });
            return out;
        }
        function reset(kind) { maps[kind] = {}; }
        function strip(d) { const o = Object.assign({}, d); delete o._su; return o; }

        // ---- تطبيق على الذاكرة ----
        function liveMap(kind) {   // المخزون والتكلفة يُعدَّلان في المكان لأن بقية التطبيق يقرأ نفس الكائن
            if (kind === 'stock') return env.getStock(); if (kind === 'cost') return env.getCost(); return null;
        }
        function publish(kind) {
            if (kind === 'pub') { env.setPub(Object.keys(maps.pub).map(k => maps.pub[k])); env.rebuild(true); }
            else { if (kind === 'stock') env.setStockReady(); env.rebuild(false); }
        }
        function setAll(kind, map) {
            if (kind === 'pub') maps.pub = map;
            else { const t = liveMap(kind); Object.keys(t).forEach(k => { delete t[k]; }); Object.keys(map).forEach(k => { t[k] = map[k]; }); maps[kind] = t; }
        }
        function applyChanges(kind, snap) {
            const target = kind === 'pub' ? maps.pub : liveMap(kind); if (kind !== 'pub') maps[kind] = target;
            let n = 0;
            snap.docChanges().forEach(ch => {
                const id = String(ch.doc.id); if (id.charAt(0) === '_') return;
                if (ch.type === 'removed') { delete target[id]; if (kind === 'pub') delete stampMs[id]; n++; return; }
                const d = ch.doc.data() || {}, t = tsMs(d._su);
                target[id] = strip(d); n++;
                if (t) { if (t > cur[kind]) cur[kind] = t; if (kind === 'pub') stampMs[id] = t; }
            });
            if (n) publish(kind);
            else if (kind === 'stock' && !env.isStockReady()) publish(kind);
        }

        // ---- التحميل الكامل (الأساس أو المطابقة) ----
        async function fullLoad(kind) {
            const col = env.db().collection(COLL[kind]), startMs = env.now();
            const snap = await Promise.race([col.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('load-timeout')), LOAD_TIMEOUT))]);
            if (snap.metadata && snap.metadata.fromCache) throw new Error('from-cache');
            const m = {}; let mx = 0, side = {};
            snap.forEach(d => {
                const id = String(d.id), x = d.data() || {};
                if (id.charAt(0) === '_') { side[id] = x; return; }
                const t = tsMs(x._su); if (t > mx) mx = t; if (kind === 'pub' && t) stampMs[id] = t;
                m[id] = strip(x);
            });
            setAll(kind, m);
            cur[kind] = Math.max(mx, startMs - HEAD_MS);
            if (kind === 'stock' && side._setup) env.setSetupMode(!!side._setup.on);
            if (kind === 'cost' && side._meta) { env.setCostSplit(!!side._meta.on); L.set('diwanSuSplit', side._meta.on ? '1' : '0'); }
            return snap.size;
        }
        function mark(kind) {   // الأساس صالح للتشغيل القادم بعد حفظ النسخة المحلية
            if (!pend) pend = {}; pend[kind] = { b: kind === 'pub' ? 'pub' : uid, c: cur[kind] };
        }

        // ---- الاستماع المفلتر ----
        function listen(kind) {
            const F = env.F, from = Math.max(0, cur[kind] - OVERLAP_MS);
            const q = env.db().collection(COLL[kind]).where('_su', '>', F.Timestamp.fromMillis(from));
            let first = true;
            const un = q.onSnapshot(snap => { if (stopped) return; applyChanges(kind, snap); if (first) { first = false; } }, err => {
                log('susync listen error', kind, err && err.code);
                dropUn(kind);
                fallback(kind, err);
            });
            addUn(kind, un); active[kind] = true;
        }
        function fallback(kind, err) {   // أي خلل: نرجع للنمط القديم لهذه المجموعة ونوقف النمط الجديد 24 ساعة
            kill((err && (err.code || err.message)) || 'error'); active[kind] = false;
            try { env.legacyStart(kind); } catch (e) { /* تجاهل */ }
        }
        async function startKind(kind) {
            if (stopped || active[kind]) return;
            let ok = false;
            try {
                if (baseValid(kind)) { setAll(kind, derive(kind, getBase())); cur[kind] = +L.get(cKey(kind)); ok = true; if (kind === 'pub') { Object.keys(maps.pub).forEach(k => { delete stampMs[k]; }); preseed(); } }
                else {
                    const p = env.prog ? env.prog('تحميل الأصناف من السحابة') : null;
                    try { await fullLoad(kind); L.set('diwanSuFull', env.now()); ok = true; if (p) p.ok('تم التحميل'); }
                    catch (e) { if (p) p.fail('تعذر التحميل', e && e.message); throw e; }
                }
            } catch (e) { log('susync base failed', kind, e && e.message); fallback(kind, e); return; }
            if (stopped) return;
            if (kind === 'stock' || kind === 'cost') startSide(kind);
            publish(kind); mark(kind);
            listen(kind);
        }
        // الأصناف تبدأ قبل تسجيل الدخول: نملأ المخزون والتكلفة من النسخة المحلية فوراً حتى لا تفقد المواد كمياتها عند أول إعادة بناء
        function preseed() {
            ['stock', 'cost'].forEach(k => { const m = L.get(bKey(k)), c = +L.get(cKey(k)) || 0; if (m && m === L.get('diwanSuUid') && c && env.now() - c <= MAX_AGE_MS) { const mp = derive(k, getBase()); const t = liveMap(k); Object.keys(mp).forEach(id => { if (t[id] === undefined) t[id] = mp[id]; }); } });
        }
        function startSide(kind) {   // مستندات خاصة بلا ختم: _setup (وضع التأسيس) و_meta (فصل التكلفة)
            const id = kind === 'stock' ? '_setup' : '_meta';
            try {
                const un = env.db().collection(COLL[kind]).doc(id).onSnapshot(d => {
                    const on = !!(d.exists && (d.data() || {}).on);
                    if (kind === 'stock') env.setSetupMode(on); else { env.setCostSplit(on); L.set('diwanSuSplit', on ? '1' : '0'); }
                    env.rebuild(false);
                }, () => { });
                addUn(kind + 'Side', un);
            } catch (e) { /* تجاهل */ }
        }
        S.startProducts = () => { stopped = false; return startKind('pub'); };
        S.startStock = () => { stopped = false; uid = env.uid(); return startKind('stock'); };
        S.startCost = () => { stopped = false; uid = env.uid(); return startKind('cost'); };

        // ---- المحذوفات ----
        S.startTomb = function () {
            if (!S.on() || active.tomb || !env.uid()) return;
            const F = env.F; cur.tomb = +L.get(cKey('tomb')) || +L.get(cKey('pub')) || cur.pub || (env.now() - HEAD_MS);
            const q = env.db().collection('pharmacy_tomb').where('_su', '>', F.Timestamp.fromMillis(Math.max(0, cur.tomb - OVERLAP_MS)));
            const un = q.onSnapshot(snap => {
                let n = 0;
                snap.docChanges().forEach(ch => {
                    if (ch.type === 'removed') return;
                    const d = ch.doc.data() || {}, t = tsMs(d._su), id = String(d.id !== undefined ? d.id : ch.doc.id);
                    if (t > cur.tomb) cur.tomb = t;
                    if (stampMs[id] && stampMs[id] >= t) return;   // أُعيد إنشاء المادة بعد الحذف
                    let hit = false;
                    ['pub', 'stock', 'cost'].forEach(k => { const m = k === 'pub' ? maps.pub : (liveMap(k) || {}); if (m[id] !== undefined) { delete m[id]; hit = true; } });
                    if (hit) { n++; delete stampMs[id]; }
                });
                if (n) { env.setPub(Object.keys(maps.pub).map(k => maps.pub[k])); env.rebuild(true); }
                if (!pend) pend = {}; pend.tomb = { b: 'tomb', c: cur.tomb };
            }, err => { log('susync tomb error', err && err.code); });
            addUn('tomb', un); active.tomb = true;
        };

        // ---- حفظ المؤشر مع النسخة المحلية ----
        S.rebuilt = function () {   // بعد إعادة بناء قائمة المواد من الخرائط: هذه هي النقطة التي تُعتمد مؤشراتها
            const p = {};
            ['pub', 'stock', 'cost'].forEach(k => { if (active[k]) p[k] = { b: k === 'pub' ? 'pub' : uid, c: cur[k] }; });
            if (active.tomb) p.tomb = { b: 'tomb', c: cur.tomb };
            pend = p;
        };
        S.commit = function () {
            if (!pend) return; Object.keys(pend).forEach(k => { L.set(bKey(k), pend[k].b); L.set(cKey(k), pend[k].c); if (k === 'stock' || k === 'cost') L.set('diwanSuUid', pend[k].b); }); pend = null;
        };
        S.invalidate = function () { ['pub', 'stock', 'cost', 'tomb'].forEach(k => { L.del(bKey(k)); L.del(cKey(k)); }); pend = null; };

        // ---- المطابقة الكاملة ----
        S.reconcile = async function (prog) {
            if (!S.on()) return false;
            const kinds = ['pub', 'stock', 'cost'].filter(k => active[k]); let n = 0;
            for (const k of kinds) {
                try { n += await fullLoad(k); } catch (e) { if (prog) prog.fail('تعذر التحديث الكامل', e && e.message); return false; }
                publish(k);
            }
            L.set('diwanSuFull', env.now()); S.rebuilt();
            if (prog) prog.ok('تم التحديث الكامل: ' + n + ' مستند');
            return true;
        };
        S.needRecon = () => S.on() && env.now() - S.lastFull() > RECON_MS;

        S.stopPrivate = function () {   // عند تسجيل الخروج: يتوقف المخزون والتكلفة والمحذوفات فقط (الأصناف العامة تبقى كما في النمط القديم)
            ['stock', 'stockSide', 'cost', 'costSide', 'tomb', 'flag'].forEach(dropUn);
            active.stock = active.cost = active.tomb = false; maps.stock = {}; maps.cost = {}; pend = null;
        };
        S.stop = function () {
            stopped = true; Object.keys(unsubs).forEach(dropUn);
            Object.keys(active).forEach(k => { active[k] = false; }); maps.pub = {}; pend = null;
        };
        S._maps = maps; S._cur = cur; S._stampMs = stampMs;

        // ---- الختم التلقائي للكتابات ----
        S.installStamp = function (F) {
            if (!F || S._stampInstalled) return; S._stampInstalled = true;
            const isTarget = ref => !!(ref && ref.parent && KIND[ref.parent.id] && String(ref.id).charAt(0) !== '_');
            const ts = () => F.FieldValue.serverTimestamp();
            const isPlain = d => { if (!d || typeof d !== 'object') return false; const p = Object.getPrototypeOf(d); return p === null || p === Object.prototype || !!(p && p.constructor && p.constructor.name === 'Object'); };   // يقبل كائنات صفحات أخرى (iframe) أيضاً، ويرفض FieldPath وما شابه
            const stamp = d => isPlain(d) ? Object.assign({}, d, { _su: ts() }) : d;
            const tombOf = ref => ref.firestore.collection('pharmacy_tomb').doc(String(ref.id));
            const tombData = ref => ({ id: String(ref.id), c: 'products', at: new Date().toISOString(), _su: ts() });
            const wrap = (proto, name, make) => { if (!proto || typeof proto[name] !== 'function') return; const o = proto[name]; proto[name] = make(o); };
            const optsStamp = a => { if (a && Array.isArray(a.mergeFields)) return Object.assign({}, a, { mergeFields: a.mergeFields.concat(['_su']) }); return a; };
            const DR = F.DocumentReference && F.DocumentReference.prototype, WB = F.WriteBatch && F.WriteBatch.prototype, TX = F.Transaction && F.Transaction.prototype;
            wrap(DR, 'set', o => function (data, opts) { if (!S.rulesOk() || !isTarget(this)) return o.apply(this, arguments); return opts === undefined ? o.call(this, stamp(data)) : o.call(this, stamp(data), optsStamp(opts)); });
            const upd = (o, ref, args, self, shift) => { const a = Array.prototype.slice.call(args); if (isPlain(a[shift])) a[shift] = stamp(a[shift]); else a.push('_su', ts()); return o.apply(self, a); };
            wrap(DR, 'update', o => function () { if (!S.rulesOk() || !isTarget(this)) return o.apply(this, arguments); return upd(o, this, arguments, this, 0); });
            [WB, TX].forEach(P => {
                wrap(P, 'set', o => function (ref, data, opts) { if (!S.rulesOk() || !isTarget(ref)) return o.apply(this, arguments); return opts === undefined ? o.call(this, ref, stamp(data)) : o.call(this, ref, stamp(data), optsStamp(opts)); });
                wrap(P, 'update', o => function (ref) { if (!S.rulesOk() || !isTarget(ref)) return o.apply(this, arguments); const a = Array.prototype.slice.call(arguments); if (isPlain(a[1])) a[1] = stamp(a[1]); else a.push('_su', ts()); return o.apply(this, a); });
                wrap(P, 'delete', o => function (ref) {
                    const r = o.apply(this, arguments);
                    if (S.rulesOk() && ref && ref.parent && ref.parent.id === 'pharmacy_products' && String(ref.id).charAt(0) !== '_') { try { this.set(tombOf(ref), tombData(ref)); } catch (e) { /* تجاهل */ } }
                    return r;
                });
            });
            wrap(DR, 'delete', o => function () {
                const r = o.apply(this, arguments), self = this;
                if (S.rulesOk() && self && self.parent && self.parent.id === 'pharmacy_products' && String(self.id).charAt(0) !== '_') { try { const t = tombOf(self).set(tombData(self)); if (t && t.catch) t.catch(() => { }); } catch (e) { /* تجاهل */ } }
                return r;
            });
        };

        // ---- فحص القواعد والمفتاح ----
        S.probe = async function () {   // قراءة مستند واحد: إن كانت القواعد منشورة تنجح (حتى لو غير موجود)، وإلا permission-denied
            try { await env.db().collection('pharmacy_tomb').doc('_probe').get(); L.set('diwanSuRules', '1'); return true; }
            catch (e) { if (e && e.code === 'permission-denied') { L.set('diwanSuRules', '0'); return false; } return S.rulesOk(); }
        };
        S.watchFlag = function () {
            try {
                const un = env.db().collection('pharmacy').doc('susync').onSnapshot(d => {
                    const on = !!(d.exists && (d.data() || {}).on), was = S.flagOn();
                    L.set('diwanSuOn', on ? '1' : '0');
                    if (on !== was && env.onFlagChange) env.onFlagChange(on);
                }, () => { });
                addUn('flag', un);
            } catch (e) { /* تجاهل */ }
        };
        S.status = () => ({ on: S.on(), rules: S.rulesOk(), flag: S.flagOn(), killed: S.killed(), lastFull: S.lastFull() });
        S.afterAuth = async function () {
            uid = env.uid();
            await S.probe(); S.watchFlag(); if (S.on()) S.startTomb();
        };

        // ---- التفعيل (للمدير): ختم كل المستندات القديمة مرة واحدة ثم رفع المفتاح ----
        S.enable = async function (prog) {
            const F = env.F, db = env.db();
            if (!(await S.probe())) throw new Error('rules-missing');
            let need = []; const list = [];
            for (const kind of ['pub', 'stock', 'cost']) {
                const snap = await db.collection(COLL[kind]).get();
                snap.forEach(d => { if (String(d.id).charAt(0) === '_') return; if (!tsMs((d.data() || {})._su)) list.push(COLL[kind] + '/' + d.id); });
            }
            if (env.grantWrites) env.grantWrites(list.length + 50);
            let done = 0;
            for (let i = 0; i < list.length; i += 400) {
                const b = db.batch();
                list.slice(i, i + 400).forEach(p => { const [c, id] = p.split('/'); b.set(db.collection(c).doc(id), { _su: F.FieldValue.serverTimestamp() }, { merge: true }); });
                await b.commit(); done += Math.min(400, list.length - i);
                if (prog) prog.tick(done, list.length, 'ختم ' + done + ' من ' + list.length);
            }
            await db.collection('pharmacy').doc('susync').set({ on: true, at: new Date().toISOString() });
            L.set('diwanSuOn', '1'); L.del('diwanSuKill'); S.invalidate();
            return list.length;
        };
        S.purgeTomb = async function () {   // صيانة: المحذوفات الأقدم من 45 يوماً (والمؤشر المحلي لا يتجاوز 30 يوماً)
            const F = env.F, db = env.db(), lim = F.Timestamp.fromMillis(env.now() - 45 * 864e5);
            const snap = await db.collection('pharmacy_tomb').where('_su', '<', lim).limit(100).get();
            if (snap.empty) return 0; const b = db.batch(); let n = 0; snap.forEach(d => { b.delete(d.ref); n++; }); await b.commit(); return n;
        };
        S.disable = async function () {
            await env.db().collection('pharmacy').doc('susync').set({ on: false, at: new Date().toISOString() });
            L.set('diwanSuOn', '0'); S.invalidate();
        };
        return S;
    }
    // ---- واجهة المدير (شاشة حالة المزامنة) ----
    function suPanelHtml() {
        try {
            if (!root.SU || typeof userRole === 'undefined' || userRole !== 'owner') return '';
            const st = SU.status(), when = st.lastFull ? new Date(st.lastFull).toLocaleString('ar-IQ') : 'لم يُحمَّل بعد';
            const txt = !st.rules ? 'تحتاج نشر قواعد Firestore الجديدة (ملف firestore.rules) أولاً.' : st.killed ? 'أُوقفت مؤقتاً بعد خطأ، ويعمل التطبيق بالنمط الكامل حالياً.' : st.flag ? 'مفعّلة: تُقرأ الأصناف المتغيّرة فقط عند الفتح. آخر تحديث كامل: ' + when : 'متوقفة: يقرأ كل جهاز كل الأصناف عند كل فتح بعد غياب.';
            return '<div class="qk-row"><div><b>المزامنة الموفِّرة للقراءات</b><small>' + txt + '</small></div><label class="setup-sw"><input type="checkbox" id="suSw" ' + (st.flag ? 'checked' : '') + ' onchange="suToggle(this)"><i></i></label></div>'
                + (st.flag ? '<div class="ds-bk-b"><button type="button" onclick="suFullNow()">تحديث كامل للأصناف</button></div>' : '');
        } catch (e) { return ''; }
    }
    async function suToggle(cb) {
        const on = cb.checked, ask = (t, x, b) => Swal.fire({ icon: 'question', title: t, text: x, showCancelButton: true, confirmButtonText: b, cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        const r = await ask(on ? 'تفعيل المزامنة الموفِّرة؟' : 'إيقاف المزامنة الموفِّرة؟', on ? 'ستُختم كل الأصناف مرة واحدة (نحو ثلاثة أضعاف عدد الأصناف كتابةً)، ثم يعتمد كل جهاز على المتغيّر فقط. يلزم نشر قواعد Firestore الجديدة قبل ذلك.' : 'سيعود كل جهاز إلى قراءة كل الأصناف عند الفتح بعد إعادة تشغيل التطبيق.', on ? 'تفعيل' : 'إيقاف');
        if (!r.isConfirmed) { cb.checked = !on; return; }
        const h = Prog.start(on ? 'تفعيل المزامنة الموفِّرة' : 'إيقاف المزامنة الموفِّرة', { text: 'جاري التنفيذ...', indeterminate: false });
        try {
            if (on) { const n = await SU.enable(h); h.ok('تم التفعيل (ختم ' + n + ' مستند)'); } else { await SU.disable(); h.ok('تم الإيقاف'); }
            Swal.fire({ icon: 'success', title: on ? 'فُعّلت المزامنة الموفِّرة' : 'أُوقفت المزامنة الموفِّرة', text: 'أعد فتح التطبيق على كل جهاز ليُطبَّق التغيير.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
            try { if (typeof showSyncStatus === 'function' && typeof currentView !== 'undefined' && currentView === 'sync') showSyncStatus(); } catch (e2) { /* تجاهل */ }
        } catch (e) {
            cb.checked = !on; h.fail('تعذر التنفيذ', (e && e.message) || '');
            Swal.fire({ icon: 'error', title: e && e.message === 'rules-missing' ? 'قواعد Firestore غير منشورة' : 'تعذر التنفيذ', text: e && e.message === 'rules-missing' ? 'انشر ملف firestore.rules الجديد من وحدة تحكم Firebase ثم أعد المحاولة.' : ((e && e.message) || ''), confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' });
        }
    }
    async function suFullNow() {
        const r = await Swal.fire({ icon: 'question', title: 'تحديث كامل للأصناف؟', text: 'سيقرأ التطبيق كل الأصناف والمخزون والكلفة من السحابة مرة واحدة (يستهلك من الحصة المجانية).', showCancelButton: true, confirmButtonText: 'تحديث', cancelButtonText: 'إلغاء', confirmButtonColor: '#0f1c38' });
        if (!r.isConfirmed) return;
        const h = Prog.start('تحديث كامل للأصناف', { text: 'جاري القراءة من السحابة...' });
        try { const ok = await SU.reconcile(h); if (!ok && h.state === 'run') h.fail('تعذر التحديث الكامل'); } catch (e) { h.fail('تعذر التحديث الكامل', (e && e.message) || ''); }
    }
    root.suPanelHtml = suPanelHtml; root.suToggle = suToggle; root.suFullNow = suFullNow;
    root.makeSu = makeSu; root.__suTsMs = tsMs;
    if (typeof module !== 'undefined' && module.exports) module.exports = { makeSu, tsMs };
})(typeof window !== 'undefined' ? window : globalThis);
