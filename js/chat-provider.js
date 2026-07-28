/* ============================================
   Reality Loop — Chat Provider Interface
   Pluggable AI chat backend
   Providers: Local (default) | 元宝 (Yuanbao) | DeepSeek
   Pattern: Provider interface with config UI
   ============================================ */

const ChatProvider = {
  currentName: '本地检索模式',
  providers: {
    local: { name: '本地检索模式', desc: '不发送数据到外部' },
    yuanbao: { name: '元宝 API', desc: '腾讯混元大模型，需配置 API Key' },
    deepseek: { name: 'DeepSeek', desc: 'DeepSeek 大模型，需配置 API Key' }
  },

  /** Get active provider key */
  async getActive() {
    return await DB.getSetting('chatProvider', 'local');
  },

  /**
   * Send message and get response.
   * @param {string} userMessage
   * @param {string} scope - 'none'|'dashboard'|'diary'|'all'
   * @returns {Promise<string>} response text
   */
  async chat(userMessage, scope) {
    const provider = await this.getActive();

    if (provider === 'yuanbao') {
      return await this._chatYuanbao(userMessage, scope);
    }
    if (provider === 'deepseek') {
      return await this._chatDeepSeek(userMessage, scope);
    }

    // Default: local retrieval
    return await Chats._localRetrieve(userMessage);
  },

  /* ── 元宝 / Yuanbao API ── */

  async _chatYuanbao(message, scope) {
    const apiKey = await DB.getSetting('yuanbaoApiKey', '');
    if (!apiKey) {
      // Fallback to local
      RL.toast('元宝 API Key 未配置，使用本地检索');
      return await Chats._localRetrieve(message);
    }

    try {
      // Build context based on scope
      let contextText = '';
      if (scope !== 'none') {
        contextText = await this._buildContext(scope, message);
      }

      // Call 元宝 API
      // Note: 元宝 API endpoint may vary; using standard OpenAI-compatible format
      const baseUrl = await DB.getSetting('yuanbaoBaseUrl', 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions');
      const model = await DB.getSetting('yuanbaoModel', 'hunyuan-pro');

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(contextText ? [{ role: 'system', content: contextText }] : []),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!res.ok) {
        throw new Error(`元宝 API 错误: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '[无回复]';

      return `[元宝 AI]\n\n${reply}\n\n⚠️ 以上由 AI 生成，请结合个人记录判断，不构成专业建议。`;

    } catch(e) {
      console.error('[RL] 元宝 API error:', e);
      return `[AI 连接失败]\n\n无法连接到元宝服务：${e.message}\n\n已自动降级为本地检索模式。\n\n${await Chats._localRetrieve(message)}`;
    }
  },

  /* ── DeepSeek API ── */

  async _chatDeepSeek(message, scope) {
    const apiKey = await DB.getSetting('deepseekApiKey', '');
    if (!apiKey) {
      RL.toast('DeepSeek API Key 未配置，使用本地检索');
      return await Chats._localRetrieve(message);
    }

    try {
      let contextText = '';
      if (scope !== 'none') {
        contextText = await this._buildContext(scope, message);
      }

      const baseUrl = await DB.getSetting('deepseekBaseUrl', 'https://api.deepseek.com/v1/chat/completions');
      const model = await DB.getSetting('deepseekModel', 'deepseek-chat');

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(contextText ? [{ role: 'system', content: contextText }] : []),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!res.ok) {
        throw new Error(`DeepSeek API 错误: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '[无回复]';

      return `[DeepSeek AI]\n\n${reply}\n\n⚠️ 以上由 AI 生成，请结合个人记录判断，不构成专业建议。`;

    } catch(e) {
      console.error('[RL] DeepSeek API error:', e);
      return `[AI 连接失败]\n\n无法连接到 DeepSeek 服务：${e.message}\n\n已自动降级为本地检索模式。\n\n${await Chats._localRetrieve(message)}`;
    }
  },

  async _buildContext(scope, query) {
    let parts = [];
    parts.push(`你是 Reality Loop 个人工作台的 AI 助手。当前用户查询：「${query}」`);
    parts.push(`数据范围：${Chats.scopeLabels[scope]||scope}`);
    parts.push('规则：只基于提供的个人数据回答；数据中没有答案时明确说"现有记录中没有足够信息"；不编造事实；不把通用知识伪装成用户记录。');

    if (scope === 'dashboard' || scope === 'all') {
      const todayTasks = await DB.getByIndex('tasks', 'date', RL.todayStr());
      parts.push(`\n今日待办（共${todayTasks.length}项）：${todayTasks.map(t=>`- [${t.completed?'x':' '}] ${t.title}`).join('\n')}`);

      const wp = await DB.getSetting('initialWeight', null);
      const wLogs = await DB.getAll('weightLogs');
      wLogs.sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(wLogs[0]) parts.push(`最新体重：${wLogs[0].weight}${await DB.getSetting('weightUnit','kg')} (${RL.fmtDate(wLogs[0].date)})`);

      const aiMinsToday = (await DB.getByIndex('learningSessions','date',RL.todayStr()))
        .filter(s=>!(s.category||'').startsWith('english-'))
        .reduce((s,x)=>s+(parseInt(x.minutes)||0),0);
      const engMinsToday = (await DB.getByIndex('learningSessions','date',RL.todayStr()))
        .filter(s=>(s.category||'').startsWith('english-'))
        .reduce((s,x)=>s+(parseInt(x.minutes)||0),0);
      parts.push(`今日学习：AI ${aiMinsToday}min · English ${engMinsToday}min`);
    }

    if (scope === 'diary' || scope === 'all') {
      const entries = await DB.getAll('diaryEntries');
      entries.sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(entries.length>0){
        parts.push(`\n最近日记（${entries.length}篇）：`);
        entries.slice(0,5).forEach(e=>{
          parts.push(`- 「${e.title||'无标题'}」(${RL.fmtDate(e.date)}): ${(e.content||'').slice(0,150)}`);
        });
      }
    }

    return parts.join('\n');
  },

  /* ── Config UI ── */

  showConfig() {
    RL.openModal(`
      <div class="modal-title">Chat Provider 配置</div>
      <div class="form-group">
        <label class="form-label">选择 Provider</label>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--border-light);cursor:pointer" onclick="document.getElementById('prov-local').checked=true">
            <input type="radio" name="prov" id="prov-local" value="local" checked>
            <div><strong>本地检索模式</strong><br><small style="color:var(--text-tertiary)">不发送任何数据到外部</small></div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--border-light);cursor:pointer" onclick="document.getElementById('prov-yuanbao').checked=true">
            <input type="radio" name="prov" id="prov-yuanbao" value="yuanbao">
            <div><strong>元宝 API (腾讯混元)</strong><br><small style="color:var(--text-tertiary)">需提供 API Key 和 Base URL</small></div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--border-light);cursor:pointer" onclick="document.getElementById('prov-deepseek').checked=true">
            <input type="radio" name="prov" id="prov-deepseek" value="deepseek">
            <div><strong>DeepSeek</strong><br><small style="color:var(--text-tertiary)">需提供 API Key（兼容 OpenAI 格式）</small></div>
          </label>
        </div>
      </div>

      <div id="yuanbao-config" style="display:none">
        <div class="form-group">
          <label class="form-label">API Base URL</label>
          <input id="yb-baseurl" placeholder="https://api.hunyuan.cloud.tencent.com/v1/chat/completions"
                 value="${''}">
        </div>
        <div class="form-group">
          <label class="form-label">API Key *</label>
          <input id="yb-key" placeholder="输入你的元宝 API Key" type="password">
        </div>
        <div class="form-group">
          <label class="form-label">模型名称</label>
          <input id="yb-model" placeholder="hunyuan-pro" value="hunyuan-pro">
        </div>
      </div>

      <div id="deepseek-config" style="display:none">
        <div class="form-group">
          <label class="form-label">API Base URL</label>
          <input id="ds-baseurl" placeholder="https://api.deepseek.com/v1/chat/completions"
                 value="${''}">
        </div>
        <div class="form-group">
          <label class="form-label">API Key *</label>
          <input id="ds-key" placeholder="输入你的 DeepSeek API Key" type="password">
        </div>
        <div class="form-group">
          <label class="form-label">模型名称</label>
          <input id="ds-model" placeholder="deepseek-chat" value="deepseek-chat">
        </div>
      </div>

      <p style="font-size:var(--fs-tiny);color:var(--danger);margin-top:6px">
        ⚠️ API Key 将存储在浏览器本地数据库中。首次发送消息前会展示数据范围。
      </p>

      <div style="display:flex;gap:8px;margin-top:18px">
        <button class="btn btn-outline" onclick="RL.closeModal()" style="flex:1">取消</button>
        <button class="btn btn-primary" onclick="ChatProvider.saveConfig()" style="flex:1">保存</button>
      </div>
    `);

    // Toggle config visibility
    setTimeout(() => {
      document.querySelectorAll('input[name="prov"]').forEach(r => {
        r.addEventListener('change', () => {
          document.getElementById('yuanbao-config').style.display =
            r.value === 'yuanbao' ? 'block' : 'none';
          document.getElementById('deepseek-config').style.display =
            r.value === 'deepseek' ? 'block' : 'none';
        });
      });

      // Pre-fill existing values
      DB.getSetting('chatProvider','local').then(v => {
        const el = document.getElementById(`prov-${v||'local'}`);
        if(el){el.checked=true;el.dispatchEvent(new Event('change'));}
      });
      DB.getSetting('yuanbaoBaseUrl','').then(v=>{
        const el=document.getElementById('yb-baseurl');if(el)el.value=v;
      });
      DB.getSetting('yuanbaoModel','hunyuan-pro').then(v=>{
        const el=document.getElementById('yb-model');if(el)el.value=v;
      });
      DB.getSetting('deepseekBaseUrl','').then(v=>{
        const el=document.getElementById('ds-baseurl');if(el)el.value=v;
      });
      DB.getSetting('deepseekModel','deepseek-chat').then(v=>{
        const el=document.getElementById('ds-model');if(el)el.value=v;
      });
    }, 100);
  },

  async saveConfig() {
    const prov = document.querySelector('input[name="prov"]:checked')?.value || 'local';
    await DB.setSetting('chatProvider', prov);

    if (prov === 'yuanbao') {
      const key = document.getElementById('yb-key').value.trim();
      if (!key) { RL.toast('请输入 API Key'); return; }
      await DB.setSetting('yuanbaoApiKey', key);
      await DB.setSetting('yuanbaoBaseUrl', document.getElementById('yb-baseurl').value.trim());
      await DB.setSetting('yuanbaoModel', document.getElementById('yb-model').value.trim() || 'hunyuan-pro');
      ChatProvider.currentName = '元宝 API';
    } else if (prov === 'deepseek') {
      const key = document.getElementById('ds-key').value.trim();
      if (!key) { RL.toast('请输入 API Key'); return; }
      await DB.setSetting('deepseekApiKey', key);
      await DB.setSetting('deepseekBaseUrl', document.getElementById('ds-baseurl').value.trim());
      await DB.setSetting('deepseekModel', document.getElementById('ds-model').value.trim() || 'deepseek-chat');
      ChatProvider.currentName = 'DeepSeek';
    } else {
      ChatProvider.currentName = '本地检索模式';
    }

    RL.closeModal();
    RL.toast(`已切换为 ${this.providers[prov]?.name||prov}`);
    Dashboard.renderSettings();
  }
};
