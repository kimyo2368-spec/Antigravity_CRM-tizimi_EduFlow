/**
 * EduFlow CRM — Supabase Client Service (Real Backend)
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { DEFAULT_SETTINGS } from '../types/index.js';
import { showToast } from '../utils/formatters.js';

class SupabaseService {
  constructor() {
    this.useRealApi = true;
    
    // Initialize Supabase Client
    if (window.supabase) {
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error('Supabase library not found! Make sure the CDN script is in index.html');
    }
  }

  async get(collection, filterFn = null) {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from(collection)
        .select('*');
        
      if (error) throw error;
      
      // Fallback local filter for backward compatibility with existing codebase
      if (filterFn && typeof filterFn === 'function') {
        return data.filter(filterFn);
      }
      return data || [];
    } catch (err) {
      console.error(`Error fetching from ${collection}:`, err.message);
      return [];
    }
  }

  async insert(collection, item) {
    if (!this.client) return null;
    try {
      // Remove local ID so Postgres generates a real UUID
      const { id, ...dataToInsert } = item; 
      
      // Some modules might already use UUIDs, if it's a valid UUID we could keep it, but it's safer to let DB generate.
      const payload = (id && String(id).length === 36) ? item : dataToInsert;

      const { data, error } = await this.client
        .from(collection)
        .insert([payload])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`Error inserting into ${collection}:`, err.message);
      showToast(`Xatolik (${collection}): ` + err.message, 'error');
      return null;
    }
  }

  async update(collection, id, updates) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from(collection)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (err) {
      console.error(`Error updating ${collection}:`, err.message);
      showToast(`Tahrirlashda xatolik (${collection}): ` + err.message, 'error');
      return null;
    }
  }

  async delete(collection, id) {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from(collection)
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    } catch (err) {
      console.error(`Error deleting from ${collection}:`, err.message);
      showToast(`O'chirishda xatolik: ` + err.message, 'error');
      return false;
    }
  }

  // Settings are still stored in localStorage for now since they are app-wide prefs, 
  // or we could store them in a settings table if created. 
  getSettings() {
    try {
      const raw = localStorage.getItem('eduflow_settings');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem('eduflow_settings', JSON.stringify(updated));
    return updated;
  }
}

export const supabase = new SupabaseService();
