import { genId, hashPassword, showToast } from '../utils/helpers.js';
import { FIREBASE_CONFIG } from '../config.js';
import { DEFAULT_SETTINGS } from '../types/index.js';

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
      { id: 'st-1', code: 'ST-000001', fullName: 'Sardorbek Rahimov', phone: '+998 97 111-22-33', parentName: 'Otabek Rahimov', parentPhone: '+998 90 999-88-77', branchId: 'br-1', groupIds: ['gr-1'], status: 'active', groupBalances: { 'gr-1': 500000 }, joinedDate: '2026-05-10' },
      { id: 'st-2', code: 'ST-000002', fullName: 'Zuhra Aliyeva', phone: '+998 93 222-33-44', parentName: 'Dilfuza Aliyeva', parentPhone: '+998 91 888-77-66', branchId: 'br-1', groupIds: ['gr-1'], status: 'active', groupBalances: { 'gr-1': 0 }, joinedDate: '2026-06-01' },
      { id: 'st-3', code: 'ST-000003', fullName: 'Nodirxon Jalolov', phone: '+998 90 333-44-55', parentName: 'Jaloliddinov N.', parentPhone: '+998 93 777-66-55', branchId: 'br-2', groupIds: ['gr-2'], status: 'active', groupBalances: { 'gr-2': -250000 }, joinedDate: '2026-06-15' },
      { id: 'st-4', code: 'ST-000004', fullName: 'Jasur Umarov', phone: '+998 94 444-55-66', parentName: 'Umarov S.', parentPhone: '+998 90 666-55-44', branchId: 'br-3', groupIds: ['gr-3'], status: 'frozen', groupBalances: { 'gr-3': -450000 }, joinedDate: '2026-04-12' }
    ],
    groups: [
      { id: 'gr-1', code: 'GR-000001', name: 'IELTS Intensive 7.5', courseName: 'Ingliz tili (IELTS)', teacherId: 'u-3', teacherName: 'Malika Sobirova', branchId: 'br-1', scheduleDays: 'Dush-Chor-Jum', scheduleTime: '14:00 - 16:00', room: 'Xona 102', monthlyFee: 600000, capacity: 15 },
      { id: 'gr-2', code: 'GR-000002', name: 'Python Django PRO', courseName: 'Python Backend', teacherId: 'u-4', teacherName: 'Bobur Karimov', branchId: 'br-2', scheduleDays: 'Sesh-Pay-Shan', scheduleTime: '16:30 - 18:30', room: 'Xona 204', monthlyFee: 750000, capacity: 12 },
      { id: 'gr-3', code: 'GR-000003', name: 'Frontend React + Vue', courseName: 'Frontend React', teacherId: 'u-4', teacherName: 'Bobur Karimov', branchId: 'br-3', scheduleDays: 'Dush-Chor-Jum', scheduleTime: '18:30 - 20:30', room: 'Xona 301', monthlyFee: 700000, capacity: 16 }
    ],
    payments: [
      { id: 'pm-1', code: 'PM-000001', studentId: 'st-1', studentName: 'Sardorbek Rahimov', branchId: 'br-1', groupId: 'gr-1', amount: 600000, paymentMethod: 'click', month: '2026-08', date: '2026-08-01', receivedBy: 'Alisher Qodirov', cancelled: false },
      { id: 'pm-2', code: 'PM-000002', studentId: 'st-2', studentName: 'Zuhra Aliyeva', branchId: 'br-1', groupId: 'gr-1', amount: 600000, paymentMethod: 'cash', month: '2026-08', date: '2026-08-01', receivedBy: 'Alisher Qodirov', cancelled: false }
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
    contracts: [],
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
      if (!parsed.contracts) parsed.contracts = [];
      // FIX #2: Migrate password → passwordHash, remove plain password
      parsed.users.forEach(function(u) {
        if (u.password && !u.passwordHash) {
          u.passwordHash = hashPassword(u.password);
        }
        delete u.password;
      });
      // Migrate student balances to group balances
      if (parsed.students) {
        parsed.students.forEach(function(s) {
          if (!s.groupBalances) s.groupBalances = {};
          if (s.balance !== undefined) {
            if (s.groupIds && s.groupIds.length > 0) {
              s.groupBalances[s.groupIds[0]] = Number(s.balance) || 0;
            } else {
              s.groupBalances['general'] = Number(s.balance) || 0;
            }
            delete s.balance;
          }
        });
      }
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

export { DatabaseService, db, STORAGE_KEY };