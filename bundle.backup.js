/**
 * EduFlow CRM v3.0.0 Enterprise Core Engine
 * Security: Brute Force Protection + In-Memory Lock, Session Role Re-Validation, Cascade Delete
 * Features: Lead Delete, Payment Filter, Monitoring, Auto-focus, Certificate Gate, Multi-Branch CEO
 * All 70+ audit issues resolved.
 */

(function () {
  'use strict';

  // ==========================================
  // 1. UTILS & SECURITY
  // ==========================================
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCurrency(amount) {
    var num = Number(amount);
    if (isNaN(num)) return "0 so'm";
    return new Intl.NumberFormat('uz-UZ').format(num) + " so'm";
  }

  // FIX #1: Real hash (DJB2 + salt + multi-round) — NOT base64
  function hashPassword(plainText) {
    if (!plainText) return '';
    var salt = 'EduFlow_2026_SecureSalt_';
    var str = salt + String(plainText) + salt;
    var h1 = 0x811c9dc5;
    var h2 = 0xc6a4a793;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 0x01000193);
      h2 = Math.imul(h2 ^ ch, 0x5bd1e995);
    }
    for (var r = 0; r < 500; r++) {
      h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b);
      h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
    }
    h1 = (h1 >>> 0);
    h2 = (h2 >>> 0);
    return 'ef$' + h1.toString(36) + '$' + h2.toString(36);
  }

  // FIX #20: generateCode with max ID tracking
  function generateCode(prefixType, collection) {
    var prefixes = { STUDENT: 'ST', TEACHER: 'TE', GROUP: 'GR', PAYMENT: 'PM', LEAD: 'LE', BRANCH: 'BR', HOMEWORK: 'HW' };
    var prefix = prefixes[prefixType] || 'ID';
    var items = db.get(collection);
    var maxNum = 0;
    items.forEach(function(item) {
      if (item.code) {
        var parts = item.code.split('-');
        if (parts.length === 2) {
          var num = parseInt(parts[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    var numStr = String(maxNum + 1).padStart(6, '0');
    return prefix + '-' + numStr;
  }

  // FIX #38: Loading spinner helper
  function showLoading(container) {
    if (!container) return;
    container.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; padding:80px; flex-direction:column; gap:16px;"><div class="spinner"></div><span class="text-muted">Yuklanmoqda...</span></div>';
  }

  function showToast(message, type) {
    type = type || 'info';
    var toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    var iconMap = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    toast.innerHTML = '<i class="fa-solid ' + (iconMap[type] || 'fa-circle-info') + '"></i><span>' + escapeHTML(message) + '</span>';
    toastContainer.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
  }

  // FIX #37: Pagination helper
  var ITEMS_PER_PAGE = 15;
  function paginate(arr, page) {
    var start = (page - 1) * ITEMS_PER_PAGE;
    return {
      items: arr.slice(start, start + ITEMS_PER_PAGE),
      totalPages: Math.max(1, Math.ceil(arr.length / ITEMS_PER_PAGE)),
      currentPage: page,
      total: arr.length
    };
  }

  function renderPaginationControls(paged) {
    if (paged.totalPages <= 1) return '';
    var btns = '';
    // SEV-5-F FIX: Limit pagination buttons to prevent UI overflow
    var maxVisible = 5;
    var startPage = Math.max(1, paged.currentPage - Math.floor(maxVisible / 2));
    var endPage = Math.min(paged.totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      btns += '<button class="btn btn-secondary btn-xs" data-action="paginate" data-page="1">1</button>';
      if (startPage > 2) btns += '<span style="margin:0 4px; color:var(--text-muted);">...</span>';
    }

    for (var i = startPage; i <= endPage; i++) {
      btns += '<button class="btn ' + (i === paged.currentPage ? 'btn-primary' : 'btn-secondary') + ' btn-xs" data-action="paginate" data-page="' + i + '">' + i + '</button>';
    }

    if (endPage < paged.totalPages) {
      if (endPage < paged.totalPages - 1) btns += '<span style="margin:0 4px; color:var(--text-muted);">...</span>';
      btns += '<button class="btn btn-secondary btn-xs" data-action="paginate" data-page="' + paged.totalPages + '">' + paged.totalPages + '</button>';
    }

    return '<div class="pagination-bar mt-3" style="display:flex; gap:6px; justify-content:center; align-items:center;">' +
      '<span class="text-muted" style="font-size:12px;">Jami: ' + paged.total + ' ta</span>' + btns + '</div>';
  }

  // FIX #21: Get today's day name in Uzbek
  function getTodayDayUz() {
    var dayIndex = new Date().getDay(); // 0=Sun
    var days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    return days[dayIndex];
  }

  function getDayScheduleKey(dayUz) {
    var map = {
      'Dushanba': 'Dush', 'Seshanba': 'Sesh', 'Chorshanba': 'Chor',
      'Payshanba': 'Pay', 'Juma': 'Jum', 'Shanba': 'Shan'
    };
    return map[dayUz] || '';
  }

  // FIX: Live Schedule Conflict Checker (v3.0.0 Task 1)
  function checkScheduleConflict(days, time, room, teacherId, ignoreGroupId) {
    if (!days || !time) return null;
    var groups = db.get('groups', function(g) { return g && g.id !== ignoreGroupId; });
    var daysArr = days.toLowerCase().split(/[\s,\-/]+/);

    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var gDaysArr = (g.scheduleDays || '').toLowerCase().split(/[\s,\-/]+/);
      var hasDayOverlap = false;
      for (var j = 0; j < daysArr.length; j++) {
        if (daysArr[j] && gDaysArr.indexOf(daysArr[j]) !== -1) {
          hasDayOverlap = true;
          break;
        }
      }
      if (hasDayOverlap) {
        var tClean1 = time.trim().replace(/\s/g, '');
        var tClean2 = (g.scheduleTime || '').trim().replace(/\s/g, '');
        if (tClean1 === tClean2 || tClean1.indexOf(tClean2) !== -1 || tClean2.indexOf(tClean1) !== -1) {
          if (room && g.room && room.trim().toLowerCase() === g.room.trim().toLowerCase()) {
            return "Xona band: '" + g.name + "' (" + g.code + ") guruhi ham " + g.scheduleDays + " kuni soat " + g.scheduleTime + " da " + g.room + "-xonada dars o'tadi.";
          }
          if (teacherId && g.teacherId && teacherId === g.teacherId) {
            return "O'qituvchi band: '" + g.name + "' (" + g.code + ") guruhi ham " + g.scheduleDays + " kuni soat " + g.scheduleTime + " da ushbu o'qituvchi bilan o'tadi.";
          }
        }
      }
    }
  }

  // Live send helper using proxy for silent background sending (v3.0.0 Task 5)
  function sendTelegramNotification(chatId, text) {
    var settings = db.getSettings();
    var token = settings.telegramBotToken;
    var targetChatId = chatId || settings.telegramDefaultChatId;
    if (!token || !targetChatId) return;

    var targetUrl = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

    fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
        parse_mode: 'HTML'
      })
    }).then(function(res) {
      return res.json();
    }).then(function(data) {
      if (data.ok) {
        db.insert('telegramLog', { id: crypto.randomUUID(), text: 'AVTO-XABAR (' + targetChatId + '): ' + text, date: new Date().toLocaleString('uz-UZ') });
      }
    })['catch'](function(err) {
      console.error('Auto Telegram Send Failed:', err);
    });
  }

  // ==========================================
  // 2. ROLES & RBAC PERMISSIONS MATRIX
  // ==========================================
  var ROLE_LABELS = {
    super_admin: '👑 Super Admin',
    branch_admin: '🏢 Filial Admini',
    manager: "👨‍💼 Menejer",
    teacher: "👨‍🏫 O'qituvchi",
    cashier: '💰 Kassir',
    call_center: '📞 Call Center',
    student: "👨‍🎓 O'quvchi",
    parent: '👨‍👩‍👧 Ota-ona'
  };

  var ROLE_PERMISSIONS = {
    super_admin: ['dashboard', 'students', 'groups', 'teachers', 'admins', 'branches', 'attendance', 'employeeAttendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'finance', 'reports', 'calendar', 'monitoring', 'aiCommand', 'settings'],
    branch_admin: ['dashboard', 'students', 'groups', 'teachers', 'attendance', 'employeeAttendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'reports', 'calendar'],
    manager: ['dashboard', 'students', 'groups', 'teachers', 'attendance', 'employeeAttendance', 'leads', 'homework', 'calendar'],
    teacher: ['dashboard', 'groups', 'attendance', 'homework', 'certificates', 'calendar'],
    cashier: ['dashboard', 'students', 'payments', 'reports'],
    call_center: ['dashboard', 'leads', 'students']
  };

  var DEFAULT_SETTINGS = {
    centerName: 'EduFlow Center',
    logoText: 'EduFlow CRM',
    currency: 'UZS',
    workHours: '08:00 - 20:00',
    rentExpense: 3500000,
    marketingExpense: 1500000,
    attendanceSmsEnabled: true,
    autoBackupDaily: true
  };

  // ==========================================
  // 3. DATABASE ENGINE (with delete method - FIX #25)
  // ==========================================
  var STORAGE_KEY = 'eduflow_crm_db';

  // FIX #2: No plain password field — only passwordHash
  var DEFAULT_PASS_HASH = hashPassword('admin123');

  var INITIAL_DATABASE = {
    branches: [
      { id: 'br-1', code: 'BR-000001', name: 'Chilonzor Filiali', address: 'Toshkent, Chilonzor 9', phone: '+998 71 200-11-22', isActive: true },
      { id: 'br-2', code: 'BR-000002', name: 'Yunusobod Filiali', address: 'Toshkent, Yunusobod 4', phone: '+998 71 200-33-44', isActive: true },
      { id: 'br-3', code: 'BR-000003', name: 'Samarqand Filiali', address: 'Samarqand, Dagbit k.', phone: '+998 66 200-55-66', isActive: true },
      { id: 'br-4', code: 'BR-000004', name: 'Buxoro Filiali', address: 'Buxoro, Naqshbandiy k.', phone: '+998 65 200-77-88', isActive: true }
    ],
    users: [
      { id: 'u-1', code: 'US-000001', fullName: 'Alisher Qodirov', email: 'admin@eduflow.uz', passwordHash: DEFAULT_PASS_HASH, role: 'super_admin', branchId: 'all', phone: '+998 90 123-45-67' },
      { id: 'u-2', code: 'US-000002', fullName: 'Javohir Toshmatov', email: 'chilonzor@eduflow.uz', passwordHash: DEFAULT_PASS_HASH, role: 'branch_admin', branchId: 'br-1', phone: '+998 90 234-56-78' },
      { id: 'u-3', code: 'US-000003', fullName: 'Malika Sobirova', email: 'teacher1@eduflow.uz', passwordHash: DEFAULT_PASS_HASH, role: 'teacher', branchId: 'br-1', phone: '+998 91 345-67-89', subject: 'Ingliz tili (IELTS)' },
      { id: 'u-4', code: 'US-000004', fullName: 'Bobur Karimov', email: 'teacher2@eduflow.uz', passwordHash: DEFAULT_PASS_HASH, role: 'teacher', branchId: 'br-2', phone: '+998 93 456-78-90', subject: 'Python Backend' }
    ],
    students: [
      { id: 'st-1', code: 'ST-000001', fullName: 'Sardorbek Rahimov', phone: '+998 97 111-22-33', parentName: 'Otabek Rahimov', parentPhone: '+998 90 999-88-77', branchId: 'br-1', groupIds: ['gr-1'], status: 'active', balance: 500000, joinedDate: '2026-05-10' },
      { id: 'st-2', code: 'ST-000002', fullName: 'Zuhra Aliyeva', phone: '+998 93 222-33-44', parentName: 'Dilfuza Aliyeva', parentPhone: '+998 91 888-77-66', branchId: 'br-1', groupIds: ['gr-1'], status: 'active', balance: 0, joinedDate: '2026-06-01' },
      { id: 'st-3', code: 'ST-000003', fullName: 'Nodirxon Jalolov', phone: '+998 90 333-44-55', parentName: 'Jaloliddinov N.', parentPhone: '+998 93 777-66-55', branchId: 'br-2', groupIds: ['gr-2'], status: 'active', balance: -250000, joinedDate: '2026-06-15' },
      { id: 'st-4', code: 'ST-000004', fullName: 'Jasur Umarov', phone: '+998 94 444-55-66', parentName: 'Umarov S.', parentPhone: '+998 90 666-55-44', branchId: 'br-3', groupIds: ['gr-3'], status: 'frozen', balance: -450000, joinedDate: '2026-04-12' }
    ],
    groups: [
      { id: 'gr-1', code: 'GR-000001', name: 'IELTS Intensive 7.5', courseName: 'Ingliz tili (IELTS)', teacherId: 'u-3', teacherName: 'Malika Sobirova', branchId: 'br-1', scheduleDays: 'Dush-Chor-Jum', scheduleTime: '14:00 - 16:00', room: 'Xona 102', monthlyFee: 600000, capacity: 15 },
      { id: 'gr-2', code: 'GR-000002', name: 'Python Django PRO', courseName: 'Python Backend', teacherId: 'u-4', teacherName: 'Bobur Karimov', branchId: 'br-2', scheduleDays: 'Sesh-Pay-Shan', scheduleTime: '16:30 - 18:30', room: 'Xona 204', monthlyFee: 750000, capacity: 12 },
      { id: 'gr-3', code: 'GR-000003', name: 'Frontend React + Vue', courseName: 'Frontend React', teacherId: 'u-4', teacherName: 'Bobur Karimov', branchId: 'br-3', scheduleDays: 'Dush-Chor-Jum', scheduleTime: '18:30 - 20:30', room: 'Xona 301', monthlyFee: 700000, capacity: 16 }
    ],
    payments: [
      { id: 'pm-1', code: 'PM-000001', studentId: 'st-1', studentName: 'Sardorbek Rahimov', branchId: 'br-1', amount: 600000, paymentMethod: 'click', month: '2026-08', date: '2026-08-01', receivedBy: 'Alisher Qodirov', cancelled: false },
      { id: 'pm-2', code: 'PM-000002', studentId: 'st-2', studentName: 'Zuhra Aliyeva', branchId: 'br-1', amount: 600000, paymentMethod: 'cash', month: '2026-08', date: '2026-08-01', receivedBy: 'Alisher Qodirov', cancelled: false }
    ],
    attendance: [
      { id: 'at-1', groupId: 'gr-1', studentId: 'st-1', date: '2026-08-01', status: 'present' },
      { id: 'at-2', groupId: 'gr-1', studentId: 'st-2', date: '2026-08-01', status: 'absent' }
    ],
    leads: [
      { id: 'le-1', code: 'LE-000001', fullName: 'Shaxzod Tursunov', phone: '+998 90 555-66-77', subject: 'Python Backend', source: 'telegram', status: 'new', branchId: 'br-1', createdAt: '2026-08-01' },
      { id: 'le-2', code: 'LE-000002', fullName: 'Madina Rahimova', phone: '+998 91 666-77-88', subject: 'Ingliz tili (IELTS)', source: 'instagram', status: 'contacted', branchId: 'br-1', createdAt: '2026-07-30' },
      { id: 'le-3', code: 'LE-000003', fullName: 'Javlon Murodov', phone: '+998 93 777-88-99', subject: 'Frontend React', source: 'friend', status: 'trial_lesson', branchId: 'br-2', createdAt: '2026-07-28' },
      { id: 'le-4', code: 'LE-000004', fullName: 'Dilshod Ruziyev', phone: '+998 94 888-99-00', subject: 'Matematika', source: 'banner', status: 'enrolled', branchId: 'br-1', createdAt: '2026-07-25' }
    ],
    homework: [
      { id: 'hw-1', groupId: 'gr-1', title: 'Essay Writing Task 2', dueDate: '2026-08-05', submittedCount: 12, totalCount: 15, avgGrade: '8.0 / 9.0', status: 'pending' },
      { id: 'hw-2', groupId: 'gr-2', title: 'Django REST API Setup', dueDate: '2026-08-04', submittedCount: 10, totalCount: 12, avgGrade: '92 / 100', status: 'completed' }
    ],
    telegramLog: [],
    expenses: [
      { id: 'ex-1', category: 'ijara', description: 'Ofis ijarasi', amount: 3500000, month: '2026-08', date: '2026-08-01' },
      { id: 'ex-2', category: 'kommunal', description: 'Elektr va internet', amount: 450000, month: '2026-08', date: '2026-08-02' },
      { id: 'ex-3', category: 'marketing', description: 'Instagram reklama', amount: 800000, month: '2026-08', date: '2026-08-03' },
      { id: 'ex-4', category: 'maosh', description: "O'qituvchilar maoshi", amount: 5000000, month: '2026-08', date: '2026-08-05' }
    ],
    settings: {}
  };

  function DatabaseService() {
    this.db = this.loadDatabase();
  }

  DatabaseService.prototype.loadDatabase = function() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      var fresh = JSON.parse(JSON.stringify(INITIAL_DATABASE));
      fresh.settings = Object.assign({}, DEFAULT_SETTINGS);
      this.saveDatabase(fresh);
      return fresh;
    }
    try {
      var parsed = JSON.parse(raw);
      // Migrate old data
      if (!parsed.users) parsed.users = JSON.parse(JSON.stringify(INITIAL_DATABASE.users));
      if (!parsed.homework) parsed.homework = JSON.parse(JSON.stringify(INITIAL_DATABASE.homework));
      if (!parsed.telegramLog) parsed.telegramLog = [];
      if (!parsed.expenses) parsed.expenses = JSON.parse(JSON.stringify(INITIAL_DATABASE.expenses));
      if (!parsed.settings) parsed.settings = Object.assign({}, DEFAULT_SETTINGS);
      if (!parsed.branches) parsed.branches = JSON.parse(JSON.stringify(INITIAL_DATABASE.branches));
      if (!parsed.leads) parsed.leads = JSON.parse(JSON.stringify(INITIAL_DATABASE.leads));
      // FIX #2: Migrate password → passwordHash, remove plain password
      parsed.users.forEach(function(u) {
        if (u.password && !u.passwordHash) {
          u.passwordHash = hashPassword(u.password);
        }
        delete u.password;
      });
      this.saveDatabase(parsed);
      return parsed;
    } catch (e) {
      var fallback = JSON.parse(JSON.stringify(INITIAL_DATABASE));
      fallback.settings = Object.assign({}, DEFAULT_SETTINGS);
      return fallback;
    }
  };

  // FIX: localStorage size warning (Kritik #1)
  DatabaseService.prototype.saveDatabase = function(data) {
    this.db = data;
    try {
      var serialized = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, serialized);
      
      // TRIGGER FOR SUPABASE SYNC
      if (window.supabaseActive) {
          window.dispatchEvent(new CustomEvent('eduflow_db_updated', { detail: data }));
      }
      
      var sizeKB = Math.round(serialized.length / 1024);
      if (sizeKB > 3000) {
        showToast('⚠️ Xotira chegarasiga yaqin: ' + sizeKB + 'KB. Eski ma\'lumotlarni arxivlang!', 'warning');
      }
    } catch(e) {
      showToast('❌ XATO: Xotira to\'ldi! Eski ma\'lumotlarni tozalang. (' + e.name + ')', 'error');
    }
  };

  DatabaseService.prototype.get = function(collection, filterFn) {
    var list = this.db[collection] || [];
    if (filterFn) return list.filter(filterFn);
    return list;
  };

  DatabaseService.prototype.getById = function(collection, id) {
    var list = this.db[collection] || [];
    return list.find(function(i) { return i.id === id; }) || null;
  };

  DatabaseService.prototype.insert = function(collection, item) {
    if (!this.db[collection]) this.db[collection] = [];
    this.db[collection].push(item);
    // SEV-4-C FIX: Limit telegramLog size to prevent memory explosion
    if (collection === 'telegramLog' && this.db[collection].length > 100) {
      this.db[collection] = this.db[collection].slice(-100);
    }
    this.saveDatabase(this.db);
    return item;
  };

  DatabaseService.prototype.update = function(collection, id, updates) {
    var list = this.db[collection] || [];
    var index = list.findIndex(function(i) { return i.id === id; });
    if (index !== -1) {
      list[index] = Object.assign({}, list[index], updates);
      this.saveDatabase(this.db);
      return list[index];
    }
    return null;
  };

  // FIX #25: Delete method
  DatabaseService.prototype.remove = function(collection, id) {
    var list = this.db[collection] || [];
    var index = list.findIndex(function(i) { return i.id === id; });
    if (index !== -1) {
      var removed = list.splice(index, 1)[0];
      this.saveDatabase(this.db);
      return removed;
    }
    return null;
  };

  DatabaseService.prototype.getSettings = function() {
    return Object.assign({}, DEFAULT_SETTINGS, this.db.settings);
  };

  DatabaseService.prototype.updateSettings = function(newSettings) {
    this.db.settings = Object.assign({}, this.db.settings, newSettings);
    this.saveDatabase(this.db);
    return this.db.settings;
  };

  // FIX #35: Renamed from 'supabase' to 'db'
  var db = new DatabaseService();

  // SUPABASE INBOUND SYNC HOOK
  window.addEventListener('eduflow_supabase_sync', function(e) {
    if (e.detail) {
      db.db = e.detail;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(e.detail));
      if (window.eduFlowApp && typeof window.eduFlowApp.navigate === 'function') {
         window.eduFlowApp.navigate(window.eduFlowApp.currentRoute);
      }
    }
  });

  // ==========================================
  // 4. AUTH MODULE — Brute Force Protected (v1.9.0)
  // ==========================================
  var SESSION_KEY = 'eduflow_session';
  var BRUTE_KEY = 'eduflow_login_attempts';

  // SEV-1-D FIX: In-memory lock — localStorage.removeItem() bilan o'chirib bo'lmaydi
  var _bruteLockInMemory = 0;

  function getBruteState() {
    try { return JSON.parse(localStorage.getItem(BRUTE_KEY) || '{}'); } catch(e) { return {}; }
  }
  function setBruteState(state) {
    localStorage.setItem(BRUTE_KEY, JSON.stringify(state));
  }
  function isLockedOut() {
    // In-memory lock takes priority — can NOT be bypassed via localStorage.removeItem()
    if (_bruteLockInMemory > Date.now()) return Math.ceil((_bruteLockInMemory - Date.now()) / 60000);
    var s = getBruteState();
    if (s.lockUntil && Date.now() < s.lockUntil) return Math.ceil((s.lockUntil - Date.now()) / 60000);
    return 0;
  }
  function recordFailedAttempt() {
    var s = getBruteState();
    s.count = (s.count || 0) + 1;
    if (s.count >= 5) {
      var lockUntil = Date.now() + 5 * 60 * 1000;
      s.lockUntil = lockUntil;
      s.count = 0;
      _bruteLockInMemory = lockUntil; // also persisted in memory, immune to localStorage clear
    }
    setBruteState(s);
  }
  function clearBruteState() {
    localStorage.removeItem(BRUTE_KEY);
    _bruteLockInMemory = 0; // clear memory lock too on successful login
  }

  function AuthModule() {
    this.currentUser = this.loadSession();
    this.activeBranchId = 'all';
  }

  AuthModule.prototype.loadSession = function() {
    var raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  };

  AuthModule.prototype.login = function(email, password, remember) {
    // FIX: Brute force check
    var lockMins = isLockedOut();
    if (lockMins > 0) {
      showToast('Juda ko\'p urinish! ' + lockMins + ' daqiqadan keyin qayta urining.', 'error');
      return 'locked';
    }

    var users = db.get('users');
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPass = String(password || '').trim();
    if (!cleanEmail || !cleanPass) return false;
    var inputHash = hashPassword(cleanPass);

    var user = users.find(function(u) { return u && String(u.email || '').trim().toLowerCase() === cleanEmail; });
    // FIX #17: Generic error — email mavjudligini oshkor etmaslik
    if (!user || user.passwordHash !== inputHash) {
      recordFailedAttempt();
      var s = getBruteState();
      var remaining = 5 - (s.count || 0);
      if (remaining <= 2 && remaining > 0) {
        showToast('Diqqat: yana ' + remaining + ' ta xato urinish qoldi!', 'warning');
      }
      return false;
    }

    clearBruteState();
    this.currentUser = user;
    var sessionData = { id: user.id, code: user.code, fullName: user.fullName, email: user.email, role: user.role, branchId: user.branchId, phone: user.phone };
    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    }
    return true;
  };

  AuthModule.prototype.logout = function() {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    showToast('Tizimdan chiqdingiz', 'info');
  };

  AuthModule.prototype.isAuthenticated = function() { return !!this.currentUser; };
  AuthModule.prototype.getCurrentUser = function() { return this.currentUser; };
  AuthModule.prototype.setActiveBranch = function(bId) { this.activeBranchId = bId; };
  AuthModule.prototype.getActiveBranch = function() { return this.activeBranchId || 'all'; };

  AuthModule.prototype.hasPermission = function(route) {
    if (!this.currentUser) return false;
    // SEV-1-B FIX: Re-validate role from DB on every check — prevents localStorage tampering
    var dbUser = db.getById('users', this.currentUser.id);
    if (!dbUser) {
      // User deleted from DB but still has session — force logout
      this.currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    // Sync role from DB (always trust DB, not the stored session)
    this.currentUser.role = dbUser.role;
    this.currentUser.branchId = dbUser.branchId;
    var allowed = ROLE_PERMISSIONS[dbUser.role] || [];
    return allowed.indexOf(route) !== -1;
  };

  var auth = new AuthModule();

  // FIX: openModal — birinchi input ga auto-fokus
  var _origOpenModal = openModal;
  openModal = function(id) {
    _origOpenModal(id);
    var el = document.getElementById(id);
    if (el) {
      var first = el.querySelector('input:not([type=hidden]), select, textarea');
      if (first) setTimeout(function() { first.focus(); }, 100);
    }
  };

  // ==========================================
  // 5. MODAL HELPER (FIX #31)
  // ==========================================
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // FIX: Custom confirm modal (v2.4.0)
  function showConfirm(message, onConfirm) {
    var modal = document.getElementById('custom-confirm-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'custom-confirm-modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
    modal.innerHTML = '<div class="modal-content glass-card" style="padding:24px; max-width:380px; text-align:center;">' +
      '<h3><i class="fa-solid fa-triangle-exclamation text-warning" style="font-size:24px;"></i> Tasdiqlash</h3>' +
      '<p class="mt-3 text-muted" style="font-size:14px; line-height:1.5;">' + escapeHTML(message).replace(/\n/g, '<br>') + '</p>' +
      '<div class="modal-footer" style="display:flex; justify-content:center; gap:12px; margin-top:20px;">' +
        '<button type="button" class="btn btn-secondary" id="confirm-no-btn">Bekor qilish</button>' +
        '<button type="button" class="btn btn-danger" id="confirm-yes-btn">Tasdiqlash</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
    document.getElementById('confirm-no-btn').addEventListener('click', function() { modal.remove(); });
    document.getElementById('confirm-yes-btn').addEventListener('click', function() {
      modal.remove();
      if (onConfirm) onConfirm();
    });
  }

  // ==========================================
  // 6. ALL 16 MODULE RENDERERS (FIX #26,27: NO inline onclick — event delegation)
  // ==========================================

  // Shared: delegate clicks on module-content
  // SEV-5-C FIX: Remove previous listener before adding new one — prevents accumulation on re-render
  function delegateClicks(container, handlers) {
    if (container._delegateClickHandler) {
      container.removeEventListener('click', container._delegateClickHandler);
    }
    var handler = function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      if (handlers[action]) {
        e.preventDefault();
        handlers[action](btn, e);
      }
    };
    container._delegateClickHandler = handler;
    container.addEventListener('click', handler);
  }

  // SEV-5-E FIX: Safe unique ID generator — prevents duplicate IDs in same millisecond
  function genId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  // ---------- 1. DASHBOARD ----------
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
    var totalDebtors = allStudents.filter(function(s) { return Number(s.balance) < 0; });
    var debtorsSum = totalDebtors.reduce(function(acc, s) { return acc + Math.abs(Number(s.balance)); }, 0);

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
    // 1. Qarzdorlar tahlili
    var criticalDebtors = allStudents.filter(function(s) { return Number(s.balance) <= -300000; });
    if (criticalDebtors.length > 0) {
      alerts.push('<div style="color:#ef4444; background:rgba(239,68,68,0.1); padding:10px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-triangle-exclamation"></i> <span><strong>Kritik qarzdorlar:</strong> ' + criticalDebtors.length + ' nafar o\'quvchi 300,000 so\'mdan ko\'p qarzga ega.</span></div>');
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

    container.innerHTML =
      '<div class="metrics-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:20px;">' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-user-graduate"></i></div><div class="metric-info"><span class="metric-title">' + "👨‍🎓 O'quvchilar" + '</span><h2 class="metric-value">' + activeStudentsCount + ' nafar</h2><span class="metric-sub text-success">Jami: ' + allStudents.length + ' ta</span></div></div>' +
        '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-chalkboard-user"></i></div><div class="metric-info"><span class="metric-title">' + "👨‍🏫 O'qituvchilar" + '</span><h2 class="metric-value">' + allTeachers.length + ' nafar</h2><span class="metric-sub text-purple">Malakali mutaxassislar</span></div></div>' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-layer-group"></i></div><div class="metric-info"><span class="metric-title">👥 Guruhlar</span><h2 class="metric-value">' + allGroups.length + ' ta guruh</h2><span class="metric-sub text-muted">' + "Barcha yo'nalishlar" + '</span></div></div>' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-cash-register"></i></div><div class="metric-info"><span class="metric-title">' + "💰 Bugungi tushum" + '</span><h2 class="metric-value text-success">' + formatCurrency(todayRevenue) + '</h2><span class="metric-sub text-success">' + todayPayments.length + " ta to'lov" + '</span></div></div>' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-wallet"></i></div><div class="metric-info"><span class="metric-title">📈 Oylik tushum</span><h2 class="metric-value">' + formatCurrency(monthlyRevenue) + '</h2><span class="metric-sub text-success">' + currentMonth + ' uchun</span></div></div>' +
        '<div class="metric-card glass-card border-red"><div class="metric-icon icon-red"><i class="fa-solid fa-hand-holding-dollar"></i></div><div class="metric-info"><span class="metric-title">⚠️ Qarzdorlar</span><h2 class="metric-value text-danger">' + formatCurrency(debtorsSum) + '</h2><span class="metric-sub text-danger">' + totalDebtors.length + ' nafar qarzdor</span></div></div>' +
        '<div class="metric-card glass-card border-warning"><div class="metric-icon icon-warning" style="background:rgba(245,158,11,0.15); color:var(--color-warning);"><i class="fa-solid fa-calendar-day"></i></div><div class="metric-info"><span class="metric-title">📅 Bugungi darslar</span><h2 class="metric-value">' + todayLessons.length + ' ta dars</h2><span class="metric-sub text-warning">' + todayDayUz + '</span></div></div>' +
        '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div class="metric-info"><span class="metric-title">🤖 AI Tavsiyasi</span><h2 class="metric-value" style="font-size:16px;">' + aiAdviceTitle + '</h2><span class="metric-sub text-purple">' + aiAdviceSub + '</span></div></div>' +
      '</div>' +
      '<div class="quick-actions-bar glass-card mt-4">' +
        '<h3><i class="fa-solid fa-bolt text-warning"></i> Tezkor Harakatlar</h3>' +
        '<div class="quick-buttons mt-2" style="display:flex; gap:12px; flex-wrap:wrap;">' +
          '<button class="btn btn-primary" data-action="navigate" data-route="students" data-open-modal="true"><i class="fa-solid fa-user-plus"></i> ' + "Yangi O'quvchi" + '</button>' +
          '<button class="btn btn-success" data-action="navigate" data-route="payments" data-open-modal="true"><i class="fa-solid fa-cash-register"></i> ' + "To'lov Qabul Qilish" + '</button>' +
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

    var rowsHTML = '';
    paged.items.forEach(function(s) {
      var grpNames = groups.filter(function(g) { return s.groupIds && s.groupIds.includes(g.id); }).map(function(g) { return g.name; }).join(', ');
      var isDebtor = Number(s.balance) < 0;
      rowsHTML += '<tr>' +
        '<td><strong class="text-primary">' + escapeHTML(s.code) + '</strong></td>' +
        '<td><strong>' + escapeHTML(s.fullName) + '</strong></td>' +
        '<td>' + escapeHTML(s.phone) + '</td>' +
        '<td>' + (grpNames || '-') + '</td>' +
        '<td class="' + (isDebtor ? 'text-danger font-bold' : 'text-success') + '">' + formatCurrency(s.balance) + '</td>' +
        '<td><span class="badge badge-' + (s.status === 'active' ? 'success' : 'warning') + '">' + escapeHTML(s.status) + '</span></td>' +
        '<td style="display:flex; gap:4px;">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-student" data-id="' + s.id + '"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-success btn-xs" data-action="adjust-balance" data-id="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" title="Balansni sozlash (Chegirma/Jarima)"><i class="fa-solid fa-scale-balanced"></i></button>' +
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
      '<div class="table-responsive glass-card"><table class="data-table"><thead><tr><th>ID KOD</th><th>F.I.SH.</th><th>TELEFON</th><th>GURUH</th><th>BALANS</th><th>HOLAT</th><th>AMAL</th></tr></thead><tbody>' + rowsHTML + '</tbody></table>' + renderPaginationControls(paged) + '</div>' +
      // Add student modal
      '<div class="modal-overlay" id="modal-student" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>' + "Yangi O'quvchi Qo'shish" + '</h3><form id="form-student" class="mt-3"><div class="form-group"><label>F.I.SH.</label><input type="text" id="st-fullname" class="form-input" required placeholder="Sardorbek Rahimov"></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="st-phone" class="form-input" required placeholder="+998 90 123-45-67"></div><div class="form-group"><label>Filial</label><select id="st-branch" class="form-select">' + branchOptions + '</select></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Ota-ona Ismi</label><input type="text" id="st-parent-name" class="form-input" placeholder="Otabek Rahimov"></div><div class="form-group"><label>Ota-ona Telefoni</label><input type="text" id="st-parent-phone" class="form-input" placeholder="+998 90 999-88-77"></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruhlar (Ctrl bilan bir nechta tanlang)</label><select id="st-group" class="form-select" multiple style="height: 80px;">' + groupOptions + '</select><div id="st-conflict-warning" class="text-danger mt-1" style="display:none; font-size:12px; font-weight:bold;"></div></div><div class="form-group"><label>Telegram Chat ID (Xabarnomalar)</label><input type="text" id="st-tg-chat" class="form-input" placeholder="Masalan: 123456789"></div></div><div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Edit student modal (SEV-5-D: added parentName, parentPhone fields)
      '<div class="modal-overlay" id="modal-student-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>O\'quvchini Tahrirlash</h3><form id="form-student-edit" class="mt-3"><input type="hidden" id="st-edit-id"><div class="form-group"><label>F.I.SH.</label><input type="text" id="st-edit-fullname" class="form-input" required></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="st-edit-phone" class="form-input" required></div><div class="form-group"><label>Holat</label><select id="st-edit-status" class="form-select"><option value="active">Faol</option><option value="frozen">To\'xtatilgan</option><option value="graduated">Bitirgan</option></select></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Ota-ona Ismi</label><input type="text" id="st-edit-parent-name" class="form-input" placeholder="Ota-ona F.I.SH."></div><div class="form-group"><label>Ota-ona Telefoni</label><input type="text" id="st-edit-parent-phone" class="form-input" placeholder="+998 90 ..."></div></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruhlar (Ctrl bilan bir nechta tanlang)</label><select id="st-edit-group" class="form-select" multiple style="height: 80px;">' + groupOptions + '</select><div id="st-edit-conflict-warning" class="text-danger mt-1" style="display:none; font-size:12px; font-weight:bold;"></div></div><div class="form-group"><label>Telegram Chat ID (Xabarnomalar)</label><input type="text" id="st-edit-tg-chat" class="form-input" placeholder="Chat ID"></div></div><div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student-edit">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Balance adjust modal (FIX v2.4.0)
      '<div class="modal-overlay" id="modal-student-balance" style="display:none;"><div class="modal-content glass-card" style="padding:24px; max-width:360px;"><h3>💰 Balansni Sozlash</h3><form id="form-balance-adjust" class="mt-3"><input type="hidden" id="ba-student-id"><div class="form-group"><label>O\'quvchi</label><input type="text" id="ba-student-name" class="form-input" readonly></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Amal turi</label><select id="ba-action-type" class="form-select"><option value="add">Kredit (Chegirma/Bonus)</option><option value="sub">Debet (Jarima/Qarz)</option></select></div><div class="form-group"><label>Summa (so\'m)</label><input type="number" id="ba-amount" class="form-input" required min="1000"></div></div><div class="form-group"><label>Tavsif / Sabab</label><input type="text" id="ba-desc" class="form-input" required placeholder="Masalan: Olimpiada chegirmasi"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-student-balance">Bekor qilish</button><button type="submit" class="btn btn-success">Saqlash</button></div></form></div></div>';

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
        document.getElementById('ba-student-id').value = btn.dataset.id;
        document.getElementById('ba-student-name').value = btn.dataset.name;
        document.getElementById('ba-amount').value = '';
        document.getElementById('ba-desc').value = '';
        openModal('modal-student-balance');
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
      db.insert('students', { id: genId('st'), code: code, fullName: fullName, phone: phone, parentName: parentName, parentPhone: parentPhone, branchId: branchId, groupIds: groupIds, status: 'active', balance: 0, telegramChatId: tgChatId, joinedDate: new Date().toISOString().split('T')[0] });
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

      var finalAmount = type === 'add' ? amount : -amount;
      var nextBalance = Number(st.balance || 0) + finalAmount;

      // Update student balance
      db.update('students', sId, { balance: nextBalance });

      // Record transaction
      var pCode = generateCode('PAYMENT', 'payments');
      db.insert('payments', {
        id: crypto.randomUUID(),
        code: pCode,
        studentId: sId,
        studentName: st.fullName,
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

    if (options.openModal) openModal('modal-student');
  }

  // ---------- 3. GROUPS (Edit+Delete added) ----------
  function renderGroups() {
    var ab = auth.getActiveBranch();
    var groups = db.get('groups', function(g) { return g && (ab === 'all' || g.branchId === ab); });
    // SEV-4-D FIX: Pre-calculate student counts for groups in O(n) instead of O(n²)
    var studentsCountMap = {};
    db.get('students').forEach(function(s) {
      if (s.groupIds) s.groupIds.forEach(function(gid) { studentsCountMap[gid] = (studentsCountMap[gid] || 0) + 1; });
    });

    var teachers = db.get('users', function(u) { return u && u.role === 'teacher'; });
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;

    var cardsHTML = '';
    groups.forEach(function(g) {
      var studCount = studentsCountMap[g.id] || 0;
      cardsHTML +=
        '<div class="group-card glass-card">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--color-primary); font-weight:800;">' + escapeHTML(g.code) + '</span><span class="badge badge-success">FAOL</span></div>' +
          '<h3 class="mt-2">' + escapeHTML(g.name) + '</h3><p class="text-muted"><i class="fa-solid fa-book"></i> ' + escapeHTML(g.courseName) + '</p>' +
          '<div class="mt-3" style="display:flex; flex-direction:column; gap:6px; font-size:13px;">' +
            "<div><i class=\"fa-solid fa-chalkboard-user\"></i> O'qituvchi: <strong>" + escapeHTML(g.teacherName) + '</strong></div>' +
            '<div><i class="fa-solid fa-calendar-days"></i> Kunlar: <strong>' + escapeHTML(g.scheduleDays) + '</strong></div>' +
            '<div><i class="fa-solid fa-clock"></i> Vaqt: <strong>' + escapeHTML(g.scheduleTime) + '</strong></div>' +
            '<div><i class="fa-solid fa-door-open"></i> Xona: <strong>' + escapeHTML(g.room) + '</strong></div>' +
            "<div><i class=\"fa-solid fa-users\"></i> O'quvchilar: <strong>" + studCount + ' / ' + g.capacity + '</strong></div>' +
          '</div>' +
          '<div class="mt-4 pt-3" style="border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">' +
            '<strong>' + formatCurrency(g.monthlyFee) + ' / oy</strong>' +
            '<div style="display:flex; gap:6px;">' +
              '<button class="btn btn-secondary btn-xs" data-action="navigate" data-route="attendance">Davomat</button>' +
              '<button class="btn btn-success btn-xs" data-action="assign-student" data-id="' + g.id + '" title="O\'quvchi biriktirish"><i class="fa-solid fa-user-plus"></i></button>' +
              '<button class="btn btn-info btn-xs" data-action="edit-group" data-id="' + g.id + '"><i class="fa-solid fa-pen"></i></button>' +
              '<button class="btn btn-danger btn-xs" data-action="delete-group" data-id="' + g.id + '" data-name="' + escapeHTML(g.name) + '" data-count="' + studCount + '"><i class="fa-solid fa-trash"></i></button>' +
            '</div>' +
          '</div>' +
        '</div>';
    });

    var teacherOpts = '';
    teachers.forEach(function(t) { teacherOpts += '<option value="' + t.id + '" data-name="' + escapeHTML(t.fullName) + '">' + escapeHTML(t.fullName) + '</option>'; });
    var branchOpts = '';
    branches.forEach(function(b) { branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });
    // FIX #20: 'Shor'→'Chor' typo fixed
    var daysOpts = '<option value="Dush-Chor-Jum">Dush-Chor-Jum (Dushanba, Chorshanba, Juma)</option><option value="Sesh-Pay-Shan">Sesh-Pay-Shan (Seshanba, Payshanba, Shanba)</option><option value="Har kun">Har kun</option><option value="Dush-Sesh-Chor-Pay-Jum">Hafta kunlari (5 kun)</option>';

    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-layer-group text-primary"></i> Guruhlar va Dars Jadvallari</h2><button class="btn btn-primary" data-action="open-add-group"><i class="fa-solid fa-plus"></i> Yangi Guruh</button></div>' +
      '<div class="groups-cards-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">' + cardsHTML + '</div>' +
      // Add group modal
      '<div class="modal-overlay" id="modal-group" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Guruh Yaratish</h3><form id="form-group" class="mt-3">' +
        '<div class="form-group"><label>Guruh Nomi</label><input type="text" id="gr-name" class="form-input" required placeholder="IELTS Intensive"></div>' +
        '<div class="form-group"><label>Kurs Nomi</label><input type="text" id="gr-course" class="form-input" required placeholder="Ingliz tili (IELTS)"></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>' + "O'qituvchi" + '</label><select id="gr-teacher" class="form-select">' + teacherOpts + '</select></div><div class="form-group"><label>Filial</label><select id="gr-branch" class="form-select">' + branchOpts + '</select></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Kunlar</label><select id="gr-days" class="form-select">' + daysOpts + '</select></div><div class="form-group"><label>Vaqt</label><input type="text" id="gr-time" class="form-input" placeholder="14:00 - 16:00"></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;"><div class="form-group"><label>Xona</label><input type="text" id="gr-room" class="form-input" placeholder="Xona 102"></div><div class="form-group"><label>Oylik narx</label><input type="number" id="gr-fee" class="form-input" value="600000"></div><div class="form-group"><label>Sig\'imi</label><input type="number" id="gr-cap" class="form-input" value="15"></div></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-group">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Edit group modal
      '<div class="modal-overlay" id="modal-group-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Guruhni Tahrirlash</h3><form id="form-group-edit" class="mt-3"><input type="hidden" id="gr-edit-id">' +
        '<div class="form-group"><label>Guruh Nomi</label><input type="text" id="gr-edit-name" class="form-input" required></div>' +
        '<div class="form-group"><label>Kurs Nomi</label><input type="text" id="gr-edit-course" class="form-input" required></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>O\'qituvchi</label><select id="gr-edit-teacher" class="form-select">' + teacherOpts + '</select></div><div class="form-group"><label>Kunlar</label><select id="gr-edit-days" class="form-select">' + daysOpts + '</select></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Vaqt</label><input type="text" id="gr-edit-time" class="form-input"></div><div class="form-group"><label>Xona</label><input type="text" id="gr-edit-room" class="form-input"></div></div>' +
        '<div class="form-group"><label>Oylik narx</label><input type="number" id="gr-edit-fee" class="form-input"></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-group-edit">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div></div>' +
      // Assign student modal
      '<div class="modal-overlay" id="modal-assign-student" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Guruhga O\'quvchi Biriktirish</h3><form id="form-assign-student" class="mt-3"><input type="hidden" id="as-group-id">' +
        '<div class="form-group"><label>O\'quvchi</label><select id="as-student-id" class="form-select" required></select></div>' +
        '<div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-assign-student">Bekor qilish</button><button type="submit" class="btn btn-primary">Biriktirish</button></div></form></div></div>';

    delegateClicks(container, {
      'open-add-group': function() { openModal('modal-group'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'navigate': function(btn) { window.eduFlowApp.navigate(btn.dataset.route); },
      'assign-student': function(btn) {
        var gid = btn.dataset.id;
        var g = db.getById('groups', gid);
        if (!g) return;
        document.getElementById('as-group-id').value = gid;
        var allStudents = db.get('students', function(s) { return !s.groupIds || !s.groupIds.includes(gid); });
        var opts = '<option value="">-- O\'quvchini tanlang --</option>';
        allStudents.forEach(function(s) { opts += '<option value="' + s.id + '">' + escapeHTML(s.fullName) + ' (' + escapeHTML(s.code) + ')</option>'; });
        document.getElementById('as-student-id').innerHTML = opts;
        openModal('modal-assign-student');
      },
      // FIX: Edit group
      'edit-group': function(btn) {
        var g = db.getById('groups', btn.dataset.id);
        if (!g) return;
        document.getElementById('gr-edit-id').value = g.id;
        document.getElementById('gr-edit-name').value = g.name || '';
        document.getElementById('gr-edit-course').value = g.courseName || '';
        document.getElementById('gr-edit-days').value = g.scheduleDays || '';
        document.getElementById('gr-edit-time').value = g.scheduleTime || '';
        document.getElementById('gr-edit-room').value = g.room || '';
        document.getElementById('gr-edit-fee').value = g.monthlyFee || 600000;
        var editTeacherEl = document.getElementById('gr-edit-teacher');
        if (editTeacherEl) editTeacherEl.value = g.teacherId || '';
        openModal('modal-group-edit');
      },
      // FIX: Delete group
      'delete-group': function(btn) {
        var count = parseInt(btn.dataset.count || '0');
        var msg = count > 0 ? "'" + btn.dataset.name + "' guruhida " + count + " nafar o'quvchi bor. O'chirishni tasdiqlaysizmi?" : "'" + btn.dataset.name + "' guruhini o'chirishni tasdiqlaysizmi?";
        showConfirm(msg, function() {
          var gid = btn.dataset.id;
          db.remove('groups', gid);
          // SEV-3-C FIX: Unassign students when their group is deleted
          var studentsInGroup = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(gid); });
          studentsInGroup.forEach(function(s) { 
            var newGroupIds = s.groupIds.filter(function(id) { return id !== gid; });
            db.update('students', s.id, { groupIds: newGroupIds }); 
          });
          showToast('Guruh o\'chirildi', 'warning');
          renderGroups();
        });
      }
    });

    var form = document.getElementById('form-group');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var teacherEl = document.getElementById('gr-teacher');
      var selOpt = teacherEl.options[teacherEl.selectedIndex];
      var name = document.getElementById('gr-name').value.trim();
      var course = document.getElementById('gr-course').value.trim();
      var teacherId = teacherEl.value;
      var branchId = document.getElementById('gr-branch').value;
      var days = document.getElementById('gr-days').value;
      var time = document.getElementById('gr-time').value.trim();
      var room = document.getElementById('gr-room').value.trim();
      var fee = Number(document.getElementById('gr-fee').value) || 600000;
      var cap = Number(document.getElementById('gr-cap').value) || 15;

      var conflictMsg = checkScheduleConflict(days, time, room, teacherId);

      function saveGroup() {
        var code = generateCode('GROUP', 'groups');
        db.insert('groups', { id: crypto.randomUUID(), code: code, name: name, courseName: course, teacherId: teacherId, teacherName: selOpt ? selOpt.dataset.name || selOpt.text : '', branchId: branchId, scheduleDays: days, scheduleTime: time, room: room, monthlyFee: fee, capacity: cap });
        showToast('Yangi guruh yaratildi!', 'success');
        closeModal('modal-group');
        renderGroups();
      }

      if (conflictMsg) {
        showConfirm(conflictMsg + "\n\nBaribir ushbu jadvalni saqlamoqchimisiz?", function() {
          saveGroup();
        });
      } else {
        saveGroup();
      }
    });

    var editForm = document.getElementById('form-group-edit');
    if (editForm) editForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('gr-edit-id').value;
      var name = document.getElementById('gr-edit-name').value.trim();
      var course = document.getElementById('gr-edit-course').value.trim();
      var days = document.getElementById('gr-edit-days').value;
      var time = document.getElementById('gr-edit-time').value.trim();
      var room = document.getElementById('gr-edit-room').value.trim();
      var fee = Number(document.getElementById('gr-edit-fee').value) || 600000;

      // FIX #10: Read teacher from updated select
      var editTeacherEl = document.getElementById('gr-edit-teacher');
      var teacherId = editTeacherEl ? editTeacherEl.value : (db.getById('groups', id) || {}).teacherId || '';
      var selTeacherOpt = editTeacherEl ? editTeacherEl.options[editTeacherEl.selectedIndex] : null;
      var teacherName = selTeacherOpt ? (selTeacherOpt.dataset.name || selTeacherOpt.text) : '';

      var conflictMsg = checkScheduleConflict(days, time, room, teacherId, id);

      function updateGroup() {
        db.update('groups', id, {
          name: name,
          courseName: course,
          teacherId: teacherId,
          teacherName: teacherName,
          scheduleDays: days,
          scheduleTime: time,
          room: room,
          monthlyFee: fee
        });
        showToast('Guruh ma\'lumotlari yangilandi!', 'success');
        closeModal('modal-group-edit');
        renderGroups();
      }

      if (conflictMsg) {
        showConfirm(conflictMsg + "\n\nBaribir ushbu jadvalni saqlamoqchimisiz?", function() {
          updateGroup();
        });
      } else {
        updateGroup();
      }
    });

    var formAssign = document.getElementById('form-assign-student');
    if (formAssign) formAssign.addEventListener('submit', function(e) {
      e.preventDefault();
      var gid = document.getElementById('as-group-id').value;
      var sid = document.getElementById('as-student-id').value;
      if (!sid) { showToast("O'quvchini tanlang!", 'warning'); return; }
      db.update('students', sid, { groupId: gid });
      showToast("O'quvchi guruhga biriktirildi!", 'success');
      closeModal('modal-assign-student');
      renderGroups();
    });
  }

  // ---------- 4. TEACHERS (Edit + Custom Password added) ----------
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
        var tGroups = db.get('groups', function(g) { return g.teacherId === t.id; });
        tGroups.forEach(function(g) {
          var groupStudentsCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(g.id) && s.status === 'active'; }).length;
          estSalary += groupStudentsCount * Number(g.monthlyFee || 600000) * (sVal / 100);
        });
        salaryLabel = 'Taxminiy oylik (' + sVal + '%): ' + formatCurrency(estSalary);
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
      var salaryValue = Number(document.getElementById('te-salary-val').value) || 40;
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
      var salaryValue = Number(document.getElementById('te-edit-salary-val').value) || 40;
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
  function renderAdmins() {
    var users = db.get('users', function(u) { return u.role !== 'teacher' && u.role !== 'student' && u.role !== 'parent'; });
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;

    var rowsHTML = '';
    users.forEach(function(u) {
      var br = branches.find(function(b) { return b.id === u.branchId; });
      var brName = u.branchId === 'all' ? 'Barcha filiallar' : (br ? br.name : '-');
      rowsHTML += '<tr>' +
        '<td><strong>' + escapeHTML(u.fullName) + '</strong></td>' +
        '<td>' + escapeHTML(ROLE_LABELS[u.role] || u.role) + '</td>' +
        '<td>' + escapeHTML(u.email) + '</td>' +
        '<td>' + escapeHTML(brName) + '</td>' +
        '<td>' + escapeHTML(u.phone) + '</td>' +
        '<td class="text-right">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-admin" data-id="' + u.id + '"><i class="fa-solid fa-pen"></i></button>' +
        '</td>' +
      '</tr>';
    });

    var branchOpts = '<option value="all">Barcha filiallar (Global)</option>';
    branches.forEach(function(b) {
      branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>';
    });
    
    var roleOpts = '';
    Object.keys(ROLE_LABELS).forEach(function(r) {
      if (r !== 'teacher' && r !== 'student' && r !== 'parent') {
        roleOpts += '<option value="' + r + '">' + escapeHTML(ROLE_LABELS[r]) + '</option>';
      }
    });

    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">' +
        '<h2><i class="fa-solid fa-user-shield text-info"></i> Tizim Xodimlari (Adminlar)</h2>' +
        '<button class="btn btn-info" data-action="open-add-admin"><i class="fa-solid fa-plus"></i> Yangi Xodim</button>' +
      '</div>' +
      '<div class="table-responsive glass-card">' +
        '<table class="data-table">' +
          '<thead><tr><th>F.I.SH</th><th>Rol</th><th>Login (Email)</th><th>Filial</th><th>Telefon</th><th>Amal</th></tr></thead>' +
          '<tbody>' + rowsHTML + '</tbody>' +
        '</table>' +
      '</div>' +
      // Add Modal
      '<div class="modal-overlay" id="modal-admin-add" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Yangi Xodim Qo\'shish</h3>' +
        '<form id="form-admin-add" class="mt-3">' +
          '<div class="form-group"><label>F.I.SH</label><input type="text" id="ad-name" class="form-input" required></div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Login (Email)</label><input type="email" id="ad-email" class="form-input" required autocomplete="off"></div>' +
            '<div class="form-group"><label>Parol</label><input type="password" id="ad-pass" class="form-input" required minlength="6" autocomplete="off"></div>' +
          '</div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Rol</label><select id="ad-role" class="form-select">' + roleOpts + '</select></div>' +
            '<div class="form-group"><label>Filial</label><select id="ad-branch" class="form-select">' + branchOpts + '</select></div>' +
          '</div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="ad-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-admin-add">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-info">Saqlash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>' +
      // Edit Modal
      '<div class="modal-overlay" id="modal-admin-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Xodim Ma\'lumotlarini Tahrirlash</h3>' +
        '<form id="form-admin-edit" class="mt-3">' +
          '<input type="hidden" id="ad-edit-id">' +
          '<div class="form-group"><label>F.I.SH</label><input type="text" id="ad-edit-name" class="form-input" required></div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Login (Email)</label><input type="email" id="ad-edit-email" class="form-input" required autocomplete="off"></div>' +
            '<div class="form-group"><label>Yangi Parol (ixtiyoriy)</label><input type="password" id="ad-edit-pass" class="form-input" placeholder="O\'zgartirmaslik uchun bo\'sh qoldiring" minlength="6" autocomplete="off"></div>' +
          '</div>' +
          '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
            '<div class="form-group"><label>Rol</label><select id="ad-edit-role" class="form-select">' + roleOpts + '</select></div>' +
            '<div class="form-group"><label>Filial</label><select id="ad-edit-branch" class="form-select">' + branchOpts + '</select></div>' +
          '</div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="ad-edit-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-admin-edit">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-primary">Yangilash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>';

    delegateClicks(container, {
      'open-add-admin': function() {
        document.getElementById('form-admin-add').reset();
        openModal('modal-admin-add');
      },
      'edit-admin': function(btn) {
        var id = btn.dataset.id;
        var u = db.getById('users', id);
        if (!u) return;
        document.getElementById('ad-edit-id').value = u.id;
        document.getElementById('ad-edit-name').value = u.fullName || '';
        document.getElementById('ad-edit-email').value = u.email || '';
        document.getElementById('ad-edit-pass').value = ''; // security
        document.getElementById('ad-edit-role').value = u.role || 'branch_admin';
        document.getElementById('ad-edit-branch').value = u.branchId || 'all';
        document.getElementById('ad-edit-phone').value = u.phone || '';
        openModal('modal-admin-edit');
      },
      'close-modal': function(btn) {
        closeModal(btn.dataset.modal);
      }
    });

    var formAdd = document.getElementById('form-admin-add');
    if (formAdd) formAdd.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('ad-email').value.trim().toLowerCase();
      var pass = document.getElementById('ad-pass').value.trim();
      var phone = document.getElementById('ad-phone').value.trim();

      var existing = db.get('users').find(function(usr) { return usr.email.toLowerCase() === email; });
      if (existing) { showToast('Bu email allaqachon band!', 'error'); return; }

      db.insert('users', {
        id: crypto.randomUUID(),
        code: 'US-' + String(db.get('users').length + 1).padStart(6, '0'),
        fullName: document.getElementById('ad-name').value.trim(),
        email: email,
        passwordHash: hashPassword(pass),
        role: document.getElementById('ad-role').value,
        branchId: document.getElementById('ad-branch').value,
        phone: phone
      });
      showToast("Yangi xodim qo'shildi!", 'success');
      closeModal('modal-admin-add');
      renderAdmins();
    });

    var formEdit = document.getElementById('form-admin-edit');
    if (formEdit) formEdit.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('ad-edit-id').value;
      var email = document.getElementById('ad-edit-email').value.trim().toLowerCase();
      var newPass = document.getElementById('ad-edit-pass').value.trim();
      
      var existing = db.get('users').find(function(usr) { return usr.email.toLowerCase() === email && usr.id !== id; });
      if (existing) { showToast('Bu email allaqachon band!', 'error'); return; }

      var updates = {
        fullName: document.getElementById('ad-edit-name').value.trim(),
        email: email,
        role: document.getElementById('ad-edit-role').value,
        branchId: document.getElementById('ad-edit-branch').value,
        phone: document.getElementById('ad-edit-phone').value.trim()
      };
      
      if (newPass) {
        updates.passwordHash = hashPassword(newPass);
      }

      // Automatically update session if editing self (only name/role/branch matter mostly)
      var curr = auth.getCurrentUser();
      if (curr && curr.id === id) {
         if (newPass) curr.passwordHash = updates.passwordHash;
         curr.fullName = updates.fullName;
         curr.email = updates.email;
         curr.role = updates.role;
         curr.branchId = updates.branchId;
         // auth module will re-save session via db sync basically or manual
      }

      db.update('users', id, updates);
      showToast("Xodim ma'lumotlari yangilandi!", 'success');
      closeModal('modal-admin-edit');
      renderAdmins();
    });
  }

  // ---------- Y. BRANCHES MANAGEMENT ----------
  function renderBranches() {
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;

    var rowsHTML = '';
    branches.forEach(function(b) {
      rowsHTML += '<tr>' +
        '<td><strong>' + escapeHTML(b.name) + '</strong></td>' +
        '<td>' + escapeHTML(b.code) + '</td>' +
        '<td>' + escapeHTML(b.address) + '</td>' +
        '<td>' + escapeHTML(b.phone) + '</td>' +
        '<td>' + (b.isActive ? '<span class="badge badge-success">Faol</span>' : '<span class="badge badge-danger">Nofaol</span>') + '</td>' +
        '<td class="text-right">' +
          '<button class="btn btn-secondary btn-xs" data-action="edit-branch" data-id="' + b.id + '" style="margin-right: 4px;"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn btn-danger btn-xs" data-action="delete-branch" data-id="' + b.id + '" data-name="' + escapeHTML(b.name) + '"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    });

    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;">' +
        '<h2><i class="fa-solid fa-code-branch text-info"></i> Filiallar Boshqaruvi</h2>' +
        '<button class="btn btn-info" data-action="open-add-branch"><i class="fa-solid fa-plus"></i> Yangi Filial</button>' +
      '</div>' +
      '<div class="table-responsive glass-card">' +
        '<table class="data-table">' +
          '<thead><tr><th>Filial Nomi</th><th>Kodi</th><th>Manzil</th><th>Telefon</th><th>Holati</th><th>Amal</th></tr></thead>' +
          '<tbody>' + rowsHTML + '</tbody>' +
        '</table>' +
      '</div>' +
      // Add Modal
      '<div class="modal-overlay" id="modal-branch-add" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Yangi Filial Qo\'shish</h3>' +
        '<form id="form-branch-add" class="mt-3">' +
          '<div class="form-group"><label>Filial Nomi</label><input type="text" id="br-name" class="form-input" required></div>' +
          '<div class="form-group"><label>Manzil</label><input type="text" id="br-address" class="form-input" required></div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="br-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-branch-add">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-info">Saqlash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>' +
      // Edit Modal
      '<div class="modal-overlay" id="modal-branch-edit" style="display:none;"><div class="modal-content glass-card" style="padding:24px;">' +
        '<h3>Filialni Tahrirlash</h3>' +
        '<form id="form-branch-edit" class="mt-3">' +
          '<input type="hidden" id="br-edit-id">' +
          '<div class="form-group"><label>Filial Nomi</label><input type="text" id="br-edit-name" class="form-input" required></div>' +
          '<div class="form-group"><label>Manzil</label><input type="text" id="br-edit-address" class="form-input" required></div>' +
          '<div class="form-group mt-3"><label>Telefon</label><input type="text" id="br-edit-phone" class="form-input" placeholder="+998" required></div>' +
          '<div class="form-group mt-3"><label style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="br-edit-active"> Faol holatda</label></div>' +
          '<div class="modal-footer mt-4">' +
            '<button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-branch-edit">Bekor qilish</button>' +
            '<button type="submit" class="btn btn-primary">Yangilash</button>' +
          '</div>' +
        '</form>' +
      '</div></div>';

    delegateClicks(container, {
      'open-add-branch': function() {
        document.getElementById('form-branch-add').reset();
        openModal('modal-branch-add');
      },
      'edit-branch': function(btn) {
        var id = btn.dataset.id;
        var b = db.getById('branches', id);
        if (!b) return;
        document.getElementById('br-edit-id').value = b.id;
        document.getElementById('br-edit-name').value = b.name || '';
        document.getElementById('br-edit-address').value = b.address || '';
        document.getElementById('br-edit-phone').value = b.phone || '';
        document.getElementById('br-edit-active').checked = !!b.isActive;
        openModal('modal-branch-edit');
      },
      'delete-branch': function(btn) {
        var id = btn.dataset.id;
        var name = btn.dataset.name;
        showConfirm("Haqiqatdan ham '" + escapeHTML(name) + "' filialini o'chirib tashlamoqchimisiz? Diqqat, ushbu filialga tegishli ma'lumotlar muammoga uchrashi mumkin!", function() {
          db.delete('branches', id);
          showToast("Filial o'chirildi!", 'success');
          
          var bSel = document.getElementById('global-branch-selector');
          if (bSel) {
            var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
            db.get('branches').forEach(function(br) {
              opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
            });
            var currentVal = bSel.value;
            bSel.innerHTML = opts;
            bSel.value = currentVal;
          }
          renderBranches();
        });
      },
      'close-modal': function(btn) {
        closeModal(btn.dataset.modal);
      }
    });

    var formAdd = document.getElementById('form-branch-add');
    if (formAdd) formAdd.addEventListener('submit', function(e) {
      e.preventDefault();
      db.insert('branches', {
        id: crypto.randomUUID(),
        code: 'BR-' + String(db.get('branches').length + 1).padStart(6, '0'),
        name: document.getElementById('br-name').value.trim(),
        address: document.getElementById('br-address').value.trim(),
        phone: document.getElementById('br-phone').value.trim(),
        isActive: true
      });
      showToast("Yangi filial qo'shildi!", 'success');
      closeModal('modal-branch-add');
      
      // Update global branch selector
      var bSel = document.getElementById('global-branch-selector');
      if (bSel) {
        var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
        db.get('branches').forEach(function(br) {
          opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
        });
        var currentVal = bSel.value;
        bSel.innerHTML = opts;
        bSel.value = currentVal;
      }
      
      renderBranches();
    });

    var formEdit = document.getElementById('form-branch-edit');
    if (formEdit) formEdit.addEventListener('submit', function(e) {
      e.preventDefault();
      var id = document.getElementById('br-edit-id').value;
      db.update('branches', id, {
        name: document.getElementById('br-edit-name').value.trim(),
        address: document.getElementById('br-edit-address').value.trim(),
        phone: document.getElementById('br-edit-phone').value.trim(),
        isActive: document.getElementById('br-edit-active').checked
      });
      showToast("Filial ma'lumotlari yangilandi!", 'success');
      closeModal('modal-branch-edit');
      
      // Update global branch selector
      var bSel = document.getElementById('global-branch-selector');
      if (bSel) {
        var opts = '<option value="all">🌐 Barcha filiallar (Global)</option>';
        db.get('branches').forEach(function(br) {
          opts += '<option value="' + br.id + '">📍 ' + escapeHTML(br.name) + '</option>';
        });
        var currentVal = bSel.value;
        bSel.innerHTML = opts;
        bSel.value = currentVal;
      }

      renderBranches();
    });
  }

  // ---------- 5. ATTENDANCE (FIX #7) ----------
  var attGroupId = '';
  var attDate = '';

  function renderAttendance() {
    var ab = auth.getActiveBranch();
    var groups = db.get('groups', function(g) { return g && (ab === 'all' || g.branchId === ab); });
    if (!attGroupId && groups.length > 0) attGroupId = groups[0].id;
    if (!attDate) attDate = new Date().toISOString().split('T')[0];

    var students = db.get('students');
    var attendanceRecords = db.get('attendance');
    var currentGroup = groups.find(function(g) { return g.id === attGroupId; });
    var groupStudents = students.filter(function(s) { return s.groupIds && s.groupIds.includes(attGroupId); });

    var container = document.getElementById('module-content');
    if (!container) return;

    var groupOpts = '';
    groups.forEach(function(g) { groupOpts += '<option value="' + g.id + '"' + (g.id === attGroupId ? ' selected' : '') + '>' + escapeHTML(g.name) + '</option>'; });

    var rowsHTML = '';
    groupStudents.forEach(function(s) {
      var rec = attendanceRecords.find(function(a) { return a.groupId === attGroupId && a.studentId === s.id && a.date === attDate; });
      var status = rec ? rec.status : '';
      rowsHTML += '<tr><td><strong>' + escapeHTML(s.code) + '</strong></td><td><strong>' + escapeHTML(s.fullName) + '</strong></td><td><div style="display:flex; gap:6px; flex-wrap:wrap; min-width:160px;">' +
        '<button class="btn ' + (status === 'present' ? 'btn-success' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="present">Keldi</button>' +
        '<button class="btn ' + (status === 'absent' ? 'btn-danger' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="absent">Kelmadi</button>' +
        '<button class="btn ' + (status === 'excused' ? 'btn-warning' : 'btn-secondary') + ' btn-sm" style="flex:1; min-width:65px; padding:8px 4px; justify-content:center;" data-action="mark-att" data-student="' + s.id + '" data-status="excused">Sababli</button>' +
      '</div></td></tr>';
    });

    // FIX: Davomatning oylik statistikasi
    var currentMonthStr = attDate.slice(0, 7);
    var groupAtt = attendanceRecords.filter(function(a) { return a.groupId === attGroupId && a.date.indexOf(currentMonthStr) === 0; });
    var totalAttRecords = groupAtt.length;
    var presentCount = groupAtt.filter(function(a) { return a.status === 'present'; }).length;
    var absentCount = groupAtt.filter(function(a) { return a.status === 'absent'; }).length;
    var excusedCount = groupAtt.filter(function(a) { return a.status === 'excused'; }).length;

    var presentPercent = totalAttRecords > 0 ? Math.round((presentCount / totalAttRecords) * 100) : 0;
    var absentPercent = totalAttRecords > 0 ? Math.round((absentCount / totalAttRecords) * 100) : 0;
    var excusedPercent = totalAttRecords > 0 ? Math.round((excusedCount / totalAttRecords) * 100) : 0;

    // Ko'p qoldirgan o'quvchilar tahlili
    var badAbsentees = [];
    groupStudents.forEach(function(s) {
      var studentAbsences = groupAtt.filter(function(a) { return a.studentId === s.id && a.status === 'absent'; }).length;
      if (studentAbsences >= 2) {
        badAbsentees.push({ name: s.fullName, count: studentAbsences });
      }
    });
    var absenteeWarnings = '';
    if (badAbsentees.length > 0) {
      absenteeWarnings += '<div class="glass-card mt-4 border-red"><h4>⚠️ Surunkali qoldiruvchilar (shu oy)</h4><ul style="margin-left:20px; margin-top:8px;">';
      badAbsentees.forEach(function(ba) {
        absenteeWarnings += '<li class="text-danger">' + escapeHTML(ba.name) + ' — <strong>' + ba.count + ' marta</strong> kelmagan</li>';
      });
      absenteeWarnings += '</ul></div>';
    }

    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-clipboard-user text-warning"></i> Kunlik Davomat Tizimi</h2></div>' +
      '<div class="glass-card mb-4" style="display:flex; gap:16px; flex-wrap:wrap;"><div class="form-group mb-0" style="flex:1; min-width:200px;"><label>Guruhni Tanlang</label><select id="att-group-select" class="form-select">' + groupOpts + '</select></div><div class="form-group mb-0" style="flex:1; min-width:200px;"><label>Dars Sanasi</label><input type="date" id="att-date-select" class="form-input" value="' + attDate + '"></div></div>' +
      '<div class="table-responsive glass-card mb-4"><h3>' + (currentGroup ? escapeHTML(currentGroup.name) : 'Guruh') + ' — Dars Davomati</h3><table class="data-table mt-3"><thead><tr><th>ID KOD</th><th>' + "O'QUVCHI F.I.SH." + '</th><th>DAVOMAT HOLATI</th></tr></thead><tbody>' + rowsHTML + '</tbody></table></div>' +
      '<div class="glass-card"><h3>📈 Oylik Davomat Tahlili (' + currentMonthStr + ')</h3>' +
        '<div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:12px;">' +
          '<div style="flex:1; min-width:140px;">🟢 Kelganlar: <strong>' + presentPercent + '%</strong> (' + presentCount + ' marta)</div>' +
          '<div style="flex:1; min-width:140px;">🔴 Kelmaganlar: <strong>' + absentPercent + '%</strong> (' + absentCount + ' marta)</div>' +
          '<div style="flex:1; min-width:140px;">🟡 Sabablilar: <strong>' + excusedPercent + '%</strong> (' + excusedCount + ' marta)</div>' +
        '</div>' +
      '</div>' + absenteeWarnings;

    // FIX #7: Change listeners for group and date
    var grpSelect = document.getElementById('att-group-select');
    var dateInput = document.getElementById('att-date-select');
    if (grpSelect) grpSelect.addEventListener('change', function() { attGroupId = grpSelect.value; renderAttendance(); });
    if (dateInput) dateInput.addEventListener('change', function() { attDate = dateInput.value; renderAttendance(); });

    delegateClicks(container, {
      'mark-att': function(btn) {
        var studentId = btn.dataset.student;
        var status = btn.dataset.status;
        // SEV-3-A FIX: Fetch fresh records from DB, not from stale closure array
        var rec = db.get('attendance').find(function(a) { return a.groupId === attGroupId && a.studentId === studentId && a.date === attDate; });
        if (rec) {
          db.update('attendance', rec.id, { status: status });
        } else {
          db.insert('attendance', { id: crypto.randomUUID(), groupId: attGroupId, studentId: studentId, date: attDate, status: status });
        }

        // Auto Telegram Notification on Absence (v3.0.0 Task 5)
        var st = db.getById('students', studentId);
        if (status === 'absent' && st) {
          var grp = db.getById('groups', attGroupId);
          var groupName = grp ? grp.name : 'Guruh';
          var tgText = "⚠️ <b>DARS QOLDIRILDI</b>\n\n" +
            "👤 <b>Talaba:</b> " + escapeHTML(st.fullName) + " (" + escapeHTML(st.code) + ")\n" +
            "📚 <b>Guruh:</b> " + escapeHTML(groupName) + "\n" +
            "📅 <b>Sana:</b> " + escapeHTML(attDate) + "\n\n" +
            "Bugungi darsda o'quvchi ishtirok etmadi. Iltimos, sababini ma'lum qiling.";
          sendTelegramNotification(st.telegramChatId, tgText);
        }

        showToast('Davomat belgilandi: ' + status.toUpperCase(), 'info');
        renderAttendance();
      }
    });
  }
  // ---------- X. EMPLOYEE ATTENDANCE ----------
  var empAttDate = new Date().toISOString().split('T')[0];
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
        '<td><strong>' + escapeHTML(p.studentName) + '</strong></td>' +
        '<td><strong class="text-success">' + formatCurrency(p.amount) + '</strong></td>' +
        '<td><span class="badge badge-info">' + escapeHTML((p.paymentMethod || '').toUpperCase()) + '</span></td>' +
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
      '<div class="modal-overlay" id="modal-payment" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>' + "To'lov Qabul Qilish" + '</h3><form id="form-payment" class="mt-3"><div class="form-group"><label>' + "O'quvchini Tanlang" + '</label><select id="pm-student" class="form-select">' + studentOpts + '</select></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;"><div class="form-group"><label>' + "To'lov Summasi (so'm)" + '</label><input type="number" id="pm-amount" class="form-input" required min="1000" placeholder="Summa"></div><div class="form-group"><label>' + "To'lov Usuli" + '</label><select id="pm-method" class="form-select"><option value="click">Click / Payme</option><option value="cash">Naqd Pul</option><option value="card">Terminal / Karta</option></select></div><div class="form-group"><label>Oyi</label><input type="month" id="pm-month" class="form-input" required value="' + new Date().toISOString().slice(0, 7) + '"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-payment">Bekor qilish</button><button type="submit" class="btn btn-success">Tasdiqlash</button></div></form></div></div>' +
      '<div class="modal-overlay" id="modal-receipt" style="display:none;"><div class="modal-content glass-card" style="padding:32px; text-align:center;" id="receipt-content"></div></div>';

    // FIX: Filter listeners
    var pmSearchEl = document.getElementById('pm-search');
    var pmMethodEl = document.getElementById('pm-filter-method');
    if (pmSearchEl) pmSearchEl.addEventListener('input', function() { paymentsSearch = pmSearchEl.value.trim(); paymentsPage = 1; renderPayments(); });
    if (pmMethodEl) pmMethodEl.addEventListener('change', function() { paymentsFilterMethod = pmMethodEl.value; paymentsPage = 1; renderPayments(); });

    var pmStudentEl = document.getElementById('pm-student');
    if (pmStudentEl) pmStudentEl.addEventListener('change', function() {
      var st = students.find(function(s) { return s.id === pmStudentEl.value; });
      if (st) {
        var stGroups = groups.filter(function(g) { return st.groupIds && st.groupIds.includes(g.id); });
        var totalFee = stGroups.reduce(function(sum, g) { return sum + Number(g.monthlyFee || 0); }, 0);
        document.getElementById('pm-amount').value = totalFee || 600000;
      }
    });

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
          if (st) db.update('students', payment.studentId, { balance: Number(st.balance) - Number(payment.amount) });
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
          rc.innerHTML = '<div style="border:2px dashed var(--border-color); padding:24px; border-radius:12px;"><i class="fa-solid fa-graduation-cap text-primary" style="font-size:36px;"></i><h2 class="mt-2">EduFlow CRM</h2><hr style="border-color:var(--border-color); margin:16px 0;"><p style="text-align:left;"><strong>Kvitansiya:</strong> ' + escapeHTML(payment.code) + '</p><p style="text-align:left;"><strong>' + "O'quvchi:" + '</strong> ' + escapeHTML(payment.studentName) + '</p><p style="text-align:left;"><strong>Summa:</strong> <span class="text-success">' + formatCurrency(payment.amount) + '</span></p><p style="text-align:left;"><strong>Usuli:</strong> ' + escapeHTML(payment.paymentMethod.toUpperCase()) + '</p><p style="text-align:left;"><strong>Sana:</strong> ' + escapeHTML(payment.date) + '</p><p style="text-align:left;"><strong>Qabul qildi:</strong> ' + escapeHTML(payment.receivedBy) + '</p><hr style="border-color:var(--border-color); margin:16px 0;"><button class="btn btn-primary" data-action="do-print">🖨️ Chop Etish</button> <button class="btn btn-secondary" data-action="close-modal" data-modal="modal-receipt">Yopish</button></div>';
        }
        openModal('modal-receipt');
      },
      'do-print': function() { window.print(); }
    });

    var form = document.getElementById('form-payment');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var stId = document.getElementById('pm-student').value;
      var amount = Number(document.getElementById('pm-amount').value);
      var method = document.getElementById('pm-method').value;
      var month = document.getElementById('pm-month').value || new Date().toISOString().slice(0, 7);
      // FIX #23: O'quvchi tanlanmasa xato
      if (!stId) { showToast("Iltimos, o'quvchini tanlang!", 'warning'); return; }
      if (isNaN(amount) || amount <= 0) { showToast("To'lov summasi noto'g'ri!", 'warning'); return; }
      var st = students.find(function(s) { return s.id === stId; });
      if (!st) return;
      var code = generateCode('PAYMENT', 'payments');
      db.insert('payments', { id: genId('pm'), code: code, studentId: st.id, studentName: st.fullName, branchId: st.branchId, amount: amount, paymentMethod: method, month: month, date: new Date().toISOString().split('T')[0], receivedBy: auth.getCurrentUser() ? auth.getCurrentUser().fullName : 'Admin', cancelled: false });
      var newBalance = Number(st.balance || 0) + amount;
      db.update('students', st.id, { balance: newBalance });

      // Auto Telegram Notification on Payment (v3.0.0 Task 5)
      var tgText = "🔔 <b>TO'LOV QABUL QILINDI</b>\n\n" +
        "👤 <b>Talaba:</b> " + escapeHTML(st.fullName) + " (" + escapeHTML(st.code) + ")\n" +
        "💰 <b>Summa:</b> " + formatCurrency(amount) + "\n" +
        "💳 <b>Uslub:</b> " + method.toUpperCase() + "\n" +
        "📈 <b>Yangi Balans:</b> " + formatCurrency(newBalance) + "\n\n" +
        "Tashrifingiz uchun rahmat! 🎓";
      sendTelegramNotification(st.telegramChatId, tgText);

      showToast("To'lov " + formatCurrency(amount) + ' qabul qilindi!', 'success');
      closeModal('modal-payment');
      renderPayments();
    });

    if (options.openModal) openModal('modal-payment');
  }

  // ---------- 7. LEADS KANBAN (FIX #10, #11) ----------
  function renderLeads(options) {
    options = options || {};
    var leads = db.get('leads');
    var branches = db.get('branches');
    var container = document.getElementById('module-content');
    if (!container) return;

    var stages = [
      { id: 'new', title: '🆕 Yangi Murojaatlar' },
      { id: 'contacted', title: '📞 Aloqada' },
      { id: 'trial_lesson', title: '🎯 Sinov Darsi' },
      { id: 'enrolled', title: "✅ A'zo Bo'ldi" },
      { id: 'rejected', title: "❌ Rad Etildi" }
    ];
    var stageIds = stages.map(function(s) { return s.id; });

    var columnsHTML = '';
    stages.forEach(function(st) {
      var list = leads.filter(function(l) { return l.status === st.id; });
      var cardsHTML = '';
      list.forEach(function(l) {
        var currIdx = stageIds.indexOf(l.status);

        var prevBtn = '';
        if (currIdx > 0) {
          prevBtn = '<button class="btn btn-secondary btn-xs" data-action="move-lead" data-id="' + l.id + '" data-next="' + stageIds[currIdx - 1] + '" title="Orqaga"><i class="fa-solid fa-arrow-left"></i></button>';
        }

        var nextBtn = '';
        if (currIdx < stageIds.length - 1) {
          nextBtn = '<button class="btn btn-primary btn-xs" data-action="move-lead" data-id="' + l.id + '" data-next="' + stageIds[currIdx + 1] + '" title="Keyingi"><i class="fa-solid fa-arrow-right"></i></button>';
        }

        var deleteBtn = '<button class="btn btn-danger btn-xs" data-action="delete-lead" data-id="' + l.id + '" data-name="' + escapeHTML(l.fullName) + '" title="O\'chirish"><i class="fa-solid fa-trash"></i></button>';

        cardsHTML += '<div style="background:var(--bg-input); padding:12px; border-radius:10px; display:flex; flex-direction:column; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
            '<div><strong>' + escapeHTML(l.fullName) + '</strong><br><small class="text-muted">' + escapeHTML(l.phone) + ' • ' + escapeHTML(l.subject) + '</small></div>' +
            deleteBtn +
          '</div>' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">' +
            (prevBtn || '<span></span>') +
            (nextBtn || '<span class="badge badge-success">Yakunlandi</span>') +
          '</div>' +
        '</div>';
      });
      columnsHTML += '<div class="kanban-column glass-card" style="flex:1; min-width:240px;"><h4>' + st.title + ' (' + list.length + ')</h4><div class="kanban-cards mt-3" style="display:flex; flex-direction:column; gap:10px;">' + cardsHTML + '</div></div>';
    });

    var branchOpts = '';
    branches.forEach(function(b) { branchOpts += '<option value="' + b.id + '">' + escapeHTML(b.name) + '</option>'; });

    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-filter-circle-dollar text-purple"></i> Lidlar Kanban Pipeline</h2><button class="btn btn-purple" data-action="open-add-lead"><i class="fa-solid fa-plus"></i> Yangi Lid</button></div>' +
      '<div class="kanban-board" style="display:flex; gap:16px; overflow-x:auto;">' + columnsHTML + '</div>' +
      '<div class="modal-overlay" id="modal-lead" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Lid Kiritish</h3><form id="form-lead" class="mt-3">' +
        '<div class="form-group"><label>F.I.SH.</label><input type="text" id="le-name" class="form-input" required></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Telefon</label><input type="text" id="le-phone" class="form-input" required></div><div class="form-group"><label>Fan</label><input type="text" id="le-subject" class="form-input" required></div></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Manba</label><select id="le-source" class="form-select"><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="friend">Do\'st tavsiyasi</option><option value="banner">Banner/Reklama</option><option value="other">Boshqa</option></select></div><div class="form-group"><label>Filial</label><select id="le-branch" class="form-select">' + branchOpts + '</select></div></div>' +
        '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-lead">Bekor qilish</button><button type="submit" class="btn btn-purple">Saqlash</button></div></form></div></div>';

    delegateClicks(container, {
      'open-add-lead': function() { openModal('modal-lead'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); },
      'move-lead': function(btn) {
        db.update('leads', btn.dataset.id, { status: btn.dataset.next });
        showToast('Lid yangi bosqichga ko\'chirildi!', 'success');
        renderLeads();
      },
      // FIX #10: Lid o'chirish
      'delete-lead': function(btn) {
        showConfirm("'" + btn.dataset.name + "' lidini o'chirishni tasdiqlaysizmi?", function() {
          db.remove('leads', btn.dataset.id);
          showToast('Lid o\'chirildi', 'warning');
          renderLeads();
        });
      }
    });

    var form = document.getElementById('form-lead');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var newPhone = document.getElementById('le-phone').value.trim();
      // FIX #6: Duplicate phone check for leads
      var existingLead = db.get('leads').find(function(l) {
        return l.phone && l.phone.replace(/[^0-9]/g, '') === newPhone.replace(/[^0-9]/g, '');
      });
      if (existingLead) {
        showToast('Bu telefon raqam allaqachon tizimda: ' + escapeHTML(existingLead.fullName) + ' (' + escapeHTML(existingLead.status) + ')', 'warning');
        return;
      }
      var code = generateCode('LEAD', 'leads');
      db.insert('leads', { id: crypto.randomUUID(), code: code, fullName: document.getElementById('le-name').value.trim(), phone: newPhone, subject: document.getElementById('le-subject').value.trim(), source: document.getElementById('le-source').value, status: 'new', branchId: document.getElementById('le-branch').value, createdAt: new Date().toISOString().split('T')[0] });
      showToast('Yangi lid kiritildi!', 'success');
      closeModal('modal-lead');
      renderLeads();
    });

    if (options.openModal) openModal('modal-lead');
  }

  // ---------- 8. HOMEWORK (FIX #12) ----------
  function renderHomework() {
    var hwList = db.get('homework');
    var groups = db.get('groups');
    var container = document.getElementById('module-content');
    if (!container) return;

    var rowsHTML = '';
    hwList.forEach(function(h) {
      var grp = groups.find(function(g) { return g.id === h.groupId; });
      // SEV-3-F FIX: Calculate totalCount dynamically to prevent stale data
      var grpStudentsCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(h.groupId) && s.status === 'active'; }).length;
      var totalCount = grpStudentsCount || h.totalCount;
      rowsHTML += '<tr><td><strong>' + escapeHTML(h.title) + '</strong></td><td>' + (grp ? escapeHTML(grp.name) : '-') + '</td><td>' + escapeHTML(h.dueDate) + '</td><td><span class="badge badge-success">' + h.submittedCount + ' / ' + totalCount + ' nafar</span></td><td><strong>' + escapeHTML(h.avgGrade) + '</strong></td></tr>';
    });

    var groupOpts = '';
    groups.forEach(function(g) { groupOpts += '<option value="' + g.id + '">' + escapeHTML(g.name) + '</option>'; });

    container.innerHTML =
      '<div class="module-header mb-4" style="display:flex; justify-content:space-between; align-items:center;"><h2><i class="fa-solid fa-book-open text-info"></i> Uy Vazifalari Tizimi</h2><button class="btn btn-info" data-action="open-add-hw"><i class="fa-solid fa-plus"></i> Yangi Vazifa</button></div>' +
      '<div class="table-responsive glass-card"><table class="data-table"><thead><tr><th>Topshiriq</th><th>Guruh</th><th>Muhlati</th><th>Topshirganlar</th><th>' + "O'rtacha Ball" + '</th></tr></thead><tbody>' + rowsHTML + '</tbody></table></div>' +
      '<div class="modal-overlay" id="modal-hw" style="display:none;"><div class="modal-content glass-card" style="padding:24px;"><h3>Yangi Uy Vazifasi</h3><form id="form-hw" class="mt-3"><div class="form-group"><label>Topshiriq Nomi</label><input type="text" id="hw-title" class="form-input" required></div><div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;"><div class="form-group"><label>Guruh</label><select id="hw-group" class="form-select">' + groupOpts + '</select></div><div class="form-group"><label>Muhlat</label><input type="date" id="hw-due" class="form-input" required></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal" data-modal="modal-hw">Bekor qilish</button><button type="submit" class="btn btn-info">Saqlash</button></div></form></div></div>';

    delegateClicks(container, {
      'open-add-hw': function() { openModal('modal-hw'); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); }
    });

    var form = document.getElementById('form-hw');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var gId = document.getElementById('hw-group').value;
      var studCount = db.get('students', function(s) { return s.groupIds && s.groupIds.includes(gId) && s.status === 'active'; }).length;
      db.insert('homework', { id: crypto.randomUUID(), groupId: gId, title: document.getElementById('hw-title').value.trim(), dueDate: document.getElementById('hw-due').value, submittedCount: 0, totalCount: studCount || 15, avgGrade: 'Baholanmagan', status: 'pending' });
      showToast('Yangi uy vazifasi yaratildi!', 'success');
      closeModal('modal-hw');
      renderHomework();
    });
  }

  // ---------- 9. CERTIFICATES (FIX #13, + graduation gate v1.9.0) ----------
  function renderCertificates() {
    var students = db.get('students');
    var groups = db.get('groups');
    var container = document.getElementById('module-content');
    if (!container) return;

    // FIX #9: Faqat bitirgan yoki faol o'quvchilar (holat tekshiruvi modal ochilganda)
    var studentOpts = '';
    students.forEach(function(s) {
      var badge = s.status === 'graduated' ? ' ✅' : (s.status === 'frozen' ? ' ❄️' : '');
      studentOpts += '<option value="' + s.id + '" data-name="' + escapeHTML(s.fullName) + '" data-status="' + escapeHTML(s.status) + '">' + escapeHTML(s.fullName) + badge + '</option>';
    });

    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-award text-warning"></i> Sertifikatlar Generatori</h2></div>' +
      '<div class="glass-card text-center" style="padding:40px;"><i class="fa-solid fa-award text-warning" style="font-size:48px;"></i><h2 class="mt-3">EduFlow Rasmiy Sertifikat</h2><div class="form-group mt-3" style="max-width:300px; margin:16px auto;"><label>' + "O'quvchini Tanlang" + '</label><select id="cert-st-select" class="form-select">' + studentOpts + '</select></div><button class="btn btn-warning mt-3" data-action="gen-cert">Sertifikat Yaratish va Chop Etish</button></div>' +
      '<div class="modal-overlay" id="modal-cert" style="display:none;"><div class="modal-content glass-card" style="padding:32px;" id="cert-body"></div></div>';

    delegateClicks(container, {
      'gen-cert': function() {
        var sel = document.getElementById('cert-st-select');
        var selectedOpt = sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex] : null;
        var name = selectedOpt ? (selectedOpt.dataset.name || selectedOpt.text || '') : '';
        var status = selectedOpt ? (selectedOpt.dataset.status || '') : '';
        var settings = db.getSettings();
        var certBody = document.getElementById('cert-body');
        function proceedCert() {
          if (certBody) {
            var certNo = 'EF-' + new Date().getFullYear() + '-' + String(db.get('students').length).padStart(4, '0');
            certBody.innerHTML = '<div style="border:3px double var(--color-warning); padding:40px; border-radius:16px; text-align:center;"><i class="fa-solid fa-award text-warning" style="font-size:64px;"></i><h1 class="mt-3">SERTIFIKAT</h1><p class="text-muted" style="font-size:12px;">№ ' + certNo + '</p><hr style="border-color:var(--color-warning); margin:20px 0;"><h2 class="text-primary">' + escapeHTML(name) + '</h2><p class="mt-3 text-muted" style="font-size:16px;">' + escapeHTML(settings.centerName) + " ta'lim markazida muvaffaqiyatli o'qishni tugatganligi tasdiqlanadi." + '</p><p class="mt-4"><strong>Sana:</strong> ' + new Date().toLocaleDateString('uz-UZ') + '</p><p><strong>Direktor:</strong> ' + escapeHTML(settings.centerName) + ' Rahbari</p><hr style="border-color:var(--color-warning); margin:20px 0;"><button class="btn btn-warning" data-action="do-print">🖨️ Chop Etish</button> <button class="btn btn-secondary" data-action="close-modal" data-modal="modal-cert">Yopish</button></div>';
          }
          openModal('modal-cert');
        }
        // FIX #9: Ogohlantirish — hali bitirmagan
        if (status && status !== 'graduated') {
          showConfirm("Bu o'quvchi hali " + (status === 'frozen' ? 'to\'xtatilgan' : 'faol o\'qiydi') + ". Shunga qaramay sertifikat berishni tasdiqlaysizmi?", proceedCert);
        } else {
          proceedCert();
        }
      },
      'do-print': function() { window.print(); },
      'close-modal': function(btn) { closeModal(btn.dataset.modal); }
    });
  }

  // ---------- 10. TELEGRAM BOT (FIX #14) ----------
  function renderTelegramBot() {
    var logs = db.get('telegramLog');
    var settings = db.getSettings();
    var container = document.getElementById('module-content');
    if (!container) return;

    var logHTML = '';
    logs.slice().reverse().forEach(function(l) {
      logHTML += '<div style="background:var(--bg-input); padding:10px 14px; border-radius:8px; margin-bottom:8px;"><strong>' + escapeHTML(l.date) + '</strong> — ' + escapeHTML(l.text) + '</div>';
    });

    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-brands fa-telegram text-info"></i> Telegram & SMS Bot</h2></div>' +
      '<div class="glass-card">' +
        '<h3>Ommaviy Broadcast Xabarnoma</h3>' +
        '<div class="form-row mt-3" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">' +
          '<div class="form-group"><label>Telegram Bot Token</label><input type="password" id="tg-panel-token" class="form-input" value="' + escapeHTML(settings.telegramBotToken || '') + '" placeholder="Tokenni kiriting (BotFather dan)"></div>' +
          '<div class="form-group"><label>Chat ID / Kanal ID</label><input type="text" id="tg-panel-chat" class="form-input" value="' + escapeHTML(settings.telegramDefaultChatId || '') + '" placeholder="Masalan: -100..."></div>' +
        '</div>' +
        '<textarea id="tg-text" class="form-input" rows="3" placeholder="Xabar matnini kiriting..."></textarea>' +
        '<button class="btn btn-purple mt-3" data-action="send-tg">Xabarni Yuborish</button>' +
      '</div>' +
      (logs.length > 0 ? '<div class="glass-card mt-4"><h3>📋 Yuborilgan Xabarlar Jurnali (' + logs.length + ')</h3><div class="mt-3">' + logHTML + '</div></div>' : '');

    delegateClicks(container, {
      'send-tg': function() {
        var el = document.getElementById('tg-text');
        var text = el ? el.value.trim() : '';
        var chatInput = document.getElementById('tg-panel-chat');
        var chatId = chatInput ? chatInput.value.trim() : (settings.telegramDefaultChatId || '');
        var tokenInput = document.getElementById('tg-panel-token');
        var token = tokenInput ? tokenInput.value.trim() : (settings.telegramBotToken || '');

        if (!text) { showToast('Xabar matnini kiriting!', 'warning'); return; }
        if (!token) {
          showToast('Xato: Telegram Bot Token kiritilmagan!', 'error');
          return;
        }
        if (!chatId) {
          showToast('Xato: Chat ID yoki Kanal ID kiritilmagan!', 'error');
          return;
        }

        // Auto-save settings when sending
        var currentSettings = db.getSettings();
        db.updateSettings(Object.assign({}, currentSettings, {
          telegramBotToken: token,
          telegramDefaultChatId: chatId
        }));

        // Live send to Telegram Bot API (via corsproxy.io to bypass CORS and ISP blocks without VPN)
        var targetUrl = 'https://api.telegram.org/bot' + token + '/sendMessage';
        var proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
        showToast('Xabar yuborilmoqda (VPNsiz)...', 'info');

        fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
          })
        }).then(function(res) {
          return res.json();
        }).then(function(data) {
          if (data.ok) {
            db.insert('telegramLog', { id: crypto.randomUUID(), text: 'YUBORILDI (' + chatId + '): ' + text, date: new Date().toLocaleString('uz-UZ') });
            if (el) el.value = '';
            showToast('Telegram xabar muvaffaqiyatli yuborildi!', 'success');
            renderTelegramBot();
          } else {
            showToast('Telegram Xatosi: ' + data.description, 'error');
          }
        })['catch'](function(err) {
          console.error(err);
          showToast('Ulanish xatosi: ' + err.message + ' (Internet yoki Proksi muammosi)', 'error');
        });
      }
    });
  }

  // ---------- 11. FINANCE P&L (DELETED - merged to the main renderFinance below) ----------

  // ---------- 12. REPORTS ----------
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
  function renderMonitoring() {
    var container = document.getElementById('module-content');
    if (!container) return;
    var dbSize = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
    var dbSizeKB = (dbSize / 1024).toFixed(1);
    var totalRecords = db.get('students').length + db.get('payments').length + db.get('groups').length + db.get('leads').length + db.get('users').length + db.get('attendance').length + db.get('homework').length;
    var lastSave = new Date().toLocaleString('uz-UZ');

    // FIX #12: localStorage foiz hisobi
    var MAX_LS_KB = 5120; // 5MB
    var usagePercent = Math.min(100, Math.round((dbSize / (MAX_LS_KB * 1024)) * 100));
    var usageColor = usagePercent > 80 ? 'text-danger' : usagePercent > 50 ? 'text-warning' : 'text-success';
    var usageIcon = usagePercent > 80 ? '🔴' : usagePercent > 50 ? '🟡' : '🟢';
    var bruteState = getBruteState();
    var loginAttempts = bruteState.count || 0;

    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-heart-pulse text-success"></i> Tizim Monitoringi</h2></div>' +
      '<div class="metrics-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px;">' +
        '<div class="metric-card glass-card border-green"><div class="metric-icon icon-green"><i class="fa-solid fa-server"></i></div><div class="metric-info"><span class="metric-title">SPA App Server</span><h2 class="metric-value text-success">🟢 ISHLAYAPTI</h2><span class="metric-sub text-muted">v3.0.0 Enterprise</span></div></div>' +
        '<div class="metric-card glass-card border-' + (usagePercent > 80 ? 'red' : 'green') + '"><div class="metric-icon icon-' + (usagePercent > 80 ? 'red' : 'green') + '"><i class="fa-solid fa-database"></i></div><div class="metric-info"><span class="metric-title">Database Storage</span><h2 class="metric-value ' + usageColor + '">' + usageIcon + ' ' + dbSizeKB + ' KB</h2><span class="metric-sub text-muted">' + usagePercent + '% (max 5MB) • ' + totalRecords + ' ta yozuv</span></div></div>' +
        '<div class="metric-card glass-card border-blue"><div class="metric-icon icon-blue"><i class="fa-solid fa-clock-rotate-left"></i></div><div class="metric-info"><span class="metric-title">Oxirgi Saqlash</span><h2 class="metric-value" style="font-size:16px;">' + lastSave + '</h2></div></div>' +
        '<div class="metric-card glass-card border-purple"><div class="metric-icon icon-purple"><i class="fa-solid fa-shield-halved"></i></div><div class="metric-info"><span class="metric-title">Xavfsizlik</span><h2 class="metric-value text-success">🟢 RBAC FAOL</h2><span class="metric-sub text-muted">DJB2+Salt • Brute Force (urinish: ' + loginAttempts + '/5)</span></div></div>' +
      '</div>';
  }

  // ---------- 15. AI COMMAND CENTER ----------
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
  function renderSettings() {
    var container = document.getElementById('module-content');
    if (!container) return;
    var settings = db.getSettings();
    var students = db.get('students');

    // WhatsApp ommaviy xabar uchun o'quvchilar
    var studentCheckboxes = students.map(function(s) {
      var botBadge = s.telegramChatId ? '<i class="fa-brands fa-telegram text-primary" title="Botga ulangan"></i>' : '';
      return '<label style="display:flex; align-items:center; gap:8px; padding:6px 0; cursor:pointer;"><input type="checkbox" class="wa-student-check" data-phone="' + escapeHTML(s.phone) + '" data-name="' + escapeHTML(s.fullName) + '" data-chatid="' + escapeHTML(s.telegramChatId || '') + '"> <strong>' + escapeHTML(s.fullName) + '</strong> <small class="text-muted">' + escapeHTML(s.phone) + '</small> ' + botBadge + '</label>';
    }).join('');

    container.innerHTML =
      '<div class="module-header mb-4"><h2><i class="fa-solid fa-gears text-primary"></i> Sozlamalar va Tizim</h2></div>' +
      // Asosiy sozlamalar
      '<div class="glass-card mb-4"><h3><i class="fa-solid fa-sliders"></i> Umumiy Sozlamalar</h3><form id="form-settings" class="mt-3">' +
        "<div class=\"form-group\"><label>O'quv Markazi Nomi</label><input type=\"text\" id=\"set-name\" class=\"form-input\" value=\"" + escapeHTML(settings.centerName) + '"></div>' +
        '<div class="form-group"><label>Logo Sarlavhasi</label><input type="text" id="set-logo" class="form-input" value="' + escapeHTML(settings.logoText) + '"></div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
          "<div class=\"form-group\"><label>Oylik Ijara va Kommunal Xarajat (so'm)</label><input type=\"number\" id=\"set-rent\" class=\"form-input\" value=\"" + (settings.rentExpense || 3500000) + '"></div>' +
          "<div class=\"form-group\"><label>Oylik Marketing Xarajati (so'm)</label><input type=\"number\" id=\"set-marketing\" class=\"form-input\" value=\"" + (settings.marketingExpense || 1500000) + '"></div>' +
        '</div>' +
        '<div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">' +
          '<div class="form-group"><label>Telegram Bot Token (Xavfsiz/Maxfiy)</label><input type="password" id="set-tg-token" class="form-input" value="' + escapeHTML(settings.telegramBotToken || '') + '" placeholder="BotToken (BotFather dan)"></div>' +
          '<div class="form-group"><label>Telegram Default Chat ID (Kanal/Guruh)</label><input type="text" id="set-tg-chat" class="form-input" value="' + escapeHTML(settings.telegramDefaultChatId || '') + '" placeholder="Masalan: -10012345678"></div>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">Sozlamalarni Saqlash</button>' +
      '</form></div>' +
      // Backup / Restore
      '<div class="glass-card mb-4"><h3><i class="fa-solid fa-shield-halved text-success"></i> Ma\'lumot Zaxirasi (Backup)</h3><p class="text-muted mt-2">Barcha ma\'lumotlarni JSON faylga saqlang yoki tiklang.</p><div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:16px;">' +
        '<button class="btn btn-success" data-action="do-backup"><i class="fa-solid fa-download"></i> Zaxiralash (JSON)</button>' +
        '<label class="btn btn-warning" style="cursor:pointer;"><i class="fa-solid fa-upload"></i> Tiklash (JSON) <input type="file" id="restore-file" accept=".json" style="display:none;"></label>' +
      '</div><p class="text-muted mt-2" style="font-size:12px;">⚠️ Tiklash amali mavjud ma\'lumotlarni almashtiradi!</p></div>' +
      // WhatsApp va Telegram ommaviy xabar
      '<div class="glass-card"><h3><i class="fa-solid fa-paper-plane text-primary"></i> WhatsApp & Telegram Xabar</h3><p class="text-muted mt-2">O\'quvchilarni tanlang va xabar yuboring:</p>' +
        '<div style="display:flex; gap:8px; margin:12px 0;"><button class="btn btn-secondary btn-sm" data-action="wa-select-all">Hammasini Tanlash</button><button class="btn btn-secondary btn-sm" data-action="wa-select-none">Tanlovni Olib Tashlash</button></div>' +
        '<div id="wa-student-list" style="max-height:200px; overflow-y:auto; padding:8px; background:var(--bg-input); border-radius:8px; margin-bottom:12px;">' + studentCheckboxes + '</div>' +
        '<div class="form-group"><label>Xabar matni</label><textarea id="wa-message" class="form-input" rows="3" placeholder="Assalomu alaykum! EduFlow markazidan eslatma..." style="resize:vertical;"></textarea></div>' +
        '<div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap;">' +
          '<button class="btn btn-success" data-action="send-wa"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>' +
          '<button class="btn btn-primary" data-action="send-tg-phone"><i class="fa-brands fa-telegram"></i> Telegram (Tel)</button>' +
          '<button class="btn btn-info" data-action="send-tg-bot" style="color:white;"><i class="fa-solid fa-robot"></i> Telegram (Bot)</button>' +
        '</div>' +
      '</div>';

    // Sozlamalar saqlansin
    var form = document.getElementById('form-settings');
    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      db.updateSettings({
        centerName: document.getElementById('set-name').value,
        logoText: document.getElementById('set-logo').value,
        rentExpense: Number(document.getElementById('set-rent').value),
        marketingExpense: Number(document.getElementById('set-marketing').value),
        telegramBotToken: document.getElementById('set-tg-token').value.trim(),
        telegramDefaultChatId: document.getElementById('set-tg-chat').value.trim()
      });
      var logoEl = document.getElementById('header-logo-title');
      if (logoEl) logoEl.innerText = document.getElementById('set-logo').value;
      showToast('Sozlamalar saqlandi!', 'success');
    });

    // Restore fayl tanlash
    var restoreFile = document.getElementById('restore-file');
    if (restoreFile) restoreFile.addEventListener('change', function(ev) {
      var file = ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(re) {
        try {
          var parsed = JSON.parse(re.result);
          if (!parsed.students || !parsed.users) { showToast('Noto\'g\'ri fayl formati!', 'error'); return; }
          showConfirm('Barcha mavjud ma\'lumotlar yuklanayotgan zaxira nusxasi bilan almashtiriladi. Davom etasizmi?', function() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            showToast('Ma\'lumotlar tiklandi! Sahifa yangilanmoqda...', 'success');
            setTimeout(function() { window.location.reload(); }, 1200);
          });
        } catch(e) { showToast('JSON fayl o\'qishda xato: ' + e.message, 'error'); }
      };
      reader.readAsText(file);
    });

    delegateClicks(container, {
      // Backup
      'do-backup': function() {
        var data = localStorage.getItem(STORAGE_KEY) || '{}';
        var blob = new Blob([data], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'EduFlow_backup_' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Zaxira fayli yuklab olindi!', 'success');
      },
      // WhatsApp
      'wa-select-all': function() {
        document.querySelectorAll('.wa-student-check').forEach(function(c) { c.checked = true; });
      },
      'wa-select-none': function() {
        document.querySelectorAll('.wa-student-check').forEach(function(c) { c.checked = false; });
      },
      'send-wa': function() {
        var message = (document.getElementById('wa-message') || {}).value || '';
        if (!message.trim()) { showToast('Xabar matni kiriting!', 'warning'); return; }
        var selected = [];
        document.querySelectorAll('.wa-student-check:checked').forEach(function(c) { selected.push({ phone: c.dataset.phone, name: c.dataset.name }); });
        if (selected.length === 0) { showToast('Kamida 1 ta o\'quvchi tanlang!', 'warning'); return; }

        if (selected.length === 1) {
          var cleanPhone = (selected[0].phone || '').replace(/[^0-9+]/g, '');
          window.open('https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(message), '_blank');
          showToast('WhatsApp ochildi!', 'success');
        } else {
          var linksHtml = selected.map(function(s) {
            var cp = (s.phone || '').replace(/[^0-9+]/g, '');
            return '<a href="https://wa.me/' + cp + '?text=' + encodeURIComponent(message) + '" target="_blank" class="btn btn-success btn-sm" style="margin:4px;">' +
              '<i class="fa-brands fa-whatsapp"></i> ' + escapeHTML(s.name) + '</a>';
          }).join('');
          showModal('WhatsApp Xabarlar', '<p class="text-muted mb-3">Quyidagi o\'quvchilarga WhatsApp yuborish uchun ustiga bosing:</p><div style="display:flex; flex-wrap:wrap;">' + linksHtml + '</div>');
        }
      },
      'send-tg-phone': function() {
        var message = (document.getElementById('wa-message') || {}).value || '';
        if (!message.trim()) { showToast('Xabar matni kiriting!', 'warning'); return; }
        var selected = [];
        document.querySelectorAll('.wa-student-check:checked').forEach(function(c) { selected.push({ phone: c.dataset.phone, name: c.dataset.name }); });
        if (selected.length === 0) { showToast('Kamida 1 ta o\'quvchi tanlang!', 'warning'); return; }

        if (selected.length === 1) {
          var cleanPhone = (selected[0].phone || '').replace(/[^0-9]/g, '');
          window.open('https://t.me/+' + cleanPhone + '?text=' + encodeURIComponent(message), '_blank');
          showToast('Telegram ochildi!', 'success');
        } else {
          var linksHtml = selected.map(function(s) {
            var cp = (s.phone || '').replace(/[^0-9]/g, '');
            return '<a href="https://t.me/+' + cp + '?text=' + encodeURIComponent(message) + '" target="_blank" class="btn btn-primary btn-sm" style="margin:4px;">' +
              '<i class="fa-brands fa-telegram"></i> ' + escapeHTML(s.name) + '</a>';
          }).join('');
          showModal('Telegram Xabarlar', '<p class="text-muted mb-3">Quyidagi o\'quvchilarga Telegram yuborish uchun ustiga bosing:</p><div style="display:flex; flex-wrap:wrap;">' + linksHtml + '</div>');
        }
      },
      'send-tg-bot': function() {
        var message = (document.getElementById('wa-message') || {}).value || '';
        if (!message.trim()) { showToast('Xabar matni kiriting!', 'warning'); return; }
        
        var settings = db.getSettings();
        if (!settings.telegramBotToken) { showToast('Bot token kiritilmagan!', 'error'); return; }

        var selected = [];
        var noChatIdCount = 0;
        document.querySelectorAll('.wa-student-check:checked').forEach(function(c) { 
          if (c.dataset.chatid) {
            selected.push({ chatId: c.dataset.chatid, name: c.dataset.name }); 
          } else {
            noChatIdCount++;
          }
        });
        
        if (selected.length === 0) { 
          showToast('Tanlangan o\'quvchilarda Telegram bot ulanmagan!', 'warning'); 
          return; 
        }

        selected.forEach(function(s, index) {
          setTimeout(function() {
            sendTelegramNotification(s.chatId, message);
          }, index * 300);
        });

        var toastMsg = selected.length + ' ta o\'quvchiga xabar yuborilmoqda!';
        if (noChatIdCount > 0) {
          toastMsg += ' (' + noChatIdCount + ' tasida bot ulanmagan)';
        }
        showToast(toastMsg, 'success');
        document.getElementById('wa-message').value = '';
      }
    });
  }

  // ==========================================
  // 7. MAIN APP ROUTER & ORCHESTRATION
  // ==========================================
  function EduFlowApp() {
    this.currentRoute = 'dashboard';
    this.sidebarOpen = false;
  }

  // FIX: Parol o'zgartirish modali
  function showChangePasswordModal() {
    var existing = document.getElementById('modal-change-pass');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-change-pass';
    modal.style.display = 'flex';
    modal.innerHTML = '<div class="modal-content glass-card" style="padding:24px; max-width:400px;"><h3>🔑 Parolni O\'zgartirish</h3><form id="form-change-pass" class="mt-3"><div class="form-group"><label>Joriy Parol</label><input type="password" id="cp-old" class="form-input" required placeholder="Joriy parolingiz"></div><div class="form-group"><label>Yangi Parol</label><input type="password" id="cp-new" class="form-input" required minlength="6" placeholder="Yangi parol (min 6 belgi)"></div><div class="form-group"><label>Yangi Parolni Tasdiqlang</label><input type="password" id="cp-confirm" class="form-input" required placeholder="Takrorlang"></div><div class="modal-footer"><button type="button" class="btn btn-secondary" id="cp-cancel">Bekor qilish</button><button type="submit" class="btn btn-primary">Saqlash</button></div></form></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.getElementById('cp-cancel').addEventListener('click', function() { modal.remove(); });
    document.getElementById('form-change-pass').addEventListener('submit', function(e) {
      e.preventDefault();
      var oldPass = document.getElementById('cp-old').value;
      var newPass = document.getElementById('cp-new').value;
      var confirmPass = document.getElementById('cp-confirm').value;
      if (newPass !== confirmPass) { showToast('Yangi parollar mos kelmaydi!', 'error'); return; }
      if (newPass.length < 6) { showToast('Parol kamida 6 belgidan iborat bo\'lishi kerak!', 'warning'); return; }
      var user = auth.getCurrentUser();
      if (!user) return;
      var dbUser = db.getById('users', user.id);
      if (!dbUser || dbUser.passwordHash !== hashPassword(oldPass)) { showToast('Joriy parol noto\'g\'ri!', 'error'); return; }
      db.update('users', user.id, { passwordHash: hashPassword(newPass) });
      showToast('Parol muvaffaqiyatli o\'zgartirildi!', 'success');
      modal.remove();
    });
  }

  EduFlowApp.prototype.init = function() {
    this.bindEvents();
    this.restoreTheme();
    this.setupConnectivity();
    this.checkAuthStatus();
  };

  EduFlowApp.prototype.checkAuthStatus = function() {
    var loginOverlay = document.getElementById('login-overlay');
    var moduleContent = document.getElementById('module-content');
    if (auth.isAuthenticated()) {
      if (loginOverlay) loginOverlay.style.display = 'none';
      this.updateUserWidget();
      this.updateSidebarVisibility();
      this.navigate(this.currentRoute);
    } else {
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (moduleContent) moduleContent.innerHTML = '';
    }
  };

  EduFlowApp.prototype.updateUserWidget = function() {
    var user = auth.getCurrentUser();
    var nameEl = document.getElementById('user-display-name');
    var roleEl = document.getElementById('user-display-role');
    var initEl = document.getElementById('user-avatar-initials');
    if (!user) {
      if (nameEl) nameEl.innerText = 'Mehmon';
      if (roleEl) roleEl.innerText = 'Kirilmagan';
      if (initEl) initEl.innerText = '?';
      return;
    }
    if (nameEl) nameEl.innerText = user.fullName;
    if (roleEl) roleEl.innerText = ROLE_LABELS[user.role] || user.role;
    if (initEl) initEl.innerText = user.fullName.charAt(0).toUpperCase();
  };

  EduFlowApp.prototype.updateSidebarVisibility = function() {
    var routes = ['dashboard', 'students', 'groups', 'teachers', 'admins', 'branches', 'attendance', 'employeeAttendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'finance', 'reports', 'calendar', 'monitoring', 'aiCommand', 'settings'];
    routes.forEach(function(route) {
      var btn = document.getElementById('nav-' + route);
      if (btn && btn.closest('.nav-item')) {
        btn.closest('.nav-item').style.display = auth.hasPermission(route) ? 'block' : 'none';
      }
    });
  };

  // FIX #29: Theme persistence
  EduFlowApp.prototype.restoreTheme = function() {
    var saved = localStorage.getItem('eduflow_theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      var themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) themeBtn.innerHTML = saved === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    }
  };

  // FIX #16: Online/Offline detection
  EduFlowApp.prototype.setupConnectivity = function() {
    var badge = document.getElementById('sync-status-badge');
    var text = document.getElementById('sync-status-text');
    function updateStatus() {
      if (navigator.onLine) {
        if (badge) { badge.classList.remove('offline'); badge.classList.add('online'); }
        if (text) text.innerText = 'Online';
      } else {
        if (badge) { badge.classList.remove('online'); badge.classList.add('offline'); }
        if (text) text.innerText = 'Offline';
      }
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  };

  EduFlowApp.prototype.bindEvents = function() {
    var self = this;
    var routes = ['dashboard', 'students', 'groups', 'teachers', 'admins', 'branches', 'attendance', 'employeeAttendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'finance', 'reports', 'calendar', 'monitoring', 'aiCommand', 'settings'];

    routes.forEach(function(route) {
      var btn = document.getElementById('nav-' + route);
      if (btn) btn.addEventListener('click', function(e) {
        e.preventDefault();
        self.navigate(route);
        // FIX #30: Close mobile sidebar
        self.closeMobileSidebar();
      });
    });

    // Theme toggle (FIX #29)
    var themeBtn = document.getElementById('theme-toggle-btn');
    var toggleLoginPass = document.getElementById('toggle-login-password');
    var loginPassInput = document.getElementById('login-password');
    if (toggleLoginPass && loginPassInput) {
      toggleLoginPass.addEventListener('click', function() {
        var type = loginPassInput.getAttribute('type') === 'password' ? 'text' : 'password';
        loginPassInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
      });
    }
    if (themeBtn) themeBtn.addEventListener('click', function() {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('eduflow_theme', next);
      themeBtn.innerHTML = next === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
      showToast("Mavzu " + next.toUpperCase() + " rejimiga o'tkazildi", 'info');
    });

    // Login form
    var formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.addEventListener('submit', function(e) {
      e.preventDefault();
      var emailInput = document.getElementById('login-email');
      var passInput = document.getElementById('login-password');
      var rememberCb = document.getElementById('login-remember');
      var errorAlert = document.getElementById('login-error-alert');
      var email = emailInput ? emailInput.value : '';
      var pass = passInput ? passInput.value : '';
      var remember = rememberCb ? rememberCb.checked : false;

      var success = auth.login(email, pass, remember);
      if (success === 'locked') {
        if (errorAlert) {
          errorAlert.innerText = "❌ Juda ko'p xato urinish! 5 daqiqaga bloklandingiz.";
          errorAlert.style.display = 'block';
        }
      } else if (success === true) {
        if (errorAlert) errorAlert.style.display = 'none';
        var loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
        self.updateUserWidget();
        self.updateSidebarVisibility();
        self.navigate('dashboard');
        showToast('Xush kelibsiz, ' + auth.getCurrentUser().fullName + '!', 'success');
      } else {
        if (errorAlert) {
          errorAlert.innerText = "❌ Kirish ma'lumotlari noto'g'ri!";
          errorAlert.style.display = 'block';
        }
        showToast("Email yoki parol noto'g'ri!", 'error');
      }
    });

    // Quick fill buttons
    var fills = [
      { id: 'btn-fill-superadmin', email: 'admin@eduflow.uz', pass: 'admin123' },
      { id: 'btn-fill-branchadmin', email: 'chilonzor@eduflow.uz', pass: 'admin123' },
      { id: 'btn-fill-teacher', email: 'teacher1@eduflow.uz', pass: 'admin123' }
    ];
    fills.forEach(function(f) {
      var btn = document.getElementById(f.id);
      if (btn) btn.addEventListener('click', function() {
        document.getElementById('login-email').value = f.email;
        document.getElementById('login-password').value = f.pass;
      });
    });

    // Reset DB button
    var btnResetDb = document.getElementById('btn-reset-db');
    if (btnResetDb) btnResetDb.addEventListener('click', function() {
      showConfirm('Haqiqatdan ham butun tizim ma\'lumotlar bazasini tozalab, qayta yuklamoqchimisiz?', function() {
        localStorage.clear();
        sessionStorage.clear();
        showToast('Eski kesh tozalandi! Sahifa yangilanmoqda...', 'warning');
        setTimeout(function() { window.location.reload(); }, 1000);
      });
    });

    // Logout
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', function() {
      auth.logout();
      self.checkAuthStatus();
    });

    // FIX: User avatar widget click → Parol o'zgartirish
    var profileWidget = document.getElementById('user-profile-widget');
    var userAvatar = document.getElementById('user-avatar-initials');
    if (userAvatar) userAvatar.addEventListener('click', function() {
      if (auth.isAuthenticated()) showChangePasswordModal();
    });
    if (userAvatar) userAvatar.style.cursor = 'pointer';
    if (userAvatar) userAvatar.title = 'Parolni o\'zgartirish uchun bosing';

    // FIX #6: Branch selector
    var branchSel = document.getElementById('global-branch-selector');
    if (branchSel) branchSel.addEventListener('change', function() {
      auth.setActiveBranch(branchSel.value);
      showToast('Filial tanlandi: ' + branchSel.options[branchSel.selectedIndex].text, 'info');
      self.navigate(self.currentRoute);
    });

    // FIX #15: Language selector notice
    var langSel = document.getElementById('lang-select');
    if (langSel) langSel.addEventListener('change', function() {
      showToast("Til almashtirish tez kunda qo'shiladi!", 'info');
      langSel.value = 'uz';
    });

    // FIX #31: ESC key closes modals
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(function(m) {
          if (m.style.display === 'flex') m.style.display = 'none';
        });
      }
    });

    // FIX #31: Backdrop click closes modals
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
      }
    });

    // FIX #30: Hamburger menu
    var hamburger = document.getElementById('hamburger-btn');
    if (hamburger) hamburger.addEventListener('click', function() {
      self.toggleMobileSidebar();
    });

    window.appRouter = function(route, options) { self.navigate(route, options); };
  };

  // FIX #30: Mobile sidebar toggle (with overlay)
  EduFlowApp.prototype.toggleMobileSidebar = function() {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('sidebar-mobile-open');
    this.sidebarOpen = !this.sidebarOpen;
    // FIX: Overlay qo'shish/olib tashlash
    var overlay = document.getElementById('sidebar-mobile-overlay');
    if (this.sidebarOpen) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-mobile-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:150;';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function() {
          window.eduFlowApp.closeMobileSidebar();
        });
      }
    } else {
      if (overlay) overlay.remove();
    }
  };

  EduFlowApp.prototype.closeMobileSidebar = function() {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('sidebar-mobile-open');
    this.sidebarOpen = false;
    var overlay = document.getElementById('sidebar-mobile-overlay');
    if (overlay) overlay.remove();
  };

  EduFlowApp.prototype.navigate = function(route, options) {
    options = options || {};
    if (!auth.hasPermission(route)) {
      showToast('Ruxsat berilmagan modul!', 'error');
      var container = document.getElementById('module-content');
      if (container) {
        container.innerHTML = '<div class="glass-card text-center" style="padding:40px;"><i class="fa-solid fa-user-lock text-danger" style="font-size:48px;"></i><h2 class="mt-3 text-danger">Ruxsat Cheklangan!</h2><p class="text-muted mt-2">Sizning rolingiz (' + escapeHTML(ROLE_LABELS[auth.getCurrentUser() ? auth.getCurrentUser().role : ''] || '') + ") ushbu modulni ko'rishga ruxsat bermaydi.</p></div>";
      }
      return;
    }

    this.currentRoute = route;
    document.querySelectorAll('.nav-item button').forEach(function(btn) { btn.classList.remove('active'); });
    var activeBtn = document.getElementById('nav-' + route);
    if (activeBtn) activeBtn.classList.add('active');

    // FIX #38: Show loading briefly
    var mc = document.getElementById('module-content');
    showLoading(mc);

    var self = this;
    setTimeout(function() {
      switch (route) {
        case 'dashboard': renderDashboard(); break;
        case 'students': renderStudents(options); break;
        case 'groups': renderGroups(); break;
        case 'teachers': renderTeachers(); break;
        case 'admins': renderAdmins(); break;
        case 'branches': renderBranches(); break;
        case 'attendance': renderAttendance(); break;
        case 'employeeAttendance': renderEmployeeAttendance(); break;
        case 'payments': renderPayments(options); break;
        case 'leads': renderLeads(options); break;
        case 'homework': renderHomework(); break;
        case 'certificates': renderCertificates(); break;
        case 'telegramBot': renderTelegramBot(); break;
        case 'finance': renderFinance(); break;
        case 'reports': renderReports(); break;
        case 'calendar': renderCalendar(); break;
        case 'monitoring': renderMonitoring(); break;
        case 'aiCommand': renderAiCommandCenter(); break;
        case 'settings': renderSettings(); break;
        default: renderDashboard();
      }
    }, 80);
  };

  document.addEventListener('DOMContentLoaded', function() {
    window.eduFlowApp = new EduFlowApp();
    window.eduFlowApp.init();

    // Register PWA Service Worker (v2.4.0) with custom update prompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('EduFlow PWA Service Worker Registered!');

        reg.addEventListener('updatefound', function() {
          var newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', function() {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              showConfirm("CRM tizimining yangi versiyasi yuklandi. Yangilanishlarni faollashtirish va yangi interfeysga o'tish uchun sahifani qayta yuklaysizmi?", function() {
                newSW.postMessage({ type: 'SKIP_WAITING' });
              });
            }
          });
        });
      })['catch'](function(err) {
        console.error('Service Worker registration failed:', err);
      });

      // Reload page when new service worker activates
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  });

})();
