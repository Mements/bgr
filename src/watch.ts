import { existsSync, readFileSync } from "fs";
import path from "path";
import { $, sleep } from "bun";
import { watch } from "fs/promises";

function parseArgs() {
  const args = process.argv.slice(2);
  const options: { [key: string]: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        options[key] = value;
        i++;
      } else {
        console.log(`🚫 Missing value for option: --${key}`);
        process.exit(1);
      }
    } else if (args[i].startsWith("-")) {
      const key = args[i].slice(1);
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        options[key] = value;
        i++;
      } else {
        console.log(`🚫 Missing value for option: -${key}`);
        process.exit(1);
      }
    }
  }

  return options;
}

// Parse named arguments
const argv = parseArgs();

// Extract path, command, and mode from arguments
const pathToWatch = argv.path || argv.p;
const command = argv.command || argv.c;
const mode = argv.mode || argv.m;

// Validate required arguments
if (!pathToWatch || !command || !mode) {
  console.log("🚫 --path, --command, and --mode options are required. Please provide them and try again.");
  process.exit(1);
}

// Check if the path is valid
if (!existsSync(pathToWatch)) {
  console.log(
    "🚫 Oops! The path you provided doesn't exist. Are you sure it's correct? Double-check and try again! 🧐",
  );
  process.exit(1);
}

// Read and parse .gitignore file
const gitignorePath = path.join(pathToWatch, '.gitignore');
let ignorePatterns: RegExp[] = [];

if (existsSync(gitignorePath)) {
  const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
  ignorePatterns = gitignoreContent
    .split('\n')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern && !pattern.startsWith('#'))
    .map(pattern => new RegExp(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')));
}

// Function to log a motivational message
const logMotivationalMessage = () => {
  const messages = [
    "Keep going, you're doing great! 💪",
    "Every change is a step forward! 🚀",
    "You're unstoppable! Keep it up! 🌟",
    "Success is just around the corner! 🏆",
  ];
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  console.log(randomMessage);
};

// Function to get the latest commit hash
async function getLatestCommitHash(): Promise<string> {
  $.cwd(pathToWatch);
  const hash = await $`git rev-parse HEAD`.text();
  return hash.trim();
}

// Function to handle file change mode
async function handleFileChangeMode() {
  const watcher = watch(pathToWatch);

  console.log(`👀 Watching for changes in: ${pathToWatch}`);
  if (ignorePatterns.length > 0) {
    console.log(`🚫 Ignoring changes based on .gitignore patterns`);
  }

  for await (const event of watcher) {
    const eventPath = path.join(pathToWatch, event.filename || "");
    const isIgnored = ignorePatterns.some(pattern => pattern.test(eventPath));

    if (isIgnored) {
      console.log(`🔕 Ignored ${event.eventType} in ${event.filename}`);
      continue;
    }

    const currentTime = new Date().toLocaleTimeString();
    console.log(`🎉 Detected ${event.eventType} in ${event.filename} at ${currentTime}`);
    logMotivationalMessage();
    await Bun.$`${{ raw: command }}`.nothrow();
  }
}

// Function to handle commit mode (local or remote)
async function handleCommitMode(isRemote: boolean) {
  let lastCommitHash = await getLatestCommitHash();
  console.log(`👀 Watching for ${isRemote ? "remote" : "local"} commits in: ${pathToWatch}`);

  while (true) {
    await sleep(5000);
    const currentCommitHash = await getLatestCommitHash();

    if (currentCommitHash !== lastCommitHash) {
      console.log(`🎉 New ${isRemote ? "remote" : "local"} commit detected: ${currentCommitHash}`);
      logMotivationalMessage();
      await Bun.$`${{ raw: command }}`.nothrow();
      lastCommitHash = currentCommitHash;
    }
  }
}

// Main function to determine mode and execute corresponding logic
async function main() {
  switch (mode) {
    case "file":
      await handleFileChangeMode();
      break;
    case "local":
      await handleCommitMode(false);
      break;
    case "remote":
      await handleCommitMode(true);
      break;
    default:
      console.log("🚫 Invalid mode. Please choose 'file', 'local', or 'remote'.");
      process.exit(1);
  }
}

// Handle graceful shutdowns
const shutdown = () => {
  console.log("👋 Bye-bye, watcher! Shutting down gracefully...");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Execute main function
main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
