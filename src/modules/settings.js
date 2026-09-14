import { db } from '../services/db.js';
import { auth } from '../services/auth.js';
import { closeModal, delegateClicks, escapeHTML, openModal, sendTelegramNotification, showConfirm, showToast } from '../utils/helpers.js';
import { ROLE_LABELS } from '../types/index.js';

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
        '<div class="form-group"><label><i class="fa-solid fa-brain text-purple"></i> Sun\'iy Intellekt API Key (OpenAI / Gemini)</label><input type="password" id="set-ai-apikey" class="form-input" value="' + escapeHTML(settings.aiApiKey || '') + '" placeholder="sk-..."></div>' +
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
        telegramDefaultChatId: document.getElementById('set-tg-chat').value.trim(),
        aiApiKey: document.getElementById('set-ai-apikey').value.trim()
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

export { renderSettings };