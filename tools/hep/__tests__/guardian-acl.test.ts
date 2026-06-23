import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkGuardianAccess,
  detectGuardianZone,
  writeDefaultGuardianPolicies
} from "../guardian-acl.ts";

const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "hermes-guardian-acl-"));
  tempRoots.push(root);
  mkdirSync(join(root, "memory"), { recursive: true });
  mkdirSync(join(root, "reports", "indexes"), { recursive: true });
  mkdirSync(join(root, "tools", "hep"), { recursive: true });
  mkdirSync(join(root, "policies", "active"), { recursive: true });
  mkdirSync(join(root, "projects", "codex-test"), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Guardian ACL", () => {
  it("detects protected and writable zones", () => {
    const root = makeWorkspace();
    expect(detectGuardianZone(root, join(root, "tools", "hep", "index.ts"))).toBe("tools/hep");
    expect(detectGuardianZone(root, join(root, "reports", "indexes", "report-index.json"))).toBe("reports/indexes");
    expect(detectGuardianZone(root, join(root, "memory", "task-registry.json"))).toBe("memory/registries");
    expect(detectGuardianZone(root, join(root, "projects", "codex-test", ".git"))).toBe(".git");
    expect(detectGuardianZone(root, join(root, "policies", "active", "task.json"))).toBe("policies");
  });

  it("allows the HEP CLI editor to edit tools/hep but not registries", () => {
    const root = makeWorkspace();
    const allowed = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-GUARDIAN-ACL-001",
      actor: "hep.cli.editor",
      action: "edit_cli",
      target: join(root, "tools", "hep", "index.ts")
    });
    expect(allowed.decision).toBe("ALLOW");
    expect(allowed.allowed).toBe(true);

    const denied = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-GUARDIAN-ACL-001",
      actor: "hep.cli.editor",
      action: "mutate_registry",
      target: join(root, "memory", "task-registry.json")
    });
    expect(denied.decision).toBe("DENY");
    expect(denied.allowed).toBe(false);
    expect(denied.reasons.join("\n")).toContain("forbidden");
  });

  it("requires dry-run first for maintenance autopilot", () => {
    const root = makeWorkspace();
    const dryRunAllowed = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      actor: "maintenance.autopilot",
      action: "dry_run",
      target: join(root, "reports", "indexes", "report-index.json"),
      dryRun: true,
      actionCount: 3
    });
    expect(dryRunAllowed.decision).toBe("ALLOW");

    const nonDryRun = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      actor: "maintenance.autopilot",
      action: "write_index",
      target: join(root, "reports", "indexes", "report-index.json"),
      dryRun: false,
      actionCount: 3
    });
    expect(nonDryRun.decision).toBe("REQUIRE_DRY_RUN");
    expect(nonDryRun.allowed).toBe(false);
  });

  it("denies maintenance autopilot from touching project engines", () => {
    const root = makeWorkspace();
    const denied = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-MAINTENANCE-AUTOPILOT-001B",
      actor: "maintenance.autopilot",
      action: "move",
      target: join(root, "projects", "codex-test"),
      dryRun: true
    });
    expect(denied.decision).toBe("DENY");
    expect(denied.reasons.join("\n")).toContain("forbidden");
  });

  it("writes default ACL manifest only when missing", () => {
    const root = makeWorkspace();
    const path = writeDefaultGuardianPolicies(root);
    expect(existsSync(path)).toBe(true);
    const first = readFileSync(path, "utf8");
    writeFileSync(path, "{\"version\":1,\"roles\":[]}", "utf8");
    const secondPath = writeDefaultGuardianPolicies(root);
    expect(secondPath).toBe(path);
    expect(readFileSync(path, "utf8")).not.toBe(first);
  });

  it("writes audit events when requested", () => {
    const root = makeWorkspace();
    const result = checkGuardianAccess({
      workspaceRoot: root,
      taskId: "HERMES-GUARDIAN-ACL-001",
      actor: "auditor.readonly",
      action: "scan",
      target: join(root, "reports"),
      writeAudit: true
    });
    expect(result.decision).toBe("ALLOW");
    const logPath = join(root, "logs", "guardian-acl-events.jsonl");
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, "utf8")).toContain("auditor.readonly");
  });
});
