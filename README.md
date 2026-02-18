<![CDATA[<div align="center">

# 🦎 BGR

**Background Runner — a modern process manager built on Bun**

[![npm](https://img.shields.io/npm/v/bgr?color=F7A41D&label=npm&logo=npm)](https://www.npmjs.com/package/bgr)
[![bun](https://img.shields.io/badge/runtime-bun-F7A41D?logo=bun)](https://bun.sh/)
[![license](https://img.shields.io/npm/l/bgr)](./LICENSE)

Start, stop, restart, and monitor any process — from dev servers to Docker containers.
Zero config. One command. Beautiful dashboard included.

```
bun install -g bgr
```

</div>

---

## Why BGR?

| Feature | PM2 | bgr |
|---------|-----|-----|
| Runtime | Node.js | Bun (5× faster startup) |
| Install | `npm i -g pm2` (50+ deps) | `bun i -g bgr` (minimal deps) |
| Config format | JSON / JS / YAML | TOML (or none at all) |
| Dashboard | `pm2 monit` (TUI) | `bgr --dashboard` (full web UI) |
| Language support | Any | Any |
| Docker-aware | ❌ | ✅ detects container status |
| Port management | Manual | Auto-detect & cleanup |
| File watching | Built-in | Built-in |
| Programmatic API | ✅ | ✅ (first-class TypeScript) |
| Process persistence | ✅ | ✅ (SQLite) |

---

## Quick Start

```bash
# Install globally
bun install -g bgr

# Start a process
bgr --name my-api --directory ./my-project --command "bun run server.ts"

# List all processes
bgr

# Open the web dashboard
bgr --dashboard
```

That's it. BGR tracks the PID, captures stdout/stderr, detects the port, and survives terminal close.

---

## Table of Contents

- [Core Commands](#core-commands)
- [Dashboard](#dashboard)
- [File Watching](#file-watching)
- [Port Handling](#port-handling)
- [Docker Integration](#docker-integration)
- [Caddy Reverse Proxy](#caddy-reverse-proxy)
- [TOML Configuration](#toml-configuration)
- [Programmatic API](#programmatic-api)
- [Migrating from PM2](#migrating-from-pm2)
- [Edge Cases & Behaviors](#edge-cases--behaviors)
- [Full CLI Reference](#full-cli-reference)

---

## Core Commands

### Starting a process

```bash
bgr --name my-api \
    --directory ~/projects/my-api \
    --command "bun run server.ts"
```

Short form — if you're already *in* the project directory:

```bash
bgr --name my-api --command "bun run server.ts"
# bgr uses current directory by default
```

### Listing processes

```bash
bgr                  # Pretty table
bgr --json           # Machine-readable JSON
bgr --filter api     # Filter by group (BGR_GROUP env)
```

### Viewing a process

```bash
bgr my-api           # Show status, PID, port, runtime, command
bgr my-api --logs    # Show stdout + stderr interleaved
bgr my-api --logs --log-stdout --lines 50  # Last 50 stdout lines only
```

### Stopping, restarting, deleting

```bash
bgr --stop my-api       # Graceful stop (SIGTERM → SIGKILL)
bgr --restart my-api     # Stop then start again with same command
bgr --delete my-api      # Stop and remove from database
bgr --clean              # Remove all stopped processes
bgr --nuke               # ☠️  Delete everything
```

### Force restart

When a process is stuck or its port is orphaned:

```bash
bgr --name my-api --command "bun run server.ts" --force
```

`--force` will:
1. Kill the existing process by PID
2. Detect all ports it was using (via OS `netstat`)
3. Kill any zombie processes still holding those ports
4. Wait for ports to free up
5. Start fresh

---

## Dashboard

BGR ships with a built-in web dashboard for managing all your processes visually.

```bash
bgr --dashboard
```

The dashboard provides:
- **Real-time process table** with status, PID, port, runtime
- **Start/stop/restart/delete** actions with one click
- **Log viewer** with monospace display and auto-scroll
- **Process detail drawer** with stdout/stderr tabs
- **Auto-refresh** every 3 seconds

### Dashboard port selection

The dashboard uses [Melina.js](https://github.com/7flash/melina.js) for serving and follows smart port selection:

| Scenario | Behavior |
|----------|----------|
| `bgr --dashboard` | Starts on port 3000. If busy, auto-falls back to 3001, 3002, etc. |
| `BUN_PORT=4000 bgr --dashboard` | Starts on port 4000. Fails with error if port is busy. |
| `bgr --dashboard --port 5000` | Same as `BUN_PORT=5000` — explicit, no fallback. |
| Dashboard already running | Prints current URL and PID instead of starting a second instance. |

The actual port is always detected from the running process and displayed correctly in `bgr` output.

---

## File Watching

For development, BGR can watch for file changes and auto-restart:

```bash
bgr --name frontend \
    --directory ~/projects/frontend \
    --command "bun run dev" \
    --watch
```

This monitors the working directory for changes and restarts the process when files are modified. Combine with `--force` to ensure clean restarts:

```bash
bgr --name api \
    --command "bun run server.ts" \
    --watch \
    --force \
    --config .dev.toml
```

---

## Port Handling

BGR automatically detects which TCP ports a process is listening on by querying the OS. This means:

- **No port configuration needed** — BGR discovers ports from `netstat`
- **No environment variable assumptions** — BGR doesn't guess `PORT` or `BUN_PORT`
- **Clean restarts** — `--force` kills all orphaned port bindings before restarting
- **Accurate display** — the port shown in `bgr` output is the *actual* bound port

### How it works

```
1. bgr spawns your process
2. Process starts and binds to a port (however it wants)
3. bgr queries `netstat -ano` (Windows) or `ss -tlnp` (Linux)
4. bgr finds all TCP LISTEN ports for the process PID
5. These ports are displayed in the table and used for cleanup
```

### Port conflict resolution

If you `--force` restart a process and its old port is still held by a zombie:

```
1. bgr detects ports held by the old PID
2. Sends SIGTERM to the old process
3. Kills any remaining processes on those ports
4. Waits for ports to become free (up to 5 seconds)
5. Starts the new process
```

---

## Docker Integration

BGR can manage Docker containers alongside regular processes:

```bash
# Start a Postgres container
bgr --name postgres \
    --command "docker run --name bgr-postgres -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16"

# Start a Redis container
bgr --name redis \
    --command "docker run --name bgr-redis -p 6379:6379 redis:7-alpine"
```

### How BGR handles Docker

BGR is **Docker-aware** — when it detects a `docker run` command, it:

1. **Checks container status** via `docker inspect` instead of checking the PID
2. **Handles container lifecycle** — stops containers with `docker stop` on `bgr --stop`
3. **Reports correct status** — shows Running/Stopped based on container state, not process state

### Docker Compose alternative

Instead of `docker-compose.yml`, use BGR to orchestrate containers alongside your app:

```bash
#!/bin/bash
# start-stack.sh

# Database
bgr --name db \
    --command "docker run --name bgr-db -p 5432:5432 \
              -v pgdata:/var/lib/postgresql/data \
              -e POSTGRES_DB=myapp \
              -e POSTGRES_PASSWORD=secret \
              postgres:16" \
    --force

# Cache
bgr --name cache \
    --command "docker run --name bgr-cache -p 6379:6379 redis:7-alpine" \
    --force

# Your app (not Docker, just a regular process)
bgr --name api \
    --directory ~/projects/my-api \
    --command "bun run server.ts" \
    --config production.toml \
    --force

# See everything
bgr
```

The advantage over Docker Compose: your app processes and Docker containers are managed in the **same place** with the **same commands**.

---

## Caddy Reverse Proxy

BGR pairs naturally with [Caddy](https://caddyserver.com/) for production deployments with automatic HTTPS.

### Basic setup

```bash
# Start your app on any port (BGR detects it)
bgr --name my-api --command "bun run server.ts" --force

# Check which port it got
bgr
# → my-api  ● Running  :3000  bun run server.ts
```

**Caddyfile:**

```caddy
api.example.com {
    reverse_proxy localhost:3000
}

dashboard.example.com {
    reverse_proxy localhost:3001
}
```

### Multi-service setup

```bash
# Start services
bgr --name api       --command "bun run api/server.ts"     --force
bgr --name frontend  --command "bun run frontend/server.ts" --force
bgr --name admin     --command "bun run admin/server.ts"    --force

# Start dashboard
bgr --dashboard
```

**Caddyfile:**

```caddy
api.example.com {
    reverse_proxy localhost:3000
}

app.example.com {
    reverse_proxy localhost:3001
}

admin.example.com {
    reverse_proxy localhost:3002
}

status.example.com {
    reverse_proxy localhost:3003  # BGR dashboard
}
```

### Managing Caddy with BGR

You can even manage Caddy itself as a BGR process:

```bash
bgr --name caddy \
    --directory /etc/caddy \
    --command "caddy run --config Caddyfile" \
    --force
```

Now `bgr` shows your entire stack — app servers, databases, and reverse proxy — in one place.

---

## TOML Configuration

BGR loads TOML config files and flattens them into environment variables:

```bash
bgr --name api --command "bun run server.ts" --config production.toml
```

```toml
# production.toml
[server]
port = 3000
host = "0.0.0.0"

[database]
url = "postgresql://localhost/myapp"
pool_size = 10

[auth]
jwt_secret = "your-secret-here"
session_ttl = 3600
```

**Becomes:**
```
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
DATABASE_URL=postgresql://localhost/myapp
DATABASE_POOL_SIZE=10
AUTH_JWT_SECRET=your-secret-here
AUTH_SESSION_TTL=3600
```

The convention: `[section]` becomes the prefix, `key` becomes the suffix, joined with `_`, uppercased.

If no `--config` is specified, BGR looks for `.config.toml` in the working directory automatically.

---

## Programmatic API

BGR exposes its internals as importable TypeScript functions:

```bash
bun add bgr
```

### Process management

```typescript
import {
  getAllProcesses,
  getProcess,
  isProcessRunning,
  terminateProcess,
  handleRun,
  getProcessPorts,
  readFileTail,
  calculateRuntime,
} from 'bgr'

// List all processes
const procs = getAllProcesses()

// Start a process programmatically
await handleRun({
  action: 'run',
  name: 'my-api',
  command: 'bun run server.ts',
  directory: '/path/to/project',
  force: true,
  remoteName: '',
})

// Check status
const proc = getProcess('my-api')
if (proc) {
  const alive = await isProcessRunning(proc.pid)
  const ports = await getProcessPorts(proc.pid)
  const runtime = calculateRuntime(proc.timestamp)
  console.log({ alive, ports, runtime })
}

// Read logs
const proc = getProcess('my-api')
if (proc) {
  const stdout = await readFileTail(proc.stdout_path, 100) // last 100 lines
  const stderr = await readFileTail(proc.stderr_path, 100)
}

// Stop a process
await terminateProcess(proc.pid)
```

### Build a custom dashboard

```typescript
import { getAllProcesses, isProcessRunning, calculateRuntime } from 'bgr'

// Express/Hono/Elysia endpoint
export async function GET() {
  const procs = getAllProcesses()
  const enriched = await Promise.all(
    procs.map(async (p) => ({
      name: p.name,
      pid: p.pid,
      running: await isProcessRunning(p.pid),
      runtime: calculateRuntime(p.timestamp),
    }))
  )
  return Response.json(enriched)
}
```

---

## Migrating from PM2

If you're coming from PM2, here's a direct mapping of commands:

### Command mapping

| PM2 | BGR |
|-----|-----|
| `pm2 start app.js --name api` | `bgr --name api --command "node app.js"` |
| `pm2 start app.js -i max` | *(cluster mode not supported — use multiple named processes)* |
| `pm2 list` | `bgr` |
| `pm2 show api` | `bgr api` |
| `pm2 logs api` | `bgr api --logs` |
| `pm2 logs api --lines 50` | `bgr api --logs --lines 50` |
| `pm2 stop api` | `bgr --stop api` |
| `pm2 restart api` | `bgr --restart api` |
| `pm2 delete api` | `bgr --delete api` |
| `pm2 flush` | `bgr --clean` |
| `pm2 kill` | `bgr --nuke` |
| `pm2 monit` | `bgr --dashboard` |
| `pm2 save` / `pm2 resurrect` | *(automatic — processes persist in SQLite)* |

### ecosystem.config.js → TOML + shell script

**PM2 ecosystem file:**

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'server.js',
      cwd: './api',
      env: { PORT: 3000, NODE_ENV: 'production' },
    },
    {
      name: 'worker',
      script: 'worker.js',
      cwd: './workers',
      env: { QUEUE: 'default' },
    },
  ],
}
```

**BGR equivalent:**

```toml
# api.toml
[server]
port = 3000

[node]
env = "production"
```

```bash
#!/bin/bash
# start.sh
bgr --name api    --directory ./api     --command "node server.js" --config api.toml --force
bgr --name worker --directory ./workers --command "node worker.js" --force
```

### Key differences

1. **No cluster mode** — BGR manages independent processes. For multi-core, run multiple named instances (`api-1`, `api-2`) behind a load balancer.

2. **No `pm2 startup`** — BGR doesn't install itself as a system service. Use your OS init system (systemd, launchd, Windows Task Scheduler) to run BGR at boot:

   ```ini
   # /etc/systemd/system/bgr-api.service
   [Unit]
   Description=My API via BGR

   [Service]
   ExecStart=/usr/local/bin/bgr --name api --directory /var/www/api --command "bun run server.ts" --force
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

3. **No log rotation** — BGR writes to plain text files in `~/.bgr/`. Use `logrotate` or similar tools, or specify custom log paths with `--stdout` and `--stderr`.

4. **Bun required** — BGR runs on Bun, but the *processes it manages* can be anything: Node.js, Python, Ruby, Go, Docker, shell scripts.

---

## Edge Cases & Behaviors

### What happens when a process crashes?

BGR records the process as **Stopped**. The PID and log files are preserved so you can inspect what happened:

```bash
bgr my-api --logs --log-stderr
```

For auto-restart on crash, use the guard script:

```bash
bun run guard.ts my-api 30  # Check every 30 seconds, restart if dead
```

### What happens on `bgr --force` if the port is stuck?

BGR queries the OS for all TCP ports held by the old PID, kills them, and waits up to 5 seconds for cleanup. If ports are still held after that, the new process starts anyway (and will likely pick a different port).

### What happens if I start two processes with the same name?

The new process replaces the old one. If the old one is still running, use `--force` to kill it first. Without `--force`, BGR will refuse to start if a process with that name is already running.

### What happens if BGR itself is killed?

The managed processes keep running — they're independent OS processes. When you run `bgr` again, it reconnects to the SQLite database and checks which PIDs are still alive. Dead processes are marked as **Stopped**.

### What about Windows?

BGR works on Windows. Process management uses `taskkill` and `wmic` instead of Unix signals. Port detection uses `netstat -ano`. The dashboard runs in your browser, so it works everywhere.

### Can I manage processes on a remote server?

Not directly — BGR manages processes on the local machine. For remote management, run BGR on the remote server and expose the dashboard behind a reverse proxy (see [Caddy section](#caddy-reverse-proxy)).

---

## Custom Log Paths

By default, logs go to `~/.bgr/<name>-out.txt` and `~/.bgr/<name>-err.txt`. Override with:

```bash
bgr --name api \
    --command "bun run server.ts" \
    --stdout /var/log/api/stdout.log \
    --stderr /var/log/api/stderr.log
```

---

## Process Groups

Tag processes with `BGR_GROUP` to organize and filter them:

```bash
BGR_GROUP=prod bgr --name api         --command "bun run server.ts" --force
BGR_GROUP=prod bgr --name worker      --command "bun run worker.ts" --force
BGR_GROUP=dev  bgr --name dev-server  --command "bun run dev"       --force

# Show only production processes
bgr --filter prod

# Show only dev processes
bgr --filter dev
```

---

## Git Integration

Pull the latest changes before starting:

```bash
bgr --name api \
    --directory ~/projects/api \
    --command "bun run server.ts" \
    --fetch \
    --force
```

`--fetch` runs `git pull` in the working directory before starting the process. Combine with `--force` for a clean deploy workflow:

```bash
# Deploy script
bgr --name api --directory /var/www/api --command "bun run server.ts" --fetch --force
```

---

## File Structure

```
~/.bgr/
├── bgr.sqlite              # Process database (SQLite)
├── myapp-out.txt           # stdout logs
├── myapp-err.txt           # stderr logs
├── bgr-dashboard-out.txt   # Dashboard stdout
└── bgr-dashboard-err.txt   # Dashboard stderr
```

All state lives in `~/.bgr/`. To reset everything, delete this directory.

---

## Full CLI Reference

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Process name | *(required for start)* |
| `--directory <path>` | Working directory | Current directory |
| `--command <cmd>` | Command to execute | *(required for start)* |
| `--config <path>` | TOML config file for env vars | `.config.toml` |
| `--force` | Kill existing process and ports before starting | `false` |
| `--fetch` | Git pull before starting | `false` |
| `--watch` | Auto-restart on file changes | `false` |
| `--stdout <path>` | Custom stdout log path | `~/.bgr/<name>-out.txt` |
| `--stderr <path>` | Custom stderr log path | `~/.bgr/<name>-err.txt` |
| `--db <path>` | Custom SQLite database path | `~/.bgr/bgr.sqlite` |
| `--json` | Output process list as JSON | `false` |
| `--filter <group>` | Filter by `BGR_GROUP` | *(show all)* |
| `--logs` | Show process logs | `false` |
| `--log-stdout` | Show only stdout | `false` |
| `--log-stderr` | Show only stderr | `false` |
| `--lines <n>` | Number of log lines | All |
| `--stop <name>` | Stop a process | - |
| `--restart <name>` | Restart a process | - |
| `--delete <name>` | Delete a process | - |
| `--clean` | Remove stopped processes | - |
| `--nuke` | Delete ALL processes | - |
| `--dashboard` | Launch web dashboard | - |
| `--version` | Show version | - |
| `--help` | Show help | - |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_NAME` | Custom database file name | `bgr` |
| `BGR_GROUP` | Assign process to a group | *(none)* |
| `BUN_PORT` | Dashboard port (explicit, no fallback) | *(auto: 3000+)* |

---

## Requirements

- [Bun](https://bun.sh) v1.0.0+

---

## License

MIT

---

<div align="center">

Built by [Mements](https://github.com/Mements) with ⚡ Bun

</div>
]]>
