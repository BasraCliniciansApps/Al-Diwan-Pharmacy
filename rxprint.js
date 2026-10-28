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
    const logo = (() => { try { return new URL('icon.jpg', location.href).href; } catch (e) { return 'icon.jpg'; } })();
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>وصفة ${rxEsc(rx.num)}</title>
<style>
@page { size: A5 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; background: #fff; }
body { font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f1c38; }
.pg { width: 148mm; min-height: 209mm; margin: 0 auto; padding: 9mm 9mm 8mm; position: relative; display: flex; flex-direction: column; }
.hd { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 2.5px solid #0f1c38; }
.hd img { width: 46px; height: 46px; border-radius: 11px; object-fit: cover; }
.hd .t { flex: 1; } .hd .t b { display: block; font-size: 19px; color: #0f1c38; line-height: 1.2; } .hd .t small { color: #64748b; font-size: 10.5px; font-weight: 600; }
.hd .m { text-align: left; font-size: 10.5px; color: #475569; line-height: 1.7; direction: ltr; } .hd .m b { color: #0f1c38; }
.ln { height: 3px; background: linear-gradient(90deg, #f9a825, #fcd34d 60%, transparent); margin-top: 2px; border-radius: 2px; }
.pt { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0 6px; }
.pt div { border: 1px solid #cbd5e1; border-radius: 9px; padding: 6px 10px; } .pt .w { grid-column: 1 / -1; }
.pt small { display: block; font-size: 9.5px; color: #64748b; font-weight: 700; } .pt b { font-size: 13.5px; }
.rx { font: 700 46px/1 'Times New Roman', Georgia, serif; color: #0f1c38; margin: 4px 2px 2px; display: flex; align-items: baseline; gap: 8px; }
.rx small { font: 700 11px 'Tajawal', sans-serif; color: #64748b; }
table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 4px; }
th { background: #0f1c38; color: #fff; font-weight: 700; padding: 6px 5px; font-size: 10.5px; text-align: right; }
th:first-child { border-radius: 0 7px 0 0; } th:last-child { border-radius: 7px 0 0 0; }
td { padding: 7px 5px; border-bottom: 1px dashed #cbd5e1; vertical-align: top; text-align: right; }
td.c { text-align: center; color: #64748b; width: 18px; } td.n b { font-size: 12.5px; } td.n small { display: block; font-size: 9px; color: #a85d08; font-weight: 700; }
.nt { margin-top: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 9px; padding: 7px 10px; font-size: 11px; line-height: 1.7; } .nt b { color: #475569; }
.sp { flex: 1; min-height: 14mm; }
.sg { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.sg div { height: 27mm; border: 1.5px dashed #94a3b8; border-radius: 11px; padding: 6px 10px; font-size: 10px; color: #64748b; font-weight: 700; }
.ft { margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9.5px; color: #94a3b8; }
@media screen { body { background: #e5e7eb; } .pg { background: #fff; margin: 12px auto; box-shadow: 0 4px 20px rgba(0,0,0,.15); } }
</style></head><body><div class="pg">
<div class="hd"><img src="${rxEsc(logo)}" alt=""><div class="t"><b>صيدلية الديوان</b><small>وصفة طبية إلكترونية</small></div>
<div class="m"><div><b>No.</b> ${rxEsc(rx.num)}</div><div>${rxDateTxt(rx.at)}</div></div></div><div class="ln"></div>
<div class="pt"><div><small>الطبيب</small><b dir="auto">${rxEsc(rx.doctor)}</b></div><div><small>المريض</small><b dir="auto">${rxEsc(rx.patient)}</b></div>${rx.dx ? `<div class="w"><small>التشخيص</small><b dir="auto">${rxEsc(rx.dx)}</b></div>` : ''}</div>
<div class="rx">℞<small>الأدوية الموصوفة</small></div>
<table><thead><tr><th></th><th>الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>التعليمات</th></tr></thead><tbody>${rows}</tbody></table>
${rx.note ? `<div class="nt"><b>ملاحظات: </b>${rxEsc(rx.note)}</div>` : ''}
<div class="sp"></div>
<div class="sg"><div>ختم الطبيب</div><div>توقيع الطبيب</div></div>
<div class="ft">صدرت إلكترونياً عبر صيدلية الديوان · ${rxEsc(rx.num)}</div>
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
    const im = d.querySelector('img');
    if (im && !im.complete) { im.onload = im.onerror = () => setTimeout(go, 100); setTimeout(go, 1500); } else setTimeout(go, 150);
}
