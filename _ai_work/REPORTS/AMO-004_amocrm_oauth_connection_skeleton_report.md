# AMO-004 amoCRM OAuth Connection Skeleton Report

## What was implemented
- Implemented `createOAuthState()` and `validateOAuthState()` in a new state store for generating one-time, expiring, secure tokens.
- Upgraded the dev-only memory token store to securely track tokens and `accountDomain` without exposing raw values to the API.
- Implemented `buildAuthorizationUrl()` and `exchangeAuthorizationCode()` using native `fetch` exclusively targeted at the amoCRM OAuth endpoint.
- Connected these modules into the `/api/integrations/amocrm/connect`, `/callback`, `/status`, and `/disconnect` backend routes.
- Updated relevant markdown documentation explaining the limitations and security boundaries of this dev-only setup.

## Files Added
- `backend/src/services/amoCrmStateStore.js`
- `_ai_work/REPORTS/AMO-004_amocrm_oauth_connection_skeleton_report.md`

## Files Changed
- `backend/.env.example`
- `backend/README.md`
- `backend/src/config.js`
- `backend/src/routes/amoCrmRoutes.js`
- `backend/src/server.js`
- `backend/src/services/amoCrmClient.js`
- `backend/src/services/amoCrmTokenStore.js`
- `_ai_work/AMOCRM_INTEGRATION_ARCHITECTURE.md`
- `_ai_work/AMOCRM_SECURITY_RULES.md`
- `_ai_work/AMOCRM_SYNC_STRATEGY.md`
- `_ai_work/PROJECT_ROUTES.md`
- `_ai_work/RISKS.md`

## Dependency Decision
I deliberately avoided introducing external dependencies (like `dotenv`, `axios`, or `express`). Native Node.js features like `crypto.randomBytes`, `Map`, `http.createServer`, and global `fetch` (standard in Node.js v18+) were heavily utilized. `fetch` is scoped explicitly inside `amoCrmClient.js` strictly for OAuth and handles its own exception formatting to hide raw outputs.

## OAuth Endpoints Behavior
- **`/connect`**: Generates a 32-byte hex state, stores it alongside its creation timestamp, and returns a redirect link to amoCRM's `/oauth` page. Returns 400 if `.env` variables are missing.
- **`/callback`**: Receives `code`, `state`, and `referer`. Validates the state's authenticity and lifetime (10 minutes max). On success, utilizes native `fetch` to POST `client_secret` and code against the target domain.
- **`/status`**: Safely outputs `connected`, `accountDomain`, and `expiresAt`. Drops tokens entirely.
- **`/disconnect`**: Wipes the in-memory state.

## Security Boundaries
- Secrets are pulled from memory, sent outward to amoCRM directly via POST, and the response is immediately destructured.
- The `client_secret` is never logged and never included in error responses.
- `state` is pruned passively preventing memory leaks over time.
- No medical or clinical keywords interact with this workflow.

## What was intentionally not implemented
- Frontend React connection implementation.
- Sync logic for Treatment Plans and Patients.
- Production-grade database token storage.

## How to run backend
- Open terminal in `backend/` directory.
- Start server using `npm run start` or `npm run dev`.

## How to test manually
- Start server on `localhost:4000`.
- Verify `GET http://localhost:4000/api/integrations/amocrm/status` defaults safely.
- With `.env` populated, executing `POST http://localhost:4000/api/integrations/amocrm/connect` will return the safe URL string.

## Verification
See final task output for test automation logs (`npm run check`).
