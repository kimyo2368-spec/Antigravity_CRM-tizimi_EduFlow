import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderEmployeeAttendance() {
    var container = document.getElementById('module-content');
    if (!container) return;
    var ab = auth.getActiveBranch();
    var allUsers = db.get('users', function(u) { return (ab === 'all' || u.branchId === ab) && u.role !== 'student' && u.role !== 'parent'; });
    var empAttendance = db.get('employeeAttendance');
    // Sort users alphabetically
    allUsers.sort(function(a, b) { return a.fullName.localeCompare(b.fullName); });
    var rowsHTML = '';
    allUsers.forEach(function(u) {
      var rec = empAttendance.find(function(a) { return a.employeeId === u.id && a.date === empAttDate; });
      var status = rec ? rec.status : 'unknown';
      var timeIn = rec ? (rec.timeIn || '') : '';
      var timeOut = rec ? (rec.timeOut || '') : '';
      var selectHTML = '<select class="form-select status-select emp-att-select" data-empid="' + u.id + '" style="' +
        (status === 'present' ? 'border-color:var(--color-success); color:var(--color-success);' :
         status === 'absent' ? 'border-color:var(--color-danger); color:var(--color-danger);' :
         status === 'excused' ? 'border-color:var(--color-warning); color:var(--color-warning);' : '') + '">' +
        '<option value="unknown" ' + (status === 'unknown' ? 'selected' : '') + '>- Belgilanmagan -</option>' +
        '<option value="present" ' + (status === 'present' ? 'selected' : '') + '>Keldi</option>' +
        '<option value="absent" ' + (status === 'absent' ? 'selected' : '') + '>Kelmadi</option>' +
        '<option value="excused" ' + (status === 'excused' ? 'selected' : '') + '>Sababli</option>' +
      '</select>';
      var roleLabels = { 'teacher': 'Ustoz', 'branch_admin': 'Filial Admin', 'manager': 'Menejer', 'cashier': 'Kassir', 'call_center': 'Call Center', 'super_admin': 'Super Admin' };
      var rLabel = roleLabels[u.role] || u.role;
      rowsHTML += '<tr style="border-bottom:1px solid var(--border-color);">' +
        '<td style="padding:12px;"><strong>' + escapeHTML(u.fullName) + '</strong><br><small class="text-muted">' + rLabel + '</small></td>' +
        '<td style="padding:12px;">' + selectHTML + '</td>' +
        '<td style="padding:12px;"><input type="time" class="form-input emp-att-timein" data-empid="' + u.id + '" value="' + escapeHTML(timeIn) + '" ' + (status !== 'present' && status !== 'unknown' ? 'disabled' : '') + ' style="width:120px;"></td>' +
        '<td style="padding:12px;"><input type="time" class="form-input emp-att-timeout" data-empid="' + u.id + '" value="' + escapeHTML(timeOut) + '" ' + (status !== 'present' && status !== 'unknown' ? 'disabled' : '') + ' style="width:120px;"></td>' +
      '</tr>';
    });
    if (allUsers.length === 0) {
      rowsHTML = '<tr><td colspan="4" class="text-center" style="padding:20px;">Filialda xodimlar topilmadi.</td></tr>';
    }
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-user-clock text-purple"></i> Xodimlar Davomati</h2></div>' +
      '<div class="glass-card mb-4" style="display:flex; gap:16px; align-items:center;">' +
        '<div style="flex:1;"><label class="text-muted" style="font-size:12px; margin-bottom:4px; display:block;">Davomat Sanasi</label>' +
        '<input type="date" id="emp-att-date" class="form-input" value="' + empAttDate + '"></div>' +
      '</div>' +
      '<div class="table-responsive glass-card">' +
        '<table class="data-table" style="width:100%; border-collapse:collapse;">' +
          '<thead>' +
            '<tr style="background:rgba(255,255,255,0.05); text-align:left;">' +
              '<th style="padding:12px; font-weight:600;">Xodim</th>' +
              '<th style="padding:12px; font-weight:600; width:150px;">Holati</th>' +
              '<th style="padding:12px; font-weight:600; width:150px;">Kelgan vaqti</th>' +
              '<th style="padding:12px; font-weight:600; width:150px;">Ketgan vaqti</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsHTML + '</tbody>' +
        '</table>' +
      '</div>';
    var dateInput = document.getElementById('emp-att-date');
    if (dateInput) dateInput.addEventListener('change', function() { empAttDate = dateInput.value; renderEmployeeAttendance(); });
    // Handle updates
    function updateEmpAttendance(empId, key, value) {
      var rec = db.get('employeeAttendance').find(function(a) { return a.employeeId === empId && a.date === empAttDate; });
      if (rec) {
        var updates = {};
        updates[key] = value;
        db.update('employeeAttendance', rec.id, updates);
      } else {
        var payload = { id: crypto.randomUUID(), employeeId: empId, date: empAttDate, status: 'unknown', timeIn: '', timeOut: '' };
        payload[key] = value;
        db.insert('employeeAttendance', payload);
      }
      showToast('Saqlandi', 'info');
      // Faqat ranglarni yangilash uchun to'liq reload qilmaymiz, ux ni buzadi.
    }
    var selects = document.querySelectorAll('.emp-att-select');
    selects.forEach(function(sel) {
      sel.addEventListener('change', function() {
        updateEmpAttendance(this.dataset.empid, 'status', this.value);
        // disable time inputs if absent/excused
        var tr = this.closest('tr');
        var inInp = tr.querySelector('.emp-att-timein');
        var outInp = tr.querySelector('.emp-att-timeout');
        if (this.value === 'absent' || this.value === 'excused') {
          inInp.disabled = true; outInp.disabled = true;
          inInp.value = ''; outInp.value = '';
          updateEmpAttendance(this.dataset.empid, 'timeIn', '');
          updateEmpAttendance(this.dataset.empid, 'timeOut', '');
        } else {
          inInp.disabled = false; outInp.disabled = false;
        }
        // update color
        this.style.borderColor = this.value === 'present' ? 'var(--color-success)' : this.value === 'absent' ? 'var(--color-danger)' : this.value === 'excused' ? 'var(--color-warning)' : '';
        this.style.color = this.style.borderColor;
      });
    });
    var timeIns = document.querySelectorAll('.emp-att-timein');
    timeIns.forEach(function(inp) {
      inp.addEventListener('change', function() { updateEmpAttendance(this.dataset.empid, 'timeIn', this.value); });
    });
    var timeOuts = document.querySelectorAll('.emp-att-timeout');
    timeOuts.forEach(function(inp) {
      inp.addEventListener('change', function() { updateEmpAttendance(this.dataset.empid, 'timeOut', this.value); });
    });
  }
  // ---------- 6. PAYMENTS (Filter + Search added v1.9.0) ----------
  var paymentsPage = 1;
  var paymentsFilterMethod = 'all';
  var paymentsSearch = '';

export { renderEmployeeAttendance };