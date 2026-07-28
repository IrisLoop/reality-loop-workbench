/* ============================================
   Reality Loop v2 — Dashboard Module
   Soft Editorial Layout
   Date header → Greeting → Weather
   Todo progress (big number) → Fat loss arc
   English/AI mini charts → Module entries
   ============================================ */

const Dashboard = {
  renderHome() {
    try {
      App.showDashHome();
      const el = document.getElementById('dash-home');
      if (!el) { console.error('[RL] #dash-home not found!'); return; }
      this.renderContent(el);
    } catch(e) {
      console.error('[RL] Dashboard.renderHome error:', e);
    }
  },

  renderSub(subPage) {
    App.showDashSub(`dash-${subPage}-page`);
    switch(subPage) {
      case 'tasks': Tasks.render(); break;
      case 'ai': AILearning.open(); break;
      case 'english': EnglishLearning.render(); break;
      case 'fatloss': FatLoss.render(); break;
      case 'finance': Finance.render(); break;
      case 'settings': this.renderSettings(); break;
    }
  },

  async renderContent(el) {
    try {
      const name = await DB.getSetting('displayName', '');
      const today = RL.todayStr();

      // ── Gather data (defensive: each section independent) ──
      // Todos
      let tasks = [], doneTasks = 0, totalTasks = 0, pct = 0;
      try {
        tasks = await DB.getByIndex('tasks', 'date', today);
        doneTasks = tasks.filter(t => t.completed).length;
        totalTasks = tasks.length;
        pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
      } catch(e) { console.warn('[RL] Dashboard todos error:', e); }

      // Weight loss
      let initW = null, targetW = null, wUnit = 'kg', latestWLog = null;
      try {
        initW = await DB.getSetting('initialWeight', null);
        targetW = await DB.getSetting('targetWeight', null);
        wUnit = await DB.getSetting('weightUnit', 'kg');
        const allWLogs = await DB.getAll('weightLogs');
        allWLogs.sort((a,b) => new Date(b.date) - new Date(a.date));
        latestWLog = allWLogs[0] || null;
      } catch(e) { console.warn('[RL] Dashboard weight error:', e); }

      // AI Learning minutes today
      let aiMins = 0, engMins = 0, allSessions = [];
      try {
        allSessions = await DB.getAll('learningSessions');
        const aiToday = allSessions.filter(s =>
          s.date === today && !(s.category||'').startsWith('english-')
        );
        aiMins = aiToday.reduce((s, sess) => s + (parseInt(sess.minutes)||0), 0);
        const engToday = allSessions.filter(s =>
          s.date === today && (s.category||'').startsWith('english-')
        );
        engMins = engToday.reduce((s, sess) => s + (parseInt(sess.minutes)||0), 0);
      } catch(e) { console.warn('[RL] Dashboard learning error:', e); }

      // 7-day data for charts
      const eng7d = this._last7Days(allSessions, 'english-', today);
      const ai7d = this._last7Days(allSessions, null, today);

      // Weather (non-blocking)
      let weatherData = null;
      try {
        const weatherCity = await DB.getSetting('weatherCity', '');
        const wres = await Weather.fetch(weatherCity);
        weatherData = wres.ok ? wres.data : null;
      } catch(e) { console.warn('[RL] Dashboard weather error:', e); }

    el.innerHTML = `
      <!-- ══ Header: Date + Greeting + Settings ══ -->
      <div class="dash-header">
        <div>
          <div class="dash-date-row">
            <span class="dash-date-text">${this._dateHeader()}</span>
            <button class="settings-btn-low" onclick="Dashboard.renderSub('settings')" aria-label="Settings">⚙</button>
          </div>
          <div class="dash-greeting">${RL.greeting(name)}</div>
          ${weatherData ? `
            <div class="dash-weather-line">
              <span class="weather-icon-inline">${weatherData.icon||''}</span>
              ${weatherData.temp ? `<span class="weather-temp">${weatherData.temp}</span>` : ''}
              ${weatherData.desc ? `<span>${RL.esc(weatherData.desc)}</span>` : ''}
              ${weatherData.humidity ? `<span> · 降雨 ${weatherData.humidity}%</span>` : ''}
              ${weatherData.hint ? `<span>，${RL.esc(weatherData.hint)}</span>` : ''}
            </div>
          ` : `
            <div class="dash-weather-line weather-empty-state">
              未连接天气服务 — 可在设置中配置城市
            </div>
          `}
        </div>
      </div>

      <!-- ══ Card 1: Today's Progress (Todo) ══ -->
      <div class="card card-lg" style="cursor:default">
        <div class="card-label">Today's Progress</div>
        <div class="progress-arc-wrap card-inner-gap">
          <div class="progress-arc">
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle class="bg" cx="28" cy="28" r="23"/>
              <circle class="fg" cx="28" cy="28" r="23"
                stroke-dasharray="${2*Math.PI*23}"
                stroke-dashoffset="${2*Math.PI*23*(1-Math.min(pct,100)/100)}"/>
            </svg>
          </div>
          <div>
            <div class="big-number">${pct}<span class="big-number-unit">%</span></div>
            <div class="big-number-sub">
              已完成 ${doneTasks} / 共 ${totalTasks} 项
              ${totalTasks===0?'<br><span style="opacity:.6">今天还没有待办</span>':''}
            </div>
          </div>
        </div>
      </div>

      <!-- ══ Card 2: Fat Loss Progress ══ -->
      <div class="card card-lg" style="cursor:default">
        <div class="card-label">减脂进度</div>
        ${initW ? `
          <div class="fatloss-progress-grid card-inner-gap">
            <div class="fatloss-stat">
              <div class="fatloss-stat-val">${initW}</div>
              <div class="fatloss-stat-lbl">初始</div>
            </div>
            <div class="fatloss-stat">
              <div class="fatloss-stat-val">${latestWLog?latestWLog.weight:'—'}</div>
              <div class="fatloss-stat-lbl">最新</div>
            </div>
            <div class="fatloss-stat">
              <div class="fatloss-stat-val">${targetW||'—'}</div>
              <div class="fatloss-stat-lbl">目标</div>
            </div>
          </div>
          ${latestWLog && initW ? `
            <div class="fatloss-arc-container">
              ${this._fatlossArc(parseFloat(initW), parseFloat(latestWLog.weight), parseFloat(targetW||initW))}
            </div>
            <div class="text-center mt-xs" style="font-size:var(--fs-tiny);color:var(--text-tertiary)">
              ${this._fatlossLabel(initW, latestWLog.weight, wUnit)}
            </div>
          ` : '<div class="empty-state" style="padding:16px 0"><div class="empty-text" style="font-size:var(--fs-caption)">需要更多体重记录来显示进度</div></div>'}
        ` : `
          <div class="empty-state" style="padding:24px 0">
            <div class="empty-text">尚未设置<br><small>点击「减脂」模块开始记录</small></div>
          </div>
        `}
      </div>

      <!-- ══ Mini Charts Row: English + AI ══ -->
      <div class="mini-chart-row">
        <!-- English -->
        <div class="mini-chart-card">
          <div class="mc-header">
            <span class="mc-title">English</span>
            <span class="mc-value">${engMins}<span class="mc-value-unit">min</span></span>
          </div>
          <canvas id="mc-eng-canvas" class="mc-canvas"></canvas>
        </div>
        <!-- AI -->
        <div class="mini-chart-card">
          <div class="mc-header">
            <span class="mc-title">AI Learning</span>
            <span class="mc-value">${aiMins}<span class="mc-value-unit">min</span></span>
          </div>
          <canvas id="mc-ai-canvas" class="mc-canvas"></canvas>
        </div>
      </div>

      <!-- ══ Module Entry List (clickable) ══ -->
      <div class="module-entry-list">
        <div class="module-entry" onclick="App.navigate('dashboard','tasks')">
          <div class="module-entry-icon"><img src="icons/01-daily-plan.png" alt="" draggable="false"></div>
          <div class="module-entry-info">
            <div class="module-entry-name">每日计划</div>
            <div class="module-entry-hint">${totalTasks} 项待办 · 进度 ${pct}%</div>
          </div>
          <div class="module-entry-arrow">›</div>
        </div>
        <div class="module-entry" onclick="App.navigate('dashboard','ai')">
          <div class="module-entry-icon"><img src="icons/02-ai-learning.png" alt="" draggable="false"></div>
          <div class="module-entry-info">
            <div class="module-entry-name">AI Learning</div>
            <div class="module-entry-hint">资料 & 学习记录</div>
          </div>
          <div class="module-entry-arrow">›</div>
        </div>
        <div class="module-entry" onclick="App.navigate('dashboard','english')">
          <div class="module-entry-icon"><img src="icons/03-english-learning.png" alt="" draggable="false"></div>
          <div class="module-entry-info">
            <div class="module-entry-name">English Learning</div>
            <div class="module-entry-hint">听说读写四部分</div>
          </div>
          <div class="module-entry-arrow">›</div>
        </div>
        <div class="module-entry" onclick="App.navigate('dashboard','fatloss')">
          <div class="module-entry-icon"><img src="icons/04-weight-progress.png" alt="" draggable="false"></div>
          <div class="module-entry-info">
            <div class="module-entry-name">减脂</div>
            <div class="module-entry-hint">体重 & 饮食追踪</div>
          </div>
          <div class="module-entry-arrow">›</div>
        </div>
        <div class="module-entry" onclick="App.navigate('dashboard','finance')">
          <div class="module-entry-icon"><img src="icons/05-finance-learning.png" alt="" draggable="false"></div>
          <div class="module-entry-info">
            <div class="module-entry-name">理财知识学习</div>
            <div class="module-entry-hint">热点 & 知识库</div>
          </div>
          <div class="module-entry-arrow">›</div>
        </div>
      </div>
    `;

    // Draw mini charts after DOM is ready (non-blocking)
    requestAnimationFrame(() => {
      try { this._drawBarChart('mc-eng-canvas', eng7d, '#BEC0BC'); } catch(e) { console.warn('[RL] Eng chart error:', e); }
      try { this._drawLineChart('mc-ai-canvas', ai7d, '#D6B7AE'); } catch(e) { console.warn('[RL] AI chart error:', e); }
    });
    } catch(err) {
      console.error('[RL] Dashboard renderContent fatal error:', err);
      el.innerHTML = `
        <div style="padding:40px 16px;text-align:center">
          <div style="font-family:var(--font-serif);font-size:var(--fs-card-title);margin-bottom:8px">加载出错</div>
          <div style="font-size:var(--fs-caption);color:var(--text-tertiary);margin-bottom:16px">${RL.esc(err.message)}</div>
          <button class="btn btn-outline btn-sm" onclick="Dashboard.renderHome()">重试</button>
        </div>`;
    }
  },

  /* ── Helpers ── */

  _dateHeader() {
    return RL.fmtDate(new Date(), 'long');
  },

  _last7Days(allSessions, catPrefix, todayStr) {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStr + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = RL.toISO(d).slice(0,10);
      const daySessions = allSessions.filter(s => s.date === ds && (catPrefix ? (s.category||'').startsWith(catPrefix) : !(s.category||'').startsWith('english-')));
      const mins = daySessions.reduce((sum,s) => sum + (parseInt(s.minutes)||0), 0);
      result.push({ date: ds, mins, label: ['日','一','二','三','四','五','六'][d.getDay()] });
    }
    return result;
  },

  _fatlossArc(init, current, target) {
    if (!init) return '';
    const range = Math.max(init - target, 0.1);
    const progress = Math.min(Math.max((init - current) / range, 0), 1);
    const r = 38;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - progress);
    return `<svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="#F0F0EC" stroke-width="5"/>
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="#1F201F" stroke-width="5"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 40 40)"
        style="transition:stroke-dashoffset .6s ease"/>
    </svg>`;
  },

  _fatlossLabel(init, latest, unit) {
    const diff = parseFloat(init) - parseFloat(latest);
    if (diff > 0) return `已减轻 ${diff.toFixed(1)} ${unit}`;
    if (diff < 0) return `较初始增加 ${Math.abs(diff).toFixed(1)} ${unit}`;
    return `当前 ${latest} ${unit}`;
  },

  /* ── Mini Chart Drawing (Canvas) ── */

  _drawBarChart(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2,2);
    const W = w/2, H = h/2;
    const maxVal = Math.max(...data.map(d=>d.mins), 1);
    const barW = Math.max(W/10, 4);
    const gap = (W - barW*7)/8;
    ctx.fillStyle = color;
    data.forEach((d,i) => {
      const bh = Math.max((d.mins/maxVal)*(H-8), d.mins>0?2:0);
      const x = gap + i*(barW+gap);
      const y = H - bh - 2;
      ctx.beginPath();
      ctx.roundRect(x,y,barW,bh,2);
      ctx.fill();
    });
  },

  _drawLineChart(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2,2);
    const W = w/2, H = h/2;
    const maxVal = Math.max(...data.map(d=>d.mins), 1);
    const pad = 6;
    const stepX = (W-pad*2)/6;
    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d,i) => {
      const x = pad + i*stepX;
      const y = H - pad - (d.mins/maxVal)*(H-pad*2);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // Draw dots
    ctx.fillStyle = color;
    data.forEach((d,i) => {
      if(d.mins>0){
        const x=pad+i*stepX, y=H-pad-(d.mins/maxVal)*(H-pad*2);
        ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();
      }
    });
  },

  /* ── Settings Page (unchanged logic, new visual tokens) ── */

  async renderSettings() {
    const el = document.getElementById('dash-settings-page');
    const name = await DB.getSetting('displayName', '');
    const city = await DB.getSetting('weatherCity', '');
    const wUnit = await DB.getSetting('weightUnit', 'kg');
    const provider = await DB.getSetting('weatherProvider', 'wttr');

    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">设置</div>
      </div>
      <div style="padding:0 var(--page-x)">
        <div class="settings-section">
          <div class="settings-section-title">个人信息</div>
          <div class="setting-row">
            <span class="setting-label">显示名称</span>
            <span class="setting-value">${name||'未设置'}</span>
          </div>
          <div class="form-group">
            <input id="set-name-input" placeholder="输入名称" value="${RL.esc(name)}">
            <button class="btn btn-primary btn-sm mt-sm" onclick="Dashboard.saveName()">保存</button>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">天气</div>
          <div class="setting-row">
            <span class="setting-label">城市</span>
            <span class="setting-value">${city||'未设置'}</span>
          </div>
          <div class="form-group">
            <input id="set-city-input" placeholder="如：上海 / Shanghai" value="${RL.esc(city)}">
            <button class="btn btn-primary btn-sm mt-sm" onclick="Dashboard.saveCity()">保存</button>
          </div>

          <div class="setting-row" style="margin-top:4px">
            <span class="setting-label">天气源</span>
            <div class="pill-toggle-group" style="width:220px">
              <button class="pill-toggle ${provider==='wttr'?'active':''}" onclick="Dashboard.saveProvider('wttr')">wttr.in</button>
              <button class="pill-toggle ${provider==='qweather'?'active':''}" onclick="Dashboard.saveProvider('qweather')">和风天气</button>
            </div>
          </div>

          <div id="wkey-wrap" style="${provider==='qweather' ? '' : 'display:none'}">
            <div class="form-group">
              <label class="form-label" for="set-wkey-input">API Key（仅和风需要）</label>
              <input id="set-wkey-input" type="password" placeholder="粘贴你的和风天气 API Key" value="">
              <button class="btn btn-primary btn-sm mt-sm" onclick="Dashboard.saveWeatherKey()">保存并连接</button>
            </div>
          </div>

          <p style="font-size:var(--fs-tiny);color:var(--text-tertiary);margin-top:6px;line-height:1.6">
            <strong>wttr.in</strong>：免费、无需 Key、浏览器直连（已开启 CORS），支持中文城市名，开箱即用。<br>
            <strong>和风天气</strong>：数据更官方，但免费版需在控制台「API Key → 设置授权域名」把部署域名加入白名单，且不能用 localhost 访问。
          </p>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">单位偏好</div>
          <div class="setting-row">
            <span class="setting-label">体重单位</span>
            <div class="pill-toggle-group" style="width:160px">
              <button class="pill-toggle ${wUnit==='kg'?'active':''}" onclick="Dashboard.saveUnit('kg')">kg</button>
              <button class="pill-toggle ${wUnit==='jin'?'active':''}" onclick="Dashboard.saveUnit('jin')">斤</button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <span class="setting-label">AI Chat Provider</span>
          <div class="setting-row">
            <span class="setting-label" style="color:var(--text-secondary)">当前 Provider</span>
            <span class="setting-value">${ChatProvider.currentName||'本地检索模式'}</span>
          </div>
          <button class="btn btn-white btn-block mb-sm" onclick="ChatProvider.showConfig()">
            配置 AI API
          </button>
          <p style="font-size:var(--fs-tiny);color:var(--text-tertiary)">
            不配置则使用本地检索模式（不发送数据到外部）
          </p>
        </div>

        <div class="settings-section">
          <span class="setting-label">数据管理</span>
          <button class="btn btn-white btn-block mb-sm" onclick="Dashboard.doExport()">导出数据 (JSON)</button>
          <button class="btn btn-white btn-block mb-sm" onclick="Dashboard.doImport()">导入数据</button>
          <button class="btn btn-danger btn-block" onclick="Dashboard.clearDemo()">清空演示数据</button>
        </div>
      </div>
    `;
  },

  async saveName() {
    const v = document.getElementById('set-name-input').value.trim();
    await DB.setSetting('displayName', v);
    RL.toast('名称已保存'); this.renderSettings();
  },
  async saveCity() {
    const v = document.getElementById('set-city-input').value.trim();
    await DB.setSetting('weatherCity', v);
    RL.toast('城市已保存'); this.renderSettings();
  },
  async saveProvider(p) {
    await DB.setSetting('weatherProvider', p);
    Weather._cache = null; // force refresh with new provider
    RL.toast(p === 'wttr' ? '已切换为 wttr.in（免 Key）' : '已切换为和风天气');
    this.renderSettings();
  },

  async saveWeatherKey() {
    const v = document.getElementById('set-wkey-input').value.trim();
    if (!v) { RL.toast('请输入 API Key'); return; }
    await DB.setSetting('weatherApiKey', v);
    await DB.setSetting('weatherProvider', 'qweather'); // lock to QWeather
    // Clear cache so next fetch uses the new key
    Weather._cache = null; Weather._locCache = {};
    RL.toast('天气 Key 已保存，正在连接…');
    // Test fetch to give immediate feedback
    const city = await DB.getSetting('weatherCity', '');
    if (city) {
      const wres = await Weather.fetch(city);
      if (wres.ok) {
        const note = wres.note ? `（${wres.note}）` : '';
        RL.toast(`已连接：${wres.data.temp} ${wres.data.desc || ''}${note}`);
      } else RL.toast(`连接失败：${wres.error}`);
    } else {
      RL.toast('已保存，请在上方先设置城市');
    }
    this.renderSettings();
  },
  async saveUnit(unit) {
    await DB.setSetting('weightUnit', unit);
    RL.toast(`单位已切换为 ${unit}`); this.renderSettings();
  },

  async doExport() {
    try {
      const json = await DB.exportData();
      const blob = new Blob([json], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url;
      a.download=`reality-loop-export-${RL.todayStr()}.json`; a.click();
      URL.revokeObjectURL(url); RL.toast('导出成功');
    } catch(e){ RL.toast('导出失败: '+e.message); }
  },

  doImport() {
    RL.openModal(`
      <div class="modal-title">导入数据</div>
      <p style="font-size:var(--fs-caption);color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
        选择之前导出的 JSON 文件。导入前会预览内容，不会覆盖已有数据。
      </p>
      <input type="file" id="import-file" accept=".json" style="margin-bottom:12px">
      <div id="import-preview" style="max-height:200px;overflow:auto;font-size:var(--fs-tiny);background:var(--bg-input);padding:10px;border-radius:10px;display:none;font-family:monospace"></div>
      <div style="display:flex;gap:8px;margin-top:18px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="Dashboard.execImport()" style="flex:1" id="import-btn" disabled>确认导入</button>
      </div>
    `);
    document.getElementById('import-file').addEventListener('change', e=>{
      const file=e.target.files[0]; if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const data=JSON.parse(ev.target.result);
          const p=document.getElementById('import-preview');
          p.style.display='block'; p.textContent=
            `版本: ${data.version}\n导出时间: ${data.exportedAt}\n`+
            Object.keys(data).filter(k=>!['version','exportedAt'].includes(k))
              .map(k=>`${k}: ${(Array.isArray(data[k])?data[k].length:'—')} 条`).join('\n');
          window._importData=ev.target.result;
          document.getElementById('import-btn').disabled=false;
        }catch(err){ alert('JSON 格式无效'); }
      };
      reader.readAsText(file);
    });
  },

  async execImport() {
    if(!window._importData) return;
    try{ await DB.importData(window._importData); RL.closeModal(); RL.toast('导入成功'); delete window._importData;}
    catch(e){ RL.toast('导入失败: '+e.message); }
  },

  async clearDemo() {
    const hasReal = await DB.hasRealData();
    const msg = hasReal
      ? '⚠️ 检测到真实数据！清空操作不可恢复，确定要清空所有数据吗？'
      : '确定要清空所有演示数据吗？';
    if(await RL.confirm(msg)){ await DB.clearDemoData(); RL.toast('已清空'); this.renderSettings(); }
  }
};
