import { EOL } from 'os';

console.log("Starting build process for bgr...");

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun', // Optimize for the Bun runtime
  format: 'esm',
  minify: true, // Minify for smaller file size
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