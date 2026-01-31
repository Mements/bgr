import { getProcess, removeProcessByName } from '../../../../src/db';
import { isProcessRunning, terminateProcess } from '../../../../src/platform';

export async function DELETE(req: Request, { params }: { params: { name: string } }) {
    const name = params.name;
    if (name) {
        const proc = getProcess(name);
        if (proc) {
            if (await isProcessRunning(proc.pid)) {
                await terminateProcess(proc.pid);
            }
            removeProcessByName(name);
            return Response.json({ success: true });
        }
        return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: "Name required" }, { status: 400 });
}
