#!/usr/bin/env bun

import { $, sleep } from "bun";
import path, { join } from "path";
import * as fs from "fs";
import { Database } from "bun:sqlite";
import { parseArgs } from "util";
import boxen from "boxen";
import chalk from "chalk";
import dedent from "dedent";
import { renderProcessTable, ProcessTableRow } from "./table";
import { getVersion } from './version.macro.ts' with { type: 'macro' };

interface CommandOptions {
  remoteName: string;
  command?: string;
  directory?: string;
  env?: Record<string, string>;
  configPath?: string;
  action: string;
  name?: string;
  force?: boolean;
  fetch?: boolean;
  stdout?: string;
  stderr?: string;
  dbPath?: string;
}

interface ProcessRecord {
  id: number;
  pid: number;
  workdir: string;
  command: string;
  name: string;
  env: string;
  timestamp: string;
  configPath?: string;
  stdout_path: string;
  stderr_path: string;
}

const homePath = (await $`echo $HOME`.text()).trim();
const dbName = process.env.DB_NAME ?? "bgr";
const dbPath = `${homePath}/.bgr/${dbName}.sqlite`;

if (!fs.existsSync(`${homePath}/.bgr`)) {
  await $`mkdir -p ${homePath}/.bgr`.nothrow();
}

let db = new Database(dbPath, { create: true });
db.query(`
  CREATE TABLE IF NOT EXISTS processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER,
    workdir TEXT,
    command TEXT,
    name TEXT UNIQUE,
    env TEXT,
    configPath TEXT,
    stdout_path TEXT,
    stderr_path TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function announce(message: string, title?: string) {
  console.log(
    boxen(chalk.white(message), {
      padding: 1,
      margin: 1,
      borderColor: 'green',
      title: title || "bgr",
      titleAlignment: 'center',
      borderStyle: 'round'
    })
  );
}

function error(message: string) {
  console.error(
    boxen(chalk.red(message), {
      padding: 1,
      margin: 1,
      borderColor: 'red',
      title: "Error",
      titleAlignment: 'center',
      borderStyle: 'double'
    })
  );
  process.exit(1);
}

function parseEnvString(envString: string): Record<string, string> {
  const env: Record<string, string> = {};
  envString.split(",").forEach(pair => {
    const [key, value] = pair.split("=");
    if (key && value) env[key] = value;
  });
  return env;
}

function validateDirectory(directory: string) {
  if (!directory || !fs.existsSync(directory) || !fs.existsSync(join(directory, ".git"))) {
    console.log(chalk.red("❌ Error: 'directory' must be a valid Git repository path."));
    process.exit(1);
  }
}

function calculateRuntime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  const diffInMinutes = Math.floor((now - start) / (1000 * 60));
  return `${diffInMinutes} minutes`;
}

async function isProcessRunning(pid: number): Promise<boolean> {
  const result = await $`ps -p ${pid}`.nothrow().text();
  return result.includes(`${pid}`);
}

async function terminateProcess(pid: number, force: boolean = false): Promise<void> {
  const signal = force ? 'KILL' : 'TERM';

  // @note kill children of "sh -c" wrapper
  let childrenResult = await $`ps --no-headers -o pid --ppid ${pid}`.nothrow().text();
  const children = childrenResult.trim().split('\n').filter(p => p.trim()).map(p => parseInt(p)).filter(n => !isNaN(n));

  for (const childPid of children) {
    await $`kill -${signal} ${childPid}`.nothrow();
  }

  // @note sh -c will quit after its children killed
  await sleep(500);
}

async function killProcessOnPort(port: number): Promise<void> {
  try {
    const result = await $`lsof -ti :${port}`.nothrow().text();
    if (result.trim()) {
      const pids = result.trim().split('\n').filter(pid => pid);
      for (const pid of pids) {
        await $`kill ${pid}`.nothrow();
        console.log(`Killed process ${pid} using port ${port}`);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not check or kill process on port ${port}: ${error}`);
  }
}

function formatEnvKey(key: string): string {
  return key.toUpperCase().replace(/\./g, '_');
}

function flattenConfig(obj: any, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const value = obj[key];
    const newPrefix = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const indexedPrefix = `${newPrefix}.${index}`;
        if (typeof item === 'object' && item !== null) {
          Object.assign(acc, flattenConfig(item, indexedPrefix));
        } else {
          acc[formatEnvKey(indexedPrefix)] = String(item);
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(acc, flattenConfig(value, newPrefix));
    } else {
      acc[formatEnvKey(newPrefix)] = String(value);
    }
    return acc;
  }, {});
}


async function parseConfigFile(configPath: string): Promise<Record<string, string>> {
  // @note t suffix solves caching issue with env variables when using --watch flag
  const importPath = `${configPath}?t=${Date.now()}`;
  const parsedConfig = await import(importPath).then(m => m.default);
  return flattenConfig(parsedConfig);
}

async function handleDelete(name: string) {
  const process = db.query(`SELECT * FROM processes WHERE name = ?`).get(name) as ProcessRecord;
  if (!process) {
    error(`No process found named '${name}'`);
  }

  const isRunning = await isProcessRunning(process.pid);
  if (isRunning) {
    await terminateProcess(process.pid);
  }

  if (fs.existsSync(process.stdout_path)) {
    fs.unlinkSync(process.stdout_path);
  }
  if (fs.existsSync(process.stderr_path)) {
    fs.unlinkSync(process.stderr_path);
  }

  db.query(`DELETE FROM processes WHERE name = ?`).run(name);
  announce(`Process '${name}' has been ${isRunning ? 'stopped and ' : ''}deleted`, "Process Deleted");
}

async function handleClean() {
  const processes = db.query(`SELECT * FROM processes`).all() as ProcessRecord[];
  let cleanedCount = 0;
  let deletedLogs = 0;

  for (const proc of processes) {
    const running = await isProcessRunning(proc.pid);
    if (!running) {
      db.query(`DELETE FROM processes WHERE pid = ?`).run(proc.pid);
      cleanedCount++;

      if (fs.existsSync(proc.stdout_path)) {
        fs.unlinkSync(proc.stdout_path);
        deletedLogs++;
      }
      if (fs.existsSync(proc.stderr_path)) {
        fs.unlinkSync(proc.stderr_path);
        deletedLogs++;
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

async function handleDeleteAll() {
  const processes = db.query(`SELECT * FROM processes`).all() as ProcessRecord[];
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
  db.query(`DELETE FROM processes`).run();
  announce("All processes have been stopped and deleted.", "Delete All");
}

async function showAll(opts?: { json?: boolean; filter?: string }) {
  const processes = db.query(`SELECT * FROM processes`).all() as ProcessRecord[];

  // Apply filter by env.BGR_GROUP if provided
  const filtered = processes.filter((proc) => {
    if (!opts?.filter) return true;
    const envVars = parseEnvString(proc.env);
    return envVars["BGR_GROUP"] === opts.filter;
  });

  if (opts?.json) {
    // JSON output with filtered env variables
    const jsonData: any[] = [];

    for (const proc of filtered) {
      const isRunning = await isProcessRunning(proc.pid);
      const envVars = parseEnvString(proc.env);

      jsonData.push({
        pid: proc.pid,
        name: proc.name,
        status: isRunning ? "running" : "stopped",
        env: envVars,
      });
    }

    console.log(JSON.stringify(jsonData, null, 2));
    return;
  }

  // Table output
  const tableData: ProcessTableRow[] = [];

  for (const proc of filtered) {
    const isRunning = await isProcessRunning(proc.pid);
    const runtime = calculateRuntime(proc.timestamp);

    tableData.push({
      id: proc.id,
      pid: proc.pid,
      name: proc.name,
      command: proc.command,
      workdir: proc.workdir,
      status: isRunning
        ? chalk.green.bold("● Running")
        : chalk.red.bold("○ Stopped"),
      runtime: runtime,
    });
  }

  if (tableData.length === 0) {
    if (opts?.filter) {
      announce(`No processes matched filter BGR_GROUP='${opts.filter}'.`, "No Matches");
    } else {
      announce("No processes found.", "Empty");
    }
    return;
  }

  const tableOutput = renderProcessTable(tableData, {
    padding: 1,
    borderStyle: "rounded",
    showHeaders: true,
  });
  console.log(tableOutput);

  const runningCount = tableData.filter((p) => p.status.includes("Running")).length;
  const stoppedCount = tableData.filter((p) => p.status.includes("Stopped")).length;
  console.log(
    chalk.cyan(
      `Total: ${tableData.length} processes (${chalk.green(`${runningCount} running`)}, ${chalk.red(`${stoppedCount} stopped`)})`
    )
  );
}

async function showLogs(name: string, logType: 'stdout' | 'stderr' | 'both' = 'both', lines?: number) {
  const proc = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(name) as ProcessRecord;
  if (!proc) {
    error(`No process found named '${name}'`);
  }

  if (logType === 'both' || logType === 'stdout') {
    console.log(chalk.green.bold(`📄 Stdout logs for ${name}:`));
    console.log(chalk.gray('═'.repeat(50)));

    if (fs.existsSync(proc.stdout_path)) {
      try {
        const tailCmd = lines ? `tail -n ${lines} "${proc.stdout_path}"` : `cat "${proc.stdout_path}"`;
        // @note "sh -c" wrapper allows to pass complex commands with unescaped symbols
        const output = await $`sh -c ${tailCmd}`.text();
        console.log(output || chalk.gray('(no output)'));
      } catch (error) {
        console.log(chalk.red(`Error reading stdout: ${error}`));
      }
    } else {
      console.log(chalk.gray('(log file not found)'));
    }

    if (logType === 'both') {
      console.log('\n');
    }
  }

  if (logType === 'both' || logType === 'stderr') {
    console.log(chalk.red.bold(`📄 Stderr logs for ${name}:`));
    console.log(chalk.gray('═'.repeat(50)));

    if (fs.existsSync(proc.stderr_path)) {
      try {
        const tailCmd = lines ? `tail -n ${lines} "${proc.stderr_path}"` : `cat "${proc.stderr_path}"`;
        const output = await $`sh -c ${tailCmd}`.text();
        console.log(output || chalk.gray('(no errors)'));
      } catch (error) {
        console.log(chalk.red(`Error reading stderr: ${error}`));
      }
    } else {
      console.log(chalk.gray('(log file not found)'));
    }
  }
}

async function showDetails(name: string) {
  const proc = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(name) as ProcessRecord;
  if (!proc) {
    error(`No process found named '${name}'`);
  }

  const isRunning = await isProcessRunning(proc.pid);
  const runtime = calculateRuntime(proc.timestamp);
  const envVars = parseEnvString(proc.env);

  const details = `
${chalk.bold('Process Details:')}
${chalk.gray('═'.repeat(50))}
${chalk.cyan.bold('Name:')} ${proc.name}
${chalk.yellow.bold('PID:')} ${proc.pid}
${chalk.bold('Status:')} ${isRunning ? chalk.green.bold("● Running") : chalk.red.bold("○ Stopped")}
${chalk.magenta.bold('Runtime:')} ${runtime}
${chalk.blue.bold('Working Directory:')} ${proc.workdir}
${chalk.white.bold('Command:')} ${proc.command}
${chalk.gray.bold('Config Path:')} ${proc.configPath}
${chalk.green.bold('Stdout Path:')} ${proc.stdout_path}
${chalk.red.bold('Stderr Path:')} ${proc.stderr_path}

${chalk.bold('🔧 Environment Variables:')}
${chalk.gray('═'.repeat(50))}
${Object.entries(envVars)
      .map(([key, value]) => `${chalk.cyan.bold(key)} = ${chalk.yellow(value)}`)
      .join('\n')}
`;
  announce(details, `Process Details: ${name}`);
}

async function retryDatabaseOperation<T>(operation: () => T, maxRetries = 5, delay = 100): Promise<T> {
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

async function handleRun(options: CommandOptions) {
  const { command, directory, env, name, configPath, force, fetch, stdout, stderr } = options;

  const existingProcess = name ? db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(name) as ProcessRecord : null;

  if (existingProcess) {
    const finalDirectory = directory || existingProcess.workdir;
    validateDirectory(finalDirectory);
    $.cwd(finalDirectory);

    if (fetch) {
      try {
        await $`git fetch origin`;
        const localHash = (await $`git rev-parse HEAD`.text()).trim();
        const remoteHash = (await $`git rev-parse origin/$(git rev-parse --abbrev-ref HEAD)`.text()).trim();

        if (localHash !== remoteHash) {
          await $`git pull origin $(git rev-parse --abbrev-ref HEAD)`;
          announce("📥 Pulled latest changes", "Git Update");
        }
      } catch (err) {
        error(`Failed to pull latest changes: ${err}`);
      }
    }

    const isRunning = await isProcessRunning(existingProcess.pid);
    if (isRunning && !force) {
      error(`Process '${name}' is currently running. Use --force to restart.`);
    }

    if (isRunning) {
      await terminateProcess(existingProcess.pid);
      announce(`🔥 Terminated existing process '${name}'`, "Process Terminated");
    }

    await retryDatabaseOperation(() =>
      db.query(`DELETE FROM processes WHERE pid = ?`).run(existingProcess.pid)
    );
  } else {
    if (!directory || !name || !command) {
      error("'directory', 'name', and 'command' parameters are required for new processes.");
    }
    validateDirectory(directory!);
    $.cwd(directory);
  }

  const finalCommand = command || existingProcess!.command;
  const finalDirectory = directory || (existingProcess?.workdir!);
  let finalEnv = env || (existingProcess ? parseEnvString(existingProcess.env) : {});

  let finalConfigPath: string | undefined | null;
  if (configPath !== undefined) {
    finalConfigPath = configPath;
  } else if (existingProcess) {
    finalConfigPath = existingProcess.configPath;
  } else {
    finalConfigPath = '.config.toml';
  }

  if (finalConfigPath) {
    const fullConfigPath = join(finalDirectory, finalConfigPath);

    if (await Bun.file(fullConfigPath).exists()) {
      try {
        const newConfigEnv = await parseConfigFile(fullConfigPath);
        finalEnv = { ...finalEnv, ...newConfigEnv };
        console.log(`Loaded config from ${finalConfigPath}`);
      } catch (err: any) {
        console.warn(`Warning: Failed to parse config file ${finalConfigPath}: ${err.message}`);
      }
    } else {
      console.log(`Config file '${finalConfigPath}' not found, continuing without it.`);
    }
  }

  // BUN_PORT kill logic when force flag is used
  if (force) {
    const bunPort = finalEnv.BUN_PORT || process.env.BUN_PORT;
    if (bunPort) {
      const port = parseInt(bunPort.toString());
      if (!isNaN(port)) {
        await killProcessOnPort(port);
      }
    }
  }

  const stdoutPath = stdout || join(homePath, ".bgr", `${name}-out.txt`);
  Bun.write(stdoutPath, '');
  const stderrPath = stderr || join(homePath, ".bgr", `${name}-err.txt`);
  Bun.write(stderrPath, '');

  const newProcess = Bun.spawn(["sh", "-c", finalCommand], {
    env: { ...Bun.env, ...finalEnv },
    cwd: finalDirectory,
    stdout: Bun.file(stdoutPath),
    stderr: Bun.file(stderrPath),
  });

  newProcess.unref();
  const timestamp = new Date().toISOString();

  await retryDatabaseOperation(() =>
    db.query(
      `INSERT INTO processes (pid, workdir, command, name, env, configPath, stdout_path, stderr_path, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newProcess.pid,
      finalDirectory,
      finalCommand,
      name!,
      Object.entries(finalEnv).map(([k, v]) => `${k}=${v}`).join(","),
      finalConfigPath || '',
      stdoutPath,
      stderrPath,
      timestamp
    )
  );

  announce(
    `${existingProcess ? '🔄 Restarted' : '🚀 Launched'} process "${name}" with PID ${newProcess.pid}`,
    "Process Started"
  );
}

function tailFile(path: string, prefix: string, colorFn: (s: string) => string, lines?: number): () => void {
  let position = 0;
  let lastPartial = '';

  const fd = fs.openSync(path, 'r');

  const printNewContent = () => {
    const stats = fs.statSync(path);
    if (stats.size <= position) return;

    const buffer = Buffer.alloc(stats.size - position);
    fs.readSync(fd, buffer, 0, buffer.length, position);

    let content = buffer.toString();
    content = lastPartial + content;
    lastPartial = '';

    const lineArray = content.split(/\r?\n/);
    if (!content.endsWith('\n')) {
      lastPartial = lineArray.pop() || '';
    }

    lineArray.forEach(line => {
      if (line) {
        console.log(colorFn(prefix + line));
      }
    });

    position = stats.size;
  };

  const watcher = fs.watch(path, { persistent: true }, (event) => {
    if (event === 'change') {
      printNewContent();
    }
  });

  printNewContent(); // Check immediately

  return () => {
    watcher.close();
    fs.closeSync(fd);
  };
}

async function handleWatch(options: CommandOptions, logOptions: { showLogs: boolean; logType: 'stdout' | 'stderr' | 'both', lines?: number }) {
  let currentProcess: ProcessRecord | null = null;
  let isRestarting = false;
  let debounceTimeout: Timer | null = null;
  let tailStops: (() => void)[] = [];
  let lastRestartPath: string | null = null; // Track if restart was due to file change

  const dumpLogsIfDead = async (proc: ProcessRecord, reason: string) => {
    const isDead = !(await isProcessRunning(proc.pid));
    if (!isDead) return false;

    console.log(chalk.yellow(`💀 Process '${options.name}' died immediately after ${reason}—dumping logs:`));

    const readAndDump = (path: string, color: ChalkInstance, label: string) => {
      try {
        if (fs.existsSync(path)) {
          const content = fs.readFileSync(path, 'utf8').trim();
          if (content) {
            console.log(`${color.bold(label)}:\n${color(content)}\n`);
          } else {
            console.log(`${color(label)}: (empty)`);
          }
        }
      } catch (err) {
        console.warn(chalk.gray(`Could not read ${label} log: ${err}`));
      }
    };

    if (logOptions.logType === 'both' || logOptions.logType === 'stdout') {
      readAndDump(proc.stdout_path, chalk.white, '📄 Stdout');
    }
    if (logOptions.logType === 'both' || logOptions.logType === 'stderr') {
      readAndDump(proc.stderr_path, chalk.red, '📄 Stderr');
    }

    return true;
  };

  const waitForLogReady = (logPath: string, timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const checkReady = (): boolean => {
        try {
          if (fs.existsSync(logPath)) {
            const stat = fs.statSync(logPath);
            if (stat.size > 0) {
              return true;
            }
          }
        } catch {
          // Ignore errors during check
        }
        return false;
      };

      if (checkReady()) {
        resolve();
        return;
      }

      const dir = path.dirname(logPath);
      const filename = path.basename(logPath);
      const watcher = fs.watch(dir, (eventType, changedFilename) => {
        if (changedFilename === filename && eventType === 'change') {
          if (checkReady()) {
            watcher.close();
            resolve();
          }
        }
      });

      // Fallback timeout to avoid indefinite hangs on silent failures
      setTimeout(() => {
        watcher.close();
        reject(new Error(`Log file ${logPath} did not become ready within ${timeoutMs}ms`));
      }, timeoutMs);
    });
  };

  const startTails = async (): Promise<(() => void)[]> => {
    const stops: (() => void)[] = [];

    if (!logOptions.showLogs || !currentProcess) return stops;

    console.log(chalk.gray("\n" + '─'.repeat(50) + "\n"));

    if (logOptions.logType === 'both' || logOptions.logType === 'stdout') {
      console.log(chalk.green.bold(`📄 Tailing stdout for ${options.name}:`));
      console.log(chalk.gray('═'.repeat(50)));
      try {
        await waitForLogReady(currentProcess.stdout_path);
      } catch (err) {
        console.warn(chalk.yellow(`⚠️  Stdout log not ready yet for ${options.name}—starting tail anyway: ${err.message}`));
      }
      const stop = tailFile(currentProcess.stdout_path, '', chalk.white, logOptions.lines);
      stops.push(stop);
    }

    if (logOptions.logType === 'both' || logOptions.logType === 'stderr') {
      console.log(chalk.red.bold(`📄 Tailing stderr for ${options.name}:`));
      console.log(chalk.gray('═'.repeat(50)));
      try {
        await waitForLogReady(currentProcess.stderr_path);
      } catch (err) {
        console.warn(chalk.yellow(`⚠️  Stderr log not ready yet for ${options.name}—starting tail anyway: ${err.message}`));
      }
      const stop = tailFile(currentProcess.stderr_path, '', chalk.red, logOptions.lines);
      stops.push(stop);
    }

    return stops;
  };

  const restartProcess = async (path?: string) => {
    if (isRestarting) return;
    isRestarting = true;
    const restartReason = path ? `restart (change in ${path})` : 'initial start';
    lastRestartPath = path || null;

    tailStops.forEach(stop => stop());
    tailStops = [];

    console.clear();
    announce(`🔄 Restarting process '${options.name}'... [${restartReason}]`, "Watch Mode");

    try {
      await handleRun({ ...options, force: true });
      currentProcess = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(options.name) as ProcessRecord;

      if (!currentProcess) {
        error(`Failed to find process '${options.name}' after restart.`);
        return;
      }

      // Quick post-mortem if it died on startup
      const died = await dumpLogsIfDead(currentProcess, restartReason);
      if (died) {
        if (lastRestartPath) {
          console.log(chalk.yellow(`⚠️  Compile error on change—pausing restarts until manual fix.`));
          return; // Avoid loop on bad code
        } else {
          error(`Failed to start process '${options.name}'. Aborting watch mode.`);
          return;
        }
      }

      tailStops = await startTails();
    } catch (err) {
      error(`Error during restart: ${err}`);
    } finally {
      isRestarting = false;
      if (currentProcess) {
        console.log(chalk.cyan(`\n👀 Watching for file changes in: ${currentProcess.workdir}`));
      }
    }
  };

  // Initial start
  console.clear();
  announce(`🚀 Starting initial process '${options.name}' in watch mode...`, "Watch Mode");
  await handleRun(options);
  currentProcess = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(options.name) as ProcessRecord;

  if (!currentProcess) {
    error(`Could not start or find process '${options.name}'. Aborting watch mode.`);
    return;
  }

  // Quick post-mortem if initial died
  const initialDied = await dumpLogsIfDead(currentProcess, 'initial start');
  if (initialDied) {
    error(`Failed to start process '${options.name}'. Aborting watch mode.`);
    return;
  }

  tailStops = await startTails();

  const workdir = currentProcess.workdir;
  console.log(chalk.cyan(`\n👀 Watching for file changes in: ${workdir}`));

  const watcher = fs.watch(workdir, { recursive: true }, (eventType, filename) => {
    if (filename == null) return;
    const fullPath = join(workdir, filename);
    if (fullPath.includes(".git") || fullPath.includes("node_modules")) return;
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => restartProcess(fullPath), 500);
  });

  const cleanup = async () => {
    console.log(chalk.magenta('\nSIGINT received...'));
    watcher.close();
    tailStops.forEach(stop => stop());
    if (debounceTimeout) clearTimeout(debounceTimeout);

    const procToKill = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(options.name) as ProcessRecord;
    if (procToKill) {
      const isRunning = await isProcessRunning(procToKill.pid);
      if (isRunning) {
        // @note avoid "await terminateProcess(procToKill.pid)" because we can re-attach --watch mode to running process
        console.log(`process ${procToKill.name} (PID: ${procToKill.pid}) still running`);
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

async function hasRunningProcesses(): Promise<boolean> {
  const processes = db.query(`SELECT pid FROM processes`).all() as ProcessRecord[];
  return processes.length > 0;
}

async function showVersion() {
  // getVersion() is replaced by the actual version string at build time
  announce(`bgr version: ${await getVersion()}`, "Version");
}

async function showHelp() {
  const usage = dedent`
    ${chalk.bold('bgr - Bun: Background Runner')}
    ${chalk.gray('═'.repeat(50))}

    ${chalk.cyan.bold('Commands:')}

    1. Process Management
    ${chalk.gray('─'.repeat(30))}
    List all processes:
    $ bgr

    List processes filtered by group (matches env BGR_GROUP):
    $ bgr --filter <group-name>

    List processes in JSON format (optionally filtered by group):
    $ bgr --json
    $ bgr --json --filter <group-name>

    View process details:
    $ bgr <process-name>
    $ bgr --name <process-name>

    View process logs:
    $ bgr <process-name> --logs
    $ bgr <process-name> --logs --log-stdout --lines 50

    Start new process:
    $ bgr --name <process-name> --directory <path> --command "<command>"

    Restart process:
    $ bgr <process-name> --restart

    Delete process (by name):
    $ bgr --delete <process-name>

    Delete ALL processes:
    $ bgr --nuke

    Clean stopped processes:
    $ bgr --clean

    2. Optional Parameters
    ${chalk.gray('─'.repeat(30))}
    --version      Show the installed version of bgr
    --watch        Watch for file changes and restart the process automatically
    --config       <path>     Config file for environment variables (default: .config.toml)
    --force        Force restart if process is running
    --fetch        Pull latest git changes before running
    --stdout       <path>     Custom stdout log path
    --stderr       <path>     Custom stderr log path
    --db           <path>     Custom database file path
    --json         Output in JSON format
    --filter       <group>    Filter instances where env BGR_GROUP equals <group>
    --logs         Show process logs
    --log-stdout   Show only stdout logs
    --log-stderr   Show only stderr logs
    --lines        <number>   Number of lines to show from logs
    --help         Show this help message
    --nuke         Delete all processes (use with caution!)

    3. Environment
    ${chalk.gray('─'.repeat(30))}
    Default database location: ~/.bgr/bgr.sqlite
    Default log location: ~/.bgr/<process-name>-{out|err}.txt

    ${chalk.bold('Examples:')}
    Start a Node.js application:
    $ bgr --name myapp --directory ~/projects/myapp --command "npm start"

    Watch a process and show logs on restart:
    $ bgr --name myapp --dir . --command "bun run dev" --watch --logs

    Restart with latest changes:
    $ bgr myapp --restart --fetch

    Check the version:
    $ bgr --version
  `;
  announce(usage, "BGR Usage Guide");
}

async function main() {
  const args = parseArgs({
    args: Bun.argv,
    options: {
      remote: { type: "string", default: "origin" },
      directory: { type: "string", short: "d" },
      command: { type: "string", short: "c" },
      name: { type: "string", short: "n" },
      config: { type: "string" },
      force: { type: "boolean", short: "f" },
      fetch: { type: "boolean" },
      stdout: { type: "string" },
      stderr: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      restart: { type: "boolean", short: "r" },
      delete: { type: "boolean" },
      db: { type: "string" },
      nuke: { type: "boolean" },
      clean: { type: "boolean" },
      json: { type: "boolean" },
      logs: { type: "boolean", short: "l" },
      "log-stdout": { type: "boolean" },
      "log-stderr": { type: "boolean" },
      lines: { type: "string" },
      filter: { type: "string" },
      watch: { type: "boolean", short: "w" },
    },
    allowPositionals: true
  });

  if (args.values.db) {
    const customDbDir = join(args.values.db, "..");
    if (!fs.existsSync(customDbDir)) {
      await $`mkdir -p ${customDbDir}`.nothrow();
    }
    db = new Database(args.values.db, { create: true });
    db.query(`
      CREATE TABLE IF NOT EXISTS processes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pid INTEGER,
        workdir TEXT,
        command TEXT,
        name TEXT UNIQUE,
        env TEXT,
        configPath TEXT,
        stdout_path TEXT,
        stderr_path TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }

  const processName = args.positionals[2];
  let action: string;

  if (args.values.watch) {
    action = 'watch';
  } else if (args.values.help) {
    action = 'help';
  } else if (args.values.version) {
    action = 'version';
  } else if (args.values.nuke) {
    action = 'delete-all';
  } else if (args.values.clean) {
    action = 'clean';
  } else if (args.values.delete) {
    if (processName || args.values.name) {
      action = 'delete';
    } else {
      error("Please specify a process name to delete or use --nuke to delete all processes");
    }
  } else if (args.values.restart) {
    action = 'run';
    args.values.force = true;
  } else if (args.values.command) {
    action = 'run';
  } else if (args.values.logs && (processName || args.values.name)) {
    action = 'logs';
  } else if (processName || args.values.name) {
    action = 'show-details';
  } else {
    action = 'show-all';
  }

  const options: CommandOptions = {
    remoteName: args.values.remote!,
    directory: args.values.directory,
    command: args.values.command,
    name: processName || args.values.name,
    configPath: args.values.config,
    action,
    force: args.values.force,
    fetch: args.values.fetch,
    stdout: args.values.stdout,
    stderr: args.values.stderr,
    dbPath: args.values.db,
    env: {}
  };

  try {
    switch (action) {
      case 'help':
        await showHelp();
        break;
      case 'version':
        await showVersion();
        break;
      case 'show-all':
        if (await hasRunningProcesses()) {
          await showAll({ json: !!args.values.json, filter: args.values.filter });
        } else {
          announce(
            `No running processes found. Use the following commands to get started:
Tip: you can start processes with BGR_GROUP set to group them, e.g. BGR_GROUP=api bgr ...`,
            "Welcome to BGR"
          );
          await showHelp();
        }
        break;
      case 'show-details':
        await showDetails(options.name!);
        break;
      case 'logs':
        const logType = args.values['log-stdout'] ? 'stdout' :
          args.values['log-stderr'] ? 'stderr' : 'both';
        const lineCount = args.values.lines ? parseInt(args.values.lines) : undefined;
        await showLogs(options.name!, logType, lineCount);
        break;
      case 'watch':
        const existingProcess = options.name ? db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(options.name) as ProcessRecord : null;
        if (!existingProcess && (!options.name || !options.command || !options.directory)) {
          error("Watch mode requires '--name', '--command', and '--directory' for the initial run.");
        }
        // In watch mode, logs are ALWAYS shown (hardcoded to true)
        const watchLogType = args.values['log-stdout'] ? 'stdout' : args.values['log-stderr'] ? 'stderr' : 'both';
        const watchLineCount = args.values.lines ? parseInt(args.values.lines) : undefined;
        await handleWatch(options, { showLogs: true, logType: watchLogType, lines: watchLineCount });
        break;
      case 'run':
        await handleRun(options);
        break;
      case 'delete':
        await handleDelete(options.name!);
        break;
      case 'delete-all':
        await handleDeleteAll();
        break;
      case 'clean':
        await handleClean();
        break;
      default:
        error("Invalid action specified");
    }
  } catch (err) {
    error(`Unexpected error: ${err}`);
  }
}

if (import.meta.path === Bun.main) {
  main();
}
