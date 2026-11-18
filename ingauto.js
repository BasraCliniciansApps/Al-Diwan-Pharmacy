// ============================================================================
// تعبئة المادة الفعالة تلقائياً من اسم المادة: تُستخرج فقط من آخر قوسين في الاسم
// مثل «Diflurok 150mg Capsule (Fluconazole 150mg)» ← Fluconazole. لا تخمين: ما لا يُقبل يبقى فارغاً.
// تُعبّأ الحقول الفارغة داخل نافذة «إكمال المواد الفعالة» للمراجعة، ولا يُحفظ شيء قبل ضغط «حفظ».
// ============================================================================
const ING_NOT = /\b(spf|oil|free|dry|touch|matte|fluide|invisible|cream|gel|lotion|tablets?|capsules?|syrup|drops?|spray|sachets?|vial|box|new|forte|plus|junior|kids?|adult|extra|mini|stick|bar|wash|shampoo|serum|foam|mask|ointment|suspension|solution|injection|ampoule|patch|pack|set|sunblock|sunscreen|moisturi[sz]er|cleanser|toner|vitamin)\b/i;
const ING_STR = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|iu|%|units?)(?:\s*\/\s*\d*(?:[.,]\d+)?\s*(?:ml|g|mg|dose|l))?/gi;
function ingExtract(name, known) {
    const m = String(name || '').match(/\(([^()]+)\)/g); if (!m) return '';
    const c = m[m.length - 1].slice(1, -1).trim();
    if (!/[A-Za-z]{3}/.test(c) || /[؀-ۿ]/.test(c) || c.length > 90) return '';
    const hadStr = ING_STR.test(c); ING_STR.lastIndex = 0;
    const r = c.replace(ING_STR, ' ').replace(/\s+/g, ' ').replace(/^[\s+,\/&-]+|[\s+,\/&-]+$/g, '').trim();
    if (r.length < 3 || ING_NOT.test(r)) return '';
    const parts = r.split(/\s*[+,\/&]\s*/).filter(Boolean);
    if (!parts.length || parts.some(s => !/^[A-Za-z][A-Za-z '\-]{2,}$/.test(s))) return '';
    if (!hadStr && !known.has(ingredientKey(r))) return '';   // بلا تركيز ولا مادة معروفة عندك: غير موثوق
    return parts.map(s => /[a-z]/.test(s) && /[A-Z]/.test(s.slice(1)) ? s : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' + ');
}
function ingAutoFill() {
    const known = new Set(products.map(p => ingredientKey(p.activeIngredient)).filter(Boolean));
    let n = 0, left = 0;
    document.querySelectorAll('#ingListContainer .ing-input').forEach(inp => {
        if (inp.value.trim()) return;
        const p = products.find(x => x.id === parseInt(inp.dataset.id)); if (!p) return;
        const v = ingExtract(p.name, known);
        if (v) { inp.value = v; inp.classList.add('ing-auto'); n++; } else left++;
    });
    const s = document.getElementById('ingSummary');
    if (s) s.innerText = n ? `تمت تعبئة ${n} صنف من أسمائها (باقي ${left} بلا مادة فعالة بالاسم). راجع الحقول الملوّنة ثم احفظ.` : 'لم يُعثر على مادة فعالة موثوقة في أسماء الأصناف المتبقية.';
}
