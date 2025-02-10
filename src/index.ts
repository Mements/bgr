import { $, sleep } from "bun";
import { join } from "path";
import * as fs from "fs";
import { Database } from "bun:sqlite";
import { parseArgs } from "util";
import boxen from "boxen";
import chalk from "chalk";
import dedent from "dedent";

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

async function terminateProcess(pid: number): Promise<void> {
  await $`kill ${pid}`.nothrow();
}

function formatEnvKey(key: string): string {
  return key.toUpperCase().replace(/\./g, '_');
}

function flattenConfig(obj: any, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenConfig(obj[key], fullKey));
    } else {
      acc[formatEnvKey(fullKey)] = Array.isArray(obj[key]) ? obj[key].join(',') : String(obj[key]);
    }
    return acc;
  }, {});
}

async function parseConfigFile(configPath: string): Promise<Record<string, string>> {
  const parsedConfig = await import(configPath).then(m => m.default);
  return flattenConfig(parsedConfig);
}

// todo: it should also delete logs files
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
      // Delete the process from database
      db.query(`DELETE FROM processes WHERE pid = ?`).run(proc.pid);
      cleanedCount++;

      // Delete associated log files if they exist
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

// todo: implement another command "bgr --clean" to delete only those processes which are not running anymore plus delete their logs files 

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

async function showAll() {
  const processes = db.query(`SELECT * FROM processes`).all() as ProcessRecord[];
  const status: Record<number, string> = {};
  for (const process of processes) {
    status[process.pid] = await isProcessRunning(process.pid) 
      ? chalk.green.bold("● Running") 
      : chalk.red.bold("○ Stopped");
  }
  
  announce("📋 Currently Monitored Processes", "Process List");
  console.table(processes.map(process => ({
    ID: chalk.blue(process.id),
    PID: chalk.yellow(process.pid),
    Name: chalk.cyan(process.name),
    Command: process.command,
    Directory: chalk.gray(process.workdir),
    Status: status[process.pid],
    Runtime: chalk.magenta(calculateRuntime(process.timestamp))
  })));
}

async function showDetails(name: string) {
  const process = db.query(`SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`).get(name) as ProcessRecord;
  if (!process) {
    error(`No process found named '${name}'`);
  }

  const isRunning = await isProcessRunning(process.pid);
  const runtime = calculateRuntime(process.timestamp);
  const envVars = parseEnvString(process.env);

  const details = `
${chalk.bold('Process Details:')}
${chalk.gray('═'.repeat(50))}
${chalk.cyan.bold('Name:')} ${process.name}
${chalk.yellow.bold('PID:')} ${process.pid}
${chalk.bold('Status:')} ${isRunning ? chalk.green.bold("● Running") : chalk.red.bold("○ Stopped")}
${chalk.magenta.bold('Runtime:')} ${runtime}
${chalk.blue.bold('Working Directory:')} ${process.workdir}
${chalk.white.bold('Command:')} ${process.command}
${chalk.gray.bold('Config Path:')} ${process.configPath}
${chalk.green.bold('Stdout Path:')} ${process.stdout_path}
${chalk.red.bold('Stderr Path:')} ${process.stderr_path}

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
        await sleep(delay * attempt); // Exponential backoff
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
  if (configPath) {
    const newConfigEnv = await parseConfigFile(join(finalDirectory, configPath));
    finalEnv = { ...finalEnv, ...newConfigEnv };
  }

  const stdoutPath = stdout || join(homePath, ".bgr", `${name}-out.txt`);
  Bun.write(stdoutPath, '');
  const stderrPath = stderr || join(homePath, ".bgr", `${name}-err.txt`);
  Bun.write(stderrPath, '');

  const newProcess = Bun.spawn(finalCommand.split(" "), {
    env: { ...Bun.env, ...finalEnv },
    cwd: finalDirectory,
    stdout: Bun.file(stdoutPath),
    stderr: Bun.file(stderrPath)
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
        Object.entries(finalEnv).map(([k,v]) => `${k}=${v}`).join(","),
        configPath!,
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

async function hasRunningProcesses(): Promise<boolean> {
  const processes = db.query(`SELECT pid FROM processes`).all() as ProcessRecord[];
  return processes.length > 0;
}

async function showHelp() {
  const usage = dedent`
    ${chalk.bold('bgr - Background Process Manager')}
    ${chalk.gray('═'.repeat(50))}

    ${chalk.cyan.bold('Commands:')}
    
    1. Process Management
    ${chalk.gray('─'.repeat(30))}
    List all processes:
    $ bgr
    
    View process details:
    $ bgr <process-name>
    $ bgr --name <process-name>
    
    Start new process:
    $ bgr --name <process-name> --directory <path> --command "<command>"
    
    Restart process:
    $ bgr <process-name> --restart
    
    Delete process (by name):
    $ bgr --delete <process-name>
    
    Delete ALL processes:
    $ bgr --nuke

    2. Optional Parameters
    ${chalk.gray('─'.repeat(30))}
    --config    <path>     Config file for environment variables (default: .config.toml)
    --force               Force restart if process is running
    --fetch              Pull latest git changes before running
    --stdout    <path>    Custom stdout log path
    --stderr    <path>    Custom stderr log path
    --db        <path>    Custom database file path
    --help               Show this help message
    --nuke               Delete all processes (use with caution!)

    3. Environment
    ${chalk.gray('─'.repeat(30))}
    Default database location: ~/.bgr/bgr.sqlite
    Default log location: ~/.bgr/<process-name>-{out|err}.txt
    
    ${chalk.bold('Examples:')}
    Start a Node.js application:
    $ bgr --name myapp --directory ~/projects/myapp --command "npm start"
    
    Restart with latest changes:
    $ bgr myapp --restart --fetch
    
    Use custom database:
    $ bgr --db ~/custom/path/mydb.sqlite
    
    Start with custom config:
    $ bgr --name myapp --config custom.config.toml --directory ./app
  `;
  announce(usage, "BGR Usage Guide");
}



async function main() {
  const args = parseArgs({
    args: Bun.argv,
    options: {
      remote: { type: "string", default: "origin" },
      directory: { type: "string" },
      command: { type: "string" },
      name: { type: "string" },
      config: { type: "string" },
      force: { type: "boolean" },
      fetch: { type: "boolean" },
      stdout: { type: "string" },
      stderr: { type: "string" },
      help: { type: "boolean" },
      restart: { type: "boolean" },
      delete: { type: "boolean" },
      db: { type: "string" },
      nuke: { type: "boolean" },
      clean: { type: "boolean" },
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
  console.log("processName ==> ", processName);

  let action: string;
  if (args.values.help) {
    action = 'help';
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
    configPath: args.values.config || '.config.toml',
    action,
    force: args.values.force,
    fetch: args.values.fetch,
    stdout: args.values.stdout,
    stderr: args.values.stderr,
    dbPath: args.values.db,
    env: {}
  };

  if (options.configPath && options.directory) {
    const configEnv = await parseConfigFile(join(options.directory, options.configPath));
    options.env = configEnv;
  }

  try {
    switch (action) {
      case 'help':
        await showHelp();
        break;

      case 'show-all':
        if (await hasRunningProcesses()) {
          await showAll();
        } else {
          announce(
            "No running processes found. Use the following commands to get started:",
            "Welcome to BGR"
          );
          await showHelp();
        }
        break;

      case 'show-details':
        await showDetails(options.name!);
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