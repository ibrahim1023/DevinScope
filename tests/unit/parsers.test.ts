import { describe, expect, it } from "vitest";
import { parseJsonc, parseSkillFrontmatter } from "../../src/parsers/index.js";

describe("parseJsonc", () => {
  it("parses JSON with comments and trailing commas", () => {
    const r = parseJsonc(`{
      // user defaults
      "agent": { "model": "opus", },
      "permissions": { "allow": ["Read(**)"] }
    }`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.value.agent as Record<string, unknown>).model).toBe("opus");
    }
  });

  it("reports malformed JSON without throwing", () => {
    const r = parseJsonc(`{ "a": }`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("flags unknown top-level fields against a known key set", () => {
    const r = parseJsonc(`{ "permissions": {}, "brandNewField": 1 }`, {
      knownTopLevelKeys: ["permissions", "agent", "hooks", "read_config_from", "mcpServers"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.unknownFields).toEqual(["brandNewField"]);
  });
});

describe("parseSkillFrontmatter", () => {
  it("extracts name, description and body", () => {
    const r = parseSkillFrontmatter(`---
name: review
description: Review code changes
---

Review the current git diff.
`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("review");
      expect(r.value.description).toBe("Review code changes");
      expect(r.value.body.trim()).toBe("Review the current git diff.");
    }
  });

  it("keeps unknown frontmatter keys in raw and unknownFields", () => {
    const r = parseSkillFrontmatter(`---
name: x
model: sonnet
future-field: yes
---

body
`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.raw["future-field"]).toBe("yes");
      expect(r.unknownFields).toContain("future-field");
    }
  });

  it("fails cleanly when frontmatter is missing", () => {
    const r = parseSkillFrontmatter("no frontmatter here");
    expect(r.ok).toBe(false);
  });

  it("fails cleanly when name is missing", () => {
    const r = parseSkillFrontmatter(`---
description: no name
---

body
`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name/i);
  });
});
