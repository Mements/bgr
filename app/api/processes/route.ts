import { getAllProcesses, getProcess } from '../../../src/db';
import { isProcessRunning } from '../../../src/platform';
import { parseEnvString, calculateRuntime } from '../../../src/utils';

export async function GET() {
    const procs = getAllProcesses();
    // Enrich with live status and runtime
    const enriched = await Promise.all(procs.map(async (p: any) => {
        const running = await isProcessRunning(p.pid);
        const envVars = parseEnvString(p.env);
        return {
            ...p,
            running,
            runtime: calculateRuntime(p.timestamp),
            envVars
        };
    }));
    return Response.json(enriched);
}
