import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, genId, generateCode, openModal, paginate, renderPaginationControls, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  var studentsPage = 1;
  var studentsSearch = '';

  function renderStudents(options) {
    options = options || {};
    var ab = auth.getActiveBranch();
    var allStudents = db.get('students', function(s) { return s && (ab === 'all' || s.branchId === ab); });
    // FIX: Search filter
    var students = studentsSearch ? allStudents.filter(function(s) {
      var q = studentsSearch.trim().toLowerCase();
      if (!q) return true;
      return (s.fullName || '').toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.code || '').toLowerCase().includes(q);
    }) : allStudents;
    var groups = db.get('groups');
    var branches = db.get('branches');
    var paged = paginate(students, studentsPage);
    var container = document.getElementById('module-content');
    if (!container) return;
    
    var currentUser = auth.getCurrentUser();
    var isFinanceOrAdmin = currentUser && (currentUser.role === 'finance' || currentUser.role === 'super_admin');
    
    var rowsHTML = '';
    paged.items.forEach(function(s) {
      var grpNames = groups.filter(function(g) { return s.groupIds && s.groupIds.includes(g.id); }).map(function(g) { return g.name; }).join(', ');
      
      var sTotalDebt = 0;
      if (s.groupBalances) {
        Object.keys(s.groupBalances).forEach(function(k) {
          if (s.groupBalances[k] < 0) sTotalDebt += Math.abs(s.groupBalances[k]);
        });
      }
      var isDebtor = sTotalDebt > 0;
      var balanceCell = isFinanceOrAdmin ? '<td class="' + (isDebtor ? 'text-danger font-bold' : 'text-success') + '">' + formatCurrency(-sTotalDebt) + '</td>' : '';
      var adjustBtn = isFinanceOrAdmin ? '<button class="btn btn-success btn-xs" data-action="adjust-balance" data-id="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" title="Qarz yozish/Chegirma"><i class="fa-solid fa-scale-balanced"></i></button> ' : '';
      var contractBtn = isFinanceOrAdmin ? '<button class="btn btn-primary btn-xs" data-action="open-contract" data-id="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" title="Yillik Shartnoma"><i class="fa-solid fa-file-contract"></i></button> ' : '';
      var contractViewBtn = isFinanceOrAdmin ? '<button class="btn btn-info btn-xs" data-action="view-contracts" data-id="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" title="Shartnomalar"><i class="fa-solid fa-chart-line"></i></button> ' : '';
      rowsHTML += '<tr>' +
        '<td><strong class="text-primary">' + escapeHTML(s.code) + '</strong></td>' +
        '<td><strong>' + escapeHTML(s.fullName) + '</strong></td>' +
        '<td>' + escapeHTML(s.phone) + '</td>' +
        '<td>' + (grpNames || '-') + '</td>' +
        balanceCell +
        '<td><span class="badge badge-' + (s.status === 'active' ? 'success' : 'warning') + '">' + escapeHTML(s.status) + '</span></td>' +
        '<td style="display:flex; gap:4px; flex-wrap:wrap;">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-student" data-id="' + s.id + '"><i class="fa-solid fa-pen"></i></button> ' +
          adjustBtn + contractBtn + contractViewBtn +
          '<button class="btn btn-danger btn-xs" data-action="delete-student-cascade" data-id="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    });
    var groupOptions = '<option value="">Guruhsiz</option>';
    groups.forEach(function(g) { groupOptions += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>'; });
    var branchOptions = '';
    branches.forEach(function(b) { branchOptions += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });
    container.innerHTML =
      '<div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">' +
        '<div><h2><i class="fa-solid fa-user-graduate text-primary"></i> ' + "O'quvchilar Boshqaruvi" + '</h2><p class="text-muted">Jami: ' + allStudents.length + " nafar o'quvchi" + '</p></div>' +
        '<button class="btn btn-primary" data-action="open-add-student"><i class="fa-solid fa-user-plus"></i> ' + "Yangi O'quvchi" + '</button>' +
      '</div>' +
      '<div class="glass-card mb-3" style="padding:12px 16px;">' +
        '<input type="text" id="student-search" class="form-input" placeholder="🔍 Ism, telefon yoki ID bo\'yicha qidiring..." value="' + escapeHTML(studentsSearch) + '">' +
      '</div>' +
      '<div class="table-responsive glass-card"><table class="data-table"><thead><tr><th>ID KOD</th><th>F.I.SH.</th><th>TELEFON</th><th>GURUH</th>' + (isFinanceOrAdmin ? '<th>BALANS</th>' : '') + '<th>HOLAT</th><th>AMAL</th></tr></thead><tbody>' + rowsHTML + '</tbody></table>' + renderPaginationControls(paged) + '</div>' +
      // Add student modal
      '<div class="modal-overlay" id="modal-student" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>' + "Yangi O'quvchi Qo'shish" + '</h3><form id="form-student" class="mt-3"><div class="form-group"><label>F.I.SH.</label><input type="text" id="st-fullname" class="form-input" required placeholder="Sardorbek Rahimov"></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="st-phone" class="form-input" required placeholder="+998 90 123-45-67"></div><div class="form-group"><label>Filial</label><select id="st-branch" class="form-select">' + branchOptions + '</select></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Ota-ona Ismi</label><input type="text" id="st-parent-name" class="form-input" placeholder="Otabek Rahimov"></div><div class="form-group"><label>Ota-ona Telefoni</label><input type="text" id="st-parent-phone" class="form-input" placeholder="+998 90 999-88-77"></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruhlar (Ctrl bilan bir nechta tanlang)</label><select id="st-group" class="form-select" multiple style="height: 80px;">' + groupOptions + '</select><div id="st-conflict-warning" class="text-danger mt-1" style="display:none; font-size:12px; font-weight:bold;"></div></div><div class="form-group"><label>Telegram Chat ID (Xabarnomalar)</label><input type="text" id="st-tg-chat" class="form-input" placeholder="Masalan: 123456789"></div></div><div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Edit student modal (SEV-5-D: added parentName, parentPhone fields)
      '<div class="modal-overlay" id="modal-student-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>O\'quvchini Tahrirlash</h3><form id="form-student-edit" class="mt-3"><input type="hidden" id="st-edit-id"><div class="form-group"><label>F.I.SH.</label><input type="text" id="st-edit-fullname" class="form-input" required></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="st-edit-phone" class="form-input" required></div><div class="form-group"><label>Holat</label><select id="st-edit-status" class="form-select"><option value="active">Faol</option><option value="frozen">To\'xtatilgan</option><option value="graduated">Bitirgan</option></select></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Ota-ona Ismi</label><input type="text" id="st-edit-parent-name" class="form-input" placeholder="Ota-ona F.I.SH."></div><div class="form-group"><label>Ota-ona Telefoni</label><input type="text" id="st-edit-parent-phone" class="form-input" placeholder="+998 90 ..."></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruhlar (Ctrl bilan bir nechta tanlang)</label><select id="st-edit-group" class="form-select" multiple style="height: 80px;">' + groupOptions + '</select><div id="st-edit-conflict-warning" class="text-danger mt-1" style="display:none; font-size:12px; font-weight:bold;"></div></div><div class="form-group"><label>Telegram Chat ID (Xabarnomalar)</label><input type="text" id="st-edit-tg-chat" class="form-input" placeholder="Chat ID"></div></div><div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student-edit">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Balance adjust modal (per group)
      '<div class="modal-overlay" id="modal-student-balance" style="display:none;"><div class="modal-content glass-card" style="padding:24px; max-width:380px;"><h3>💰 Qarz yoki Chegirma Yozish</h3><form id="form-balance-adjust" class="mt-3"><input type="hidden" id="ba-student-id"><div class="form-group"><label>O\'quvchi</label><input type="text" id="ba-student-name" class="form-input" readonly></div><div class="form-group"><label>Qaysi guruh bo\'yicha?</label><select id="ba-group" class="form-select" required></select></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Amal turi</label><select id="ba-action-type" class="form-select"><option value="sub">Jarima / Qarz yozish (-)</option><option value="add">Kredit / Chegirma (+)</option></select></div><div class="form-group"><label>Summa (so\'m)</label><input type="number" id="ba-amount" class="form-input" required min="1000"></div></div><div class="form-group"><label>Joriy balans holati</label><div id="ba-current-balance" style="font-weight:bold; color:var(--text-color);"></div></div><div class="modal-footer mt-3"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student-balance">Bekor qilish</button><button type="submit" class="btn btn-success">Saqlash</button></div></form></div></div>' +
      // Contract create modal
      '<div class="modal-overlay" id="modal-contract" style="display:none;"><div class="modal-content glass-card" style="padding:24px; max-width:400px;"><h3>📄 Yillik Shartnoma Tuzish</h3><form id="form-contract" class="mt-3"><input type="hidden" id="c-student-id"><div class="form-group"><label>O\'quvchi</label><input type="text" id="c-student-name" class="form-input" readonly></div><div class="form-group"><label>Qaysi guruh bo\'yicha?</label><select id="c-group" class="form-select" required></select></div><div class="form-group"><label>Umumiy Shartnoma Summasi (so\'m)</label><input type="number" id="c-amount" class="form-input" required min="1000" placeholder="Masalan: 5000000"></div><div class="form-group"><label>Necha qismga bo\'lib to\'lanadi?</label><input type="number" id="c-parts" class="form-input" required min="1" max="12" value="1" placeholder="1-12"></div><div class="form-group"><label>Boshlanish Sanasi</label><input type="date" id="c-date" class="form-input" required value="' + new Date().toISOString().split('T')[0] + '"></div><div class="modal-footer mt-3"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-contract">Bekor qilish</button><button type="submit" class="btn btn-primary">Tasdiqlash</button></div></form></div></div>' +
      // Contracts view modal
      '<div class="modal-overlay" id="modal-contracts-view" style="display:none;"><div class="modal-content glass-card" style="padding:24px; max-width:600px;"><h3>📊 O\'quvchi Shartnomalari</h3><div id="cv-content" class="mt-3" style="max-height:400px; overflow-y:auto;"></div><div class="modal-footer mt-3"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-contracts-view">Yopish</button></div></div></div>';
    // Search live filter
    var searchEl = document.getElementById('student-search');
    if (searchEl) searchEl.addEventListener('input', function() {
      studentsSearch = searchEl.value; // Do not trim here to preserve spaces while typing
      studentsPage = 1;
      renderStudents({ focusSearch: true });
    });
    function checkScheduleConflict(groupIds) {
      if (!groupIds || groupIds.length < 2) return null;
      var allGroups = db.get('groups');
      var selectedGroups = allGroups.filter(function(g) { return groupIds.includes(g.id); });
      for (var i = 0; i < selectedGroups.length; i++) {
        for (var j = i + 1; j < selectedGroups.length; j++) {
          var g1 = selectedGroups[i];
          var g2 = selectedGroups[j];
          if (!g1.scheduleDays || !g2.scheduleDays) continue;
          var days1 = g1.scheduleDays.split('-');
          var days2 = g2.scheduleDays.split('-');
          var commonDays = days1.filter(function(d) { return days2.includes(d); });
          if (commonDays.length > 0 && g1.scheduleTime && g2.scheduleTime) {
            var t1 = g1.scheduleTime.split(' - ');
            var t2 = g2.scheduleTime.split(' - ');
            if (t1.length === 2 && t2.length === 2) {
              if (t1[0] < t2[1] && t2[0] < t1[1]) {
                 return { g1: g1.name, g2: g2.name, days: commonDays.join(', ') };
              }
            }
          }
        }
      }
      return null;
    }
    function handleGroupSelectionChange(selectId, warningId) {
      var select = document.getElementById(selectId);
      var warning = document.getElementById(warningId);
      if (!select || !warning) return;
      select.addEventListener('change', function() {
        var groupIds = Array.from(select.selectedOptions).map(function(opt) { return opt.value; });
        var conflict = checkScheduleConflict(groupIds);
        if (conflict) {
          warning.innerText = 'Diqqat: ' + conflict.g1 + ' va ' + conflict.g2 + ' guruhlari dars vaqtlari ustma-ust tushadi (' + conflict.days + ')!';
          warning.style.display = 'block';
        } else {
          warning.style.display = 'none';
        }
      });
    }
    handleGroupSelectionChange('st-group', 'st-conflict-warning');
    handleGroupSelectionChange('st-edit-group', 'st-edit-conflict-warning');
    if (options.focusSearch) {
      setTimeout(function() {
        var s = document.getElementById('student-search');
        if (s) {
          s.focus();
          var len = s.value.length;
          s.setSelectionRange(len, len);
        }
      }, 0);
    }
    delegateClicks(container, {
      'open-add-student': function() { openModal('modal-student'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'delete-student': function(btn) {
        showConfirm("'" + btn.dataset.name + "' ni o'chirishni tasdiqlaysizmi?", function() {
          db.remove('students', btn.dataset.id);
          showToast("O'quvchi o'chirildi", 'warning');
          renderStudents();
        });
      },
      // FIX: Edit student
      'edit-student': function(btn) {
        var s = db.getById('students', btn.dataset.id);
        if (!s) return;
        document.getElementById('st-edit-id').value = s.id;
        document.getElementById('st-edit-fullname').value = s.fullName || '';
        document.getElementById('st-edit-phone').value = s.phone || '';
        document.getElementById('st-edit-status').value = s.status || 'active';
        var editSelect = document.getElementById('st-edit-group');
        for (var i = 0; i < editSelect.options.length; i++) {
          editSelect.options[i].selected = s.groupIds && s.groupIds.includes(editSelect.options[i].value);
        }
        var warningEl = document.getElementById('st-edit-conflict-warning');
        if (warningEl) warningEl.style.display = 'none'; // reset warning on open
        document.getElementById('st-edit-tg-chat').value = s.telegramChatId || '';
        // SEV-5-D: Populate parent fields
        var pnEl = document.getElementById('st-edit-parent-name');
        var ppEl = document.getElementById('st-edit-parent-phone');
        if (pnEl) pnEl.value = s.parentName || '';
        if (ppEl) ppEl.value = s.parentPhone || '';
        openModal('modal-student-edit');
      },
      // FIX: Adjust Balance modal trigger
      'adjust-balance': function(btn) {
        var s = db.getById('students', btn.dataset.id);
        if (!s) return;
        document.getElementById('ba-student-id').value = s.id;
        document.getElementById('ba-student-name').value = s.fullName;
        
        var groupSelect = document.getElementById('ba-group');
        groupSelect.innerHTML = '';
        var hasGroups = false;
        
        var allGroups = db.get('groups');
        if (s.groupIds) {
          s.groupIds.forEach(function(gId) {
            var g = allGroups.find(function(grp) { return grp.id === gId; });
            if (g) {
              groupSelect.innerHTML += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>';
              hasGroups = true;
            }
          });
        }
        if (!hasGroups) {
          groupSelect.innerHTML = '<option value="general">Umumiy (Guruhsiz)</option>';
        }
        
        // Update current balance display
        var updateBalanceDisplay = function() {
          var selGroup = groupSelect.value;
          var bal = (s.groupBalances && s.groupBalances[selGroup]) ? s.groupBalances[selGroup] : 0;
          document.getElementById('ba-current-balance').innerHTML = formatCurrency(bal);
        };
        groupSelect.onchange = updateBalanceDisplay;
        updateBalanceDisplay();
        
        document.getElementById('ba-amount').value = '';
        var baDescEl = document.getElementById('ba-desc');
        if (baDescEl) baDescEl.value = '';
        openModal('modal-student-balance');
      },
      'open-contract': function(btn) {
        var s = db.getById('students', btn.dataset.id);
        if (!s) return;
        document.getElementById('c-student-id').value = s.id;
        document.getElementById('c-student-name').value = s.fullName;
        var groupSelect = document.getElementById('c-group');
        groupSelect.innerHTML = '';
        var hasGroups = false;
        var allGroups = db.get('groups');
        if (s.groupIds) {
          s.groupIds.forEach(function(gId) {
            var g = allGroups.find(function(grp) { return grp.id === gId; });
            if (g) { groupSelect.innerHTML += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>'; hasGroups = true; }
          });
        }
        if (!hasGroups) { groupSelect.innerHTML = '<option value="general">Umumiy (Guruhsiz)</option>'; }
        
        document.getElementById('c-amount').value = '';
        document.getElementById('c-parts').value = '1';
        openModal('modal-contract');
      },
      'view-contracts': function(btn) {
         var sId = btn.dataset.id;
         var sContracts = db.get('contracts', function(c) { return c.studentId === sId; });
         var allGroups = db.get('groups');
         var content = '';
         if (sContracts.length === 0) {
            content = '<p class="text-muted">Bu o\'quvchida hali shartnomalar tuzilmagan.</p>';
         } else {
            sContracts.forEach(function(c) {
               var gName = c.groupId === 'general' ? 'Umumiy' : (allGroups.find(function(g) { return g.id === c.groupId; })?.name || 'Noma\'lum');
               var partAmount = Math.round(c.totalAmount / c.parts);
               content += '<div class="glass-card mb-3" style="padding:16px;">' +
                 '<h4>🏫 Guruh: ' + escapeHTML(gName) + '</h4>' +
                 '<p><strong>💰 Jami Summa:</strong> ' + formatCurrency(c.totalAmount) + '</p>' +
                 '<p><strong>📆 Bo\'lib to\'lash:</strong> ' + c.parts + ' qism (har biri ' + formatCurrency(partAmount) + ')</p>' +
                 '<p><strong>🚀 Boshlanish:</strong> ' + escapeHTML(c.startDate) + '</p>' +
                 '<hr style="border-color:var(--border-color); margin:12px 0;">' +
                 '<h5>🗓️ To\'lov Grafigi (Taxminiy)</h5><ul style="list-style:none; padding:0; display:grid; grid-template-columns:1fr 1fr; gap:8px;">';
               
               var sDate = new Date(c.startDate);
               for(var i=1; i<=c.parts; i++) {
                 var pDate = new Date(sDate);
                 pDate.setMonth(pDate.getMonth() + (i - 1));
                 content += '<li style="padding:4px; background:rgba(0,0,0,0.05); border-radius:4px;">' + i + '-qism: <strong class="text-warning">' + pDate.toISOString().split('T')[0] + '</strong><br>' + formatCurrency(partAmount) + '</li>';
               }
               content += '</ul></div>';
            });
         }
         var cvc = document.getElementById('cv-content');
         if (cvc) cvc.innerHTML = content;
         openModal('modal-contracts-view');
      },
      // FIX: Cascade delete — attendance + payments ham o'chirilsin
      'delete-student-cascade': function(btn) {
        var sid = btn.dataset.id;
        var sname = btn.dataset.name;
        var attCount = db.get('attendance', function(a) { return a.studentId === sid; }).length;
        var pmCount = db.get('payments', function(p) { return p.studentId === sid; }).length;
        var msg = "'" + sname + "' ni o'chirishni tasdiqlaysizmi?\n";
        if (attCount > 0) msg += attCount + ' ta davomat yozuvi ham o\'chiriladi.\n';
        if (pmCount > 0) msg += pmCount + " ta to'lov yozuvi ham o'chiriladi.";
        showConfirm(msg, function() {
          db.remove('students', sid);
          // Davomat yozuvlarini tozalash
          var attList = db.get('attendance', function(a) { return a.studentId === sid; });
          attList.forEach(function(a) { db.remove('attendance', a.id); });
          // SEV-2-C FIX: To'lov yozuvlarini ham tozalash (orphan payments)
          var pmList = db.get('payments', function(p) { return p.studentId === sid; });
          pmList.forEach(function(p) { db.remove('payments', p.id); });
          showToast(sname + " o'chirildi (" + attCount + ' davomat, ' + pmCount + " to'lov yozuvi ham tozalandi)", 'warning');
          renderStudents();
        });
      },
      'paginate': function(btn) { studentsPage = parseInt(btn.dataset.page); renderStudents(); }
    });
    // Add student form
    var form = document.getElementById('form-student');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var fullName = document.getElementById('st-fullname').value.trim();
      var phone = document.getElementById('st-phone').value.trim();
      var parentName = document.getElementById('st-parent-name').value.trim();
      var parentPhone = document.getElementById('st-parent-phone').value.trim();
      var branchId = document.getElementById('st-branch').value;
      var groupSelect = document.getElementById('st-group');
      var groupIds = Array.from(groupSelect.selectedOptions).map(function(opt) { return opt.value; });
      var tgChatId = document.getElementById('st-tg-chat').value.trim();
      if (!fullName || !phone) return;
      // FIX: Phone number regex check
      var phoneRegex = /^\+?[0-9\s\-()]{9,18}$/;
      if (!phoneRegex.test(phone)) {
        showToast("Telefon formati noto'g'ri (Kamida 9 ta raqam)!", 'warning');
        return;
      }
      var code = generateCode('STUDENT', 'students');
      db.insert('students', { id: genId('st'), code: code, fullName: fullName, phone: phone, parentName: parentName, parentPhone: parentPhone, branchId: branchId, groupIds: groupIds, status: 'active', groupBalances: {}, telegramChatId: tgChatId, joinedDate: new Date().toISOString().split('T')[0] });
      showToast("O'quvchi " + fullName + ' (' + code + ') saqlandi!', 'success');
      closeModal('modal-student');
      renderStudents();
    });
    // Edit student form
    var editForm = document.getElementById('form-student-edit');
    if (editForm) editForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('st-edit-id').value;
      var fullName = document.getElementById('st-edit-fullname').value.trim();
      var phone = document.getElementById('st-edit-phone').value.trim();
      var status = document.getElementById('st-edit-status').value;
      var editGroupSelect = document.getElementById('st-edit-group');
      var groupIds = Array.from(editGroupSelect.selectedOptions).map(function(opt) { return opt.value; });
      var tgChatId = document.getElementById('st-edit-tg-chat').value.trim();
      // SEV-5-D FIX: Read parent fields from edit modal
      var parentNameEl = document.getElementById('st-edit-parent-name');
      var parentPhoneEl = document.getElementById('st-edit-parent-phone');
      var parentName = parentNameEl ? parentNameEl.value.trim() : '';
      var parentPhone = parentPhoneEl ? parentPhoneEl.value.trim() : '';
      if (!fullName || !phone || !id) return;
      var phoneRegex = /^\+?[0-9\s\-()]{9,18}$/;
      if (!phoneRegex.test(phone)) {
        showToast("Telefon formati noto'g'ri (Kamida 9 ta raqam)!", 'warning');
        return;
      }
      db.update('students', id, { fullName: fullName, phone: phone, status: status, groupIds: groupIds, telegramChatId: tgChatId, parentName: parentName, parentPhone: parentPhone });
      showToast("O'quvchi ma'lumotlari yangilandi!", 'success');
      closeModal('modal-student-edit');
      renderStudents();
    });
    // Adjust student balance form submit
    var balForm = document.getElementById('form-balance-adjust');
    if (balForm) balForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var sId = document.getElementById('ba-student-id').value;
      var type = document.getElementById('ba-action-type').value;
      var amount = Number(document.getElementById('ba-amount').value);
      var desc = document.getElementById('ba-desc').value.trim();
      if (!sId || !amount || !desc) return;
      var st = db.getById('students', sId);
      if (!st) return;
      var groupId = document.getElementById('ba-group').value;
      var finalAmount = type === 'add' ? amount : -amount;
      if (!st.groupBalances) st.groupBalances = {};
      var nextBalance = Number(st.groupBalances[groupId] || 0) + finalAmount;
      // Update student balance
      st.groupBalances[groupId] = nextBalance;
      db.update('students', sId, { groupBalances: st.groupBalances });
      // Record transaction
      var pCode = generateCode('PAYMENT', 'payments');
      db.insert('payments', {
        id: crypto.randomUUID(),
        code: pCode,
        studentId: sId,
        studentName: st.fullName,
        groupId: groupId,
        branchId: st.branchId || 'br-1',
        amount: finalAmount,
        paymentMethod: 'adjust',
        month: new Date().toISOString().slice(0, 7),
        date: new Date().toISOString().split('T')[0],
        receivedBy: auth.getCurrentUser() ? auth.getCurrentUser().fullName : 'Tizim',
        cancelled: false,
        notes: desc
      });
      showToast("Balans muvaffaqiyatli o'zgartirildi! Yangi balans: " + formatCurrency(nextBalance), 'success');
      closeModal('modal-student-balance');
      renderStudents();
    });

    var cForm = document.getElementById('form-contract');
    if (cForm) cForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var sId = document.getElementById('c-student-id').value;
      var groupId = document.getElementById('c-group').value;
      var amount = Number(document.getElementById('c-amount').value);
      var parts = Number(document.getElementById('c-parts').value);
      var startDate = document.getElementById('c-date').value;
      if (!sId || !groupId || !amount || !parts) return;
      
      var st = db.getById('students', sId);
      if (!st) return;

      var contractId = genId('ct');
      db.insert('contracts', {
        id: contractId,
        studentId: sId,
        groupId: groupId,
        branchId: st.branchId || 'br-1',
        totalAmount: amount,
        parts: parts,
        startDate: startDate,
        createdAt: new Date().toISOString()
      });

      if (!st.groupBalances) st.groupBalances = {};
      st.groupBalances[groupId] = Number(st.groupBalances[groupId] || 0) - amount;
      db.update('students', sId, { groupBalances: st.groupBalances });

      showToast("Yillik shartnoma tuzildi va " + formatCurrency(amount) + " balansga qarz sifatida yozildi!", "success");
      closeModal('modal-contract');
      renderStudents();
    });
    if (options.openModal) openModal('modal-student');
  }
  // ---------- 3. GROUPS (Edit+Delete added) ----------

export { renderStudents };