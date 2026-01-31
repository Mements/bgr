import { getProcess } from '../../../../src/db';
import { readFileTail } from '../../../../src/platform';

export async function GET(req: Request, { params }: { params: { name: string } }) {
    const name = params.name;
    if (name) {
        const proc = getProcess(name);
        if (proc) {
            const lines = 100;
            const stdout = await readFileTail(proc.stdout_path, lines);
            const stderr = await readFileTail(proc.stderr_path, lines);
            return Response.json({ stdout, stderr });
        }
        return Response.json({ error: "Process not found" }, { status: 404 });
    }
    return Response.json({ error: "Name required" }, { status: 400 });
}
