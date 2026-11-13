/* تقرير تطابق المخزون: يقارن سلسلة حركات البيع/الإلغاء/التعديل لكل مادة ويكشف الفروقات (للمالك) */
async function openRecon() {
    if (typeof userRole === 'undefined' || userRole !== 'owner') { Swal.fire({ icon: 'info', title: 'للمالك فقط', confirmButtonColor: '#0f1c38' }); return; }
    if (!navigator.onLine || !db) { Swal.fire({ icon: 'info', title: 'يلزم اتصال بالإنترنت', confirmButtonColor: '#0f1c38' }); return; }
    const days = 7, since = new Date(Date.now() - days * 86400000).toISOString();
    const PO = Prog.open('جاري إعداد تقرير التطابق');
    let moves = [];
    try {
        const snap = await db.collection('pharmacy_moves').where('ts', '>=', since).get();
        snap.forEach(d => moves.push(d.data()));
    } catch (e) {
        Prog.end(PO, 'quiet');
        Swal.fire({ icon: 'error', title: 'تعذّر قراءة الحركات', text: 'تأكد من نشر قواعد الحماية الأخيرة ثم أعد المحاولة.', confirmButtonColor: '#0f1c38' });
        return;
    }
    Prog.end(PO, 'quiet');
    moves.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    const by = {}; let sales = 0, cancels = 0, edits = 0;
    moves.forEach(m => {
        if (m.kind === 'sale') sales++; else if (m.kind === 'cancel') cancels++; else if (m.kind === 'edit') edits++;
        (m.lines || []).forEach(l => { (by[l.p] = by[l.p] || []).push({ m, l }); });
    });
    const gaps = [];
    Object.keys(by).forEach(id => {
        const arr = by[id];
        for (let i = 1; i < arr.length; i++) {
            const a = arr[i - 1].l, b = arr[i].l, mb = arr[i].m;
            const exp = (a.q * 1000 + a.l), got = ((b.q - b.dq) * 1000 + (b.l - b.dl));
            if (exp !== got) gaps.push({ id, diff: (b.q - b.dq) - a.q, diffL: (b.l - b.dl) - a.l, who: mb.by || '', no: mb.no || '', kind: mb.kind, ts: mb.ts });
        }
    });
    const neg = [];
    (products || []).forEach(p => { const s = stockMap[String(p.id)]; if (s && (parseInt(s.qty) || 0) < 0) neg.push(p); });
    const nm = id => { const p = (products || []).find(x => String(x.id) === String(id)); return p ? dispName(p) : id; };
    const kindT = k => k === 'sale' ? 'بيع' : k === 'cancel' ? 'إلغاء' : 'تعديل';
    const esc = s => escapeHtml(String(s));
    let h = '<div style="text-align:right;font-size:.85rem;line-height:1.9">'
        + '<div>آخر ' + days + ' أيام: <b>' + fmtNum(sales) + '</b> بيع، <b>' + fmtNum(cancels) + '</b> إلغاء، <b>' + fmtNum(edits) + '</b> تعديل.</div>';
    if (!moves.length) h += '<div style="color:#64748b">لا توجد حركات مسجّلة بعد في هذه المدة.</div>';
    h += gaps.length ? '<div style="margin-top:8px;color:#b45309"><b>فروقات بين الحركات (' + fmtNum(gaps.length) + '):</b></div>'
        + gaps.slice(0, 40).map(g => '<div style="border-bottom:1px solid #e2e8f0;padding:4px 0">' + esc(nm(g.id)) + '<br><small>قبل ' + kindT(g.kind) + (g.no ? ' فاتورة ' + esc(g.no) : '') + (g.who ? ' (' + esc(g.who) + ')' : '') + ' تغيّر الرصيد بمقدار ' + fmtNum(g.diff) + (g.diffL ? ' والمفرد ' + fmtNum(g.diffL) : '') + ' دون حركة مسجّلة (جرد أو وارد أو تعديل يدوي أو عملية من جهاز غير محدّث).</small></div>').join('')
        : '<div style="margin-top:8px;color:#15803d">✓ لا توجد فروقات بين حركات البيع والإلغاء.</div>';
    if (neg.length) h += '<div style="margin-top:8px;color:#b91c1c"><b>مواد برصيد سالب (' + fmtNum(neg.length) + '):</b></div>' + neg.slice(0, 30).map(p => '<div>' + esc(dispName(p)) + ' — ' + fmtNum(parseInt(stockMap[String(p.id)].qty) || 0) + '</div>').join('');
    h += '</div>';
    Swal.fire({ title: 'تقرير تطابق المخزون', html: h, confirmButtonText: 'إغلاق', confirmButtonColor: '#0f1c38' });
}
