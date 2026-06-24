import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildAssetRecord,
  createAssetLease,
  dependencyCheck,
  initializeDependencyGuard,
  upsertAssetRegistry,
  writeImpactLedger,
  type ImpactPlan,
} from "../dependency-guard";

function makeWorkspace(): string {
  const root = join(tmpdir(), "dependency-guard-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function cleanupWorkspace(workspace: string): void {
  rmSync(workspace, { recursive: true, force: true });
}

function writeReport(workspace: string, relativePath: string): void {
  const absolute = join(workspace, relativePath);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, "# report\n", "utf8");
}

function makeProjectWorkspace(): { workspace: string; project: string; hepIndex: string } {
  const workspace = makeWorkspace();
  const project = join(workspace, "codex-test");
  const hepDir = join(project, "tools", "hep");
  const hepIndex = join(hepDir, "index.ts");
  mkdirSync(hepDir, { recursive: true });
  writeFileSync(hepIndex, "export {}\n", "utf8");
  return { workspace, project, hepIndex };
}

function validImpactPlan(target = "reports/old.md"): ImpactPlan {
  return {
    impactedAssets: [target, "reports/indexes/report-index.json"],
    compensatingTasks: ["Update report index after archive", "Create follow-up verification task"],
    requiredValidations: ["npm run lint", "npm test", "npm run build"],
    rollbackPlan: [`Restore ${target} from archive`, "Rebuild dependency graph"],
  };
}

describe("dependency guard", () => {
  it("allows low-risk read/index", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/safe.md");

      const readResult = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "auditor.readonly",
        action: "read",
        target: "reports/safe.md",
      });
      const indexResult = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "archivist.indexer",
        action: "index",
        target: "reports/safe.md",
      });

      expect(readResult.decision).toBe("ALLOW");
      expect(indexResult.decision).toBe("ALLOW");
      expect(readResult.allowed).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("blocks or escalates critical asset mutation", () => {
    const workspace = makeWorkspace();
    try {
      mkdirSync(join(workspace, "codex-test", ".git"), { recursive: true });

      const result = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "archive",
        target: "codex-test",
      });

      expect(["DENY", "ESCALATE"]).toContain(result.decision);
      expect(result.risk).toBe("critical");
      expect(result.safeAlternative).toContain("safe workspace");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("active lease requires waiver or denies", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/busy.md");
      const asset = buildAssetRecord(workspace, "reports/busy.md");
      upsertAssetRegistry(workspace, [asset]);
      createAssetLease(workspace, {
        assetId: asset.assetId,
        leasedBy: "reports.indexer",
        taskId: "HERMES-REPORTS-INDEX-001",
        mode: "write",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        reason: "index refresh",
      });

      const result = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "archive",
        target: "reports/busy.md",
      });

      expect(["DENY", "REQUIRE_WAIVER_PLAN"]).toContain(result.decision);
      expect(result.activeLeases).toHaveLength(1);
      expect(result.blockingDependencies[0]).toContain("active-lease:reports.indexer");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("referenced asset requires waiver", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/old.md");
      const asset = buildAssetRecord(workspace, "reports/old.md");
      asset.referencedBy = ["reports/indexes/report-index.json"];
      asset.linkedTasks = ["HERMES-REPORTS-INDEX-001"];
      asset.status = "active";
      upsertAssetRegistry(workspace, [asset]);

      const result = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "archive",
        target: "reports/old.md",
      });

      expect(result.decision).toBe("REQUIRE_WAIVER_PLAN");
      expect(result.blockingDependencies).toContain("referenced-by:reports/indexes/report-index.json");
      expect(result.requiredActions.join(" ")).toContain("impact plan");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("impact plan can allow controlled change", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/old.md");
      const asset = buildAssetRecord(workspace, "reports/old.md");
      asset.referencedBy = ["reports/indexes/report-index.json"];
      upsertAssetRegistry(workspace, [asset]);

      const result = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "archive",
        target: "reports/old.md",
        impactPlan: validImpactPlan(),
      });

      expect(result.decision).toBe("ALLOW_WITH_IMPACT_PLAN");
      expect(result.impactedAssets).toContain("reports/old.md");
      expect(result.compensatingTasks).toContain("Update report index after archive");
      expect(result.requiredValidations).toContain("npm run build");
      expect(result.rollbackPlan).toContain("Restore reports/old.md from archive");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("writes impact ledger", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/old.md");
      const asset = buildAssetRecord(workspace, "reports/old.md");
      asset.referencedBy = ["reports/indexes/report-index.json"];
      upsertAssetRegistry(workspace, [asset]);
      const request = {
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "archive" as const,
        target: "reports/old.md",
        impactPlan: validImpactPlan(),
      };
      const result = dependencyCheck(request);

      const entry = writeImpactLedger(workspace, request, result);
      const ledgerPath = join(workspace, "logs", "dependency-impact-ledger.jsonl");
      const ledgerLine = readFileSync(ledgerPath, "utf8").trim();

      expect(entry.taskId).toBe("HERMES-DEPENDENCY-GUARD-001C");
      expect(entry.actor).toBe("maintenance.trio");
      expect(entry.action).toBe("archive");
      expect(entry.target).toBe("reports/old.md");
      expect(entry.decision).toBe("ALLOW_WITH_IMPACT_PLAN");
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(ledgerLine).toContain("HERMES-DEPENDENCY-GUARD-001C");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("delete is not allowed by default", () => {
    const workspace = makeWorkspace();
    try {
      writeReport(workspace, "reports/delete-me.md");

      const result = dependencyCheck({
        workspaceRoot: workspace,
        taskId: "HERMES-DEPENDENCY-GUARD-001C",
        actor: "maintenance.trio",
        action: "delete",
        target: "reports/delete-me.md",
      });

      expect(["DENY", "ESCALATE"]).toContain(result.decision);
      expect(result.allowed).toBe(false);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("initializes baseline dependency files without overwriting existing registries", () => {
    const workspace = makeWorkspace();
    try {
      const customAssetPath = join(workspace, "memory", "dependency-assets.json");
      mkdirSync(join(workspace, "memory"), { recursive: true });
      writeFileSync(customAssetPath, `${JSON.stringify({ generatedAt: "manual", assets: [] })}\n`, "utf8");

      const initialized = initializeDependencyGuard(workspace);

      expect(initialized.assets).toBe(0);
      expect(initialized.assetPath).toContain("dependency-assets.json");
      expect(initialized.leasesPath).toContain("dependency-leases.jsonl");
      expect(initialized.graphPath).toContain("dependency-graph.json");
      expect(initialized.ledgerPath).toContain("dependency-impact-ledger.jsonl");
      expect(readFileSync(customAssetPath, "utf8")).toContain("manual");
      expect(existsSync(join(workspace, "logs", "dependency-impact-ledger.jsonl"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("resolves repo-relative HEP target against projectPath", () => {
    const { workspace, project } = makeProjectWorkspace();
    try {
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "tools/hep/index.ts",
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.targetAsset.path).toBe("codex-test/tools/hep/index.ts");
      expect(result.targetAsset.notes).toContain("path-format:repo-relative");
      expect(result.targetAsset.notes).toContain("exists:file");
      expect(result.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("resolves workspace-relative HEP target against workspaceRoot", () => {
    const { workspace, project } = makeProjectWorkspace();
    try {
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "codex-test/tools/hep/index.ts",
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.targetAsset.path).toBe("codex-test/tools/hep/index.ts");
      expect(result.targetAsset.notes).toContain("path-format:workspace-relative");
      expect(result.targetAsset.notes).toContain("exists:file");
      expect(result.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("keeps missing-on-disk for missing repo-relative target", () => {
    const { workspace, project } = makeProjectWorkspace();
    try {
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "tools/hep/not-real.ts",
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.targetAsset.path).toBe("codex-test/tools/hep/not-real.ts");
      expect(result.targetAsset.notes).toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("blocks traversal targets before disk inspection", () => {
    const { workspace, project } = makeProjectWorkspace();
    try {
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: "../outside.txt",
      });

      expect(result.decision).toBe("DENY");
      expect(result.allowed).toBe(false);
      expect(result.targetAsset.notes.join("\n")).toContain("path-contract-blocked");
      expect(result.reasons.join("\n")).toContain("path contract rejected");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("allows absolute target inside project root", () => {
    const { workspace, project, hepIndex } = makeProjectWorkspace();
    try {
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: hepIndex,
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.targetAsset.path).toBe("codex-test/tools/hep/index.ts");
      expect(result.targetAsset.notes).toContain("path-format:absolute");
      expect(result.targetAsset.notes).toContain("exists:file");
      expect(result.targetAsset.notes).not.toContain("missing-on-disk");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("blocks absolute target outside allowed roots", () => {
    const { workspace, project } = makeProjectWorkspace();
    const outside = join(workspace, "..", "outside.txt");
    try {
      writeFileSync(outside, "outside", "utf8");
      const result = dependencyCheck({
        workspaceRoot: workspace,
        projectPath: project,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        actor: "maintenance.autopilot",
        action: "inspect",
        target: outside,
      });

      expect(result.decision).toBe("DENY");
      expect(result.allowed).toBe(false);
      expect(result.targetAsset.notes.join("\n")).toContain("path-contract-blocked");
    } finally {
      rmSync(outside, { force: true });
      cleanupWorkspace(workspace);
    }
  });
});
