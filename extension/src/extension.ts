import * as vscode from "vscode";
import * as auth from "./auth";
import * as api from "./api";
import { TasksProvider } from "./tasksProvider";
import { FilesProvider } from "./filesProvider";
import { SiloFileSystemProvider, SCHEME, siloUri } from "./siloFs";
import { LoginPanel } from "./loginPanel";
import { WelcomePanel } from "./welcomePanel";

type Me = Awaited<ReturnType<typeof api.getMe>>;

export async function activate(context: vscode.ExtensionContext) {
  const tasksProvider = new TasksProvider();
  const filesProvider = new FilesProvider(() => auth.ensureFreshToken(context));

  const siloFs = new SiloFileSystemProvider(() => auth.ensureFreshToken(context));
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(SCHEME, siloFs, { isCaseSensitive: true })
  );

  vscode.window.registerTreeDataProvider("simmsilos.tasks", tasksProvider);
  vscode.window.registerTreeDataProvider("simmsilos.files", filesProvider);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "simmsilos.refresh";
  statusBar.text = "$(sync) SimmSilos";
  statusBar.show();
  context.subscriptions.push(statusBar);

  let _knownTaskIds = new Set<number>();
  let _currentMe: Me | null = null;

  function updateStatusBar(me: Me) {
    const pending = tasksProvider.pendingCount;
    const badge = pending > 0 ? ` $(bell) ${pending}` : "";
    statusBar.text = `$(git-branch) ${me.branch ?? "unassigned"} | ${me.username}${badge}`;
    statusBar.tooltip = `SimmSilos — ${pending} pending task(s). Click to refresh.`;
  }

  // single source of truth for loading session data
  async function refreshSession(token: string, refreshFiles = true): Promise<Me | undefined> {
    try {
      const me = await api.getMe(token);
      _currentMe = me;
      tasksProvider.update(me.tasks);
      if (refreshFiles) filesProvider.refresh();
      updateStatusBar(me);
      WelcomePanel.update(me);
      return me;
    } catch {
      vscode.window.showErrorMessage("SimmSilos: failed to load profile");
    }
  }

  async function boot(refreshFiles = false): Promise<Me | undefined> {
    const token = await auth.ensureFreshToken(context);
    if (!token) { statusBar.text = "$(account) SimmSilos: Not logged in"; return; }
    return refreshSession(token, refreshFiles);
  }

  async function pollTasks() {
    const token = await auth.ensureFreshToken(context);
    if (!token) return;
    try {
      const me = await api.getMe(token);
      const prevIds = _knownTaskIds;
      const newTasks = me.tasks.filter(t => !prevIds.has(t.id));

      // only update UI if something actually changed
      if (newTasks.length > 0 || me.tasks.length !== prevIds.size) {
        _currentMe = me;
        tasksProvider.update(me.tasks);
        updateStatusBar(me);
        _knownTaskIds = new Set(me.tasks.map(t => t.id));
      }

      newTasks.forEach(t => {
        vscode.window.showInformationMessage(
          `SimmSilos: new task → ${t.function} on ${t.branch}`, "View Tasks"
        ).then(a => { if (a === "View Tasks") vscode.commands.executeCommand("simmsilos.tasks.focus"); });
      });
    } catch {}
  }

  const poller = setInterval(pollTasks, 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(poller) });

  async function doLogin(username: string, password: string): Promise<boolean> {
    try {
      const { token } = await api.login(username, password);
      await context.secrets.store("simmsilos.token", token);
      const me = await refreshSession(token, true);
      if (!me) return false;
      _knownTaskIds = new Set(me.tasks.map(t => t.id));
      return true;
    } catch { return false; }
  }

  function registerMarkCommand(command: string, status: "done" | "in_progress") {
    return vscode.commands.registerCommand(command, async (item: any) => {
      const task = item?.task ?? item;
      const token = await auth.ensureFreshToken(context);
      if (!token) return;
      await api.updateTaskStatus(token, task.id, status);
      await boot(false); // task status changed, no need to reload files
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("simmsilos.login", () => LoginPanel.show(context, doLogin)),

    vscode.commands.registerCommand("simmsilos.logout", async () => {
      await auth.logout(context);
      _currentMe = null;
      tasksProvider.update([]);
      filesProvider.refresh();
      statusBar.text = "$(account) SimmSilos: Not logged in";
    }),

    vscode.commands.registerCommand("simmsilos.refresh", async () => {
      await boot(true);
      vscode.window.showInformationMessage("SimmSilos refreshed");
    }),

    vscode.commands.registerCommand("simmsilos.syncSilo", async () => {
      const token = await auth.ensureFreshToken(context);
      if (!token) return vscode.window.showErrorMessage("Not logged in");
      const confirm = await vscode.window.showWarningMessage(
        "Sync will overwrite your local silo files. Continue?", "Yes", "No"
      );
      if (confirm !== "Yes") return;
      await api.syncSilo(token);
      filesProvider.refresh();
      vscode.window.showInformationMessage("Silo synced from project");
    }),

    registerMarkCommand("simmsilos.markDone", "done"),
    registerMarkCommand("simmsilos.markInProgress", "in_progress"),

    vscode.commands.registerCommand("simmsilos.viewTask", async (task: api.Task) => {
      const panel = vscode.window.createWebviewPanel(
        "simmsilosTask", `Task: ${task.function}`, vscode.ViewColumn.One, {}
      );
      const date = new Date(task.assigned_at * 1000).toLocaleString();
      const color = task.status === "done" ? "#4caf50" : task.status === "in_progress" ? "#2196f3" : "#aaa";
      panel.webview.html = `<!DOCTYPE html><html><head><style>
        body{font-family:-apple-system,sans-serif;padding:32px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground)}
        h2{margin-bottom:24px}.row{margin-bottom:16px}
        .label{font-size:11px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:4px}
        .value{font-size:15px;font-weight:500}
        .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:600;background:${color}33;color:${color}}
      </style></head><body>
        <h2>${task.function}</h2>
        <div class="row"><div class="label">Status</div><div class="value"><span class="badge">${task.status.replace("_", " ")}</span></div></div>
        <div class="row"><div class="label">Branch</div><div class="value">${task.branch}</div></div>
        <div class="row"><div class="label">Assigned</div><div class="value">${date}</div></div>
        <div class="row"><div class="label">Task ID</div><div class="value">#${task.id}</div></div>
      </body></html>`;
    }),

    vscode.commands.registerCommand("simmsilos.switchBranch", () => {
      const me = _currentMe;
      if (!me?.branch) return vscode.window.showInformationMessage("No branch assigned");
      vscode.window.showInformationMessage(`Current branch: ${me.branch}. Contact admin to switch.`);
    }),

    vscode.commands.registerCommand("simmsilos.diffSilo", async (item: any) => {
      const token = await auth.ensureFreshToken(context);
      if (!token) return;
      const path = item?.resourcePath;
      if (!path) return;
      // fetch current content as "before", open silo URI as "after" (editable)
      try {
        const { content } = await api.readFile(token, path);
        const beforeUri = vscode.Uri.from({ scheme: "untitled", path: `project-master/${path}` });
        const edit = new vscode.WorkspaceEdit();
        edit.insert(beforeUri, new vscode.Position(0, 0), content);
        await vscode.workspace.applyEdit(edit);
        vscode.commands.executeCommand("vscode.diff", beforeUri, siloUri(path), `Project master ↔ Silo: ${path}`);
      } catch {
        vscode.window.showErrorMessage(`Could not load file for diff: ${path}`);
      }
    }),
  );

  WelcomePanel.onRefresh = () => boot(true);

  const existingToken = await auth.getToken(context);
  if (!existingToken) {
    LoginPanel.show(context, doLogin);
  } else {
    const initial = await boot(true);
    if (initial) {
      _knownTaskIds = new Set(initial.tasks.map(t => t.id));
      WelcomePanel.show(context, initial);
    }
  }
}

export function deactivate() {}
