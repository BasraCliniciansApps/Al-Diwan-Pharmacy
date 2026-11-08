// تصدير Excel حقيقي (.xlsx) لقوائم الوارد بنفس تنسيق ملف الصيدلية (جدول Excel بنمط Light9 واتجاه من اليمين لليسار)
// مولّد xlsx ذاتي بلا مكتبات خارجية: يعمل دون إنترنت.
const XL_THEME = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n<a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" name=\"Office Theme\"><a:themeElements><a:clrScheme name=\"Office\"><a:dk1><a:sysClr val=\"windowText\" lastClr=\"000000\"/></a:dk1><a:lt1><a:sysClr val=\"window\" lastClr=\"FFFFFF\"/></a:lt1><a:dk2><a:srgbClr val=\"44546A\"/></a:dk2><a:lt2><a:srgbClr val=\"E7E6E6\"/></a:lt2><a:accent1><a:srgbClr val=\"5B9BD5\"/></a:accent1><a:accent2><a:srgbClr val=\"ED7D31\"/></a:accent2><a:accent3><a:srgbClr val=\"A5A5A5\"/></a:accent3><a:accent4><a:srgbClr val=\"FFC000\"/></a:accent4><a:accent5><a:srgbClr val=\"4472C4\"/></a:accent5><a:accent6><a:srgbClr val=\"70AD47\"/></a:accent6><a:hlink><a:srgbClr val=\"0563C1\"/></a:hlink><a:folHlink><a:srgbClr val=\"954F72\"/></a:folHlink></a:clrScheme><a:fontScheme name=\"Office\"><a:majorFont><a:latin typeface=\"Calibri Light\" panose=\"020F0302020204030204\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/><a:font script=\"Jpan\" typeface=\"Yu Gothic Light\"/><a:font script=\"Hang\" typeface=\"맑은 고딕\"/><a:font script=\"Hans\" typeface=\"等线 Light\"/><a:font script=\"Hant\" typeface=\"新細明體\"/><a:font script=\"Arab\" typeface=\"Times New Roman\"/><a:font script=\"Hebr\" typeface=\"Times New Roman\"/><a:font script=\"Thai\" typeface=\"Tahoma\"/><a:font script=\"Ethi\" typeface=\"Nyala\"/><a:font script=\"Beng\" typeface=\"Vrinda\"/><a:font script=\"Gujr\" typeface=\"Shruti\"/><a:font script=\"Khmr\" typeface=\"MoolBoran\"/><a:font script=\"Knda\" typeface=\"Tunga\"/><a:font script=\"Guru\" typeface=\"Raavi\"/><a:font script=\"Cans\" typeface=\"Euphemia\"/><a:font script=\"Cher\" typeface=\"Plantagenet Cherokee\"/><a:font script=\"Yiii\" typeface=\"Microsoft Yi Baiti\"/><a:font script=\"Tibt\" typeface=\"Microsoft Himalaya\"/><a:font script=\"Thaa\" typeface=\"MV Boli\"/><a:font script=\"Deva\" typeface=\"Mangal\"/><a:font script=\"Telu\" typeface=\"Gautami\"/><a:font script=\"Taml\" typeface=\"Latha\"/><a:font script=\"Syrc\" typeface=\"Estrangelo Edessa\"/><a:font script=\"Orya\" typeface=\"Kalinga\"/><a:font script=\"Mlym\" typeface=\"Kartika\"/><a:font script=\"Laoo\" typeface=\"DokChampa\"/><a:font script=\"Sinh\" typeface=\"Iskoola Pota\"/><a:font script=\"Mong\" typeface=\"Mongolian Baiti\"/><a:font script=\"Viet\" typeface=\"Times New Roman\"/><a:font script=\"Uigh\" typeface=\"Microsoft Uighur\"/><a:font script=\"Geor\" typeface=\"Sylfaen\"/></a:majorFont><a:minorFont><a:latin typeface=\"Calibri\" panose=\"020F0502020204030204\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/><a:font script=\"Jpan\" typeface=\"Yu Gothic\"/><a:font script=\"Hang\" typeface=\"맑은 고딕\"/><a:font script=\"Hans\" typeface=\"等线\"/><a:font script=\"Hant\" typeface=\"新細明體\"/><a:font script=\"Arab\" typeface=\"Arial\"/><a:font script=\"Hebr\" typeface=\"Arial\"/><a:font script=\"Thai\" typeface=\"Tahoma\"/><a:font script=\"Ethi\" typeface=\"Nyala\"/><a:font script=\"Beng\" typeface=\"Vrinda\"/><a:font script=\"Gujr\" typeface=\"Shruti\"/><a:font script=\"Khmr\" typeface=\"DaunPenh\"/><a:font script=\"Knda\" typeface=\"Tunga\"/><a:font script=\"Guru\" typeface=\"Raavi\"/><a:font script=\"Cans\" typeface=\"Euphemia\"/><a:font script=\"Cher\" typeface=\"Plantagenet Cherokee\"/><a:font script=\"Yiii\" typeface=\"Microsoft Yi Baiti\"/><a:font script=\"Tibt\" typeface=\"Microsoft Himalaya\"/><a:font script=\"Thaa\" typeface=\"MV Boli\"/><a:font script=\"Deva\" typeface=\"Mangal\"/><a:font script=\"Telu\" typeface=\"Gautami\"/><a:font script=\"Taml\" typeface=\"Latha\"/><a:font script=\"Syrc\" typeface=\"Estrangelo Edessa\"/><a:font script=\"Orya\" typeface=\"Kalinga\"/><a:font script=\"Mlym\" typeface=\"Kartika\"/><a:font script=\"Laoo\" typeface=\"DokChampa\"/><a:font script=\"Sinh\" typeface=\"Iskoola Pota\"/><a:font script=\"Mong\" typeface=\"Mongolian Baiti\"/><a:font script=\"Viet\" typeface=\"Arial\"/><a:font script=\"Uigh\" typeface=\"Microsoft Uighur\"/><a:font script=\"Geor\" typeface=\"Sylfaen\"/></a:minorFont></a:fontScheme><a:fmtScheme name=\"Office\"><a:fillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:gradFill rotWithShape=\"1\"><a:gsLst><a:gs pos=\"0\"><a:schemeClr val=\"phClr\"><a:lumMod val=\"110000\"/><a:satMod val=\"105000\"/><a:tint val=\"67000\"/></a:schemeClr></a:gs><a:gs pos=\"50000\"><a:schemeClr val=\"phClr\"><a:lumMod val=\"105000\"/><a:satMod val=\"103000\"/><a:tint val=\"73000\"/></a:schemeClr></a:gs><a:gs pos=\"100000\"><a:schemeClr val=\"phClr\"><a:lumMod val=\"105000\"/><a:satMod val=\"109000\"/><a:tint val=\"81000\"/></a:schemeClr></a:gs></a:gsLst><a:lin ang=\"5400000\" scaled=\"0\"/></a:gradFill><a:gradFill rotWithShape=\"1\"><a:gsLst><a:gs pos=\"0\"><a:schemeClr val=\"phClr\"><a:satMod val=\"103000\"/><a:lumMod val=\"102000\"/><a:tint val=\"94000\"/></a:schemeClr></a:gs><a:gs pos=\"50000\"><a:schemeClr val=\"phClr\"><a:satMod val=\"110000\"/><a:lumMod val=\"100000\"/><a:shade val=\"100000\"/></a:schemeClr></a:gs><a:gs pos=\"100000\"><a:schemeClr val=\"phClr\"><a:lumMod val=\"99000\"/><a:satMod val=\"120000\"/><a:shade val=\"78000\"/></a:schemeClr></a:gs></a:gsLst><a:lin ang=\"5400000\" scaled=\"0\"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w=\"6350\" cap=\"flat\" cmpd=\"sng\" algn=\"ctr\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:prstDash val=\"solid\"/><a:miter lim=\"800000\"/></a:ln><a:ln w=\"12700\" cap=\"flat\" cmpd=\"sng\" algn=\"ctr\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:prstDash val=\"solid\"/><a:miter lim=\"800000\"/></a:ln><a:ln w=\"19050\" cap=\"flat\" cmpd=\"sng\" algn=\"ctr\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:prstDash val=\"solid\"/><a:miter lim=\"800000\"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad=\"57150\" dist=\"19050\" dir=\"5400000\" algn=\"ctr\" rotWithShape=\"0\"><a:srgbClr val=\"000000\"><a:alpha val=\"63000\"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"><a:tint val=\"95000\"/><a:satMod val=\"170000\"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape=\"1\"><a:gsLst><a:gs pos=\"0\"><a:schemeClr val=\"phClr\"><a:tint val=\"93000\"/><a:satMod val=\"150000\"/><a:shade val=\"98000\"/><a:lumMod val=\"102000\"/></a:schemeClr></a:gs><a:gs pos=\"50000\"><a:schemeClr val=\"phClr\"><a:tint val=\"98000\"/><a:satMod val=\"130000\"/><a:shade val=\"90000\"/><a:lumMod val=\"103000\"/></a:schemeClr></a:gs><a:gs pos=\"100000\"><a:schemeClr val=\"phClr\"><a:shade val=\"63000\"/><a:satMod val=\"120000\"/></a:schemeClr></a:gs></a:gsLst><a:lin ang=\"5400000\" scaled=\"0\"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/><a:extLst><a:ext uri=\"{05A4C25C-085E-4340-85A3-A5531E510DB2}\"><thm15:themeFamily xmlns:thm15=\"http://schemas.microsoft.com/office/thememl/2012/main\" name=\"Office Theme\" id=\"{62F939B6-93AF-4DB8-9C6B-D6C7DFDC589F}\" vid=\"{4A3C46E8-61CC-4603-A589-7422A47A8E4A}\"/></a:ext></a:extLst></a:theme>";
const xlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const xlCol = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const xlSerial = d => { const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); return Math.round(t / 86400000) + 25569; };
const xlCrcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function xlCrc(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = xlCrcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function xlZip(files) {   // ZIP بدون ضغط (STORE)
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
    files.forEach(f => {
        const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = xlCrc(data);
        const lh = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
        parts.push(lh, name, data);
        cen.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), name);
        off += lh.length + name.length + data.length;
    });
    const cl = cen.reduce((s, x) => s + x.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), 0, 0]);
    return new Blob([...parts, ...cen, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
// sheet: { name, tab, zoom, freeze, defH, cols:[{w,hide}], head:[...], hdr:{sz,bold}, rows:[[cell]], table }
// cell: { v, f (معادلة), s: مفتاح التنسيق } أو قيمة بسيطة؛ التنسيق: { fmt, al:'center'|'', fill:true }
function xlBuild(sheet) {
    const strs = [], sIdx = new Map(), fmts = [], xfs = [], xfIdx = new Map();
    const sst = s => { if (!sIdx.has(s)) { sIdx.set(s, strs.length); strs.push(s); } return sIdx.get(s); };
    const fmtId = f => { if (!f) return 0; let i = fmts.indexOf(f); if (i < 0) { fmts.push(f); i = fmts.length - 1; } return 164 + i; };
    const xf = st => { st = st || {}; const k = JSON.stringify(st); if (!xfIdx.has(k)) { xfIdx.set(k, xfs.length); xfs.push(st); } return xfIdx.get(k); };
    xf({ al: 'center' });
    const nc = sheet.head.length;
    let x = '';
    const cellXml = (r, c, cell, hdrCell) => {
        const ref = xlCol(c) + r;
        if (cell == null || cell === '') { const s = hdrCell || (cell && cell.s); return hdrCell ? '<c r="' + ref + '" s="' + hdrCell + '"/>' : ''; }
        let o = cell; if (typeof cell !== 'object') o = { v: cell };
        const s = xf(o.s || {}), sa = ' s="' + s + '"';
        if (o.f != null) return '<c r="' + ref + '"' + sa + '><f>' + xlEsc(o.f) + '</f><v>' + (o.v == null || o.v === '' ? 0 : o.v) + '</v></c>';
        if (o.v == null || o.v === '') return '<c r="' + ref + '"' + sa + '/>';
        if (typeof o.v === 'number') return '<c r="' + ref + '"' + sa + '><v>' + o.v + '</v></c>';
        return '<c r="' + ref + '"' + sa + ' t="s"><v>' + sst(String(o.v)) + '</v></c>';
    };
    const hs = sheet.hdr || {};
    const rowsXml = [];
    // رأس الجدول
    rowsXml.push('<row r="1">' + sheet.head.map((h, c) => '<c r="' + xlCol(c) + '1" s="' + xf(Object.assign({ al: (sheet.hdrAl && sheet.hdrAl[c]) || 'center' }, hs)) + '" t="s"><v>' + sst(h) + '</v></c>').join('') + '</row>');
    sheet.rows.forEach((row, i) => { const r = i + 2; rowsXml.push('<row r="' + r + '">' + row.map((cell, c) => cellXml(r, c, cell)).join('') + '</row>'); });
    const last = sheet.rows.length + 1, ref = 'A1:' + xlCol(nc - 1) + last;
    // الأنماط
    const fonts = '<fonts count="3"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="14"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>';
    const fills = '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor theme="0"/><bgColor indexed="64"/></patternFill></fill></fills>';
    const xfXml = xfs.map(st => {
        const font = st.sz === 14 ? 1 : st.bold ? 2 : 0;
        return '<xf numFmtId="' + fmtId(st.fmt) + '" fontId="' + font + '" fillId="' + (st.fill ? 2 : 0) + '" borderId="0" xfId="0"' + (st.fmt ? ' applyNumberFormat="1"' : '') + ' applyFont="1"' + (st.fill ? ' applyFill="1"' : '') + ' applyAlignment="1"><alignment' + (st.al ? ' horizontal="' + st.al + '"' : '') + ' vertical="center"/></xf>';
    }).join('');
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + (fmts.length ? '<numFmts count="' + fmts.length + '">' + fmts.map((f, i) => '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + xlEsc(f) + '"/>').join('') + '</numFmts>' : '') + fonts + fills + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xfs.length + '">' + xfXml + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
    const cols = sheet.cols.map((c, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c.w + '"' + (c.hide ? ' hidden="1"' : '') + ' customWidth="1"/>').join('');
    const pane = sheet.freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : '';
    const sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="' + sheet.tab + '"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="' + ref + '"/><sheetViews><sheetView rightToLeft="1" tabSelected="1" zoomScale="' + sheet.zoom + '" zoomScaleNormal="' + sheet.zoom + '" workbookViewId="0">' + pane + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="' + sheet.defH + '"/><cols>' + cols + '</cols><sheetData>' + rowsXml.join('') + '</sheetData><pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" fitToHeight="0" orientation="landscape"/><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>';
    const tbl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="' + sheet.table + '" displayName="' + sheet.table + '" ref="' + ref + '" totalsRowShown="0"><autoFilter ref="' + ref + '"/><tableColumns count="' + nc + '">' + sheet.head.map((h, i) => '<tableColumn id="' + (i + 1) + '" name="' + xlEsc(h) + '"/>').join('') + '</tableColumns><tableStyleInfo name="TableStyleLight9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>';
    const sstXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + strs.length + '" uniqueCount="' + strs.length + '">' + strs.map(s => '<si><t xml:space="preserve">' + xlEsc(s) + '</t></si>').join('') + '</sst>';
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return xlZip([
        { name: '[Content_Types].xml', data: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>' },
        { name: '_rels/.rels', data: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
        { name: 'xl/workbook.xml', data: H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="' + R + '"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="' + xlEsc(sheet.name) + '" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
        { name: 'xl/_rels/workbook.xml.rels', data: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + R + '/styles" Target="styles.xml"/><Relationship Id="rId3" Type="' + R + '/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId4" Type="' + R + '/theme" Target="theme/theme1.xml"/></Relationships>' },
        { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
        { name: 'xl/worksheets/_rels/sheet1.xml.rels', data: H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + R + '/table" Target="../tables/table1.xml"/></Relationships>' },
        { name: 'xl/tables/table1.xml', data: tbl },
        { name: 'xl/styles.xml', data: styles },
        { name: 'xl/sharedStrings.xml', data: sstXml },
        { name: 'xl/theme/theme1.xml', data: XL_THEME }
    ]);
}
const XL_F = { iqd: '#,##0.00\\ [$IQD]', iqd0: '[$IQD]\\ #,##0', date: 'dd/mm/yyyy;@', mon: 'mmm-yy', int: '0' };
const xlDate = s => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(s || '')); return m ? xlSerial(new Date(+m[1], +m[2] - 1, +(m[3] || 1))) : ''; };
// بناء ملف Excel لقوائم وارد: mode='lists' (سطر لكل قائمة: ورقة «الطلبيات») أو 'items' (سطر لكل مادة: ورقة «قوائم المواد مفصلة»)
function puXlsxBuild(recs, mode) {
    const C = { al: 'center', fill: true }, n = v => parseFloat(v) || 0, F = f => Object.assign({ fmt: f }, C);
    // تُصدَّر فقط الأعمدة الموجودة بيانتها في التطبيق (بنفس ترتيب ملف الصيدلية وتنسيقه)
    if (mode === 'lists') {
        const head = ['تسلسل', 'ت', 'الكشف', 'المذخر', 'رقم القائمة', 'التاريخ', 'المبلغ بالعراقي', 'استرجاع بالعراقي', 'المبلغ الصافي بالعراقي'];
        const rows = recs.map((r, i) => {
            const t = r.cancelled ? 0 : puTotalOf(r), nt = r.cancelled ? 0 : puNetOf(r), rt = t - nt, rr = i + 2;
            const no = /^\d+$/.test(String(r.no || '')) ? parseInt(r.no) : String(r.no || '');
            return [{ v: n(r.seq) || i + 1, s: { al: 'center' } }, { v: i + 1, s: C }, { v: r.stmt ? '*' : '', s: C }, { v: r.supplier || '', s: C }, { v: no, s: F(XL_F.int) }, { v: xlDate(r.date), s: F(XL_F.date) },
                { v: t, s: F(XL_F.iqd) }, { v: rt, s: F(XL_F.iqd) }, { f: 'G' + rr + '-H' + rr, v: nt, s: F(XL_F.iqd) }];
        });
        const w = [5.27, 7.4, 7.13, 26.07, 16.66, 14.8, 20.86, 21.4, 21.4];
        return xlBuild({ name: 'الطلبيات', tab: 'FFFF0000', zoom: 70, freeze: true, defH: 18, cols: w.map((x, i) => ({ w: x, hide: i === 0 })), head, hdr: { sz: 14, bold: true }, rows, table: 'Table_Orders' });
    }
    const head = ['تسلسل', 'ت', 'المادة', 'الشركة', 'السعر بالعراقي', 'العدد', 'البونص', 'تاريخ النفاذ', 'المذخر', 'رقم القائمة', 'تاريخ القائمة', 'المجموع', 'ملاحظات'];
    const rows = []; let k = 0;
    recs.forEach(r => (r.items || []).forEach((it, j) => {
        k++; const rr = k + 1, p = products.find(x => x.id === it.pid), no = /^\d+$/.test(String(r.no || '')) ? parseInt(r.no) : String(r.no || '');
        const notes = [r.cancelled ? 'ملغاة' : '', it.batch ? 'دفعة ' + it.batch : ''].filter(Boolean).join(' | ');
        rows.push([{ v: k, s: { al: 'center' } }, { v: j + 1, s: { al: 'center' } }, { v: it.name || '', s: { fill: true } }, { v: (p && p.brand) || '', s: C }, { v: n(it.cost), s: F(XL_F.iqd) },
            { v: n(it.qty), s: C }, { v: it.bonus ? n(it.bonus) : '', s: C }, { v: xlDate(it.expiry), s: F(XL_F.mon) }, { v: r.supplier || '', s: C }, { v: no, s: F(XL_F.int) }, { v: xlDate(r.date), s: F(XL_F.date) },
            { f: 'F' + rr + '*E' + rr, v: n(it.qty) * n(it.cost), s: F(XL_F.iqd0) }, { v: notes, s: C }]);
    }));
    const w = [11.73, 7.13, 48.6, 30.66, 14.93, 8.33, 6.46, 11.73, 20.5, 16.7, 13.1, 14.7, 41.3];
    return xlBuild({ name: 'قوائم المواد مفصلة', tab: 'FFFFC000', zoom: 95, freeze: false, defH: 14.25, cols: w.map((x, i) => ({ w: x, hide: i === 0 })), head, hdr: {}, hdrAl: { 2: '' }, rows, table: 'Table_Items' });
}
// تصدير سجل المردود: ورقة «مسترجع الى المذاخر» (سطر لكل مادة) بنفس تنسيق ملف الصيدلية، مع الأعمدة الموجودة بيانتها في التطبيق فقط
function lgRetXlsxBuild(arr) {
    const C = { al: 'center', fill: true }, n = v => parseFloat(v) || 0, F = f => Object.assign({ fmt: f }, C);
    const head = ['ت', 'المادة', 'العدد', 'المبلغ الكلي بالعراقي', 'الكشف', 'المذخر', 'رقم القائمة', 'تاريخ القائمة', 'قائمة الاسترجاع', 'تاريخ قائمة الاسترجاع', 'ملاحظات'];
    const rows = []; let k = 0;
    const num = v => /^\d+$/.test(String(v || '')) ? parseInt(v) : String(v || '');
    arr.forEach(e => {
        const inv = e.listId ? puAll.find(x => x.id === e.listId) : null;
        const tail = [{ v: e.stmt ? '*' : '', s: C }, { v: e.supplier || '', s: C }, { v: num(e.listNo || (inv && inv.no) || ''), s: F(XL_F.int) }, { v: xlDate((inv && inv.date) || ''), s: F(XL_F.date) }, { v: num(e.cnNo), s: F(XL_F.int) }, { v: xlDate(e.cnDate), s: F(XL_F.date) }, { v: e.reason || '', s: { al: 'left', fill: true } }];
        const its = e.items || [];
        if (!its.length) { k++; rows.push([{ v: k, s: { al: 'center', fill: true } }, { v: '(مردود عام)', s: { al: 'left', fill: true } }, { v: '', s: F(XL_F.int) }, { v: n(e.amount), s: F(XL_F.iqd0) }, ...tail]); return; }
        its.forEach(l => { const q = parseInt(l.qty) || 0; k++; rows.push([{ v: k, s: { al: 'center', fill: true } }, { v: l.name || '', s: { al: 'left', fill: true } }, { v: q, s: F(XL_F.int) }, { v: q * n(l.cost), s: F(XL_F.iqd0) }, ...tail]); });
    });
    const w = [4.9, 63.9, 9.7, 21, 10.1, 22.2, 17.7, 19.8, 23.5, 17.1, 68.5];
    return xlBuild({ name: 'مسترجع الى المذاخر', tab: 'FF92D050', zoom: 70, freeze: false, defH: 14.25, cols: w.map(x => ({ w: x })), head, hdr: {}, rows, table: 'Table_Returns' });
}

async function puXlsxSave(recs, mode, fileBase) {
    const blob = puXlsxBuild(recs, mode), name = fileBase + '.xlsx';
    return downloadFile(name, blob, blob.type);
}
