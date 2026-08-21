import { describe, expect, it } from "vitest";
import { redactEnv, redactText } from "../../src/security/redact.js";

describe("redactText", () => {
  it("redacts GitHub tokens", () => {
    expect(redactText("token is ghp_CANARY123abc")).not.toContain("ghp_CANARY123abc");
  });

  it("redacts OpenAI-style keys", () => {
    expect(redactText("key: sk-CANARYabcdefghijklmnop")).not.toContain("sk-CANARYabcdefghijklmnop");
  });

  it("redacts Slack tokens and bearer credentials", () => {
    expect(redactText("xoxb-CANARY-123-abc")).not.toContain("xoxb-CANARY-123-abc");
    expect(redactText("Authorization: Bearer CANARYtokenvalue123")).not.toContain("CANARYtokenvalue123");
  });

  it("redacts env-style secret assignments", () => {
    const out = redactText('"API_KEY": "supersecretvalue123"');
    expect(out).not.toContain("supersecretvalue123");
    expect(out).toContain("API_KEY");
  });

  it("preserves ${env:VAR} and ${file:...} references structurally", () => {
    const out = redactText('"oauthClientSecret": "${env:MY_MCP_CLIENT_SECRET}"');
    expect(out).toContain("${env:MY_MCP_CLIENT_SECRET}");
    expect(redactText('"${file:/path/to/secret}"')).toContain("${file:/path/to/secret}");
  });

  it("does not redact ordinary prose", () => {
    const text = "Always run the complete test suite.";
    expect(redactText(text)).toBe(text);
  });
});

describe("redactEnv", () => {
  it("maps values to configured/missing markers", () => {
    expect(redactEnv({ GITHUB_TOKEN: "ghp_x", EMPTY: "" })).toEqual({
      GITHUB_TOKEN: "configured",
      EMPTY: "missing",
    });
  });

  it("keeps env references as configured without exposing targets", () => {
    expect(redactEnv({ SECRET: "${env:REAL}" }).SECRET).toBe("configured");
  });
});
