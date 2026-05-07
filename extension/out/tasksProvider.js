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
exports.TaskItem = exports.TasksProvider = void 0;
const vscode = __importStar(require("vscode"));
class TasksProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.tasks = [];
    }
    update(tasks) {
        this.tasks = tasks;
        this._onDidChangeTreeData.fire();
    }
    get pendingCount() {
        return this.tasks.filter(t => t.status !== "done").length;
    }
    getTreeItem(item) { return item; }
    getChildren() {
        if (!this.tasks.length) {
            return [new TaskItem("No tasks assigned", "", vscode.TreeItemCollapsibleState.None)];
        }
        return this.tasks.map(t => new TaskItem(t.function, t.status, vscode.TreeItemCollapsibleState.None, t));
    }
}
exports.TasksProvider = TasksProvider;
class TaskItem extends vscode.TreeItem {
    constructor(label, status, collapsible, task) {
        super(label, collapsible);
        this.task = task;
        this.description = status.replace("_", " ");
        this.tooltip = task
            ? `${task.function}\nStatus: ${task.status}\nBranch: ${task.branch}\nAssigned: ${new Date(task.assigned_at * 1000).toLocaleString()}`
            : "";
        this.contextValue = task ? "task" : "";
        this.iconPath = new vscode.ThemeIcon(status === "done" ? "check" : status === "in_progress" ? "sync~spin" : "circle-outline");
        if (task) {
            this.command = {
                command: "simmsilos.viewTask",
                title: "View Task Details",
                arguments: [task],
            };
        }
    }
}
exports.TaskItem = TaskItem;
