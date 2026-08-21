/**
 * Single redaction chokepoint (spec §23). Every renderer, snapshot writer
 * and debug log passes output through here. Secrets render as markers:
 * configured | missing | redacted — never values.
 */
export type SecretState = "configured" | "missing" | "redacted";

export const SECRET_PATTERNS: RegExp[] = [
  /\bghp_[A-Za-z0-9]{8,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, // JWT
];

const ENVISH_KEY = /(TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL)/i;
const REFERENCE = /^\$\{(env:[^}]+|file:[^}]+)\}$/;

function redactEnvAssignments(input: string): string {
  // "API_KEY": "value"  /  API_KEY=value  /  API_KEY: value
  const MARKERS = new Set(["configured", "missing", "redacted", "<redacted>"]);
  return input.replace(
    /(["']?[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)[A-Za-z0-9_]*["']?\s*[:=]\s*)["']?(\$\{(?:env|file):[^}]+\}|[^"'\s,}]+)["']?/gi,
    (m, prefix: string, value: string) =>
      REFERENCE.test(value) || MARKERS.has(value) ? m : `${prefix}"<redacted>"`,
  );
}

export function redactText(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "<redacted>");
  }
  return redactEnvAssignments(out);
}

/** Map an env object to presence markers. Values never survive. */
export function redactEnv(env: Record<string, string>): Record<string, SecretState> {
  const out: Record<string, SecretState> = {};
  for (const [key, value] of Object.entries(env)) {
    out[key] = value.trim() === "" ? "missing" : "configured";
  }
  return out;
}

/** Is this key name one whose value must never be printed? */
export function isSecretKey(key: string): boolean {
  return ENVISH_KEY.test(key);
}
