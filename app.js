import { auth } from './src/services/auth.js';
import { db } from './src/services/db.js';
import { ROLE_LABELS } from './src/types/index.js';
import { closeModal, escapeHTML, hashPassword, openModal, showConfirm, showLoading, showToast, sendTelegramNotification } from './src/utils/helpers.js';
import { renderDashboard } from './src/modules/dashboard.js';
import { renderStudents } from './src/modules/students.js';
import { renderGroups } from './src/modules/groups.js';
import { renderTeachers } from './src/modules/teachers.js';
import { renderAdmins } from './src/modules/admins.js';
import { renderBranches } from './src/modules/branches.js';
import { renderAttendance } from './src/modules/attendance.js';
import { renderEmployeeAttendance } from './src/modules/employeeAttendance.js';
import { renderPayments } from './src/modules/payments.js';
import { renderLeads } from './src/modules/leads.js';
import { renderHomework } from './src/modules/homework.js';
import { renderCertificates } from './src/modules/certificates.js';
import { renderTelegramBot } from './src/modules/telegramBot.js';
import { renderReports } from './src/modules/reports.js';
import { renderCalendar } from './src/modules/calendar.js';
import { renderMonitoring } from './src/modules/monitoring.js';
import { renderAiCommandCenter } from './src/modules/aiCommandCenter.js';
import { renderFinance } from './src/modules/finance.js';
import { renderSettings } from './src/modules/settings.js';

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
    this.startBackgroundTasks();
    this.checkAuthStatus();
  };
  
  EduFlowApp.prototype.startBackgroundTasks = function() {
    setInterval(function() {
      // Toshkent vaqti bilan hisoblash
      var tzDateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" });
      var nowTashkent = new Date(tzDateStr);
      var year = nowTashkent.getFullYear();
      var month = String(nowTashkent.getMonth() + 1).padStart(2, '0');
      var day = String(nowTashkent.getDate()).padStart(2, '0');
      var today = year + '-' + month + '-' + day;
      var currentMinutes = nowTashkent.getHours() * 60 + nowTashkent.getMinutes();

      var attendance = db.get('attendance');
      var unnotified = attendance.filter(function(a) { return a.date === today && a.notified === false; });
      if (unnotified.length === 0) return;

      var groups = db.get('groups');
      var students = db.get('students');

      unnotified.forEach(function(att) {
        var g = groups.find(function(x) { return x.id === att.groupId; });
        if (!g || !g.scheduleTime) return;

        // scheduleTime format usually "14:00 - 16:00"
        var parts = g.scheduleTime.split('-');
        if (parts.length < 2) return;
        
        var endTimeStr = parts[1].trim(); // "16:00"
        var timeParts = endTimeStr.split(':');
        if (timeParts.length < 2) return;
        
        var endMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
        
        if (currentMinutes >= endMinutes) {
          // Time to send!
          db.update('attendance', att.id, { notified: true });
          
          var st = students.find(function(s) { return s.id === att.studentId; });
          if (!st || !st.telegramChatId) return;

          var textMap = {
            'present': '🟢 <b>KELDI</b> - Farzandingiz darsga ishtirok etdi.',
            'absent': '🔴 <b>KELMADI</b> - Farzandingiz bugungi darsga kelmadi.',
            'late': '🟡 <b>KECHIKIB KELDI</b> - Farzandingiz bugungi darsga kechikib keldi.',
            'excused': '🔵 <b>SABABLI</b> - Farzandingiz bugungi darsdan sababli ruxsat so\'ragan.'
          };
          
          var tgText = "📋 <b>DAVOMAT XABARNOMASI</b>\n\n" +
            "👤 <b>Talaba:</b> " + escapeHTML(st.fullName) + " (" + escapeHTML(st.code) + ")\n" +
            "📚 <b>Guruh:</b> " + escapeHTML(g.name) + "\n" +
            "📅 <b>Sana:</b> " + escapeHTML(today) + "\n\n" +
            "Holati: " + (textMap[att.status] || att.status);
          
          sendTelegramNotification(st.telegramChatId, tgText);
        }
      });
    }, 60000);
  };

  EduFlowApp.prototype.checkAuthStatus = function() {
    var loginOverlay = document.getElementById('login-overlay');
    var moduleContent = document.getElementById('module-content');
    if (auth.isAuthenticated()) {
      if (loginOverlay) loginOverlay.style.display = 'none';
      this.updateUserWidget();
      this.updateSidebarVisibility();
      
      var initialRoute = this.currentRoute;
      if (window.location.hash) {
          var hashRoute = window.location.hash.replace('#', '');
          var validRoutes = ['dashboard', 'students', 'groups', 'teachers', 'admins', 'branches', 'attendance', 'employeeAttendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'finance', 'reports', 'calendar', 'monitoring', 'aiCommand', 'settings'];
          if (validRoutes.includes(hashRoute)) initialRoute = hashRoute;
      }
      this.navigate(initialRoute);
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
    
    // Listen for back/forward browser buttons
    window.addEventListener('hashchange', function() {
        var hashRoute = window.location.hash.replace('#', '');
        if (hashRoute && self.currentRoute !== hashRoute) {
            self.navigate(hashRoute);
        }
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
    if (window.location.hash !== '#' + route) {
        window.location.hash = route;
    }
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

window.eduFlowApp = new EduFlowApp();
export default EduFlowApp;