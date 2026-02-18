/**
 * DELETE /api/processes/:name — Stop and remove a process
 */
import { getProcess, removeProcessByName, isProcessRunning, terminateProcess } from 'bgr';

export async function DELETE(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);
    const proc = getProcess(name);

    if (!proc) {
        return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (await isProcessRunning(proc.pid)) {
        await terminateProcess(proc.pid);
    }
    removeProcessByName(name);
    return Response.json({ success: true });
}
