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
  ,

  _safeUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) {
      return '';
    }
  },

  _verificationLabel(value) {
    return {
      official: '\u5b98\u65b9\u786e\u8ba4',
      cross_verified: '\u591a\u6765\u6e90\u786e\u8ba4',
      single_source: '\u5355\u4e00\u6765\u6e90'
    }[value] || '\u5c1a\u5f85\u6838\u5b9e';
  },

  _healthLabel(value) {
    return {
      ok: '\u6b63\u5e38',
      degraded: '\u90e8\u5206\u53ef\u7528',
      failed: '\u5931\u8d25',
      skipped: '\u672a\u914d\u7f6e'
    }[value] || '\u672a\u77e5';
  },

  _isStale(targetDate) {
    if (!targetDate) return true;
    const endOfTargetDay = new Date(`${targetDate}T23:59:59+08:00`);
    if (Number.isNaN(endOfTargetDay.getTime())) return true;
    return Date.now() - endOfTargetDay.getTime() > 2 * 24 * 60 * 60 * 1000;
  },

  async _renderNews(c) {
    c.style.padding = '0 var(--space-md)';
    c.innerHTML = `
      <div class="card">
        <div class="empty-state finance-loading-state">
          <div class="finance-loading-dot" aria-hidden="true"></div>
          <div class="empty-text">\u6b63\u5728\u8bfb\u53d6\u6628\u65e5\u91d1\u878d\u70ed\u70b9...</div>
        </div>
      </div>`;

    const manualPromise = DB.getAll('financeItems');
    let snapshot = null;
    let loadError = '';
    try {
      const response = await fetch('data/finance-news.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.schemaVersion !== 1 || !Array.isArray(payload.items)) {
        throw new Error('\u6570\u636e\u683c\u5f0f\u4e0d\u53d7\u652f\u6301');
      }
      snapshot = payload;
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }

    const allItems = await manualPromise;
    const manualItems = allItems
      .filter(item => (item.category || '') === 'news')
      .sort((a, b) => new Date(b.eventDate || b.createdAt) - new Date(a.eventDate || a.createdAt));

    const automaticHtml = snapshot ? this._snapshotHtml(snapshot) : `
      <div class="card"><div class="empty-state">
        <div class="empty-text">\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u81ea\u52a8\u91d1\u878d\u70ed\u70b9<br><small>${RL.esc(loadError || '\u8bf7\u7a0d\u540e\u91cd\u8bd5')}</small></div>
      </div></div>`;
    const manualHtml = manualItems.length ? `
      <div class="finance-section-heading">\u6211\u6dfb\u52a0\u7684\u70ed\u70b9</div>
      <div class="card">${manualItems.map(item => this._manualNewsItem(item)).join('')}</div>` : '';

    c.innerHTML = automaticHtml + manualHtml;
  },

  _snapshotHtml(data) {
    const stale = this._isStale(data.targetDate);
    const dateLabel = data.targetDate ? RL.esc(data.targetDate) : '\u7b49\u5f85\u9996\u6b21\u8fd0\u884c';
    const statusText = stale && data.targetDate
      ? '\u6570\u636e\u53ef\u80fd\u5df2\u8fc7\u671f'
      : (data.status === 'partial' ? `\u5df2\u9009 ${data.itemCount || 0} / 10 \u6761` : '\u6628\u65e5\u7cbe\u9009');
    const health = (data.sourceHealth || [])
      .map(source => `<span class="finance-source-health" data-status="${['ok','degraded','failed','skipped'].includes(source.status) ? source.status : 'unknown'}">${RL.esc(source.name || '')} &middot; ${RL.esc(this._healthLabel(source.status))}</span>`)
      .join('');
    const items = (data.items || []).slice(0, 10);
    const emptyMessage = data.status === 'awaiting_api_configuration'
      ? '\u81ea\u52a8\u66f4\u65b0\u7a0b\u5e8f\u5df2\u5c31\u7eea\uff0c\u7b49\u5f85\u9996\u6b21\u7ebf\u4e0a\u8fd0\u884c\u3002'
      : '\u8be5\u65e5\u671f\u6ca1\u6709\u8fbe\u5230\u7b5b\u9009\u6807\u51c6\u7684\u70ed\u70b9\uff0c\u4e0d\u4f7f\u7528\u4f4e\u8d28\u91cf\u5185\u5bb9\u51d1\u6570\u3002';

    return `
      <div class="finance-digest-meta ${stale ? 'stale' : ''}">
        <div>
          <div class="finance-digest-title">\u6628\u65e5\u91d1\u878d\u70ed\u70b9</div>
          <div class="finance-digest-date">\u6570\u636e\u65e5\u671f ${dateLabel} &middot; ${RL.esc(statusText)}</div>
        </div>
        <div class="finance-count">${items.length}<small>/10</small></div>
      </div>
      ${health ? `<div class="finance-source-health-row">${health}</div>` : ''}
      ${items.length ? `<div class="finance-news-list">${items.map((item, index) => this._automaticNewsItem(item, index)).join('')}</div>` : `
        <div class="card"><div class="empty-state"><div class="empty-text">${RL.esc(emptyMessage)}</div></div></div>`}
      <div class="finance-method-note">${RL.esc(data.methodology || '')}</div>`;
  },

  _automaticNewsItem(item, index) {
    const url = this._safeUrl(item.url);
    const sources = (item.sources || []).map(source => source.name).filter(Boolean);
    const sourceText = sources.length ? [...new Set(sources)].join(' / ') : (item.source || '\u672a\u77e5\u6765\u6e90');
    const linkText = item.urlType === 'homepage' ? '\u67e5\u770b\u6765\u6e90\u4e3b\u9875' : '\u9605\u8bfb\u539f\u6587';
    const verificationClass = ['official','cross_verified','single_source'].includes(item.verification) ? item.verification : 'unverified';
    return `
      <article class="finance-news-card">
        <div class="finance-news-topline">
          <span class="finance-news-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="finance-category">${RL.esc(item.categoryLabel || '\u91d1\u878d\u70ed\u70b9')}</span>
          <span class="finance-verification ${verificationClass}">${RL.esc(this._verificationLabel(item.verification))}</span>
        </div>
        <h3 class="finance-news-title">${RL.esc(item.title || '')}</h3>
        ${item.summary ? `<p class="finance-news-summary">${RL.esc(item.summary)}</p>` : ''}
        ${item.whySelected ? `<p class="finance-news-reason">${RL.esc(item.whySelected)}</p>` : ''}
        <div class="finance-news-footer">
          <span>${RL.esc(sourceText)}</span>
          ${url ? `<a href="${RL.esc(url)}" target="_blank" rel="noopener noreferrer">${linkText} &#8599;</a>` : ''}
        </div>
      </article>`;
  },

  _manualNewsItem(item) {
    const url = this._safeUrl(item.sourceLink);
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(item.title)}</div>
          <div class="list-item-sub">${RL.esc(item.topic || '\u624b\u52a8\u8bb0\u5f55')} ${item.eventDate ? `&middot; ${RL.esc(RL.fmtDate(item.eventDate))}` : ''}</div>
          ${item.summary ? `<div class="list-item-sub finance-manual-summary">${RL.esc(item.summary.slice(0, 160))}${item.summary.length > 160 ? '&hellip;' : ''}</div>` : ''}
          <div class="list-item-sub">\u6765\u6e90\uff1a${RL.esc(item.sourceName || '\u672a\u586b\u5199')}${url ? ` &middot; <a href="${RL.esc(url)}" target="_blank" rel="noopener noreferrer">\u6253\u5f00\u94fe\u63a5</a>` : ''}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="Finance.editItem('${item.id}')" aria-label="\u7f16\u8f91">&#9998;</button>
          <button class="icon-btn danger" onclick="Finance.delItem('${item.id}')" aria-label="\u5220\u9664">&#9003;</button>
        </div>
      </div>`;
  }
};
