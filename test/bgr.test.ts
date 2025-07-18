// test.ts
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import * as fs from "fs/promises";
import { Database } from "bun:sqlite";

// --- Test Configuration ---
const testDir = join(import.meta.dir, "test_env");
const appDir = join(testDir, "my-app");
const dbPath = join(testDir, "test.sqlite");
const scriptPath = join(import.meta.dir, "src", "index.ts");

// --- Helper Functions ---

/** Runs the bgr script as a subprocess with specified arguments. */
const runBgr = async (args: string[]) => {
    const proc = Bun.spawn(
        ["bun", "run", scriptPath, "--db", dbPath, ...args],
        {
            stdout: "pipe",
            stderr: "pipe",
        }
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    return { exitCode, stdout, stderr };
};

/** Cleans up all test artifacts (directories, DB, running processes). */
const cleanup = async () => {
    // Terminate any running test processes recorded in the DB
    try {
        const db = new Database(dbPath);
        const pids = db.query<{ pid: number }, []>(`SELECT pid FROM processes`).all();
        db.close();

        for (const { pid } of pids) {
            try {
                process.kill(pid, 'SIGKILL'); // Force kill
            } catch (e) {
                // Ignore errors if the process is already dead
            }
        }
    } catch (e) { /* Ignore if DB doesn't exist */ }

    // Remove the temporary test directory
    await fs.rm(testDir, { recursive: true, force: true });
};

// --- Test Suite ---

// Setup before all tests run
beforeAll(async () => {
    await cleanup(); // Ensure a clean state
    await fs.mkdir(appDir, { recursive: true });
    // Create a dummy .git directory as required by validateDirectory()
    await fs.mkdir(join(appDir, ".git"), { recursive: true });
});

// Teardown after all tests have run
afterAll(async () => {
    await cleanup();
});

describe("bgr Process Manager Fixes", () => {

    test("Bug 1 Fix: Should start a process successfully when default .config.toml is missing", async () => {
        const args = [
            "--name", "app-no-config",
            "--directory", appDir,
            "--command", "bun --version"
        ];
        const { exitCode, stdout, stderr } = await runBgr(args);

        // Assertions
        expect(stderr).not.toContain("Cannot find module");
        expect(stderr).not.toContain("Error:");
        expect(stdout).toContain("Config file '.config.toml' not found");
        expect(stdout).toContain("🚀 Launched process \"app-no-config\"");
        expect(exitCode).toBe(0);

        // Verify database entry
        const db = new Database(dbPath);
        const proc = db.query(`SELECT * FROM processes WHERE name = ?`).get("app-no-config") as any;
        db.close();

        expect(proc).toBeDefined();
        expect(proc.name).toBe("app-no-config");
        expect(proc.configPath).toBe(".config.toml"); // Should store the default path it looked for
    }, 20000);

    test("Bug 2 Fix: Should remember and use custom config path on restart", async () => {
        // 1. Create a custom config file (using .ts as it's supported by Bun's import)
        const customConfigName = "prod.config.ts";
        const customConfigPath = join(appDir, customConfigName);
        const outLogPath = join(testDir, "app-with-config-out.log");
        await fs.writeFile(customConfigPath, `export default { MY_VAR: "bug_was_fixed" };`);

        // 2. Start the process with the custom config
        const startArgs = [
            "--name", "app-with-config",
            "--directory", appDir,
            "--command", `sh -c 'echo $MY_VAR'`, // Use `sh -c` for var expansion
            "--config", customConfigName,
            "--stdout", outLogPath,
        ];
        const startResult = await runBgr(startArgs);

        expect(startResult.stderr).not.toContain("Error:");
        expect(startResult.stdout).toContain("🚀 Launched process \"app-with-config\"");
        
        // Verify DB entry has the correct custom config path
        let db = new Database(dbPath);
        const proc1 = db.query(`SELECT * FROM processes WHERE name = ?`).get("app-with-config") as any;
        db.close();
        
        expect(proc1).toBeDefined();
        expect(proc1.configPath).toBe(customConfigName);
        
        // Wait for the initial process to write to its log
        await sleep(500);
        
        // 3. Restart the process WITHOUT specifying --config again
        const restartArgs = ["app-with-config", "--restart", "--force"];
        const restartResult = await runBgr(restartArgs);

        expect(restartResult.stderr).not.toContain("Error:");
        expect(restartResult.stdout).toContain(`Loaded config from ${customConfigName}`);
        expect(restartResult.stdout).toContain("🔄 Restarted process \"app-with-config\"");
        
        // 4. Verify the correct config was used by checking the output log.
        // The file should have been truncated and rewritten by the new process.
        await sleep(500);

        const logContent = await fs.readFile(outLogPath, "utf-8");
        expect(logContent.trim()).toBe("bug_was_fixed");

    }, 30000);
});