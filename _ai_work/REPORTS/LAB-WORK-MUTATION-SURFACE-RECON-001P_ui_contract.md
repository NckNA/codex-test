# LAB-WORK-MUTATION-SURFACE-RECON-001P — first laboratory write-surface contract

## Summary

Final verdict: **PASS** for reconnaissance.

The first laboratory write UI is **READY to implement only as a patient-card-scoped surface**. The top-level `/laboratory` page must remain read-only in the next implementation task.

Recommended boundary:

```text
PatientCardPage
→ PatientLaboratoryWorkTab(patientId, timezone, role)
→ bounded LaboratoryWorkOrderDialog
→ fail-closed laboratory mutation options read helper
→ frozen useLaboratoryWorkMutations (001O)
→ frozen atomic RPCs (001N)
```

This choice deliberately avoids adding patient selection to the first mutation UI. The patient card already supplies the authoritative `patientId`, reducing wrong-patient risk and keeping the first write task bounded.

No application code, route, schema, migration or browser state is changed by 001P.

## Branch

`recon/lab-work-mutation-surface-001p`

## PR URL

https://github.com/NckNA/codex-test/pull/386

- Base: `main`.
- Baseline: `e30af98622caf21c69d760026133a2c54810765c` (001O frozen plus final evidence correction).
- Initial report head: `ce2200d4e97c019b026f438e3b44a9b114a10e9b`.
- Initial CI: run `#837` / `32242919951`, **SUCCESS** on `ce2200d4e97c019b026f438e3b44a9b114a10e9b`.
- Report update commit: N/A because a report cannot truthfully contain its own future SHA; final evidence is persisted after publication.

## Changed files

This is a strict report-only task. The live PR may contain exactly:

```text
_ai_work/REPORTS/LAB-WORK-MUTATION-SURFACE-RECON-001P_ui_contract.md
```

No `src/*`, migration, seed, package, helper, environment, screenshot or unrelated report file is allowed.

## Sources inspected

Laboratory lineage:

- 001L top-level read-only queue surface and `LaboratoryPage.tsx`;
- 001I patient human-readable reference surface and `PatientLaboratoryWorkTab.tsx`;
- 001H `usePatientLaboratoryWorkReferences`;
- 001M laboratory mutation semantic contract;
- 001N atomic RPC foundation;
- 001O typed mutation client/hook and `mutationVersion` behavior.

Adjacent implementation patterns:

- `PatientCardPage.tsx` role/timezone propagation patterns;
- `Sidebar.tsx` laboratory read visibility;
- `DoctorRepository.ts` active/all-doctor reads;
- `useClinicDoctors.ts` existing backend-selection behavior;
- `usePatientsCollection.ts` and `useCashierPatientSearch.ts` patient read/search behavior;
- `CompletedServicesPanel.tsx` + role-capability pattern;
- `domain/timezone.ts` tenant-local datetime conversion helpers.

## Current surface analysis

### Top-level `/laboratory`

`LaboratoryPage` is explicitly an **operational read-only queue**. It already provides:

- all tenant laboratory orders through 001K;
- patient names;
- doctor/laboratory/work-type human labels;
- overdue/today/upcoming/unscheduled grouping;
- status, doctor, laboratory and text filters;
- summary cards;
- refresh/retry states.

Its current doctor/laboratory filter options are reconstructed from **values already referenced by loaded orders**. Those lists are correct for filtering existing queue rows but incomplete for creating a new order. A doctor/laboratory that has never appeared in an order is absent.

The queue's patient-name map likewise contains patients represented by laboratory orders. It is not a safe complete patient picker for create.

Therefore adding create directly to `/laboratory` now would require a second new concern: a full tenant patient search/selection path. That is unnecessary for the first write task and increases wrong-patient risk.

### Patient laboratory tab

`PatientLaboratoryWorkTab` already has the authoritative patient context:

```text
patientId
clinic timezone
patient-scoped orders
human-readable doctor/laboratory/work-type labels
```

It is therefore the smallest correct place to introduce the first create/edit/complete/reopen UI.

`PatientCardPage` already passes `activeTenant.role` into other patient sub-panels, but not yet into `PatientLaboratoryWorkTab`. Adding `role` in the next implementation is a narrow established pattern, not a new authorization system.

### Mutation hook

Frozen 001O already provides:

- Supabase-only/fail-closed availability;
- create/update/complete/reopen commands;
- stable create identity;
- explicit `expectedVersion`;
- bounded error categories;
- operation-uncertain exact retry;
- deterministic stale/state refresh;
- post-commit refresh warning;
- tenant/user context gating;
- in-flight duplicate-action blocking.

The UI must consume those semantics rather than reimplement them.

## Role capability contract

UI capability helpers must mirror 001N, while the database remains authoritative.

Recommended explicit capability object:

```text
clinic_owner:
  view=true create=true edit=true complete=true reopen=true

clinic_admin:
  view=true create=true edit=true complete=true reopen=true

doctor:
  view=true create=true edit=true complete=true reopen=false

registrar:
  view=true create=true edit=true complete=true reopen=false

cashier / marketer / support / unknown:
  create=false edit=false complete=false reopen=false
```

The next task must not rely on sidebar visibility as authorization. Patient-card actions must derive directly from `activeTenant.role` and `useLaboratoryWorkMutations.available`. RPC role checks remain the final enforcement layer.

## First write-surface choice

### Accepted: patient card first

Add mutation controls only inside `PatientLaboratoryWorkTab`.

Benefits:

1. `patientId` is already fixed and tenant-scoped by the patient card.
2. No new patient picker/search is required.
3. Doctor workflow naturally starts from a concrete patient.
4. Existing patient-scoped read/refetch already exists.
5. Browser QA can prove one patient's full lifecycle without a second search subsystem.
6. Later queue actions can reuse the dialog after a separate safe patient-selection task.

### Rejected for the next task: top-level queue create

Do not add a top-level create button in 001Q. It would force either:

- misuse of queue patient-name data as a complete picker; or
- reuse of `usePatientsCollection`, which can silently select local backend outside a fully ready Supabase context; or
- reuse of the cashier-specific patient-search hook across an unrelated domain; or
- creation of an additional generic patient-search subsystem in the same PR.

All four options widen the first mutation UI unnecessarily.

## Mutation options read-model

The current human-readable reference hook is optimized for displaying **existing orders**, not for editing/creating them:

- doctors are requested only for doctor IDs present on current orders;
- laboratories/work types are resolved for display;
- selected work-type IDs are not exposed to the UI.

`useClinicDoctors()` is also not the preferred write-form source because it independently falls back to local backend when Supabase prerequisites are absent. The mutation UI must share the stricter 001C/001O selection.

### Required next-task helper

Add one bounded read-only helper, tentatively:

```text
useLaboratoryMutationOptions(orderId?)
```

It must consume `useLaboratoryWorkRepository()` and be enabled only when:

```text
ready
backend === 'supabase'
tenantId present
userId present
repository present
```

It may use the **same existing repositories**, not a new backend:

```text
repository.listLaboratories(true)
repository.listWorkTypes(true)
repository.listOrderWorkTypeIds(orderId)   // edit only; one order, no N+1
createDoctorRepository({backend:'supabase', tenantId}).listDoctors()
```

Required result:

```text
doctors: [{id, name, active}]
laboratories: [{id, name, active}]
workTypes: [{id, name, code, active, sortOrder}]
selectedWorkTypeIds: string[]
ready/loading/error/refetch
```

Selection behavior:

- create may select only active doctor/laboratory/work types;
- edit may keep an already-selected inactive historical reference;
- an inactive historical option must be visibly marked and cannot be newly selected after removal;
- no raw UUID should be used as display text;
- if option loading fails, mutation form must remain unavailable rather than accepting guessed IDs.

## Dialog/form contract

Recommended reusable component name:

```text
LaboratoryWorkOrderDialog
```

The component may be reusable later, but in 001Q it is mounted only from the patient laboratory tab.

### Create

Patient is fixed by the current card and displayed read-only, not editable.

Initial create form should support the current laboratory order domain without inventing extra lifecycle states:

- title: required;
- order number: optional;
- responsible doctor: optional active selection;
- laboratory: optional active selection;
- work types: zero or more active selections;
- sent to laboratory timestamp: optional;
- planned ready timestamp: optional;
- received from laboratory timestamp: optional;
- try-in timestamp: optional;
- delivered to patient timestamp: optional;
- shade: optional;
- anatomical scope: optional;
- selected teeth: optional;
- comment: optional.

The RPC already treats status as `in_progress`; create UI must not offer a status selector.

### Edit

Edit is available only for `in_progress` orders and only when `mutationVersion` is a positive integer.

The dialog must initialize from the complete current order state and exact selected work-type IDs. Save calls one `updateOrder` with the **entire desired state**, preserving fields the user did not change.

If `mutationVersion` is missing or invalid:

```text
edit/complete/reopen actions disabled or absent
message: refresh current data before changing this laboratory work
no RPC call
```

### Complete

Completion must be a separate deliberate action, not a status dropdown.

Recommended UI:

- button `Завершить работу` on `in_progress` order;
- small confirmation dialog naming the order;
- call `completeOrder({orderId, expectedVersion})`;
- on success close confirmation and let the 001O refresh update status/version.

### Reopen

Only owner/admin sees `Вернуть в работу` on completed orders.

Reopen requires a non-empty explicit reason in a dialog. The reason is sent only to `reopenOrder`; it must not silently overwrite the normal order comment.

### No hard delete

No delete/remove-order control in 001Q.

## Date/time contract

Laboratory timestamps are offset-aware instants in the repository/database.

For `datetime-local` form controls, 001Q must reuse the existing tenant-timezone helpers:

```text
instantToTenantDateTimeInput
 tenantDateTimeToInstant
```

Rules:

- display/edit in the active clinic timezone;
- convert local wall-clock input to an offset-aware instant before mutation;
- empty optional datetime maps to `null`;
- surface `TimezoneError` using the existing safe timezone messages;
- never append `Z` to a local datetime by hand;
- do not use browser timezone as clinic truth.

## Anatomical/teeth scope

001Q should not introduce a second dental chart. `selectedTeeth` remains manufacturing/laboratory scope.

A bounded selector or validated FDI input is acceptable, but it must:

- allow only the FDI set accepted by 0035;
- deduplicate and sort before submission;
- preserve current selected teeth on edit;
- not write dental-chart tooth state or findings.

If implementing a full graphical tooth selector materially expands the task, use a validated compact FDI selector/input first and leave graphical enhancement for a separate UI task.

## Error and reconciliation UX

The UI must expose the 001O semantic categories without interpreting raw backend strings.

### Validation / permission

Show bounded form/action error. Do not retry automatically.

### Stale / conflict / not_found / invalid_state

001O already requests a canonical refresh. UI must:

- keep/close the form only according to whether canonical data is available;
- show a clear message that data changed and needs review;
- never silently resubmit with a newly read version.

### Operation uncertain

Show a high-visibility state:

```text
Результат операции пока не подтверждён.
Не создавайте новую операцию.
```

Provide exactly one `Повторить ту же операцию` action wired to `retryPendingMutation()`.

The UI must not rebuild the payload or generate another create UUID on retry.

### Committed result + refresh warning

If the RPC succeeded but refresh failed, show the 001O `refreshWarning` as a warning, not as a failed mutation. Provide normal page refresh/reload guidance.

## Refresh ownership

In `PatientLaboratoryWorkTab`, instantiate 001O with the existing patient-order `refetch` as its primary refresh callback.

After order refresh:

- create adds the new order to patient list;
- edit/complete/reopen replaces the canonical order/version;
- `usePatientLaboratoryWorkReferences` query identity reacts to changed order identity/IDs and refreshes labels.

The component may also expose a manual combined refresh if reference options are stale, but it must not perform independent direct table mutations.

## Component decomposition for 001Q

Keep `PatientCardPage` thin. Recommended allowed design:

```text
PatientCardPage
  only passes role to PatientLaboratoryWorkTab

PatientLaboratoryWorkTab
  owns list + action visibility + selected order/dialog state

laboratoryWorkPermissions.ts
  pure role-capability helper

useLaboratoryMutationOptions.ts
  fail-closed read-only form options

LaboratoryWorkOrderDialog.tsx
  create/edit form

LaboratoryWorkLifecycleDialogs.tsx
  bounded complete/reopen confirmation/reason UI
```

This prevents `PatientCardPage` from becoming the God Component explicitly prohibited by project rules.

## Unit/integration test contract for 001Q

At minimum:

### Permission tests

- owner/admin: create/edit/complete/reopen shown when state allows;
- doctor: create/edit/complete shown, reopen absent;
- registrar: create/edit/complete shown, reopen absent;
- cashier/unsupported: mutation controls absent;
- direct injected RPC cannot make unavailable/local mutation UI active.

### Create form

- patient is fixed and cannot be changed;
- active options load from tenant-scoped sources;
- inactive options cannot be newly selected;
- title required;
- optional empty values become null/empty set;
- datetime uses tenant timezone helpers;
- submit calls `createOrder` once;
- double click/in-flight submit does not create second call.

### Edit

- complete desired state + exact selected work-type IDs are loaded;
- historical inactive current refs remain visible/preserved;
- completed order has no edit action;
- missing/invalid mutationVersion blocks mutation;
- expectedVersion passed exactly.

### Lifecycle

- complete is explicit confirmation, not status dropdown;
- owner/admin reopen requires reason;
- doctor/registrar cannot reopen;
- no delete action exists.

### Reconciliation

- stale result shows safe conflict and canonical refetch path;
- uncertain result shows retry control;
- retry calls `retryPendingMutation`, not create/update anew;
- committed result + failed refresh shows warning, not failure;
- tenant/user context change hides stale mutation state.

### Timezone/anatomy

- instant ↔ tenant `datetime-local` conversion;
- invalid/nonexistent/ambiguous local time surfaces safe error;
- selected teeth validated/deduplicated/sorted;
- no dental chart/finding mutation.

## Real browser QA matrix for 001Q

Browser QA is mandatory because 001Q will change UI.

Use real local Supabase and synthetic fixtures only; cleanup in `finally` with zero-row verification.

### Admin A

1. Open synthetic patient's `Лаборатория` tab.
2. Create an order with active doctor, laboratory, at least two work types, planned-ready date, shade and selected teeth.
3. Verify list display and `mutationVersion`-backed action availability.
4. Hard refresh/browser reload and verify persistence.
5. Edit title/date/work-type set; verify persistence after reload.
6. Complete; verify status and absence of edit action.
7. Reopen with explicit reason; verify status returns to `В работе` after reload.
8. Verify no delete control.
9. Console errors = 0; failed requests = 0; secrets/raw UUID not shown.

### Doctor A

1. Create one order for a synthetic patient.
2. Edit it.
3. Complete it.
4. Reopen action absent.
5. Reload persistence.
6. Console/network clean.

### Registrar A

1. Create or edit an in-progress order.
2. Complete allowed.
3. Reopen absent.
4. Console/network clean.

### Unsupported role (Cashier A)

- patient laboratory read behavior may remain according to existing patient-card access;
- create/edit/complete/reopen controls absent;
- no mutation request issued.

### Tenant boundary

- Admin B cannot load/mutate Clinic A patient/order via direct route/known fixture IDs;
- no Clinic A patient name, laboratory order, doctor/lab/type labels or raw IDs appear.

### Stale conflict

- open edit on version N;
- mutate the synthetic order through a controlled local-only second session so version becomes N+1;
- submit stale form;
- UI shows bounded stale message;
- no partial work-type update;
- canonical refreshed state wins.

### Cleanup

Verify zero rows for every synthetic patient/order/relation/reference fixture created specifically by the smoke scenario.

## What 001Q must NOT do

- no top-level `/laboratory` create/edit/complete/reopen controls yet;
- no patient picker/search;
- no new backend/repository family;
- no schema or migration changes;
- no direct Supabase table mutations;
- no local/dev mutation fallback;
- no hard delete;
- no new lifecycle statuses;
- no finance, warehouse, treatment-plan, completed-service, dental-chart or finding writes;
- no MacDent/amoCRM writes;
- no audit viewer expansion;
- no global timezone helper rewrite;
- no `PatientCardPage` business logic beyond passing role/props.

## Checks

001P is report-only. Required before merge:

- changed-file allowlist: exactly this report;
- `npm run lint`: PASS;
- full `npm test -- --run`: PASS;
- `npm run build`: PASS;
- `git diff --check`: PASS;
- GitHub CI: SUCCESS.

## Browser smoke

**NOT REQUIRED / NOT PERFORMED.**

001P changes no UI or runtime behavior. Browser execution belongs to 001Q and is mandatory there.

## Issues / limitations

- Existing `useClinicDoctors` independently chooses local fallback and should not be the mutation-form authority; 001Q needs a bounded options hook sharing laboratory selection.
- Existing queue/reference maps are display/read models and are incomplete as create-option sources.
- A future top-level queue create action still needs a dedicated safe tenant patient search/picker task or explicit extension; that concern is intentionally not bundled into 001Q.
- Audit UI projection of laboratory events remains separate from audit integrity already proven in 001N.
- Graphical tooth selection may be a later enhancement if a bounded validated FDI control is used first.

## Final verdict

```text
FIRST WRITE SURFACE: PATIENT LABORATORY TAB
TOP-LEVEL QUEUE WRITE CONTROLS NEXT TASK: NO
PATIENT PICKER NEXT TASK: NO
ROLE CAPABILITIES: DEFINED
FAIL-CLOSED OPTIONS READ MODEL: REQUIRED
MUTATION VERSION GATE: REQUIRED
CREATE / EDIT / COMPLETE / REOPEN UX: DEFINED
UNCERTAIN RETRY UX: DEFINED
STALE-CONFLICT UX: DEFINED
TENANT-TIMEZONE INPUT RULES: DEFINED
HARD DELETE: FORBIDDEN
REAL BROWSER QA: REQUIRED IN IMPLEMENTATION
001P RECON: PASS
```

## Recommended next task

**LAB-WORK-MUTATION-PATIENT-SURFACE-001Q — implement the first bounded laboratory write UI only inside `PatientLaboratoryWorkTab`: pass active tenant role from `PatientCardPage`, add a pure laboratory role-capability helper, add a fail-closed `useLaboratoryMutationOptions` read helper sharing the 001C/001O laboratory backend selection, add a reusable create/edit dialog and explicit complete/reopen dialogs, consume only frozen `useLaboratoryWorkMutations`, require valid `mutationVersion` for existing-order actions, preserve inactive historical references, use tenant timezone conversion helpers, expose uncertain exact-retry/stale-refresh warnings, and run the full Admin/Doctor/Registrar/unsupported-role/tenant-boundary/stale-conflict real localhost browser QA matrix. Keep `/laboratory` top-level queue read-only; no patient picker, migrations, hard delete, new status, finance/warehouse/treatment/completed-service/dental-chart/finding/MacDent/amoCRM write coupling.**
