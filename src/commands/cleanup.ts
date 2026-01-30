
import { getProcess, removeProcessByName, removeProcess, getAllProcesses, removeAllProcesses } from "../db";
import { isProcessRunning, terminateProcess } from "../platform";
import { announce, error } from "../logger";
import type { ProcessRecord } from "../types";
import * as fs from "fs";

export async function handleDelete(name: string) {
    const process = getProcess(name); // Wrapper or raw query needed if getProcess doesn't return full type
    // getProcess returns ProcessRecord | null

    if (!process) {
        error(`No process found named '${name}'`);
        // error calls process.exit(1), so we return but TS doesn't know. 
        return;
    }

    const isRunning = await isProcessRunning(process.pid);
    if (isRunning) {
        await terminateProcess(process.pid);
    }

    if (fs.existsSync(process.stdout_path)) {
        try { fs.unlinkSync(process.stdout_path); } catch { }
    }
    if (fs.existsSync(process.stderr_path)) {
        try { fs.unlinkSync(process.stderr_path); } catch { }
    }

    removeProcessByName(name);
    announce(`Process '${name}' has been ${isRunning ? 'stopped and ' : ''}deleted`, "Process Deleted");
}

export async function handleClean() {
    const processes = getAllProcesses();
    let cleanedCount = 0;
    let deletedLogs = 0;

    for (const proc of processes) {
        const running = await isProcessRunning(proc.pid);
        if (!running) {
            removeProcess(proc.pid);
            cleanedCount++;

            if (fs.existsSync(proc.stdout_path)) {
                try { fs.unlinkSync(proc.stdout_path); deletedLogs++; } catch { }
            }
            if (fs.existsSync(proc.stderr_path)) {
                try { fs.unlinkSync(proc.stderr_path); deletedLogs++; } catch { }
            }
        }
    }

    if (cleanedCount === 0) {
        announce("No stopped processes found to clean.", "Clean Complete");
    } else {
        announce(
            `Cleaned ${cleanedCount} stopped ${cleanedCount === 1 ? 'process' : 'processes'} and removed ${deletedLogs} log ${deletedLogs === 1 ? 'file' : 'files'}.`,
            "Clean Complete"
        );
    }
}

export async function handleDeleteAll() {
    const processes = getAllProcesses();
    if (processes.length === 0) {
        announce("There are no processes to delete.", "Delete All");
        return;
    }
    for (const proc of processes) {
        const running = await isProcessRunning(proc.pid);
        if (running) {
            await terminateProcess(proc.pid);
        }
    }

    // Use SatiDB helper
    removeAllProcesses();

    announce("All processes have been stopped and deleted.", "Delete All");
}
