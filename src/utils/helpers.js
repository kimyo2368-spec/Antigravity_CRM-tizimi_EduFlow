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
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.style.display = 'flex';
      var first = el.querySelector('input:not([type=hidden]), select, textarea');
      if (first) setTimeout(function() { first.focus(); }, 100);
    }
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

// Shared: delegate clicks on module-content
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

// SEV-5-E FIX: Safe unique ID generator
function genId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}


export {
  checkScheduleConflict,
  closeModal,
  delegateClicks,
  escapeHTML,
  formatCurrency,
  genId,
  generateCode,
  getDayScheduleKey,
  getTodayDayUz,
  hashPassword,
  openModal,
  paginate,
  renderPaginationControls,
  sendTelegramNotification,
  showConfirm,
  showLoading,
  showToast
};
