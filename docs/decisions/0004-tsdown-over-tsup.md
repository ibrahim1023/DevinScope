# ADR-0004: tsdown (not tsup) for the CLI build

**Status:** Accepted (2026-08-21)
**Context:** Initial preference was tsup (largest community, stable). Research on 2026-08-21 found the tsup repository README carries an official notice: "This project is not actively maintained anymore. Please consider using tsdown instead." tsdown (Rolldown-based, by the Vite/Rolldown org) is ESM-first, API-compatible, and provides a dedicated tsup migration command.

**Decision:** Build with tsdown: single ESM entry `src/cli/index.ts` → `dist/cli.js`, `dts: false` (CLI, no library consumers), shebang banner preserved, `minify: false` for debuggable stack traces, `clean: true` (tsdown default).

**Consequences:**
- (+) Maintained toolchain aligned with the Vite/Rolldown ecosystem; ESM-first output avoids tsup's known extension-emission holes under `"type": "module"`.
- (−) Younger than tsup (~0.5M vs ~6M weekly downloads). Risk contained: build is one config file; reverting to tsup is a one-line swap if tsdown fails us.
