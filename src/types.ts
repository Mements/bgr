export interface CommandOptions {
    remoteName: string;
    command?: string;
    directory?: string;
    env?: Record<string, string>;
    configPath?: string;
    action: string;
    name?: string;
    force?: boolean;
    fetch?: boolean;
    stdout?: string;
    stderr?: string;
    dbPath?: string;
}

export interface ProcessRecord {
    id: number;
    pid: number;
    workdir: string;
    command: string;
    name: string;
    env: string;
    timestamp: string;
    configPath?: string;
    stdout_path: string;
    stderr_path: string;
}
