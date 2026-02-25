/**
 * GET /api/logs/:name — Read process stdout/stderr logs
 *
 * Supports incremental loading via query params:
 *   ?tab=stdout|stderr   — which log to read (default: stdout)
 *   ?offset=N            — byte offset to start reading from (default: 0 = full file)
 *
 * Returns:
 *   { text, size, mtime, filePath }
 *
 * On first call (offset=0), returns full file content.
 * On subsequent calls (offset=previousSize), returns only new bytes.
 * Client uses `size` as the offset for the next request.
 */
import { getProcess } from '../../../../../src/db';
import { stat, open } from 'fs/promises';

interface FileInfo {
    text: string;
    size: number;
    mtime: string | null;
    filePath: string;
}

async function readLogFile(path: string, offset: number): Promise<FileInfo> {
    try {
        const s = await stat(path);
        const size = s.size;
        const mtime = s.mtime.toISOString();

        // If offset >= current size, no new data
        if (offset >= size) {
            return { text: '', size, mtime, filePath: path };
        }

        // Read from offset to end
        const handle = await open(path, 'r');
        try {
            const bytesToRead = size - offset;
            const buffer = Buffer.alloc(bytesToRead);
            await handle.read(buffer, 0, bytesToRead, offset);
            return { text: buffer.toString('utf-8'), size, mtime, filePath: path };
        } finally {
            await handle.close();
        }
    } catch {
        return { text: '', size: 0, mtime: null, filePath: path };
    }
}

export async function GET(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);
    const proc = getProcess(name);

    if (!proc) {
        return Response.json({ error: 'Process not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const tab = url.searchParams.get('tab') || 'stdout';
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;

    const path = tab === 'stderr' ? proc.stderr_path : proc.stdout_path;
    const info = await readLogFile(path, offset);

    return Response.json(info);
}
