import { db } from './db.js';
import { hashPassword, openModal, showToast } from '../utils/helpers.js';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../types/index.js';

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

export { auth, SESSION_KEY, BRUTE_KEY };