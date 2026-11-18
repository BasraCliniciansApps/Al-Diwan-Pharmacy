// ============================================================================
// المواد الراكدة (تنبيهات): مادة لها مخزون ولم تُبع خلال المدة (الافتراضية 90 يوماً).
// آخر بيع لكل مادة يُحسب من الفواتير؛ ولتوفير قراءات السحابة تُحمَّل مبيعات المدة مرة كل 7 أيام فقط
// (عند اختيار «راكدة» بالتنبيهات) وتُحفظ محلياً، وبينها تُضاف الفواتير الحديثة الموجودة على الجهاز.
// ============================================================================
const DEAD_LS = 'diwanDeadSold';
let deadMemo = null, deadBusy = false;
const deadDays = () => { const n = parseInt(lsGet('diwanDeadDays')); return n > 0 ? n : 90; };
const deadIso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const deadAgo = iso => Math.max(0, Math.round((new Date(todayLocalISO() + 'T00:00:00') - new Date(String(iso).slice(0, 10) + 'T00:00:00')) / 864e5));
function deadStore() { try { return JSON.parse(lsGet(DEAD_LS)) || null; } catch (e) { return null; } }
function deadReady() { const s = deadStore(); return !!(s && s.days === deadDays() && s.at && deadAgo(s.at) < 7); }
function deadReset() { deadMemo = null; }
function deadScan() {
    const m = {};
    (billAll || []).forEach(b => { if (!b || !b.issued || b.cancelled) return; (b.items || []).forEach(it => { if (it.pid && (!m[it.pid] || String(b.date) > m[it.pid])) m[it.pid] = String(b.date); }); });
    return m;
}
function deadMap() {
    if (deadMemo) return deadMemo;
    const s = deadStore(), m = Object.assign({}, (s && s.map) || {}), n = deadScan();
    Object.keys(n).forEach(k => { if (!m[k] || n[k] > m[k]) m[k] = n[k]; });
    return (deadMemo = m);
}
function deadOf(p) {   // يرجع false أو عدد الأيام منذ آخر بيع (أو 99999 إن لم يُبع قط ضمن المدة)
    if (!deadReady() || p.arch) return false;
    if (!((parseInt(p.qty) || 0) > 0 || (parseInt(p.loose) || 0) > 0)) return false;
    const D = deadDays(), last = deadMap()[p.id];
    if (last && deadAgo(last) < D) return false;
    const lp = p.lastPurchase && p.lastPurchase.date; if (lp && deadAgo(lp) < D) return false;   // وصلت حديثاً
    return last ? deadAgo(last) : 99999;
}
async function deadEnsure() {
    if (deadBusy) return; deadBusy = true;
    const h = Prog.start('تحميل مبيعات الفترة', { text: 'لتحديد المواد الراكدة...' });
    try {
        const D = deadDays(), from = deadIso(new Date(Date.now() - D * 864e5));
        await invEnsureSince(from);
        lsSet(DEAD_LS, JSON.stringify({ at: todayLocalISO(), days: D, map: deadScan() })); deadReset();
        h.ok('تم');
    } catch (e) { h.fail('تعذر تحميل المبيعات', e.message || String(e)); }
    deadBusy = false; if (typeof renderAlerts === 'function' && currentView === 'alerts') renderAlerts();
}
