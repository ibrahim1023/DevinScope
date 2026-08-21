import { describe, expect, it } from "vitest";
import { main } from "../../src/cli/index.js";

describe("cli stub", () => {
  it("prints version with --version", () => {
    expect(main(["node", "devinscope", "--version"])).toBe(0);
  });
});
