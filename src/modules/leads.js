import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, generateCode, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderLeads(options) {
    options = options || {};
    var leads = db.get('leads');
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;
    var stages = [
      { id: 'new', title: '🆕 Yangi Murojaatlar' },
      { id: 'contacted', title: '📞 Aloqada' },
      { id: 'trial_lesson', title: '🎯 Sinov Darsi' },
      { id: 'enrolled', title: "✅ A'zo Bo'ldi" },
      { id: 'rejected', title: "❌ Rad Etildi" }
    ];
    var stageIds = stages.map(function(s) { return s.id; });
    var columnsHTML = '';
    stages.forEach(function(st) {
      var list = leads.filter(function(l) { return l.status === st.id; });
      var cardsHTML = '';
      list.forEach(function(l) {
        var currIdx = stageIds.indexOf(l.status);
        var prevBtn = '';
        if (currIdx > 0) {
          prevBtn = '<button class="btn btn-secondary btn-xs" data-action="move-lead" data-id="' + l.id + '" data-next="' + stageIds[currIdx - 1] + '" title="Orqaga"><i class="fa-solid fa-arrow-left"></i></button>';
        }
        var nextBtn = '';
        if (currIdx < stageIds.length - 1) {
          nextBtn = '<button class="btn btn-primary btn-xs" data-action="move-lead" data-id="' + l.id + '" data-next="' + stageIds[currIdx + 1] + '" title="Keyingi"><i class="fa-solid fa-arrow-right"></i></button>';
        }
        var deleteBtn = '<button class="btn btn-danger btn-xs" data-action="delete-lead" data-id="' + l.id + '" data-name="' + escapeHTML(l.fullName) + '" title="O\'chirish"><i class="fa-solid fa-trash"></i></button>';
        cardsHTML += '<div style="background:var(--bg-input); padding:12px; border-radius:10px; display:flex; flex-direction:column; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
            '<div><strong>' + escapeHTML(l.fullName) + '</strong><br><small class="text-muted">' + escapeHTML(l.phone) + ' • ' + escapeHTML(l.subject) + '</small></div>' +
            deleteBtn +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">' +
            (prevBtn || '<span></span>') +
            (nextBtn || '<span class="badge badge-success">Yakunlandi</span>') +
          '</div>' +
        '</div>';
      });
      columnsHTML += '<div class="kanban-column glass-card" style="flex:1; min-width:240px;"><h4>' + st.title + ' (' + list.length + ')</h4><div class="kanban-cards mt-3" style="display:flex; flex-direction:column; gap:10px;">' + cardsHTML + '</div></div>';
    });
    var branchOpts = '';
    branches.forEach(function(b) { branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-filter-circle-dollar text-purple"></i> Lidlar Kanban Pipeline</h2><button class="btn btn-purple" data-action="open-add-lead"><i class="fa-solid fa-plus"></i> Yangi Lid</button></div>' +
      '<div class="kanban-board" style="display:flex; gap:16px; overflow-x:auto;">' + columnsHTML + '</div>' +
      '<div class="modal-overlay" id="modal-lead" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Lid Kiritish</h3><form id="form-lead" class="mt-3">' +
        '<div class="form-group"><label>F.I.SH.</label><input type="text" id="le-name" class="form-input" required></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="le-phone" class="form-input" required></div><div class="form-group"><label>Fan</label><input type="text" id="le-subject" class="form-input" required></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Manba</label><select id="le-source" class="form-select"><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="friend">Do\'st tavsiyasi</option><option value="banner">Banner/Reklama</option><option value="other">Boshqa</option></select></div><div class="form-group"><label>Filial</label><select id="le-branch" class="form-select">' + branchOpts + '</select></div></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-lead">Bekor qilish</button><button type="submit" class="btn btn-purple">Saqlash</button></div></form></div></div>';
    delegateClicks(container, {
      'open-add-lead': function() { openModal('modal-lead'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'move-lead': function(btn) {
        db.update('leads', btn.dataset.id, { status: btn.dataset.next });
        showToast('Lid yangi bosqichga ko\'chirildi!', 'success');
        renderLeads();
      },
      // FIX #10: Lid o'chirish
      'delete-lead': function(btn) {
        showConfirm("'" + btn.dataset.name + "' lidini o'chirishni tasdiqlaysizmi?", function() {
          db.remove('leads', btn.dataset.id);
          showToast('Lid o\'chirildi', 'warning');
          renderLeads();
        });
      }
    });
    var form = document.getElementById('form-lead');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var newPhone = document.getElementById('le-phone').value.trim();
      // FIX #6: Duplicate phone check for leads
      var existingLead = db.get('leads').find(function(l) {
        return l.phone && l.phone.replace(/[^0-9]/g, '') === newPhone.replace(/[^0-9]/g, '');
      });
      if (existingLead) {
        showToast('Bu telefon raqam allaqachon tizimda: ' + escapeHTML(existingLead.fullName) + ' (' + escapeHTML(existingLead.status) + ')', 'warning');
        return;
      }
      var code = generateCode('LEAD', 'leads');
      db.insert('leads', { id: crypto.randomUUID(), code: code, fullName: document.getElementById('le-name').value.trim(), phone: newPhone, subject: document.getElementById('le-subject').value.trim(), source: document.getElementById('le-source').value, status: 'new', branchId: document.getElementById('le-branch').value, createdAt: new Date().toISOString().split('T')[0] });
      showToast('Yangi lid kiritildi!', 'success');
      closeModal('modal-lead');
      renderLeads();
    });
    if (options.openModal) openModal('modal-lead');
  }
  // ---------- 8. HOMEWORK (FIX #12) ----------

export { renderLeads };