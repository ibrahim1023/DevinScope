# ADR-0001: Single-package ESM-only layered kernel

**Status:** Accepted (2026-08-21)
**Context:** v0.1 needs a portable npm CLI with fast iteration and fixture-heavy tests (product-spec §26–27). Options considered: (A) single package with enforced layer direction, (B) pnpm monorepo splitting `@devinscope/core` from the CLI, (C) compiled single binary via pkg/sea.

**Decision:** Approach A. One package, `"type": "module"`, Node ≥ 24, strict unidirectional imports: `cli → render → snapshots/diff → diagnostics → resolution → runtime → adapters/parsers → platform`. Layer direction is enforced by an ESLint `no-restricted-imports` boundary rule, not by package boundaries.

**Consequences:**
- (+) Zero publishing/versioning overhead; one `npx devinscope` entry point (spec §37).
- (+) ESM-only halves the build matrix; justified because we control the only consumer (the CLI) and Node 24 is the floor.
- (−) Module discipline relies on lint, not the package manager. Accepted at v0.1 size; revisit if an external consumer of the engine appears (then reconsider B).
- Rejected: B (YAGNI — no standalone engine consumer; the future Devin plugin, spec §35, shells out to the CLI), C (build-matrix pain, no v0.1 benefit, contradicts spec §26).
