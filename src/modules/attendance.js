import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, sendTelegramNotification, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  window.attTab = window.attTab || 'daily';
  
  function renderAttendance() {
    var ab = auth.getActiveBranch();
    var groups = db.get('groups', function(g) { return g && (ab === 'all' || g.branchId === ab); });
    if (!window.attGroupId && groups.length > 0) window.attGroupId = groups[0].id;
    if (!window.attDate) window.attDate = new Date().toISOString().split('T')[0];
    if (!window.attHistoryMonth) window.attHistoryMonth = new Date().toISOString().slice(0, 7);
    
    var students = db.get('students');
    var attendanceRecords = db.get('attendance');
    var currentGroup = groups.find(function(g) { return g.id === window.attGroupId; });
    var groupStudents = students.filter(function(s) { return s.groupIds && s.groupIds.includes(window.attGroupId); });
    var container = document.getElementById('module-content');
    if (!container) return;
    
    var groupOpts = '';
    groups.forEach(function(g) { groupOpts += '<option value="' + g.id + '"' + (g.id === window.attGroupId ? ' selected' : '') + '>' + escapeHTML(g.name) + '</option>'; });
    
    var html = '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">' +
      '<h2><i class="fa-solid fa-clipboard-user text-warning"></i> Yo\'qlama Tizimi</h2>' +
      '<div class="tabs" style="display:flex; gap:8px;">' +
        '<button class="btn ' + (window.attTab === 'daily' ? 'btn-primary' : 'btn-secondary') + '" data-action="switch-att-tab" data-tab="daily">Kunlik Yo\'qlama</button>' +
        '<button class="btn ' + (window.attTab === 'monthly' ? 'btn-primary' : 'btn-secondary') + '" data-action="switch-att-tab" data-tab="monthly">Oylik Yo\'qlama va Tarix</button>' +
      '</div>' +
    '</div>';
    
    html += '<div class="glass-card mb-4" style="display:flex; gap:16px; flex-wrap:wrap;">' +
      '<div class="form-group mb-0" style="flex:1; min-width:200px;"><label>Guruhni Tanlang</label><select id="att-group-select" class="form-select">' + groupOpts + '</select></div>';
      
    if (window.attTab === 'daily') {
      html += '<div class="form-group mb-0" style="flex:1; min-width:200px;"><label>Dars Sanasi</label><input type="date" id="att-date-select" class="form-input" value="' + window.attDate + '"></div></div>';
      
      var rowsHTML = '';
      groupStudents.forEach(function(s) {
        var rec = attendanceRecords.find(function(a) { return a.groupId === window.attGroupId && a.studentId === s.id && a.date === window.attDate; });
        var status = rec ? rec.status : '';
        rowsHTML += '<tr><td><strong>' + escapeHTML(s.code) + '</strong></td><td><strong>' + escapeHTML(s.fullName) + '</strong></td><td><div style="display:flex; gap:6px; flex-wrap:wrap; min-width:160px;">' +
          '<button class="btn ' + (status === 'present' ? 'btn-success' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="present">Keldi</button>' +
          '<button class="btn ' + (status === 'absent' ? 'btn-danger' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="absent">Kelmadi</button>' +
          '<button class="btn ' + (status === 'late' ? 'btn-info' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="late">Kechikib keldi</button>' +
          '<button class="btn ' + (status === 'excused' ? 'btn-warning' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="excused">Sababli</button>' +
        '</div></td></tr>';
      });
      html += '<div class="table-responsive glass-card mb-4"><h3>' + (currentGroup ? escapeHTML(currentGroup.name) : 'Guruh') + ' — Dars Davomati</h3><table class="data-table mt-3"><thead><tr><th>ID KOD</th><th>O\'QUVCHI F.I.SH.</th><th>DAVOMAT HOLATI</th></tr></thead><tbody>' + rowsHTML + '</tbody></table></div>';
      
    } else {
      html += '<div class="form-group mb-0" style="flex:1; min-width:200px;"><label>Oyni Tanlang (Tarix)</label><input type="month" id="att-month-select" class="form-input" value="' + window.attHistoryMonth + '"></div></div>';
      
      html += '<div class="glass-card mb-4"><h3>📅 Oxirgi 12 oylik tarix (Umumiy ko\'rsatkichlar)</h3><div style="display:flex; overflow-x:auto; gap:12px; padding:12px 0;">';
      var d = new Date();
      d.setDate(1);
      for (var i = 0; i < 12; i++) {
        var mStr = d.toISOString().slice(0, 7);
        var mAtt = attendanceRecords.filter(function(a) { return a.groupId === window.attGroupId && a.date.indexOf(mStr) === 0; });
        var mTotal = mAtt.length;
        var mPres = mAtt.filter(function(a) { return a.status === 'present'; }).length;
        var mPerc = mTotal > 0 ? Math.round((mPres / mTotal) * 100) : 0;
        
        var isSelected = mStr === window.attHistoryMonth;
        var bg = isSelected ? 'var(--primary-color)' : 'rgba(0,0,0,0.05)';
        var col = isSelected ? '#fff' : 'var(--text-color)';
        html += '<div style="min-width:120px; padding:16px; border-radius:8px; text-align:center; background:' + bg + '; color:' + col + '; cursor:pointer; border:1px solid var(--border-color); user-select:none;" data-action="select-history-month" data-month="' + mStr + '">' +
          '<strong>' + mStr + '</strong><br><span style="font-size:20px; font-weight:bold;">' + mPerc + '%</span><br><small>Kelish ko\'rsatkichi</small>' +
        '</div>';
        d.setMonth(d.getMonth() - 1);
      }
      html += '</div></div>';
      
      var groupAtt = attendanceRecords.filter(function(a) { return a.groupId === window.attGroupId && a.date.indexOf(window.attHistoryMonth) === 0; });
      var totalAttRecords = groupAtt.length;
      var presentCount = groupAtt.filter(function(a) { return a.status === 'present'; }).length;
      var absentCount = groupAtt.filter(function(a) { return a.status === 'absent'; }).length;
      var lateCount = groupAtt.filter(function(a) { return a.status === 'late'; }).length;
      var excusedCount = groupAtt.filter(function(a) { return a.status === 'excused'; }).length;
      var presentPercent = totalAttRecords > 0 ? Math.round((presentCount / totalAttRecords) * 100) : 0;
      var absentPercent = totalAttRecords > 0 ? Math.round((absentCount / totalAttRecords) * 100) : 0;
      var latePercent = totalAttRecords > 0 ? Math.round((lateCount / totalAttRecords) * 100) : 0;
      var excusedPercent = totalAttRecords > 0 ? Math.round((excusedCount / totalAttRecords) * 100) : 0;
      
      var badAbsentees = [];
      groupStudents.forEach(function(s) {
        var studentAbsences = groupAtt.filter(function(a) { return a.studentId === s.id && a.status === 'absent'; }).length;
        if (studentAbsences >= 2) { badAbsentees.push({ name: s.fullName, count: studentAbsences }); }
      });
      var absenteeWarnings = '';
      if (badAbsentees.length > 0) {
        absenteeWarnings += '<div class="glass-card mt-4 border-red"><h4>⚠️ Surunkali qoldiruvchilar (' + window.attHistoryMonth + ')</h4><ul style="margin-left:20px; margin-top:8px;">';
        badAbsentees.forEach(function(ba) { absenteeWarnings += '<li class="text-danger">' + escapeHTML(ba.name) + ' — <strong>' + ba.count + ' marta</strong> kelmagan</li>'; });
        absenteeWarnings += '</ul></div>';
      }
      
      html += '<div class="glass-card"><h3>📈 Oylik Davomat Tahlili (' + window.attHistoryMonth + ')</h3>' +
        '<div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:12px;">' +
          '<div style="flex:1; min-width:140px;">🟢 Kelganlar: <strong>' + presentPercent + '%</strong> (' + presentCount + ' marta)</div>' +
          '<div style="flex:1; min-width:140px;">🔴 Kelmaganlar: <strong>' + absentPercent + '%</strong> (' + absentCount + ' marta)</div>' +
          '<div style="flex:1; min-width:140px;">🔵 Kechikkanlar: <strong>' + latePercent + '%</strong> (' + lateCount + ' marta)</div>' +
          '<div style="flex:1; min-width:140px;">🟡 Sabablilar: <strong>' + excusedPercent + '%</strong> (' + excusedCount + ' marta)</div>' +
        '</div>' +
      '</div>' + absenteeWarnings;
    }
    
    container.innerHTML = html;
    
    var grpSelect = document.getElementById('att-group-select');
    var dateInput = document.getElementById('att-date-select');
    var monthInput = document.getElementById('att-month-select');
    if (grpSelect) grpSelect.addEventListener('change', function() { window.attGroupId = grpSelect.value; renderAttendance(); });
    if (dateInput) dateInput.addEventListener('change', function() { window.attDate = dateInput.value; renderAttendance(); });
    if (monthInput) monthInput.addEventListener('change', function() { window.attHistoryMonth = monthInput.value; renderAttendance(); });
    
    delegateClicks(container, {
      'switch-att-tab': function(btn) {
        window.attTab = btn.dataset.tab;
        renderAttendance();
      },
      'select-history-month': function(btn) {
        window.attHistoryMonth = btn.dataset.month;
        renderAttendance();
      },
      'mark-att': function(btn) {
        var studentId = btn.dataset.student;
        var status = btn.dataset.status;
        var rec = db.get('attendance').find(function(a) { return a.groupId === window.attGroupId && a.studentId === studentId && a.date === window.attDate; });
        if (rec) {
          db.update('attendance', rec.id, { status: status, notified: false });
        } else {
          db.insert('attendance', { id: crypto.randomUUID(), groupId: window.attGroupId, studentId: studentId, date: window.attDate, status: status, notified: false });
        }
        showToast('Davomat belgilandi: ' + status.toUpperCase(), 'info');
        renderAttendance();
      }
    });
  }
  // ---------- X. EMPLOYEE ATTENDANCE ----------
  var empAttDate = new Date().toISOString().split('T')[0];

export { renderAttendance };