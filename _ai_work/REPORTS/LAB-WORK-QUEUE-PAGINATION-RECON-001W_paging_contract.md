# LAB-WORK-QUEUE-PAGINATION-RECON-001W

## Final verdict

**PASS**

## Branch

`recon/lab-work-queue-pagination-001w`

## PR URL

Pending until report publication.

- Base: `main`.
- Baseline: `fe22a31ab4365beebd58c3bff0787032b36420d2` (001V frozen).
- Report head / CI: pending publication.

## Summary

001W is strict report-only reconnaissance for bounding the tenant-wide laboratory operational queue after 001V removed the broad patient-name hydration. No application code, migration, schema, browser, local data, MacDent, amoCRM or cloud Supabase write was performed.

The current queue cannot be made correct by simply adding `limit/offset` or `.range()` to `ILaboratoryWorkRepository.listOrders()`. Today `LaboratoryPage` derives its summary, status/due/doctor/laboratory filters, search results, filter option lists and operational priority ordering from the entire loaded tenant order array. Paginating that array before those semantics are moved server-side would silently turn whole-queue behavior into current-page behavior.

The recommended architecture is a bounded read model that preserves existing frozen mutation and enrichment contracts:

1. a server-side paged laboratory-order read with authoritative filters, search, ordering and `totalFiltered`;
2. a separate lightweight whole-tenant laboratory summary for `inProgress`, `overdue`, and `completed`;
3. doctor/laboratory filter options loaded independently from existing small dictionaries, including inactive historical references;
4. patient names and order reference labels enriched only for the current page through the already accepted exact-ID/read hooks rather than returned by a giant joined UI payload.

This requires a dedicated read RPC boundary because the current search contract spans order fields plus patient, doctor, laboratory and work-type names. Trying to reproduce that correctly with client-side filtering after page boundaries is incomplete, while scattering cross-entity presearches across multiple repositories would reintroduce broad reads and complex reconciliation.

## Checks

- Source-only reconnaissance: PASS.
- Current repository paging/search/filter contract inspected: PASS.
- Current `LaboratoryPage` whole-array summary/filter/search/sort semantics inspected: PASS.
- Existing project offset/range pagination pattern inspected: PASS.
- Existing laboratory indexes inspected: PASS.
- Existing independent doctor/laboratory reference sources inspected: PASS.
- Tenant authoritative IANA timezone foundation inspected: PASS.
- Changed files expected: exactly this Markdown report.
- Browser smoke: not required for report-only reconnaissance.
- Cloud Supabase: forbidden and not used.

## Browser smoke

Not run. 001W changes no UI or runtime code. The already-running local DentalFlow site is unrelated to the acceptance evidence for this report-only task and is intentionally left available for user inspection.

## Current-state evidence

### 1. The current primary read is unbounded

`SupabaseLaboratoryWorkRepository.listOrders()` currently executes a tenant-scoped `SELECT *` with optional patient/status/laboratory/doctor equality filters and orders by `created_at DESC, id ASC`. It has no `limit`, `offset`, cursor or range.

The local repository mirrors this by reading all tenant local orders and sorting the full result.

`LaboratoryWorkOrderFilters` currently contains only:

- `patientId`;
- `status`;
- `laboratoryId`;
- `responsibleDoctorId`.

`useLaboratoryWorkQueue()` calls `repository.listOrders(normalizedFilters)` and exposes the full returned array.

### 2. Current page semantics are whole-queue semantics

`LaboratoryPage` calls `useLaboratoryWorkQueue()` without filters and then performs the following over the complete loaded array:

- global summary counts: in-progress, overdue, completed;
- status filter;
- due filter;
- responsible-doctor filter;
- laboratory filter;
- free-text search;
- doctor/laboratory dropdown option derivation;
- operational sorting.

The current test explicitly describes this as filtering the loaded queue and verifies patient-name search.

Therefore a range applied before these operations would make every result dependent on which physical page happened to load first.

### 3. Current free-text search is cross-entity

The current search string matches all of:

- laboratory work title;
- order number;
- patient full name;
- responsible doctor full name;
- laboratory name;
- work-type names.

All six semantic sources must be searched before the page boundary. A plain `laboratory_work_orders` PostgREST range cannot preserve this behavior by itself.

### 4. Current operational ordering can be reproduced server-side

Current client ordering is:

1. overdue in-progress;
2. in-progress ready later today;
3. upcoming in-progress;
4. unscheduled in-progress;
5. completed;
6. within the bucket, `planned_ready_at ASC`, then `updated_at DESC`.

Because the current status domain is only `in_progress | completed`, an explicit SQL `CASE` ordering is recommended rather than depending on textual status ordering. The server contract should be deterministic with `id ASC` as the final tie-breaker.

Recommended conceptual order key:

1. `CASE status WHEN 'in_progress' THEN 0 ELSE 1 END`;
2. for in-progress rows, `planned_ready_at ASC NULLS LAST`;
3. `updated_at DESC`;
4. `id ASC`.

This naturally puts past-due work first, then today's/upcoming scheduled work, then unscheduled work, followed by completed rows. The RPC should express the CASE explicitly so future status additions do not silently alter order semantics.

### 5. Due filters must use the authoritative tenant timezone

The project already has `tenants.timezone` as an authoritative IANA timezone, established by migration 0028. The server must read the tenant timezone itself; the browser must not supply an arbitrary timezone for due filtering.

Recommended semantics:

- `all`: no due predicate;
- `overdue`: `status = 'in_progress'`, planned time exists and is `< now()`;
- `today`: `status = 'in_progress'`, planned time is `>= now()` and before the end of the current tenant-local day;
- `upcoming`: `status = 'in_progress'`, planned time is on a tenant-local day after today;
- `unscheduled`: `status = 'in_progress' AND planned_ready_at IS NULL`.

This preserves the current UI rule that a job scheduled earlier today but already late belongs to `overdue`, not `today`.

### 6. Existing indexes help but do not justify blind index expansion

Migration 0035 already provides:

- `(tenant_id, patient_id, created_at DESC)`;
- `(tenant_id, responsible_doctor_id, created_at DESC)` for non-null doctor;
- `(tenant_id, laboratory_id, created_at DESC)` for non-null laboratory;
- `(tenant_id, status, planned_ready_at)`.

001X should inspect query plans with representative local fixtures before adding another composite/search index. No `pg_trgm` or broad cross-domain index expansion should be introduced speculatively.

## Rejected approaches

### Rejected A: add `.range()` to current `listOrders()` and keep client filters

Rejected because it would make summary, search, due/status filters and doctor/laboratory dropdowns page-local while the UI continues to present them as whole-queue behavior.

### Rejected B: fetch many pages in the browser until all filters can be evaluated

Rejected because it merely disguises the existing unbounded read as repeated bounded reads and does not scale.

### Rejected C: pre-search patients/doctors/labs/work types independently, union order IDs, then page orders

Rejected for the first implementation because it requires multiple cross-entity searches, set reconciliation, deduplication and large ID lists before paging. It also duplicates search semantics across repositories.

### Rejected D: giant enriched queue RPC returning every human label, filter dictionary and summary in one JSON object

Rejected because it would create a second God read-model and bypass the already frozen page-scoped 001V patient-label and existing laboratory-reference enrichment paths.

### Rejected E: keyset pagination for the first bounded queue

Not selected initially. Keyset pagination is attractive for mutation-heavy feeds, but the queue has a compound nullable operational sort and needs previous-page navigation plus server filters/search. The project already has a tested offset/range pagination convention. A bounded offset model is acceptable if filter/search changes reset to page 0 and successful mutations return the queue to a canonical first page before refetch.

## Selected paging contract

### Backend read boundary

001X should introduce a read-only, tenant-authorized RPC dedicated to the laboratory operational queue. Suggested semantic name:

`list_laboratory_work_queue_page`

Suggested inputs:

- `p_tenant_id uuid`;
- `p_status text default null`;
- `p_responsible_doctor_id uuid default null`;
- `p_laboratory_id uuid default null`;
- `p_due_filter text default null`;
- `p_search text default null`;
- `p_limit integer default 50`;
- `p_offset integer default 0`.

Role access should remain identical to laboratory SELECT: clinic owner, clinic admin, doctor, registrar. Unsupported roles must fail closed.

Recommended limits:

- default `50`;
- minimum `1`;
- maximum `100`.

`p_offset` must be non-negative.

### Search contract

Search must execute before pagination and preserve the six current semantic sources. The query should use a parameterized escaped `ILIKE` pattern against order fields and `EXISTS` checks for related patient/doctor/laboratory/work-type names.

Literal `%`, `_`, and backslash should be escaped so user search text is treated literally rather than as a SQL wildcard program.

Search should be debounced in 001Z, approximately 300 ms. To preserve current semantics, a one-character non-empty search remains valid; do not silently impose a new minimum query length in the backend.

### Return contract

Avoid returning human labels. The page result should contain canonical order records only, plus paging metadata.

Preferred return boundary:

```text
{
  items: LaboratoryWorkOrderRecord[],
  totalFiltered: number,
  limit: number,
  offset: number
}
```

A JSON object is preferred over repeating `total_count` on every row because zero-result pages still need the count. The frontend client must validate/map the payload rather than exposing raw RPC JSON to components.

### Global summary boundary

The three summary cards are not page summaries. Preserve them as whole-tenant metrics:

- `inProgress`;
- `overdue`;
- `completed`.

001X should provide a separate read-only summary RPC, conceptually:

`get_laboratory_work_queue_summary(p_tenant_id uuid)`

`overdue` must use `now()` and does not require browser timezone because overdue is an instant comparison. The summary should remain independent from user search/page filters, matching current behavior.

Do not duplicate summary values on each page row.

### Filter options

Doctor and laboratory dropdowns must no longer be derived from page rows after pagination.

Use existing tenant-scoped dictionaries:

- `DoctorRepository.listDoctors()`;
- `LaboratoryWorkRepository.listLaboratories(true)`.

These include inactive historical references, which is necessary because filtering old rows by a now-inactive doctor/laboratory must remain possible.

A dedicated queue-filter-options hook is preferable to reusing a mutation-specific hook name, but it should use the same underlying repositories and must not create new backend schema.

### Page-scoped enrichment

After the page returns canonical order records:

- 001V `listPatientLabelsByIds()` hydrates only patients on the current page;
- the existing laboratory reference read hydrates only doctors/labs/work types needed by current page rows.

Thus page enrichment remains bounded by page size and frozen read models remain reusable.

### Mutation/refetch behavior

The existing mutation hook refresh callback is retained conceptually. Because edit/complete/reopen can move a row in the operational sort or remove it from the current filter, successful mutations should reset the top-level operational queue to offset 0 before the canonical refetch.

Create should likewise return to page 0.

An uncertain mutation must keep the existing exact-retry semantics and must not optimistically insert a row into page state.

### Filter/search/page state

All server-side filters and search are part of the query identity.

Changing any of these resets offset to 0:

- status;
- due;
- doctor;
- laboratory;
- search.

Changing page size also resets offset to 0.

Page navigation must never retain stale rows from a previous query identity while the new page loads.

## 001X SQL test matrix

The schema/RPC foundation task should prove at least:

1. owner/admin/doctor/registrar can read their tenant queue;
2. cashier/unsupported roles cannot;
3. cross-tenant rows are never returned;
4. page size/offset bounds are validated;
5. page 1/page 2 have deterministic non-overlapping order IDs;
6. identical sort keys fall back to deterministic `id` order;
7. status/doctor/laboratory filters run before paging;
8. overdue/today/upcoming/unscheduled use the tenant timezone correctly;
9. search finds title;
10. search finds order number;
11. search finds patient name;
12. search finds doctor name;
13. search finds laboratory name;
14. search finds work-type name without duplicating orders with multiple matching work types;
15. literal `%` and `_` are not interpreted as unbounded wildcards;
16. `totalFiltered` is correct including a zero-item offset page;
17. summary counts whole-tenant orders and is independent from page/search filters;
18. completed/in-progress operational ordering matches the accepted priority;
19. no finance/warehouse/treatment/appointment side effects;
20. existing 001N mutation RPCs remain untouched.

## Frontend decomposition after 001X

### 001Y: typed paged queue read client/hook

Data layer only:

- typed RPC page client;
- typed summary read;
- paging/filter/search query identity;
- page-scoped 001V label enrichment;
- independent queue filter options;
- stale-context reset tests;
- no UI changes.

### 001Z: queue pagination UI + real browser QA

UI task:

- wire server status/due/doctor/lab/search filters;
- 300 ms search debounce;
- page size and previous/next controls;
- show `totalFiltered`/current page information without pretending page count is whole summary;
- preserve global summary cards;
- mutation success resets to page 0 and refetches canonical state;
- real Admin/Doctor/Registrar/Cashier/Admin B browser matrix;
- mutation while on later page;
- search across patient/work-type names;
- tenant boundary;
- cleanup to zero.

## Scope boundaries

001W does not authorize:

- application code changes;
- migrations;
- database writes;
- browser automation;
- cloud Supabase;
- MacDent/amoCRM actions;
- changes to frozen laboratory mutation semantics;
- queue UI changes.

## Issues / limitations

- Offset pagination can shift under concurrent writes. The selected mitigation for the first bounded version is canonical reset-to-first-page after mutations and reset-on-filter changes. Keyset pagination can be reconsidered after real clinic volume/usage evidence.
- Cross-entity search may require performance tuning at larger tenant volumes. 001X should measure local query plans before adding indexes; 001W does not prescribe speculative trigram indexes.
- Global Hermes task policy remains shared mutable state and was overwritten by a parallel task during this reconnaissance. 001W policy was re-applied before writing this report.
- Existing unrelated React act warnings, Vite chunk-size warning and npm audit findings are baseline project issues, not pagination findings.

## Recommended Next Task

`LAB-WORK-QUEUE-PAGINATION-FOUNDATION-001X`: implement the read-only schema/RPC foundation for bounded laboratory queue paging, cross-entity search, tenant-timezone due filters, `totalFiltered`, and whole-tenant summary with local SQL/RLS tests only; no UI.
