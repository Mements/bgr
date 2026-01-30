import { SatiDB } from "@ments/db";
import { schemas } from "./schema";
import { getHomeDir, ensureDir } from "./platform";
import { join } from "path";
import { sleep } from "bun";

const homePath = getHomeDir();
const dbName = process.env.DB_NAME ?? "bgr";
const dbPath = join(homePath, ".bgr", `${dbName}_v2.sqlite`);
ensureDir(join(homePath, ".bgr"));

export const db = new SatiDB(dbPath, schemas);

// --- Query Functions ---

export function getProcess(name: string) {
    const results = db.process.findMany({
        where: { name },
        orderBy: { timestamp: 'desc' },
        take: 1
    });
    return results[0] || null;
}

export function getAllProcesses() {
    return db.process.find();
}

// --- Mutation Functions ---

export function insertProcess(data: {
    pid: number;
    workdir: string;
    command: string;
    name: string;
    env: string;
    configPath: string;
    stdout_path: string;
    stderr_path: string;
}) {
    return db.process.insert({
        ...data,
        timestamp: new Date(),
    });
}

export function removeProcess(pid: number) {
    const p = db.process.findOne({ pid });
    if (p) {
        db.process.delete(p.id);
    }
}

export function removeProcessByName(name: string) {
    const processes = db.process.find({ name });
    for (const p of processes) {
        db.process.delete(p.id);
    }
}

export function removeAllProcesses() {
    const all = db.process.find();
    for (const p of all) {
        db.process.delete(p.id);
    }
}

// --- Utilities ---

export async function retryDatabaseOperation<T>(operation: () => T, maxRetries = 5, delay = 100): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return operation();
        } catch (err: any) {
            if (err?.code === 'SQLITE_BUSY' && attempt < maxRetries) {
                await sleep(delay * attempt);
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries reached for database operation');
}
