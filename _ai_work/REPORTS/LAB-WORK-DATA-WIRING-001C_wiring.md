# LAB-WORK-DATA-WIRING-001C — Laboratory Work Data Wiring

## 1. Final verdict

Task verdict: **LABORATORY WORK DATA WIRING IMPLEMENTED AND VERIFIED**

Machine-readable final verdict: **PASS**

DentalFlow now has a bounded tenant/auth-aware hook that selects the existing laboratory repository without introducing UI, migrations, finance, warehouse, treatment/completed-service coupling, MacDent writes or amoCRM writes.

The critical invariant is fail-closed production routing: `supabase-active` never silently falls back to localStorage while auth or tenant state is missing or loading.

## Summary

The task adds only repository-selection wiring and tests. Development remains local; production requires configured Supabase plus authenticated user and active tenant. Missing production context exposes no repository instead of silently persisting to browser localStorage.

## 2. Branch and PR

- Branch: `feature/lab-work-data-wiring-001c`.
- PR: https://github.com/NckNA/codex-test/pull/369
- Base branch: `main`.

## PR URL

https://github.com/NckNA/codex-test/pull/369
- Verified baseline: `e91681825414bfec035ef09b7f1ec39bdc4edf19`.

## 3. Implementation head reviewed before final report update

- Implementation head: `ba17d5950bf72532918c9105340602a147415c85`.
- Workflow: `CI`.
- Run number: `#784`.
- Run ID: `32219287761`.
- Conclusion: `SUCCESS`.
- Tested commit: `ba17d5950bf72532918c9105340602a147415c85`.
- Tested commit matched the implementation head exactly.

## 4. Report update commit

Report update commit: N/A because a report-only commit cannot contain its own future SHA or the CI result that tests it.

The exact final report-only commit and fresh final CI run must be recorded in the immutable finalization receipt and final task response.

## 5. Changed files

Implementation:

1. `src/data/hooks/useLaboratoryWorkRepository.ts`;
2. `src/data/hooks/useLaboratoryWorkRepository.test.tsx`.

Final task report:

3. `_ai_work/REPORTS/LAB-WORK-DATA-WIRING-001C_wiring.md`.

No migration, seed, package, lockfile, UI, finance, warehouse, treatment, completed-service, MacDent, amoCRM or environment file belongs in the final diff.

## 6. Semantic contract

### Development mode

`authMode=dev` selects the local laboratory repository. Current tenant/user identifiers are forwarded when available so local behavior remains explicit and testable.

### Production/authenticated mode

`authMode=supabase-active` selects Supabase only when all of the following are true:

- Supabase is configured;
- auth loading is complete;
- tenant loading is complete;
- an authenticated user exists;
- an active tenant exists.

If any required condition is missing, the hook returns:

- backend: `unavailable`;
- ready: `false`;
- repository: `null`.

It does not create a local fallback repository in production mode.

## 7. Causal/safety invariant

The wiring prevents this failure mode:

```text
production auth/tenant temporarily unavailable
→ localStorage fallback
→ UI later believes data was persisted to clinic storage
→ data disappears or diverges from tenant source of truth
```

Instead:

```text
production auth/tenant temporarily unavailable
→ repository unavailable
→ no persistence path exposed
```

## Checks

### Targeted suite

**PASS — 10/10 tests**

Coverage includes:

- development mode selects local backend;
- authenticated tenant/user selects Supabase;
- missing user fails closed;
- missing tenant fails closed;
- auth loading fails closed;
- tenant loading fails closed;
- missing Supabase configuration fails closed;
- repository factory receives development context;
- repository factory receives tenant/user production context;
- production missing-tenant state never instantiates local storage.

### Full quality gate

- `npm run lint`: **PASS**;
- full Vitest: **PASS — 116 files / 1212 tests**;
- `npm run build`: **PASS**;
- `git diff --check`: **PASS**;
- forbidden-coupling scan: **PASS / no matches**.

### GitHub CI

Implementation head `ba17d5950bf72532918c9105340602a147415c85` passed CI run `32219287761` / `#784`:

- Merge guard: success;
- ESLint: success;
- Tests: success;
- Build: success.

## 9. Browser smoke

**NOT REQUIRED**

Reason: this task adds only repository-selection data wiring and unit tests. It changes no route, page, component or visible browser workflow.

## 10. Scope audit

```text
UI CHANGES: 0
MIGRATIONS: 0
CLOUD SUPABASE WRITES DURING TASK: 0
MACDENT WRITES: 0
AMOCRM WRITES: 0
FINANCE COUPLING: 0
WAREHOUSE COUPLING: 0
TREATMENT/COMPLETED-SERVICE COUPLING: 0
SILENT PRODUCTION LOCALSTORAGE FALLBACK: BLOCKED
```

## 11. Issues / limitations

- Existing React `act(...)` warnings remain baseline warnings and are unrelated to this task.
- `npm ci` reports 7 pre-existing dependency vulnerabilities: 1 moderate and 6 high. No package or lockfile change was made because dependency remediation is outside this bounded task.
- No patient-facing laboratory UI is introduced here.
- No new laboratory mutations are exposed by this hook beyond the existing repository contract.

## 12. Recommended next task

`LAB-WORK-PATIENT-READ-001D` — add the smallest read-only patient-scoped laboratory-work query hook that consumes `useLaboratoryWorkRepository`, with unit tests only.

Keep out of scope:

- visual UI;
- create/update/delete actions from the patient surface;
- finance;
- warehouse;
- treatment/completed-service coupling;
- MacDent mutations;
- amoCRM mutations.
