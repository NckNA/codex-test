# COMMUNICATION-ORCHESTRATION-FOUNDATION-001

## 1. Final verdict

**PARTIAL: implementation is complete, but local Supabase SQL/concurrency and authenticated browser smoke require the local Hermes runtime before the final verdict can be upgraded**

## 2. Summary

This task adds a tenant-scoped, provider-neutral communication orchestration foundation. An eligible appointment reminder job may be transformed into one immutable communication operation that snapshots the exact appointment, job, contact, consent, suppression and simulation route facts used at preparation time. The operation remains distinct from a message and never completes the reminder job or confirms the appointment.

Only `noop` and `mock` simulation routes are supported. There is no real provider, amoCRM adapter, OAuth change, credential storage, HTTP call, worker, cron, webhook, retry engine, template engine, bulk messaging or external send.

## 3. Branch

`feature/communication-orchestration-foundation-001`

## 4. PR URL

Pending PR creation.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required and verified baseline: `1789e6e7bc0af276effff9087148f96ea544fe05`;
- PR #357 is merged at that baseline;
- no duplicate open or merged task PR was found;
- the feature branch was created from the exact baseline.

## 6. Final head

Recorded after final validation because a commit cannot contain its own future SHA.

## 7. Changed files

- `_ai_work/REPORTS/COMMUNICATION-ORCHESTRATION-FOUNDATION-001_foundation.md`;
- `supabase/migrations/0032_communication_orchestration_foundation.sql`;
- `supabase/tests/0032_communication_orchestration_foundation_test.sql`;
- `supabase/tests/0032_communication_orchestration_concurrency.ps1`;
- `src/domain/communications/CommunicationCommand.ts` and tests;
- `src/domain/communications/CommunicationAdapter.ts` and tests;
- `src/domain/communications/adapters/NoopCommunicationAdapter.ts`;
- `src/domain/communications/adapters/MockCommunicationAdapter.ts`;
- `src/data/repositories/CommunicationOrchestrationRepository.ts` and tests;
- `src/data/hooks/useCommunicationOperations.ts` and tests;
- `src/components/communications/CommunicationOperationsPanel.tsx` and tests;
- `src/pages/CommunicationDiagnosticsPage.tsx`;
- `src/App.tsx`;
- `src/components/layout/Sidebar.tsx`.

No historical migration, package, lockfile, generated type, provider SDK, environment file or cloud configuration is changed.

## 8. Pre-read

Reviewed the reminder operations reconnaissance, queue foundation, manual operations, communication contact/consent foundation and amoCRM communication reconnaissance reports. Reconciled migrations `0029` through `0031`, manual reminder RPCs, eligibility RPC, tenant roles, audit/activity helpers, integration token skeleton, placeholders and CI configuration.

## 9. Orchestration gap map

Before this task:

- reminder jobs represented durable manual work;
- communication eligibility represented provider-neutral contact/consent/suppression readiness;
- manual contact outcomes represented staff activity only;
- amoCRM represented a disconnected OAuth skeleton;
- no durable object bound eligibility to an exact provider-neutral command;
- no route/version snapshot, simulation result, uncertain state or recovery contract existed.

Reusable assets are reminder job identity/versioning, contact and consent facts, eligibility RPC, tenant roles, RLS and audit/activity helpers. Provider placeholders and global amoCRM token memory are incompatible and unused.

## 10. Purpose model

Stable purpose codes:

- `appointment_confirmation_request`;
- `appointment_day_before_reminder`;
- `appointment_same_day_reminder`;
- `appointment_control_call_task`.

Purpose is derived from the reminder type. Unsupported types are rejected. No marketing, billing, clinical or free-form purpose exists.

## 11. Channel model

Supported automated-operation channels are `sms`, `whatsapp` and `email`. Manual phone remains outside orchestration. One operation has exactly one immutable channel.

## 12. Operation schema

`communication_operations` binds one immutable operation to tenant, reminder job, appointment, patient, selected contact, purpose, channel, language, exact entity versions, policy version, eligibility version and route/version. Composite foreign keys prohibit cross-tenant references.

States are limited to prepared and simulation states. No sent, delivered, read or replied state exists.

## 13. Snapshot model

Validated JSON snapshots store:

- eligibility and blocked reasons;
- channel-specific consent event/state;
- global and channel suppression;
- masked contact metadata and destination fingerprint;
- appointment date/time, clinic and doctor display values;
- route ID, adapter code and configuration version;
- the safe structured command.

Snapshots are immutable after creation.

## 14. Destination privacy

The operation stores contact ID, masked destination and SHA-256 destination fingerprint. The normalized/raw destination is never copied into the operation, command, audit or activity record. Frontend readers receive the masked value only.

## 15. Route model

`communication_routes` is tenant/channel scoped. Only `noop` and `mock` are accepted, `simulation_only` is constrained true, one active route per tenant/channel is enforced, disabled routes are not selected and there is no global fallback.

## 16. State model

- `prepared`;
- `simulation_running`;
- `simulation_succeeded`;
- `simulation_failed`;
- `simulation_uncertain`;
- `cancelled`.

A database check constrains timestamps and normalized results for every state.

## 17. Result model

Normalized result codes:

- accepted;
- rejected;
- temporary_failure;
- permanent_failure;
- timeout_before_acceptance;
- timeout_after_acceptance;
- unknown.

Accepted means only that a simulation accepted the command. Timeout after possible acceptance and unknown are uncertain and cannot be retried automatically.

## 18. Structured command

The command includes tenant/operation/reminder/appointment/patient/contact identity, purpose, channel, language, masked destination, destination fingerprint, operation key, requested timestamp and an allowlisted variable map.

Allowed variables are patient first name, clinic name, appointment date/time, doctor display name and clinic callback phone. Unknown or clinical variables are rejected.

## 19. Preparation RPC

`prepare_communication_operation`:

1. authenticates and requires clinic owner/admin;
2. locks reminder job, appointment, preferences and selected contact;
3. validates exact job/appointment versions;
4. derives purpose;
5. re-runs provider-neutral eligibility;
6. requires verified non-representative contact, granted consent and no suppression;
7. selects one enabled simulation route;
8. builds snapshots and safe variables;
9. computes deterministic fingerprint;
10. stores one immutable operation;
11. records audit/activity once;
12. performs no adapter execution.

## 20. Operation identity

`(tenant_id, operation_key)` is unique. Same key and same identity replays; the same key with different parameters is rejected. A second logically identical operation is prevented by the tenant/reminder/channel/fingerprint unique index.

## 21. Simulation RPC

`simulate_communication_operation` supports only the seven declared scenarios. It revalidates current job, appointment, contact, consent, suppression and route facts, records a deterministic external simulation ID, normalizes the result and never changes reminder or appointment state.

Simulation keys and fingerprints are unique and replay-safe.

## 22. Recovery

`recover_communication_operation` returns persisted state only. It may mark a persisted terminal simulation as recovered, but never runs the adapter and never creates another operation. Uncertain remains uncertain.

## 23. Cancellation/invalidation

Prepared operations are reconciled by authoritative updates to reminder jobs, appointments, contacts, preferences and routes. Stale work is cancelled with a safe reason. Completed simulation history remains immutable.

## 24. Adapter contract

The TypeScript `CommunicationAdapter` contract exposes `validateCommand`, `prepare`, `simulate` and `recover`. Noop and mock implementations are deterministic, scenario-driven and contain no fetch/XHR/HTTP path.

## 25. Role matrix

- owner/admin: read, configure simulation routes, prepare, simulate and recover;
- registrar: safe read-only diagnostics;
- doctor/cashier/unknown/no tenant: blocked.

## 26. RLS

RLS is enabled on routes, route-operation idempotency storage and communication operations. Browser-authenticated direct inserts, updates and deletes are revoked. Writes occur only through controlled RPCs.

## 27. Audit/activity

Preparation, simulation start/result, cancellation and route changes create paired audit/activity facts exactly once. Metadata contains IDs, purpose/channel, adapter, state, masked destination and safe error only. It excludes raw destination, secrets, message body and clinical data.

## 28. Repository integration

The Supabase repository provides tenant-scoped route and operation reads plus RPC-only route, preparation, simulation and recovery writes. No localStorage fallback or frontend adapter execution exists in Supabase-active mode.

## 29. Hook integration

`useCommunicationOperations` clears state on tenant change, ignores stale responses, blocks duplicate actions, retains keys across ambiguous failures, attempts recovery before retry and visibly preserves uncertain states.

## 30. Diagnostic UI

`/communications` is available to reminder-operation roles. Owner/admin can configure noop/mock routes, prepare a test operation, select a scenario, simulate and recover. Registrar receives read-only readiness/status. The UI states: “Это тестовая операция. Сообщение пациенту не отправляется.” It contains no real-send action.

## 31. Reminder queue integration

The diagnostics page reads the existing reminder queue and displays eligibility/blocking reasons. Preparation uses the exact reminder and appointment versions from that queue. Simulation does not alter the job.

## 32. SQL tests

`0032_communication_orchestration_foundation_test.sql` covers role/RLS isolation, route constraints, eligibility/consent/suppression/contact failures, immutable snapshots, privacy, idempotency, all simulation outcomes, recovery, audit/activity and absence of reminder/confirmation/clinical/financial side effects.

Execution status: pending local Supabase runtime.

## 33. Concurrency tests

The PowerShell suite covers same-key replay, competing logical operations, consent/suppression/contact/appointment races, simulation races, uncertain timeout, cross-tenant keys and route-version races. It reports operations, replays, conflicts, uncertain/cancelled operations, duplicate active operations, audit/activity and deadlocks.

Execution status: pending local Supabase runtime.

## 34. TypeScript tests

Domain, adapter, migration-contract, repository, hook and diagnostic panel tests were added. Static TypeScript transpilation succeeds for all new/modified source files. Full Vitest execution is recorded after CI.

## 35. Browser smoke

Pending authenticated local Supabase browser runtime.

## 36. Network proof

Static code and tests contain no real provider implementation or outbound HTTP path. Adapter tests fail if fetch is invoked. Fresh browser network proof remains pending local runtime.

## 37. Database counters

Pending local Supabase validation. Target zero counters: duplicate active operations, unsafe consent operations, raw destinations, clinical variables, reminder changes, appointment confirmations, confirmation attempts, cross-tenant leaks and deadlocks.

## 38. Side-effect validation

The implementation contains no clinical or finance mutation. Local database counters remain pending.

## 39. Cleanup

No cloud operation was performed. Local QA cleanup/reset remains pending the local Supabase runtime.

## 40. Lint/test/build

Pending fresh CI and local runtime validation.

## 41. Fresh CI

Pending PR creation and final head.

## 42. Known limitations

- no real provider or delivery state;
- no template/content versioning;
- no inbound reply processing;
- no worker, scheduler or retry engine;
- callback phone remains optional/empty until an authoritative tenant setting exists;
- local SQL, concurrency and browser validation cannot be claimed without the local runtime.

## 43. What was intentionally not implemented

No amoCRM adapter, OAuth change, provider credential, external HTTP request, SMS, WhatsApp, email, worker, cron, webhook, retry engine, message body editor, bulk messaging, automatic reminder completion, appointment confirmation, cloud migration apply or HEP-V2.

## 44. Recommended next task

`COMMUNICATION-TEMPLATE-FOUNDATION-001`

Once durable operations, immutable snapshots, routes and normalized simulation outcomes exist, content must become tenant-scoped, language-aware, versioned and privacy-safe before any real adapter may be considered.
