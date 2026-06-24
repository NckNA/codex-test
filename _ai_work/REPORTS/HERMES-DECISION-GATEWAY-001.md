# HERMES-DECISION-GATEWAY-001

## Summary

Implemented the first Hermes HEP Decision Gateway. It composes existing foundation layers into one final decision without replacing them:

1. local task policy summary;
2. Guardian ACL;
3. Dependency Guard;
4. Hazard Registry;
5. Event Log;
6. decision ledger.

Final decisions:

- `ALLOW`
- `DENY`
- `DRY_RUN_ONLY`
- `REQUIRE_PLAN`
- `ESCALATE`

## Changed Files

- `tools/hep/decision-gateway.ts`
- `tools/hep/__tests__/decision-gateway.test.ts`
- `tools/hep/index.ts`
- `tools/hep/guardian-acl.ts`
- `_ai_work/REPORTS/HERMES-DECISION-GATEWAY-001.md`

`guardian-acl.ts` was changed only to allow read-only `inspect` for HEP files by `maintenance.autopilot`. It does not grant write, move, delete, policy edit, migration, or app-code permissions.

## Decision Model

The gateway evaluates:

- `actor`
- `action`
- `target`
- `taskId`
- policy context
- target path contract
- dependency state
- hazards

Conservative precedence:

`DENY > ESCALATE > REQUIRE_PLAN > DRY_RUN_ONLY > ALLOW`

## Evaluation Order

1. Validate required input.
2. Normalize target through Dependency Guard path contract.
3. Read `D:\hermes\super-hermes-policy.json` if available.
4. Apply policy constraints:
   - active task mismatch => `ESCALATE`;
   - `appCodeChanges=false` + app code target => `DENY`;
   - `migrations=false` + migration target => `DENY`.
5. Run Guardian ACL.
6. Run Dependency Guard.
7. Match active hazards.
8. Compose final decision.
9. Write Hermes event unless disabled.
10. Write decision ledger unless disabled.

## CLI Commands

JSON:

```bash
node tools/hep/index.ts decision-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-GATEWAY-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts --target-type file
```

Markdown:

```bash
node tools/hep/index.ts decision-explain --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-GATEWAY-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts --target-type file
```

Safety flags:

- `--no-write-event`
- `--no-write-ledger`

## Test Results

- `npm run lint`: passed
- `npm test -- tools/hep/__tests__/decision-gateway.test.ts`: passed, 15 tests
- `npm test`: passed, 71 files / 698 tests
- `npm run build`: passed

Build warning:

- Vite reports one bundle chunk over 500 kB after minification. This is a warning, not a build failure.

## Smoke Results

### decision-check on HEP file

Command:

```bash
node tools/hep/index.ts decision-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-GATEWAY-001 --actor maintenance.autopilot --action inspect --target tools/hep/index.ts --target-type file
```

Result:

- final decision: `ESCALATE`
- reason: active policy task is `HERMES-FOUNDATION-AUDIT-FIX-001`, request task is `HERMES-DECISION-GATEWAY-001`
- Guardian: `ALLOW`
- Dependency Guard: `ALLOW`
- normalized target: `codex-test/tools/hep/index.ts`
- Dependency notes: `path-format:repo-relative`, `exists:file`
- `missing-on-disk`: not present

This confirms the path contract is fixed. The escalation is policy-driven.

### decision-explain

Command produced readable Markdown with:

- final decision;
- reason;
- policy signal;
- Guardian signal;
- Dependency signal;
- hazard signal.

### traversal smoke

Command:

```bash
node tools/hep/index.ts decision-check --workspaceRoot D:\hermes --repositoryPath D:\hermes\codex-test --taskId HERMES-DECISION-GATEWAY-001 --actor maintenance.autopilot --action inspect --target ../outside.txt --target-type file
```

Result:

- final decision: `DENY`
- allowed: `false`
- Guardian: `DENY`
- Dependency Guard: `DENY`
- reason includes path contract traversal block.

## Runtime Output

Decision ledger was written:

`D:\hermes\logs\decisions\decision-events.jsonl`

Hermes Event Log was written by smoke commands.

## Observability

Command:

```bash
node tools/hep/index.ts observability-report --workspaceRoot D:\hermes --max-events 10 --max-reports 10
```

Result:

- overall: `RED`
- reason: the smoke commands intentionally wrote `ESCALATE` and `DENY` decision events.
- missing modules: `0`
- corrupt event lines: `0`

This is expected after exercising the new gateway with an active policy mismatch and traversal-deny smoke case.

## Known Limitations

- No override flag is implemented for active policy mismatch.
- Guardrail Blocker report creation is not automatic in v1.
- Hazard matching is intentionally conservative and lightweight.
- Event writes can affect observability status because observability treats DENY/ESCALATE as signals requiring attention.

## Recommended Next Task

`HERMES-DECISION-POLICY-001`
