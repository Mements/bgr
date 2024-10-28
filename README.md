# Bun-Git-Run (BGR)

*A lightweight process manager written in Bun*

BGR is a simple yet powerful process manager that helps you manage long-running processes with ease. It provides process monitoring, environment configuration, and detailed logging capabilities.

## Key Features 🚀

- **Process Management**: Start, stop, and monitor your processes with simple commands
- **Environment Configuration**: Support for environment variables via config files
- **Detailed Logging**: Separate stdout and stderr logs for each process
- **SQLite Storage**: Reliable process state tracking using SQLite database
- **Zero Runtime Dependencies**: Only requires Bun to run

## Installation

1. Clone and install:
```bash
git clone https://github.com/7flash/bgr.git $HOME/bgr
cd bgr && bun install
```

2. Compile bgrun:
```bash
bun build ./src/index.ts --compile --outfile ./bin/bgrun
```

3. Add to your PATH (in ~/.bashrc):
```bash
export PATH="$HOME/bgr/bin:$PATH"
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

## Comparison with PM2

While PM2 offers a rich set of features for Node.js applications, BGR provides:

- **Simplicity**: Minimal setup and dependencies
- **Bun Runtime**: Native support for Bun applications
- **SQLite Storage**: Reliable process state persistence
- **Structured Logging**: Separate stdout/stderr logs per process
- **Config Files**: Easy environment variable management

## License

This project is licensed under the MIT License.