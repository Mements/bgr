# BGR: Background Runner

[![bun](https://img.shields.io/badge/powered%20by-bun-F7A41D)](https://bun.sh/)

A powerful process manager built with Bun for managing long-running processes with advanced features like auto-restart, file watching, and integration with Bun's execution model.

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0.0 or higher

### Install

```bash
bun install -g bgr@latest
```

### Development

```bash
git clone https://github.com/7flash/bgr.git
cd bgr
bun install
bun link
```

## Features

- **Advanced process management** with database persistence
- **Auto-restart** with file watching for development
- **Environment variable management** from TOML config files
- **Process monitoring** and status tracking
- **Automatic port cleanup** on force restart
- **Git integration** with automatic pull on `--fetch`
- **Group filtering** and JSON output
- **Structured logging** with custom log paths

## Usage

### Process Management

```bash
# List all processes
bgr

# List processes filtered by group
bgr --filter api

# List processes in JSON format
bgr --json

# View process details
bgr myapp

# Show process logs
bgr myapp --logs --lines 50

# View only stdout logs
bgr myapp --logs --log-stdout

# View only stderr logs  
bgr myapp --logs --log-stderr
```

### Starting Processes

```bash
# Basic process start
bgr --name myapp --directory /path/to/project --command "npm start"

# Start with file watching (auto-restart on changes)
bgr --name myapp --directory ./myapp --command "bun run dev" --watch

# Start with config file for environment variables
bgr --name myapp --directory ./myapp --command "bun run server" --config production.toml

# Force restart (kills existing process and port conflicts)
bgr --name myapp --directory ./myapp --command "bun run server" --force

# Start with automatic git pull
bgr --name myapp --directory ./myapp --command "bun run server" --fetch
```

### Process Control

```bash
# Restart process
bgr myapp --restart

# Delete specific process
bgr --delete myapp

# Clean stopped processes
bgr --clean

# Delete ALL processes
bgr --nuke
```

## Advanced Usage

### Development with Auto-Restart

BGR excels at development workflows with its `--watch` mode:

```bash
# Frontend development with auto-restart and logs
bgr --name frontend \
    --directory ~/projects/frontend \
    --command "bun run --watch dev" \
    --watch \
    --logs \
    --log-stdout \
    --lines 20

# Backend API with file watching and environment
bgr --name api \
    --directory ~/projects/api \
    --command "bun run src/server.ts" \
    --watch \
    --config .config.toml \
    --force
```

### Production Deployment

```bash
# Start production service
bgr --name production-api \
    --directory /var/www/api \
    --command "bun run src/server.ts" \
    --config production.toml \
    --fetch \
    --stdout /var/log/bgr/api-out.log \
    --stderr /var/log/bgr/api-err.log

# Multiple services in same group
BGR_GROUP=api bgr --name auth-api --directory ./auth --command "bun run server"
BGR_GROUP=api bgr --name user-api --directory ./users --command "bun run server"

# Filter by group
bgr --filter api
```

### Advanced Process Spawning

The key advantage of BGR over traditional process managers is how easily you can spawn managed processes from within your scripts:

```typescript
import { $ } from "bun";

// Start a managed trader agent from your script
await Bun.$`bgr --name ${traderName} --directory ${process.env.HOME}/Documents/trader-agent --command "bun run src/index.ts" --config ${traderName}.toml --force`;

// Multiple managed processes
await Promise.all([
  Bun.$`bgr --name api-server --directory ./api --command "bun run server" --config api.toml`,
  Bun.$`bgr --name worker --directory ./workers --command "bun run worker" --config worker.toml`,
]);

// Restart processes programmatically
await Bun.$`bgr --restart api-server`;
await Bun.$`bgr --force restart worker`;
```

## Why BGR is Better than Alternatives

### vs Simple Spawning

**Simple spawning:**
```typescript
const child = Bun.spawn(["node", "script.js"]);
```

**Problems:**
- No automatic restart if process crashes
- No port conflict resolution
- No environment variable management
- No log capture
- No process status tracking

**BGR approach:**
```typescript
await Bun.$`bgr --name myapp --command "bun run script" --force`;
```
- Auto-restart on crash via guard.ts
- Automatic port cleanup
- Config-based environment variables
- Structured logging
- Persistent process tracking

### vs Workers

**Workers limitations:**
- Single memory space, isolation challenges
- Limited to Node.js/Bun environment
- Complex inter-process communication
- Resource management issues

**BGR advantages:**
- True process isolation
- Any executable or script
- Simple inter-process communication via file system
- Better resource management
- Cross-language compatibility

### vs PM2/Process Managers

**Traditional process managers:**
- Heavy dependencies
- Complex configuration
- Node.js only
- Slower startup
- Complex API

**BGR benefits:**
- Built on Bun - ultra-fast startup
- Simple CLI and API
- Language agnostic
- Lightweight dependencies
- Native Bun features

## Configuration

### TOML Config Files

BGR automatically loads TOML configuration files and converts them to environment variables:

```toml
# .config.toml
[server]
port = 3000
host = "0.0.0.0"
timeout = 30000

[database]
url = "postgresql://localhost/myapp"
pool_size = 10
connection_timeout = 5000

[logging]
level = "info"
format = "json"
```

**Becomes environment variables:**
- `SERVER_PORT=3000`
- `SERVER_HOST=0.0.0.0`
- `SERVER_TIMEOUT=30000`
- `DATABASE_URL=postgresql://localhost/myapp`
- `DATABASE_POOL_SIZE=10`
- `DATABASE_CONNECTION_TIMEOUT=5000`
- `LOGGING_LEVEL=info`
- `LOGGING_FORMAT=json`

### Environment Variables

```bash
# Custom database path
DB_NAME=myapp bgr

# Process grouping
BGR_GROUP=production bgr --name api-server --command "bun run server"
```

## File Structure

```
~/.bgr/
├── bgr.sqlite              # Process database
├── myapp-out.txt          # stdout logs
├── myapp-err.txt          # stderr logs
└── backup/                # Historical logs
    ├── myapp-out-2024-01-01.txt
    └── myapp-err-2024-01-01.txt
```

## Guard Process for Auto-Restart

For critical processes, use the guard script to automatically restart them if they stop:

```bash
# Monitor a process and restart it if it crashes
bun run guard.ts myapp 30

# Monitor every 30 seconds and auto-restart
```

## Advanced Examples

### Multi-Service Development

```bash
# Start all services
BGR_GROUP=dev bgr --name frontend --directory ./frontend --command "bun run dev --watch" --watch --force
BGR_GROUP=dev bgr --name backend --directory ./backend --command "bun run --watch server.ts" --watch --config .dev.toml
BGR_GROUP=dev bgr --name database --directory ./ --command "docker run -p 5432:5432 postgres:15"

# View all dev services
bgr --filter dev

# Restart specific service
bgr --restart backend
```

### Production Architecture

```bash
# Start production services
bgr --name main-api --directory /var/api --command "bun run server" --config prod.toml --fetch --stdout /var/log/main-api.log --stderr /var/log/main-api.err
bgr --name cache-server --directory /var/cache --command "redis-server" --config redis.toml
bgr --name background-worker --directory /var/workers --command "bun run worker" --config worker.toml --force

# Monitor services
while true; do
  bgr --json | jq '.[] | select(.status == "running") | .name'
  sleep 60
done
```

### Dynamic Process Management

```typescript
// orchestrator.ts
import { $ } from "bun";

class ServiceOrchestrator {
  async startService(name: string, config: ServiceConfig) {
    await Bun.$`bgr --name ${name} --directory ${config.directory} --command "${config.command}" --config ${config.config} --force`;
  }

  async restartService(name: string) {
    await Bun.$`bgr --restart ${name}`;
  }

  async stopService(name: string) {
    await Bun.$`bgr --delete ${name}`;
  }

  async getHealthCheck() {
    const result = await Bun.$`bgr --json`.json();
    return result.filter((p: any) => p.status === "running");
  }
}

// Usage
const orchestrator = new ServiceOrchestrator();
await orchestrator.startService("api", {
  directory: "./api",
  command: "bun run server",
  config: "production.toml"
});
```

## API Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_NAME` | Custom database name | `bgr` |
| `BGR_GROUP` | Process grouping for filtering | - |

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Process name | Required |
| `--directory <path>` | Working directory | Required |
| `--command <cmd>` | Command to execute | Required |
| `--config <path>` | Config file path | `.config.toml` |
| `--force` | Force restart running process | `false` |
| `--fetch` | Pull latest git changes | `false` |
| `--watch` | Watch for file changes and auto-restart | `false` |
| `--stdout <path>` | Custom stdout log path | `~/.bgr/<name>-out.txt` |
| `--stderr <path>` | Custom stderr log path | `~/.bgr/<name>-err.txt` |
| `--db <path>` | Custom database path | `~/.bgr/bgr.sqlite` |
| `--json` | Output in JSON format | `false` |
| `--filter <group>` | Filter by BGR_GROUP | - |
| `--logs` | Show process logs | `false` |
| `--log-stdout` | Show only stdout logs | `false` |
| `--log-stderr` | Show only stderr logs | `false` |
| `--lines <number>` | Number of log lines to show | All |
| `--help` | Show help | - |
| `--version` | Show version | - |

## Testing

```bash
bun test
```

## License

MIT
