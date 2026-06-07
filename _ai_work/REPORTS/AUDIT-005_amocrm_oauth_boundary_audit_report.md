# AUDIT-005 amoCRM/OAuth Boundary Audit Report

## Task ID
AUDIT-005

## Summary
This is a read-only audit of the current amoCRM/OAuth frontend-backend boundary in DentalFlow CRM. The audit inspects how the amoCRM integration code is split between the React frontend and the Node.js backend proxy, looking specifically for medical data leakage, token exposure, runtime connections, and gaps against the target multi-tenant secure architecture.

## Files inspected

### Frontend amoCRM files
- `src/integrations/amocrm/amoCrmMapper.ts`
- `src/integrations/amocrm/amoCrmTypes.ts`
- `src/components/treatment/TreatmentPlansTab.tsx` (contains disabled amoCRM sync button)
- `src/components/patients/PatientModal.tsx` (amoCRM lead source)
- `src/pages/PatientsPage.tsx` (amoCRM lead source styling)
- `src/pages/PatientCardPage.tsx` (amoCRM lead source label)

### Backend amoCRM routes/services
- `backend/src/routes/amoCrmRoutes.js`
- `backend/src/services/amoCrmClient.js`
- `backend/src/services/amoCrmStateStore.js`
- `backend/src/services/amoCrmTokenStore.js`

### Backend config/env files
- `backend/src/config.js`
- `backend/.env.example`
- `backend/README.md`

### Related source documents
- `_ai_work/SOURCES/09_AMOCRM_INTEGRATION_RULES.md`
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`

---

## Current boundary overview

The current integration boundary is completely disconnected. There is no active communication between the frontend and the backend.

- **What exists in frontend:** A data mapper (`amoCrmMapper.ts`) that extracts safe commercial fields from DentalFlow entities to create amoCRM DTOs, plus a disabled UI button.
- **What exists in backend:** A minimal HTTP server skeleton that successfully handles the amoCRM OAuth 2.0 authorization code flow (state generation, callback, token exchange) and stores the resulting tokens in a global memory variable.
- **Frontend calling backend:** ❌ Does not exist. The frontend never makes HTTP requests to the backend (no `fetch`/`axios` calls to `/api/integrations` or `localhost:4000` exist).
- **Frontend calling amoCRM directly:** ❌ Does not exist. The frontend never calls the external amoCRM API.
- **Backend real external OAuth exchange:** ✅ Exists. The backend `exchangeAuthorizationCode` function makes a real `fetch` to `https://www.amocrm.ru/oauth2/access_token`.
- **Sync implementation:** ❌ Placeholder. Backend sync endpoints (`/sync-patient`, `/sync-treatment-plan`) return `501 Not Implemented`.

---

## Frontend amoCRM inventory

### `src/integrations/amocrm/amoCrmMapper.ts`
- **Purpose:** Transforms DentalFlow `Patient` and `TreatmentPlan` objects into safe amoCRM contact and lead drafts.
- **Inputs:** `Patient`, `TreatmentPlan` objects.
- **Outputs:** `AmoCrmContactDraft`, `AmoCrmLeadDraft`, `AmoCrmSyncPreview`.
- **Network calls:** ❌ None. Pure functions only.
- **Stores data:** ❌ None.
- **Handles tokens/secrets:** ❌ None.
- **Risk notes:** Very safe. It is an isolated utility file that is not currently imported or used anywhere else in the application.

### `src/integrations/amocrm/amoCrmTypes.ts`
- **Purpose:** Defines TypeScript interfaces for the outgoing amoCRM DTOs (`AmoCrmContactDraft`, `AmoCrmLeadDraft`, `AmoCrmSyncPreview`).
- **Network/Storage/Secrets:** ❌ None.

### Pages/Components referencing amoCRM
- `TreatmentPlansTab.tsx`: Contains a button with the text "amoCRM: после подключения". The button is hardcoded as `disabled` with `cursor-not-allowed` and no `onClick` handler.
- `PatientModal.tsx` / `PatientsPage.tsx` / `PatientCardPage.tsx`: Reference `amocrm` strictly as a string value for the `PatientSource` enum (e.g., "Source: amoCRM").

---

## Backend amoCRM route inventory

Located in `backend/src/routes/amoCrmRoutes.js`.

| Method | Path | Purpose | Input | Output | Token/State Behavior | Limitations |
|---|---|---|---|---|---|---|
| GET | `/api/integrations/amocrm/status` | Check connection status | None | JSON with `connected`, `accountDomain` | Reads from `amoCrmTokenStore` | Global status only, not tenant-scoped. |
| POST | `/api/integrations/amocrm/connect` | Start OAuth flow | None | JSON with `authorizationUrl` | Creates new OAuth state | No auth/tenant check. Any caller can trigger. |
| GET | `/api/integrations/amocrm/callback` | OAuth callback | `code`, `state`, `referer` | JSON success/error | Validates state, exchanges code, saves tokens | State deleted after use. Tokens saved globally. |
| POST | `/api/integrations/amocrm/disconnect` | Clear integration | None | JSON success | Clears global token store | No auth check. Any caller can disconnect. |
| POST | `/api/integrations/amocrm/webhook` | Receive amoCRM events | None | `202 Accepted` | None | Placeholder. Ignores all events. |
| POST | `/api/integrations/amocrm/sync-patient` | Sync patient | None | `501 Not Implemented` | None | Placeholder. |
| POST | `/api/integrations/amocrm/sync-treatment-plan` | Sync plan | None | `501 Not Implemented` | None | Placeholder. |

---

## Backend amoCRM service inventory

### `amoCrmClient.js`
- **Purpose:** Builds the OAuth URL and performs the token exchange via `fetch`.
- **External calls:** ✅ POSTs to `oauth2/access_token` on the amoCRM domain.
- **Storage:** None directly.
- **Error handling:** Catches network errors, explicitly strips raw response data to avoid logging or returning secrets to the frontend.
- **Security notes:** Safe error handling. Includes `client_secret` in the server-to-server payload (correct OAuth behavior).
- **Limitations:** Does not implement token refresh logic.

### `amoCrmStateStore.js`
- **Purpose:** Generates, stores, and validates secure one-time OAuth state strings to prevent CSRF.
- **Functions:** `createOAuthState`, `validateOAuthState`, `clearExpiredOAuthStates`.
- **Storage approach:** In-memory `Map()`.
- **Security notes:** State is cryptographically random (32 bytes hex), expires after 10 minutes, and is strictly one-time use (deleted immediately upon validation).
- **Limitations:** States are not associated with a specific tenant or user.

### `amoCrmTokenStore.js`
- **Purpose:** Stores the exchanged amoCRM access and refresh tokens.
- **Functions:** `getConnectionStatus`, `saveTokenSet`, `getTokenSet`, `clearTokenSet`.
- **Storage approach:** Single in-memory variable `currentTokenSet`.
- **Security notes:** `getConnectionStatus()` explicitly strips `accessToken` and `refreshToken` before returning the object. Tokens are never sent to the client.
- **Limitations:** Memory-only (lost on server restart). Single-tenant (one global variable). `expiresAt` is saved but never actively checked.

---

## OAuth flow assessment

The current OAuth flow successfully implements a server-side OAuth 2.0 pattern suitable for a dev skeleton:
1. **Authorization URL:** Generated server-side, includes a secure state.
2. **State creation:** Cryptographically secure, 10-minute TTL, one-time use.
3. **Callback validation:** State is validated and burned.
4. **Token exchange:** Server-to-server POST request; client secret is never exposed.
5. **Token storage:** Memory-only.
6. **Refresh token behavior:** ❌ Not implemented. Token expires and requires manual reconnect.
7. **Tenant/user association:** ❌ Not implemented. The state and tokens are global to the server instance.

---

## Token and secret exposure assessment

- **`client_secret` in frontend:** ❌ Not found.
- **`access_token` in frontend:** ❌ Not found.
- **`refresh_token` in frontend:** ❌ Not found.
- **Bearer token references in frontend:** ❌ Not found.
- **Tokens returned to frontend:** ❌ No. Backend explicitly filters them out in `/status` and `/callback`.
- **Tokens logged:** ❌ No. Backend has no logging of tokens or request payloads.
- **Secrets in `.env.example`:** ❌ No. Values are empty.
- **Real `.env` committed:** ❌ No.
- **Token store behavior:** Safe (in-memory, filtered on output), but fundamentally ephemeral.

---

## Mapper payload assessment

The `amoCrmMapper.ts` defines what the frontend *would* send to the backend for sync.

### For contact draft (`mapPatientToAmoContactDraft`)
- **Fields included:** `name`, `phone`, `email` (undefined).
- **Source fields:** `Patient.fullName`, `Patient.phone`.
- **Medical data included:** ❌ None.

### For lead draft (`mapTreatmentPlanToAmoLeadDraft`)
- **Fields included:** `name` (plan title + patient name), `price` (totalPrice), `status`, `source`.
- **Source fields:** `TreatmentPlan.title`, `TreatmentPlan.totalPrice`, `Patient.integration.leadStatus`, `Patient.integration.source`.
- **Medical data included:** ❌ None.

### For sync preview (`buildAmoSyncPreview`)
- **Fields included:** `contact`, `lead`, `warnings`.
- **Warnings behavior:** Generates warnings if the patient lacks a phone number or if the plan price is 0.

---

## Medical data leakage assessment

The audit searched for medical fields (`toothNumber`, `dentalChart`, `finding.description`, `diagnosis`, `MedicalDocument`, etc.) in the integration boundary.

- **Found:** ❌ Not found.
- **Where searched:** Frontend `amoCrmMapper.ts`, frontend `amoCrmTypes.ts`, and all backend source files.
- **Assessment:** The integration payload is completely clean of medical data. The frontend mapper successfully extracts only administrative/commercial summary data (names, phones, totals, statuses). No medical details cross the amoCRM boundary.

---

## Tenant/auth/permission boundary assessment

The current integration proxy is a generic skeleton and completely lacks the SaaS multi-tenant boundary.

- **`tenantId`:** ❌ Absent in routes, states, and tokens.
- **`userId`:** ❌ Absent.
- **Auth guard:** ❌ Absent. Endpoints are unprotected.
- **Permission guard:** ❌ Absent.
- **Feature entitlement:** ❌ Absent.
- **Subscription/access check:** ❌ Absent.
- **Tenant-scoped token storage:** ❌ Absent.
- **Audit log:** ❌ Absent.

**Current limitation:** Any user (or external script) that can reach `localhost:4000` can connect, disconnect, or view the status of the single global amoCRM connection.

---

## Sync and webhook readiness

- **sync-patient status:** ❌ Placeholder (`501 Not Implemented`).
- **sync-treatment-plan status:** ❌ Placeholder (`501 Not Implemented`).
- **webhook status:** ❌ Placeholder (returns `202 Accepted` but ignores payload).
- **Idempotency:** ❌ None.
- **Webhook validation:** ❌ None.
- **Safe sync logs:** ❌ None.
- **Retry/refresh:** ❌ None.
- **Persisted external IDs:** ❌ None.

---

## Frontend/backend mismatch and risks

1. **Complete Disconnection:** The frontend has a mapper, and the backend has an OAuth proxy, but the frontend never calls the backend API to connect, disconnect, or check status.
2. **Missing UI:** There is no UI in the frontend settings to initiate the amoCRM OAuth flow.
3. **No Database:** Token storage is memory-only. If the backend restarts, the amoCRM connection drops.
4. **Single-Tenant Risk:** Before any frontend UI is wired up to the backend, the backend MUST be upgraded to support `tenantId` authentication, or else the first clinic to connect will overwrite the connection for everyone.
5. **CORS:** The backend lacks CORS headers, meaning the React frontend (`localhost:5173`) currently cannot make requests to the backend (`localhost:4000`) due to browser security policies.

---

## Security observations

### Positive observations
- Medical data filtering is successfully implemented in the frontend mapper.
- OAuth flow correctly avoids passing tokens to the frontend.
- OAuth state correctly mitigates CSRF.
- No secrets are leaked in code or `.env.example`.

### Gaps / Blockers before real sync
- **BLOCKER:** Missing CORS headers on the backend.
- **BLOCKER:** Token storage is memory-only and not persisted.
- **BLOCKER:** No authentication or tenant isolation (single global token).
- **BLOCKER:** No sync logic actually implemented.

---

## Recommended safe next steps

The boundary is safe because it is entirely disconnected and medical data is properly filtered. However, significant backend infrastructure is required before real sync can occur.

**Recommended sequence:**
1. **QA-001** — Create current prototype smoke test checklist (to stabilize the current prototype before major backend work).
2. **CLEAN-001** — Identify fake actions and risky placeholders in the UI.
3. **AMO-PLAN-001** — Plan the safe amoCRM integration boundary (CORS, API contracts) before implementation.
4. **AMO-FE-001** — Connect frontend settings UI to backend status/connect endpoints (requires CORS).
5. **AMO-BE-002** — Add tenant/auth placeholders and database persistence for tokens.

---

## Checks

- `git status --short`: Clean (only report file added)
- `Get-ChildItem -Path src ... | Select-String "client_secret|token|Bearer|access_token"`: 0 matches in frontend.
- `Get-ChildItem -Path src ... | Select-String "amoCrmMapper"`: 0 matches (mapper is unused).
- `npm run lint`: ✅ 0 errors, 1 warning (pre-existing in `DentalChartTab.tsx`).
- `npm run build`: ✅ Success.
- `node --check backend/src/*.js`: ✅ All backend syntax checks passed.

---

## Safety notes

- This was an **audit-only task**.
- No source code changed.
- No backend code changed.
- No package files changed.
- No dependencies added.
- No real patient data added.
- No secrets added.
- No `.env` file created or changed.
- No external API call was executed intentionally.

---

## What was not implemented

- No code changes made.
- No backend changes made.
- No frontend changes made.
- No amoCRM real sync implemented.
- No OAuth changes made.
- No token persistence implemented.
- No auth/tenant implementation added.
- No database implementation added.
- No fixes applied.

---

## Issues or observations

The amoCRM integration is completely disconnected between frontend and backend, and the backend acts as a single-tenant memory-only proxy. This is perfectly acceptable for a prototype skeleton, but it means **no real sync can occur** until database persistence and tenant isolation are implemented. No blocking integration issues were fixed or modified because this task was audit-only.

## Recommended next step
**QA-001** — Create current prototype smoke test checklist.
