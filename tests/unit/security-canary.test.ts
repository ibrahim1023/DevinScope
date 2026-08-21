import { describe, expect, it } from "vitest";
import { emptyGraph } from "../../src/runtime/graph.js";
import type { RuntimeEntity } from "../../src/runtime/types.js";
import { renderJson } from "../../src/render/json.js";
import { renderDoctor } from "../../src/render/doctor.js";

const CANARIES = ["ghp_CANARY0123456789", "sk-CANARYabcdefghijklmnop", "xoxb-CANARY-999-zzz"];

function entityWithSecrets(): RuntimeEntity {
  return {
    id: "mcp:project:leaky",
    kind: "mcp",
    name: "leaky",
    scope: "project",
    status: "available",
    provenance: { sourceType: "project-config", resolution: "direct" },
    metadata: {
      env: { GITHUB_TOKEN: "configured" },
      body: `never printed, contains ${CANARIES[0]}`,
      note: `Authorization: Bearer ${CANARIES[1]}`,
    },
  };
}

describe("security canaries (docs/testing.md tier 4)", () => {
  it("no canary value appears in any rendered output", () => {
    const graph = emptyGraph("/repo");
    graph.entities.push(entityWithSecrets());
    graph.diagnostics.push({
      code: "X",
      title: `token ${CANARIES[2]} leaked into a title`,
      severity: "HIGH",
      entityIds: ["mcp:project:leaky"],
      evidence: [`key=${CANARIES[0]}`],
      explanation: "e",
    });

    const json = renderJson(graph);
    const terminal = renderDoctor(graph, { color: false });
    for (const canary of CANARIES) {
      expect(json, `json contains ${canary}`).not.toContain(canary);
      expect(terminal, `terminal contains ${canary}`).not.toContain(canary);
    }
    // presence markers survive
    expect(json).toContain('"configured"');
    // bodies are stripped from JSON output entirely
    expect(json).not.toContain("never printed");
  });
});
