import { serve } from "@ments/web";
import { getAllProcesses, getProcess, removeProcessByName, insertProcess, removeAllProcesses } from "./db";
import { handleRun } from "./commands/run";
import { handleDelete } from "./commands/cleanup";
import { isProcessRunning, terminateProcess, readFileTail } from "./platform";
import { getVersion, parseEnvString, calculateRuntime } from "./utils";

// Premium Dashboard HTML with glassmorphism and modern design
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BGR Dashboard - Process Manager</title>
    <meta name="description" content="BGR - Bun Background Runner - A modern process manager dashboard">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: rgba(22, 22, 30, 0.8);
            --bg-glass: rgba(255, 255, 255, 0.03);
            --border-glass: rgba(255, 255, 255, 0.08);
            --accent-primary: #6366f1;
            --accent-secondary: #8b5cf6;
            --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
            --success: #22c55e;
            --success-bg: rgba(34, 197, 94, 0.15);
            --danger: #ef4444;
            --danger-bg: rgba(239, 68, 68, 0.15);
            --warning: #f59e0b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --shadow-glow: 0 0 60px rgba(99, 102, 241, 0.15);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Animated background gradient */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.05) 0%, transparent 70%);
            pointer-events: none;
            z-index: 0;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
            position: relative;
            z-index: 1;
        }

        /* Header */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-glass);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .logo-icon {
            width: 48px;
            height: 48px;
            background: var(--accent-gradient);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            box-shadow: var(--shadow-glow);
        }

        .logo h1 {
            font-size: 1.75rem;
            font-weight: 700;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .logo span {
            color: var(--text-secondary);
            font-size: 0.875rem;
            font-weight: 400;
        }

        .header-actions {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .version-badge {
            padding: 0.5rem 1rem;
            background: var(--bg-glass);
            border: 1px solid var(--border-glass);
            border-radius: 9999px;
            font-size: 0.75rem;
            color: var(--text-secondary);
            backdrop-filter: blur(10px);
        }

        /* Stats Cards */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }

        .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 1.5rem;
            backdrop-filter: blur(20px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .stat-card:hover {
            transform: translateY(-2px);
            border-color: var(--accent-primary);
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.1);
        }

        .stat-card.running {
            border-left: 3px solid var(--success);
        }

        .stat-card.stopped {
            border-left: 3px solid var(--danger);
        }

        .stat-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .stat-card.running .stat-value {
            background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
            -webkit-background-clip: text;
            background-clip: text;
        }

        .stat-card.stopped .stat-value {
            background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
            -webkit-background-clip: text;
            background-clip: text;
        }

        /* Toolbar */
        .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .toolbar h2 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .btn-primary {
            background: var(--accent-gradient);
            color: white;
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(99, 102, 241, 0.4);
        }

        .btn-ghost {
            background: var(--bg-glass);
            border: 1px solid var(--border-glass);
            color: var(--text-secondary);
        }

        .btn-ghost:hover {
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-primary);
        }

        .btn-danger {
            background: var(--danger-bg);
            color: var(--danger);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.25);
        }

        /* Process Table */
        .table-container {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 20px;
            overflow: hidden;
            backdrop-filter: blur(20px);
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            text-align: left;
            padding: 1rem 1.5rem;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid var(--border-glass);
        }

        td {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border-glass);
            transition: background 0.2s ease;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        .process-name {
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .process-icon {
            width: 36px;
            height: 36px;
            background: var(--accent-gradient);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.875rem;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.375rem 0.875rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }

        .status-badge.running {
            background: var(--success-bg);
            color: var(--success);
        }

        .status-badge.stopped {
            background: var(--danger-bg);
            color: var(--danger);
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        .status-badge.running .status-dot {
            background: var(--success);
        }

        .status-badge.stopped .status-dot {
            background: var(--danger);
            animation: none;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .pid {
            font-family: 'SF Mono', Monaco, 'Fira Code', monospace;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .command {
            font-family: 'SF Mono', Monaco, 'Fira Code', monospace;
            font-size: 0.8125rem;
            color: var(--text-secondary);
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .runtime {
            color: var(--text-muted);
            font-size: 0.875rem;
        }

        .actions {
            display: flex;
            gap: 0.5rem;
        }

        .action-btn {
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-size: 1rem;
            background: var(--bg-glass);
            border: 1px solid var(--border-glass);
            color: var(--text-secondary);
        }

        .action-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-primary);
        }

        .action-btn.danger:hover {
            background: var(--danger-bg);
            color: var(--danger);
            border-color: rgba(239, 68, 68, 0.3);
        }

        .action-btn.success:hover {
            background: var(--success-bg);
            color: var(--success);
            border-color: rgba(34, 197, 94, 0.3);
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            color: var(--text-muted);
        }

        .empty-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }

        .empty-state h3 {
            font-size: 1.25rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .empty-state p {
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
        }

        /* Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal-overlay.active {
            display: flex;
        }

        .modal {
            background: var(--bg-secondary);
            border: 1px solid var(--border-glass);
            border-radius: 20px;
            width: 100%;
            max-width: 500px;
            max-height: 90vh;
            overflow: auto;
            animation: modalIn 0.3s ease;
        }

        @keyframes modalIn {
            from {
                opacity: 0;
                transform: scale(0.95) translateY(10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-glass);
        }

        .modal-header h3 {
            font-size: 1.125rem;
            font-weight: 600;
        }

        .modal-close {
            width: 32px;
            height: 32px;
            border: none;
            background: var(--bg-glass);
            border-radius: 8px;
            cursor: pointer;
            color: var(--text-muted);
            font-size: 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .modal-close:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.06);
        }

        .modal-body {
            padding: 1.5rem;
        }

        .form-group {
            margin-bottom: 1.25rem;
        }

        .form-group label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .form-group input {
            width: 100%;
            padding: 0.875rem 1rem;
            background: var(--bg-glass);
            border: 1px solid var(--border-glass);
            border-radius: 10px;
            color: var(--text-primary);
            font-size: 0.9375rem;
            font-family: inherit;
            transition: all 0.2s;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .form-group input::placeholder {
            color: var(--text-muted);
        }

        .modal-footer {
            padding: 1.25rem 1.5rem;
            border-top: 1px solid var(--border-glass);
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
        }

        /* Logs Panel */
        .logs-panel {
            margin-top: 2.5rem;
        }

        .logs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .logs-content {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 1.5rem;
            max-height: 400px;
            overflow: auto;
            font-family: 'SF Mono', Monaco, 'Fira Code', monospace;
            font-size: 0.8125rem;
            line-height: 1.6;
            color: var(--text-secondary);
            white-space: pre-wrap;
            word-break: break-all;
        }

        .log-line {
            padding: 0.125rem 0;
        }

        .log-line:hover {
            background: rgba(255, 255, 255, 0.02);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            header {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }

            .table-container {
                overflow-x: auto;
            }

            table {
                min-width: 800px;
            }

            .toolbar {
                flex-direction: column;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <div class="logo-icon">⚡</div>
                <div>
                    <h1>BGR</h1>
                    <span>Background Runner</span>
                </div>
            </div>
            <div class="header-actions">
                <span class="version-badge" id="version">Loading...</span>
                <button class="btn btn-ghost" onclick="refreshData()">🔄 Refresh</button>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Processes</div>
                <div class="stat-value" id="total-count">-</div>
            </div>
            <div class="stat-card running">
                <div class="stat-label">Running</div>
                <div class="stat-value" id="running-count">-</div>
            </div>
            <div class="stat-card stopped">
                <div class="stat-label">Stopped</div>
                <div class="stat-value" id="stopped-count">-</div>
            </div>
        </div>

        <div class="toolbar">
            <h2>Processes</h2>
            <div>
                <button class="btn btn-primary" onclick="openNewProcessModal()">➕ New Process</button>
            </div>
        </div>

        <div class="table-container">
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
                <tbody id="processes-table">
                    <tr>
                        <td colspan="6">
                            <div class="empty-state">
                                <div class="empty-icon">🔍</div>
                                <h3>Loading processes...</h3>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="logs-panel" id="logs-panel" style="display: none;">
            <div class="logs-header">
                <h2>📜 Logs: <span id="logs-process-name"></span></h2>
                <button class="btn btn-ghost" onclick="closeLogs()">✕ Close</button>
            </div>
            <div class="logs-content" id="logs-content"></div>
        </div>
    </div>

    <!-- New Process Modal -->
    <div class="modal-overlay" id="new-process-modal">
        <div class="modal">
            <div class="modal-header">
                <h3>➕ New Process</h3>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="process-name">Process Name</label>
                    <input type="text" id="process-name" placeholder="my-app">
                </div>
                <div class="form-group">
                    <label for="process-command">Command</label>
                    <input type="text" id="process-command" placeholder="bun run dev">
                </div>
                <div class="form-group">
                    <label for="process-directory">Working Directory</label>
                    <input type="text" id="process-directory" placeholder="/path/to/app">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="createProcess()">Create Process</button>
            </div>
        </div>
    </div>

    <script>
        let processes = [];
        let selectedProcess = null;

        async function loadVersion() {
            try {
                const res = await fetch('/api/version');
                const data = await res.json();
                document.getElementById('version').textContent = 'v' + data.version;
            } catch(e) {
                document.getElementById('version').textContent = 'BGR';
            }
        }

        async function loadProcesses() {
            try {
                const res = await fetch('/api/processes');
                processes = await res.json();
                renderProcesses();
                updateStats();
            } catch(e) {
                console.error('Failed to load processes:', e);
            }
        }

        function updateStats() {
            const total = processes.length;
            const running = processes.filter(p => p.running).length;
            const stopped = total - running;
            
            document.getElementById('total-count').textContent = total;
            document.getElementById('running-count').textContent = running;
            document.getElementById('stopped-count').textContent = stopped;
        }

        function renderProcesses() {
            const tbody = document.getElementById('processes-table');
            
            if (processes.length === 0) {
                tbody.innerHTML = \`
                    <tr>
                        <td colspan="6">
                            <div class="empty-state">
                                <div class="empty-icon">📦</div>
                                <h3>No processes running</h3>
                                <p>Start a new process to see it here</p>
                                <button class="btn btn-primary" onclick="openNewProcessModal()">➕ Create Process</button>
                            </div>
                        </td>
                    </tr>
                \`;
                return;
            }

            tbody.innerHTML = processes.map(p => \`
                <tr>
                    <td>
                        <div class="process-name">
                            <div class="process-icon">\${p.name.charAt(0).toUpperCase()}</div>
                            <span>\${escapeHtml(p.name)}</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge \${p.running ? 'running' : 'stopped'}">
                            <span class="status-dot"></span>
                            \${p.running ? 'Running' : 'Stopped'}
                        </span>
                    </td>
                    <td class="pid">\${p.pid}</td>
                    <td class="command" title="\${escapeHtml(p.command)}">\${escapeHtml(p.command)}</td>
                    <td class="runtime">\${p.runtime || '-'}</td>
                    <td class="actions">
                        <button class="action-btn" onclick="viewLogs('\${escapeHtml(p.name)}')" title="View Logs">📜</button>
                        \${p.running 
                            ? \`<button class="action-btn danger" onclick="stopProcess('\${escapeHtml(p.name)}')" title="Stop">⏹️</button>\`
                            : \`<button class="action-btn success" onclick="restartProcess('\${escapeHtml(p.name)}')" title="Restart">▶️</button>\`
                        }
                        <button class="action-btn danger" onclick="deleteProcess('\${escapeHtml(p.name)}')" title="Delete">🗑️</button>
                    </td>
                </tr>
            \`).join('');
        }

        function escapeHtml(str) {
            if (typeof str !== 'string') return str;
            return str.replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;')
                      .replace(/"/g, '&quot;')
                      .replace(/'/g, '&#039;');
        }

        function openNewProcessModal() {
            document.getElementById('new-process-modal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('new-process-modal').classList.remove('active');
            document.getElementById('process-name').value = '';
            document.getElementById('process-command').value = '';
            document.getElementById('process-directory').value = '';
        }

        async function createProcess() {
            const name = document.getElementById('process-name').value.trim();
            const command = document.getElementById('process-command').value.trim();
            const directory = document.getElementById('process-directory').value.trim();

            if (!name || !command || !directory) {
                alert('Please fill in all fields');
                return;
            }

            try {
                const res = await fetch('/api/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, command, directory })
                });
                
                if (res.ok) {
                    closeModal();
                    await loadProcesses();
                } else {
                    const data = await res.json();
                    alert('Failed: ' + (data.error || 'Unknown error'));
                }
            } catch(e) {
                alert('Failed to create process: ' + e.message);
            }
        }

        async function stopProcess(name) {
            if (!confirm(\`Stop process "\${name}"?\`)) return;
            
            try {
                await fetch('/api/stop/' + encodeURIComponent(name), { method: 'POST' });
                await loadProcesses();
            } catch(e) {
                alert('Failed to stop: ' + e.message);
            }
        }

        async function restartProcess(name) {
            try {
                await fetch('/api/restart/' + encodeURIComponent(name), { method: 'POST' });
                await loadProcesses();
            } catch(e) {
                alert('Failed to restart: ' + e.message);
            }
        }

        async function deleteProcess(name) {
            if (!confirm(\`Delete process "\${name}"? This will stop it and remove all records.\`)) return;
            
            try {
                await fetch('/api/processes/' + encodeURIComponent(name), { method: 'DELETE' });
                await loadProcesses();
            } catch(e) {
                alert('Failed to delete: ' + e.message);
            }
        }

        async function viewLogs(name) {
            document.getElementById('logs-panel').style.display = 'block';
            document.getElementById('logs-process-name').textContent = name;
            selectedProcess = name;
            await refreshLogs();
        }

        async function refreshLogs() {
            if (!selectedProcess) return;
            
            try {
                const res = await fetch('/api/logs/' + encodeURIComponent(selectedProcess));
                const data = await res.json();
                const logsContent = document.getElementById('logs-content');
                
                const lines = (data.stdout || '').split('\\n')
                    .map(line => \`<div class="log-line">\${escapeHtml(line)}</div>\`)
                    .join('');
                    
                logsContent.innerHTML = lines || '<em>No logs available</em>';
                logsContent.scrollTop = logsContent.scrollHeight;
            } catch(e) {
                document.getElementById('logs-content').innerHTML = '<em>Failed to load logs</em>';
            }
        }

        function closeLogs() {
            document.getElementById('logs-panel').style.display = 'none';
            selectedProcess = null;
        }

        function refreshData() {
            loadProcesses();
            if (selectedProcess) {
                refreshLogs();
            }
        }

        // Initial load
        loadVersion();
        loadProcesses();

        // Auto-refresh every 3 seconds
        setInterval(refreshData, 3000);

        // Close modal on Escape
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                closeModal();
                closeLogs();
            }
        });

        // Close modal on overlay click
        document.getElementById('new-process-modal').addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay')) {
                closeModal();
            }
        });
    </script>
</body>
</html>`;
}

export async function startServer(port: number = 3000) {
  console.log(`🚀 Starting BGR Dashboard on http://localhost:${port}`);

  serve(async (req) => {
    const url = new URL(req.url);

    // API Endpoints
    if (url.pathname === "/api/processes") {
      const procs = getAllProcesses();
      // Enrich with live status and runtime
      const enriched = await Promise.all(procs.map(async p => {
        const running = await isProcessRunning(p.pid);
        const envVars = parseEnvString(p.env);
        return {
          ...p,
          running,
          runtime: calculateRuntime(p.timestamp),
          envVars
        };
      }));
      return enriched;
    }

    if (url.pathname === "/api/version") {
      return { version: await getVersion() };
    }

    // Logs endpoint
    if (url.pathname.startsWith("/api/logs/")) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (name) {
        const proc = getProcess(name);
        if (proc) {
          const lines = 100;
          const stdout = await readFileTail(proc.stdout_path, lines);
          const stderr = await readFileTail(proc.stderr_path, lines);
          return { stdout, stderr };
        }
        return new Response(JSON.stringify({ error: "Process not found" }), { status: 404 });
      }
    }

    // Start/Create process
    if (req.method === "POST" && url.pathname === "/api/start") {
      const body = await req.json();
      try {
        await handleRun({
          action: 'run',
          name: body.name,
          command: body.command,
          directory: body.directory,
          force: body.force,
          remoteName: '',
        });
        return { success: true };
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // Stop process
    if (req.method === "POST" && url.pathname.startsWith("/api/stop/")) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (name) {
        const proc = getProcess(name);
        if (proc && await isProcessRunning(proc.pid)) {
          await terminateProcess(proc.pid);
          return { success: true };
        }
        return new Response(JSON.stringify({ error: "Process not found or not running" }), { status: 404 });
      }
    }

    // Restart process
    if (req.method === "POST" && url.pathname.startsWith("/api/restart/")) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (name) {
        try {
          await handleRun({
            action: 'run',
            name,
            force: true,
            remoteName: '',
          });
          return { success: true };
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      }
    }

    // Delete process
    if (req.method === "DELETE" && url.pathname.startsWith("/api/processes/")) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (name) {
        const proc = getProcess(name);
        if (proc) {
          if (await isProcessRunning(proc.pid)) {
            await terminateProcess(proc.pid);
          }
          removeProcessByName(name);
          return { success: true };
        }
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }
    }

    // Default: serve dashboard
    return new Response(getDashboardHTML(), {
      headers: { "Content-Type": "text/html" }
    });
  }, { port });
}
