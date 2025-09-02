import { file } from 'bun';
import { join } from 'path';

/**
 * Reads the project's version from package.json at build time.
 * The returned value is directly inlined into the bundle.
 */
export async function getVersion(): Promise<string> {
  try {
    const pkgPath = join(import.meta.dir, '../package.json');
    const pkg = await file(pkgPath).json();
    return pkg.version || '0.0.0';
  } catch (err) {
    console.error("Failed to read version from package.json during build:", err);
    return '0.0.0-error';
  }
}