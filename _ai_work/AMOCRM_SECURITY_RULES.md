# amoCRM Security Rules

## Token Handling
Strict rules regarding the management and storage of amoCRM API authentication tokens:
- No tokens (access or refresh) are allowed in the frontend codebase.
- No `client_secret` is allowed in the frontend codebase.
- No tokens are allowed to be stored in the browser's `localStorage` or `sessionStorage`.
- No tokens are allowed to be committed to Git.
- No tokens are allowed to be documented in `_ai_work/` markdown files.
- Tokens **must** be stored securely server-side inside the integration proxy/backend database.
- Refresh tokens must be protected and used strictly by the backend for automatic rotation.
- Application logs (both frontend and backend) must never output or contain raw tokens.

## Medical Data Protection
DentalFlow is a clinical tool. amoCRM is a sales tool. Preventing medical data leakage is paramount:
- Do not send clinical findings to amoCRM.
- Do not send dental chart status or history to amoCRM.
- Do not send medical diagnoses to amoCRM.
- Do not send `riskDescription` or hazard alerts to amoCRM.
- Do not send tooth-level specific treatment details to amoCRM.
- **Rule:** Send only commercial, administrative, and contact summaries (Name, Phone, Lead Source, Plan Price) to amoCRM.

## Permission Model
Future implementation requirements for access control:
- Only users with an `admin` or `owner` role can connect, configure, or disconnect the amoCRM integration.
- Regular doctors or administrative staff without system privileges should not see integration tokens or backend settings.
- All manual sync actions or integration configuration changes must be recorded in an audit log.

## Webhook Safety
Future implementation requirements for handling incoming webhooks from amoCRM:
- The backend must verify the webhook source (e.g., via IP whitelisting or signature if supported by amoCRM).
- Ignore webhooks for unknown entities (deals or contacts not mapped to DentalFlow IDs).
- **Critical:** Never let a webhook payload overwrite or alter medical data, dental charts, or clinical treatment plans.
- Log all webhook payload processing errors and sync failures securely.


## Storage and State (AMO-004 specific)
- The AMO-004 token store is a dev-only memory store and will be wiped on restart.
- No token should ever be exposed by the `/status` endpoint.
- Production token storage must be encrypted server-side.
- OAuth `state` is one-time use only and automatically expires after 10 minutes.
