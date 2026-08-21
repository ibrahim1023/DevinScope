import { redactText } from "../security/redact.js";

/**
 * Structured stderr logging (docs/observability.md). Single-line JSON,
 * stable event names, stdout stays clean. Levels via --verbose/--debug
 * or DEVINSCOPE_LOG=debug|info. All output passes the redaction chokepoint.
 */
type Level = "debug" | "info";

let currentLevel: Level | "off" =
  process.env.DEVINSCOPE_LOG === "debug"
    ? "debug"
    : process.env.DEVINSCOPE_LOG === "info"
      ? "info"
      : "off";

export function setLogLevel(level: Level | "off"): void {
  currentLevel = level;
}

function emit(level: Level, event: string, fields: Record<string, unknown>): void {
  if (currentLevel === "off") return;
  if (currentLevel === "info" && level === "debug") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  process.stderr.write(redactText(line) + "\n");
}

export const log = {
  debug: (event: string, fields: Record<string, unknown> = {}) => emit("debug", event, fields),
  info: (event: string, fields: Record<string, unknown> = {}) => emit("info", event, fields),
};
