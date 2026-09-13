import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderHomework() {
    var hwList = db.get('homework');
    var groups = db.get('groups');
    var container = document.getElementById('module-content');
    if (!container) return;
    var rowsHTML = '';
    hwList.forEach(function(h) {
      var grp = groups.find(function(g) { return g.id === h.groupId; });
      // SEV-3-F FIX: Calculate totalCount dynamically to prevent stale data
      var grpStudentsCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(h.groupId) && s.status === 'active'; }).length;
      var totalCount = grpStudentsCount || h.totalCount;
      rowsHTML += '<tr><td><strong>' + escapeHTML(h.title) + '</strong></td><td>' + (grp ? escapeHTML(grp.name) : '-') + '</td><td>' + escapeHTML(h.dueDate) + '</td><td><span class="badge badge-success">' + h.submittedCount + ' / ' + totalCount + ' nafar</span></td><td><strong>' + escapeHTML(h.avgGrade) + '</strong></td></tr>';
    });
    var groupOpts = '';
    groups.forEach(function(g) { groupOpts += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>'; });
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-book-open text-info"></i> Uy Vazifalari Tizimi</h2><button class="btn btn-info" data-action="open-add-hw"><i class="fa-solid fa-plus"></i> Yangi Vazifa</button></div>' +
      '<div class="table-responsive glass-card"><table class="data-table"><thead><tr><th>Topshiriq</th><th>Guruh</th><th>Muhlati</th><th>Topshirganlar</th><th>' + "O'rtacha Ball" + '</th></tr></thead><tbody>' + rowsHTML + '</tbody></table></div>' +
      '<div class="modal-overlay" id="modal-hw" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Uy Vazifasi</h3><form id="form-hw" class="mt-3"><div class="form-group"><label>Topshiriq Nomi</label><input type="text" id="hw-title" class="form-input" required></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruh</label><select id="hw-group" class="form-select">' + groupOpts + '</select></div><div class="form-group"><label>Muhlat</label><input type="date" id="hw-due" class="form-input" required></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-hw">Bekor qilish</button><button type="submit" class="btn btn-info">Saqlash</button></div></form></div></div>';
    delegateClicks(container, {
      'open-add-hw': function() { openModal('modal-hw'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); }
    });
    var form = document.getElementById('form-hw');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var gId = document.getElementById('hw-group').value;
      var studCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(gId) && s.status === 'active'; }).length;
      db.insert('homework', { id: crypto.randomUUID(), groupId: gId, title: document.getElementById('hw-title').value.trim(), dueDate: document.getElementById('hw-due').value, submittedCount: 0, totalCount: studCount || 15, avgGrade: 'Baholanmagan', status: 'pending' });
      showToast('Yangi uy vazifasi yaratildi!', 'success');
      closeModal('modal-hw');
      renderHomework();
    });
  }
  // ---------- 9. CERTIFICATES (FIX #13, + graduation gate v1.9.0) ----------

export { renderHomework };