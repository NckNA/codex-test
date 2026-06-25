# HERMES-ROADMAP-CHECKPOINT-001

Status: refreshed roadmap checkpoint  
Type: report-only / architecture checkpoint  
Refreshed: 2026-06-25 Asia/Almaty  
Workspace root: `D:\hermes`  
Repository context: `D:\hermes\codex-test`  
Primary HEP branch checked: `feature/hermes-maintenance-trio-002-finalize`  
Pre-refresh HEAD observed: `750b9110c1f3ef3a9f6206e12ec3b837b59b53c4`  
Policy used for this refresh: `HERMES-ROADMAP-CHECKPOINT-001`, report-only, local-only, no app code, no migrations, no cloud Supabase.

This document is the long-memory checkpoint for Hermes / HEP / DentalFlow. It exists so future sessions do not rebuild the ship from scraps, screenshots, and human optimism.

---

## 0. Executive verdict

The earlier checkpoint was useful but stale. It captured the broad 40+ layer map, but its implementation status lagged behind the current HEP branch.

Current reality:

- Hermes bridge is reachable.
- `D:\hermes` governance zones exist.
- `D:\hermes\codex-test` is a clean Git repo on the active HEP branch before this report refresh.
- Several layers previously marked as pending are now present locally as HEP modules and tests.
- The roadmap still needs separation between implemented-local, active-next, and future strategic layers.
- HEP safety/governance work and DentalFlow product/UI work must remain separate branches and policies.

Main architectural correction:

Hermes is not the brain by itself. Hermes is the ship, control panel, registries, safety systems, logs, gates, and mission discipline. Agents are the crew. Without gates, agents become chaos with keyboard access. Without agents, Hermes is a very organized empty hull.

---

## 1. Current observed workspace state

### 1.1 Hermes bridge and workspace

- Hermes CLI reachable.
- Workspace root: `D:\hermes`.
- All core governance zones are present:
  - `core`
  - `projects`
  - `worktrees`
  - `worktrees/active`
  - `worktrees/archived`
  - `reports`
  - `reports/active`
  - `reports/archived`
  - `reports/indexes`
  - `policies`
  - `policies/active`
  - `policies/archived`
  - `memory`
  - `backups`
  - `temp`
  - `logs`
  - `agents`

### 1.2 Current local Git / branch state before this report edit

- Repo: `D:\hermes\codex-test`
- Branch: `feature/hermes-maintenance-trio-002-finalize`
- HEAD before refresh: `750b9110c1f3ef3a9f6206e12ec3b837b59b53c4`.
- Working tree before refresh: clean.
- `origin/main` observed at `258e3174ea7c22a0e7f8f5c35089fde9225a84df`.

Important distinction:

- Many HEP layers are implemented in the active local HEP branch.
- That does not automatically mean every HEP layer is merged to `main`.
- Future agents must state whether they mean `implemented locally`, `committed on HEP branch`, `pushed`, `PR opened`, or `merged to main`.

### 1.3 Root workspace cleanup candidates

The workspace audit found several non-zone root folders:

- `D:\hermes\moltbook-hermes`
- `D:\hermes\quarantine`
- `D:\hermes\super-hermes-check`
- `D:\hermes\tasks`

Decision:

- Do not delete.
- Do not move automatically.
- Classify later through an explicit cleanup/inventory task.
- Human approval alone is not enough for protected or destructive cleanup.

---

## 2. Architecture model: Hermes as ship

The correct model has these layers:

1. Hull / workspace zones
   - `core`, `projects`, `worktrees`, `reports`, `memory`, `policies`, `backups`, `logs`, `agents`.

2. Navigation / mission
   - Mission Control, Mission Queue, task order, stop conditions.

3. Law / safety constitution
   - Guardian ACL, Dependency Guard, Hazard Registry, Decision Gateway, Decision Policy.

4. Property / asset governance
   - Asset Registry, Asset Ownership, Owner Approval, Asset Lease, Asset Lifecycle.

5. Change discipline
   - Change Plan, Changeset Registry, Rollback Contract, Rollback Verify.

6. Exceptions
   - Waiver Registry, waiver verification, high-risk waiver gates.

7. Crew management
   - Agent capability matrix, agent reputation, worker scheduler, handoff protocol.

8. Memory and knowledge
   - Memory tiers, knowledge index, report index, lessons registry.

9. Product work
   - DentalFlow UI/backend/schema tasks, finance flows, timeline, stock, audit logs.

10. Host safety
   - Windows/storage/disk health/backup/restore/security triage.

The key rule: do not put all of this into one giant task. That is not architecture. That is a ceremonial bonfire for future debugging.

---

## 3. Completed / implemented HEP foundation in active HEP branch

These layers are treated as completed or locally implemented in the active HEP branch, based on current repo tree, reports, registries, and recent commit history.

### 3.1 Foundation and maintenance spine

1. `HERMES-MAINTENANCE-TRIO-001`
2. `HERMES-MAINTENANCE-TRIO-002`
3. `HERMES-GOVERNANCE-LIFECYCLE-001`
4. `HERMES-REPORTS-INDEX-001`
5. `HERMES-GUARDIAN-ACL-001`
6. `HERMES-DEPENDENCY-GUARD-001C`
7. `HERMES-MAINTENANCE-AUTOPILOT-001B`
8. `HERMES-EVENT-LOG-001`
9. `HERMES-OBSERVABILITY-001`
10. `HERMES-HEP-LINE-RECONCILE-001`
11. `HERMES-EVENT-LOG-CLI-WIRE-001`
12. `HERMES-HAZARD-REGISTRY-001`
13. `HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001`
14. `HERMES-DECISION-GATEWAY-001`
15. `HERMES-DECISION-POLICY-001`
16. `HERMES-ASSET-REGISTRY-001`

Meaning:

- Guardian ACL checks actor/action/target permissions.
- Dependency Guard checks impact and dependency signals.
- Hazard Registry stores known hazards and blockers.
- Event Log records task and decision events.
- Observability summarizes denials, escalations, reports, failures, and missing modules.
- Guardrail Blocker writes blocker reports when safe execution is impossible.
- Decision Gateway aggregates safety signals.
- Decision Policy applies rule precedence.
- Asset Registry identifies assets, criticality, and protection.

### 3.2 Asset / ownership / exception layers now present locally

The previous checkpoint marked these as future or pending. Current local branch shows them as present as modules/tests or runtime registry structures:

1. `HERMES-ASSET-OWNERSHIP-001`
   - `tools/hep/asset-ownership.ts`
   - `tools/hep/__tests__/asset-ownership.test.ts`
   - runtime ownership registry exists under `D:\hermes\memory\ownership\ownership-registry.json`

2. `HERMES-WAIVER-REGISTRY-001`
   - `tools/hep/waiver-registry.ts`
   - `tools/hep/__tests__/waiver-registry.test.ts`
   - runtime waiver folder exists under `D:\hermes\memory\waivers`

3. `HERMES-ROLLBACK-CONTRACT-001`
   - `tools/hep/rollback-contract.ts`
   - `tools/hep/__tests__/rollback-contract.test.ts`
   - runtime rollback folder exists under `D:\hermes\memory\rollback`

4. Waiver / rollback reference hardening
   - waiver rollback reference CLI/task exists in reports
   - rollback verification task exists in reports
   - high-risk waiver verification behavior appears in recent HEP commit history

Important correction:

These are no longer just future ideas. They are implemented enough to be treated as part of the current local HEP spine, but they still need merge/PR status clarity and quality verification before being called production-stable.

### 3.3 Change and policy layers now present locally

1. `HERMES-BLOCKER-ROOT-CAUSE-001`
2. `HERMES-POLICY-SIMULATOR-001`
3. `HERMES-CHANGE-PLAN-001`
4. `HERMES-CHANGESET-REGISTRY-001`
5. Changeset-to-decision-gateway integration
6. Task status snapshot / governance PR prep layers

Observed files include:

- `tools/hep/blocker-root-cause.ts`
- `tools/hep/change-plan.ts`
- `tools/hep/changeset-registry.ts`
- matching test files under `tools/hep/__tests__`

Status:

- Treat as local implemented HEP layers.
- Do not assume merged to `main` without checking PR/merge metadata.

### 3.4 Mission / self-improvement modules now present locally

Observed files include:

- `tools/hep/mission-control.ts`
- `tools/hep/__tests__/mission-control.test.ts`
- `tools/hep/self-improvement-gate.ts`
- `tools/hep/__tests__/self-improvement-gate.test.ts`
- runtime self-improvement registry under `D:\hermes\memory\self-improvement\self-improvement-registry.json`

Interpretation:

- `HERMES-MISSION-CONTROL-001` has at least a local module/test foundation.
- `HERMES-SELF-IMPROVEMENT-GATE-001` has at least a local module/test foundation.
- Strategic self-improvement is still not “free autonomy”. It must remain gated by ownership, waiver, rollback, mission alignment, policy, tests, reports, and clean Git state.

---

## 4. Active next HEP queue

This is the practical next queue after the current local implementation state. These are not all new features; several are hardening, reconciliation, or merge-readiness tasks.

### 4.1 `HERMES-GOVERNANCE-PR-PREP-001`

Purpose:

Prepare the HEP governance branch for PR/merge review.

Required outputs:

- current branch and HEAD
- PR status or draft PR status
- changed file summary
- verification report
- CI status if available
- explicit note whether HEP stack is merged to `main`

Why:

The local branch contains many HEP layers. Until merge/PR state is clean, future agents may confuse “exists locally” with “available on main”. Humans do this too, then blame the tooling. Charming tradition.

### 4.2 `HERMES-ROADMAP-CHECKPOINT-001`

Purpose:

Keep this document current.

Rules:

- Update after major HEP roadmap changes.
- Separate local implementation, merged implementation, active next, and future layers.
- Never mix DentalFlow product backlog with HEP safety backlog without labels.

### 4.3 `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`

Priority: very high for DentalFlow UI work.

Problem:

UI/product tasks currently hit policy risk when `appCodeChanges=false` or `gitMode=report_only` is inferred.

Goal:

Permit explicit UI/app tasks to set `appCodeChanges=true` only with strict allowlists.

Requirements:

- task type must explicitly be `ui` or `app`
- allowed file paths/directories must be explicit
- HEP files forbidden unless HEP task
- migrations forbidden unless schema/cloud task
- generated types forbidden unless explicit
- package files forbidden unless explicit
- cloud Supabase forbidden unless explicit cloud task
- report path required
- smoke/check profile required

### 4.4 `HERMES-HUMAN-APPROVAL-CONSTRAINTS-001`

Purpose:

Formalize the core rule:

- human approval confirms intent
- human approval does not disable safety
- human approval is not root override
- critical/protected destructive actions remain `DENY` unless a bounded waiver/owner/rollback path allows safe exception handling

This rule already exists conceptually and in ownership logic, but deserves a dedicated hardening layer because humans keep trying to solve safety with “ну я же разрешил”. No, that is not a security model. That is a confession.

### 4.5 `HERMES-ROLLBACK-VERIFY-001`

Purpose:

Prove rollback plans work.

Required:

- verify rollback procedure
- record rollback evidence
- connect rollback evidence to changeset
- block high-risk changes when rollback is only theoretical

### 4.6 `HERMES-REPORT-QUALITY-GATE-001`

Purpose:

Accept reports only if they contain:

- taskId
- branch
- commit hash
- changed files
- checks
- smoke or reason no smoke was run
- blockers/limitations
- clean/dirty Git state
- recommended next task

### 4.7 `HERMES-TASK-TEMPLATE-REGISTRY-001`

Purpose:

Standard task templates for:

- HEP report-only
- HEP tooling code
- DentalFlow frontend UI
- backend repository/client
- schema/migration
- cloud migration apply
- browser QA
- finance workflow
- host cleanup

### 4.8 `HERMES-AGENT-HANDOFF-PROTOCOL-001`

Purpose:

Make handoffs between ChatGPT, Hermes_S, Codex, Google/Gemini, and humans structured.

Handoff must include:

- taskId
- branch
- commit
- status
- changed files
- blockers
- tests
- smoke
- next step

---

## 5. Future HEP roadmap layers

### 5.1 Asset governance

- `HERMES-ASSET-INVENTORY-001`
- `HERMES-ASSET-LEASE-001`
- `HERMES-ASSET-LIFECYCLE-001`
- `HERMES-OWNER-APPROVAL-FLOW-001`

Purpose:

Move from “we know some assets” to “we can discover, classify, lease, protect, and lifecycle assets without agents trampling each other”.

### 5.2 Mission / scheduling / workforce

- `HERMES-MISSION-QUEUE-001`
- `HERMES-WORKER-SCHEDULER-001`
- `HERMES-AGENT-REPUTATION-001`
- `HERMES-AGENT-CAPABILITY-MATRIX-001`

Purpose:

Route tasks to the right worker based on capability, risk, reputation, permissions, and availability.

### 5.3 Memory / knowledge

- `HERMES-MEMORY-TIERS-001`
- `HERMES-KNOWLEDGE-INDEX-001`
- `HERMES-LESSONS-REGISTRY-001`
- `HERMES-MEMORY-COMPACTION-001`

Purpose:

Make Hermes remember facts in the right tier instead of relying on chat context, which is basically building a railway on fog.

### 5.4 Risk and safety gates

- `HERMES-RISK-SCORING-001`
- `HERMES-FAILURE-BUDGET-001`
- `HERMES-DRY-RUN-SANDBOX-001`
- `HERMES-CI-GATEWAY-001`
- `HERMES-PR-REVIEW-GATE-001`
- `HERMES-SECURITY-SCAN-GATE-001`
- `HERMES-SECRET-SCAN-GATE-001`
- `HERMES-DATA-BOUNDARY-GATE-001`
- `HERMES-BROWSER-QA-GATE-001`

Purpose:

Make risky work provably bounded before it touches code, patient data, secrets, cloud, storage, or browser automation.

### 5.5 Host / Windows / storage

- `HERMES-HOST-HEALTH-GATE-001`
- `HERMES-DISK-SAFETY-GATE-001`
- `HERMES-BACKUP-REGISTRY-001`
- `HERMES-RESTORE-DRILL-001`

Purpose:

Use host condition as a safety signal.

Known host facts:

- `D:` is the main healthy Kingston SSD.
- `E:` / `G:` are risky/disposable after media rescue.
- `D:\MEDIA_RESCUE_FROM_TOSHIBA` is protected personal media.
- Windows remains low-trust due to prior Defender/exclusion/suspicious-tool context.

### 5.6 Observability / audit / reports

- `HERMES-OBSERVABILITY-DASHBOARD-001`
- `HERMES-AUDIT-TRAIL-HARDENING-001`
- `HERMES-REPORT-QUALITY-GATE-001`

Purpose:

Make reports and events hard to fake, easy to inspect, and useful for future routing.

---

## 6. DentalFlow product roadmap

DentalFlow tasks are product work, not HEP governance work. They must not be mixed into HEP branches.

### 6.1 Immediate product queue

1. `PATIENT-FINANCE-UI-001`
2. `CASHIER-PAYMENT-FLOW-001`
3. `COMPLETED-SERVICES / performed works` finance integration
4. `TIMELINE` integration
5. `PAYMENTS-DEBTS` continuation
6. `STOCK / materials` later
7. `AUDIT-ACTIVITY-LOG` layers
8. `ROLE-LABEL / permissions polish`

### 6.2 Finance rules that must not be broken

- Completed service is not payment.
- Invoice is not payment.
- Payment is not treatment completion.
- Allocation explains where money went.
- `patients.balance` is not finance source of truth.
- Finance reads go through repository/client boundaries.
- Finance writes go through controlled RPC client boundaries.
- No direct table writes from finance UI components.
- No raw RPC calls from finance UI components.

### 6.3 `PATIENT-FINANCE-UI-001` strict scope

Allowed purpose:

- patient finance tab UI
- finance summary
- invoices
- invoice items
- payments
- allocations
- draft invoice
- add invoice item
- issue invoice
- record payment
- allocate payment
- admin void actions
- role-based UI boundaries

Must not touch:

- migrations
- SQL/RPC
- seed
- generated types
- HEP files
- stock
- documents
- timeline
- refunds/write-offs
- reports UI

Blocker:

- Must complete or activate `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001` first so UI tasks can safely receive `appCodeChanges=true` with allowlists.

---

## 7. Known blockers and risks

### 7.1 Status drift

The old checkpoint existed but was stale. This is dangerous because agents may downgrade implemented layers to “future” or reimplement what already exists.

Mitigation:

- Use this refreshed checkpoint.
- Future agents must check repo tree and Git history before claiming a task is pending.

### 7.2 Local branch versus main

Many HEP layers are on active local HEP branch. Main may not include them.

Mitigation:

- Always report branch and HEAD.
- Always say whether a layer is local, committed, pushed, PR-open, or merged.

### 7.3 UI policy blocker

DentalFlow UI work needs app-code permission. Without it, Hermes_S protects the project but cannot productively modify app files.

Mitigation:

- Do `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001` before `PATIENT-FINANCE-UI-001`.

### 7.4 Root-level workspace clutter

There are still root-level project/worktree-like folders.

Mitigation:

- No deletion.
- Use inventory/classification task.
- Migrate only through explicit move/archive task.

### 7.5 Human override confusion

Human approval can confirm intent, but it must not override hard DENY rules.

Mitigation:

- Hard-code this as `HERMES-HUMAN-APPROVAL-CONSTRAINTS-001` and keep it in Decision Policy / Ownership / Waiver layers.

---

## 8. Permanent invariants

These rules must survive chat resets, branch switches, and whatever tragic ritual humans call “just a quick change”.

1. Human approval is not root override.
2. Owner approval is not universal override.
3. Critical/protected destructive actions default to `DENY`.
4. Waivers must be task-bound, scoped, expiring, auditable, and rollback-linked.
5. HEP tasks and DentalFlow UI/product tasks must not be mixed in one branch.
6. UI/app tasks require explicit `appCodeChanges=true` and strict allowlist.
7. No cloud Supabase unless explicit cloud task.
8. No migrations unless explicit schema/migration task.
9. No generated types committed unless explicitly allowed.
10. No package file edits unless explicitly allowed.
11. No direct table writes from finance UI components.
12. No raw RPC calls from finance UI components.
13. Finance reads and writes must respect repository/RPC client boundaries.
14. `patients.balance` is not finance source of truth.
15. Completed service is not payment.
16. Invoice is not payment.
17. Payment is not treatment completion.
18. Allocation explains where money went.
19. Any agent output must include commit hash, changed files, checks, smoke, and clean status.
20. If blocked, write a blocker report instead of guessing or bypassing.
21. Do not leave dirty repo behind.
22. Do not delete or move protected media, memory, policies, worktrees, `.git`, `.env`, migrations, or project roots without explicit scoped task and safety path.
23. Browser QA is useful but must be task-scoped and not run against stale localhost servers.
24. Cloud data and patient data require explicit boundary checks.

---

## 9. Recommended implementation sequence

### Path A: make Hermes governance merge-ready

1. `HERMES-GOVERNANCE-PR-PREP-001`
2. Verify current HEP branch against `main`
3. Produce PR report with changed files, tests, CI/smoke status
4. Merge or explicitly keep as HEP branch
5. Update roadmap after merge result

### Path B: unlock DentalFlow product work

1. `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`
2. `PATIENT-FINANCE-UI-001`
3. `CASHIER-PAYMENT-FLOW-001`
4. Completed-services finance integration
5. Timeline integration
6. Stock/material boundary

### Path C: strengthen self-improvement safely

1. `HERMES-HUMAN-APPROVAL-CONSTRAINTS-001`
2. `HERMES-ROLLBACK-VERIFY-001`
3. `HERMES-REPORT-QUALITY-GATE-001`
4. `HERMES-RISK-SCORING-001`
5. `HERMES-FAILURE-BUDGET-001`
6. `HERMES-AGENT-CAPABILITY-MATRIX-001`
7. `HERMES-WORKER-SCHEDULER-001`

### Path D: host safety

1. `HERMES-HOST-HEALTH-GATE-001`
2. `HERMES-DISK-SAFETY-GATE-001`
3. `HERMES-BACKUP-REGISTRY-001`
4. `HERMES-RESTORE-DRILL-001`

---

## 10. Final checkpoint verdict

This checkpoint now reflects the current larger Hermes architecture more accurately than the previous stale version.

Verdict: `ROADMAP CHECKPOINT REFRESHED`

Scope of this refresh:

- report/document only
- no app code changes
- no migrations
- no cloud Supabase
- no browser smoke
- no destructive file operations
