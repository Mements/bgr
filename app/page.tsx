import { ProcessDashboard } from './components/ProcessDashboard';
import { LogsPanel } from './components/LogsPanel';

export default function HomePage() {
    return (
        <>
            {/* Client Island for Process Dashboard */}
            <ProcessDashboard />

            {/* Client Island for Logs */}
            <LogsPanel />
        </>
    );
}
