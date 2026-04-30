import * as vscode from "vscode";
import { Task } from "./api";

export class TasksProvider implements vscode.TreeDataProvider<TaskItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];

  update(tasks: Task[]) {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: TaskItem) { return item; }

  getChildren(): TaskItem[] {
    if (!this.tasks.length) {
      return [new TaskItem("No tasks assigned", "", vscode.TreeItemCollapsibleState.None)];
    }
    return this.tasks.map(t => new TaskItem(t.function, t.status, vscode.TreeItemCollapsibleState.None, t));
  }
}

class TaskItem extends vscode.TreeItem {
  constructor(
    label: string,
    status: string,
    collapsible: vscode.TreeItemCollapsibleState,
    public readonly task?: Task
  ) {
    super(label, collapsible);
    this.description = status;
    this.tooltip = status;
    this.contextValue = task ? "task" : "";
    this.iconPath = new vscode.ThemeIcon(
      status === "done" ? "check" : status === "in_progress" ? "sync~spin" : "circle-outline"
    );
  }
}
