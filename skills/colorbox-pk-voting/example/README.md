# PK Vote Example

This directory is a reference implementation for the `pk-voting` skill.

## Contents

- `index.html`: standalone mobile-first H5 using ColorboxAI Cloud auth/request and optional OSS upload.
- `cloudfunctions/activity_api/`: the fixed Node.js HTTP function for public reads and authenticated voting.
- `migrations/20260828220000_create_pk_vote.sql`: PostgreSQL tables, indexes, seed data, grants, and the transactional vote RPC.

## Frontend configuration

Copy `index.html` to the activity's `h5/index.html`, then replace:

- `window.ACTIVITY_API_BASE` with the exact URL returned by `queryGateway(action="getAccess")`; do not construct a gateway domain.
- `window.ACTIVITY_ENV_ID` with the canonical CloudBase environment ID.
- `window.PK_MATCH_ID` with the deployed match ID.

Only `file://`, `localhost`, and `127.0.0.1` use the built-in demonstration match. A deployed page with missing configuration or an unavailable SDK shows a configuration error instead of silently falling back to demo data.

## API contract

| Method | Path | Gateway auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | public | Function health check. |
| `GET` | `/api/pk/matches/:matchId` | public | Match configuration and both candidates. |
| `GET` | `/api/pk/matches/:matchId/results` | public | Current counts, percentages, and total votes. |
| `GET` | `/api/pk/me?matchId=:matchId` | authenticated | Current user's vote and remaining count. |
| `POST` | `/api/pk/votes` | authenticated | Body `{ "matchId": "...", "side": "left|right", "proofUrl": "https://..." }`. |

Responses use `{ "code": 0, "message": "success", "data": ..., "requestId": "..." }`. The gateway context is the only identity source; neither the page nor the function accepts a client `puid`.

If the gateway cannot split authentication by method/path in one access entry, create separate public read and authenticated write access paths that still target the same `activity_api` function. Keep `/health`, match, and result reads public; require auth for `/pk/me` and `/pk/votes`.

## Deployment and smoke checks

1. Replace the seed match, candidates, schedule, and copy in the migration, then apply it to a new activity environment.
2. Deploy `cloudfunctions/activity_api` as one Node.js HTTP Function listening on port `9000`.
3. Configure explicit CORS, gateway access, and invoke permission. Read back the real public URL and write it into both the H5 and manifest.
4. Verify `GET /health`, public match/result reads, and `OPTIONS /pk/votes` against that exact URL.
5. Verify unauthenticated `/pk/me` and `/pk/votes` return `401`, an authenticated vote returns `201`, a duplicate vote returns `409`, and the result count and `/pk/me` state agree afterward.
6. Inspect all three table schemas and query the seeded match. Generate the activity's manifest from the actual deployed resources, then record the schema and route verification evidence.

The candidate table stores bounded summary counts so public result reads never scan the vote detail table. `submit_pk_vote` serializes attempts per match/user with a PostgreSQL advisory transaction lock, validates the schedule and side, inserts the detail row, and increments the candidate count in one transaction.
