// =====================================================================
// الأقسام والتصنيفات الجاهزة (22 قسم علاجي + فرعياتها). تُحمَّل بزر واحد من «إدارة الأقسام»،
// ولا تغيّر أي مادة موجودة. القديم يبقى ويُعلَّم «قديم» ويختفي لوحده إذا فضى.
// =====================================================================
const TAX_SEED = {
    'الجهاز الهضمي والكبد': ['مضادات الحموضة', 'مثبطات مضخة البروتون (PPI)', 'مضادات H2', 'مسهلات', 'مضادات الإسهال', 'مضادات التقلص الهضمي', 'مضادات القيء', 'أنزيمات هضمية', 'بروبيوتيك', 'أدوية الكبد والصفراء', 'أدوية البواسير'],
    'القلب والضغط والدهون': ['خافضات الضغط (ACEI)', 'خافضات الضغط (ARB)', 'حاصرات بيتا', 'حاصرات الكالسيوم', 'مدرات البول', 'أدوية الذبحة', 'أدوية قصور القلب', 'خافضات الدهون', 'مضادات اضطراب النظم'],
    'الجهاز التنفسي والحساسية': ['موسعات القصبات', 'كورتيزون الاستنشاق', 'مقشعات', 'مضادات السعال', 'مضادات الهيستامين', 'أدوية الربو'],
    'السكري والغدد الصماء': ['إنسولين', 'أقراص السكري', 'أدوية الغدة الدرقية', 'كورتيزونات فموية وحقن', 'أدوية العظام والكالسيوم'],
    'الجهاز العصبي والنفسي': ['مضادات الصرع', 'مضادات الاكتئاب', 'مهدئات ومنومات', 'مضادات الذهان', 'أدوية باركنسون', 'أدوية الصداع والشقيقة', 'أدوية الخرف'],
    'المسكنات والعظام والعضلات': ['مسكنات بسيطة', 'مضادات الالتهاب (NSAIDs)', 'مسكنات أفيونية', 'مرخيات العضلات', 'أدوية النقرس', 'أدوية الروماتيزم', 'مراهم مسكنة موضعية'],
    'المضادات الحيوية ومضادات العدوى': ['بنسلينات', 'سيفالوسبورينات', 'ماكروليدات', 'كينولونات', 'أمينوغليكوزيدات', 'تتراسيكلينات', 'مضادات الفطريات الفموية', 'مضادات الفيروسات', 'مضادات الطفيليات والديدان', 'أدوية السل والملاريا'],
    'الجلدية': ['كورتيزون موضعي', 'مضادات حيوية موضعية', 'مضادات فطريات موضعية', 'علاج حب الشباب', 'ترطيب البشرة', 'أدوية الصدفية', 'الجروح والحروق', 'القمل والجرب'],
    'العيون': ['قطرات عين (مضادات حيوية)', 'قطرات عين (كورتيزون)', 'أدوية ضغط العين', 'دموع صناعية', 'مراهم العين'],
    'الأذن والأنف والحنجرة': ['قطرات الأذن', 'قطرات وبخاخات الأنف', 'غرغرة وأدوية الحنجرة', 'غسول الأنف'],
    'المسالك البولية والكلى': ['أدوية البروستات', 'مضادات تقلص المثانة', 'مطهرات بولية', 'أدوية الحصى', 'أدوية الكلى'],
    'النسائية والتوليد والهرمونات': ['حبوب منع الحمل', 'أدوية الخصوبة', 'أدوية الحمل (حديد وفوليك)', 'أدوية الدورة', 'هرمونات سن اليأس', 'تحاميل ومراهم مهبلية'],
    'الدم والتخثر': ['مضادات التخثر', 'مضادات الصفيحات', 'أدوية فقر الدم', 'مرقئات'],
    'الأورام والمناعة': ['أدوية الأورام', 'مثبطات المناعة', 'أدوية بيولوجية'],
    'اللقاحات والأمصال': ['لقاحات', 'أمصال'],
    'الفيتامينات والمعادن والمكملات': ['فيتامينات متعددة', 'فيتامين د وكالسيوم', 'حديد ومعادن', 'أوميغا 3 وزيوت', 'مكملات رياضية', 'مكملات الشعر والبشرة'],
    'الأم والطفل': ['حليب أطفال', 'حفاضات', 'مكملات الأطفال', 'شرابات الأطفال', 'مستلزمات الرضاعة'],
    'الفم والأسنان': ['معاجين وفُرش', 'غسول الفم', 'جل فموي', 'أدوية اللثة والفم'],
    'العناية الشخصية والتجميل': ['العناية بالبشرة', 'العناية بالشعر', 'العطور ومزيلات العرق', 'العناية بالجسم', 'المكياج', 'العناية بالأظافر'],
    'الأعشاب والمنتجات الطبيعية': ['أعشاب وشاي طبي', 'زيوت طبيعية', 'عسل ومنتجات النحل'],
    'الأجهزة والمستلزمات الطبية': ['قياس السكر والضغط', 'موازين الحرارة', 'كمامات وقفازات', 'دعامات وضمادات', 'أجهزة التنفس والبخاخ'],
    'المحاليل والمستهلكات والإسعافات': ['محاليل وريدية', 'محاقن وإبر', 'إسعافات أولية', 'قطن وشاش']
};
function taxSeeded() { return Object.keys(TAX_SEED).every(d => departments.includes(d)); }
function renderTaxSeedBox() {
    const box = document.getElementById('taxSeedBox'); if (!box) return;
    const subs = Object.values(TAX_SEED).reduce((n, a) => n + a.length, 0);
    box.innerHTML = taxSeeded()
        ? `<h4>✅ الأقسام الجاهزة محمَّلة</h4><small style="display:block;color:var(--text-sub);line-height:1.8">القديم معلَّم «قديم» ويختفي لوحده لما ما تبقى مادة عليه. تقدر تعدّل أو تضيف أو تحذف أي قسم أو تصنيف. وحذف القديم النهائي يكون من 🗑️ بعد نقل مواده.</small>`
        : `<h4>📥 الأقسام الجاهزة (${Object.keys(TAX_SEED).length} قسم، ${subs} تصنيف)</h4><small style="display:block;color:var(--text-sub);line-height:1.8;margin-bottom:8px">تضيف أقسام علاجية جاهزة وتصنيفاتها. <b>لا تغيّر أي مادة</b>، والأقسام القديمة تبقى وتُعلَّم «قديم». تقدر تعدّل الكل بعدها.</small><button type="button" class="icon-btn primary-btn" onclick="taxSeed()">📥 تحميل الأقسام الجاهزة</button>`;
}
async function taxSeed() {
    if (!writesAllowed()) return;
    const r = await Swal.fire({ icon: 'question', title: 'تحميل الأقسام الجاهزة؟', confirmButtonColor: '#0f1c38', showCancelButton: true, confirmButtonText: 'تحميل', cancelButtonText: 'رجوع', width: 'min(94vw, 460px)',
        html: '<div style="text-align:right;font-size:.88rem;line-height:1.9">• تنضاف ' + Object.keys(TAX_SEED).length + ' قسم وتصنيفاتها.<br>• <b>مواد ما تنتقل ولا تتغير.</b><br>• القديم يبقى ويُعلَّم «قديم»، ويختفي لما يفضى.<br>• خذ نسخة احتياطية قبل (يفضّل).</div>' });
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
function taxKey(n) { return String(n || '').toLowerCase().split(/\s\d|\s*\(|\s[x×]\s*\d/)[0].trim(); }
let taxFirstIdx = null;
function taxSuggest(p) {   // يرجع {d, s, guess} أو null
    const k = taxKey(p.name), hit = TAX_MAP[k];
    if (hit) return { d: hit[0], s: hit[1], guess: false };
    const h = TAX_LEGACY_HINT[p.category]; if (h) return { d: h[0], s: h[1], guess: true };
    if (!taxFirstIdx) { taxFirstIdx = {}; Object.keys(TAX_MAP).forEach(key => { const w = key.split(/[\s-]/)[0]; if (w.length >= 4) (taxFirstIdx[w] = taxFirstIdx[w] || []).push(TAX_MAP[key]); }); }
    const w = k.split(/[\s-]/)[0], arr = w.length >= 4 ? taxFirstIdx[w] : null;
    if (arr && arr.length && arr.every(x => x[0] === arr[0][0] && x[1] === arr[0][1])) return { d: arr[0][0], s: arr[0][1], guess: true };   // نفس الشركة/الاسم بتركيز آخر
    return null;
}
function taxFormOf(p) {   // الشكل المقترح: المحدّد يدوياً أو المكتشف من الاسم (وإلا فارغ = تلقائي)
    if (p.form) return p.form;
    const str = `${p.name} ${p.meta || ''}`.toLowerCase(), f = FORMS.find(x => x.re && x.re.test(str));
    return f ? f.id : '';
}
function taxRvList() { return products.filter(p => taxLegacy.d.includes(p.department)); }
function taxRvEntry(p) {   // الاقتراح الحالي لمادة (أو ما عدّلته أنت)
    const r = taxRv[p.id]; if (r && (r.st === 'ok' || r.st === 'edit' || r.st === 'no')) return r;
    const sg = taxSuggest(p);
    return { d: sg ? TAX_DEPTS[sg.d - 1] : '', s: sg ? TAX_SEED[TAX_DEPTS[sg.d - 1]][sg.s - 1] : '', f: taxFormOf(p), st: '', guess: !!(sg && sg.guess) };
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
            <div class="tr-sug">${e.d ? `<span class="tr-d">${escapeHtml(e.d)}</span> › <span class="tr-s">${escapeHtml(e.s)}</span>` : '<span class="tr-none">بدون اقتراح — اضغط ✗ وحدّد</span>'}${fobj ? ` · <span class="tr-f">${escapeHtml(fobj.txt)}</span>` : ''}${e.guess && !st ? ' <em class="tg warn">تقدير</em>' : ''}${st === 'edit' ? ' <em class="tg">عدّلته</em>' : ''}</div></div>
            <div class="tr-btns"><button type="button" class="tr-yes" onclick="taxRvYes(${p.id})" aria-label="صح">✓</button><button type="button" class="tr-no" onclick="taxRvNo(${p.id})" aria-label="خطأ">✗</button></div></div>`;
    }).join('') || '<div class="bill-none">ما فيه مواد بهذا الفلتر.</div>';
    const head = `<div class="tr-head"><b>🧭 مراجعة التصنيف</b><button type="button" class="tr-x" onclick="taxRvClose()" aria-label="إغلاق">✕</button></div>
        <div class="tr-prog">راجعت <b>${fmtNum(cnt.ok + cnt.no)}</b> من ${fmtNum(all.length)} — معتمد ${fmtNum(cnt.ok)}</div>
        <div class="tr-chips">${chip('new', 'غير مراجع', cnt.nw)}${chip('ok', '✓ صح', cnt.ok)}${chip('no', '✗ خطأ', cnt.no)}${chip('none', 'بلا اقتراح', cnt.none)}${chip('all', 'الكل', all.length)}</div>
        <input type="search" id="trSearch" class="tr-search" placeholder="🔍 ابحث باسم المادة..." value="${escapeHtml(taxRvQ)}" oninput="taxRvSearch(this.value)">`;
    const foot = `<div class="tr-foot"><button type="button" onclick="taxRvAcceptShown()">✓ اعتمد المعروض (${fmtNum(Math.min(rows.length, taxRvShown))})</button><button type="button" class="tr-apply" onclick="taxRvApply()">📥 تطبيق المعتمد (${fmtNum(cnt.ok)})</button></div>`;
    if (keepSearch && document.getElementById('trList')) {
        document.getElementById('trList').innerHTML = body + (rows.length > shown.length ? `<button type="button" class="pu-newprod" onclick="taxRvMore()">عرض المزيد (${fmtNum(rows.length - shown.length)})</button>` : '');
        el.querySelector('.tr-prog').innerHTML = `راجعت <b>${fmtNum(cnt.ok + cnt.no)}</b> من ${fmtNum(all.length)} — معتمد ${fmtNum(cnt.ok)}`;
        el.querySelector('.tr-chips').innerHTML = chip('new', 'غير مراجع', cnt.nw) + chip('ok', '✓ صح', cnt.ok) + chip('no', '✗ خطأ', cnt.no) + chip('none', 'بلا اقتراح', cnt.none) + chip('all', 'الكل', all.length);
        el.querySelector('.tr-foot').innerHTML = foot.replace(/^<div class="tr-foot">|<\/div>$/g, '');
        return;
    }
    el.innerHTML = `${head}<div class="tr-list" id="trList">${body}${rows.length > shown.length ? `<button type="button" class="pu-newprod" onclick="taxRvMore()">عرض المزيد (${fmtNum(rows.length - shown.length)})</button>` : ''}</div>${foot}`;
}
function taxRvYes(id) {
    const p = products.find(x => x.id === id); if (!p) return; const e = taxRvEntry(p);
    if (!e.d) { taxRvNo(id); return; }
    taxRv[id] = { d: e.d, s: e.s, f: e.f, st: e.st === 'edit' ? 'edit' : 'ok' }; taxRvSave(); taxRvRender(true);
}
async function taxRvNo(id) {
    const p = products.find(x => x.id === id); if (!p) return; const e = taxRvEntry(p);
    const dOpts = TAX_DEPTS.map(d => `<option value="${escapeHtml(d)}" ${d === e.d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
    const fOpts = '<option value="">تلقائي</option>' + FORM_GROUPS.map(g => `<optgroup label="${g}">${FORMS.filter(f => f.g === g).map(f => `<option value="${f.id}" ${f.id === e.f ? 'selected' : ''}>${escapeHtml(f.txt)}</option>`).join('')}</optgroup>`).join('') + FORMS.filter(f => !f.g).map(f => `<option value="${f.id}" ${f.id === e.f ? 'selected' : ''}>${escapeHtml(f.txt)}</option>`).join('');
    const fillSubs = () => { const d = document.getElementById('trD').value; document.getElementById('trS').innerHTML = (TAX_SEED[d] || []).map(s => `<option value="${escapeHtml(s)}" ${s === e.s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join(''); };
    const r = await Swal.fire({ title: escapeHtml(p.name), showCancelButton: true, showDenyButton: true, confirmButtonText: 'حفظ التصحيح', denyButtonText: 'تخطّي', cancelButtonText: 'رجوع', confirmButtonColor: '#0f1c38', width: 'min(94vw, 460px)',
        html: `<div class="sw-form" style="text-align:right"><label>القسم<select id="trD" onchange="">${dOpts}${e.d ? '' : '<option value="" selected>— اختر —</option>'}</select></label><label>التصنيف<select id="trS"></select></label><label>الشكل الدوائي<select id="trF">${fOpts}</select></label></div>`,
        didOpen: () => { const d = document.getElementById('trD'); d.addEventListener('change', () => { e.s = ''; fillSubs(); }); fillSubs(); },
        preConfirm: () => ({ d: document.getElementById('trD').value, s: document.getElementById('trS').value, f: document.getElementById('trF').value }) });
    if (r.isDenied) { taxRv[id] = { d: e.d, s: e.s, f: e.f, st: 'no' }; taxRvSave(); taxRvRender(true); return; }
    if (!r.isConfirmed || !r.value || !r.value.d) return;
    taxRv[id] = { d: r.value.d, s: r.value.s, f: r.value.f, st: 'edit' }; taxRvSave(); taxRvRender(true);
}
function taxRvAcceptShown() {
    const rows = taxRvRows().slice(0, taxRvShown); let n = 0;
    rows.forEach(({ p, e }) => { if (e.d && !e.st) { taxRv[p.id] = { d: e.d, s: e.s, f: e.f, st: 'ok' }; n++; } });
    taxRvSave(); taxRvRender(true);
    Swal.fire({ icon: 'success', title: 'اعتُمد ' + n + ' مادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
}
async function taxRvApply() {
    const list = taxRvList().filter(p => { const e = taxRv[p.id]; return e && (e.st === 'ok' || e.st === 'edit') && e.d; });
    if (!list.length) { Swal.fire({ icon: 'info', title: 'ما فيه مواد معتمدة للتطبيق', confirmButtonColor: '#0f1c38' }); return; }
    if (!writesAllowed()) return;
    const r = await Swal.fire({ icon: 'question', title: 'تطبيق التصنيف على ' + list.length + ' مادة؟', confirmButtonColor: '#0f1c38', showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'رجوع', width: 'min(94vw, 460px)',
        html: '<div style="text-align:right;font-size:.88rem;line-height:1.9">• يتغير <b>القسم والتصنيف والشكل</b> فقط. الأسعار والكميات ما تنلمس.<br>• يفضّل تاخذ نسخة احتياطية قبل.<br>• اللي ما عتمدته يبقى كما هو.</div>' });
    if (!r.isConfirmed) return;
    const olds = new Map();
    list.forEach(p => { const e = taxRv[p.id]; olds.set(p.id, { department: p.department, category: p.category, form: p.form, formOther: p.formOther }); p.department = e.d; if (e.s) p.category = e.s; if (e.f) { p.form = e.f; } });
    const h = Prog.start('تطبيق التصنيف', { text: 'حفظ ' + fmtNum(list.length) + ' مادة...' });
    const ok = await saveProductsDelta(list.map(p => ({ p, dq: 0, dl: 0 })));
    if (!ok) { list.forEach(p => Object.assign(p, olds.get(p.id))); renderAll(); h.fail('لم يُطبَّق التصنيف', 'رجعت المواد لحالتها السابقة'); return; }
    h.ok('طُبّق التصنيف على ' + fmtNum(list.length) + ' مادة');
    list.forEach(p => { logAction('edit', p, [{ f: 'القسم/التصنيف (مراجعة التصنيف)', from: String(olds.get(p.id).department) + ' › ' + String(olds.get(p.id).category), to: p.department + ' › ' + p.category }]); delete taxRv[p.id]; });
    taxRvSave(); renderAll(); taxRvRender();
}
// زر الدخول لمراجعة التصنيف داخل مربع «الأقسام الجاهزة»
{ const _rts = renderTaxSeedBox; renderTaxSeedBox = function () { _rts(); const box = document.getElementById('taxSeedBox'); if (!box || !taxSeeded()) return; const n = taxRvList().length; box.insertAdjacentHTML('beforeend', `<button type="button" class="icon-btn primary-btn" style="margin-top:10px" onclick="taxRvOpen()">🧭 مراجعة التصنيف (صح / خطأ) — ${fmtNum(n)} مادة</button>`); }; }
