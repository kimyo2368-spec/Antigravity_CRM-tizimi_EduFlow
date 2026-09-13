import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

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

export { renderMonitoring };