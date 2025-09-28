## Task
Implement a --watch flag that uses Bun's watch() API to watch for file changes in the directory of the running process and automatically restart the process on changes. The implementation should also support showing -err and -out logs while watching.

## Context
Based on the existing codebase:

### Current Structure:
- Main entry point: `src/index.ts`
- Command parsing uses `parseArgs` from Bun
- Process management functions: `handleRun`, `showAll`, `showLogs`, etc.
- Database operations use SQLite through Bun:sqlite
- Logging system writes stdout/stderr to files
- Process spawning uses `Bun.spawn` with environment variables

### Key Functions and Patterns:
- `handleRun(options)` - Creates and manages process execution (lines 428-550)
- `showLogs(name, logType, lines?)` - Displays process logs (lines 318-379)
- `isProcessRunning(pid)` - Checks if process is running (lines 116-119)
- `terminateProcess(pid)` - Kills existing process (lines 121-123)
- Process creation uses `Bun.spawn(["sh", "-c", finalCommand], {...})`
- Environment variables are handled through `env: {...Bun.env, ...finalEnv}`
- Log files are created and managed through stdout/stderr redirection

### Current Command Structure:
```typescript
const args = parseArgs({
  args: Bun.argv,
  options: {
    watch: { type: "boolean" }, // Add this
    "log-stdout": { type: "boolean" },
    "log-stderr": { type: "boolean" },
    // ... existing options
  },
  allowPositionals: true
});
```

## Suggestions
1. **Watch Implementation**: Use `Bun.watch()` to monitor file changes in the working directory
2. **Process Management**: Need to gracefully terminate current process and spawn new one
3. **Log Display**: Continue showing stdout/stderr logs during watch mode
4. **Bun.watch() API**: Should monitor file changes and trigger restart
5. **Signal Handling**: Handle SIGINT gracefully to clean up watch mode

## Format
Provide the complete implementation of the --watch functionality including:
1. Adding watch flag to command parsing
2. Implementing watch mode with process restart logic
3. Integrating log display options (-err and -out)
4. Proper cleanup and signal handling

## Files
/Users/gur/Documents/bgr/src/index.ts