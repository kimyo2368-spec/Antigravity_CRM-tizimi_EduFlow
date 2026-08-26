/**
 * EduFlow CRM v1.0 — Main App Entrypoint & Router
 */

import { auth } from './src/modules/auth.js';
import { supabase } from './src/services/supabase.js';
import { offlineSync } from './src/services/offlineSync.js';
import { ROLE_LABELS } from './src/types/index.js';

import { renderDashboard } from './src/modules/dashboard.js';
import { renderStudents } from './src/modules/students.js';
import { renderGroups } from './src/modules/groups.js';
import { renderTeachers } from './src/modules/teachers.js';
import { renderAttendance } from './src/modules/attendance.js';
import { renderPayments } from './src/modules/payments.js';
import { renderLeads } from './src/modules/leads.js';
import { renderCertificates } from './src/modules/certificates.js';
import { renderHomework } from './src/modules/homework.js';
import { renderTelegramBot } from './src/modules/telegramBot.js';
import { renderFinance } from './src/modules/finance.js';
import { renderReports } from './src/modules/reports.js';
import { renderCalendar } from './src/modules/calendar.js';
import { renderMonitoring } from './src/modules/monitoring.js';
import { renderAiCommandCenter } from './src/modules/aiCommand.js';
import { renderSettings } from './src/modules/settings.js';

class EduFlowApp {
  constructor() {
    this.currentRoute = 'dashboard';
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkAuthStatus();
    this.setupOfflineListener();
    this.loadSystemSettings();
  }

  loadSystemSettings() {
    const settings = supabase.getSettings();
    const logoEl = document.getElementById('header-logo-title');
    if (logoEl) logoEl.innerText = settings.logoText || 'EduFlow CRM';
  }

  checkAuthStatus() {
    const loginOverlay = document.getElementById('login-overlay');
    if (auth.isAuthenticated()) {
      loginOverlay.style.display = 'none';
      this.updateUserWidget();
      this.navigate(this.currentRoute);
    } else {
      loginOverlay.style.display = 'flex';
    }
  }

  updateUserWidget() {
    const user = auth.getCurrentUser();
    if (!user) return;

    document.getElementById('user-display-name').innerText = user.fullName;
    document.getElementById('user-display-role').innerText = ROLE_LABELS[user.role] || user.role;
    document.getElementById('user-avatar-initials').innerText = user.fullName.charAt(0).toUpperCase();
  }

  bindEvents() {
    // Global Event Delegation for clicks
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-route], [data-action]');
      if (!el) return;

      if (el.hasAttribute('data-route')) {
        const route = el.getAttribute('data-route');
        const optionsStr = el.getAttribute('data-options');
        let options = {};
        if (optionsStr) {
          try { options = JSON.parse(optionsStr); } catch (err) {}
        }
        this.navigate(route, options);
      } else if (el.hasAttribute('data-action')) {
        const action = el.getAttribute('data-action');
        const argsStr = el.getAttribute('data-args') || '[]';
        let args = [];
        if (argsStr) {
          try { args = JSON.parse(argsStr); } catch (err) {}
        }
        if (typeof window[action] === 'function') {
          window[action](...args);
        }
      }
    });

    // Navigation Buttons
    const routes = ['dashboard', 'students', 'groups', 'teachers', 'attendance', 'payments', 'leads', 'homework', 'certificates', 'telegramBot', 'finance', 'reports', 'calendar', 'monitoring', 'aiCommand', 'settings'];
    routes.forEach(route => {
      const btn = document.getElementById(`nav-${route}`);
      if (btn) {
        btn.addEventListener('click', () => this.navigate(route));
      }
    });

    // Global Branch Selector Listener
    const branchSelector = document.getElementById('global-branch-selector');
    if (branchSelector) {
      branchSelector.addEventListener('change', (e) => {
        auth.setActiveBranch(e.target.value);
        this.navigate(this.currentRoute);
      });
    }

    // Login Form Submit
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      const rememberCheck = document.getElementById('login-remember');
      const remember = rememberCheck ? rememberCheck.checked : false;

      const success = await auth.login(email, pass, remember);
      if (success) {
        document.getElementById('login-overlay').style.display = 'none';
        this.updateUserWidget();
        this.navigate('dashboard');
      }
    });

    // Logout Button
    document.getElementById('btn-logout').addEventListener('click', () => {
      auth.logout();
      document.getElementById('login-overlay').style.display = 'flex';
    });

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', nextTheme);
        themeBtn.innerHTML = nextTheme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
      });
    }

    // Global Router Helper
    window.appRouter = (route, options) => this.navigate(route, options);
    window.toggleOfflineSim = () => offlineSync.toggleSimulatedOffline();
  }

  setupOfflineListener() {
    offlineSync.subscribe((isOnline, pendingCount) => {
      const badge = document.getElementById('sync-status-badge');
      const text = document.getElementById('sync-status-text');
      if (badge && text) {
        if (isOnline) {
          badge.className = 'offline-badge online';
          text.innerHTML = pendingCount > 0 ? `Online (${pendingCount} kutilmoqda)` : 'Online';
        } else {
          badge.className = 'offline-badge offline';
          text.innerHTML = pendingCount > 0 ? `Offline (${pendingCount} kutilmoqda)` : 'Offline Rejim';
        }
      }
    });
  }

  async navigate(route, options = {}) {
    this.currentRoute = route;

    // Update active nav button styling
    document.querySelectorAll('.nav-item button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${route}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Render target module
    switch (route) {
      case 'dashboard':
        await renderDashboard();
        break;
      case 'students':
        await renderStudents(options);
        break;
      case 'groups':
        await renderGroups();
        break;
      case 'teachers':
        await renderTeachers();
        break;
      case 'attendance':
        await renderAttendance();
        break;
      case 'payments':
        await renderPayments(options);
        break;
      case 'leads':
        await renderLeads();
        break;
      case 'homework':
        await renderHomework();
        break;
      case 'certificates':
        await renderCertificates();
        break;
      case 'telegramBot':
        await renderTelegramBot();
        break;
      case 'finance':
        await renderFinance();
        break;
      case 'reports':
        await renderReports();
        break;
      case 'calendar':
        await renderCalendar();
        break;
      case 'monitoring':
        await renderMonitoring();
        break;
      case 'aiCommand':
        await renderAiCommandCenter();
        break;
      case 'settings':
        await renderSettings();
        break;
      default:
        await renderDashboard();
    }
  }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
  window.eduFlowApp = new EduFlowApp();
});
