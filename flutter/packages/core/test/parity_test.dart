import 'dart:convert';
import 'dart:io';

import 'package:diwan_core/diwan_core.dart';
import 'package:flutter_test/flutter_test.dart';

/// تكافؤ مع الويب: المخرجات المرجعية مولَّدة من دوال data.js/admin.js نفسها
/// (node tools/gen_parity_golden.js) ثم يُتأكد أن منطق Dart يعطي النتائج حرفياً.
void main() {
  final g = jsonDecode(File('test/golden/parity.json').readAsStringSync()) as Map<String, dynamic>;
  final today = DateTime(2026, 11, 16);
  const cfg = AlertConfig();
  final prods = (g['products'] as List).cast<Map<String, dynamic>>();

  test('normSearch', () {
    for (final e in g['normSearch'] as List) {
      expect(normSearch(e[0]), e[1], reason: 'normSearch(${e[0]})');
    }
  });

  test('fixMetaOrder', () {
    for (final e in g['fixMeta'] as List) {
      expect(fixMetaOrder(e[0]), e[1], reason: 'fixMeta(${e[0]})');
    }
  });

  test('الاسم وسطر العبوة وعرض الكمية', () {
    for (final x in prods) {
      final p = Product(Map<String, dynamic>.from(x['p'] as Map));
      expect(dispName(p), x['dispName'], reason: 'dispName ${p.id}');
      expect(dispName(p, part: true), x['dispNamePart'], reason: 'part ${p.id}');
      expect(packLine(p), x['packLine'], reason: 'packLine ${p.id}');
      expect(stockLabel(p), x['stockLabel'], reason: 'stockLabel ${p.id}');
      expect(p.inStock, x['inStock'], reason: 'inStock ${p.id}');
      expect(isLowStock(p, cfg), x['low'], reason: 'low ${p.id}');
    }
  });

  test('الدفعات وتواريخ النفاذ', () {
    for (final x in prods) {
      final p = Product(Map<String, dynamic>.from(x['p'] as Map));
      expect(productExpiryDates(p), x['expiryDates'], reason: 'dates ${p.id}');
      final want = (x['batches'] as List).cast<Map<String, dynamic>>();
      final got = getBatches(p);
      expect(got.length, want.length, reason: 'batches count ${p.id}');
      for (var i = 0; i < want.length; i++) {
        expect(got[i].e, want[i]['e'], reason: 'batch e ${p.id}#$i');
        expect(got[i].q, want[i]['q'], reason: 'batch q ${p.id}#$i');
        expect(got[i].l, want[i]['l'], reason: 'batch l ${p.id}#$i');
        expect(got[i].pr, (want[i]['pr'] ?? 0), reason: 'batch pr ${p.id}#$i');
        expect(got[i].legacy, want[i]['legacy'] == null ? null : (want[i]['legacy'] as List).cast<String>());
      }
    }
  });

  test('التنبيهات (صلاحية + كمية قليلة)', () {
    var any = 0;
    for (final x in prods) {
      final p = Product(Map<String, dynamic>.from(x['p'] as Map));
      final w = x['alert'] as Map<String, dynamic>;
      final k = alertKinds(p, cfg, today: today);
      expect(k.days, w['days'], reason: 'days ${p.id}');
      expect(k.date, w['date'], reason: 'date ${p.id}');
      expect(k.expired, w['expired'], reason: 'expired ${p.id}');
      expect(k.m1, w['m1'], reason: 'm1 ${p.id}');
      expect(k.m3, w['m3'], reason: 'm3 ${p.id}');
      expect(k.m6, w['m6'], reason: 'm6 ${p.id}');
      expect(k.low, w['low'], reason: 'low ${p.id}');
      expect(k.any, w['any'], reason: 'any ${p.id}');
      final bq = w['bq'] as Map<String, dynamic>?;
      expect(k.bq?.e, bq?['e'], reason: 'bq.e ${p.id}');
      expect(k.bq?.q, bq?['q'], reason: 'bq.q ${p.id}');
      expect(k.bq?.l, bq?['l'], reason: 'bq.l ${p.id}');
      if (k.any) any++;
    }
    expect(any, greaterThan(20)); // الحالات تغطي التنبيهات فعلاً
  });

  test('البحث: درجات مطابقة لكل مادة ولكل استعلام', () {
    final idx = CatalogIndex([
      for (final x in prods) Product(Map<String, dynamic>.from(x['p'] as Map)),
    ]);
    // الفهرس يرتّب بالأحدث أولاً؛ نبني خريطة id→موضع لمطابقة ترتيب المرجع
    final pos = {for (var i = 0; i < idx.all.length; i++) idx.all[i].id: i};
    for (final s in g['search'] as List) {
      final q = s['q'] as String;
      final scores = (s['scores'] as List).cast<int>();
      for (var i = 0; i < prods.length; i++) {
        final id = (prods[i]['p'] as Map)['id'] as int;
        expect(idx.scoreOf(pos[id]!, q), scores[i], reason: 'search "$q" on $id');
      }
    }
  });

  test('الباركود: مفاتيح المطابقة وGS1', () {
    for (final b in g['barcodes'] as List) {
      expect(barcodeKeys(b[0]).toList()..sort(), (b[1] as List).cast<String>(), reason: 'keys ${b[0]}');
    }
    for (final b in g['gs1'] as List) {
      final r = parseGs1(b[0]);
      final w = b[1] as Map<String, dynamic>?;
      expect(r?.gtin, w?['gtin'], reason: 'gs1 ${b[0]}');
      expect(r?.batch, w?['batch']);
      expect(r?.exp, w?['exp']);
    }
  });

  test('فاحص المادة: النسبة الفعلية وحد الخصم للبائعين (أربع إعدادات)', () {
    final sc = g['sc'] as Map<String, dynamic>;
    final cfgs = [
      for (final c in sc['cfgs'] as List)
        ScanConfig(mode: c['mode'], margin: (c['margin'] as num).toDouble(), step: (c['step'] as num).toDouble()),
    ];
    for (final c in (sc['cases'] as List).cast<Map<String, dynamic>>()) {
      final p = Product({'id': 1, 'price': c['price'], 'costPrice': c['cost']});
      final ex = scExact(p);
      expect(ex, (c['exact'] as num?)?.toDouble(), reason: 'exact ${c['price']}/${c['cost']}');
      final lims = c['lim'] as List;
      for (var i = 0; i < cfgs.length; i++) {
        expect(scLimitFor(p, cfgs[i]), (lims[i] as num?)?.toDouble(),
            reason: 'limit ${c['price']}/${c['cost']} cfg#$i');
      }
    }
  });

  test('حاسبة الخصم (مالك): خسارة/هامش ضعيف/رابح', () {
    const cfg = ScanConfig();
    final p = Product({'id': 1, 'price': 10000, 'costPrice': 8000});
    expect(scCalc(p, cfg, owner: true, d: 30, fin: 7000).cls, 'bad');
    expect(scCalc(p, cfg, owner: true, d: 18, fin: 8200).cls, 'mid');
    expect(scCalc(p, cfg, owner: true, d: 5, fin: 9500).cls, 'ok');
    expect(scCalc(Product({'id': 1, 'price': 10000}), cfg, owner: true, d: 5, fin: 9500).msg, 'لا توجد كلفة');
  });

  test('حاسبة الخصم (بائع): حد dlim دون كشف الكلفة', () {
    const cfg = ScanConfig();
    final p = Product({'id': 1, 'price': 10000, 'dlim': 10});
    expect(scCalc(p, cfg, owner: false, d: 8, fin: 9200).msg, 'آمن');
    expect(scCalc(p, cfg, owner: false, d: 12, fin: 8800).msg, 'يتجاوز الحد الآمن');
    expect(scCalc(Product({'id': 1, 'price': 10000, 'dlim': 0}), cfg, owner: false, d: 1, fin: 9900).msg, 'لا يسمح بخصم');
    expect(scCalc(Product({'id': 1, 'price': 10000}), cfg, owner: false, d: 1, fin: 9900).msg, 'حد الخصم غير محسوب');
  });
}
