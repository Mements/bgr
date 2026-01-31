'use client';

import { useState, useEffect, useRef } from 'react';
import { island } from 'melina/island';

function LogsPanelImpl() {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [processName, setProcessName] = useState('');
    const [logs, setLogs] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const logsRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Listen for log view requests
        const handleViewLogs = (e: CustomEvent<{ name: string }>) => {
            const name = e.detail.name;
            setProcessName(name);
            setIsOpen(true);
            loadLogs(name);

            // Auto-refresh logs every 2s
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => loadLogs(name), 2000);
        };

        window.addEventListener('bgr:viewLogs', handleViewLogs as EventListener);

        return () => {
            window.removeEventListener('bgr:viewLogs', handleViewLogs as EventListener);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    async function loadLogs(name: string) {
        setIsLoading(true);
        try {
            const res = await fetch('/api/logs/' + encodeURIComponent(name));
            if (res.ok) {
                const data = await res.json();
                setLogs(data.stdout || '');
                // Auto-scroll to bottom
                if (logsRef.current) {
                    logsRef.current.scrollTop = logsRef.current.scrollHeight;
                }
            }
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setIsLoading(false);
        }
    }

    function close() {
        setIsOpen(false);
        setIsExpanded(false);
        setProcessName('');
        setLogs('');
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    function toggleExpand() {
        setIsExpanded(!isExpanded);
    }

    if (!isOpen) return null;

    return (
        <div className={`logs-floating-panel ${isExpanded ? 'expanded' : ''}`}>
            <div className="logs-panel-header">
                <div className="logs-panel-title">
                    <span className="logs-icon">📜</span>
                    <span>{processName}</span>
                    {isLoading && <span className="logs-loading">●</span>}
                </div>
                <div className="logs-panel-actions">
                    <button
                        className="logs-btn"
                        onClick={toggleExpand}
                        title={isExpanded ? 'Minimize' : 'Expand'}
                    >
                        {isExpanded ? '⊖' : '⊕'}
                    </button>
                    <a
                        href={`/logs/${encodeURIComponent(processName)}`}
                        className="logs-btn"
                        title="Open Full Page"
                    >
                        ↗
                    </a>
                    <button className="logs-btn" onClick={close} title="Close">✕</button>
                </div>
            </div>
            <div className="logs-panel-content" ref={logsRef}>
                {logs ? (
                    logs.split('\n').map((line, i) => (
                        <div key={i} className="log-line">{line}</div>
                    ))
                ) : (
                    <div className="logs-empty">No logs available</div>
                )}
            </div>
        </div>
    );
}

// Export the island-wrapped version
export const LogsPanel = island(LogsPanelImpl, 'LogsPanel');
