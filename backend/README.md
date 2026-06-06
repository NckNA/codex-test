# DentalFlow Integration Proxy

## Purpose
This backend acts as a secure integration proxy bridging DentalFlow with external CRMs (like amoCRM). It ensures that medical data is safely separated from commercial sync operations and manages third-party authentication securely.

## Why this backend exists
- The frontend must NOT store amoCRM access or refresh tokens.
- Exposing the OAuth `client_secret` in the frontend is a critical security vulnerability.
- Server-side proxies can reliably handle rate-limiting, webhook processing, retries, and token rotation without depending on the user's browser state.

## Current AMO-003 Scope
This project is currently a **skeleton prototype**. 
It provides the basic folder structure, safe environment variable loading, simple internal routing without external dependencies, and stubbed API endpoints.

## What is not implemented yet
- **Real OAuth:** The OAuth 2.0 flow is not implemented.
- **Real amoCRM API Calls:** No network requests are made to amoCRM.
- **Frontend Connection:** The DentalFlow frontend does not yet call this backend.
- **Token Persistence:** Tokens are not saved to a database or disk.

## How to run locally
1. Ensure Node.js is installed.
2. Inside the \`backend/\` directory, run \`npm run start\` or \`npm run dev\`.
3. The server will start on port 4000 (or the port defined in \`.env\`).

## Available endpoints
- \`GET /health\` -> Returns simple health status.
- \`GET /api/integrations/amocrm/status\` -> Returns connected status (always false for now).
- Various \`POST /api/integrations/amocrm/*\` -> Return 501 Not Implemented placeholders.

## Security rules
- No tokens in the frontend codebase.
- No `client_secret` exposed.
- No medical data (e.g., findings, diagnoses) should ever be sent to amoCRM. Only commercial and administrative data is allowed.

## Future AMO-004/AMO-005 tasks
- Implement the OAuth 2.0 exchange and securely store access/refresh tokens in a database.
- Create outbound sync logic using the pure mapper functions.
- Setup inbound webhook handlers to update CRM lead statuses in DentalFlow.
