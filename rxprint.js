// =====================================================================
// قالب طباعة الوصفة الإلكترونية (مشترك بين صفحة الطبيب وصفحة الإدارة).
// rx = { num, doctor, patient, items:[{n, ext, dose, freq, dur, ins}], note, at }
// =====================================================================
function rxEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rxDateTxt(t) {
    const d = new Date(t || Date.now());
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}
function rxPrintDoc(rx) {
    const rows = (rx.items || []).map((it, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="n" dir="auto"><b>${rxEsc(it.n)}</b>${it.ext ? '<small>خارج الصيدلية</small>' : ''}</td>
        <td>${rxEsc(it.dose)}</td><td>${rxEsc(it.freq)}</td><td>${rxEsc(it.dur)}</td><td>${rxEsc(it.ins)}</td></tr>`).join('');
    const font = (() => { try { return new URL('fonts/ArefRuqaa-Bold.ttf', location.href).href; } catch (e) { return 'fonts/ArefRuqaa-Bold.ttf'; } })();
    const logo = (() => { try { return new URL('icon.jpg', location.href).href; } catch (e) { return 'icon.jpg'; } })();
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>وصفة ${rxEsc(rx.num)}</title>
<style>
@font-face { font-family: 'Aref Ruqaa'; font-weight: 700; src: url('${rxEsc(font)}') format('truetype'); }
@page { size: A6 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f1c38; }
.pg { width: 105mm; height: 148mm; margin: 0 auto; padding: 5mm 6mm 4mm; position: relative; overflow: hidden; }
.bd { height: 100%; display: flex; flex-direction: column; }
.hd { position: relative; text-align: center; padding: 1mm 0 6px; border-bottom: 2.5px solid #0f1c38; }
.hd .dr { font-family: 'Aref Ruqaa', 'Tajawal', serif; font-weight: 700; color: #0f1c38; line-height: 1.2; } .hd .dr .t1 { font-size: 16px; } .hd .dr .t3 { font-size: 9.5px; font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; font-weight: 600; color: #475569; margin-top: 2px; line-height: 1.5; }
.hd .dr .t4 { font-size: 10.5px; font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; font-weight: 800; color: #0f1c38; margin-top: 1px; direction: ltr; unicode-bidi: plaintext; }
.hd .dr .t2 { font-size: 26px; margin-top: 1px; overflow-wrap: anywhere; }
.hd .m { position: absolute; left: 0; top: 0; text-align: left; font-size: 10px; color: #475569; line-height: 1.6; direction: ltr; } .hd .m b { color: #0f1c38; }
.ln { height: 3px; background: linear-gradient(90deg, #f9a825, #fcd34d 60%, transparent); margin-top: 2px; border-radius: 2px; }
.pt { margin: 7px 0 2px; }
.rw { display: flex; align-items: baseline; gap: 6px; padding: 3px 2px 2px; border-bottom: 1px dotted #94a3b8; min-height: 18px; }
.rw span { font-size: 10px; font-weight: 800; color: #64748b; white-space: nowrap; } .rw b { font-size: 12px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.rw.ph { width: 62%; margin-right: auto; } .rw.ph b { direction: ltr; text-align: left; unicode-bidi: plaintext; }
.rx { font: 700 32px/1 'Times New Roman', Georgia, serif; color: #0f1c38; margin: 6px 2px 0; direction: ltr; padding-bottom: 3px; border-bottom: 1.5px solid #0f1c38; }
table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-top: 5px; }
th { background: #0f1c38; color: #fff; font-weight: 700; padding: 4px 3px; font-size: 8.5px; text-align: right; }
th:first-child { border-radius: 0 7px 0 0; } th:last-child { border-radius: 7px 0 0 0; }
td { padding: 3px 3px; border-bottom: 1px dashed #cbd5e1; vertical-align: top; text-align: right; }
td.c { text-align: center; color: #64748b; width: 18px; } td.n b { font-size: 10.5px; } td.n small { display: block; font-size: 9px; color: #a85d08; font-weight: 700; }
.nt { margin-top: 6px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 9px; padding: 5px 9px; font-size: 10.5px; line-height: 1.55; } .nt b { color: #475569; }
.sp { flex: 1; min-height: 2mm; }
.sg { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
.sg div { height: 22mm; border: 1.5px dashed #94a3b8; border-radius: 11px; padding: 5px 9px; font-size: 9.5px; color: #64748b; font-weight: 700; position: relative; overflow: hidden; }
.sg div img { position: absolute; inset: 14px 6px 4px; width: calc(100% - 12px); height: calc(100% - 18px); object-fit: contain; }
@media screen { body { background: #e5e7eb; } .pg { background: #fff; margin: 12px auto; box-shadow: 0 4px 20px rgba(0,0,0,.15); } }
</style></head><body><div class="pg"><div class="bd">
<div class="hd"><div class="m"><div><b>No.</b> ${rxEsc(rx.num)}</div><div>${rxDateTxt(rx.at)}</div></div><div class="dr"><div class="t1">الدكتور</div><div class="t2" dir="auto">${rxEsc(String(rx.doctor || '').replace(/^\s*د\.?\s*/, ''))}</div>${(() => { const c = rx.clinic || {}, l = [c.s, c.a].filter(x => x && String(x).trim()); return (l.length ? `<div class="t3" dir="auto">${l.map(x => rxEsc(x)).join(' · ')}</div>` : '') + (c.p && String(c.p).trim() ? `<div class="t4">☎ ${rxEsc(c.p)}</div>` : ''); })()}</div></div><div class="ln"></div>
<div class="pt"><div class="rw ph"><span>رقم الهاتف:</span><b>${rxEsc(rx.phone || '')}</b></div><div class="rw"><span>اسم المريض:</span><b dir="auto">${rxEsc(rx.patient)}</b></div><div class="rw"><span>التشخيص:</span><b dir="auto">${rxEsc(rx.dx || '')}</b></div></div>
<div class="rx">℞</div>
<table><thead><tr><th></th><th>الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>التعليمات</th></tr></thead><tbody>${rows}</tbody></table>
${rx.note ? `<div class="nt"><b>ملاحظات: </b>${rxEsc(rx.note)}</div>` : ''}
<div class="sp"></div>
<div class="sg"><div>توقيع الطبيب${(rx.clinic || {}).sg ? `<img src="${rxEsc(rx.clinic.sg)}" alt="">` : ''}</div><div>ختم الطبيب${(rx.clinic || {}).st ? `<img src="${rxEsc(rx.clinic.st)}" alt="">` : ''}</div></div>
</div></div></body></html>`;
}
// يضغط المحتوى تلقائياً ليبقى الوصفة في ورقة واحدة
function rxFit(d) {
    try { const bd = d.querySelector('.bd'); if (!bd) return; let z = 1; bd.style.zoom = 1; while (bd.scrollHeight > bd.clientHeight + 1 && z > 0.45) { z -= 0.03; bd.style.zoom = z.toFixed(2); } } catch (e) { /* تجاهل */ }
}
// طباعة عبر إطار مخفي (يعمل على الهاتف والحاسوب)
function rxPrintNow(rx) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(rxPrintDoc(rx)); d.close();
    let fired = false;
    const go = () => { if (fired) return; fired = true; rxFit(d); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* تجاهل */ } setTimeout(() => f.remove(), 60000); };
    try { const fr = d.fonts && d.fonts.load ? d.fonts.load('700 30px "Aref Ruqaa"', 'الدكتور') : null; if (fr) { Promise.race([fr, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(go, 150), () => setTimeout(go, 150)); setTimeout(go, 3200); } else setTimeout(go, 150); } catch (e) { setTimeout(go, 150); }
}

// ---------- تشفير سجل الطبيب للاسترجاع (AES-GCM بمفتاح مشتق من رمز من 6 أرقام) ----------
const rxB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 8192))); return btoa(s); };
const rxUnB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function rxKey(code, salt) {
    const enc = new TextEncoder(), base = await crypto.subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('diwan-rx:' + salt), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function rxEncrypt(code, salt, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12)), key = await rxKey(code, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    return { iv: rxB64(iv), data: rxB64(new Uint8Array(ct)) };
}
async function rxDecrypt(code, salt, iv, data) {
    const key = await rxKey(code, salt), pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rxUnB64(iv) }, key, rxUnB64(data));
    return JSON.parse(new TextDecoder().decode(pt));
}

// ---------- إرسال الوصفة كملف PDF عبر واتساب ----------
const RX_WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
function rxWaNum(p) {
    let d = String(p || '').replace(/[^\d+]/g, '').replace(/^\+/, ''); d = d.replace(/[٠-٩]/g, c => c.charCodeAt(0) - 1632);
    if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '964' + d.slice(1);
    return d.replace(/\D/g, '');
}
async function rxPdfBlob(rx) {
    const W = 397;
    let html = rxPrintDoc(rx);
    try {
        const buf = await (await fetch('fonts/ArefRuqaa-Bold.ttf')).arrayBuffer();
        html = html.replace(/url\('[^']*ArefRuqaa-Bold\.ttf'\)/, "url('data:font/ttf;base64," + rxB64(new Uint8Array(buf)) + "')");
    } catch (e) { /* تجاهل */ }
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + W + 'px;height:600px;border:0;visibility:hidden';
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(html); d.close();
    try { await Promise.race([d.fonts.load('700 30px "Aref Ruqaa"', 'الدكتور'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* تجاهل */ }
    await new Promise(r => setTimeout(r, 150)); rxFit(d);
    const pg = d.querySelector('.pg'), H = 559;
    const css = d.querySelector('style').textContent.replace(/@page[^}]*}/, '') + ' .pg { margin: 0 !important; box-shadow: none !important; } .wrap { background: #fff; font-family: Tajawal, "Segoe UI", Tahoma, Arial, sans-serif; color: #0f1c38; direction: rtl; }';
    const inner = new XMLSerializer().serializeToString(pg);
    f.remove();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="wrap" dir="rtl"><style>' + css.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</style>' + inner + '</div></foreignObject></svg>';
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const S = 3, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    const jpg = new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer());
    const pw = (W * 0.75).toFixed(2), ph = (H * 0.75).toFixed(2), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
    const obj = (n, body, stream) => { offs[n] = len; put(n + ' 0 obj\n' + body); if (stream) { put('\nstream\n'); put(stream); put('\nendstream'); } put('\nendobj\n'); };
    put('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    obj(4, '<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>', jpg);
    const cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q'; obj(5, '<< /Length ' + cs.length + ' >>', cs);
    const xr = len; put('xref\n0 6\n0000000000 65535 f \n'); for (let i = 1; i <= 5; i++) put(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    put('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
}
async function rxShareWa(rx, say) {
    say = say || (window.toast ? window.toast : () => { });
    const num = rxWaNum(rx.phone); if (!num) { say('لا يوجد رقم هاتف للمريض'); return; }
    const h = typeof Prog !== 'undefined' ? Prog.start('تجهيز الوصفة PDF', { text: 'إنشاء الملف...' }) : null;
    let blob; try { blob = await rxPdfBlob(rx); } catch (e) { if (h) h.fail('تعذر تجهيز الملف', 'حاول مرة أخرى.'); else say('تعذر تجهيز الملف'); return; }
    if (h) h.ok('الملف جاهز'); else say('جاري تجهيز ملف PDF...');
    const name = (rx.num || 'rx') + '.pdf', file = new File([blob], name, { type: 'application/pdf' });
    const txt = 'وصفتك الطبية' + (rx.patient ? ' (' + rx.patient + ')' : '');
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { say('اختر واتساب ثم المريض (' + rx.phone + ')'); await navigator.share({ files: [file], title: 'وصفة طبية', text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    say('نُزِّل الملف، أرفقه في محادثة المريض'); setTimeout(() => { try { window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(txt), '_blank'); } catch (e) { /* تجاهل */ } }, 600);
}
