import 'barcode.dart';
import 'js_compat.dart';

bool _truthy(Object? v) =>
    v != null && v != false && v != 0 && v != '' && !(v is double && v.isNaN);

/// مادة مدموجة من pharmacy_products + pharmacy_stock (+ pharmacy_cost للمدير).
/// تحتفظ بالمستند الخام كما هو، وتوفّر وصولاً بسلوك JavaScript نفسه.
class Product {
  Product(this.raw);
  final Map<String, dynamic> raw;

  int get id => jsInt(raw['id']);
  String get key => (raw['id'] ?? '').toString();
  String get name => jsStr(raw['name']).trim();
  String get brand => jsStr(raw['brand']).trim();
  String get meta => jsStr(raw['meta']);
  String get img => jsStr(raw['img']);
  double get price => jsNum(raw['price']);
  bool get arch => _truthy(raw['arch']);
  int get qty => jsInt(raw['qty']);
  int get loose => jsInt(raw['loose']);
  String? get form => _truthy(raw['form']) ? raw['form'].toString() : null;
  String get formOther => jsStr(raw['formOther']);
  int get subCount {
    final n = jsInt(raw['subCount']);
    return n > 1 ? n : 0;
  }

  bool get hasRetail => subCount > 1;
  String get subType => _truthy(raw['subType']) ? raw['subType'].toString() : 'جزء';

  double get subPrice {
    final sp = jsNum(raw['subPrice']);
    if (sp > 0) return sp;
    return hasRetail ? (price / subCount).roundToDouble() : 0;
  }

  /// الكمية متوفرة؟ (مرآة isInStock)
  bool get inStock {
    if (arch) return false;
    if (raw['qty'] != null) return qty > 0 || loose > 0;
    return raw['inStock'] == true;
  }

  bool get hasUnits => qty > 0 || loose > 0;

  List<String> get cats {
    final extras = raw['extraCategories'];
    return [
      raw['category'],
      if (extras is List) ...extras.where((x) => x is String && x.isNotEmpty),
    ].where(_truthy).map((e) => e.toString()).toList();
  }

  List<String> get barcodes {
    final set = <String>[];
    final more = raw['barcodes'];
    for (final b in [raw['barcode'], if (more is List) ...more]) {
      final c = cleanBarcode(b);
      if (c.isNotEmpty && !set.contains(c)) set.add(c);
    }
    return set;
  }
}
