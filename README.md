# BGR: Background Runner

[![npm version](https://img.shields.io/npm/v/bgr.svg)](https://www.npmjs.com/package/bgr)
[![bun](https://img.shields.io/badge/powered%20by-bun-F7A41D)](https://bun.sh/)

A process manager built with Bun for managing long-running processes.

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0.0 or higher
- Git (for repository features)

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

After linking, `bgr` will be available globally.

## Usage

### Start a process

```bash
bgr --name myapp --directory /path/to/project --command "npm start"
```

### List processes

```bash
bgr
```

Output:
```
╭─────┬────────┬──────────┬─────────────────┬──────────────────┬───────────┬──────────╮
│ ID  │ PID    │ Name     │ Command         │ Directory        │ Status    │ Runtime  │
├─────┼────────┼──────────┼─────────────────┼──────────────────┼───────────┼──────────┤
│ 1   │ 12345  │ myapp    │ npm start       │ /home/user/app   │ ● Running │ 45 min   │
│ 2   │ 23456  │ api      │ bun server.ts   │ /home/user/api   │ ○ Stopped │ 0 min    │
╰─────┴────────┴──────────┴─────────────────┴──────────────────┴───────────┴──────────╯
Total: 2 processes (1 running, 1 stopped)
```

### View process details

```bash
bgr myapp
```

Output:
```
╭────────── Process Details: myapp ──────────╮
│                                            │
│ Process Details:                           │
│ ══════════════════════════════════════════ │
│ Name: myapp                                │
│ PID: 12345                                 │
│ Status: ● Running                          │
│ Runtime: 45 minutes                        │
│ Working Directory: /home/user/app          │
│ Command: npm start                         │
│ Config Path: .config.toml                  │
│ Stdout Path: /home/.bgr/myapp-out.txt      │
│ Stderr Path: /home/.bgr/myapp-err.txt      │
│                                            │
│ Environment Variables:                     │
│ ══════════════════════════════════════════ │
│ SERVER_PORT = 3000                         │
│ DATABASE_URL = postgres://localhost/mydb   │
│                                            │
╰────────────────────────────────────────────╯
```

### Restart a process

```bash
bgr myapp --restart
```

### Delete a process

```bash
bgr --delete myapp
```

### Clean stopped processes

```bash
bgr --clean
```

### Delete all processes

```bash
bgr --nuke
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `bgr` | List all processes |
| `bgr <name>` | Show process details |
| `bgr --name <name> --directory <path> --command "<cmd>"` | Start new process |
| `bgr <name> --restart` | Restart process |
| `bgr --delete <name>` | Delete process |
| `bgr --clean` | Remove stopped processes |
| `bgr --nuke` | Delete all processes |
| `bgr --help` | Show help |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--config <path>` | Config file path | `.config.toml` |
| `--force` | Force restart running process | `false` |
| `--fetch` | Pull latest git changes | `false` |
| `--stdout <path>` | Custom stdout log path | `~/.bgr/<name>-out.txt` |
| `--stderr <path>` | Custom stderr log path | `~/.bgr/<name>-err.txt` |
| `--db <path>` | Custom database path | `~/.bgr/bgr.sqlite` |

## Configuration Files

BGR reads TOML files for environment variables:

```toml
# .config.toml
[server]
port = 3000
host = "0.0.0.0"

[database]
url = "postgresql://localhost/myapp"
pool_size = 10
```

These become environment variables:
- `SERVER_PORT=3000`
- `SERVER_HOST=0.0.0.0`
- `DATABASE_URL=postgresql://localhost/myapp`
- `DATABASE_POOL_SIZE=10`

## Examples

### Development setup

```bash
# Frontend
bgr --name frontend --directory ./frontend --command "npm run dev"

# Backend
bgr --name backend --directory ./backend --command "bun run --watch server.ts"

# Database
bgr --name postgres --directory . --command "docker run -p 5432:5432 postgres:15"
```

### Production deployment

```bash
# Start with automatic git pull
bgr --name production-api \
    --directory /var/www/api \
    --command "bun run src/server.ts" \
    --config production.toml \
    --fetch
```

## Safe Restarts

For automatic process monitoring and restart, see the [guard example](./examples/guard.ts).

## Safe Reboots

While BGR excellently manages your processes during runtime, you'll want them to restart automatically after system reboots.

1) Create systemd service:

```bash
sudo nano /etc/systemd/system/bgr-startup.service
```

Example: [bgr-startup.service](./examples/bgr-startup.service).

2) Enable and start:

```bash
sudo systemctl enable bgr-myapp.service
sudo systemctl start bgr-myapp.service
```

## File Structure

```
~/.bgr/
├── bgr.sqlite          # Process database
├── myapp-out.txt       # stdout logs
└── myapp-err.txt       # stderr logs
```

## Debugging

View process logs:

```bash
# stdout
tail -f ~/.bgr/myapp-out.txt

# stderr
tail -f ~/.bgr/myapp-err.txt
```

Check database:

```bash
sqlite3 ~/.bgr/bgr.sqlite "SELECT * FROM processes;"
```

## Testing

Run the test suite:

```bash
bun test
```