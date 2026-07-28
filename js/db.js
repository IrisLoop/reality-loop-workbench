/* ============================================
   Reality Loop — IndexedDB Data Layer
   Entities: settings, tasks, learningResources,
   learningSessions, weightProfile, weightLogs,
   foodLogs, financeItems, diaryEntries,
   chatSessions, chatMessages
   ============================================ */

const DB = (() => {
  const DB_NAME = 'RealityLoopDB';
  const DB_VERSION = 1;

  let db = null;

  /** Open/create database */
  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        // Settings
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        // Tasks
        if (!d.objectStoreNames.contains('tasks')) {
          const s = d.createObjectStore('tasks', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('completed', 'completed', { unique: false });
        }
        // Learning Resources (AI)
        if (!d.objectStoreNames.contains('learningResources')) {
          const s = d.createObjectStore('learningResources', { keyPath: 'id' });
          s.createIndex('type', 'type', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        // Learning Sessions
        if (!d.objectStoreNames.contains('learningSessions')) {
          const s = d.createObjectStore('learningSessions', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
          s.createIndex('resourceId', 'resourceId', { unique: false });
        }
        // Weight Profile
        if (!d.objectStoreNames.contains('weightProfile')) d.createObjectStore('weightProfile', { keyPath: 'key' });
        // Weight Logs
        if (!d.objectStoreNames.contains('weightLogs')) {
          const s = d.createObjectStore('weightLogs', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        // Food Logs
        if (!d.objectStoreNames.contains('foodLogs')) {
          const s = d.createObjectStore('foodLogs', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        // Finance Items
        if (!d.objectStoreNames.contains('financeItems')) {
          const s = d.createObjectStore('financeItems', { keyPath: 'id' });
          s.createIndex('category', 'category', { unique: false });
        }
        // Diary Entries
        if (!d.objectStoreNames.contains('diaryEntries')) {
          const s = d.createObjectStore('diaryEntries', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        // Chat Sessions
        if (!d.objectStoreNames.contains('chatSessions')) {
          d.createObjectStore('chatSessions', { keyPath: 'id' });
        }
        // Chat Messages
        if (!d.objectStoreNames.contains('chatMessages')) {
          const s = d.createObjectStore('chatMessages', { keyPath: 'id' });
          s.createIndex('sessionId', 'sessionId', { unique: false });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  /** Generic CRUD helpers */
  function tx(stores, mode) { return db.transaction(stores, mode); }

  async function getAll(storeName) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(storeName, id) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readonly').objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, item) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').objectStore(storeName).put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function del(storeName, id) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').objectStore(storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function getByIndex(storeName, indexName, value) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readonly').objectStore(storeName).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function countAll(storeName) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readonly').objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(storeName) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(storeName, 'readwrite').objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /* ── Settings ── */
  async function getSetting(key, defaultVal = null) {
    await open();
    return new Promise(resolve => {
      const req = tx('settings', 'readonly').objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultVal);
      req.onerror = () => resolve(defaultVal);
    });
  }
  async function setSetting(key, value) {
    await put('settings', { key, value, updatedAt: RL.toISO(new Date()) });
  }

  /* ── Export all data as JSON ── */
  async function exportData() {
    const stores = ['tasks','learningResources','learningSessions','weightProfile',
                    'weightLogs','foodLogs','financeItems','diaryEntries',
                    'chatSessions','chatMessages','settings'];
    const data = { version: '1.0.0', exportedAt: RL.toISO(new Date()) };
    for (const s of stores) {
      try { data[s] = await getAll(s); } catch(e) { data[s] = []; }
    }
    return JSON.stringify(data, null, 2);
  }

  /* ── Import from JSON with validation ── */
  async function importData(jsonStr) {
    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch(e) { throw new Error('JSON 格式无效'); }
    if (!parsed.version) throw new Error('缺少版本号，可能不是有效的导出文件');
    const stores = ['tasks','learningResources','learningSessions','weightProfile',
                    'weightLogs','foodLogs','financeItems','diaryEntries',
                    'chatSessions','chatMessages','settings'];
    for (const s of stores) {
      if (Array.isArray(parsed[s]) && parsed[s].length > 0) {
        const t = tx(s, 'readwrite');
        const os = t.objectStore(s);
        for (const item of parsed[s]) os.put(item);
        await new Promise((res, rej) => { t.oncomplete = res; t.onerror = rej; });
      }
    }
  }

  /* ── Clear demo data ── */
  async function clearDemoData() {
    const stores = ['tasks','learningResources','learningSessions','weightLogs',
                    'foodLogs','financeItems','diaryEntries','chatSessions','chatMessages'];
    for (const s of stores) await clearStore(s);
  }

  /* ── Check if has any real data ── */
  async function hasRealData() {
    const counts = await Promise.all([
      countAll('tasks'), countAll('diaryEntries'), countAll('chatSessions')
    ]);
    return counts.some(c => c > 0);
  }

  return {
    open, getAll, get, put, del, getByIndex, countAll, clearStore,
    getSetting, setSetting, exportData, importData, clearDemoData, hasRealData
  };
})();
