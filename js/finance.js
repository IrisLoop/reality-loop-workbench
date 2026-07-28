/* ============================================
   Reality Loop — Finance Learning Module
   Financial news + knowledge base
   No auto-data in v1
   ============================================ */

const Finance = {
  currentView: 'news', // news | knowledge

  async render() {
    const el = document.getElementById('dash-finance-page');
    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">理财知识学习</div>
        <button class="header-action" onclick="Finance.showAdd()">＋</button>
      </div>
      <div style="padding:0 var(--space-md)">
        <div class="pill-toggle-group">
          <button class="pill-toggle ${this.currentView==='news'?'active':''}" onclick="Finance.switchView('news')">金融热点</button>
          <button class="pill-toggle ${this.currentView==='knowledge'?'active':''}" onclick="Finance.switchView('knowledge')">知识库</button>
        </div>
      </div>
      <div id="finance-content"></div>
      <div style="padding:8px var(--space-md);font-size:var(--fs-xs);color:var(--text-tertiary);text-align:center">
        ⚠️ 以上内容均为学习资料，不构成投资建议
      </div>
    `;
    this.renderContent();
  },

  switchView(v) { this.currentView = v; this.render(); },

  async renderContent() {
    const c = document.getElementById('finance-content');
    if (this.currentView === 'news') await this._renderNews(c);
    else await this._renderKnowledge(c);
  },

  async _renderNews(c) {
    const items = await DB.getAll('financeItems');
    const news = items.filter(i => (i.category||'') === 'news');
    news.sort((a,b) => new Date(b.eventDate || b.createdAt) - new Date(a.eventDate || a.createdAt));

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = news.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">📰</div>
        <div class="empty-text">暂无金融热点<br><small>首版仅支持手动添加，不自动生成实时数据</small></div>
      </div></div>`
    : `<div class="card">${news.map(n => this._newsItem(n)).join('')}</div>`;
  },

  _newsItem(n) {
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(n.title)}</div>
          <div class="list-item-sub">
            主题: ${n.topic||'—'} · ${n.eventDate?RL.fmtDate(n.eventDate):''}
          </div>
          ${n.summary ? `<div class="list-item-sub" style="margin-top:4px;color:var(--text-secondary)">${RL.esc(n.summary.slice(0,120))}${n.summary.length>120?'...':''}</div>` : ''}
          <div class="list-item-sub">
            来源: ${n.sourceName||'—'}
            ${n.sourceLink ? `<a href="${RL.esc(n.sourceLink)}" target="_blank" rel="noopener" style="margin-left:4px">🔗</a>` : ''}
          </div>
          <div class="list-item-sub" style="color:var(--text-tertiary)">状态: ${n.status||'未读'} · ${RL.fmtDate(n.createdAt)}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="Finance.editItem('${n.id}')">✏️</button>
          <button class="icon-btn danger" onclick="Finance.delItem('${n.id}')">🗑️</button>
        </div>
      </div>`;
  },

  async _renderKnowledge(c) {
    const items = await DB.getAll('financeItems');
    const kb = items.filter(i => (i.category||'') === 'knowledge');

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = kb.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">📚</div>
        <div class="empty-text">知识库为空<br><small>点击右上角 ＋ 添加知识点</small></div>
      </div></div>`
    : `<div class="card">${kb.map(k => this._kbItem(k)).join('')}</div>`;
  },

  _kbItem(k) {
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(k.title)}</div>
          ${k.content ? `<div class="list-item-sub">${RL.esc(k.content.slice(0,150))}${k.content.length>150?'...':''}</div>` : ''}
          ${k.link ? `<div class="list-item-sub"><a href="${RL.esc(k.link)}" target="_blank" rel="noopener">🔗 ${k.link}</a></div>` : ''}
          <div class="list-item-sub" style="color:var(--text-tertiary)">${RL.fmtDate(k.createdAt)}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="Finance.editItem('${k.id}')">✏️</button>
          <button class="icon-btn danger" onclick="Finance.delItem('${k.id}')">🗑️</button>
        </div>
      </div>`;
  },

  showAdd() {
    const isNews = this.currentView === 'news';
    RL.openModal(`
      <div class="modal-title">${isNews?'添加金融热点':'添加知识点'}</div>
      <div class="form-group"><label class="form-label">标题 *</label><input id="fi-title" placeholder="标题"></div>
      ${isNews ? `
        <div class="form-group"><label class="form-label">主题</label><input id="fi-topic" placeholder="如：货币政策、市场动态"></div>
        <div class="form-group"><label class="form-label">事件日期</label><input type="date" id="fi-eventdate"></div>
        <div class="form-group"><label class="form-label">摘要</label><textarea id="fi-summary" placeholder="事件摘要..."></textarea></div>
        <div class="form-row">
          <div class="form-group" style="flex:2"><label class="form-label">来源名称</label><input id="fi-sourcename" placeholder="如：财新网"></div>
          <div class="form-group" style="flex:1"><label class="form-label">状态</label><input id="fi-status" placeholder="未读/已读"></div>
        </div>
        <div class="form-group"><label class="form-label">来源链接</label><input id="fi-sourcelink" placeholder="https://..."></div>
      ` : `
        <div class="form-group"><label class="form-label">正文/笔记</label><textarea id="fi-content" placeholder="知识点内容..." style="min-height:120px"></textarea></div>
        <div class="form-group"><label class="form-label">参考链接</label><input id="fi-link" placeholder="https://..."></div>
      `}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="Finance.saveItem()" style="flex:1">保存</button>
      </div>
    `);
  },

  async saveItem() {
    const title = document.getElementById('fi-title').value.trim();
    if (!title) { RL.toast('请输入标题'); return; }
    const isNews = this.currentView === 'news';
    const now = RL.toISO(new Date());

    const base = { id: RL.uid(), title, category: isNews ? 'news' : 'knowledge', createdAt: now, updatedAt: now };

    if (isNews) {
      Object.assign(base, {
        topic: document.getElementById('fi-topic').value.trim(),
        eventDate: document.getElementById('fi-eventdate').value || null,
        summary: document.getElementById('fi-summary').value.trim(),
        sourceName: document.getElementById('fi-sourcename').value.trim(),
        status: document.getElementById('fi-status').value.trim(),
        sourceLink: document.getElementById('fi-sourcelink').value.trim()
      });
    } else {
      Object.assign(base, {
        content: document.getElementById('fi-content').value.trim(),
        link: document.getElementById('fi-link').value.trim()
      });
    }

    await DB.put('financeItems', base);
    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  async editItem(id) {
    const item = await DB.get('financeItems', id);
    if (!item) return;
    this.currentView = item.category || 'news';
    this.render();
    setTimeout(() => {
      this.showAdd();
      setTimeout(() => {
        document.getElementById('fi-title').value = item.title||'';
        if (item.category === 'news') {
          document.getElementById('fi-topic').value=item.topic||'';
          document.getElementById('fi-eventdate').value=item.eventDate||'';
          document.getElementById('fi-summary').value=item.summary||'';
          document.getElementById('fi-sourcename').value=item.sourceName||'';
          document.getElementById('fi-status').value=item.status||'';
          document.getElementById('fi-sourcelink').value=item.sourceLink||'';
        } else {
          document.getElementById('fi-content').value=item.content||'';
          document.getElementById('fi-link').value=item.link||'';
        }
        const btn = document.querySelector('[onclick="Finance.saveItem()"]');
        if (btn) btn.setAttribute('onclick', `Finance.updateItem('${id}')`);
      }, 100);
    }, 50);
  },

  async updateItem(id) {
    const item = await DB.get('financeItems', id);
    if (!item) return;
    item.title = document.getElementById('fi-title').value.trim();
    if (!item.title) { RL.toast('请输入标题'); return; }
    if (item.category === 'news') {
      item.topic = document.getElementById('fi-topic').value.trim();
      item.eventDate = document.getElementById('fi-eventdate').value || null;
      item.summary = document.getElementById('fi-summary').value.trim();
      item.sourceName = document.getElementById('fi-sourcename').value.trim();
      item.status = document.getElementById('fi-status').value.trim();
      item.sourceLink = document.getElementById('fi-sourcelink').value.trim();
    } else {
      item.content = document.getElementById('fi-content').value.trim();
      item.link = document.getElementById('fi-link').value.trim();
    }
    item.updatedAt = RL.toISO(new Date());
    await DB.put('financeItems', item);
    RL.closeModal(); RL.toast('已更新'); this.renderContent();
  },

  async delItem(id) {
    if (await RL.confirm('确定删除？')) { await DB.del('financeItems', id); RL.toast('已删除'); this.renderContent(); }
  }
};
