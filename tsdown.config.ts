import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { cli: "src/cli/index.ts" },
  format: ["esm"],
  dts: false,
  minify: false,
  banner: { js: "#!/usr/bin/env node" },
  outExtensions: () => ({ js: ".js" }),
});
