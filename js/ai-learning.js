/* ============================================
   Reality Loop — AI Learning Module
   Resources CRUD, sessions, search/filter
   ============================================ */

const AILearning = {
  currentView: 'resources', // resources | sessions | hot

  async render() {
    const el = document.getElementById('dash-ai-page');
    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">AI Learning</div>
        <button class="header-action" onclick="AILearning.showAddResource()">＋</button>
      </div>

      <div style="padding:0 var(--space-md)">
        <div class="tab-bar">
          <button class="tab-item ${this.currentView==='resources'?'active':''}" onclick="AILearning.switchView('resources')">资料库</button>
          <button class="tab-item ${this.currentView==='sessions'?'active':''}" onclick="AILearning.switchView('sessions')">学习记录</button>
          <button class="tab-item ${this.currentView==='hot'?'active':''}" onclick="AILearning.switchView('hot')">AI 热点</button>
        </div>
      </div>
      <div id="ai-content"></div>
    `;
    this.renderContent();
  },

  switchView(v) { this.currentView = v; this.render(); },

  async renderContent() {
    const c = document.getElementById('ai-content');
    switch(this.currentView) {
      case 'resources': await this._renderResources(c); break;
      case 'sessions': await this._renderSessions(c); break;
      case 'hot': await this._renderHot(c); break;
    }
  },

  async _renderResources(c) {
    const items = await DB.getAll('learningResources');
    const aiItems = items.filter(i => (i.category || '') === 'ai' || !i.category);
    c.style.padding = '0 var(--space-md)';
    c.innerHTML = aiItems.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">📚</div><div class="empty-text">暂无 AI 学习资料<br><small>点击右上角 ＋ 添加</small></div>
      </div></div>`
    : `<div class="card">${aiItems.map(r => this._resourceItem(r)).join('')}</div>`;
  },

  _resourceItem(r) {
    return `
      <div class="list-item" data-id="${r.id}">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(r.title)}</div>
          <div class="list-item-sub">
            ${(r.type||'—')} · ${(r.tags||'').split(',').filter(Boolean).map(t=>`#${t}`).join(' ')||''}
          </div>
          <div class="list-item-sub">${RL.fmtDate(r.createdAt)} · 状态: ${r.status||'待学'}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="AILearning.viewResource('${r.id}')" title="详情">👁️</button>
          <button class="icon-btn" onclick="AILearning.editResource('${r.id}')" title="编辑">✏️</button>
          <button class="icon-btn danger" onclick="AILearning.delResource('${r.id}')" title="删除">🗑️</button>
        </div>
      </div>`;
  },

  async viewResource(id) {
    const r = await DB.get('learningResources', id);
    if (!r) return;
    RL.openModal(`
      <div class="modal-title">${RL.esc(r.title)}</div>
      <div style="font-size:var(--fs-sm)">
        <p><b>类型:</b> ${RL.esc(r.type||'—')}</p>
        <p><b>标签:</b> ${RL.esc(r.tags||'—')}</p>
        <p><b>状态:</b> ${RL.esc(r.status||'待学')}</p>
        ${r.notes ? `<p><b>备注:</b> ${RL.esc(r.notes)}</p>` : ''}
        ${r.sourceLink ? `<p><a href="${RL.esc(r.sourceLink)}" target="_blank" rel="noopener">🔗 来源链接</a></p>` : '<p style="color:var(--text-tertiary)">暂无来源链接</p>'}
        ${r.videoLink ? `<p><a href="${RL.esc(r.videoLink)}" target="_blank" rel="noopener">▶️ 视频链接</a></p>` : '<p style="color:var(--text-tertiary)">暂无视频链接</p>'}
        <p style="color:var(--text-tertiary);margin-top:8px">创建: ${RL.fmtDate(r.createdAt)} · 更新: ${RL.fmtDate(r.updatedAt)}</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline btn-sm" onclick="AILearning.addSessionForResource('${id}')" style="flex:1">记录学习</button>
        <button class="btn btn-primary btn-sm" onclick="RL.closeModal()" style="flex:1">关闭</button>
      </div>
    `);
  },

  async addSessionForResource(resourceId) {
    RL.closeModal();
    setTimeout(() => this.showAddSession(null, resourceId), 300);
  },

  async _renderSessions(c) {
    const sessions = await DB.getAll('learningSessions');
    const aiSessions = sessions.filter(s => (s.category||'') === 'ai' || !s.category);
    aiSessions.sort((a,b) => new Date(b.date+'T'+(b.createdAt||'')) - new Date(a.date+'T'+(a.createdAt||'')));
    c.style.padding = '0 var(--space-md)';
    c.innerHTML = aiSessions.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">⏱️</div><div class="empty-text">暂无学习记录<br><small>点击资料详情可添加记录</small></div>
      </div></div>`
    : `<div class="card">${aiSessions.map(s => this._sessionItem(s)).join('')}</div>
         <div style="text-align:center;padding:12px">
           <button class="btn btn-outline btn-sm" onclick="AILearning.showAddSession()">＋ 新建记录</button>
         </div>`;
  },

  _sessionItem(s) {
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${s.minutes} 分钟 · ${RL.fmtDate(s.date)}</div>
          <div class="list-item-sub">${s.notes ? RL.esc(s.notes) : ''}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="AILearning.editSession('${s.id}')">✏️</button>
          <button class="icon-btn danger" onclick="AILearning.delSession('${s.id}')">🗑️</button>
        </div>
      </div>`;
  },

  async _renderHot(c) {
    c.style.padding = '0 var(--space-md)';

    // 自动热点：来自 data/ai-news.json（由 WorkBuddy 抓取并定期更新）
    let autoHtml = '';
    try {
      const res = await fetch('data/ai-news.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        autoHtml = `
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin:6px 2px 8px">
            <span style="font-size:var(--fs-sm);font-weight:600;color:var(--text-secondary)">今日 AI 热点</span>
            <span style="font-size:var(--fs-xs);color:var(--text-tertiary)">更新于 ${RL.esc(data.updated || '')}</span>
          </div>
          <div class="card">${items.length ? items.map(h => this._hotItem(h)).join('') : '<div class="empty-text" style="padding:14px">暂无自动热点</div>'}</div>`;
      }
    } catch (e) { /* 本地 file:// 打开时 fetch 受限，仅显示手动添加部分 */ }

    // 手动添加的热点（保留原 DB 逻辑）
    const all = await DB.getAll('learningResources');
    const hotItems = all.filter(i => (i.tags||'').includes('热点') || (i.type||'') === 'hot-topic');
    const manualHtml = hotItems.length ? `
      <div style="font-size:var(--fs-sm);font-weight:600;color:var(--text-secondary);margin:16px 2px 8px">我添加的热点</div>
      <div class="card">${hotItems.map(h => this._resourceItem(h)).join('')}</div>` : '';

    c.innerHTML = autoHtml + manualHtml + `
      <div style="text-align:center;padding:16px">
        <button class="btn btn-outline btn-sm" onclick="AILearning.showAddResource('hot-topic')">＋ 添加热点</button>
      </div>`;
  },

  _hotItem(h) {
    const url = h.url || '';
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(h.title || '')}</div>
          <div class="list-item-sub">${RL.esc(h.source || '')}${h.date ? ' · ' + RL.esc(h.date) : ''}</div>
          ${h.summary ? `<div class="list-item-sub" style="color:var(--text-secondary);margin-top:3px;line-height:1.5">${RL.esc(h.summary)}</div>` : ''}
          ${h.tags && h.tags.length ? `<div class="list-item-sub" style="margin-top:3px">${h.tags.map(t => '#' + RL.esc(t)).join(' ')}</div>` : ''}
        </div>
        <div class="list-item-actions">
          ${url ? `<a class="icon-btn" href="${RL.esc(url)}" target="_blank" rel="noopener noreferrer" title="打开原文" style="text-decoration:none">🔗</a>` : ''}
        </div>
      </div>`;
  },

  showAddResource(typeHint = null) {
    RL.openModal(`
      <div class="modal-title">${typeHint === 'hot-topic' ? '添加 AI 热点' : '添加 AI 资料'}</div>
      <div class="form-group"><label class="form-label">标题 *</label><input id="ar-title" placeholder="标题"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1"><label class="form-label">类型</label><input id="ar-type" placeholder="文章/视频/论文..." value="${typeHint||''}"></div>
        <div class="form-group" style="flex:1"><label class="form-label">状态</label><input id="ar-status" placeholder="待学/学习中/已完成"></div>
      </div>
      <div class="form-group"><label class="form-label">主题标签（逗号分隔）</label><input id="ar-tags" placeholder="LLM, Agent, 工程实践"></div>
      <div class="form-group"><label class="form-label">备注/正文</label><textarea id="ar-notes" placeholder="笔记或摘要..."></textarea></div>
      <div class="form-group"><label class="form-label">来源链接</label><input id="ar-source" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">视频链接</label><input id="ar-video" placeholder="https://..."></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="AILearning.saveResource()" style="flex:1">保存</button>
      </div>
    `);
  },

  async saveResource() {
    const title = document.getElementById('ar-title').value.trim();
    if (!title) { RL.toast('请输入标题'); return; }
    const now = RL.toISO(new Date());
    await DB.put('learningResources', {
      id: RL.uid(), title,
      type: document.getElementById('ar-type').value.trim(),
      status: document.getElementById('ar-status').value.trim(),
      tags: document.getElementById('ar-tags').value.trim(),
      notes: document.getElementById('ar-notes').value.trim(),
      sourceLink: document.getElementById('ar-source').value.trim(),
      videoLink: document.getElementById('ar-video').value.trim(),
      category: 'ai',
      createdAt: now, updatedAt: now
    });
    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  editResource(id) {
    DB.get('learningResources', id).then(r => {
      if (!r) return;
      this.showAddResource();
      setTimeout(() => {
        document.getElementById('ar-title').value = r.title||'';
        document.getElementById('ar-type').value = r.type||'';
        document.getElementById('ar-status').value = r.status||'';
        document.getElementById('ar-tags').value = r.tags||'';
        document.getElementById('ar-notes').value = r.notes||'';
        document.getElementById('ar-source').value = r.sourceLink||'';
        document.getElementById('ar-video').value = r.videoLink||'';
        // Replace save handler for edit
        const btn = document.querySelector('[onclick="AILearning.saveResource()"]');
        if (btn) btn.setAttribute('onclick', `AILearning.updateResource('${id}')`);
      }, 100);
    });
  },

  async updateResource(id) {
    const r = await DB.get('learningResources', id);
    if (!r) return;
    r.title = document.getElementById('ar-title').value.trim(); if(!r.title){RL.toast('请输入标题');return;}
    r.type = document.getElementById('ar-type').value.trim();
    r.status = document.getElementById('ar-status').value.trim();
    r.tags = document.getElementById('ar-tags').value.trim();
    r.notes = document.getElementById('ar-notes').value.trim();
    r.sourceLink = document.getElementById('ar-source').value.trim();
    r.videoLink = document.getElementById('ar-video').value.trim();
    r.updatedAt = RL.toISO(new Date());
    await DB.put('learningResources', r);
    RL.closeModal(); RL.toast('已更新'); this.renderContent();
  },

  async delResource(id) {
    if (await RL.confirm('确定删除这条资料吗？')) {
      await DB.del('learningResources', id); RL.toast('已删除'); this.renderContent();
    }
  },

  showAddSession(id = null, resourceId = null) {
    RL.openModal(`
      <div class="modal-title">${id?'编辑':'新建'}学习记录</div>
      <div class="form-group"><label class="form-label">日期</label><input type="date" id="as-date" value="${RL.todayStr()}"></div>
      <div class="form-group"><label class="form-label">学习分钟数 *</label><input type="number" id="as-mins" placeholder="30" min="0" max="1440"></div>
      <div class="form-group"><label class="form-label">备注</label><textarea id="as-notes" placeholder="学习了什么..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="AILearning.saveSession('${id||''}','${resourceId||''}')" style="flex:1">保存</button>
      </div>
    `);
    if (id) {
      DB.get('learningSessions', id).then(s => {
        if (s) { document.getElementById('as-date').value=s.date||''; document.getElementById('as-mins').value=s.minutes||''; document.getElementById('as-notes').value=s.notes||''; }
      });
    }
  },

  async saveSession(id, resourceId) {
    const minsVal = document.getElementById('as-mins').value;
    const v = RL.validateNonNeg(minsVal, '分钟数');
    if (!v.ok) { RL.toast(v.error); return; }

    const now = RL.toISO(new Date());
    if (id) {
      const s = await DB.get('learningSessions', id);
      if (s) { s.date=document.getElementById('as-date').value; s.minutes=v.value; s.notes=document.getElementById('as-notes').value.trim(); s.updatedAt=now; await DB.put('learningSessions',s); }
    } else {
      await DB.put('learningSessions', { id:RL.uid(), date:document.getElementById('as-date').value, minutes:v.value, notes:document.getElementById('as-notes').value.trim(), resourceId:resourceId||null, category:'ai', createdAt:now, updatedAt:now });
    }
    RL.closeModal(); RL.toast(id?'已更新':'已保存'); this.renderContent();
  },

  editSession(id) { this.showAddSession(id); },
  async delSession(id) { if(await RL.confirm('确定删除？')){await DB.del('learningSessions',id);RL.toast('已删除');this.renderContent();} }
};
