import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { addHazard } from "../hazard-registry.ts";
import { buildAssetRecord, upsertAssetRegistry } from "../dependency-guard.ts";
import { evaluateDecisionGateway } from "../decision-gateway.ts";

const TASK_ID = "HERMES-DECISION-GATEWAY-001";

function makeWorkspace(): { workspace: string; project: string } {
  const workspace = join(tmpdir(), "decision-gateway-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const project = join(workspace, "codex-test");
  mkdirSync(join(project, "tools", "hep"), { recursive: true });
  writeFileSync(join(project, "tools", "hep", "index.ts"), "export {}\n", "utf8");
  return { workspace, project };
}

function cleanupWorkspace(workspace: string): void {
  rmSync(workspace, { recursive: true, force: true });
}

function writePolicy(workspace: string, overrides: Record<string, unknown> = {}): void {
  const policy = {
    version: 2,
    activeTaskId: TASK_ID,
    allowed: {
      appCodeChanges: true,
      migrations: true,
      gitCodeChanges: true
    },
    forbidden: {
      cloudSupabase: true
    },
    outputRedaction: true,
    ...overrides
  };
  writeFileSync(join(workspace, "super-hermes-policy.json"), `${JSON.stringify(policy, null, 2)}\n`, "utf8");
}

function request(workspace: string, project: string, extra: Partial<Parameters<typeof evaluateDecisionGateway>[0]> = {}) {
  return {
    workspaceRoot: workspace,
    repositoryPath: project,
    taskId: TASK_ID,
    actor: "maintenance.autopilot",
    action: "inspect",
    target: "tools/hep/index.ts",
    targetType: "file" as const,
    writeEvent: false,
    writeDecisionLedger: false,
    ...extra
  };
}

describe("Decision Gateway", () => {
  it("allows when policy, Guardian, Dependency, and hazards are clean", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(result.decision).toBe("ALLOW");
      expect(result.allowed).toBe(true);
      expect(result.normalizedTarget).toBe("codex-test/tools/hep/index.ts");
      expect(result.dependencyResult?.targetAsset.notes).toContain("exists:file");
      expect(result.dependencyResult?.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("denies when target path escapes allowed roots", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { target: "../outside.txt" }));

      expect(result.decision).toBe("DENY");
      expect(result.allowed).toBe(false);
      expect(result.reasons.join("\n")).toContain("Dependency Guard denied");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("denies when Guardian denies actor/action/target", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { actor: "unknown.actor" }));

      expect(result.decision).toBe("DENY");
      expect(result.signals.guardian.decision).toBe("DENY");
      expect(result.reasons.join("\n")).toContain("Guardian ACL denied");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("requires plan when Dependency Guard requires waiver", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);
      const reportPath = join(workspace, "reports", "old.md");
      mkdirSync(join(workspace, "reports"), { recursive: true });
      writeFileSync(reportPath, "old", "utf8");
      const asset = buildAssetRecord(workspace, "reports/old.md", { projectPath: project });
      asset.referencedBy = ["reports/indexes/report-index.json"];
      upsertAssetRegistry(workspace, [asset]);

      const result = evaluateDecisionGateway(request(workspace, project, {
        actor: "maintenance.trio",
        action: "archive",
        target: "reports/old.md"
      }));

      expect(result.decision).toBe("REQUIRE_PLAN");
      expect(result.requiredMode).toBe("impact-plan");
      expect(result.signals.dependency.decision).toBe("REQUIRE_WAIVER_PLAN");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("escalates when active high hazard matches", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);
      mkdirSync(join(workspace, "reports"), { recursive: true });
      writeFileSync(join(workspace, "reports", "risky-report.md"), "risky", "utf8");
      addHazard({
        hazardId: "HZD-TEST-RISKY-REPORT-001",
        title: "Risky report fixture",
        area: "hep",
        severity: "high",
        symptom: "fixture",
        workaround: "manual review",
        prevention: "test",
        tags: ["risky-report"]
      }, { hermesRoot: workspace });

      const result = evaluateDecisionGateway(request(workspace, project, {
        actor: "maintenance.trio",
        action: "archive",
        target: "reports/risky-report.md"
      }));

      expect(result.decision).toBe("ESCALATE");
      expect(result.hazardMatches[0].hazardId).toBe("HZD-TEST-RISKY-REPORT-001");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("keeps low hazard as warning only", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);
      addHazard({
        hazardId: "HZD-TEST-LOW-REPORT-001",
        title: "Low report fixture",
        area: "hep",
        severity: "low",
        symptom: "fixture",
        workaround: "note",
        prevention: "test",
        tags: ["low-report"]
      }, { hermesRoot: workspace });

      const result = evaluateDecisionGateway(request(workspace, project, {
        actor: "auditor.readonly",
        target: "tools/hep/index.ts",
        reason: "checking low-report"
      }));

      expect(result.decision).toBe("ALLOW");
      expect(result.warnings.join("\n")).toContain("HZD-TEST-LOW-REPORT-001");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("does not crash when hazard registry is missing", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(result.decision).toBe("ALLOW");
      expect(result.signals.hazards.status).toBe("missing-or-empty");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("does not crash when event log is missing", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { writeEvent: true }));

      expect(result.eventWritten).toBe(true);
      expect(existsSync(join(workspace, "logs", "events", "hermes-events.jsonl"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("writes decision ledger when enabled", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { writeDecisionLedger: true }));

      expect(result.decisionLedgerPath).toContain("decision-events.jsonl");
      expect(existsSync(result.decisionLedgerPath || "")).toBe(true);
      expect(readFileSync(result.decisionLedgerPath || "", "utf8")).toContain(TASK_ID);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("redacts sensitive-looking fields from event and ledger output", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, {
        writeEvent: true,
        writeDecisionLedger: true,
        reason: "token=supersecret sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
      }));
      const ledger = readFileSync(result.decisionLedgerPath || "", "utf8");
      const events = readFileSync(join(workspace, "logs", "events", "hermes-events.jsonl"), "utf8");

      expect(ledger).not.toContain("supersecret");
      expect(ledger).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
      expect(events).not.toContain("supersecret");
      expect(events).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
      expect(`${ledger}\n${events}`).toContain("[REDACTED]");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("escalates when policy activeTaskId mismatches", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace, { activeTaskId: "OTHER-TASK-001" });

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(result.decision).toBe("ESCALATE");
      expect(result.reasons.join("\n")).toContain("differs from request task");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("denies app code target when policy appCodeChanges is false", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace, { allowed: { appCodeChanges: false, migrations: true, gitCodeChanges: true } });
      mkdirSync(join(project, "src"), { recursive: true });
      writeFileSync(join(project, "src", "App.tsx"), "export {}\n", "utf8");

      const result = evaluateDecisionGateway(request(workspace, project, {
        actor: "auditor.readonly",
        target: "src/App.tsx"
      }));

      expect(result.decision).toBe("DENY");
      expect(result.reasons.join("\n")).toContain("app code");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("denies migration target when policy migrations is false", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace, { allowed: { appCodeChanges: true, migrations: false, gitCodeChanges: true } });
      mkdirSync(join(project, "supabase", "migrations"), { recursive: true });
      writeFileSync(join(project, "supabase", "migrations", "0001.sql"), "-- migration\n", "utf8");

      const result = evaluateDecisionGateway(request(workspace, project, {
        actor: "auditor.readonly",
        target: "supabase/migrations/0001.sql"
      }));

      expect(result.decision).toBe("DENY");
      expect(result.reasons.join("\n")).toContain("migration");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("repo-relative HEP target works without missing-on-disk", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { target: "tools/hep/index.ts" }));

      expect(result.normalizedTarget).toBe("codex-test/tools/hep/index.ts");
      expect(result.dependencyResult?.targetAsset.notes).toContain("path-format:repo-relative");
      expect(result.dependencyResult?.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("workspace-relative HEP target works without missing-on-disk", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { target: "codex-test/tools/hep/index.ts" }));

      expect(result.normalizedTarget).toBe("codex-test/tools/hep/index.ts");
      expect(result.dependencyResult?.targetAsset.notes).toContain("path-format:workspace-relative");
      expect(result.dependencyResult?.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  // ── Decision Policy integration ───────────────────────────────────────────

  it("gateway result includes matchedRules from Decision Policy", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(Array.isArray(result.matchedRules)).toBe(true);
      expect(result.matchedRules.length).toBeGreaterThan(0);
      // Clean ALLOW run: only ALLOW_DEFAULT should fire
      expect(result.matchedRules).toContain("ALLOW_DEFAULT");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("gateway result includes decisionPolicyResult from Decision Policy", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(result.decisionPolicyResult).toBeDefined();
      expect(result.decisionPolicyResult?.decision).toBe("ALLOW");
      expect(result.decisionPolicyResult?.severity).toBe("info");
      expect(result.decisionPolicyResult?.recommendedNextSteps.length).toBeGreaterThan(0);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("matchedRules includes POLICY_TASK_MISMATCH when activeTaskId differs", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace, { activeTaskId: "OTHER-TASK-MISMATCH" });

      const result = evaluateDecisionGateway(request(workspace, project));

      expect(result.decision).toBe("ESCALATE");
      expect(result.matchedRules).toContain("POLICY_TASK_MISMATCH");
      expect(result.decisionPolicyResult?.matchedRules).toContain("POLICY_TASK_MISMATCH");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("matchedRules includes PATH_OUTSIDE_ALLOWED_ROOTS for traversal target", () => {
    const { workspace, project } = makeWorkspace();
    try {
      writePolicy(workspace);

      const result = evaluateDecisionGateway(request(workspace, project, { target: "../outside.txt" }));

      expect(result.decision).toBe("DENY");
      expect(result.matchedRules).toContain("DEPENDENCY_DENY");
      expect(result.matchedRules).toContain("PATH_OUTSIDE_ALLOWED_ROOTS");
    } finally {
      cleanupWorkspace(workspace);
    }
  });
});
