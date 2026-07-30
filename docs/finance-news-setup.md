# Finance digest setup

The Finance Learning page reads `data/finance-news.json`. The browser never receives provider API keys and never fetches providers when the page opens.

## GitHub Actions secrets

Configure these repository secrets before the first manual workflow run:

- `TUSHARE_TOKEN`: required for Chinese finance headlines. The Tushare `news` API needs separate news permission.
- `ALPHA_VANTAGE_API_KEY`: required for global macro, policy, IPO, and M&A coverage.
- `FINANCE_NEWS_DEEPSEEK_API_KEY`: optional. When present, selected English headlines are translated and summarized in Chinese. This must be a server-side key; do not reuse or copy a browser-stored key.

Do not commit any key to this repository or put a provider key in frontend JavaScript.

## Schedule and data window

`.github/workflows/deploy-pages.yml` runs at 06:07 Asia/Shanghai, with a 06:37 fallback run. The script collects the previous calendar day in the same timezone and writes at most 10 items.

The target mix is:

- 3 macro and geopolitics items
- 3 policy and regulation items
- 3 company and IPO items
- 1 highest-scoring remaining item

If fewer than 10 items meet the rules, the file contains fewer items instead of filler.

## Failure behavior

Each snapshot is written atomically. If the finance update fails, GitHub Actions keeps the previous successful snapshot and continues the Pages deployment. The UI marks snapshots older than two days as stale.

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

The selection, category quotas, deduplication, scoring, JSON schema, frontend loading, stale-state UI, and failure fallback have local tests. Tushare and Alpha Vantage coverage remain unverified until valid repository secrets and provider permissions are configured. A single successful run must not be treated as proof of long-term stability.
