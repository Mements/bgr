'use client';

import { useState, useEffect } from 'react';
import { island } from 'melina/island';

interface Process {
    name: string;
    pid: number;
    command: string;
    running: boolean;
    runtime: string;
    timestamp?: number;
}

interface NewProcessForm {
    name: string;
    command: string;
    directory: string;
}

function ProcessDashboardImpl() {
    const [processes, setProcesses] = useState<Process[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showNewProcessModal, setShowNewProcessModal] = useState(false);
    const [newProcessForm, setNewProcessForm] = useState<NewProcessForm>({
        name: '',
        command: '',
        directory: '',
    });
    const [isCreating, setIsCreating] = useState(false);

    const fetchProcesses = async () => {
        try {
            const res = await fetch('/api/processes');
            if (!res.ok) throw new Error('Failed to fetch processes');
            const data = await res.json();
            setProcesses(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProcesses();
        // Auto-refresh every 5 seconds
        const interval = setInterval(fetchProcesses, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleViewLogs = (name: string) => {
        window.dispatchEvent(new CustomEvent('bgr:viewLogs', { detail: { name } }));
    };

    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleAction = async (action: 'restart' | 'stop', name: string) => {
        setActionLoading(`${action}-${name}`);
        try {
            const res = await fetch(`/api/${action}/${encodeURIComponent(name)}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                console.error(`Failed to ${action} process:`, data.error);
                alert(`Failed to ${action} ${name}: ${data.error || 'Unknown error'}`);
            } else {
                // Refresh after successful action
                await fetchProcesses();
            }
        } catch (e) {
            console.error(`Failed to ${action} process:`, e);
            alert(`Failed to ${action} ${name}: Network error`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleCreateProcess = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newProcessForm.name.trim() || !newProcessForm.command.trim()) {
            alert('Name and command are required');
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newProcessForm.name.trim(),
                    command: newProcessForm.command.trim(),
                    directory: newProcessForm.directory.trim() || undefined,
                    force: false,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(`Failed to create process: ${data.error || 'Unknown error'}`);
            } else {
                // Reset form and close modal
                setNewProcessForm({ name: '', command: '', directory: '' });
                setShowNewProcessModal(false);
                // Refresh processes
                await fetchProcesses();
            }
        } catch (e) {
            console.error('Failed to create process:', e);
            alert('Failed to create process: Network error');
        } finally {
            setIsCreating(false);
        }
    };

    const total = processes.length;
    const running = processes.filter(p => p.running).length;
    const stopped = total - running;

    if (isLoading) {
        return (
            <div className="loading-state">
                <div className="loading-spinner">⏳</div>
                <p>Loading processes...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-state">
                <div className="error-icon">❌</div>
                <h3>Error loading processes</h3>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={fetchProcesses}>Retry</button>
            </div>
        );
    }

    return (
        <>
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Processes</div>
                    <div className="stat-value">{total}</div>
                </div>
                <div className="stat-card running">
                    <div className="stat-label">Running</div>
                    <div className="stat-value">{running}</div>
                </div>
                <div className="stat-card stopped">
                    <div className="stat-label">Stopped</div>
                    <div className="stat-value">{stopped}</div>
                </div>
            </div>

            <div className="toolbar">
                <h2>Processes</h2>
                <div>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowNewProcessModal(true)}
                    >
                        ➕ New Process
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ marginLeft: '1rem' }}
                        onClick={fetchProcesses}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Process</th>
                            <th>Status</th>
                            <th>PID</th>
                            <th>Command</th>
                            <th>Runtime</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processes.length === 0 ? (
                            <tr>
                                <td colSpan={6}>
                                    <div className="empty-state">
                                        <div className="empty-icon">📦</div>
                                        <h3>No processes running</h3>
                                        <p>Click "New Process" to add your first process</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setShowNewProcessModal(true)}
                                        >
                                            ➕ New Process
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            processes.map((p) => (
                                <tr key={p.name}>
                                    <td>
                                        <div className="process-name">
                                            <div className="process-icon">{p.name.charAt(0).toUpperCase()}</div>
                                            <span>{p.name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${p.running ? 'running' : 'stopped'}`}>
                                            <span className="status-dot"></span>
                                            {p.running ? 'Running' : 'Stopped'}
                                        </span>
                                    </td>
                                    <td className="pid">{p.pid}</td>
                                    <td className="command" title={p.command}>{p.command}</td>
                                    <td className="runtime">{p.runtime || '-'}</td>
                                    <td className="actions">
                                        <button
                                            className="action-btn"
                                            title="View Logs"
                                            onClick={() => handleViewLogs(p.name)}
                                        >
                                            📜
                                        </button>
                                        <button
                                            className="action-btn"
                                            title="Restart"
                                            onClick={() => handleAction('restart', p.name)}
                                        >
                                            🔄
                                        </button>
                                        {p.running && (
                                            <button
                                                className="action-btn"
                                                title="Stop"
                                                onClick={() => handleAction('stop', p.name)}
                                            >
                                                ⏹️
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* New Process Modal */}
            {showNewProcessModal && (
                <div className="modal-overlay active" onClick={() => setShowNewProcessModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>➕ New Process</h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowNewProcessModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleCreateProcess}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label htmlFor="process-name">Process Name *</label>
                                    <input
                                        id="process-name"
                                        type="text"
                                        placeholder="my-server"
                                        value={newProcessForm.name}
                                        onChange={(e) => setNewProcessForm(prev => ({ ...prev, name: e.target.value }))}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="process-command">Command *</label>
                                    <input
                                        id="process-command"
                                        type="text"
                                        placeholder="node server.js"
                                        value={newProcessForm.command}
                                        onChange={(e) => setNewProcessForm(prev => ({ ...prev, command: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="process-directory">Working Directory (optional)</label>
                                    <input
                                        id="process-directory"
                                        type="text"
                                        placeholder="/path/to/project"
                                        value={newProcessForm.directory}
                                        onChange={(e) => setNewProcessForm(prev => ({ ...prev, directory: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowNewProcessModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isCreating}
                                >
                                    {isCreating ? '⏳ Creating...' : '🚀 Start Process'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

// Export the island-wrapped version
export const ProcessDashboard = island(ProcessDashboardImpl, 'ProcessDashboard');
