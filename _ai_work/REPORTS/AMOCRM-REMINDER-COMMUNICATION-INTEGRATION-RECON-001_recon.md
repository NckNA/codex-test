# AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001

## Final verdict

**PARTIAL: tenant-specific installed amoCRM channel evidence and fresh browser/local-runtime validation are unavailable; repository and official API evidence identify the next safe hardening slice but do not authorize message delivery**

## Executive summary

The current amoCRM implementation is a disconnected development skeleton, not a production integration and not a reminder communication boundary. It has an authorization-code exchange, one process-global in-memory credential set, placeholder synchronization routes, and a webhook that accepts and ignores requests. It has no tenant binding, role checks, durable credential repository, refresh implementation, external-object repository, CRM synchronization, chat channel, message operation, delivery-state processing, or inbound-reply correlation.

DentalFlow already has the correct authoritative foundations: tenant-scoped appointment reminder jobs, manual reminder operations, normalized communication contacts, channel-specific consent, suppression, representative handling, and provider-neutral eligibility. Those facts must remain authoritative.

Official amoCRM documentation confirms that CRM contacts, leads, tasks, notes and webhooks exist, and that a separately registered Chats API channel can create chats, transfer messages, report delivery states and return message history. Those capabilities require a registered channel, signed requests, a per-account `scope_id`, channel webhooks, conversation identity and a real external transport. None is evidenced in this repository or the connected Supabase project.

**Target architecture:** B, provider-neutral communication orchestration with amoCRM as one possible adapter.

**Exact next task:** `AMOCRM-INTEGRATION-HARDENING-001`.

No real amoCRM write, message, task, contact, lead, note, credential refresh, webhook registration, or cloud mutation was performed.

## Branch

`recon/amocrm-reminder-communication-integration-recon-001`

## PR URL

Pending initial PR creation. The URL will be inserted before final validation.

## Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required and verified baseline: `db6f298bc30a886ee569245fcb5599a0735b24d2`;
- PR `#356` is merged at that exact commit;
- the baseline also contains the reminder queue and manual-operations foundations;
- no duplicate open or merged PR was found for this task ID/title;
- the branch was created directly from the exact baseline.

## Final head

Recorded in the final task response because a report cannot contain its own future commit SHA without changing that SHA.

## Changed files

Exactly one file:

- `_ai_work/REPORTS/AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001_recon.md`

No production code, migration, package, generated type, fixture, UI, provider, worker, cron, Edge Function, or webhook implementation is changed.

## Pre-read

Required reports reconciled:

- `APPOINTMENT-REMINDER-OPERATIONS-RECON-001`;
- `APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001`;
- `APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001`;
- `APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001`.

amoCRM history reconciled:

- `AMO-001`, `AMO-002`, `AMO-003`, `AMO-004`;
- `AUDIT-005_amocrm_oauth_boundary_audit_report`;
- amoCRM architecture, mapping, security and sync-strategy documents.

Repository inspection covered backend routes/services/config, frontend mappers/types/UI, patient storage, reminder contracts, initial schema, token table, source references, package scripts and CI.

Official amoCRM documentation was checked on **2026-07-13**: OAuth, API limits, contacts, leads, tasks, notes/events, CRM webhooks, Chats capabilities, Chats methods and Chats webhook formats.

## Existing amoCRM assets

| Asset | Responsibility | Scope/auth | Operations | Error/retry/idempotency/audit/tests | Reachability/classification |
|---|---|---|---|---|---|
| `backend/src/server.js` | plain Node proxy | no authentication or tenant middleware | dispatches routes | none | separate manual server; risky skeleton |
| `backend/src/routes/amoCrmRoutes.js` | status/connect/callback/disconnect, webhook and sync placeholders | global, no user/role/tenant | token exchange and global disconnect; sync returns 501; webhook ignores | redacted simple errors; no retry/idempotency/audit | not called by frontend; risky/partial |
| `amoCrmClient.js` | OAuth URL and code exchange | global config | only token exchange; sync functions throw | no refresh/retry | partial; must be replaced/hardened |
| `amoCrmTokenStore.js` | credential storage | one process-global object | save/read/clear | no lock, version, persistence or audit | dev-only; unsafe for SaaS |
| `amoCrmStateStore.js` | one-time state | global Map, not bound to tenant/user/account | create/consume, ten-minute TTL | cryptographically random; no ownership binding | reusable concept only |
| `backend/src/config.js` | loads amoCRM settings | one global account/config | config only | no tenant/account selection | partial/risky |
| backend README/env/package | documents and starts skeleton | global | manual start/check | backend checks are outside root CI | accurate docs, partial tooling |
| `amoCrmMapper.ts` | contact/lead preview mapping | caller-supplied patient | pure mapping, no network | no consumer/operation key/tests proving integration | dead prototype |
| `amoCrmTypes.ts` | draft DTO types | none | none | none | placeholder |
| `ExternalCrmLink` | optional contact/lead/deal IDs | indirectly scoped by patient row | model only | no account composite or uniqueness | partial/risky |
| `PatientRepository.ts` | stores opaque `patient.integration` JSON | tenant-filtered patient row | read/write JSON | no external-reference constraints | active storage, unsuitable mapping authority |
| patient-card CRM panel | displays source/status/IDs | current patient | read-only | exposes raw external IDs to authorized UI | active display, not integration |
| disabled treatment-plan button | future UI hint | none | none | none | placeholder |
| `patients.integration` JSONB | legacy metadata | patient tenant | opaque metadata | no history/uniqueness/account validation | risky legacy model |
| `integration_tokens` table | intended tenant credential storage | unique tenant/provider | unused by backend | encryption is naming/design intent only; no refresh lock/account ID | reusable but insufficient |
| historical docs/reports | design intent | mixed | none | not runtime evidence | informative only |

No production amoCRM repository, sync service, tenant settings page, external-reference repository, chat client, task/note client, message client, delivery-attempt store, polling job, signed webhook verifier, or recovery lookup exists.

## Current data-flow map

### DentalFlow to amoCRM

| Flow | Trigger/payload | Authority | Idempotency/failure/replay | Isolation/exposure | Status |
|---|---|---|---|---|---|
| patient create/update | no trigger; unused draft is name + legacy phone | DentalFlow patient | none | no adapter tenant boundary; legacy phone lacks consent authority | absent |
| appointment create/update/cancel | no mapper or route | DentalFlow appointment | n/a | no data leaves | absent |
| contact create/update | no API request | DentalFlow | none | none | absent |
| lead create/update | unused draft includes patient name, plan title, total price, status/source | DentalFlow | none | includes financial total and must not be used for reminders | absent/unsafe draft |
| task/note creation | none | DentalFlow reminder/audit | none | none | absent |
| message send | none | DentalFlow reminder/consent | none | none | absent |

### amoCRM to DentalFlow

| Flow | Trigger/payload | Authority/idempotency | Isolation | Status |
|---|---|---|---|---|
| contact or lead update | none | no contract | none | absent |
| tasks or notes | none | no contract | none | absent |
| incoming message | placeholder webhook discards body | no persistence/deduplication | none | absent |
| CRM webhook | accepts 202, ignores all | duplicates and failures invisible | none | placeholder |
| delivery status | none | no message ID/state | none | absent |
| external IDs | optional replaceable patient JSON only | no mapping history | patient row only | not populated by integration |

Contacts, leads, tasks, notes and conversations are **not synchronized**.

## External ID model

Current identifiers:

| ID | Location | Tenant/account safety | Finding |
|---|---|---|---|
| account/domain | global memory token object | no tenant binding | lost on restart/overwritable |
| integration/client ID | global environment | no tenant binding | one global config |
| contact/lead/deal IDs | optional patient JSON | tenant only indirectly; no account composite | duplicate/stale mappings possible |
| task/note/message/conversation/webhook IDs | absent | none | absent |
| channel ID/`scope_id` | absent | none | no chat connection |

One patient can be remapped silently; several patients can share the same external ID; cross-account uniqueness is not enforced; appointments have no external reference.

Minimum required model before communications:

1. `integration_accounts`: tenant, provider, verified account ID/domain, connection state, credential version, revocation/health timestamps, unique tenant/provider.
2. `integration_external_refs`: tenant + integration account + local entity/type + external type/ID, mapping version/history, composite uniqueness in both directions.
3. Later, only after channel evidence, `integration_channel_connections`: account, channel ID, `scope_id`, vendor/channel type, capability flags, hook version, connection state and server-side secret reference.

`patients.integration` must become display/compatibility metadata, not mapping authority.

## OAuth and secret boundary

Current flow:

1. any reachable caller starts connect;
2. server creates a random one-time state;
3. callback validates state;
4. server exchanges code using server-side application credentials;
5. one global in-memory credential set is saved;
6. status returns only domain/expiry metadata;
7. any reachable caller can clear it.

Findings:

- authorization-code exchange: partial and server-side;
- token refresh: absent;
- durable storage: absent in running backend;
- database token table: exists but unused;
- encryption implementation: absent;
- expiry enforcement: absent;
- tenant/account binding: absent;
- concurrent refresh protection: absent;
- route authentication and roles: absent;
- state binding to actor/tenant/account: absent;
- exact callback account verification: absent;
- frontend credential exposure: not found;
- error redaction: raw token response is not returned;
- revocation behavior: absent.

Credentials are not production-safe today. Official amoCRM refresh credentials rotate on use, so future refresh must use a row lock or compare-and-swap and must reject stale concurrent results.

Required hardening:

- authenticate every route;
- owner/admin configuration only;
- bind state to tenant, actor and expected account;
- verify exact account ID/domain;
- encrypt durable server-side credentials per tenant/account;
- transactionally rotate refresh credentials with generation/version control;
- handle expiry/revocation/disconnect;
- never expose provider credentials to frontend or logs;
- audit connect/refresh/revoke/mismatch with safe metadata.

## Current tenant isolation

Reminder and consent foundations are tenant-scoped. amoCRM is not.

Gaps: no tenant/user/role in routes, state or token store; no one-tenant-to-one-account rule; no account ID; no domain verification against a tenant; no per-tenant throttling; no webhook account verification; no audit; global disconnect affects the last connected account.

Required rule: one DentalFlow tenant maps to exactly one verified amoCRM account unless explicitly redesigned; no global default/fallback; every credential and external ID is composite with tenant/account; account or webhook mismatch fails closed.

**Result: failed for production, tolerable only because the skeleton is disconnected and performs no sync.**

## Current role model

Current routes have no roles. Required matrix:

| Role | Configure/authorize | View health | Reminder operations | Credential access |
|---|---:|---:|---:|---:|
| owner | yes | yes | policy | no raw credential |
| admin | tenant policy | yes | yes | no raw credential |
| registrar | no | safe operational state only | yes | no |
| doctor | no | no | no provider action | no |
| cashier | no | no | no provider action | no |
| unknown/no tenant | blocked | blocked | blocked | blocked |

## Actual connected communication channels

No evidence establishes native chats, WhatsApp, SMS, email, external connector, channel ID, channel secret reference, `scope_id`, chat hook, sender/bot identity, templates, sandbox, message ID or conversation ID.

Read-only inspection of the connected Supabase project found `integration_tokens` with zero rows and no reminder/communication/channel tables. Its applied migrations stop at `0013`, behind repository baseline `0031`. This proves drift in the accessible project, not a production channel.

| Model | Result |
|---|---|
| amoCRM native/custom chats | official capability only; no installed channel |
| WhatsApp widget/vendor | no evidence |
| SMS widget/vendor | no evidence |
| email integration | no DentalFlow evidence |
| staff manual writing in amoCRM | operationally possible but unverified |
| task/note-only use | no implementation |

## Official amoCRM capability check

Checked 2026-07-13 using official documentation only.

| Capability | Official result | Limitation/current compatibility | Confidence |
|---|---|---|---|
| OAuth code exchange | supported at exact account domain | current skeleton lacks tenant/account binding | high |
| refresh | supported; refresh value is single-use and replacement must be stored | absent; concurrency unsafe if naively added | high |
| contacts/leads/tasks/notes | read/write APIs exist | no repository client; not reminder authority | high |
| CRM webhooks | supported; account limit documented | placeholder ignores and does not verify | high |
| chat channel connect | signed API returns account-specific `scope_id` | channel registration/secret/install absent | high |
| chat creation | integration-owned conversation ID supported | no mapping model | high |
| message transfer | supported for registered custom channels | acceptance is not delivery; external transport required | high |
| delivery status | sent/delivered/read/error model supported | no channel/message/status consumer | high |
| message history | supported per conversation | needs signed request, scope and conversation | high |
| inbound/outbound chat hooks | supported for connected channel | verifier/correlation absent | high |
| WhatsApp templates/time windows | channel-specific capabilities | vendor/config unknown | medium/high |
| native generic idempotency | no general reminder-send key documented | DentalFlow must enforce | medium/high |

## API and rate-limit constraints

Official CRM API guidance currently states up to 7 requests/second per integration and 50 requests/second per account, with HTTP 429 on limit breach and possible 403 blocking after repeated violations.

Future requirements: backend-only bounded worker, per-tenant/account throttling, safe backoff, separated refresh traffic, dead-letter/manual review, bounded scans, no blind resend, and batching only where documented. Reminder volume is not measured in the repository.

## Current message-send capability

**Absent.** No command, endpoint, channel, transport, template, sender identity, operation store or external message ID exists. An official Chats API does not make an installed third-party WhatsApp/SMS widget callable by DentalFlow.

## Current delivery-status capability

**Absent.** There is no message ID, delivery attempt, status webhook, polling lookup or normalizer. Manual `message_sent` is a staff-entered fact, not delivery proof.

## Current inbound-reply capability

**Absent.** The webhook ignores bodies and has no signature/account/channel validation, conversation identity or correlation.

Initial future rule: verified inbound reply creates a manual review item; staff interprets it and uses the existing confirmation/reschedule workflow. Arbitrary text must not automatically confirm an appointment.

## Communication command model

```text
CommunicationCommand
- tenant_id
- reminder_job_id
- appointment_id
- patient_id
- communication_contact_id
- channel
- purpose_code
- language
- consent_snapshot
- suppression_snapshot
- appointment_version
- reminder_job_version
- operation_key
- payload_fingerprint
- safe_variable_map
- requested_at
```

Purpose codes: `appointment_confirmation_request`, `appointment_day_before_reminder`, `appointment_same_day_reminder`, `control_call_task`.

No free-form clinical payload. Final eligibility, appointment version/state and consent/suppression must be rechecked immediately before any external side effect.

## Proposed amoCRM adapter contract

Input: immutable communication command.

Responsibilities: resolve exact tenant account, reject mismatch, resolve contact/channel/conversation, preserve operation key/fingerprint, perform only approved external action, store external ID, normalize outcome, redact errors and expose recovery lookup.

Output: `accepted | rejected | uncertain | manual_action_required`, optional external ID, safe error code, retryability and timestamp.

The adapter must not confirm appointments, complete reminder jobs merely on acceptance, create clinical/financial facts, choose another tenant/account, or bypass consent.

## Task-only fallback

`DentalFlow reminder job → amoCRM task → staff contact → manual result in DentalFlow` was evaluated and rejected now. It duplicates `/reminders`, creates two queues, adds mapping/completion reconciliation, weakens audit consistency and increases duplicate-contact risk without proving a communication channel.

## Inbound reply handling

Future handling must verify signature/account/channel, deduplicate provider event/message ID, resolve tenant/contact/conversation, flag shared/representative contacts, create manual review, and require staff to record the interpreted result through existing operations. `да`, `нет`, `перенесите` and free text are not automatically authoritative.

## Idempotency

Identities are required for contact sync, task/note/message creation, webhook consumption and reply interpretation.

Rules:

- same operation key + same fingerprint = replay;
- same key + different fingerprint = reject;
- reserve local operation before external side effect;
- store external ID transactionally;
- timeout after possible acceptance = uncertain;
- perform recovery lookup before retry;
- never blindly duplicate a message;
- duplicate webhook returns success without duplicate effects.

Integration-owned conversation/message IDs can aid correlation but are not assumed to be a complete provider idempotency guarantee.

## Uncertain outcomes

Required states include prepared, dispatching, accepted, rejected, uncertain, delivered, read, manual-review-required and cancelled-before-dispatch.

Accepted is not delivered; delivered is not replied; replied is not confirmed. If external acceptance cannot be disproved after timeout, do not resend automatically. Recover by external ID/history or route to manual review.

## Reschedule/cancellation behavior

Commands bind to appointment and reminder-job versions. Reschedule supersedes stale work. Cancellation, no-show, arrival, visit start/completion and consent withdrawal block new dispatch. In-flight uncertain work is not retried blindly. Already accepted external messages remain historical and do not mutate appointment truth.

## Consent and suppression behavior

DentalFlow remains authoritative for channel consent, evidence, global/channel suppression, patient/representative ownership, preferred language/channel and eligibility. amoCRM metadata cannot grant consent or clear suppression. Snapshot at preparation and recheck at dispatch.

## Security/privacy payload allowlist

Allowed: patient first name, clinic name, appointment date/time, doctor display name, callback phone and purpose code.

Forbidden: diagnosis, complaints, findings, tooth chart, treatment details/title, price/total, balance/debt/payment, clinical notes, medical documents and arbitrary patient notes.

The current lead draft includes treatment title and total price and must not be reused for reminders.

## Error model

Safe codes: `amo_not_configured`, `amo_authorization_required`, `amo_token_expired`, `amo_account_mismatch`, `amo_rate_limited`, `amo_contact_mapping_missing`, `amo_channel_unavailable`, `amo_message_not_supported`, `amo_operation_uncertain`, `amo_external_rejected`, `amo_webhook_untrusted`, `amo_tenant_mismatch`.

No credential value, raw provider body, stack trace or account secret may reach users/logs.

## Failure matrix

| Scenario | Detection/state | Retry/manual response | Risk |
|---|---|---|---|
| not configured | rejected safe code | owner/admin config | low |
| expired/revoked authorization | expiry/401/revoke state | atomic refresh or reconnect | low/medium |
| concurrent refresh | credential generation conflict | one winner; stale result rejected | high outage/corruption |
| missing/duplicate contact | no or multiple mapping | manual mapping, no auto-send | high wrong recipient |
| channel/send unavailable | capability absent | use DentalFlow manual queue | low |
| rate limit | 429 | bounded backoff | delay |
| timeout before acceptance | known no acceptance | bounded retry | medium |
| timeout after possible acceptance | uncertain | recovery before retry/manual | high duplicate |
| duplicate/delayed webhook | ID/fingerprint/time | replay/no send effect | low/medium |
| wrong-account webhook | account/scope mismatch | reject/security audit | critical cross-tenant |
| reschedule/cancel during send | version/status mismatch | no stale retry; review uncertain | medium |
| consent withdrawn during send | final eligibility/in-flight state | block new; privacy review | high |
| shared family/representative number | ambiguous owner | manual review | high wrong recipient |
| manual and external race | operation correlation conflict | prevent duplicate/manual review | high annoyance |
| DentalFlow down after acceptance | reserved operation, no response | recovery lookup | high duplicate |
| amoCRM down after local persist | prepared/retryable | bounded retry/manual | delay |

## Observability

Metrics: commands prepared; accepted/rejected/uncertain/recovered; duplicates prevented; rate limits; refresh success/failure/conflict; account mismatch; missing mappings; inbound replies; manual-review backlog; tenant failure rate; untrusted hooks.

Logs: correlation ID, tenant ID, operation type, external object type, redacted external ID, safe error code, duration and credential generation. Do not log patient contact values or message bodies in general logs.

## Browser/network findings

Fresh Chrome DevTools/HeadlessChrome validation could not run because Hermes local developer execution is blocked in this conversation.

Static and prior-audit evidence:

- frontend makes no amoCRM backend/direct API calls;
- mapper has no consumer;
- sync button is disabled;
- no frontend credential references were found;
- backend responses omit credential values;
- no message/provider request code exists.

Required proof status:

- external amoCRM mutation calls: 0 by source capability; fresh capture unavailable;
- message sends: 0;
- credential values visible: 0 in source/contracts; fresh capture unavailable;
- service-role value visible: 0 in this boundary; fresh capture unavailable.

## Local experiment findings

Performed read-only: GitHub baseline/source/PR inspection, official documentation review, and connected Supabase schema/migration queries.

Supabase findings: token table exists, row count 0, amoCRM row count 0, no reminder/communication/channel tables, latest applied migration `0013` versus repository `0031`.

Unavailable: local worktree, local database reset, local app/network, mock OAuth runtime, fresh browser and local quality commands. No external write or cloud modification occurred.

## Architecture options comparison

Scores 1 poor, 5 strong. Complexity/maintenance score 5 means easier/lower burden.

| Criterion | A direct adapter | B neutral layer + adapter | C task sync | D manual DentalFlow |
|---|---:|---:|---:|---:|
| complexity | 2 | 1 initially/4 later | 3 | 5 |
| security | 2 | 5 | 3 | 5 |
| reliability | 2 | 5 | 3 | 5 manual |
| low lock-in | 1 | 5 | 2 | 5 |
| low duplicate risk | 2 | 5 | 1 | 4 |
| observability | 2 | 5 | 2 | 4 |
| tenant fit | 1 current | 5 after hardening | 3 | 5 |
| operational value | 3 if channel exists | 5 | 2 | 4 current |
| future providers | 1 | 5 | 1 | 2 |
| maintenance | 2 | 4 after foundation | 2 | 5 |

A is rejected now. B is the target. C is rejected because it duplicates `/reminders`. D remains the safe current operating mode until B prerequisites are complete.

## Recommended architecture

**B: provider-neutral communication orchestration with amoCRM as one adapter.**

The adapter is blocked until the integration boundary and actual channel are evidenced.

## Exact next task

**`AMOCRM-INTEGRATION-HARDENING-001`**

Smallest safe slice:

- authenticate/authorize integration routes;
- bind OAuth state to tenant/actor/expected account;
- persist one verified tenant/account configuration;
- exact account/domain verification;
- encrypted durable credential storage;
- atomic refresh rotation and concurrent-refresh protection;
- tenant-scoped revocation/health;
- constrained external account/reference model;
- safe health/error/audit;
- block unsafe global memory behavior in production mode;
- no contacts, leads, tasks, notes, messages, channel connection or reminder execution change.

After hardening, external evidence must identify the actual channel/vendor, `scope_id`, sender/template rules, delivery callbacks and inbound semantics before any send adapter task.

## Known blockers

No configured account in the accessible store; no actual channel/vendor/scope/sender/templates; no tenant-aware backend; no refresh; no durable credential repository; no external-reference constraints; no message/delivery/reply storage; accessible cloud drift; no fresh browser/local execution.

## What was intentionally not implemented

No production code, migration, OAuth change, refresh, provider abstraction, delivery, message, CRM object mutation, webhook, worker, cron, Edge Function, package/type/UI/fixture change, cloud apply, credential access, next task, or HEP-V2.

## Validation

Required local commands are `npm run lint`, `npm run test -- --run`, and `npm run build`. Local execution was unavailable through Hermes. The root GitHub Actions workflow runs install, ESLint, tests, build and merge guard for PRs to main. Fresh CI on the exact final head is required and will be recorded in the final response.

Static validation passed: exact baseline/ancestry, duplicate search, one intended file, source inventory, no send/channel code, no frontend credential references, read-only Supabase inspection and official documentation review.

## Fresh CI

Pending PR creation and final report commit. Exact run, tested SHA, ESLint, tests, build and merge-guard results will be reported in the final task response; placing them here would create a new untested head.

## Final verdict

**PARTIAL: tenant-specific installed amoCRM channel evidence and fresh browser/local-runtime validation are unavailable; repository and official API evidence identify `AMOCRM-INTEGRATION-HARDENING-001` but do not authorize message delivery**
