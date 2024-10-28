import { $, sleep } from "bun";
import { join } from "path";
import * as fs from "fs";
import { Database } from "bun:sqlite";

const homePath = process.env.HOME || "~";
const DB_PATH = `${homePath}/.bgrun/processes.sqlite`;

// Ensure .bgrun directory exists
if (!fs.existsSync(`${homePath}/.bgrun`)) {
  await $`mkdir -p ${homePath}/.bgrun`.nothrow();
}

// Initialize database
const db = new Database(DB_PATH, { create: true });
db.query(`
  CREATE TABLE IF NOT EXISTS processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid INTEGER, 
    workdir TEXT,
    command TEXT,
    name TEXT UNIQUE,
    env TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Parse environment variables string
function parseEnvString(envString: string): Record<string, string> {
  const env: Record<string, string> = {};
  const pairs = envString.split(",");
  pairs.forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      env[key] = value;
    }
  });
  return env;
}

// Check if process is running
async function isProcessRunning(pid: number): Promise<boolean> {
  const result = await $`ps -p ${pid}`.nothrow().text();
  return result.includes(`${pid}`);
}

async function main() {
  const processName = process.argv[3];
  if (!processName) {
    console.error("❌ Error: Process name required");
    console.error("Usage: bun run guard-restart.ts keep-alive <process-name>");
    process.exit(1);
  }

  console.log(`🔄 Starting keep-alive monitor for "${processName}"`);
  
  const delay = 30 * 1000; // Check every 30 seconds

  while (true) {
    try {
      // Get process record from database
      const process = db.query(
        `SELECT * FROM processes WHERE name = ? ORDER BY timestamp DESC LIMIT 1`
      ).get(processName) as any;

      if (!process) {
        console.error(`❌ No process found with name '${processName}'`);
        process.exit(1);
      }

      // Check if process is running
      const running = await isProcessRunning(process.pid);

      if (!running) {
        console.log(`⚠️ Process "${processName}" (PID: ${process.pid}) is down, restarting...`);

        // Start new process
        const newProcess = Bun.spawn(process.command.split(" "), {
          env: { ...process.env, ...parseEnvString(process.env) },
          cwd: process.workdir,
          stdout: Bun.file(join(homePath, ".bgrun", `${process.name}-stdout.txt`)),
          stderr: Bun.file(join(homePath, ".bgrun", `${process.name}-stderr.txt`)),
        });

        // Update database with new process info
        db.query(`DELETE FROM processes WHERE pid = ?`).run(process.pid);
        db.query(
          `INSERT INTO processes (pid, workdir, command, name, env) VALUES (?, ?, ?, ?, ?)`
        ).run(
          newProcess.pid,
          process.workdir,
          process.command,
          process.name,
          process.env
        );

        console.log(`✅ Restarted process with new PID ${newProcess.pid}`);
      } else {
        console.log(`✅ Process "${processName}" (PID: ${process.pid}) is running`);
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
    }

    await sleep(delay);
  }
}

if (import.meta.path === Bun.main) {
  main();
}