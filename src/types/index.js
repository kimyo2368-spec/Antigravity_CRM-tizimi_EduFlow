  var ROLE_LABELS = {
    super_admin: '👑 Super Admin',
    branch_admin: '🏢 Filial Admini',
    manager: "👨‍💼 Menejer",
    teacher: "👨‍🏫 O'qituvchi",
    cashier: '💰 Kassir',
    finance: '📈 Moliyachi',
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
    finance: ['dashboard', 'students', 'groups', 'payments', 'finance', 'reports', 'calendar'],
    call_center: ['dashboard', 'leads', 'students']
  };
  var DEFAULT_SETTINGS = {
    centerName: 'EduFlow Center',
    logoText: 'EduFlow CRM',
    currency: 'UZS',
    workHours: '08:00 - 20:00',
    rentExpense: 3500000,
    marketingExpense: 1500000,
    telegramBotToken: '',
    telegramDefaultChatId: '',
    aiApiKey: '',
    attendanceSmsEnabled: true,
    autoBackupDaily: true
  };
  // ==========================================

export { ROLE_LABELS, ROLE_PERMISSIONS, DEFAULT_SETTINGS };