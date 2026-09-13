import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderBranches() {
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;
    var rowsHTML = '';
    branches.forEach(function(b) {
      rowsHTML += '<tr>' +
        '<td><strong>' + escapeHTML(b.name) + '</strong></td>' +
        '<td>' + escapeHTML(b.code) + '</td>' +
        '<td>' + escapeHTML(b.address) + '</td>' +
        '<td>' + escapeHTML(b.phone) + '</td>' +
        '<td>' + (b.isActive ? '<span class="badge badge-success">Faol</span>' : '<span class="badge badge-danger">Nofaol</span>') + '</td>' +
        '<td class="text-right">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-branch" data-id="' + b.id + '" style="margin-right: 4px;"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-danger btn-xs" data-action="delete-branch" data-id="' + b.id + '" data-name="' + escapeHTML(b.name) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    });
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">' +
        '<h2><i class="fa-solid fa-code-branch text-info"></i> Filiallar Boshqaruvi</h2>' +
        '<button class="btn btn-info" data-action="open-add-branch"><i class="fa-solid fa-plus"></i> Yangi Filial</button>' +
      '</div>' +
      '<div class="table-responsive glass-card">' +
        '<table class="data-table">' +
          '<thead><tr><th>Filial Nomi</th><th>Kodi</th><th>Manzil</th><th>Telefon</th><th>Holati</th><th>Amal</th></tr></thead>' +
          '<tbody>' + rowsHTML + '</tbody>' +
        '</table>' +
      '</div>' +
      // Add Modal
      '<div class="modal-overlay" id="modal-branch-add" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Yangi Filial Qo\'shish</h3>' +
        '<form id="form-branch-add" class="mt-3">' +
          '<div class="form-group"><label>Filial Nomi</label><input type="text" id="br-name" class="form-input" required></div>' +
          '<div class="form-group"><label>Manzil</label><input type="text" id="br-address" class="form-input" required></div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="br-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-branch-add">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-info">Saqlash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>' +
      // Edit Modal
      '<div class="modal-overlay" id="modal-branch-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Filialni Tahrirlash</h3>' +
        '<form id="form-branch-edit" class="mt-3">' +
          '<input type="hidden" id="br-edit-id">' +
          '<div class="form-group"><label>Filial Nomi</label><input type="text" id="br-edit-name" class="form-input" required></div>' +
          '<div class="form-group"><label>Manzil</label><input type="text" id="br-edit-address" class="form-input" required></div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="br-edit-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="form-group mt-3"><label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="br-edit-active"> Faol holatda</label></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-branch-edit">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-primary">Yangilash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>';
    delegateClicks(container, {
      'open-add-branch': function() {
        document.getElementById('form-branch-add').reset();
        openModal('modal-branch-add');
      },
      'edit-branch': function(btn) {
        var id = btn.dataset.id;
        var b = db.getById('branches', id);
        if (!b) return;
        document.getElementById('br-edit-id').value = b.id;
        document.getElementById('br-edit-name').value = b.name || '';
        document.getElementById('br-edit-address').value = b.address || '';
        document.getElementById('br-edit-phone').value = b.phone || '';
        document.getElementById('br-edit-active').checked = !!b.isActive;
        openModal('modal-branch-edit');
      },
      'delete-branch': function(btn) {
        var id = btn.dataset.id;
        var name = btn.dataset.name;
        showConfirm("Haqiqatdan ham '" + escapeHTML(name) + "' filialini o'chirib tashlamoqchimisiz? Diqqat, ushbu filialga tegishli ma'lumotlar muammoga uchrashi mumkin!", function() {
          db.delete('branches', id);
          showToast("Filial o'chirildi!", 'success');
          var bSel = document.getElementById('global-branch-selector');
          if (bSel) {
            var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
            db.get('branches').forEach(function(br) {
              opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
            });
            var currentVal = bSel.value;
            bSel.innerHTML = opts;
            bSel.value = currentVal;
          }
          renderBranches();
        });
      },
      'close-modal': function(btn) {
        closeModal(btn.dataset.modal);
      }
    });
    var formAdd = document.getElementById('form-branch-add');
    if (formAdd) formAdd.addEventListener('submit', function(e) {
      e.preventDefault();
      db.insert('branches', {
        id: crypto.randomUUID(),
        code: 'BR-' + String(db.get('branches').length + 1).padStart(6, '0'),
        name: document.getElementById('br-name').value.trim(),
        address: document.getElementById('br-address').value.trim(),
        phone: document.getElementById('br-phone').value.trim(),
        isActive: true
      });
      showToast("Yangi filial qo'shildi!", 'success');
      closeModal('modal-branch-add');
      // Update global branch selector
      var bSel = document.getElementById('global-branch-selector');
      if (bSel) {
        var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
        db.get('branches').forEach(function(br) {
          opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
        });
        var currentVal = bSel.value;
        bSel.innerHTML = opts;
        bSel.value = currentVal;
      }
      renderBranches();
    });
    var formEdit = document.getElementById('form-branch-edit');
    if (formEdit) formEdit.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('br-edit-id').value;
      db.update('branches', id, {
        name: document.getElementById('br-edit-name').value.trim(),
        address: document.getElementById('br-edit-address').value.trim(),
        phone: document.getElementById('br-edit-phone').value.trim(),
        isActive: document.getElementById('br-edit-active').checked
      });
      showToast("Filial ma'lumotlari yangilandi!", 'success');
      closeModal('modal-branch-edit');
      // Update global branch selector
      var bSel = document.getElementById('global-branch-selector');
      if (bSel) {
        var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
        db.get('branches').forEach(function(br) {
          opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
        });
        var currentVal = bSel.value;
        bSel.innerHTML = opts;
        bSel.value = currentVal;
      }
      renderBranches();
    });
  }
  // ---------- 5. ATTENDANCE (FIX #7) ----------
  var attGroupId = '';
  var attDate = '';

export { renderBranches };