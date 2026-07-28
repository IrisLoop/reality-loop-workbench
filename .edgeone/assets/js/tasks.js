/* ============================================
   Reality Loop — Daily Plan / Todos Module
   CRUD, progress tracking, date switching
   ============================================ */

const Tasks = {
  currentDate: null,

  async render() {
    this.currentDate = RL.todayStr();
    const el = document.getElementById('dash-tasks-page');
    el.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Dashboard.renderHome()">‹</button>
        <div class="subpage-title">每日计划</div>
        <button class="header-action" onclick="Tasks.showAdd()">＋</button>
      </div>
      <div id="tasks-content"></div>
    `;
    await this.renderList();
  },

  async renderList() {
    const container = document.getElementById('tasks-content');
    if (!container) return;

    const tasks = await DB.getByIndex('tasks', 'date', this.currentDate);
    const doneCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;

    container.innerHTML = `
      <!-- Date selector -->
      <div style="padding:0 var(--space-md) var(--space-sm)">
        <div class="card" style="padding:12px 16px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <button class="icon-btn" onclick="Tasks.shiftDate(-1)">‹</button>
            <span style="font-weight:600;font-size:var(--fs-md)">${RL.fmtDate(this.currentDate, 'long')}</span>
            <button class="icon-btn" onclick="Tasks.shiftDate(1)">›</button>
          </div>
          <div class="mt-sm" style="text-align:center">
            <span style="font-size:var(--fs-xs);color:var(--text-secondary)">
              完成进度：${doneCount}/${totalCount}
            </span>
            <span class="ml-sm" style="font-weight:bold;color:var(--text-primary)">${pct}%</span>
          </div>
        </div>
      </div>

      <!-- Task list -->
      <div style="padding:0 var(--space-md)">
        <div class="card">
          ${totalCount === 0 ? `
            <div class="empty-state" style="padding:40px 0">
              <div class="empty-icon">📝</div>
              <div class="empty-text">今天还没有待办<br><small>点击右上角 ＋ 添加</small></div>
            </div>
          ` : tasks.map(t => this._taskItem(t)).join('')}
        </div>
      </div>
    `;
  },

  _taskItem(t) {
    return `
      <div class="todo-item" data-id="${t.id}">
        <div class="todo-check ${t.completed ? 'checked' : ''}"
             onclick="Tasks.toggle('${t.id}')"></div>
        <div class="todo-body">
          <div class="todo-title ${t.completed ? 'done' : ''}">${RL.esc(t.title)}</div>
          <div class="todo-meta">
            ${t.completed && t.completedAt ? `完成于 ${RL.fmtTime(t.completedAt)}` : `添加于 ${RL.fmtTime(t.createdAt)}`}
          </div>
        </div>
        <span class="todo-status">${t.completed ? '已完成' : '待办'}</span>
        <div class="list-item-actions">
          <button class="icon-btn" onclick="Tasks.edit('${t.id}')" title="编辑">✏️</button>
          <button class="icon-btn danger" onclick="Tasks.remove('${t.id}')" title="删除">🗑️</button>
        </div>
      </div>`;
  },

  shiftDate(days) {
    const d = new Date(this.currentDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    this.currentDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    this.renderList();
  },

  showAdd(id = null) {
    const isEdit = !!id;
    RL.openModal(`
      <div class="modal-title">${isEdit ? '编辑待办' : '新建待办'}</div>
      <div class="form-group">
        <label class="form-label">标题 *</label>
        <input id="task-title-input" placeholder="待办事项..." ${isEdit ? '' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input type="date" id="task-date-input" value="${this.currentDate}">
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="Tasks.save('${id||''}')" style="flex:1">${isEdit ? '保存' : '添加'}</button>
      </div>
    `);

    if (isEdit) {
      DB.get('tasks', id).then(t => {
        if (t) {
          document.getElementById('task-title-input').value = t.title;
          document.getElementById('task-date-input').value = t.date;
        }
      });
    }
  },

  async save(id) {
    const title = document.getElementById('task-title-input').value.trim();
    const date = document.getElementById('task-date-input').value || this.currentDate;

    if (!title) { RL.toast('请输入标题'); return; }

    const now = RL.toISO(new Date());

    if (id) {
      const task = await DB.get('tasks', id);
      if (task) {
        task.title = title;
        task.date = date;
        task.updatedAt = now;
        await DB.put('tasks', task);
      }
    } else {
      await DB.put('tasks', {
        id: RL.uid(),
        title,
        date,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now
      });
    }

    RL.closeModal();
    RL.toast(id ? '已更新' : '已添加');
    this.renderList();
  },

  async toggle(id) {
    const task = await DB.get('tasks', id);
    if (!task) return;
    const now = RL.toISO(new Date());
    task.completed = !task.completed;
    task.completedAt = task.completed ? now : null;
    task.updatedAt = now;
    await DB.put('tasks', task);
    this.renderList();
  },

  edit(id) { this.showAdd(id); },

  async remove(id) {
    if (await RL.confirm('确定删除这条待办吗？')) {
      await DB.del('tasks', id);
      RL.toast('已删除');
      this.renderList();
    }
  }
};
