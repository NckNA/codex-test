# COMMUNICATION-ORCHESTRATION-FOUNDATION-001

## 1. Final verdict

**PARTIAL: local Supabase SQL regression/concurrency suites and authenticated browser/network smoke could not be executed because the local Hermes/Supabase runtime is unavailable; implementation, isolated domain tests and repository CI validation are otherwise complete**

## 2. Summary

This task adds a tenant-scoped, provider-neutral communication orchestration foundation. An eligible reminder job can be transformed into one immutable communication operation that snapshots the exact appointment, reminder job, selected contact, consent, suppression and simulation-route facts used at preparation time.

A communication operation is not a message. Simulation acceptance is not sending or delivery. Simulation never completes the reminder job, confirms the appointment or creates a confirmation attempt. Only deterministic `noop` and `mock` adapters exist; no external provider is contacted.

## 3. Branch

`feature/communication-orchestration-foundation-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/358

PR #358 is open as a draft and remains unmerged.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required and verified baseline: `1789e6e7bc0af276effff9087148f96ea544fe05`;
- PR #357 is merged at that exact baseline;
- no duplicate open or merged task PR was found;
- the feature branch was created from the exact baseline.

## 6. Final head

The exact final head is recorded in the final task response because a commit cannot contain its own future SHA.

## 7. Changed files

Exactly 20 files belong to the final diff:

- `_ai_work/REPORTS/COMMUNICATION-ORCHESTRATION-FOUNDATION-001_foundation.md`;
- `supabase/migrations/0032_communication_orchestration_foundation.sql`;
- `supabase/tests/0032_communication_orchestration_foundation_test.sql`;
- `supabase/tests/0032_communication_orchestration_concurrency.ps1`;
- `src/domain/communications/CommunicationCommand.ts` and tests;
- `src/domain/communications/CommunicationAdapter.ts` and tests;
- `src/domain/communications/CommunicationMigration.test.ts`;
- `src/domain/communications/adapters/NoopCommunicationAdapter.ts`;
- `src/domain/communications/adapters/MockCommunicationAdapter.ts`;
- `src/data/repositories/CommunicationOrchestrationRepository.ts` and tests;
- `src/data/hooks/useCommunicationOperations.ts` and tests;
- `src/components/communications/CommunicationOperationsPanel.tsx` and tests;
- `src/pages/CommunicationDiagnosticsPage.tsx`;
- `src/App.tsx`;
- `src/components/layout/Sidebar.tsx`.

No historical migration, package, lockfile, generated type, provider SDK, environment file, diagnostic log, temporary workflow or cloud configuration remains changed.

## 8. Pre-read

Reviewed the reminder operations reconnaissance, reminder queue foundation, manual reminder operations, communication contact/consent foundation and amoCRM reminder communication reconnaissance. Reconciled migrations `0029` through `0031`, reminder RPCs, communication eligibility, tenant roles, RLS, audit/activity helpers, integration-token skeleton, placeholders and CI.

## 9. Orchestration gap map

Before this task, reminder jobs represented durable manual work and communication eligibility represented provider-neutral readiness, but no durable object bound an exact reminder version to an exact contact, consent, suppression, route and structured command. No route snapshot, normalized simulation result, uncertain state or recovery contract existed.

Reusable foundations are reminder identity/versioning, eligibility, contacts, consent, suppression, tenant roles, RLS and audit/activity. Provider placeholders and the global amoCRM OAuth skeleton are unrelated and intentionally unused.

## 10. Purpose model

Stable purpose codes:

- `appointment_confirmation_request`;
- `appointment_day_before_reminder`;
- `appointment_same_day_reminder`;
- `appointment_control_call_task`.

Purpose is derived from reminder type. Unsupported, marketing, billing, clinical and free-form purposes are rejected.

## 11. Channel model

Supported channels are `sms`, `whatsapp` and `email`. Manual phone remains outside automated orchestration. One operation has exactly one immutable channel.

## 12. Operation schema

`public.communication_operations` binds tenant, reminder job, appointment, patient, contact, purpose, channel, language, operation key, fingerprint, exact entity versions, policy/eligibility versions, route/version and normalized simulation result. Composite foreign keys prevent cross-tenant references.

## 13. Snapshot model

Immutable validated JSON snapshots store:

- eligibility and blocked reasons;
- channel-specific consent state and evidence reference;
- global and channel suppression;
- masked contact metadata and destination fingerprint;
- appointment date/time, doctor, clinic and callback variables;
- route ID, adapter and configuration version;
- provider-neutral structured command.

No clinical or financial facts are snapshotted.

## 14. Destination privacy

Operations store only the selected contact ID, masked destination and SHA-256 destination fingerprint. Raw and normalized destinations are not copied into operation rows, command snapshots, audit or activity. The trusted adapter runtime must resolve the authoritative contact later.

## 15. Route model

`public.communication_routes` is tenant/channel scoped. Only `noop` and `mock` are accepted, `simulation_only` must be true, one enabled primary route per tenant/channel is enforced, disabled routes are not selected, and no global or cross-tenant fallback exists.

## 16. State model

- `prepared`;
- `simulation_running`;
- `simulation_succeeded`;
- `simulation_failed`;
- `simulation_uncertain`;
- `cancelled`.

No `queued`, `sending`, `sent`, `delivered`, `read` or `replied` state exists.

## 17. Result model

Normalized result codes:

- `accepted`;
- `rejected`;
- `temporary_failure`;
- `permanent_failure`;
- `timeout_before_acceptance`;
- `timeout_after_acceptance`;
- `unknown`.

`timeout_after_acceptance` and `unknown` remain uncertain and are never blindly retried.

## 18. Structured command

The command contains tenant, operation, reminder, appointment, patient and contact IDs; purpose; channel; language; masked destination; destination fingerprint; operation key; requested timestamp; and an allowlisted variable map.

Allowed variables are `patient_first_name`, `clinic_name`, `appointment_date`, `appointment_time`, `doctor_display_name` and `clinic_callback_phone`. Unknown, clinical and financial variables are rejected.

## 19. Preparation RPC

`prepare_communication_operation` authenticates owner/admin, locks and validates reminder/appointment/contact/preference rows, checks exact versions, derives purpose, re-runs eligibility, requires granted channel consent and no suppression, rejects representative review, selects one simulation route, builds snapshots/command/fingerprint, persists one immutable operation and records audit/activity once. It performs no adapter execution.

## 20. Operation identity

`(tenant_id, operation_key)` is unique. Same key plus same fingerprint replays. Same key plus changed payload is rejected. A second logically identical active operation is prevented by tenant/reminder/channel/fingerprint uniqueness.

## 21. Simulation RPC

`simulate_communication_operation` permits only declared scenarios and `noop/mock` routes. It revalidates current source facts, normalizes one deterministic simulation result, stores a deterministic simulation external ID and never changes reminder, appointment or confirmation state.

## 22. Recovery

`recover_communication_operation` reads the persisted normalized result. It does not call an adapter, create another operation or retry uncertain work. Uncertain remains uncertain until an explicit later recovery design exists.

## 23. Cancellation/invalidation

Prepared operations are reconciled when reminder jobs, appointments, contacts, communication preferences or routes change. Cancellation, supersession, reschedule, consent withdrawal, suppression, contact archive and route disable invalidate stale prepared operations. Completed simulation history remains immutable.

## 24. Adapter contract

`CommunicationAdapter` exposes `validateCommand`, `prepare`, `simulate` and `recover`. `NoopCommunicationAdapter` and `MockCommunicationAdapter` are deterministic and contain no fetch, XHR, provider SDK or outbound HTTP path.

## 25. Role matrix

- owner/admin: read, configure test routes, prepare, simulate and recover;
- registrar: safe read-only readiness and operation status;
- doctor/cashier/unknown/no tenant: blocked.

## 26. RLS

RLS is enabled on routes, route-operation idempotency storage and communication operations. Direct authenticated inserts, updates and deletes are revoked. Mutations use controlled RPCs only.

## 27. Audit/activity

Preparation, simulation start/result, cancellation and route changes create paired audit/activity facts once per logical transition. Metadata contains safe IDs, purpose/channel, adapter, state, masked destination and safe error only. Raw destinations, secrets, message bodies and clinical data are excluded.

## 28. Repository integration

The Supabase repository provides tenant-scoped route/operation reads and RPC-only route, preparation, simulation and recovery mutations. Errors are mapped to safe user messages. Supabase-active mode has no localStorage fallback and frontend code never executes an adapter.

## 29. Hook integration

`useCommunicationOperations` performs no fetch without a tenant, clears state on tenant switch, ignores stale responses, blocks duplicate actions, retains operation keys across ambiguous failures, attempts recovery before a user retry and preserves uncertain state visibly.

## 30. Diagnostic UI

`/communications` provides an owner/admin diagnostic panel for noop/mock routes, preparation, scenario simulation and recovery. Registrar receives read-only status. The UI warns: “Это тестовая операция. Сообщение пациенту не отправляется.” No “Отправить”, “Доставить” or real-send control exists.

## 31. Reminder queue integration

The diagnostics page reads the existing reminder queue and eligibility summary. Preparation receives exact reminder and appointment versions from the queue. Simulation does not alter reminder state.

## 32. SQL tests

`0032_communication_orchestration_foundation_test.sql` contains the required role/RLS, route, eligibility, consent, suppression, contact, snapshot, privacy, idempotency, result, recovery, audit/activity and side-effect scenarios.

Execution status: **not executed**, because local Supabase/Hermes is unavailable and cloud apply is forbidden.

## 33. Concurrency tests

`0032_communication_orchestration_concurrency.ps1` covers same-key replay, competing logical operations, consent/suppression/contact/reschedule races, simulation races, uncertain timeout, tenant-isolated keys, route-version races and deadlock counters.

Execution status: **not executed**, because the local Supabase runtime is unavailable.

## 34. TypeScript tests

Added domain, adapter, migration-contract, repository, hook and diagnostic-panel tests. An isolated local run passed **3 files / 17 tests** for command, adapter and migration contracts. The full repository Vitest step passed in CI after whitespace-tolerant migration assertions were corrected.

## 35. Browser smoke

Authenticated local browser smoke was not executed because the local Hermes/Supabase runtime is unavailable. No browser result is fabricated from static inspection.

## 36. Network proof

Static implementation and adapter tests prove there is no real provider implementation, amoCRM call, SMS/WhatsApp/email request, fetch/XHR or provider credential surface. Fresh authenticated browser network counters remain unclaimed without the local runtime.

## 37. Database counters

Required database counters could not be measured locally. The migration/tests define target zero invariants for duplicate active operations, unsafe consent operations, raw destinations, clinical variables, reminder changes, appointment confirmations, confirmation attempts, cross-tenant leaks and deadlocks.

## 38. Side-effect validation

No clinical, finance, stock, document, provider, amoCRM or credential mutation path was introduced. Runtime database before/after counters remain unclaimed because local Supabase could not be started.

## 39. Cleanup

Temporary bundle chunks, reconstruction workflows, diagnostic workflows/logs and package/CI modifications were removed. The final PR diff contains only the 20 intended implementation files. No cloud operation was performed. `supabase db reset --no-seed` could not be run without local Supabase.

## 40. Lint/test/build

- ESLint: passed on repository CI;
- full Vitest: passed on repository CI;
- isolated communication tests: 3 files / 17 tests passed;
- production build: TypeScript diagnostics found three integration errors, which were corrected before the final report commit;
- final production build result is recorded by fresh CI on the exact final head in the final task response.

## 41. Fresh CI

The report commit triggers fresh GitHub Actions CI on the exact final head. Its run ID and exact results are recorded in the final task response because this report cannot contain evidence from its own future commit.

## 42. Known limitations

- no real provider or delivery state;
- no template/content versioning;
- no inbound reply processing;
- no worker, scheduler, webhook or retry engine;
- callback phone remains optional until an authoritative tenant setting exists;
- local SQL, concurrency, authenticated browser, database counters and reset remain unavailable.

## 43. What was intentionally not implemented

No amoCRM adapter, OAuth change, provider credential, secret manager, external HTTP request, SMS, WhatsApp, email, worker, cron, webhook, retry engine, message editor, bulk messaging, automatic reminder completion, appointment confirmation, cloud migration apply or HEP-V2 was implemented.

## 44. Recommended next task

`COMMUNICATION-TEMPLATE-FOUNDATION-001`

Once durable operations, immutable snapshots, routes and normalized simulation outcomes exist, content must become tenant-scoped, language-aware, versioned and privacy-safe before any real adapter may be considered.
