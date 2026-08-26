/**
 * EduFlow CRM v1.0 Types & Constants Definition
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  BRANCH_ADMIN: 'branch_admin',
  MANAGER: 'manager',
  TEACHER: 'teacher',
  CASHIER: 'cashier',
  CALL_CENTER: 'call_center',
  STUDENT: 'student',
  PARENT: 'parent'
};

export const ROLE_LABELS = {
  super_admin: '👑 Super Admin',
  branch_admin: '🏢 Filial Admini',
  manager: '👨‍💼 Menejer',
  teacher: '👨‍🏫 O\'qituvchi',
  cashier: '💰 Kassir',
  call_center: '📞 Call Center',
  student: '👨‍🎓 O\'quvchi',
  parent: '👨‍👩‍👧 Ota-ona'
};

export const ID_PREFIXES = {
  STUDENT: 'ST',
  TEACHER: 'TE',
  GROUP: 'GR',
  PAYMENT: 'PM',
  LESSON: 'LS',
  LEAD: 'LE',
  BRANCH: 'BR'
};

export const DEFAULT_SETTINGS = {
  centerName: 'EduFlow Center',
  logoText: 'EduFlow CRM',
  currency: 'UZS',
  telegramBotToken: 'bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  workHours: '08:00 - 20:00',
  subjects: ['Ingliz tili (IELTS)', 'General English', 'Python Backend', 'Frontend React', 'Matematika', 'Robototexnika'],
  attendanceSmsEnabled: true,
  autoBackupDaily: true
};
