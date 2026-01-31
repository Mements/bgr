import { handleRun } from '../../../src/commands/run';

export async function POST(req: Request) {
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.command) {
        return Response.json({
            error: "Name and command are required"
        }, { status: 400 });
    }

    try {
        await handleRun({
            action: 'run',
            name: body.name,
            command: body.command,
            // Default to current working directory if not provided
            directory: body.directory || process.cwd(),
            force: body.force || false,
            remoteName: '',
        });
        return Response.json({ success: true });
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
