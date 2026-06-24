# HERMES-ASSET-REGISTRY-001

## Summary

Implemented the first Asset Registry layer for the Hermes Execution Platform (HEP). This layer provides a durable registry identifying target resources (files, directories, external directories), explaining their security parameters (criticality, lifecycle, owner), and mapping allowed/forbidden/requires-plan actions.

The Asset Registry exposes a pure stateless rule checking logic integrated into the Decision Gateway and Decision Policy to enforce protection rules for critical, protected, high-criticality, and archive-candidate assets.

## Changed Files

- [NEW] `tools/hep/asset-registry.ts` (Core types, seed registry, checking logic, event logging)
- [NEW] `tools/hep/__tests__/asset-registry.test.ts` (12 unit tests covering all required cases)
- [MODIFY] `tools/hep/decision-gateway.ts` (Integrated `checkAssetAction`, added `assetSignal` to output and policy input)
- [MODIFY] `tools/hep/decision-policy.ts` (Added asset-registry security rules)
- [MODIFY] `tools/hep/__tests__/decision-gateway.test.ts` (Added 4 gateway integration tests)
- [MODIFY] `tools/hep/__tests__/decision-policy.test.ts` (Added 5 policy rules unit tests)
- [MODIFY] `tools/hep/index.ts` (Added `asset-init`, `asset-list`, `asset-see`, and `asset-check` CLI commands)
- [NEW] `D:\hermes\memory\assets\asset-registry.json` (Durable registry JSON file)
- [NEW] `D:\hermes\logs\assets\asset-events.jsonl` (Registry audit log file)
- [NEW] `_ai_work/REPORTS/HERMES-ASSET-REGISTRY-001.md` (This report)

## Asset Model

### Asset Types
- `hep_tooling`
- `runtime_memory`
- `runtime_log`
- `report`
- `registry`
- `worktree`
- `project_root`
- `user_data`
- `media_archive`
- `host_storage`
- `unknown`

### Criticality Levels
- `low`
- `medium`
- `high`
- `critical`

### Lifecycles
- `active`
- `protected`
- `archive_candidate`
- `archived`
- `deprecated`
- `unknown`

## Seed Assets

A total of 16 seed assets are initialized, including:
1. `hep.project.codex-test` (project root)
2. `hep.cli.index`, `hep.decision.gateway`, `hep.decision.policy` (tooling)
3. `runtime.assets` (asset registry config)
4. `host.media_rescue` (`D:\MEDIA_RESCUE_FROM_TOSHIBA` external critical protected archive)
5. `worktree.event_log_old` (archive candidate worktree)

## CLI Commands

- **`asset-init`**: `node tools/hep/index.ts asset-init --workspaceRoot D:\hermes`
- **`asset-list`**: `node tools/hep/index.ts asset-list --workspaceRoot D:\hermes`
- **`asset-see`**: `node tools/hep/index.ts asset-see --workspaceRoot D:\hermes --asset-id <id>`
- **`asset-check`**: `node tools/hep/index.ts asset-check --workspaceRoot D:\hermes --target <target> --action <action>`

## Gateway & Policy Integration

### Decision Gateway
- Coordinates the collection of `assetSignal` via `checkAssetAction` from `asset-registry.ts`.
- Appends warnings if the registry file is missing/corrupted instead of crashing.
- Stores check events inside `logs/assets/asset-events.jsonl`.
- Passes the signal to Decision Policy and exposes it in the Gateway JSON/Markdown output.

### Decision Policy Rules
- **`ASSET_CRITICAL_DESTRUCTIVE_DENY`**: returns `DENY` if criticality = critical and action is destructive.
- **`ASSET_PROTECTED_DESTRUCTIVE_DENY`**: returns `DENY` if lifecycle = protected and action is destructive.
- **`ASSET_OWNER_REQUIRED`**: returns `ESCALATE` if criticality is high/critical and owner is missing.
- **`ASSET_HIGH_MOVE_REQUIRE_PLAN`**: returns `REQUIRE_PLAN` if criticality = high and action is move/rename/archive.
- **`ASSET_UNKNOWN_DESTRUCTIVE_REQUIRE_PLAN`**: returns `REQUIRE_PLAN` if asset is unknown and action is destructive.
- **`ASSET_ARCHIVE_CANDIDATE_REQUIRE_PLAN`**: returns `REQUIRE_PLAN` if lifecycle = archive_candidate and action is archive/move/delete.
- **`ASSET_REGISTRY_MISSING`**: returns `REQUIRE_PLAN` if asset signal is missing and action is destructive.

## Validation Results

- **`npm run lint`**: Passed clean.
- **`npm test`**: Passed all **73 test files, 750 tests** successfully.
- **`npm run build`**: Passed clean.

### Smoke Results

1. **Smoke A (asset-init)**:
   Initialized registry and event log.
2. **Smoke B (asset-check)**:
   Checking `tools/hep/index.ts` returned `hep.cli.index` with criticality `high` and lifecycle `active`.
3. **Smoke C (Destructive delete denied)**:
   Checking delete on `D:\MEDIA_RESCUE_FROM_TOSHIBA` returned `DENY` with rules `ASSET_CRITICAL_DESTRUCTIVE_DENY` and `ASSET_PROTECTED_DESTRUCTIVE_DENY` triggered.
4. **Smoke D (High move requires plan)**:
   Checking archive on `tools/hep/index.ts` returned `REQUIRE_PLAN` with rule `ASSET_HIGH_MOVE_REQUIRE_PLAN` triggered.
5. **Smoke E (observability-report)**:
   Generated snapshot correctly recording the test runs.

## Next Recommended Task

- **`HERMES-ASSET-OWNERSHIP-001`**: Establish ownership rules and enforce owner validation checks.
