'use client';

import { useState, useEffect, useRef } from 'react';
import { island } from 'melina/island';

interface LogsViewerProps {
    processName: string;
}

function LogsViewerImpl({ processName }: LogsViewerProps) {
    const [logs, setLogs] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);
    const logsRef = useRef<HTMLDivElement>(null);

    async function loadLogs() {
        try {
            const res = await fetch('/api/logs/' + encodeURIComponent(processName));
            if (res.ok) {
                const data = await res.json();
                setLogs(data.stdout || '');
                // Auto-scroll to bottom if enabled
                if (autoScroll && logsRef.current) {
                    logsRef.current.scrollTop = logsRef.current.scrollHeight;
                }
            }
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadLogs();
        // Auto-refresh logs every 2s
        const interval = setInterval(loadLogs, 2000);
        return () => clearInterval(interval);
    }, [processName]);

    if (isLoading) {
        return (
            <div className="logs-viewer-loading">
                <div className="loading-spinner">⏳</div>
                <p>Loading logs...</p>
            </div>
        );
    }

    return (
        <div className="logs-viewer">
            <div className="logs-viewer-toolbar">
                <label className="auto-scroll-toggle">
                    <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                    />
                    Auto-scroll
                </label>
                <button className="btn btn-ghost" onClick={loadLogs}>
                    🔄 Refresh
                </button>
            </div>
            <div className="logs-viewer-content" ref={logsRef}>
                {logs ? (
                    logs.split('\n').map((line, i) => (
                        <div key={i} className="log-line">
                            <span className="log-line-number">{i + 1}</span>
                            <span className="log-line-content">{line}</span>
                        </div>
                    ))
                ) : (
                    <div className="logs-empty">No logs available for this process</div>
                )}
            </div>
        </div>
    );
}

// Export the island-wrapped version
export const LogsViewer = island(LogsViewerImpl, 'LogsViewer');
