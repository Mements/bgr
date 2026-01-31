#!/usr/bin/env bun

import { parseArgs } from "util";
import { getVersion } from "./utils";
import { handleRun } from "./commands/run";
import { showAll } from "./commands/list";
import { handleDelete, handleClean, handleDeleteAll } from "./commands/cleanup";
import { handleWatch } from "./commands/watch";
import { showLogs } from "./commands/logs";
import { showDetails } from "./commands/details";
import { handleDashboard } from "./commands/dashboard";
import type { CommandOptions } from "./types";
import { error, announce } from "./logger";
import dedent from "dedent";
import chalk from "chalk";

async function showHelp() {
  const usage = dedent`
    ${chalk.bold('bgr - Bun: Background Runner')}
    ${chalk.gray('═'.repeat(50))}

    ${chalk.yellow('Usage:')}
      bgr [name] [options]

    ${chalk.yellow('Commands:')}
      bgr                     List all processes
      bgr [name]             Show details for a process
      bgr --dashboard        Start web dashboard
      bgr --delete [name]    Delete a process
      bgr --restart [name]   Restart a process
      bgr --clean            Remove all stopped processes
      bgr --nuke             Delete ALL processes

    ${chalk.yellow('Options:')}
      --name <string>        Process name (required for new)
      --command <string>     Process command (required for new)
      --directory <path>     Working directory (required for new)
      --config <path>        Config file (default: .config.toml)
      --watch                Watch for file changes and auto-restart
      --force                Force restart existing process
      --fetch                Fetch latest git changes before running
      --json                 Output in JSON format
      --filter <group>       Filter list by BGR_GROUP
      --logs                 Show logs
      --log-stdout           Show only stdout logs
      --log-stderr           Show only stderr logs
      --lines <n>            Number of log lines to show (default: all)
      --version              Show version
      --dashboard            Start web dashboard (alias: --server)
      --port <number>        Port for web dashboard (default: 3001)
      --help                 Show this help message

    ${chalk.yellow('Examples:')}
      bgr --dashboard
      bgr --name myapp --command "bun run dev" --directory . --watch
      bgr myapp --logs --lines 50
  `;
  console.log(usage);
}

// Re-running parseArgs logic properly
async function run() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      name: { type: 'string' },
      command: { type: 'string' },
      directory: { type: 'string' },
      config: { type: 'string' },
      watch: { type: 'boolean' },
      force: { type: 'boolean' },
      fetch: { type: 'boolean' },
      delete: { type: 'boolean' },
      nuke: { type: 'boolean' },
      restart: { type: 'boolean' },
      clean: { type: 'boolean' },
      json: { type: 'boolean' },
      logs: { type: 'boolean' },
      "log-stdout": { type: 'boolean' },
      "log-stderr": { type: 'boolean' },
      lines: { type: 'string' },
      filter: { type: 'string' },
      version: { type: 'boolean' },
      help: { type: 'boolean' },
      db: { type: 'string' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      server: { type: 'boolean' },
      dashboard: { type: 'boolean' },
      port: { type: 'string' },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.dashboard || values.server) {
    const port = values.port ? parseInt(values.port as string) : 3001;
    await handleDashboard(port);
    // keep running
    return;
  }

  if (values.version) {
    console.log(`bgr version: ${await getVersion()}`);
    return;
  }

  if (values.help) {
    await showHelp();
    return;
  }

  // Commands flow
  if (values.nuke) {
    await handleDeleteAll();
    return;
  }

  if (values.clean) {
    await handleClean();
    return;
  }

  const name = (values.name as string) || positionals[0];

  // Delete
  if (values.delete) {
    // bgr --delete (bool)
    if (name) {
      await handleDelete(name);
    } else {
      error("Please specify a process name to delete.");
    }
    return;
  }

  // Restart
  if (values.restart) {
    if (!name) {
      error("Please specify a process name to restart.");
    }
    await handleRun({
      action: 'run',
      name: name,
      force: true,
      // other options undefined, handleRun will look up process
      remoteName: '',
    });
    return;
  }

  // Logs
  if (values.logs || values["log-stdout"] || values["log-stderr"]) {
    if (!name) {
      error("Please specify a process name to show logs for.");
    }
    const logType = values["log-stdout"] ? 'stdout' : (values["log-stderr"] ? 'stderr' : 'both');
    const lines = values.lines ? parseInt(values.lines as string) : undefined;
    await showLogs(name, logType, lines);
    return;
  }

  // Watch
  if (values.watch) {
    await handleWatch({
      action: 'watch',
      name: name,
      command: values.command as string | undefined,
      directory: values.directory as string | undefined,
      configPath: values.config as string | undefined,
      force: values.force as boolean | undefined,
      remoteName: '',
      dbPath: values.db as string | undefined,
      stdout: values.stdout as string | undefined,
      stderr: values.stderr as string | undefined
    }, {
      showLogs: (values.logs as boolean) || false,
      logType: 'both',
      lines: values.lines ? parseInt(values.lines as string) : undefined
    });
    return;
  }

  // List or Run or Details
  if (name) {
    if (!values.command && !values.directory) {
      await showDetails(name);
    } else {
      await handleRun({
        action: 'run',
        name: name,
        command: values.command as string | undefined,
        directory: values.directory as string | undefined,
        configPath: values.config as string | undefined,
        force: values.force as boolean | undefined,
        fetch: values.fetch as boolean | undefined,
        remoteName: '',
        dbPath: values.db as string | undefined,
        stdout: values.stdout as string | undefined,
        stderr: values.stderr as string | undefined
      });
    }
  } else {
    if (values.command) {
      error("Process name is required.");
    }
    await showAll({
      json: values.json as boolean | undefined,
      filter: values.filter as string | undefined
    });
  }
}

run().catch(err => {
  console.error(chalk.red(err));
  process.exit(1);
});
