import { EOL } from 'os';

console.log("Starting build process for bgrun...");

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  minify: false,
  // Mark all packages as external to rely on node_modules
  // This avoids bundling native modules or mismatched React versions
  packages: "external",
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

const outFile = result.outputs[0].path;

console.log(`Build successful! Executable created at: ${outFile}`);