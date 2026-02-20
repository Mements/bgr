/**
 * GET /api/debug — Debug info about BGR internals
 * 
 * Returns DB path, BGR home dir, platform info for diagnostics.
 */
import { getDbInfo } from 'bgrun';

export async function GET() {
    const info = getDbInfo();
    return Response.json({
        ...info,
        platform: process.platform,
        bun: Bun.version,
        pid: process.pid,
        cwd: process.cwd(),
    });
}
