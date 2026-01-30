/**
 * Cross-platform utility functions for BGR
 * Provides Windows and Unix compatible process management
 */

import * as fs from "fs";
import * as os from "os";
import { $ } from "bun";

/** Detect if running on Windows - use function to prevent bundler tree-shaking */
export function isWindows(): boolean {
  return process.platform === "win32";
}

/**
 * Get the user's home directory cross-platform
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Check if a process with the given PID is running
 * For Docker containers, checks container status instead of PID
 */
export async function isProcessRunning(pid: number, command?: string): Promise<boolean> {
  try {
    // Docker container detection
    if (command && (command.includes('docker run') || command.includes('docker-compose up') || command.includes('docker compose up'))) {
      return await isDockerContainerRunning(command);
    }

    if (isWindows()) {
      // On Windows, use tasklist to check for PID
      const result = await $`tasklist /FI "PID eq ${pid}" /NH`.nothrow().text();
      return result.includes(`${pid}`);
    } else {
      // On Unix, use ps -p
      const result = await $`ps -p ${pid}`.nothrow().text();
      return result.includes(`${pid}`);
    }
  } catch {
    return false;
  }
}

/**
 * Check if a Docker container from a command is running
 */
async function isDockerContainerRunning(command: string): Promise<boolean> {
  try {
    // Extract container name from --name flag
    const nameMatch = command.match(/--name\s+["']?(\S+?)["']?(?:\s|$)/);
    if (nameMatch) {
      const containerName = nameMatch[1];
      const result = await $`docker inspect -f "{{.State.Running}}" ${containerName}`.nothrow().text();
      return result.trim() === 'true';
    }

    // If no --name, try to find running containers that match the image
    // Extract image name (last argument before -d or after -d)
    const imageMatch = command.match(/docker\s+run\s+.*?(?:-d\s+)?(\S+)\s*$/);
    if (imageMatch) {
      const imageName = imageMatch[1];
      const result = await $`docker ps --filter ancestor=${imageName} --format "{{.ID}}"`.nothrow().text();
      return result.trim().length > 0;
    }

    return false;
  } catch {
    return false;
  }
}


/**
 * Get child process PIDs (for termination)
 */
async function getChildPids(pid: number): Promise<number[]> {
  try {
    if (isWindows()) {
      // On Windows, use wmic to get child processes
      const result = await $`wmic process where (ParentProcessId=${pid}) get ProcessId`.nothrow().text();
      return result
        .split('\n')
        .map(line => parseInt(line.trim()))
        .filter(n => !isNaN(n) && n > 0);
    } else {
      // On Unix, use ps --ppid
      const result = await $`ps --no-headers -o pid --ppid ${pid}`.nothrow().text();
      return result
        .trim()
        .split('\n')
        .filter(p => p.trim())
        .map(p => parseInt(p))
        .filter(n => !isNaN(n));
    }
  } catch {
    return [];
  }
}

/**
 * Terminate a process and its children
 */
export async function terminateProcess(pid: number, force: boolean = false): Promise<void> {
  // First, kill children
  const children = await getChildPids(pid);

  for (const childPid of children) {
    try {
      if (isWindows()) {
        if (force) {
          await $`taskkill /F /PID ${childPid}`.nothrow();
        } else {
          await $`taskkill /PID ${childPid}`.nothrow();
        }
      } else {
        const signal = force ? 'KILL' : 'TERM';
        await $`kill -${signal} ${childPid}`.nothrow();
      }
    } catch {
      // Ignore errors for already-dead processes
    }
  }

  // Wait a bit for graceful shutdown
  await Bun.sleep(500);

  // Then kill the parent if still running
  if (await isProcessRunning(pid)) {
    try {
      if (isWindows()) {
        if (force) {
          await $`taskkill /F /PID ${pid}`.nothrow();
        } else {
          await $`taskkill /PID ${pid}`.nothrow();
        }
      } else {
        const signal = force ? 'KILL' : 'TERM';
        await $`kill -${signal} ${pid}`.nothrow();
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Kill processes using a specific port
 */
export async function killProcessOnPort(port: number): Promise<void> {
  try {
    if (isWindows()) {
      // On Windows, use netstat to find processes on port
      const result = await $`netstat -ano | findstr :${port}`.nothrow().text();
      const pids = new Set<number>();

      for (const line of result.split('\n')) {
        const match = line.match(/LISTENING\s+(\d+)/);
        if (match) {
          pids.add(parseInt(match[1]));
        }
      }

      for (const pid of pids) {
        await $`taskkill /F /PID ${pid}`.nothrow();
        console.log(`Killed process ${pid} using port ${port}`);
      }
    } else {
      // On Unix, use lsof
      const result = await $`lsof -ti :${port}`.nothrow().text();
      if (result.trim()) {
        const pids = result.trim().split('\n').filter(pid => pid);
        for (const pid of pids) {
          await $`kill ${pid}`.nothrow();
          console.log(`Killed process ${pid} using port ${port}`);
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not check or kill process on port ${port}: ${error}`);
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the shell command array for spawning a process
 * On Windows uses cmd.exe, on Unix uses sh
 */
export function getShellCommand(command: string): string[] {
  if (isWindows()) {
    return ["cmd", "/c", command];
  } else {
    return ["sh", "-c", command];
  }
}

/**
 * Find the actual child process PID spawned by a shell wrapper
 * Returns the child PID or the original PID if no child found
 */
export async function findChildPid(parentPid: number): Promise<number> {
  try {
    if (isWindows()) {
      // Use PowerShell Get-CimInstance (wmic is deprecated)
      const result = await $`powershell -Command "Get-CimInstance Win32_Process -Filter 'ParentProcessId=${parentPid}' | Select-Object -ExpandProperty ProcessId"`.nothrow().text();
      const pids = result
        .split('\n')
        .map((line: string) => parseInt(line.trim()))
        .filter((n: number) => !isNaN(n) && n > 0);

      // Return first child PID if found
      if (pids.length > 0) {
        return pids[0];
      }
    } else {
      // Unix - use ps to find child
      const result = await $`ps --no-headers -o pid --ppid ${parentPid}`.nothrow().text();
      const childPid = parseInt(result.trim());
      if (!isNaN(childPid) && childPid > 0) {
        return childPid;
      }
    }
  } catch {
    // Ignore errors
  }
  return parentPid;
}


export async function readFileTail(filePath: string, lines?: number): Promise<string> {
  try {
    const content = await Bun.file(filePath).text();

    if (!lines) {
      return content;
    }

    const allLines = content.split(/\r?\n/);
    const tailLines = allLines.slice(-lines);
    return tailLines.join('\n');
  } catch (error) {
    throw new Error(`Error reading file: ${error}`);
  }
}

/**
 * Copy a file from source to destination
 */
export function copyFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest);
}

/**
 * Get memory usage of a process in bytes
 */
export async function getProcessMemory(pid: number): Promise<number> {
  try {
    if (isWindows()) {
      // On Windows, use wmic to get memory
      const result = await $`wmic process where ProcessId=${pid} get WorkingSetSize`.nothrow().text();
      const lines = result.split('\n').filter(line => line.trim() && !line.includes('WorkingSetSize'));
      if (lines.length > 0) {
        return parseInt(lines[0].trim()) || 0;
      }
      return 0;
    } else {
      // On Unix, use ps to get RSS in KB
      const result = await $`ps -o rss= -p ${pid}`.text();
      const memoryKB = parseInt(result.trim());
      return memoryKB * 1024; // Convert to bytes
    }
  } catch {
    return 0;
  }
}

