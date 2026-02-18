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
import { start } from 'melina';
import path from 'path';

export async function startServer() {
    const appDir = path.join(import.meta.dir, '../dashboard/app');

    const port = process.env.BUN_PORT ? parseInt(process.env.BUN_PORT, 10) : 3000;
    await start({
        appDir,
        defaultTitle: 'BGR Dashboard - Process Manager',
        globalCss: path.join(appDir, 'globals.css'),
        port,
    });
}
