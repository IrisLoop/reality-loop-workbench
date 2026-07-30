/* ============================================
   Reality Loop — Utility Functions
   ============================================ */

const RL = {
  /** Generate a unique ID */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  /** Format date to ISO string (local timezone) */
  toISO(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },

  /** Get today's date string YYYY-MM-DD */
  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  /** Format date for display */
  fmtDate(dateStr, style = 'short') {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const opts = style === 'long'
      ? { year:'numeric', month:'long', day:'numeric', weekday:'long' }
      : { month:'short', day:'numeric' };
    return d.toLocaleDateString('zh-CN', opts);
  },

  /** Format time for display HH:mm */
  fmtTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });
  },

  /** Get greeting based on time of day */
  greeting(name) {
    const h = new Date().getHours();
    let text = h >= 5 && h < 12 ? 'Good Morning' : h >= 12 && h < 18 ? 'Good Afternoon' : 'Good Evening';
    if (name) text += ', ' + name;
    return text;
  },

  /** Show toast notification */
  toast(msg, duration = 3000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), duration);
  },

  /** Show confirmation dialog */
  confirm(message) {
    return new Promise(resolve => {
      const ov = document.getElementById('confirm-overlay');
      document.getElementById('confirm-msg').textContent = message;
      ov.classList.add('show');
      const ok = () => { ov.classList.remove('show'); resolve(true); cleanup(); };
      const cancel = () => { ov.classList.remove('show'); resolve(false); cleanup(); };
      function cleanup() {
        document.getElementById('confirm-ok').removeEventListener('click', ok);
        document.getElementById('confirm-cancel').removeEventListener('click', cancel);
      }
      document.getElementById('confirm-ok').addEventListener('click', ok);
      document.getElementById('confirm-cancel').addEventListener('click', cancel);
    });
  },

  /** Open modal sheet */
  openModal(contentHTML) {
    document.getElementById('modal-body').innerHTML = contentHTML;
    document.getElementById('modal-overlay').classList.add('show');
  },

  /** Close modal sheet */
  closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
  },

  /** Escape HTML */
  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /** Debounce */
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  },

  /** Clamp number between min/max */
  clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  },

  /** Validate positive number input */
  validatePositive(val, label) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return { ok: false, error: `${label} 必须为正数` };
    if (!isFinite(n)) return { ok: false, error: `${label} 数值无效` };
    if (n > 1e9) return { ok: false, error: `${label} 值过大` };
    return { ok: true, value: n };
  },

  /** Validate non-negative number */
  validateNonNeg(val, label) {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return { ok: false, error: `${label} 必须为非负数` };
    if (!isFinite(n)) return { ok: false, error: `${label} 数值无效` };
    return { ok: true, value: n };
  }
};

/* Keep each daily digest fixed in the browser after its first successful read. */
const DailyDigestCache = (() => {
  const PREFIX = 'rl-digest-cache-v1:';
  const MAX_STORED_DAYS = 7;
  const memory = new Map();
  const inFlight = new Map();

  function dateInShanghai(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(value);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function expectedTargetDate(now = new Date()) {
    const today = dateInShanghai(now);
    const previous = new Date(`${today}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
  }

  function storageKey(kind, targetDate) {
    return `${PREFIX}${kind}:${targetDate}`;
  }

  function isValidForDate(payload, targetDate, validator) {
    try {
      return validator(payload, targetDate) === true;
    } catch {
      return false;
    }
  }

  function readStored(kind, targetDate, validator) {
    try {
      const payload = JSON.parse(localStorage.getItem(storageKey(kind, targetDate)) || 'null');
      return isValidForDate(payload, targetDate, validator) ? payload : null;
    } catch {
      return null;
    }
  }

  function latestStored(kind) {
    try {
      const prefix = `${PREFIX}${kind}:`;
      let latest = null;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          const payload = JSON.parse(localStorage.getItem(key) || 'null');
          if (payload?.schemaVersion !== 1 || !payload?.targetDate || !Array.isArray(payload?.items) || payload.items.length === 0) continue;
          if (!latest || payload.targetDate > latest.targetDate) latest = payload;
        } catch {
          // Ignore one corrupt cache entry and continue looking for a usable fallback.
        }
      }
      return latest;
    } catch {
      return null;
    }
  }

  function persist(kind, targetDate, payload) {
    try {
      const prefix = `${PREFIX}${kind}:`;
      localStorage.setItem(storageKey(kind, targetDate), JSON.stringify(payload));
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      keys.sort().reverse().slice(MAX_STORED_DAYS).forEach(key => localStorage.removeItem(key));
    } catch {
      // Private browsing or storage pressure must not prevent the digest from rendering.
    }
  }

  function peek(kind, validator) {
    const targetDate = expectedTargetDate();
    const key = storageKey(kind, targetDate);
    if (memory.has(key)) return memory.get(key);
    const stored = readStored(kind, targetDate, validator);
    if (stored) memory.set(key, stored);
    return stored;
  }

  async function load(kind, url, validator) {
    const targetDate = expectedTargetDate();
    const key = storageKey(kind, targetDate);
    const cached = peek(kind, validator);
    if (cached) return cached;
    if (inFlight.has(key)) return inFlight.get(key);

    const request = (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (payload?.schemaVersion !== 1 || !Array.isArray(payload?.items)) {
          throw new Error('Unsupported digest schema');
        }
        memory.set(key, payload);
        if (isValidForDate(payload, targetDate, validator)) {
          persist(kind, targetDate, payload);
        }
        return payload;
      } catch (error) {
        const fallback = latestStored(kind);
        if (fallback) {
          memory.set(key, fallback);
          return fallback;
        }
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, request);
    return request;
  }

  function clearToday(kind) {
    const key = storageKey(kind, expectedTargetDate());
    memory.delete(key);
    inFlight.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // Clearing an unavailable store is already equivalent to a cache miss.
    }
  }

  try {
    if (new URLSearchParams(window.location.search).get('refresh-digests') === '1') {
      clearToday('ai');
      clearToday('finance');
    }
  } catch {
    // Non-browser tests and restricted environments can use the cache normally.
  }

  return { expectedTargetDate, peek, load, clearToday };
})();

// Close modal on overlay click
document.getElementById('modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') RL.closeModal();
});
