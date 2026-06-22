import * as fs from "node:fs";
import * as path from "node:path";
import { gitExecutor } from "./worktree-manager.ts";
import { redactSecrets } from "./task-memory.ts";

export interface PlaceholderWarning {
  line: number;
  content: string;
  placeholder: string;
}

export interface GhRunDetails {
  databaseId: number;
  number: number;
  status: string;
  conclusion: string;
  headSha: string;
}

// Helper to execute GitHub CLI commands safely, normalizing errors and redacting secrets
function runGhCommand(cmd: string, repositoryPath: string): string {
  try {
    return gitExecutor.execSync(cmd, { cwd: repositoryPath, encoding: "utf8", stdio: "pipe" });
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`GitHub CLI command failed: ${redactSecrets(rawMsg)}`, { cause: err });
  }
}

// Parse helper to count occurrences of a metadata field to prevent duplicate conflicts
function countMatches(content: string, keys: string[]): number {
  let count = 0;
  for (const key of keys) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    
    const bulletRegex = new RegExp(`^\\s*-\\s*\\*\\*${escapedKey}\\*\\*:\\s*.*`, "gim");
    const bulletMatches = content.match(bulletRegex) || [];
    count += bulletMatches.length;

    const headerRegex = new RegExp(`^##\\s*\\d+\\.\\s*${escapedKey}\\s*$`, "gim");
    const headerMatches = content.match(headerRegex) || [];
    count += headerMatches.length;
  }
  return count;
}

// Replace helper for a specific field supporting both bullet list and numbered section formats
function replaceField(content: string, keys: string[], newValue: string, bulletFormatValue: string): string {
  let updatedContent = content;
  for (const key of keys) {
    const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

    const bulletRegex = new RegExp(`(^\\s*-\\s*\\*\\*${escapedKey}\\*\\*:\\s*)(.*)`, "im");
    if (bulletRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(bulletRegex, `$1${bulletFormatValue}`);
      continue;
    }

    // Numbered section regex matching the header and the body of the section up to the next section or end of file
    const headerRegex = new RegExp(`(^##\\s*\\d+\\.\\s*${escapedKey}\\s*$\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |\\r?\\n$|$)`, "im");
    if (headerRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(headerRegex, (_match, p1, p2) => {
        const hasLeadingNewline = p2.startsWith("\r\n") || p2.startsWith("\n");
        if (hasLeadingNewline) {
          const newline = p2.startsWith("\r\n") ? "\r\n" : "\n";
          return p1 + newline + newValue;
        } else {
          return p1 + newValue;
        }
      });
    }
  }
  return updatedContent;
}

// Detects the latest report file under _ai_work/REPORTS/
export function detectLatestReport(repositoryPath: string): string {
  const reportsDir = path.resolve(repositoryPath, "_ai_work/REPORTS");
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`Reports directory does not exist at: ${reportsDir}`);
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const filePath = path.join(reportsDir, f);
      const stat = fs.statSync(filePath);
      return { path: filePath, mtime: stat.mtimeMs };
    });

  if (files.length === 0) {
    throw new Error("No report markdown files (.md) found in _ai_work/REPORTS/.");
  }

  if (files.length === 1) {
    return files[0].path;
  }

  // 1. Check Git status for modified/untracked reports
  try {
    const gitStatus = gitExecutor.execSync("git status --porcelain", { cwd: repositoryPath, encoding: "utf8" });
    const modifiedReports = gitStatus.split(/\r?\n/)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.endsWith(".md") && trimmed.includes("_ai_work/REPORTS/");
      })
      .map(line => {
        // git status --porcelain outputs:
        // XY path
        // where XY is a 2-character status code followed by a space.
        // We extract path starting from index 3.
        return path.resolve(repositoryPath, line.slice(3).trim());
      });

    // De-duplicate modified reports
    const uniqueModified = Array.from(new Set(modifiedReports));

    if (uniqueModified.length === 1) {
      return uniqueModified[0];
    }
    if (uniqueModified.length > 1) {
      throw new Error(`Ambiguous reports: Multiple modified report files found in Git status:\n${uniqueModified.join("\n")}\nPlease specify the report explicitly using --report <path>.`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Ambiguous reports")) {
      throw e;
    }
    // Fall back to mtime if git status check fails
  }

  // 2. Sort by mtime
  files.sort((a, b) => b.mtime - a.mtime);

  // If mtime difference between top 2 files is less than 5 minutes, mark as ambiguous
  if (files.length > 1 && (files[0].mtime - files[1].mtime) < 5 * 60 * 1000) {
    throw new Error(`Ambiguous reports: The two most recently modified reports were updated within 5 minutes of each other:\n1. ${files[0].path}\n2. ${files[1].path}\nPlease specify the report explicitly using --report <path>.`);
  }

  return files[0].path;
}

// Scans report content for placeholders (TBD, TODO, PARTIAL)
export function scanPlaceholders(content: string): PlaceholderWarning[] {
  const warnings: PlaceholderWarning[] = [];
  const lines = content.split(/\r?\n/);
  const placeholderRegex = /\b(TBD|TODO|PARTIAL)\b/gi;

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    placeholderRegex.lastIndex = 0;
    let match;
    while ((match = placeholderRegex.exec(lineContent)) !== null) {
      warnings.push({
        line: i + 1,
        content: lineContent.trim(),
        placeholder: match[0]
      });
    }
  }
  return warnings;
}

// Main execution function
export function finalizeReport(options: {
  repositoryPath: string;
  reportPath?: string;
  verdict?: string;
  nextTask?: string;
}): void {
  const repositoryPath = path.resolve(options.repositoryPath);
  
  // 1. Resolve report path
  let targetReport = options.reportPath;
  if (targetReport) {
    targetReport = path.resolve(targetReport);
  } else {
    targetReport = detectLatestReport(repositoryPath);
  }

  if (!fs.existsSync(targetReport)) {
    throw new Error(`Report file not found at: ${targetReport}`);
  }

  console.log(`Finalizing report: ${targetReport}`);

  // 2. Read report content
  let content = fs.readFileSync(targetReport, "utf8");

  // 3. Define metadata keys and check for duplicate conflicts
  const prUrlKeys = ["PR URL", "PR_URL"];
  const branchKeys = ["Branch Name", "Branch"];
  const prHeadKeys = ["PR Head Reviewed Before Final Report Update", "PR Head Reviewed", "PR Head"];
  const reportCommitKeys = ["Report Update Commit"];
  const runIdKeys = ["Run ID", "CI Run ID", "CI runId"];
  const runNumberKeys = ["Run Number", "CI Run Number", "CI runNumber"];
  const testedCommitKeys = ["Tested Commit", "CI Tested Commit"];
  const verdictKeys = ["Final Verdict", "final_verdict"];
  const nextTaskKeys = ["Recommended Next Task", "recommended_next_task"];

  // Validate duplicate conflicts and required presence
  const validationList = [
    { name: "PR URL", keys: prUrlKeys, required: true },
    { name: "Branch", keys: branchKeys, required: true },
    { name: "PR Head Reviewed", keys: prHeadKeys, required: true },
    { name: "Report Update Commit", keys: reportCommitKeys, required: true },
    { name: "Run ID", keys: runIdKeys, required: true },
    { name: "Run Number", keys: runNumberKeys, required: true },
    { name: "Tested Commit", keys: testedCommitKeys, required: true },
    { name: "Final Verdict", keys: verdictKeys, required: !!options.verdict },
    { name: "Recommended Next Task", keys: nextTaskKeys, required: !!options.nextTask }
  ];

  for (const item of validationList) {
    const matchesCount = countMatches(content, item.keys);
    if (matchesCount > 1) {
      throw new Error(`Conflict: Multiple entries found for metadata field "${item.name}". Please clean up the markdown before finalization.`);
    }
    if (item.required && matchesCount === 0) {
      throw new Error(`Error: Required metadata field "${item.name}" not found in the report.`);
    }
  }

  // 4. Retrieve Git/GitHub CLI information
  console.log("Retrieving Git and GitHub CLI metadata...");
  let branchName: string;
  try {
    branchName = gitExecutor.execSync("git branch --show-current", { cwd: repositoryPath }).trim();
  } catch (e) {
    throw new Error(`Failed to retrieve git branch: ${e instanceof Error ? e.message : e}`, { cause: e });
  }

  let headSha: string;
  try {
    headSha = gitExecutor.execSync("git rev-parse HEAD", { cwd: repositoryPath }).trim();
  } catch (e) {
    throw new Error(`Failed to retrieve HEAD SHA: ${e instanceof Error ? e.message : e}`, { cause: e });
  }

  // Retrieve PR URL
  const prJsonStr = runGhCommand("gh pr view --json url", repositoryPath);
  let prUrl: string;
  try {
    const prData = JSON.parse(prJsonStr);
    prUrl = prData.url || "";
  } catch (e) {
    throw new Error(`Failed to parse PR URL JSON: ${e instanceof Error ? e.message : e}`, { cause: e });
  }

  if (!prUrl) {
    throw new Error("No active pull request URL found for the current branch.");
  }

  // Retrieve latest CI Run details
  const runListJsonStr = runGhCommand(
    `gh run list --branch "${branchName}" --limit 1 --json databaseId,number,status,conclusion,headSha`,
    repositoryPath
  );
  let runs: GhRunDetails[];
  try {
    runs = JSON.parse(runListJsonStr);
  } catch (e) {
    throw new Error(`Failed to parse gh run list JSON: ${e instanceof Error ? e.message : e}`, { cause: e });
  }

  if (runs.length === 0) {
    throw new Error(`No GitHub Actions workflow runs found for branch "${branchName}". Please push the branch to trigger CI first.`);
  }

  const latestRun = runs[0];
  console.log(`Latest CI Run ID:     ${latestRun.databaseId}`);
  console.log(`Latest CI Run Number: ${latestRun.number}`);
  console.log(`Latest CI Status:     ${latestRun.status}`);
  console.log(`Latest CI Conclusion: ${latestRun.conclusion}`);
  console.log(`Latest CI Tested SHA: ${latestRun.headSha}`);

  // 5. Validate CI run criteria
  if (latestRun.status !== "completed") {
    throw new Error(`CI Validation Blocked: Latest workflow run is still in status "${latestRun.status}". Please wait for CI to finish.`);
  }

  if (latestRun.conclusion !== "success") {
    throw new Error(`CI Validation Blocked: Latest workflow run finished with conclusion "${latestRun.conclusion}". Fix tests before finalization.`);
  }

  // Tested commit mismatch check (stale CI head)
  if (latestRun.headSha !== headSha) {
    throw new Error(`CI Validation Blocked: Tested SHA in CI (${latestRun.headSha}) does not match local HEAD commit (${headSha}). Please push your latest changes and wait for CI.`);
  }

  // 6. Execute replacements
  const naWording = "N/A because the final report update commit cannot reference itself before creation.";
  
  content = replaceField(content, prUrlKeys, prUrl, `[${prUrl}](${prUrl})`);
  content = replaceField(content, branchKeys, branchName, `\`${branchName}\``);
  content = replaceField(content, prHeadKeys, headSha, `\`${headSha}\``);
  content = replaceField(content, reportCommitKeys, naWording, `\`${naWording}\``);
  content = replaceField(content, runIdKeys, String(latestRun.databaseId), `\`${latestRun.databaseId}\``);
  content = replaceField(content, runNumberKeys, String(latestRun.number), `\`${latestRun.number}\``);
  content = replaceField(content, testedCommitKeys, latestRun.headSha, `\`${latestRun.headSha}\``);

  if (options.verdict) {
    content = replaceField(content, verdictKeys, options.verdict, `**${options.verdict}**`);
  }
  if (options.nextTask) {
    content = replaceField(content, nextTaskKeys, options.nextTask, `**${options.nextTask}**`);
  }

  // 7. Write updated content
  fs.writeFileSync(targetReport, content, "utf8");
  console.log("Report updated successfully.");

  // 8. Log placeholder warnings in compiler-like format
  const warnings = scanPlaceholders(content);
  if (warnings.length > 0) {
    console.warn(`\n[WARNING] Found ${warnings.length} unresolved placeholder(s) in the finalized report:`);
    for (const w of warnings) {
      console.warn(`${targetReport}:${w.line}: warning: Unresolved placeholder "${w.placeholder}" in line: "${w.content}"`);
    }
  }
}
