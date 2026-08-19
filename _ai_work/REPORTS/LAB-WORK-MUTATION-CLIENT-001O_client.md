# LAB-WORK-MUTATION-CLIENT-001O — typed laboratory mutation client

## Summary

Final verdict: **PASS**

001O adds the smallest frontend/data-layer mutation boundary on top of frozen 001N. No write UI is introduced.

Accepted runtime path:

```text
current auth + active tenant
→ useLaboratoryWorkRepository selection
→ Supabase-ready only
→ useLaboratoryWorkMutations
→ LaboratoryWorkMutationRpcClient
→ frozen 001N atomic RPC
→ canonical result / bounded typed error
→ best-effort read refresh
```

There is no production local mutation fallback and no direct table write in the new mutation client.

## Branch

`feature/lab-work-mutation-client-001o`

## PR URL

https://github.com/NckNA/codex-test/pull/384

- Base: `main`.
- Baseline: `bf5a74e662ed93833fdce412b8ed0b911adb3b81`.
- Implementation commit: `1eb053f8972e45400d3eb4a05aced6f606fd0bdd`.
- Implementation CI: run `#832` / `32241681699`, **SUCCESS** on `1eb053f8972e45400d3eb4a05aced6f606fd0bdd`.
- Report update commit: N/A because a report cannot truthfully contain its own future SHA; final PR/CI evidence is persisted after publication.

## Changed files

Expected task scope:

```text
src/data/repositories/LaboratoryWorkRepository.ts
src/data/repositories/LaboratoryWorkRepository.test.ts
src/data/repositories/LaboratoryWorkMutationRpcClient.ts
src/data/repositories/LaboratoryWorkMutationRpcClient.test.ts
src/data/hooks/useLaboratoryWorkMutations.ts
src/data/hooks/useLaboratoryWorkMutations.test.tsx
_ai_work/REPORTS/LAB-WORK-MUTATION-CLIENT-001O_client.md
```

No migration, package, seed, page, component, MacDent or amoCRM file belongs to this task.

## Semantic contract

### Read model version

`LaboratoryWorkOrderRecord` now maps the 001N monotonic `mutation_version` as `mutationVersion`.

The broad legacy record property is optional only to avoid mechanically rewriting unrelated pre-001N fixture literals. Runtime Supabase mapping always supplies a numeric version; local prototype normalization also supplies/increments a version. All mutation actions require an explicit positive `expectedVersion`.

### Mutation backend selection

`useLaboratoryWorkMutations` consumes the already accepted `useLaboratoryWorkRepository` backend/tenant/user selection.

Mutation availability requires all of:

```text
backend === supabase
ready === true
tenantId present
userId present
```

An injected test RPC client cannot bypass an unavailable/local selection.

### RPC-only write boundary

`LaboratoryWorkMutationRpcClient` calls only:

```text
create_laboratory_work_order_atomic
update_laboratory_work_order_atomic
complete_laboratory_work_order_atomic
reopen_laboratory_work_order_atomic
```

The production client/hook contains no `.from(...)` direct table access and does not import `LocalStorageLaboratoryWorkRepository` or `createLaboratoryWorkRepository` for mutations.

### Stable create identity

Create uses one securely generated UUID as the stable order identity and embeds the same identity in its request ID. If the backend/transport result is uncertain, the exact captured command is retained. `retryPendingMutation()` repeats the same order ID, request ID and payload rather than generating another order.

No insecure timestamp/random fallback is used when `crypto.randomUUID()` is unavailable; creation fails closed instead.

### Existing-order concurrency

Update/complete/reopen require explicit `expectedVersion`. The typed client passes that value to frozen 001N. Known `LAB_ORDER_STALE_WRITE` errors map to a bounded stale category and trigger a best-effort refresh of canonical state.

### Error contract

Known database markers map to bounded categories:

```text
permission
stale
conflict
not_found
invalid_state
validation
operation_uncertain
```

Raw backend details are not copied into the safe user-facing message. Unknown transport/backend failures are treated as `operation_uncertain`, not as confirmed failure.

### Reconciliation behavior

- successful command: return committed canonical row and best-effort refresh;
- refresh failure after confirmed success: preserve success and expose `refreshWarning`;
- stale/conflict/not-found/invalid-state: clear retry command and best-effort refresh;
- uncertain result: retain exact captured command for safe retry;
- context switch: previous error/loading/retry indicators are hidden and retry is rejected outside the captured tenant/user context;
- concurrent second action while one is in flight: blocked before a second RPC call.

## Checks

- Targeted laboratory read/mutation suite: **6 files / 59 tests PASS**.
- Full Vitest: **124 files / 1275 tests PASS**.
- `npm run lint`: **PASS**.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- Fresh local Supabase reset on current main/0036: **PASS**.
- Production mutation client/hook direct `.from(...)` scan: **0 matches**.
- Local/legacy mutation repository import scan: **0 forbidden imports**.
- Migration/package/UI changed-file scan: **0 matches**.
- GitHub implementation CI #832: **SUCCESS**.

Initial development checks also caught and corrected three non-product-contract issues before acceptance:

1. one test helper failed to return its `.from` spy;
2. React 19 lint rejected synchronous state clearing inside an effect and ref reads during render; state was redesigned as context-gated instead of suppressing lint;
3. the project `erasableSyntaxOnly` TypeScript configuration rejected a constructor parameter property; the client now uses the same explicit field pattern as existing RPC clients.

## Live local Supabase data-layer smoke

A real local Supabase integration check was run with the standard QA Admin A account and host-injected password. No password/key was written to the repository or returned in output.

A temporary synthetic tenant-A laboratory fixture was created and the actual `SupabaseLaboratoryWorkMutationRpcClient` executed:

```text
create → update → complete → reopen
mutationVersion: 1 → 2 → 3 → 4
```

Result: **PASS 1/1**.

This proves actual RPC names, argument names, authenticated execution and composite-row mapping rather than only mocked behavior.

The temporary test file was deleted before commit. Fixture cleanup was verified:

```text
orders   0
links    0
types    0
labs     0
doctors  0
patients 0
```

## Browser smoke

**NOT REQUIRED / NOT PERFORMED.**

001O changes no page, route or component and the task policy keeps browser localhost disabled. Real browser write QA belongs to the later write-surface implementation after a dedicated UI/write RECON.

## Safety audit

- Cloud Supabase: **not touched**.
- Production writes: **none**.
- MacDent writes: **none**.
- amoCRM writes: **none**.
- Migrations: **none in 001O**.
- UI/routes/components: **unchanged**.
- Finance/warehouse/treatment/completed-service coupling: **none**.
- Hard delete: **not exposed**.
- Local mutation fallback in production hook: **none**.
- Direct table writes in new RPC client: **none**.
- Tenant/user context is inherited from the accepted 001C-style laboratory repository selection and checked before mutation.

## Issues / limitations

- No UI consumes the mutation hook yet.
- `mutationVersion` remains optional in the broad legacy record TypeScript shape for compatibility with older fixture literals; the future write UI must explicitly require a numeric version before rendering edit/complete/reopen actions.
- Exact retry of an uncertain update/complete/reopen can return a stale/state conflict if the original command actually committed. This is expected: the hook then refreshes canonical state instead of guessing success.
- Activity-feed projection for laboratory audit remains outside this task.
- Existing unrelated React `act(...)` warnings remain in the full suite.
- Vite still reports the pre-existing large-chunk warning.
- `npm ci` reports the pre-existing dependency audit state of 1 moderate and 6 high vulnerabilities; no package or lockfile change is made.

## Final verdict

```text
MUTATION VERSION READ MODEL: PASS
SUPABASE-ONLY MUTATION SELECTION: PASS
DIRECT TABLE WRITES IN NEW CLIENT: 0
ATOMIC CREATE/UPDATE/COMPLETE/REOPEN RPC MAPPING: PASS
STABLE CREATE RETRY IDENTITY: PASS
STALE/CONFLICT SAFE MAPPING + REFRESH: PASS
TENANT/USER CONTEXT GATING: PASS
REAL LOCAL SUPABASE CLIENT FLOW: PASS
UI CHANGED: NO
MIGRATIONS CHANGED: NO
001O: READY FOR FREEZE AFTER FINAL REPORT CI AND PR REVIEW
```

## Recommended next task

**LAB-WORK-MUTATION-SURFACE-RECON-001P — perform a strict report-only STUDY/RECON for the first laboratory write UI. Determine whether create/edit/complete/reopen belongs on the top-level `/laboratory` queue, patient card, or a bounded shared dialog; define patient selection, doctor/laboratory/work-type source rules, role/action visibility, fail-closed handling when `mutationVersion` is absent, stale/conflict/retry UX, post-write refresh behavior and the exact Admin/Doctor/Registrar/unsupported-role + tenant-boundary browser QA matrix. Do not change components, routes, hooks, RPCs, schema or migrations in the RECON task.**
