# PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001 Foundation Report

## 1. Final verdict

PLATFORM SUPERADMIN TENANT LIFECYCLE IMPLEMENTED AND VERIFIED

## 2. Summary

Implemented a platform-level administration foundation for DentalFlow tenants. Platform superadmins are global identities separate from clinic memberships. They can create clinics transactionally with an initial clinic owner and subscription period, manage owner recovery, change subscription periods with immutable history, suspend, resume, expire and archive clinics, and view safe lifecycle history without receiving automatic access to clinical or financial data.

Operational tenant access is enforced in PostgreSQL, not merely hidden in the frontend. Suspended, expired, archived and incomplete tenants cannot mutate protected clinical, appointment, finance, communication, integration or tenant-settings domains. Hard deletion is not a product operation.

## 3. Branch

`feature/platform-superadmin-tenant-lifecycle-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/361

## 5. Baseline

- Repository: `NckNA/codex-test`
- Required and verified baseline: `0b3091030b1576a3f6874d9d14d9b749534b6e2d`
- PR #360 was verified as merged into `origin/main` with that merge commit.
- No duplicate open or merged task with ID `PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001` was found.
- Work was performed in the existing clean isolated worktree requested by the task.
- Cloud Supabase remained forbidden and was not touched.

## 6. Final head

- Final implementation head: `f8c8df06cbc82bc65ffe8079e470a4ba48f91735`.
- The report-only metadata commit necessarily follows the implementation head. A commit cannot embed its own SHA without changing that SHA; the exact final PR head is recorded in PR #361 metadata and the final task response.

## 7. Changed files

30 files including this report:

- `scripts/seed-qa-users.cjs`
- `src/App.test.tsx`
- `src/App.tsx`
- `src/components/platform/CreateTenantDialog.test.tsx`
- `src/components/platform/CreateTenantDialog.tsx`
- `src/components/platform/PlatformLayout.tsx`
- `src/components/platform/TenantLifecyclePanel.test.tsx`
- `src/components/platform/TenantLifecyclePanel.tsx`
- `src/components/platform/TenantOwnerPanel.test.tsx`
- `src/components/platform/TenantOwnerPanel.tsx`
- `src/contexts/TenantContext.test.tsx`
- `src/contexts/TenantContext.tsx`
- `src/data/hooks/usePlatformTenants.test.tsx`
- `src/data/hooks/usePlatformTenants.ts`
- `src/data/repositories/PlatformTenantRepository.test.ts`
- `src/data/repositories/PlatformTenantRepository.ts`
- `src/domain/platform/PlatformAdmin.test.ts`
- `src/domain/platform/PlatformAdmin.ts`
- `src/domain/platform/TenantLifecycle.test.ts`
- `src/domain/platform/TenantLifecycle.ts`
- `src/domain/platform/TenantSubscription.test.ts`
- `src/domain/platform/TenantSubscription.ts`
- `src/pages/devQaLoginShortcut.ts`
- `src/pages/platform/PlatformTenantDetailsPage.tsx`
- `src/pages/platform/PlatformTenantsPage.tsx`
- `src/pages/TenantAccessBlockedPage.tsx`
- `supabase/migrations/0035_platform_superadmin_tenant_lifecycle.sql`
- `supabase/tests/0035_platform_superadmin_tenant_lifecycle_concurrency.ps1`
- `supabase/tests/0035_platform_superadmin_tenant_lifecycle_test.sql`
- `_ai_work/REPORTS/PLATFORM-SUPERADMIN-TENANT-LIFECYCLE-001_foundation.md`

## 8. Existing tenant inventory

Before this task:

- `public.tenants` contained clinic identity, timezone and a legacy status field.
- `tenant_users` combined tenant membership and clinic role but had no active/disabled membership status.
- `app_role` already included `platform_owner` and `platform_admin`, but those values were tenant roles and were therefore unsuitable as global platform authorization.
- The legacy `subscriptions` table was Stripe-shaped and did not preserve platform lifecycle history.
- `get_user_tenants()` and `has_tenant_role()` checked membership only and ignored suspension, expiration, grace and archive.
- `TenantContext` loaded `tenant_users` directly and had no authoritative lifecycle bootstrap.
- Core patient, appointment and other RLS policies inherited the membership-only behavior.
- No safe production platform-superadmin administration route existed.

## 9. Existing tenant creation paths

No ordinary authenticated production path safely created a tenant together with an owner and subscription. Local QA tooling inserted memberships through service-role access. Server-side and historical SQL fixtures could create tenants independently, which could temporarily produce ownerless identities. Migration 0035 adds a controlled creation transaction and a narrowly scoped server-fixture compatibility bootstrap.

## 10. Platform-superadmin model

Created `public.platform_administrators` with:

- `user_id` primary key;
- `active` or `disabled` status;
- display name and timestamps;
- explicit creator/disabled metadata;
- empty safe JSON metadata.

Platform administrators are global and are not tenant memberships. An active platform administrator is not automatically inserted into `tenant_users`, does not receive `clinic_owner`, and cannot read tenant clinical tables through platform authorization.

## 11. Secure bootstrap

Initial platform-superadmin bootstrap is explicit and server-controlled. The documented local QA mechanism uses the guarded service-role seed script. Production bootstrap remains an authorized operator action through protected service-role SQL or equivalent deployment tooling. The migration contains no production email, no domain guessing, no first-user promotion and no frontend self-promotion RPC.

## 12. Tenant lifecycle model

Created `public.tenant_lifecycle` with stable stored states:

- `provisioning`;
- `active`;
- `suspended`;
- `expired`;
- `archived`.

The row stores subscription boundaries, grace end, suspension timestamps/reason/note, resume/expiry/archive timestamps, actor IDs, lifecycle version and safe metadata.

## 13. Stored versus effective status

`get_tenant_effective_lifecycle_status(tenant_id, at_time)` distinguishes:

- stored lifecycle status;
- effective status at a requested timestamp;
- operational access.

A temporary suspension whose `suspended_until` is already past can become effectively active without a cron job when the subscription is valid. An expired subscription becomes effectively expired after grace even if a stored reconciliation has not yet run. Archive is terminal for operational access.

## 14. Subscription-period model

Created `public.tenant_subscription_periods` with scheduled, active, superseded, expired and cancelled states. Every change creates a new record linked to the previous period and supersedes the old current record. A partial unique index enforces one non-superseded current period per tenant. End-before-start and grace-before-expiry are rejected.

## 15. Grace policy

Operational access remains active through `grace_expires_at` when supplied. If no grace end is supplied, subscription expiry is the effective boundary. Once current time exceeds grace, effective status becomes expired and ordinary operations are blocked. No cron is required for enforcement.

## 16. Tenant creation transaction

`create_platform_tenant(...)` performs one atomic transaction:

1. verifies an active platform superadmin;
2. normalizes and locks the clinic identity;
3. validates owner identity and subscription dates;
4. checks idempotency key/fingerprint;
5. creates tenant identity;
6. creates lifecycle and current subscription period;
7. creates the initial active `clinic_owner` membership;
8. verifies the owner invariant;
9. derives active, provisioning or expired state;
10. writes one audit/activity pair;
11. stores the idempotent result.

Failure leaves no tenant, ownerless lifecycle, orphan period or partial membership.

## 17. Owner assignment

Implemented controlled add, replace and remove owner operations. Platform superadmins can assign an initial owner and recover a clinic by adding another owner. Owner assignment is tenant-specific and does not grant platform-superadmin status.

## 18. Last-owner protection

`tenant_users.membership_status` distinguishes active and disabled memberships. A database trigger rejects deletion, role demotion or disabling of the final active `clinic_owner`. Concurrent owner removals were tested and at least one active owner remains.

## 19. Subscription changes

Implemented set, extend and shorten operations. Each operation locks lifecycle/current period, preserves history, increments lifecycle version, recalculates status, writes one audit/activity pair and supports replay. Shortening requires explicit confirmation and a reason code. Immediate expiry must be explicit.

## 20. Suspension

`suspend_tenant(...)` supports temporary or indefinite suspension, safe reason codes, optional safe note, idempotency and audit. Ordinary clinic operations are blocked while records remain preserved. Subscription extension does not silently bypass an explicit suspension.

## 21. Resumption

`resume_tenant(...)` rejects archived tenants and does not invent a subscription. If subscription/grace is expired, it returns the safe renewal requirement: `Сначала продлите подписку клиники.` Successful resume clears the active suspension state, increments lifecycle version and audits once.

## 22. Expiration

Expiration is derived from timestamps. Tenant bootstrap and every guarded mutation use effective lifecycle status. An old authenticated browser tab cannot continue patient, appointment, clinical, finance, communication or integration mutations after effective expiry. Owners receive a safe expiry screen and may switch to another active clinic.

## 23. Archival

`archive_tenant(...)` requires platform-superadmin authorization, confirmation and reason. It locks lifecycle, cancels pending amoCRM OAuth states, preserves memberships/data/history and makes the tenant operationally unavailable. Subscription extension and resume cannot reactivate an archived tenant.

## 24. Why hard delete was not implemented

No product RPC, repository method or UI action physically deletes tenants. A database trigger rejects ordinary and service-role product deletion. A narrowly scoped local PostgreSQL test-cleanup flag exists solely so historical SQL fixtures can remove their own rows; it is not exposed through authenticated or service-role application APIs.

## 25. Operational access guard

`tenant_operational_access_allowed(tenant_id, user_id, action_context)` returns:

- `allowed`;
- effective status;
- safe reason code;
- required action.

Reason codes include provisioning, subscription not started, expired, suspended, archived, no membership and unavailable.

## 26. Database enforcement

Lifecycle checks are integrated into shared tenant helpers and a common mutation trigger. Protected boundaries include patients, doctors, appointments, complaints, dental charts, tooth states, findings, treatment plans/stages, files/documents, visits/encounters/completed services, invoices/items/payments/allocations/refunds/write-offs/reservations, reminders, communications, templates and integration references.

Safe clinic identity and membership reads remain available to blocked members so the blocked-state page can show clinic name, status and recovery instructions. Clinical and financial reads are not automatically opened by that exception.

## 27. Platform/tenant data isolation

Platform list/details RPCs return only tenant identity, timezone, lifecycle, subscription dates/history, owner IDs/display names, lifecycle version and safe platform audit metadata. They return no patient identity, phone/email, complaint, diagnosis, dental chart, treatment plan, service, invoice, payment, message body or amoCRM credential.

Static inspection found no `.from(...)` direct table calls in the platform repository/hook/pages. Platform mutations use controlled RPCs only.

## 28. Role matrix

| Role | Platform list/create/lifecycle mutation | Safe own lifecycle | Clinic operations when active |
|---|---:|---:|---:|
| Active platform superadmin | Yes | Only if separately a member | No automatic access |
| Disabled platform admin | No | Membership rules only | Membership rules only |
| Clinic owner | No | Yes | Yes |
| Clinic admin | No | Yes | Yes |
| Doctor | No | Safe status needed for gate | Yes within existing role rules |
| Registrar | No | Safe status needed for gate | Yes within existing role rules |
| Cashier | No | Safe status needed for gate | Yes within existing role rules |
| Unknown/no tenant | No | No | No |

## 29. RLS/grants

RLS is enabled on platform administrators, tenant lifecycle, subscription periods and platform operations. Authenticated users cannot directly insert/update/delete those tables. Platform operations are not generally readable. Tenant owners receive only controlled safe lifecycle/subscription reads. Ordinary users cannot promote themselves.

Catalog proof after reset:

- authenticated platform-admin insert: false;
- authenticated lifecycle update: false;
- authenticated subscription insert: false;
- authenticated platform-operation select: false.

## 30. Audit/activity

Lifecycle events use the required `platform_tenant_*` event family. Metadata is restricted to tenant ID, lifecycle version, status changes, subscription dates, owner user IDs, reason code and platform actor ID. No patient, clinical, financial, password, token or secret payload is written. Replay does not duplicate audit/activity.

## 31. Backend contract

The platform server boundary is implemented as protected PostgreSQL RPCs invoked through Supabase Auth. Authorization is evaluated server-side using the authenticated user ID and `platform_administrators`; frontend role labels are ignored. No service-role key is exposed to the browser. No backend JavaScript changes were required.

## 32. Repository/hook

`PlatformTenantRepository` provides deterministic safe DTOs and controlled methods for list, details, create, owner operations, subscription changes, suspend, resume and archive. It has no localStorage fallback and performs no direct table mutation.

`usePlatformTenants` adds stale-response protection, duplicate-action blocking, deterministic filters, safe error mapping and refresh/detail orchestration.

## 33. Platform UI

Added protected routes:

- `/platform/tenants`;
- `/platform/tenants/:tenantId`.

The platform layout is physically separate from the clinic layout and does not mount medical navigation/providers. The UI supports create, lifecycle details, subscription changes, suspension, resume, archive and owner recovery. There is no permanent-delete action.

## 34. Clinic blocked-state UI

Added dedicated screens for provisioning, suspension, expiration and archive. They show safe clinic identity, reason, subscription expiry, support instruction, logout and switching to another active clinic. They do not mount patient or finance pages.

## 35. SQL tests

All SQL suites `0024–0035` passed. The new `0035_platform_superadmin_tenant_lifecycle_test.sql` passed after the final migration changes and covers the requested authorization, transaction, lifecycle, owner, RLS, mutation-blocking, preservation and side-effect scenarios.

## 36. Concurrency tests

Required concurrency suites passed:

- 0025 appointment conflict;
- 0026 cancellation/no-show;
- 0027 confirmation workflow;
- 0029 reminder queue;
- 0030 manual reminder operations;
- 0032 communication orchestration;
- 0033 communication templates;
- 0034 amoCRM integration;
- 0035 platform tenant lifecycle.

Final 0035 counters:

- tenants: 4;
- lifecycle rows: 4;
- current subscriptions: 4;
- subscription history rows: 6;
- active owner memberships: 4;
- platform operations: 18;
- operation replays: 1;
- conflicts/denials: 6;
- suspensions: 3;
- resumes: 1;
- archived tenants: 1;
- audit events: 14;
- activity events: 14;
- ownerless active tenants: 0;
- tenants without lifecycle: 0;
- multiple current subscription periods: 0;
- archived tenants with operational access: 0;
- cross-tenant lifecycle mutations: 0;
- audit/activity mismatch: 0;
- deadlocks: 0.

## 37. TypeScript tests

Targeted platform tests passed. The final full Vitest run passed:

- test files: 122;
- tests: 1206.

Coverage includes parsing/effective status, grace, suspension/archive transitions, subscription validation, safe DTOs, RPC mapping, stale responses, duplicate action blocking, route authorization, create validation, owner protection, shortening/archive confirmation and blocked-state switching.

## 38. Browser smoke

Authenticated localhost smoke covered:

- active platform superadmin access;
- disabled platform superadmin denial;
- clinic owner, doctor, registrar and cashier platform denial;
- clinic creation with initial owner/subscription;
- owner isolation from platform routes;
- temporary suspension and owner blocked page;
- resume;
- expiry by confirmed shortening and expiry blocked page;
- extension/reactivation with history preserved;
- second-owner recovery and final-owner protection;
- archive and archived blocked page;
- multi-tenant switch from suspended/archived tenant to active tenant.

Role matrix scenarios were 6/6 PASS. Successful browser scenarios had zero console errors and zero failed requests; secret-pattern visibility was false.

## 39. Network proof

- controlled platform RPC mutations: greater than zero (create, owner add/remove, suspend, resume, shorten, extend, archive exercised);
- direct tenant table writes from platform client: 0;
- direct lifecycle writes from platform client: 0;
- direct subscription writes from platform client: 0;
- service-role exposed to browser: 0;
- clinical records returned to platform pages: 0;
- financial records returned to platform pages: 0;
- external provider calls: 0;
- amoCRM calls: 0;
- message sends: 0.

## 40. Database counters

After final reset:

- migration: 0035;
- task QA users: 0;
- platform administrators: 0;
- platform operations: 0;
- ownerless active tenants: 0;
- audit/activity mismatch: 0.

Two pre-existing local demo tenant identities remain as `provisioning` server-bootstrap rows with zero memberships. No task/browser/concurrency tenant remains.

## 41. Side-effect validation

SQL tests use rollback or explicit cleanup. Suspension and archive block access without deleting clinical or financial records. No unexpected changes were observed in complaints, findings, diagnoses, treatment plans, dental charts, completed services, invoices, payments, refunds, write-offs, stock, documents, communication templates, amoCRM credentials or external messages.

## 42. Cleanup

- deleted seven browser screenshots;
- deleted temporary Vite/seed/expiry helper files;
- stopped task Vite process;
- port 52841 is closed;
- ran final `supabase db reset --no-seed` through migration 0035;
- QA users/platform administrators/operations are zero;
- no task-specific tenant fixture remains.

## 43. Lint/test/build

- ESLint: PASS;
- full Vitest: 122 files / 1206 tests PASS;
- production build: PASS.

Existing unrelated React `act(...)` warnings and the Vite large-chunk warning remain non-failing.

## 44. Fresh CI

GitHub Actions CI run #766 (run ID `29355581738`) completed successfully on the exact implementation head `f8c8df06cbc82bc65ffe8079e470a4ba48f91735`.

- validate: SUCCESS;
- ESLint: SUCCESS;
- full tests: SUCCESS;
- build: SUCCESS;
- Merge guard: SUCCESS.

A fresh CI run on the report-only final PR head is recorded in PR #361 metadata and the final task response.

## 45. Known limitations

- No billing provider, price calculation, invoice generation or payment collection is included.
- No support impersonation or clinical support dashboard is included.
- No physical tenant purge is exposed.
- Legacy `subscriptions` remains for compatibility; lifecycle authority is `tenant_lifecycle` plus `tenant_subscription_periods`.
- Persisted reconciliation of temporary suspension/expiry can be performed by controlled future maintenance, but access enforcement does not require a cron job.
- Browser QA uses local-only guarded QA identities and shortcut support.

## 46. What was intentionally not implemented

No custom permissions, permission checkboxes, role designer, branch/department scope, payment provider, recurring billing, marketing, patient export, support impersonation, cloud migration apply, HEP-V2, unrelated amoCRM work or tenant hard-delete product flow was implemented. The PR is review-only and merge was not performed.

## 47. Recommended next discussion/task

Return to Nick and explicitly reopen product discussion `TENANT-PERMISSION-MODEL-RECON-001` without starting implementation. The discussion should confirm employee creation, job title versus access rights, permission catalogue/grouping, own/assigned/clinic scopes, dependencies, owner delegation, role templates, help/risk labels, final-owner protection and delegation limits.
