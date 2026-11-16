#!/usr/bin/env python3
"""يولّد flutter/packages/core/lib/src/forms_table.dart من FORMS في data.js (مصدر الحقيقة)."""
import json, os, subprocess, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = open(os.path.join(root, 'data.js'), encoding='utf-8').read().split('\n')
s = next(i for i, l in enumerate(lines) if l.startswith('const FORMS = ['))
e = next(i for i in range(s, len(lines)) if lines[i].startswith('];'))
js = "const mkForm = (id, txt, cls, g, re) => ({ id, txt, cls, g, re: re || null });\n" + "\n".join(lines[s:e + 1]) + \
     "\nconsole.log(JSON.stringify(FORMS.map(f=>({id:f.id,txt:f.txt,g:f.g,cls:f.cls,re:f.re?f.re.source:null,fl:f.re?f.re.flags:''}))))"
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
    f.write(js)
d = json.loads(subprocess.check_output(['node', f.name]))
def lit(x):
    assert "'''" not in x
    return "r'''" + x + "'''"
out = ["// مولَّد آليّاً من FORMS في data.js (لا تعدّله يدوياً): python3 tools/gen_forms.py", "",
       "class FormDef {", "  const FormDef(this.id, this.txt, this.group, this.cls, this.pattern, this.flags);",
       "  final String id, txt, group, cls;", "  final String? pattern;", "  final String flags;", "}", "", "const diwanForms = <FormDef>["]
for x in d:
    pat = lit(x['re']) if x['re'] is not None else 'null'
    out.append("  FormDef(%s, %s, %s, %s, %s, %s)," % (lit(x['id']), lit(x['txt']), lit(x['g']), lit(x['cls']), pat, lit(x['fl'])))
out.append("];")
open(os.path.join(root, 'flutter/packages/core/lib/src/forms_table.dart'), 'w', encoding='utf-8').write("\n".join(out) + "\n")
print(len(d), 'forms')
