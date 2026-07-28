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
      document.getElementById.getElementById('confirm-cancel').addEventListener('click', cancel);
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

// Close modal on overlay click
document.getElementById('modal-overlay')?.addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') RL.closeModal();
});
