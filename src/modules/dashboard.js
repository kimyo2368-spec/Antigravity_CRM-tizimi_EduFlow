import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, getDayScheduleKey, getTodayDayUz, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderDashboard() {
    var ab = auth.getActiveBranch();
    var allStudents = db.get('students', function(s) { return s && (ab === 'all' || s.branchId === ab); });
    var allTeachers = db.get('users', function(u) { return u && u.role === 'teacher' && (ab === 'all' || u.branchId === ab); });
    var allGroups = db.get('groups', function(g) { return g && (ab === 'all' || g.branchId === ab); });
    var allPayments = db.get('payments', function(p) { return p && !p.cancelled && (ab === 'all' || p.branchId === ab); });
    var todayStr = new Date().toISOString().split('T')[0];
    var currentMonth = todayStr.slice(0, 7);
    // SEV-3-D FIX: Exclude 'adjust' from revenue
    var todayPayments = allPayments.filter(function(p) { return p.date === todayStr && p.paymentMethod !== 'adjust'; });
    var todayRevenue = todayPayments.reduce(function(acc, p) { return acc + (Number(p.amount) || 0); }, 0);
    // FIX #22: Monthly revenue (not all-time)
    var monthlyPayments = allPayments.filter(function(p) { return p.month === currentMonth && p.paymentMethod !== 'adjust'; });
    var monthlyRevenue = monthlyPayments.reduce(function(acc, p) { return acc + (Number(p.amount) || 0); }, 0);
    var activeStudentsCount = allStudents.filter(function(s) { return s.status === 'active'; }).length;
    var totalDebtors = [];
    var debtorsSum = 0;
    allStudents.forEach(function(s) {
      var sTotalDebt = 0;
      if (s.groupBalances) {
        Object.keys(s.groupBalances).forEach(function(k) {
          if (s.groupBalances[k] < 0) sTotalDebt += Math.abs(s.groupBalances[k]);
        });
      }
      if (sTotalDebt > 0) {
        totalDebtors.push(s);
        debtorsSum += sTotalDebt;
      }
    });
    // FIX #21: Real today's lessons count
    var todayDayUz = getTodayDayUz();
    var todayDayKey = getDayScheduleKey(todayDayUz);
    var todayLessons = allGroups.filter(function(g) {
      return g.scheduleDays && g.scheduleDays.includes(todayDayKey);
    });
    var container = document.getElementById('module-content');
    if (!container) return;
    var currentUser = auth.getCurrentUser();
    var isTeacher = currentUser && currentUser.role === 'teacher';
    var isFinanceOrAdmin = currentUser && (currentUser.role === 'finance' || currentUser.role === 'super_admin');
    if (isTeacher) {
      var tGroups = allGroups.filter(function(g) { return g.teacherId === currentUser.id; });
      var tStudentsCount = 0;
      var estSalary = 0;
      var sType = currentUser.salaryType || 'percent';
      var sVal = Number(currentUser.salaryValue !== undefined ? currentUser.salaryValue : (currentUser.salaryPercentage !== undefined ? currentUser.salaryPercentage : 40));
      if (sType === 'fixed') {
        estSalary = sVal;
      }
      tGroups.forEach(function(g) {
        var groupStudentsCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(g.id) && s.status === 'active'; }).length;
        tStudentsCount += groupStudentsCount;
        if (sType === 'percent') {
          estSalary += groupStudentsCount * Number(g.monthlyFee || 600000) * (sVal / 100);
        }
      });
      var salaryLabel = sType === 'fixed' ? 'Doimiy maosh' : ('Taxminiy oylik (' + sVal + '%)');
      var attendanceRecordsT = db.get('attendance', function(a) { return a.date === todayStr; });
      var unmarkedLessonsT = tGroups.filter(function(g) {
        return g.scheduleDays && g.scheduleDays.includes(todayDayKey) && !attendanceRecordsT.some(function(a) { return a.groupId === g.id; });
      });
      var tAlerts = [];
      if (unmarkedLessonsT.length > 0) {
        tAlerts.push('<div style="color:#2563eb; background:rgba(37,99,235,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-clipboard-user"></i> <span><strong>Davomat olinmagan:</strong> Bugungi ' + unmarkedLessonsT.length + ' ta guruhingiz uchun davomat hali olinmagan.</span></div>');
      }
      var tAlertsHTML = '';
      if (tAlerts.length > 0) {
        tAlertsHTML = '<div class="glass-card mt-4" style="border: 1px solid var(--border-color);">' +
          '<h3><i class="fa-solid fa-bell text-danger"></i> Tizim Ogohlantirishlari</h3>' +
          '<div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">' + tAlerts.join('') + '</div>' +
        '</div>';
      }
      container.innerHTML =
        '<div class="metrics-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:20px;">' +
          '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-layer-group"></i></div><div class="metric-info"><span class="metric-title">Mening guruhlarim</span><h2 class="metric-value">' + tGroups.length + ' ta</h2></div></div>' +
          '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-user-graduate"></i></div><div class="metric-info"><span class="metric-title">Mening o\'quvchilarim</span><h2 class="metric-value">' + tStudentsCount + ' nafar</h2></div></div>' +
          '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-money-bill-wave"></i></div><div class="metric-info"><span class="metric-title">' + salaryLabel + '</span><h2 class="metric-value text-success">' + formatCurrency(estSalary) + '</h2></div></div>' +
          '<div class="metric-card glass-card border-warning"><div class="metric-icon icon-warning" style="background:rgba(245,158,11,0.15); color:var(--color-warning);"><i class="fa-solid fa-calendar-day"></i></div><div class="metric-info"><span class="metric-title">Bugungi darslarim</span><h2 class="metric-value">' + tGroups.filter(function(g) { return g.scheduleDays && g.scheduleDays.includes(todayDayKey); }).length + ' ta</h2><span class="metric-sub text-warning">' + todayDayUz + '</span></div></div>' +
        '</div>' +
        tAlertsHTML +
        '<div class="quick-actions-bar glass-card mt-4">' +
          '<h3><i class="fa-solid fa-bolt text-warning"></i> Tezkor Harakatlar</h3>' +
          '<div class="quick-buttons mt-2" style="display:flex; gap:12px; flex-wrap:wrap;">' +
            '<button class="btn btn-warning" data-action="navigate" data-route="attendance"><i class="fa-solid fa-clipboard-user"></i> Davomat Olish</button>' +
            '<button class="btn btn-primary" data-action="navigate" data-route="groups"><i class="fa-solid fa-layer-group"></i> Guruhlarimni Ko\'rish</button>' +
          '</div>' +
        '</div>';
      delegateClicks(container, {
        navigate: function(btn) {
          window.eduFlowApp.navigate(btn.dataset.route, { openModal: btn.dataset.openModal === 'true' });
        }
      });
      return;
    }
    // DYNAMIC ALERTS & NOTIFICATIONS
    var alerts = [];
    // 1. Qarzdorlar tahlili (Only for finance/admin)
    if (isFinanceOrAdmin) {
      var criticalDebtors = allStudents.filter(function(s) {
        var debt = 0;
        if (s.groupBalances) {
          Object.keys(s.groupBalances).forEach(function(k) {
            if (s.groupBalances[k] < 0) debt += Math.abs(s.groupBalances[k]);
          });
        }
        return debt >= 300000;
      });
      if (criticalDebtors.length > 0) {
        alerts.push('<div style="color:#ef4444; background:rgba(239,68,68,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-triangle-exclamation"></i> <span><strong>Kritik qarzdorlar:</strong> ' + criticalDebtors.length + ' nafar o\'quvchi 300,000 so\'mdan ko\'p qarzga ega.</span></div>');
      }
    }
    // 2. Inactive leads (>3 kun yangi bosqichda qolib ketgan)
    var threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    var oldLeads = db.get('leads', function(l) {
      return l.status === 'new' && l.createdAt && new Date(l.createdAt) < threeDaysAgo;
    });
    if (oldLeads.length > 0) {
      alerts.push('<div style="color:#f59e0b; background:rgba(245,158,11,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-clock"></i> <span><strong>Eski lidlar:</strong> ' + oldLeads.length + ' ta yangi lid 3 kundan beri javobsiz qolmoqda.</span></div>');
    }
    // 3. Xona to'qnashuvi (conflict)
    var roomConflicts = 0;
    var conflictsMap = {};
    allGroups.forEach(function(g) {
      var key = g.scheduleDays + '_' + g.scheduleTime + '_' + g.room;
      if (!conflictsMap[key]) conflictsMap[key] = [];
      conflictsMap[key].push(g.id);
    });
    Object.keys(conflictsMap).forEach(function(k) {
      if (conflictsMap[k].length > 1) roomConflicts++;
    });
    if (roomConflicts > 0) {
      alerts.push('<div style="color:#ef4444; background:rgba(239,68,68,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-circle-exclamation"></i> <span><strong>Dars jadvali:</strong> Kalendarda ' + roomConflicts + ' ta xona to\'qnashuvi (conflict) aniqlandi!</span></div>');
    }
    // 4. Davomat olinmagan bugungi darslar
    var attendanceRecords = db.get('attendance', function(a) { return a.date === todayStr; });
    var unmarkedLessons = todayLessons.filter(function(g) {
      return !attendanceRecords.some(function(a) { return a.groupId === g.id; });
    });
    if (unmarkedLessons.length > 0) {
      alerts.push('<div style="color:#2563eb; background:rgba(37,99,235,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-clipboard-user"></i> <span><strong>Davomat olinmagan:</strong> Bugungi ' + unmarkedLessons.length + ' ta guruh uchun davomat hali olinmagan.</span></div>');
    }
    var alertsHTML = '';
    if (alerts.length > 0) {
      alertsHTML = '<div class="glass-card mt-4" style="border: 1px solid var(--border-color);">' +
        '<h3><i class="fa-solid fa-bell text-danger"></i> Tizim Ogohlantirishlari (' + alerts.length + ')</h3>' +
        '<div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">' + alerts.join('') + '</div>' +
      '</div>';
    }
    // SEV-4-A FIX: O(n²) → O(n) using Map-based pre-grouping
    var attendance = db.get('attendance') || [];
    var activeStudents = allStudents.filter(function(s) { return s.status === 'active'; });
    // Build attendance lookup Map: studentId → {present, absent, total}
    var attMap = {};
    attendance.forEach(function(a) {
      if (!attMap[a.studentId]) attMap[a.studentId] = { present: 0, absent: 0 };
      if (a.status === 'present') attMap[a.studentId].present++;
      else if (a.status === 'absent') attMap[a.studentId].absent++;
    });
    var studentStats = activeStudents.map(function(s) {
      var rec = attMap[s.id] || { present: 0, absent: 0 };
      var total = rec.present + rec.absent;
      var rate = total > 0 ? Math.round((rec.present / total) * 100) : 100;
      return { student: s, rate: rate, present: rec.present, absent: rec.absent, total: total };
    });
    var leaderboard = studentStats.slice()
      .sort(function(a, b) { return b.rate - a.rate; })
      .slice(0, 5);
    var redZone = studentStats.slice()
      .filter(function(x) { return x.rate < 75 && x.absent > 0; })
      .sort(function(a, b) { return a.rate - b.rate; })
      .slice(0, 5);
    var leaderboardHTML = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">';
    leaderboard.forEach(function(item, idx) {
      var medals = ['🥇', '🥈', '🥉', '🎖️', '🎖️'];
      leaderboardHTML += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px;">' +
        '<div style="display:flex; gap:10px; align-items:center;">' +
          '<span style="font-size:16px;">' + medals[idx] + '</span>' +
          '<div><strong>' + escapeHTML(item.student.fullName) + '</strong><br><small class="text-muted">' + item.student.code + '</small></div>' +
        '</div>' +
        '<span class="badge badge-success">' + item.rate + '% kelgan</span>' +
      '</div>';
    });
    if (leaderboard.length === 0) leaderboardHTML += '<p class="text-muted" style="font-size:13px;">Hozircha ma\'lumot yo\'q</p>';
    leaderboardHTML += '</div>';
    var redZoneHTML = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">';
    redZone.forEach(function(item) {
      var waLink = 'https://wa.me/' + encodeURIComponent((item.student.phone || '').replace(/[^0-9+]/g,'')) + '?text=' + encodeURIComponent('Assalomu alaykum! Hurmatli ota-ona, o\'g\'lingiz/qizingiz ' + item.student.fullName + ' darslarni muntazam qoldirmoqda (Davomati: ' + item.rate + '%). Iltimos, o\'quv markazi bilan bog\'laning.');
      redZoneHTML += '<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239,68,68,0.05); padding:8px 12px; border-radius:8px; border-left:3px solid var(--color-danger);">' +
        '<div>' +
          '<strong>' + escapeHTML(item.student.fullName) + '</strong><br>' +
          '<small class="text-danger">Davomat: ' + item.rate + '% (' + item.absent + ' marta kelmagan)</small>' +
        '</div>' +
        '<div style="display:flex; gap:6px;">' +
          '<a href="tel:' + item.student.phone + '" class="btn btn-secondary btn-xs" title="Qo\'ng\'iroq qilish"><i class="fa-solid fa-phone"></i></a>' +
          '<a href="' + waLink + '" target="_blank" class="btn btn-success btn-xs" title="WhatsApp xabar"><i class="fa-brands fa-whatsapp"></i></a>' +
        '</div>' +
      '</div>';
    });
    if (redZone.length === 0) redZoneHTML += '<p class="text-muted" style="font-size:13px;">Hozircha dars qoldirgan talabalar yo\'q. Ajoyib! 🎉</p>';
    redZoneHTML += '</div>';
    // SEV-5-G FIX: Compute real AI advice from actual enrollment data
    var courseDemand = {};
    allStudents.forEach(function(s) {
      if (s.status !== 'active') return;
      var stGroups = allGroups.filter(function(g) { return s.groupIds && s.groupIds.includes(g.id); });
      stGroups.forEach(function(grp) { courseDemand[grp.courseName] = (courseDemand[grp.courseName] || 0) + 1; });
    });
    var topCourseName = 'Kurs';
    var topCourseCount = 0;
    Object.keys(courseDemand).forEach(function(c) {
      if (courseDemand[c] > topCourseCount) { topCourseCount = courseDemand[c]; topCourseName = c; }
    });
    var debitorsPct = allStudents.length > 0 ? Math.round((totalDebtors.length / allStudents.length) * 100) : 0;
    var aiAdviceTitle = totalDebtors.length > 3 ? 'Qarzdorlarni chaqiring' : (topCourseCount > 8 ? "Yangi guruh oching" : 'Jadval optimallang');
    var aiAdviceSub = totalDebtors.length > 3 ? debitorsPct + "% qarzdor (" + totalDebtors.length + " nafar)" : (topCourseCount > 8 ? escapeHTML(topCourseName) + ' — ' + topCourseCount + " o'quvchi" : allGroups.length + ' guruh, ' + allTeachers.length + " o'qituvchi");
    var financialCards = isFinanceOrAdmin ?
      '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-cash-register"></i></div><div class="metric-info"><span class="metric-title">' + "💰 Bugungi tushum" + '</span><h2 class="metric-value text-success">' + formatCurrency(todayRevenue) + '</h2><span class="metric-sub text-success">' + todayPayments.length + " ta to'lov" + '</span></div></div>' +
      '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-wallet"></i></div><div class="metric-info"><span class="metric-title">📈 Oylik tushum</span><h2 class="metric-value">' + formatCurrency(monthlyRevenue) + '</h2><span class="metric-sub text-success">' + currentMonth + ' uchun</span></div></div>' +
      '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="metric-info"><span class="metric-title">⚠️ Qarzdorlar</span><h2 class="metric-value text-danger">' + formatCurrency(debtorsSum) + '</h2><span class="metric-sub text-danger">' + totalDebtors.length + ' nafar qarzdor</span></div></div>' : '';

    var financeAction = isFinanceOrAdmin ? '<button class="btn btn-success" data-action="navigate" data-route="payments" data-open-modal="true"><i class="fa-solid fa-cash-register"></i> ' + "To'lov Qabul Qilish" + '</button>' : '';

    container.innerHTML =
      '<div class="metrics-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:20px;">' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-user-graduate"></i></div><div class="metric-info"><span class="metric-title">' + "👨‍🎓 O'quvchilar" + '</span><h2 class="metric-value">' + activeStudentsCount + ' nafar</h2><span class="metric-sub text-success">Jami: ' + allStudents.length + ' ta</span></div></div>' +
        '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-chalkboard-user"></i></div><div class="metric-info"><span class="metric-title">' + "👨‍🏫 O'qituvchilar" + '</span><h2 class="metric-value">' + allTeachers.length + ' nafar</h2><span class="metric-sub text-purple">Malakali mutaxassislar</span></div></div>' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-layer-group"></i></div><div class="metric-info"><span class="metric-title">👥 Guruhlar</span><h2 class="metric-value">' + allGroups.length + ' ta guruh</h2><span class="metric-sub text-muted">' + "Barcha yo'nalishlar" + '</span></div></div>' +
        financialCards +
        '<div class="metric-card glass-card border-warning"><div class="metric-icon icon-warning" style="background:rgba(245,158,11,0.15); color:var(--color-warning);"><i class="fa-solid fa-calendar-day"></i></div><div class="metric-info"><span class="metric-title">📅 Bugungi darslar</span><h2 class="metric-value">' + todayLessons.length + ' ta dars</h2><span class="metric-sub text-warning">' + todayDayUz + '</span></div></div>' +
        '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div class="metric-info"><span class="metric-title">🤖 AI Tavsiyasi</span><h2 class="metric-value" style="font-size:16px;">' + aiAdviceTitle + '</h2><span class="metric-sub text-purple">' + aiAdviceSub + '</span></div></div>' +
      '</div>' +
      '<div class="quick-actions-bar glass-card mt-4">' +
        '<h3><i class="fa-solid fa-bolt text-warning"></i> Tezkor Harakatlar</h3>' +
        '<div class="quick-buttons mt-2" style="display:flex; gap:12px; flex-wrap:wrap;">' +
          '<button class="btn btn-primary" data-action="navigate" data-route="students" data-open-modal="true"><i class="fa-solid fa-user-plus"></i> ' + "Yangi O'quvchi" + '</button>' +
          financeAction +
          '<button class="btn btn-warning" data-action="navigate" data-route="attendance"><i class="fa-solid fa-clipboard-user"></i> Davomat Olish</button>' +
          '<button class="btn btn-purple" data-action="navigate" data-route="leads" data-open-modal="true"><i class="fa-solid fa-filter-circle-dollar"></i> Yangi Lid Kiritish</button>' +
        '</div>' +
      '</div>' +
      alertsHTML +
      '<div class="dashboard-grid mt-4" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">' +
        '<div class="glass-card"><h3><i class="fa-solid fa-trophy text-warning"></i> A\'lochi O\'quvchilar (Leaderboard)</h3>' + leaderboardHTML + '</div>' +
        '<div class="glass-card"><h3 class="text-danger"><i class="fa-solid fa-user-slash"></i> Xavfli Zona (Dars qoldirganlar)</h3>' + redZoneHTML + '</div>' +
      '</div>';
    delegateClicks(container, {
      navigate: function(btn) {
        window.eduFlowApp.navigate(btn.dataset.route, { openModal: btn.dataset.openModal === 'true' });
      }
    });
  }
  // ---------- 2. STUDENTS (Edit+Search added) ----------
  var studentsPage = 1;
  var studentsSearch = '';

export { renderDashboard };