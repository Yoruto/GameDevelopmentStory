# Result Poster Posting Example

This directory is a reference implementation for the `result-poster-posting` skill.

`index.html` is a standalone mobile-first H5. It renders a result object to a local Canvas poster and, only after the user clicks `发帖分享`, uploads the PNG through `window.ColorboxAI.oss.uploadFile` before opening the Hupu editor with `window.ColorboxAI.request.bbs.openPostEditor`.

The optional backend reference keeps the result data in the activity environment:

- `cloudfunctions/activity_api/`: the fixed `activity_api` function with `GET /api/health`, authenticated `GET /api/result/me`, and authenticated `POST /api/result/save`.
- `migrations/20260828213000_create_result_poster_results.sql`: renames the platform `demo_items` baseline to `result_poster_results`, adds result fields, a unique user index, and the `save_result_poster_result` RPC.

The page's built-in `result` object is deliberately used for local preview. In a deployed activity, load the authenticated result through `window.ColorboxAI.cloud.auth` and `window.ColorboxAI.cloud.request`, then replace that object before rendering. The backend never receives the poster Blob: the browser uploads it directly through the OSS capability and passes the returned absolute HTTPS CDN URL only to the post editor.

The page is intentionally usable when opened directly from disk: it shows the demo result and local poster, while the share action explains that the Hupu App SDK is required. Before publishing, apply the migration, deploy the fixed `activity_api`, replace the `result` object and optional `topicId`/`tagId`, then verify login, result save/read, upload, cancellation, editor failure, and CDN URL validation in the Hupu App.
