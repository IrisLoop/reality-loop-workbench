/* ============================================
   Reality Loop — Fat Loss Module
   Weight tracking, food logs, kcal sum
   Unit: kg ↔ 斤 conversion
   ============================================ */

const FatLoss = {
  currentView: 'overview', // overview | weight | food

  async render() {
    const el = document.getElementById('dash-fatloss-page');
    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">减脂</div>
        <button class="header-action" onclick="FatLoss.showQuickAdd()" aria-label="Add record">&#65291;</button>
      </div>
      <div style="padding:0 var(--space-md)">
        <div class="pill-toggle-group">
          <button class="pill-toggle ${this.currentView==='overview'?'active':''}" onclick="FatLoss.switchView('overview')">概览</button>
          <button class="pill-toggle ${this.currentView==='weight'?'active':''}" onclick="FatLoss.switchView('weight')">体重</button>
          <button class="pill-toggle ${this.currentView==='food'?'active':''}" onclick="FatLoss.switchView('food')">饮食</button>
        </div>
      </div>
      <div id="fatloss-content"></div>
    `;
    this.renderContent();
  },
  showQuickAdd() {
    if (this.currentView === 'food') this.showAddFood();
    else this.showAddWeight();
  },

  switchView(v) { this.currentView = v; this.render(); },

  async renderContent() {
    const c = document.getElementById('fatloss-content');
    switch(this.currentView) {
      case 'overview': await this._renderOverview(c); break;
      case 'weight': await this._renderWeight(c); break;
      case 'food': await this._renderFood(c); break;
    }
  },

  async _renderOverview(c) {
    const unit = await DB.getSetting('weightUnit', 'kg');
    const initW = await DB.getSetting('initialWeight', null);
    const targetW = await DB.getSetting('targetWeight', null);
    const allLogs = await DB.getAll('weightLogs');
    allLogs.sort((a,b) => new Date(b.date) - new Date(a.date));

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = `
      <!-- Profile Card -->
      <div class="card">
        <div class="card-header"><span class="card-title">目标设置</span>
          <button class="btn btn-sm btn-outline" onclick="FatLoss.showProfileEdit()">编辑</button>
        </div>
        <div style="display:flex;gap:16px;margin-top:8px">
          <div style="flex:1">
            <div class="summary-label">初始体重</div>
            <div class="summary-value">${initW ? `${initW} ${unit}` : '未设置'}</div>
          </div>
          <div style="flex:1">
            <div class="summary-label">目标体重</div>
            <div class="summary-value">${targetW ? `${targetW} ${unit}` : '未设置'}</div>
          </div>
        </div>
        <div class="mt-sm">
          <span class="summary-label">单位：</span>
          <span style="font-weight:600">${unit}</span>
          <button class="btn btn-sm btn-outline ml-sm" onclick="FatLoss.toggleUnit()">切换</button>
        </div>
      </div>

      <!-- Latest weight -->
      <div class="card">
        <div class="card-title">最新记录</div>
        ${allLogs.length > 0 ? `
          <div style="margin-top:8px">
            <div class="summary-value">${allLogs[0].weight} ${unit}</div>
            <div class="summary-label">${RL.fmtDate(allLogs[0].date)}${allLogs[0].notes ? ' · '+RL.esc(allLogs[0].notes) : ''}</div>
          </div>
          <div class="mt-sm text-secondary" style="font-size:var(--fs-xs)">共 ${allLogs.length} 条记录</div>
        ` : `
          <div class="empty-state" style="padding:24px 0">
            <div class="empty-text">暂无体重记录</div>
          </div>
        `}
      </div>

      <!-- Today's food summary -->
      ${await this._todayFoodSummary()}
    `;
  },

  async _todayFoodSummary() {
    const todayFoods = await DB.getByIndex('foodLogs', 'date', RL.todayStr());
    const totalKcal = todayFoods.reduce((s,f) => s + (parseFloat(f.kcal)||0), 0);
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">今日饮食</span>
          <span class="badge ${totalKcal>0?'badge-default':''}">${totalKcal} kcal</span>
        </div>
        ${todayFoods.length > 0 ? todayFoods.slice(0,5).map(f => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:var(--fs-sm);border-bottom:1px solid var(--border-light)">
            <span>${RL.esc(f.name)} <span style="color:var(--text-tertiary);font-size:var(--fs-xs)">(${f.meal||'—'})</span></span>
            <span>${f.kcal} kcal</span>
          </div>
        `).join('') + (todayFoods.length > 5 ? `<div style="text-align:center;color:var(--text-tertiary);font-size:var(--fs-xs);padding-top:4px">还有 ${todayFoods.length-5} 条...</div>`:'')
        : '<div class="empty-state" style="padding:16px 0"><div class="empty-text" style="font-size:var(--fs-sm)">今天还没有饮食记录</div></div>'}
      </div>`;
  },

  async _renderWeight(c) {
    const unit = await DB.getSetting('weightUnit', 'kg');
    const logs = await DB.getAll('weightLogs');
    logs.sort((a,b) => new Date(b.date) - new Date(a.date));

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = `
      <div style="padding:0 var(--space-md) var(--space-sm)" style="display:flex;gap:8px">
        <button class="btn btn-primary btn-block btn-sm" onclick="FatLoss.showAddWeight()">＋ 记录体重</button>
      </div>
      <div class="card">
        ${logs.length === 0 ? `
          <div class="empty-state"><div class="empty-icon">⚖️</div><div class="empty-text">暂无记录</div></div>
        ` : logs.map(l => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${l.weight} ${unit}</div>
              <div class="list-item-sub">${RL.fmtDate(l.date)}${l.notes ? ' · '+RL.esc(l.notes):''}</div>
            </div>
            <div class="list-item-actions">
              <button class="icon-btn" onclick="FatLoss.editWeight('${l.id}')">✏️</button>
              <button class="icon-btn danger" onclick="FatLoss.delWeight('${l.id}')">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async _renderFood(c) {
    const logs = await DB.getAll('foodLogs');
    logs.sort((a,b) => new Date(b.date) - new Date(a.date));

    c.style.padding = '0 var(--space-md)';
    c.innerHTML = `
      <div style="padding:0 var(--space-md) var(--space-sm)">
        <button class="btn btn-primary btn-block btn-sm" onclick="FatLoss.showAddFood()">＋ 记录饮食</button>
      </div>
      <div class="card">
        ${logs.length === 0 ? `
          <div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">暂无饮食记录</div></div>
        ` : logs.map(f => `
          <div class="list-item">
            <div class="list-item-body">
              <div class="list-item-title">${RL.esc(f.name)} <span class="badge badge-default">${f.kcal} kcal</span></div>
              <div class="list-item-sub">${f.meal||'—'} · ${RL.fmtDate(f.date)}${f.notes?' · '+RL.esc(f.notes):''}</div>
            </div>
            <div class="list-item-actions">
              <button class="icon-btn" onclick="FatLoss.editFood('${f.id}')">✏️</button>
              <button class="icon-btn danger" onclick="FatLoss.delFood('${f.id}')">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  /* ── Profile Edit ── */
  showProfileEdit() {
    Promise.all([
      DB.getSetting('initialWeight',''),
      DB.getSetting('targetWeight',''),
      DB.getSetting('weightUnit','kg')
    ]).then(([init,target,unit]) => {
      RL.openModal(`
        <div class="modal-title">目标设置</div>
        <div class="form-group"><label class="form-label">初始体重 (${unit})</label>
          <input id="fp-init" type="number" step="0.1" value="${init||''}" placeholder="如 65">
        </div>
        <div class="form-group"><label class="form-label">目标体重 (${unit})</label>
          <input id="fp-target" type="number" step="0.1" value="${target||''}" placeholder="如 55">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
          <button class="btn btn-primary" onclick="FatLoss.saveProfile()" style="flex:1">保存</button>
        </div>
      `);
    });
  },

  async saveProfile() {
    const initV = document.getElementById('fp-init').value.trim();
    const targetV = document.getElementById('fp-target').value.trim();

    if (initV) { const v = RL.validatePositive(initV,'初始体重'); if(!v.ok){RL.toast(v.error);return;} await DB.setSetting('initialWeight',v.value); }
    if (targetV) { const v = RL.validatePositive(targetV,'目标体重'); if(!v.ok){RL.toast(v.error);return;} await DB.setSetting('targetWeight',v.value); }

    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  async toggleUnit() {
    const cur = await DB.getSetting('weightUnit', 'kg');
    const next = cur === 'kg' ? 'jin' : 'kg';
    await DB.setSetting('weightUnit', next);
    RL.toast(`已切换为 ${next}`);
    this.renderContent();
  },

  /* ── Weight CRUD ── */
  showAddWeight(id=null) {
    RL.openModal(`
      <div class="modal-title">${id?'编辑':'记录'}体重</div>
      <div class="form-group"><label class="form-label">日期</label><input type="date" id="fw-date" value="${RL.todayStr()}"></div>
      <div class="form-group"><label class="form-label">体重 *</label><input type="number" step="0.1" id="fw-weight" placeholder="如 63.5"></div>
      <div class="form-group"><label class="form-label">备注</label><input id="fw-notes" placeholder="可选"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="FatLoss.saveWeight('${id||''}')" style="flex:1">保存</button>
      </div>
    `);
    if (id) {
      DB.get('weightLogs',id).then(w=>{if(w){document.getElementById('fw-date').value=w.date||'';document.getElementById('fw-weight').value=w.weight||'';document.getElementById('fw-notes').value=w.notes||'';}});
    }
  },

  async saveWeight(id) {
    const v = RL.validatePositive(document.getElementById('fw-weight').value, '体重');
    if (!v.ok) { RL.toast(v.error); return; }
    const now = RL.toISO(new Date());
    if (id) {
      const w = await DB.get('weightLogs', id);
      if (w) { w.date=document.getElementById('fw-date').value; w.weight=v.value; w.notes=document.getElementById('fw-notes').value.trim(); w.updatedAt=now; await DB.put('weightLogs',w); }
    } else {
      await DB.put('weightLogs',{id:RL.uid(),date:document.getElementById('fw-date').value,weight:v.value,notes:document.getElementById('fw-notes').value.trim(),createdAt:now,updatedAt:now});
    }
    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  editWeight(id) { this.showAddWeight(id); },
  async delWeight(id) { if(await RL.confirm('确定删除？')){await DB.del('weightLogs',id);RL.toast('已删除');this.renderContent();}},

  /* ── Food CRUD ── */
  showAddFood(id=null) {
    RL.openModal(`
      <div class="modal-title">${id?'编辑':'记录'}饮食</div>
      <div class="form-group"><label class="form-label">食物名称 *</label><input id="ff-name" placeholder="如：鸡胸肉沙拉"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">餐次</label>
          <select id="ff-meal"><option value="早餐">早餐</option><option value="午餐">午餐</option><option value="晚餐">晚餐</option><option value="加餐">加餐</option></select>
        </div>
        <div class="form-group"><label class="form-label">热量 (kcal)</label><input type="number" id="ff-kcal" min="0" placeholder="350"></div>
      </div>
      <div class="form-group"><label class="form-label">日期</label><input type="date" id="ff-date" value="${RL.todayStr()}"></div>
      <div class="form-group"><label class="form-label">备注</label><input id="ff-notes" placeholder="可选"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="FatLoss.saveFood('${id||''}')" style="flex:1">保存</button>
      </div>
    `);
    if (id) {
      DB.get('foodLogs',id).then(f=>{if(f){document.getElementById('ff-name').value=f.name||'';document.getElementById('ff-meal').value=f.meal||'早餐';document.getElementById('ff-kcal').value=f.kcal||'';document.getElementById('ff-date').value=f.date||'';document.getElementById('ff-notes').value=f.notes||'';}});
    }
  },

  async saveFood(id) {
    const name = document.getElementById('ff-name').value.trim();
    if (!name) { RL.toast('请输入食物名称'); return; }
    const kcalV = RL.validateNonNeg(document.getElementById('ff-kcal').value, '热量');
    if (!kcalV.ok) { RL.toast(kcalV.error); return; }
    const now = RL.toISO(new Date());
    if (id) {
      const f = await DB.get('foodLogs', id);
      if (f) { f.name=name; f.meal=document.getElementById('ff-meal').value; f.kcal=kcalV.value; f.date=document.getElementById('ff-date').value; f.notes=document.getElementById('ff-notes').value.trim(); f.updatedAt=now; await DB.put('foodLogs',f); }
    } else {
      await DB.put('foodLogs',{id:RL.uid(),name,meal:document.getElementById('ff-meal').value,kcal:kcalV.value,date:document.getElementById('ff-date').value,notes:document.getElementById('ff-notes').value.trim(),createdAt:now,updatedAt:now});
    }
    RL.closeModal(); RL.toast('已保存'); this.renderContent();
  },

  editFood(id) { this.showAddFood(id); },
  async delFood(id) { if(await RL.confirm('确定删除？')){await DB.del('foodLogs',id);RL.toast('已删除');this.renderContent();}}
};
