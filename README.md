# PR Analytics Dashboard

A public, read-only PR analytics dashboard that automatically aggregates pull-request data across **all repositories your GitHub token can see**, grouped **by user** to surface team performance.

- Zero-picker landing page — opens with full data
- Works across **all orgs and all repos** the token has access to
- Sprint-based filtering with optional drill-downs (orgs, repos, users, state, reviewer type)
- Internal (R1) vs external (R2) reviewer classification
- Aggressive caching (20 min TTL) and per-IP rate limiting
- CSV export
- Dark / light / system theme

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

- `GITHUB_TOKEN` (required) — PAT or fine-grained token
- `MAX_REPOS_PER_AGGREGATION` (default 50) — caps fan-out per cache miss
- `ALLOW_PRIVATE_REPOS` (default true) — set `false` to force public-only
- `INCLUDE_ARCHIVED` / `INCLUDE_FORKS` — default false
- `RATE_LIMIT_PER_MIN` (default 60)
- `CACHE_PROVIDER` — `memory` (default) or `redis`

## Data files

- `data/team.json` — internal team membership (R1) + bot list
- `data/sprint.json` — sprint definitions with active sprint id

Edit these to match your team and sprint cadence; the server picks up changes on restart.

## API endpoints

| Endpoint                    | Description                             |
| --------------------------- | --------------------------------------- |
| `GET /api/health`           | Health check + cache stats              |
| `GET /api/config`           | Safe app config (sprints, app name)     |
| `GET /api/discover`         | Token-accessible orgs and repos         |
| `GET /api/github/aggregate` | Main aggregation (all filters optional) |
| `GET /api/export`           | CSV export with same filter contract    |

## Architecture

```
Client (Next.js, public)
   ↓
TanStack Query → /api/github/aggregate
   ↓
Per-IP rate limit → L1 cache → discovery
   ↓
GitHub REST (concurrency-limited, p-limit=8)
   ↓
Normalize → R1/R2 classify → bot filter → aggregate
   ↓
Cache (TTL 20m)
```

See `req.md` (project root) for the full spec.
