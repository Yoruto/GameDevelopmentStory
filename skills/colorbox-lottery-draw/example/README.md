# Draw Example

This directory is the reference implementation for the `lottery-draw` skill. It is a standalone, mobile-first H5 with a CloudBase HTTP Function and PostgreSQL migration.

## Contents

- `index.html`: native HTML/CSS/JS card-pool page. It uses public `GET /api/pool`, authenticated quota/history reads, authenticated draw requests, and optional user-selected image uploads through `window.ColorboxAI.oss.uploadFile`.
- `cloudfunctions/activity_api/`: one HTTP function listening on port `9000`, with `/health`, `/pool`, `/draw/quota`, `/draw/results`, and `POST /draw` routes.
- `migrations/20260828220000_create_draw.sql`: renames the platform `demo_items` baseline to `draw_pools`, creates prize, quota, session, and draw-record tables, seeds a pool, and installs the transactional `perform_draw` RPC.

## API contract

- `GET /api/health`: public health check.
- `GET /api/pool?poolId=default`: public pool configuration, display odds, available prizes, and a bounded list of recent public results. No user identity is accepted.
- `GET /api/draw/quota?poolId=default`: authenticated current-user remaining count and pity progress. The user ID comes from `x-cloudbase-context`.
- `GET /api/draw/results?poolId=default`: authenticated current-user draw records, capped at 50 rows.
- `POST /api/draw`: authenticated body `{ "poolId": "default", "drawCount": 1, "proofUrl": "https://..." }`. The function validates a count from 1 to 10 and the optional HTTPS proof URL. `X-Request-Id` is an RFC4122 UUID used for idempotency.

The `perform_draw` RPC locks the pool and user quota, checks activity dates and available attempts, selects a prize using the configured weight (or the pity prize at the threshold), decrements stock and quota, and inserts all records in one transaction. A repeated request ID returns the original session without drawing again. The browser never supplies a PUID, inventory, or result.

Before deploying an adapted example, replace `ACTIVITY_API_BASE`, `ACTIVITY_ENV_ID`, and `ACTIVITY_POOL_ID` with values from the actual activity and gateway. Read the gateway URL from `queryGateway`, then run health, CORS preflight, unauthenticated pool, authenticated quota/history, successful draw, insufficient-count, exhausted-stock, and duplicate-request smoke tests. Keep `example/` as a reference rather than publishing it directly.
