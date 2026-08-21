import { describe, it } from "vitest";
import { listFixtures, normalizeGraph, runFixture, writeExpected } from "../fixtures/harness.js";

/**
 * Golden generator: writes expected.graph.json / expected.diagnostics.json
 * for every fixture. Run via `pnpm test:golden:update`, then REVIEW the
 * git diff before committing (docs/testing.md). Never runs in CI.
 */
const UPDATE = process.env.UPDATE_FIXTURES === "1";

describe.runIf(UPDATE)("generate fixture goldens", () => {
  for (const name of listFixtures()) {
    it(`writes goldens for ${name}`, async () => {
      const run = await runFixture(name);
      try {
        writeExpected(name, normalizeGraph(run.graph, run.tmp));
      } finally {
        run.cleanup();
      }
    });
  }
});
