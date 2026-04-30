"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const auth = __importStar(require("./auth"));
const api = __importStar(require("./api"));
const tasksProvider_1 = require("./tasksProvider");
const filesProvider_1 = require("./filesProvider");
const siloFs_1 = require("./siloFs");
async function activate(context) {
    const tasksProvider = new tasksProvider_1.TasksProvider();
    const filesProvider = new filesProvider_1.FilesProvider(() => auth.ensureFreshToken(context));
    const siloFs = new siloFs_1.SiloFileSystemProvider(() => auth.ensureFreshToken(context));
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider(siloFs_1.SCHEME, siloFs, { isCaseSensitive: true }));
    vscode.window.registerTreeDataProvider("simmsilos.tasks", tasksProvider);
    vscode.window.registerTreeDataProvider("simmsilos.files", filesProvider);
    async function boot() {
        const token = await auth.ensureFreshToken(context);
        if (!token)
            return;
        try {
            const me = await api.getMe(token);
            tasksProvider.update(me.tasks);
            filesProvider.refresh();
            vscode.window.setStatusBarMessage(`SimmSilos: ${me.username} | branch: ${me.branch ?? "unassigned"}`, 5000);
        }
        catch {
            vscode.window.showErrorMessage("SimmSilos: failed to load profile");
        }
    }
    context.subscriptions.push(vscode.commands.registerCommand("simmsilos.login", async () => {
        await auth.login(context);
        await boot();
    }), vscode.commands.registerCommand("simmsilos.logout", async () => {
        await auth.logout(context);
        tasksProvider.update([]);
        filesProvider.refresh();
    }), vscode.commands.registerCommand("simmsilos.refresh", boot), vscode.commands.registerCommand("simmsilos.syncSilo", async () => {
        const token = await auth.ensureFreshToken(context);
        if (!token)
            return vscode.window.showErrorMessage("Not logged in");
        await api.syncSilo(token);
        filesProvider.refresh();
        vscode.window.showInformationMessage("Silo synced from project");
    }), vscode.commands.registerCommand("simmsilos.markDone", async (task) => {
        const token = await auth.ensureFreshToken(context);
        if (!token)
            return;
        await api.updateTaskStatus(token, task.id, "done");
        await boot();
    }), vscode.commands.registerCommand("simmsilos.markInProgress", async (task) => {
        const token = await auth.ensureFreshToken(context);
        if (!token)
            return;
        await api.updateTaskStatus(token, task.id, "in_progress");
        await boot();
    }));
    await boot();
}
function deactivate() { }
