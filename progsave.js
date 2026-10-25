// شريط التقدّم لكل زر حفظ: يلفّ دوال الحفظ الرئيسية. إذا طوّلت أكثر من 0.3 ثانية يطلع الشريط (نفس شريط التحميل/الرفع)
(function () {
    const MAP = {
        puSave: 'حفظ الوارد', saveFormProduct: 'حفظ المادة', saveInvoiceEdit: 'حفظ الفاتورة', saveInvoiceRecord: 'حفظ الفاتورة',
        lgxSave: 'حفظ السجل', lgrSave: 'حفظ المردود', puSaveSupplierRec: 'حفظ المذخر', ptCommit: 'حفظ التبادل',
        saveInventory: 'حفظ الجرد', saveIngredients: 'حفظ المكونات', savePricingSettings: 'حفظ التسعير',
        catConfirm: 'اعتماد الرصيد', catMergeConfirm: 'دمج المادتين', lgFinSaveField: 'حفظ الملخص المالي'
    };
    Object.keys(MAP).forEach(name => {
        const orig = window[name];
        if (typeof orig !== 'function' || orig.__ps) return;
        const w = async function () {
            let x = null, done = false;
            const t = setTimeout(() => { if (!done && typeof Prog !== "undefined") x = Prog.open(MAP[name], { text: 'جاري الحفظ...' }); }, 300);
            try {
                const r = await orig.apply(this, arguments);
                done = true; clearTimeout(t);
                if (x) Prog.end(x, 'ok', 'تم الحفظ');
                return r;
            } catch (e) {
                done = true; clearTimeout(t);
                if (x) Prog.end(x, 'err', 'فشل الحفظ'); 
                throw e;
            }
        };
        w.__ps = 1; window[name] = w;
    });
})();
