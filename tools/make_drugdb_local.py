#!/usr/bin/env python3
"""يولّد drugdb_local.js من tools/local_dict_src.json (قاموس صيدلية الديوان المحلي).
الصيغة: window.DRUGDB_LOCAL={m:{key:ingredient|[candidates]},k:{key:"كلمات مفتاحية"}}
المفتاح = dhBaseKey(اسم المادة) كما في datahub.js. هذا القاموس يتقدّم على قاعدة الأدوية المصرية."""
import json, collections, os
d = os.path.dirname(os.path.abspath(__file__))
src = json.load(open(os.path.join(d, 'local_dict_src.json'), encoding='utf-8'))
m, k = collections.OrderedDict(), collections.OrderedDict()
for e in src:
    if e['ing']:
        c = m.setdefault(e['key'], [])
        if e['ing'] not in c: c.append(e['ing'])
    if e['kw']:
        w = k.setdefault(e['key'], [])
        for x in e['kw']:
            if x not in w: w.append(x)
m = {a: (b[0] if len(b) == 1 else b) for a, b in m.items()}
k = {a: ' '.join(b) for a, b in k.items()}
out = 'window.DRUGDB_LOCAL=' + json.dumps({'v': 1, 'm': m, 'k': k}, ensure_ascii=False, separators=(',', ':')) + ';'
open(os.path.join(d, '..', 'drugdb_local.js'), 'w', encoding='utf-8').write(out)
print('keys m=%d k=%d bytes=%d' % (len(m), len(k), len(out.encode())))
