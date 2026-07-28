/* ============================================
   Reality Loop — Weather Adapter
   Pluggable weather data source
   Default: wttr.in (free, no key, CORS-friendly, Chinese city names OK)
   Optional: 和风天气 QWeather (needs key + authorized domain)
   Pattern: adapter + provider fallback + cache + empty-state fallback
   ============================================ */

const Weather = {
  providerName: '未配置',
  _cache: null,
  _cacheTime: 0,
  CACHE_TTL: 10 * 60 * 1000, // 10 minutes

  // Cache for city name → Location ID resolution (session only)
  _locCache: {},

  /* Base endpoints. Free tier uses devapi; production standard uses api. */
  QWEATHER_BASE: 'https://devapi.qweather.com',
  QWEATHER_GEO: 'https://geoapi.qweather.com',

  /**
   * Fetch weather for a city (Chinese name, coords "lon,lat", or Location ID).
   * Returns a structured result:
   *   { ok: true,  data: { temp, desc, icon, humidity, hint } }
   *   { ok: false, error: '人类可读原因', errorType: 'key'|'city'|'cors'|'network'|'empty'|'config' }
   */
  async fetch(city) {
    const apiKey = await DB.getSetting('weatherApiKey', '');
    const provider = await DB.getSetting('weatherProvider', 'wttr'); // default: free, no key

    if (!city) {
      return { ok: false, error: '尚未设置城市', errorType: 'config' };
    }

    // Return cached result if fresh
    if (this._cache && (Date.now() - this._cacheTime) < this.CACHE_TTL) {
      return { ok: true, data: this._cache };
    }

    const cacheOk = (data, name) => {
      this._cache = data; this._cacheTime = Date.now();
      this.providerName = name;
      return { ok: true, data };
    };

    try {
      let data = null;
      if (provider === 'qweather' && apiKey) {
        data = await this._fetchQWeather(city, apiKey);
        return cacheOk(data, '和风天气');
      } else if (provider === 'openweathermap' && apiKey) {
        data = await this._fetchOWM(city, apiKey);
        return cacheOk(data, 'OpenWeatherMap');
      } else if (provider === 'tianqiapi') {
        data = await this._fetchTianqiapi(city);
        return cacheOk(data, '一刻天气');
      } else {
        // default: wttr.in (no key, CORS-friendly)
        data = await this._fetchWttr(city);
        return cacheOk(data, 'wttr.in');
      }
    } catch (e) {
      console.warn('[RL] Weather primary fetch error:', e.message);
      // If the configured provider is not wttr and it failed, fall back to wttr.in
      // so the dashboard still shows weather (e.g. QWeather key/domain issues).
      if (provider !== 'wttr') {
        try {
          const fb = await this._fetchWttr(city);
          if (fb) {
            const r = cacheOk(fb, 'wttr.in（备用）');
            r.note = `主源（${provider}）失败，已退回 wttr.in`;
            return r;
          }
        } catch (e2) { console.warn('[RL] Weather fallback also failed:', e2.message); }
      }
      // Typed errors thrown by sub-fetchers
      if (e.errorType) return { ok: false, error: e.message, errorType: e.errorType };
      // Network / CORS failure (fetch throws TypeError "Failed to fetch" when blocked)
      if (e instanceof TypeError || /Failed to fetch|NetworkError/.test(e.message)) {
        return {
          ok: false,
          error: '网络或跨域被拦截（和风需在控制台配置授权域名，并通过部署后的真实域名访问，不要用 localhost）',
          errorType: 'cors'
        };
      }
      return { ok: false, error: e.message || '未知错误', errorType: 'network' };
    }
  },

  /* ── QWeather / 和风天气 ── */
  async _fetchQWeather(city, key) {
    // Resolve city name → Location ID (QWeather requires ID, not raw name)
    const locationId = await this._resolveLocation(city, key);
    if (!locationId) {
      const e = new Error('城市名解析失败（检查城市拼写，或改用 Location ID / 经纬度）');
      e.errorType = 'city'; throw e;
    }

    const url = `${this.QWEATHER_BASE}/v7/weather/now?location=${encodeURIComponent(locationId)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      // 401/403 → Key 无效或未授权域名；429 → 超限
      const t = (res.status === 401 || res.status === 403) ? 'key' : 'network';
      const e = new Error(`和风返回 HTTP ${res.status}${t === 'key' ? '（Key 无效或未配置授权域名）' : ''}`);
      e.errorType = t; throw e;
    }
    const j = await res.json();
    if (j.code !== '200') {
      // 和风业务码：401=Key 错误, 403=无权限/未授权域名, 404=城市, 429=超限
      let t = 'network';
      if (['401','403'].includes(j.code)) t = 'key';
      else if (j.code === '404') t = 'city';
      const e = new Error(`和风错误码 ${j.code}（${this._qwCodeMsg(j.code)}）`);
      e.errorType = t; throw e;
    }

    return {
      temp: `${j.now.temp}°`,
      desc: j.now.text,
      icon: this._iconForCode(j.now.icon),
      humidity: j.now.humidity,
      hint: this._hintFromText(j.now.text)
    };
  },

  _qwCodeMsg(code) {
    const m = {
      '401': 'Key 错误或未授权', '402': '超过免费额度', '403': '无权限（请配置授权域名）',
      '404': '城市未找到', '429': '请求过于频繁（限速）', '500': '服务端错误'
    };
    return m[code] || '未知';
  },

  /**
   * Resolve a user-typed location string to a QWeather Location ID.
   * Accepts:
   *  - "lon,lat"  → use directly
   *  - pure digits (Location ID) → use directly
   *  - Chinese/English city name → GeoAPI lookup
   */
  async _resolveLocation(city, key) {
    const c = (city || '').trim();

    // Coordinates or already an ID
    if (/^[\d.]+,[\d.]+$/.test(c)) return c;          // lon,lat
    if (/^\d{4,}$/.test(c)) return c;                  // Location ID

    // Cached name resolution
    if (this._locCache[c]) return this._locCache[c];

    const url = `${this.QWEATHER_GEO}/v2/city/lookup?location=${encodeURIComponent(c)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
      const t = (res.status === 401 || res.status === 403) ? 'key' : 'network';
      const e = new Error(`GeoAPI HTTP ${res.status}${t === 'key' ? '（Key 无效或未配置授权域名）' : ''}`);
      e.errorType = t; throw e;
    }
    const j = await res.json();
    if (j.code !== '200' || !j.location || !j.location.length) {
      const e = new Error('城市未找到（检查城市名拼写）');
      e.errorType = 'city'; throw e;
    }
    const id = j.location[0].id;
    this._locCache[c] = id; // session cache
    return id;
  },

  /* ── OpenWeatherMap ── */
  async _fetchOWM(city, key) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=zh_cn`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OWM ${res.status}`);
    const j = await res.json();
    return {
      temp: `${Math.round(j.main.temp)}°`,
      desc: j.weather[0]?.description || '',
      icon: this._iconForOWM(j.weather[0]?.id),
      humidity: j.main.humidity,
      hint: ''
    };
  },

  /* ── Tianqiapi / 一刻天气 (free, no key) ── */
  async _fetchTianqiapi(city) {
    const url = `https://tianqiapi.com/api?unescape=1&appid=&appsecret=&city=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tianqiapi ${res.status}`);
    const j = await res.json();
    if (j.code !== 200) throw new Error('Tianqiapi error');
    return {
      temp: `${j.data[0]?.tem}°`,
      desc: j.data[0]?.wea || '',
      icon: '',
      humidity: j.data[0]?.humidity || '',
      hint: j.data[0]?.air_tips || ''
    };
  },

  /* ── wttr.in (free, no key, CORS-friendly, Chinese city OK) ── */
  async _fetchWttr(city) {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wttr.in ${res.status}`);
    const j = await res.json();
    const cur = j.current_condition && j.current_condition[0];
    if (!cur) throw new Error('wttr.in 无数据');
    const code = parseInt(cur.weatherCode, 10);
    const desc = this._wttrDesc(code);
    return {
      temp: `${cur.temp_C}°`,
      desc,
      icon: this._wttrIcon(code),
      humidity: cur.humidity,
      hint: this._hintFromText(desc)
    };
  },

  /* wttr.in weatherCode → 中文描述 */
  _wttrDesc(code) {
    const m = {
      113:'晴', 116:'多云', 119:'阴', 122:'阴', 143:'薄雾', 176:'阵雨',
      179:'阵雪', 182:'冻雨', 185:'冻毛毛雨', 200:'雷阵雨', 227:'风吹雪',
      230:'暴风雪', 248:'雾', 260:'冻雾', 263:'小毛雨', 266:'毛毛雨',
      281:'冻毛雨', 284:'强冻毛雨', 293:'小阵雨', 296:'小雨', 299:'中雨',
      302:'大雨', 305:'阵雨', 308:'大雨', 311:'小阵雨', 314:'强阵雨',
      317:'暴雨', 320:'小雪', 323:'小阵雪', 326:'小雪', 329:'中阵雪',
      332:'中雪', 335:'大阵雪', 338:'大雪', 350:'冰粒', 353:'小阵雨',
      356:'强阵雨', 359:'暴雨', 362:'小冻雨', 365:'强冻雨', 386:'雷阵雨',
      389:'强雷雨', 392:'雷阵雪', 395:'强雷阵雪'
    };
    return m[code] || '未知';
  },
  /* wttr.in weatherCode → emoji 图标 */
  _wttrIcon(code) {
    if (code === 113) return '☀️';
    if (code === 116) return '⛅';
    if (code === 119 || code === 122) return '☁️';
    if (code === 143 || code === 248 || code === 260) return '🌫️';
    if ([176,179,182,185,200,263,266,281,284,293,296,299,302,305,308,311,314,317,353,356,359,362,365,386,389].includes(code)) return '🌧️';
    if ([227,230,320,323,326,329,332,335,338,350,392,395].includes(code)) return '❄️';
    return '🌤️';
  },

  _iconForCode(code) {
    const map = { '100':'☀️','101':'⛅','102':'☁️','103':'☁️','104':'☁️',
      '300':'🌧️','301':'🌧️','302':'⛈️','303':'⛈️','304':'🌧️',
      '309':'🌧️','399':'🌧️','400':'❄️','401':'🌨️','402':'🌨️',
      '500':'🌫️','501':'🌫️','502':'🌫️','900':'🌡️','901':'❄️','998':'🌙','999':'🔆'
    };
    return map[code] || '🌤️';
  },
  _iconForOWM(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌧️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800) return '☀️';
    if (id > 800) return '⛅';
    return '🌤️';
  },
  _hintFromText(text) {
    const hints = { '晴':'适合户外活动', '多云':'温度适宜', '阴':'可能转雨',
      '小雨':'记得带伞', '中雨':'出行注意安全', '大雨':'尽量减少外出',
      '雷阵雨':'注意防雷', '雪':'注意保暖', '雾':'能见度低，小心驾驶'
    };
    for (const [k, v] of Object.entries(hints)) { if (text.includes(k)) return v; }
    return '';
  }
};
