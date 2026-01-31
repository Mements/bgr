import { handleRun } from '../../../../src/commands/run';

async function restartProcess(name: string) {
    if (name) {
        try {
            await handleRun({
                action: 'run',
                name,
                force: true,
                remoteName: '',
            });
            return Response.json({ success: true });
        } catch (e: any) {
            return Response.json({ error: e.message }, { status: 500 });
        }
    }
    return Response.json({ error: "Name required" }, { status: 400 });
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
    return restartProcess(params.name);
}

export async function GET(req: Request, { params }: { params: { name: string } }) {
    return restartProcess(params.name);
}
