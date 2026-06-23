import * as fs from "node:fs";
import * as path from "node:path";

export interface ReportIndexOptions {
  workspaceRoot: string;
  projectPath?: string;
  outputPath?: string;
  now?: string;
}

export interface ReportIndexEntry {
  fileName: string;
  path: string;
  source: "project_report" | "workspace_report";
  taskId?: string;
  title?: string;
  prNumbers: number[];
  prUrls: string[];
  branches: string[];
  inferredStatus: "ACTIVE" | "MERGED" | "ARCHIVED" | "BLOCKED" | "STALE" | "UNKNOWN";
  flags: string[];
  updatedAt: string;
}

export interface ReportIndex {
  schemaVersion: 1;
  generatedAt: string;
  workspaceRoot: string;
  projectPath: string;
  entries: ReportIndexEntry[];
  summary: {
    total: number;
    withTaskId: number;
    orphaned: number;
    stale: number;
    merged: number;
    archived: number;
    blocked: number;
    duplicateTaskIds: string[];
  };
}

const TASK_ID_PATTERN = /\b[A-Z][A-Z0-9]+(?:-[A-Z0-9]+){2,}\b/g;
const PR_NUMBER_PATTERN = /(?:PR\s*#|pull\/)\s*(\d+)/gi;
const PR_URL_PATTERN = /https:\/\/github\.com\/[^\s)]+\/pull\/\d+/gi;
const BRANCH_PATTERN = /(?:branch|ветка)\s*[:-]\s*`?([A-Za-z0-9._/-]+)`?/gi;

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeStatMtime(filePath: string): string {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractTaskId(fileName: string, content: string): string | undefined {
  const fromFile = fileName.match(TASK_ID_PATTERN)?.[0];
  if (fromFile) return fromFile;
  return content.match(TASK_ID_PATTERN)?.[0];
}

function extractTitle(content: string): string | undefined {
  const line = content.split(/\r?\n/).find((item) => item.trim().startsWith("# "));
  return line ? line.replace(/^#\s+/, "").trim() : undefined;
}

function extractNumbers(pattern: RegExp, content: string): number[] {
  const numbers: number[] = [];
  for (const match of content.matchAll(pattern)) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value)) numbers.push(value);
  }
  return unique(numbers);
}

function extractBranches(content: string): string[] {
  const branches: string[] = [];
  for (const match of content.matchAll(BRANCH_PATTERN)) {
    if (match[1]) branches.push(match[1]);
  }
  return unique(branches);
}

function inferStatus(filePath: string, content: string): ReportIndexEntry["inferredStatus"] {
  const lower = content.toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, "/").toLowerCase();
  if (normalizedPath.includes("/reports/archived/")) return "ARCHIVED";
  if (lower.includes("blocked") || lower.includes("failed") || lower.includes("not ready")) return "BLOCKED";
  if (lower.includes("merged") || lower.includes("ci: success") || lower.includes("build: passed")) return "MERGED";
  if (lower.includes("todo") || lower.includes("partial") || lower.includes("pending")) return "STALE";
  if (normalizedPath.includes("/reports/active/")) return "ACTIVE";
  return "UNKNOWN";
}

function buildFlags(entry: Omit<ReportIndexEntry, "flags">, content: string): string[] {
  const flags: string[] = [];
  if (!entry.taskId) flags.push("ORPHANED_NO_TASK_ID");
  if (entry.prNumbers.length === 0 && entry.prUrls.length === 0) flags.push("NO_PR_REFERENCE");
  const lower = content.toLowerCase();
  if (lower.includes("todo") || lower.includes("partial") || lower.includes("pending")) flags.push("STALE_MARKERS");
  if (entry.inferredStatus === "BLOCKED") flags.push("BLOCKED_MARKERS");
  return flags;
}

function scanMarkdownFiles(root: string, source: ReportIndexEntry["source"]): ReportIndexEntry[] {
  if (!fs.existsSync(root)) return [];
  const entries: ReportIndexEntry[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const dirent of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, dirent.name);
      if (dirent.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (!dirent.isFile() || !dirent.name.toLowerCase().endsWith(".md")) {
        continue;
      }
      const content = fs.readFileSync(absolute, "utf8");
      const base = {
        fileName: dirent.name,
        path: absolute,
        source,
        taskId: extractTaskId(dirent.name, content),
        title: extractTitle(content),
        prNumbers: extractNumbers(PR_NUMBER_PATTERN, content),
        prUrls: unique(content.match(PR_URL_PATTERN) || []),
        branches: extractBranches(content),
        inferredStatus: inferStatus(absolute, content),
        updatedAt: safeStatMtime(absolute)
      };
      entries.push({ ...base, flags: buildFlags(base, content) });
    }
  }
  return entries;
}

export function buildReportIndex(options: ReportIndexOptions): ReportIndex {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const projectPath = path.resolve(options.projectPath || path.join(workspaceRoot, "codex-test"));
  const generatedAt = options.now || new Date().toISOString();
  const projectReports = scanMarkdownFiles(path.join(projectPath, "_ai_work", "REPORTS"), "project_report");
  const workspaceReports = scanMarkdownFiles(path.join(workspaceRoot, "reports"), "workspace_report");
  const entries = [...projectReports, ...workspaceReports].sort((a, b) => a.fileName.localeCompare(b.fileName));

  const taskCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.taskId) taskCounts.set(entry.taskId, (taskCounts.get(entry.taskId) || 0) + 1);
  }
  const duplicateTaskIds = Array.from(taskCounts.entries()).filter(([, count]) => count > 1).map(([taskId]) => taskId).sort();
  for (const entry of entries) {
    if (entry.taskId && duplicateTaskIds.includes(entry.taskId)) {
      entry.flags.push("DUPLICATE_TASK_ID");
    }
  }

  return {
    schemaVersion: 1,
    generatedAt,
    workspaceRoot,
    projectPath,
    entries,
    summary: {
      total: entries.length,
      withTaskId: entries.filter((entry) => !!entry.taskId).length,
      orphaned: entries.filter((entry) => entry.flags.includes("ORPHANED_NO_TASK_ID")).length,
      stale: entries.filter((entry) => entry.flags.includes("STALE_MARKERS") || entry.inferredStatus === "STALE").length,
      merged: entries.filter((entry) => entry.inferredStatus === "MERGED").length,
      archived: entries.filter((entry) => entry.inferredStatus === "ARCHIVED").length,
      blocked: entries.filter((entry) => entry.inferredStatus === "BLOCKED").length,
      duplicateTaskIds
    }
  };
}

export function writeReportIndex(index: ReportIndex, outputPath?: string): string {
  const target = outputPath || path.join(index.workspaceRoot, "reports", "indexes", "report-index.json");
  writeJson(target, index);
  return target;
}

export function formatReportIndex(index: ReportIndex, outputPath?: string): string {
  return [
    "Report index built",
    `Total: ${index.summary.total}`,
    `With taskId: ${index.summary.withTaskId}`,
    `Orphaned: ${index.summary.orphaned}`,
    `Stale: ${index.summary.stale}`,
    `Merged: ${index.summary.merged}`,
    `Archived: ${index.summary.archived}`,
    `Blocked: ${index.summary.blocked}`,
    `Duplicate taskIds: ${index.summary.duplicateTaskIds.length}`,
    outputPath ? `Output: ${outputPath}` : "Output: dry-run/no write"
  ].join("\n");
}
