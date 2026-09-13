import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

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

export { renderTelegramBot };