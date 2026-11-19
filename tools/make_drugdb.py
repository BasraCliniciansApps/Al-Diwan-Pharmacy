#!/usr/bin/env python3
"""يولّد drugdb.js (اسم تجاري مُطبَّع ← مادة فعالة) من قاعدة الأدوية المصرية المفتوحة (CC0 حسب README):
https://github.com/karem505/egyptian-drug-database  — الملف: data/egyptian-drugs.csv
الاستعمال: python3 tools/make_drugdb.py /path/egyptian-drugs.csv
المفاتيح تُحسب بنفس دالة dhBaseKey الموجودة في datahub.js حتى تتطابق تماماً."""
import csv, json, re, subprocess, sys, os, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
src = open(os.path.join(root, 'datahub.js'), encoding='utf-8').read()
a = src.index('const DH_STR_RE'); b = src.index('const dhStripStr')
js = src[a:b].replace('const DH_STR_RE', 'var DH_STR_RE').replace('const DH_FORM_RE', 'var DH_FORM_RE')
js += "\nconst rows = JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));\nconsole.log(JSON.stringify(rows.map(n => dhBaseKey(n))));"
def title(s):
    out = []
    for part in re.sub(r'\([^)]*\)', ' ', s).split('+'):
        p = re.sub(r'\s+', ' ', part).strip().lower()
        if p: out.append(p[0].upper() + p[1:])
    return ' + '.join(out)
names = [r['commercial_name_en'] for r in rows]
with tempfile.TemporaryDirectory() as d:
    open(d + '/k.js', 'w').write(js); json.dump(names, open(d + '/n.json', 'w'))
    keys = json.loads(subprocess.check_output(['node', d + '/k.js', d + '/n.json']))
m = {}
for k, r in zip(keys, rows):
    s = title(r['scientific_name'])
    if len(k) < 3 or not s: continue
    m.setdefault(k, set()).add(s)
out = {k: next(iter(v)) for k, v in m.items() if len(v) == 1}
body = 'window.DRUGDB={v:1,src:"Egyptian Drug Database (CC0)",m:' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '};'
open(os.path.join(root, 'drugdb.js'), 'w', encoding='utf-8').write(body)
print('keys', len(out), 'dropped ambiguous', len(m) - len(out), 'bytes', len(body.encode()))
