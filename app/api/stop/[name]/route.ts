import { getProcess } from '../../../../src/db';
import { isProcessRunning, terminateProcess } from '../../../../src/platform';

export async function POST(req: Request, { params }: { params: { name: string } }) {
    const name = params.name;
    if (name) {
        const proc = getProcess(name);
        if (proc && await isProcessRunning(proc.pid)) {
            await terminateProcess(proc.pid);
            return Response.json({ success: true });
        }
        return Response.json({ error: "Process not found or not running" }, { status: 404 });
    }
    return Response.json({ error: "Name required" }, { status: 400 });
}
