# COMMUNICATION-TEMPLATE-FOUNDATION-001

## 1. Final verdict

**COMMUNICATION TEMPLATE FOUNDATION IMPLEMENTED AND VERIFIED**

Tenant-scoped versioned templates, deterministic plain-text rendering, immutable publishing, exact operation snapshots, RLS, controlled RPC mutations, audit/activity, repository/hook/UI integration and all required local validation are complete. No provider was called and no message was sent.

## 2. Summary

This task adds a tenant-owned template foundation for the existing noop/mock communication orchestration. Templates are keyed by tenant, appointment-reminder purpose, channel and explicit language. Content is versioned through draft, published, superseded and archived states. Published content is immutable.

Operation preparation now resolves one exact active template only after eligibility, consent, suppression, contact and route checks. It renders an allowlisted variable map and stores the exact template version, content fingerprint, rendered fingerprint and rendered plain text in the communication operation. Later template publishing does not alter historical operations.

## 3. Branch

`feature/communication-template-foundation-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/360

PR #360 remains open, must not be merged, and is moved from draft to ready only after fresh CI succeeds on the exact final head.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- exact baseline: `38e221ed2e7ce2b2599f7f948ce1bd2431af5ab8`;
- baseline is merge commit for PR #358;
- `origin/main` was fetched and confirmed at the exact baseline;
- no open or merged duplicate task PR was found;
- isolated worktree was created from the exact baseline;
- starting worktree was clean.

## 6. Final head

The exact final head is recorded in the final task response and PR metadata. A commit cannot contain its own future SHA.

## 7. Changed files

Expected final scope:

- `_ai_work/REPORTS/COMMUNICATION-TEMPLATE-FOUNDATION-001_foundation.md`;
- `supabase/migrations/0033_communication_template_foundation.sql`;
- `supabase/tests/0033_communication_template_foundation_test.sql`;
- `supabase/tests/0033_communication_template_concurrency.ps1`;
- `supabase/tests/0032_communication_orchestration_foundation_test.sql`;
- `supabase/tests/0032_communication_orchestration_concurrency.ps1`;
- `src/domain/communications/CommunicationTemplate.ts` and test;
- `src/domain/communications/CommunicationTemplateRenderer.ts` and test;
- `src/domain/communications/CommunicationCommand.ts` and test;
- `src/data/repositories/CommunicationTemplateRepository.ts` and test;
- `src/data/repositories/CommunicationOrchestrationRepository.ts`;
- `src/data/hooks/useCommunicationTemplates.ts` and test;
- `src/components/communications/CommunicationTemplateManager.tsx` and test;
- `src/components/communications/CommunicationOperationsPanel.tsx`;
- `src/pages/CommunicationTemplatesPage.tsx`;
- `src/App.tsx`;
- `src/components/layout/Sidebar.tsx`.

No historical migration, dependency, lockfile, generated type, workflow, provider SDK, cloud configuration or environment file is changed.

## 8. Pre-read

Reviewed:

- `APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001` report and migration 0031;
- `AMOCRM-REMINDER-COMMUNICATION-INTEGRATION-RECON-001` report;
- `COMMUNICATION-ORCHESTRATION-FOUNDATION-001` report, migration 0032, SQL and concurrency suites;
- communication routes and operations;
- `prepare_communication_operation`;
- structured communication command;
- noop/mock adapter contract;
- patient contacts, preferences, consent and suppression;
- appointment reminder jobs and tenant timezone logic;
- audit/activity helpers;
- role/RLS model;
- current SMS, mailing, reminder and confirmation pages;
- tenant display name and communication language sources.

## 9. Existing message/template inventory

| Path / area | Classification | Finding |
|---|---|---|
| `src/pages/SmsPage.tsx` | placeholder | UI placeholder; no durable template model and no provider send path. |
| `src/pages/MailingPage.tsx` | placeholder/unrelated | Mailing placeholder; marketing remains outside this task. |
| `src/pages/ReminderOperationsPage.tsx` | reusable operations UI | Displays durable reminder tasks and statuses, not message bodies. |
| `src/components/schedule/AppointmentConfirmationPanel.tsx` | manual workflow | Manual appointment confirmation controls; not a provider template. |
| `src/pages/CommunicationDiagnosticsPage.tsx` | reusable | Existing noop/mock orchestration diagnostics reused for exact rendered snapshots. |
| `src/components/communications/CommunicationOperationsPanel.tsx` | reusable | Existing route/preparation/simulation UI extended with template version and rendered content. |
| `src/components/patients/patient-card/PatientCommunicationSection.tsx` | reusable authoritative profile | Provides language, contacts, consent and suppression facts; not content. |
| `public.tenants.name` | authoritative reusable variable | Used for `clinic_name`. |
| appointment/doctor/patient records | authoritative reusable variables | Used only for the six allowlisted values. |
| callback phone | missing authoritative source | Variable remains allowed, but rendering fails safely when a selected template requires it. No value is invented. |
| hardcoded UI notifications | unrelated | User-interface labels and safe errors are not provider message templates. |

No reachable real SMS, WhatsApp, email or amoCRM delivery implementation was found or added.

## 10. Purpose model

Supported purposes remain exactly:

- `appointment_confirmation_request`;
- `appointment_day_before_reminder`;
- `appointment_same_day_reminder`;
- `appointment_control_call_task`.

Both historical reminder code `control_call_task` and the actual queue code `callback_task` map to the one stable purpose `appointment_control_call_task`. No marketing, recall, billing, debt, clinical result, treatment offer or document purpose was added.

## 11. Channel model

Supported channels:

- `sms`;
- `whatsapp`;
- `email`.

All are plain text in this foundation. Email supports a plain-text subject and body. SMS/WhatsApp subjects are rejected. There is no channel fallback, provider routing or delivery state.

## 12. Language model

Supported explicit languages:

- `ru`;
- `kk`;
- `en`.

Language derives from the selected authoritative contact/profile. No automatic translation or mixed-language generation exists. Selection is exact tenant + purpose + channel + language. No silent default-language fallback was enabled.

## 13. Template schema

`public.communication_templates` is the stable identity and contains:

- tenant;
- exact purpose/channel/language;
- display name;
- active/inactive/archived status;
- active version reference;
- actor timestamps;
- empty validated metadata.

A partial unique index permits at most one non-archived stable identity per tenant/purpose/channel/language.

## 14. Version schema

`public.communication_template_versions` contains:

- tenant/template composite ownership;
- monotonically increasing version number;
- draft/published/superseded/archived status;
- optional email subject;
- required plain-text body;
- deterministic ordered variable keys;
- SHA-256 content fingerprint;
- created/updated/published/archive actors and times;
- superseded version reference;
- empty validated metadata.

Unique indexes enforce one draft and one published version per template.

## 15. Placeholder syntax

Minimal syntax:

`{{patient_first_name}}`

The parser accepts exact lowercase ASCII identifiers only. It rejects:

- malformed or unbalanced braces;
- spaces inside placeholders;
- nesting;
- property access;
- filters;
- functions;
- loops;
- conditionals;
- expressions;
- remote includes;
- arbitrary code.

Variable keys are returned in deterministic alphabetical order.

## 16. Variable allowlist

Allowed only:

- `patient_first_name`;
- `clinic_name`;
- `appointment_date`;
- `appointment_time`;
- `doctor_display_name`;
- `clinic_callback_phone`.

Explicitly rejected examples include diagnosis, complaint, finding, tooth, treatment, treatment plan, procedure, balance, debt, invoice, payment, discount, document, medical result, raw phone and raw email. Unknown variables also fail.

## 17. Content safety

Validation rejects:

- empty body;
- control characters and null bytes;
- HTML-like markup;
- malformed braces;
- unknown, clinical and financial placeholders;
- missing email subject;
- SMS/WhatsApp subject;
- excessive body/subject length;
- non-object render variables;
- extra render variables;
- missing or blank required variables;
- unsafe variable values.

Unicode is preserved. No HTML execution, JavaScript evaluation or database expression interpolation exists.

## 18. Length policy

Foundation safety limits:

- SMS body: 1000 characters;
- WhatsApp body: 4000 characters;
- email subject: 200 characters;
- email body: 10000 characters;
- individual rendered variable value: 500 characters.

Rendered SMS over 160 characters receives `sms_practical_single_message_length`. No segmentation or provider-limit claim is implemented.

## 19. Draft lifecycle

Creating a stable template creates version 1 as a draft. A published template can receive one new draft copied from the current active version. Draft updates use expected `updated_at` optimistic concurrency and recompute ordered variables and content fingerprint.

## 20. Publishing lifecycle

Publishing is transactional:

1. manager role verified;
2. template-level advisory lock acquired;
3. template and draft locked;
4. idempotency checked;
5. exact draft version and expected timestamp checked;
6. content revalidated;
7. previous published version marked superseded;
8. draft marked published;
9. stable template points to the new active version;
10. audit/activity written once;
11. result stored for replay.

## 21. Immutability

Published, superseded and archived version content cannot be changed. The write guard blocks subject, body, variable keys, fingerprint, version number, template ID or tenant changes. Direct authenticated mutations are revoked. Editing requires a new draft/version.

## 22. Rendering contract

Input:

- exact version content;
- exact channel;
- exact variable map.

Output:

- optional email subject;
- rendered plain-text body;
- character count;
- rendered SHA-256 fingerprint;
- variable keys used;
- warnings.

Rendering is deterministic and requires exact variables: every required key must be present and no extra key is accepted.

## 23. Fingerprints

Template content fingerprint covers channel, normalized subject, body and ordered variable keys. Rendered fingerprint covers channel, rendered subject, rendered body and variable keys. Operation payload fingerprint additionally covers template/version identities and rendered fingerprint, preventing replay with changed content.

## 24. Active-template resolution

`get_active_communication_template` resolves only one active, non-archived stable template with its exact published active version. Database uniqueness and transactional publishing prevent ambiguity.

## 25. Fallback policy

Implemented policy:

1. exact tenant;
2. exact purpose;
3. exact channel;
4. exact explicit language;
5. otherwise blocked.

No tenant-default-language fallback and no cross-channel fallback are silently applied.

## 26. Orchestration integration

`prepare_communication_operation` now performs:

1. manager authentication;
2. reminder/appointment/version validation;
3. purpose derivation;
4. eligibility recomputation;
5. verified patient-owned contact selection;
6. granted consent and suppression checks;
7. noop/mock simulation route selection;
8. explicit language resolution;
9. exact active template/version resolution;
10. safe variable-map construction;
11. deterministic rendering;
12. exact template/render snapshots;
13. operation persistence and paired audit/activity.

No adapter executes during preparation.

## 27. Operation template snapshot

New operation fields:

- `template_id`;
- `template_version_id`;
- `template_version_number`;
- `template_content_fingerprint`;
- `rendered_content_fingerprint`;
- `rendered_subject`;
- `rendered_body`;
- `rendered_character_count`;
- `template_snapshot`.

The structured command also contains safe template identity/fingerprints and rendered plain text. Raw contact destination remains absent.

Legacy operations created before migration 0033 may retain all-null template fields. Every new preparation requires a complete snapshot.

## 28. Stale-version handling

Template and version rows are locked during preparation. Publishing uses the same template lock. Preparation versus publishing therefore snapshots one coherent version, never a mixed template ID/body/fingerprint. A newer published version does not mutate or cancel existing prepared operations.

## 29. Role matrix

| Role | Read | Preview | Create/edit/publish/archive |
|---|---:|---:|---:|
| clinic owner | yes | yes | yes |
| clinic admin | yes | yes | yes |
| registrar | yes | yes | no |
| doctor | no | no | no |
| cashier | no | no | no |
| unknown/no tenant | no | no | no |
| anonymous | no | no | no |

## 30. RLS

RLS is enabled on templates, versions and template-operation idempotency storage. Owner/admin/registrar have tenant-scoped SELECT through policies/RPCs. Anonymous access is revoked. Authenticated INSERT/UPDATE/DELETE is revoked. All mutations use controlled SECURITY DEFINER RPCs with explicit NULL-safe membership checks.

A real defect was found and fixed: `NULL NOT IN (...)` in a SECURITY DEFINER role check could fail to reject a no-membership user. All template read RPCs and the manager helper now use `v_role IS NULL OR ...`.

## 31. Audit/activity

Paired events:

- `communication_template_created`;
- `communication_template_draft_created`;
- `communication_template_draft_updated`;
- `communication_template_published`;
- `communication_template_superseded`;
- `communication_template_archived`.

Metadata contains IDs, purpose, channel, language, version number and fingerprints. It excludes contact destination, patient-specific rendered body, secrets and clinical/financial data.

## 32. Repository integration

`CommunicationTemplateRepository` provides:

- list/get/get-active;
- create stable template;
- create/update draft;
- publish;
- archive;
- preview.

Writes are RPC-only, tenant ID is injected into every call, ordering is database-defined and errors are mapped to safe domain messages. No localStorage fallback or direct table mutation exists.

The orchestration repository maps the new template/render snapshot fields and exposes the safe no-active-template error.

## 33. Hook integration

`useCommunicationTemplates` exposes templates, selection, draft, preview, loading/saving/publishing/archiving/error and role capabilities. It:

- performs no fetch without tenant/user/Supabase access;
- clears state on tenant change;
- ignores stale responses;
- blocks duplicate publish;
- preserves optimistic timestamps;
- keeps editor state available after safe errors;
- refreshes once after a successful mutation.

## 34. Template UI

`/communication-templates` provides:

- exact purpose/channel/language selection;
- plain textarea editor;
- allowed-variable insertion helpers;
- live placeholder validation;
- safe sample preview;
- rendered length/fingerprint;
- create draft, save, publish, new version and archive actions;
- read-only published content;
- registrar read-only view.

Warnings state that published versions are immutable, templates do not send messages and only allowlisted variables may be used. No send button, WYSIWYG or HTML editor exists.

Communication diagnostics now displays exact template version, rendered fingerprint and rendered snapshot for prepared operations.

## 35. SQL tests

Full local SQL regression result:

- suites: `10` (`0024` through `0033`);
- explicit `pg_temp.assert_true` assertions counted by runner: `552`;
- result: PASS.

Template suite 0033: `85` explicit assertions plus expected-error scenarios. It covers roles/RLS, identity validation, draft/publish/archive, replay/conflict, immutable published content, Unicode RU/KK, deterministic preview, exact resolution, operation v1/v2 snapshots, no raw destination, no clinical/financial variables and side-effect counters.

Updated 0032 orchestration regression creates exact active tenant templates and validates the real `callback_task` mapping.

## 36. Concurrency tests

Required suites passed:

- 0025 appointment conflicts;
- 0026 cancellation/no-show;
- 0027 confirmation workflow;
- 0029 reminder queue;
- 0030 manual reminder operations;
- 0032 communication orchestration;
- 0033 communication templates.

0033 final counters:

- templates: `5`;
- versions: `10`;
- drafts: `0`;
- published: `3`;
- superseded: `2`;
- active templates: `3`;
- replays: `2`;
- expected conflicts: `5`;
- operations by template version: one operation on v1 and two on v2;
- multiple active versions: `0`;
- duplicate version numbers: `0`;
- operations without template snapshot: `0`;
- audit/activity: `29/29`;
- deadlocks: `0`.

Scenarios A-K passed, including same-key replay, competing drafts, competing publishes, update/publish, publish/archive, preparation/publish and cross-tenant keys.

## 37. TypeScript tests

Targeted template suite:

- files: `5`;
- tests: `40`;
- result: PASS.

Full repository suite:

- files: `107`;
- tests: `1143`;
- result: PASS.

Coverage includes parser, clinical/financial rejection, malformed braces, deterministic fingerprints/rendering, Unicode, limits, repository RPC mapping, safe errors, no direct writes, hook tenant switching, duplicate publish, owner/admin controls, registrar read-only UI, live validation and absence of send action.

## 38. Browser smoke

Authenticated local Chromium/Playwright smoke passed with real Supabase Auth and RLS:

- owner manages templates;
- admin manages templates;
- registrar reads active templates with no mutation controls;
- doctor blocked;
- cashier blocked;
- tenant B cannot see tenant A templates;
- RU SMS draft saved and previewed;
- version 1 published and read-only;
- invalid `{{diagnosis}}` blocks publish;
- corrected version 2 published and prior version retained;
- KK Cyrillic preview/publish preserved;
- callback preparation without exact active template blocked safely;
- operation v1 rendered snapshot visible;
- after v2 publish old operation remains v1;
- new operation uses v2.

## 39. Network proof

Authenticated browser counters:

- total requests: `2050`;
- external calls: `0`;
- provider calls: `0`;
- amoCRM calls: `0`;
- SMS calls: `0`;
- WhatsApp calls: `0`;
- email sends: `0`;
- direct template writes: `0`;
- direct version writes: `0`;
- controlled RPC mutations: `10`;
- service role exposed: `false`;
- secrets in URL/body: `false`;
- hosts: `127.0.0.1:5186`, `127.0.0.1:54321` only.

## 40. Database counters

After browser smoke:

- templates: `2`;
- versions: `3`;
- published: `2`;
- superseded: `1`;
- multiple active versions: `0`;
- duplicate version numbers: `0`;
- published versions mutated: `0`;
- communication operations: `2`;
- operation version sequence: `1,2`;
- operations without template snapshot: `0`;
- operations with invalid variables: `0`;
- operations with clinical/financial content: `0`;
- cross-tenant template links: `0`;
- raw destination exposure: `0`;
- reminder jobs changed: `0`;
- appointments changed: `0`;
- confirmation attempts created: `0`;
- template audit/activity: `10/10`;
- mismatch: `0`;
- concurrency deadlocks: `0`.

## 41. Side-effect validation

Tenant-specific counters remained zero for:

- visits;
- encounters;
- findings;
- treatment plans;
- completed services;
- invoices;
- payments;
- refunds;
- write-offs/financial adjustments;
- patient balance changes;
- patient files/documents.

No stock, dental chart, amoCRM, provider credential or external message path was touched.

## 42. Cleanup

Removed:

- temporary QA users;
- browser patients/doctors/appointments/jobs/contacts;
- temporary routes;
- templates and versions;
- communication operations;
- temporary scripts, SQL files, logs and screenshots;
- Vite/browser process.

Final `npx supabase db reset --no-seed` passed and applied migrations `0001` through `0033`. Post-reset counts:

- QA auth users: `0`;
- browser fixture patients/doctors/appointments/jobs/contacts/routes: `0`;
- templates: `0`;
- versions: `0`;
- communication operations: `0`;
- Vite port 5186: not listening.

The two Demo Clinic tenant rows are baseline rows created by historical migration 0001, not remaining task fixtures.

## 43. Lint/test/build

- ESLint: PASS;
- targeted template tests: `40/40` PASS;
- full Vitest: `107 files / 1143 tests` PASS;
- TypeScript + Vite production build: PASS;
- transformed modules: `1970`;
- no dependency or lockfile change.

Existing non-blocking React `act(...)` warnings and the existing Vite chunk-size warning remain unrelated to this task.

## 44. Fresh CI

Fresh GitHub Actions CI must run on the exact final pushed head. Run ID, tested SHA and step conclusions are recorded in the final task response because this report commit cannot contain evidence from its own future CI run.

Required expected steps:

- ESLint;
- full tests;
- build;
- merge guard.

## 45. Known limitations

- no authoritative clinic callback phone source currently exists; templates requiring it fail safely;
- no default-language fallback is enabled;
- no auto-translation;
- no default-template auto-seeding;
- email remains subject + plain text only;
- no provider delivery, worker, webhook or retry engine;
- no inbound reply handling;
- template body is visible only to authorized communication roles.

## 46. What was intentionally not implemented

- no real message send;
- no SMS/WhatsApp/email provider SDK;
- no amoCRM adapter;
- no amoCRM OAuth change;
- no HTML email engine;
- no WYSIWYG;
- no Liquid/Mustache/Handlebars;
- no expressions, loops, conditions or custom code;
- no attachments or document links;
- no marketing, bulk campaigns, payment reminders or clinical-result messages;
- no worker, cron, webhook or retry engine;
- no cloud migration apply;
- no generated types;
- no package addition;
- no HEP-V2;
- no PR merge.

## 47. Recommended next task

`AMOCRM-INTEGRATION-HARDENING-001`

After provider-neutral orchestration and exact versioned content exist, the next safe slice is tenant-safe OAuth/account hardening. Real message delivery must still wait until amoCRM channel capability and adapter contracts are proven.
