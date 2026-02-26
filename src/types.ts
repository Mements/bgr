export interface CommandOptions {
    remoteName?: string;
    command?: string;
    directory?: string;
    env?: Record<string, string>;
    configPath?: string;
    action?: string;
    name?: string;
    force?: boolean;
    fetch?: boolean;
    stdout?: string;
    stderr?: string;
    dbPath?: string;
}
