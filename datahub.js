// =====================================================================
// مركز تجهيز البيانات: مكان واحد لإكمال بيانات المخزن (المادة الفعالة، التصنيف، المكرر، الناقص، قواعدك الخاصة)
// لا يستبدل «سجل الأدوية» ولا أي أداة قائمة؛ يربط بها ويضيف عليها. يعتمد على data.js و taxonomy.js و catalog.js و pricefix.js
// =====================================================================
let dhScreen = 'home', dhQ = '', dhFilter = 'miss', dhShown = 40;
const dhEdits = new Map();   // معرّف المادة ← { name, ai, aiGen }
const DH_RULES_LS = 'diwanTaxCustom';
let dhRules = (() => { try { const a = JSON.parse(localStorage.getItem(DH_RULES_LS)); return Array.isArray(a) ? a : []; } catch (e) { return []; } })();
function dhRulesSave() { try { localStorage.setItem(DH_RULES_LS, JSON.stringify(dhRules)); } catch (e) { /* تجاهل */ } }
const dhEsc = s => escapeHtml(String(s == null ? '' : s));
const dhEl = () => document.getElementById('dataHub');
const dhHas = p => !!String(p.activeIngredient || '').trim();

// ---------- قواعدك الخاصة: كلمات تُفحص على الاسم والمادة الفعالة، وتتقدّم على كل القواعد الجاهزة ----------
function dhCustomHit(p) {
    if (!dhRules.length) return null;
    const hay = `${p.name || ''} ${p.activeIngredient || ''}`.toLowerCase();
    for (const r of dhRules) {
        if (!(r.words || []).some(w => w && hay.includes(String(w).toLowerCase()))) continue;
        const di = TAX_DEPTS.indexOf(r.dept), si = di < 0 ? -1 : TAX_SEED[r.dept].indexOf(r.cat);
        if (si >= 0) return { d: di + 1, s: si + 1, guess: false };
    }
    return null;
}

// ---------- إحصاءات الاكتمال ----------
function dhNormKey(n) {
    return String(n || '').toLowerCase().replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%|gm|l)\b/g, ' ').replace(/\bx\s*\d+\b/g, ' ')
        .replace(/\b(tablets?|capsules?|caps|syrup|cream|ointment|gel|drops?|eye|ear|nasal|spray|lotion|shampoo|solution|suspension|ampoules?|vials?|vial|inj\w*|sachets?|soap|forte|plus|film|coated|effervescent|oral|strip|strips|pcs|count)\b/g, ' ')
        .replace(/[^a-z؀-ۿ]+/g, '');
}
function dhDupGroups() {
    const m = new Map();
    products.forEach(p => { const k = dhNormKey(p.name); if (k.length >= 4) (m.get(k) || m.set(k, []).get(k)).push(p); });
    return [...m.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length);
}
function dhStats() {
    const n = products.length || 1;
    const ing = products.filter(dhHas).length;
    const cls = products.filter(p => p.department && p.department !== 'قسم غير مصنّف' && p.category && p.category !== 'غير مصنّف').length;
    const bc = products.filter(p => barcodesOf(p).length).length;
    const price = products.filter(p => Number(p.price) > 0).length;
    const form = products.filter(p => p.form).length;
    const pct = Math.round((ing + cls + bc + price + form) / (5 * n) * 100);
    return { n: products.length, ing, cls, bc, price, form, pct };
}
function dhLossCount() { const keep = pzLoss; pzLoss = true; const c = pzBuild().length; pzLoss = keep; return c; }

// ---------- الفتح والإغلاق والتنقل ----------
function dhOpen(screen) {
    let el = dhEl();
    if (!el) { el = document.createElement('div'); el.id = 'dataHub'; el.className = 'tax-rv'; document.body.appendChild(el); }
    el.style.display = 'flex'; dhGo(screen || 'home');
}
function dhClose() {
    const el = dhEl(); if (el) el.style.display = 'none';
    try { renderAll(); } catch (e) { /* تجاهل */ }
}
function dhGo(s) { dhScreen = s; dhQ = ''; dhShown = 40; if (s === 'ing') dhFilter = 'miss'; dhRender(); }
function dhHead(title, back) {
    return `<div class="tr-head"><b>${title}</b><span>${back ? '<button type="button" class="tr-x" style="margin-inline-end:8px" onclick="dhGo(\'home\')" aria-label="رجوع">↩</button>' : ''}<button type="button" class="tr-x" onclick="dhClose()" aria-label="إغلاق">✕</button></span></div>`;
}
function dhRender(keep) {
    const el = dhEl(); if (!el) return;
    if (dhScreen === 'ing') return dhRenderIng(el, keep);
    if (dhScreen === 'dup') return dhRenderDup(el);
    if (dhScreen === 'miss') return dhRenderMiss(el);
    if (dhScreen === 'rules') return dhRenderRules(el);
    dhRenderHome(el);
}

// ---------- الرئيسية ----------
function dhCard(icon, title, sub, pct, onclick, tone) {
    return `<button type="button" class="dh-card" onclick="${onclick}"><span class="dh-ic">${icon}</span><span class="dh-tx"><b>${title}</b><small>${sub}</small>${pct == null ? '' : `<i class="dh-bar"><u style="width:${pct}%"></u></i>`}</span><span class="dh-go">‹</span></button>`;
}
function dhRenderHome(el) {
    const st = dhStats(), dups = dhDupGroups().length, pct = (a, b) => b ? Math.round(a / b * 100) : 100;
    const seeded = typeof taxSeeded === 'function' && taxSeeded(), tax = seeded ? taxRvList().length : 0;
    el.innerHTML = `${dhHead('🧰 مركز تجهيز البيانات')}
    <div class="dh-body">
        <div class="dh-meter"><div><b>${st.pct}%</b><small>اكتمال بيانات المخزن</small></div><i class="dh-bar big"><u style="width:${st.pct}%"></u></i>
            <small>${fmtNum(st.n)} مادة • مادة فعالة ${pct(st.ing, st.n)}% • تصنيف ${pct(st.cls, st.n)}% • باركود ${pct(st.bc, st.n)}% • سعر ${pct(st.price, st.n)}% • شكل دوائي ${pct(st.form, st.n)}%</small></div>
        ${dhCard('🧪', 'سجل المادة الفعالة', `${fmtNum(st.n - st.ing)} مادة بدون اسم علمي — أضفه يدوياً أو اقترحه بالذكاء الاصطناعي`, pct(st.ing, st.n), "dhGo('ing')")}
        ${dhCard('🧭', 'مراجعة التصنيف', seeded ? `${fmtNum(tax)} مادة بالأقسام القديمة بانتظار المراجعة (تستفيد من الاسم العلمي)` : 'حمّل الأقسام الجاهزة أولاً من إدارة الأقسام', seeded ? pct(st.cls, st.n) : null, "dhClose();taxRvOpen()")}
        ${dhCard('🔁', 'المواد المكررة', dups ? `${fmtNum(dups)} مجموعة أسماء متشابهة يمكن ضمها` : 'لا توجد مواد مكررة ظاهرة', null, "dhGo('dup')")}
        ${dhCard('📋', 'بيانات ناقصة', `بلا باركود ${fmtNum(st.n - st.bc)} • بلا سعر ${fmtNum(st.n - st.price)} • بلا شكل دوائي ${fmtNum(st.n - st.form)}`, null, "dhGo('miss')")}
        ${dhCard('⚙️', 'قواعد تصنيفي الخاصة', dhRules.length ? `${fmtNum(dhRules.length)} قاعدة مضافة` : 'أضف قاعدة بنفسك: كلمة بالاسم ← تصنيف', null, "dhGo('rules')")}
        <div class="dh-note">«سجل الأدوية» يبقى بمكانه بالإعدادات كما هو.</div>
    </div>`;
}

// ---------- سجل المادة الفعالة ----------
function dhIngList() {
    const q = String(dhQ || '').toLowerCase().trim();
    return products.filter(p => (dhFilter === 'all' || (dhFilter === 'miss' ? !dhHas(p) : dhHas(p)))
        && (!q || `${p.name} ${p.brand || ''} ${p.activeIngredient || ''}`.toLowerCase().includes(q)))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function dhImgHtml(p) { return p.img && String(p.img).trim() ? `<img src="${dhEsc(p.img)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'📷'}))">` : '<span>📷</span>'; }
// بعد إضافة/حذف صورة من هذه الشاشة: حدّث المصغّرة فقط (بدون فقدان تعديلات الأسماء غير المحفوظة)
function dhImgDone(id) { const el = document.getElementById('dhi-' + id), p = products.find(x => x.id === id); if (!el || !p) return false; el.innerHTML = dhImgHtml(p); return true; }
function dhIngRow(p) {
    const e = dhEdits.get(p.id) || {}, name = e.name != null ? e.name : p.name, ai = e.ai != null ? e.ai : (p.activeIngredient || ''), br = e.br != null ? e.br : (p.brand || '');
    return `<div class="dh-row ${e.aiGen ? 'sug' : ''}" id="dhr-${p.id}">
        <div class="dh-img" id="dhi-${p.id}" onclick="sheetImgTap(${p.id})" role="button" aria-label="صورة المادة">${dhImgHtml(p)}</div>
        <div class="dh-sub" dir="ltr">${dhEsc(p.brand || '')}${p.brand && p.meta ? ' | ' : ''}${dhEsc(fixMetaOrder(p.meta || ''))}</div>
        <label><span>الاسم التجاري</span><input type="text" dir="ltr" value="${dhEsc(name)}" oninput="dhEdit(${p.id},'name',this.value)"></label>
        <label><span>الاسم العلمي (المادة الفعالة)</span><input type="text" dir="ltr" list="activeList" value="${dhEsc(ai)}" placeholder="مثال: Ciprofloxacin — للمركّب افصل بـ +" oninput="dhEdit(${p.id},'ai',this.value)"></label>
        <label><span>الشركة</span><input type="text" dir="ltr" list="dhBrandList" value="${dhEsc(br)}" placeholder="اسم الشركة المصنّعة" oninput="dhEdit(${p.id},'br',this.value)"></label>
    </div>`;
}
function dhEdit(id, f, v) {
    const p = products.find(x => x.id === id); if (!p) return;
    const e = dhEdits.get(id) || {}; e[f] = v; if (f === 'ai') e.aiGen = false;
    dhEdits.set(id, e); dhFootRefresh();
    const row = document.getElementById('dhr-' + id); if (row) row.classList.remove('sug');
}
function dhChanged() {
    const out = [];
    dhEdits.forEach((e, id) => {
        const p = products.find(x => x.id === id); if (!p) return;
        const name = e.name != null ? String(e.name).trim() : p.name, ai = e.ai != null ? String(e.ai).trim() : String(p.activeIngredient || '').trim(), br = e.br != null ? String(e.br).trim() : String(p.brand || '').trim();
        if ((name && name !== p.name) || ai !== String(p.activeIngredient || '').trim() || br !== String(p.brand || '').trim()) out.push({ p, name: name || p.name, ai, br, aiGen: !!e.aiGen });
    });
    return out;
}
function dhFootRefresh() {
    const b = document.getElementById('dhSaveBtn'); if (b) b.textContent = `💾 حفظ (${fmtNum(dhChanged().length)})`;
}
function dhRenderIng(el, keep) {
    const all = dhIngList(), shown = all.slice(0, dhShown), has = products.filter(dhHas).length;
    const chip = (k, t, n) => `<button type="button" class="${dhFilter === k ? 'on' : ''}" onclick="dhSetF('${k}')">${t} <b>${fmtNum(n)}</b></button>`;
    const listHtml = shown.map(dhIngRow).join('') + (all.length > shown.length ? `<button type="button" class="pu-newprod" onclick="dhMore()">عرض المزيد (${fmtNum(all.length - shown.length)})</button>` : '') || '<div class="bill-none">لا توجد مواد بهذا الفلتر.</div>';
    if (keep && document.getElementById('dhList')) { document.getElementById('dhList').innerHTML = listHtml; return; }
    const brands = [...new Set(products.map(p => String(p.brand || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    el.innerHTML = `<datalist id="dhBrandList">${brands.map(b => `<option value="${dhEsc(b)}">`).join('')}</datalist>${dhHead('🧪 سجل المادة الفعالة', true)}
    <div class="tr-prog">اكتمل <b>${fmtNum(has)}</b> من ${fmtNum(products.length)} مادة. الاسم التجاري قابل للتعديل، وتحته تكتب الاسم العلمي.</div>
    <div class="tr-chips">${chip('miss', 'ناقصة', products.length - has)}${chip('done', 'مكتملة', has)}${chip('all', 'الكل', products.length)}</div>
    <input type="search" class="tr-search" placeholder="🔍 ابحث باسم المادة..." value="${dhEsc(dhQ)}" oninput="dhSearch(this.value)">
    <div class="tr-list" id="dhList">${listHtml}</div>
    <div class="tr-foot"><button type="button" onclick="dhAiSuggest()">🤖 اقترح بالذكاء الاصطناعي</button><button type="button" class="tr-apply" id="dhSaveBtn" onclick="dhSaveIng()">💾 حفظ (${fmtNum(dhChanged().length)})</button></div>`;
}
function dhSetF(f) { dhFilter = f; dhShown = 40; dhRender(); }
function dhSearch(v) { dhQ = v; dhShown = 40; dhRender(true); }
function dhMore() { dhShown += 40; dhRender(true); }

async function dhAiSuggest() {
    const eng = typeof getAiEngine === 'function' ? getAiEngine() : 'local';
    if (eng === 'local') { Swal.fire({ icon: 'info', title: 'الذكاء الاصطناعي غير مفعّل', text: 'فعّل محرك الذكاء الاصطناعي من الإعدادات (مفتاح Gemini أو مزوّد آخر) ثم أعد المحاولة.', confirmButtonColor: '#0f1c38' }); return; }
    const todo = dhIngList().filter(p => dhFilter !== 'done' && !String((dhEdits.get(p.id) || {}).ai || '').trim() && !dhHas(p)).slice(0, 25);
    if (!todo.length) { Swal.fire({ icon: 'info', title: 'لا توجد مواد ظاهرة تحتاج اقتراحاً', timer: 1800, showConfirmButton: false }); return; }
    const h = Prog.start('اقتراح المواد الفعالة', { text: fmtNum(todo.length) + ' مادة...' });
    try {
        const list = todo.map((p, i) => `${i + 1}. ${p.name}${p.brand ? ' (' + p.brand + ')' : ''}`).join('\n');
        const prompt = 'You are a pharmacist assistant for an Iraqi pharmacy. For each product below (brand/trade name as sold in Iraq), give the generic active ingredient(s) in English WITHOUT strength or form, joined by " + " for combinations. If the product is not a drug/supplement with a clear active ingredient, or you are not sure, use an empty string. Reply with ONLY a JSON array like [{"i":1,"a":"Ciprofloxacin"}], no extra text.\n\n' + list;
        const txt = await callAiEngine(eng, { prompt, json: false });
        const m = String(txt).match(/\[[\s\S]*\]/); if (!m) throw new Error('رد غير مفهوم من النموذج');
        const arr = JSON.parse(m[0]); let n = 0;
        arr.forEach(o => { const p = todo[(parseInt(o.i) || 0) - 1], a = String(o.a || '').trim(); if (p && a) { const e = dhEdits.get(p.id) || {}; e.ai = a; e.aiGen = true; dhEdits.set(p.id, e); n++; } });
        h.ok(n ? 'اقتُرحت ' + n + ' مادة فعالة — راجعها ثم احفظ' : 'لم يتعرّف النموذج على مواد');
        dhRender();
    } catch (err) { h.fail('تعذّر الاقتراح', err && err.message); }
}
async function dhSaveIng() {
    if (!writesAllowed()) return;
    const ch = dhChanged(); if (!ch.length) { Swal.fire({ icon: 'info', title: 'لا توجد تعديلات للحفظ', timer: 1600, showConfirmButton: false }); return; }
    const ai = ch.filter(c => c.aiGen).length;
    if (ai) {
        const r = await Swal.fire({ icon: 'question', title: 'اقتراحات الذكاء الاصطناعي', text: `${ai} مادة فعالة اقترحها الذكاء الاصطناعي ولم تعدّلها. هل راجعتها وتريد حفظها؟`, showCancelButton: true, confirmButtonColor: '#0f1c38', confirmButtonText: 'نعم، احفظ', cancelButtonText: 'رجوع للمراجعة' });
        if (!r.isConfirmed) return;
    }
    const upd = [];
    ch.forEach(c => {
        const p = c.p, oldN = p.name, oldA = p.activeIngredient || '', f = [];
        if (c.name !== oldN) { p.name = c.name; f.push({ f: 'الاسم (مركز البيانات)', from: oldN, to: c.name }); }
        if (c.ai !== String(oldA).trim()) { p.activeIngredient = c.ai; f.push({ f: 'المادة الفعالة (مركز البيانات)', from: oldA, to: c.ai }); }
        if (c.br !== String(p.brand || '').trim()) { const oldB = p.brand || ''; p.brand = c.br; f.push({ f: 'الشركة (مركز البيانات)', from: oldB, to: c.br }); }
        upd.push({ p, f });
    });
    const ok = await saveProductsBatch(upd.map(u => u.p));
    if (ok) {
        upd.forEach(u => { try { logAction('edit', u.p, u.f); } catch (e) { /* تجاهل */ } });
        ch.forEach(c => dhEdits.delete(c.p.id));
        try { refreshActiveDatalist(); renderAll(); } catch (e) { /* تجاهل */ }
        Swal.fire({ icon: 'success', title: 'تم حفظ ' + fmtNum(upd.length) + ' مادة', toast: true, position: 'bottom', showConfirmButton: false, timer: 2200 });
        dhRender();
    }
}

// ---------- المواد المكررة ----------
function dhRenderDup(el) {
    const gs = dhDupGroups();
    el.innerHTML = `${dhHead('🔁 المواد المكررة', true)}
    <div class="tr-prog">${gs.length ? fmtNum(gs.length) + ' مجموعة أسماء متشابهة. اختر المادة الصحيحة وضمّ الأخرى إليها؛ السجلات كلها تنتقل للمادة الباقية.' : 'لا توجد مواد مكررة ظاهرة ✅'}</div>
    <div class="tr-list">${gs.slice(0, 80).map(g => `<div class="dh-row"><div class="dh-sub">${g.length} مواد متشابهة</div>${g.map((p, i) => `<div class="dh-dup"><span dir="ltr"><b>${dhEsc(p.name)}</b><small> ${dhEsc(stockLabel(p))}</small></span>${i === 0 ? '<em>الأساسية</em>' : `<button type="button" onclick="dhMerge(${p.id},${g[0].id})">⇄ ضمّها للأساسية</button>`}</div>`).join('')}${g.length > 2 ? '' : `<button type="button" class="dh-swap" onclick="dhMerge(${g[0].id},${g[1].id})">⇄ اعكس: ضمّ الأولى للثانية</button>`}</div>`).join('')}</div>`;
}
async function dhMerge(srcId, dstId) {
    catSrc = srcId; await catMergeConfirm(dstId);   // نافذة التأكيد داخل catMergeConfirm
    dhRender();
}

// ---------- بيانات ناقصة ----------
function dhRenderMiss(el) {
    const st = dhStats(), loss = dhLossCount();
    pzLoss = false; const nop = pzBuild().length;
    const row = (t, n, btn) => `<div class="dh-miss"><span><b>${t}</b><small>${fmtNum(n)} مادة</small></span>${btn || ''}</div>`;
    el.innerHTML = `${dhHead('📋 بيانات ناقصة', true)}<div class="dh-body">
        ${row('بلا باركود', st.n - st.bc, '<button type="button" onclick="dhClose();openCatalog()">افتح سجل الأدوية</button>')}
        ${row('بلا شكل دوائي', st.n - st.form, '<button type="button" onclick="dhClose();openCatalog()">افتح سجل الأدوية</button>')}
        ${row('بلا سعر بيع (ولها سعر شراء)', nop, '<button type="button" onclick="pzOpen()">تسعيرها</button>')}
        ${row('تُباع بخسارة (السعر ≤ الكلفة)', loss, '<button type="button" onclick="pzOpen(true)">تصحيحها</button>')}
        ${row('بلا مادة فعالة', st.n - st.ing, "<button type=\"button\" onclick=\"dhGo('ing')\">أكملها</button>")}
    </div>`;
}

// ---------- قواعد تصنيفي الخاصة ----------
function dhRenderRules(el) {
    const depts = TAX_DEPTS;
    el.innerHTML = `${dhHead('⚙️ قواعد تصنيفي الخاصة', true)}<div class="dh-body">
        <div class="dh-note">إذا ظهرت أي كلمة من كلماتك في اسم المادة أو اسمها العلمي، يُقترح التصنيف الذي تحدده. قواعدك تتقدم على القواعد الجاهزة.</div>
        <div class="dh-row"><label><span>الكلمات (افصل بينها بفاصلة)</span><input type="text" id="dhRw" dir="ltr" placeholder="مثال: eye drops, ophthalmic"></label>
            <label><span>القسم</span><select id="dhRd" onchange="dhRuleCats()">${depts.map(d => `<option>${dhEsc(d)}</option>`).join('')}</select></label>
            <label><span>التصنيف</span><select id="dhRc"></select></label>
            <button type="button" class="dh-add" onclick="dhRuleAdd()">＋ إضافة القاعدة</button></div>
        ${dhRules.map((r, i) => `<div class="dh-miss"><span><b dir="ltr">${dhEsc((r.words || []).join(' ، '))}</b><small>${dhEsc(r.dept)} › ${dhEsc(r.cat)} • تطابق ${fmtNum(products.filter(p => (r.words || []).some(w => `${p.name} ${p.activeIngredient || ''}`.toLowerCase().includes(String(w).toLowerCase()))).length)} مادة</small></span><button type="button" onclick="dhRuleDel(${i})">🗑 حذف</button></div>`).join('')}
    </div>`;
    dhRuleCats();
}
function dhRuleCats() {
    const d = document.getElementById('dhRd'), c = document.getElementById('dhRc'); if (!d || !c) return;
    c.innerHTML = (TAX_SEED[d.value] || []).map(x => `<option>${dhEsc(x)}</option>`).join('');
}
function dhRuleAdd() {
    const words = document.getElementById('dhRw').value.split(/[,،]+/).map(x => x.trim()).filter(Boolean);
    const dept = document.getElementById('dhRd').value, cat = document.getElementById('dhRc').value;
    if (!words.length) { Swal.fire({ icon: 'warning', title: 'اكتب كلمة واحدة على الأقل', confirmButtonColor: '#0f1c38' }); return; }
    dhRules.unshift({ words, dept, cat }); dhRulesSave(); dhRender();
}
async function dhRuleDel(i) {
    if (!(await askSure('حذف هذه القاعدة؟', (dhRules[i].words || []).join(' ، '), 'حذف'))) return;
    dhRules.splice(i, 1); dhRulesSave(); dhRender();
}
