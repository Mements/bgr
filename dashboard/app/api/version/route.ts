/**
 * GET /api/version — Return BGR version
 */
import { getVersion } from 'bgrun';

export async function GET() {
    return Response.json({ version: await getVersion() });
}
