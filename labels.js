// ============================================================================
// ملصقات الباركود: توليد باركود داخلي (EAN-13) + طباعة على ورق A4 مقسّم بأنواع تقسيم متعددة
// ============================================================================
const LBL_LS = 'diwanLabelCfg', LBL_SEQ = 'diwanLblSeq';
// [عدد الملصقات، أعمدة، صفوف، عرض ملم، ارتفاع ملم، مسافة أفقية، مسافة عمودية]
const LBL_SHEETS = [
    [2, 1, 2, 199.6, 143.5, 0, 0], [4, 2, 2, 99.1, 139, 2.5, 0], [6, 2, 3, 99.1, 93.1, 2.5, 0], [8, 2, 4, 99.1, 67.7, 2.5, 0],
    [10, 2, 5, 99.1, 57, 2.5, 0], [12, 2, 6, 99.1, 42.3, 2.5, 0], [14, 2, 7, 99.1, 38.1, 2.5, 0], [16, 2, 8, 99.1, 33.9, 2.5, 0],
    [18, 3, 6, 63.5, 46.6, 2.5, 0], [21, 3, 7, 63.5, 38.1, 2.5, 0], [24, 3, 8, 63.5, 33.9, 2.5, 0], [27, 3, 9, 63.5, 29.6, 2.5, 0],
    [30, 3, 10, 63.5, 25.4, 2.5, 0], [33, 3, 11, 63.5, 25.4, 2.5, 0], [40, 4, 10, 48.5, 25.4, 0, 0], [44, 4, 11, 48.5, 25.4, 0, 0],
    [48, 4, 12, 45.7, 21.2, 2.5, 0], [56, 4, 14, 52.5, 21.2, 0, 0], [65, 5, 13, 38.1, 21.2, 2.5, 0], [84, 4, 21, 52.5, 14.1, 0, 0],
    [100, 5, 20, 42, 14.85, 0, 0]
];
const LBL_DEF = { sheet: '24', custom: { cols: 3, rows: 8, w: 63.5, h: 33.9, gx: 2.5, gy: 0, ml: '', mt: '' }, name: true, num: true, price: false, shop: false,
    shopName: 'صيدلية الديوان', copies: 1, start: 1, guides: false, offX: 0, offY: 0 };
function lblCfg() {
    let s = null; try { s = JSON.parse(localStorage.getItem(LBL_LS)); } catch (e) { s = null; }
    const c = Object.assign({}, LBL_DEF, s || {}); c.custom = Object.assign({}, LBL_DEF.custom, (s && s.custom) || {}); return c;
}
function lblCfgSave(c) { try { localStorage.setItem(LBL_LS, JSON.stringify(c)); } catch (e) { /* تجاهل */ } }
function lblGeom(c) {
    const n = v => { const x = parseFloat(v); return isFinite(x) ? x : NaN; };
    let cols, rows, w, h, gx, gy, ml, mt;
    if (c.sheet === 'custom') {
        const u = c.custom; cols = Math.max(1, parseInt(u.cols) || 1); rows = Math.max(1, parseInt(u.rows) || 1); w = n(u.w) || 50; h = n(u.h) || 25; gx = n(u.gx) || 0; gy = n(u.gy) || 0;
        ml = n(u.ml); mt = n(u.mt);
    } else {
        const s = LBL_SHEETS.find(x => String(x[0]) === String(c.sheet)) || LBL_SHEETS.find(x => x[0] === 24);
        cols = s[1]; rows = s[2]; w = s[3]; h = s[4]; gx = s[5]; gy = s[6]; ml = NaN; mt = NaN;
    }
    if (!isFinite(ml)) ml = (210 - (cols * w + (cols - 1) * gx)) / 2;
    if (!isFinite(mt)) mt = (297 - (rows * h + (rows - 1) * gy)) / 2;
    return { cols, rows, w, h, gx, gy, ml, mt, per: cols * rows };
}
// ---------- توليد الباركود الداخلي ----------
function lblEanCheck(d12) { let s = 0; for (let i = 0; i < 12; i++) s += (+d12[i]) * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10; }
function lblNextCode() {   // يبدأ بالرقم 2 (نطاق الاستعمال الداخلي في EAN-13) ثم 11 خانة تسلسلية ثم رقم التحقق
    let mx = parseInt(localStorage.getItem(LBL_SEQ)) || 0;
    products.forEach(p => barcodesOf(p).forEach(b => { if (/^2\d{12}$/.test(b)) mx = Math.max(mx, parseInt(b.slice(1, 12), 10) || 0); }));
    for (let k = 0; k < 100000; k++) {
        mx++;
        const d = '2' + String(mx).padStart(11, '0'), code = d + lblEanCheck(d);
        if (!findByBarcode(code)) { try { localStorage.setItem(LBL_SEQ, String(mx)); } catch (e) { /* تجاهل */ } return code; }
    }
    return '';
}
// ---------- رسم الباركود (SVG) ----------
const L_ = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_ = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_ = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const P_ = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
function lblBits(code) {   // يرجع {bits, quiet} حسب نوع الباركود
    const c = String(code || '');
    const isD = /^\d+$/.test(c);
    const ean13 = d => { const f = +d[0], par = P_[f]; let b = '101'; for (let i = 0; i < 6; i++) b += (par[i] === 'L' ? L_ : G_)[+d[i + 1]]; b += '01010'; for (let i = 7; i < 13; i++) b += R_[+d[i]]; return b + '101'; };
    if (isD && c.length === 13 && lblEanCheck(c) === +c[12]) return { bits: ean13(c), quiet: 9 };
    if (isD && c.length === 12 && lblEanCheck('0' + c.slice(0, 11)) === +c[11]) return { bits: ean13('0' + c), quiet: 9 };
    if (isD && c.length === 8) {
        let s = 0; for (let i = 0; i < 7; i++) s += (+c[i]) * (i % 2 ? 1 : 3);
        if ((10 - (s % 10)) % 10 === +c[7]) { let b = '101'; for (let i = 0; i < 4; i++) b += L_[+c[i]]; b += '01010'; for (let i = 4; i < 8; i++) b += R_[+c[i]]; return { bits: b + '101', quiet: 7 }; }
    }
    // Code 128-B لأي رقم أو نص آخر
    const vals = [104]; let sum = 104;
    for (let i = 0; i < c.length; i++) { const v = c.charCodeAt(i) - 32; if (v < 0 || v > 94) continue; vals.push(v); sum += v * (vals.length - 1); }
    vals.push(sum % 103); vals.push(106);
    let bits = '', bar = true;
    vals.forEach(v => { String(C128[v]).split('').forEach(w => { bits += (bar ? '1' : '0').repeat(+w); bar = !bar; }); bar = true; });
    return { bits, quiet: 10 };
}
function lblSvg(code) {
    const r = lblBits(code), q = r.quiet, W = r.bits.length + q * 2; let d = '';
    for (let i = 0; i < r.bits.length;) { if (r.bits[i] === '1') { let j = i; while (j < r.bits.length && r.bits[j] === '1') j++; d += 'M' + (i + q) + ' 0h' + (j - i) + 'v1h-' + (j - i) + 'z'; i = j; } else i++; }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 1" preserveAspectRatio="none" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`;
}
// ---------- بناء صفحات الملصقات ----------
function lblPagesHtml(c, items, onlyFirst) {
    const g = lblGeom(c), list = [];
    items.forEach(it => { for (let k = 0; k < Math.max(1, parseInt(c.copies) || 1); k++) list.push(it); });
    const start = Math.max(1, Math.min(g.per, parseInt(c.start) || 1)) - 1;
    const slots = new Array(start).fill(null).concat(list);
    const pages = Math.max(1, Math.ceil(slots.length / g.per)), fs = Math.min(g.h > 60 ? 15 : 10, Math.max(4.5, g.h * 0.26));
    const ox = parseFloat(c.offX) || 0, oy = parseFloat(c.offY) || 0;
    let out = '';
    for (let pg = 0; pg < (onlyFirst ? 1 : pages); pg++) {
        let inner = '';
        for (let i = 0; i < g.per; i++) {
            const it = slots[pg * g.per + i]; if (it === undefined) break;
            const col = i % g.cols, row = Math.floor(i / g.cols);
            const x = g.ml + col * (g.w + g.gx) + ox, y = g.mt + row * (g.h + g.gy) + oy;
            const box = `left:${x.toFixed(2)}mm;top:${y.toFixed(2)}mm;width:${g.w}mm;height:${g.h}mm;font-size:${fs.toFixed(1)}pt`;
            if (!it) { inner += `<div class="lb${c.guides ? ' lg' : ''}" style="${box}"></div>`; continue; }
            inner += `<div class="lb${c.guides ? ' lg' : ''}" style="${box}">`
                + (c.shop && c.shopName ? `<div class="ls">${escapeHtml(c.shopName)}</div>` : '')
                + (c.name ? `<div class="ln">${escapeHtml(it.name || '')}</div>` : '')
                + `<div class="lbar">${lblSvg(it.bc)}</div>`
                + (c.num ? `<div class="lnum">${escapeHtml(it.bc)}</div>` : '')
                + (c.price && parseFloat(it.price) > 0 ? `<div class="lpr">${Number(it.price).toLocaleString('en-US')} د.ع</div>` : '')
                + `</div>`;
        }
        out += `<div class="lpg">${inner}</div>`;
    }
    return { html: out, pages, total: list.length, per: g.per };
}
function lblCss() {
    const ff = (getComputedStyle(document.body).fontFamily || 'sans-serif').replace(/"/g, "'");
    return `.lpg{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fff;page-break-after:always;break-after:page}.lpg:last-child{page-break-after:auto;break-after:auto}
.lb{position:absolute;box-sizing:border-box;padding:.8mm 1.2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;text-align:center;line-height:1.15;color:#000;font-family:${ff};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lb.lg{outline:.2mm dashed #888;outline-offset:-.1mm}.ls{font-size:.8em;font-weight:700;white-space:nowrap;max-width:100%;overflow:hidden}
.ln{font-weight:700;width:100%;max-height:2.4em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;unicode-bidi:plaintext;word-break:break-word}
.lbar{flex:1 1 auto;min-height:0;width:100%;margin:.4mm 0}.lbar svg{width:100%;height:100%;display:block}
.lnum{font-family:monospace;letter-spacing:.05em;direction:ltr;white-space:nowrap;font-size:.85em}.lpr{font-weight:800;font-size:1.05em}`;
}
function lblPrint(c, items) {
    const h = Prog.start('تجهيز الملصقات', { text: 'جارٍ تجهيز الصفحات للطباعة...', indeterminate: true });
    try {
        const r = lblPagesHtml(c, items, false);
        const doc = `<!doctype html><html dir="ltr"><head><meta charset="utf-8"><title>ملصقات الباركود</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}${lblCss()}</style></head><body>${r.html}</body></html>`;
        const old = document.getElementById('lblFrame'); if (old) old.remove();
        const f = document.createElement('iframe'); f.id = 'lblFrame'; f.setAttribute('aria-hidden', 'true');
        f.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none';
        f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); h.ok('تم تجهيز ' + r.pages + ' صفحة'); } catch (e) { h.fail('تعذر بدء الطباعة', e && e.message); } };
        f.srcdoc = doc; document.body.appendChild(f);
    } catch (e) { h.fail('تعذر تجهيز الملصقات', e && e.message); }
}
// ---------- النافذة ----------
let lblSt = null;
function lblItemsOf(list) { return list.map(p => ({ id: p.id, name: p.name, price: p.price, bc: barcodesOf(p)[0] || '' })); }
function lblCan() { return typeof can === 'function' ? can('stockEdit') : true; }
function lblOpen(arg, opt) {   // arg: مصفوفة مواد/عناصر، أو بلا وسيط لاختيار المصدر من داخل النافذة
    opt = opt || {};
    const picker = !arg;
    lblSt = { cfg: lblCfg(), items: picker ? [] : (arg[0] && arg[0].id !== undefined && arg[0].bc === undefined ? lblItemsOf(arg) : arg), picker, src: 'nobc', picked: [] };
    if (picker) lblPickRecalc();
    Swal.fire({ title: '🏷️ ملصقات الباركود', html: lblDlgHtml(), width: 560, showCancelButton: true, confirmButtonText: '🖨️ طباعة', cancelButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', customClass: { popup: 'lbl-pop' },
        didOpen: lblWire, preConfirm: () => { lblRead(); const ok = lblSt.items.filter(i => i.bc); if (!ok.length) { Swal.showValidationMessage('لا توجد مواد بباركود للطباعة'); return false; } lblCfgSave(lblSt.cfg); lblPrint(lblSt.cfg, ok); return false; } });
}
function lblPickRecalc() {
    const act = products.filter(p => !p.arch);
    if (lblSt.src === 'nobc') lblSt.items = lblItemsOf(act.filter(p => !barcodesOf(p).length));
    else if (lblSt.src === 'all') lblSt.items = lblItemsOf(act);
    else lblSt.items = lblItemsOf(lblSt.picked.map(id => products.find(p => p.id === id)).filter(Boolean));
}
function lblDlgHtml() {
    const c = lblSt.cfg, cu = c.custom;
    const sw = (id, on, t) => `<div class="lbl-row"><span>${t}</span><label class="setup-sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label></div>`;
    const num = (id, v, t, st) => `<label class="lbl-f"><span>${t}</span><input id="${id}" type="number" inputmode="decimal" step="${st || 'any'}" min="0" value="${v === undefined || v === null ? '' : v}" dir="ltr"></label>`;
    return `<div class="lbl-box">
        ${lblSt.picker ? `<label class="lbl-f"><span>المواد المطلوب طباعتها</span><select id="lbSrc"><option value="nobc">المواد التي بلا باركود</option><option value="all">كل المواد</option><option value="pick">اختيار مواد بالاسم</option></select></label>
        <div id="lbPick" hidden><input id="lbQ" type="search" placeholder="ابحث باسم المادة..." autocomplete="off"><div id="lbRes" class="lbl-res"></div><div id="lbChips" class="lbl-chips"></div></div>` : ''}
        <div id="lbSum" class="lbl-sum"></div><div id="lbGenW"></div>
        <label class="lbl-f"><span>نوع تقسيم الورقة (A4)</span><select id="lbSheet">${LBL_SHEETS.map(s => `<option value="${s[0]}">${s[0]} ملصقاً — ${s[1]}×${s[2]} — ${s[3]}×${s[4]} ملم</option>`).join('')}<option value="custom">مخصّص (أدخل القياسات)</option></select></label>
        <div id="lbCust" class="lbl-grid" hidden>${num('cuCols', cu.cols, 'عدد الأعمدة', 1)}${num('cuRows', cu.rows, 'عدد الصفوف', 1)}${num('cuW', cu.w, 'عرض الملصق (ملم)')}${num('cuH', cu.h, 'ارتفاع الملصق (ملم)')}${num('cuGx', cu.gx, 'مسافة أفقية (ملم)')}${num('cuGy', cu.gy, 'مسافة عمودية (ملم)')}${num('cuMl', cu.ml, 'هامش أيسر (فارغ = وسط)')}${num('cuMt', cu.mt, 'هامش علوي (فارغ = وسط)')}</div>
        <div class="lbl-sec">محتوى الملصق</div>
        ${sw('lbName', c.name, 'اسم المادة')}${sw('lbNum', c.num, 'رقم الباركود تحت الخطوط')}${sw('lbPrice', c.price, 'السعر')}${sw('lbShop', c.shop, 'اسم الصيدلية')}
        <label class="lbl-f" id="lbShopW"><span>اسم الصيدلية على الملصق</span><input id="lbShopN" type="text" value="${escapeHtml(c.shopName)}"></label>
        <div class="lbl-grid">${num('lbCopies', c.copies, 'عدد النسخ لكل مادة', 1)}${num('lbStart', c.start, 'البدء من الملصق رقم', 1)}</div>
        <details class="lbl-det"><summary>ضبط الإزاحة والتجربة</summary>
            <div class="lbl-grid">${num('lbOx', c.offX, 'إزاحة أفقية (ملم، سالب = يسار)')}${num('lbOy', c.offY, 'إزاحة عمودية (ملم، سالب = أعلى)')}</div>
            ${sw('lbGuides', c.guides, 'إظهار حدود الملصقات (للتجربة على ورقة عادية)')}
        </details>
        <div class="lbl-sec">معاينة الصفحة الأولى</div><div id="lbPv" class="lbl-pv"></div><div id="lbInfo" class="lbl-info"></div>
        <div class="lbl-note">يُحفظ نوع الورقة وخياراتك تلقائياً كإعداد افتراضي لهذا الجهاز.</div>
    </div>`;
}
function lblRead() {
    const $ = id => document.getElementById(id), c = lblSt.cfg;
    c.sheet = $('lbSheet').value;
    c.custom = { cols: $('cuCols').value, rows: $('cuRows').value, w: $('cuW').value, h: $('cuH').value, gx: $('cuGx').value, gy: $('cuGy').value, ml: $('cuMl').value, mt: $('cuMt').value };
    c.name = $('lbName').checked; c.num = $('lbNum').checked; c.price = $('lbPrice').checked; c.shop = $('lbShop').checked; c.guides = $('lbGuides').checked;
    c.shopName = $('lbShopN').value; c.copies = Math.max(1, parseInt($('lbCopies').value) || 1); c.start = Math.max(1, parseInt($('lbStart').value) || 1);
    c.offX = parseFloat($('lbOx').value) || 0; c.offY = parseFloat($('lbOy').value) || 0;
}
function lblRefresh() {
    const $ = id => document.getElementById(id); if (!$('lbPv')) return;
    lblRead(); const c = lblSt.cfg; lblCfgSave(c);
    $('lbCust').hidden = c.sheet !== 'custom'; $('lbShopW').style.display = c.shop ? '' : 'none';
    const ok = lblSt.items.filter(i => i.bc), no = lblSt.items.filter(i => !i.bc && i.id !== undefined);
    $('lbSum').innerHTML = `المواد: <b>${ok.length}</b> بباركود${no.length ? ` · <b style="color:#b91c1c">${no.length}</b> بلا باركود (لن تُطبع)` : ''}`;
    $('lbGenW').innerHTML = no.length && lblCan() ? `<button type="button" class="lbl-gen" id="lbGen">⚙ توليد باركود وحفظه لـ ${no.length} مادة</button>` : '';
    const g = $('lbGen'); if (g) g.onclick = lblGenAll;
    const r = lblPagesHtml(c, ok.length ? ok : [{ name: 'اسم المادة', price: 5000, bc: '2000000000015' }], true), full = lblPagesHtml(c, ok, false), geo = lblGeom(c);
    const pv = $('lbPv'), s = Math.max(.2, (pv.clientWidth || 300) / (210 * 3.7795));
    pv.style.height = (297 * 3.7795 * s) + 'px';
    pv.innerHTML = `<style>${lblCss()}</style><div style="width:210mm;height:297mm;transform:scale(${s});transform-origin:top left;box-shadow:0 0 0 1px #cbd5e1">${r.html}</div>`;
    $('lbInfo').textContent = ok.length ? `${full.total} ملصق على ${full.pages} صفحة · ${geo.per} ملصقاً في الصفحة (${geo.w}×${geo.h} ملم)` : 'لا توجد مواد بباركود. المعاينة تجريبية.';
}
function lblWire() {
    const $ = id => document.getElementById(id), c = lblSt.cfg;
    $('lbSheet').value = c.sheet;
    const any = () => lblRefresh();
    document.querySelectorAll('.lbl-box input, .lbl-box select').forEach(e => { if (e.id !== 'lbQ') { e.addEventListener('input', any); e.addEventListener('change', any); } });
    if (lblSt.picker) {
        $('lbSrc').value = lblSt.src;
        $('lbSrc').onchange = () => { lblSt.src = $('lbSrc').value; $('lbPick').hidden = lblSt.src !== 'pick'; lblPickRecalc(); lblPickDraw(); lblRefresh(); };
        $('lbQ').oninput = lblPickDraw;
        lblPickDraw();
    }
    lblRefresh();
}
function lblPickDraw() {
    const $ = id => document.getElementById(id); if (!$('lbRes')) return;
    const q = normSearch($('lbQ').value || ''), toks = q.split(' ');
    const res = q ? products.filter(p => !p.arch && !lblSt.picked.includes(p.id) && searchScore(p, q, toks) > 0).slice(0, 8) : [];
    $('lbRes').innerHTML = res.map(p => `<button type="button" data-a="${p.id}"><span dir="auto">${escapeHtml(p.name)}</span><i>＋</i></button>`).join('');
    $('lbChips').innerHTML = lblSt.picked.map(id => { const p = products.find(x => x.id === id); return p ? `<span class="lbl-chip"><span dir="auto">${escapeHtml(p.name)}</span><button type="button" data-r="${id}" aria-label="إزالة">✕</button></span>` : ''; }).join('');
    $('lbRes').querySelectorAll('button').forEach(b => b.onclick = () => { lblSt.picked.push(+b.dataset.a); $('lbQ').value = ''; lblPickRecalc(); lblPickDraw(); lblRefresh(); });
    $('lbChips').querySelectorAll('button').forEach(b => b.onclick = () => { lblSt.picked = lblSt.picked.filter(x => x !== +b.dataset.r); lblPickRecalc(); lblPickDraw(); lblRefresh(); });
}
async function lblGenAll() {
    if (!writesAllowed() || !lblCan()) return;
    const list = lblSt.items.filter(i => !i.bc && i.id !== undefined), ps = list.map(i => products.find(p => p.id === i.id)).filter(Boolean);
    if (!ps.length) return;
    const old = ps.map(p => ({ b: p.barcode, bs: p.barcodes }));
    ps.forEach(p => { const code = lblNextCode(); p.barcode = code; p.barcodes = [code]; });
    const ok = typeof catSaveMany === 'function' ? await catSaveMany(ps.map(p => ({ p, dq: 0, dl: 0 })), 'حفظ الباركودات', 'تم توليد الباركودات') : 0;
    ps.forEach((p, i) => { if (i >= ok) { p.barcode = old[i].b; p.barcodes = old[i].bs; } });
    ps.slice(0, ok).forEach(p => { try { logAction('edit', p, [{ f: 'الباركود', from: '', to: p.barcode }]); } catch (e) { /* تجاهل */ } });
    list.forEach(i => { const p = products.find(x => x.id === i.id); i.bc = p ? (barcodesOf(p)[0] || '') : ''; });
    if (typeof renderCatalog === 'function' && document.getElementById('catList')) renderCatalog();
    lblRefresh();
}
// ---------- نقاط الدخول ----------
function lblGenForm() {   // من نموذج تعديل المادة: يولّد رقماً ويضيفه لقائمة الباركودات
    const code = lblNextCode(); if (code) addFormBarcode(code);
}
function lblFormPrint() {
    const name = (document.getElementById('fName') || {}).value || '', price = (document.getElementById('fPrice') || {}).value || 0;
    const bc = (formBarcodes && formBarcodes[0]) || '';
    if (!bc) { Swal.fire({ icon: 'info', title: 'أضف باركوداً أولاً', text: 'اضغط «توليد» أو اكتب باركوداً ثم اطبع الملصق.', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); return; }
    lblOpen([{ name: name.trim(), price, bc }]);
}
