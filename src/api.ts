/**
 * BGR Public API (package: bgrun)
 * 
 * Import from 'bgrun' to use these functions in your own process-managing apps.
 * 
 * @example
 * ```ts
 * import { getAllProcesses, isProcessRunning, handleRun } from 'bgrun'
 * 
 * // List all managed processes
 * const processes = getAllProcesses()
 * 
 * // Check if a process is running
 * const alive = await isProcessRunning(process.pid)
 * 
 * // Start a new managed process
 * await handleRun({ name: 'my-app', command: 'bun run dev', directory: './my-app', action: 'run', remoteName: '' })
 * ```
 */

// --- Database Operations ---
export { db, getAllProcesses, getProcess, insertProcess, removeProcess, removeProcessByName, removeAllProcesses, retryDatabaseOperation } from './db'

// --- Process Operations ---
export { isProcessRunning, terminateProcess, readFileTail, getProcessPorts, findChildPid, findPidByPort, getShellCommand, killProcessOnPort, waitForPortFree, ensureDir, getHomeDir, isWindows } from './platform'

// --- High-Level Commands ---
export { handleRun } from './commands/run'

// --- Utilities ---
export { getVersion, calculateRuntime, parseEnvString, validateDirectory } from './utils'
