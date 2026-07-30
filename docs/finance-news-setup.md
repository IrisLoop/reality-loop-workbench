# Finance digest setup

The Finance Learning page reads `data/finance-news.json`. The browser never receives provider API keys and never fetches providers when the page opens.

## GitHub Actions secrets

Configure these repository secrets before the first manual workflow run:

- `ALPHA_VANTAGE_API_KEY`: required for global macro, policy, IPO, and M&A coverage.
- `FINANCE_NEWS_DEEPSEEK_API_KEY`: optional. When present, selected English headlines are translated and summarized in Chinese. This must be a server-side key; do not reuse or copy a browser-stored key.

Do not commit any key to this repository or put a provider key in frontend JavaScript.

Chinese policy and regulation coverage uses public, key-free sources from the China Securities Regulatory Commission, the People's Bank of China, and the State Council policy portal. Each source is filtered for finance relevance before ranking. GDELT remains a key-free, non-blocking supplement for international geopolitics.

## Schedule and data window

`.github/workflows/deploy-pages.yml` runs at 06:07 Asia/Shanghai, with a 06:37 fallback run. The script collects the previous calendar day in the same timezone and writes at most 10 items.

The 06:37 run is a failure fallback, not a second refresh. When a usable snapshot for the target date already exists, both the AI and finance generators stop before calling any external provider. A successful partial finance snapshot is also fixed for that day rather than being silently replaced later.

Manual workflow runs follow the same non-overwrite rule by default. Select `force_refresh` only when an existing current-day snapshot is known to be wrong and should be deliberately replaced.

Browsers that already cached the old snapshot intentionally keep it fixed. After an operator uses `force_refresh`, open the deployed page once with `?refresh-digests=1` to discard that device's current-day AI and finance cache and read the replacement snapshot. This only reloads the public JSON files; it does not call provider APIs.

The target mix is:

- 3 macro and geopolitics items
- 3 policy and regulation items
- 3 company and IPO items
- 1 highest-scoring remaining item

If fewer than 10 items meet the rules, the file contains fewer items instead of filler.

## Failure behavior

Each snapshot is written atomically. If the finance update fails, GitHub Actions keeps the previous successful snapshot and continues the Pages deployment. The UI marks snapshots older than two days as stale.

After the browser reads a valid current-day snapshot once, it keeps that snapshot locally for the day. Reopening the tab does not repeatedly request the static JSON file. External sources are only called by GitHub Actions; opening the page never calls the official Chinese sources, Alpha Vantage, GDELT, DeepSeek, or the AI Hot source directly.

## Local checks

```powershell
node --check scripts/update-finance-news.mjs
node scripts/update-finance-news.mjs --self-test
```

A real dry run uses provider network access and does not write the snapshot:

```powershell
$env:FINANCE_NEWS_TARGET_DATE='2026-07-29'
node scripts/update-finance-news.mjs --dry-run
Remove-Item Env:FINANCE_NEWS_TARGET_DATE
```

## Current verification boundary

The selection, category quotas, deduplication, scoring, JSON schema, frontend loading, stale-state UI, and failure fallback have local tests. The three official Chinese sources have a live connectivity and parsing check. Alpha Vantage coverage remains unverified locally because its key exists only in GitHub Actions. A single successful run must not be treated as proof of long-term stability, and public page structures can change without notice.
