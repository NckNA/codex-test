# AMOCRM-INTEGRATION-HARDENING-001 Foundation Report

## 1. Final verdict

AMOCRM INTEGRATION HARDENING IMPLEMENTED AND VERIFIED

## 2. Summary

Implemented a tenant-safe amoCRM OAuth and integration-account foundation for DentalFlow. The previous unauthenticated, process-global OAuth/token skeleton was replaced with a server-side boundary backed by tenant-bound database records, protected encrypted credential storage, hashed one-time OAuth state, authoritative amoCRM account verification, credential-versioned refresh leases, safe health responses, tenant-scoped disconnect/reconnect, and an identifier-only external-reference foundation.

This task performs no contact, lead, deal, task, note, message, or conversation synchronization. It sends no WhatsApp, SMS, or email messages and adds no worker, cron, inbound webhook, Chats API adapter, or cloud migration execution.

## 3. Branch

`feature/amocrm-integration-hardening-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/360

## 5. Baseline

- Repository: `NckNA/codex-test`
- Required baseline: `c431dde28612093ddf164ea4f84a3d9a9c2b7079`
- Verified `origin/main`: `c431dde28612093ddf164ea4f84a3d9a9c2b7079`
- PR #359 is contained in `origin/main`.
- No duplicate open or merged task with ID `AMOCRM-INTEGRATION-HARDENING-001` was found.
- Work was performed in a clean isolated worktree because the source checkout contained unrelated untracked files.

## 6. Final head

- Final implementation head: `29d26c1763b3ec6ed6acc547eb752acf3de85831`
- The report-only metadata commit necessarily follows the implementation head. A commit cannot embed its own SHA without changing that SHA; the exact final PR head is therefore recorded in PR #360 metadata and the final task response.

## 7. Changed files

37 files including this report:

- `.env.example`
- `backend/.env.example`
- `backend/README.md`
- `backend/package.json`
- `backend/src/config.js`
- `backend/src/mockAmoCrmServer.js`
- `backend/src/routes/amoCrmRoutes.js`
- `backend/src/routes/healthRoutes.js`
- `backend/src/server.js`
- `backend/src/services/amoCrmClient.js` (removed)
- `backend/src/services/amocrmIntegration.test.mjs`
- `backend/src/services/amoCrmIntegrationService.js`
- `backend/src/services/amoCrmMockTransport.js`
- `backend/src/services/amoCrmProviderClient.js`
- `backend/src/services/amoCrmStateStore.js` (removed)
- `backend/src/services/amoCrmTokenStore.js` (removed)
- `backend/src/services/credentialVault.js`
- `backend/src/services/requestContext.js`
- `backend/src/services/supabaseGateway.js`
- `backend/src/utils/jsonResponse.js`
- `src/components/integrations/AmoCrmIntegrationSettings.test.tsx`
- `src/components/integrations/AmoCrmIntegrationSettings.tsx`
- `src/data/hooks/useAmoCrmIntegration.test.tsx`
- `src/data/hooks/useAmoCrmIntegration.ts`
- `src/data/repositories/AmoCrmIntegrationRepository.test.ts`
- `src/data/repositories/AmoCrmIntegrationRepository.ts`
- `src/domain/integrations/amocrm/AmoCrmHealth.test.ts`
- `src/domain/integrations/amocrm/AmoCrmHealth.ts`
- `src/domain/integrations/amocrm/AmoCrmIntegration.test.ts`
- `src/domain/integrations/amocrm/AmoCrmIntegration.ts`
- `src/domain/integrations/amocrm/AmoCrmOAuthState.test.ts`
- `src/domain/integrations/amocrm/AmoCrmOAuthState.ts`
- `src/pages/SettingsPage.tsx`
- `supabase/migrations/0034_amocrm_integration_hardening.sql`
- `supabase/tests/0034_amocrm_integration_concurrency.ps1`
- `supabase/tests/0034_amocrm_integration_hardening_test.sql`
- `_ai_work/REPORTS/AMOCRM-INTEGRATION-HARDENING-001_foundation.md`

Historical migrations were not edited.

## 8. Pre-read

Reviewed:

- `AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001`
- `COMMUNICATION-ORCHESTRATION-FOUNDATION-001`
- `COMMUNICATION-TEMPLATE-FOUNDATION-001`
- existing backend amoCRM routes and service files
- old process-global state and token stores
- environment handling
- tenant membership and role helpers
- audit/activity internal functions
- current settings page, frontend auth/session context, tenant context, repository and hook patterns
- local Supabase, SQL, concurrency, Vitest, browser, and CI infrastructure

The reconnaissance findings were confirmed against the source before implementation.

## 9. Existing amoCRM inventory

### Replaced as insecure

- `backend/src/routes/amoCrmRoutes.js`: unauthenticated connect/callback/status/disconnect routes; replaced with authenticated tenant-scoped routes.
- `backend/src/services/amoCrmStateStore.js`: process-global OAuth `Map`; removed.
- `backend/src/services/amoCrmTokenStore.js`: process-global token state; removed.
- `backend/src/services/amoCrmClient.js`: mixed provider HTTP, referer trust, token handling, and placeholders; removed.
- callback tenant/account selection based on callback data alone; replaced by hashed state lookup and stored binding.
- global disconnect behavior; replaced by one-tenant transaction.
- placeholder webhook/synchronization methods; removed from the active contract.

### Reused or hardened

- minimal Node HTTP backend runtime: retained but rebuilt as a server-only integration boundary.
- existing Supabase authentication and `tenant_users`: reused for actor identity and independent role enforcement.
- existing audit/activity internal functions: reused through a redacted integration event helper.
- settings page and tenant context: reused for safe role-aware UI.

### Risks explicitly removed

- process-global credentials
- unauthenticated routes
- missing tenant binding
- missing role checks
- frontend token exposure risk
- refresh-token rotation race
- cross-tenant credential overwrite
- arbitrary callback tenant attachment
- provider raw error leakage

## 10. Official amoCRM API verification

Verified against current official documentation on 2026-07-14:

- Authorization URL: `https://www.amocrm.ru/oauth?client_id={Integration ID}&state={state}&mode={popup|post_message}`.
- Callback returns `code`, `referer`, and `state`; `state` is intended for CSRF verification.
- Authorization code lifetime: 20 minutes.
- Token exchange and refresh endpoint: `POST https://{account-domain}/oauth2/access_token`.
- Token response contains `access_token`, `refresh_token`, and `expires_in`; documented example access lifetime is 86,400 seconds.
- Refresh credentials rotate and must be replaced atomically. The official documentation warns that a refresh credential is single-use and expires if unused for three months.
- Account verification endpoint: `GET /api/v4/account`; authoritative fields include account `id`, `name`, and `subdomain`.
- Current limits: 7 requests/second per integration and 50 requests/second per account.
- amoCRM supports an optional integration-disconnect hook carrying `account_id` and `client_id`; this task intentionally does not add an inbound webhook.
- Token endpoint documented errors include HTTP 400 for invalid request data; application handling also maps 401/403, 429, 5xx, and network uncertainty to bounded safe states.

Official sources:

- https://www.amocrm.ru/developers/content/oauth/step-by-step
- https://www.amocrm.ru/developers/content/crm_platform/account-info
- https://www.amocrm.ru/developers/content/api/recommendations

## 11. Integration account model

Migration `0034_amocrm_integration_hardening.sql` creates `public.integration_accounts` with:

- exact `tenant_id` ownership
- provider code fixed to `amocrm`
- stable statuses: disconnected, authorization_pending, connected, refresh_required, degraded, account_mismatch, revoked, disabled
- authoritative external account ID and normalized domain
- display name
- credential version and token expiry
- connected/verified/refreshed/error/disconnected timestamps
- refresh lease token/version/expiry
- actor and audit timestamps
- archived timestamp and empty safe metadata

Uniqueness:

- one non-archived amoCRM integration account per tenant
- one active external amoCRM account ID across tenants
- tenant/account composite foreign-key ownership
- advisory transaction lock on authoritative external account ID for deterministic concurrent binding

## 12. Credential storage

`public.integration_credentials` stores only server-produced ciphertext:

- encrypted access credential
- encrypted refresh credential
- encryption key version
- credential version
- access expiry and refresh timestamps
- tenant and integration composite ownership

Security controls:

- RLS enabled
- no anon or authenticated SELECT
- no anon or authenticated INSERT/UPDATE/DELETE
- service-role-only functions perform credential mutations
- write-guard trigger rejects direct application writes outside the trusted internal boundary
- safe status functions never select or return credential columns
- audit/activity metadata allowlist excludes credential material

## 13. Encryption boundary

Implemented in `backend/src/services/credentialVault.js`:

- AES-256-GCM
- 96-bit random IV
- authenticated tag
- structured versioned ciphertext envelope
- 32-byte server-only key from `AMOCRM_CREDENTIAL_ENCRYPTION_KEY`
- integer `AMOCRM_CREDENTIAL_KEY_VERSION`
- no committed key material
- invalid/missing key fails closed as `configuration_error`
- encryption/decryption errors map to `encryption_error`

The frontend never receives plaintext or ciphertext. No XOR, base64-as-encryption, browser storage, or process-global credential store exists.

## 14. OAuth state model

`public.integration_oauth_states` stores:

- SHA-256 state hash only
- tenant ID
- integration account ID
- initiating user ID
- provider code
- expected account ID/domain when reconnecting
- redirect URI fingerprint
- short expiry
- callback exchange lease
- consumed/cancelled/failure terminal metadata

Raw state is generated as 32 cryptographically random bytes encoded as base64url, returned once in the authorization URL, and never persisted. New connection attempts cancel older unconsumed attempts for the same integration account.

## 15. Start connection

`startConnection(...)`:

1. authenticates the Supabase bearer session;
2. accepts current tenant header only as a selection hint;
3. independently verifies actor membership and owner/admin role in the database;
4. creates or reuses one stable integration account;
5. generates random state and persists only its hash;
6. binds state to tenant, actor, integration, provider, redirect fingerprint, and expiry;
7. returns only authorization URL, safe expiry, integration account ID, and safe status;
8. records one redacted connection-start event.

## 16. Callback flow

The callback:

1. hashes the received raw state;
2. locks and claims the corresponding state row with a one-time exchange lease;
3. rejects missing, expired, cancelled, consumed, or already-in-progress state before provider exchange;
4. resolves tenant, actor, integration, expected account, and redirect fingerprint from stored state;
5. exchanges authorization code server-side;
6. verifies token response shape;
7. calls `GET /api/v4/account` server-side;
8. normalizes authoritative ID/domain/name;
9. blocks expected-account mismatch and cross-tenant duplicate account binding;
10. encrypts both credentials;
11. atomically replaces credential row and increments version;
12. consumes state;
13. records redacted completion and account-verification events;
14. redirects with safe status/error identifiers only.

Authorization code, raw state, tokens, client secret, provider raw response, SQL error, stack trace, and ciphertext are absent from frontend responses, URLs, logs, and audit metadata.

## 17. Account identity verification

Authoritative identity comes from the amoCRM account endpoint, not from user input or callback `referer` alone:

- external account ID is stored as text
- domain/subdomain is normalized to a supported amoCRM/Kommo hostname
- display name is stored when present
- reconnect carries expected existing ID/domain in server-side OAuth state
- mismatch produces `account_mismatch` and preserves previously valid credentials
- refresh re-verifies account identity before committing rotated credentials

## 18. Account/domain binding

- Equivalent scheme, path, case, port, and trailing-dot forms normalize deterministically.
- Unsupported domains are rejected.
- Database uniqueness plus an advisory lock prevents the same authoritative amoCRM account from being silently attached to two tenants during a race.
- The losing tenant receives safe `account_already_bound` handling rather than a raw unique-constraint error.

## 19. Atomic refresh

Refresh is server-only and uses a lease/version protocol:

1. lock integration account and credential row;
2. return no-change if access remains sufficiently valid;
3. acquire a 60-second refresh lease for one credential version;
4. parallel loser receives `in_progress` and does not call amoCRM;
5. decrypt current refresh credential server-side;
6. call provider refresh endpoint once;
7. verify new token pair and account identity;
8. encrypt new pair;
9. commit only when lease token and expected credential version still match;
10. increment credential version exactly once;
11. clear lease and update safe health/audit metadata.

A stale refresher cannot overwrite a reconnect or disconnect winner.

## 20. Refresh failure model

Implemented bounded codes:

- temporary_provider_error
- invalid_grant
- credential_revoked
- account_mismatch
- network_timeout_before_response
- network_timeout_after_possible_acceptance
- encryption_error
- configuration_error

`invalid_grant`/revoke leads to `refresh_required`; account mismatch blocks operational use; temporary/timeout failures lead to degraded safe health. Failure preserves account identity, last known metadata, and credential version. An uncertain timeout is not blindly retried with a potentially rotated refresh credential.

## 21. Disconnect

Tenant-scoped disconnect:

- authenticates owner/admin
- locks one tenant integration
- deletes the active credential row, cryptographically removing application access to credentials
- cancels outstanding OAuth states
- clears token/refresh lease data
- preserves safe account identity and audit history
- leaves external references intact
- does not affect any other tenant
- is idempotent and audits only the first state-changing call

No provider entity is deleted.

## 22. Reconnect

Reconnect:

- reuses the stable integration account row
- creates a fresh OAuth state
- binds expected existing external ID/domain
- never returns old credentials
- replaces credentials only after a verified callback
- increments credential version
- leaves cancelled/consumed states terminal
- preserves audit history

## 23. Health model

Frontend-safe health includes:

- integration account ID
- provider code
- stable status and connected flag
- external account ID/domain/display name
- token expiry
- connected/verified/refreshed/error timestamps
- safe error code
- credential version
- action required
- reconnect/disconnect/manage permissions

It excludes access credential, refresh credential, ciphertext, authorization code, client secret, state hash, and provider raw payload.

## 24. External-reference model

`public.integration_external_references` provides identifier-only future foundations for:

- contact
- lead
- deal
- task
- note
- message
- conversation

It enforces tenant/integration ownership and uniqueness for both internal and external identities. Metadata is constrained to an empty object in this foundation, so no clinical, financial, patient, or synchronization payload is stored. Create/archive/list operations are controlled server functions. No synchronization is executed.

## 25. Role matrix

| Role | Safe health | Connect/reconnect | Refresh/check | Disconnect | External-reference mutation |
|---|---:|---:|---:|---:|---:|
| clinic_owner | yes | yes | yes | yes | yes |
| clinic_admin | yes | yes | yes | yes | yes |
| registrar | read-only | no | no provider refresh | no | no |
| doctor | no panel/no fetch | no | no | no | no |
| cashier | no panel/no fetch | no | no | no | no |
| unknown/null membership | blocked | blocked | blocked | blocked | blocked |
| anonymous | blocked | blocked | blocked | blocked | blocked |

Server-side role enforcement is authoritative; hiding UI controls is not treated as authorization.

## 26. RLS/grants

- `integration_accounts`: authenticated SELECT only through tenant/role RLS for owner/admin/registrar; no direct authenticated writes.
- `integration_credentials`: no authenticated/anon read or write; service role only.
- `integration_oauth_states`: no general frontend access; service role only.
- `integration_external_references`: tenant-scoped safe read for owner/admin/registrar; no direct authenticated mutation.
- all four tables have RLS enabled.
- NULL-role, unknown membership, anonymous, doctor, cashier, and cross-tenant cases are tested.

## 27. Audit/activity

Implemented redacted paired audit/activity events for:

- connection started/completed/failed
- account verified/mismatch
- refresh started/succeeded/failed
- reconnect started
- disconnected
- external reference created/archived

Allowed metadata contains integration/tenant/account identifiers, normalized domain, credential version, safe status, and safe error code. Tests confirm credential/state/client-secret material is absent and audit/activity event counts match.

## 28. Backend contract

Implemented:

- `startConnection(...)`
- `completeCallback(...)`
- `getHealth(...)`
- `refreshCredentials(...)`
- `disconnect(...)`
- `reconnect(...)`
- account verification via provider client
- `listExternalReferences(...)`
- `createExternalReference(...)`
- `archiveExternalReference(...)`

All provider HTTP is server-side. The frontend never calls amoCRM token or account endpoints.

## 29. Repository/hook

Frontend repository methods:

- `getAmoCrmIntegrationHealth()`
- `startAmoCrmConnection()`
- `disconnectAmoCrmConnection()`
- `reconnectAmoCrmConnection()`
- `requestAmoCrmHealthRefresh()`
- identifier-only external-reference methods

`useAmoCrmIntegration`:

- performs no fetch without an allowed current tenant role
- clears visible state on tenant switch through tenant-keyed state
- ignores stale responses
- blocks duplicate actions
- handles callback marker with one safe status refresh
- never parses provider response or credentials
- does not use localStorage

A real Chromium smoke found and fixed an unbound native `fetch` invocation; regression coverage now verifies `globalThis.fetch` binding.

## 30. Settings UI

Owner/admin panel displays connected state, account name/ID/domain, last verification, expiry, safe status, and required action. It provides Connect, Reconnect, Check State, and Disconnect controls.

Registrar receives read-only safe status. Doctor and cashier receive no panel and perform no integration request.

Required warnings are present:

- connection applies only to the current clinic;
- this version sends no messages and synchronizes no data;
- users must never enter amoCRM tokens manually.

No message-send, contact-sync, deal-sync, lead-sync, or task-sync control exists.

## 31. Local amoCRM mock

A deterministic local mock implements:

- authorization code success/invalid/expired
- access/refresh response
- refresh rotation and invalid_grant
- account information and mismatch
- timeout before response
- timeout after possible acceptance
- rate limit
- temporary server error
- counters proving no provider entity/message mutation

All automated provider traffic remained local. No real amoCRM account was mutated.

## 32. SQL tests

`0034_amocrm_integration_hardening_test.sql`: 75 assertions passed, covering role/RLS/grants, state hashing/binding/expiry/one-time use, callback account verification, cross-tenant duplicate account blocking, safe health, credential secrecy, reconnect/versioning, refresh lease/stale rejection/failure, external-reference isolation/uniqueness, idempotent disconnect, audit redaction/parity, and business side-effect absence.

Clean regression run passed all SQL suites `0024–0034`:

- 0024 legacy grants
- 0025 appointment conflicts
- 0026 cancellation/no-show
- 0027 confirmation
- 0028 tenant timezone
- 0029 reminder queue
- 0030 reminder manual operations
- 0031 communication consent
- 0032 communication orchestration
- 0033 communication templates
- 0034 amoCRM hardening

## 33. Concurrency tests

All required concurrency suites passed:

- 0025
- 0026
- 0027
- 0029
- 0030
- 0032
- 0033
- 0034

amoCRM counters:

- integration accounts: 3
- OAuth states: 10
- consumed states: 7
- callback exchanges: 7
- maximum credential version observed: 7
- refresh calls: 3
- refresh replays: 1
- account mismatches: 1
- disconnected accounts: 2
- external references: 1
- audit events: 30
- activity events: 30
- deadlocks: 0

Required invariants:

- cross-tenant credential overwrite: 0
- duplicate active account bindings: 0
- credential version rollback: 0
- raw credentials in audit: 0
- OAuth state reuse: 0
- deadlocks: 0
- audit/activity mismatch: 0

## 34. TypeScript tests

Final full Vitest run:

- 114 test files passed
- 1,192 tests passed

Targeted coverage includes domain normalization/equality/mismatch, state expiry/terminal handling, safe health mapping, safe errors, public type secrecy, repository routing, native fetch binding, no localStorage, hook tenant switching/stale-response handling/duplicate action blocking/role fetch suppression, UI role controls/warnings, encryption, server state hashing, callback single-consumption, provider mock behavior, rotated refresh, uncertainty mapping, redaction, and one-provider-call parallel refresh.

## 35. Browser smoke

Authenticated local browser smoke passed with local Supabase and local mock amoCRM:

- owner/admin sees and manages connected integration
- registrar sees safe read-only connected status
- doctor/cashier see no integration panel and issue no integration request
- start/callback success verified through backend lifecycle
- authoritative account identity displayed
- wrong account rejected without credential overwrite
- second tenant blocked from the same external account
- parallel refresh produced one provider refresh request
- revoked refresh produced reconnect-required health
- disconnect affected only the current tenant
- reconnect created a new state and replaced credentials safely
- tenant B could not read tenant A external references
- no token/ciphertext/service-role value appeared in visible UI

## 36. Network proof

Browser/page-open counter deltas:

- frontend token endpoint calls: 0
- frontend refresh endpoint calls: 0
- frontend account endpoint calls: 0
- provider entity mutation calls: 0
- provider message calls: 0

Lifecycle proof:

- local mock OAuth exchanges: greater than 0
- controlled backend operations: greater than 0
- parallel backend refresh calls: 2
- resulting provider refresh calls: 1
- credentials in browser responses/storage/URL: 0
- service role in frontend: 0
- real amoCRM mutations/messages: 0

Allowed hosts only: local frontend, local Supabase, local backend, and local mock amoCRM.

## 37. Database counters

After lifecycle and concurrency validation, required invariants were zero:

- active amoCRM integrations per tenant > 1: 0
- same external account bound to multiple active tenants: 0
- raw OAuth states stored: 0
- consumed state reused: 0
- credentials readable by authenticated role: 0
- credential version rollback: 0
- cross-tenant credential references: 0
- credentials in audit/activity: 0
- credentials in safe status: 0
- external-reference duplicates: 0
- cross-tenant external references: 0
- deadlocks: 0
- audit/activity mismatch: 0

## 38. Side-effect validation

Unchanged by SQL/lifecycle tests:

- patients
- appointments
- reminder jobs
- communication operations
- templates
- visits
- encounters
- findings
- treatment plans
- completed services
- invoices
- payments
- refunds
- write-offs
- balances and finance model state
- stock
- documents
- real amoCRM contacts/leads/deals/tasks/messages

No communication operation or reminder job was created by amoCRM operations.

## 39. Cleanup

Completed:

- task frontend/backend/mock processes stopped
- task ports 44555, 49011, and 52673 closed
- lifecycle scratch scripts, mock counters, PID files, and logs removed
- final `npx supabase db reset --no-seed` applied migrations 0001–0034
- latest migration: 0034
- QA users: 0
- QA tenants: 0
- integration accounts: 0
- OAuth states: 0
- credential rows: 0
- external-reference rows: 0

The local Supabase CLI returned a transient 502 while restarting optional services after the final reset; subsequent `supabase status` and direct database checks confirmed the stack running and the database fully reset through migration 0034.

## 40. Lint/test/build

- `npm run lint`: PASS
- `npm run test -- --run`: PASS, 114 files / 1,192 tests
- `npm run build`: PASS
- backend `npm run check`: PASS
- SQL `0024–0034`: PASS
- required concurrency suites: PASS

Non-failing existing warnings:

- React test `act(...)` warnings in unrelated legacy tests
- Vite bundle-size warning for the existing main bundle

## 41. Fresh CI

GitHub Actions CI run #763 (run ID `29332792739`) completed successfully on the exact final implementation head `29d26c1763b3ec6ed6acc547eb752acf3de85831`.

Passed jobs/checks:

- validate: SUCCESS
  - ESLint: SUCCESS
  - full tests: SUCCESS
  - build: SUCCESS
- Merge guard: SUCCESS

A report-only metadata commit follows this verified implementation head. Its exact PR head and fresh CI result are recorded in PR #360 metadata and the final task response, avoiding the impossible self-reference of embedding a commit SHA inside the commit whose SHA it determines.

## 42. Known limitations

- Provider behavior is validated against current official documentation and a deterministic local mock; automated tests intentionally do not mutate a real amoCRM tenant.
- Deployment must supply server-only Supabase service role, amoCRM application credentials, redirect URI, and a 32-byte encryption key through protected runtime configuration.
- Disconnect destroys local active credentials and preserves safe history; it does not call a provider revocation endpoint or add the optional amoCRM disconnect webhook.
- No automatic refresh scheduler exists; refresh is an explicit safe primitive.
- The current Node server remains a lightweight project runtime rather than a managed Edge Function deployment.

## 43. What was intentionally not implemented

- contact synchronization
- lead/deal synchronization
- task/note synchronization
- message/conversation synchronization
- Chats API
- WhatsApp/SMS/email provider adapters
- provider message sending
- inbound message webhook
- integration disconnect webhook
- polling worker
- cron or background refresh loop
- communication-operation execution
- cloud Supabase migration apply
- platform superadmin work
- tenant-permission project
- HEP-V2

## 44. Recommended next task

No automatic implementation task should start.

Return to Nick for a product-level discussion covering:

- the actual role amoCRM should play in DentalFlow;
- whether DentalFlow should create contacts, tasks, leads, deals, or notes;
- whether WhatsApp access is available through amoCRM APIs in the real tenant account;
- which data must remain only in DentalFlow;
- whether the next smallest safe slice is a provider adapter, task sync, contact sync, or no sync at all.
