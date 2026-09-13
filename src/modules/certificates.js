import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderCertificates() {
    var students = db.get('students');
    var groups = db.get('groups');
    var container = document.getElementById('module-content');
    if (!container) return;
    // FIX #9: Faqat bitirgan yoki faol o'quvchilar (holat tekshiruvi modal ochilganda)
    var studentOpts = '';
    students.forEach(function(s) {
      var badge = s.status === 'graduated' ? ' ✅' : (s.status === 'frozen' ? ' ❄️' : '');
      studentOpts += '<option value="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" data-status="' + escapeHTML(s.status) + '">' + escapeHTML(s.fullName) + badge + '</option>';
    });
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-award text-warning"></i> Sertifikatlar Generatori</h2></div>' +
      '<div class="glass-card text-center" style="padding:40px;"><i class="fa-solid fa-award text-warning" style="font-size:48px;"></i><h2 class="mt-3">EduFlow Rasmiy Sertifikat</h2><div class="form-group mt-3" style="max-width:300px; margin:16px auto;"><label>' + "O'quvchini Tanlang" + '</label><select id="cert-st-select" class="form-select">' + studentOpts + '</select></div><button class="btn btn-warning mt-3" data-action="gen-cert">Sertifikat Yaratish va Chop Etish</button></div>' +
      '<div class="modal-overlay" id="modal-cert" style="display:none;"><div class="modal-content glass-card" style="padding:32px;" id="cert-body"></div></div>';
    delegateClicks(container, {
      'gen-cert': function() {
        var sel = document.getElementById('cert-st-select');
        var selectedOpt = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex] : null;
        var name = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text || '') : '';
        var status = selectedOpt ? (selectedOpt.dataset.status || '') : '';
        var settings = db.getSettings();
        var certBody = document.getElementById('cert-body');
        function proceedCert() {
          if (certBody) {
            var certNo = 'EF-' + new Date().getFullYear() + '-' + String(db.get('students').length).padStart(4, '0');
            certBody.innerHTML = '<div style="border:3px double var(--color-warning); padding:40px; border-radius:16px; text-align:center;"><i class="fa-solid fa-award text-warning" style="font-size:64px;"></i><h1 class="mt-3">SERTIFIKAT</h1><p class="text-muted" style="font-size:12px;">№ ' + certNo + '</p><hr style="border-color:var(--color-warning); margin:20px 0;"><h2 class="text-primary">' + escapeHTML(name) + '</h2><p class="mt-3 text-muted" style="font-size:16px;">' + escapeHTML(settings.centerName) + " ta'lim markazida muvaffaqiyatli o'qishni tugatganligi tasdiqlanadi." + '</p><p class="mt-4"><strong>Sana:</strong> ' + new Date().toLocaleDateString('uz-UZ') + '</p><p><strong>Direktor:</strong> ' + escapeHTML(settings.centerName) + ' Rahbari</p><hr style="border-color:var(--color-warning); margin:20px 0;"><button class="btn btn-warning" data-action="do-print">🖨️ Chop Etish</button> <button class="btn btn-secondary" data-action="close-modal" data-modal="modal-cert">Yopish</button></div>';
          }
          openModal('modal-cert');
        }
        // FIX #9: Ogohlantirish — hali bitirmagan
        if (status && status !== 'graduated') {
          showConfirm("Bu o'quvchi hali " + (status === 'frozen' ? 'to\'xtatilgan' : 'faol o\'qiydi') + ". Shunga qaramay sertifikat berishni tasdiqlaysizmi?", proceedCert);
        } else {
          proceedCert();
        }
      },
      'do-print': function() { window.print(); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); }
    });
  }
  // ---------- 10. TELEGRAM BOT (FIX #14) ----------

export { renderCertificates };