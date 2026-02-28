/**
 * BGR Dashboard Server
 * 
 * Uses Melina.js to serve the dashboard app with file-based routing.
 * All API endpoints and page rendering are handled by the dashboard/app/ directory.
 * 
 * Port selection is handled entirely by Melina:
 *   - If BUN_PORT env var is set → uses that (explicit, will fail if busy)
 *   - Otherwise → defaults to 3000, falls back to next available if busy
 */
import path from 'path';

export async function startServer() {
    // Dynamic import to avoid melina's side-effect console.log at bundle load time
    const { start } = await import('melina');
    const appDir = path.join(import.meta.dir, '../dashboard/app');

    // Only pass port when BUN_PORT is explicitly set.
    // When omitted, Melina defaults to 3000 with auto-fallback to next available port.
    const explicitPort = process.env.BUN_PORT ? parseInt(process.env.BUN_PORT, 10) : undefined;
    await start({
        appDir,
        defaultTitle: 'bgrun Dashboard - Process Manager',
        globalCss: path.join(appDir, 'globals.css'),
        ...(explicitPort !== undefined && { port: explicitPort }),
    });
}
