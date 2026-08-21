import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Diagnostic, RuntimeGraph } from "../../src/runtime/types.js";
import { expectedPaths, listFixtures, normalizeGraph, readExpected, runFixture } from "../fixtures/harness.js";

/**
 * The fixture corpus IS the eval harness (ADR-0005, docs/evals.md).
 * Two layers per scenario:
 *   1. explicit semantic assertions (below) — goldens can't drift meaning
 *   2. golden file comparison — regression guard
 */

interface ScenarioAssertions {
  /** exact diagnostic codes with severities expected */
  diagnostics: Array<[code: string, severity: Diagnostic["severity"]]>;
  /** extra semantic checks */
  check?(graph: RuntimeGraph): void;
}

const EXPECTATIONS: Record<string, ScenarioAssertions> = {
  "clean-project": {
    diagnostics: [],
    check(g) {
      expect(g.entities.length).toBeGreaterThanOrEqual(4);
      expect(g.entities.map((e) => e.kind).sort()).toEqual(["config", "hook", "instruction", "skill"]);
    },
  },
  "duplicate-skills": {
    diagnostics: [["DUP_SKILL", "MEDIUM"]],
    check(g) {
      const skills = g.entities.filter((e) => e.kind === "skill" && e.name === "review");
      expect(skills).toHaveLength(2);
      expect(skills.every((e) => e.status === "available")).toBe(true);
      expect(skills.every((e) => e.provenance.resolution === "unknown")).toBe(true);
      expect(skills.map((e) => e.scope).sort()).toEqual(["global", "project"]);
    },
  },
  "broken-hook": {
    diagnostics: [["BROKEN_HOOK_CMD", "HIGH"]],
    check(g) {
      expect(g.diagnostics[0]!.evidence.join(" ")).toContain("scripts/filter-context.sh");
    },
  },
  "config-shadowing": {
    diagnostics: [
      ["SHADOWED_ENTITY", "INFO"],
      ["SHADOWED_ENTITY", "INFO"],
    ],
    check(g) {
      const servers = g.entities.filter((e) => e.kind === "mcp" && e.name === "github");
      expect(servers).toHaveLength(3);
      const active = servers.filter((e) => e.status === "active");
      expect(active).toHaveLength(1);
      expect(active[0]!.scope).toBe("project-local");
      expect(servers.filter((e) => e.status === "shadowed")).toHaveLength(2);
    },
  },
  "plugin-conflict": {
    diagnostics: [["PLUGIN_REQUIRED_MISSING", "MEDIUM"]],
    check(g) {
      expect(g.entities.some((e) => e.kind === "plugin" && e.name === "other")).toBe(true);
      expect(g.entities.some((e) => e.kind === "plugin" && e.name === "acme/review-tools")).toBe(true);
    },
  },
  "broken-mcp": {
    // graph diagnostics are severity-sorted (ERROR→INFO), then by code
    diagnostics: [
      ["MCP_CMD_MISSING", "HIGH"],
      ["MCP_BAD_URL", "MEDIUM"],
      ["MCP_MISSING_ENV", "MEDIUM"],
    ],
    check(g) {
      const missing = g.diagnostics.find((d) => d.code === "MCP_MISSING_ENV")!;
      expect(missing.evidence.join(" ")).toContain("DEVINSCOPE_FIXTURE_UNSET_VAR");
      expect(JSON.stringify(g)).not.toContain("DEVINSCOPE_FIXTURE_UNSET_VAR_VALUE");
    },
  },
  "conflicting-instructions": {
    diagnostics: [["CONFLICT_MODAL", "MEDIUM"]],
    check(g) {
      const c = g.diagnostics.find((d) => d.code === "CONFLICT_MODAL")!;
      expect(c.evidence.join(" ")).toContain("confidence: medium");
      expect(c.explanation).toMatch(/heuristic/i);
    },
  },
  // spec §39 dogfood scenario
  "demo-repo": {
    diagnostics: [
      ["BROKEN_HOOK_CMD", "HIGH"],
      ["MCP_CMD_MISSING", "HIGH"],
      ["CONFLICT_MODAL", "MEDIUM"],
      ["CONFLICT_MODAL", "MEDIUM"],
      ["DUP_SKILL", "MEDIUM"],
    ],
    check(g) {
      // 7 discovered instruction sources
      const instructionSources = g.entities.filter((e) => e.kind === "instruction" || e.kind === "rule");
      expect(instructionSources).toHaveLength(7);

      // 1 duplicate/shadowed skill
      const skills = g.entities.filter((e) => e.kind === "skill" && e.name === "explain-diff-html");
      expect(skills).toHaveLength(2);

      // project-local override present
      expect(g.entities.some((e) => e.scope === "project-local")).toBe(true);

      // plugin contributes its entities
      expect(g.entities.some((e) => e.kind === "plugin" && e.name === "teamkit")).toBe(true);
    },
  },
};

describe("fixture corpus", () => {
  for (const name of listFixtures()) {
    it(`scenario ${name}`, async () => {
      const run = await runFixture(name);
      try {
        const graph = normalizeGraph(run.graph, run.tmp);

        // explicit semantic assertions
        const expected = EXPECTATIONS[name];
        if (!expected) throw new Error(`no EXPECTATIONS entry for fixture "${name}"`);
        const actualPairs = graph.diagnostics.map((d) => [d.code, d.severity]);
        expect(actualPairs).toEqual(expected.diagnostics);
        expected.check?.(graph);

        // golden comparison
        const paths = expectedPaths(name);
        if (!existsSync(paths.graph)) {
          throw new Error(`missing goldens for "${name}" — run: pnpm test:golden:update`);
        }
        const golden = readExpected(name);
        expect({ schema: graph.schema, entities: graph.entities, metrics: graph.metrics }).toEqual(golden.entities);
        expect(graph.diagnostics).toEqual(golden.diagnostics);
      } finally {
        run.cleanup();
      }
    });
  }
});
