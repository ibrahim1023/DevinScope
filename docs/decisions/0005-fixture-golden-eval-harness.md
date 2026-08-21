# ADR-0005: Fixture corpus is the test suite *and* the eval harness

**Status:** Accepted (2026-08-21)
**Context:** Product-spec §31 mandates fixture-driven tests: input filesystem + expected runtime graph + expected diagnostics. Because the product is deterministic, the same corpus doubles as the evaluation harness — no LLM evals are meaningful for exact-output software.

**Decision:** Each scenario is a directory `fixtures/<scenario>/` containing the input files, `expected.graph.json`, `expected.diagnostics.json`, and (for CLI-level scenarios) `expected.output.txt`. The harness copies the fixture to a temp dir, normalizes volatile values (absolute paths → `<ROOT>`/`<HOME>`, timestamps, hash salts), runs discovery→diagnostics, and compares with `toMatchFileSnapshot`-style file comparison. CI runs the corpus as a blocking gate on macOS/Linux/Windows. Golden updates require `pnpm test:golden:update` + reviewed diff; CI never auto-updates.

**Consequences:**
- (+) One artifact serves unit tests, regression gate, and the dogfood/demo repo (spec §39 is itself a fixture).
- (+) Eval "score" is exact: N/N scenarios green, per-diagnostic-class precision/recall over the corpus (see docs/evals.md).
- (−) Goldens can hide bugs if updated carelessly; mitigated by mandatory diff review and explicit per-diagnostic assertions alongside snapshots.
