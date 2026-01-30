
import { error, announce } from "../logger";
import { getProcess } from "../db";
import { isProcessRunning, calculateRuntime, parseEnvString } from "../utils";
import chalk from "chalk";

export async function showDetails(name: string) {
    const proc = getProcess(name);
    if (!proc) {
        error(`No process found named '${name}'`);
        return;
    }

    const isRunning = await isProcessRunning(proc.pid, proc.command);
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
