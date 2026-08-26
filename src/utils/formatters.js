/**
 * EduFlow CRM Utility & Formatter Functions
 */

import { ID_PREFIXES } from '../types/index.js';

/**
 * Format currency to UZS (so'm)
 * @param {number} amount 
 * @returns {string}
 */
export function formatCurrency(amount) {
  if (isNaN(amount) || amount === null) return '0 UZS';
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format Uzbek date
 * @param {string|Date} dateInput 
 * @returns {string}
 */
export function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  return d.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Generate Auto-ID Code (e.g. ST-000001)
 * @param {string} prefixType - e.g. 'STUDENT', 'GROUP'
 * @param {number} sequenceNumber 
 * @returns {string}
 */
export function generateCode(prefixType, sequenceNumber) {
  const prefix = ID_PREFIXES[prefixType] || 'ID';
  const numStr = String(sequenceNumber).padStart(6, '0');
  return `${prefix}-${numStr}`;
}

/**
 * Toast Notification Dispatcher
 * @param {string} message 
 * @param {'success'|'error'|'warning'|'info'} type 
 */
export function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type]}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Check if two schedules overlap (Days and Times).
 * @param {string} days1 e.g. "Dush-Shor-Jum"
 * @param {string} time1 e.g. "14:00 - 16:00"
 * @param {string} days2
 * @param {string} time2
 * @returns {boolean} true if overlapping
 */
export function isScheduleConflict(days1, time1, days2, time2) {
  if (!days1 || !time1 || !days2 || !time2) return false;

  const d1 = String(days1).toLowerCase();
  const d2 = String(days2).toLowerCase();
  let daysOverlap = false;

  if (d1.includes('har kuni') || d2.includes('har kuni')) {
    daysOverlap = true;
  } else if (d1 === d2) {
    daysOverlap = true;
  }

  if (!daysOverlap) return false;

  const parseTime = (tStr) => {
    const [start, end] = tStr.split('-').map(s => s.trim());
    const parseHM = (hm) => {
      if (!hm) return 0;
      const [h, m] = hm.split(':').map(Number);
      return (h * 60) + (m || 0);
    };
    return { start: parseHM(start), end: parseHM(end) };
  };

  try {
    const t1 = parseTime(time1);
    const t2 = parseTime(time2);
    // Overlap condition: Start A < End B and Start B < End A
    return t1.start < t2.end && t2.start < t1.end;
  } catch (e) {
    return false;
  }
}

/**
 * Simple DJB2-based hashing for demo purposes (DJB2 + salt)
 * @param {string} password
 * @returns {string} hashed string
 */
export function hashPassword(password) {
  if (!password) return '';
  const salt = "eduflow_secure_salt_";
  const str = salt + password;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash.toString(16);
}
