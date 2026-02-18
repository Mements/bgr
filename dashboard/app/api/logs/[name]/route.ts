/**
 * GET /api/logs/:name — Read last 100 lines of process stdout/stderr
 */
import { getProcess, readFileTail } from 'bgr';

export async function GET(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);
    const proc = getProcess(name);

    if (!proc) {
        return Response.json({ error: 'Process not found' }, { status: 404 });
    }

    const stdout = await readFileTail(proc.stdout_path, 100);
    const stderr = await readFileTail(proc.stderr_path, 100);
    return Response.json({ stdout, stderr });
}
