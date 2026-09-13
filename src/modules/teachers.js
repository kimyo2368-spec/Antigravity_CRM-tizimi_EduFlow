import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, formatCurrency, generateCode, hashPassword, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

  function renderTeachers() {
    var ab = auth.getActiveBranch();
    var teachers = db.get('users', function(u) { return u && u.role === 'teacher' && (ab === 'all' || u.branchId === ab); });
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;
    var cardsHTML = '';
    teachers.forEach(function(t) {
      var isFired = t.isFired || t.status === 'fired';
      // FIX: Salary calculation supporting both 'percent' and 'fixed' salary types
      var sType = t.salaryType || 'percent';
      var sVal = Number(t.salaryValue !== undefined ? t.salaryValue : (t.salaryPercentage !== undefined ? t.salaryPercentage : 40));
      var estSalary = 0;
      var salaryLabel = '';
      if (sType === 'fixed') {
        estSalary = sVal;
        salaryLabel = 'Doimiy maosh: ' + formatCurrency(estSalary);
      } else {
        var currentMonth = new Date().toISOString().slice(0, 7);
        var curD = new Date();
        var curMonthInt = curD.getFullYear() * 12 + curD.getMonth();
        
        var tGroups = db.get('groups', function(g) { return g.teacherId === t.id; });
        var totalRealRevenue = 0;
        var totalExpectedRevenue = 0;
        
        tGroups.forEach(function(g) {
          // Expected revenue
          var activeStudentsCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(g.id) && s.status === 'active'; }).length;
          totalExpectedRevenue += activeStudentsCount * Number(g.monthlyFee || 600000);

          // Real revenue
          var gContracts = db.get('contracts', function(c) { return c.groupId === g.id; });
          var gPayments = db.get('payments', function(p) { return p.groupId === g.id && p.month === currentMonth && !p.cancelled && p.paymentMethod !== 'adjust'; });
          
          gContracts.forEach(function(c) {
            var cStartDate = new Date(c.startDate);
            var cStartMonthInt = cStartDate.getFullYear() * 12 + cStartDate.getMonth();
            if (curMonthInt >= cStartMonthInt && curMonthInt < cStartMonthInt + Number(c.parts)) {
              totalRealRevenue += (Number(c.totalAmount) / Number(c.parts));
            }
          });

          gPayments.forEach(function(p) {
            var hasContract = gContracts.some(function(c) { return c.studentId === p.studentId; });
            if (!hasContract) {
              totalRealRevenue += Number(p.amount);
            }
          });
        });
        
        estSalary = totalExpectedRevenue * (sVal / 100);
        var realSalary = totalRealRevenue * (sVal / 100);
        
        salaryLabel = 'Taxminiy (' + sVal + '%): ' + formatCurrency(estSalary) + '<br><i class="fa-solid fa-check-circle" style="font-size:11px;"></i> Haqiqiy: ' + formatCurrency(realSalary);
      }
      cardsHTML +=
        '<div class="group-card glass-card ' + (isFired ? 'border-red' : 'border-purple') + '">' +
          '<h3>' + escapeHTML(t.fullName) + '</h3>' +
          '<p class="text-muted"><i class="fa-solid fa-book"></i> Fan: ' + escapeHTML(t.subject || 'Ingliz tili') + '</p>' +
          '<div class="mt-2" style="font-size:13px;"><i class="fa-solid fa-phone"></i> ' + escapeHTML(t.phone) + '</div>' +
          '<div class="mt-2" style="font-size:13px;"><i class="fa-solid fa-envelope"></i> ' + escapeHTML(t.email) + '</div>' +
          '<div class="mt-2 text-success" style="font-size:13px; font-weight:bold;"><i class="fa-solid fa-money-bill-wave"></i> ' + salaryLabel + '</div>' +
          '<div class="mt-3 pt-2" style="border-top:1px solid var(--border-color); display:flex; gap:6px; flex-wrap:wrap;">' +
            '<button class="btn btn-info btn-xs" data-action="edit-teacher" data-id="' + t.id + '"><i class="fa-solid fa-pen"></i> Tahrirlash</button>' +
            '<button class="btn ' + (isFired ? 'btn-success' : 'btn-danger') + ' btn-xs" data-action="toggle-teacher" data-id="' + t.id + '" data-fire="' + (!isFired) + '">' + (isFired ? 'Tiklash' : "Bo'shatish") + '</button>' +
          '</div>' +
        '</div>';
    });
    var branchOpts = '';
    branches.forEach(function(b) { branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });
    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><div><h2><i class="fa-solid fa-chalkboard-user text-purple"></i> ' + "O'qituvchilar" + '</h2></div><button class="btn btn-purple" data-action="open-add-teacher">' + "Yangi O'qituvchi" + '</button></div>' +
      '<div class="groups-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">' + cardsHTML + '</div>' +
      // Add teacher modal (FIX: custom password + salary type + salary value fields)
      '<div class="modal-overlay" id="modal-teacher" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>' + "Yangi O'qituvchi Qo'shish" + '</h3><form id="form-teacher" class="mt-3">' +
        '<div class="form-group"><label>F.I.SH.</label><input type="text" id="te-name" class="form-input" required></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Email</label><input type="email" id="te-email" class="form-input" required></div><div class="form-group"><label>Telefon</label><input type="text" id="te-phone" class="form-input" required></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Fan</label><input type="text" id="te-subject" class="form-input" placeholder="Ingliz tili (IELTS)"></div><div class="form-group"><label>Filial</label><select id="te-branch" class="form-select">' + branchOpts + '</select></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">' +
          '<div class="form-group"><label>Maosh Turi</label><select id="te-salary-type" class="form-select"><option value="percent">Foiz (%)</option><option value="fixed">Doimiy (Fiksirlangan)</option></select></div>' +
          '<div class="form-group"><label>Qiymat (Foiz / Summa)</label><input type="number" id="te-salary-val" class="form-input" required value="40"></div>' +
          '<div class="form-group"><label>Parol</label><input type="password" id="te-password" class="form-input" placeholder="Kamida 6 belgi" required minlength="6"></div>' +
        '</div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-teacher">Bekor qilish</button><button type="submit" class="btn btn-purple">Saqlash</button></div></form></div></div>' +
      // Edit teacher modal
      '<div class="modal-overlay" id="modal-teacher-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>O\'qituvchini Tahrirlash</h3><form id="form-teacher-edit" class="mt-3"><input type="hidden" id="te-edit-id">' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>F.I.SH.</label><input type="text" id="te-edit-name" class="form-input" required></div><div class="form-group"><label>Login (Email)</label><input type="email" id="te-edit-email" class="form-input" required></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="te-edit-phone" class="form-input" required></div><div class="form-group"><label>Fan</label><input type="text" id="te-edit-subject" class="form-input"></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">' +
          '<div class="form-group"><label>Maosh Turi</label><select id="te-edit-salary-type" class="form-select"><option value="percent">Foiz (%)</option><option value="fixed">Doimiy (Fiksirlangan)</option></select></div>' +
          '<div class="form-group"><label>Qiymat (Foiz / Summa)</label><input type="number" id="te-edit-salary-val" class="form-input" required></div>' +
          '<div class="form-group"><label>Yangi Parol</label><input type="text" id="te-edit-pass" class="form-input" placeholder="O\'zgartirmaslik uchun bo\'sh"></div>' +
        '</div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-teacher-edit">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>';
    delegateClicks(container, {
      'open-add-teacher': function() { openModal('modal-teacher'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'toggle-teacher': function(btn) {
        db.update('users', btn.dataset.id, { isFired: btn.dataset.fire === 'true' });
        showToast("O'qituvchi maqomi yangilandi", 'info');
        renderTeachers();
      },
      // FIX: Edit teacher
      'edit-teacher': function(btn) {
        var t = db.getById('users', btn.dataset.id);
        if (!t) return;
        document.getElementById('te-edit-id').value = t.id;
        document.getElementById('te-edit-name').value = t.fullName || '';
        document.getElementById('te-edit-email').value = t.email || '';
        document.getElementById('te-edit-phone').value = t.phone || '';
        document.getElementById('te-edit-subject').value = t.subject || '';
        document.getElementById('te-edit-salary-type').value = t.salaryType || 'percent';
        document.getElementById('te-edit-salary-val').value = t.salaryValue !== undefined ? t.salaryValue : (t.salaryPercentage !== undefined ? t.salaryPercentage : 40);
        document.getElementById('te-edit-pass').value = '';
        openModal('modal-teacher-edit');
      }
    });
    // Add teacher form (FIX: duplicate email check + custom password + salary config)
    var form = document.getElementById('form-teacher');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var pass = document.getElementById('te-password').value.trim();
      var phone = document.getElementById('te-phone').value.trim();
      var salaryType = document.getElementById('te-salary-type').value;
      var valStr = document.getElementById('te-salary-val').value;
      var salaryValue = valStr !== '' ? Number(valStr) : 40;
      if (pass.length < 6) { showToast('Parol kamida 6 belgidan iborat bo\'lishi kerak!', 'warning'); return; }
      // Phone validation
      var phoneRegex = /^\+?[0-9\s\-()]{9,18}$/;
      if (!phoneRegex.test(phone)) { showToast("Telefon formati noto'g'ri (Kamida 9 ta raqam)!", 'warning'); return; }
      var emailVal = document.getElementById('te-email').value.trim().toLowerCase();
      // FIX #3: Duplicate email check
      var existingUser = db.get('users').find(function(u) { return u.email && u.email.toLowerCase() === emailVal; });
      if (existingUser) { showToast('Bu email allaqachon tizimda mavjud: ' + escapeHTML(existingUser.fullName), 'error'); return; }
      var code = generateCode('TEACHER', 'users');
      db.insert('users', { id: crypto.randomUUID(), code: code, fullName: document.getElementById('te-name').value.trim(), email: emailVal, passwordHash: hashPassword(pass), role: 'teacher', phone: phone, subject: document.getElementById('te-subject').value.trim(), branchId: document.getElementById('te-branch').value, salaryType: salaryType, salaryValue: salaryValue });
      showToast("Yangi o'qituvchi saqlandi!", 'success');
      closeModal('modal-teacher');
      renderTeachers();
    });
    // Edit teacher form
    var editForm = document.getElementById('form-teacher-edit');
    if (editForm) editForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('te-edit-id').value;
      var phone = document.getElementById('te-edit-phone').value.trim();
      var salaryType = document.getElementById('te-edit-salary-type').value;
      var valStrEdit = document.getElementById('te-edit-salary-val').value;
      var salaryValue = valStrEdit !== '' ? Number(valStrEdit) : 40;
      var phoneRegex = /^\+?[0-9\s\-()]{9,18}$/;
      if (!phoneRegex.test(phone)) { showToast("Telefon formati noto'g'ri (Kamida 9 ta raqam)!", 'warning'); return; }
      var updates = {
        fullName: document.getElementById('te-edit-name').value.trim(),
        email: document.getElementById('te-edit-email').value.trim(),
        phone: phone,
        subject: document.getElementById('te-edit-subject').value.trim(),
        salaryType: salaryType,
        salaryValue: salaryValue
      };
      var newPass = document.getElementById('te-edit-pass').value.trim();
      if (newPass.length >= 6) { updates.passwordHash = hashPassword(newPass); }
      else if (newPass.length > 0 && newPass.length < 6) { showToast('Parol kamida 6 belgi bo\'lishi kerak!', 'warning'); return; }
      db.update('users', id, updates);
      showToast("O'qituvchi ma'lumotlari yangilandi!", 'success');
      closeModal('modal-teacher-edit');
      renderTeachers();
    });
  }
  // ---------- X. ADMINS MANAGEMENT ----------

export { renderTeachers };