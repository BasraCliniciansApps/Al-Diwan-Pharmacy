// تحسين شكل النوافذ المنبثقة (SweetAlert2): أسئلة/تأكيدات = ورقة من الأسفل، والباقي = بطاقة مدمجة
(function () {
    'use strict';
    if (!window.Swal || !Swal.fire || Swal.__dw) return;
    var ICMAP = { question: 'circle-question-mark', warning: 'triangle-alert', error: 'circle-x', success: 'circle-check', info: 'info' };
    var orig = Swal.fire.bind(Swal);
    Swal.fire = function (o) {
        if (!o || typeof o !== 'object' || o.toast || (o.customClass && o.customClass.popup)) return orig.apply(null, arguments);
        var o2 = Object.assign({}, o);
        var sheet = !!(o.showCancelButton || o.showDenyButton) && !o.input && !o.width;
        var cc = Object.assign({}, o.customClass || {});
        cc.popup = 'dw-pop ' + (sheet ? 'dw-sheet' : 'dw-card');
        cc.container = (cc.container ? cc.container + ' ' : '') + (sheet ? 'dw-cont-sheet' : 'dw-cont-card');
        cc.icon = 'dw-ic dw-ic-' + (o.icon || 'none');
        cc.title = 'dw-title'; cc.htmlContainer = 'dw-text';
        cc.confirmButton = 'dw-btn dw-btn-main' + (/^#(b91c1c|dc2626|ef4444|991b1b|c0392b)/i.test(String(o.confirmButtonColor || '')) ? ' dw-btn-danger' : ''); cc.cancelButton = 'dw-btn dw-btn-ghost'; cc.denyButton = 'dw-btn dw-btn-deny';
        cc.actions = 'dw-actions';
        o2.customClass = cc;
        if (o.icon && ICMAP[o.icon] && window.AppIcons && !o.iconHtml) o2.iconHtml = AppIcons.svg(ICMAP[o.icon]);
        if (sheet && !o.position) o2.position = 'bottom';
        o2.showClass = { popup: sheet ? 'dw-in-sheet' : 'dw-in-card', backdrop: 'swal2-backdrop-show', icon: '' };
        o2.hideClass = { popup: sheet ? 'dw-out-sheet' : 'dw-out-card', backdrop: 'swal2-backdrop-hide', icon: '' };
        o2.buttonsStyling = false; o2.reverseButtons = false;
        return orig(o2);
    };
    Swal.__dw = true;
})();
