import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";

export type GuardrailBlockType =
  | "policy_block"
  | "safety_layer_block"
  | "tool_contract_block"
  | "path_contract_block"
  | "unknown";

export interface GuardrailBlockerInput {
  workspaceRoot: string;
  taskId: string;
  blockedAt?: string;
  blockedOperation: string;
  blockType: GuardrailBlockType;
  activePolicyTaskId?: string;
  gitMode?: string;
  expectedCapability: string;
  attemptedTool?: string;
  attemptedPath?: string;
  target?: string;
  completed?: string[];
  remaining?: string[];
  nextSafeSteps?: string[];
  cloudTouched?: boolean;
  repoDirty?: boolean;
  redactionApplied?: boolean;
}

export interface GuardrailBlockerReport {
  taskId: string;
  blockedAt: string;
  blockedOperation: string;
  blockType: GuardrailBlockType;
  activePolicyTaskId?: string;
  gitMode?: string;
  expectedCapability: string;
  attemptedTool?: string;
  attemptedPath?: string;
  target?: string;
  completed: string[];
  remaining: string[];
  nextSafeSteps: string[];
  cloudTouched: boolean;
  repoDirty: boolean;
  redactionApplied: boolean;
  outputs: {
    json: string;
    markdown: string;
  };
}

const SECRET_PATTERNS = [
  /sbp_[A-Za-z0-9_=-]{20,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sk-proj-[A-Za-z0-9_-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /\b(?:password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*["']?[^"',\s]+["']?/gi,
  /postgres(?:ql)?:\/\/[^\s"')]+/gi
];

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function safeTaskId(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-task";
}

export function redactGuardrailText(value: string): { value: string; redacted: boolean } {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return { value: redacted, redacted: redacted !== value };
}

function sanitizeString(value: string | undefined): { value: string | undefined; redacted: boolean } {
  if (value === undefined) return { value, redacted: false };
  return redactGuardrailText(value);
}

function sanitizeList(values: string[] | undefined): { value: string[]; redacted: boolean } {
  let redacted = false;
  const value = (values || []).map((item) => {
    const sanitized = redactGuardrailText(item);
    redacted = redacted || sanitized.redacted;
    return sanitized.value;
  });
  return { value, redacted };
}

function detectRepoDirty(workspaceRoot: string): boolean {
  const projectPath = resolve(workspaceRoot, "codex-test");
  if (!existsSync(projectPath)) return false;
  try {
    return execSync("git status --short", { cwd: projectPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().length > 0;
  } catch {
    return false;
  }
}

function markdownList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function formatMarkdown(report: GuardrailBlockerReport): string {
  return [
    `# Guardrail Blocker: ${report.taskId}`,
    "",
    `- **Blocked at**: ${report.blockedAt}`,
    `- **Blocked operation**: ${report.blockedOperation}`,
    `- **Block type**: ${report.blockType}`,
    `- **Active policy task**: ${report.activePolicyTaskId || "n/a"}`,
    `- **Git mode**: ${report.gitMode || "n/a"}`,
    `- **Expected capability**: ${report.expectedCapability}`,
    `- **Attempted tool**: ${report.attemptedTool || "n/a"}`,
    `- **Attempted path**: ${report.attemptedPath || report.target || "n/a"}`,
    `- **Cloud touched**: ${report.cloudTouched}`,
    `- **Repo dirty**: ${report.repoDirty}`,
    `- **Redaction applied**: ${report.redactionApplied}`,
    "",
    "## Completed",
    "",
    markdownList(report.completed),
    "",
    "## Remaining",
    "",
    markdownList(report.remaining),
    "",
    "## Next Safe Steps",
    "",
    markdownList(report.nextSafeSteps),
    ""
  ].join("\n");
}

export function writeGuardrailBlockerReport(input: GuardrailBlockerInput): GuardrailBlockerReport {
  const workspaceRoot = resolve(input.workspaceRoot);
  const outputBase = join(workspaceRoot, "reports", "active", `blockers-${safeTaskId(input.taskId)}-blocker`);
  const jsonPath = `${outputBase}.json`;
  const markdownPath = `${outputBase}.md`;

  const blockedOperation = sanitizeString(input.blockedOperation);
  const activePolicyTaskId = sanitizeString(input.activePolicyTaskId);
  const gitMode = sanitizeString(input.gitMode);
  const expectedCapability = sanitizeString(input.expectedCapability);
  const attemptedTool = sanitizeString(input.attemptedTool);
  const attemptedPath = sanitizeString(input.attemptedPath);
  const target = sanitizeString(input.target);
  const completed = sanitizeList(input.completed);
  const remaining = sanitizeList(input.remaining);
  const nextSafeSteps = sanitizeList(input.nextSafeSteps);
  const redactionApplied = Boolean(
    input.redactionApplied ||
    blockedOperation.redacted ||
    activePolicyTaskId.redacted ||
    gitMode.redacted ||
    expectedCapability.redacted ||
    attemptedTool.redacted ||
    attemptedPath.redacted ||
    target.redacted ||
    completed.redacted ||
    remaining.redacted ||
    nextSafeSteps.redacted
  );

  const report: GuardrailBlockerReport = {
    taskId: safeTaskId(input.taskId),
    blockedAt: input.blockedAt || new Date().toISOString(),
    blockedOperation: blockedOperation.value || "unknown",
    blockType: input.blockType,
    activePolicyTaskId: activePolicyTaskId.value,
    gitMode: gitMode.value,
    expectedCapability: expectedCapability.value || "unknown",
    attemptedTool: attemptedTool.value,
    attemptedPath: attemptedPath.value,
    target: target.value,
    completed: completed.value,
    remaining: remaining.value,
    nextSafeSteps: nextSafeSteps.value,
    cloudTouched: input.cloudTouched === true,
    repoDirty: input.repoDirty ?? detectRepoDirty(workspaceRoot),
    redactionApplied,
    outputs: {
      json: jsonPath,
      markdown: markdownPath
    }
  };

  ensureDir(dirname(jsonPath));
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(markdownPath, formatMarkdown(report), "utf8");
  return report;
}

export function readGuardrailBlockerReport(jsonPath: string): GuardrailBlockerReport {
  return JSON.parse(readFileSync(jsonPath, "utf8")) as GuardrailBlockerReport;
}
