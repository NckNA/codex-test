# AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001

## Final verdict

Final verdict: **PASS**

AMOCRM REMINDER COMMUNICATION INTEGRATION RECONCILED AND NEXT SAFE SLICE IDENTIFIED

## Executive summary

The repository does not contain an operational amoCRM synchronization or reminder-communication integration. It contains three disconnected foundations:

1. frontend-only patient lead-source metadata and an unused safe payload mapper;
2. a standalone development Node.js OAuth skeleton with one global in-memory token set;
3. a tenant-scoped Supabase `integration_tokens` table that no runtime code currently uses.

No patient, appointment, contact, lead, task, note, message, conversation, delivery status, reply, or webhook event is currently synchronized in either direction. The frontend does not call the integration proxy. The proxy sync endpoints return `501 Not Implemented`; its webhook returns `202 Accepted` while discarding the request. The current OAuth skeleton has no authentication, tenant binding, durable encrypted storage, refresh implementation, concurrent-refresh protection, account verification, or revocation recovery.

Official amoCRM documentation confirms that contacts, leads, tasks, notes/events, webhooks, OAuth, and a Chats API exist. It does not establish that DentalFlow can send through an arbitrary WhatsApp/SMS widget already visible inside an amoCRM account. The Chats API model expects an integration to register and operate a channel/transport, receive manager-message webhooks, deliver the message externally, and report delivery status back to amoCRM. No such channel integration, vendor contract, channel ID, scope, secret, conversation mapping, message mapping, or webhook receiver exists in this repository.

The evidence-based recommendation is a provider-neutral communication orchestration boundary. DentalFlow must remain authoritative for reminder jobs, appointments, contact selection, consent, suppression, and operation identity. amoCRM may become one adapter only after its tenant-scoped OAuth/account boundary and a real channel capability are proven. A direct amoCRM send adapter is unsafe now, and amoCRM task-only synchronization would duplicate the existing `/reminders` operational queue.

No external amoCRM request, token refresh, contact/lead/task/note mutation, webhook registration, or message send was performed.

## Summary

Current amoCRM runtime capability is limited to a disconnected development OAuth skeleton. DentalFlow sends and receives no CRM or communication data. The safe architecture is provider-neutral communication orchestration, with the existing DentalFlow reminder, contact, consent and suppression models remaining authoritative. amoCRM may be evaluated as a later adapter only after tenant/account OAuth hardening and concrete channel evidence.

## Branch

`recon/amocrm-reminder-communication-integration-recon-001`

## PR URL

https://github.com/NckNA/codex-test/pull/357

## Baseline

- repository: `NckNA/codex-test`;
- required baseline: `db6f298bc30a886ee569245fcb5599a0735b24d2`;
- verified `origin/main`: `db6f298bc30a886ee569245fcb5599a0735b24d2`;
- PR #356 was merged at that exact commit;
- the source checkout was clean;
- no open or merged duplicate PR with this task ID was found;
- the worktree was created directly from current `origin/main`.

## Final head

- reviewed report head before this update: `2eff9c5361bdc6cc435ec43e0e55fc0e95170c30`;
- workflow: `CI`;
- run ID: `29250618691`;
- conclusion: `success`;
- final report-update head and fresh CI are recorded by the immutable finalization receipt because a commit cannot contain its own future SHA.

## Report update commit

- Report update commit: N/A (the report commit cannot reference itself; use the finalization receipt).
- The final report head and fresh CI run are recorded after final CI in an immutable local receipt.

## Changed files

Exactly one file:

- `_ai_work/REPORTS/AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001_recon.md`

No migration, source, backend, package, lock, generated type, fixture, environment, or CI file was changed.

## Pre-read

Required reminder reports reviewed:

- `APPOINTMENT-REMINDER-OPERATIONS-RECON-001`;
- `APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001`;
- `APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001`;
- `APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001`.

Historical amoCRM reports reviewed:

- `AMO-001_integration_readiness_and_lead_source_layer_report.md`;
- `AMO-002_amocrm_real_integration_architecture_report.md`;
- `AMO-003_backend_proxy_skeleton_report.md`;
- `AMO-004_amocrm_oauth_connection_skeleton_report.md`;
- `AUDIT-005_amocrm_oauth_boundary_audit_report.md`.

Repository areas inspected:

- frontend integration types/mappers and every amoCRM reference;
- standalone backend routes, client, token store, state store and configuration;
- Supabase migrations, RLS and grants;
- patient persistence and external CRM metadata;
- reminder jobs, manual outcomes and contact/consent foundations;
- routes/placeholders, environment references, package scripts, tests and CI;
- absence of Edge Functions, workers, cron, provider webhooks and message delivery code.

Searches covered `amo`, `amocrm`, `kommo`, OAuth/token terms, contacts, leads, tasks, notes, messages, chats, conversations, WhatsApp, SMS, email, webhooks and external identifiers.

## Existing amoCRM assets

| Asset | Responsibility | Layer | Tenant/auth model | Operations | Reachability | Classification |
|---|---|---|---|---|---|---|
| `src/integrations/amocrm/amoCrmTypes.ts` | contact/lead draft types | frontend | none | none | not imported by operational flow | reusable type sketch, partial |
| `src/integrations/amocrm/amoCrmMapper.ts` | maps patient/treatment data to safe preview drafts | frontend | receives caller objects only | no network | unreachable in production flow | reusable payload allowlist idea, dead/partial |
| patient `integration` JSON/type | lead source/status and optional external contact/lead/deal IDs | frontend + patient row JSON | patient row is tenant-scoped; embedded IDs have no independent constraint | display/edit only | reachable as metadata UI | risky as authoritative mapping |
| patient overview external CRM panel | displays provider, sync status and raw external IDs | frontend | patient tenant boundary | read-only display | reachable | partial, potentially misleading |
| disabled treatment-plan amoCRM action | future sync label | frontend | none | none | reachable but disabled | placeholder |
| `/crm` | CRM page | frontend | normal app shell only | none | reachable | placeholder |
| `/settings` | integration/configuration candidate | frontend | normal app shell only | none | reachable | placeholder |
| `/sms`, `/mailing` | channel pages | frontend | none | none | reachable | placeholders |
| `backend/src/server.js` | standalone HTTP proxy | backend | no DentalFlow auth/tenant middleware | route dispatch | not called by frontend | development skeleton, risky if exposed |
| `backend/src/routes/amoCrmRoutes.js` | status/connect/callback/disconnect/webhook/sync routes | backend | no user, role or tenant verification | OAuth start/callback; disconnect; placeholders | standalone only | partial OAuth, unsafe multi-tenant boundary |
| `amoCrmClient.js` | authorization URL and initial token exchange | backend | global configuration | real OAuth token exchange only | reachable only by proxy route | reusable initial exchange, incomplete |
| `amoCrmStateStore.js` | random one-time OAuth state with TTL | backend memory | not bound to tenant/user/account | create/consume state | standalone only | partial, requires replacement/binding |
| `amoCrmTokenStore.js` | holds one token pair and account domain | backend memory | one global token set | save/read status/clear | standalone only | unsafe for SaaS, requires replacement |
| `integration_tokens` | intended encrypted token persistence | database | unique `(tenant_id, provider)`, RLS, service-role CRUD | unused | no runtime caller | reusable schema seed, incomplete |
| amoCRM architecture/security/mapping docs | planned integration design | documentation | aspirational | none | documentation only | stale/partly reusable |
| backend tests | none beyond Node syntax check | test | n/a | n/a | n/a | missing |

No Supabase Edge Function, serverless route, queue worker, scheduler, secure webhook endpoint, or production deployment path for the Node proxy was found.

## Current data-flow map

### DentalFlow to amoCRM

| Flow | Current trigger | Current payload | Result |
|---|---|---|---|
| patient creation/update | none | mapper can construct name, phone, email and safe custom fields in memory | no request, no contact ID persisted |
| appointment create/update/cancel | none | no mapper or endpoint | no flow |
| contact creation/update | none | draft type only | no flow |
| lead/deal creation/status | none | treatment-plan preview draft only | no flow |
| task creation | none | no implementation | no flow |
| note creation | none | no implementation | no flow |
| message send | none | no command/provider contract | no flow |
| sync endpoints | standalone POST route | ignored by placeholder | `501 Not Implemented` |

### amoCRM to DentalFlow

| Flow | Current mechanism | Result |
|---|---|---|
| contact updates | none | absent |
| lead status | none | absent |
| tasks | none | absent |
| notes/events | none | absent |
| incoming messages | none | absent |
| delivery statuses | none | absent |
| webhooks | standalone unauthenticated placeholder | returns accepted and discards payload |
| external IDs | no response handling | absent |

There is no authority conflict today because there is no sync. The risk begins if the placeholders are wired without first creating tenant/account, credential, external-reference and operation boundaries.

## External ID model

Current stored identifiers:

- patient JSON may contain `externalContactId`, `externalLeadId`, `externalDealId`;
- the backend memory token store contains an account domain while the process is alive;
- `integration_tokens` stores no account ID/domain or integration ID;
- task, note, message, conversation/chat and webhook IDs are not stored;
- appointments and reminder jobs have no amoCRM reference.

Current weaknesses:

- embedded patient JSON has no composite tenant/provider/account uniqueness;
- no FK or dedicated mapping lifecycle;
- no account identity accompanies an external ID;
- one patient could be assigned multiple or stale contacts without detection;
- one amoCRM contact could be assigned to multiple patients without a constraint;
- resync replacement/history is undefined;
- appointment-to-lead/task/note/message correlation does not exist.

Minimum future external-reference model:

1. tenant integration account: `tenant_id`, provider, amo account ID/domain, integration ID, authorization health/version, credential reference and timestamps;
2. external reference: tenant, provider, provider account, local entity type/ID, external object type/ID, state/version, timestamps and unique composite constraints;
3. communication operation: reminder job, appointment, patient, selected contact, channel, purpose, snapshots, operation key/fingerprint, provider/adapter, external operation/message/conversation IDs, state and safe error;
4. webhook inbox: provider account, external event ID, payload hash, verification state, received/processed timestamps and unique `(provider account, event ID)`.

Patient JSON may remain a display cache but must not be the authoritative external mapping.

## OAuth and secret boundary

Current authorization-code path:

1. any caller that can reach the proxy may request `/connect`;
2. a random memory state is created with a ten-minute TTL;
3. callback validates/consumes state;
4. backend posts code, client ID, client secret and redirect URI to amoCRM;
5. returned tokens and account domain are stored in one global memory variable;
6. status strips token values;
7. disconnect clears the global variable.

Positive properties:

- client secret and token exchange are server-side;
- frontend has no token references;
- state is cryptographically random, expiring and one-time;
- status response omits tokens;
- errors are reduced rather than returning the raw OAuth response.

Blocking weaknesses:

- no DentalFlow authentication or owner-only authorization;
- state is not bound to tenant, user, expected account or redirect session;
- one process-global account can be overwritten or disconnected by another caller;
- tokens disappear on restart;
- the database token table is unused;
- fields named `*_encrypted` are not backed by encryption/decryption code;
- no refresh implementation;
- no atomic refresh-token rotation;
- no concurrent refresh lock/CAS;
- no account ID/domain verification after exchange;
- no revoked-token health state or reconnect workflow;
- no audit/metrics;
- no production deployment boundary.

Official documentation checked on 2026-07-13 states that the authorization code is short-lived, access is account/domain specific, tokens must be handled server-side, and refresh-token exchange rotates the refresh token. A refresh token that is not used for the documented period expires. Concurrent refresh without a per-tenant lock and atomic replacement can therefore corrupt the only valid credential pair.

Tokens are not safe for production today. They are currently hidden from the frontend, but the storage, tenant, authorization, refresh and account-integrity requirements are absent.

## Current tenant isolation

Repository reality:

- frontend patient/appointment/reminder/consent data is tenant-scoped;
- `integration_tokens` is tenant-scoped and unique per tenant/provider;
- the Node proxy ignores that table;
- OAuth state, token set, account domain and status are global;
- routes do not accept or verify DentalFlow tenant identity;
- no provider account maps to a tenant;
- webhook account identity is not validated;
- no cross-tenant external ID constraint exists.

Required future invariant:

- one tenant maps to one explicitly configured amoCRM account unless a later design supports more;
- credentials, refresh locks, external IDs, rate budgets and webhook identities are composite with tenant/provider account;
- no global default account and no fallback to another tenant;
- callback and webhook account mismatch are rejected;
- resolving zero or more than one tenant is terminal/manual-review, never a guess.

Current tenant-isolation result: **unsafe and unsuitable for any production sync or communication**.

## Current role model

Current amoCRM proxy role model: none. Any network caller can request status/connect/disconnect and invoke placeholder routes.

Required role model:

| Capability | Owner | Admin | Registrar | Doctor | Cashier | Unknown/no tenant |
|---|---:|---:|---:|---:|---:|---:|
| configure/authorize account | yes | tenant policy only | no | no | no | blocked |
| view integration health | yes | yes | safe operational subset | no | no | blocked |
| view reminder communication state | yes | yes | yes | no by default | no | blocked |
| manual contact/review reply | yes | yes | yes | no | no | blocked |
| view credentials/tokens | never in frontend | never | never | never | never | never |

## Actual connected communication channels

No connected communication channel was established by repository or local runtime evidence.

- amoCRM native Chats integration: not configured in code;
- WhatsApp widget/vendor: no vendor, channel ID, API contract or credential found;
- SMS widget/vendor: none;
- email integration: none;
- external connector attached to amoCRM: none documented;
- staff manual writing inside amoCRM: possible as a human product behavior, but not integrated with DentalFlow;
- amoCRM task-only use: not implemented.

The backend status endpoint returned `connected=false` and `configured=false`. The frontend CRM/settings/SMS/mailing pages are placeholders and do not display an amoCRM account or channel.

## Official amoCRM capability check

Checked only current official amoCRM documentation on 2026-07-13.

| Capability | Official capability | Limitation relevant to DentalFlow | Repository compatibility | Confidence |
|---|---|---|---|---|
| OAuth 2.0 | authorization-code and refresh-token flows | account-specific, server secret, rotating refresh token | initial exchange only | high |
| contacts | read/create/update contacts | requires authorized account and durable ID mapping | mapper draft only | high |
| leads | read/create/update leads | pipeline/status/account mapping required | draft only | high |
| tasks | create/read/update tasks | task identity, responsible user and duplicate policy required | absent | high |
| notes/events | CRM entities expose notes/events | not a delivery or reply channel | absent | high |
| webhooks | account webhooks exist for supported entity changes | signature/account/event replay handling still required | ignored placeholder | high |
| Chats API | integrations can register channel/scope, create chats/import/send messages and process webhooks/statuses | integration acts as the external transport; not a generic bridge to arbitrary installed widget | entirely absent | high |
| inbound chat | message receiver/webhook models exist for the registered integration | sender/message/conversation mapping must be owned and verified | absent | high |
| native idempotency | not proven as a universal guarantee across CRM/chat operations | DentalFlow must enforce operation identity/recovery | absent | medium-high |

Official documentation names/areas reviewed: OAuth 2.0, API restrictions, Contacts, Leads, Tasks, Events/Notes, Webhooks, Chats API capabilities, Chats API methods and Chats API webhooks.

## API and rate-limit constraints

Official limits checked:

- up to 7 requests per second per integration;
- up to 50 requests per second per account;
- provider/account errors and rate limits require controlled backoff rather than frontend retries.

Recommended execution model:

- bounded background worker, not browser calls;
- per-tenant and per-amo-account queue isolation;
- throttling below official ceilings with jitter;
- respect retry-after/provider classification;
- token refresh traffic consumes account capacity;
- dead-letter/manual review after bounded attempts;
- no one failing tenant may exhaust all tenants;
- batching only where official endpoint semantics preserve identity and per-item results.

Reminder volume is expected to be modest per clinic, but bursts around day-before/same-day windows make scheduling and per-account backpressure necessary.

## Current message-send capability

Current DentalFlow installation: **none**.

The repository has no message command, provider client, chat channel registration, conversation resolver, message endpoint, template contract, worker or external message ID. A staff-entered manual reminder result `message_sent` is not evidence of a provider request.

Official amoCRM Chats capabilities do not change this result. DentalFlow would need to operate or explicitly integrate a real channel transport. No evidence shows that a currently installed WhatsApp/SMS connector can be driven by DentalFlow through a supported API.

## Current delivery-status capability

Current installation: **none**.

No provider message ID or status is stored. No webhook/polling path normalizes accepted/sent/delivered/read/failed states. The placeholder webhook discards events.

Official Chats API supports status exchange for a registered chat integration, but DentalFlow has no such integration. A synchronous API acceptance would still mean `accepted`, not `delivered`; neither means appointment confirmation.

## Current inbound-reply capability

Current installation: **none**.

Official chat webhooks can expose inbound messages/conversation identities to the integration that owns the channel. The repository lacks:

- a trusted webhook endpoint;
- provider account/channel verification;
- sender/contact/conversation/message mappings;
- correlation to patient, appointment and reminder job;
- duplicate-event protection;
- manual review queue for replies.

A phone number may belong to several patients or a representative. Therefore even a verified inbound message must not automatically confirm an appointment from arbitrary text.

## Communication command model

Provider-neutral immutable command:

```text
tenant_id
reminder_job_id
appointment_id
patient_id
contact_id
channel
purpose_code
language
consent_snapshot
suppression_snapshot
appointment_version
reminder_job_version
operation_key
safe_variable_map
requested_at
```

Purpose codes:

- `appointment_confirmation_request`;
- `appointment_day_before_reminder`;
- `appointment_same_day_reminder`;
- `control_call_task`.

The command contains no free-form clinical payload. Eligibility is decided from DentalFlow facts immediately before execution.

## Proposed amoCRM adapter contract

Input: the provider-neutral communication command.

Adapter responsibilities, only after amoCRM hardening/channel proof:

- resolve exact tenant amoCRM account;
- resolve tenant-scoped external contact mapping;
- resolve supported channel/conversation or task-only mode;
- create the supported external object;
- preserve operation key/fingerprint;
- persist/return external operation ID;
- normalize status and safe error;
- expose recovery lookup;
- redact provider bodies and credentials.

Normalized output:

```text
accepted | rejected | uncertain | manual_action_required
external_id?
safe_error_code?
retryable
timestamp
```

The adapter must never confirm appointments, complete reminder jobs merely because a provider accepted a request, create clinical/financial facts, or bypass consent/suppression.

## Task-only fallback

Possible flow:

```text
DentalFlow reminder job
→ amoCRM task assigned to administrator
→ administrator manually sends/calls
→ result manually recorded in DentalFlow
```

Assessment:

- duplicates the existing `/reminders` queue;
- creates two task states that can diverge;
- requires responsible-user mapping and task ID synchronization;
- weakens audit because completion in amoCRM does not prove the DentalFlow result;
- invites duplicate manual and amoCRM processing;
- offers little value unless staff already live exclusively in amoCRM and bidirectional task synchronization is proven.

The safest fallback remains the existing DentalFlow manual reminder queue. amoCRM task synchronization is not recommended as the next slice.

## Inbound reply handling

Initial safe rule:

1. verify provider account/channel/event identity;
2. deduplicate external event/message ID;
3. correlate to external conversation/contact and candidate DentalFlow contacts;
4. if correlation is unique, create a manual review item linked to the communication operation;
5. if shared number/representative/ambiguous patient, require manual patient and appointment selection;
6. staff interprets `да`, `нет`, `перенесите` or free text;
7. existing controlled confirmation/reschedule workflow records the fact.

No arbitrary inbound text automatically confirms, cancels or reschedules an appointment.

## Idempotency

Required operation identities:

| Operation | Identity |
|---|---|
| contact synchronization | tenant + provider account + patient/contact version + operation key |
| task creation | tenant + provider account + reminder job/version + purpose |
| note creation | tenant + provider account + communication operation + note purpose |
| message creation | tenant + provider account + reminder job/version + channel + purpose + operation key |
| webhook consumption | provider account + external event ID |
| reply processing | provider account + external message ID + review operation key |

Rules:

- same key and same fingerprint returns replay;
- same key with changed payload is rejected;
- intent and fingerprint persist before external call;
- provider account and external ID persist transactionally;
- retry never generates a new logical identity;
- provider-native idempotency may supplement, not replace, DentalFlow enforcement.

## Uncertain outcomes

A timeout before a request leaves the process may be retryable. A timeout after transmission is `uncertain`.

Required behavior:

1. persist operation as processing before call;
2. send with stable operation identity where supported;
3. on ambiguous response, retain `uncertain`;
4. query provider by stored request/message/external reference or consume webhook;
5. retry only after a definitive not-found/rejected result and policy approval;
6. never blind-send a second message;
7. surface manual review when provider recovery is impossible.

Current amoCRM skeleton has no recovery lookup or external operation persistence.

## Reschedule/cancellation behavior

DentalFlow remains authoritative.

- reschedule supersedes stale reminder jobs/commands by appointment and reminder-job version;
- worker rechecks current appointment version, eligibility, consent and suppression under lock immediately before external call;
- cancellation/no-show cancels pending work;
- accepted external messages remain immutable history and are not erased;
- in-flight uncertain work is resolved, not blindly repeated;
- optional reschedule/cancellation notices would be distinct future purpose codes, not reuse stale commands.

The existing reminder migrations already invalidate/supersede jobs on appointment lifecycle changes. Future orchestration must consume that authority rather than reproducing it in amoCRM.

## Consent and suppression behavior

DentalFlow already contains tenant-scoped authoritative:

- normalized patient/representative contacts;
- preferred language/channel;
- channel-specific consent states;
- channel and global suppression;
- append-only consent events;
- duplicate-contact flag;
- idempotent communication-profile operations.

Before every command execution:

- resolve exact contact;
- reject missing/unverified/ambiguous contact as policy requires;
- recheck consent and suppression;
- compare snapshots/versions;
- consent withdrawal or suppression blocks new communication;
- amoCRM contact data must never override DentalFlow consent/suppression.

## Security/privacy payload allowlist

Allowed variables:

- patient first name;
- clinic name;
- appointment date;
- appointment time;
- doctor display name;
- callback phone;
- purpose code.

Forbidden:

- diagnosis, complaints or findings;
- dental chart;
- treatment plan;
- treatment/clinical notes;
- balance, debt, payments or other finance facts;
- medical documents;
- unrestricted patient notes;
- raw consent evidence or secrets.

Additional concerns:

- amoCRM users may have broad visibility and retention outside DentalFlow;
- data residency/retention and account permissions require tenant approval;
- logs must not contain patient contact values;
- representative identity must remain explicit;
- deletion/archiving cannot erase DentalFlow audit facts.

## Failure matrix

| Failure | Detection | Persisted state | Retry decision | Manual intervention/audit | Patient risk |
|---|---|---|---|---|---|
| amoCRM not configured | account lookup missing | rejected | no | configure account; `amo_not_configured` | no send |
| OAuth expired | expiry/401 | blocked/retryable after refresh | refresh once | health alert | delay |
| OAuth revoked | refresh/401 terminal | rejected | no blind retry | reauthorize | missed reminder |
| concurrent refresh | credential version/lock | one refresh owner | wait/reload | metric/audit | duplicate auth failure |
| contact absent | mapping lookup | manual action required | no send | map/create via controlled flow | wrong/no recipient |
| duplicate contacts | >1 valid mapping | blocked/manual review | no | select/merge mapping | privacy leak |
| lead absent | adapter mode requires lead | rejected/manual | policy-specific | create controlled lead or avoid dependency | operational only |
| channel widget disabled | capability/health check | rejected | no until restored | tenant alert | missed reminder |
| send API unavailable | capability matrix | rejected | no | choose provider/manual queue | no duplicate |
| rate limit | 429/retry hint | retryable | delayed backoff | metric | delayed reminder |
| timeout before acceptance | transport evidence | retryable/uncertain by stage | bounded | audit | delay |
| timeout after acceptance | request sent, no result | uncertain | recovery first | manual if no lookup | duplicate-send risk |
| webhook duplicate | unique event key | replay/no-op | none | duplicate metric | none |
| webhook delayed | event time/order | pending/late event | reconcile | audit latency | stale status |
| webhook wrong account | verified account mismatch | rejected | no | security alert | cross-tenant leak |
| patient rescheduled during send | version recheck/event | superseded or accepted history | do not resend stale content | review accepted stale send | confusing message |
| patient cancelled during send | lifecycle recheck | cancelled or accepted history | no retry | review if accepted | confusing message |
| consent withdrawn during send | consent version recheck | blocked or accepted history | no new send | audit withdrawal race | privacy risk |
| shared family number | duplicate contact candidates | manual review | no automatic send/reply action | choose patient/representative | wrong patient |
| representative reply | contact owner metadata | manual review | n/a | staff interpretation | authority ambiguity |
| manual and amoCRM processing | reminder operation claim/key | duplicate prevented/conflict | no | reconcile queue | duplicate contact |
| DentalFlow unavailable after provider acceptance | durable pre-call operation | uncertain/accepted recovery | provider lookup/webhook | manual review | duplicate risk if ignored |
| amoCRM unavailable after operation persistence | processing/retryable | retryable | bounded backoff | dead-letter | delay |

Safe error codes:

`amo_not_configured`, `amo_authorization_required`, `amo_token_expired`, `amo_account_mismatch`, `amo_rate_limited`, `amo_contact_mapping_missing`, `amo_channel_unavailable`, `amo_message_not_supported`, `amo_operation_uncertain`, `amo_external_rejected`, `amo_webhook_untrusted`, `amo_tenant_mismatch`.

No user message exposes token, refresh token, secret, raw provider body, stack trace or credentials.

## Observability

Metrics:

- commands prepared;
- requests accepted/rejected/uncertain/recovered;
- duplicate prevented;
- rate limited;
- token refresh success/failure;
- missing/duplicate contact mappings;
- inbound replies and manual review backlog;
- per-tenant/account failure and latency.

Structured logs:

- correlation ID;
- tenant ID;
- operation type;
- provider account reference;
- external object type and redacted ID;
- safe error code;
- duration/retry classification.

General logs exclude patient phone/email, message body, token and raw provider payload.

## Browser/network findings

Local frontend and standalone proxy were started without amoCRM credentials.

- `/crm`, `/settings`, `/sms`, `/mailing` rendered placeholders;
- CRM/settings did not display a connected account or health state;
- proxy status returned provider `amocrm`, `connected=false`, `configured=false` and no token properties;
- browser smoke for all four pages had zero write requests, zero failed requests and zero fatal console errors;
- forbidden secret terms were not visible;
- Chrome DevTools MCP 1.5.0 confirmed zero external amoCRM/Kommo requests, zero message endpoint requests and zero write methods;
- MCP console showed only existing accessibility issues and a harmless missing resource, not integration failures;
- no external amoCRM mutation or message send occurred.

Required network proof:

- external amoCRM mutation calls: `0`;
- message sends: `0`;
- token values visible: `0`;
- service-role visible: `0`.

## Browser smoke

Browser smoke passed for the reachable placeholder surfaces and disconnected backend status. The absence of a tenant switcher or amoCRM status/configuration UI is itself a finding: there is no role-aware operational integration surface to test.

## Local experiment findings

- local catalog assertions: `45/45` passed for `integration_tokens`, reminder jobs and communication contact/preferences tables;
- `integration_tokens` has tenant/provider uniqueness, RLS and no anon/authenticated direct writes;
- no runtime code reads/writes that token table;
- reminder jobs and consent/suppression are real, tenant-scoped and provider-neutral;
- backend status safely omits tokens;
- backend Node syntax check passed;
- frontend production bundle/source scan contained no amoCRM secret/token references;
- no real OAuth exchange or refresh was attempted;
- no local or cloud data mutation was required;
- an attempted cloud migration tool call was refused by active policy before any precheck or apply; cloud remained untouched.

## Architecture options comparison

Score: 1 poor, 5 strong. Complexity and maintenance scores are reversed: 5 means easier/lower burden.

| Option | Complexity | Security | Reliability | Lock-in | Duplicate safety | Observability | Tenant isolation | Operational value | Future providers | Maintenance | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A. Direct amoCRM communication adapter | 2 | 1 | 1 | 1 | 1 | 2 | 1 | 3 if channel existed | 1 | 2 | reject now |
| B. Provider-neutral orchestration + amoCRM adapter later | 3 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | recommended |
| C. amoCRM task synchronization only | 3 | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | duplicates `/reminders` |
| D. Keep DentalFlow manual queue only | 5 | 5 | 4 | 5 | 4 | 4 | 5 | 3 | 2 | 5 | safe interim fallback |

## Recommended architecture

**Option B: provider-neutral communication orchestration with amoCRM as a possible later adapter.**

Why:

- DentalFlow already owns reminder jobs, appointment versions, contacts, consent and suppression;
- a durable communication operation is needed regardless of provider;
- it creates one idempotent/observable uncertain-result boundary before irreversible sends;
- amoCRM channel capability and OAuth/account safety are not established;
- it prevents vendor-specific fields from leaking into reminder jobs;
- another provider can be added without rewriting scheduling/consent logic;
- manual queue remains the fallback when no adapter is configured.

The first orchestration slice must not send messages. It should persist commands/operations, snapshots, state, idempotency, eligibility recheck and adapter-neutral result/error contracts using a no-op/manual adapter in tests.

## Recommended next task

### Exact next task

**COMMUNICATION-ORCHESTRATION-FOUNDATION-001**

Smallest safe scope:

- provider-neutral communication operation/command persistence;
- tenant-scoped operation key and fingerprint;
- immutable appointment/reminder/contact/consent/suppression snapshots;
- state machine for prepared/processing/accepted/rejected/uncertain/manual-review/superseded/cancelled;
- safe error taxonomy;
- recovery contract without external implementation;
- lifecycle/consent invalidation and audit/metrics foundation;
- no provider call, no OAuth change, no message send.

## Known blockers

A real amoCRM adapter remains blocked by:

- no tenant-bound production OAuth/account store;
- no refresh rotation or concurrency protection;
- no exact installed channel/vendor evidence;
- no channel/scope/secret/conversation/message model;
- no external reference table;
- no trusted webhook/account verifier;
- no provider recovery lookup;
- no role-aware integration UI/health;
- no worker/backpressure/dead-letter path;
- no confirmed API right to send through any existing WhatsApp/SMS widget.

## Issues / limitations

- No production amoCRM account or installed-widget inventory was inspected because the task forbids credentials and production mutation; repository/runtime evidence proves no configured channel locally.
- Official capabilities describe what a properly registered integration can build, not what an unknown third-party widget permits.
- Data residency, retention, commercial connector terms and clinic-specific amoCRM user permissions require a later tenant/vendor review.
- Current patient external CRM metadata may display stale/unverified IDs and should not be trusted for communication.

## What was intentionally not implemented

- no migration, source or UI change;
- no OAuth/token refresh change;
- no provider abstraction implementation;
- no contact, lead, task or note creation;
- no message, SMS, WhatsApp or email send;
- no webhook, worker, cron or Edge Function;
- no cloud access/apply;
- no credentials or token values;
- no fixture committed;
- no package/lock change;
- no next task started;
- no PR merge;
- no HEP-V2 work.

## Validation

- baseline/PR/duplicate checks: passed;
- strict changed-file scope before report: clean;
- backend `npm run check`: passed;
- local schema assertions: `45/45` passed;
- browser smoke: passed;
- Chrome DevTools MCP 1.5.0 network inspection: passed;
- frontend secret scan: no production secret references;
- `npm run lint`: passed;
- `npm run test -- --run`: **96 files / 1070 tests passed**;
- `npm run build`: passed;
- existing unrelated React `act(...)`, intentional error-path logs and Vite bundle-size warning remain non-blocking.

## Checks

- exactly one report file changed: passed;
- production code changed: no;
- migrations/package/generated types changed: no;
- external amoCRM writes: 0;
- message sends: 0;
- secrets exposed: 0;
- official documentation check: complete;
- four architecture options compared: complete;
- exactly one next task selected: complete.

## Fresh CI

Reviewed pre-update CI:

- workflow: `CI`;
- run ID: `29250618691`;
- tested SHA: `2eff9c5361bdc6cc435ec43e0e55fc0e95170c30`;
- validate: `success`;
- merge guard: `success`.

A fresh CI run on the final report-update head is required after this update. The PR must remain open and unmerged; final head/run metadata is recorded in the immutable receipt.

## Final verdict

Final verdict: **PASS**

AMOCRM REMINDER COMMUNICATION INTEGRATION RECONCILED AND NEXT SAFE SLICE IDENTIFIED
