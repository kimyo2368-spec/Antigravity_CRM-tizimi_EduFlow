import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, escapeHTML, formatCurrency, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderAiCommandCenter() {
    var students = db.get('students');
    var payments = db.get('payments', function(p) { return p && !p.cancelled; });
    var groups = db.get('groups');
    var currentMonth = new Date().toISOString().slice(0, 7);
    var monthlyRevenue = payments.filter(function(p) { return p.month === currentMonth; }).reduce(function(acc, p) { return acc + (Number(p.amount) || 0); }, 0);
    var debtors = students.filter(function(s) { return Number(s.balance) < 0; });
    var expenses = db.get('expenses', function(e) { return e.month === currentMonth; });
    var totalExpenses = expenses.reduce(function(a, e) { return a + Number(e.amount || 0); }, 0);
    var netProfit = monthlyRevenue - totalExpenses;
    var container = document.getElementById('module-content');
    if (!container) return;
    // Top kurslar hisoblash
    var courseCounts = {};
    students.forEach(function(s) {
      var stGroups = groups.filter(function(g) { return s.groupIds && s.groupIds.includes(g.id); });
      stGroups.forEach(function(grp) { courseCounts[grp.courseName] = (courseCounts[grp.courseName] || 0) + 1; });
    });
    var topCourse = Object.keys(courseCounts).sort(function(a, b) { return courseCounts[b] - courseCounts[a]; })[0];
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-robot text-purple"></i> AI Command Center</h2></div>' +
      '<div class="metrics-grid mb-4" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-users"></i></div><div class="metric-info"><span class="metric-title">Faol O\'quvchilar</span><h2 class="metric-value text-success">' + students.filter(function(s) { return s.status === 'active'; }).length + '</h2></div></div>' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-layer-group"></i></div><div class="metric-info"><span class="metric-title">Jami Guruhlar</span><h2 class="metric-value text-primary">' + groups.length + '</h2></div></div>' +
        '<div class="metric-card glass-card border-' + (netProfit >= 0 ? 'green' : 'red') + '"><div class="metric-icon icon-' + (netProfit >= 0 ? 'green' : 'red') + '"><i class="fa-solid fa-chart-line"></i></div><div class="metric-info"><span class="metric-title">Sof Foyda (' + currentMonth + ')</span><h2 class="metric-value ' + (netProfit >= 0 ? 'text-success' : 'text-danger') + '" style="font-size:18px;">' + formatCurrency(netProfit) + '</h2></div></div>' +
        '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="metric-info"><span class="metric-title">Qarzdorlar</span><h2 class="metric-value text-danger">' + debtors.length + ' nafar</h2></div></div>' +
      '</div>' +
      '<div class="glass-card"><h3><i class="fa-solid fa-brain text-purple"></i> AI Tahlil va Tavsiyalar</h3><ul style="margin-left:20px; margin-top:12px; line-height:2;">' +
        '<li>📚 Eng mashhur kurs: <strong>' + escapeHTML(topCourse || '—') + '</strong> (' + (courseCounts[topCourse] || 0) + ' o\'quvchi)</li>' +
        '<li>💰 Oylik tushum: <strong>' + formatCurrency(monthlyRevenue) + '</strong> | Xarajat: <strong>' + formatCurrency(totalExpenses) + '</strong></li>' +
        (netProfit >= 0 ? '<li class="text-success">✅ Foyda: <strong>' + formatCurrency(netProfit) + '</strong> — Tizim daromadli!</li>' : '<li class="text-danger">⚠️ Zarar: <strong>' + formatCurrency(Math.abs(netProfit)) + '</strong> — Xarajatlarni kamaytiring!</li>') +
        (debtors.length > 3 ? '<li class="text-warning">⚠️ ' + debtors.length + ' ta qarzdor — eslatma yuborish tavsiya etiladi.</li>' : '') +
        '<li>🎯 AI Tavsiyasi: ' + (topCourse ? escapeHTML(topCourse) + ' kursiga talab yuqori — yangi guruh oching!' : 'Ma\'lumot yetarli emas.') + '</li>' +
      '</ul></div>';
  }
  // ---------- 11. FINANCE — To'liq Moliyaviy Dashboard ----------

export { renderAiCommandCenter };