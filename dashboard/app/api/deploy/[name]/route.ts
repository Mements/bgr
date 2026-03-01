/**
 * POST /api/deploy/:name — Git pull + install deps + restart a process
 * 
 * Only works if the process directory is a git repository.
 * Steps: git pull → bun install → force restart
 */
import { getProcess } from '../../../../../src/db';
import { handleRun } from '../../../../../src/commands/run';
import { measure } from 'measure-fn';
import { $ } from 'bun';

export async function POST(req: Request, { params }: { params: { name: string } }) {
    const name = decodeURIComponent(params.name);

    try {
        const proc = getProcess(name);
        if (!proc) {
            return Response.json({ error: `Process '${name}' not found` }, { status: 404 });
        }

        const dir = proc.workdir;

        // Check if it's a git repo
        const isGit = await Bun.file(`${dir}/.git/HEAD`).exists();
        if (!isGit) {
            return Response.json({ error: `'${dir}' is not a git repository` }, { status: 400 });
        }

        const result = await measure(`Deploy "${name}"`, async () => {
            // 1. Git pull
            $.cwd(dir);
            const pullOutput = await $`git pull`.text();

            // 2. Install dependencies (detect package manager)
            let installOutput = '';
            const hasBunLock = await Bun.file(`${dir}/bun.lock`).exists() || await Bun.file(`${dir}/bun.lockb`).exists();
            const hasPackageJson = await Bun.file(`${dir}/package.json`).exists();

            if (hasPackageJson) {
                installOutput = await $`bun install`.text();
            }

            // 3. Restart the process
            await handleRun({
                action: 'run',
                name,
                force: true,
                remoteName: '',
            });

            return { pullOutput: pullOutput.trim(), installOutput: installOutput.trim() };
        });

        return Response.json({ success: true, ...result });
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
