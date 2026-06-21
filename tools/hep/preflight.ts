import { createRequire } from "node:module";

/**
 * Verifies that the current environment meets the requirements:
 * 1. Node.js version >= 24.15.0
 * 2. node:sqlite is available with DatabaseSync class
 * 
 * Throws a clear error if requirements are not met.
 */
export function verifyNodeEnvironmentSync(): void {
  const version = process.versions.node;
  const parts = version.split(".").map(Number);
  const major = parts[0];
  const minor = parts[1];

  if (major < 24 || (major === 24 && minor < 15)) {
    throw new Error(`Node.js version must be >= 24.15.0. Current version is ${version}`);
  }

  try {
    const require = createRequire(import.meta.url);
    const sqlite = require("node:sqlite");
    if (!sqlite.DatabaseSync) {
      throw new Error("DatabaseSync class is not exported from node:sqlite");
    }
  } catch (err) {
    throw new Error(`node:sqlite is unavailable in this Node.js environment: ${err instanceof Error ? err.message : err}`, { cause: err });
  }
}
