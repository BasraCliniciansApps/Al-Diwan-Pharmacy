// تحسين شكل النوافذ المنبثقة (SweetAlert2): أسئلة/تأكيدات = ورقة من الأسفل، والباقي = بطاقة مدمجة
(function () {
    'use strict';
    if (!window.Swal || !Swal.fire || Swal.__dw) return;
    var ICMAP = { question: 'circle-question-mark', warning: 'triangle-alert', error: 'circle-x', success: 'circle-check', info: 'info' };
    var orig = Swal.fire.bind(Swal);
    Swal.fire = function (o) {
        if (!o || typeof o !== 'object' || o.toast || (o.customClass && o.customClass.popup)) return orig.apply(null, arguments);
        var o2 = Object.assign({}, o);
        if (o2.confirmButtonText === undefined) o2.confirmButtonText = 'حسناً';   // لا يظهر «OK» الإنجليزي أبداً
        if (o2.cancelButtonText === undefined) o2.cancelButtonText = 'إلغاء';
        if (o2.denyButtonText === undefined) o2.denyButtonText = 'لا';
        // نوافذ الأدوات داخل الإعدادات: تُعرض كصفحة داخل الإعدادات نفسها لا كنافذة منبثقة
        var host = document.querySelector('#catModal .modal-card'), cm = document.getElementById('catModal');
        if (host && cm && cm.style.display && cm.style.display !== 'none' && (o.html || o.input) && !o.icon && !o.timer && !o.target) {
            var cci = Object.assign({}, o.customClass || {});
            cci.popup = 'dw-pop dw-inline'; cci.container = 'dw-cont-inline'; cci.title = 'dw-title'; cci.htmlContainer = 'dw-text'; cci.actions = 'dw-actions';
            cci.confirmButton = 'dw-btn dw-btn-main'; cci.cancelButton = 'dw-btn dw-btn-ghost'; cci.denyButton = 'dw-btn dw-btn-ghost';
            o2.customClass = cci; o2.target = host; o2.backdrop = false; o2.heightAuto = false; o2.position = 'center'; o2.grow = false;
            o2.showClass = { popup: '', backdrop: '', icon: '' }; o2.hideClass = { popup: '', backdrop: '', icon: '' };
            o2.buttonsStyling = false; o2.reverseButtons = false; o2.returnFocus = false;
            var od = o.didOpen, oc = o.willClose;
            o2.didOpen = function () { host.scrollTop = 0; host.classList.add('sh-subopen'); if (od) return od.apply(this, arguments); };
            o2.didDestroy = function () { host.classList.remove('sh-subopen'); if (o.didDestroy) return o.didDestroy.apply(this, arguments); };
            return orig(o2);
        }
        var sheet = !!(o.showCancelButton || o.showDenyButton) && !o.input && !o.width;
        var cc = Object.assign({}, o.customClass || {});
        cc.popup = 'dw-pop ' + (sheet ? 'dw-sheet' : 'dw-card');
        cc.container = (cc.container ? cc.container + ' ' : '') + (sheet ? 'dw-cont-sheet' : 'dw-cont-card');
        cc.icon = 'dw-ic dw-ic-' + (o.icon || 'none');
        cc.title = 'dw-title' + (o.customClass && o.customClass.title ? ' ' + o.customClass.title : ''); cc.htmlContainer = 'dw-text';
        cc.confirmButton = 'dw-btn dw-btn-main' + (/^#(b91c1c|dc2626|ef4444|991b1b|c0392b)/i.test(String(o.confirmButtonColor || '')) ? ' dw-btn-danger' : ''); cc.cancelButton = (o.customClass && o.customClass.cancelButton) || 'dw-btn dw-btn-ghost'; cc.denyButton = (o.customClass && o.customClass.denyButton) || 'dw-btn dw-btn-deny';
        cc.actions = 'dw-actions';
        o2.customClass = cc;
        if (o.icon && ICMAP[o.icon] && window.AppIcons && !o.iconHtml) o2.iconHtml = AppIcons.svg(ICMAP[o.icon]);
        if (sheet && !o.position) o2.position = 'bottom';
        o2.showClass = { popup: sheet ? 'dw-in-sheet' : 'dw-in-card', backdrop: 'swal2-backdrop-show', icon: '' };
        o2.hideClass = { popup: sheet ? 'dw-out-sheet' : 'dw-out-card', backdrop: 'swal2-backdrop-hide', icon: '' };
        o2.buttonsStyling = false; o2.reverseButtons = false;
        if (sheet) {   // سحب الورقة السفلية للأسفل لإغلاقها (يُعدّ إلغاءً)
            var od2 = o.didOpen;
            o2.didOpen = function (pop) {
                var y0 = 0, dy = 0, on = false;
                pop.addEventListener('touchstart', function (e) { on = e.touches.length === 1 && e.touches[0].clientY - pop.getBoundingClientRect().top <= 90; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
                pop.addEventListener('touchmove', function (e) { if (!on) return; dy = e.touches[0].clientY - y0; if (dy > 0) { if (e.cancelable) e.preventDefault(); pop.style.transition = 'none'; pop.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: false });
                var end = function () { if (!on) return; on = false; pop.style.transition = ''; if (dy > 80) { try { if (o.showCancelButton) Swal.clickCancel(); else Swal.close(); } catch (er) { /* تجاهل */ } } pop.style.transform = ''; dy = 0; };
                pop.addEventListener('touchend', end, { passive: true }); pop.addEventListener('touchcancel', end, { passive: true });
                if (od2) return od2.apply(this, arguments);
            };
        }
        return orig(o2);
    };
    Swal.__dw = true;
})();
