import { $, sleep, file } from "bun";
import { join } from "path";

// Utility function to get formatted current time
function getFormattedTime() {
  const now = new Date();
  const pad = (num) => num.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Function to parse command-line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = { remoteName: "origin", command: null };

  args.forEach((arg, index) => {
    if (arg.startsWith("--remote=")) {
      options.remoteName = arg.split("=")[1];
    } else if (index === 0) {
      options.command = arg;
    }
  });

  return options;
}

// Function to read and parse package.json
async function getPackageJsonCommand(repoDirectory) {
  const packageJsonPath = join(repoDirectory, 'package.json');
  const packageJsonBlob = file(packageJsonPath);

  try {
    console.log(`📄 Reading package.json from ${packageJsonPath}...`);
    const packageJson = JSON.parse(await packageJsonBlob.text());
    console.log("✅ Successfully parsed package.json.");
    return packageJson.refresh_cmd;
  } catch (err) {
    console.error("❌ Error: Unable to parse package.json.");
    console.error("Please ensure your package.json is valid JSON.");
    process.exit(1);
  }
}

// Main function to reload, execute, and commit logs
async function reloadThenExecuteAndCommitLogs(remoteName, command) {
  const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
  const logDirectory = join(repoDirectory, 'bgr-output');
  let firstRun = true;
  let currentProcess = null;

  while (true) {
    try {
      console.log("🔄 Fetching latest changes...");
      await $`git fetch ${remoteName}`;

      const localHash = (await $`git rev-parse @`.text()).trim();
      const remoteHash = (await $`git rev-parse ${remoteName}/$(git rev-parse --abbrev-ref HEAD)`.text()).trim();

      console.log(`🔍 Local hash: ${localHash}`);
      console.log(`🔍 Remote hash: ${remoteHash}`);

      if (localHash !== remoteHash || firstRun) {
        firstRun = false;
        console.log("⬇️ Pulling latest changes...");
        await $`git pull ${remoteName} $(git rev-parse --abbrev-ref HEAD)`;

        if (currentProcess) {
          console.log("🛑 Terminating existing process...");
          currentProcess.kill();
          await currentProcess.exited;
        }

        console.log(`🚀 Executing command: ${command}`);
        currentProcess = Bun.spawn(command.split(' '), {
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(currentProcess.stdout).text();
        const stderr = await new Response(currentProcess.stderr).text();

        await currentProcess.exited;

        if (currentProcess.exitCode !== 0) {
          console.error(`❌ Command failed with exit code ${currentProcess.exitCode}`);
          console.error(stderr);
          continue;
        }

        console.log(`📜 Command output: ${stdout}`);

        const logFileName = `log_${getFormattedTime().replace(/[: ]/g, '_')}.txt`;
        const latestLogFilePath = join(logDirectory, "latest.txt");
        const newLogFilePath = join(logDirectory, logFileName);

        const branchName = "bgr";
        const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.text()).trim();

        console.log(`🌿 Current branch: ${currentBranch}`);

        const lastCommitMessage = (await $`git log -1 --pretty=%B`.text()).trim().split('\n')[0];
        const commitMessage = `bgr - ${lastCommitMessage}`;

        console.log(`📝 Commit message: ${commitMessage}`);

        try {
          console.log(`🌿 Creating and switching to branch: ${branchName}`);
          await $`git checkout -b ${branchName}`;
        } catch (err) {
          console.error("⚠️ Branch creation failed, attempting to switch to existing branch...");
          await $`git checkout ${branchName}`;
        }

        try {
          console.log(`💾 Writing log to ${newLogFilePath} and ${latestLogFilePath}`);
          await Bun.write(newLogFilePath, new Blob([stdout]));
          await Bun.write(latestLogFilePath, new Blob([stdout]));

          console.log("➕ Adding log files to git...");
          await $`git add ${newLogFilePath} ${latestLogFilePath}`;
          await $`git commit -m "${commitMessage} - ${getFormattedTime()}"`;
          console.log("🔼 Pushing changes to remote...");
          await $`git push -u ${remoteName} ${branchName}`;
        } catch (err) {
          console.error("❌ Error during git operations:", err);
        } finally {
          console.log(`🔄 Switching back to original branch: ${currentBranch}`);
          await $`git checkout ${currentBranch}`;
        }
      } else {
        console.log("🔍 No changes detected.");
      }

      process.stdout.write(`⏳ Last checked at ${getFormattedTime()} | Local: ${localHash} | Remote: ${remoteHash}\r`);
    } catch (err) {
      console.error("❌ Error during reload and execute cycle:", err);
    }

    await sleep(5 * 1000);
  }
}

async function main() {
  const { remoteName, command } = parseArguments();
  console.log(`🔗 Using git remote: ${remoteName}`);

  const repoDirectory = (await $`git rev-parse --show-toplevel`.text()).trim();
  const refreshCommand = command || await getPackageJsonCommand(repoDirectory);

  if (!refreshCommand) {
    console.error("❌ Error: 'refresh_cmd' is missing in package.json.");
    process.exit(1);
  }

  console.log(`🔄 Refresh command: ${refreshCommand}`);
  await reloadThenExecuteAndCommitLogs(remoteName, refreshCommand);
}

if (import.meta.path === Bun.main) {
  console.log("🚀 Starting the reload and execute cycle...");
  main();
}
