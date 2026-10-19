// ============================================================================
// 1. إعدادات FIREBASE (ضع بيانات مشروعك المجاني هنا)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDimxdd2vaKdOFw-IDYfWaivslosGMFVh4",
  authDomain: "al-d1-pharmacy.firebaseapp.com",
  projectId: "al-d1-pharmacy",
  storageBucket: "al-d1-pharmacy.firebasestorage.app",
  messagingSenderId: "670194103463",
  appId: "1:670194103463:web:ab22898112c5a5b9a69782",
  measurementId: "G-MHG8XCN3M8"
};

// ============================================================================
// 2. الأقسام والتصنيفات الافتراضية (قابلة للتعديل من داخل التطبيق)
// ============================================================================
const defaultDepartments = ["قسم الجلدية"];

const defaultSubCategories = [
    "واقيات الشمس",
    "العناية بالشعر والشامبو",
    "غسولات وعلاجات حب الشباب",
    "المرطبات والترميم",
    "التفتيح والتقشير",
    "المضادات الموضعية (بكتيريا/فطريات/طفيليات)",
    "الكورتيزونات والمراهم الموضعية",
    "الأدوية الفموية والشرابات"
];

// ============================================================================
// 3. قائمة الأصناف الـ 166 الكاملة (مدرجة تحت قسم الجلدية ومعالجة اتجاه الأرقام)
// ============================================================================
const defaultProducts = [
    {id: 1, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ISISPHARMA", name: "Uveblock SPF 50+ (Dry Touch)", details: "واقي شمس سائل فائق الجفاف، للبشرة الحساسة والدهنية، لمسة مطفية (Matte)، حماية واسعة الطيف.", meta: "40 ml | Fluid Cream", qty: 5, img: "1001882687.jpg"},
    {id: 2, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ISISPHARMA", name: "Uveblock SPF 50+ (Fluide Invisible)", details: "واقي شمس سائل خفي بدون أثر أبيض، للبشرة الحساسة، مقاوم للماء.", meta: "40 ml | Fluid", qty: 5, img: "1001882688.jpg"},
    {id: 3, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ARDENE SEBUMA", name: "Total Sunblock Cream SPF 50 (Oil Free)", details: "واقي شمس خالٍ من الدهون للبشرة الدهنية والمعرضة لحب الشباب، غني بفيتامين E و C وخلاصة العرقسوس والجوجوبا.", meta: "50 g | Oil Free Cream", qty: 4, img: "1001882711.jpg"},
    {id: 4, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ARDENE DERMOCOSMETICS", name: "Total Sunblock Cream SPF 60 (Tinted)", details: "واقي شمس ملون فيزيائي (خالٍ من الفلاتر الكيميائية) للبشرة الجافة والحساسة، مقاوم للماء والتعرق.", meta: "50 g | Tinted Cream", qty: 4, img: "1001882712.jpg"},
    {id: 5, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ARDENE", name: "Sunscreen Lotion SPF 30 (Oil Free)", details: "لوشن واقي شمس خالٍ من الزيوت للبشرة الدهنية والمعرضة للحبوب، يحتوي على فيتامين E وبيسابولول.", meta: "75 g | Lotion", qty: 4, img: "1001882716.jpg"},
    {id: 6, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ARDENE SUN", name: "Rejusol Sunshield Cream SPF 90 (Anti-Aging)", details: "واقي شمس مضاد للشيخوخة والتجاعيد بلون Peach Beige للبشرة العادية والجافة، يحتوي على Ascorbyl Glucoside وإكليل الجبل.", meta: "SPF 90 | Cream", qty: 3, img: "1001882717.jpg"},
    {id: 7, department: "قسم الجلدية", category: "واقيات الشمس", brand: "ARDENE SUN", name: "Acnesol+ Sunshield Cream SPF 50 (Extra Matt)", details: "واقي شمس للبشرة الدهنية والمعرضة للحبوب بمظهر مطفي ولون بيج طبيعي وتغطية عالية، يحتوي على Sepicontrol A5.", meta: "SPF 50 | Matt Cream", qty: 4, img: "1001882718.jpg"},
    {id: 8, department: "قسم الجلدية", category: "واقيات الشمس", brand: "BIONIKE", name: "Defence B-Lucent Anti-Dark Spots SPF 50", details: "كريم واقي شمس علاجي مضاد للبقع والتصبغات للبشرة المعرضة للكلف وفرط التصبغ.", meta: "SPF 50 | Cream", qty: 3, img: "1001882735.jpg"},
    {id: 9, department: "قسم الجلدية", category: "واقيات الشمس", brand: "PHOTOBLOCK", name: "Photoblock Gel SPF 50", details: "جل واقي شمس خفيف مخصص للبشرة الدهنية والمعرضة لحب الشباب.", meta: "75 g | Gel", qty: 5, img: "1001882755.jpg"},
    {id: 10, department: "قسم الجلدية", category: "واقيات الشمس", brand: "PHOTOBLOCK", name: "Photoblock Plus Cream SPF 50+", details: "كريم واقي شمس مع مفعول مضاد لعلامات تقدم السن والشيخوخة.", meta: "75 g | Cream", qty: 5, img: "1001882756.jpg"},
    {id: 11, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "GEROVITAL", name: "Tratament Expert Anti-Hair Loss Serum", details: "سيروم يترك على فروة الرأس لعلاج تساقط الشعر، يحتوي على Procapil و Bio-Capigen PT.", meta: "Serum | Spray", qty: 3, img: "1001882689.jpg"},
    {id: 12, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "DENIZ", name: "Spray Minoxidil 2% (For Women)", details: "بخاخ مينوكسيديل 2% محلول موضعي لإيقاف تساقط الشعر وإعادة إنباته وتنشيط البصيلات للنساء.", meta: "60 ml | Spray", qty: 6, img: "1001882700.jpg"},
    {id: 13, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "SEBAMED", name: "Anti-Dandruff Shampoo pH 5.5", details: "شامبو طبي مضاد للقشرة للشعر الدهني والفروة المعرضة للقشرة، يحتوي على Piroctone Olamine.", meta: "200 ml | Shampoo", qty: 5, img: "1001882708.jpg"},
    {id: 14, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "SEBAMED", name: "Anti-Hairloss Shampoo pH 5.5", details: "شامبو طبي لتقليل تساقط الشعر وتنشيط الدورة الدموية للفروة بتركيبة NHE والكافيين والجنكة بيلوبا.", meta: "200 ml | Shampoo", qty: 5, img: "1001882709.jpg"},
    {id: 15, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "MOSTAL", name: "Mostal Solution", details: "محلول موضعي لتكثيف الشعر ومنع التساقط وزيادة سماكة الشعرة للرجال والنساء.", meta: "50 ml | Solution", qty: 4, img: "1001882754.jpg"},
    {id: 16, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "KENAZOLE", name: "Kenazole Shampoo (Ketoconazole 2%)", details: "شامبو طبي مضاد للفطريات والقشرة والتهاب الجلد الدهني (Ketoconazole 20mg/1g).", meta: "100 ml | Shampoo", qty: 8, img: "1001882793.jpg"},
    {id: 17, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "DOMINA", name: "Beta-Salic Solution (بيتا-ساليك محلول)", details: "محلول لفروة الرأس (بيتاميثازون + ساليسيليك أسيد) لعلاج صدفية الفروة والإكزيما الدهنية.", meta: "Solution | Scalp", qty: 6, img: "1001882803.jpg"},
    {id: 18, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "PHILADELPHIA", name: "Panthophil Vitamin Hair Tonic", details: "تونيك مقوي ومغذي للشعر بالفيتامينات والبانثينول لتقوية بصيلات الشعر.", meta: "Lotion | Hair Tonic", qty: 4, img: "1001882804.jpg"},
    {id: 19, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "DENIZ", name: "Antibacterial-Antiseborrheic Shampoo", details: "شامبو طبي للشعر والجسم مضاد للبكتيريا والقشرة الدهنية، يحتوي على الكبريت، قطران الصنوبر، ساليسيليك أسيد وبروفيتامين B5.", meta: "Shampoo | Sulfur + Tar", qty: 4, img: "1001882805.jpg"},
    {id: 20, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "TURKUAZ", name: "Minodil X Plus Caffeine Shampoo (Procapil 5%)", details: "شامبو مضاد لتساقط الشعر بتركيز Procapil 5% مع الكافيين، زيت الخروع، زيت الزيتون وفيتامين B5.", meta: "200 ml | Shampoo", qty: 4, img: "1001882806.jpg"},
    {id: 21, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "TURKUAZ", name: "Minodil X Plus Caffeine Spray (Procapil 5%)", details: "بخاخ مقوي ومضاد لتساقط الشعر بتركيز Procapil 5% مع الكافيين وفيتامين B5.", meta: "60 ml | Spray", qty: 4, img: "1001882807.jpg"},
    {id: 22, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "ARDENE HERBA SENSE", name: "Bio-Fort Anti Hair-Loss Shampoo", details: "شامبو عشبي مقوي للشعر الضعيف والمتساقط، غني بـ 10 أعشاب طبيعية، كافيين، وفيتامينات B3, B6, B5.", meta: "Shampoo | Herbal", qty: 4, img: "1001882808.jpg"},
    {id: 23, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "KONIX", name: "Stop Lice Tea Tree Oil Shampoo (ستوب لايس)", details: "شامبو زيت شجرة الشاي المضاد للقمل والصئبان مع مشط خاص بالداخل.", meta: "250 ml | Shampoo", qty: 5, img: "1001882809.jpg"},
    {id: 24, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "UNIREX", name: "Naxoral Shampoo (Ketoconazole 2%)", details: "شامبو مضاد للقشرة والفطريات بتركيز كيتوكونازول 2%.", meta: "Shampoo | Ketoconazole 2%", qty: 6, img: "1001882812.jpg"},
    {id: 25, department: "قسم الجلدية", category: "العناية بالشعر والشامبو", brand: "UNIREX", name: "Selerex Dandruff Shampoo (Selenium Sulfide)", details: "شامبو طبي بتركيز سيلينيوم سلفايد للتحكم بالقشرة المستعصية والتهاب الفروة الدهني والتينيا الملونة.", meta: "200 ml | Shampoo", qty: 5, img: "1001882813.jpg"},
    {id: 26, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "TURKUAZ", name: "Off Acne Soap (صابون أوف أكني)", details: "صابون منظف لعلاج حب الشباب بتأثير ثلاثي (تقشير، تغذية، مضاد بكتيري).", meta: "125 g | Soap Bar", qty: 6, img: "1001882691.jpg"},
    {id: 27, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "LA ROCHE-POSAY", name: "Effaclar Medicated Gel Cleanser (+M)", details: "غسول جل طبي للبشرة الدهنية وحب الشباب، يحتوي على 2% Salicylic Acid و LHA المقشر اللطيف.", meta: "150 ml | Cleanser", qty: 3, img: "1001882692.jpg"},
    {id: 28, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "NOREVA", name: "Exfoliac Intensive Foaming Gel", details: "غسول جل رغوي مكثف لتنقية وتنظيف البشرة الدهنية والمعرضة لحب الشباب (للوجه والجسم).", meta: "200 ml | Wash Gel", qty: 3, img: "1001882693.jpg"},
    {id: 29, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "ARDENE SEBUMA", name: "Salicyl 2 Body Anti-Acne Spray", details: "بخاخ معالج لحبوب الظهر والجسم، يحتوي على Salicylic Acid 2%، Glycolic Acid، و Piroctone Olamine.", meta: "Spray | Body Acne", qty: 4, img: "1001882694.jpg"},
    {id: 30, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "PANOXYL", name: "PanOxyl Acne Foaming Wash 10%", details: "غسول رغوي بنزويل بيروكسايد بأقصى قوة (10% Benzoyl Peroxide) للوجه والجسم للقضاء على بكتيريا حب الشباب.", meta: "156 g | Wash", qty: 4, img: "1001882701.jpg"},
    {id: 31, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "AJANTA", name: "Perobar 2.5% Cleansing Bar", details: "صابونة طبية لحب الشباب بتركيز 2.5% Benzoyl Peroxide لتقليل الدهون وفتح المسام.", meta: "Soap Bar | BPO 2.5%", qty: 6, img: "1001882725.jpg"},
    {id: 32, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "AJANTA", name: "Perobar 5% Cleansing Bar", details: "صابونة طبية لحب الشباب بتركيز 5% Benzoyl Peroxide للبشرة الدهنية وحب الشباب المتوسط إلى الشديد.", meta: "Soap Bar | BPO 5%", qty: 6, img: "1001882726.jpg"},
    {id: 33, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "OZMODERM AUSTRALIA", name: "Acne Clear Cleansing Bar", details: "صابونة طبية للبشرة المعرضة لحب الشباب لتنقية المسام وتقليل الإفرازات الدهنية.", meta: "100 g | Soap Bar", qty: 5, img: "1001882729.jpg"},
    {id: 34, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "DENIZ", name: "Deniz Sulfur Soap (صابون الكبريت)", details: "صابونة الكبريت الطبية لعلاج البثور وحب الشباب والفطريات للوجه والجسم والشعر.", meta: "Soap Bar | Sulfur", qty: 6, img: "1001882732.jpg"},
    {id: 35, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "OZMODERM AUSTRALIA", name: "Antibacterial Bar (Lemon Myrtle Oil)", details: "صابونة مضادة للبكتيريا تقضي على 99.9% من الميكروبات، مناسبة للبشرة الحساسة والاستخدام اليومي.", meta: "100 g | Soap Bar", qty: 5, img: "1001882733.jpg"},
    {id: 36, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "PHILADELPHIA", name: "Clinaderm 1% Topical Solution", details: "محلول موضعي مضاد حيوي (Clindamycin 10mg/ml) لعلاج حب الشباب الالتهابي.", meta: "30 ml | Solution", qty: 8, img: "1001882743.jpg"},
    {id: 37, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "REVUELE", name: "No Problem Facial Wash Gel (Salicylic Acid & Zinc)", details: "غسول جل يومي للبشرة الدهنية والمختلطة بحمض الساليسيليك والزنك لتقليل الشوائب ولمعان البشرة.", meta: "Wash Gel | Salicylic", qty: 5, img: "1001882746.jpg"},
    {id: 38, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "COSRX", name: "Salicylic Acid Daily Gentle Cleanser", details: "غسول كوري لطيف يومي بحمض الساليسيليك 0.5% والمستخلصات النباتية لتنقية المسام وإزالة الدهون.", meta: "150 ml | Cleanser", qty: 4, img: "1001882748.jpg"},
    {id: 39, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "JAMJOOM PHARMA", name: "Acretin 0.025% Cream (Tretinoin)", details: "كريم تريتينوين بتركيز 0.025% لعلاج حب الشباب وتجديد خلايا البشرة.", meta: "30 g | Cream", qty: 10, img: "1001882773.jpg"},
    {id: 40, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "JAMJOOM PHARMA", name: "Acretin 0.05% Cream (Tretinoin)", details: "كريم تريتينوين بتركيز 0.05% لعلاج حب الشباب الرؤوس السوداء والتقشير.", meta: "30 g | Cream", qty: 10, img: "1001882774.jpg"},
    {id: 41, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "AZADERM", name: "Azaderm Cream (Azelaic Acid 20%)", details: "كريم حمض الأزيليك 20% المضاد لحب الشباب والوردية والمفتح للتصبغات وآثار الحبوب.", meta: "30 g | Cream", qty: 8, img: "1001882777.jpg"},
    {id: 42, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "AJANTA", name: "Peroduo Gel (Adapalene + Benzoyl Peroxide)", details: "جل ثنائي المفعول يجمع بين أدابالين وبنزويل بيروكسايد لعلاج حب الشباب الموضعي.", meta: "15 g | Gel", qty: 6, img: "1001882787.jpg"},
    {id: 43, department: "قسم الجلدية", category: "غسولات وعلاجات حب الشباب", brand: "DOMINA", name: "Ben-Oxide 10 Gel (Benzoyl Peroxide 10%)", details: "جل بنزويل بيروكسايد بتركيز 10% لعلاج حب الشباب الموضعي.", meta: "30 g | Gel", qty: 6, img: "1001882786.jpg"},
    {id: 44, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SIMPLE", name: "Hydrating Light Moisturiser", details: "مرطب خفيف سريع الامتصاص للبشرة الحساسة، يحتوي على 1% Niacinamide و Pro-Vitamin B5، خالٍ من العطور.", meta: "125 ml | Lotion", qty: 5, img: "1001882695.jpg"},
    {id: 45, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SIMPLE", name: "Replenishing Rich Moisturiser", details: "مرطب غني للبشرة الجافة والحساسة بالجلسرين النباتي وفيتامينات B5 و E لترطيب عميق.", meta: "125 ml | Cream", qty: 5, img: "1001882696.jpg"},
    {id: 46, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SIMPLE", name: "Water Boost Hydrating Gel Cream", details: "جل كريم مرطب عميق للبشرة الجافة والحساسة بخاصية Water Boost.", meta: "50 ml | Gel Cream", qty: 4, img: "1001882697.jpg"},
    {id: 47, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SIMPLE", name: "Moisturising Facial Wash", details: "غسول وجه مرطب خالٍ من الصابون بنسبة 100% مع فيتامين B5 و E والأحماض الأمينية لجميع أنواع البشرة.", meta: "150 ml | Wash", qty: 5, img: "1001882698.jpg"},
    {id: 48, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "REVUELE", name: "Ceramide Hydrating Cleanser", details: "غسول مرطب بالسيراميد وحمض الهيالورونيك للبشرة الجافة إلى الجافة جداً للوجه والجسم دون خدش الحاجز الجلدي.", meta: "250 ml | Cleanser", qty: 4, img: "1001882699.jpg"},
    {id: 49, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ISISPHARMA", name: "Sensylia 24h Cream", details: "كريم مرطب ومهدئ لمدة 24 ساعة للبشرة الحساسة العادية إلى الجافة.", meta: "40 ml | Cream", qty: 4, img: "1001882702.jpg"},
    {id: 50, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ISISPHARMA", name: "Sensylia 24h Légère Fluid", details: "سائل مرطب ومهدئ خفيف للبشرة الحساسة العادية إلى المختلطة مع لمسة مطفية.", meta: "40 ml | Fluid", qty: 4, img: "1001882703.jpg"},
    {id: 51, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ISISPHARMA", name: "Secalia Face Cream Ultra-Confort", details: "كريم مغذي ومرمم للوجه للبشرة الجافة إلى الجافة جداً والإكزيما.", meta: "40 ml | Cream", qty: 4, img: "1001882704.jpg"},
    {id: 52, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ISISPHARMA", name: "Secalia Body Lotion Ultra-Confort", details: "لوشن مرطب ومغذي للجسم للبشرة الجافة إلى الجافة جداً يرمم الحاجز الجلدي.", meta: "200 ml | Lotion", qty: 4, img: "1001882706.jpg"},
    {id: 53, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ISISPHARMA", name: "Urelia 10 Exfoliating Moisturising Cream", details: "كريم مرطب ومقشر بتركيز يوريا 10% للبشرة شديدة الجفاف والمتقشرة أو المصابة بالتقرن للوجه والجسم.", meta: "150 ml | Cream", qty: 4, img: "1001882707.jpg"},
    {id: 54, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ARDENE", name: "Moisturizing Lotion (Urea 10%)", details: "لوشن مرطب مكثف باليوريا 10% والسيراميد وحمض الهيالورونيك للمناطق شديدة الجفاف والقدمين.", meta: "75 g | Lotion", qty: 5, img: "1001882710.jpg"},
    {id: 55, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ARDENE", name: "Vaseline Cream (With Glycerin)", details: "كريم فازلين طبي مع الجلسرين خالٍ من اللانولين والعطور لترطيب وحماية الجلد المتشقق.", meta: "50 ml | Cream", qty: 6, img: "1001882713.jpg"},
    {id: 56, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ARDENE BEAUTY", name: "Dermaline Repair Cream", details: "كريم مرمم ومهدئ للبشرة المتضررة بعد جلسات الليزر والتقشير، يحتوي على مركب (Mn + Zn + Cu Gluconate).", meta: "40 ml | Repair Cream", qty: 5, img: "1001882715.jpg"},
    {id: 57, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SVR", name: "Xerial 50 Extreme Crème Pieds", details: "كريم مركز جداً بتركيز يوريا نقية 50% وحمض الساليسيليك لإزالة مسامير القدم والتقرنات وتشققات الكعبين في 7 أيام.", meta: "50 ml | Cream", qty: 3, img: "1001882719.jpg"},
    {id: 58, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "NIVEA", name: "Nivea Soft Moisturizing Cream", details: "كريم مرطب ناعم ومنعش بفيتامين E وزيت الجوجوبا للوجه والجسم واليدين.", meta: "75 ml | Cream", qty: 8, img: "1001882720.jpg"},
    {id: 59, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "GLYCERIN", name: "Glycerin Cream (جليسرين كريم الأصلي)", details: "كريم الجلسرين الأحمر الكلاسيكي للترطيب المكثف للجلد الجاف والمتشقق.", meta: "125 g | Cream", qty: 10, img: "1001882721.jpg"},
    {id: 60, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "AJANTA", name: "Aquasoft Cream (Glycerin 15%)", details: "كريم طبي مرطب للبشرة الجافة يحتوي على جلسرين بتركيز 15%.", meta: "50 g | Cream", qty: 6, img: "1001882724.jpg"},
    {id: 61, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SUDOCREM", name: "Sudocrem Antiseptic Healing Cream", details: "كريم مطهر ومرمم للبشرة لحالات التهاب الحفاض، الإكزيما، الجروح السطحية وحروق الشمس.", meta: "Cream | Antiseptic", qty: 8, img: "1001882723.jpg"},
    {id: 62, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "FEMME CARE", name: "Stretch Mark Cream", details: "كريم لتقليل والوقاية من علامات تمدد الجلد أثناء الحمل وتحفيز الكولاجين والمرونة.", meta: "50 ml | Cream", qty: 4, img: "1001882722.jpg"},
    {id: 63, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "AJANTA", name: "Aquasoft Savon (Moisturizing Soap)", details: "صابونة مرطبة لطيفة للبشرة الجافة والحساسة.", meta: "Soap Bar", qty: 6, img: "1001882727.jpg"},
    {id: 64, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "OZMODERM AUSTRALIA", name: "Sensitive Bar Gentle Cleansing Bar", details: "صابونة طبية لطيفة جداً مخصصة لتنظيف البشرة الحساسة والمتهيجة دون جفاف.", meta: "100 g | Soap Bar", qty: 5, img: "1001882730.jpg"},
    {id: 65, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "AVENE", name: "Cicalfate+ Repairing Protective Cream", details: "كريم سيكالفات بلس الشهير لترميم وإصلاح الجلد المتضرر والمتهيج وما بعد الإجراءات التجميلية.", meta: "40 ml | Repair Cream", qty: 4, img: "1001882749.jpg"},
    {id: 66, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "DERMA PELLA", name: "Calm Cream (Soothing Moisturizing Cream)", details: "كريم ملطف ومهدئ ومرطب للبشرة المتهيجة والحساسة.", meta: "75 g | Cream", qty: 5, img: "1001882757.jpg"},
    {id: 67, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "AQUAX", name: "Aquax Cream", details: "كريم مرطب طبي للبشرة الجافة والمتهيجة والمصابة بالحكة والإكزيما.", meta: "150 g | Cream", qty: 8, img: "1001882759.jpg"},
    {id: 68, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "AQUAX", name: "Aquax Deo Cream (Hyperhidrosis)", details: "كريم طبي لتقليل وعلاج فرط التعرق (Hyperhidrosis).", meta: "75 g | Cream", qty: 5, img: "1001882760.jpg"},
    {id: 69, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SORAFINE", name: "Sorafine Cremogel", details: "كريم-جل مرطب ومهدئ خالٍ من الزيوت (Non-Comedogenic) بخلاصة الجوجوبا، مثالي للبشرة المختلطة والدهنية.", meta: "75 g | Gel Cream", qty: 5, img: "1001882762.jpg"},
    {id: 70, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "JULPHAR", name: "Mebo Ointment (0.25% Beta-Sitosterol)", details: "مرهم ميبو العشبي الطبيعي لعلاج الحروق والجروح وتقرحات الجلد.", meta: "30 g | Ointment", qty: 10, img: "1001882764.jpg"},
    {id: 71, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "JULPHAR", name: "Mebo Scar Ointment", details: "مرهم ميبو سكار لتقليل ومنع تشكل الندبات بعد الجروح والحروق والعمليات.", meta: "30 g | Ointment", qty: 5, img: "1001882765.jpg"},
    {id: 72, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "NEWGEL+E", name: "NewGel+E Advanced Silicone Gel for Scars", details: "جل السيليكون الطبي المتقدم مع فيتامين E لعلاج وإخفاء الندبات القديمة والحديثة.", meta: "15 g | Gel", qty: 3, img: "1001882772.jpg"},
    {id: 73, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ARDENE", name: "Vitamin E Face & Hand Cream", details: "كريم مرطب بفيتامين E للوجه واليدين للبشرة العادية والحساسة.", meta: "45 g | Cream", qty: 5, img: "1001882783.jpg"},
    {id: 74, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "ARDENE", name: "Collagen Moisturizing Cream", details: "كريم مرطب بالكولاجين وفيتامينات A, E, C والبانثينول وزيت بذور العنب للبشرة الجافة.", meta: "50 g | Cream", qty: 5, img: "1001882784.jpg"},
    {id: 75, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "UNIREX", name: "Aquanza Glycerin & Aloe Vera Cream", details: "كريم فائق الترطيب للبشرة الجافة بالجلسرين وخلاصة الألوفيرا.", meta: "50 g | Cream", qty: 6, img: "1001882810.jpg"},
    {id: 76, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "UNIREX", name: "Bioral Rich Replenishing Face Cream (Urea 5%)", details: "كريم وجه غني باليوريا 5%، السيراميد، حمض الهيالورونيك والسكوالان لإغاثة البشرة الجافة.", meta: "75 g | Cream", qty: 5, img: "1001882811.jpg"},
    {id: 77, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SDI", name: "Zinc Oxide Ointment (مرهم أوكسيد الزنك)", details: "مرهم أوكسيد الزنك لحماية الجلد وتهدئة الطفح الجلدي والتهابات الحفاض.", meta: "25 g | Ointment", qty: 10, img: "1001882816.jpg"},
    {id: 78, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "SDI", name: "Zinc Castor Oil Baby Ointment", details: "مرهم الزنك وزيت الخروع لحماية بشرة الأطفال وعلاج طفح الحفاض.", meta: "25 g | Ointment", qty: 10, img: "1001882827.jpg"},
    {id: 79, department: "قسم الجلدية", category: "المرطبات والترميم", brand: "LSI", name: "Quasix Anti-Redness Cream", details: "كريم مضاد للاحمرار والوردية (Rosacea) للبشرة الجافة والمختلطة.", meta: "30 g | Cream", qty: 4, img: "1001882832.jpg"},
    {id: 80, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "THE ORDINARY", name: "Alpha Arbutin 2% + HA Serum", details: "سيروم ألفا أربوتين 2% المركز مع حمض الهيالورونيك لعلاج البقع البنية والتصبغات وتوحيد لون البشرة.", meta: "30 ml | Serum", qty: 4, img: "1001882690.jpg"},
    {id: 81, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "ISISPHARMA", name: "Unitone 4 White Nightly Care", details: "كريم ليلي مركز لإزالة البقع الصباغية والكلف وتفتيح البشرة.", meta: "40 ml | Cream", qty: 4, img: "1001882705.jpg"},
    {id: 82, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "ARDENE", name: "Skin Lightener Cream", details: "كريم مفتح للبشرة يحتوي على فيتامين C، Kojic Acid، Kojic Dipalmitate، وفيتامينات A و E.", meta: "50 g | Cream", qty: 4, img: "1001882714.jpg"},
    {id: 83, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "OZMODERM AUSTRALIA", name: "Whitening Black Bar (Brightening Bar)", details: "صابونة التفتيح السوداء بخلاصة الفطر، فيتامين C، الكافيار، الفحم النشط والجنسنغ لجميع أنواع البشرة.", meta: "100 g | Soap Bar", qty: 5, img: "1001882731.jpg"},
    {id: 84, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "LA JU", name: "SW Skin Whitening Cream", details: "كريم تفتيح ونضارة البشرة وعلاج التصبغات.", meta: "40 g | Cream", qty: 4, img: "1001882734.jpg"},
    {id: 85, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "MAC", name: "Benoquin Cream (Monobenzone 20%)", details: "كريم مونوبنزون 20% لإزالة التصبغات النهائية في حالات البهاق المنتشر (Vitiligo).", meta: "30 g | Cream", qty: 3, img: "1001882738.jpg"},
    {id: 86, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "AQUAX", name: "Aquax Whitening Cream", details: "كريم أكواكس المفتح والمرطب للبشرة.", meta: "50 g | Cream", qty: 5, img: "1001882761.jpg"},
    {id: 87, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "JAMJOOM PHARMA", name: "HiQuin 4% Cream (Hydroquinone 4%)", details: "كريم هايكوين بتركيز هيدروكينون 4% لعلاج الكلف والتصبغات والبقع الداكنة.", meta: "30 g | Cream", qty: 10, img: "1001882768.jpg"},
    {id: 88, department: "قسم الجلدية", category: "التفتيح والتقشير", brand: "ARDENE", name: "AHA 12% Alpha-Hydroxy Acid Cream", details: "كريم أحماض الفواكه المقشر بتركيز 12% مع الريتينول وفيتامين C والألوفيرا لتجديد البشرة وتقليل التجاعيد والبقع.", meta: "50 g | Cream", qty: 4, img: "1001882785.jpg"},
    {id: 89, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "AMOOR", name: "Potassium Permanganate (برمنكنات للتعقيم)", details: "بلورات برمنغنات البوتاسيوم للتعقيم والمغاطس الجلدية المطهرة والقابضة.", meta: "7 g | Powder", qty: 10, img: "1001882728.jpg"},
    {id: 90, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "FPI", name: "PermeRx 5% Cream (Permethrin 5%)", details: "كريم بيرمثرين 5% لعلاج الجرب (Scabies) والقمل.", meta: "30 g | Cream", qty: 10, img: "1001882737.jpg"},
    {id: 91, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "ACM", name: "Molutrex Solution (5% Potassium Hydroxide)", details: "محلول موضعي بتركيز 5% هيدروكسيد البوتاسيوم لعلاج المليساء المعدية (Molluscum Contagiosum).", meta: "10 ml | Solution", qty: 3, img: "1001882740.jpg"},
    {id: 92, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "BAYER", name: "Canesten Cream (Clotrimazole 1%)", details: "كريم كانستين المضاد للفطريات واسع الطيف.", meta: "20 g | Cream", qty: 8, img: "1001882741.jpg"},
    {id: 93, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "ERNST", name: "Iverzo 1 Cream (Ivermectin 1%)", details: "كريم إيفرمكتين 1% الموضعي لعلاج الوردية (Rosacea) والطفيليات الجلدية.", meta: "30 g | Cream", qty: 4, img: "1001882742.jpg"},
    {id: 94, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "ATCO", name: "Ivermite Lotion (Ivermectin 0.5%)", details: "لوشن إيفرمكتين الموضعي 0.5% لعلاج القمل والجرب والطفيليات الجلدية.", meta: "60 ml | Lotion", qty: 5, img: "1001882744.jpg"},
    {id: 95, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "AVALON PHARMA", name: "Avoban Ointment (Mupirocin 2%)", details: "مرهم موبيروسين 2% مضاد بكتيري موضعي لعلاج القوباء (Impetigo)، التهاب البصيلات والدمامل.", meta: "15 g | Ointment", qty: 8, img: "1001882747.jpg"},
    {id: 96, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "AJANTA", name: "Lucoz Cream (Luliconazole 1%)", details: "كريم لوليكونازول 1% مضاد فطريات حديث وقوي لعلاج التينيا والفطريات الجلدية.", meta: "30 g | Cream", qty: 6, img: "1001882763.jpg"},
    {id: 97, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "LINCOLN", name: "Clovir Cream (Aciclovir 5%)", details: "كريم أسيكلوفير 5% مضاد فيروسي موضعي لعلاج الهربس البسيط (لطمة الحمى).", meta: "15 g | Cream", qty: 8, img: "1001882779.jpg"},
    {id: 98, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "BRAWN", name: "Gentamicin Cream BP 0.3%", details: "كريم جنتامايسين 0.3% مضاد حيوي موضعي للعدوى البكتيرية الجلدية.", meta: "15 g | Cream", qty: 10, img: "1001882780.jpg"},
    {id: 99, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SANA ALFAYHAA", name: "Fusicure Ointment (فيوسيكيور مرهم)", details: "مرهم صوديوم فيوسيديت 2% مضاد حيوي لعلاج الالتهابات البكتيرية الجلدية.", meta: "20 g | Ointment", qty: 10, img: "1001882781.jpg"},
    {id: 100, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SANA ALFAYHAA", name: "Fusicure Cream (فيوسيكيور كريم)", details: "كريم حمض الفيوسيديك 2% مضاد بكتيري موضعي.", meta: "20 g | Cream", qty: 10, img: "1001882782.jpg"},
    {id: 101, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "FERRER", name: "Dermofix Cream (Sertaconazole 2%)", details: "كريم سيرتاكونازول نيترات 20mg/g المضاد للفطريات الجلدية والخمائر.", meta: "20 g | Cream", qty: 6, img: "1001882788.jpg"},
    {id: 102, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "BILIM", name: "Ketoral Cream (Ketoconazole 2%)", details: "كريم كيتوكونازول 2% مضاد فطريات واسع الطيف.", meta: "40 g | Cream", qty: 8, img: "1001882789.jpg"},
    {id: 103, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "DAR ALDAWA", name: "Mycoheal Cream (Miconazole 2%)", details: "كريم ميكونازول نيترات 20mg/g مضاد للفطريات الجلدية.", meta: "30 g | Cream", qty: 8, img: "1001882790.jpg"},
    {id: 104, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "UNITED", name: "Candizol Oral Gel (Miconazole 2%)", details: "جل فموي ميكونازول 2% لعلاج فطريات الفم واللسان (Oral Thrush).", meta: "40 g | Oral Gel", qty: 6, img: "1001882791.jpg"},
    {id: 105, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "JUMAN", name: "Sulfur 5% Cream (كريم الكبريت جمان)", details: "كريم الكبريت بتركيز 5% شديد الفعالية لعلاج الجرب والفطريات وحب الشباب.", meta: "500 ml | Cream", qty: 5, img: "1001882794.jpg"},
    {id: 106, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "VITAPURE", name: "Terbinafine-Vitapure Spray 1%", details: "بخاخ تيربينافين 1% مضاد للفطريات الجلدية وفطريات الأصابع والقدمين.", meta: "30 ml | Spray", qty: 6, img: "1001882795.jpg"},
    {id: 107, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SDI", name: "Whitefield's Ointment (مرهم ويتفيلد)", details: "مرهم حمض البنزويك وحمض الساليسيليك المقشر والمضاد للفطريات السطحية.", meta: "25 g | Ointment", qty: 8, img: "1001882796.jpg"},
    {id: 108, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "PHILADELPHIA", name: "Metroza 0.75% Gel (Metronidazole)", details: "جل ميترونيدازول 0.75% لعلاج الوردية (Rosacea) والالتهابات الجلدية.", meta: "0.75% | Gel", qty: 6, img: "1001882799.jpg"},
    {id: 109, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "STIEFEL", name: "Duofilm Solution (Salicylic 16.7% + Lactic 15%)", details: "محلول ديفيلم الكاوي والمقشر لعلاج وإزالة الثآليل (Warts) ومسامير اللحم.", meta: "18 ml | Solution", qty: 5, img: "1001882800.jpg"},
    {id: 110, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "AVALON PHARMA", name: "Avomack Solution", details: "محلول موضعي بحمض الساليسيليك واللاكتيك لإزالة الثآليل ومسامير القدم.", meta: "Solution | Warts", qty: 6, img: "1001882801.jpg"},
    {id: 111, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "OCTOBER PHARMA", name: "Collomak Topical Solution", details: "محلول كولوماك (Salicylic Acid 20% + Lactic Acid 5% + Polidocanol 2%) لإزالة الثآليل والتقرنات.", meta: "10 ml | Solution", qty: 6, img: "1001882802.jpg"},
    {id: 112, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SDI", name: "Permethrin Ointment (مرهم بيرمثرين)", details: "مرهم مضاد للجرب والطفيليات الجلدية.", meta: "Ointment | SDI", qty: 8, img: "1001882820.jpg"},
    {id: 113, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "ASWAR AL-KHALEEJ", name: "As-Fugidin Cream (Fusidic Acid)", details: "كريم فيوسيدين مضاد بكتيري موضعي.", meta: "15 g | Cream", qty: 10, img: "1001882822.jpg"},
    {id: 114, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SDI", name: "Mycodin Ointment", details: "مرهم مضاد للفطريات الجلدية.", meta: "15 g | Ointment", qty: 8, img: "1001882823.jpg"},
    {id: 115, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "SAMA ALFAYHAA", name: "Hyloza Cream (Silver Sulfadiazine + Hyaluronic Acid)", details: "كريم سلفاديازين الفضة مع حمض الهيالورونيك لعلاج الحروق ومنع العدوى وتسريع التئام الجروح.", meta: "30 g | Cream", qty: 6, img: "1001882828.jpg"},
    {id: 116, department: "قسم الجلدية", category: "المضادات الموضعية (بكتيريا/فطريات/طفيليات)", brand: "CELAVEX", name: "Celavex Cream (Cetrimide 0.5% + Chlorhexidine 0.1%)", details: "كريم مطهر ومعقم للجروح والحروق السطحية والخدوش وطفح الحفاض.", meta: "25 g | Cream", qty: 8, img: "1001882829.jpg"},
    {id: 117, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "HALAMINE", name: "Halamine Lotion (Calamine Lotion)", details: "لوشن ملطف ومبرد للجلد ومضاد للحكة والتهيج وحروق الشمس والجدري.", meta: "100 ml | Lotion", qty: 8, img: "1001882736.jpg"},
    {id: 118, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "AQUAX", name: "Aquax-H Cream (Hydrocortisone 17-Butyrate 0.1%)", details: "كريم هيدروكورتيزون 17-بيوتيرات 0.1% لعلاج الإكزيما والالتهابات الجلدية.", meta: "30 g | Cream", qty: 6, img: "1001882758.jpg"},
    {id: 119, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "JAMJOOM PHARMA", name: "Elica Cream (Mometasone Furoate 0.1%)", details: "كريم موميتازون فيورويت 0.1% لعلاج الإكزيما والصدفية والحساسية الجلدية.", meta: "30 g | Cream", qty: 10, img: "1001882766.jpg"},
    {id: 120, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "JAMJOOM PHARMA", name: "Promax Cream (Clobetasol 0.05%)", details: "كريم كلوبيتازول بروبيونات 0.05% كورتيزون عالي القوة للإكزيما والصدفية المستعصية.", meta: "30 g | Cream", qty: 8, img: "1001882767.jpg"},
    {id: 121, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "JULPHAR", name: "Alfacort Cream (Hydrocortisone 1%)", details: "كريم هيدروكورتيزون 1% خفيف لعلاج الالتهابات الجلدية البسيطة والإكزيما.", meta: "15 g | Cream", qty: 10, img: "1001882769.jpg"},
    {id: 122, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "TABUK", name: "Rolip Ointment (Calcipotriol / Betamethasone)", details: "مرهم كالسيبوتريول (نظير فيتامين D) مع بيتاميثازون المخصص لعلاج الصدفية اللويحية (Plaque Psoriasis).", meta: "30 g | Ointment", qty: 5, img: "1001882770.jpg"},
    {id: 123, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "AJANTA", name: "Talimus 0.1% Ointment (Tacrolimus 0.1%)", details: "مرهم تاكروليمس 0.1% معدل مناعي موضعي خالٍ من الكورتيزون لعلاج الإكزيما التأتبية والبهاق.", meta: "10 g | Ointment", qty: 5, img: "1001882771.jpg"},
    {id: 124, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "WPC", name: "Quadridain Cream (رباعي المفعول)", details: "كريم رباعي مضاد للالتهابات والبكتيريا والفطريات الجلدية المختلطة.", meta: "15 g | Cream", qty: 10, img: "1001882778.jpg"},
    {id: 125, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "FERRER", name: "Peitel 0.25% Cream (Prednicarbate)", details: "كريم بريدنيكاربات 0.25% كورتيزون موضعي عالي الأمان لعلاج الإكزيما والتهاب الجلد.", meta: "30 g | Cream", qty: 5, img: "1001882797.jpg"},
    {id: 126, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "UNIREX", name: "Virapoxx Gel (For Chickenpox)", details: "جل مبرد ومهدئ للحكة الشديدة المصاحبة للجدري المائي (Chickenpox) ويمنع التندب، مناسب من عمر 6 أشهر.", meta: "150 ml | Gel", qty: 5, img: "1001882814.jpg"},
    {id: 127, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "DIJLA", name: "Nastocord Cream", details: "كريم مشكل مضاد للالتهابات الفطرية والبكتيرية والحساسية.", meta: "15 g | Cream", qty: 8, img: "1001882815.jpg"},
    {id: 128, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "SDI", name: "Betnosam Ointment (Betamethasone)", details: "مرهم بيتاميثازون لعلاج الحساسية والصدفية والإكزيما الجافة.", meta: "15 g | Ointment", qty: 10, img: "1001882817.jpg"},
    {id: 129, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "SDI", name: "Betnosam Cream (Betamethasone)", details: "كريم بيتاميثازون لعلاج الالتهابات الجلدية والحساسية.", meta: "15 g | Cream", qty: 10, img: "1001882818.jpg"},
    {id: 130, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "SDI", name: "Nystacort Ointment", details: "مرهم نيستاتين وكورتيزون لعلاج التهابات الحفاض والفطريات المترافقة مع التهاب.", meta: "15 g | Ointment", qty: 10, img: "1001882819.jpg"},
    {id: 131, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "SDI", name: "Dermodin Cream (Clobetasol)", details: "كريم ديرمودين لعلاج الإكزيما والصدفية والحساسية الشديدة.", meta: "25 g | Cream", qty: 10, img: "1001882821.jpg"},
    {id: 132, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "SDI", name: "Betnosam-N Cream (Betamethasone + Neomycin)", details: "كريم بيتاميثازون مع نيومايسين للالتهابات الجلدية المصحوبة بعدوى بكتيرية.", meta: "15 g | Cream", qty: 10, img: "1001882824.jpg"},
    {id: 133, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "HAYAT", name: "Hycortisone 2.5% Cream (هايكورتيزون 2.5%)", details: "كريم هيدروكورتيزون بتركيز 2.5% لعلاج الإكزيما والالتهابات الجلدية.", meta: "15 g | Cream", qty: 8, img: "1001882825.jpg"},
    {id: 134, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "MDI", name: "Hydrocortisone-MDI Cream 1%", details: "كريم هيدروكورتيزون أسيتات 1% لعلاج الحساسية والاحمرار.", meta: "15 g | Cream", qty: 8, img: "1001882826.jpg"},
    {id: 135, department: "قسم الجلدية", category: "الكورتيزونات والمراهم الموضعية", brand: "WPC", name: "Dermocalin Cream", details: "كريم ملطف لتهيجات الجلد البسيطة، لدغات الحشرات وحروق الشمس.", meta: "25 g | Cream", qty: 6, img: "1001882831.jpg"},
    {id: 136, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ATCO", name: "Ivermite 6mg Tablets (Ivermectin USP)", details: "أقراص إيفرمكتين 6 ملغ فموية مضادة للطفيليات لعلاج الجرب المستعصي والعدوى الطفيلية.", meta: "10 Tablets | Oral", qty: 6, img: "1001882739.jpg"},
    {id: 137, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ASIA PHARMA", name: "Retane 20 (Isotretinoin 20mg Capsules)", details: "كبسولات أيزوتريتينوين 20 ملغ لعلاج حب الشباب الكيسي والعقدي الشديد.", meta: "30 Capsules | Oral", qty: 8, img: "1001882775.jpg"},
    {id: 138, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ASIA PHARMA", name: "Retane 10 (Isotretinoin 10mg Capsules)", details: "كبسولات أيزوتريتينوين 10 ملغ لعلاج حب الشباب.", meta: "30 Capsules | Oral", qty: 8, img: "1001882776.jpg"},
    {id: 139, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PHILADELPHIA", name: "Mycophil Oral Suspension (Nystatin)", details: "معلق فموي نيستاتين خالٍ من الكحول لعلاج فطريات الفم والأمعاء (Candidiasis).", meta: "30 ml | Oral Drops", qty: 8, img: "1001882792.jpg"},
    {id: 140, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "VIDA FARMA", name: "Troda 100 Capsules (Itraconazole 100mg)", details: "كبسولات إيتراكونازول 100 ملغ مضاد فطريات جهازي واسع الطيف لفطريات الجلد والأظافر.", meta: "8 Capsules | Oral", qty: 6, img: "1001882833.jpg"},
    {id: 141, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "JAMJOOM PHARMA", name: "Lamifen 250mg Tablets (Terbinafine 250mg)", details: "أقراص لامفين (تيربينافين 250 ملغ) لعلاج فطريات الأظافر والجلد والشعر.", meta: "14 Tablets | Oral", qty: 6, img: "1001882834.jpg"},
    {id: 142, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "UROK PHARMA", name: "Diflurok 150mg Capsule (Fluconazole 150mg)", details: "كبسولة فلوكونازول 150 ملغ أحادية الجرعة لعلاج الخمائر والفطريات الجلدية والتناسلية.", meta: "1 Capsule | Oral", qty: 12, img: "1001882835.jpg"},
    {id: 143, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ACCORD", name: "Aciclovir 800mg Tablets", details: "أقراص أسيكلوفير 800 ملغ مضاد فيروسي لعلاج الحزام الناري (Herpes Zoster) والجدري المائي.", meta: "35 Tablets | Oral", qty: 5, img: "1001882836.jpg"},
    {id: 144, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "MEDICO LABS", name: "Viramed 200 Tablets (Aciclovir 200mg)", details: "أقراص أسيكلوفير 200 ملغ مضاد فيروسي لعلاج التهابات الهربس البسيط.", meta: "20 Tablets | Oral", qty: 6, img: "1001882839.jpg"},
    {id: 145, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ACCORD", name: "Aciclovir 400mg Tablets", details: "أقراص أسيكلوفير 400 ملغ مضاد فيروسي لعلاج الهربس والوقاية من تكراره.", meta: "56 Tablets | Oral", qty: 5, img: "1001882840.jpg"},
    {id: 146, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "GENERIC", name: "Desloratadine 5mg Tablets", details: "أقراص ديسلوراتادين 5 ملغ مضاد هيستامين طويل المفعول لا يسبب النعاس للحكة والشرى (Urticaria).", meta: "30 Tablets | Oral", qty: 10, img: "1001882843.jpg"},
    {id: 147, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ORGANON", name: "Aerius 5mg Tablets (Desloratadine)", details: "أقراص إيريوس الأصلية 5 ملغ لعلاج الحساسية الجلدية والشرى المزمن والحكة دون نعاس.", meta: "30 Tablets | Oral", qty: 6, img: "1001882844.jpg"},
    {id: 148, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "SANOFI", name: "Telfast 120mg Tablets (Fexofenadine)", details: "أقراص تيلفاست 120 ملغ مضاد حساسية سريع المفعول لا يسبب النعاس.", meta: "15 Tablets | Oral", qty: 8, img: "1001882845.jpg"},
    {id: 149, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "SANOFI", name: "Telfast 180mg Tablets (Fexofenadine)", details: "أقراص تيلفاست 180 ملغ المخصصة للشرى الجلدي (Urticaria) والحكة الشديدة دون نعاس.", meta: "15 Tablets | Oral", qty: 8, img: "1001882846.jpg"},
    {id: 150, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "MUP", name: "Alertam 120mg Tablets (Fexofenadine)", details: "أقراص فيكسوفينادين 120 ملغ مضاد للحساسية والحكة.", meta: "10 Tablets | Oral", qty: 8, img: "1001882847.jpg"},
    {id: 151, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "TABUK", name: "Fexodine 180mg Tablets (Fexofenadine)", details: "أقراص فيكسودين 180 ملغ لعلاج الشرى والحساسية الجلدية.", meta: "14 Tablets | Oral", qty: 8, img: "1001882848.jpg"},
    {id: 152, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "MICRO LABS", name: "Fexofast-120 Tablets (Fexofenadine)", details: "أقراص فيكسوفينادين 120 ملغ مضاد للهيستامين.", meta: "10 Tablets | Oral", qty: 8, img: "1001882849.jpg"},
    {id: 153, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "MICRO LABS", name: "Fexofast-180 Tablets (Fexofenadine)", details: "أقراص فيكسوفينادين 180 ملغ لعلاج الحساسية الجلدية والشرى.", meta: "10 Tablets | Oral", qty: 8, img: "1001882850.jpg"},
    {id: 154, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "BAYER", name: "Claritine 10mg Tablets (Loratadine)", details: "أقراص كلاريتين 10 ملغ لعلاج الحساسية والحكة والشرى لمدة 24 ساعة دون نعاس.", meta: "10 Tablets | Oral", qty: 8, img: "1001882851.jpg"},
    {id: 155, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Laritin 10mg Tablets (Loratadine)", details: "أقراص لوراتادين 10 ملغ لعلاج أعراض الحساسية والشرى الجلدي.", meta: "30 Tablets | Oral", qty: 10, img: "1001882852.jpg"},
    {id: 156, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "JULPHAR", name: "Cetralon 10mg Tablets (Cetirizine)", details: "أقراص سيتريزين 10 ملغ مضاد هيستامين قوي لعلاج الحكة والتحسس الجلدي.", meta: "10 Tablets | Oral", qty: 10, img: "1001882853.jpg"},
    {id: 157, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Laritin Syrup (Loratadine 5mg/5ml)", details: "شراب لوراتادين للأطفال لعلاج الحساسية الجلدية والشرى والحكة.", meta: "100 ml | Syrup", qty: 8, img: "1001882854.jpg"},
    {id: 158, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Larius Oral Syrup (Desloratadine 2.5mg/5ml)", details: "شراب ديسلوراتادين للأطفال لا يسبب النعاس لعلاج الحساسية الجلدية والشرى.", meta: "100 ml | Syrup", qty: 8, img: "1001882855.jpg"},
    {id: 159, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Chlomal Syrup (Chlorpheniramine Maleate)", details: "شراب كلورفينيرامين مضاد للحساسية والحكة الشديدة لدى الأطفال.", meta: "100 ml | Syrup", qty: 8, img: "1001882856.jpg"},
    {id: 160, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "SDI", name: "Allermin Syrup (شراب الرمين - Diphenhydramine)", details: "شراب دايفنهيدرامين 10mg/5ml مضاد للحساسية والحكة والشرى.", meta: "100 ml | Syrup", qty: 8, img: "1001882857.jpg"},
    {id: 161, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "MEDWISE", name: "Colchicine Wise 0.5mg Tablets", details: "أقراص كولشيسين 0.5 ملغ لعلاج داء بهجت (Behcet's Disease)، التهابات الأوعية الجلدية والنقرس.", meta: "30 Tablets | Oral", qty: 5, img: "1001882859.jpg"},
    {id: 162, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Prednicort Syrup (Prednisolone 15mg/5ml)", details: "شراب بريدنيزولون 15 ملغ/5 مل مضاد التهاب وحساسية فموي للأطفال.", meta: "100 ml | Syrup", qty: 8, img: "1001882861.jpg"},
    {id: 163, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "SDI", name: "Fenistil Kids Drops", details: "قطرات فينيستيل للأطفال مضادة للهيستامين والشرى والحكة الجلدية وجدري الماء.", meta: "15 ml | Drops", qty: 8, img: "1001882862.jpg"},
    {id: 164, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "ASWAR AL-KHALEEJ", name: "As-Prislone 5mg Tablets (Prednisolone 5mg)", details: "أقراص بريدنيزولون 5 ملغ كورتيزون فموي لعلاج الحالات الالتهابية والتحسسية.", meta: "100 Tablets | Oral", qty: 8, img: "1001882863.jpg"},
    {id: 165, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "PIONEER", name: "Prednicort 20mg Tablets (Prednisolone 20mg)", details: "أقراص بريدنيزولون 20 ملغ لعلاج الأمراض الجلدية المناعية والتحسسية الحادة.", meta: "20 Tablets | Oral", qty: 8, img: "1001882864.jpg"},
    {id: 166, department: "قسم الجلدية", category: "الأدوية الفموية والشرابات", brand: "JULPHAR", name: "Gupisone 20mg Tablets (Prednisolone 20mg)", details: "أقراص غوبيزون (بريدنيزولون 20 ملغ) مضاد التهاب وتحسس جهازي.", meta: "20 Tablets | Oral", qty: 8, img: "1001882865.jpg"}
];

// ============================================================================
// 4. منطق التطبيق، المزامنة مع Firebase، وإدارة الجلسة الدائمة
// ============================================================================
let products = JSON.parse(localStorage.getItem('diwanProducts')) || defaultProducts;
let departments = JSON.parse(localStorage.getItem('diwanDepts')) || defaultDepartments;
let subCategories = JSON.parse(localStorage.getItem('diwanSubCats')) || defaultSubCategories;

let activeDept = departments[0] || "قسم الجلدية";
let mainTab = 'all';
let activeSubCat = 'الكل';
let currentOpenId = null;
let db = null;
let auth = null;
let isFirebaseReady = false;
let currentUser = null;

// دالة إصلاح انقلاب الأرقام والوحدات تلقائياً (حتى لو كانت مخزنة قديماً بالمقلوب)
function fixMetaOrder(metaStr) {
    if (!metaStr) return '';
    // يحول أي صيغة مقلوبة مثل "Tablets | Oral 10" إلى "10 Tablets | Oral"
    let fixed = metaStr.replace(/^(Tablets|Capsules|Capsule|Drops|Syrup|ml|g)\s*\|\s*([A-Za-z\s]+)\s+(\d+)$/i, '$3 $1 | $2');
    fixed = fixed.replace(/^(Syrup|Drops|Solution|Cream|Gel|Ointment)\s*\|\s*(\d+\s*(?:ml|g))$/i, '$2 | $1');
    return fixed;
}

// تنظيف أي بيانات مخزنة مسبقاً في المتصفح
products = products.map(p => ({
    ...p,
    department: p.department || "قسم الجلدية",
    meta: fixMetaOrder(p.meta)
}));

function initFirebase() {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "PUT_YOUR_API_KEY_HERE") {
        document.getElementById('syncBadge').innerText = "💾 محلي (بانتظار ربط Firebase)";
        return;
    }
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        isFirebaseReady = true;

        // حفظ جلسة الدخول دائماً في المتصفح (LOCAL Persistence)
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        // مراقبة حالة تسجيل الدخول تلقائياً بدون طلب الرمز كل مرة
        auth.onAuthStateChanged(user => {
            currentUser = user;
            const authBtn = document.getElementById('authBtn');
            if (user) {
                document.body.classList.add('admin-mode');
                authBtn.classList.add('active');
                authBtn.innerText = '🔓 خروج الصيدلي';
            } else {
                document.body.classList.remove('admin-mode');
                authBtn.classList.remove('active');
                authBtn.innerText = '🔒 دخول الصيدلي';
            }
            if (currentOpenId) openSheet(currentOpenId);
        });

        // مزامنة فورية للبيانات والأقسام من السحابة
        db.collection('pharmacy').doc('catalogData').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.products) products = data.products.map(p => ({...p, meta: fixMetaOrder(p.meta)}));
                if (data.departments) departments = data.departments;
                if (data.subCategories) subCategories = data.subCategories;
                saveLocal();
                renderAll();
                document.getElementById('syncBadge').innerText = "☁️ متزامن";
            } else if (currentUser) {
                // رفع البيانات الافتراضية لأول مرة تلقائياً عند دخول الصيدلي
                pushToCloud();
            }
        });
    } catch (e) {
        console.warn("Firebase Error:", e);
    }
}

function saveLocal() {
    localStorage.setItem('diwanProducts', JSON.stringify(products));
    localStorage.setItem('diwanDepts', JSON.stringify(departments));
    localStorage.setItem('diwanSubCats', JSON.stringify(subCategories));
}

async function pushToCloud() {
    saveLocal();
    if (isFirebaseReady && currentUser) {
        document.getElementById('syncBadge').innerText = "⏳ جاري الحفظ...";
        try {
            await db.collection('pharmacy').doc('catalogData').set({
                products,
                departments,
                subCategories,
                updatedAt: new Date().toISOString()
            });
            document.getElementById('syncBadge').innerText = "☁️ تم الحفظ";
        } catch (err) {
            alert("خطأ في الحفظ السحابي: " + err.message);
        }
    }
}

// ============================================================================
// 5. تسجيل الدخول الآمن عبر Firebase
// ============================================================================
function handleAuthClick() {
    if (!isFirebaseReady) {
        alert("يرجى وضع مفاتيح firebaseConfig في أعلى ملف data.js أولاً لتفعيل الحماية السحابية.");
        return;
    }
    if (currentUser) {
        if (confirm("هل تود تسجيل الخروج من وضع الصيدلي؟")) {
            auth.signOut();
        }
    } else {
        document.getElementById('loginError').style.display = 'none';
        document.getElementById('loginModal').style.display = 'flex';
    }
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

async function performLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const errBox = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');

    if (!email || !pass) {
        errBox.innerText = "يرجى إدخال البريد الإلكتروني وكلمة المرور";
        errBox.style.display = 'block';
        return;
    }

    btn.innerText = "جاري التحقق...";
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeLoginModal();
    } catch (e) {
        errBox.innerText = "بيانات الدخول غير صحيحة أو الحساب غير مسجل في Firebase Auth";
        errBox.style.display = 'block';
    } finally {
        btn.innerText = "تسجيل الدخول";
    }
}

// ============================================================================
// 6. إدارة الأقسام الكبرى والتصنيفات الفرعية (إضافة وتعديل التسميات)
// ============================================================================
function openCategoryManager() {
    renderManagerLists();
    document.getElementById('catModal').style.display = 'flex';
}

function closeCategoryManager() {
    document.getElementById('catModal').style.display = 'none';
}

function renderManagerLists() {
    const deptContainer = document.getElementById('deptListManager');
    deptContainer.innerHTML = departments.map((d, i) => `
        <div class="manager-item">
            <span>${d}</span>
            <div style="display:flex; gap:6px;">
                <button class="icon-btn" onclick="renameDepartment(${i})">✏️ تعديل الاسم</button>
            </div>
        </div>
    `).join('');

    const subContainer = document.getElementById('subCatListManager');
    subContainer.innerHTML = subCategories.map((c, i) => `
        <div class="manager-item">
            <span>${c}</span>
            <div style="display:flex; gap:6px;">
                <button class="icon-btn" onclick="renameSubCategory(${i})">✏️ تعديل الاسم</button>
            </div>
        </div>
    `).join('');
}

function renameDepartment(index) {
    const oldName = departments[index];
    const newName = prompt("تعديل اسم القسم الرئيسي:", oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        const clean = newName.trim();
        departments[index] = clean;
        products.forEach(p => { if (p.department === oldName) p.department = clean; });
        if (activeDept === oldName) activeDept = clean;
        pushToCloud();
        renderManagerLists();
        renderAll();
    }
}

function addDepartment() {
    const val = document.getElementById('newDeptInput').value.trim();
    if (val && !departments.includes(val)) {
        departments.push(val);
        document.getElementById('newDeptInput').value = '';
        pushToCloud();
        renderManagerLists();
        renderAll();
    }
}

function renameSubCategory(index) {
    const oldName = subCategories[index];
    const newName = prompt("تعديل تسمية التصنيف الفرعي:", oldName);
    if (newName && newName.trim() && newName.trim() !== oldName) {
        const clean = newName.trim();
        subCategories[index] = clean;
        products.forEach(p => { if (p.category === oldName) p.category = clean; });
        if (activeSubCat === oldName) activeSubCat = clean;
        pushToCloud();
        renderManagerLists();
        renderAll();
    }
}

function addSubCategory() {
    const val = document.getElementById('newSubCatInput').value.trim();
    if (val && !subCategories.includes(val)) {
        subCategories.push(val);
        document.getElementById('newSubCatInput').value = '';
        pushToCloud();
        renderManagerLists();
        renderAll();
    }
}

// ============================================================================
// 7. العرض والفلترة
// ============================================================================
function isRxItem(item) {
    const rxKeywords = ['مضادات', 'كورتيزون', 'فموية', 'شرابات', 'rx'];
    if (rxKeywords.some(k => item.category.toLowerCase().includes(k))) return true;
    const rxNames = ['acretin', 'azaderm', 'peroduo', 'ben-oxide', 'clinaderm', 'minoxidil', 'beta-salic', 'kenazole', 'naxoral', 'selerex', 'hiquin', 'benoquin'];
    return rxNames.some(k => item.name.toLowerCase().includes(k));
}

function getFormBadge(item) {
    const str = `${item.name} ${item.meta}`.toLowerCase();
    if (str.includes('tablet') || str.includes('capsule')) return {txt: 'أقراص / كبسول', cls: 'badge-oral'};
    if (str.includes('syrup') || str.includes('suspension') || str.includes('drops')) return {txt: 'شراب / قطرات', cls: 'badge-syrup'};
    if (str.includes('ointment') || str.includes('مرهم')) return {txt: 'مرهم (Oint)', cls: 'badge-oint'};
    if (str.includes('gel') || str.includes('جل')) return {txt: 'جل (Gel)', cls: 'badge-gel'};
    if (str.includes('shampoo') || str.includes('wash') || str.includes('cleanser') || str.includes('soap') || str.includes('bar')) return {txt: 'غسول / شامبو', cls: 'badge-wash'};
    if (str.includes('spray') || str.includes('solution') || str.includes('lotion') || str.includes('serum')) return {txt: 'محلول / بخاخ', cls: 'badge-spray'};
    return {txt: 'كريم (Cream)', cls: 'badge-cream'};
}

function renderDepartmentsBar() {
    const bar = document.getElementById('departmentsBar');
    bar.innerHTML = departments.map(d => `
        <button class="dept-chip ${activeDept === d ? 'active' : ''}" onclick="selectDepartment('${d}')">
            🏥 ${d}
        </button>
    `).join('');
}

function selectDepartment(d) {
    activeDept = d;
    activeSubCat = 'الكل';
    renderAll();
}

function setMainTab(tab) {
    mainTab = tab;
    activeSubCat = 'الكل';
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
    if (tab === 'all') document.getElementById('navAll').classList.add('active');
    else if (tab === 'rx') document.getElementById('navRx').classList.add('active');
    else document.getElementById('navCosmetic').classList.add('active');
    renderAll();
}

function getBaseFilteredByTab() {
    return products.filter(p => {
        const matchDept = (p.department || "قسم الجلدية") === activeDept;
        if (!matchDept) return false;
        if (mainTab === 'rx') return isRxItem(p);
        if (mainTab === 'cosmetic') return !isRxItem(p);
        return true;
    });
}

function renderPills() {
    const baseItems = getBaseFilteredByTab();
    const availableCats = ['الكل', ...subCategories.filter(c => baseItems.some(p => p.category === c))];
    const bar = document.getElementById('pillsBar');

    bar.innerHTML = availableCats.map(c => {
        const count = c === 'الكل' ? baseItems.length : baseItems.filter(x => x.category === c).length;
        const active = activeSubCat === c ? 'active' : '';
        return `
            <button class="pill ${active}" onclick="selectSubCat('${c}')">
                <span>${c}</span>
                <span class="pill-num">${count}</span>
            </button>
        `;
    }).join('');
}

function selectSubCat(c) {
    activeSubCat = c;
    renderAll();
}

function handleSearch() {
    const q = document.getElementById('searchInput').value;
    document.getElementById('clearSearchBtn').style.display = q.length > 0 ? 'flex' : 'none';
    renderAll();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderAll();
}

function renderAll() {
    renderDepartmentsBar();
    renderPills();

    const tabTitle = mainTab === 'all' ? 'جميع الأصناف' : (mainTab === 'rx' ? 'الأدوية العلاجية (Rx)' : 'العناية والكوزمتك');
    document.getElementById('sectionLabel').innerText = `${activeDept} • ${tabTitle}`;

    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const baseItems = getBaseFilteredByTab();

    const filtered = baseItems.filter(p => {
        const matchCat = activeSubCat === 'الكل' || p.category === activeSubCat;
        const text = `${p.name} ${p.brand} ${p.details} ${p.meta} ${p.category}`.toLowerCase();
        const matchQ = !query || text.includes(query);
        return matchCat && matchQ;
    });

    document.getElementById('countLabel').innerText = `${filtered.length} صنف`;
    const container = document.getElementById('itemsContainer');

    container.innerHTML = filtered.map(p => {
        const badge = getFormBadge(p);
        const dotCls = p.qty > 0 ? 'status-dot' : 'status-dot out';
        const cleanMeta = fixMetaOrder(p.meta);
        return `
            <div class="bento-card" onclick="openSheet(${p.id})">
                <div class="bento-img-wrap">
                    <span class="${dotCls}" style="top:10px; right:10px;"></span>
                    <span class="form-badge ${badge.cls} bento-badge-top">${badge.txt}</span>
                    <img src="${p.img}" alt="" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%221.5%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%224%22/><circle cx=%228.5%22 cy=%228.5%22 r=%221.5%22/><path d=%22M21 15l-5-5L5 21%22/></svg>'">
                </div>
                <div class="bento-body">
                    <div class="bento-brand">${p.brand}</div>
                    <div class="bento-title">${p.name}</div>
                    <div class="bento-sub" dir="ltr">&lrm;${cleanMeta}</div>
                </div>
            </div>
        `;
    }).join('');
}

function openSheet(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentOpenId = id;
    const badge = getFormBadge(p);
    const cleanMeta = fixMetaOrder(p.meta);
    const stockTag = p.qty > 0 
        ? `<span class="form-badge" style="background:#dcfce7; color:#15803d;">متوفر في الصيدلية (${p.qty})</span>`
        : `<span class="form-badge" style="background:#fee2e2; color:#b91c1c;">غير متوفر حالياً (0)</span>`;

    document.getElementById('sheetContent').innerHTML = `
        <div class="sheet-header">
            <div class="sheet-img-box" onclick="zoomImage('${p.img}')">
                <img src="${p.img}" alt="" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%221.5%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%224%22/></svg>'">
            </div>
            <div class="sheet-title-area">
                <div class="sheet-brand">${p.brand}</div>
                <div class="sheet-name" dir="ltr" style="text-align:right;">${p.name}</div>
                <div class="sheet-badges">
                    ${stockTag}
                    <span class="form-badge ${badge.cls}">${badge.txt}</span>
                </div>
            </div>
        </div>

        <div class="sheet-section">
            <h4>التركيب والاستخدام الطبي</h4>
            <p>${p.details}</p>
        </div>

        <div class="sheet-section" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
            <div>
                <h4>القسم والتصنيف</h4>
                <p style="font-size:0.86rem; font-weight:700;">${p.department || 'قسم الجلدية'} - ${p.category}</p>
            </div>
            <div style="text-align:left;">
                <h4>العبوة / الشكل الدوائي</h4>
                <p dir="ltr" style="font-size:0.92rem; font-weight:800; color:var(--primary-dark); text-align:left;">&lrm;${cleanMeta}</p>
            </div>
        </div>

        <div class="sheet-admin-box">
            <div style="font-size:0.8rem; font-weight:800; color:#b45309; margin-bottom:8px;">⚙️ تحكم الصيدلي المباشر</div>
            <div class="admin-row">
                <div class="qty-control-lg">
                    <button onclick="updateItemQty(${p.id}, -1)">-</button>
                    <span style="font-weight:800; min-width:28px; text-align:center;">${p.qty}</span>
                    <button onclick="updateItemQty(${p.id}, 1)">+</button>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="icon-btn" onclick="closeSheet(); openFormModal(${p.id});">✏️ تعديل الصنف</button>
                    <button class="icon-btn" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="deleteItem(${p.id})">🗑️ حذف</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('sheetBackdrop').classList.add('open');
    document.getElementById('bottomSheet').classList.add('open');
}

function closeSheet() {
    document.getElementById('sheetBackdrop').classList.remove('open');
    document.getElementById('bottomSheet').classList.remove('open');
    currentOpenId = null;
}

function updateItemQty(id, delta) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    p.qty = Math.max(0, (parseInt(p.qty) || 0) + delta);
    pushToCloud();
    renderAll();
    openSheet(id);
}

function populateModalSelects() {
    document.getElementById('fDepartment').innerHTML = departments.map(d => `<option value="${d}">${d}</option>`).join('');
    document.getElementById('fCategory').innerHTML = subCategories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function openFormModal(id = null) {
    populateModalSelects();
    const modal = document.getElementById('formModal');
    if (id) {
        const p = products.find(x => x.id === id);
        document.getElementById('formModalTitle').innerText = 'تعديل بيانات الصنف';
        document.getElementById('editId').value = p.id;
        document.getElementById('fDepartment').value = p.department || departments[0];
        document.getElementById('fCategory').value = p.category;
        document.getElementById('fBrand').value = p.brand;
        document.getElementById('fName').value = p.name;
        document.getElementById('fDetails').value = p.details;
        document.getElementById('fMeta').value = fixMetaOrder(p.meta);
        document.getElementById('fQty').value = p.qty;
        document.getElementById('fImg').value = p.img || '';
    } else {
        document.getElementById('formModalTitle').innerText = 'إضافة صنف جديد';
        document.getElementById('editId').value = '';
        document.getElementById('fDepartment').value = activeDept;
        document.getElementById('fBrand').value = '';
        document.getElementById('fName').value = '';
        document.getElementById('fDetails').value = '';
        document.getElementById('fMeta').value = '';
        document.getElementById('fQty').value = 5;
        document.getElementById('fImg').value = '';
    }
    modal.style.display = 'flex';
}

function closeFormModal() {
    document.getElementById('formModal').style.display = 'none';
}

function uploadImgBase64(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const max = 450;
            let w = img.width, h = img.height;
            if (w > h && w > max) { h *= max / w; w = max; }
            else if (h > max) { w *= max / h; h = max; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            document.getElementById('fImg').value = canvas.toDataURL('image/jpeg', 0.72);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function saveFormProduct() {
    const editId = document.getElementById('editId').value;
    const obj = {
        id: editId ? parseInt(editId) : Date.now(),
        department: document.getElementById('fDepartment').value,
        category: document.getElementById('fCategory').value,
        brand: document.getElementById('fBrand').value.trim() || 'GENERIC',
        name: document.getElementById('fName').value.trim(),
        details: document.getElementById('fDetails').value.trim(),
        meta: fixMetaOrder(document.getElementById('fMeta').value.trim()),
        qty: parseInt(document.getElementById('fQty').value) || 0,
        img: document.getElementById('fImg').value.trim()
    };
    if (!obj.name) return alert('يرجى إدخال اسم الصنف');

    if (editId) {
        const idx = products.findIndex(x => x.id === parseInt(editId));
        if (idx > -1) products[idx] = obj;
    } else {
        products.unshift(obj);
    }
    pushToCloud();
    closeFormModal();
    renderAll();
}

function deleteItem(id) {
    if (confirm('هل أنت متأكد من حذف هذا الصنف نهائياً؟')) {
        products = products.filter(x => x.id !== id);
        pushToCloud();
        closeSheet();
        renderAll();
    }
}

function zoomImage(src) {
    if (!src) return;
    document.getElementById('zoomImg').src = src;
    document.getElementById('zoomModal').style.display = 'flex';
}

window.onload = function() {
    renderAll();
    initFirebase();
};
