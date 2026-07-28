/* ============================================
   Reality Loop v2 — Diary Module
   Book-page feel: serif dates/titles,
   sans body text, 1.7 line-height
   ============================================ */

const Diary = {
  currentEntryId: null,
  saveTimer: null,

  async renderList() {
    const listEl = document.getElementById('diary-list-view');
    const editorEl = document.getElementById('diary-editor-view');
    listEl.classList.remove('hidden');
    editorEl.classList.add('hidden');

    const entries = await DB.getAll('diaryEntries');
    entries.sort((a,b) => new Date(b.date) - new Date(a.date));

    listEl.innerHTML = `
      <div class="page-header">
        <div class="page-title">Diary</div>
        <button class="header-action" onclick="Diary.createEntry()" aria-label="New entry">✏</button>
      </div>

      <!-- Date filter -->
      <div style="padding:0 var(--page-x) 12px">
        <input type="date" id="diary-filter" placeholder="按日期筛选"
               style="font-size:var(--fs-caption);padding:9px 13px;border-radius:10px">
      </div>

      <div id="diary-list" style="padding:0 var(--page-x)">
        ${entries.length === 0 ? `
          <div class="card"><div class="empty-state">
            <div class="empty-icon"><img src="icons/06-diary-empty.png" alt="" draggable="false"></div>
            <div class="empty-text">还没有日记<br><small>点击右上角 ✏ 开始写</small></div>
          </div></div>
        ` : entries.map(e => this._listItem(e)).join('')}
      </div>
    `;

    document.getElementById('diary-filter')?.addEventListener('change', e => {
      this._filterList(e.target.value);
    });
  },

  _listItem(e) {
    const preview = (e.content||'').replace(/<[^>]+>/g,'').slice(0,100);
    return `
      <div class="diary-list-item" onclick="Diary.openEntry('${e.id}')">
        <div class="diary-list-date">${RL.fmtDate(e.date, 'long')}</div>
        <div class="diary-list-title">${RL.esc(e.title||'无标题')}</div>
        <div class="diary-list-preview">${RL.esc(preview)}${preview.length>=100?'...':''}</div>
      </div>`;
  },

  _filterList(dateStr) {
    DB.getAll('diaryEntries').then(entries => {
      let filtered = entries.sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(dateStr) filtered=filtered.filter(e=>e.date===dateStr);
      const c=document.getElementById('diary-list');
      c.innerHTML=filtered.length===0?`
        <div class="card"><div class="empty-state"><div class="empty-text">该日期没有日记</div></div></div>`
        :filtered.map(e=>this._listItem(e)).join('');
    });
  },

  createEntry() { this.currentEntryId=null; this.showEditor(); },
  async openEntry(id) { this.currentEntryId=id; this.showEditor(); },

  showEditor() {
    document.getElementById('diary-list-view').classList.add('hidden');
    const editorEl=document.getElementById('diary-editor-view');
    editorEl.classList.remove('hidden');

    const isNew=!this.currentEntryId;
    editorEl.innerHTML=`
      <div class="subpage-header">
        <button class="back-btn" onclick="Diary.renderList()">‹</button>
        <div class="subpage-title">${isNew?'新建日记':'编辑日记'}</div>
      </div>
      <div style="padding:0 var(--page-x)">
        <input id="diary-title" class="diary-title-input"
               placeholder="标题（可选）" value="">
        <div class="diary-date-display">${RL.fmtDate(new Date(),'long')}</div>
        <div style="margin-bottom:2px">
          <input type="date" id="diary-date" value="${RL.todayStr()}"
                 style="font-size:var(--fs-tiny);padding:7px 12px">
        </div>
        <textarea id="diary-content" class="diary-editor"
                  placeholder="写下今天的故事..." style="min-height:320px"></textarea>
        <div class="save-indicator" id="diary-save-status"></div>
        <div style="display:flex;gap:8px;margin-top:18px">
          ${this.currentEntryId?`<button class="btn btn-danger btn-sm" onclick="Diary.deleteEntry()">删除</button>`:''}
          <div style="flex:1"></div>
          <button class="btn btn-primary" onclick="Diary.saveEntry()">保存</button>
        </div>
      </div>
    `;

    if(this.currentEntryId){
      DB.get('diaryEntries',this.currentEntryId).then(entry=>{
        if(entry){
          document.getElementById('diary-title').value=entry.title||'';
          document.getElementById('diary-date').value=entry.date||'';
          document.getElementById('diary-content').value=entry.content||'';
        }
      });
    }

    document.getElementById('diary-content')?.addEventListener('input',
      RL.debounce(()=>this.autoSave(),1500)
    );
  },

  async autoSave(){
    const el=document.getElementById('diary-save-status'); if(!el)return;
    el.className='save-indicator saving'; el.textContent='保存中...';
    try{await this._doSave();el.className='save-indicator saved';el.textContent='✓ 已自动保存';
      setTimeout(()=>{if(el.textContent.includes('自动'))el.textContent='';},3000);}
    catch(e){el.className='save-indicator error';el.textContent='✗ 保存失败';}
  },

  async saveEntry(){
    try{await this._doSave(); RL.toast('已保存'); this.renderList();}
    catch(e){RL.toast('保存失败: '+e.message);}
  },

  async _doSave(){
    const title=document.getElementById('diary-title')?.value.trim()||'';
    const date=document.getElementById('diary-date')?.value||RL.todayStr();
    const content=document.getElementById('diary-content')?.value||'';
    const now=RL.toISO(new Date());
    if(!this.currentEntryId){
      this.currentEntryId=RL.uid();
      await DB.put('diaryEntries',{id:this.currentEntryId,title,date,content,createdAt:now,updatedAt:now});
    }else{
      const entry=await DB.get('diaryEntries',this.currentEntryId);
      if(entry){entry.title=title;entry.date=date;entry.content=content;entry.updatedAt=now;
        await DB.put('diaryEntries',entry);}
    }
  },

  async deleteEntry(){
    if(!this.currentEntryId)return;
    if(await RL.confirm('确定删除这篇日记吗？此操作不可恢复。')){
      await DB.del('diaryEntries',this.currentEntryId); RL.toast('已删除'); this.renderList();
    }
  }
};
