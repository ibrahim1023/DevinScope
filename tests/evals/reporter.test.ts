import { describe, expect, it } from "vitest";
import type { Diagnostic } from "../../src/runtime/types.js";
import { listFixtures, normalizeGraph, readExpected, runFixture } from "../fixtures/harness.js";

/**
 * Eval score report (docs/evals.md): per-scenario results and
 * per-diagnostic-class precision/recall of actual vs golden diagnostics.
 * Precision = no unexpected diagnostics; recall = no missing diagnostics.
 */
interface ClassScore {
  tp: number;
  fp: number;
  fn: number;
}

describe("eval score report", () => {
  it("scores the corpus", async () => {
    const perClass = new Map<string, ClassScore>();
    const perScenario: Array<{ name: string; green: boolean }> = [];

    const bump = (code: string, key: keyof ClassScore) => {
      const s = perClass.get(code) ?? { tp: 0, fp: 0, fn: 0 };
      s[key]++;
      perClass.set(code, s);
    };

    for (const name of listFixtures()) {
      const run = await runFixture(name);
      try {
        const graph = normalizeGraph(run.graph, run.tmp);
        const golden = readExpected(name).diagnostics as Diagnostic[];
        const actual = graph.diagnostics;

        const goldenKeys = golden.map((d) => `${d.code}`);
        const actualKeys = actual.map((d) => `${d.code}`);

        let green = true;
        for (const d of actual) {
          const idx = goldenKeys.indexOf(d.code);
          if (idx >= 0) {
            goldenKeys.splice(idx, 1);
            bump(d.code, "tp");
          } else {
            bump(d.code, "fp");
            green = false;
          }
        }
        for (const code of goldenKeys) {
          bump(code, "fn");
          green = false;
        }
        perScenario.push({ name, green });
        expect(actualKeys, `scenario ${name}: diagnostics differ from golden`).toEqual(golden.map((d) => d.code));
      } finally {
        run.cleanup();
      }
    }

    const lines = ["", "=== DevinScope eval score ==="];
    for (const s of perScenario) lines.push(`  ${s.green ? "green" : "RED  "} ${s.name}`);
    for (const [code, s] of [...perClass.entries()].sort()) {
      const precision = s.tp / (s.tp + s.fp || 1);
      const recall = s.tp / (s.tp + s.fn || 1);
      lines.push(`  ${code.padEnd(24)} precision ${precision.toFixed(2)}  recall ${recall.toFixed(2)}`);
    }
    console.log(lines.join("\n"));

    expect(perScenario.every((s) => s.green)).toBe(true);
  });
});
