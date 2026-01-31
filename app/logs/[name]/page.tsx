import { LogsViewer } from '../../components/LogsViewer';

export default function LogsPage({ params }: { params: { name: string } }) {
    const processName = decodeURIComponent(params.name);

    return (
        <div className="logs-page">
            <div className="logs-page-header">
                <a href="/" className="back-link">← Back to Dashboard</a>
                <h1>📜 Logs: {processName}</h1>
            </div>
            <LogsViewer processName={processName} />
        </div>
    );
}
