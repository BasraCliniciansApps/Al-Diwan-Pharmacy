# يولّد icons.js: أيقونات Lucide (ISC) مدمجة + استبدال الإيموجي بها في الواجهة تلقائياً
import re, json, os
L = '/tmp/icons/lucide/icons/'
MAP = {
 '✅':'circle-check','✓':'check','⏳':'hourglass','✕':'x','✖':'x','❌':'x','⚠️':'triangle-alert','⚠':'triangle-alert',
 '🔍':'search','🔎':'search','✏️':'pencil','🖋️':'pencil','🗑️':'trash','⚙️':'settings','➕':'plus','🌓':'sun-moon','💊':'pill',
 '💾':'save','☁️':'cloud','🏷️':'tag','🖨️':'printer','🏠':'house','🏡':'house','📦':'package','💳':'credit-card','📥':'package-open',
 '📅':'calendar-days','🗓️':'calendar-days','🎉':'party-popper','🔔':'bell','✨':'sparkles','🧪':'flask-conical','🔄':'refresh-cw',
 '↩️':'undo-2','↩':'undo-2','📑':'file-text','🎁':'gift','🔁':'repeat','📊':'chart-column','📋':'clipboard-list','🗂️':'folders','📲':'smartphone','📜':'scroll-text','👁':'eye','🖼️':'image','🧩':'puzzle',
 '🛒':'shopping-cart','📚':'library','💬':'message-circle','⬇️':'download','🏥':'hospital','🔗':'link','📉':'trending-down','📴':'wifi-off',
 '🤖':'bot','🔐':'lock','🔒':'lock','♻️':'recycle','🌐':'globe','📷':'camera','📸':'camera','🧾':'receipt-text','🏭':'warehouse',
 '👤':'user','🚫':'ban','⛔':'ban','📁':'folder','📖':'book-open','💡':'lightbulb','★':'star','⬆️':'arrow-up','💰':'wallet',
 '🔵':'dot','🟢':'dot','🔴':'dot','🟡':'dot','⭐':'star','📌':'pin','🔙':'arrow-right','✔️':'check','✔':'check','❗':'circle-alert','❓':'circle-question-mark','ℹ️':'info','ℹ':'info','📝':'file-pen','📄':'file-text','🔧':'wrench','🛠️':'wrench','⏰':'alarm-clock','🕒':'clock','⬅️':'arrow-right','➡️':'arrow-left','▶️':'play','⏸️':'pause','📞':'phone','📱':'smartphone','✉️':'mail','💲':'banknote','🛑':'octagon-x','🆕':'sparkles','▦':'scan-barcode','⟳':'refresh-cw','⏻':'log-out','🚪':'log-out','☀️':'sun','🌙':'moon','🔽':'chevron-down','🔼':'chevron-up'}
icons = {}
EXTRA = ['circle-question-mark','circle-x','info','circle-check','triangle-alert','x']
for k, n in MAP.items():
    f = L + n + '.svg'
    if not os.path.exists(f): print('MISSING', k, n); continue
    s = open(f).read()
    inner = re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
    inner = re.sub(r'\s+', ' ', inner).strip()
    icons[n] = inner
for n in EXTRA:
    f = L + n + '.svg'
    if os.path.exists(f):
        icons[n] = re.sub(r'\s+', ' ', re.search(r'<svg[^>]*>(.*)</svg>', open(f).read(), re.S).group(1)).strip()
    else: print('MISSING extra', n)
keys = sorted(MAP.keys(), key=lambda x: -len(x))
js = '''// أيقونات Lucide (رخصة ISC) — خطية أحادية اللون، مدمجة داخل التطبيق (تعمل بدون إنترنت).
// تستبدل أي إيموجي يظهر في الواجهة بأيقونة مطابقة وتأخذ لون النص المحيط.
(function () {
    'use strict';
    var ICONS = %s;
    var MAP = %s;
    var RE = new RegExp('(' + Object.keys(MAP).sort(function (a, b) { return b.length - a.length; }).map(function (k) { return k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'); }).join('|') + ')\\\\uFE0F?', 'g');
    var ANY = new RegExp('[\\\\u{1F300}-\\\\u{1FAFF}\\\\u2600-\\\\u27BF\\\\u2B50\\\\u2B06\\\\u2B07\\\\u23FB\\u25A6\\u27F3\\u2B05\\\\u2705\\\\u23F3\\\\u23F0\\\\u2139\\\\u2764]\\\\uFE0F?', 'gu');
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, TITLE: 1, SVG: 1, svg: 1, NOSCRIPT: 1 };
    function svg(name) {
        return '<svg class="ic ic-' + name + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (name === 'dot' ? '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>' : ICONS[name]) + '</svg>';
    }
    function dotColor(ch) { return ch.indexOf('\\uD83D\\uDFE2') === 0 ? '#16a34a' : ch.indexOf('\\uD83D\\uDD34') === 0 ? '#dc2626' : ch.indexOf('\\uD83D\\uDD35') === 0 ? '#2563eb' : '#d97706'; }
    function makeNode(ch) {
        var n = MAP[ch] || MAP[ch.replace(/\\uFE0F$/, '')];
        var t = document.createElement('template'); t.innerHTML = svg(n);
        var el = t.content.firstChild;
        if (n === 'dot') el.style.color = dotColor(ch);
        return el;
    }
    function stripAny(s) { return s.replace(ANY, '').replace(/^\\s+/, ''); }
    function fixText(node) {
        var v = node.nodeValue;
        if (!v || !ANY.test(v)) { ANY.lastIndex = 0; return; }
        ANY.lastIndex = 0;
        var p = node.parentNode; if (!p) return;
        if (SKIP[p.nodeName]) { if (p.nodeName === 'OPTION') node.nodeValue = stripAny(v); return; }
        var frag = document.createDocumentFragment(), last = 0, m;
        ANY.lastIndex = 0;
        while ((m = ANY.exec(v))) {
            var ch = m[0], base = ch.replace(/\\uFE0F$/, '');
            if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
            if (MAP[ch] || MAP[base]) frag.appendChild(makeNode(ch));
            last = m.index + ch.length;
            if (v.charAt(last) === ' ' && (MAP[ch] || MAP[base])) { /* نُبقي المسافة */ }
        }
        if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
        p.replaceChild(frag, node);
    }
    function fixAttrs(el) {
        ['placeholder', 'title', 'aria-label'].forEach(function (a) { var v = el.getAttribute && el.getAttribute(a); if (v && ANY.test(v)) { el.setAttribute(a, stripAny(v)); } ANY.lastIndex = 0; });
    }
    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) { fixText(root); return; }
        if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
        fixAttrs(root);
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
        while ((n = w.nextNode())) { if (n.nodeValue && /[^\\x00-\\u2000]/.test(n.nodeValue)) list.push(n); }
        list.forEach(fixText);
        if (root.querySelectorAll) root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(fixAttrs);
        if (root.querySelectorAll) root.querySelectorAll('option').forEach(function (o) { if (ANY.test(o.textContent)) o.textContent = stripAny(o.textContent); ANY.lastIndex = 0; });
    }
    function start() {
        walk(document.body);
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'characterData') fixText(m.target);
                else m.addedNodes.forEach(walk);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    window.AppIcons = { svg: svg, walk: walk, names: Object.keys(ICONS) };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
''' % (json.dumps(icons, ensure_ascii=False), json.dumps({k: MAP[k] for k in MAP if MAP[k] in icons or MAP[k]=='dot'}, ensure_ascii=False))
open('icons.js', 'w', encoding='utf-8').write(js)
print(len(icons), 'icons', len(js)//1024, 'KB')
