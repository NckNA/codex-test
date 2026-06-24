import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readGuardrailBlockerReport, redactGuardrailText, writeGuardrailBlockerReport } from "../guardrail-blocker.ts";

function makeWorkspace(): string {
  const root = join(tmpdir(), "guardrail-blocker-tests", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function cleanupWorkspace(workspace: string): void {
  rmSync(workspace, { recursive: true, force: true });
}

describe("guardrail blocker reports", () => {
  it("writes JSON and Markdown blocker reports", () => {
    const workspace = makeWorkspace();
    try {
      const report = writeGuardrailBlockerReport({
        workspaceRoot: workspace,
        taskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        blockedAt: "2026-06-24T00:00:00.000Z",
        blockedOperation: "dependency-check inspect",
        blockType: "path_contract_block",
        activePolicyTaskId: "HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001",
        gitMode: "code_changes",
        expectedCapability: "inspect repo-relative HEP file",
        attemptedTool: "dependencyCheck",
        attemptedPath: "tools/hep/index.ts",
        completed: ["read task", "checked git status"],
        remaining: ["fix path contract"],
        nextSafeSteps: ["run dependency-check smoke"],
        cloudTouched: false,
        repoDirty: false
      });

      expect(report.blockType).toBe("path_contract_block");
      expect(report.cloudTouched).toBe(false);
      expect(report.repoDirty).toBe(false);
      expect(existsSync(report.outputs.json)).toBe(true);
      expect(existsSync(report.outputs.markdown)).toBe(true);
      expect(readGuardrailBlockerReport(report.outputs.json).taskId).toBe("HERMES-FOUNDATION-GUARDRAIL-AND-PATH-CONTRACT-001");
      expect(readFileSync(report.outputs.markdown, "utf8")).toContain("Guardrail Blocker");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("redacts secrets from blocker content", () => {
    const workspace = makeWorkspace();
    try {
      const report = writeGuardrailBlockerReport({
        workspaceRoot: workspace,
        taskId: "SECRET-BLOCKER-001",
        blockedOperation: "tool failed with token=secret-value",
        blockType: "tool_contract_block",
        expectedCapability: "write report without leaking sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
        attemptedTool: "guardrail-blocker",
        remaining: ["Do not expose password=supersecret"],
        nextSafeSteps: ["Use redacted diagnostics"],
        cloudTouched: false,
        repoDirty: false
      });
      const json = readFileSync(report.outputs.json, "utf8");
      const markdown = readFileSync(report.outputs.markdown, "utf8");

      expect(report.redactionApplied).toBe(true);
      expect(json).not.toContain("secret-value");
      expect(json).not.toContain("supersecret");
      expect(json).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890");
      expect(markdown).toContain("[REDACTED]");
    } finally {
      cleanupWorkspace(workspace);
    }
  });

  it("redacts standalone text", () => {
    const result = redactGuardrailText("Authorization: Bearer abc token=my-token password=my-password");

    expect(result.redacted).toBe(true);
    expect(result.value).not.toContain("my-token");
    expect(result.value).not.toContain("my-password");
  });
});
