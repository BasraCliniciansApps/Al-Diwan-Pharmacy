// ============================================================================
// حماية المخزون عند البيع (للمواد المجرودة فقط):
// ١) المنع: لا يُسمح بإضافة كمية أكبر من المتوفر، فتتوقف الكمية عند المتوفر.
// ٢) التجاوز: المدير، ومن مُنح صلاحية «تجاوز المخزون»، يتجاوز بتأكيد عند الإصدار، ويُسجَّل التجاوز.
// ٣) التنبيه: عند بقاء عدد قليل (الافتراضي 2 فأقل) بعد البيع يظهر تنبيه نفاد.
// المواد غير المجرودة لا تُمنع لأن كمياتها غير موثوقة (يبقى لها التحذير القديم).
// ============================================================================
const SG_ON = 'diwanSgOn', SG_AL = 'diwanSgAlert', SG_LOG = 'diwanSgLog';
const sgOn = () => { try { return localStorage.getItem(SG_ON) !== '0'; } catch (e) { return true; } };
const sgAlertAt = () => { let n = NaN; try { n = parseInt(localStorage.getItem(SG_AL)); } catch (e) { /* تجاهل */ } return isNaN(n) || n < 0 ? 2 : n; };
const sgCanOver = () => userRole === 'owner' || (typeof can === 'function' && can('overSell'));
const sgGuarded = p => !!p && sgOn() && p.counted === true;
const sgBlock = p => sgGuarded(p) && !sgCanOver();
const sgEsc = s => escapeHtml(String(s == null ? '' : s));

function sgToast(title, icon, ms) { Swal.fire({ icon: icon || 'warning', title, toast: true, position: 'top', showConfirmButton: false, timer: ms || 2400 }); }
function sgClampNote(p, n) { sgToast('المتوفر ' + stockLabel(p) + ' فقط، لا يمكن إضافة المزيد' + (n ? ' (نقص ' + fmtNum(n) + ')' : ''), 'warning', 2600); }

// تنبيه قرب النفاد بعد إضافة المادة للفاتورة؛ يرجع true إن ظهر التنبيه
function sgLowNote(pid) {
    try {
        const p = products.find(x => x.id === pid); if (!sgGuarded(p) || typeof billPlan !== 'function' || !bill || bill.deduct === false) return false;
        const e = billPlan().find(x => x.p.id === pid); if (!e) return false;
        const sc = hasRetail(p) ? subCountOf(p) : 1, rem = (e.to.qty || 0) + (e.to.loose || 0) / sc;
        if (rem > sgAlertAt()) return false;
        sgToast(rem <= 0 ? 'تنبيه: ستنفد هذه المادة بعد هذه الفاتورة' : 'تنبيه: يتبقى ' + stockTxt(p, e.to) + ' فقط من هذه المادة', 'warning', 3000);
        return true;
    } catch (err) { return false; }
}

function sgReq(p) {
    let a = 0, b = 0;
    ((typeof bill !== 'undefined' && bill && bill.items) || []).forEach(it => { if (it.pid !== p.id) return; const n = parseFloat(it.qty) || 0; (it.unit === 'part' && hasRetail(p)) ? b += n : a += n; });
    return [a ? fmtNum(a) + ' علبة' : '', b ? fmtNum(b) + ' ' + (subTypeOf(p) || 'جزء') : ''].filter(Boolean).join(' + ');
}
function sgLog() { try { return JSON.parse(lsGet(SG_LOG)) || []; } catch (e) { return []; } }
function sgLogAdd(g) {
    try {
        const a = sgLog(); a.unshift({ at: new Date().toISOString(), user: (typeof userName === 'string' && userName) || (userRole === 'owner' ? 'المدير' : ''), bill: (typeof bill !== 'undefined' && bill && bill.no) || '', items: g.map(e => ({ name: dispName(e.p), need: sgReq(e.p), avail: stockLabel(e.p) })) });
        lsSet(SG_LOG, JSON.stringify(a.slice(0, 200)));
    } catch (e) { /* تجاهل */ }
}

// البوابة الأخيرة عند الإصدار أو حفظ التعديل: true = أكمل، false = أوقف
async function sgGate(short) {
    const g = (short || []).filter(e => sgGuarded(e.p)); if (!g.length) return true;
    const list = g.map(e => `<div dir="rtl" style="margin:6px 0"><b dir="ltr">${sgEsc(dispName(e.p))}</b><br><small>المطلوب ${sgEsc(sgReq(e.p))} • المتوفر ${sgEsc(stockLabel(e.p))}</small></div>`).join('');
    if (!sgCanOver()) {
        await Swal.fire({ icon: 'error', title: 'لا يمكن البيع فوق المتوفر', html: list + '<small>خفّض الكمية إلى المتوفر، أو اطلب من المدير.</small>', confirmButtonText: 'حسناً', confirmButtonColor: '#0f1c38' });
        return false;
    }
    const r = await Swal.fire({ icon: 'warning', title: 'تجاوز المخزون', html: 'الكميات التالية أكبر من المتوفر بعد الجرد:' + list + '<small>سيصبح رصيدها 0 ويُسجَّل التجاوز.</small>', showCancelButton: true, confirmButtonText: 'تجاوز وإصدار', cancelButtonText: 'إلغاء', confirmButtonColor: '#b91c1c', reverseButtons: true });
    if (!r.isConfirmed) return false;
    sgLogAdd(g); return true;
}

// ---------- الإعدادات ----------
function sgSetOn(v) { try { localStorage.setItem(SG_ON, v ? '1' : '0'); } catch (e) { /* تجاهل */ } Swal.fire({ icon: 'success', title: v ? 'فُعّل منع البيع فوق المتوفر' : 'أُوقف منع البيع فوق المتوفر', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 }); }
function sgSetAlert(v) {
    const n = parseInt(v);
    if (isNaN(n) || n < 0) { Swal.fire({ icon: 'warning', title: 'أدخل رقماً صحيحاً (0 أو أكثر)', confirmButtonColor: '#0f1c38', confirmButtonText: 'حسناً' }); sgInitUi(); return; }
    try { localStorage.setItem(SG_AL, String(n)); } catch (e) { /* تجاهل */ }
    Swal.fire({ icon: 'success', title: 'تم حفظ حد تنبيه النفاد', toast: true, position: 'bottom', showConfirmButton: false, timer: 1600 });
}
function sgInitUi() { const a = document.getElementById('sgOnInput'), b = document.getElementById('sgAlertInput'); if (a) a.checked = sgOn(); if (b) b.value = sgAlertAt(); }
function sgLogOpen() {
    const a = sgLog();
    Swal.fire({ title: 'سجل التجاوزات', confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38', html: a.length ? `<div dir="rtl" style="text-align:right;max-height:55vh;overflow:auto">${a.slice(0, 50).map(x => `<div style="border-bottom:1px solid #e2e8f0;padding:8px 0"><small>${sgEsc(fmtDateDMY(String(x.at).slice(0, 10)))} • ${sgEsc(x.user || '—')}${x.bill ? ' • فاتورة ' + sgEsc(x.bill) : ''}</small>${(x.items || []).map(i => `<div><b dir="ltr">${sgEsc(i.name)}</b><br><small>المطلوب ${sgEsc(i.need)} • كان المتوفر ${sgEsc(i.avail)}</small></div>`).join('')}</div>`).join('')}</div><small>أعد جرد هذه المواد لتصحيح أرصدتها.</small>` : 'لا توجد تجاوزات مسجلة.' });
}
setTimeout(sgInitUi, 1200);
