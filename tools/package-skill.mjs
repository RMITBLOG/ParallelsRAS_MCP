import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { zipSync } from "fflate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "build", "skill-cli.js");
const skillRoot = path.join(root, ".agents", "skills", "parallels-ras");
const script = path.join(skillRoot, "scripts", "ras-query.mjs");
const archive = path.join(root, "skill-packages", "parallels-ras-skill.zip");

const bundle = await build({
  entryPoints: [entry],
  outfile: script,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  minify: true,
  legalComments: "none",
  metafile: true,
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "silent",
});

const bundledDependencies = Object.values(bundle.metafile.outputs)
  .flatMap((output) => Object.entries(output.inputs))
  .filter(([input, details]) =>
    details.bytesInOutput > 0 && input.includes("@modelcontextprotocol"));
if (bundledDependencies.length > 0) {
  throw new Error("Standalone skill unexpectedly contains MCP runtime code");
}

const fixedTime = new Date("1980-01-01T00:00:00Z");
const files = {
  "parallels-ras/SKILL.md": [new Uint8Array(readFileSync(path.join(skillRoot, "SKILL.md"))), { mtime: fixedTime }],
  "parallels-ras/scripts/ras-query.mjs": [new Uint8Array(readFileSync(script)), { mtime: fixedTime }],
};
mkdirSync(path.dirname(archive), { recursive: true });
writeFileSync(archive, zipSync(files, { level: 9 }));
console.log(`Packaged ${archive}`);
