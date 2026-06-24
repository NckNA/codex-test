# HERMES-WAIVER-REGISTRY-001: Waiver Registry Layer

## Metadata
- **PR URL**: TBD
- **Branch**: TBD
- **PR Head Reviewed**: TBD
- **Report Update Commit**: TBD

---

## GitHub Actions CI Verification
- **Run ID**: TBD
- **Run Number**: TBD
- **Status**: TBD
- **Conclusion**: TBD
- **Tested Commit**: TBD

---

## Summary

Implemented the first Waiver Registry layer for Hermes HEP.  
The Waiver Registry provides a bounded exception system allowing exceptional risky actions only under strict, auditable, time-limited, and scoped conditions.

Core principles:
- Human approval is NOT root access.
- Owner approval is NOT a universal override.
- A waiver is NOT a magic bypass; it is a narrow, expiring, auditable exception.
- Critical and protected destructive actions remain strictly denied (`DENY`) and cannot be relaxed by any waiver in version 1.

---

## Changed Files

- [NEW] [waiver-registry.ts](file:///D:/hermes/codex-test/tools/hep/waiver-registry.ts) — Waiver registry core (validation, matches, signal evaluation, events logging).
- [NEW] [waiver-registry.test.ts](file:///D:/hermes/codex-test/tools/hep/__tests__/waiver-registry.test.ts) — 5 unit tests covering registry operations.
- [MODIFY] [decision-policy.ts](file:///D:/hermes/codex-test/tools/hep/decision-policy.ts) — Added WaiverSignal integration, relaxation rules, and 6 new policy unit tests.
- [MODIFY] [decision-gateway.ts](file:///D:/hermes/codex-test/tools/hep/decision-gateway.ts) — Collects and executes waiver evaluations; adds 3 gateway integration tests.
- [MODIFY] [index.ts](file:///D:/hermes/codex-test/tools/hep/index.ts) — Implemented CLI commands (`waiver-init`, `waiver-list`, `waiver-see`, `waiver-add`, `waiver-revoke`, `waiver-check`).
- [NEW] [HERMES-WAIVER-REGISTRY-001.md](file:///D:/hermes/codex-test/_ai_work/REPORTS/HERMES-WAIVER-REGISTRY-001.md) — This report.

---

## Implemented Waiver Rules in Decision Policy

| Rule ID | Decision | Description / Rationale |
| :--- | :--- | :--- |
| `WAIVER_EXPIRED` | `ESCALATE` | The matched waiver is expired. |
| `WAIVER_REVOKED` | `DENY` | The matched waiver has been revoked. |
| `WAIVER_ROLLBACK_REQUIRED` | `ESCALATE` | Active medium/high-risk waiver is missing a rollback plan. |
| `WAIVER_VALID_LOW_MEDIUM_RELAX_PLAN` | `ALLOW` | Relaxes tentative `REQUIRE_PLAN` to `ALLOW` for low/medium risk. |
| `WAIVER_VALID_HIGH_REDUCE_ESCALATE_TO_PLAN` | `REQUIRE_PLAN` | Relaxes tentative `ESCALATE` to `REQUIRE_PLAN` (reduces risk). |
| `WAIVER_NO_DENY_BYPASS` | `DENY` | Waiver attempts to bypass hard DENY (forbidden in v1). |
| `WAIVER_NO_CRITICAL_DESTRUCTIVE_BYPASS` | `DENY` | Waiver attempts to bypass critical/protected destructive deny. |
| `WAIVER_NO_FORBIDDEN_FOR_ALL_BYPASS` | `DENY` | Waiver attempts to bypass ownership forbidden-for-all action. |

---

## CLI Commands Added

```bash
# Initialize Waiver Registry
node tools/hep/index.ts waiver-init --workspaceRoot D:\hermes

# List all waivers
node tools/hep/index.ts waiver-list --workspaceRoot D:\hermes

# View specific waiver
node tools/hep/index.ts waiver-see --workspaceRoot D:\hermes --waiver-id <waiverId>

# Add a waiver
node tools/hep/index.ts waiver-add --workspaceRoot D:\hermes --taskId <taskId> --actor <actor> --action <action> --risk-level <low/medium/high> --reason <reason> --expires-at <ISO> [--target <path>] [--assetId <id>] [--review-level <none/owner/guardian/multi_reviewer>]

# Revoke a waiver
node tools/hep/index.ts waiver-revoke --workspaceRoot D:\hermes --waiver-id <waiverId> --reason <reason>

# Evaluate waiver signal
node tools/hep/index.ts waiver-check --workspaceRoot D:\hermes --taskId <taskId> --actor <actor> --action <action> [--target <path>] [--assetId <id>]
```

---

## Verification Results

### Tests
All tests in the HEP test suite passed successfully:
```bash
npx vitest run tools/hep/__tests__/
```
Output:
```
 Test Files  15 passed (15)
      Tests  194 passed (194)
```

### Linting
```bash
npm run lint
```
Output: Clean with 0 errors.

### Build Compilation
```bash
npm run build
```
Output: Compilation and production build successful.

---

## Recommended Next Steps

- Continue monitoring the event log and observability snapshots.
