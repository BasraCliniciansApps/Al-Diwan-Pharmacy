import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';

import 'catalog/catalog_index.dart';
import 'catalog/product.dart';
import 'catalog/scan_logic.dart';
import 'catalog/stock_logic.dart';
import 'repositories.dart';
import 'user_profile.dart';

/// يدمج pharmacy_products + pharmacy_stock (+ pharmacy_cost للمدير) كما يفعل rebuildProducts في الويب،
/// ويعيد البناء مرة واحدة بعد 150ms من آخر تغيير (حماية من إعادة الرسم المتكررة).
class FirebaseCatalogRepository implements CatalogRepository {
  FirebaseCatalogRepository(this.profile, {FirebaseFirestore? db})
      : _db = db ?? FirebaseFirestore.instance;

  final UserProfile profile;
  final FirebaseFirestore _db;

  bool get _canStock =>
      profile.isOwner || profile.can('stockView') || profile.can('sell') || profile.can('invList');

  @override
  Stream<CatalogSnapshot> watchCatalog() {
    late StreamController<CatalogSnapshot> ctl;
    final subs = <StreamSubscription>[];
    var pub = <Map<String, dynamic>>[];
    var stock = <String, Map<String, dynamic>>{};
    var cost = <String, Map<String, dynamic>>{};
    var setup = false, cache = true, havePub = false;
    Timer? t;

    void rebuild() {
      t?.cancel();
      t = Timer(const Duration(milliseconds: 150), () {
        if (!havePub || ctl.isClosed) return;
        final merged = <Product>[
          for (final d in pub)
            Product({
              ...d,
              ...?stock['${d['id']}'],
              ...?cost['${d['id']}'],
            })
        ];
        ctl.add(CatalogSnapshot(CatalogIndex(merged), setupMode: setup, fromCache: cache));
      });
    }

    ctl = StreamController<CatalogSnapshot>(
      onListen: () {
        subs.add(_db.collection('pharmacy_products').snapshots(includeMetadataChanges: true).listen((s) {
          pub = [for (final d in s.docs) d.data()];
          havePub = true;
          cache = s.metadata.isFromCache;
          rebuild();
        }, onError: ctl.addError));
        if (_canStock) {
          subs.add(_db.collection('pharmacy_stock').snapshots().listen((s) {
            final m = <String, Map<String, dynamic>>{};
            var sm = false;
            for (final d in s.docs) {
              if (d.id == '_setup') {
                sm = d.data()['on'] == true;
              } else {
                m[d.id] = d.data();
              }
            }
            stock = m;
            setup = sm;
            rebuild();
          }, onError: (_) {})); // صلاحية مفقودة: نكمل بلا كميات
        }
        if (profile.isOwner) {
          subs.add(_db.collection('pharmacy_cost').snapshots().listen((s) {
            final m = <String, Map<String, dynamic>>{};
            for (final d in s.docs) {
              if (d.id != '_meta') m[d.id] = d.data();
            }
            cost = m;
            rebuild();
          }, onError: (_) {}));
        }
      },
      onCancel: () {
        t?.cancel();
        for (final s in subs) {
          s.cancel();
        }
      },
    );
    return ctl.stream;
  }

  @override
  Stream<AlertConfig> watchAlertConfig() => _db
      .collection('pharmacy')
      .doc('metadata')
      .snapshots()
      .map((d) => AlertConfig.fromMetadata(d.data()));

  @override
  Stream<ScanConfig> watchScanConfig() => _db
      .collection('pharmacy')
      .doc('metadata')
      .snapshots()
      .map((d) => ScanConfig.fromMap(d.data()?['scan'] is Map ? Map<String, dynamic>.from(d.data()!['scan'] as Map) : null));

  @override
  Stream<List<Map<String, dynamic>>> watchPurchases() {
    if (!(profile.isOwner || profile.can('purchases'))) return Stream.value(const []);
    return _db
        .collection('pharmacy_purchases')
        .snapshots()
        .map((s) => [for (final d in s.docs) d.data()])
        .handleError((_) {});
  }
}
