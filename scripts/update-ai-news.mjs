import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIME_ZONE = 'Asia/Shanghai';
const API_URL = 'https://aihot.virxact.com/api/v1/items';
const SOURCE_PAGE = 'https://aihot.virxact.com/agent';
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'ai-news.json'
);
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const MAX_RETRIES = 3;
const isDryRun = process.argv.includes('--dry-run');
const skipIfCurrent = process.env.AI_HOT_SKIP_IF_CURRENT === '1';

function dateInTimeZone(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function previousCalendarDate(now = new Date()) {
  const today = dateInTimeZone(now);
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function validateTargetDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid AI_HOT_TARGET_DATE: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid AI_HOT_TARGET_DATE: ${value}`);
  }
  return value;
}

async function currentSnapshotIsComplete(targetDate) {
  if (!skipIfCurrent) return false;
  try {
    const snapshot = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
    return snapshot?.schemaVersion === 1 &&
      snapshot?.targetDate === targetDate &&
      snapshot?.itemCount >= 10 &&
      Array.isArray(snapshot?.items) &&
      snapshot.items.length >= 10;
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Reality-Loop-Workbench/1.0 (+https://github.com/IrisLoop/reality-loop-workbench)'
        },
        signal: AbortSignal.timeout(30_000)
      });

      if (response.ok) return response.json();

      const retryable = response.status === 429 || response.status === 503;
      if (!retryable || attempt === MAX_RETRIES) {
        throw new Error(`AI HOT request failed: HTTP ${response.status}`);
      }

      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '5', 10);
      await wait(Math.max(1, retryAfter) * 1_000);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await wait(attempt * 2_000);
    }
  }
  throw lastError || new Error('AI HOT request failed');
}

async function fetchSelectedItems() {
  const items = [];
  let cursor = null;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const url = new URL(API_URL);
    url.searchParams.set('mode', 'selected');
    url.searchParams.set('window', '7d');
    url.searchParams.set('by', 'published');
    url.searchParams.set('limit', String(PAGE_SIZE));
    if (cursor) url.searchParams.set('cursor', cursor);

    const payload = await fetchJson(url);
    if (payload?.schemaVersion !== 1 || !Array.isArray(payload.items) || !payload.page) {
      throw new Error('AI HOT returned an unsupported response schema');
    }

    items.push(...payload.items);
    if (!payload.page.hasMore) return items;
    if (!payload.page.nextCursor) {
      throw new Error('AI HOT response says hasMore without nextCursor');
    }
    cursor = payload.page.nextCursor;
  }

  throw new Error(`AI HOT pagination exceeded ${MAX_PAGES} pages`);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\u0000/g, '').trim().slice(0, maxLength)
    : '';
}

function categoryLabel(category) {
  return {
    'ai-models': 'AI 模型',
    'ai-products': 'AI 产品',
    industry: '行业',
    paper: '论文',
    tip: '技巧'
  }[category] || cleanText(category, 40);
}

function normalizeItem(item, targetDate) {
  const title = cleanText(item?.title, 500);
  const originalUrl = safeHttpUrl(item?.links?.original);
  const aihotUrl = safeHttpUrl(item?.links?.aihot);
  const publishedAt = typeof item?.publishedAt === 'string' ? item.publishedAt : '';
  const discoveredAt = typeof item?.discoveredAt === 'string' ? item.discoveredAt : '';

  if (!title || !originalUrl || !aihotUrl || !publishedAt) return null;

  const score = Number.isFinite(item.score) ? item.score : null;
  const category = cleanText(item.category, 40);
  const tag = categoryLabel(category);

  return {
    id: cleanText(item.id, 200),
    title,
    originalTitle: cleanText(item.originalTitle, 500) || null,
    summary: cleanText(item.summary, 2_000) || null,
    source: 'AI HOT · AI 摘要 · ' + (cleanText(item?.source?.name, 200) || '未知来源'),
    url: aihotUrl,
    originalUrl,
    aihotUrl,
    tags: tag ? [tag] : [],
    category: category || null,
    score,
    date: targetDate,
    publishedAt,
    discoveredAt
  };
}

function buildDigest(items, targetDate, now = new Date()) {
  const seen = new Set();
  const ranked = items
    .filter(item => item?.selected === true)
    .filter(item => {
      if (!item.publishedAt) return false;
      const date = new Date(item.publishedAt);
      return !Number.isNaN(date.getTime()) && dateInTimeZone(date) === targetDate;
    })
    .sort((a, b) => {
      const scoreDifference = (b.score ?? -1) - (a.score ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .filter(item => {
      const key = item.id || item.links?.original;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(item => normalizeItem(item, targetDate))
    .filter(Boolean)
    .slice(0, 10);

  if (ranked.length === 0) {
    throw new Error(`AI HOT returned no usable selected items for ${targetDate}`);
  }

  return {
    schemaVersion: 1,
    updated: targetDate,
    generatedAt: now.toISOString(),
    targetDate,
    timezone: TIME_ZONE,
    itemCount: ranked.length,
    source: {
      name: 'AI HOT',
      url: SOURCE_PAGE,
      api: API_URL
    },
    methodology: '按北京时间前一自然日筛选 AI HOT 精选内容，按官方 score 热度分降序排列；同分时按发布时间倒序，最多展示 10 条。',
    disclaimer: '标题与摘要来自 AI HOT 聚合与 AI 处理。重要事实请以原始来源为准。',
    items: ranked
  };
}

async function main() {
  const targetDate = validateTargetDate(
    process.env.AI_HOT_TARGET_DATE || previousCalendarDate()
  );
  if (await currentSnapshotIsComplete(targetDate)) {
    process.stdout.write(`AI Hot snapshot already contains 10 items for ${targetDate}; skipping retry.\n`);
    return;
  }
  const sourceItems = await fetchSelectedItems();
  const digest = buildDigest(sourceItems, targetDate);
  const output = `${JSON.stringify(digest, null, 2)}\n`;

  if (isDryRun) {
    process.stdout.write(output);
    return;
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  await writeFile(temporaryPath, output, 'utf8');
  await rename(temporaryPath, OUTPUT_PATH);
  process.stdout.write(`Updated ${OUTPUT_PATH} with ${digest.itemCount} items for ${targetDate}\n`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
