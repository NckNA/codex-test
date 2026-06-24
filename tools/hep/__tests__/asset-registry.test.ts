import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  initializeAssetRegistry,
  loadAssetRegistry,
  checkAssetAction,
  findAssetForTarget,
  writeAssetEvent
} from "../asset-registry.ts";

function makeWorkspace(): { workspace: string; project: string } {
  const workspace = join(tmpdir(), "asset-registry-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const project = join(workspace, "codex-test");
  mkdirSync(join(project, "tools", "hep"), { recursive: true });
  writeFileSync(join(project, "tools", "hep", "index.ts"), "export {}\n", "utf8");
  return { workspace, project };
}

function cleanupWorkspace(workspace: string): void {
  rmSync(workspace, { recursive: true, force: true });
}

describe("Asset Registry", () => {
  it("1. asset-init creates registry with seed assets", () => {
    const { workspace } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const registryFile = join(workspace, "memory", "assets", "asset-registry.json");
      expect(existsSync(registryFile)).toBe(true);
      
      const assets = loadAssetRegistry({ workspaceRoot: workspace });
      expect(assets.length).toBeGreaterThan(0);
      expect(assets.some(a => a.assetId === "hep.project.codex-test")).toBe(true);
      expect(assets.some(a => a.assetId === "host.media_rescue")).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("2. repo-relative target tools/hep/index.ts finds hep.cli.index", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const asset = findAssetForTarget({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "tools/hep/index.ts"
      });
      expect(asset).toBeDefined();
      expect(asset?.assetId).toBe("hep.cli.index");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("3. workspace-relative target codex-test/tools/hep/index.ts finds hep.cli.index", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const asset = findAssetForTarget({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "codex-test/tools/hep/index.ts"
      });
      expect(asset).toBeDefined();
      expect(asset?.assetId).toBe("hep.cli.index");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("4. absolute path inside repository finds matching asset", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const targetAbs = resolve(project, "tools/hep/index.ts");
      const asset = findAssetForTarget({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: targetAbs
      });
      expect(asset).toBeDefined();
      expect(asset?.assetId).toBe("hep.cli.index");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("5. traversal outside roots is blocked", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "../outside.txt",
        action: "read"
      });
      expect(result.actionAllowed).toBe(false);
      expect(result.actionForbidden).toBe(true);
      expect(result.reasons.some(r => r.includes("path contract violation") || r.includes("outside"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("6. unknown target returns unknown asset signal", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "tools/hep/not-existent-file.ts",
        action: "read"
      });
      expect(result.matched).toBe(false);
      expect(result.type).toBe("unknown");
      expect(result.criticality).toBe("low");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("7. critical protected media asset + delete returns forbidden signal", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "D:\\MEDIA_RESCUE_FROM_TOSHIBA",
        action: "delete"
      });
      expect(result.matched).toBe(true);
      expect(result.assetId).toBe("host.media_rescue");
      expect(result.actionForbidden).toBe(true);
      expect(result.actionAllowed).toBe(false);
      expect(result.reasons.some(r => r.includes("forbidden") || r.includes("Destructive"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("8. high HEP asset + move requires plan", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "tools/hep/index.ts",
        action: "move"
      });
      expect(result.matched).toBe(true);
      expect(result.assetId).toBe("hep.cli.index");
      expect(result.requiresPlan).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("9. archive_candidate worktree archive requires plan", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: join(workspace, "hermes-event-log-001-work"),
        action: "archive"
      });
      expect(result.matched).toBe(true);
      expect(result.assetId).toBe("worktree.event_log_old");
      expect(result.requiresPlan).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("10. asset events write JSONL", () => {
    const { workspace } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      writeAssetEvent({
        workspaceRoot: workspace,
        event: {
          taskId: "TEST-TASK",
          actor: "test-actor",
          action: "delete",
          target: "D:\\MEDIA_RESCUE_FROM_TOSHIBA",
          assetId: "host.media_rescue",
          matched: true,
          decision: "DENY",
          allowed: false
        }
      });
      const eventsFile = join(workspace, "logs", "assets", "asset-events.jsonl");
      expect(existsSync(eventsFile)).toBe(true);
      
      const content = readFileSync(eventsFile, "utf8").trim();
      const lines = content.split("\n");
      expect(lines.length).toBe(1);
      
      const event = JSON.parse(lines[0]);
      expect(event.taskId).toBe("TEST-TASK");
      expect(event.decision).toBe("DENY");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("11. registry missing does not crash check; returns unknown/warning", () => {
    const { workspace, project } = makeWorkspace();
    try {
      // Do not call initializeAssetRegistry
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "tools/hep/index.ts",
        action: "read"
      });
      expect(result.matched).toBe(false);
      expect(result.type).toBe("unknown");
      expect(result.warnings.some(w => w.includes("missing") || w.includes("not initialized"))).toBe(true);
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("12. external protected asset D:\\MEDIA_RESCUE_FROM_TOSHIBA is recognized when seeded", () => {
    const { workspace, project } = makeWorkspace();
    try {
      initializeAssetRegistry({ workspaceRoot: workspace });
      const result = checkAssetAction({
        workspaceRoot: workspace,
        repositoryPath: project,
        target: "D:\\MEDIA_RESCUE_FROM_TOSHIBA",
        action: "read"
      });
      expect(result.matched).toBe(true);
      expect(result.assetId).toBe("host.media_rescue");
      expect(result.criticality).toBe("critical");
      expect(result.lifecycle).toBe("protected");
    } finally {
      cleanupWorkspace(workspace);
    }
  });
});
