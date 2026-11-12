#!/usr/bin/env python3
"""يولّد admin.html (الصيدلي) من app.template.html + invoice.html.part، وindex.html مجرد تحويل إليه"""
import re, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = open(os.path.join(root, 'app.template.html'), encoding='utf-8').read()
inv = open(os.path.join(root, 'invoice.html.part'), encoding='utf-8').read()
pur = open(os.path.join(root, 'purchase.html.part'), encoding='utf-8').read()
def build(mode):
    s = t.replace('@@INVOICE_HTML@@', inv).replace('@@PURCHASE_HTML@@', pur)
    if mode == 'admin':
        s = re.sub(r'<!--/?A-->', '', s)
        s = re.sub(r'<!--C-->.*?<!--/C-->', '', s, flags=re.S)
        title, cls = 'لوحة الصيدلي | صيدلية الديوان', 'admin-page'
        s = s.replace('href="manifest.json"', 'href="manifest-admin.json"')
        s = s.replace('data-view="stock"', 'data-view="splash"', 1)   # يبدأ بشاشة البداية لا بقائمة الأصناف
    else:
        s = re.sub(r'<!--A-->.*?<!--/A-->', '', s, flags=re.S)
        s = re.sub(r'<!--/?C-->', '', s)
        title, cls = 'صيدلية الديوان | الدليل الدوائي', 'customer'
    return s.replace('__TITLE__', title).replace('__BODYCLASS__', cls).replace('__MODE__', mode)
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write('<!doctype html><html lang="ar"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=admin.html"><title>صيدلية الديوان</title><script>location.replace("admin.html"+location.search+location.hash)</script>')
open(os.path.join(root, 'admin.html'), 'w', encoding='utf-8').write(build('admin'))
print('built admin.html (+ index.html redirect)')
