import { z } from "zod";

export const ProcessSchema = z.object({
    id: z.number().optional(),
    pid: z.number(),
    workdir: z.string(),
    command: z.string(),
    name: z.string(),
    env: z.string(),
    configPath: z.string().optional().default(''),
    stdout_path: z.string(),
    stderr_path: z.string(),
    timestamp: z.date().default(() => new Date()),
});

// For SatiDB runtime
export const schemas = {
    process: ProcessSchema
};

// For satidb-gen code generation
export const tables = {
    process: ProcessSchema
};

export type Process = z.infer<typeof ProcessSchema>;
