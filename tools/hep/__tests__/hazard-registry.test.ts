import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { addHazard, getHazard, initHazardRegistry, listHazards, mitigateHazard } from "../hazard-registry.ts";

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hermes-hazards-"));
}

describe("hazard-registry", () => {
  it("initializes registry with default hazards", () => {
    const hermesRoot = makeRoot();
    const registry = initHazardRegistry({ hermesRoot });

    expect(registry.hazards.length).toBeGreaterThanOrEqual(9);
    expect(getHazard("HZD-HEP-BRANCH-DIVERGENCE-001", { hermesRoot })?.status).toBe("active");
    expect(fs.existsSync(path.join(hermesRoot, "memory", "hazards", "hazards.json"))).toBe(true);
    expect(fs.existsSync(path.join(hermesRoot, "logs", "hazards", "hazard-events.jsonl"))).toBe(true);
  });

  it("adds a new hazard", () => {
    const hermesRoot = makeRoot();
    initHazardRegistry({ hermesRoot });

    const hazard = addHazard({
      hazardId: "HZD-TEST-NEW-001",
      title: "Test hazard",
      area: "hep",
      severity: "medium",
      symptom: "Something repeatable happened.",
      workaround: "Use a narrow workaround.",
      prevention: "Add a regression test.",
      linkedTasks: ["TASK-1"],
      tags: ["test"]
    }, { hermesRoot, actor: "test", taskId: "TASK-1" });

    expect(hazard.hazardId).toBe("HZD-TEST-NEW-001");
    expect(getHazard("HZD-TEST-NEW-001", { hermesRoot })?.linkedTasks).toContain("TASK-1");
  });

  it("updates occurrence count for existing hazards", () => {
    const hermesRoot = makeRoot();
    initHazardRegistry({ hermesRoot });

    const first = addHazard({
      hazardId: "HZD-TEST-REPEAT-001",
      title: "Repeat hazard",
      area: "cli",
      severity: "low",
      symptom: "Repeated symptom.",
      workaround: "Repeat workaround.",
      prevention: "Repeat prevention."
    }, { hermesRoot });
    const second = addHazard({
      hazardId: "HZD-TEST-REPEAT-001",
      title: "Repeat hazard updated",
      area: "cli",
      severity: "medium",
      symptom: "Repeated symptom again.",
      workaround: "Repeat workaround again.",
      prevention: "Repeat prevention again.",
      linkedTasks: ["TASK-2"]
    }, { hermesRoot });

    expect(first.occurrenceCount).toBe(1);
    expect(second.occurrenceCount).toBe(2);
    expect(second.linkedTasks).toContain("TASK-2");
  });

  it("filters hazards", () => {
    const hermesRoot = makeRoot();
    initHazardRegistry({ hermesRoot });

    const criticalStorage = listHazards({ severity: "critical", area: "storage" }, { hermesRoot });

    expect(criticalStorage.some((hazard) => hazard.hazardId === "HZD-HOST-HDD-PREDICTIVE-FAILURE-001")).toBe(true);
  });

  it("marks a hazard as mitigated", () => {
    const hermesRoot = makeRoot();
    initHazardRegistry({ hermesRoot });

    const mitigated = mitigateHazard("HZD-HEP-BRANCH-DIVERGENCE-001", "Reconciled branches", { hermesRoot, actor: "test", taskId: "TASK-MITIGATE" });

    expect(mitigated.status).toBe("mitigated");
    expect(mitigated.mitigatedAt).toBeTruthy();
  });

  it("rejects registry paths outside Hermes root", () => {
    const hermesRoot = makeRoot();

    expect(() => initHazardRegistry({
      hermesRoot,
      registryPath: path.resolve(path.dirname(hermesRoot), "hazards.json")
    })).toThrow(/escapes Hermes root/);
  });
});
