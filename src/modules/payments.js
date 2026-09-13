import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, genId, generateCode, openModal, paginate, renderPaginationControls, sendTelegramNotification, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';
import { renderPaginationControls } from '../utils/shared_render.js';

  function renderPayments(options) {
    options = options || {};
    var ab = auth.getActiveBranch();
    var allPayments = db.get('payments', function(p) { return p && (ab === 'all' || p.branchId === ab); });
    // FIX: Filter by method and search
    var payments = allPayments.filter(function(p) {
      var methodOk = paymentsFilterMethod === 'all' || p.paymentMethod === paymentsFilterMethod;
      var searchOk = !paymentsSearch || (p.studentName || '').toLowerCase().includes(paymentsSearch.toLowerCase()) || (p.code || '').toLowerCase().includes(paymentsSearch.toLowerCase());
      return methodOk && searchOk;
    });
    var students = db.get('students');
    var groups = db.get('groups');
    var paged = paginate(payments, paymentsPage);
    var container = document.getElementById('module-content');
    if (!container) return;
    var rowsHTML = '';
    paged.items.forEach(function(p) {
      var cancelled = p.cancelled ? ' style="opacity:0.5; text-decoration:line-through;"' : '';
      rowsHTML += '<tr' + cancelled + '>' +
        '<td><strong class="text-primary">' + escapeHTML(p.code) + '</strong></td>' +
        '<td><strong>' + escapeHTML(p.studentName) + '</strong><br><small class="text-muted">' + (p.groupId ? (groups.find(function(g) { return g.id === p.groupId; })?.name || 'Guruhsiz') : 'Guruhsiz') + '</small></td>' +
        '<td><strong class="text-success">' + formatCurrency(p.amount) + '</strong></td>' +
        '<td><span class="badge badge-info">' + escapeHTML((p.paymentMethod || '').toUpperCase()) + '</span><br><small class="text-muted">' + (p.period === 'annual' ? 'Yillik' : 'Oylik') + '</small></td>' +
        '<td>' + escapeHTML(p.date) + ' <small class="text-muted">' + escapeHTML(p.month || '') + '</small></td>' +
        '<td>' + (p.cancelled ? '<span class="badge badge-danger">BEKOR</span>' :
          '<button class="btn btn-secondary btn-sm" data-action="print-receipt" data-id="' + p.id + '">🧾 Chek</button> ' +
          '<button class="btn btn-danger btn-xs" data-action="cancel-payment" data-id="' + p.id + '" data-amount="' + p.amount + '" data-student="' + p.studentId + '">Bekor</button>') +
        '</td></tr>';
    });
    var studentOpts = '<option value="">Tanlang...</option>';
    students.forEach(function(s) { studentOpts += '<option value="' + s.id + '">' + escapeHTML(s.fullName) + ' (' + escapeHTML(s.code) + ')</option>'; });
    // FIX: Filter bar
    var filterBar = '<div class="glass-card mb-3" style="display:flex; gap:12px; flex-wrap:wrap; align-items:center; padding:12px 16px;">' +
      '<input type="text" id="pm-search" class="form-input" style="flex:1; min-width:180px;" placeholder="🔍 O\'quvchi yoki kod..." value="' + escapeHTML(paymentsSearch) + '">' +
      '<select id="pm-filter-method" class="form-select" style="min-width:150px;">' +
        '<option value="all"' + (paymentsFilterMethod==='all'?' selected':'') + '>Barcha usullar</option>' +
        '<option value="cash"' + (paymentsFilterMethod==='cash'?' selected':'') + '>Naqd Pul</option>' +
        '<option value="click"' + (paymentsFilterMethod==='click'?' selected':'') + '>Click / Payme</option>' +
        '<option value="card"' + (paymentsFilterMethod==='card'?' selected':'') + '>Terminal / Karta</option>' +
      '</select>' +
      '<span class="text-muted" style="font-size:13px;">Natija: ' + payments.length + ' ta / Jami: ' + allPayments.length + ' ta</span>' +
    '</div>';
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><div><h2><i class="fa-solid fa-wallet text-success"></i> ' + "To'lovlar va Moliya" + '</h2></div><button class="btn btn-success" data-action="open-add-payment"><i class="fa-solid fa-cash-register"></i> ' + "To'lov Qabul Qilish" + '</button></div>' +
      filterBar +
      '<div class="table-responsive glass-card"><table class="data-table"><thead><tr><th>KOD</th><th>' + "O'QUVCHI" + '</th><th>SUMMA</th><th>USULI</th><th>SANA / OY</th><th>AMALLAR</th></tr></thead><tbody>' + rowsHTML + '</tbody></table>' + renderPaginationControls(paged) + '</div>' +
      '<div class="modal-overlay" id="modal-payment" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>' + "To'lov Qabul Qilish" + '</h3><form id="form-payment" class="mt-3"><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>' + "O'quvchini Tanlang" + '</label><select id="pm-student" class="form-select">' + studentOpts + '</select></div><div class="form-group"><label>Guruh</label><select id="pm-group" class="form-select" required><option value="">O\'quvchini tanlang</option></select></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>To\'lov Davri</label><select id="pm-period" class="form-select"><option value="monthly">Oylik (1 oy)</option><option value="annual">Yillik (12 oy)</option></select></div><div class="form-group"><label>Boshlanish Oyi</label><input type="month" id="pm-month" class="form-input" required value="' + new Date().toISOString().slice(0, 7) + '"></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>' + "To'lov Summasi (so'm)" + '</label><input type="number" id="pm-amount" class="form-input" required min="1000" placeholder="Summa"></div><div class="form-group"><label>' + "To'lov Usuli" + '</label><select id="pm-method" class="form-select"><option value="click">Click / Payme</option><option value="cash">Naqd Pul</option><option value="card">Terminal / Karta</option></select></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-payment">Bekor qilish</button><button type="submit" class="btn btn-success">Tasdiqlash</button></div></form></div></div>' +
      '<div class="modal-overlay" id="modal-receipt" style="display:none;"><div class="modal-content glass-card" style="padding:32px; text-align:center;" id="receipt-content"></div></div>';
    // FIX: Filter listeners
    var pmSearchEl = document.getElementById('pm-search');
    var pmMethodEl = document.getElementById('pm-filter-method');
    if (pmSearchEl) pmSearchEl.addEventListener('input', function() { paymentsSearch = pmSearchEl.value.trim(); paymentsPage = 1; renderPayments(); });
    if (pmMethodEl) pmMethodEl.addEventListener('change', function() { paymentsFilterMethod = pmMethodEl.value; paymentsPage = 1; renderPayments(); });
    function updateAmount() {
      var stId = pmStudentEl ? pmStudentEl.value : '';
      var groupId = document.getElementById('pm-group') ? document.getElementById('pm-group').value : '';
      var period = document.getElementById('pm-period') ? document.getElementById('pm-period').value : 'monthly';
      var st = students.find(function(s) { return s.id === stId; });
      if (st) {
        var stGroups = groups.filter(function(g) { return st.groupIds && st.groupIds.includes(g.id); });
        var targetGroup = stGroups.find(function(g) { return g.id === groupId; });
        var baseFee = targetGroup ? Number(targetGroup.monthlyFee || 0) : stGroups.reduce(function(sum, g) { return sum + Number(g.monthlyFee || 0); }, 0);
        baseFee = baseFee || 600000;
        
        var finalFee = period === 'annual' ? baseFee * 12 : baseFee;
        var amountEl = document.getElementById('pm-amount');
        if (amountEl) amountEl.value = finalFee;
      }
    }

    if (pmStudentEl) pmStudentEl.addEventListener('change', function() {
      var st = students.find(function(s) { return s.id === pmStudentEl.value; });
      var groupSelect = document.getElementById('pm-group');
      if (st) {
        groupSelect.innerHTML = '';
        var hasGroups = false;
        var stGroups = groups.filter(function(g) { return st.groupIds && st.groupIds.includes(g.id); });
        stGroups.forEach(function(g) {
          groupSelect.innerHTML += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>';
          hasGroups = true;
        });
        if (!hasGroups) groupSelect.innerHTML = '<option value="general">Umumiy (Guruhsiz)</option>';
        
        updateAmount();
      } else {
        groupSelect.innerHTML = '<option value="">O\'quvchini tanlang</option>';
        document.getElementById('pm-amount').value = '';
      }
    });

    var pmGroupEl = document.getElementById('pm-group');
    if (pmGroupEl) pmGroupEl.addEventListener('change', updateAmount);
    var pmPeriodEl = document.getElementById('pm-period');
    if (pmPeriodEl) pmPeriodEl.addEventListener('change', updateAmount);
    delegateClicks(container, {
      'open-add-payment': function() { openModal('modal-payment'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'paginate': function(btn) { paymentsPage = parseInt(btn.dataset.page); renderPayments(); },
      // SEV-2-B FIX: Read amount from DB not from data attribute (stale HTML bug)
      'cancel-payment': function(btn) {
        showConfirm("Bu to'lovni bekor qilishni tasdiqlaysizmi?", function() {
          var payment = db.getById('payments', btn.dataset.id);
          if (!payment || payment.cancelled) { showToast("Bu to'lov allaqachon bekor qilingan!", 'warning'); return; }
          db.update('payments', btn.dataset.id, { cancelled: true });
          var st = db.getById('students', payment.studentId);
          if (st) {
            var groupId = payment.groupId || 'general';
            if (!st.groupBalances) st.groupBalances = {};
            st.groupBalances[groupId] = Number(st.groupBalances[groupId] || 0) - Number(payment.amount);
            db.update('students', payment.studentId, { groupBalances: st.groupBalances });
          }
          showToast("To'lov bekor qilindi va balans qaytarildi", 'warning');
          renderPayments();
        });
      },
      // FIX #17: Print receipt in modal
      'print-receipt': function(btn) {
        var payment = db.getById('payments', btn.dataset.id);
        if (!payment) return;
        var rc = document.getElementById('receipt-content');
        if (rc) {
          rc.innerHTML = '<div style="border:2px dashed var(--border-color); padding:24px; border-radius:12px;"><i class="fa-solid fa-graduation-cap text-primary" style="font-size:36px;"></i><h2 class="mt-2">EduFlow CRM</h2><hr style="border-color:var(--border-color); margin:16px 0;"><p style="text-align:left;"><strong>Kvitansiya:</strong> ' + escapeHTML(payment.code) + '</p><p style="text-align:left;"><strong>' + "O'quvchi:" + '</strong> ' + escapeHTML(payment.studentName) + '</p><p style="text-align:left;"><strong>Davri:</strong> ' + (payment.period === 'annual' ? 'Yillik' : 'Oylik') + '</p><p style="text-align:left;"><strong>Summa:</strong> <span class="text-success">' + formatCurrency(payment.amount) + '</span></p><p style="text-align:left;"><strong>Usuli:</strong> ' + escapeHTML(payment.paymentMethod.toUpperCase()) + '</p><p style="text-align:left;"><strong>Sana:</strong> ' + escapeHTML(payment.date) + '</p><p style="text-align:left;"><strong>Qabul qildi:</strong> ' + escapeHTML(payment.receivedBy) + '</p><hr style="border-color:var(--border-color); margin:16px 0;"><button class="btn btn-primary" data-action="do-print">🖨️ Chop Etish</button> <button class="btn btn-secondary" data-action="close-modal" data-modal="modal-receipt">Yopish</button></div>';
        }
        openModal('modal-receipt');
      },
      'do-print': function() { window.print(); }
    });
    var form = document.getElementById('form-payment');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var stId = document.getElementById('pm-student').value;
      var groupId = document.getElementById('pm-group').value;
      var amount = Number(document.getElementById('pm-amount').value);
      var method = document.getElementById('pm-method').value;
      var period = document.getElementById('pm-period').value;
      var month = document.getElementById('pm-month').value || new Date().toISOString().slice(0, 7);
      // FIX #23: O'quvchi tanlanmasa xato
      if (!stId) { showToast("Iltimos, o'quvchini tanlang!", 'warning'); return; }
      if (!groupId) { showToast("Iltimos, guruhni tanlang!", 'warning'); return; }
      if (isNaN(amount) || amount <= 0) { showToast("To'lov summasi noto'g'ri!", 'warning'); return; }
      var st = students.find(function(s) { return s.id === stId; });
      if (!st) return;
      var code = generateCode('PAYMENT', 'payments');
      db.insert('payments', { id: genId('pm'), code: code, studentId: st.id, studentName: st.fullName, groupId: groupId, branchId: st.branchId, amount: amount, paymentMethod: method, period: period, month: month, date: new Date().toISOString().split('T')[0], receivedBy: auth.getCurrentUser() ? auth.getCurrentUser().fullName : 'Admin', cancelled: false });
      
      if (!st.groupBalances) st.groupBalances = {};
      var newBalance = Number(st.groupBalances[groupId] || 0) + amount;
      st.groupBalances[groupId] = newBalance;
      db.update('students', st.id, { groupBalances: st.groupBalances });
      
      var groupName = groupId === 'general' ? 'Guruhsiz' : (groups.find(function(g) { return g.id === groupId; })?.name || 'Noma\'lum');

      // Auto Telegram Notification on Payment (v3.0.0 Task 5)
      var tgText = "🔔 <b>TO'LOV QABUL QILINDI</b>\n\n" +
        "👤 <b>Talaba:</b> " + escapeHTML(st.fullName) + " (" + escapeHTML(st.code) + ")\n" +
        "🏫 <b>Guruh:</b> " + escapeHTML(groupName) + "\n" +
        "⏳ <b>To'lov turi:</b> " + (period === 'annual' ? 'Yillik (12 oy)' : 'Oylik') + "\n" +
        "💰 <b>Summa:</b> " + formatCurrency(amount) + "\n" +
        "💳 <b>Uslub:</b> " + method.toUpperCase() + "\n" +
        "📈 <b>Joriy Balans (shu guruh):</b> " + formatCurrency(newBalance) + "\n\n" +
        "Tashrifingiz uchun rahmat! 🎓";
      sendTelegramNotification(st.telegramChatId, tgText);
      showToast("To'lov " + formatCurrency(amount) + ' qabul qilindi!', 'success');
      closeModal('modal-payment');
      renderPayments();
    });
    if (options.openModal) openModal('modal-payment');
  }
  // ---------- 7. LEADS KANBAN (FIX #10, #11) ----------

export { renderPayments };