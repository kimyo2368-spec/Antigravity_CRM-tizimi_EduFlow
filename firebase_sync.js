import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { FIREBASE_CONFIG } from './src/config.js';

console.log('[Firebase Sync] Initializing...');

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

const TABLES = ['branches', 'users', 'students', 'groups', 'payments', 'attendance', 'leads', 'expenses', 'homework'];

let lastDbState = null;

function notify(msg, type='info') {
  if (window.showToast) window.showToast(msg, type);
  else console.log(`[Toast ${type}] ${msg}`);
}

async function fetchAllFromFirebase() {
  notify('Ma\'lumotlar serverdan olinmoqda...', 'info');
  const freshDb = {};
  let totalRecords = 0;
  
  try {
    for (const table of TABLES) {
      const querySnapshot = await getDocs(collection(db, table));
      freshDb[table] = [];
      querySnapshot.forEach((doc) => {
        freshDb[table].push(doc.data());
      });
      totalRecords += freshDb[table].length;
    }

    // If Firebase is completely empty, upload local mock database to seed it
    if (totalRecords === 0) {
      notify('Baza bo\'sh, boshlang\'ich ma\'lumotlar yuklanmoqda...', 'warning');
      const localDbStr = localStorage.getItem('eduflow_crm_db');
      if (localDbStr) {
        const localDb = JSON.parse(localDbStr);
        lastDbState = JSON.parse(JSON.stringify(freshDb)); 
        await pushToFirebase(localDb);
        notify('Baza muvaffaqiyatli shakllantirildi!', 'success');
        
        // Prevent infinite recursion by checking if we actually pushed data
        let hasData = false;
        for (let t of TABLES) { if (localDb[t] && localDb[t].length > 0) hasData = true; }
        if (hasData) {
            return fetchAllFromFirebase();
        }
      }
    }

    // Set default settings for bundle.js
    freshDb.settings = {};
    freshDb.telegramLog = [];
    
    lastDbState = JSON.parse(JSON.stringify(freshDb));
    
    // Notify bundle.js to reload. We keep the old event name for compatibility.
    window.dispatchEvent(new CustomEvent('eduflow_supabase_sync', { detail: freshDb }));
    notify('Server bilan sinxronizatsiya muvaffaqiyatli yakunlandi!', 'success');
  } catch (error) {
    console.error("Firebase fetch error:", error); alert("Firebase fetch error: " + error.message);
    notify(`Tarmoq xatosi: ${error.message}`, 'error');
  }
}

async function pushToFirebase(newDb) {
  if (!lastDbState) return;
  
  try {
    for (const table of TABLES) {
      const oldRecords = lastDbState[table] || [];
      const newRecords = newDb[table] || [];
      
      const toUpsert = newRecords.filter(nRecord => {
        const oRecord = oldRecords.find(o => o.id === nRecord.id);
        return JSON.stringify(nRecord) !== JSON.stringify(oRecord);
      });
      
      const newIds = new Set(newRecords.map(r => r.id));
      const toDelete = oldRecords.filter(o => !newIds.has(o.id));
      
      // Upload inserts/updates
      for (const rec of toUpsert) {
        if (!rec.id) continue;
        await setDoc(doc(db, table, rec.id), rec);
      }
      
      // Remove deletes
      for (const rec of toDelete) {
        if (!rec.id) continue;
        await deleteDoc(doc(db, table, rec.id));
      }
    }
    
    lastDbState = JSON.parse(JSON.stringify(newDb));
  } catch (error) {
    console.error("Firebase push error:", error); alert("Firebase push error: " + error.message);
    notify(`Xatolik: ${error.message}`, 'error');
  }
}

// Listen to local changes from bundle.js
window.addEventListener('eduflow_db_updated', (e) => {
  console.log('[Firebase Sync] Local change detected, pushing to server...');
  pushToFirebase(e.detail);
});

// For backward compatibility with bundle.js
window.supabaseActive = true; 

// Start initial fetch
fetchAllFromFirebase();
