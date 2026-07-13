# AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001

## Final verdict

**PARTIAL: tenant-specific installed amoCRM channel evidence and fresh browser/local-runtime validation are unavailable; repository and official API evidence identify the next safe hardening slice but do not authorize message delivery**

## Executive summary

The current amoCRM implementation is a disconnected development skeleton, not a production integration and not a reminder communication boundary. It has server-side authorization-code exchange, one process-global in-memory credential set, placeholder sync routes, and a webhook that accepts and ignores requests. It has no authentication, role or tenant binding, durable encrypted credential repository, refresh implementation, external-reference repository, CRM synchronization, chat channel, send operation, delivery processing, or inbound-reply correlation.

DentalFlow remains authoritative for appointments, reminder jobs, contact consent, suppression and opt-out. Official amoCRM documentation shows that CRM entities and a separately registered Chats API channel can support messages, statuses and history, but that requires a channel, signed requests, per-account `scope_id`, hooks, conversation IDs and a real transport. None is evidenced here.

Target architecture: **B, provider-neutral communication orchestration with amoCRM as one possible adapter.** Exact next task: **`AMOCRM-INTEGRATION-HARDENING-001`**. No external mutation or cloud change was performed.

## Branch

`recon/amocrm-reminder-communication-integration-recon-001`

## PR URL

https://github.com/NckNA/codex-test/pull/357

## Baseline

- repository: `NckNA/codex-test`;
- base: `main`;
- exact verified baseline: `db6f298bc30a886ee569245fcb5599a0735b24d2`;
- PR #356 is merged at that commit;
- duplicate task PR search returned none;
- branch created from the exact baseline.

## Final head

Recorded in the final response because this file cannot contain its own future commit SHA.

## Changed files

Exactly `_ai_work/REPORTS/AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001_recon.md`. No other file is intended or allowed.

## Pre-read

Reviewed the four required reminder reports, AMO-001 through AMO-004, AUDIT-005, amoCRM architecture/security/mapping/sync documents, backend routes/services/config/docs, frontend mapper/types/UI, patient integration storage, reminder types/repositories, initial schema, token table, package scripts and CI.

Official amoCRM OAuth, limits, contacts, leads, tasks, notes/events, CRM webhooks, Chats capabilities, methods and hook formats were checked on 2026-07-13.

## Existing amoCRM assets

| Asset | Finding | Classification |
|---|---|---|
| backend server/routes | unauthenticated global status/connect/callback/disconnect; sync 501; webhook ignored | risky partial skeleton |
| OAuth client | code exchange only; no refresh or CRM client | partial |
| state store | random one-time ten-minute state, not bound to user/tenant/account | partially reusable |
| credential store | one global in-memory object, lost on restart, no lock/version | unsafe for production |
| global config | one account/application configuration | not multi-tenant |
| frontend mapper/types | unused contact/lead preview; no network | dead placeholder |
| patient external CRM metadata | optional contact/lead/deal IDs in replaceable JSON | risky legacy model |
| patient CRM panel | display-only source/status/external IDs | active display only |
| treatment-plan amoCRM button | disabled, no handler | placeholder |
| `integration_tokens` table | tenant/provider schema intent, unused by backend; lacks account identity/refresh lock | insufficient foundation |
| historical docs/reports | design intent, not runtime capability | documentation |

No production integration repository, channel configuration, message/task/note client, signed webhook verifier, delivery store, recovery lookup, or integration tests exist.

## Current data-flow map

DentalFlow → amoCRM: **none**. The unused patient draft contains name/legacy phone. The unused lead draft contains patient name, treatment-plan title and total price, so it is not suitable for reminder communications. Appointments, cancellations, contacts, tasks, notes, statuses and messages are not sent.

amoCRM → DentalFlow: **none**. Contact/lead/task/note changes are not read. Incoming webhook bodies are discarded. Delivery statuses, replies and external identifiers are not ingested. There is no trigger, idempotency key, replay, failure recovery, tenant boundary or audit.

## External ID model

Current: account/domain only in global memory; integration/client ID in global environment; optional contact/lead/deal IDs inside patient JSON; no task/note/message/conversation/webhook/channel IDs; no composite uniqueness; stale and duplicate mappings are possible; appointments have no mapping.

Minimum required:

- `integration_accounts`: tenant, provider, verified account ID/domain, status, credential generation, health/revocation, unique tenant/provider;
- `integration_external_refs`: tenant + account + local entity/type + external type/ID, history/version and bidirectional composite uniqueness;
- later, only with channel evidence, `integration_channel_connections`: channel ID, `scope_id`, vendor/type, capabilities, hook version and server-only secret reference.

## OAuth and secret boundary

The authorization-code exchange is server-side and does not return raw credentials to frontend. Everything else is insufficient: routes are unauthenticated; state is not bound to actor/tenant/account; credentials are global and memory-only; expiry is not enforced; refresh, encryption, revocation, audit and exact account verification are absent.

Official refresh credentials rotate after use, so future refresh must be transactional with a row lock or compare-and-swap, credential generation and stale-result rejection. Credentials must never reach frontend or logs.

## Current tenant isolation

Failed for amoCRM. No tenant/user/role exists in routes, state or credential store; there is no one-tenant-to-one-account rule, account ID verification, tenant throttling, hook account validation or tenant audit. This is tolerable only because frontend and sync are disconnected.

Required: one tenant maps to one verified account unless explicitly redesigned; no global default or fallback; all credentials/external IDs are tenant+account composite; mismatch fails closed.

## Current role model

Owner configures and authorizes; admin operates according to tenant policy; registrar sees safe status and performs manual reminders; doctor/cashier cannot configure; unknown/no tenant is blocked. No role receives raw credentials. Current amoCRM routes implement none of this.

## Actual connected communication channels

None evidenced. No native/custom chat, WhatsApp, SMS, email, vendor connector, channel ID, channel secret reference, `scope_id`, sender identity, templates, sandbox, message ID or conversation ID exists in repository or accessible Supabase configuration.

Read-only Supabase inspection found zero `integration_tokens` rows and migration history only through `0013`, behind repository `0031`; this proves accessible-project drift, not an installed channel.

## Official amoCRM capability check

- OAuth and refresh are supported, but exact account domain and secure credential lifecycle are integrator responsibilities.
- Contact, lead, task, note and CRM webhook APIs exist.
- Chats API requires a separately connected signed channel and returns account-specific `scope_id`.
- Chat creation, message transfer, delivery status (`sent/delivered/read/error`) and conversation history exist for such a channel.
- Official capability does not prove an installed WhatsApp/SMS/email widget is callable by DentalFlow.
- No generic reminder-send idempotency key was established; DentalFlow must enforce operation identity.

Confidence: high for documented capabilities, low for tenant-specific channel availability because no external installation evidence exists.

## API and rate-limit constraints

Official guidance documents 7 requests/second per integration and 50 requests/second per account, HTTP 429 on breach and possible 403 blocking after repeated violations. A future path needs bounded backend work, per-tenant/account throttling, safe backoff, recovery before resend, manual/dead-letter handling, and no frontend direct calls.

## Current message-send capability

**Absent.** No command, endpoint, channel, transport, sender/template, operation record or external message ID exists.

## Current delivery-status capability

**Absent.** There is no message ID, delivery attempt, status webhook/polling or normalizer. Manual `message_sent` is not proof of delivery.

## Current inbound-reply capability

**Absent.** The webhook ignores bodies and verifies neither signature nor account/channel. There is no conversation/patient/reminder correlation.

## Communication command model

```text
tenant_id, reminder_job_id, appointment_id, patient_id,
communication_contact_id, channel, purpose_code, language,
consent_snapshot, suppression_snapshot, appointment_version,
reminder_job_version, operation_key, payload_fingerprint,
safe_variable_map, requested_at
```

Purpose codes: confirmation request, day-before reminder, same-day reminder, control-call task. No free-form clinical payload.

## Proposed amoCRM adapter contract

Input: immutable communication command. Resolve exact tenant account, contact and channel/conversation; preserve operation key; perform only approved action; store external ID; return `accepted`, `rejected`, `uncertain`, or `manual_action_required` plus safe error/retry data; expose recovery lookup.

The adapter never confirms appointments, completes reminder work on mere acceptance, creates clinical/financial facts, changes consent, or falls back to another tenant.

## Task-only fallback

Rejected now. Synchronizing amoCRM tasks would duplicate `/reminders`, create two queues and completion reconciliation, weaken audit consistency, and increase duplicate-contact risk without adding delivery evidence.

## Inbound reply handling

Future verified replies create manual review. Signature/account/channel and event ID are verified; shared/representative contacts remain ambiguous; staff interprets `да`, `нет`, `перенесите` or free text and invokes existing confirmation/reschedule operations. Arbitrary text is not automatic confirmation.

## Idempotency

Same operation key + same fingerprint replays; same key + different fingerprint rejects. Reserve locally before side effect; store external ID transactionally; deduplicate hooks by provider ID/fingerprint; timeout after possible acceptance becomes uncertain; recover before retry; never blindly resend.

## Uncertain outcomes

Accepted is not delivered; delivered is not replied; replied is not confirmed. States must distinguish prepared, dispatching, accepted, rejected, uncertain, delivered, read and manual review. Unresolved uncertainty blocks automatic resend.

## Reschedule/cancellation behavior

Commands bind to appointment/reminder versions. Reschedule supersedes stale work. Cancellation, no-show, arrival, visit progress/completion and consent withdrawal block pending work. In-flight uncertainty is reviewed, not blindly retried.

## Consent and suppression behavior

DentalFlow remains authoritative. Snapshot at command preparation and recheck immediately before side effect. amoCRM metadata cannot grant consent, clear suppression or override representative rules.

## Security/privacy payload allowlist

Allowed: patient first name, clinic, appointment date/time, doctor display name, callback phone, purpose code.

Forbidden: diagnosis, complaints, findings, tooth chart, treatment title/details, price/total, balance/debt/payment, clinical notes and medical documents. The current lead mapper includes treatment title and total price and must not be reused.

## Error model

Safe codes: `amo_not_configured`, `amo_authorization_required`, `amo_token_expired`, `amo_account_mismatch`, `amo_rate_limited`, `amo_contact_mapping_missing`, `amo_channel_unavailable`, `amo_message_not_supported`, `amo_operation_uncertain`, `amo_external_rejected`, `amo_webhook_untrusted`, `amo_tenant_mismatch`.

## Failure matrix

| Failure | Persisted result | Action/risk |
|---|---|---|
| not configured/expired/revoked | safe rejected/auth-required | configure, atomic refresh or reconnect |
| concurrent refresh | generation conflict | one winner; reject stale result |
| missing/duplicate contact | manual review | no automatic send; wrong-recipient risk |
| channel unavailable | manual action | use DentalFlow queue |
| 429 | retryable delayed | bounded backoff |
| timeout after possible acceptance | uncertain | recovery before retry; duplicate risk |
| duplicate/delayed webhook | replay/pending | deduplicate, no duplicate effect |
| wrong-account webhook | rejected untrusted | security audit; critical cross-tenant risk |
| reschedule/cancel/withdrawal in flight | superseded/uncertain | block retry; review |
| shared/representative number | ambiguous | manual review |
| manual/external race | conflict/review | prevent duplicate contact |
| DentalFlow down after acceptance | uncertain | external recovery lookup |
| amoCRM down after local persist | prepared/retryable | bounded retry/manual fallback |

## Observability

Metrics: prepared, accepted, rejected, uncertain, recovered, duplicates prevented, rate limits, refresh conflicts, account mismatch, missing mappings, inbound replies, manual-review backlog, per-tenant failures. Logs: correlation/tenant/operation, redacted external ID, safe error, duration and credential generation. No general logging of contact values or message bodies.

## Browser/network findings

Fresh Chrome DevTools/HeadlessChrome was unavailable because Hermes local developer execution is blocked. Static and prior-audit evidence shows no frontend amoCRM calls, no mapper consumer, disabled sync UI, no frontend credential references, no message client, and no provider request path.

Required proof: external amoCRM mutations 0 by source capability; message sends 0; visible credential values 0 in source/contracts; visible service-role value 0 in this boundary. Fresh network capture remains missing evidence.

## Local experiment findings

Performed read-only: GitHub baseline/source/PR inspection, official documentation review, and Supabase schema/migration queries. No external write or cloud modification occurred. Local worktree/database/app/browser and local quality commands were unavailable.

## Architecture options comparison

| Option | Security/reliability | Lock-in/duplicates | Value/current feasibility |
|---|---|---|---|
| A direct amoCRM adapter | weak until major hardening | high lock-in and uncertain duplicates | blocked |
| B provider-neutral + amo adapter | strongest boundaries/observability | low lock-in, explicit idempotency | selected target; adapter blocked |
| C amo task sync | medium | duplicate queue/high reconciliation | rejected |
| D DentalFlow manual | safest current mode | no provider lock-in | required fallback, not target automation |

## Recommended architecture

**B: provider-neutral communication orchestration with amoCRM as one adapter.** Do not implement the adapter yet.

## Exact next task

**`AMOCRM-INTEGRATION-HARDENING-001`**: authenticate/authorize routes; bind state to tenant/actor/account; persist verified tenant/account; exact account verification; encrypted durable credentials; atomic refresh/concurrency protection; tenant-scoped revoke/health; constrained external references; safe audit/errors; disable unsafe global production behavior. No CRM objects, chat connection, message or reminder execution change.

## Known blockers

No configured account/channel/vendor/scope/sender/templates; no tenant-aware backend; no refresh/durable credentials/external-reference constraints; no message/delivery/reply storage; accessible cloud drift; no fresh browser/local execution.

## What was intentionally not implemented

No production code, migration, OAuth/refresh change, provider abstraction, message/delivery, CRM mutation, webhook, worker, cron, Edge Function, package/type/UI/fixture change, cloud apply, credential access, next task, or HEP-V2.

## Validation

Required commands: `npm run lint`, `npm run test -- --run`, `npm run build`. Local execution was unavailable. GitHub Actions runs install, ESLint, tests, build and merge guard for PRs to main. Fresh CI on the exact final head is required and reported in the final response.

Static validation: exact baseline, duplicate search, one intended file, source inventory, no send/channel implementation, no frontend credential reference, read-only Supabase inspection and official documentation review.

## Fresh CI

Pending exact-final-head workflow completion. Exact run and tested SHA are reported in the final response; placing them here would create a new untested head.

## Final verdict

**PARTIAL: tenant-specific installed amoCRM channel evidence and fresh browser/local-runtime validation are unavailable; repository and official API evidence identify `AMOCRM-INTEGRATION-HARDENING-001` but do not authorize message delivery**
