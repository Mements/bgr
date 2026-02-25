/**
 * GET /api/logs/:name — Read ALL lines of process stdout/stderr
 * Returns full log content + file modification timestamps
 */
import { getProcess } from '../../../../../src/db';
import { stat, readFile } from 'fs/promises';

async function getFileMtime(path: string): Promise<string | null> {
    try {
        const s = await stat(path);
        return s.mtime.toISOString();
    } catch {
        return null;
    }
}

async function readFullFile(path: string): Promise<string> {
    try {
        return await readFile(path, 'utf-8');
    } catch {
        return '';
    }
}

export async function GET(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);
    const proc = getProcess(name);

    if (!proc) {
        return Response.json({ error: 'Process not found' }, { status: 404 });
    }

    const [stdout, stderr, stdoutModified, stderrModified] = await Promise.all([
        readFullFile(proc.stdout_path),
        readFullFile(proc.stderr_path),
        getFileMtime(proc.stdout_path),
        getFileMtime(proc.stderr_path),
    ]);

    return Response.json({
        stdout, stderr,
        stdoutModified, stderrModified,
        stdoutPath: proc.stdout_path,
        stderrPath: proc.stderr_path,
    });
}
