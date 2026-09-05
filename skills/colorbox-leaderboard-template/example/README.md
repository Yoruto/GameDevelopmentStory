# Leaderboard Example

This directory is a reference implementation for the `leaderboard-template` skill.

## Contents

- `index.html`: mobile-first H5 page using `window.ColorboxAI.cloud.auth` and `window.ColorboxAI.cloud.request`.
- `cloudfunctions/activity_api/`: Node.js HTTP function for the leaderboard API.
- `migrations/20260828210000_create_leaderboard.sql`: PostgreSQL migration that reuses the platform `demo_items` baseline as `leaderboard_entries`.

## API contract

- `GET /api/leaderboard`: authenticated top 50 entries, sorted by score descending, then `updated_at` ascending.
- `GET /api/leaderboard/me`: authenticated current-user score and rank.
- `POST /api/leaderboard/submit`: authenticated body `{ "score": 123, "displayName": "..." }`; the user ID comes from the gateway context, never from the body.
- `GET /api/health`: public health check.

The migration stores one highest score per user with a unique `puid` index and uses a PostgreSQL function for an atomic higher-score upsert. The function example includes grants and disables RLS on the activity table; review the environment's security policy before applying it.

Before deploying an adapted example, replace the page's `ACTIVITY_API_BASE` and `ACTIVITY_ENV_ID` with values from the actual activity environment, configure gateway auth/CORS, and run authenticated read/write smoke tests.
