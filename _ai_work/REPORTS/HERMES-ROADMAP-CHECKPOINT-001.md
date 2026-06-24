# HERMES-ROADMAP-CHECKPOINT-001

Status: checkpoint / roadmap capture  
Type: report-only  
Repository context: `D:\hermes\codex-test`  
Primary HEP branch: `feature/hermes-maintenance-trio-002-finalize`  
Last confirmed HEP commit: `265d2ac feat(hep): add asset registry`  

This checkpoint records the current Hermes / DentalFlow roadmap so future task sessions do not lose the broader 40+ layer plan.

---

## 1. Current confirmed foundation

The following HEP foundation layers have been completed or accepted in this session history:

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

Current foundation meaning:

- Guardian ACL checks actor/action/target permission.
- Dependency Guard checks paths, dependencies, and impact signals.
- Hazard Registry stores known risks and prior blockers.
- Event Log records task and decision events.
- Observability summarizes failures, denied actions, escalations, reports, and missing modules.
- Guardrail Blocker writes blocker reports when work cannot proceed safely.
- Decision Gateway collects signals and produces decisions.
- Decision Policy evaluates rules and precedence.
- Asset Registry identifies what a target is, how critical it is, and how protected it is.

---

## 2. Active / nearest HEP tasks

### 2.1 `HERMES-ASSET-OWNERSHIP-001`

Status: pending / not implemented  
Priority: high  
Type: HEP foundation / asset governance

Purpose:

Asset Registry answers: what is this target?  
Asset Ownership must answer: who is responsible for it and who may approve or perform actions?

Core principle:

- Human approval is not root access.
- Owner approval is not a universal override.
- Critical/protected destructive actions remain `DENY` until a future Waiver Registry exists.

Expected outputs:

- `tools/hep/asset-ownership.ts`
- `tools/hep/__tests__/asset-ownership.test.ts`
- Gateway integration with `ownershipSignal`
- Decision Policy ownership rules
- CLI commands: `ownership-init`, `ownership-list`, `ownership-see`, `ownership-check`
- Runtime ownership registry: `D:\hermes\memory\assets\asset-ownership.json`
- Runtime events: `D:\hermes\logs\assets\asset-ownership-events.jsonl`

Known issue:

A local Hermes_S attempt was blocked by safety layer while writing/integrating the module. The partial changes were manually cleaned up. Repo returned to clean state.

Recommended executor:

- Google/Gemini or Codex when available.
- Hermes_S may still hit write/integration guardrails.

---

### 2.2 `HERMES-WAIVER-REGISTRY-001`

Status: future after Ownership  
Priority: high  
Type: HEP safety / bounded exceptions

Purpose:

Create a strict, auditable exception mechanism for risky actions.

Waiver must not mean simple human approval.

Required waiver fields:

- `taskId`
- `assetId` or `hazardId`
- `action`
- `target`
- `scope`
- `reason`
- `expiresAt`
- `allowedFiles` / `allowedTargets`
- `rollbackPlan`
- `owner` / `reviewer`
- explicit confirmation phrase
- audit event id

Rules:

- Waiver can narrow a permission, not disable safety globally.
- Critical/protected destructive actions remain denied until this layer explicitly defines safe exception handling.
- Waiver must expire.
- Waiver must be task-bound.

---

### 2.3 `HERMES-ROLLBACK-CONTRACT-001`

Status: future  
Priority: high  
Type: HEP safety / reversibility

Purpose:

Every non-trivial change must have an explicit rollback path.

Required model:

- changed files
- expected changed files
- rollback command or revert procedure
- verification after rollback
- backup/snapshot pointer if needed
- no rollback of protected user data without explicit support

Why:

Safe self-improvement is impossible if the system can change itself but cannot reliably return to the previous safe state.

---

### 2.4 `HERMES-MISSION-CONTROL-001`

Status: future  
Priority: high  
Type: HEP coordination / goal control

Purpose:

Define the active mission before agents perform work.

Mission must define:

- current objective
- allowed task families
- forbidden task families
- active constraints
- task order
- stop conditions
- owner/reviewer

Why:

Without mission alignment, agents may improve random files just because they found them. That is not autonomy; it is wandering with admin rights.

---

### 2.5 `HERMES-SELF-IMPROVEMENT-GATE-001`

Status: strategic future  
Priority: high but not now  
Type: HEP self-modification gate

Purpose:

Create the final gate that decides whether Hermes may modify its own HEP systems.

Prerequisites:

- Asset Registry
- Asset Ownership
- Waiver Registry
- Rollback Contract
- Mission Control
- Observability
- CI/test gate
- report gate

Must check:

- asset criticality
- ownership
- policy
- waiver if needed
- rollback plan
- mission alignment
- tests
- report
- clean git state

---

## 3. Policy / permission infrastructure tasks

### 3.1 `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`

Status: discovered blocker  
Priority: high for app/UI tasks  
Type: HEP policy parser / permission model

Discovered during attempt to prepare `PATIENT-FINANCE-UI-001`.

Problem:

The UI task needed frontend/app changes, but active policy inference produced:

- `gitMode: report_only`
- `gitCodeChanges: false`
- `appCodeChanges: false`
- risk flags including code-change denial

Even though the task itself was a UI implementation task.

Goal:

Teach task policy layer to safely issue `appCodeChanges=true` for explicit app/UI tasks with strict file allowlists.

Requirements:

- taskType must be `ui` or `app`
- explicit allowed file paths or directories
- migrations forbidden unless task is schema/cloud
- HEP files forbidden unless HEP task
- generated types forbidden unless explicit
- package files forbidden unless explicit
- cloud Supabase forbidden unless cloud task
- report must be allowed

Why:

Without this, Hermes can protect code but cannot safely change product UI. A locked toolbox is safe but not useful.

---

### 3.2 `HERMES-POLICY-SIMULATOR-001`

Status: future  
Priority: medium-high  
Type: policy tooling

Purpose:

Simulate decisions before applying a task policy.

Input:

- task spec
- proposed changed files
- actor
- action
- target

Output:

- predicted allow/deny/escalate
- reasons
- matched policy rules
- missing permissions
- required task scope changes

Why:

Avoid starting a task only to discover halfway that the active policy cannot permit the required work.

---

### 3.3 `HERMES-TASK-TEMPLATE-REGISTRY-001`

Status: future  
Priority: medium  
Type: task policy standardization

Purpose:

Create standard templates for common task families:

- HEP report-only
- HEP tooling code
- frontend UI
- backend repository/client
- schema/migration
- cloud migration apply
- browser QA
- finance workflow
- host cleanup

Each template should define:

- allowed files
- forbidden files
- default policy
- required checks
- required report fields
- smoke expectations

---

## 4. Asset lifecycle / governance future layers

### 4.1 `HERMES-ASSET-INVENTORY-001`

Status: optional future  
Priority: medium  
Type: HEP asset discovery

Purpose:

Scan workspace/repo/runtime and propose missing asset records.

Should discover:

- HEP modules
- runtime memory files
- logs
- report indexes
- worktrees
- protected external folders
- app roots
- cloud config references

Important:

Inventory proposes records only. No auto-delete, auto-archive, or auto-move.

---

### 4.2 `HERMES-ASSET-LEASE-001`

Status: future  
Priority: medium  
Type: asset concurrency control

Purpose:

Prevent multiple agents/tasks from modifying the same asset at the same time.

Lease fields:

- assetId
- taskId
- actor
- leaseType: read/write/exclusive
- expiresAt
- reason
- heartbeat

---

### 4.3 `HERMES-ASSET-LIFECYCLE-001`

Status: future  
Priority: medium  
Type: asset lifecycle management

Purpose:

Formalize lifecycle states:

- active
- protected
- archive_candidate
- archived
- deprecated
- quarantined
- unknown

No lifecycle transition should happen without policy, owner, and event log.

---

### 4.4 `HERMES-OWNER-APPROVAL-FLOW-001`

Status: future after Ownership  
Priority: medium-high  
Type: approval workflow

Purpose:

Turn ownership metadata into actual approval workflow.

Owner approval should be scoped, logged, and limited. It must not override critical safety automatically.

---

## 5. Change management future layers

### 5.1 `HERMES-CHANGE-PLAN-001`

Status: future  
Priority: high  
Type: planning gate

Purpose:

For non-trivial changes, require a structured change plan before implementation.

Plan fields:

- taskId
- intent
- affected assets
- expected changed files
- forbidden files
- risks
- rollback plan
- validation plan
- smoke plan

---

### 5.2 `HERMES-CHANGESET-REGISTRY-001`

Status: future  
Priority: medium-high  
Type: change tracking

Purpose:

Track each change set across implementation, tests, report, commit, and smoke.

Fields:

- taskId
- branch
- commit
- changed files
- tests run
- smoke results
- report path
- rollback pointer
- decision events

---

### 5.3 `HERMES-ROLLBACK-VERIFY-001`

Status: future after Rollback Contract  
Priority: medium-high

Purpose:

Prove rollback actually works, not just that someone wrote a poetic rollback plan.

---

## 6. Agent governance future layers

### 6.1 `HERMES-AGENT-REPUTATION-001`

Status: future  
Priority: medium-high

Purpose:

Track agent reliability.

Subjects:

- Codex
- Google/Gemini
- Hermes_S
- manual human
- future workers

Metrics:

- successful tasks
- scope violations
- dirty repo left behind
- failed tests
- blocked attempts
- rollback required
- hidden assumptions
- report quality

Rule:

Repeated failures should reduce future permissions.

---

### 6.2 `HERMES-AGENT-CAPABILITY-MATRIX-001`

Status: future  
Priority: medium

Purpose:

Record what each agent can safely do.

Examples:

- Google/Gemini: broad implementation with detailed plan, must be verified
- Codex: best for code work when available
- Hermes_S: good for audit, read, report, controlled checks, but can hit safety write blocks
- human: can approve intent but is not root override

---

### 6.3 `HERMES-WORKER-SCHEDULER-001`

Status: future  
Priority: medium

Purpose:

Route tasks to the right worker based on scope, risk, and availability.

Inputs:

- task type
- risk
- required permissions
- active agent availability
- reputation
- expected runtime

---

### 6.4 `HERMES-AGENT-HANDOFF-PROTOCOL-001`

Status: future  
Priority: medium

Purpose:

Standardize how tasks pass from one agent to another.

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

## 7. Memory / knowledge future layers

### 7.1 `HERMES-MEMORY-TIERS-001`

Status: future  
Priority: medium-high

Purpose:

Separate memory into tiers:

- runtime facts
- task reports
- hazards
- assets
- policies
- long-term knowledge
- user/project preferences

---

### 7.2 `HERMES-KNOWLEDGE-INDEX-001`

Status: future  
Priority: medium

Purpose:

Index reports, decisions, hazards, assets, and task history for retrieval.

Should answer:

- what has been done?
- what failed?
- what tasks are next?
- what files are risky?
- what rules apply?

---

### 7.3 `HERMES-MISSION-QUEUE-001`

Status: future  
Priority: medium

Purpose:

Maintain ordered mission tasks with dependencies.

---

## 8. Risk / safety gate future layers

### 8.1 `HERMES-RISK-SCORING-001`

Status: future  
Priority: medium-high

Purpose:

Compute risk score from signals:

- asset criticality
- action type
- actor reputation
- dependency impact
- hazards
- policy mismatch
- ownership
- rollback availability

---

### 8.2 `HERMES-FAILURE-BUDGET-001`

Status: future  
Priority: medium-high

Purpose:

Limit how many failures/escalations/denies an agent or task can accumulate before permissions are reduced or work stops.

---

### 8.3 `HERMES-DRY-RUN-SANDBOX-001`

Status: future  
Priority: medium-high

Purpose:

Give agents a safe preview environment before real writes.

---

### 8.4 `HERMES-CI-GATEWAY-001`

Status: future  
Priority: medium

Purpose:

Treat CI results as a formal decision signal.

---

### 8.5 `HERMES-PR-REVIEW-GATE-001`

Status: future  
Priority: medium

Purpose:

Require PR review signals before merge or before certain high-risk tasks are accepted.

---

### 8.6 `HERMES-SECURITY-SCAN-GATE-001`

Status: future  
Priority: medium-high

Purpose:

Integrate dependency/security scanning as a decision signal.

---

### 8.7 `HERMES-SECRET-SCAN-GATE-001`

Status: future  
Priority: high

Purpose:

Block commits/reports that expose secrets, tokens, credentials, or local sensitive config.

---

### 8.8 `HERMES-DATA-BOUNDARY-GATE-001`

Status: future  
Priority: high

Purpose:

Enforce boundaries for user data, patient data, protected media, logs, and cloud data.

---

### 8.9 `HERMES-HUMAN-APPROVAL-CONSTRAINTS-001`

Status: future  
Priority: high

Purpose:

Formalize that human approval is not root override.

Rules:

- human may confirm intent
- human may request escalation
- human cannot automatically downgrade critical risk
- critical/protected destructive actions need waiver/owner/rollback, not just chat approval

---

## 9. Host / storage / backup future layers

### 9.1 `HERMES-HOST-HEALTH-GATE-001`

Status: future  
Priority: medium-high

Purpose:

Use host health as a decision signal.

Inputs:

- disk health
- free space
- Defender status
- suspicious tools
- backup availability
- power/runtime state

---

### 9.2 `HERMES-DISK-SAFETY-GATE-001`

Status: future  
Priority: high

Purpose:

Prevent risky actions on unstable disks, protected media folders, and low-free-space volumes.

---

### 9.3 `HERMES-BACKUP-REGISTRY-001`

Status: future  
Priority: high

Purpose:

Track backups and snapshots.

Fields:

- assetId
- backupPath
- createdAt
- verifiedAt
- restoreProcedure
- retention

---

### 9.4 `HERMES-RESTORE-DRILL-001`

Status: future  
Priority: medium-high

Purpose:

Periodically test that backups can actually restore.

---

## 10. Observability / reports future layers

### 10.1 `HERMES-OBSERVABILITY-DASHBOARD-001`

Status: future  
Priority: medium

Purpose:

Make observability readable as a dashboard, not only JSON/Markdown snapshots.

---

### 10.2 `HERMES-AUDIT-TRAIL-HARDENING-001`

Status: future  
Priority: medium-high

Purpose:

Make audit/event trails harder to corrupt or silently edit.

---

### 10.3 `HERMES-REPORT-QUALITY-GATE-001`

Status: future  
Priority: medium

Purpose:

Validate reports before accepting tasks.

Checks:

- taskId present
- changed files listed
- checks listed
- smoke listed
- blockers listed
- no contradictions
- no stale PR/CI metadata

---

## 11. DentalFlow product backlog

### 11.1 `PATIENT-FINANCE-UI-001`

Status: pending / not implemented  
Priority: medium-high  
Type: DentalFlow frontend UI

Purpose:

Add patient card finance tab for:

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

Known current state:

- Patient card already has a `finance` tab label `Финансы`.
- It currently points to a placeholder / in-development panel.
- Backend finance schema/repository/RPC/client already exist.

Known blocker for Hermes_S:

- UI task policy did not grant `appCodeChanges=true`.
- Separate app-code policy permission task is needed before Hermes_S can safely implement this.

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

---

### 11.2 `CASHIER-PAYMENT-FLOW-001`

Status: future after Patient Finance UI  
Priority: medium

Purpose:

Dedicated cashier workflow for payments and allocations.

Do not start before `PATIENT-FINANCE-UI-001` is complete.

---

### 11.3 Completed services / finance integration follow-up

Status: future  
Priority: medium

Purpose:

Clarify relationship between completed services and invoice items.

Rules:

- completed_service is not payment
- invoice_item may reference completed_service
- payment does not complete treatment
- allocation explains where money went

---

### 11.4 Timeline integration follow-up

Status: future  
Priority: low-medium

Purpose:

Only after finance UI and cashier flow are stable, consider safe timeline events.

No timeline integration inside `PATIENT-FINANCE-UI-001`.

---

### 11.5 Stock/material finance boundary

Status: future  
Priority: low-medium

Purpose:

Define boundaries between services, invoice items, and material write-offs.

No stock mutation in current finance UI tasks.

---

### 11.6 Finance reports

Status: future  
Priority: medium

Purpose:

Finance dashboards/reports after core finance UI and cashier flow.

No reports UI in `PATIENT-FINANCE-UI-001`.

---

## 12. Host / Windows tasks already known

Previously completed or noted:

- `HOST-AUDIT-001`
- `HOST-MEDIA-COPY-001A`
- `HOST-MEDIA-VERIFY-001`
- `HOST-C-DRIVE-RELIEF-002`
- `HOST-SECURITY-TRIAGE-001`
- `HOST-MIGRATION-PLAN-001`

Known host facts:

- `D:` is the main healthy Kingston SSD.
- `E:` / `G:` are treated as risky/disposable after media rescue.
- `D:\MEDIA_RESCUE_FROM_TOSHIBA` is protected personal media archive.
- Windows is low-trust due to Defender/exclusions/suspicious tools history.
- Migration remains important but not immediate.

---

## 13. Permanent rules / invariants

These must not be forgotten:

1. Human approval is not root override.
2. Critical/protected destructive actions default to `DENY`.
3. HEP tasks and DentalFlow app/UI tasks must not be mixed in the same branch.
4. UI/app tasks require explicit `appCodeChanges=true` and strict allowlist.
5. No cloud Supabase unless explicit cloud task.
6. No migrations unless explicit schema/migration task.
7. No generated types committed unless explicitly allowed.
8. No package file edits unless explicitly allowed.
9. No direct table writes from finance UI components.
10. No raw RPC calls from finance UI components.
11. Finance reads go through `FinanceRepository`.
12. Finance writes go through `FinanceRpcClient`.
13. `patients.balance` is not finance source of truth.
14. Completed service is not payment.
15. Invoice is not payment.
16. Payment is not treatment completion.
17. Allocation explains where money went.
18. Any agent output must include commit hash, changed files, checks, smoke, and clean status.
19. If blocked, write blocker report instead of guessing or bypassing.
20. Do not leave dirty repo behind.

---

## 14. Recommended near-term paths

### If priority is Hermes self-improvement

1. `HERMES-ASSET-OWNERSHIP-001`
2. `HERMES-WAIVER-REGISTRY-001`
3. `HERMES-ROLLBACK-CONTRACT-001`
4. `HERMES-MISSION-CONTROL-001`
5. `HERMES-SELF-IMPROVEMENT-GATE-001`

### If priority is DentalFlow product

1. `HERMES-TASK-POLICY-APP-CODE-PERMISSION-001`
2. `PATIENT-FINANCE-UI-001`
3. `CASHIER-PAYMENT-FLOW-001`

### If priority is safer automation execution

1. `HERMES-TASK-TEMPLATE-REGISTRY-001`
2. `HERMES-POLICY-SIMULATOR-001`
3. `HERMES-AGENT-CAPABILITY-MATRIX-001`
4. `HERMES-AGENT-HANDOFF-PROTOCOL-001`

---

## 15. Final checkpoint verdict

This report captures the broader 40+ task roadmap that was not fully included in the shorter session checkpoint.

No code changes are intended by this task.

Verdict: `ROADMAP CHECKPOINT CAPTURED`
