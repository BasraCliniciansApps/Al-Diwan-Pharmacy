// ============================================================================
// اقتراح الطلب الذكي: الكمية المقترحة = (معدل البيع اليومي × أيام التغطية) − المتوفر.
// معدل البيع من فواتير آخر N أسبوع (علبة؛ والأجزاء تُحسب كسراً من العلبة).
// ============================================================================
const SPO_LS = 'diwanPoSmart';
let spoLoadedKey = '', spoBusy = false;
function spoCfg() { let c = {}; try { c = JSON.parse(lsGet(SPO_LS)) || {}; } catch (e) { c = {}; } return { on: c.on !== false, weeks: [2, 4, 8, 12].includes(c.weeks) ? c.weeks : 4, cover: [7, 14, 21, 30].includes(c.cover) ? c.cover : 14 }; }
function spoSave(c) { lsSet(SPO_LS, JSON.stringify(c)); }
function spoFrom(c) { const d = new Date(Date.now() - c.weeks * 7 * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function spoSold(c) {   // pid → علب مباعة خلال الفترة
    const from = spoFrom(c), m = new Map();
    (billAll || []).filter(b => b && b.issued && !b.cancelled && String(b.date) >= from).forEach(b => (b.items || []).forEach(it => {
        if (!it.pid) return; const p = products.find(x => x.id === it.pid), q = parseFloat(it.qty) || 0; if (!(q > 0)) return;
        const boxes = it.unit === 'part' && p && hasRetail(p) ? q / subCountOf(p) : q; m.set(it.pid, (m.get(it.pid) || 0) + boxes);
    }));
    return m;
}
function spoInfo(p, sold, c) {
    const days = c.weeks * 7, rate = (sold.get(p.id) || 0) / days, sc = subCountOf(p);
    const stock = (parseInt(p.qty) || 0) + (sc ? (parseInt(p.loose) || 0) / sc : 0);
    const left = rate > 0 ? stock / rate : null, sug = rate > 0 ? Math.max(0, Math.ceil(rate * c.cover - stock - 1e-9)) : 0;
    return { rate, stock, left, sug };
}
(function () {
    const baseCands = poCandidates;
    poCandidates = function () {
        const c = spoCfg(), base = baseCands(); if (!c.on) return base;
        const sold = spoSold(c), seen = new Set(base.map(p => p.id)), extra = [];
        products.forEach(p => { if (p.arch || seen.has(p.id)) return; const i = spoInfo(p, sold, c); if (i.sug > 0 && i.left !== null && i.left < c.cover) extra.push(p); });
        const all = base.concat(extra), key = p => { const i = spoInfo(p, sold, c); return i.left === null ? 1e9 : i.left; };
        return all.sort((a, b) => key(a) - key(b) || (parseInt(a.qty) || 0) - (parseInt(b.qty) || 0));
    };
    const baseRender = renderPO;
    renderPO = function () {
        const c = spoCfg();
        if (c.on) { const sold = spoSold(c); poCandidates().forEach(p => { if (!poState[p.id]) { const i = spoInfo(p, sold, c); poState[p.id] = { on: true, qty: i.sug > 0 ? i.sug : Math.max(getMinQty(p) * 2 - (parseInt(p.qty) || 0), 1) }; } }); }
        baseRender.apply(this, arguments);
        try { spoDecorate(c); } catch (e) { /* تجاهل */ }
        if (c.on) spoEnsure(c);
    };
})();
function spoDecorate(c) {
    const pane = document.getElementById('billPane-po'); if (!pane) return;
    let bar = document.getElementById('spoBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'spoBar'; bar.className = 'spo-bar no-print'; const act = pane.querySelector('.bill-actions'); act.parentNode.insertBefore(bar, act.nextSibling); }
    const opt = (arr, v, f) => arr.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${f(x)}</option>`).join('');
    bar.innerHTML = `<label class="spo-sw"><input type="checkbox" ${c.on ? 'checked' : ''} onchange="spoSet('on',this.checked)"><span>الاقتراح الذكي للكميات (حسب معدل البيع)</span></label>
        ${c.on ? `<div class="spo-row"><label><span>قياس المبيعات</span><select onchange="spoSet('weeks',+this.value)">${opt([2, 4, 8, 12], c.weeks, x => 'آخر ' + x + ' أسابيع')}</select></label><label><span>يغطي الطلب</span><select onchange="spoSet('cover',+this.value)">${opt([7, 14, 21, 30], c.cover, x => x + ' يوماً')}</select></label></div>` : ''}`;
    if (!c.on) return;
    const sold = spoSold(c), list = poCandidates(), rows = document.querySelectorAll('#poRows tr');
    rows.forEach((tr, k) => {
        const p = list[k], nm = tr.querySelector('.c-name'); if (!p || !nm) return;
        const i = spoInfo(p, sold, c), old = nm.querySelector('.spo-i'); if (old) old.remove();
        const t = i.rate > 0 ? `يُباع ${(Math.round(i.rate * 10) / 10)} علبة/يوم • يكفي ${i.left < 1 ? 'أقل من يوم' : Math.floor(i.left) + ' يوماً'} • مقترح ${i.sug}` : 'لا مبيعات خلال الفترة';
        nm.insertAdjacentHTML('beforeend', `<small class="spo-i no-print ${i.rate > 0 && i.left < 7 ? 'hot' : ''}">${t}</small>`);
    });
}
function spoSet(k, v) { const c = spoCfg(); c[k] = v; spoSave(c); poState = {}; renderPO(); }
async function spoEnsure(c) {   // الفواتير الافتراضية 300 فقط: نحمّل كل فواتير الفترة مرة واحدة
    const from = spoFrom(c); if (spoBusy || spoLoadedKey === from + '|' + todayLocalISO()) return; spoBusy = true;
    const h = Prog.start('تحميل مبيعات الفترة', { text: 'لحساب الاقتراح الذكي...' });
    try { await invEnsureSince(from); spoLoadedKey = from + '|' + todayLocalISO(); h.ok('تم'); poState = {}; if (currentBillTab === 'po') renderPO(); } catch (e) { h.fail('تعذر التحميل', e.message || String(e)); spoLoadedKey = from + '|' + todayLocalISO(); }
    spoBusy = false;
}
