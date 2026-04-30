import * as vscode from "vscode";
import * as auth from "./auth";
import * as api from "./api";
import { TasksProvider } from "./tasksProvider";
import { FilesProvider } from "./filesProvider";
import { SiloFileSystemProvider, SCHEME } from "./siloFs";

export async function activate(context: vscode.ExtensionContext) {
  const tasksProvider = new TasksProvider();
  const filesProvider = new FilesProvider(() => auth.ensureFreshToken(context));

  const siloFs = new SiloFileSystemProvider(() => auth.ensureFreshToken(context));
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(SCHEME, siloFs, { isCaseSensitive: true })
  );

  vscode.window.registerTreeDataProvider("simmsilos.tasks", tasksProvider);
  vscode.window.registerTreeDataProvider("simmsilos.files", filesProvider);

  async function boot() {
    const token = await auth.ensureFreshToken(context);
    if (!token) return;
    try {
      const me = await api.getMe(token);
      tasksProvider.update(me.tasks);
      filesProvider.refresh();
      vscode.window.setStatusBarMessage(
        `SimmSilos: ${me.username} | branch: ${me.branch ?? "unassigned"}`, 5000
      );
    } catch {
      vscode.window.showErrorMessage("SimmSilos: failed to load profile");
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("simmsilos.login", async () => {
      await auth.login(context);
      await boot();
    }),

    vscode.commands.registerCommand("simmsilos.logout", async () => {
      await auth.logout(context);
      tasksProvider.update([]);
      filesProvider.refresh();
    }),

    vscode.commands.registerCommand("simmsilos.refresh", boot),

    vscode.commands.registerCommand("simmsilos.syncSilo", async () => {
      const token = await auth.ensureFreshToken(context);
      if (!token) return vscode.window.showErrorMessage("Not logged in");
      await api.syncSilo(token);
      filesProvider.refresh();
      vscode.window.showInformationMessage("Silo synced from project");
    }),

    vscode.commands.registerCommand("simmsilos.markDone", async (task: any) => {
      const token = await auth.ensureFreshToken(context);
      if (!token) return;
      await api.updateTaskStatus(token, task.id, "done");
      await boot();
    }),

    vscode.commands.registerCommand("simmsilos.markInProgress", async (task: any) => {
      const token = await auth.ensureFreshToken(context);
      if (!token) return;
      await api.updateTaskStatus(token, task.id, "in_progress");
      await boot();
    })
  );

  await boot();
}

export function deactivate() {}
