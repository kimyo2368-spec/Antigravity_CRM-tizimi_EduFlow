import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderFinance() {
    var container = document.getElementById('module-content');
    if (!container) return;
    var currentMonth = new Date().toISOString().slice(0, 7);
    var allPayments = db.get('payments', function(p) { return p && !p.cancelled; });
    var expenses = db.get('expenses') || [];
    var students = db.get('students');
    // Oylar ro'yxati
    var months = {};
    allPayments.forEach(function(p) { if (p.month) months[p.month] = true; });
    expenses.forEach(function(e) { if (e.month) months[e.month] = true; });
    var sortedMonths = Object.keys(months).sort().slice(-6); // Oxirgi 6 oy
    // Joriy oy hisobi
    var monthPayments = allPayments.filter(function(p) { return p.month === currentMonth; });
    var monthExpenses = expenses.filter(function(e) { return e.month === currentMonth; });
    var totalRevenue = monthPayments.reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
    var totalExpenses = monthExpenses.reduce(function(a, e) { return a + Number(e.amount || 0); }, 0);
    var netProfit = totalRevenue - totalExpenses;
    var debtors = students.filter(function(s) { return Number(s.balance) < 0; });
    var totalDebt = debtors.reduce(function(a, s) { return a + Math.abs(Number(s.balance)); }, 0);
    // To'lov usullari
    var methodCounts = { cash: 0, click: 0, card: 0 };
    monthPayments.forEach(function(p) { if (methodCounts[p.paymentMethod] !== undefined) methodCounts[p.paymentMethod] += Number(p.amount || 0); });
    // Xarajatlar breakdown
    var expBreakdown = {};
    monthExpenses.forEach(function(e) { expBreakdown[e.category] = (expBreakdown[e.category] || 0) + Number(e.amount || 0); });
    // Canvas grafik uchun ma'lumot
    var chartBars = sortedMonths.map(function(m) {
      var rev = allPayments.filter(function(p) { return p.month === m; }).reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
      var exp = expenses.filter(function(e) { return e.month === m; }).reduce(function(a, e) { return a + Number(e.amount || 0); }, 0);
      return { month: m, rev: rev, exp: exp };
    });
    var maxVal = chartBars.reduce(function(a, b) { return Math.max(a, b.rev, b.exp); }, 1);
    var barsHTML = chartBars.map(function(b) {
      var revH = Math.round((b.rev / maxVal) * 120);
      var expH = Math.round((b.exp / maxVal) * 120);
      return '<div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; min-width:60px;">' +
        '<div style="display:flex; align-items:flex-end; gap:3px; height:130px;">' +
          '<div style="width:18px; height:' + revH + 'px; background:var(--color-success); border-radius:4px 4px 0 0;" title="Tushum: ' + formatCurrency(b.rev) + '"></div>' +
          '<div style="width:18px; height:' + expH + 'px; background:var(--color-danger); border-radius:4px 4px 0 0;" title="Xarajat: ' + formatCurrency(b.exp) + '"></div>' +
        '</div>' +
        '<small style="font-size:10px; color:var(--text-muted);">' + b.month.slice(5) + '/' + b.month.slice(2,4) + '</small>' +
      '</div>';
    }).join('');
    var methodHTML = '<div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">' +
      '<div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; background:#10b981; border-radius:50%;"></div> Naqd: <strong>' + formatCurrency(methodCounts.cash) + '</strong></div>' +
      '<div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; background:#2563eb; border-radius:50%;"></div> Click/Payme: <strong>' + formatCurrency(methodCounts.click) + '</strong></div>' +
      '<div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; background:#8b5cf6; border-radius:50%;"></div> Terminal: <strong>' + formatCurrency(methodCounts.card) + '</strong></div>' +
    '</div>';
    // Xarajat kategoriyalari
    var catLabels = { ijara: '🏢 Ijara', kommunal: '💡 Kommunal', marketing: '📢 Marketing', maosh: '👩‍💼 Maosh', boshqa: '📦 Boshqa' };
    var expRows = Object.keys(expBreakdown).map(function(cat) {
      return '<tr><td>' + (catLabels[cat] || escapeHTML(cat)) + '</td><td class="text-danger"><strong>' + formatCurrency(expBreakdown[cat]) + '</strong></td></tr>';
    }).join('');
    // Multi-branch Comparison Calculations (v3.0.0 Task 3)
    var settings = db.getSettings();
    var rentAndUtilities = Number(settings.rentExpense) || 3500000;
    var marketingExpenses = Number(settings.marketingExpense) || 1500000;
    var branches = db.get('branches') || [];
    var branchRowsHTML = '';
    branches.forEach(function(b) {
      var bStudents = students.filter(function(s) { return s.branchId === b.id && s.status === 'active'; });
      var bPayments = allPayments.filter(function(p) { return p.branchId === b.id && p.month === currentMonth; });
      var bRevenue = bPayments.reduce(function(acc, p) { return acc + (Number(p.amount) || 0); }, 0);
      var bDebt = students.filter(function(s) { return s.branchId === b.id && Number(s.balance) < 0; })
                          .reduce(function(acc, s) { return acc + Math.abs(Number(s.balance)); }, 0);
      var bTeacherSalaries = Math.round(bRevenue * 0.45);
      var bShareExpenses = bTeacherSalaries + Math.round((rentAndUtilities + marketingExpenses) / (branches.length || 1));
      var bNet = bRevenue - bShareExpenses;
      branchRowsHTML += '<tr>' +
        '<td><strong>' + escapeHTML(b.name) + '</strong></td>' +
        '<td>' + bStudents.length + ' nafar</td>' +
        '<td class="text-success"><strong>' + formatCurrency(bRevenue) + '</strong></td>' +
        '<td class="text-danger">' + formatCurrency(bDebt) + '</td>' +
        '<td class="' + (bNet >= 0 ? 'text-success' : 'text-danger') + '"><strong>' + formatCurrency(bNet) + '</strong></td>' +
      '</tr>';
    });
    var branchComparisonHTML = '<div class="glass-card mt-4">' +
      '<h3><i class="fa-solid fa-code-compare text-primary"></i> Filiallararo CEO Solishtirish Paneli (' + currentMonth + ')</h3>' +
      '<div class="table-responsive mt-3">' +
        '<table class="data-table">' +
          '<thead>' +
            '<tr>' +
              '<th>Filial Nomi</th>' +
              '<th>Faol Talabalar</th>' +
              '<th>Oylik Tushum</th>' +
              '<th>Qarzdorlik</th>' +
              '<th>Sof Foyda (Taqsimlangan)</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + branchRowsHTML + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
    // Xarajat qo'shish formasi
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-chart-pie text-success"></i> Moliyaviy Boshqaruv</h2></div>' +
      // KPI kartalar
      '<div class="metrics-grid mb-4" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-arrow-trend-up"></i></div><div class="metric-info"><span class="metric-title">Bu Oy Tushum</span><h2 class="metric-value text-success" style="font-size:20px;">' + formatCurrency(totalRevenue) + '</h2><span class="metric-sub">' + monthPayments.length + ' ta to\'lov</span></div></div>' +
        '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-arrow-trend-down"></i></div><div class="metric-info"><span class="metric-title">Bu Oy Xarajat</span><h2 class="metric-value text-danger" style="font-size:20px;">' + formatCurrency(totalExpenses) + '</h2><span class="metric-sub">' + monthExpenses.length + ' ta xarajat</span></div></div>' +
        '<div class="metric-card glass-card border-' + (netProfit >= 0 ? 'green' : 'red') + '"><div class="metric-icon icon-' + (netProfit >= 0 ? 'green' : 'red') + '"><i class="fa-solid fa-scale-balanced"></i></div><div class="metric-info"><span class="metric-title">Sof Foyda</span><h2 class="metric-value ' + (netProfit >= 0 ? 'text-success' : 'text-danger') + '" style="font-size:20px;">' + formatCurrency(netProfit) + '</h2></div></div>' +
        '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="metric-info"><span class="metric-title">Qarzdorlik</span><h2 class="metric-value text-danger" style="font-size:20px;">' + formatCurrency(totalDebt) + '</h2><span class="metric-sub">' + debtors.length + ' ta qarzdor</span></div></div>' +
      '</div>' +
      // Grafik
      '<div class="glass-card mb-4"><div style="display:flex; justify-content:space-between; align-items:center;"><h3><i class="fa-solid fa-chart-column"></i> Oylik Daromad/Xarajat Grafigi</h3><div style="display:flex; gap:12px; font-size:12px;"><span style="color:var(--color-success);">■ Tushum</span><span style="color:var(--color-danger);">■ Xarajat</span></div></div><div style="display:flex; align-items:flex-end; gap:8px; margin-top:16px; padding:8px; overflow-x:auto;">' + barsHTML + '</div>' + methodHTML + '</div>' +
      // Xarajatlar
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; flex-wrap:wrap;">' +
        '<div class="glass-card"><div style="display:flex; justify-content:space-between; align-items:center;"><h3>📊 Bu Oy Xarajatlar</h3><button class="btn btn-danger btn-sm" data-action="open-add-expense"><i class="fa-solid fa-plus"></i> Qo\'shish</button></div>' +
          (expRows ? '<table class="data-table mt-3"><thead><tr><th>Kategoriya</th><th>Summa</th></tr></thead><tbody>' + expRows + '</tbody></table>' : '<p class="text-muted mt-3">Xarajat kiritilmagan</p>') +
        '</div>' +
        '<div class="glass-card"><h3>💳 Qarzdor O\'quvchilar</h3><div class="mt-3" style="display:flex; flex-direction:column; gap:8px;">' +
          debtors.slice(0, 5).map(function(s) {
            var waLink = 'https://wa.me/' + encodeURIComponent((s.phone || '').replace(/[^0-9+]/g,'')) + '?text=' + encodeURIComponent('Assalomu alaykum! ' + s.fullName + ', ' + formatCurrency(Math.abs(Number(s.balance))) + ' miqdorida qarzdorligingiz bor.');
            return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--bg-input); border-radius:8px;">' +
              '<div><strong>' + escapeHTML(s.fullName) + '</strong><br><small class="text-danger">' + formatCurrency(Math.abs(Number(s.balance))) + '</small></div>' +
              '<a href="' + waLink + '" target="_blank" class="btn btn-success btn-xs"><i class="fa-brands fa-whatsapp"></i></a>' +
            '</div>';
          }).join('') +
          (debtors.length > 5 ? '<p class="text-muted" style="font-size:12px;">va yana ' + (debtors.length - 5) + ' nafar...</p>' : '') +
        '</div></div>' +
      '</div>' +
      branchComparisonHTML +
      // Xarajat qo'shish modali
      '<div class="modal-overlay" id="modal-expense" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Xarajat Kiritish</h3><form id="form-expense" class="mt-3">' +
        '<div class="form-group"><label>Kategoriya</label><select id="ex-cat" class="form-select"><option value="ijara">Ijara</option><option value="kommunal">Kommunal</option><option value="marketing">Marketing</option><option value="maosh">Maosh</option><option value="boshqa">Boshqa</option></select></div>' +
        '<div class="form-group"><label>Tavsif</label><input type="text" id="ex-desc" class="form-input" required placeholder="Ofis ijarasi"></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Summa (so\'m)</label><input type="number" id="ex-amount" class="form-input" required min="1000"></div><div class="form-group"><label>Oy</label><input type="month" id="ex-month" class="form-input" value="' + currentMonth + '"></div></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-expense">Bekor qilish</button><button type="submit" class="btn btn-danger">Saqlash</button></div>' +
      '</form></div></div>';
    delegateClicks(container, {
      'open-add-expense': function() { openModal('modal-expense'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); }
    });
    var expForm = document.getElementById('form-expense');
    if (expForm) expForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var cat = document.getElementById('ex-cat').value;
      var desc = document.getElementById('ex-desc').value.trim();
      var amount = Number(document.getElementById('ex-amount').value);
      var month = document.getElementById('ex-month').value;
      if (!desc || !amount) return;
      db.insert('expenses', { id: crypto.randomUUID(), category: cat, description: desc, amount: amount, month: month, date: new Date().toISOString().split('T')[0] });
      showToast('Xarajat kiritildi: ' + formatCurrency(amount), 'success');
      closeModal('modal-expense');
      renderFinance();
    });
  }
  // ---------- 16. SETTINGS (Backup/Restore + WhatsApp qo'shildi) ----------

export { renderFinance };