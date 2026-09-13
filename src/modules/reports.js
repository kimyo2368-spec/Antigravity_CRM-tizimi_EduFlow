import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderReports() {
    var container = document.getElementById('module-content');
    if (!container) return;
    var students = db.get('students');
    var payments = db.get('payments', function(p) { return p && !p.cancelled; });
    var statHTML = '';
    var totalRevenue = payments.reduce(function(a, p) { return a + Number(p.amount || 0); }, 0);
    var debtors = students.filter(function(s) { return Number(s.balance) < 0; });
    var totalDebt = debtors.reduce(function(a, s) { return a + Math.abs(Number(s.balance)); }, 0);
    debtors.forEach(function(s) {
      statHTML += '<tr><td><strong>' + escapeHTML(s.fullName) + '</strong></td><td>' + escapeHTML(s.phone) + '</td><td class="text-danger"><strong>' + formatCurrency(Math.abs(Number(s.balance))) + '</strong></td>' +
        '<td><a href="https://wa.me/' + encodeURIComponent((s.phone || '').replace(/[^0-9+]/g,'')) + '?text=' + encodeURIComponent('Assalomu alaykum! ' + s.fullName + ', ' + formatCurrency(Math.abs(Number(s.balance))) + ' miqdorida qarzdorligingiz bor. Iltimos to\'lov qiling.') + '" target="_blank" class="btn btn-success btn-xs"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a></td></tr>';
    });
    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-chart-bar text-info"></i> Hisobotlar Markazi</h2></div>' +
      '<div class="metrics-grid mb-4" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-money-bill-wave"></i></div><div class="metric-info"><span class="metric-title">Jami Tushum</span><h2 class="metric-value text-success" style="font-size:18px;">' + formatCurrency(totalRevenue) + '</h2></div></div>' +
        '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="metric-info"><span class="metric-title">Umumiy Qarzdorlik</span><h2 class="metric-value text-danger" style="font-size:18px;">' + formatCurrency(totalDebt) + '</h2><span class="metric-sub">' + debtors.length + ' ta o\'quvchi</span></div></div>' +
      '</div>' +
      '<div class="glass-card mb-4">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;"><h3>📊 Export / Yuklab olish</h3></div>' +
        '<div style="display:flex; gap:12px; flex-wrap:wrap;">' +
          '<button class="btn btn-primary" data-action="export-csv" data-type="students"><i class="fa-solid fa-download"></i> O\'quvchilar (CSV)</button>' +
          '<button class="btn btn-success" data-action="export-csv" data-type="payments"><i class="fa-solid fa-download"></i> To\'lovlar (CSV)</button>' +
        '</div>' +
      '</div>' +
      (debtors.length > 0 ? '<div class="glass-card"><h3 class="text-danger">⚠️ Qarzdor O\'quvchilar (' + debtors.length + ' nafar)</h3><div class="table-responsive mt-3"><table class="data-table"><thead><tr><th>F.I.SH.</th><th>Telefon</th><th>Qarzdorlik</th><th>Eslatma</th></tr></thead><tbody>' + statHTML + '</tbody></table></div></div>' : '');
    delegateClicks(container, {
      'export-csv': function(btn) {
        var type = btn.dataset.type;
        var bom = '\uFEFF';
        var csvStr = 'data:text/csv;charset=utf-8,' + bom;
        if (type === 'students') {
          csvStr += 'ID Kod,F.I.Sh.,Telefon,Balans,Holat,Qo\'shilgan sana\n';
          students.forEach(function(s) { csvStr += s.code + ',"' + s.fullName + '",' + s.phone + ',' + s.balance + ',' + (s.status === 'active' ? 'Faol' : 'To\'xtatilgan') + ',' + (s.joinedDate || '') + '\n'; });
        } else {
          csvStr += 'Kod,O\'quvchi,Summa,To\'lov usuli,Sana,Oy,Holat\n';
          payments.forEach(function(p) { csvStr += p.code + ',"' + p.studentName + '",' + p.amount + ',' + p.paymentMethod + ',' + p.date + ',' + (p.month || '') + ',' + (p.cancelled ? 'Bekor' : 'Tasdiqlangan') + '\n'; });
        }
        var uri = encodeURI(csvStr);
        var link = document.createElement('a');
        link.setAttribute('href', uri);
        link.setAttribute('download', 'EduFlow_' + type + '_' + new Date().toISOString().split('T')[0] + '.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('Hisobot CSV fayliga yuklab olindi!', 'success');
      }
    });
  }
  // ---------- 13. CALENDAR — To'liq Haftalik Jadval ----------

export { renderReports };