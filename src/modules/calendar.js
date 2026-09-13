import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, escapeHTML, getTodayDayUz, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderCalendar() {
    var groups = db.get('groups');
    var days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    var dayKeys = { 'Dushanba': 'Dush', 'Seshanba': 'Sesh', 'Chorshanba': 'Chor', 'Payshanba': 'Pay', 'Juma': 'Jum', 'Shanba': 'Shan' };
    // Barcha unique vaqt slotlarini aniqlash
    var slotSet = {};
    groups.forEach(function(g) { if (g.scheduleTime) slotSet[g.scheduleTime] = true; });
    var slots = Object.keys(slotSet).sort();
    if (slots.length === 0) slots = ['08:00 - 10:00', '10:00 - 12:00', '14:00 - 16:00', '16:30 - 18:30', '18:30 - 20:30'];
    // Xona to'qnashuvi aniqlash
    var conflicts = {};
    groups.forEach(function(g) {
      var key = g.scheduleDays + '_' + g.scheduleTime + '_' + g.room;
      if (!conflicts[key]) conflicts[key] = [];
      conflicts[key].push(g.id);
    });
    var container = document.getElementById('module-content');
    if (!container) return;
    var todayDayUz = getTodayDayUz();
    var thHTML = '<th style="min-width:120px;">KUN</th>';
    slots.forEach(function(s) { thHTML += '<th style="min-width:140px;">' + escapeHTML(s) + '</th>'; });
    var rowsHTML = '';
    days.forEach(function(day) {
      var key = dayKeys[day];
      var isToday = day === todayDayUz;
      rowsHTML += '<tr' + (isToday ? ' style="background:rgba(37,99,235,0.1);"' : '') + '>';
      rowsHTML += '<td><strong class="text-primary">' + day + (isToday ? ' <span class="badge badge-success">Bugun</span>' : '') + '</strong></td>';
      slots.forEach(function(slot) {
        var matchingGroups = groups.filter(function(g) {
          return g.scheduleTime === slot && g.scheduleDays && g.scheduleDays.includes(key);
        });
        var cellHTML = '';
        matchingGroups.forEach(function(mg) {
          var cKey = (mg.scheduleDays || '') + '_' + slot + '_' + mg.room;
          var hasConflict = conflicts[cKey] && conflicts[cKey].length > 1;
          var colors = ['rgba(37,99,235,0.15)', 'rgba(16,185,129,0.15)', 'rgba(139,92,246,0.15)', 'rgba(245,158,11,0.15)', 'rgba(239,68,68,0.15)'];
          var colorIdx = Math.abs(mg.id.charCodeAt(mg.id.length-1)) % colors.length;
          cellHTML += '<div style="background:' + (hasConflict ? 'rgba(239,68,68,0.2)' : colors[colorIdx]) + '; padding:6px 8px; border-radius:8px; margin-bottom:4px; border-left:3px solid ' + (hasConflict ? '#ef4444' : '#2563eb') + ';">' +
            '<strong style="font-size:11px;">' + escapeHTML(mg.name) + '</strong><br>' +
            '<small class="text-muted"><i class="fa-solid fa-door-open"></i> ' + escapeHTML(mg.room) + '</small>' +
            (hasConflict ? '<br><small class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Xona to\'qnashuvi!</small>' : '') +
          '</div>';
        });
        rowsHTML += '<td>' + (cellHTML || '<span class="text-muted" style="font-size:12px;">—</span>') + '</td>';
      });
      rowsHTML += '</tr>';
    });
    // O'qituvchi bo'sh vaqtlari
    var teachers = db.get('users', function(u) { return u && u.role === 'teacher'; });
    var teacherRows = '';
    teachers.forEach(function(t) {
      var myGroups = groups.filter(function(g) { return g.teacherId === t.id; });
      teacherRows += '<tr><td><strong>' + escapeHTML(t.fullName) + '</strong><br><small class="text-muted">' + escapeHTML(t.subject || '') + '</small></td><td>' + myGroups.length + ' ta guruh</td><td>' + myGroups.map(function(g) { return '<span class="badge badge-info">' + escapeHTML(g.name) + '</span>'; }).join(' ') + '</td></tr>';
    });
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-calendar-days text-primary"></i> Haftalik Dars Jadvali va Xonalar</h2></div>' +
      '<div class="table-responsive glass-card mb-4" style="overflow-x:auto;"><table class="data-table"><thead><tr>' + thHTML + '</tr></thead><tbody>' + rowsHTML + '</tbody></table></div>' +
      '<div class="glass-card"><h3><i class="fa-solid fa-chalkboard-user text-purple"></i> O\'qituvchilar Band Jadvali</h3><div class="table-responsive mt-3"><table class="data-table"><thead><tr><th>O\'qituvchi</th><th>Guruhlar soni</th><th>Guruhlar</th></tr></thead><tbody>' + teacherRows + '</tbody></table></div></div>';
  }
  // ---------- 14. MONITORING (FIX #39) ----------

export { renderCalendar };