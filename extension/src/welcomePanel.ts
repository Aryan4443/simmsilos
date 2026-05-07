import * as vscode from "vscode";
import { Task } from "./api";

export class WelcomePanel {
  static onRefresh: (() => void) | undefined;
  private static _panel: vscode.WebviewPanel | undefined;

  static update(data: { username: string; role: string; branch: string | null; tasks: Task[] }) {
    if (WelcomePanel._panel) {
      WelcomePanel._panel.webview.html = getHtml(data);
    }
  }

  static show(_context: vscode.ExtensionContext, data: {
    username: string;
    role: string;
    branch: string | null;
    tasks: Task[];
  }) {
    if (WelcomePanel._panel) {
      WelcomePanel._panel.webview.html = getHtml(data);
      WelcomePanel._panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "simmsilosWelcome",
      "SimmSilos — Dashboard",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    WelcomePanel._panel = panel;
    panel.onDidDispose(() => { WelcomePanel._panel = undefined; });
    panel.webview.html = getHtml(data);

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.command === "openTasks") {
        vscode.commands.executeCommand("simmsilos.tasks.focus");
      } else if (msg.command === "openFiles") {
        vscode.commands.executeCommand("simmsilos.files.focus");
      } else if (msg.command === "refresh") {
        WelcomePanel.onRefresh?.();
      }
    });
  }
}

function getHtml(data: { username: string; role: string; branch: string | null; tasks: Task[] }): string {
  const taskRows = data.tasks.length
    ? data.tasks.map(t => `
        <div class="task">
          <span class="task-icon ${t.status}">${t.status === "done" ? "✓" : t.status === "in_progress" ? "↻" : "○"}</span>
          <span class="task-name">${t.function}</span>
          <span class="task-status">${t.status.replace("_", " ")}</span>
        </div>`).join("")
    : `<div class="empty">No tasks assigned yet</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 40px;
      max-width: 700px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }
    .logo { font-size: 24px; font-weight: 700; color: var(--vscode-textLink-foreground); }
    .welcome { font-size: 14px; color: var(--vscode-descriptionForeground); }
    .username { font-weight: 600; color: var(--vscode-editor-foreground); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      padding: 20px;
    }
    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 18px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .task {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .task-icon { font-size: 16px; width: 20px; text-align: center; }
    .task-icon.done { color: #4caf50; }
    .task-icon.in_progress { color: #2196f3; }
    .task-icon.pending { color: var(--vscode-descriptionForeground); }
    .task-name { flex: 1; font-size: 14px; }
    .task-status { font-size: 12px; color: var(--vscode-descriptionForeground); }
    .empty { color: var(--vscode-descriptionForeground); font-size: 13px; padding: 12px 0; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    button {
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">SimmSilos</div>
      <div class="welcome">Welcome back, <span class="username">${data.username}</span></div>
    </div>
    <span class="badge">${data.role}</span>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Assigned Branch</div>
      <div class="card-value">${data.branch ?? "Not assigned"}</div>
    </div>
    <div class="card">
      <div class="card-label">Tasks</div>
      <div class="card-value">${data.tasks.length} assigned</div>
    </div>
  </div>

  <div class="section-title">My Tasks</div>
  ${taskRows}

  <div class="actions">
    <button onclick="vscode.postMessage({command:'openTasks'})">View Tasks</button>
    <button onclick="vscode.postMessage({command:'openFiles'})">Browse Silo Files</button>
    <button onclick="vscode.postMessage({command:'refresh'})" style="background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)">↻ Refresh</button>
  </div>

  <script>const vscode = acquireVsCodeApi();</script>
</body>
</html>`;
}
