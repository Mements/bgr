import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
// @ts-ignore
import { serve, createAppRouter } from "melina";

export async function handleDashboard(port: number) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const candidates = [
        join(__dirname, "..", "..", "app"), // src/commands/dashboard.ts
        join(__dirname, "..", "app"),       // dist/index.js
        join(__dirname, "app")              // flat
    ];

    const appDir = candidates.find(path => existsSync(path));

    if (!appDir) {
        console.error(`❌ Dashboard app directory not found. Searched at:`);
        candidates.forEach(c => console.error(`   - ${c}`));
        console.error("This installation of bgr might be corrupted or missing files.");
        process.exit(1);
    }

    console.log(`🦊 Starting BGR Dashboard...`);

    try {
        await serve(createAppRouter({
            appDir,
        }), { port });
    } catch (e) {
        console.error("Failed to start dashboard:", e);
        process.exit(1);
    }
}
