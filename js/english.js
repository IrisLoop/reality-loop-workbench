/* ============================================
   Reality Loop — English Learning Module
   4 Parts: Speaking / Listening / Writing / Reading
   ============================================ */

const EnglishLearning = {
  parts: [
    { key: 'speaking', label: 'Speaking', subLabel: '口语', icon: '🗣️' },
    { key: 'listening', label: 'Listening', subLabel: '听力', icon: '🎧' },
    { key: 'writing', label: 'Writing', subLabel: '作文', icon: '✍️' },
    { key: 'reading', label: 'Reading', subLabel: '阅读', icon: '📖' }
  ],
  currentPart: 'speaking',
  currentView: 'materials', // materials | sessions

  async render() {
    const el = document.getElementById('dash-english-page');
    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">English Learning</div>
        <button class="header-action" onclick="EnglishLearning.showAddMaterial()">＋</button>
      </div>

      <!-- Part tabs -->
      <div style="padding:0 var(--space-md)">
        <div class="tab-bar" id="eng-part-tabs">
          ${this.parts.map(p => `
            <button class="tab-item ${this.currentPart===p.key?'active':''}"
                    onclick="EnglishLearning.switchPart('${p.key}')">${p.label}</button>
          `).join('')}
        </div>

        <!-- View toggle -->
        <div class="pill-toggle-group mt-sm" style="width:220px;margin-left:auto;margin-right:auto">
          <button class="pill-toggle ${this.currentView==='materials'?'active':''}"
                  onclick="EnglishLearning.switchView('materials')">资料</button>
          <button class="pill-toggle ${this.currentView==='sessions'?'active':''}"
                  onclick="EnglishLearning.switchView('sessions')">记录</button>
        </div>
      </div>
      <div id="eng-content"></div>
    `;
    this.renderContent();
  },

  switchPart(key) { this.currentPart = key; this.render(); },
  switchView(v) { this.currentView = v; this.render(); },

  async renderContent() {
    const c = document.getElementById('eng-content');
    if (this.currentView === 'materials') await this._renderMaterials(c);
    else await this._renderSessions(c);
  },

  async _renderMaterials(c) {
    const items = await DB.getAll('learningResources');
    const partItems = items.filter(i => i.category === `english-${this.currentPart}`);
    partItems.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const partInfo = this.parts.find(p => p.key === this.currentPart);

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = partItems.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">${partInfo?.icon||'📚'}</div>
        <div class="empty-text">${partInfo?.label||''} 暂无资料<br><small>点击右上角 ＋ 添加</small></div>
      </div></div>`
    : `<div class="card">${partItems.map(m => this._materialItem(m)).join('')}</div>`;
  },

  _materialItem(m) {
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${RL.esc(m.title)}</div>
          <div class="list-item-sub">${m.desc||''}</div>
          <div class="list-item-sub">状态: ${m.status||'未开始'} · ${RL.fmtDate(m.createdAt)}</div>
        </div>
        <div class="list-item-actions">
          ${m.videoLink?`<button class="icon-btn" onclick="window.open('${RL.esc(m.videoLink)}','_blank')" title="观看视频">▶️</button>`:''}
          ${m.sourceLink?`<button class="icon-btn" onclick="window.open('${RL.esc(m.sourceLink)}','_blank')" title="来源">🔗</button>`:''}
          <button class="icon-btn" onclick="EnglishLearning.editMaterial('${m.id}')">✏️</button>
          <button class="icon-btn danger" onclick="EnglishLearning.delMaterial('${m.id}')">🗑️</button>
        </div>
      </div>`;
  },

  async _renderSessions(c) {
    const sessions = await DB.getAll('learningSessions');
    const partSessions = sessions.filter(s => s.category === `english-${this.currentPart}`);
    partSessions.sort((a,b) => new Date(b.date) - new Date(a.date));
    const partInfo = this.parts.find(p => p.key === this.currentPart);

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = partSessions.length === 0 ? `
      <div class="card"><div class="empty-state">
        <div class="empty-icon">⏱️</div>
        <div class="empty-text">${partInfo?.label||''} 暂无学习记录</div>
      </div></div>`
    : `<div class="card">${partSessions.map(s => this._sessionRow(s)).join('')}</div>
       <div style="text-align:center;padding:12px">
         <button class="btn btn-outline btn-sm" onclick="EnglishLearning.showAddSession()">＋ 记录学习</button>
       </div>`;
  },

  _sessionRow(s) {
    return `
      <div class="list-item">
        <div class="list-item-body">
          <div class="list-item-title">${s.minutes} 分钟 · ${RL.fmtDate(s.date)}</div>
          <div class="list-item-sub">${s.notes ? RL.esc(s.notes) : ''}</div>
        </div>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="EnglishLearning.editSession('${s.id}')">✏️</button>
          <button class="icon-btn danger" onclick="EnglishLearning.delSession('${s.id}')">🗑️</button>
        </div>
      </div>`;
  },

  showAddMaterial() {
    const partInfo = this.parts.find(p => p.key === this.currentPart);
    RL.openModal(`
      <div class="modal-title">添加 ${partInfo?.label||''} 资料</div>
      <div class="form-group"><label class="form-label">标题 *</label><input id="em-title" placeholder="标题"></div>
      <div class="form-group"><label class="form-label">说明</label><textarea id="em-desc" placeholder="内容说明..."></textarea></div>
      <div class="form-group"><label class="form-label">状态</label><input id="em-status" placeholder="未开始/进行中/完成"></div>
      <div class="form-group"><label class="form-label">来源链接</label><input id="em-source" placeholder="https://..."></div>
      <div class="form-group"><label class="form-label">视频链接</label><input id="em-video" placeholder="https://..."></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="EnglishLearning.saveMaterial()" style="flex:1">保存</button>
      </div>
    `);
  },

  async saveMaterial() {
    const title = document.getElementById('em-title').value.trim();
    if (!title) { RL.toast('请输入标题'); return; }
    const now = RL.toISO(new Date());
    await DB.put('learningResources', {
      id: RL.uid(), title,
      desc: document.getElementById('em-desc').value.trim(),
      status: document.getElementById('em-status').value.trim(),
      sourceLink: document.getElementById('em-source').value.trim(),
      videoLink: document.getElementById('em-video').value.trim(),
      category: `english-${this.currentPart}`,
      createdAt: now, updatedAt: now
    });
    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  editMaterial(id) {
    DB.get('learningResources', id).then(m => {
      if (!m) return;
      this.showAddMaterial();
      this.currentPart = m.category.replace('english-', '');
      setTimeout(() => {
        document.getElementById('em-title').value=m.title||'';
        document.getElementById('em-desc').value=m.desc||'';
        document.getElementById('em-status').value=m.status||'';
        document.getElementById('em-source').value=m.sourceLink||'';
        document.getElementById('em-video').value=m.videoLink||'';
        const btn = document.querySelector('[onclick="EnglishLearning.saveMaterial()"]');
        if (btn) btn.setAttribute('onclick', `EnglishLearning.updateMaterial('${id}')`);
      }, 100);
    });
  },

  async updateMaterial(id) {
    const m = await DB.get('learningResources', id);
    if (!m) return;
    m.title=document.getElementById('em-title').value.trim(); if(!m.title){RL.toast('请输入标题');return;}
    m.desc=document.getElementById('em-desc').value.trim();
    m.status=document.getElementById('em-status').value.trim();
    m.sourceLink=document.getElementById('em-source').value.trim();
    m.videoLink=document.getElementById('em-video').value.trim();
    m.updatedAt=RL.toISO(new Date());
    await DB.put('learningResources',m);
    RL.closeModal(); RL.toast('已更新'); this.renderContent();
  },

  async delMaterial(id) {
    if (await RL.confirm('确定删除？')) { await DB.del('learningResources',id); RL.toast('已删除'); this.renderContent(); }
  },

  showAddSession(id=null) {
    RL.openModal(`
      <div class="modal-title">${id?'编辑':'新建'}学习记录</div>
      <div class="form-group"><label class="form-label">日期</label><input type="date" id="es-date" value="${RL.todayStr()}"></div>
      <div class="form-group"><label class="form-label">学习分钟数 *</label><input type="number" id="es-mins" placeholder="30" min="0" max="1440"></div>
      <div class="form-group"><label class="form-label">备注</label><textarea id="es-notes" placeholder="学习内容..."></textarea></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="EnglishLearning.saveSession('${id||''}')" style="flex:1">保存</button>
      </div>
    `);
    if (id) {
      DB.get('learningSessions', id).then(s => {
        if(s){document.getElementById('es-date').value=s.date||'';document.getElementById('es-mins').value=s.minutes||'';document.getElementById('es-notes').value=s.notes||'';}
      });
    }
  },

  async saveSession(id) {
    const v = RL.validateNonNeg(document.getElementById('es-mins').value, '分钟数');
    if (!v.ok) { RL.toast(v.error); return; }
    const now = RL.toISO(new Date());
    if (id) {
      const s = await DB.get('learningSessions', id);
      if (s) { s.date=document.getElementById('es-date').value; s.minutes=v.value; s.notes=document.getElementById('es-notes').value.trim(); s.updatedAt=now; await DB.put('learningSessions',s); }
    } else {
      await DB.put('learningSessions', { id:RL.uid(), date:document.getElementById('es-date').value, minutes:v.value, notes:document.getElementById('es-notes').value.trim(), category:`english-${this.currentPart}`, createdAt:now, updatedAt:now });
    }
    RL.closeModal(); RL.toast(id?'已更新':'已保存'); this.renderContent();
  },

  editSession(id) { this.showAddSession(id); },
  async delSession(id) { if(await RL.confirm('确定删除？')){await DB.del('learningSessions',id);RL.toast('已删除');this.renderContent();} }
};
