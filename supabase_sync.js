import { SUPABASE_URL, SUPABASE_ANON_KEY } from './src/config.js';

console.log('[Supabase Sync] Initializing...');

// Standard Supabase client from CDN
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseActive = true;

const TABLES = ['branches', 'users', 'students', 'groups', 'payments', 'attendance', 'leads', 'expenses', 'homework'];

let lastDbState = null;

// Helper to show toasts
function notify(msg, type='info') {
  if (window.showToast) window.showToast(msg, type);
  else console.log(`[Toast ${type}] ${msg}`);
}

async function fetchAllFromSupabase() {
  notify('Ma\'lumotlar serverdan olinmoqda...', 'info');
  const freshDb = {};
  let totalRecords = 0;
  
  for (const table of TABLES) {
    const { data, error } = await client.from(table).select('*');
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      freshDb[table] = [];
    } else {
      freshDb[table] = data || [];
      totalRecords += freshDb[table].length;
    }
  }
  
  // If Supabase is completely empty, upload local mock database to seed it
  if (totalRecords === 0) {
    notify('Baza bo\'sh, boshlang\'ich ma\'lumotlar yuklanmoqda...', 'warning');
    const localDbStr = localStorage.getItem('eduflow_crm_db');
    if (localDbStr) {
      const localDb = JSON.parse(localDbStr);
      lastDbState = JSON.parse(JSON.stringify(freshDb)); // FIX: Set this so pushToSupabase works
      await pushToSupabase(localDb);
      notify('Baza muvaffaqiyatli shakllantirildi!', 'success');
      return fetchAllFromSupabase(); // fetch again
    }
  }
  
  // Set default settings
  freshDb.settings = {};
  freshDb.telegramLog = [];
  
  lastDbState = JSON.parse(JSON.stringify(freshDb));
  
  // Notify bundle.js to reload
  window.dispatchEvent(new CustomEvent('eduflow_supabase_sync', { detail: freshDb }));
  notify('Server bilan sinxronizatsiya muvaffaqiyatli yakunlandi!', 'success');
}

// Push differences to Supabase
async function pushToSupabase(newDb) {
  if (!lastDbState) return;
  
  for (const table of TABLES) {
    const oldRecords = lastDbState[table] || [];
    const newRecords = newDb[table] || [];
    
    // Find Inserts / Updates (Simple Upsert approach)
    // To optimize, we could check for equality, but upsert is fine for now
    const toUpsert = newRecords.filter(nRecord => {
      const oRecord = oldRecords.find(o => o.id === nRecord.id);
      return JSON.stringify(nRecord) !== JSON.stringify(oRecord);
    });
    
    if (toUpsert.length > 0) {
      const { error } = await client.from(table).upsert(toUpsert);
      if (error) {
        console.error(`Error upserting to ${table}:`, error);
        notify(`Xatolik (${table}): ${error.message}`, 'error');
      }
    }
    
    // Find Deletes
    const newIds = new Set(newRecords.map(r => r.id));
    const toDelete = oldRecords.filter(o => !newIds.has(o.id));
    
    for (const dRec of toDelete) {
      await client.from(table).delete().eq('id', dRec.id);
    }
  }
  
  lastDbState = JSON.parse(JSON.stringify(newDb));
}

// Listen to local changes from bundle.js
window.addEventListener('eduflow_db_updated', (e) => {
  console.log('[Supabase Sync] Local change detected, pushing to server...');
  pushToSupabase(e.detail);
});

// Start initial fetch
fetchAllFromSupabase();
