import { CommandOptions } from "../types";
import { getProcess, removeProcess, retryDatabaseOperation, insertProcess } from "../db";
import { isProcessRunning, terminateProcess, getHomeDir, getShellCommand, killProcessOnPort, findChildPid } from "../platform";
import { error, announce } from "../logger";
import { validateDirectory, parseEnvString } from "../utils";
import { parseConfigFile } from "../config";
import { $ } from "bun";
import { sleep } from "bun";
import { join } from "path";

const homePath = getHomeDir();

export async function handleRun(options: CommandOptions) {
    const { command, directory, env, name, configPath, force, fetch, stdout, stderr } = options;

    const existingProcess = name ? getProcess(name) : null;

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

        // Use retry wrapper from DB?
        // Using raw SQLite for now to match index.ts logic
        await retryDatabaseOperation(() =>
            removeProcess(existingProcess.pid)
        );
    } else {
        if (!directory || !name || !command) {
            error("'directory', 'name', and 'command' parameters are required for new processes.");
        }
        validateDirectory(directory!);
        $.cwd(directory!);
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

    const newProcess = Bun.spawn(getShellCommand(finalCommand!), {
        env: { ...Bun.env, ...finalEnv },
        cwd: finalDirectory,
        stdout: Bun.file(stdoutPath),
        stderr: Bun.file(stderrPath),
    });

    newProcess.unref();
    // Give shell a moment to spawn child, then find PID before shell exits
    await sleep(100);
    // Find the actual child PID (shell wrapper exits immediately after spawning)
    const actualPid = await findChildPid(newProcess.pid);
    // Wait more for subprocess to initialize
    await sleep(400);

    await retryDatabaseOperation(() =>
        insertProcess({
            pid: actualPid,
            workdir: finalDirectory,
            command: finalCommand!,
            name: name!,
            env: Object.entries(finalEnv).map(([k, v]) => `${k}=${v}`).join(","),
            configPath: finalConfigPath || '',
            stdout_path: stdoutPath,
            stderr_path: stderrPath,
        })
    );

    announce(
        `${existingProcess ? '🔄 Restarted' : '🚀 Launched'} process "${name}" with PID ${newProcess.pid}`,
        "Process Started"
    );
}
