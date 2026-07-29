/* ============================================
   Reality Loop — Chat Provider Interface
   Pluggable AI chat backend
   Providers: Local (default) | 元宝 (Yuanbao) | DeepSeek
   Pattern: Provider interface with config UI
   ============================================ */

const ChatProvider = {
  deepseekDefaults: Object.freeze({
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-v4-flash'
  }),

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

  async _normalizeDeepSeekConfig() {
    const endpoint = this._normalizeDeepSeekEndpoint(
      await DB.getSetting('deepseekBaseUrl', this.deepseekDefaults.endpoint)
    );
    const model = this._normalizeDeepSeekModel(
      await DB.getSetting('deepseekModel', this.deepseekDefaults.model)
    );
    return { endpoint, model };
  },

  _normalizeDeepSeekEndpoint(value) {
    const raw = String(value || '').trim();
    if (!raw) return this.deepseekDefaults.endpoint;

    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error('DeepSeek 接口地址格式无效');
    }

    if (url.protocol !== 'https:') {
      throw new Error('DeepSeek 接口必须使用 HTTPS');
    }

    if (url.hostname === 'api.deepseek.com') {
      const pathName = url.pathname.replace(/\/+$/, '');
      if (!pathName || pathName === '/v1') {
        url.pathname = '/v1/chat/completions';
      }
    }

    return url.href.replace(/\/$/, '');
  },

  _normalizeDeepSeekModel(value) {
    const model = String(value || '').trim();
    if (!model || model === 'deepseek-chat' || model === 'deepseek-reasoner') {
      return this.deepseekDefaults.model;
    }
    return model;
  },

  _deepSeekHttpError(status, apiMessage = '') {
    const labels = {
      400: '请求格式错误',
      401: 'API Key 无效或已失效',
      402: '账户余额不足',
      404: '接口地址或模型不存在',
      422: '请求参数无效',
      429: '请求过于频繁',
      500: 'DeepSeek 服务内部错误',
      503: 'DeepSeek 服务繁忙'
    };
    const label = labels[status] || 'DeepSeek API 请求失败';
    const detail = String(apiMessage || '').trim().slice(0, 180);
    return label + '（HTTP ' + status + '）' + (detail ? '：' + detail : '');
  },

  async _requestDeepSeek({
    apiKey,
    endpoint,
    model,
    messages,
    maxTokens = 1024,
    temperature = 0.7
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    let response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false
        }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      if (
        error instanceof TypeError ||
        /Failed to fetch|NetworkError|Load failed/i.test(error?.message || '')
      ) {
        throw new Error('网络请求失败。请确认接口地址正确，并检查当前网络能否访问 api.deepseek.com');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let apiMessage = '';
      try {
        const errorBody = await response.json();
        apiMessage = errorBody?.error?.message || errorBody?.message || '';
      } catch {
        // Some gateways return an empty or non-JSON error body.
      }
      throw new Error(this._deepSeekHttpError(response.status, apiMessage));
    }

    return await response.json();
  },

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

      const { endpoint, model } = await this._normalizeDeepSeekConfig();
      const data = await this._requestDeepSeek({
        apiKey,
        endpoint,
        model,
        messages: [
          ...(contextText ? [{ role: 'system', content: contextText }] : []),
          { role: 'user', content: message }
        ]
      });
      const reply = data.choices?.[0]?.message?.content || '[无回答]';

      return '[DeepSeek AI]\n\n' + reply +
        '\n\n⚠️ 以上由 AI 生成，请结合个人记录判断，不构成专业建议。';
    } catch (error) {
      console.error('[RL] DeepSeek API error:', error);
      return '[AI 连接失败]\n\n无法连接到 DeepSeek 服务：' + error.message +
        '\n\n已自动降级为本地检索模式。\n\n' +
        await Chats._localRetrieve(message);
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
          <label class="form-label">Chat Completions 完整接口地址</label>
          <input id="ds-baseurl" placeholder="https://api.deepseek.com/v1/chat/completions"
                 value="https://api.deepseek.com/v1/chat/completions">
          <small style="color:var(--text-tertiary)">留空时使用 DeepSeek 官方接口。</small>
        </div>
        <div class="form-group">
          <label class="form-label">API Key *</label>
          <input id="ds-key" placeholder="输入新 Key；留空则保留已保存的 Key"
                 type="password" autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label">模型名称</label>
          <input id="ds-model" placeholder="deepseek-v4-flash" value="deepseek-v4-flash">
        </div>
        <button id="ds-test-btn" class="btn btn-outline" type="button"
                onclick="ChatProvider.testDeepSeekConnection()" style="width:100%">
          测试 DeepSeek 连接
        </button>
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
      DB.getSetting('deepseekBaseUrl',this.deepseekDefaults.endpoint).then(v=>{
        const el=document.getElementById('ds-baseurl');
        if(el)el.value=this._normalizeDeepSeekEndpoint(v);
      });
      DB.getSetting('deepseekModel',this.deepseekDefaults.model).then(v=>{
        const el=document.getElementById('ds-model');
        if(el)el.value=this._normalizeDeepSeekModel(v);
      });
      DB.getSetting('deepseekApiKey','').then(v=>{
        const el=document.getElementById('ds-key');
        if(el && v)el.placeholder='已保存 API Key；留空则保持不变';
      });
    }, 100);
  },

  async testDeepSeekConnection() {
    const button = document.getElementById('ds-test-btn');
    const enteredKey = document.getElementById('ds-key')?.value.trim() || '';
    const savedKey = await DB.getSetting('deepseekApiKey', '');
    const apiKey = enteredKey || savedKey;
    if (!apiKey) {
      RL.toast('请先输入 DeepSeek API Key');
      return;
    }

    let endpoint;
    let model;
    try {
      endpoint = this._normalizeDeepSeekEndpoint(
        document.getElementById('ds-baseurl')?.value
      );
      model = this._normalizeDeepSeekModel(
        document.getElementById('ds-model')?.value
      );
    } catch (error) {
      RL.toast(error.message);
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = '测试中…';
    }

    try {
      await this._requestDeepSeek({
        apiKey,
        endpoint,
        model,
        messages: [{ role: 'user', content: '只回复 OK' }],
        maxTokens: 16,
        temperature: 0
      });
      RL.toast('DeepSeek 连接成功 · ' + model);
    } catch (error) {
      RL.toast('连接失败：' + error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = '测试 DeepSeek 连接';
      }
    }
  },

  async saveConfig() {
    const prov = document.querySelector('input[name="prov"]:checked')?.value || 'local';

    if (prov === 'yuanbao') {
      const key = document.getElementById('yb-key').value.trim();
      if (!key) { RL.toast('请输入 API Key'); return; }
      await DB.setSetting('yuanbaoApiKey', key);
      await DB.setSetting('yuanbaoBaseUrl', document.getElementById('yb-baseurl').value.trim());
      await DB.setSetting('yuanbaoModel', document.getElementById('yb-model').value.trim() || 'hunyuan-pro');
      ChatProvider.currentName = '元宝 API';
    } else if (prov === 'deepseek') {
      const enteredKey = document.getElementById('ds-key').value.trim();
      const savedKey = await DB.getSetting('deepseekApiKey', '');
      if (!enteredKey && !savedKey) {
        RL.toast('请输入 DeepSeek API Key');
        return;
      }

      let endpoint;
      let model;
      try {
        endpoint = this._normalizeDeepSeekEndpoint(
          document.getElementById('ds-baseurl').value
        );
        model = this._normalizeDeepSeekModel(
          document.getElementById('ds-model').value
        );
      } catch (error) {
        RL.toast(error.message);
        return;
      }

      if (enteredKey) {
        await DB.setSetting('deepseekApiKey', enteredKey);
      }
      await DB.setSetting('deepseekBaseUrl', endpoint);
      await DB.setSetting('deepseekModel', model);
      ChatProvider.currentName = 'DeepSeek';
    } else {
      ChatProvider.currentName = '本地检索模式';
    }

    await DB.setSetting('chatProvider', prov);
    RL.closeModal();
    RL.toast('已切换为 ' + (this.providers[prov]?.name || prov));
    Dashboard.renderSettings();
  }

};
