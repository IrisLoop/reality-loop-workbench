/* ============================================
   Reality Loop — Chats Module
   Session management, message history,
   data scope control, local retrieval mode,
   pluggable provider interface
   ============================================ */

const Chats = {
  currentSessionId: null,
  scopes: ['none', 'dashboard', 'diary', 'all'],
  scopeLabels: { none:'不使用个人数据', dashboard:'仅 Dashboard', diary:'仅 Diary', all:'Dashboard + Diary' },
  currentScope: 'none',

  async renderList() {
    const listEl = document.getElementById('chats-list-view');
    const detailEl = document.getElementById('chats-detail-view');
    listEl.classList.remove('hidden');
    detailEl.classList.add('hidden');

    const sessions = await DB.getAll('chatSessions');
    sessions.sort((a,b) => new Date(b.lastActive || b.createdAt) - new Date(a.lastActive || a.createdAt));

    listEl.innerHTML = `
      <div class="page-header">
        <div class="page-title">Chats</div>
        <button class="header-action" onclick="Chats.createSession()">＋</button>
      </div>
      <div id="chats-list-content" style="padding:0 var(--page-x)">
        ${sessions.length === 0 ? `
          <div class="card"><div class="empty-state">
            <div class="empty-icon"><img src="icons/07-chats-empty.png" alt="" draggable="false"></div>
            <div class="empty-text">暂无对话<br><small>点击右上角 ＋ 新建</small></div>
          </div></div>
        ` : sessions.map(s => this._sessionCard(s)).join('')}
      </div>
    `;
  },

  _sessionCard(s) {
    const msgCount = s.messageCount || 0;
    return `
      <div class="chat-session-card" onclick="Chats.openSession('${s.id}')">
        <div class="module-info">
          <div class="module-name">${RL.esc(s.title || '新对话')}</div>
          <div class="module-hint">
            ${s.scopeLabel || this.scopeLabels[s.scope]||'—'} · ${msgCount} 条消息 · ${RL.fmtDate(s.lastActive||s.createdAt)}
          </div>
        </div>
        <div class="module-arrow">›</div>
      </div>`;
  },

  createSession() {
    // Show session creation with scope selection
    RL.openModal(`
      <div class="modal-title">新建对话</div>
      <div class="form-group">
        <label class="form-label">对话标题（可选）</label>
        <input id="chat-new-title" placeholder="如：今日总结">
      </div>
      <div class="form-group">
        <label class="form-label">数据范围 *</label>
        <div class="chat-scope-bar" style="flex-wrap:wrap">
          ${this.scopes.map(sc => `
            <span class="scope-chip ${sc==='none'?'active':''}" data-scope="${sc}" onclick="Chats.selectScope(this)">${this.scopeLabels[sc]}</span>
          `).join('')}
        </div>
      </div>
      <p style="font-size:var(--fs-xs);color:var(--text-tertiary);margin-top:8px">
        选择 AI 回答时可访问的数据范围。Diary 默认不勾选。
      </p>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="Chats.confirmCreate()" style="flex:1">开始</button>
      </div>
    `);
    window._selectedScope = 'none';
  },

  selectScope(el) {
    document.querySelectorAll('.scope-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    window._selectedScope = el.dataset.scope;
  },

  async confirmCreate() {
    const title = document.getElementById('chat-new-title').value.trim() || '新对话';
    const scope = window._selectedScope || 'none';
    const now = RL.toISO(new Date());

    const session = {
      id: RL.uid(),
      title,
      scope,
      scopeLabel: this.scopeLabels[scope],
      messageCount: 0,
      createdAt: now,
      lastActive: now
    };

    await DB.put('chatSessions', session);
    RL.closeModal();
    this.openSession(session.id);
  },

  async openSession(id) {
    this.currentSessionId = id;
    const session = await DB.get('chatSessions', id);
    if (!session) { RL.toast('会话不存在'); return; }

    this.currentScope = session.scope || 'none';

    const listEl = document.getElementById('chats-list-view');
    const detailEl = document.getElementById('chats-detail-view');
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');

    const messages = await DB.getByIndex('chatMessages', 'sessionId', id);

    detailEl.innerHTML = `
      <div class="subpage-header">
        <button class="back-btn" onclick="Chats.renderList()">‹</button>
        <div class="subpage-title" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${RL.esc(session.title)}</div>
        <button class="icon-btn danger" onclick="Chats.deleteSession('${id}')">🗑️</button>
      </div>

      <!-- Scope bar -->
      <div style="padding:4px var(--space-md) 0">
        <div class="chat-scope-bar">
          ${this.scopes.map(sc => `
            <span class="scope-chip ${sc===this.currentScope?'active':''}"
                  data-scope="${sc}"
                  onclick="Chats.changeScope('${sc}')">${this.scopeLabels[sc]}</span>
          `).join('')}
        </div>
      </div>

      <!-- Messages -->
      <div id="chat-messages" style="padding:12px var(--page-x);min-height:200px;max-height:calc(100dvh - 280px);overflow-y:auto">
        ${messages.length === 0 ? `
          <div class="empty-state" style="padding:40px 0">
            <div class="empty-text">开始一段对话吧<br><small style="color:var(--text-tertiary)">当前模式：本地检索</small></div>
          </div>
        ` : messages.map(m => this._msgBubble(m)).join('')}
      </div>

      <!-- Input -->
      <div style="position:sticky;bottom:0;background:var(--bg-page);padding:8px var(--page-x) calc(var(--nav-height) + 8px)">
        <div class="chat-input-area">
          <input id="chat-input" placeholder="输入消息..." autocomplete="off">
          <button class="chat-send-btn" onclick="Chats.sendMessage()">↑</button>
        </div>
      </div>
    `;

    // Scroll to bottom
    const msgContainer = document.getElementById('chat-messages');
    if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;

    // Enter key to send
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
  },

  _escapeMarkdownHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  },

  _renderMarkdownInline(value) {
    const tokens = [];
    const saveToken = html => '\uE000' + (tokens.push(html) - 1) + '\uE001';
    let text = String(value ?? '');

    text = text.replace(/`([^`\n]+)`/g, (match, code) =>
      saveToken('<code>' + this._escapeMarkdownHTML(code) + '</code>')
    );

    text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi, (match, label, href) => {
      try {
        const url = new URL(href);
        if (!['http:', 'https:'].includes(url.protocol)) return match;
        return saveToken(
          '<a href="' + this._escapeMarkdownHTML(url.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          this._escapeMarkdownHTML(label) + '</a>'
        );
      } catch {
        return match;
      }
    });

    text = this._escapeMarkdownHTML(text);
    text = text
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
      .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,!?;:)]?)/g, '$1<em>$2</em>');

    return text.replace(/\uE000(\d+)\uE001/g, (match, index) =>
      tokens[Number(index)] ?? ''
    );
  },

  renderMarkdown(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let listType = null;
    let inFence = false;
    let fenceLanguage = '';
    let codeLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push('<p>' + paragraph.map(line => this._renderMarkdownInline(line)).join('<br>') + '</p>');
      paragraph = [];
    };

    const closeList = () => {
      if (!listType) return;
      html.push('</' + listType + '>');
      listType = null;
    };

    const openList = type => {
      if (listType === type) return;
      closeList();
      listType = type;
      html.push('<' + type + '>');
    };

    for (const line of lines) {
      const fence = line.match(/^\s*```\s*([\w-]*)\s*$/);
      if (fence) {
        flushParagraph();
        closeList();
        if (inFence) {
          const languageClass = fenceLanguage
            ? ' class="language-' + this._escapeMarkdownHTML(fenceLanguage) + '"'
            : '';
          html.push('<pre><code' + languageClass + '>' +
            this._escapeMarkdownHTML(codeLines.join('\n')) + '</code></pre>');
          inFence = false;
          fenceLanguage = '';
          codeLines = [];
        } else {
          inFence = true;
          fenceLanguage = fence[1] || '';
        }
        continue;
      }

      if (inFence) {
        codeLines.push(line);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        closeList();
        continue;
      }

      const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        const level = heading[1].length;
        html.push('<h' + level + '>' + this._renderMarkdownInline(heading[2]) + '</h' + level + '>');
        continue;
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushParagraph();
        closeList();
        html.push('<hr>');
        continue;
      }

      const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const type = ordered ? 'ol' : 'ul';
        openList(type);
        html.push('<li>' + this._renderMarkdownInline((ordered || unordered)[1]) + '</li>');
        continue;
      }

      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        html.push('<blockquote>' + this._renderMarkdownInline(quote[1]) + '</blockquote>');
        continue;
      }

      closeList();
      paragraph.push(line);
    }

    if (inFence) {
      html.push('<pre><code>' + this._escapeMarkdownHTML(codeLines.join('\n')) + '</code></pre>');
    }
    flushParagraph();
    closeList();
    return html.join('');
  },

  _cleanAssistantContent(value) {
    return String(value ?? '')
      .replace(/^\s*\[DeepSeek AI\]\s*/i, '')
      .replace(/\s*⚠️\s*以上由\s*AI\s*生成，?\s*请结合个人记录判断，?\s*不构成专业建议。?\s*$/u, '')
      .trim();
  },

  _msgBubble(m) {
    const isUser = m.role === 'user';
    const content = isUser
      ? RL.esc(m.content)
      : this.renderMarkdown(this._cleanAssistantContent(m.content));
    return '<div class="chat-bubble ' + (isUser ? 'user' : 'ai') + '">' + content + '</div>';
  },

  changeScope(scope) {
    this.currentScope = scope;
    // Update UI
    document.querySelectorAll('#chats-detail-view .scope-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.scope === scope);
    });

    // Persist scope change to session
    if (this.currentSessionId) {
      DB.get('chatSessions', this.currentSessionId).then(s => {
        if (s) { s.scope = scope; s.scopeLabel = this.scopeLabels[scope]; DB.put('chatSessions', s); }
      });
    }

    RL.toast(`数据范围已切换为：${this.scopeLabels[scope]}`);
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const now = RL.toISO(new Date());

    // Save user message
    const userMsg = {
      id: RL.uid(),
      sessionId: this.currentSessionId,
      role: 'user',
      content: text,
      createdAt: now
    };
    await DB.put('chatMessages', userMsg);

    // Clear input
    input.value = '';

    // Update session
    if (this.currentSessionId) {
      const s = await DB.get('chatSessions', this.currentSessionId);
      if (s) { s.lastActive = now; s.messageCount = (s.messageCount||0)+1; await DB.put('chatSessions', s); }
    }

    // Re-render messages and show response
    await this._renderAndRespond(text);
  },

  async _renderAndRespond(userText) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Add user bubble
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user';
    userBubble.textContent = userText;
    container.appendChild(userBubble);

    // Show typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-bubble ai';
    typing.innerHTML = '<span style="color:var(--text-tertiary)">思考中...</span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    // Use ChatProvider (local or AI)
    let response;
    try {
      response = await ChatProvider.chat(userText, this.currentScope);
    } catch(e) {
      response = `[错误]\n\n${e.message}\n\n${await this._localRetrieve(userText)}`;
    }

    // Remove typing, add response
    typing.remove();

    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble ai';
    aiBubble.innerHTML = this.renderMarkdown(this._cleanAssistantContent(response));
    container.appendChild(aiBubble);
    container.scrollTop = container.scrollHeight;

    // Save AI response
    const now = RL.toISO(new Date());
    const aiMsg = {
      id: RL.uid(),
      sessionId: this.currentSessionId,
      role: 'assistant',
      content: response,
      source: 'local-retrieval',
      scope: this.currentScope,
      createdAt: now
    };
    await DB.put('chatMessages', aiMsg);

    // Update session
    if (this.currentSessionId) {
      const s = await DB.get('chatSessions', this.currentSessionId);
      if (s) { s.lastActive = now; s.messageCount = (s.messageCount||0)+1; await DB.put('chatSessions', s); }
    }
  },

  async _localRetrieve(query) {
    const q = query.toLowerCase().trim();

    switch(this.currentScope) {
      case 'dashboard': return await this._searchDashboard(q);
      case 'diary': return await this._searchDiary(q);
      case 'all': return await this._searchAll(q);
      case 'none':
      default:
        return `[本地检索模式]\n\n现有记录中没有足够信息来回答「${query}」。\n\n如需使用个人数据，请在上方切换数据范围。当前设置为「不使用个人数据」。`;
    }
  },

  async _searchDashboard(q) {
    const results = [];

    // Search tasks
    const tasks = await DB.getByIndex('tasks', 'date', RL.todayStr());
    tasks.filter(t => t.title.toLowerCase().includes(q))
      .forEach(t => results.push(`待办: "${t.title}" (${t.completed?'已完成':'待办'})`));

    // Search weight logs
    const wLogs = await DB.getAll('weightLogs');
    wLogs.filter(l => (l.notes||'').toLowerCase().includes(q))
      .forEach(l => results.push(`体重记录: ${l.weight}kg (${RL.fmtDate(l.date)})${l.notes?': '+l.notes:''}`));

    // Search learning resources
    const resources = await DB.getAll('learningResources');
    resources.filter(r =>
      (r.title||'').toLowerCase().includes(q) ||
      (r.notes||'').toLowerCase().includes(q) ||
      (r.tags||'').toLowerCase().includes(q)
    ).forEach(r => results.push(`学习资料: "${r.title}" [${r.type||'—'}]`));

    // Search finance items
    const finItems = await DB.getAll('financeItems');
    finItems.filter(f =>
      (f.title||'').toLowerCase().includes(q) ||
      (f.summary||'').toLowerCase().includes(q) ||
      (f.content||'').toLowerCase().includes(q)
    ).forEach(f => results.push(`金融资料: "${f.title}"`));

    if (results.length === 0) {
      return `[本地检索模式 — Dashboard 数据]\n\n在 Dashboard 记录中没有找到与「${query}」匹配的内容。\n\n提示：可以尝试更具体的关键词，或在每日计划、AI Learning、English Learning、减脂、理财知识等模块中搜索。`;
    }

    return `[本地检索模式 — Dashboard 数据]\n\n找到 ${results.length} 条相关记录：\n\n${results.slice(0,10).map((r,i)=>`${i+1}. ${r}`).join('\n')}\n\n⚠️ 以上来自本地记录，不构成专业建议。`;
  },

  async _searchDiary(q) {
    const entries = await DB.getAll('diaryEntries');
    const matches = entries.filter(e =>
      (e.title||'').toLowerCase().includes(q) ||
      (e.content||'').toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      return `[本地检索模式 — Diary 数据]\n\n在日记记录中没有找到与「${query}」相关的内容。\n\n当前未启用 Dashboard 数据访问。如需跨模块搜索，请将数据范围切换为「Dashboard + Diary」。`;
    }

    return `[本地检索模式 — Diary 数据]\n\n找到 ${matches.length} 篇相关日记：\n\n${matches.slice(0,5).map((e,i)=>
      `${i+1}. ��${e.title||'无标题'}」(${RL.fmtDate(e.date)})\n   ${(e.content||'').slice(0,120)}${(e.content||'').length>120?'...':''}`
    ).join('\n\n')}`;
  },

  async _searchAll(q) {
    const dashResult = await this._searchDashboard(q);
    const diaryResult = await this._searchDiary(q.replace('[本地检索模式','').split('\n')[0]||q);

    // Combine, removing headers from sub-results
    const dashLines = dashResult.split('\n').filter(l => !l.startsWith('['));
    const diaryLines = diaryResult.split('\n').filter(l => !l.startsWith('['));

    return `[本地检索模式 — 全部数据]\n\n=== Dashboard ===\n${dashLines.join('\n')}\n\n=== Diary ===\n${diaryLines.join('\n')}\n\n⚠️ 以上均来自本地记录，不构成专业建议或个性化推荐。`;
  },

  async deleteSession(id) {
    if (await RL.confirm('确定删除这个会话吗？所有消息将被删除且不可恢复。')) {
      // Delete all messages first
      const msgs = await DB.getByIndex('chatMessages', 'sessionId', id);
      for (const m of msgs) await DB.del('chatMessages', m.id);
      // Delete session
      await DB.del('chatSessions', id);
      RL.toast('已删除');
      this.renderList();
    }
  }
};
