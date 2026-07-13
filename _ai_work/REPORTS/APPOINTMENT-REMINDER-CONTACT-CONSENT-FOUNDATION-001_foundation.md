# APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001

## 1. Final verdict

Final verdict: **PASS**

Task verdict: **PATIENT COMMUNICATION CONTACT AND CONSENT FOUNDATION IMPLEMENTED AND VERIFIED**

The tenant-scoped contact, preference, consent, suppression and provider-neutral eligibility foundation is implemented and verified locally. It does not send SMS, WhatsApp or email, select a provider, create a delivery attempt, run a worker, register cron, expose a webhook, build templates, apply cloud migrations or start HEP-V2.

## 2. Summary

The task introduces authoritative communication facts that are separate from the legacy `patients.phone` display field. Raw and normalized phone/email values are stored separately, representative ownership is explicit, consent is channel-specific and defaults to `unknown`, suppression has higher precedence than preference, and every changed consent fact is append-only and idempotent.

Patient cards now include a minimal communication section for authorized staff. Reminder queue rows receive provider-neutral eligibility badges without changing reminder job state or sending anything.

## 3. Branch

`feature/appointment-reminder-contact-consent-foundation-001`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/356

PR #356 is open, ready for review and remains unmerged.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required baseline: `112f9990ed486201a3d86648521867c20ddd1aff`;
- verified `origin/main`: `112f9990ed486201a3d86648521867c20ddd1aff`;
- PR #355 was confirmed merged into `main`;
- the source checkout was clean;
- the feature worktree was created directly from current `origin/main`;
- cloud Supabase remained forbidden and untouched.

## 6. PR head reviewed before final report update

- implementation head: `7a9e5c4397fb5cd44037e36b9bd4464a4553b9f3`;
- workflow: `CI`;
- run number: `#726`;
- run ID: `29229999819`;
- conclusion: `success`;
- tested commit: `7a9e5c4397fb5cd44037e36b9bd4464a4553b9f3`;
- tested commit matched the implementation head exactly;
- ESLint, tests, build and Merge guard passed;
- PR #356 remained open and unmerged.

## 7. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA and the CI run that tests it.

The exact final report-only head and fresh CI run will be recorded in the final task response and an immutable local finalization receipt.

## 8. Changed files

Expected final changed files:

- `_ai_work/REPORTS/APPOINTMENT-REMINDER-CONTACT-CONSENT-FOUNDATION-001_foundation.md`;
- `src/components/patients/patient-card/PatientCommunicationSection.tsx`;
- `src/components/patients/patient-card/PatientCommunicationSection.test.tsx`;
- `src/data/hooks/usePatientCommunicationProfile.ts`;
- `src/data/hooks/usePatientCommunicationProfile.test.tsx`;
- `src/data/repositories/PatientCommunicationRepository.ts`;
- `src/data/repositories/PatientCommunicationRepository.test.ts`;
- `src/data/repositories/AppointmentReminderRepository.ts`;
- `src/pages/PatientCardPage.tsx`;
- `src/pages/ReminderOperationsPage.tsx`;
- `src/types/index.ts`;
- `supabase/migrations/0031_patient_communication_contact_consent_foundation.sql`;
- `supabase/tests/0031_patient_communication_contact_consent_foundation_test.sql`.

No historical migration, package file, lockfile, generated type, provider SDK, environment file, screenshot, browser fixture, temporary script or cloud configuration belongs in the final diff.

## 9. Pre-read

Reports read and reconciled:

- `APPOINTMENT-CONFIRMATION-WORKFLOW-001`;
- `APPOINTMENT-REMINDER-OPERATIONS-RECON-001`;
- `TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001`;
- `APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001`;
- `APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001`.

Architecture and implementation sources reviewed:

- role and permission rules;
- multi-tenant and data-isolation rules;
- patient model and patient repository;
- patient create/edit/card UI;
- appointment and schedule contracts;
- reminder repository and manual queue;
- confirmation workflow;
- audit/activity internal helpers;
- Supabase-active authentication and repository conventions;
- testing strategy;
- `/sms` and `/mailing` placeholders.

## 10. Existing contact inventory

Before this task:

| Surface | Classification | Actual behavior | Safe for automation |
|---|---|---|---|
| `patients.phone` | legacy free text | created/edited by patient forms, displayed on patient pages and reminder UI | no |
| patient repository `phone` | compatibility field | tenant-scoped patient CRUD, no authoritative normalization or consent | no |
| manual reminder channel `phone/sms/whatsapp/email` | operational outcome label | staff records how a manual contact was attempted | no automatic delivery |
| `/sms` page | placeholder | no provider and no send contract | no |
| `/mailing` page | placeholder | no provider and no send contract | no |
| language/locale | missing as patient communication authority | UI language is not patient consent/preference | no |
| guardian/representative | missing as structured communication ownership | no authoritative relation | no |
| consent/opt-out | missing | no channel-specific evidence or suppression | no |

There was no normalized contact table, no append-only consent history, no explicit representative ownership, no suppression precedence and no provider-neutral eligibility function.

## 11. Legacy phone behavior

`patients.phone` remains unchanged for compatibility.

Migration `0031`:

- creates one patient-owned `import_legacy` phone contact when the legacy value is non-empty;
- preserves `contact_value_raw` exactly after trimming;
- stores a normalized value only when deterministic E.164 validation succeeds;
- sets `is_verified = false`;
- sets all automated consent states to `unknown`;
- does not fabricate representative ownership;
- does not fabricate opt-in;
- does not delete or rewrite `patients.phone`.

A narrow legacy synchronization trigger handles patients created after migration/seeding and later legacy phone edits. It may update only an active, unverified, patient-owned `import_legacy` contact. It cannot overwrite a verified or separately managed authoritative contact.

A clean reset proved two legacy patient phones produced two unverified `import_legacy` contacts and unknown consent states.

## 12. Contact data model

`public.patient_communication_contacts` stores:

- tenant and patient identity;
- contact type `phone` or `email`;
- raw value and separately normalized value;
- country code where deterministically known;
- primary and verification flags;
- verification source;
- owner type `patient` or `representative`;
- representative name and stable relation;
- contact-specific language;
- possible-duplicate warning;
- actor/timestamps;
- soft archive timestamp.

Composite tenant/patient foreign keys prevent cross-tenant ownership. Archived contacts cannot be primary. Verified contacts require a normalized destination and verification source.

## 13. Phone normalization

The database is authoritative.

`normalize_patient_phone_e164(text)`:

- requires an explicit leading `+`;
- strips spaces, parentheses and hyphens after the plus;
- validates `+` followed by 8–15 digits with a non-zero country prefix;
- accepts Kazakhstan and international E.164 values;
- rejects extensions and extension markers;
- does not silently convert `8...` or guess a country;
- preserves the original raw value separately.

Verified examples:

- `+7 (700) 123-45-67` → `+77001234567`;
- `+49 151 12345678` → `+4915112345678`;
- `87001234567` → invalid because no explicit country code;
- `+77001234567 ext 4` → invalid.

Frontend validation is only an early UX check; RPC/database validation remains final.

## 14. Email normalization

`normalize_patient_email(text)`:

- trims whitespace;
- lowercases the canonical representation;
- performs syntactic validation;
- preserves the raw value separately;
- preserves plus addressing;
- performs no domain-specific rewriting or alias collapse;
- does not claim verification.

Verified example:

` Patient+tag@Example.COM ` → `patient+tag@example.com`.

## 15. Representative model

Representative ownership is explicit and never inferred from a phone string.

A representative contact requires:

- `owner_type = representative`;
- non-empty representative name;
- one stable relation: `parent`, `guardian`, `spouse`, `child`, `caregiver` or `other`.

The model records communication ownership, not legal guardianship. A representative contact may be primary only when staff explicitly selects it. Eligibility marks representative automated destinations as `representative_review_required` and `requiresManualReview = true`.

The patient card displays a clear warning that the contact belongs to a representative.

## 16. Primary contact rules

Partial unique indexes enforce:

- at most one active primary phone per tenant/patient;
- at most one active primary email per tenant/patient.

Primary changes are transactional through controlled RPCs. Other active contacts of the same type are demoted before the selected contact is promoted. Archived contacts cannot become primary. Tenant and patient relationships are validated under lock.

## 17. Preference model

`public.patient_communication_preferences` stores one row per tenant/patient with:

- preferred language: `ru`, `kk` or `en`;
- preferred channel: `phone`, `whatsapp`, `sms`, `email` or `none`;
- explicit `allow_manual_phone`;
- separate SMS, WhatsApp and email consent states;
- phone/SMS/WhatsApp/email suppression facts;
- global suppression;
- reason, timestamp and actor for suppressions;
- actor and timestamps for preference changes.

Preferred channel is a preference only. It cannot override missing consent or suppression.

## 18. Consent model

Consent states are not booleans:

- `unknown`;
- `granted`;
- `denied`;
- `withdrawn`.

SMS, WhatsApp and email consent are independent. A valid phone does not grant SMS or WhatsApp consent. A preferred channel does not grant consent. Unknown is never treated as granted.

Registrar consent sources are constrained to appropriate verbal/correction paths; owner/admin have the wider approved source set.

## 19. Consent evidence

`public.patient_communication_consent_events` is append-only and records:

- tenant and patient;
- channel;
- previous and new state;
- stable source;
- actor;
- reason;
- timestamp;
- safe metadata;
- tenant-scoped operation key and fingerprint.

Authenticated users cannot insert, update or delete event rows directly. Only the controlled consent RPC appends events.

Idempotency:

- same operation key + same payload replays one result;
- replay creates no second event and no second audit/activity pair;
- same key + changed payload is rejected;
- a genuine later transition, such as withdrawn → granted, creates a new evidence event.

## 20. Suppression model

Per-channel and global suppression are explicit facts with stable reasons:

- `patient_request`;
- `representative_request`;
- `invalid_contact`;
- `wrong_number`;
- `duplicate_contact`;
- `legal_restriction`;
- `staff_decision`;
- `other`.

Registrar suppression is restricted to operational reasons such as invalid/wrong/duplicate contact or staff correction. Owner/admin may use the broader approved set.

Unsuppressing removes only the selected suppression. It does not fabricate consent. Automated eligibility returns only when all remaining requirements are satisfied.

## 21. Eligibility precedence

`get_patient_communication_eligibility(tenant, patient, channel)` is read-only and provider-neutral.

Automated channel precedence:

1. global suppression;
2. channel suppression;
3. denied, withdrawn or unknown consent;
4. no preferred communication channel;
5. missing contact;
6. invalid contact;
7. unverified contact;
8. representative review requirement;
9. granted consent with a valid verified destination.

Stable blocked reasons:

- `no_contact`;
- `invalid_contact`;
- `unverified_contact`;
- `consent_unknown`;
- `consent_denied`;
- `consent_withdrawn`;
- `channel_suppressed`;
- `global_suppression`;
- `no_preferred_channel`;
- `representative_review_required`.

Manual phone is evaluated separately. Manual work may remain available when the contact and manual-phone policy permit it. A global `legal_restriction` blocks manual phone; ordinary automated suppression does not silently erase authorized manual work.

The function never sends, reserves, claims or changes a reminder job.

## 22. RPC contracts

Controlled RPCs:

- `upsert_patient_communication_contact(...)`;
- `archive_patient_communication_contact(...)`;
- `set_primary_patient_communication_contact(...)`;
- `set_patient_communication_preferences(...)`;
- `set_patient_communication_consent(...)`;
- `set_patient_communication_suppression(...)`;
- `get_patient_communication_eligibility(...)`.

Mutating RPCs authenticate, resolve tenant role, lock patient/contact/preferences where required, validate tenant relationships, normalize input server-side, preserve raw values, enforce state rules, record audit/activity, append consent evidence where applicable, and use tenant-scoped operation keys.

During SQL validation, a real PostgreSQL `NULL NOT IN (...)` authorization defect was detected and fixed. All role checks now explicitly reject `NULL` membership before evaluating allowed roles.

## 23. Role matrix

| Capability | Owner | Admin | Registrar | Doctor | Cashier | Unknown/no tenant |
|---|---:|---:|---:|---:|---:|---:|
| View contacts/preferences | yes | yes | yes | read-only | no | no |
| View consent history | yes | yes | yes | no | no | no |
| Add/edit/archive/primary contact | yes | yes | yes | no | no | no |
| Change language/channel/manual phone | yes | yes | yes | no | no | no |
| Record consent | yes | yes | verbal/correction sources | no | no | no |
| Suppress/unsuppress | yes | yes | operational reasons only | no | no | no |
| Read provider-neutral eligibility | yes | yes | yes | yes | no | no |

Browser smoke verified owner/admin behavior, doctor read-only behavior and cross-tenant owner isolation.

## 24. RLS

RLS is enabled on:

- `patient_communication_contacts`;
- `patient_communication_preferences`;
- `patient_communication_consent_events`;
- `patient_communication_operations`.

Authenticated reads are tenant-scoped and role-scoped. Direct authenticated INSERT/UPDATE/DELETE is revoked. Consent events are append-only. Operations are not exposed for normal frontend reads. Anonymous, cashier, unknown and no-tenant access is blocked.

Schema assertions passed: **45/45**.

## 25. Audit/activity

Events implemented:

- `patient_communication_contact_added`;
- `patient_communication_contact_updated`;
- `patient_communication_contact_archived`;
- `patient_communication_primary_changed`;
- `patient_communication_preferences_changed`;
- `patient_communication_consent_changed`;
- `patient_communication_suppression_changed`.

Audit/activity include tenant, patient, actor, role, target and safe old/new facts. General activity metadata stores only a destination suffix where needed, not the full raw contact.

SQL and browser validation proved one audit and one activity event per changed logical operation. Browser result: `6/6` parity.

## 26. Repository integration

`PatientCommunicationRepository` provides:

- `listPatientContacts(patientId)`;
- `getPatientCommunicationProfile(patientId)`;
- `upsertContact(...)`;
- `archiveContact(...)`;
- `setPrimaryContact(...)`;
- `updatePreferences(...)`;
- `setConsent(...)`;
- `setSuppression(...)`;
- `getEligibility(patientId, channel)`;
- `getEligibilitySummary(patientId)`.

Reads are tenant-filtered. Mutations are RPC-only. Supabase-active mode has no localStorage/local repository fallback when the tenant is missing. Safe error mapping does not expose SQLSTATE, constraint names, function names, stack traces, operation keys or raw contact values.

## 27. Hook integration

`usePatientCommunicationProfile` exposes:

- profile, contacts, preferences, eligibility and consent history;
- loading and dedicated mutation flags;
- safe error state;
- role-aware mutation capability;
- refresh, contact, preference, consent and suppression actions.

Behavior verified:

- no tenant → no fetch;
- no patient → no fetch;
- tenant switch clears old data;
- patient switch clears old data;
- late/stale response is ignored;
- duplicate mutation is blocked;
- success refreshes once;
- errors preserve the loaded profile/editor context.

## 28. Patient-card UI

A real `Связь` tab was added to the patient card.

It displays:

- primary phone and email;
- raw and normalized values;
- verification status;
- patient or representative ownership;
- representative name/relation;
- preferred language/channel;
- per-channel consent;
- channel/global suppression;
- duplicate warning;
- provider-neutral eligibility;
- consent history.

Controlled actions include contact add/archive/primary, preferences, consent/withdrawal and suppression changes. Doctor sees the same authorized contact facts read-only.

Required warnings are present. No provider/send controls exist.

## 29. Reminder-queue integration

Reminder enrichment fetches provider-neutral communication eligibility for each unique patient and attaches a summary without changing the reminder job.

Rows show:

- `Автоканал доступен`;
- `Только вручную`;
- `Нет согласия`;
- `Контакт не готов`;
- `Связь подавлена`;
- `Автосвязь заблокирована`.

Browser smoke verified a legacy/unverified row displayed `Только вручную` and a verified SMS-consented row displayed `Автоканал доступен`. Both fixture reminder jobs remained `scheduled`.

## 30. SQL tests

`supabase/tests/0031_patient_communication_contact_consent_foundation_test.sql` passed.

Coverage includes the required role matrix, tenant isolation, Kazakhstan/international E.164, no country guessing, extension rejection, email normalization, legacy import, primary rules, representative validation, preferences, consent transitions, consent replay/conflict, per-channel/global suppression, eligibility, duplicate family number, append-only evidence, RLS, audit parity and clinical/financial/reminder invariants.

Full inherited SQL regression passed:

- 0024;
- 0025;
- 0026;
- 0027;
- 0028;
- 0029;
- 0030;
- 0031.

Required concurrency suites passed:

- 0025;
- 0026;
- 0027;
- 0029;
- 0030.

No overlap, duplicate active job, active stale job or deadlock regression was introduced.

## 31. TypeScript tests

Targeted communication/reminder tests: **54/54 passed**.

Full test suite: **96 test files, 1070 tests passed**.

Coverage includes repository mapping/RPC calls/safe errors/tenant filtering/no direct mutations, hook switch and stale-response behavior, UI legacy/consent/representative/duplicate/suppression/role behavior and reminder regression.

## 32. Browser smoke

HeadlessChrome 150 was used because a separate Chrome DevTools MCP executable was unavailable in the environment.

Verified against real local Supabase Auth:

- legacy phone shown unverified;
- consent shown as unknown;
- automation blocked for legacy/unverified contact;
- valid E.164 contact saved with raw and normalized values;
- SMS consent granted without granting WhatsApp;
- WhatsApp suppression blocked only WhatsApp;
- global suppression blocked automated channels;
- representative ownership displayed explicitly;
- shared family number produced a warning but remained valid;
- tenant B could not read tenant A patient/contact;
- doctor contact view was read-only;
- reminder eligibility badges matched database facts;
- no send/provider controls appeared.

Final scenarios reported console errors `0`, failed requests `0` and secrets visible `false`.

## 33. Network validation

Local Kong/PostgREST logs for the smoke window showed:

- contact upsert RPC: `2`;
- consent RPC: `1`;
- suppression RPC: `3`;
- read-only eligibility RPC: `88`;
- direct writes to contacts: `0`;
- direct writes to preferences: `0`;
- direct writes to consent events: `0`;
- provider/SMS/WhatsApp/email requests: `0`.

The browser received only an anon client configuration and ordinary authenticated user session. No service-role credential was exposed to the frontend.

## 34. Database validation

Browser-smoke database snapshot before cleanup:

- communication contacts: `4`;
- consent events: `1`;
- idempotent communication operations: `6`;
- communication audit events: `6`;
- communication activity events: `6`;
- scheduled reminder jobs: `2`;
- duplicate consent operation keys: `0`;
- cross-tenant contact leaks: `0`;
- invalid normalized contacts: `0`.

Eligibility snapshot:

- phone: `manual_only`, manual eligible, automated false;
- SMS: `available`, consent granted, automated eligible;
- WhatsApp: `suppressed`, consent unknown, automated false.

SQL validation also proved automated eligibility without granted consent equals zero.

## 35. Side-effect validation

The task created no:

- appointment confirmation mutation;
- reminder job state mutation;
- visit;
- clinical encounter;
- completed service;
- treatment plan/finding/chart fact;
- invoice;
- payment;
- refund/adjustment;
- patient balance change;
- document;
- stock movement;
- provider request or delivery attempt.

Browser fixture counts for visits, encounters, services, invoices and payments were all `0`.

## 36. Cleanup

Completed:

- feature Vite processes stopped, including orphaned local Vite processes;
- QA screenshots removed;
- temporary browser SQL and launch scripts removed;
- `.env.local` removed;
- local Supabase reset without QA seed;
- QA users: `0`;
- browser patients: `0`;
- task reminder jobs: `0`;
- task communication operations: `0`;
- task consent events: `0`.

Baseline seed patients and their unverified legacy contacts remain because they are part of normal migration/seed behavior, not QA residue.

## Checks

All required local implementation, schema, SQL, concurrency, TypeScript, browser, network, cleanup and side-effect checks passed. Detailed evidence follows in sections 30–38.

## 37. Lint/test/build

Final local quality gate:

- ESLint: **passed with no task warning**;
- Vitest: **96 files / 1070 tests passed**;
- TypeScript/Vite production build: **passed**;
- transformed modules: `1959`;
- only the pre-existing large-chunk warning remains.

## 38. Fresh CI

Implementation CI completed successfully on the exact reviewed head:

- workflow: `CI`;
- run number: `#726`;
- run ID: `29229999819`;
- tested commit: `7a9e5c4397fb5cd44037e36b9bd4464a4553b9f3`;
- ESLint: passed;
- tests: passed;
- build: passed;
- Merge guard: passed;
- conclusion: `success`;
- PR remained open and unmerged.

A second fresh CI run will validate the report-only metadata commit. Its exact head and run are recorded outside this self-referential report in the final task response and immutable receipt.

## Limitations

The known limitations are explicit and do not invalidate the verified contact/consent foundation. They are listed below.

## 39. Known limitations

- This is a contact/consent foundation, not a delivery system.
- Phone verification is an explicit staff fact; no OTP or external verification exists.
- Legal guardianship is not inferred or proven by the representative relation field.
- `patients.phone` remains a compatibility field and can still differ from authoritative managed contacts; the legacy trigger only synchronizes unverified `import_legacy` data.
- Reminder enrichment currently performs four eligibility RPCs per unique patient. It is correct and tenant-safe but should become a bounded batch/read-model RPC before high-volume provider work.
- Contact verification/suppression policy may need tenant-level administration before automated delivery is approved.
- No provider account, delivery evidence, inbound reply or webhook semantics were evaluated.

## 40. What was intentionally not implemented

Not implemented:

- SMS, WhatsApp or email sending;
- provider SDK or adapter;
- delivery-attempt table;
- worker, queue claim, retry or scheduler;
- cron or Edge Function;
- webhook;
- message templates;
- OTP verification;
- marketing campaigns/subscriptions;
- consent inference;
- broad CRM contact redesign;
- public portal or consent PDF;
- clinical or financial changes;
- cloud migration apply;
- generated types;
- HEP-V2.

## 41. Recommended next task

Recommended next task: **APPOINTMENT-REMINDER-PROVIDER-ABSTRACTION-001**

Reason: normalized contacts, language, consent and suppression are now authoritative enough to design a provider-neutral outbound adapter without exposing credentials or sending from the frontend.

This next task was not started.
