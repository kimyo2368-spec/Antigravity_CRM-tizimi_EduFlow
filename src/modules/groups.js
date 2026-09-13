import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { checkScheduleConflict, closeModal, delegateClicks, escapeHTML, formatCurrency, generateCode, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderGroups() {
    var ab = auth.getActiveBranch();
    var groups = db.get('groups', function(g) { return g && (ab === 'all' || g.branchId === ab); });
    // SEV-4-D FIX: Pre-calculate student counts for groups in O(n) instead of O(n²)
    var studentsCountMap = {};
    db.get('students').forEach(function(s) {
      if (s.groupIds) s.groupIds.forEach(function(gid) { studentsCountMap[gid] = (studentsCountMap[gid] || 0) + 1; });
    });
    var teachers = db.get('users', function(u) { return u && u.role === 'teacher'; });
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;
    var cardsHTML = '';
    groups.forEach(function(g) {
      var studCount = studentsCountMap[g.id] || 0;
      cardsHTML +=
        '<div class="group-card glass-card">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--color-primary); font-weight:800;">' + escapeHTML(g.code) + '</span><span class="badge badge-success">FAOL</span></div>' +
          '<h3 class="mt-2">' + escapeHTML(g.name) + '</h3><p class="text-muted"><i class="fa-solid fa-book"></i> ' + escapeHTML(g.courseName) + '</p>' +
          '<div class="mt-3" style="display:flex; flex-direction:column; gap:6px; font-size:13px;">' +
            "<div><i class=\"fa-solid fa-chalkboard-user\"></i> O'qituvchi: <strong>" + escapeHTML(g.teacherName) + '</strong></div>' +
            '<div><i class="fa-solid fa-calendar-days"></i> Kunlar: <strong>' + escapeHTML(g.scheduleDays) + '</strong></div>' +
            '<div><i class="fa-solid fa-clock"></i> Vaqt: <strong>' + escapeHTML(g.scheduleTime) + '</strong></div>' +
            '<div><i class="fa-solid fa-door-open"></i> Xona: <strong>' + escapeHTML(g.room) + '</strong></div>' +
            "<div><i class=\"fa-solid fa-users\"></i> O'quvchilar: <strong>" + studCount + ' / ' + g.capacity + '</strong></div>' +
          '</div>' +
          '<div class="mt-4 pt-3" style="border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
            '<strong>' + formatCurrency(g.monthlyFee) + ' / oy</strong>' +
            '<div style="display:flex; gap:6px;">' +
              '<button class="btn btn-secondary btn-xs" data-action="navigate" data-route="attendance">Davomat</button>' +
              '<button class="btn btn-success btn-xs" data-action="assign-student" data-id="' + g.id + '" title="O\'quvchi biriktirish"><i class="fa-solid fa-user-plus"></i></button>' +
              '<button class="btn btn-info btn-xs" data-action="edit-group" data-id="' + g.id + '"><i class="fa-solid fa-pen"></i></button>' +
              '<button class="btn btn-danger btn-xs" data-action="delete-group" data-id="' + g.id + '" data-name="' + escapeHTML(g.name) + '" data-count="' + studCount + '"><i class="fa-solid fa-trash"></i></button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    var teacherOpts = '';
    teachers.forEach(function(t) { teacherOpts += '<option value="' + t.id + '" data-name="' + escapeHTML(t.fullName) + '">' + escapeHTML(t.fullName) + '</option>'; });
    var branchOpts = '';
    branches.forEach(function(b) { branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });
    // FIX #20: 'Shor'→'Chor' typo fixed
    var daysOpts = '<option value="Dush-Chor-Jum">Dush-Chor-Jum (Dushanba, Chorshanba, Juma)</option><option value="Sesh-Pay-Shan">Sesh-Pay-Shan (Seshanba, Payshanba, Shanba)</option><option value="Har kun">Har kun</option><option value="Dush-Sesh-Chor-Pay-Jum">Hafta kunlari (5 kun)</option>';
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-layer-group text-primary"></i> Guruhlar va Dars Jadvallari</h2><button class="btn btn-primary" data-action="open-add-group"><i class="fa-solid fa-plus"></i> Yangi Guruh</button></div>' +
      '<div class="groups-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">' + cardsHTML + '</div>' +
      // Add group modal
      '<div class="modal-overlay" id="modal-group" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Guruh Yaratish</h3><form id="form-group" class="mt-3">' +
        '<div class="form-group"><label>Guruh Nomi</label><input type="text" id="gr-name" class="form-input" required placeholder="IELTS Intensive"></div>' +
        '<div class="form-group"><label>Kurs Nomi</label><input type="text" id="gr-course" class="form-input" required placeholder="Ingliz tili (IELTS)"></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>' + "O'qituvchi" + '</label><select id="gr-teacher" class="form-select">' + teacherOpts + '</select></div><div class="form-group"><label>Filial</label><select id="gr-branch" class="form-select">' + branchOpts + '</select></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Kunlar</label><select id="gr-days" class="form-select">' + daysOpts + '</select></div><div class="form-group"><label>Vaqt</label><input type="text" id="gr-time" class="form-input" placeholder="14:00 - 16:00"></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;"><div class="form-group"><label>Xona</label><input type="text" id="gr-room" class="form-input" placeholder="Xona 102"></div><div class="form-group"><label>Oylik narx</label><input type="number" id="gr-fee" class="form-input" value="600000"></div><div class="form-group"><label>Sig\'imi</label><input type="number" id="gr-cap" class="form-input" value="15"></div></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-group">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Edit group modal
      '<div class="modal-overlay" id="modal-group-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Guruhni Tahrirlash</h3><form id="form-group-edit" class="mt-3"><input type="hidden" id="gr-edit-id">' +
        '<div class="form-group"><label>Guruh Nomi</label><input type="text" id="gr-edit-name" class="form-input" required></div>' +
        '<div class="form-group"><label>Kurs Nomi</label><input type="text" id="gr-edit-course" class="form-input" required></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>O\'qituvchi</label><select id="gr-edit-teacher" class="form-select">' + teacherOpts + '</select></div><div class="form-group"><label>Kunlar</label><select id="gr-edit-days" class="form-select">' + daysOpts + '</select></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Vaqt</label><input type="text" id="gr-edit-time" class="form-input"></div><div class="form-group"><label>Xona</label><input type="text" id="gr-edit-room" class="form-input"></div></div>' +
        '<div class="form-group"><label>Oylik narx</label><input type="number" id="gr-edit-fee" class="form-input"></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-group-edit">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Assign student modal
      '<div class="modal-overlay" id="modal-assign-student" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Guruhga O\'quvchi Biriktirish</h3><form id="form-assign-student" class="mt-3"><input type="hidden" id="as-group-id">' +
        '<div class="form-group"><label>O\'quvchi</label><select id="as-student-id" class="form-select" required></select></div>' +
        '<div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-assign-student">Bekor qilish</button><button type="submit" class="btn btn-primary">Biriktirish</button></div></form></div></div>';
    delegateClicks(container, {
      'open-add-group': function() { openModal('modal-group'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'navigate': function(btn) { window.eduFlowApp.navigate(btn.dataset.route); },
      'assign-student': function(btn) {
        var gid = btn.dataset.id;
        var g = db.getById('groups', gid);
        if (!g) return;
        document.getElementById('as-group-id').value = gid;
        var allStudents = db.get('students', function(s) { return !s.groupIds || !s.groupIds.includes(gid); });
        var opts = '<option value="">-- O\'quvchini tanlang --</option>';
        allStudents.forEach(function(s) { opts += '<option value="' + s.id + '">' + escapeHTML(s.fullName) + ' (' + escapeHTML(s.code) + ')</option>'; });
        document.getElementById('as-student-id').innerHTML = opts;
        openModal('modal-assign-student');
      },
      // FIX: Edit group
      'edit-group': function(btn) {
        var g = db.getById('groups', btn.dataset.id);
        if (!g) return;
        document.getElementById('gr-edit-id').value = g.id;
        document.getElementById('gr-edit-name').value = g.name || '';
        document.getElementById('gr-edit-course').value = g.courseName || '';
        document.getElementById('gr-edit-days').value = g.scheduleDays || '';
        document.getElementById('gr-edit-time').value = g.scheduleTime || '';
        document.getElementById('gr-edit-room').value = g.room || '';
        document.getElementById('gr-edit-fee').value = g.monthlyFee || 600000;
        var editTeacherEl = document.getElementById('gr-edit-teacher');
        if (editTeacherEl) editTeacherEl.value = g.teacherId || '';
        openModal('modal-group-edit');
      },
      // FIX: Delete group
      'delete-group': function(btn) {
        var count = parseInt(btn.dataset.count || '0');
        var msg = count > 0 ? "'" + btn.dataset.name + "' guruhida " + count + " nafar o'quvchi bor. O'chirishni tasdiqlaysizmi?" : "'" + btn.dataset.name + "' guruhini o'chirishni tasdiqlaysizmi?";
        showConfirm(msg, function() {
          var gid = btn.dataset.id;
          db.remove('groups', gid);
          // SEV-3-C FIX: Unassign students when their group is deleted
          var studentsInGroup = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(gid); });
          studentsInGroup.forEach(function(s) {
            var newGroupIds = s.groupIds.filter(function(id) { return id !== gid; });
            db.update('students', s.id, { groupIds: newGroupIds });
          });
          showToast('Guruh o\'chirildi', 'warning');
          renderGroups();
        });
      }
    });
    var form = document.getElementById('form-group');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var teacherEl = document.getElementById('gr-teacher');
      var selOpt = teacherEl.options[teacherEl.selectedIndex];
      var name = document.getElementById('gr-name').value.trim();
      var course = document.getElementById('gr-course').value.trim();
      var teacherId = teacherEl.value;
      var branchId = document.getElementById('gr-branch').value;
      var days = document.getElementById('gr-days').value;
      var time = document.getElementById('gr-time').value.trim();
      var room = document.getElementById('gr-room').value.trim();
      var fee = Number(document.getElementById('gr-fee').value) || 600000;
      var cap = Number(document.getElementById('gr-cap').value) || 15;
      var conflictMsg = checkScheduleConflict(days, time, room, teacherId);
      function saveGroup() {
        var code = generateCode('GROUP', 'groups');
        db.insert('groups', { id: crypto.randomUUID(), code: code, name: name, courseName: course, teacherId: teacherId, teacherName: selOpt ? selOpt.dataset.name || selOpt.text : '', branchId: branchId, scheduleDays: days, scheduleTime: time, room: room, monthlyFee: fee, capacity: cap });
        showToast('Yangi guruh yaratildi!', 'success');
        closeModal('modal-group');
        renderGroups();
      }
      if (conflictMsg) {
        showConfirm(conflictMsg + "\n\nBaribir ushbu jadvalni saqlamoqchimisiz?", function() {
          saveGroup();
        });
      } else {
        saveGroup();
      }
    });
    var editForm = document.getElementById('form-group-edit');
    if (editForm) editForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('gr-edit-id').value;
      var name = document.getElementById('gr-edit-name').value.trim();
      var course = document.getElementById('gr-edit-course').value.trim();
      var days = document.getElementById('gr-edit-days').value;
      var time = document.getElementById('gr-edit-time').value.trim();
      var room = document.getElementById('gr-edit-room').value.trim();
      var fee = Number(document.getElementById('gr-edit-fee').value) || 600000;
      // FIX #10: Read teacher from updated select
      var editTeacherEl = document.getElementById('gr-edit-teacher');
      var teacherId = editTeacherEl ? editTeacherEl.value : (db.getById('groups', id) || {}).teacherId || '';
      var selTeacherOpt = editTeacherEl ? editTeacherEl.options[editTeacherEl.selectedIndex] : null;
      var teacherName = selTeacherOpt ? (selTeacherOpt.dataset.name || selTeacherOpt.text) : '';
      var conflictMsg = checkScheduleConflict(days, time, room, teacherId, id);
      function updateGroup() {
        db.update('groups', id, {
          name: name,
          courseName: course,
          teacherId: teacherId,
          teacherName: teacherName,
          scheduleDays: days,
          scheduleTime: time,
          room: room,
          monthlyFee: fee
        });
        showToast('Guruh ma\'lumotlari yangilandi!', 'success');
        closeModal('modal-group-edit');
        renderGroups();
      }
      if (conflictMsg) {
        showConfirm(conflictMsg + "\n\nBaribir ushbu jadvalni saqlamoqchimisiz?", function() {
          updateGroup();
        });
      } else {
        updateGroup();
      }
    });
    var formAssign = document.getElementById('form-assign-student');
    if (formAssign) formAssign.addEventListener('submit', function(e) {
      e.preventDefault();
      var gid = document.getElementById('as-group-id').value;
      var sid = document.getElementById('as-student-id').value;
      if (!sid) { showToast("O'quvchini tanlang!", 'warning'); return; }
      db.update('students', sid, { groupId: gid });
      showToast("O'quvchi guruhga biriktirildi!", 'success');
      closeModal('modal-assign-student');
      renderGroups();
    });
  }
  // ---------- 4. TEACHERS (Edit + Custom Password added) ----------

export { renderGroups };