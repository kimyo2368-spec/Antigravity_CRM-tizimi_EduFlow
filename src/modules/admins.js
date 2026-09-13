import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, hashPassword, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderAdmins() {
    var users = db.get('users', function(u) { return u.role !== 'teacher' && u.role !== 'student' && u.role !== 'parent'; });
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;
    var rowsHTML = '';
    users.forEach(function(u) {
      var br = branches.find(function(b) { return b.id === u.branchId; });
      var brName = u.branchId === 'all' ? 'Barcha filiallar' : (br ? br.name : '-');
      rowsHTML += '<tr>' +
        '<td><strong>' + escapeHTML(u.fullName) + '</strong></td>' +
        '<td>' + escapeHTML(ROLE_LABELS[u.role] || u.role) + '</td>' +
        '<td>' + escapeHTML(u.email) + '</td>' +
        '<td>' + escapeHTML(brName) + '</td>' +
        '<td>' + escapeHTML(u.phone) + '</td>' +
        '<td class="text-right">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-admin" data-id="' + u.id + '"><i class="fa-solid fa-pen"></i></button>' +
        '</td>' +
      '</tr>';
    });
    var branchOpts = '<option value="all">Barcha filiallar (Global)</option>';
    branches.forEach(function(b) {
      branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>';
    });
    var roleOpts = '';
    Object.keys(ROLE_LABELS).forEach(function(r) {
      if (r !== 'teacher' && r !== 'student' && r !== 'parent') {
        roleOpts += '<option value="' + r + '">' + escapeHTML(ROLE_LABELS[r]) + '</option>';
      }
    });
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">' +
        '<h2><i class="fa-solid fa-user-shield text-info"></i> Tizim Xodimlari (Adminlar)</h2>' +
        '<button class="btn btn-info" data-action="open-add-admin"><i class="fa-solid fa-plus"></i> Yangi Xodim</button>' +
      '</div>' +
      '<div class="table-responsive glass-card">' +
        '<table class="data-table">' +
          '<thead><tr><th>F.I.SH</th><th>Rol</th><th>Login (Email)</th><th>Filial</th><th>Telefon</th><th>Amal</th></tr></thead>' +
          '<tbody>' + rowsHTML + '</tbody>' +
        '</table>' +
      '</div>' +
      // Add Modal
      '<div class="modal-overlay" id="modal-admin-add" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Yangi Xodim Qo\'shish</h3>' +
        '<form id="form-admin-add" class="mt-3">' +
          '<div class="form-group"><label>F.I.SH</label><input type="text" id="ad-name" class="form-input" required></div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Login (Email)</label><input type="email" id="ad-email" class="form-input" required autocomplete="off"></div>' +
            '<div class="form-group"><label>Parol</label><input type="password" id="ad-pass" class="form-input" required minlength="6" autocomplete="off"></div>' +
          '</div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Rol</label><select id="ad-role" class="form-select">' + roleOpts + '</select></div>' +
            '<div class="form-group"><label>Filial</label><select id="ad-branch" class="form-select">' + branchOpts + '</select></div>' +
          '</div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="ad-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-admin-add">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-info">Saqlash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>' +
      // Edit Modal
      '<div class="modal-overlay" id="modal-admin-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Xodim Ma\'lumotlarini Tahrirlash</h3>' +
        '<form id="form-admin-edit" class="mt-3">' +
          '<input type="hidden" id="ad-edit-id">' +
          '<div class="form-group"><label>F.I.SH</label><input type="text" id="ad-edit-name" class="form-input" required></div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Login (Email)</label><input type="email" id="ad-edit-email" class="form-input" required autocomplete="off"></div>' +
            '<div class="form-group"><label>Yangi Parol (ixtiyoriy)</label><input type="password" id="ad-edit-pass" class="form-input" placeholder="O\'zgartirmaslik uchun bo\'sh qoldiring" minlength="6" autocomplete="off"></div>' +
          '</div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Rol</label><select id="ad-edit-role" class="form-select">' + roleOpts + '</select></div>' +
            '<div class="form-group"><label>Filial</label><select id="ad-edit-branch" class="form-select">' + branchOpts + '</select></div>' +
          '</div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="ad-edit-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-admin-edit">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-primary">Yangilash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>';
    delegateClicks(container, {
      'open-add-admin': function() {
        document.getElementById('form-admin-add').reset();
        openModal('modal-admin-add');
      },
      'edit-admin': function(btn) {
        var id = btn.dataset.id;
        var u = db.getById('users', id);
        if (!u) return;
        document.getElementById('ad-edit-id').value = u.id;
        document.getElementById('ad-edit-name').value = u.fullName || '';
        document.getElementById('ad-edit-email').value = u.email || '';
        document.getElementById('ad-edit-pass').value = ''; // security
        document.getElementById('ad-edit-role').value = u.role || 'branch_admin';
        document.getElementById('ad-edit-branch').value = u.branchId || 'all';
        document.getElementById('ad-edit-phone').value = u.phone || '';
        openModal('modal-admin-edit');
      },
      'close-modal': function(btn) {
        closeModal(btn.dataset.modal);
      }
    });
    var formAdd = document.getElementById('form-admin-add');
    if (formAdd) formAdd.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('ad-email').value.trim().toLowerCase();
      var pass = document.getElementById('ad-pass').value.trim();
      var phone = document.getElementById('ad-phone').value.trim();
      var existing = db.get('users').find(function(usr) { return usr.email.toLowerCase() === email; });
      if (existing) { showToast('Bu email allaqachon band!', 'error'); return; }
      db.insert('users', {
        id: crypto.randomUUID(),
        code: 'US-' + String(db.get('users').length + 1).padStart(6, '0'),
        fullName: document.getElementById('ad-name').value.trim(),
        email: email,
        passwordHash: hashPassword(pass),
        role: document.getElementById('ad-role').value,
        branchId: document.getElementById('ad-branch').value,
        phone: phone
      });
      showToast("Yangi xodim qo'shildi!", 'success');
      closeModal('modal-admin-add');
      renderAdmins();
    });
    var formEdit = document.getElementById('form-admin-edit');
    if (formEdit) formEdit.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('ad-edit-id').value;
      var email = document.getElementById('ad-edit-email').value.trim().toLowerCase();
      var newPass = document.getElementById('ad-edit-pass').value.trim();
      var existing = db.get('users').find(function(usr) { return usr.email.toLowerCase() === email && usr.id !== id; });
      if (existing) { showToast('Bu email allaqachon band!', 'error'); return; }
      var updates = {
        fullName: document.getElementById('ad-edit-name').value.trim(),
        email: email,
        role: document.getElementById('ad-edit-role').value,
        branchId: document.getElementById('ad-edit-branch').value,
        phone: document.getElementById('ad-edit-phone').value.trim()
      };
      if (newPass) {
        updates.passwordHash = hashPassword(newPass);
      }
      // Automatically update session if editing self (only name/role/branch matter mostly)
      var curr = auth.getCurrentUser();
      if (curr && curr.id === id) {
         if (newPass) curr.passwordHash = updates.passwordHash;
         curr.fullName = updates.fullName;
         curr.email = updates.email;
         curr.role = updates.role;
         curr.branchId = updates.branchId;
         // auth module will re-save session via db sync basically or manual
      }
      db.update('users', id, updates);
      showToast("Xodim ma'lumotlari yangilandi!", 'success');
      closeModal('modal-admin-edit');
      renderAdmins();
    });
  }
  // ---------- Y. BRANCHES MANAGEMENT ----------

export { renderAdmins };