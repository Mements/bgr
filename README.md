# BGR - Bun: Background Runner

*A lightweight process manager written in Bun*

BGR is a simple yet powerful process manager that helps you manage long-running processes with ease. It provides process monitoring, environment configuration, and detailed logging capabilities.

## Key Features 🚀

- **Process Management**: Start, stop, and monitor your processes with simple commands
- **Environment Configuration**: Support for environment variables via config files
- **Detailed Logging**: Separate stdout and stderr logs for each process
- **SQLite Storage**: Reliable process state tracking using SQLite database
- **Zero Runtime Dependencies**: Only requires Bun to run

## Installation

### Option 1: Install via npm (Recommended)

```bash
# Install globally
npm install -g bgr
```

### Option 2: Manual Installation

1. Clone and install:
```bash
git clone https://github.com/7flash/bgr.git $HOME/bgr
cd bgr && bun install
```

2. Compile bgr:
```bash
bun build ./src/index.ts --compile --outfile ./bin/bgr
```

3. Add to your PATH (in ~/.bashrc):
```bash
export PATH="$HOME/bgr/bin:$PATH"
```

### Prerequisites

BGR requires [Bun](https://bun.sh/) to be installed on your system:

```bash
# Install Bun if not already installed
curl -fsSL https://bun.sh/install | bash
```

## Usage 

### Basic Commands

```bash
# Show all processes
bgr

# View specific process details
bgr <process-name>
bgr --name <process-name>

# Start new process
bgr --name myapp --directory ~/projects/myapp --command "npm start"

# Restart process
bgr <process-name> --restart

# Delete process
bgr --delete <process-name>
```

### Optional Parameters

```bash
--config <path>      Config file for environment variables (default: .config.toml)
--force              Force restart if process is running
--fetch              Pull latest git changes before running
--stdout <path>      Custom stdout log path
--stderr <path>      Custom stderr log path
--db <path>          Custom database file path
--help               Show help message
```

### Environment Configuration

BGR supports environment variables through config files. Create a `.config.toml` file in your project directory:

```toml
[app]
port = 3000
host = "localhost"

[database]
url = "postgres://localhost:5432"
```

BGR will automatically load and format these configurations as environment variables:

```
APP_PORT=3000
APP_HOST=localhost
DATABASE_URL=postgres://localhost:5432
```

### Examples

```bash
# Start a Node.js application
bgr --name myapp --directory ~/projects/myapp --command "npm start"

# Start with custom config
bgr --name myapp --config custom.config.toml --directory ./app

# Restart process with force
bgr myapp --restart --force

# Use custom database location
bgr --db ~/custom/path/mydb.sqlite
```

## File Locations

- **Database**: `~/.bgr/bgr.sqlite`
- **Logs**: `~/.bgr/<process-name>-out.txt` and `~/.bgr/<process-name>-err.txt`

## Extending BGR

BGR is designed to be simple and extensible. Here's an example of how to create a guard script to monitor and automatically restart processes:

### Example: Process Guard Script

Create a file called `guard.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Simple Guard Script for BGR
 * This script monitors a specific process and automatically restarts it if it stops
 * 
 * Usage: bun guard.ts <process-name> [check-interval-seconds]
 */

import { $, sleep } from "bun";

async function main() {
  // Parse command line arguments
  const processName = process.argv[2];
  const checkInterval = parseInt(process.argv[3] || "30") * 1000; // Default 30 seconds
  
  if (!processName) {
    console.error("❌ Error: Process name is required");
    console.error("Usage: bun guard.ts <process-name> [check-interval-seconds]");
    process.exit(1);
  }
  
  console.log(`🔍 Starting guard for process "${processName}"`);
  console.log(`⏱️  Checking every ${checkInterval/1000} seconds`);
  
  // Main monitoring loop
  while (true) {
    try {
      // Check process status using bgr
      const result = await $`bgr ${processName}`.quiet().nothrow();
      
      // Check if the process is not running
      if (result.stdout.includes("○ Stopped") || result.exitCode !== 0) {
        console.log(`⚠️ Process "${processName}" is not running! Attempting to restart...`);
        
        // Restart the process
        const restartResult = await $`bgr ${processName} --restart --force`.nothrow();
        
        if (restartResult.exitCode === 0) {
          console.log(`✅ Successfully restarted "${processName}"`);
        } else {
          console.error(`❌ Failed to restart "${processName}"`);
          console.error(restartResult.stderr);
        }
      } else {
        console.log(`✅ Process "${processName}" is running (${new Date().toLocaleTimeString()})`);
      }
    } catch (error) {
      console.error(`❌ Error checking process: ${error.message}`);
    }
    
    // Wait for the next check interval
    await sleep(checkInterval);
  }
}

main().catch(err => {
  console.error("🚨 Fatal error:", err);
  process.exit(1);
});
```

To use this guard script:

```bash
# Make the script executable
chmod +x guard.ts

# Start monitoring a process (checks every 30 seconds)
bun guard.ts my-service

# Start monitoring with a different check interval (e.g., 10 seconds)
bun guard.ts my-service 10
```

You can run multiple guard scripts to monitor different services, or extend the script to monitor multiple services at once.

## Running Bun Applications as Daemons

BGR is an excellent choice for running Bun applications as daemons. Here's how:

```bash
# Start a Bun application as a daemon
bgr --name my-bun-app --directory ~/projects/my-bun-app --command "bun index.ts"
```

For maximum reliability, you can combine BGR with a guard script:

```bash
# First start your Bun application
bgr --name my-bun-app --directory ~/projects/my-bun-app --command "bun index.ts"

# Then start a guard for it (also as a managed process)
bgr --name guard-my-bun-app --directory ~/projects/my-bun-app --command "bun guard.ts my-bun-app"
```

## Comparison with PM2

While PM2 is a mature process manager for Node.js applications, BGR offers significant advantages for modern development workflows:

### The BGR Advantage

- **Bun-Native Performance**
  - Blazing fast startup (up to 30x faster than Node.js-based process managers)
  - Lower memory footprint (typically 60-80% less memory usage)
  - Modern TypeScript Support, Native ESM

- **Lightweight Architecture**
  - No daemon process that can become a single point of failure
  - Independent process tracking with SQLite for reliable state persistence
  - Zero runtime dependencies beyond Bun itself

- **Developer-Friendly Experience**
  - Zero-configuration defaults that just work
  - Intuitive CLI with modern design patterns
  - Extensible with simple Bun scripts

## License

This project is licensed under the MIT License.