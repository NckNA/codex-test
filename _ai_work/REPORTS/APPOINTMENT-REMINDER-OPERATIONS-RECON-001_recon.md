# APPOINTMENT-REMINDER-OPERATIONS-RECON-001

## 1. Final verdict

**PARTIAL: mandatory Chrome DevTools MCP, clean local Supabase eligibility experiments, local quality gates and final cleanup reset could not be executed because Hermes local command execution is unavailable in this conversation**

The repository and GitHub baseline were reconciled, the reminder/provider surface was inventoried, the target architecture and implementation order were defined, and a report-only branch was created from the required merge commit. No reminder delivery, migration, provider call, worker, cron, webhook, package change, cloud apply or appointment mutation change was introduced.

## 2. Executive summary

The project has an authoritative appointment source, controlled cancellation/no-show operations, and a separate auditable confirmation workflow. It does **not** have reminder jobs, a reminder planner, a provider-neutral messaging client, SMS/WhatsApp/email delivery, provider webhooks, cron, an Edge Function, a worker, reminder settings, reminder templates, normalized patient communication preferences, or a tenant timezone stored in the database.

The safest implementation order is not automated delivery. The first blocker is authoritative tenant-timezone handling because `tenants` has no timezone field while schedule code converts selected dates through UTC and the appointment repository removes timezone offsets on reads and appends `Z` to offset-free values on writes. A reminder planner built on that behavior can send work on the wrong local day or hour.

After timezone is authoritative, the first reminder slice should be a tenant-scoped **manual operations queue** with durable jobs, no provider send, explicit staff outcomes, cancellation/reschedule invalidation, optimistic appointment-version checks, and idempotent planning. Automated provider delivery remains blocked by the absence of normalized contact, language, consent and opt-out data.

## 3. Branch

`recon/appointment-reminder-operations-recon-001`

## 4. PR URL

Pending at the time of the initial report commit. The PR URL is added in the final report-only update after the branch is pushed.

## 5. Baseline

- repository: `NckNA/codex-test`;
- base branch: `main`;
- required baseline: `7b1e27ed7789669e1ad49c5245ef8a45a6ba893a`;
- verified GitHub baseline: PR `#350` is merged and its merge commit is exactly `7b1e27ed7789669e1ad49c5245ef8a45a6ba893a`;
- the report branch was created from that exact commit;
- no cloud Supabase operation was performed.

## 6. PR head reviewed before final report update

Pending at the time of the initial report commit. This section is populated after fresh GitHub Actions CI completes on the initial report head.

## 7. Report update commit

N/A because the final report commit cannot reference itself.

## 8. Changed files

Exactly one intended file:

- `_ai_work/REPORTS/APPOINTMENT-REMINDER-OPERATIONS-RECON-001_recon.md`

No production source, migration, test fixture, package, lockfile, generated type, environment file or screenshot is changed.

## 9. Pre-read

Reviewed:

- `_ai_work/REPORTS/SCHEDULE-OPERATIONS-RECON-001_recon.md`;
- `_ai_work/REPORTS/APPOINTMENT-CONFLICT-HARDENING-001_hardening.md`;
- `_ai_work/REPORTS/SCHEDULE-SOURCE-OF-TRUTH-CONSOLIDATION-001_consolidation.md`;
- `_ai_work/REPORTS/APPOINTMENT-CANCELLATION-NOSHOW-001_lifecycle.md`;
- `_ai_work/REPORTS/APPOINTMENT-CONFIRMATION-WORKFLOW-001_workflow.md`;
- `_ai_work/SOURCES/02_ROLES_AND_PERMISSIONS.md`;
- `_ai_work/SOURCES/03_MULTI_TENANT_ARCHITECTURE_RULES.md`;
- `_ai_work/SOURCES/04_DATA_ISOLATION_AND_SECURITY.md`;
- `_ai_work/SOURCES/08_APPOINTMENTS_AND_SCHEDULE.md`;
- `_ai_work/SOURCES/11_BACKEND_AND_API_ARCHITECTURE.md`;
- `_ai_work/SOURCES/13_STORAGE_AND_MIGRATION_STRATEGY.md`;
- `_ai_work/SOURCES/18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md`;
- appointment migrations `0001` through `0027`;
- current appointment repository, hooks, schedule page, confirmation components, lifecycle components, patient repository and patient editor;
- routes, placeholders, package scripts, CI workflow and backend integration skeleton.

The requested files `_ai_work/SOURCES/10_NOTIFICATIONS_AND_COMMUNICATIONS.md` and `_ai_work/SOURCES/12_INTEGRATIONS_ARCHITECTURE.md` are not present at the verified baseline.

## 10. Current reminder inventory

| Artifact | Layer | Reachable | Classification | Current behavior | Tenant/patient scope | Delivery readiness |
|---|---|---:|---|---|---|---|
| `SchedulePage` confirmation-attention filter | frontend | yes | real operational, but confirmation-only | Lists appointments whose confirmation state needs attention | repository is tenant-scoped; patient is appointment-scoped | no send |
| `AppointmentConfirmationPanel` | frontend + RPC | yes | real operational | Records contact attempts or direct confirmation | tenant, appointment and patient checked by backend | records facts only |
| `appointment_confirmation_attempts` | database | yes | real operational | Immutable human contact-attempt history | tenant-scoped RLS | not a reminder/delivery table |
| `/sms` / `SmsPage` | frontend | yes | placeholder | States SMS gateway integration will be implemented later | none | no provider, no send |
| `/mailing` / `MailingPage` | frontend | yes | placeholder | States email mailing will be implemented later | none | no provider, no send |
| `/settings` / `SettingsPage` | frontend | yes | placeholder | Generic future settings page | none | no reminder policy |
| amoCRM backend routes | backend | limited | unrelated integration skeleton | OAuth/status skeleton; webhook is ignored placeholder; sync endpoints return 501 | not a reminder channel | not usable for reminders |
| `integration_tokens` | database | not browser-readable by design | unrelated | Supports only `amocrm` encrypted token rows | tenant-scoped | no messaging provider credentials |
| package dependencies | build | yes | negative finding | Supabase/React only; no SMS, WhatsApp, email, queue or scheduler SDK | n/a | none |
| cron / scheduler / Edge Function / worker | backend | no | absent | no operational artifact found | n/a | none |
| provider-neutral `sendMessage` client | backend | no | absent | no contract or implementation found | n/a | none |
| reminder jobs / task queue tables | database | no | absent | no schema found | n/a | none |

No existing artifact sends SMS, WhatsApp or email. A recorded `message_sent` confirmation outcome is a staff-entered operational fact, not proof that a provider request occurred.

## 11. Current human workflow

The clinic workflow supplied for the product is:

1. The day before the appointment, request confirmation.
2. If the patient has not responded, staff call in the evening.
3. If there is still no response, staff make a control call about three hours before the appointment.
4. If the patient continues to ignore contact, staff may move/release the slot and fill it from another date.
5. If the patient confirms, repeated confirmation prompts stop.
6. If the patient requests a callback, staff need a timed human task rather than another generic outbound message.
7. Cancellation ends future reminder work.
8. No-show ends future reminder work.
9. Reschedule invalidates all work tied to the old appointment time.

Current system support covers manual attempt recording, callback/unreachable/confirmed states, cancellation/no-show, reschedule and an attention filter. It does not schedule day-before work, evening calls, three-hour calls, callbacks or tenant-specific policy.

The workflow must be tenant-configurable. One clinic may use one day-before request and one call; another may use only manual calls; another may disable same-day contact. Global hard-coding would silently turn one clinic’s operating habit into every tenant’s policy, which is a remarkably efficient way to create support tickets.

## 12. Existing UI and placeholders

Reachable UI findings from source and prior verified reports:

- `/` is the real `SchedulePage`;
- `/appointments` remains a placeholder;
- `/sms`, `/mailing` and `/settings` are reachable placeholders;
- the schedule’s “Задачи на сегодня” area contains only the confirmation-attention filter;
- there is no durable reminder queue, due-time filter, attempt counter, provider status, retry action, template editor or policy editor;
- confirmation controls are shown only to owner/admin/registrar and are hidden for terminal appointment states;
- patient history displays confirmation facts but no reminder plan or delivery history;
- no route exposes provider credentials.

A fresh Chrome DevTools MCP pass was mandatory but could not be executed because the available Hermes connection does not permit local command/MCP execution in this conversation. Prior baseline reports prove the confirmation and lifecycle UI worked before this report, but they do not replace fresh reminder-specific browser reconnaissance.

## 13. Existing backend and integration assets

Reusable foundations:

- transactional appointment create/reschedule/lifecycle/confirmation RPC boundaries;
- optimistic `updated_at` checking;
- tenant-scoped operation keys and recovery through `appointment_operations`;
- audit/activity infrastructure;
- tenant-scoped appointment and confirmation-attempt reads;
- role helpers and backend role checks;
- existing backend skeleton that demonstrates server-side secret loading for amoCRM.

Missing assets:

- reminder planner;
- reminder job repository;
- delivery-attempt repository;
- provider abstraction;
- scheduler/worker;
- webhook ingestion;
- reminder settings/templates;
- normalized contact/consent model;
- tenant timezone in live schema;
- operational metrics and alerts.

The amoCRM skeleton must not be reused as an outbound reminder provider. It is a separate integration domain and does not offer a safe messaging contract.

## 14. Appointment eligibility matrix

Authoritative gates are evaluated in this order:

1. tenant and appointment must match;
2. appointment must have a patient;
3. start time must be in the future according to tenant timezone;
4. status must be `new` or legacy `confirmed`;
5. current appointment version must match the planned version;
6. reminder type policy must permit the confirmation state;
7. required contact/policy data must exist for automated delivery;
8. callback/unreachable cases may require human review instead of generic automation.

### Status and time matrix

| Appointment status | Future / due soon | Already started / past | Decision |
|---|---|---|---|
| `new` | evaluate confirmation matrix | ineligible | normal reminder candidate |
| legacy `confirmed` | evaluate confirmation matrix | ineligible | confirmation state, not legacy status, controls message type |
| `arrived` | ineligible | ineligible | patient is already present |
| `in_progress` | ineligible | ineligible | encounter workflow has begun |
| `completed` | ineligible | ineligible | terminal historical fact |
| `cancelled` | ineligible | ineligible | all pending jobs cancelled |
| `no_show` | ineligible | ineligible | all pending jobs cancelled |
| `blocked` | ineligible | ineligible | no patient communication |

### Confirmation-state matrix for future `new` or legacy `confirmed` rows

| Confirmation state | `confirmation_request` | operational day-before reminder | same-day reminder | Human review |
|---|---|---|---|---|
| `unconfirmed` | eligible if enabled | eligible if policy separates reminder from confirmation | eligible if enabled and still future | no, unless contact missing |
| `contact_in_progress` | only after configured lockout/attempt policy | eligible if configured | eligible if configured | yes after max attempts or uncertain history |
| `confirmed` | ineligible | eligible only if `reminder_after_confirmation=true` | eligible only if enabled | no |
| `unreachable` | retry only under explicit max-attempt policy | not generic by default | not generic by default | required after policy exhaustion |
| `callback_requested` | ineligible | ineligible as generic automation | ineligible as generic automation | required callback task |

### Time-position semantics

- `future`: candidate according to policy;
- `due soon`: same eligibility, higher queue priority;
- `already started`: ineligible even if status was not updated;
- `past`: ineligible;
- missed scheduler window: process only inside a bounded grace window, otherwise mark `skipped` and require review.

## 15. Reminder types

| Type | First implementation | Human/automated | Preconditions |
|---|---|---|---|
| `confirmation_request` | queue foundation, manual execution | human first; automated later | future active appointment, unconfirmed/contact policy |
| `day_before_reminder` | queue foundation | human first; automated later | future active appointment, tenant policy |
| `same_day_reminder` | later or optional queue type | human first | due offset, not started |
| `control_call_task` | manual operations slice | human task | unresolved confirmation near appointment |
| `callback_task` | manual operations slice | human task | `callback_requested`, due time explicitly recorded |
| `reschedule_notice` | later | automated/manual distinct communication | successful reschedule and consent/channel readiness |
| `cancellation_notice` | later | automated/manual distinct communication | successful cancellation and consent/channel readiness |

Do not collapse these into one generic `notification` value. Different types have different prerequisites, suppression rules, audit meaning and retry behavior.

## 16. Tenant configuration requirements

Proposed contract:

```text
tenant_reminder_policy
- tenant_id
- enabled
- timezone
- confirmation_request_enabled
- day_before_enabled
- day_before_local_time
- same_day_enabled
- same_day_offset_minutes
- reminder_after_confirmation
- allowed_channels[]
- channel_priority[]
- quiet_hours_start
- quiet_hours_end
- maximum_delivery_attempts
- retry_backoff_policy
- callback_workflow_enabled
- staff_fallback_enabled
- default_language
- sender_identity_reference
- policy_version
- updated_by
- updated_at
```

Distinctions:

- **system default**: safe disabled/default policy used only when a tenant explicitly adopts it;
- **tenant policy**: clinic-specific schedule, channels and attempt limits;
- **appointment override**: narrow opt-out or special handling, audited;
- **patient preference**: language, preferred/blocked channels, consent and opt-out;
- **provider capability**: what the configured account can actually send;
- **template version**: immutable content version used by a job.

Frontend must not calculate or persist trusted schedules. The backend/planner derives `due_at`.

## 17. Timezone and scheduling model

Findings:

1. Live `tenants` schema has no timezone field.
2. `appointments.start_time` and `end_time` are `timestamptz`.
3. `SchedulePage` derives a date with `selectedDate.toISOString().split('T')[0]`, which converts to UTC before selecting the calendar day.
4. `AppointmentRepository.normalizeTimeFromDb` strips `Z` or offsets.
5. `normalizeTimeForDb` appends `Z` to offset-free values.
6. Therefore the application currently loses authoritative timezone meaning even though PostgreSQL stores `timestamptz`.

Required semantics:

- store tenant timezone as an IANA name, not a numeric offset;
- calculate “tomorrow” in tenant timezone;
- store `due_at` as `timestamptz`;
- retain an immutable `policy_version` and appointment version used for planning;
- process jobs with `due_at <= now()` and a bounded lateness/grace window;
- never create schedules in browser code;
- use IANA timezone data so historical Kazakhstan timezone changes are represented by the timezone database rather than hard-coded assumptions;
- daylight-saving behavior, for tenants that use DST, follows the IANA zone and must define handling for ambiguous/nonexistent local times;
- deterministic ordering: `due_at`, priority, job ID.

This missing foundation blocks safe reminder planning.

## 18. Proposed reminder-job schema

Minimum safe table:

```text
public.appointment_reminder_jobs
- id uuid primary key
- tenant_id uuid not null
- appointment_id uuid not null
- patient_id uuid not null
- reminder_type text not null
- execution_mode text not null          -- manual | automated
- channel text null
- due_at timestamptz not null
- state text not null
- operation_key text not null
- payload_fingerprint text not null
- appointment_version timestamptz not null
- policy_version text not null
- template_version text null
- attempt_count integer not null default 0
- last_attempt_at timestamptz null
- provider_message_id text null
- last_error_code text null
- last_error_message_safe text null
- claimed_at timestamptz null
- claim_expires_at timestamptz null
- claimed_by text null
- created_by uuid null
- created_at timestamptz not null
- updated_at timestamptz not null
- cancelled_at timestamptz null
- completed_at timestamptz null
```

Indexes:

- `(tenant_id, state, due_at, id)`;
- `(tenant_id, appointment_id, state)`;
- `(tenant_id, patient_id, due_at)`;
- unique `(tenant_id, operation_key)`;
- logical-plan unique key covering tenant, appointment, type, due time, policy version and appointment version.

No raw message secret, provider token, diagnosis, complaint, treatment detail or unrestricted payload belongs in this table.

## 19. Proposed delivery-attempt schema

```text
public.appointment_reminder_delivery_attempts
- id uuid primary key
- tenant_id uuid not null
- reminder_job_id uuid not null
- attempt_number integer not null
- delivery_key text not null
- provider text not null
- channel text not null
- request_fingerprint text not null
- provider_request_id text null
- provider_message_id text null
- outcome text not null
- attempted_at timestamptz not null
- completed_at timestamptz null
- safe_error_code text null
- retryable boolean not null
- provider_event_id text null
- raw_payload_reference text null
- created_at timestamptz not null
```

Constraints:

- unique `(tenant_id, reminder_job_id, attempt_number)`;
- unique `(tenant_id, delivery_key)`;
- provider webhook event IDs must be unique inside the resolved provider account;
- raw provider payload is retained only by explicit encrypted/secured retention policy, never in ordinary browser-readable rows.

## 20. Job state machine

| State | Entry | Exit | Retry | Visibility |
|---|---|---|---|---|
| `scheduled` | planner creates future job | `ready`, `cancelled`, `superseded`, `skipped` | no | queue/history |
| `ready` | due window reached | `processing`, `cancelled`, `superseded`, `skipped` | claimable | queue |
| `processing` | worker/operator claims | `sent`, `failed_retryable`, `failed_terminal`, `uncertain`, `cancelled` | lease recovery | operational |
| `sent` | provider accepted/send acknowledged | `delivered`, `failed_terminal`, `uncertain` | no blind resend | history |
| `delivered` | authenticated provider event | terminal | no | history |
| `failed_retryable` | classified transient failure | `ready`, `processing`, `failed_terminal` | bounded | queue/history |
| `failed_terminal` | permanent failure/max attempts | terminal | manual privileged retry only | visible |
| `cancelled` | appointment/policy cancellation | terminal | no | history |
| `superseded` | appointment time/version changed | terminal | no | history |
| `skipped` | outside due/grace window or operator skip | terminal | new explicit job only | visible |
| `uncertain` | timeout/ambiguous provider response | `sent`, `delivered`, `failed_retryable`, `failed_terminal` | lookup before resend | alert |

`sent` means the provider accepted or acknowledged a send operation. `delivered` requires provider delivery evidence. Neither means the patient confirmed the appointment.

## 21. Delivery outcome model

Provider-neutral outcomes:

- `accepted`: provider accepted request;
- `sent`: provider reports dispatch;
- `delivered`: provider reports terminal delivery;
- `read`: provider reports read/seen;
- `failed`: delivery failed;
- `rejected`: provider rejected request;
- `expired`: provider expired the message;
- `unknown`: outcome cannot yet be resolved.

`accepted`/`sent` can come from synchronous provider responses. `delivered`/`read` are normally webhook-driven. `rejected` and many `failed` values are terminal; transient provider or transport failures may retry. `unknown` never authorizes a blind duplicate send and never changes confirmation state.

## 22. Idempotency

Two independent layers are required.

### Job creation identity

Fingerprint inputs:

```text
tenant_id
appointment_id
reminder_type
due_at
policy_version
appointment_version
execution_mode
```

Recommended uniqueness:

- `unique (tenant_id, operation_key)`;
- a deterministic operation key derived from the above logical identity;
- repeated planner scans return/reuse one logical job;
- same appointment in another tenant remains independent.

### Delivery identity

Fingerprint inputs:

```text
tenant_id
reminder_job_id
delivery_key
provider
channel
template_version
recipient_normalized_hash
payload_fingerprint
```

Recommended uniqueness:

- `unique (tenant_id, delivery_key)`;
- `unique (tenant_id, reminder_job_id, attempt_number)`;
- provider idempotency key equals stable delivery key where supported.

After provider timeout, perform provider lookup/recovery using request/message ID before creating another attempt. A changed appointment version supersedes the job before send.

## 23. Reschedule behavior

Required invariant: no message may reference the stale appointment time.

On reschedule:

- pending `scheduled`, `ready` and unclaimed retry jobs for the old version become `superseded`;
- a new plan is created from the new appointment time/version;
- already sent/delivered attempts remain immutable history;
- a worker must re-read and lock the appointment/version immediately before delivery;
- stale workers must abort without sending;
- UI shows the current plan separately from historical superseded jobs.

Options:

1. **Synchronous mutation in reschedule RPC**: strongest race protection, but couples appointment and reminder schemas.
2. **Transactional event/outbox then planner**: good decoupling, but requires event infrastructure and consumer.
3. **Periodic reconciliation only**: simplest, but leaves a stale-send window.

Recommendation: synchronous supersede of pending jobs in the authoritative reschedule transaction, plus periodic reconciliation as repair. New planning may occur in the same transaction or through a durable event, but stale invalidation must not depend only on a future scan.

## 24. Cancellation/no-show behavior

Cancellation:

- cancel all pending jobs;
- in-flight worker rechecks appointment status under lock before provider call;
- if provider acceptance already occurred, keep history and do not erase it;
- optional cancellation notice is a distinct future communication type;
- cancellation must win over retries.

No-show:

- cancel all future jobs;
- no automatic marketing/follow-up in this task;
- preserve already-sent history.

Race rules:

- cancel/no-show versus unclaimed job: lifecycle action cancels it;
- cancel/no-show versus claimed but unsent job: worker status/version recheck aborts;
- lifecycle action versus accepted provider response: history remains, no duplicate compensation;
- confirmation versus send: confirmation may suppress only confirmation-request jobs, not silently rewrite a delivery fact.

Hard deletion must cascade or synchronously make every job non-sendable. Delivery history retention must follow explicit legal/audit policy rather than leaving orphaned sendable rows.

## 25. Confirmation interaction

| Confirmation fact | `confirmation_request` | operational reminder | Staff action |
|---|---|---|---|
| `unconfirmed` | allowed by policy | allowed | normal queue |
| `contact_in_progress` | wait for lockout/max-attempt policy | allowed if configured | review recent attempt |
| `confirmed` | suppressed | retained only if tenant enables reminders after confirmation | no repeated confirmation prompt |
| `unreachable` | bounded retry only | normally suppressed | human review |
| `callback_requested` | suppressed | suppressed as generic automation | create callback task |
| contact outcome `message_sent` | does not confirm | no automatic confirmation change | await reply/manual result |
| provider `delivered`/`read` | does not confirm | delivery history only | reply requires separate workflow |

A patient reply requires an authenticated provider webhook, normalized inbound event and a separate controlled confirmation action. Delivery success never updates `confirmation_state`.

## 26. Patient contact and consent readiness

Current patient data has:

- one free-form `phone` text field;
- no email field in the current Patient interface/table;
- no normalized E.164 value;
- no country-code model;
- no WhatsApp-capability flag;
- no preferred language;
- no preferred channel;
- no communication-consent record;
- no opt-out/suppression record;
- no guardian contact model for minors;
- no verified ownership;
- no duplicate-number policy.

The patient editor validates only that the phone is non-empty. It does not normalize or validate the number.

Verdict:

- **manual call queue**: conditionally usable because staff can view the existing phone and decide manually;
- **automated outbound delivery**: blocked until a normalized contact and consent/suppression model exists;
- consent must not be inferred from the existence of a phone number or from an appointment source.

## 27. Template model

Proposed table/contract:

```text
reminder_message_templates
- id
- tenant_id
- reminder_type
- channel
- language
- version
- active
- approval_state
- body
- variable_allowlist
- character_limit
- created_by
- created_at
- retired_at
```

Allowed variables only:

- patient first name;
- clinic name;
- appointment date;
- appointment time;
- doctor display name;
- clinic contact details.

Forbidden content:

- diagnosis;
- complaint;
- procedure/treatment plan;
- tooth data;
- medical findings;
- balance/debt unless a separate authorized finance communication domain exists.

Jobs retain the exact template version used. Editing a template never changes historical delivery meaning.

## 28. Privacy and security

- Minimize patient data in jobs and provider metadata.
- Use normalized recipient only at the server/provider boundary.
- Provider credentials live only in server-side secret storage.
- No provider token, webhook secret or service role may appear in frontend, authenticated-readable tables, reports, logs, screenshots or committed environment files.
- Webhooks require signature validation, replay protection and provider-account-to-tenant resolution.
- Tenant ID is required on every job, attempt, template, policy and provider-account relation.
- Ordinary frontend users cannot forge `sent`, `delivered`, `read` or provider IDs.
- Message-body retention should be configurable and minimized; historical template version plus safe render metadata may be preferable to unrestricted body storage.
- Staff visibility follows operational need, not medical access.
- Provider logs must not contain medical notes or raw secrets.

## 29. Provider abstraction

Core contract:

```text
sendMessage({
  tenantId,
  channel,
  recipient,
  template,
  idempotencyKey,
  metadata
}) -> SendResult
```

`SendResult`:

```text
status: accepted | rejected | unknown
providerRequestId?
providerMessageId?
retryable
safeErrorCode?
```

Recovery contract:

```text
lookupDelivery({
  tenantId,
  provider,
  idempotencyKey,
  providerRequestId?,
  providerMessageId?
}) -> RecoveryResult
```

Webhook normalization contract:

```text
providerEventId
providerAccountRef
providerMessageId
normalizedOutcome
occurredAt
receivedAt
safeMetadata
```

Provider-specific adapters own credentials, HTTP payloads, response mapping, retry classification and signature validation. Core reminder tables use provider-neutral states. No vendor should be selected until a tenant/provider requirement is approved.

## 30. Background execution options

| Option | Strengths | Weaknesses | Readiness |
|---|---|---|---|
| Supabase Cron + Edge Function | close to database, simple deployment, secret support | cron/Edge Functions absent, provider webhook and local parity need work | later |
| External worker/queue | strong retries, concurrency, observability and scaling | more infrastructure and cost | later |
| Application-server scheduler | reuses backend skeleton | current backend is narrow/placeholder; process availability and leader election unresolved | later |
| Manual operator queue | no provider secret, no background send, immediate operational value | staff effort, no automatic delivery | preferred first production slice |

Preferred sequence:

1. authoritative tenant timezone;
2. durable reminder queue foundation/planner in dry-run/manual mode;
3. manual operations UI and audited outcomes;
4. normalized contact/consent foundation;
5. provider adapter;
6. worker;
7. webhook ingestion.

## 31. Manual-first option

Recommended first reminder product slice:

- create durable reminder work items;
- show due/overdue appointments;
- show patient phone and confirmation state;
- let authorized staff mark called, message manually sent, callback scheduled, skipped or completed;
- record the result through controlled RPC;
- do not send through a provider;
- invalidate jobs on reschedule/cancellation/no-show;
- preserve tenant isolation and audit.

This extends the existing confirmation workflow without pretending a human-recorded result is a provider delivery. It yields operational value while avoiding credential, webhook, consent and duplicate-send risks.

## 32. Role matrix

| Capability | Owner | Admin | Registrar | Doctor | Cashier | Unknown/no tenant |
|---|---:|---:|---:|---:|---:|---:|
| View reminder queue | yes | yes | yes | optional read-only/no | no | no |
| View delivery history | yes | yes | yes | optional read-only | no | no |
| Configure reminder policy | yes | policy-dependent | no | no | no | no |
| Create manual job | yes | yes | yes | no | no | no |
| Complete/skip manual job | yes | yes | yes | no | no | no |
| Retry failed automated job | yes | restricted | no by default | no | no | no |
| Manage templates | yes | restricted | no | no | no | no |
| Manage provider credentials | yes/server admin only | no by default | no | no | no | no |
| Trigger test message | later, privileged and audited | later, explicit permission | no | no | no | no |

Backend remains authoritative. UI hiding is not authorization.

## 33. Proposed RLS

Reminder jobs:

- tenant members may select only own-tenant rows according to role;
- no direct authenticated insert/update of provider-controlled fields;
- owner/admin/registrar may use controlled RPCs for manual queue actions;
- provider worker writes via server role or narrowly scoped SECURITY DEFINER RPC.

Delivery attempts:

- tenant-scoped read for authorized operational roles;
- insert/update only through server boundary;
- authenticated frontend cannot set provider outcome or identifiers.

Templates/policy:

- own-tenant read;
- owner and explicitly authorized admin mutate through controlled RPC;
- registrar read-only where needed;
- no cross-tenant defaults masquerading as tenant rows.

Provider credentials:

- no authenticated direct read;
- references only in tenant configuration;
- secret values remain outside ordinary application tables or encrypted with server-only access.

## 34. Audit/activity

Events:

- `appointment_reminder_scheduled`;
- `appointment_reminder_superseded`;
- `appointment_reminder_cancelled`;
- `appointment_reminder_send_started`;
- `appointment_reminder_sent`;
- `appointment_reminder_delivered`;
- `appointment_reminder_failed`;
- `appointment_reminder_retried`;
- `appointment_reminder_skipped`.

Each event records:

- tenant;
- appointment;
- patient;
- job;
- actor or system source;
- reminder type;
- channel/provider-neutral outcome;
- operation/delivery key reference;
- safe reason/error code;
- timestamp.

Replay does not emit duplicate success events. Full provider payloads, credentials and message bodies are excluded.

## 35. Observability

Minimum metrics:

- jobs due;
- jobs overdue/delayed;
- planning duration;
- claim-to-completion duration;
- send acceptance rate;
- delivery rate;
- retry count;
- terminal failures;
- uncertain outcomes;
- superseded/cancelled jobs;
- duplicates prevented;
- provider latency;
- webhook lag;
- lease recoveries;
- stale-version skips.

Admin alerts:

- due backlog above threshold;
- oldest due age above threshold;
- invalid credentials;
- sustained provider rejection/rate limiting;
- uncertain outcomes awaiting recovery;
- webhook lag;
- worker lease churn;
- tenant policy enabled without valid provider/contact readiness.

## 36. Failure matrix

| Failure | Decision | Audit/user status |
|---|---|---|
| no phone | human review / terminal for that channel | `missing_contact` |
| malformed phone | terminal until corrected | `invalid_contact` |
| no consent | skip/terminal automated delivery | `consent_required` |
| missing template | terminal configuration error | visible to admin |
| provider unavailable | retryable with backoff | failed retryable |
| timeout before acceptance | lookup; retry only if definitely absent | uncertain |
| timeout after acceptance | lookup/webhook recovery; no blind resend | uncertain |
| webhook never arrives | retain sent/unknown; reconcile by lookup | alert |
| duplicate webhook | idempotent no-op | duplicate prevented metric |
| invalid credential | terminal/configuration alert | admin-visible |
| rate limit | retryable using provider delay | failed retryable |
| tenant disabled | cancel/skip | tenant disabled |
| appointment cancelled | cancel job | lifecycle reason |
| appointment rescheduled | supersede old job | stale plan |
| appointment already started | skip | outside window |
| worker crash | lease expiry and reclaim | lease recovered |
| two workers claim same job | one claim wins | duplicate prevented |
| stale appointment version | supersede/skip and replan | stale version |

## 37. Claiming and concurrency

Preferred database claim:

```text
atomic UPDATE ... WHERE state='ready'
  AND due_at <= now()
  AND (claim_expires_at IS NULL OR claim_expires_at < now())
RETURNING ...
```

`SELECT FOR UPDATE SKIP LOCKED` is also valid inside a transaction and is preferable for batch workers. Advisory locks are unnecessary if row claims and unique delivery keys are correct. A managed queue can replace this later.

Required fields:

- `claimed_at`;
- `claim_expires_at`;
- `claimed_by`;
- maximum attempts;
- lease duration.

Before provider call, worker must:

1. own a valid lease;
2. lock/re-read the job;
3. re-read appointment status, time and version;
4. confirm tenant policy/contact/template readiness;
5. insert/reserve the delivery identity;
6. call provider with stable idempotency key.

Two workers cannot hold the same active claim or create the same delivery key.

## 38. Webhook requirements

Future webhook boundary:

- authenticate endpoint;
- validate provider signature and timestamp;
- resolve provider account to exactly one tenant;
- enforce unique provider event ID;
- ingest idempotently;
- accept out-of-order events through monotonic outcome rules;
- quarantine unknown message IDs for review;
- reject cross-tenant/provider-account mismatches;
- support safe replay;
- retain raw payload only under encrypted, access-controlled and time-bounded policy;
- emit audit/activity without secrets or medical content.

No webhook is required for the manual-first slice.

## 39. Browser reconnaissance

Fresh Chrome DevTools MCP execution: **not completed** due unavailable local Hermes/MCP execution.

Source-level and inherited baseline findings:

- SchedulePage is reachable and operational;
- confirmation attention is a filter, not a persistent task queue;
- appointment modal exposes controlled confirmation/lifecycle actions;
- patient history displays confirmation facts;
- `/sms`, `/mailing`, `/settings` are visible placeholders;
- there is no reminder label, due-time action, provider status, delivery history, retry UI or policy UI;
- prior confirmation browser QA verified `message_sent` does not confirm and role/tenant isolation worked;
- no fresh reminder-specific network or role smoke was executed.

## 40. Database experiments

Fresh clean-local-Supabase experiments: **not completed** because local command execution is unavailable.

The required fixture plan was reconciled:

| Fixture | Expected classification |
|---|---|
| future unconfirmed | eligible confirmation/manual reminder work |
| future confirmed | operational reminder only if tenant policy enables it |
| callback requested | human callback task |
| unreachable | bounded retry or human review |
| cancelled | excluded |
| no-show | excluded |
| rescheduled | old plan superseded, new plan created |
| starting soon | same-day/control task if still future |
| already past | excluded |

Required dry-run query should return deterministic ordering by `due_at`, appointment start and ID, tenant-isolated counts, and exclusion reasons. No eligible/excluded **executed counts** are claimed in this report. No temporary table or cloud database was touched.

## 41. Scale analysis

Let:

- `A` = appointments per tenant per day;
- `R` = planned reminders/tasks per appointment;
- `T` = active tenants;
- `P` = mean delivery attempts;
- `W` = webhook events per delivery.

Approximate daily volumes:

```text
jobs = A × R × T
delivery attempts = jobs × P
webhook events = delivery attempts × W
```

Sensitivity examples should be evaluated rather than invented as business facts. At low/medium SaaS scale, one global worker can initially batch due jobs across tenants if every query is indexed and tenant-safe. Tenant-wide periodic scans are acceptable only with `(state, due_at)` planning indexes and bounded windows. Per-patient queries would create N+1 behavior; planner queries should join/resolve contact data in batches. Webhook and retry volume may exceed appointment volume and must be planned separately.

## 42. Implementation options

### Option 1: Manual reminder operations queue

- changes: reminder-job migration, controlled RPCs, repository/hook/UI, audit and tests;
- provider: none;
- value: immediate;
- risk: moderate;
- dependency: authoritative timezone;
- rollback: disable policy/queue UI, retain history;
- readiness: conditional.

### Option 2: Planner plus dry-run jobs, no operational completion

- changes: job schema, policy schema, planner RPC/dry-run reports;
- provider: none;
- value: validates eligibility/idempotency;
- risk: moderate;
- dependency: timezone;
- rollback: disable planner;
- readiness: conditional.

### Option 3: Full automated provider delivery

- changes: contact/consent schema, settings/templates, provider adapter, worker, webhook, secrets, metrics and extensive tests;
- value: high after maturity;
- risk: high;
- dependency: all foundations;
- rollback: complex because provider calls are irreversible;
- readiness: blocked.

Preferred product slice after timezone: Option 1, with planner/idempotency logic from Option 2 included narrowly enough to create the manual queue safely.

## 43. Readiness cards

### APPOINTMENT-REMINDER-QUEUE-FOUNDATION-001

- verdict: **CONDITIONAL**;
- dependencies: authoritative tenant timezone and offset-preserving appointment time contract;
- scope: job schema, planner/dry-run, state/version/idempotency, lifecycle invalidation, RLS/audit;
- risks: stale-time jobs and policy overreach;
- why later: cannot calculate safe due times yet;
- duplicate check: no existing reminder table/planner.

### APPOINTMENT-REMINDER-MANUAL-OPERATIONS-001

- verdict: **CONDITIONAL**;
- dependencies: queue foundation;
- scope: due queue, staff completion/skip/callback outcome, role UI;
- risks: confusing contact attempt with delivery;
- why later: requires durable jobs first;
- duplicate check: confirmation attention filter is not a durable reminder queue.

### APPOINTMENT-REMINDER-PROVIDER-ADAPTER-001

- verdict: **BLOCKED**;
- dependencies: normalized contact, consent/opt-out, templates, provider decision, secret storage;
- scope: provider-neutral contract and one adapter;
- risks: privacy, duplicate sends, vendor leakage;
- why later: prerequisites absent;
- duplicate check: amoCRM skeleton is unrelated.

### APPOINTMENT-REMINDER-WORKER-001

- verdict: **BLOCKED**;
- dependencies: jobs, provider adapter, leases, metrics, recovery;
- scope: claim/send/retry/reconcile;
- risks: duplicate/concurrent sends;
- why later: no sendable job/provider boundary;
- duplicate check: no current worker or scheduler.

### APPOINTMENT-REMINDER-WEBHOOK-001

- verdict: **BLOCKED**;
- dependencies: provider account, message IDs, adapter and secure endpoint;
- scope: signature verification, idempotent normalized events;
- risks: spoofing, replay, cross-tenant resolution;
- why later: no provider delivery;
- duplicate check: amoCRM ignored webhook is unrelated and unsafe as a reminder webhook.

### APPOINTMENT-REMINDER-TENANT-SETTINGS-001

- verdict: **CONDITIONAL**;
- dependencies: tenant timezone/config foundation and stable policy contract;
- scope: owner/admin policy UI over controlled backend;
- risks: UI becoming source of truth;
- why later: current `/settings` is only a placeholder;
- duplicate check: no reminder settings exist.

## 44. Non-duplication check

Search of current main, reports, branches and PRs found:

- confirmation attempts and state in PR `#350`;
- cancellation/no-show lifecycle in PR `#349`;
- appointment conflict/idempotency foundation in PR `#347`;
- schedule source consolidation in PR `#348`;
- placeholders for SMS, mailing and settings;
- amoCRM integration skeleton and unrelated token model;
- no reminder branch;
- no reminder PR;
- no reminder job/delivery table;
- no provider sender;
- no cron/worker/webhook implementation.

The proposed queue does not replace confirmation attempts. A reminder job says work is due; a confirmation attempt says a real staff contact action was recorded; a provider delivery attempt says a real provider request occurred.

## 45. Exact next task

**TENANT-TIMEZONE-SCHEDULING-FOUNDATION-001**

Exact scope:

- add authoritative IANA timezone to tenant data with a safe existing-tenant default;
- expose it through tenant context/backend DTO;
- centralize conversion between tenant-local appointment input and `timestamptz`;
- stop stripping database timezone offsets;
- stop interpreting arbitrary offset-free browser values as UTC by appending `Z`;
- make schedule day selection/filtering tenant-timezone aware;
- add SQL/unit/browser tests for Asia/Almaty, UTC storage, day boundaries and reschedule;
- no reminder tables or provider work.

Evidence: reminder due times cannot be trusted while tenant timezone is absent and current frontend/repository transformations erase or invent timezone information. Contact/consent is the next prerequisite before automated delivery, but it does not block a later manual queue as directly as timezone blocks planning itself.

## 46. Validation

Completed through GitHub:

- required baseline commit confirmed;
- PR `#350` merge commit confirmed;
- branch created from exact baseline;
- reminder PR/branch non-duplication search completed;
- repository source/report/schema inventory completed;
- expected changed-file scope is one report.

Not executable locally in this conversation:

- `git status --short`;
- `npm run lint`;
- `npm run test -- --run`;
- `npm run build`;
- Chrome DevTools MCP;
- local Supabase CTE experiments;
- local `git diff --check`.

GitHub Actions CI is required on the report head and final report-update head. Its result is recorded after the PR is opened.

## 47. Cleanup

No QA user, tenant, patient, appointment, reminder row, provider request, screenshot, fake-provider script, Vite process or temporary SQL file was created by this report session.

`npx supabase db reset --no-seed` was not executed because local command execution is unavailable. Therefore the mandatory local cleanup validation remains incomplete even though this session did not create local fixtures.

## 48. Known limitations

- fresh browser and database experiments are missing;
- local worktree cleanliness cannot be independently confirmed through Hermes;
- no executed eligibility counts are claimed;
- no provider was evaluated against a real account;
- no legal consent rule is invented;
- timezone foundation and contact/consent foundations remain separate future work;
- historical legacy `status='confirmed'` remains distinct from authoritative `confirmation_state`;
- hard-delete retention policy for future delivery history needs a deliberate legal/audit decision.

## 49. What was intentionally not implemented

- no migration;
- no reminder table;
- no delivery-attempt table;
- no provider SDK;
- no SMS;
- no WhatsApp;
- no email;
- no cron;
- no Edge Function;
- no worker;
- no webhook;
- no settings page;
- no template editor;
- no appointment mutation change;
- no confirmation workflow change;
- no cancellation/no-show change;
- no cloud apply;
- no seed change;
- no package change;
- no generated type;
- no HEP-V2;
- no next task;
- no merge.
