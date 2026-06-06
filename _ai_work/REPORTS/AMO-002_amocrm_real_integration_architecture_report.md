# AMO-002 amoCRM Real Integration Architecture Report

## What was created
- Designed the real amoCRM integration architecture without writing API code.
- Created architectural documents covering system design, field mapping, security rules, and sync strategy.
- Concluded that a dedicated Node.js backend/proxy is required to handle OAuth tokens securely.

## Files Added
- `_ai_work/AMOCRM_INTEGRATION_ARCHITECTURE.md`
- `_ai_work/AMOCRM_FIELD_MAPPING.md`
- `_ai_work/AMOCRM_SECURITY_RULES.md`
- `_ai_work/AMOCRM_SYNC_STRATEGY.md`
- `_ai_work/REPORTS/AMO-002_amocrm_real_integration_architecture_report.md`

## Files Changed
- `_ai_work/PROJECT_ROUTES.md` (Updated integration status)
- `_ai_work/RISKS.md` (Appended new integration risks)

## Official Docs Reviewed
- amoCRM API v4 concepts (OAuth 2.0 flow, contacts, leads/deals, webhooks, rate limits). This informed the decision to separate concerns using a backend proxy.

## Key Architecture Decisions
- **Proxy Requirement:** A Node.js backend proxy is necessary to handle OAuth callbacks, securely store access/refresh tokens, process webhooks, and manage rate limits.
- **Medical Isolation:** Strict boundaries defined to prevent medical records (dental charts, clinical findings) from leaking into amoCRM sales payloads.
- **Phased Sync Strategy:** Phase 1 pushes data to amoCRM. Phase 2 introduces limited webhook-driven inbound updates (status updates only).

## What was intentionally not implemented
- No `src/` changes.
- No real amoCRM API calls or complex JSON payloads.
- No OAuth flow or token storage logic.
- No backend code (`server.js`, serverless functions, etc.).

## Why frontend must not store tokens
Storing tokens in the frontend exposes them to malicious users (via local storage or network interception). amoCRM uses an OAuth 2.0 flow that requires a `client_secret` to exchange authorization codes for access tokens. Exposing the `client_secret` in client-side React code completely compromises the integration security. All token generation, storage, and refresh mechanisms must occur server-side.

## Future Task Recommendations
- **AMO-003:** Initialize the Node.js backend proxy repository/service and implement the secure OAuth 2.0 flow and token storage database.
- **AMO-004:** Implement outbound sync via the proxy, mapping DentalFlow `Patient` and `TreatmentPlan` models directly into amoCRM v4 JSON payloads.
