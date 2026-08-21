import { execa } from "execa";

/**
 * Build dist/cli.js exactly once per test run. CLI contract tests spawn the
 * bundle as a subprocess; per-file beforeAll builds race in parallel CI
 * workers (tsdown `clean: true` wipes dist mid-build → empty/corrupt output).
 */
export default async function globalSetup(): Promise<void> {
  await execa("pnpm", ["build"], { cwd: new URL("..", import.meta.url).pathname, stdio: "inherit" });
}
