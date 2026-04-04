import { rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });

await build({
  bundle: true,
  entryPoints: ["src/cli.ts"],
  format: "cjs",
  outdir: "dist",
  outExtension: {
    ".js": ".cjs"
  },
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: '#!/usr/bin/env node'
  }
});
