import { getVersion } from '../../../src/utils';

export async function GET() {
    return Response.json({ version: await getVersion() });
}
