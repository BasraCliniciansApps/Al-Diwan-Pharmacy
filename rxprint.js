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
.pg { width: 105mm; margin: 0 auto; padding: 6mm 6mm 5mm; position: relative; display: flex; flex-direction: column; }
.hd { position: relative; text-align: center; padding: 2mm 0 8px; border-bottom: 2.5px solid #0f1c38; }
.hd .dr { font-family: 'Aref Ruqaa', 'Tajawal', serif; font-weight: 700; color: #0f1c38; line-height: 1.25; } .hd .dr .t1 { font-size: 17px; } .hd .dr .t2 { font-size: 27px; margin-top: 2px; overflow-wrap: anywhere; }
.hd img { width: 46px; height: 46px; border-radius: 11px; object-fit: cover; }
.hd .t { flex: 1; } .hd .t b { display: block; font-size: 19px; color: #0f1c38; line-height: 1.2; } .hd .t small { color: #64748b; font-size: 10.5px; font-weight: 600; }
.hd .m { position: absolute; left: 0; top: 0; text-align: left; font-size: 10.5px; color: #475569; line-height: 1.7; direction: ltr; } .hd .m b { color: #0f1c38; }
.ln { height: 3px; background: linear-gradient(90deg, #f9a825, #fcd34d 60%, transparent); margin-top: 2px; border-radius: 2px; }
.pt { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0 6px; }
.pt div { border: 1px solid #cbd5e1; border-radius: 9px; padding: 6px 10px; } .pt .w { grid-column: 1 / -1; }
.pt small { display: block; font-size: 9.5px; color: #64748b; font-weight: 700; } .pt b { font-size: 12px; }
.rx { font: 700 36px/1 'Times New Roman', Georgia, serif; color: #0f1c38; margin: 4px 2px 2px; direction: ltr; display: flex; align-items: baseline; gap: 8px; }
.rx small { font: 700 11px 'Tajawal', sans-serif; color: #64748b; }
table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-top: 4px; }
th { background: #0f1c38; color: #fff; font-weight: 700; padding: 5px 3px; font-size: 8.5px; text-align: right; }
th:first-child { border-radius: 0 7px 0 0; } th:last-child { border-radius: 7px 0 0 0; }
td { padding: 5px 3px; border-bottom: 1px dashed #cbd5e1; vertical-align: top; text-align: right; }
td.c { text-align: center; color: #64748b; width: 18px; } td.n b { font-size: 10.5px; } td.n small { display: block; font-size: 9px; color: #a85d08; font-weight: 700; }
.nt { margin-top: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 9px; padding: 7px 10px; font-size: 11px; line-height: 1.7; } .nt b { color: #475569; }
.sp { flex: 1; min-height: 14mm; }
.sg { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.sg div { height: 27mm; border: 1.5px dashed #94a3b8; border-radius: 11px; padding: 6px 10px; font-size: 10px; color: #64748b; font-weight: 700; }
.ft { margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9.5px; color: #94a3b8; }
@media screen { body { background: #e5e7eb; } .pg { background: #fff; margin: 12px auto; box-shadow: 0 4px 20px rgba(0,0,0,.15); } }
</style></head><body><div class="pg">
<div class="hd"><div class="m"><div><b>No.</b> ${rxEsc(rx.num)}</div><div>${rxDateTxt(rx.at)}</div></div><div class="dr"><div class="t1">الدكتور</div><div class="t2" dir="auto">${rxEsc(String(rx.doctor || '').replace(/^\s*د\.?\s*/, ''))}</div></div></div><div class="ln"></div>
<div class="pt"><div class="w"><small>المريض</small><b dir="auto">${rxEsc(rx.patient)}</b>${rx.phone ? `<small style="margin-top:2px;direction:ltr">${rxEsc(rx.phone)}</small>` : ''}</div>${rx.dx ? `<div class="w"><small>التشخيص</small><b dir="auto">${rxEsc(rx.dx)}</b></div>` : ''}</div>
<div class="rx">℞</div>
<table><thead><tr><th></th><th>الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>التعليمات</th></tr></thead><tbody>${rows}</tbody></table>
${rx.note ? `<div class="nt"><b>ملاحظات: </b>${rxEsc(rx.note)}</div>` : ''}
</div></body></html>`;
}
// طباعة عبر إطار مخفي (يعمل على الهاتف والحاسوب)
function rxPrintNow(rx) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    const d = f.contentWindow.document; d.open(); d.write(rxPrintDoc(rx)); d.close();
    let fired = false;
    const go = () => { if (fired) return; fired = true; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* تجاهل */ } setTimeout(() => f.remove(), 60000); };
    try { const fr = d.fonts && d.fonts.load ? d.fonts.load('700 30px "Aref Ruqaa"', 'الدكتور') : null; if (fr) { Promise.race([fr, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(go, 150), () => setTimeout(go, 150)); setTimeout(go, 3200); } else setTimeout(go, 150); } catch (e) { setTimeout(go, 150); }
}

// ---------- تشفير سجل الطبيب للاسترجاع (AES-GCM بمفتاح مشتق من رمز من 6 أرقام) ----------
const rxB64 = u8 => btoa(String.fromCharCode.apply(null, Array.from(u8)));
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
