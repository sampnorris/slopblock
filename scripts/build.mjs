import { build } from "esbuild";

await build({
  bundle: true,
  entryPoints: ["src/main.ts", "src/cli.ts"],
  format: "esm",
  outdir: "dist",
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: '#!/usr/bin/env node'
  }
});
