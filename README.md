# PR Analytics Dashboard

A public, read-only PR analytics dashboard that automatically aggregates pull-request data across **all repositories your GitHub token can see**, grouped **by user** to surface team performance.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-org%2Fpr-review-dashboard&env=GITHUB_TOKEN&envDescription=GitHub%20PAT%20with%20repo%20or%20public_repo%20scope)

## Highlights

- Zero-picker landing page — opens with full data
- Works across **all orgs and all repos** the token has access to
- Sprint-based filtering with deep-linkable filters (`?orgs=…&repos=…&users=…`)
- Internal (R1) vs external (R2) reviewer classification with bot detection
- Aggressive caching (20 min TTL) and per-IP rate limiting
- CSV export with three grain options (comment / PR / user)
- Real-time activity charts: state distribution, daily trends, PR-size scatter, bot vs human, reviewer-load heatmap, stale PR radar
- Auto-refresh, saved views, share links, density toggle
- Keyboard-first: `r` refresh, `t` theme, `1`/`2`/`3` tabs, `/` search, `?` shortcuts, `Esc` clear
- Light / dark / system theme + high-contrast mode
- WCAG 2.1 AA conscious: keyboard navigable, screen-reader labels, `prefers-reduced-motion` aware

## ⚠️ Security: token scope = data scope

The dashboard URL is **public** (no login required). The `GITHUB_TOKEN` you set on the server determines what data the public can see.

| Deployment pattern                              | Token scope                          | Where to deploy                      |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------ |
| Public OSS dashboard                            | `public_repo`                        | Vercel public URL                    |
| Internal team dashboard                         | `repo`                               | Behind VPN / SSO / Cloudflare Access |
| Hybrid (token can see private, app filters out) | `repo` + `ALLOW_PRIVATE_REPOS=false` | Vercel public URL                    |

**Choose the right token for your visibility model.**

## Quick start

```bash
cp .env.example .env.local
# edit .env.local and set GITHUB_TOKEN

npm install
npm run dev
```

Visit `http://localhost:3000` — the dashboard auto-loads with full data once the token is configured.

## Configuration

See `.env.example` for the full list. Key vars:

- `GITHUB_TOKEN` (required, single PAT) — fine-grained or classic PAT
- `GITHUB_TOKENS` (optional) — comma-separated list of PATs for round-robin rotation; effective rate-limit becomes `5000 × N`
- `GITHUB_USE_GRAPHQL` (optional, default `false`) — when `true`, the aggregator hot path fetches PRs + comments + reviews in a single GraphQL query per page (≈50–98% fewer requests; falls back to REST automatically on failure)
- `MAX_REPOS_PER_AGGREGATION` (default 50) — caps fan-out per cache miss
- `MAX_PRS_PER_REPO` (default 1000) — caps per-repo PR fetch
- `EXTRA_PUBLIC_REPOS` — comma-separated `owner/repo` list to inject for demos
- `EXTRA_PUBLIC_REPOS_ONLY` (default false) — when true, only fetch the listed repos (skips token-discovery)
- `ALLOW_PRIVATE_REPOS` (default true) — set `false` to force public-only
- `INCLUDE_ARCHIVED` / `INCLUDE_FORKS` — default false
- `RATE_LIMIT_PER_MIN` (default 60)
- `CACHE_PROVIDER` — `memory` (default) or `redis`
- `LOG_LEVEL` — pino level: `debug` / `info` / `warn` / `error`

## Data files

- `data/team.json` — internal team membership (R1) + bot list
- `data/sprint.json` — sprint definitions with active sprint id

Edit these to match your team and sprint cadence; the server picks up changes on restart.

## API endpoints

| Endpoint                    | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `GET /api/health`           | Liveness check; add `?deep=1` for token + GitHub API verification |
| `GET /api/config`           | Safe app config (sprints, app name)                               |
| `GET /api/discover`         | Token-accessible orgs and repos                                   |
| `GET /api/github/aggregate` | Main aggregation (all filters optional)                           |
| `GET /api/export`           | CSV export; `?grain=comment\|pr\|user`                            |

## Keyboard shortcuts

| Key       | Action                          |
| --------- | ------------------------------- |
| `/`       | Focus search                    |
| `Esc`     | Clear search (when focused)     |
| `r`       | Refresh data                    |
| `t`       | Toggle theme                    |
| `1/2/3`   | Switch tabs (Users/Repos/Activity) |
| `?`       | Show this help modal            |

## Architecture

```
Client (Next.js, public)
   ↓
TanStack Query → /api/github/aggregate
   ↓
Per-IP rate limit → L1 cache → discovery
   ↓
GitHub REST (concurrency-limited p-limit=8, multi-token round-robin)
   ↓
Normalize → R1/R2 classify → bot filter → aggregate
   ↓
Cache (TTL 20m)
```

See `req.md` (project root) for the full spec, and `ENHANCEMENTS.md` for the upgrade backlog.

## License

MIT
