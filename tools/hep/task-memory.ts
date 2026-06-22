import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { verifyNodeEnvironmentSync } from "./preflight.ts";

export { verifyNodeEnvironmentSync as verifyNodeEnvironment };

// Strictly Redact Secrets (Tokens, passwords, cookies, auth headers, database URLs, env-like variables)
export function redactSecrets(text: string): string {
  if (!text) return "";
  let redacted = text;

  // 1. Redact Supabase tokens (sbp_...)
  redacted = redacted.replace(/sbp_[a-zA-Z0-9]{30,80}/g, "[REDACTED_SUPABASE_TOKEN]");

  // 2. Redact Supabase keys / JWTs
  redacted = redacted.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{2,}(?:\.[A-Za-z0-9_-]*)?/g, "[REDACTED_JWT]");
  redacted = redacted.replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]");

  // 3. Redact PostgreSQL DB URL connection strings
  redacted = redacted.replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, "[REDACTED_DATABASE_URL]");

  // 4. Redact cookies
  redacted = redacted.replace(/(cookie\s*:\s*)[^;\r\n]+/gi, "$1[REDACTED_COOKIES]");
  redacted = redacted.replace(/(["']?cookie["']?\s*[:=]\s*)(["']?)[^"'\r\n]+\2/gi, "$1[REDACTED_COOKIES]");

  // 5. Redact auth headers, bearer tokens, passwords, and env-like secrets
  const sensitivePatterns = /(["']?)([a-z0-9_-]*(?:secret|password|pwd|token|auth|bearer|private_key|api_key|db_url)[a-z0-9_-]*)\1(\s*[:=]\s*)(?:(["'])(.*?)\4|([^"'\s,;}]+))/gi;
  redacted = redacted.replace(sensitivePatterns, (_match, keyQuote, key, separator, valQuote) => {
    const qKey = keyQuote ? `${keyQuote}${key}${keyQuote}` : key;
    if (valQuote) {
      return `${qKey}${separator}${valQuote}[REDACTED]${valQuote}`;
    } else {
      return `${qKey}${separator}[REDACTED]`;
    }
  });

  // Also redact standard env vars like DB_PASS=val, API_SECRET=val
  const envPatterns = /(["']?)([A-Z0-9_]*(?:SECRET|PASSWORD|PWD|TOKEN|AUTH|KEY|URL)[A-Z0-9_]*)\1(\s*[=:]\s*)(?:(["'])(.*?)\4|([^"'\s;]+))/g;
  redacted = redacted.replace(envPatterns, (_match, keyQuote, key, separator) => {
    const qKey = keyQuote ? `${keyQuote}${key}${keyQuote}` : key;
    return `${qKey}${separator}[REDACTED]`;
  });

  return redacted;
}

// Database Connection Manager
export class TaskMemoryManager {
  private db: DatabaseSync | null = null;
  private dbPath: string;

  constructor(repositoryPath: string) {
    verifyNodeEnvironmentSync();
    const dbDir = path.resolve(repositoryPath, "_ai_work/task_memory");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = path.join(dbDir, "task_memory.db");
  }

  public connect(): void {
    if (this.db) return;
    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  private initializeSchema(): void {
    if (!this.db) throw new Error("Database not connected");
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_history (
        task_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        repository_path TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        base_branch TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        pr_url TEXT,
        status TEXT NOT NULL,
        final_verdict TEXT,
        recommended_next_task TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_events (
        task_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES task_history (task_id)
      );

      CREATE TABLE IF NOT EXISTS task_validations (
        task_id TEXT NOT NULL,
        validation_name TEXT NOT NULL,
        result TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES task_history (task_id)
      );

      CREATE TABLE IF NOT EXISTS task_blockers (
        task_id TEXT NOT NULL,
        blocker_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        needed_capability TEXT,
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES task_history (task_id)
      );
    `);
  }

  public insertTaskHistory(task: {
    taskId: string;
    taskType: string;
    repositoryPath: string;
    worktreePath: string;
    baseBranch: string;
    branchName: string;
    status: string;
  }): void {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      INSERT INTO task_history (
        task_id, task_type, repository_path, worktree_path, base_branch, branch_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(task_id) DO UPDATE SET
        status = excluded.status,
        updated_at = datetime('now')
    `);

    stmt.run(
      redactSecrets(task.taskId),
      redactSecrets(task.taskType),
      redactSecrets(task.repositoryPath),
      redactSecrets(task.worktreePath),
      redactSecrets(task.baseBranch),
      redactSecrets(task.branchName),
      redactSecrets(task.status)
    );
  }

  public updateTaskFinalStatus(taskId: string, update: {
    status: string;
    prUrl?: string;
    finalVerdict?: string;
    recommendedNextTask?: string;
  }): void {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      UPDATE task_history SET
        status = ?,
        pr_url = COALESCE(?, pr_url),
        final_verdict = COALESCE(?, final_verdict),
        recommended_next_task = COALESCE(?, recommended_next_task),
        updated_at = datetime('now')
      WHERE task_id = ?
    `);

    stmt.run(
      redactSecrets(update.status),
      update.prUrl ? redactSecrets(update.prUrl) : null,
      update.finalVerdict ? redactSecrets(update.finalVerdict) : null,
      update.recommendedNextTask ? redactSecrets(update.recommendedNextTask) : null,
      redactSecrets(taskId)
    );
  }

  public insertTaskEvent(taskId: string, eventType: string, summary: string): void {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      INSERT INTO task_events (task_id, event_type, summary, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run(
      redactSecrets(taskId),
      redactSecrets(eventType),
      redactSecrets(summary)
    );
  }

  public insertTaskValidation(taskId: string, validationName: string, result: string, details: Record<string, unknown>): void {
    if (!this.db) throw new Error("Database not connected");

    const detailsStr = redactSecrets(JSON.stringify(details));
    const stmt = this.db.prepare(`
      INSERT INTO task_validations (task_id, validation_name, result, details_json, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      redactSecrets(taskId),
      redactSecrets(validationName),
      redactSecrets(result),
      detailsStr
    );
  }

  public insertTaskBlocker(taskId: string, blockerType: string, summary: string, neededCapability: string): void {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      INSERT INTO task_blockers (task_id, blocker_type, summary, needed_capability, resolved, created_at)
      VALUES (?, ?, ?, ?, 0, datetime('now'))
    `);

    stmt.run(
      redactSecrets(taskId),
      redactSecrets(blockerType),
      redactSecrets(summary),
      redactSecrets(neededCapability)
    );
  }

  public resolveTaskBlockers(taskId: string): void {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      UPDATE task_blockers SET resolved = 1 WHERE task_id = ?
    `);

    stmt.run(redactSecrets(taskId));
  }

  public getTaskHistory(taskId: string): Record<string, unknown> | null {
    if (!this.db) throw new Error("Database not connected");

    const stmt = this.db.prepare(`
      SELECT * FROM task_history WHERE task_id = ?
    `);

    const result = stmt.get(redactSecrets(taskId)) as Record<string, unknown> | undefined;
    return result || null;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
