// حاسبة الأسعار (تسعيرة نقابة الصيادلة) — تعتمد نفس إعدادات التسعير ودالة syndCalc المستخدمة في المواد.
function pcOpen() {
    const html = `<div class="pc-box" dir="rtl">
        <label class="pc-l">سعر الشراء (د.ع)</label>
        <input id="pcCost" class="swal2-input pc-in" type="text" inputmode="decimal" autocomplete="off" placeholder="أدخل سعر الشراء">
        <div id="pcOut" class="pc-out"><span class="pc-hint">أدخل سعر الشراء ليظهر سعر البيع.</span></div>
        <div class="pc-src">${escapeHtml(syndBookText())} · سعر الصرف ${fmtNum(pricingCfg.rate)}</div></div>`;
    Swal.fire({
        title: '🧮 حاسبة الأسعار', html, showConfirmButton: false, showCloseButton: true, focusConfirm: false,
        didOpen: () => {
            const inp = document.getElementById('pcCost'), out = document.getElementById('pcOut');
            const toNum = s => Number(String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,\s،]/g, '')) || 0;
            const run = () => {
                const c = toNum(inp.value), r = syndCalc(c);
                if (!r) { out.innerHTML = '<span class="pc-hint">أدخل سعر الشراء ليظهر سعر البيع.</span>'; return; }
                out.innerHTML = `<div class="pc-price"><small>سعر البيع</small><b>${fmtNum(r.price)}</b><small>د.ع</small></div>
                    <div class="pc-rows"><div><span>المعادل بالدولار</span><b>${(Math.round(r.usd * 100) / 100).toLocaleString('en-US')} $</b></div>
                    <div><span>نسبة الشريحة</span><b>${r.pct}%</b></div>
                    <div><span>الربح</span><b>${fmtNum(r.price - c)} د.ع</b></div></div>`;
            };
            inp.addEventListener('input', run); setTimeout(() => inp.focus(), 80);
        }
    });
}
