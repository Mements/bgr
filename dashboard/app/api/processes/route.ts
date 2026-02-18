/**
 * GET /api/processes — Enriched process list
 * 
 * Uses batch subprocess calls (single tasklist + single netstat)
 * instead of per-process calls to avoid subprocess pile-up on Windows.
 * Results are cached for 5 seconds via globalThis.
 */
import { getAllProcesses, calculateRuntime } from 'bgr';
import { $ } from 'bun';

const CACHE_TTL_MS = 5_000;
const SUBPROCESS_TIMEOUT_MS = 4_000;

// Persistent cache across module re-evaluations
const g = globalThis as any;
if (!g.__bgrProcessCache) {
    g.__bgrProcessCache = { data: null, timestamp: 0, inflight: null };
}
const cache = g.__bgrProcessCache;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), SUBPROCESS_TIMEOUT_MS)),
    ]);
}

/** Single tasklist call — returns set of running PIDs */
async function getRunningPids(pids: number[]): Promise<Set<number>> {
    if (pids.length === 0) return new Set();
    try {
        const isWin = process.platform === 'win32';
        if (isWin) {
            const result = await $`tasklist /FO CSV /NH`.nothrow().quiet().text();
            const runningPids = new Set<number>();
            for (const line of result.split('\n')) {
                const match = line.match(/"[^"]*","(\d+)"/);
                if (match) {
                    const pid = parseInt(match[1]);
                    if (pids.includes(pid)) runningPids.add(pid);
                }
            }
            return runningPids;
        } else {
            const result = await $`ps -p ${pids.join(',')} -o pid=`.nothrow().quiet().text();
            const runningPids = new Set<number>();
            for (const line of result.trim().split('\n')) {
                const pid = parseInt(line.trim());
                if (!isNaN(pid)) runningPids.add(pid);
            }
            return runningPids;
        }
    } catch {
        return new Set();
    }
}

/** Single netstat call — returns map of PID → ports */
async function getPortsByPid(pids: number[]): Promise<Map<number, number[]>> {
    const portMap = new Map<number, number[]>();
    if (pids.length === 0) return portMap;
    try {
        const isWin = process.platform === 'win32';
        if (isWin) {
            const result = await $`netstat -ano`.nothrow().quiet().text();
            const pidSet = new Set(pids);
            for (const line of result.split('\n')) {
                const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
                if (match) {
                    const port = parseInt(match[1]);
                    const pid = parseInt(match[2]);
                    if (pidSet.has(pid)) {
                        const existing = portMap.get(pid) || [];
                        if (!existing.includes(port)) existing.push(port);
                        portMap.set(pid, existing);
                    }
                }
            }
        } else {
            const result = await $`ss -tlnp`.nothrow().quiet().text();
            const pidSet = new Set(pids);
            for (const line of result.split('\n')) {
                for (const pid of pidSet) {
                    if (line.includes(`pid=${pid}`)) {
                        const portMatch = line.match(/:(\d+)\s/);
                        if (portMatch) {
                            const port = parseInt(portMatch[1]);
                            const existing = portMap.get(pid) || [];
                            if (!existing.includes(port)) existing.push(port);
                            portMap.set(pid, existing);
                        }
                    }
                }
            }
        }
    } catch { /* ignore */ }
    return portMap;
}

async function fetchProcesses(): Promise<any[]> {
    const procs = getAllProcesses();
    const pids = procs.map((p: any) => p.pid);

    // Two subprocess calls total (not 2×N)
    const [runningPids, portMap] = await Promise.all([
        withTimeout(getRunningPids(pids), new Set<number>()),
        withTimeout(getPortsByPid(pids), new Map<number, number[]>()),
    ]);

    return procs.map((p: any) => {
        const running = runningPids.has(p.pid);
        const ports = running ? (portMap.get(p.pid) || []) : [];
        return {
            name: p.name,
            command: p.command,
            directory: p.workdir,
            pid: p.pid,
            running,
            port: ports.length > 0 ? ports[0] : null,
            ports,
            runtime: calculateRuntime(p.timestamp),
            timestamp: p.timestamp,
        };
    });
}

export async function GET() {
    const now = Date.now();

    // Return cached data if still fresh
    if (cache.data && (now - cache.timestamp) < CACHE_TTL_MS) {
        return Response.json(cache.data);
    }

    // Deduplicate concurrent requests
    if (!cache.inflight) {
        cache.inflight = fetchProcesses().then(result => {
            cache.data = result;
            cache.timestamp = Date.now();
            cache.inflight = null;
            return result;
        }).catch(err => {
            cache.inflight = null;
            throw err;
        });
    }

    const result = await cache.inflight;
    return Response.json(result);
}
