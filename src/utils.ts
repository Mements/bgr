
export function parseEnvString(envString: string): Record<string, string> {
    const env: Record<string, string> = {};
    envString.split(",").forEach(pair => {
        const [key, value] = pair.split("=");
        if (key && value) env[key] = value;
    });
    return env;
}


export function calculateRuntime(startTime: string): string {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const diffInMinutes = Math.floor((now - start) / (1000 * 60));
    return `${diffInMinutes} minutes`;
}

// Re-export specific utils from platform if they are used as generic utils
export { isProcessRunning } from "./platform";

import * as fs from "fs";
import { join } from "path";
import chalk from "chalk";

// Read version at runtime instead of using macros (macros crash on Windows)
export async function getVersion(): Promise<string> {
    try {
        const pkgPath = join(import.meta.dir, '../package.json');
        const pkg = await Bun.file(pkgPath).json();
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}


export function validateDirectory(directory: string) {
    if (!directory || !fs.existsSync(directory)) {
        console.log(chalk.red("❌ Error: 'directory' must be a valid path."));
        process.exit(1);
    }
}

export function tailFile(path: string, prefix: string, colorFn: (s: string) => string, lines?: number): () => void {
    let position = 0;
    let lastPartial = '';
    // Check if file exists first? The original code did fs.openSync which throws if not exist. 
    // Assuming caller checks persistence or we catch.

    if (!fs.existsSync(path)) {
        return () => { };
    }

    const fd = fs.openSync(path, 'r');

    const printNewContent = () => {
        try {
            const stats = fs.statSync(path);
            if (stats.size <= position) return;

            const buffer = Buffer.alloc(stats.size - position);
            fs.readSync(fd, buffer, 0, buffer.length, position);

            let content = buffer.toString();
            content = lastPartial + content;
            lastPartial = '';

            const lineArray = content.split(/\r?\n/);
            if (!content.endsWith('\n')) {
                lastPartial = lineArray.pop() || '';
            }

            lineArray.forEach(line => {
                if (line) {
                    console.log(colorFn(prefix + line));
                }
            });

            position = stats.size;
        } catch (e) {
            // ignore read errors
        }
    };

    const watcher = fs.watch(path, { persistent: true }, (event) => {
        if (event === 'change') {
            printNewContent();
        }
    });

    printNewContent(); // Check immediately

    return () => {
        watcher.close();
        try { fs.closeSync(fd); } catch { }
    };
}

