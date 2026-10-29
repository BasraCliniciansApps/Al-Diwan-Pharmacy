// =====================================================================
// الأقسام والتصنيفات الجاهزة (22 قسم علاجي + فرعياتها). تُحمَّل بزر واحد من «إدارة الأقسام»،
// ولا تغيّر أي مادة موجودة. القديم يبقى ويُعلَّم «قديم» ويختفي لوحده إذا فضى.
// =====================================================================
const TAX_SEED = {
    'الجهاز الهضمي والكبد': ['مضادات الحموضة', 'مثبطات مضخة البروتون (PPI)', 'مضادات H2', 'مسهلات', 'مضادات الإسهال', 'مضادات التقلص الهضمي', 'مضادات القيء', 'أنزيمات هضمية', 'بروبيوتيك', 'أدوية الكبد والصفراء', 'أدوية البواسير', 'مضادات الانتفاخ والغازات', 'أدوية القولون العصبي', 'علاج جرثومة المعدة', 'أدوية التهاب الأمعاء', 'ألياف وملينات الحجم', 'أملاح الإماهة الفموية', 'أدوية الارتجاع والمريء', 'أدوية الغثيان والدوار', 'محفزات الشهية', 'أدوية المغص'],
    'القلب والضغط والدهون': ['خافضات الضغط (ACEI)', 'خافضات الضغط (ARB)', 'حاصرات بيتا', 'حاصرات الكالسيوم', 'مدرات البول', 'أدوية الذبحة', 'أدوية قصور القلب', 'خافضات الدهون', 'مضادات اضطراب النظم', 'مدرات الحلقة', 'مدرات الثيازيد', 'مضادات الألدوستيرون', 'أدوية الضغط المركّبة', 'نيترات', 'ديجوكسين', 'أدوية الدوالي والأوردة', 'أدوية الدوخة والدورة الدموية', 'أدوية الضغط الرئوي'],
    'الجهاز التنفسي والحساسية': ['موسعات القصبات', 'كورتيزون الاستنشاق', 'مقشعات', 'مضادات السعال', 'مضادات الهيستامين', 'أدوية الربو', 'أدوية الزكام والإنفلونزا', 'مزيلات الاحتقان', 'أدوية الانسداد الرئوي (COPD)', 'مضادات اللوكوترين', 'شراب السعال والحساسية للأطفال', 'أدوية الحساسية الموسمية', 'أدوية الصدر المركّبة'],
    'السكري والغدد الصماء': ['إنسولين', 'أقراص السكري', 'أدوية الغدة الدرقية', 'كورتيزونات فموية وحقن', 'أدوية العظام والكالسيوم', 'ميتفورمين', 'سلفونيل يوريا', 'مثبطات DPP-4', 'مثبطات SGLT2', 'حقن GLP-1', 'أدوية السمنة', 'أدوية الغدة الجار درقية', 'هرمونات الذكورة', 'هرمون النمو', 'أدوية نقص السكر', 'بدائل السكر والمحليات'],
    'الجهاز العصبي والنفسي': ['مضادات الصرع', 'مضادات الاكتئاب', 'مهدئات ومنومات', 'مضادات الذهان', 'أدوية باركنسون', 'أدوية الصداع والشقيقة', 'أدوية الخرف', 'مضادات القلق', 'منومات (Z-drugs)', 'أدوية ADHD', 'أدوية الدوار', 'أدوية الأعصاب الطرفية', 'أدوية التصلب المتعدد', 'أدوية الإقلاع عن التدخين', 'مثبتات المزاج', 'أدوية الأرق الطبيعية', 'أدوية الألم العصبي'],
    'المسكنات والعظام والعضلات': ['مسكنات بسيطة', 'مضادات الالتهاب (NSAIDs)', 'مسكنات أفيونية', 'مرخيات العضلات', 'أدوية النقرس', 'أدوية الروماتيزم', 'مراهم مسكنة موضعية', 'باراسيتامول وخافضات الحرارة', 'مسكنات الصداع', 'مسكنات الأسنان', 'مسكنات وخافضات حرارة للأطفال', 'أدوية هشاشة العظام', 'لصقات مسكنة', 'جل NSAID موضعي', 'مضادات التقلص والمغص', 'مخدرات موضعية وحقن التخدير'],
    'المضادات الحيوية ومضادات العدوى': ['بنسلينات', 'سيفالوسبورينات', 'ماكروليدات', 'كينولونات', 'أمينوغليكوزيدات', 'تتراسيكلينات', 'مضادات الفطريات الفموية', 'مضادات الفيروسات', 'مضادات الطفيليات والديدان', 'أدوية السل والملاريا', 'ميترونيدازول ومضادات اللاهوائيات', 'سلفوناميدات وتريميثوبريم', 'أدوية الإنفلونزا', 'أدوية الهربس', 'أدوية التهاب الكبد', 'أدوية الأميبا والجيارديا', 'مضادات حيوية أخرى', 'مضادات الفطريات (حقن)', 'أدوية الإيدز'],
    'الجلدية': ['كورتيزون موضعي', 'مضادات حيوية موضعية', 'مضادات فطريات موضعية', 'علاج حب الشباب', 'ترطيب البشرة', 'أدوية الصدفية', 'الجروح والحروق', 'القمل والجرب', 'مضادات الهيستامين والحكة', 'أدوية الأكزيما والتهاب الجلد', 'أدوية الثآليل', 'أدوية الوردية', 'علاج التصبغات والكلف', 'التفتيح والتقشير', 'واقيات الشمس', 'علاج تساقط الشعر', 'علاج القشرة والتهاب الدهن', 'مضادات التعرق', 'علاج الندبات والتشققات', 'لسعات الحشرات والحكة', 'علاج فطريات الأظافر', 'مطهرات الجلد', 'علاج البهاق', 'الهربس الموضعي', 'علاج الشيخوخة والتجاعيد', 'علاج الجفاف والخشونة', 'ترميم البشرة'],
    'العيون': ['قطرات عين (مضادات حيوية)', 'قطرات عين (كورتيزون)', 'أدوية ضغط العين', 'دموع صناعية', 'مراهم العين', 'قطرات مضادة للحساسية', 'قطرات عين مركّبة', 'قطرات توسيع الحدقة', 'قطرات مضادة للالتهاب (NSAID)', 'قطرات احمرار العين', 'محاليل العدسات', 'مرطبات الجفون والتنظيف', 'أدوية الجفاف والتعب', 'أدوية وذمة القرنية'],
    'الأذن والأنف والحنجرة': ['قطرات الأذن', 'قطرات وبخاخات الأنف', 'غرغرة وأدوية الحنجرة', 'غسول الأنف', 'مزيلات احتقان الأنف', 'بخاخات كورتيزون الأنف', 'أدوية التهاب الجيوب', 'قطرات أنف للأطفال', 'مزيل شمع الأذن', 'أقراص مص للحلق', 'أدوية دوار الأذن', 'بخاخات الحلق'],
    'المسالك البولية والكلى': ['أدوية البروستات', 'مضادات تقلص المثانة', 'مطهرات بولية', 'أدوية الحصى', 'أدوية الكلى', 'أدوية ضعف الانتصاب', 'أدوية سلس البول', 'أدوية التهاب المثانة', 'أدوية الفشل الكلوي', 'أدوية سرعة القذف', 'أدوية العقم الذكري'],
    'النسائية والتوليد والهرمونات': ['حبوب منع الحمل', 'أدوية الخصوبة', 'أدوية الحمل (حديد وفوليك)', 'أدوية الدورة', 'هرمونات سن اليأس', 'تحاميل ومراهم مهبلية', 'حبوب الطوارئ', 'حقن منع الحمل', 'وسائل منع الحمل الأخرى', 'أدوية الولادة والرحم', 'علاج الفطريات المهبلية', 'علاج التهاب المهبل البكتيري', 'أدوية الدورة المؤلمة', 'محفزات التبويض', 'أدوية بطانة الرحم', 'اختبارات الحمل والتبويض', 'أدوية إيقاف الحليب', 'العناية الحميمة وشد المهبل', 'الواقيات الذكرية والمزلقات'],
    'الدم والتخثر': ['مضادات التخثر', 'مضادات الصفيحات', 'أدوية فقر الدم', 'مرقئات', 'حقن الحديد', 'فيتامين K', 'أدوية الثلاسيميا', 'أدوية نزف الدورة', 'محفزات الدم', 'أدوية الدوالي والخثار'],
    'الأورام والمناعة': ['أدوية الأورام', 'مثبطات المناعة', 'أدوية بيولوجية', 'أدوية السرطان الفموية', 'العلاج الهرموني للأورام', 'أدوية الغثيان الكيماوي', 'أدوية زرع الأعضاء', 'كورتيزونات مناعية', 'عوامل النمو'],
    'اللقاحات والأمصال': ['لقاحات', 'أمصال', 'لقاحات الأطفال', 'لقاحات البالغين', 'لقاحات السفر', 'مصل الكزاز والسعار', 'مضادات السموم', 'غلوبيولينات مناعية (Anti-D / IVIG)'],
    'الفيتامينات والمعادن والمكملات': ['فيتامينات متعددة', 'فيتامين د وكالسيوم', 'حديد ومعادن', 'أوميغا 3 وزيوت', 'مكملات رياضية', 'مكملات الشعر والبشرة', 'فيتامين ب والأعصاب', 'فيتامين C والمناعة', 'فيتامين E ومضادات الأكسدة', 'زنك وسيلينيوم ومعادن نادرة', 'مغنيسيوم', 'ميلاتونين والنوم والاسترخاء', 'التوتر والمزاج', 'الذاكرة والتركيز والدماغ', 'خصوبة الرجال', 'خصوبة النساء', 'الحمل والرضاعة', 'صحة الرجل والبروستات', 'صحة المرأة وسن اليأس', 'المفاصل والغضاريف', 'صحة العيون', 'القلب والدورة الدموية', 'السكر والتمثيل الغذائي', 'الوزن والحرق', 'الكبد والتنظيف', 'الهضم والألياف', 'الطاقة ومكافحة التعب', 'المسالك البولية', 'الغدة الدرقية', 'كولاجين وببتيدات', 'أحماض أمينية وكرياتين', 'كبار السن (50+)', 'بروبيوتيك وبريبيوتيك'],
    'الأم والطفل': ['حليب أطفال', 'حفاضات', 'مكملات الأطفال', 'شرابات الأطفال', 'مستلزمات الرضاعة', 'العناية ببشرة الطفل', 'مراهم الحفاض', 'مستلزمات الاستحمام للأطفال', 'علاج المغص والتسنين', 'قطرات فيتامين للأطفال', 'مستلزمات الحمل', 'مستلزمات النفاس', 'مناديل مبللة', 'حليب أطفال خاص (علاجي)', 'مضخات الحليب', 'ألعاب وسكاكر الأطفال', 'كريمات الحلمات'],
    'الفم والأسنان': ['معاجين وفُرش', 'غسول الفم', 'جل فموي', 'أدوية اللثة والفم', 'خيط أسنان وفرش بين الأسنان', 'تبييض الأسنان', 'مثبتات أطقم الأسنان', 'علاج حساسية الأسنان', 'قطرات ومسكنات الأسنان', 'علاج قروح الفم', 'منتجات تقويم الأسنان', 'معاجين الأطفال', 'معطرات الفم ورائحة الفم', 'منظفات اللسان'],
    'العناية الشخصية والتجميل': ['العناية بالبشرة', 'العناية بالشعر', 'العطور ومزيلات العرق', 'العناية بالجسم', 'المكياج', 'العناية بالأظافر', 'صابون ومنظفات', 'الحلاقة وإزالة الشعر', 'العناية النسائية الحميمة', 'العناية بالشفاه', 'العناية بالقدم واليد', 'العناية بالعين والهالات', 'صبغات الشعر', 'أدوات التجميل', 'التسمير والعناية بعد الشمس', 'العناية بالرجال'],
    'الأعشاب والمنتجات الطبيعية': ['أعشاب وشاي طبي', 'زيوت طبيعية', 'عسل ومنتجات النحل', 'مشروبات وشاي أعشاب', 'مستخلصات نباتية', 'بذور وحبوب طبية', 'علاجات طبيعية للنوم والتوتر', 'مغلي الجهاز الهضمي', 'ماء الورد والزهور', 'صموغ وراتنجات', 'بخور ومعطرات', 'تحلية طبيعية'],
    'الأجهزة والمستلزمات الطبية': ['قياس السكر والضغط', 'موازين الحرارة', 'كمامات وقفازات', 'دعامات وضمادات', 'أجهزة التنفس والبخاخ', 'أجهزة قياس الضغط', 'أجهزة السكر وشرائطها', 'موازين', 'عكازات وكراسي', 'دعامات الظهر والركبة', 'جوارب طبية', 'أجهزة العلاج الطبيعي', 'اختبارات سريعة', 'مستلزمات الإنسولين', 'وسائد وفرش طبية', 'مقاييس وسماعات', 'حفاضات وفوط البالغين'],
    'المحاليل والمستهلكات والإسعافات': ['محاليل وريدية', 'محاقن وإبر', 'إسعافات أولية', 'قطن وشاش', 'مطهرات ومعقمات', 'ضمادات وبلاستر', 'خيوط جراحية', 'قساطر وأكياس البول', 'مستلزمات الجراحة', 'أكياس فغر', 'قفازات الفحص', 'كحول وبيتادين'],
    'الضمادات والمستلزمات الجراحية': ['ضمادات الجروح العامة', 'ضمادات مقاومة للماء', 'ضمادات الحروق', 'ضمادات الجروح المزمنة والقرحة', 'بلاستر لاصق', 'لاصق طبي وشرائط', 'شاش معقم', 'ضمادات ضاغطة ومرنة', 'لواصق إغلاق الجروح', 'ضمادات العيون والأذن', 'مستلزمات العمليات الصغرى', 'أدوات الجراحة والمشارط', 'قفازات جراحية معقمة', 'كمامات وأغطية جراحية', 'مستلزمات الغيار والتعقيم'],
    'المعقمات والمطهرات': ['معقمات اليدين', 'مطهرات الجروح والجلد', 'كحول طبي', 'مطهرات الأسطح والأدوات', 'مطهرات جراحية (Scrub)', 'محاليل غسل الجروح (Saline)', 'بيروكسيد الهيدروجين', 'مناديل معقمة', 'مطهرات الفم والحلق', 'مطهرات العدسات والأجهزة', 'مطهرات المياه والمراحيض'],
    'السمنة والتنحيف': ['أدوية السمنة', 'مثبطات الشهية', 'حارقات الدهون ومكملات التنحيف', 'شاي وأعشاب التنحيف', 'بدائل الوجبات والمشروبات الدايت', 'ألياف الدايت ومانعات امتصاص الدهون', 'بدائل السكر والمحليات']
};
const TAX_BASE = 22;   // الأقسام الجاهزة الأصلية؛ ما بعدها أقسام أُضيفت لاحقاً (تنضاف بزر «إضافة التصنيفات الجديدة»)
function taxSeeded() { return Object.keys(TAX_SEED).slice(0, TAX_BASE).every(d => departments.includes(d)); }
const TAX_OLD_NAMES = { 'الحلاقة وإزالة الشعر': 'الحلاقة والعناية بالرجل' };   // الاسم الجديد ← الاسم القديم الذي قد يكون محمّلاً سابقاً
function taxPendingRenames() { return Object.keys(TAX_OLD_NAMES).filter(n => subCategories.includes(TAX_OLD_NAMES[n]) && !subCategories.includes(n)); }
function taxApplyRenames() {   // يعيد تسمية تصنيف محمَّل سابقاً (في القوائم والمواد) ويرجع المواد المتأثرة
    const touched = new Set();
    taxPendingRenames().forEach(n => {
        const o = TAX_OLD_NAMES[n], i = subCategories.indexOf(o); subCategories[i] = n;
        Object.keys(deptSubs).forEach(d => { deptSubs[d] = (deptSubs[d] || []).map(x => x === o ? n : x); });
        taxLegacy.c = (taxLegacy.c || []).map(x => x === o ? n : x);
        products.forEach(p => { let hit = false; if (p.category === o) { p.category = n; hit = true; } if (extrasOf(p.extraCategories).includes(o)) { p.extraCategories = p.extraCategories.map(x => x === o ? n : x); hit = true; } if (hit) touched.add(p); });
    });
    return [...touched];
}
function taxMissingSubs() { const out = []; Object.keys(TAX_SEED).forEach((d, i) => { if (!departments.includes(d) && i < TAX_BASE) return; const have = departments.includes(d) ? (deptSubs[d] || []) : []; TAX_SEED[d].forEach(s => { if (!have.includes(s) && !(taxLegacy.c || []).includes(s)) out.push([d, s]); }); }); return out; }
async function taxAddNew(btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإضافة...'; }
    const h = Prog.start('إضافة الأقسام والتصنيفات الجديدة', { text: 'تجهيز...' });
    try {
        if (!writesAllowed()) { h.fail('لا يوجد اتصال', 'الإضافة تُحفظ في السحابة، اتصل بالإنترنت وأعد المحاولة'); renderManagerLists(); return; }
        const renamed = taxApplyRenames(), miss = taxMissingSubs();
        if (!miss.length && !renamed.length) { h.ok('كل التصنيفات موجودة أصلاً'); renderManagerLists(); return; }
        miss.forEach(([d, s]) => { if (!departments.includes(d)) departments.push(d); deptSubs[d] = (deptSubs[d] || []).concat(s); if (!subCategories.includes(s)) subCategories.push(s); });
        renderManagerLists(); try { renderAll(); } catch (e) { /* تجاهل */ }   // تظهر محلياً فوراً
        h.set(null, 'حفظ ' + fmtNum(miss.length) + ' تصنيف في السحابة...');
        await pushToCloud(true);
        if (renamed.length) { h.set(null, 'تحديث اسم التصنيف في ' + fmtNum(renamed.length) + ' مادة...'); await saveProductsDelta(renamed.map(p => ({ p, dq: 0, dl: 0 }))); }
        h.ok('أُضيف ' + fmtNum(miss.length) + ' تصنيف جديد' + (renamed.length ? ' وحُدّث اسم تصنيف لـ ' + fmtNum(renamed.length) + ' مادة' : ''));
    } catch (e) {
        h.fail('تعذرت الإضافة', (e && e.message) || String(e));
        try { renderManagerLists(); } catch (x) { /* تجاهل */ }
    }
}
function renderTaxSeedBox() {
    const box = document.getElementById('taxSeedBox'); if (!box) return;
    const subs = Object.values(TAX_SEED).reduce((n, a) => n + a.length, 0);
    const nm = taxSeeded() ? taxMissingSubs().length + taxPendingRenames().length : 0;
    box.innerHTML = taxSeeded()
        ? (nm ? `<h4>🆕 ${fmtNum(nm)} تصنيف جديد متوفر</h4><small style="display:block;color:var(--text-sub);line-height:1.8;margin-bottom:8px">تصنيفات إضافية (مثل الخصوبة والميلاتونين والمفاصل...). تُضاف إلى الأقسام دون المساس بموادك أو تعديلاتك.</small><button type="button" class="icon-btn primary-btn" onclick="taxAddNew(this)">➕ إضافة التصنيفات الجديدة</button><hr style="margin:12px 0;border:none;border-top:1px solid #e2e8f0">` : '') + `<h4>✅ الأقسام الجاهزة محمَّلة</h4><small style="display:block;color:var(--text-sub);line-height:1.8">القديم معلَّم «قديم» ويختفي تلقائياً عندما لا تبقى مادة عليه. يمكنك تعديل أي قسم أو تصنيف أو إضافته أو حذفه. وحذف القديم النهائي يكون من 🗑️ بعد نقل مواده.</small>`
        : `<h4>📥 الأقسام الجاهزة (${Object.keys(TAX_SEED).length} قسم، ${subs} تصنيف)</h4><small style="display:block;color:var(--text-sub);line-height:1.8;margin-bottom:8px">تُضيف أقساماً علاجية جاهزة وتصنيفاتها. <b>لا تغيّر أي مادة</b>، والأقسام القديمة تبقى وتُعلَّم «قديم». يمكنك تعديل الكل بعدها.</small><button type="button" class="icon-btn primary-btn" onclick="taxSeed()">📥 تحميل الأقسام الجاهزة</button>`;
}
async function taxSeed() {
    if (!writesAllowed()) return;
    const r = await Swal.fire({ icon: 'question', title: 'تحميل الأقسام الجاهزة؟', confirmButtonColor: '#0f1c38', showCancelButton: true, confirmButtonText: 'تحميل', cancelButtonText: 'رجوع', width: 'min(94vw, 460px)',
        html: '<div style="text-align:right;font-size:.88rem;line-height:1.9">• تُضاف ' + Object.keys(TAX_SEED).length + ' قسم وتصنيفاتها.<br>• <b>المواد لا تنتقل ولا تتغير.</b><br>• القديم يبقى ويُعلَّم «قديم»، ويختفي عندما يفرغ.<br>• يُفضَّل أخذ نسخة احتياطية قبل ذلك.</div>' });
    if (!r.isConfirmed) return;
    const oldD = departments.slice(), oldC = subCategories.slice();
    const newD = Object.keys(TAX_SEED), newC = new Set(Object.values(TAX_SEED).flat());
    taxLegacy = { d: [...new Set([...taxLegacy.d, ...oldD.filter(d => !newD.includes(d))])], c: [...new Set([...taxLegacy.c, ...oldC.filter(c => !newC.has(c))])] };
    newD.forEach(d => { if (!departments.includes(d)) departments.push(d); deptSubs[d] = TAX_SEED[d].slice(); TAX_SEED[d].forEach(c => { if (!subCategories.includes(c)) subCategories.push(c); }); });
    const h = Prog.start('تحميل الأقسام الجاهزة', { text: 'حفظ الأقسام في السحابة...' });
    try { await pushToCloud(true); } catch (e) { h.fail('تعذر الحفظ', e && e.message); return; }
    renderManagerLists(); renderAll();
    h.ok('تم تحميل ' + Object.keys(TAX_SEED).length + ' قسم وتصنيفاتها');
}
{ const _rml = renderManagerLists; renderManagerLists = function () { _rml(); renderTaxSeedBox(); }; }

// =====================================================================
// مراجعة التصنيف: لكل مادة في قسم قديم نقترح (القسم + التصنيف + الشكل) وإنت تضغط ✓ صح أو ✗ خطأ (وتصحّح)، وبعدها «تطبيق».
// ما يتغيّر شي بالمواد إلا بعد ضغط «تطبيق المعتمد».
// =====================================================================
const TAX_DEPTS = Object.keys(TAX_SEED);
const TAX_LEGACY_HINT = { 'واقيات الشمس': [19, 1], 'العناية بالشعر والشامبو': [19, 2], 'غسولات وعلاجات حب الشباب': [8, 4], 'المرطبات والترميم': [8, 5], 'التفتيح والتقشير': [19, 1], 'المضادات الموضعية (بكتيريا/فطريات/طفيليات)': [8, 3], 'الكورتيزونات والمراهم الموضعية': [8, 1] };
let taxRv = {}, taxRvFilter = 'new', taxRvQ = '', taxRvShown = 60, taxRvFirst = null;
try { taxRv = JSON.parse(localStorage.getItem('diwanTaxRv')) || {}; } catch (e) { taxRv = {}; }
function taxRvSave() { try { localStorage.setItem('diwanTaxRv', JSON.stringify(taxRv)); } catch (e) { /* تجاهل */ } }
function taxKeys(n) { const k = taxKey(n), b = k.replace(/\s+(cream|ointment|tablets?|capsules?|syrup|gel|solution|drops|shampoo|lotion|spray|ampoule|vial|suspension)$/, ''); return b !== k ? [k, b] : [k]; }
function taxKey(n) { return String(n || '').toLowerCase().split(/\s\d|\s*\(|\s[x×]\s*\d/)[0].trim(); }
let taxFirstIdx = null;
// قواعد بالكلمات (أولوية على الجدول) للمنتجات الواضحة: [regex، القسم، التصنيف]
const TAX_KW = [
    [/lozenges?|pastilles?|لوزنج|اقراص\s*مص|أقراص\s*مص|strepsils/i, 'الأذن والأنف والحنجرة', 'أقراص مص للحلق'],
    [/postpartum|post-?partum|maternity\s*(belt|girdle|support|pads?|napkins?|briefs?|panties)|abdomen\s*(belt|band|support)|belly\s*(band|belt)|مشد\s*(النفاس|الولادة|البطن)|نفاس/i, 'الأم والطفل', 'مستلزمات النفاس'],
    [/nipple\s*(cream|balm|ointment|butter|salve|care)|(cream|balm|ointment)\s*(for\s*)?nipples?|lanolin|كريم\s*(ال)?حلمات|مرهم\s*(ال)?حلمات/i, 'الأم والطفل', 'كريمات الحلمات'],
    [/tongue\s*(scraper|cleaner|brush)|منظف\s*(ال)?لسان|مكشطة\s*(ال)?لسان/i, 'الفم والأسنان', 'منظفات اللسان'],
    [/interdental|floss|dental\s*tape|بين\s*الأسنان|بين\s*الاسنان|خيط\s*(ال)?أ?سنان/i, 'الفم والأسنان', 'خيط أسنان وفرش بين الأسنان'],
    [/whiten[^,]*(tooth\s*paste|toothpaste)|(tooth\s*paste|toothpaste)[^,]*whiten/i, 'الفم والأسنان', 'تبييض الأسنان'],
    [/sensitiv[^,]*(tooth\s*paste|toothpaste)|(tooth\s*paste|toothpaste)[^,]*sensitiv/i, 'الفم والأسنان', 'علاج حساسية الأسنان'],
    [/tooth\s*paste|toothpaste|dentifrice|معجون\s*(ال)?أ?سنان/i, 'الفم والأسنان', 'معاجين وفُرش'],
    [/tooth\s*brush|toothbrush|فرشاة\s*(ال)?أ?سنان/i, 'الفم والأسنان', 'معاجين وفُرش'],
    [/anti-?\s*d\b|rhophylac|rhogam|rh\s*immune|immun[eo]?\s*globulin|immunoglobulin|\bivig\b|غلوبيولين/i, 'اللقاحات والأمصال', 'غلوبيولينات مناعية (Anti-D / IVIG)', [['النسائية والتوليد والهرمونات', 'أدوية الولادة والرحم']]],
    [/^(?=.*(patch|sticker|لصاق|لصق)).*(fever\s*track|temperature|thermo|track|monitor|تتبع|قياس\s*(ال)?حرارة|حرارة\s*(ال)?جسم)/i, 'الأجهزة والمستلزمات الطبية', 'موازين الحرارة'],
    [/^(?=.*(patch|plaster|pad|لصق)).*(fever|cooling|حمى|حرارة|خافض)/i, 'المسكنات والعظام والعضلات', 'باراسيتامول وخافضات الحرارة', [['المسكنات والعظام والعضلات', 'مسكنات وخافضات حرارة للأطفال']]],
    [/^(?=.*(patch|plaster|لصق|لصقة)).*(pain|joint|muscle|arthritis|ache|hot|heat|warm|cool|salonpas|capsicum|knee|back|neck|shoulder|رقبة|ظهر|مفاصل|الم|ألم|مسكن)/i, 'المسكنات والعظام والعضلات', 'لصقات مسكنة'],
    [/^(?=.*(women|woman|feminine|femin|ladies|for\s*her|نسائي|للنساء)).*(probiotic|cranberr|بروبيوتيك|كرانبيري)|^(?=.*(probiotic|بروبيوتيك)).*(cranberr|كرانبيري)/i, 'الفيتامينات والمعادن والمكملات', 'بروبيوتيك وبريبيوتيك', [['الفيتامينات والمعادن والمكملات', 'صحة المرأة وسن اليأس'], ['الفيتامينات والمعادن والمكملات', 'المسالك البولية']]],
    [/probiotic|prebiotic|synbiotic|lactobac|bifido|بروبيوتيك|بروبايوتك|بريبيوتيك|بري\s*بايوتك|بري\s*بيوتك/i, 'الفيتامينات والمعادن والمكملات', 'بروبيوتيك وبريبيوتيك', [['الجهاز الهضمي والكبد', 'بروبيوتيك']]],
    [/cranberr|كرانبيري|توت\s*بري/i, 'الفيتامينات والمعادن والمكملات', 'المسالك البولية'],
    [/breast\s*pads?|nursing\s*pads?|nipple\s*(pads?|covers?|shields?)|lactation\s*pads?|فوط\s*(الرضاعة|الصدر)/i, 'الأم والطفل', 'مستلزمات الرضاعة'],
    [/adult\s*(diapers?|pads?|pants?|briefs?|underwear|incontinence)|incontinence|under-?\s*pads?|bed\s*pads?|pull-?\s*ups?\s*(for\s*)?adults?|adult[^,]*(pull-?\s*ups?|pants)|(حفاض|حفاظ|كيلوت|فوط|سروال)[^,]*(بالغين|مسنين|كبار|سلس)|(بالغين|مسنين|كبار)[^,]*(حفاض|حفاظ|كيلوت)/i, 'الأجهزة والمستلزمات الطبية', 'حفاضات وفوط البالغين'],
    [/sanitary\s*(pads?|napkins?|towels?)|panty\s*liners?|period\s*pads?|فوط\s*(صحية|نسائية)|فوطة|always\b|kotex|libresse/i, 'العناية الشخصية والتجميل', 'العناية النسائية الحميمة'],
    [/diapers?|pampers|huggies|molfix|sanita|nappy|nappies|حفاض|حفاظ/i, 'الأم والطفل', 'حفاضات'],
    [/pregabalin|lyrica|pregafix|pregalin|gabapentin|neurontin|gabator|بريجابالين|بريغابالين|جابابنتين|غابابنتين/i, 'الجهاز العصبي والنفسي', 'أدوية الألم العصبي', [['الجهاز العصبي والنفسي', 'أدوية الأعصاب الطرفية'], ['الجهاز العصبي والنفسي', 'مضادات الصرع']]],
    [/^(?!.*(eye|ophthalm|ocular|\btears?\b|drops?|\bgel\s*drops|عين|قطر)).*(condoms?|durex|trojan|playboy|manforce|lubricant|lube\b|واقي\s*ذكري|واقيات\s*ذكرية|عازل\s*ذكري|مزلق)/i, 'النسائية والتوليد والهرمونات', 'الواقيات الذكرية والمزلقات', [['النسائية والتوليد والهرمونات', 'وسائل منع الحمل الأخرى']]],
    [/^(?=.*(lidocaine|lignocaine|ليدوكائين|ليدوكين))(?=.*(\biv\b|vial|ampou?le|inject|amp\b|فيال|امبول|أمبول)).*/i, 'المسكنات والعظام والعضلات', 'مخدرات موضعية وحقن التخدير', [['القلب والضغط والدهون', 'مضادات اضطراب النظم']]],
    [/lidocaine|lignocaine|xylocaine|bupivacaine|marcaine|articaine|septanest|ubistesin|procaine|mepivacaine|scandonest|prilocaine|emla|levobupivacaine|ropivacaine|ليدوكائين|ليدوكين|زايلوكائين/i, 'المسكنات والعظام والعضلات', 'مخدرات موضعية وحقن التخدير'],
    [/(fitting|tighten\w*|tightening)\s*insert\w*|vaginal\s*(tighten\w*|insert\w*)|شد\s*المهبل/i, 'النسائية والتوليد والهرمونات', 'العناية الحميمة وشد المهبل'],
    [/orlistat|onlefit|xenical|alli\b|zeroxen|اورليستات|أورليستات|زينيكال/i, 'السمنة والتنحيف', 'أدوية السمنة', [['السكري والغدد الصماء', 'أدوية السمنة']]],
    [/phentermine|sibutramine|appetite|سيبوترامين|كابح\s*الشهية/i, 'السمنة والتنحيف', 'مثبطات الشهية'],
    [/slim(ming)?\s*tea|detox\s*tea|slimming\s*(tea|herbal)|شاي\s*(التنحيف|الرجيم|السلم)/i, 'السمنة والتنحيف', 'شاي وأعشاب التنحيف'],
    [/fat\s*burn|slimming|garcinia|green\s*coffee|cla\b|حارق|تنحيف|جارسينيا/i, 'السمنة والتنحيف', 'حارقات الدهون ومكملات التنحيف', [['الفيتامينات والمعادن والمكملات', 'الوزن والحرق']]],
    [/meal\s*replacement|diet\s*(shake|drink|bar|meal)|بديل\s*الوجبات/i, 'السمنة والتنحيف', 'بدائل الوجبات والمشروبات الدايت'],
    [/fat\s*binder|carb\s*blocker|white\s*kidney|chitosan|كيتوزان/i, 'السمنة والتنحيف', 'ألياف الدايت ومانعات امتصاص الدهون'],
    [/stevia|sweetener|saccharin|sucralose|aspartame|tropicana\s*slim|sugar\s*substitute|ستيفيا|سكرين|محلي|بديل\s*السكر|سكرالوز/i, 'السكري والغدد الصماء', 'بدائل السكر والمحليات', [['السمنة والتنحيف', 'بدائل السكر والمحليات']]],
    [/(pillow|cushion|mattress|وسادة|مخدة|وسائد|فرشة)/i, 'الأجهزة والمستلزمات الطبية', 'وسائد وفرش طبية'],
    [/^(?=.*(baby|kids?|infant|children|اطفال|أطفال|طفل)).*(vaseline|petroleum\s*jelly|فازلين)/i, 'الأم والطفل', 'العناية ببشرة الطفل', [['الجلدية', 'ترطيب البشرة']]],
    [/alcohol\s*(swab|pad|prep)|rubbing\s*alcohol|medical\s*alcohol|isopropyl|ethanol|كحول طبي|^alcohol\b/i, 'المعقمات والمطهرات', 'كحول طبي'],
    [/water-?proof[^,]*(dressing|plaster|bandage|film)|(dressing|plaster|bandage)[^,]*water-?proof|ضماد[^,]*ماء/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات مقاومة للماء'],
    [/hydrocolloid|foam\s*dressing|bed\s*sore|pressure\s*(ulcer|sore)|alginate|ulcer\s*dressing/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات الجروح المزمنة والقرحة'],
    [/burn[^,]*dressing|tulle|paraffin\s*gauze|jelonet/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات الحروق'],
    [/steri-?strip|wound\s*closure|skin\s*closure|suture\s*strip/i, 'الضمادات والمستلزمات الجراحية', 'لواصق إغلاق الجروح'],
    [/eye\s*(pad|patch|dressing)|ear\s*dressing/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات العيون والأذن'],
    [/^(?!.*(nasal|pain|medicated|joint|hot|cold)).*(band-?aid|adhesive\s*(bandage|strips?)|\bplasters?\b|بلاستر)/i, 'الضمادات والمستلزمات الجراحية', 'بلاستر لاصق'],
    [/surgical\s*tape|medical\s*tape|micropore|paper\s*tape|zinc\s*oxide\s*tape|لاصق طبي/i, 'الضمادات والمستلزمات الجراحية', 'لاصق طبي وشرائط'],
    [/gauze|swabs?\b|شاش/i, 'الضمادات والمستلزمات الجراحية', 'شاش معقم'],
    [/elastic\s*bandage|crepe|bandage|ضماد ضاغط|رباط/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات ضاغطة ومرنة'],
    [/scalpel|surgical\s*blade|forceps|surgical\s*scissors|مشرط/i, 'الضمادات والمستلزمات الجراحية', 'أدوات الجراحة والمشارط'],
    [/^(?!.*(surgical|scalpel|cream|foam|gel|lotion|after|مشرط)).*(razors?\b|shavers?\b|gillette|\bblades?\b|shaving|شفرة حلاقة|ماكينة حلاقة|مكينة حلاقة)/i, 'العناية الشخصية والتجميل', 'الحلاقة وإزالة الشعر'],
    [/(surgical|sterile|examination)\s*gloves?|قفازات جراحية/i, 'الضمادات والمستلزمات الجراحية', 'قفازات جراحية معقمة'],
    [/surgical\s*(mask|drape|gown|cap)|^(?!.*(sheet|clay|peel|beauty|facial|hydrat|collagen|mud|cream|gel|moistur|whiten|serum|mask\s*for|charcoal|عناية|ماسك)).*face\s*mask/i, 'الضمادات والمستلزمات الجراحية', 'كمامات وأغطية جراحية'],
    [/dressing|wound\s*care|ضماد/i, 'الضمادات والمستلزمات الجراحية', 'ضمادات الجروح العامة'],
    [/hand\s*(sanitizer|sanitiser|rub)|sanitizer|sanitiser|معقم (ايدي|أيدي)/i, 'المعقمات والمطهرات', 'معقمات اليدين'],
    [/surgical\s*scrub|hibiscrub|scrub\s*(brush|solution)\b/i, 'المعقمات والمطهرات', 'مطهرات جراحية (Scrub)'],
    [/hydrogen\s*peroxide|بيروكسيد/i, 'المعقمات والمطهرات', 'بيروكسيد الهيدروجين'],
    [/saline[^,]*(wash|spray|irrigat)|wound\s*wash|normal\s*saline/i, 'المعقمات والمطهرات', 'محاليل غسل الجروح (Saline)'],
    [/(disinfect|antiseptic|sanit)\w*[^,]*wipes?|wipes?[^,]*(disinfect|antiseptic|alcohol)/i, 'المعقمات والمطهرات', 'مناديل معقمة'],
    [/lens[^,]*(solution|disinfect)|multi-?purpose\s*solution|معقم عدسات/i, 'المعقمات والمطهرات', 'مطهرات العدسات والأجهزة'],
    [/disinfect\w*|surface\s*spray|chlorine|bleach|معقم أسطح/i, 'المعقمات والمطهرات', 'مطهرات الأسطح والأدوات'],
    [/^(?!.*(mouth|throat|gargle|lozenge|cream|ointment|shampoo)).*(betadine|povidone|iodine|chlorhexidine|savlon|dettol|cetrimide|antiseptic|مطهر)/i, 'المعقمات والمطهرات', 'مطهرات الجروح والجلد'],
    [/floss|interdental|inter-dental|inter-?\s*d[a-z]{2,6}al|l-?\s*shaped[^,]*brush|tooth\s*picks?|خلة\s*اسنان|خلة\s*أسنان|خيط اسنان|خيط أسنان|بين الاسنان|بين الأسنان/i, 'الفم والأسنان', 'خيط أسنان وفرش بين الأسنان'],
    [/tooth\s*paste|toothpaste|dentifrice|tooth\s*brush|toothbrush|معجون اسنان|معجون أسنان|فرشاة/i, 'الفم والأسنان', 'معاجين وفُرش'],
    [/whiten\w*[^,]*strips?|strips?[^,]*whiten|teeth\s*strips?|tooth\s*strips?|شرائط تبييض|teeth\s*whiten|تبييض الاسنان|تبييض الأسنان/i, 'الفم والأسنان', 'تبييض الأسنان'],
    [/mouth\s*wash|mouthwash|mouth\s*rinse|غسول فم/i, 'الفم والأسنان', 'غسول الفم'],
    [/breath[^,]*(strips?|film|spray|mints?|freshener|drops)|(strips?|film|spray|mints?)[^,]*breath|oral\s*strips?|mouth\s*strips?|رائحة الفم|معطر فم/i, 'الفم والأسنان', 'معطرات الفم ورائحة الفم'],
    [/lip\s*(balm|care|stick|gloss|salve|butter|therap\w*|moistur\w*|mask|scrub|treatment|defen[cs]e|protect\w*|repair|shield|spf|sun\w*|conditioner|plump\w*)|lipstick|مرطب شفاه|بلسم شفاه/i, 'العناية الشخصية والتجميل', 'العناية بالشفاه'],
    // أدوية الأورام والمناعة
    [/tamoxifen|nolvadex|anastrozole|arimidex|exemestane|aromasin|bicalutamide|casodex|flutamide|megestrol|fulvestrant|faslodex|goserelin|zoladex|leuprolide|leuprorelin|تاموكسيفين|اناستروزول|أناستروزول|بيكالوتاميد/i, 'الأورام والمناعة', 'العلاج الهرموني للأورام'],
    [/capecitabine|xeloda|imatinib|glivec|temozolomide|hydroxyurea|hydroxycarbamide|mercaptopurine|erlotinib|gefitinib|sorafenib|sunitinib|lenalidomide|abiraterone|olaparib/i, 'الأورام والمناعة', 'أدوية السرطان الفموية'],
    [/paclitaxel|docetaxel|cisplatin|carboplatin|oxaliplatin|doxorubicin|epirubicin|gemcitabine|fluorouracil|5-?\s*fu\b|cyclophosphamide|vincristine|vinorelbine|etoposide|irinotecan|bleomycin|cytarabine|methotrexate\s*(vial|inj|amp)/i, 'الأورام والمناعة', 'أدوية الأورام'],
    [/granisetron|palonosetron|aprepitant|emend\b/i, 'الأورام والمناعة', 'أدوية الغثيان الكيماوي'],
    [/tacrolimus|prograf|mycophenol|cellcept|cyclosporin|sandimmun|azathioprine|imuran|sirolimus|everolimus/i, 'الأورام والمناعة', 'أدوية زرع الأعضاء'],
    // تحفيز التبويض والخصوبة
    [/letrozole|femara|clomiphene|clomid|clomifen|pregnyl|ovitrelle|choriomon|\bhcg\b|menopur|gonal-?\s*f|puregon|follitropin|ovidrel/i, 'النسائية والتوليد والهرمونات', 'محفزات التبويض'],
    // حمض الترانيكساميك: موضعي ← تصبغات، فموي/حقن ← مرقئات
    [/^(?=.*(tranexamic|tranacix|transamin|cyklokapron|ترانيكساميك|ترانكسا)).*(cream|gel|serum|lotion|topical|كريم|جل|سيروم|tranacix)/i, 'الجلدية', 'علاج التصبغات والكلف'],
    [/tranexamic|transamin|cyklokapron|ترانيكساميك/i, 'الدم والتخثر', 'مرقئات'],
    // أي مادة اسمها فيها «Vitamin / فيتامين»: تُقترح ضمن المكملات (قاعدة احتياطية في آخر القائمة فتتقدم عليها القواعد الأخصّ). فيتامين K له تصنيفه بالدم فيُستثنى
    [/vitamin\s*-?\s*d\b|vitamin\s*-?\s*d[2-4]\b|فيتامين\s*د\b/i, 'الفيتامينات والمعادن والمكملات', 'فيتامين د وكالسيوم'],
    [/^(?!.*(vitamin\s*-?\s*k\d*\b|فيتامين\s*ك\b|cream|ointment|lotion|serum|shampoo|soap|\bgel\b|spray|barrier|face|skin|hair|lip|eye|drops?\s*for\s*eye|كريم|مرهم|شامبو|صابون)).*(vitamin|vitamins|فيتامين)/i, 'الفيتامينات والمعادن والمكملات', 'فيتامينات متعددة'],
];
function taxKwHit(name) {
    for (const [re, d, s] of TAX_KW) if (re.test(name || '')) { const di = TAX_DEPTS.indexOf(d), si = di < 0 ? -1 : TAX_SEED[d].indexOf(s); if (si >= 0) return { d: di + 1, s: si + 1, guess: false }; }
    return null;
}
// دليل الشكل الدوائي من الاسم: يأتي بعد الجدول الدقيق وقبل التخمينات (القسم القديم / أول كلمة)، فاسم مثل «... Eye Drops» لا يذهب للعناية الشخصية
const TAX_FORM_HINTS = [
    [/(sodium\s*chloride|nacl|hypertonic|muro\s*128|endenorm|ملح\s*مرتفع)[^\n]*(5\s*%|2\s*%)|(5\s*%|2\s*%)[^\n]*(sodium\s*chloride|nacl)|endenorm|muro\s*128|corneal\s*edema|وذمة\s*القرنية|وذمة\s*العين/i, 'العيون', 'أدوية وذمة القرنية'],
    [/eye\s*(oint\w*)|ophthalmic\s*(oint\w*)|مرهم\s*عين/i, 'العيون', 'مراهم العين'],
    [/artificial\s*tears?|lubricant\s*eye|dry\s*eyes?|\btears\b|دموع\s*صناعية/i, 'العيون', 'دموع صناعية'],
    [/eye\s*-?\s*drops?|eyedrops?|ophthalmic|eye\s*(gel|wash|spray)|ocular|قطرة\s*عين|قطرات\s*عين/i, 'العيون', 'قطرات عين مركّبة'],
    [/ear\s*-?\s*drops?|otic|قطرة\s*أذن|قطرات\s*أذن|قطرة\s*اذن/i, 'الأذن والأنف والحنجرة', 'قطرات الأذن'],
    [/nasal\s*(spray|drops?)|nose\s*(spray|drops?)|nasal|بخاخ\s*أنف|قطرة\s*أنف|قطرات\s*أنف/i, 'الأذن والأنف والحنجرة', 'قطرات وبخاخات الأنف'],
    [/throat\s*spray|gargle|بخاخ\s*حلق|غرغرة/i, 'الأذن والأنف والحنجرة', 'بخاخات الحلق'],
    [/vaginal|pessar(y|ies)|ovules?|مهبل|تحاميل\s*مهبلية/i, 'النسائية والتوليد والهرمونات', 'تحاميل ومراهم مهبلية'],
    [/sunscreen|sunblock|sun\s*(cream|block|protect\w*)|spf\s*\d+|واقي\s*شمس/i, 'الجلدية', 'واقيات الشمس']
];
function taxFormHit(name) {
    for (const [re, d, s] of TAX_FORM_HINTS) if (re.test(name || '')) { const di = TAX_DEPTS.indexOf(d), si = di < 0 ? -1 : TAX_SEED[d].indexOf(s); if (si >= 0) return { d: di + 1, s: si + 1, guess: true }; }
    return null;
}
// قاموس المواد الفعالة: يُفحص على (الاسم + المادة الفعالة) بعد الجدول الدقيق وقاعدة الشكل، وقبل التخمينات. الأخصّ أولاً
const TAX_ING = [
    [/(betamethasone|hydrocortisone|clobetasol|mometasone|fluocinolone|triamcinolone|desonide|fluocinonide)[^,]*(cream|ointment|lotion|oint\b|gel)|(cream|ointment|lotion|oint\b)[^,]*(betamethasone|hydrocortisone|clobetasol|mometasone|fluocinolone|triamcinolone)/i, 'الجلدية', 'كورتيزون موضعي'],
    [/(diclofenac|ketoprofen|piroxicam|ibuprofen|nimesulide|etofenamate)[^,]*\bgel\b|\bgel\b[^,]*(diclofenac|ketoprofen|piroxicam|ibuprofen)/i, 'المسكنات والعظام والعضلات', 'جل NSAID موضعي'],
    [/(fusidic|mupirocin|neomycin|bacitracin|silver\s*sulfadiazine)[^,]*(cream|ointment)|(clindamycin|erythromycin)[^,]*(gel|lotion|topical)/i, 'الجلدية', 'مضادات حيوية موضعية'],
    [/(clotrimazole|miconazole|ketoconazole|terbinafine|econazole|bifonazole|nystatin)[^,]*(cream|ointment|lotion|spray)|(cream|ointment)[^,]*(clotrimazole|miconazole|terbinafine)/i, 'الجلدية', 'مضادات فطريات موضعية'],
    [/isotretinoin|adapalene|tretinoin|benzoyl\s*peroxide|azelaic|tazarotene/i, 'الجلدية', 'علاج حب الشباب'],
    [/minoxidil/i, 'الجلدية', 'علاج تساقط الشعر'],
    [/calcipotriol|calcipotriene|anthralin|dithranol/i, 'الجلدية', 'أدوية الصدفية'],
    [/permethrin|benzyl\s*benzoate|lindane/i, 'الجلدية', 'القمل والجرب'],
    [/hydroquinone|kojic|arbutin|tranexamic/i, 'الجلدية', 'علاج التصبغات والكلف'],
    [/(enalapril|lisinopril|ramipril|captopril|perindopril|quinapril|benazepril|fosinopril|losartan|valsartan|irbesartan|candesartan|telmisartan|olmesartan|azilsartan)[^,]*(hydrochlorothiazide|hctz|amlodipine|indapamide)|(hydrochlorothiazide|hctz|amlodipine)[^,]*(enalapril|lisinopril|ramipril|perindopril|losartan|valsartan|irbesartan|candesartan|telmisartan|olmesartan)/i, 'القلب والضغط والدهون', 'أدوية الضغط المركّبة'],
    [/enalapril|lisinopril|ramipril|captopril|perindopril|quinapril|benazepril|fosinopril/i, 'القلب والضغط والدهون', 'خافضات الضغط (ACEI)'],
    [/losartan|valsartan|irbesartan|candesartan|telmisartan|olmesartan|azilsartan/i, 'القلب والضغط والدهون', 'خافضات الضغط (ARB)'],
    [/atenolol|bisoprolol|metoprolol|propranolol|carvedilol|nebivolol|labetalol|sotalol/i, 'القلب والضغط والدهون', 'حاصرات بيتا'],
    [/amlodipine|nifedipine|felodipine|diltiazem|verapamil|lercanidipine|nicardipine|nimodipine/i, 'القلب والضغط والدهون', 'حاصرات الكالسيوم'],
    [/furosemide|frusemide|torsemide|torasemide|bumetanide/i, 'القلب والضغط والدهون', 'مدرات الحلقة'],
    [/hydrochlorothiazide|indapamide|chlorthalidone|chlorothiazide/i, 'القلب والضغط والدهون', 'مدرات الثيازيد'],
    [/spironolactone|eplerenone|aldactone/i, 'القلب والضغط والدهون', 'مضادات الألدوستيرون'],
    [/atorvastatin|rosuvastatin|simvastatin|pravastatin|lovastatin|pitavastatin|fenofibrate|gemfibrozil|ezetimibe|bezafibrate/i, 'القلب والضغط والدهون', 'خافضات الدهون'],
    [/isosorbide|nitroglycerin|glyceryl\s*trinitrate|\bgtn\b|nicorandil/i, 'القلب والضغط والدهون', 'نيترات'],
    [/digoxin|lanoxin/i, 'القلب والضغط والدهون', 'ديجوكسين'],
    [/amiodarone|flecainide|propafenone|dronedarone/i, 'القلب والضغط والدهون', 'مضادات اضطراب النظم'],
    [/trimetazidine|ranolazine/i, 'القلب والضغط والدهون', 'أدوية الذبحة'],
    [/ivabradine|sacubitril/i, 'القلب والضغط والدهون', 'أدوية قصور القلب'],
    [/diosmin|hesperidin|troxerutin|calcium\s*dobesilate|rutoside/i, 'القلب والضغط والدهون', 'أدوية الدوالي والأوردة'],
    [/clopidogrel|ticagrelor|prasugrel|dipyridamole|cilostazol|aspirin\s*(75|81|100)|plavix/i, 'الدم والتخثر', 'مضادات الصفيحات'],
    [/warfarin|rivaroxaban|apixaban|dabigatran|edoxaban|enoxaparin|heparin|fondaparinux|acenocoumarol/i, 'الدم والتخثر', 'مضادات التخثر'],
    [/omeprazole|esomeprazole|pantoprazole|lansoprazole|rabeprazole|dexlansoprazole/i, 'الجهاز الهضمي والكبد', 'مثبطات مضخة البروتون (PPI)'],
    [/famotidine|ranitidine|cimetidine|nizatidine/i, 'الجهاز الهضمي والكبد', 'مضادات H2'],
    [/magnesium\s*hydroxide|aluminium\s*hydroxide|aluminum\s*hydroxide|sodium\s*alginate|magaldrate|sucralfate/i, 'الجهاز الهضمي والكبد', 'مضادات الحموضة'],
    [/simethicone|dimethicone|activated\s*charcoal/i, 'الجهاز الهضمي والكبد', 'مضادات الانتفاخ والغازات'],
    [/lactulose|bisacodyl|senna|sennosides|macrogol|polyethylene\s*glycol|picosulfate|glycerin\s*suppos/i, 'الجهاز الهضمي والكبد', 'مسهلات'],
    [/loperamide|diphenoxylate|racecadotril|nifuroxazide/i, 'الجهاز الهضمي والكبد', 'مضادات الإسهال'],
    [/hyoscine|scopolamine|drotaverine|mebeverine|trimebutine|otilonium|pinaverium|alverine|papaverine/i, 'الجهاز الهضمي والكبد', 'مضادات التقلص الهضمي'],
    [/domperidone|metoclopramide|ondansetron|zofran|itopride|prochlorperazine|meclizine/i, 'الجهاز الهضمي والكبد', 'مضادات القيء'],
    [/ursodeoxycholic|ursodiol|silymarin|silybin|ademetionine|l-?ornithine/i, 'الجهاز الهضمي والكبد', 'أدوية الكبد والصفراء'],
    [/pancreatin|pancrelipase|bromelain|lipase/i, 'الجهاز الهضمي والكبد', 'أنزيمات هضمية'],
    [/mesalazine|mesalamine|sulfasalazine|balsalazide/i, 'الجهاز الهضمي والكبد', 'أدوية التهاب الأمعاء'],
    [/psyllium|ispaghula|methylcellulose|plantago/i, 'الجهاز الهضمي والكبد', 'ألياف وملينات الحجم'],
    [/oral\s*rehydration|\bors\b|rehydration\s*salts?/i, 'الجهاز الهضمي والكبد', 'أملاح الإماهة الفموية'],
    [/salbutamol|albuterol|terbutaline|formoterol|salmeterol|ipratropium|tiotropium|theophylline|aminophylline|ventolin/i, 'الجهاز التنفسي والحساسية', 'موسعات القصبات'],
    [/montelukast|zafirlukast|singulair/i, 'الجهاز التنفسي والحساسية', 'مضادات اللوكوترين'],
    [/cetirizine|loratadine|desloratadine|fexofenadine|levocetirizine|chlorpheniramine|chlorphenamine|diphenhydramine|ebastine|rupatadine|bilastine|hydroxyzine|cyproheptadine|promethazine/i, 'الجهاز التنفسي والحساسية', 'مضادات الهيستامين'],
    [/ambroxol|bromhexine|guaifenesin|guaiphenesin|acetylcysteine|carbocisteine|carbocysteine|erdosteine|mucolytic|ivy\s*leaf|hedera/i, 'الجهاز التنفسي والحساسية', 'مقشعات'],
    [/dextromethorphan|butamirate|levodropropizine|codeine\s*(linctus|syrup)|pholcodine/i, 'الجهاز التنفسي والحساسية', 'مضادات السعال'],
    [/pseudoephedrine|phenylephrine|oxymetazoline|xylometazoline/i, 'الجهاز التنفسي والحساسية', 'مزيلات الاحتقان'],
    [/insulin|glargine|aspart|lispro|detemir|degludec|glulisine|lantus|novorapid|mixtard/i, 'السكري والغدد الصماء', 'إنسولين'],
    [/metformin|glucophage/i, 'السكري والغدد الصماء', 'ميتفورمين'],
    [/gliclazide|glimepiride|glibenclamide|glyburide|glipizide|diamicron|amaryl/i, 'السكري والغدد الصماء', 'سلفونيل يوريا'],
    [/sitagliptin|vildagliptin|linagliptin|saxagliptin|alogliptin|januvia|galvus/i, 'السكري والغدد الصماء', 'مثبطات DPP-4'],
    [/empagliflozin|dapagliflozin|canagliflozin|ertugliflozin|jardiance|forxiga/i, 'السكري والغدد الصماء', 'مثبطات SGLT2'],
    [/liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|ozempic|victoza/i, 'السكري والغدد الصماء', 'حقن GLP-1'],
    [/pioglitazone|repaglinide|nateglinide|acarbose/i, 'السكري والغدد الصماء', 'أقراص السكري'],
    [/levothyroxine|thyroxine|liothyronine|carbimazole|methimazole|propylthiouracil|euthyrox|eltroxin/i, 'السكري والغدد الصماء', 'أدوية الغدة الدرقية'],
    [/prednisolone|prednisone|dexamethasone|methylprednisolone|hydrocortisone|triamcinolone|deflazacort|betamethasone/i, 'السكري والغدد الصماء', 'كورتيزونات فموية وحقن'],
    [/alendronate|risedronate|ibandronate|zoledronic|raloxifene|denosumab/i, 'المسكنات والعظام والعضلات', 'أدوية هشاشة العظام'],
    [/carbamazepine|valpro|levetiracetam|lamotrigine|phenytoin|topiramate|oxcarbazepine|phenobarbital|lacosamide|zonisamide|primidone/i, 'الجهاز العصبي والنفسي', 'مضادات الصرع'],
    [/sertraline|fluoxetine|escitalopram|citalopram|paroxetine|venlafaxine|duloxetine|amitriptyline|nortriptyline|mirtazapine|bupropion|trazodone|fluvoxamine|vortioxetine|agomelatine/i, 'الجهاز العصبي والنفسي', 'مضادات الاكتئاب'],
    [/diazepam|lorazepam|alprazolam|clonazepam|bromazepam|buspirone|midazolam|oxazepam/i, 'الجهاز العصبي والنفسي', 'مضادات القلق'],
    [/zolpidem|zopiclone|eszopiclone|zaleplon/i, 'الجهاز العصبي والنفسي', 'منومات (Z-drugs)'],
    [/risperidone|olanzapine|quetiapine|aripiprazole|haloperidol|clozapine|amisulpride|paliperidone|ziprasidone|sulpiride/i, 'الجهاز العصبي والنفسي', 'مضادات الذهان'],
    [/levodopa|carbidopa|pramipexole|ropinirole|rasagiline|benserazide|selegiline|trihexyphenidyl|amantadine/i, 'الجهاز العصبي والنفسي', 'أدوية باركنسون'],
    [/sumatriptan|rizatriptan|zolmitriptan|eletriptan|naratriptan|flunarizine/i, 'الجهاز العصبي والنفسي', 'أدوية الصداع والشقيقة'],
    [/donepezil|memantine|rivastigmine|galantamine/i, 'الجهاز العصبي والنفسي', 'أدوية الخرف'],
    [/methylphenidate|atomoxetine|lisdexamfetamine/i, 'الجهاز العصبي والنفسي', 'أدوية ADHD'],
    [/lithium/i, 'الجهاز العصبي والنفسي', 'مثبتات المزاج'],
    [/betahistine|cinnarizine|dimenhydrinate|meclozine/i, 'الجهاز العصبي والنفسي', 'أدوية الدوار'],
    [/mecobalamin|methylcobalamin|benfotiamine|alpha\s*lipoic|thioctic|citicoline|piracetam/i, 'الجهاز العصبي والنفسي', 'أدوية الأعصاب الطرفية'],
    [/paracetamol|acetaminophen|panadol|\bapap\b/i, 'المسكنات والعظام والعضلات', 'باراسيتامول وخافضات الحرارة'],
    [/ibuprofen|diclofenac|naproxen|ketoprofen|meloxicam|celecoxib|etoricoxib|piroxicam|indomethacin|indometacin|ketorolac|nimesulide|aceclofenac|mefenamic|lornoxicam|dexketoprofen|flurbiprofen/i, 'المسكنات والعظام والعضلات', 'مضادات الالتهاب (NSAIDs)'],
    [/tramadol|codeine|morphine|tapentadol|fentanyl|oxycodone|buprenorphine|pethidine|meperidine/i, 'المسكنات والعظام والعضلات', 'مسكنات أفيونية'],
    [/cyclobenzaprine|tizanidine|baclofen|methocarbamol|orphenadrine|thiocolchicoside|eperisone|chlorzoxazone|tolperisone/i, 'المسكنات والعظام والعضلات', 'مرخيات العضلات'],
    [/allopurinol|febuxostat|colchicine|probenecid/i, 'المسكنات والعظام والعضلات', 'أدوية النقرس'],
    [/hydroxychloroquine|leflunomide|methotrexate|sulfasalazine\s*en|tofacitinib|baricitinib/i, 'المسكنات والعظام والعضلات', 'أدوية الروماتيزم'],
    [/amoxicillin|amoxycillin|ampicillin|penicillin|flucloxacillin|cloxacillin|piperacillin|augmentin|co-?amoxiclav|clavulan|oxacillin/i, 'المضادات الحيوية ومضادات العدوى', 'بنسلينات'],
    [/cefixime|cefuroxime|ceftriaxone|cefotaxime|cefalexin|cephalexin|cefadroxil|cefdinir|cefpodoxime|ceftazidime|cefepime|cefaclor|cefprozil|ceftibuten|cefazolin|cefoperazone/i, 'المضادات الحيوية ومضادات العدوى', 'سيفالوسبورينات'],
    [/azithromycin|clarithromycin|erythromycin|roxithromycin|josamycin|spiramycin/i, 'المضادات الحيوية ومضادات العدوى', 'ماكروليدات'],
    [/ciprofloxacin|levofloxacin|ofloxacin|moxifloxacin|norfloxacin|gatifloxacin|pefloxacin/i, 'المضادات الحيوية ومضادات العدوى', 'كينولونات'],
    [/gentamicin|gentamycin|amikacin|tobramycin|streptomycin|kanamycin|neomycin/i, 'المضادات الحيوية ومضادات العدوى', 'أمينوغليكوزيدات'],
    [/doxycycline|tetracycline|minocycline|oxytetracycline|tigecycline/i, 'المضادات الحيوية ومضادات العدوى', 'تتراسيكلينات'],
    [/fluconazole|itraconazole|terbinafine|ketoconazole|voriconazole|griseofulvin|posaconazole|nystatin/i, 'المضادات الحيوية ومضادات العدوى', 'مضادات الفطريات الفموية'],
    [/aciclovir|acyclovir|valaciclovir|valacyclovir|famciclovir/i, 'المضادات الحيوية ومضادات العدوى', 'أدوية الهربس'],
    [/oseltamivir|tamiflu|baloxavir|zanamivir/i, 'المضادات الحيوية ومضادات العدوى', 'أدوية الإنفلونزا'],
    [/sofosbuvir|ledipasvir|daclatasvir|ribavirin|entecavir|tenofovir|lamivudine|adefovir/i, 'المضادات الحيوية ومضادات العدوى', 'أدوية التهاب الكبد'],
    [/albendazole|mebendazole|ivermectin|praziquantel|pyrantel|nitazoxanide|levamisole|niclosamide/i, 'المضادات الحيوية ومضادات العدوى', 'مضادات الطفيليات والديدان'],
    [/metronidazole|tinidazole|ornidazole|secnidazole|flagyl/i, 'المضادات الحيوية ومضادات العدوى', 'ميترونيدازول ومضادات اللاهوائيات'],
    [/sulfamethoxazole|trimethoprim|co-?trimoxazole|septrin|bactrim/i, 'المضادات الحيوية ومضادات العدوى', 'سلفوناميدات وتريميثوبريم'],
    [/chloroquine|artemether|artesunate|lumefantrine|primaquine|quinine|isoniazid|rifampicin|rifampin|ethambutol|pyrazinamide/i, 'المضادات الحيوية ومضادات العدوى', 'أدوية السل والملاريا'],
    [/nitrofurantoin|fosfomycin|vancomycin|linezolid|clindamycin|colistin|meropenem|imipenem|ertapenem|teicoplanin|fusidic|rifaximin/i, 'المضادات الحيوية ومضادات العدوى', 'مضادات حيوية أخرى'],
    [/ethinyl\s*estradiol|ethinylestradiol|levonorgestrel|drospirenone|desogestrel|gestodene|cyproterone|norgestimate/i, 'النسائية والتوليد والهرمونات', 'حبوب منع الحمل'],
    [/estradiol|oestradiol|progesterone|dydrogesterone|norethisterone|medroxyprogesterone|duphaston|utrogestan/i, 'النسائية والتوليد والهرمونات', 'أدوية الدورة'],
    [/oxytocin|misoprostol|carbetocin|methylergometrine|ergometrine|dinoprostone/i, 'النسائية والتوليد والهرمونات', 'أدوية الولادة والرحم'],
    [/cabergoline|bromocriptine/i, 'النسائية والتوليد والهرمونات', 'أدوية إيقاف الحليب'],
    [/tamsulosin|finasteride|dutasteride|alfuzosin|silodosin|doxazosin/i, 'المسالك البولية والكلى', 'أدوية البروستات'],
    [/solifenacin|oxybutynin|tolterodine|mirabegron|trospium|darifenacin|fesoterodine/i, 'المسالك البولية والكلى', 'مضادات تقلص المثانة'],
    [/sildenafil|tadalafil|vardenafil|avanafil|viagra|cialis/i, 'المسالك البولية والكلى', 'أدوية ضعف الانتصاب'],
    [/dapoxetine|priligy/i, 'المسالك البولية والكلى', 'أدوية سرعة القذف'],
    [/potassium\s*citrate|citrate\s*mixture|sodium\s*bicarbonate\s*tab/i, 'المسالك البولية والكلى', 'أدوية الحصى'],
    [/cholecalciferol|ergocalciferol|calcitriol|alfacalcidol/i, 'الفيتامينات والمعادن والمكملات', 'فيتامين د وكالسيوم'],
    [/omega-?\s*3|fish\s*oil|epa\b|dha\b|krill/i, 'الفيتامينات والمعادن والمكملات', 'أوميغا 3 وزيوت'],
    [/ferrous|ferric|iron\s*(sulfate|bisglycinate|polymaltose)|ferrous\s*fumarate/i, 'الفيتامينات والمعادن والمكملات', 'حديد ومعادن'],
    [/ascorbic\s*acid|folic\s*acid|cyanocobalamin|thiamine|pyridoxine|riboflavin|niacin|biotin|tocopherol|multivit/i, 'الفيتامينات والمعادن والمكملات', 'فيتامينات متعددة']
];
function taxIngHit(text) {
    const t = String(text || ''); if (!t.trim()) return null;
    for (const [re, d, s] of TAX_ING) if (re.test(t)) { const di = TAX_DEPTS.indexOf(d), si = di < 0 ? -1 : TAX_SEED[d].indexOf(s); if (si >= 0) return { d: di + 1, s: si + 1, guess: false }; }
    return null;
}
const TAX_GENERIC_FIRST = new Set(['natural', 'nature', 'baby', 'babies', 'kids', 'kid', 'junior', 'children', 'hair', 'skin', 'body', 'face', 'pure', 'organic', 'herbal', 'super', 'extra', 'plus', 'active', 'forte', 'ultra', 'multi', 'vitamin', 'vitamins', 'complete', 'advanced', 'intense', 'intensive', 'fresh', 'daily', 'original', 'classic', 'white', 'black', 'cream', 'drops', 'tablet', 'syrup', 'sugar', 'medical', 'dental', 'oral']);
function taxSuggest(p) {   // يرجع {d, s, guess} أو null
    const cu = typeof dhCustomHit === 'function' ? dhCustomHit(p) : null; if (cu) return cu;   // قواعدك الخاصة أولاً
    const ai = String(p.activeIngredient || '').trim(), txt = ai ? p.name + ' ' + ai : p.name;   // الاسم العلمي يدخل بكل القواعد لزيادة الدقة
    const kw = taxKwHit(txt); if (kw) return kw;
    const k = taxKey(p.name), hit = taxKeys(p.name).map(x => TAX_MAP[x]).find(Boolean);
    if (hit) return { d: hit[0], s: hit[1], guess: false };
    const fh = taxFormHit(txt); if (fh) return fh;
    const ih = taxIngHit(txt); if (ih) return ih;
    const h = TAX_LEGACY_HINT[p.category]; if (h) return { d: h[0], s: h[1], guess: true };
    if (!taxFirstIdx) { taxFirstIdx = {}; Object.keys(TAX_MAP).forEach(key => { const w = key.split(/[\s-]/)[0]; if (w.length >= 4) (taxFirstIdx[w] = taxFirstIdx[w] || []).push(TAX_MAP[key]); }); }
    const w = k.split(/[\s-]/)[0], arr = w.length >= 4 && !TAX_GENERIC_FIRST.has(w) ? taxFirstIdx[w] : null;
    if (arr && arr.length && arr.every(x => x[0] === arr[0][0] && x[1] === arr[0][1])) return { d: arr[0][0], s: arr[0][1], guess: true };   // نفس الشركة/الاسم بتركيز آخر
    return null;
}
function taxFormOf(p) {   // الشكل المقترح: المحدّد يدوياً أو المكتشف من الاسم (وإلا فارغ = تلقائي)
    if (p.form) return p.form;
    const str = `${p.name} ${p.meta || ''}`.toLowerCase(), f = FORMS.find(x => x.re && x.re.test(str));
    return f ? f.id : '';
}
function taxRvList() { return products.filter(p => taxLegacy.d.includes(p.department)); }
function taxExtraOf(p) {   // تصنيفات إضافية مقترحة للمركّبات: [[القسم، التصنيف], ...]
    for (const e of TAX_KW) if (e[3] && e[0].test(p.name || '')) return e[3].filter(c => (TAX_SEED[c[0]] || []).includes(c[1]));
    const k = taxKeys(p.name).map(x => TAX_EXTRA[x]).find(Boolean); if (!k) return [];
    return k.map(c => [TAX_DEPTS[c[0] - 1], (TAX_SEED[TAX_DEPTS[c[0] - 1]] || [])[c[1] - 1]]).filter(c => c[0] && c[1]);
}
function taxRvEntry(p) {   // الاقتراح الحالي لمادة (أو ما عدّلته أنت)
    const r = taxRv[p.id];
    if (r && (r.st === 'ok' || r.st === 'edit' || r.st === 'no')) return Object.assign({ x: taxExtraOf(p) }, r);
    if (r && r.st === 'sug') return { d: r.d, s: r.s, f: r.f, x: r.x || [], st: '', guess: false, auto: true };   // اقتراح تغيّر تلقائياً بسبب جرعة أخرى
    const sg = taxSuggest(p);
    return { d: sg ? TAX_DEPTS[sg.d - 1] : '', s: sg ? TAX_SEED[TAX_DEPTS[sg.d - 1]][sg.s - 1] : '', f: taxFormOf(p), x: taxExtraOf(p), st: '', guess: !!(sg && sg.guess) };
}
function taxRvOpen() {
    if (!taxSeeded()) { Swal.fire({ icon: 'info', title: 'حمّل الأقسام الجاهزة أولاً', text: 'من «إدارة الأقسام» اضغط «تحميل الأقسام الجاهزة».', confirmButtonColor: '#0f1c38' }); return; }
    let el = document.getElementById('taxRv');
    if (!el) { el = document.createElement('div'); el.id = 'taxRv'; el.className = 'tax-rv'; document.body.appendChild(el); }
    taxRvFilter = 'new'; taxRvQ = ''; taxRvShown = 60; el.style.display = 'flex'; taxRvRender();
}
function taxRvClose() { const el = document.getElementById('taxRv'); if (el) el.style.display = 'none'; try { renderManagerLists(); } catch (e) { /* تجاهل */ } }
function taxRvSet(f) { taxRvFilter = f; taxRvShown = 60; taxRvRender(); }
function taxRvSearch(v) { taxRvQ = v; taxRvShown = 60; taxRvRender(true); }
function taxRvMore() { taxRvShown += 60; taxRvRender(true); }
function taxRvRows() {
    const list = taxRvList(), q = normSearch(taxRvQ), out = [];
    list.forEach(p => {
        if (q && !normSearch(p.name + ' ' + (p.brand || '')).includes(q)) return;
        const e = taxRvEntry(p), st = e.st || '';
        const flt = taxRvFilter;
        if (flt === 'new' && st) return;
        if (flt === 'ok' && st !== 'ok' && st !== 'edit') return;
        if (flt === 'no' && st !== 'no') return;
        if (flt === 'none' && (e.d || st)) return;
        out.push({ p, e });
    });
    return out;
}
function taxRvRender(keepSearch) {
    const el = document.getElementById('taxRv'); if (!el) return;
    const all = taxRvList(), cnt = { ok: 0, no: 0, nw: 0, none: 0 };
    all.forEach(p => { const e = taxRvEntry(p); if (e.st === 'ok' || e.st === 'edit') cnt.ok++; else if (e.st === 'no') cnt.no++; else { cnt.nw++; if (!e.d) cnt.none++; } });
    const rows = taxRvRows(), shown = rows.slice(0, taxRvShown);
    const chip = (k, t, n) => `<button type="button" class="${taxRvFilter === k ? 'on' : ''}" onclick="taxRvSet('${k}')">${t} <b>${fmtNum(n)}</b></button>`;
    const body = shown.map(({ p, e }) => {
        const fobj = e.f ? FORMS.find(x => x.id === e.f) : null, st = e.st;
        return `<div class="tr-row ${st === 'ok' || st === 'edit' ? 'ok' : st === 'no' ? 'no' : ''}" id="trr-${p.id}">
            <div class="tr-main"><b dir="ltr">${escapeHtml(p.name)}</b>
            <div class="tr-sug">${e.d ? `<div class="tr-ln main"><span class="tr-d">${escapeHtml(e.d)}</span>: <span class="tr-s">${escapeHtml(e.s)}</span>${fobj ? ` - <span class="tr-f">${escapeHtml(fobj.txt)}</span>` : ''}</div>` : `<div class="tr-ln"><span class="tr-none">بدون اقتراح — اضغط ✕ وحدّد</span>${fobj ? ` - <span class="tr-f">${escapeHtml(fobj.txt)}</span>` : ''}</div>`}${(e.x || []).map(c => `<div class="tr-ln extra"><span class="tr-d">${escapeHtml(c[0])}</span>: <span class="tr-s">${escapeHtml(c[1])}</span></div>`).join('')}${(e.guess && !st) || st === 'edit' || e.auto ? `<div class="tr-tags">${e.guess && !st ? '<em class="tg warn">تقدير</em>' : ''}${st === 'edit' ? '<em class="tg">عدّلته</em>' : ''}${e.auto ? '<em class="tg">تغيّر تلقائياً</em>' : ''}</div>` : ''}</div></div>
            <div class="tr-btns"><button type="button" class="tr-yes" onclick="taxRvYes(${p.id})" aria-label="صح"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg></button><button type="button" class="tr-no" onclick="taxRvNo(${p.id})" aria-label="خطأ"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>`;
    }).join('') || '<div class="bill-none">لا توجد مواد بهذا الفلتر.</div>';
    const head = `<div class="tr-head"><b>🧭 مراجعة التصنيف</b><button type="button" class="tr-x" onclick="taxRvClose()" aria-label="إغلاق">✕</button></div>
        <div class="tr-prog">راجعت <b>${fmtNum(cnt.ok + cnt.no)}</b> من ${fmtNum(all.length)} — معتمد ${fmtNum(cnt.ok)}</div>
        <div class="tr-chips">${chip('new', 'غير مراجع', cnt.nw)}${chip('ok', '✓ صح', cnt.ok)}${chip('no', '✕ خطأ', cnt.no)}${chip('none', 'بلا اقتراح', cnt.none)}${chip('all', 'الكل', all.length)}</div>
        <input type="search" id="trSearch" class="tr-search" placeholder="🔍 ابحث باسم المادة..." value="${escapeHtml(taxRvQ)}" oninput="taxRvSearch(this.value)">`;
    const foot = `<div class="tr-foot"><button type="button" onclick="taxRvAcceptShown()">✓ اعتمد المعروض (${fmtNum(Math.min(rows.length, taxRvShown))})</button><button type="button" class="tr-apply" onclick="taxRvApply()">📥 تطبيق المعتمد (${fmtNum(cnt.ok)})</button></div>`;
    if (keepSearch && document.getElementById('trList')) {
        document.getElementById('trList').innerHTML = body + (rows.length > shown.length ? `<button type="button" class="pu-newprod" onclick="taxRvMore()">عرض المزيد (${fmtNum(rows.length - shown.length)})</button>` : '');
        el.querySelector('.tr-prog').innerHTML = `راجعت <b>${fmtNum(cnt.ok + cnt.no)}</b> من ${fmtNum(all.length)} — معتمد ${fmtNum(cnt.ok)}`;
        el.querySelector('.tr-chips').innerHTML = chip('new', 'غير مراجع', cnt.nw) + chip('ok', '✓ صح', cnt.ok) + chip('no', '✕ خطأ', cnt.no) + chip('none', 'بلا اقتراح', cnt.none) + chip('all', 'الكل', all.length);
        el.querySelector('.tr-foot').innerHTML = foot.replace(/^<div class="tr-foot">|<\/div>$/g, '');
        return;
    }
    el.innerHTML = `${head}<div class="tr-list" id="trList">${body}${rows.length > shown.length ? `<button type="button" class="pu-newprod" onclick="taxRvMore()">عرض المزيد (${fmtNum(rows.length - shown.length)})</button>` : ''}</div>${foot}`;
}
function taxRvYes(id) {
    const p = products.find(x => x.id === id); if (!p) return; const e = taxRvEntry(p);
    if (!e.d) { taxRvNo(id); return; }
    taxRv[id] = { d: e.d, s: e.s, f: e.f, x: e.x || [], st: e.st === 'edit' ? 'edit' : 'ok' }; taxRvSave(); taxRvRender(true);
}
async function taxRvNo(id) {
    const p = products.find(x => x.id === id); if (!p) return; const e = taxRvEntry(p);
    const dOpts = TAX_DEPTS.map(d => `<option value="${escapeHtml(d)}" ${d === e.d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
    const fOpts = '<option value="">تلقائي</option>' + FORM_GROUPS.map(g => `<optgroup label="${g}">${FORMS.filter(f => f.g === g).map(f => `<option value="${f.id}" ${f.id === e.f ? 'selected' : ''}>${escapeHtml(f.txt)}</option>`).join('')}</optgroup>`).join('') + FORMS.filter(f => !f.g).map(f => `<option value="${f.id}" ${f.id === e.f ? 'selected' : ''}>${escapeHtml(f.txt)}</option>`).join('');
    const fillSubs = () => { const d = document.getElementById('trD').value; document.getElementById('trS').innerHTML = (TAX_SEED[d] || []).map(s => `<option value="${escapeHtml(s)}" ${s === e.s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join(''); };
    const xsel = (e.x || []).map(c => c.slice());
    const r = await Swal.fire({ title: escapeHtml(p.name), showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ التصحيح', denyButtonText: 'تخطّي', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38', width: 'min(94vw, 460px)',
        html: `<div class="sw-form" style="text-align:right"><label>القسم<select id="trD" onchange="">${dOpts}${e.d ? '' : '<option value="" selected>— اختر —</option>'}</select></label><label>التصنيف<select id="trS"></select></label><label>الشكل الدوائي<select id="trF">${fOpts}</select></label>
            <div class="tr-xbox"><b>تصنيفات إضافية (للمركّبات)</b><div id="trXL"></div><div class="tr-xadd"><select id="trXD">${dOpts.replace(' selected', '')}</select><select id="trXS"></select><button type="button" id="trXB">＋</button></div></div></div>`,
        didOpen: () => {
            const d = document.getElementById('trD'); d.addEventListener('change', () => { e.s = ''; fillSubs(); }); fillSubs();
            const xd = document.getElementById('trXD'), xs = document.getElementById('trXS'), xl = document.getElementById('trXL');
            const fillX = () => { xs.innerHTML = (TAX_SEED[xd.value] || []).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join(''); };
            const showX = () => { xl.innerHTML = xsel.map((c, i) => `<span class="tr-chip">${escapeHtml(c[0])} › ${escapeHtml(c[1])} <button type="button" data-i="${i}" aria-label="حذف">✕</button></span>`).join('') || '<small>لا يوجد</small>'; xl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { xsel.splice(+b.dataset.i, 1); showX(); })); };
            xd.addEventListener('change', fillX); fillX(); showX();
            document.getElementById('trXB').addEventListener('click', () => { const c = [xd.value, xs.value]; if (c[1] && !xsel.some(z => z[0] === c[0] && z[1] === c[1])) { xsel.push(c); showX(); } });
        },
        preConfirm: () => ({ d: document.getElementById('trD').value, s: document.getElementById('trS').value, f: document.getElementById('trF').value, x: xsel.slice() }) });
    if (r.isDenied) { taxRv[id] = { d: e.d, s: e.s, f: e.f, x: e.x || [], st: 'no' }; taxRvSave(); taxRvRender(true); return; }
    if (!r.isConfirmed || !r.value || !r.value.d) return;
    taxRv[id] = { d: r.value.d, s: r.value.s, f: r.value.f, x: r.value.x, st: 'edit' };
    // نفس المادة بجرعات/أحجام أخرى (نفس الاسم قبل الرقم): نغيّر اقتراحها تلقائياً، وإنت بس تضغط ✓
    const key = taxKey(p.name), oldF = e.f; let n = 0;
    if (key.length >= 3) products.forEach(q => {
        if (q.id === id || taxKey(q.name) !== key) return;
        const qe = taxRvEntry(q); if (qe.st) return;   // ما نلمس اللي راجعته
        const nf = (r.value.f !== oldF && qe.f === oldF) ? r.value.f : qe.f;
        taxRv[q.id] = { d: r.value.d, s: r.value.s, f: nf, x: r.value.x, st: 'sug' }; n++;
    });
    taxRvSave(); taxRvRender(true);
    if (n) Swal.fire({ icon: 'success', title: 'غُيّر اقتراح ' + n + ' جرعة/حجم مماثل تلقائياً', text: 'ستجدها «غير مراجعة»، فقط اضغط ✓', toast: true, position: 'bottom', showConfirmButton: false, timer: 2600 });
}
function taxRvAcceptShown() {
    const rows = taxRvRows().slice(0, taxRvShown); let n = 0;
    rows.forEach(({ p, e }) => { if (e.d && !e.st) { taxRv[p.id] = { d: e.d, s: e.s, f: e.f, x: e.x || [], st: 'ok' }; n++; } });
    taxRvSave(); taxRvRender(true);
    Swal.fire({ icon: 'success', title: 'اعتُمد ' + n + ' مادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
}
async function taxRvApply() {
    const list = taxRvList().filter(p => { const e = taxRv[p.id]; return e && (e.st === 'ok' || e.st === 'edit') && e.d; });
    if (!list.length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد معتمدة للتطبيق', confirmButtonColor: '#0f1c38' }); return; }
    if (!writesAllowed()) return;
    const r = await Swal.fire({ icon: 'question', title: 'تطبيق التصنيف على ' + list.length + ' مادة؟', confirmButtonColor: '#0f1c38', showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'رجوع', width: 'min(94vw, 460px)',
        html: '<div style="text-align:right;font-size:.88rem;line-height:1.9">• يتغير <b>القسم والتصنيف والشكل</b> فقط. الأسعار والكميات لا تتأثر.<br>• يُفضَّل أخذ نسخة احتياطية قبل ذلك.<br>• ما لم تعتمده يبقى كما هو.</div>' });
    if (!r.isConfirmed) return;
    let addedSub = false;   // التصنيفات المختارة تنضاف لقوائم الأقسام إن لم تكن موجودة
    list.forEach(p => { const e = taxRv[p.id]; (e.x || []).forEach(c => { if (c[1] && !(deptSubs[c[0]] || []).includes(c[1])) { deptSubs[c[0]] = (deptSubs[c[0]] || []).concat(c[1]); if (!subCategories.includes(c[1])) subCategories.push(c[1]); addedSub = true; } }); });
    list.forEach(p => { const e = taxRv[p.id]; if (e.s && !(deptSubs[e.d] || []).includes(e.s)) { deptSubs[e.d] = (deptSubs[e.d] || []).concat(e.s); if (!subCategories.includes(e.s)) subCategories.push(e.s); addedSub = true; } });
    if (addedSub) { try { await pushToCloud(true); } catch (e) { /* تجاهل */ } }
    const olds = new Map();
    list.forEach(p => { const e = taxRv[p.id]; olds.set(p.id, { department: p.department, category: p.category, form: p.form, formOther: p.formOther, extraDepartments: p.extraDepartments, extraCategories: p.extraCategories }); p.department = e.d; if (e.s) p.category = e.s; { const xx = e.x || []; const ds = [...new Set(extrasOf(p.extraDepartments).concat(xx.map(c => c[0])))].filter(d => d !== p.department), cs = [...new Set(extrasOf(p.extraCategories).concat(xx.map(c => c[1])))].filter(c => c !== p.category); p.extraDepartments = ds; p.extraCategories = cs; } if (e.f) { p.form = e.f; } });
    const h = Prog.start('تطبيق التصنيف', { text: 'حفظ ' + fmtNum(list.length) + ' مادة...' });
    const ok = await saveProductsDelta(list.map(p => ({ p, dq: 0, dl: 0 })));
    if (!ok) { list.forEach(p => Object.assign(p, olds.get(p.id))); renderAll(); h.fail('لم يُطبَّق التصنيف', 'أُعيدت المواد إلى حالتها السابقة'); return; }
    h.ok('طُبّق التصنيف على ' + fmtNum(list.length) + ' مادة');
    list.forEach(p => { logAction('edit', p, [{ f: 'القسم/التصنيف (مراجعة التصنيف)', from: String(olds.get(p.id).department) + ' › ' + String(olds.get(p.id).category), to: p.department + ' › ' + p.category }]); delete taxRv[p.id]; });
    taxRvSave(); renderAll(); taxRvRender();
}
// زر الدخول لمراجعة التصنيف داخل مربع «الأقسام الجاهزة»
{ const _rts = renderTaxSeedBox; renderTaxSeedBox = function () { _rts(); const box = document.getElementById('taxSeedBox'); if (!box || !taxSeeded()) return; const n = taxRvList().length; box.insertAdjacentHTML('beforeend', `<button type="button" class="icon-btn primary-btn" style="margin-top:10px" onclick="taxRvOpen()">🧭 مراجعة التصنيف (صح / خطأ) — ${fmtNum(n)} مادة</button>`); }; }
