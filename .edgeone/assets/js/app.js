/* ============================================
   Reality Loop — App Shell & Router
   SPA navigation, page switching, init
   ============================================ */

const App = {
  currentPage: 'dashboard',
  currentSubPage: null,

  async init() {
    try {
      await DB.open();
      this.bindNav();
      this.navigate('dashboard');
      console.log('[RL] App initialized');
    } catch(e) {
      console.error('[RL] App init failed:', e);
      const el = document.getElementById('dash-home');
      if (el) el.innerHTML = `<div style="padding:40px 16px;text-align:center;color:var(--text-tertiary)">初始化失败: ${RL.esc(e.message)}<br><button class="btn btn-outline btn-sm mt-md" onclick="location.reload()">刷新</button></div>`;
    }
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.page);
      });
    });
  },

  navigate(page, subPage = null) {
    this.currentPage = page;
    this.currentSubPage = subPage;

    // Switch main pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');

    // Render content
    switch(page) {
      case 'dashboard':
        if (!subPage) Dashboard.renderHome();
        else Dashboard.renderSub(subPage);
        break;
      case 'chats':
        Chats.renderList();
        break;
      case 'diary':
        Diary.renderList();
        break;
    }

    // Scroll to top
    window.scrollTo(0, 0);
  },

  /** Show sub-page within dashboard, hide others */
  showDashSub(id) {
    document.getElementById('dash-home')?.classList.add('hidden');
    ['dash-tasks-page','dash-ai-page','dash-english-page','dash-fatloss-page',
     'dash-finance-page','dash-settings-page'].forEach(pid => {
      const el = document.getElementById(pid);
      if (el) el.classList.toggle('hidden', pid !== id);
    });
  },

  /** Return to dash home from sub-page */
  showDashHome() {
    document.getElementById('dash-home')?.classList.remove('hidden');
    ['dash-tasks-page','dash-ai-page','dash-english-page','dash-fatloss-page',
     'dash-finance-page','dash-settings-page'].forEach(pid => {
      document.getElementById(pid)?.classList.add('hidden');
    });
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
