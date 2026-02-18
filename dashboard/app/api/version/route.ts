/**
 * GET /api/version — Return BGR version
 */
import { getVersion } from 'bgr';

export async function GET() {
    return Response.json({ version: await getVersion() });
}
