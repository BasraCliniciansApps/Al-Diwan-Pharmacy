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

# فئات القاعدة ← كلمات بحث عربية وإنجليزية (مستوى الاستطباب العام فقط)
TAG_RULES = [
 (r'ANTIBIOTIC|PENICILLIN|CEPHALOSPORIN|MACROLIDE|QUINOLONE|AMINOGLYCOSIDE|CARBAPENEM', 'مضاد حيوي التهاب بكتيريا antibiotic'),
 (r'NSAID|ANALGESIC|ANTIPYRETIC', 'مسكن ألم التهاب صداع pain'),
 (r'ANTIPYRETIC', 'خافض حرارة حمى سخونه fever'),
 (r'ANTI-?HISTAMINE|ANTI-ALLERGY', 'حساسية مضاد هستامين allergy'),
 (r'PROTON PUMP|PEPTIC|ANTACID|H2 ANTAGONIST', 'حرقة معدة حموضة قرحة acidity'),
 (r'ANTIEMETIC', 'غثيان قيء استفراغ nausea'),
 (r'LAXATIVE', 'إمساك ملين constipation'),
 (r'ANTIDIARRH|ANTI-DIARRH', 'إسهال اسهال diarrhea'),
 (r'COUGH|MUCOLYTIC|EXPECTORANT|ANTITUSSIVE', 'سعال كحة بلغم cough'),
 (r'COLD PRODUCTS|DECONGESTANT', 'برد زكام انفلونزا احتقان cold flu'),
 (r'ANTIFUNGAL', 'مضاد فطريات فطر antifungal'),
 (r'ANTI-?VIRAL', 'مضاد فيروسات antiviral'),
 (r'ANTI-?PARASITIC|ANTHELMINTIC|ANTIMALARIAL|ANTIPROTOZOAL', 'طفيليات ديدان antiparasitic'),
 (r'ANTI-?HYPERTENSIVE|CALCIUM CHANNEL|BETA BLOCKER|\\bACE\\b|ANGIOTENSIN', 'ضغط ارتفاع ضغط الدم hypertension'),
 (r'DIURETIC', 'مدر للبول diuretic'),
 (r'ANTI-?DIABETIC|INSULIN|SGLT2|DPP-4', 'سكر سكري diabetes'),
 (r'HYPERLIPIDEMIC|STATIN', 'كوليسترول دهون statin'),
 (r'ANTI-?COAGULANT|ANTIPLATELET|ANTI-?THROMBOTIC', 'سيولة دم تخثر anticoagulant'),
 (r'ANTI-ISCHEMIC|ANTI-ANGINAL|CARDIAC|ANTIARRHYTHMIC', 'قلب ذبحة angina'),
 (r'ANTIDEPRESSANT|ANXIOLYTIC|HYPNOTIC|PSYCHIATRIC|ANTIPSYCHOTIC', 'نفسي اكتئاب قلق نوم depression anxiety'),
 (r'ANTI-?EPILEPTIC|ANTICONVULSANT', 'صرع تشنج epilepsy'),
 (r'ANTI-?MIGRAINE', 'صداع نصفي شقيقة migraine'),
 (r'MUSCLE RELAXANT', 'مرخي عضلات شد عضلي muscle'),
 (r'GLUCOCORTICOID|CORTICOSTEROID|STEROID', 'كورتيزون ستيرويد steroid'),
 (r'HORMON|THYROID|CONTRACEPTIVE|ESTROGEN|PROGEST', 'هرمون hormone'),
 (r'THYROID', 'غدة درقية thyroid'),
 (r'CONTRACEPTIVE', 'منع حمل contraceptive'),
 (r'ANTI-?ACNE', 'حب الشباب بثور acne'),
 (r'SUN ?BLOCK|SUNSCREEN', 'واقي شمس sunscreen'),
 (r'SKIN CARE|MOISTURI[SZ]ING|WHITENING', 'بشرة ترطيب كريم skin'),
 (r'HAIR CARE|SHAMPOO|HAIR', 'شعر تساقط شامبو hair'),
 (r'ORAL CARE|MOUTH|DENTAL', 'فم اسنان اللثة oral'),
 (r'VAGINAL', 'مهبل نسائية vaginal'),
 (r'\\bEYE\\b|OPHTHALM', 'عين قطرة عين eye'),
 (r'\\bEAR\\b|\\bOTIC\\b', 'اذن قطرة اذن ear'),
 (r'NASAL', 'انف بخاخ انف nasal'),
 (r'ANTISEPTIC|DISINFECT', 'مطهر تعقيم antiseptic'),
 (r'MULTIVITAMIN|VITAMIN|SUPPLEMENT|MINERAL', 'فيتامين مكمل غذائي vitamin'),
 (r'\\bIRON\\b', 'حديد فقر دم anemia iron'),
 (r'CALCIUM|VITAMIN D', 'كالسيوم عظام calcium'),
 (r'OMEGA', 'اوميغا omega'),
 (r'WEIGHT LOSS', 'تنحيف انقاص وزن'),
 (r'SEXUAL|ERECTILE', 'ضعف جنسي'),
 (r'ANTINEOPLASTIC|CHEMOTHERAPY', 'سرطان اورام chemotherapy'),
 (r'ANTI-?RHEUMATIC|OSTEOARTHRITIS|GOUT', 'مفاصل روماتيزم نقرس arthritis'),
 (r'MASSAGE', 'مساج دهان الم عضلات'),
 (r'ANTI-?ASTHMA|BRONCHODILATOR|ASTHMA', 'ربو ضيق تنفس asthma'),
 (r'ANTISPASMODIC|SPASM', 'مغص تقلصات antispasmodic'),
 (r'PROSTAT|URINARY|\\bURO', 'بروستات مجاري بولية urinary'),
 (r'HEMORRHOID', 'بواسير'),
 (r'ANTI-?VERTIGO|VERTIGO', 'دوخة دوار vertigo'),
]
TAGS = [(re.compile(p), t) for p, t in TAG_RULES]
def tags_of(cls):
    out = []
    for rx, t in TAGS:
        if rx.search(cls.upper()):
            for w in t.split():
                if w not in out: out.append(w)
    return ' '.join(out)

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
m = {}; ar = {}; tg = {}
for k, r in zip(keys, rows):
    s = title(r['scientific_name'])
    if len(k) < 3 or not s: continue
    m.setdefault(k, set()).add(s)
    a = re.sub(r'\s+', ' ', r['commercial_name_ar'] or '').strip()
    if a and k not in ar: ar[k] = a
    for w in tags_of(r['drug_class'] or '').split():
        tg.setdefault(k, [])
        if w not in tg[k]: tg[k].append(w)
out = {k: (next(iter(v)) if len(v) == 1 else sorted(v)[:6]) for k, v in m.items()}   # الملتبس: قائمة احتمالات يختار منها المستخدم
tags = sorted({' '.join(v) for v in tg.values()}); tix = {t: i for i, t in enumerate(tags)}
T = {k: tix[' '.join(v)] for k, v in tg.items() if k in out and v}
A = {k: v for k, v in ar.items() if k in out}
body = 'window.DRUGDB=' + json.dumps({'v': 2, 'src': 'Egyptian Drug Database (CC0)', 'm': out, 'a': A, 'tg': tags, 't': T}, ensure_ascii=False, separators=(',', ':')) + ';'
open(os.path.join(root, 'drugdb.js'), 'w', encoding='utf-8').write(body)
print('keys', len(out), 'ambiguous', sum(1 for v in out.values() if isinstance(v, list)), 'arabic', len(A), 'tagged', len(T), 'uniqueTagSets', len(tags), 'bytes', len(body.encode()))
