import { parse as parseYaml } from "yaml";

export type ParseResult<T> =
  | { ok: true; value: T; unknownFields: string[] }
  | { ok: false; error: string };

/** Strip // and block comments plus trailing commas, then JSON.parse. Never eval. */
export function parseJsonc(
  text: string,
  opts?: { knownTopLevelKeys?: string[] },
): ParseResult<Record<string, unknown>> {
  try {
    const stripped = stripJsonComments(text).replace(/,(\s*[}\]])/g, "$1");
    const value: unknown = JSON.parse(stripped);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "top-level value is not an object" };
    }
    const obj = value as Record<string, unknown>;
    const known = opts?.knownTopLevelKeys;
    const unknownFields = known ? Object.keys(obj).filter((k) => !known.includes(k)) : [];
    return { ok: true, value: obj, unknownFields };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function stripJsonComments(input: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    const next = input[i + 1];
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

export interface SkillFrontmatter {
  name: string;
  description?: string;
  body: string;
  /** Full parsed frontmatter, unknown keys preserved (spec §30). */
  raw: Record<string, unknown>;
}

const KNOWN_SKILL_KEYS = new Set([
  "name",
  "description",
  "allowed-tools",
  "triggers",
  "model",
  "max-nesting",
  "permissions",
]);

export function parseSkillFrontmatter(text: string): ParseResult<SkillFrontmatter> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) {
    return { ok: false, error: "missing --- frontmatter fence" };
  }
  let raw: unknown;
  try {
    raw = parseYaml(match[1]!);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "frontmatter is not a mapping" };
  }
  const fm = raw as Record<string, unknown>;
  if (typeof fm.name !== "string" || fm.name.trim() === "") {
    return { ok: false, error: "frontmatter requires a non-empty 'name'" };
  }
  const unknownFields = Object.keys(fm).filter((k) => !KNOWN_SKILL_KEYS.has(k));
  const value: SkillFrontmatter = {
    name: fm.name,
    body: match[2]!,
    raw: fm,
  };
  if (typeof fm.description === "string") value.description = fm.description;
  return { ok: true, value, unknownFields };
}
