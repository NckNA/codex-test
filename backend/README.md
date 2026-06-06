
# DentalFlow Integration Proxy

## Purpose
This backend acts as a secure integration proxy bridging DentalFlow with external CRMs (like amoCRM). It ensures that medical data is safely separated from commercial sync operations and manages third-party authentication securely.

## Why this backend exists
- The frontend must NOT store amoCRM access or refresh tokens.
- Exposing the OAuth `client_secret` in the frontend is a critical security vulnerability.
- Server-side proxies can reliably handle rate-limiting, webhook processing, retries, and token rotation without depending on the user's browser state.

## How to configure
Copy `.env.example` to `.env` and fill in your integration variables.
**Warning:** Never commit real secrets or tokens into version control.

## How to run locally
1. Ensure Node.js is installed.
2. Inside the `backend/` directory, run `npm run start` or `npm run dev`.
3. The server will start on port 4000 (or the port defined in `.env`).

## Available endpoints
- `GET /health` -> Returns simple health status.
- `GET /api/integrations/amocrm/status` -> Returns connected status and domain. No tokens.
- `POST /api/integrations/amocrm/connect` -> Generates OAuth state and returns the `authorizationUrl` if configured.
- `GET /api/integrations/amocrm/callback` -> Validates state, exchanges the authorization code for tokens, and stores them in memory.
- `POST /api/integrations/amocrm/disconnect` -> Clears the in-memory token store.
- Various `POST /api/integrations/amocrm/sync-*` -> Return 501 Not Implemented placeholders.

## Warning: Dev-Only Token Store
The current `AMOCRM_TOKEN_STORE_MODE=memory` is strictly for the AMO-004 development skeleton. Tokens will disappear immediately if the server restarts. Production deployment requires encrypted, persistent, server-side database storage.

## Security rules
- No tokens in the frontend codebase.
- No `client_secret` exposed or logged anywhere.
- No medical data (e.g., findings, diagnoses) should ever be sent to amoCRM. Only commercial and administrative data is allowed.
