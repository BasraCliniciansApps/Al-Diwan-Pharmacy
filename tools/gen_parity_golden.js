#!/usr/bin/env node
// يولّد مخرجات مرجعية (golden) من دوال الويب الأصلية لاختبارات تكافؤ Dart:
//   node tools/gen_parity_golden.js
// يستخرج الدوال من data.js / admin.js كما هي (بلا تعديل) ويشغّلها على حالات مولّدة بثبات.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const SRC = { 'data.js': read('data.js'), 'admin.js': read('admin.js') };

function extractFn(name) {
  for (const f of Object.keys(SRC)) {
    const lines = SRC[f].split('\n');
    const i = lines.findIndex(l => l.startsWith('function ' + name + '('));
    if (i < 0) continue;
    const bal = s => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
    if (bal(lines[i]) === 0 && /\}\s*(\/\/.*)?$/.test(lines[i])) return lines[i];
    let j = i + 1;
    while (j < lines.length && !/^\}/.test(lines[j])) j++;
    return lines.slice(i, j + 1).join('\n');
  }
  throw new Error('function not found: ' + name);
}
function extractBlock(startRe) {
  const lines = SRC['data.js'].split('\n');
  const s = lines.findIndex(l => startRe.test(l));
  let e = s; while (!/^\];/.test(lines[e])) e++;
  return lines.slice(s, e + 1).join('\n');
}

const FIXED_NOW = new Date(2026, 10, 16, 9, 0, 0).getTime();   // 2026-11-16
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(FIXED_NOW); } static now() { return FIXED_NOW; } }

const names = ['normSearch', 'editDistanceWithin', 'tokenMatchScore', 'searchScore', 'searchIndexOf', 'extrasOf', 'catsOf',
  'cleanBarcode', 'parseGS1', 'gs1Exp', 'barcodeKeys', 'barcodesOf', 'fixMetaOrder', 'dispForm', 'packLine', 'dispParts', 'dispName',
  'subCountOf', 'hasRetail', 'subTypeOf', 'stockLabel', 'getProductExpiryDates', 'btKey', 'btDate', 'btPr', 'btSc', 'getBatches',
  'hasUnits', 'getMinQty', 'isLowStock', 'expiryDaysOf', 'alertKinds', 'isInStock'];
const code = [
  'const SEARCH_IDX = new WeakMap(); const alertMonths = [1, 3, 6]; const lowStockThreshold = 2;',
  'const mkForm = (id, txt, cls, g, re) => ({ id, txt, cls, g, re: re || null });',
  extractBlock(/^const FORMS = \[/),
  ...names.map(extractFn),
  'this.__api = { normSearch, searchScore, searchIndexOf, barcodeKeys, parseGS1, fixMetaOrder, dispName, packLine, stockLabel, getBatches, alertKinds, isLowStock, isInStock, getProductExpiryDates };',
].join('\n');
const ctx = vm.createContext({ Date: FakeDate, console });
vm.runInContext(code, ctx);
const api = ctx.__api;

// ---- مولّد حالات ثابت ----
let seed = 20261116; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];
const NAMES = ['Panadol Extra 500mg', 'بنادول إكسترا', 'Augmentin 1g', 'اوغمنتين ١٠٠٠', 'Voltaren Emulgel 1%', 'فولتارين جل', 'Amoxil 500', 'أموكسيل كبسول',
  'Zyrtec 10mg', 'زيرتك', 'Cetaphil Moisturizing Cream', 'سيتافيل كريم مرطب', 'Brufen 400', 'بروفين', 'Nexium 40mg', 'نيكسيوم', 'Lantus SoloStar', 'لانتوس', 'Vitamin C 1000', 'فيتامين سي فوار'];
const BRANDS = ['GSK', 'Pfizer', 'سامراء', 'Galderma', 'Bayer', 'GENERIC', ''];
const METAS = ['30 Tablets', 'Tablets | Film 20', '120 ml | Syrup', 'Syrup | 100 ml', '50 g', 'Cream | 30 g', '', '10 Capsules', 'Drops | 15 ml'];
const FORMS_IDS = ['', '', 'other', 'efferpowder', 'ovule', 'condom'];
const mon = n => { const d = new Date(2026, 10 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
function mkProduct(i) {
  const sc = pick([0, 0, 0, 10, 4]);
  const p = { id: 1000 + i, name: pick(NAMES), brand: pick(BRANDS), meta: pick(METAS), form: pick(FORMS_IDS), price: pick([0, 3500, 7250, 12000]),
    qty: pick([0, 1, 2, 3, 8, 20]), loose: sc ? pick([0, 1, 3]) : 0, subCount: sc || undefined, subType: sc ? pick(['شريط', 'حبة', undefined]) : undefined,
    arch: rnd() < .08, keywords: pick(['', 'مسكن صداع', 'antibiotic']), activeIngredient: pick(['', 'Paracetamol', 'ديكلوفيناك']),
    details: pick(['', 'يستعمل للألم']), category: pick(['', 'مسكنات', 'مضادات حيوية']), barcode: pick(['', '6291041500213', '5000158062276']) };
  if (p.form === 'other') p.formOther = pick(['Gel', 'Lozenge']);
  if (p.minQty === undefined && rnd() < .3) p.minQty = pick([0, 1, 5]);
  const mode = pick(['none', 'legacy1', 'legacyN', 'bt', 'bt']);
  if (mode === 'legacy1') { p.expiryDate = mon(pick([-1, 1, 2, 4, 8])); }
  if (mode === 'legacyN') { p.expiryDates = [mon(2), mon(7)]; }
  if (mode === 'bt') {
    p.bt = {}; const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) { const e = pick([mon(-2), mon(0), mon(1), mon(3), mon(5), mon(12), '']); const pr = rnd() < .2 ? pick([4000, 8000]) : 0; const key = (e ? e.replace('-', '_') : 'none') + (pr ? '~' + pr : ''); p.bt[key] = { q: Math.floor(rnd() * 5), l: sc > 1 ? Math.floor(rnd() * sc) : 0, ...(rnd() < .15 ? { d: 1 } : {}) }; }
  }
  return JSON.parse(JSON.stringify(p));
}
const products = Array.from({ length: 80 }, (_, i) => mkProduct(i));
const queries = ['panadol', 'بنادول', 'الاوغمنتين', 'augmentn', 'voltarin', 'فيتامين سي', 'paracetamol', '6291041500213', 'مسكن', 'cetaphil cream', 'سيتافيل', 'zzzz', '', 'اموكسيل', 'نيكسيوم 40'];
const barcodes = ['6291041500213', '06291041500213', '(01)06291041500213(17)271100(10)AB12', '0106291041500213172711001 0AB12', '5000158062276', 'abc-123', '12345678', ''];

const out = {
  fixedToday: '2026-11-16',
  normSearch: ['  Ótrivin  ٣ملغ ', 'أَلْبَنادول', 'الدواء الجديد', 'ال', 'إبرة', 'مؤتمر', 'ئ ى ة', 'Vitamin-C 1000!', ''].map(s => [s, api.normSearch(s)]),
  fixMeta: METAS.concat(['Tablets | Film 20', 'ml | Syrup 100', 'Syrup | 100 ml', 'Cream | 30 g']).map(s => [s, api.fixMetaOrder(s)]),
  products: products.map(p => ({
    p,
    dispName: api.dispName(p, false), dispNamePart: api.dispName(p, true), packLine: api.packLine(p), stockLabel: api.stockLabel(p),
    inStock: api.isInStock(p), low: api.isLowStock(p), batches: api.getBatches(p), expiryDates: api.getProductExpiryDates(p),
    alert: (() => { const k = api.alertKinds(p); return { days: k.days, date: k.date, bq: k.bq || null, expired: k.expired, m1: k.m1, m3: k.m3, m6: k.m6, low: k.low, any: k.any }; })(),
  })),
  search: queries.map(q => { const n = api.normSearch(q), t = n ? n.split(' ') : []; return { q, scores: products.map(p => api.searchScore(p, n, t)) }; }),
  barcodes: barcodes.map(b => [b, [...api.barcodeKeys(b)].sort()]),
  gs1: barcodes.map(b => [b, api.parseGS1(b)]),
};
const dest = path.join(root, 'flutter', 'packages', 'core', 'test', 'golden');
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(path.join(dest, 'parity.json'), JSON.stringify(out));
console.log('products', products.length, 'queries', queries.length, '->', path.join(dest, 'parity.json'));
