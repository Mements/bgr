#!/usr/bin/env bun

// ./Documents/bgr/example/table.ts

import { renderProcessTable, getTerminalWidth } from "../src/table";
import type { ProcessTableRow } from "../src/table";
import chalk from "chalk";

// Sample data to demonstrate truncation and the hybrid view.
// One entry has very long fields to ensure it gets truncated on most screens.
const processes: ProcessTableRow[] = [
  {
    id: 1,
    pid: 12345,
    name: "api-server",
    command: "bun run start",
    workdir: "/home/user/projects/api-server",
    status: chalk.green.bold("● Running"),
    runtime: "45 minutes",
  },
  {
    id: 2,
    pid: 12678,
    name: "long-running-data-processor-service-instance-alpha",
    command: "python -m processor.main --config /etc/processor/config.prod.json --logfile /var/log/processor.log",
    workdir: "/var/opt/services/data-processor/instances/alpha/current",
    status: chalk.green.bold("● Running"),
    runtime: "8 hours",
  },
  {
    id: 3,
    pid: 13990,
    name: "ui-watcher",
    command: "npm run dev",
    workdir: "/home/user/projects/frontend-app",
    status: chalk.green.bold("● Running"),
    runtime: "12 minutes",
  },
  {
    id: 4,
    pid: 9876,
    name: "old-task",
    command: "rake db:migrate",
    workdir: "/home/user/projects/legacy-rails",
    status: chalk.red.bold("○ Stopped"),
    runtime: "2 days ago",
  },
];

const termWidth = getTerminalWidth();
console.log(chalk.bold.blue(`\nTerminal width: ${termWidth} columns\n`));

console.log(chalk.bold.green("--- Rendering Process Table (Hybrid Method) ---"));

// Pass the terminal width to the renderer
const tableOptions = { maxWidth: termWidth };
const tableOutput = renderProcessTable(processes, tableOptions);

console.log(tableOutput);

console.log(chalk.bold.green("\n--- End of Table ---"));