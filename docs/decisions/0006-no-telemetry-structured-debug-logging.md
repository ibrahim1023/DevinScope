# ADR-0006: No telemetry; observability = structured debug logging + JSON contract

**Status:** Accepted (2026-08-21)
**Context:** Product-spec §34: 100% local, telemetry only ever as explicit opt-in. We evaluated OpenTelemetry (incl. GenAI semantic conventions) and hosted LLM-observability tooling for the CLI's own diagnostics.

**Decision:** No telemetry, no OTel, no external observability SDK. Observability for a local deterministic CLI means: (1) `--verbose`/`--debug` emit structured, single-line JSON logs to **stderr** with stable event names (`discovery.start`, `adapter.found`, `adapter.error`, `diagnostic.emitted`, …), keeping stdout clean for piping; (2) `--json` is a versioned output contract covered by golden tests; (3) a `DEVINSCOPE_LOG=debug` env equivalent. All log lines pass through `src/security/redact.ts` like any other output.

**Consequences:**
- (+) Aligns with the privacy principle; debuggability comes from reproducible structured logs the user can attach to issues (consistent with redacted snapshots).
- (+) Avoids pinning to OTel GenAI conventions that are Development-status with no stable release (verified 2026-08-21).
- (−) If a future `--semantic` mode (spec §10) ships, this ADR must be revisited for trace capture of LLM calls — that mode would justify OTel or a trace export behind explicit opt-in.
