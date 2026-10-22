#!/usr/bin/env python3
"""يولّد index.html (الزبائن) و admin.html (الصيدلي) من app.template.html + invoice.html.part"""
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
        s = s.replace('href="manifest.json"', 'href="manifest-admin.json"').replace('content="صيدلية الديوان"', 'content="الديوان - صيدلي"')
    else:
        s = re.sub(r'<!--A-->.*?<!--/A-->', '', s, flags=re.S)
        s = re.sub(r'<!--/?C-->', '', s)
        title, cls = 'صيدلية الديوان | الدليل الدوائي', 'customer'
    return s.replace('__TITLE__', title).replace('__BODYCLASS__', cls).replace('__MODE__', mode)
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(build('customer'))
open(os.path.join(root, 'admin.html'), 'w', encoding='utf-8').write(build('admin'))
print('built index.html + admin.html')
