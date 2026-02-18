/**
 * POST /api/stop/:name — Stop a running process
 */
import { getProcess, isProcessRunning, terminateProcess } from 'bgrun';

export async function POST(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);
    const proc = getProcess(name);

    if (!proc || !(await isProcessRunning(proc.pid))) {
        return Response.json({ error: 'Process not found or not running' }, { status: 404 });
    }

    await terminateProcess(proc.pid);
    return Response.json({ success: true });
}
