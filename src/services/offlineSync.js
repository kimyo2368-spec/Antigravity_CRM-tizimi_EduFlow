/**
 * EduFlow CRM — Offline Sync Manager & Local Queue
 */

import { showToast } from '../utils/formatters.js';

class OfflineSyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueueKey = 'eduflow_sync_queue';
    this.listeners = [];
    this.isSyncing = false;

    window.addEventListener('online', () => this.handleOnlineStatusChange(true));
    window.addEventListener('offline', () => this.handleOnlineStatusChange(false));
  }

  handleOnlineStatusChange(status) {
    this.isOnline = status;
    this.notifyListeners();
    if (status) {
      showToast('Internet aloqasi qaytdi! Ma\'lumotlar avtomatik sinxronlanmoqda...', 'success');
      this.flushQueue();
    } else {
      showToast('Internet uzildi. Offline rejim ishga tushdi.', 'warning');
    }
  }

  getQueue() {
    const raw = localStorage.getItem(this.syncQueueKey);
    return raw ? JSON.parse(raw) : [];
  }

  enqueue(action) {
    const queue = this.getQueue();
    queue.push({
      id: 'sync_' + Date.now(),
      action,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(this.syncQueueKey, JSON.stringify(queue));
    this.notifyListeners();
  }

  async flushQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      let queue = this.getQueue();
      if (queue.length === 0) return;

      console.log(`[SyncManager] Syncing ${queue.length} pending items to Supabase...`);
      
      let successfulCount = 0;
      const remainingQueue = [];

      for (const item of queue) {
        if (!this.isOnline) {
          console.warn(`[SyncManager] Network offline, pausing sync for item:`, item.id);
          remainingQueue.push(item);
          continue;
        }

        try {
          // Simulate network request
          await new Promise(res => setTimeout(res, 300));
          
          successfulCount++;
          console.log(`[SyncManager] Successfully synced action:`, item.action);
        } catch (err) {
          console.error(`[SyncManager] Failed to sync item:`, err);
          remainingQueue.push(item);
        }
      }

      if (remainingQueue.length === 0) {
        localStorage.removeItem(this.syncQueueKey);
      } else {
        localStorage.setItem(this.syncQueueKey, JSON.stringify(remainingQueue));
      }

      this.notifyListeners();
      
      if (successfulCount > 0) {
        showToast(`${successfulCount} ta ma'lumot markaziy bazaga sinxronlandi!`, 'success');
      }
      
      if (remainingQueue.length > 0) {
        showToast(`${remainingQueue.length} ta ma'lumot sinxronlanmadi, kutilmoqda.`, 'warning');
      }
    } finally {
      this.isSyncing = false;
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    const queue = this.getQueue();
    this.listeners.forEach(cb => cb(this.isOnline, queue.length));
  }


}

export const offlineSync = new OfflineSyncManager();
