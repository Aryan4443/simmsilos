import * as vscode from "vscode";
import * as api from "./api";
import { siloUri } from "./siloFs";

export class FilesProvider implements vscode.TreeDataProvider<FileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private getToken: () => Promise<string | undefined>) {}

  refresh() { this._onDidChangeTreeData.fire(); }

  getTreeItem(item: FileItem) { return item; }

  async getChildren(item?: FileItem): Promise<FileItem[]> {
    const token = await this.getToken();
    if (!token) return [new FileItem("Not logged in", "", "file")];

    try {
      const path = item?.resourcePath ?? "";
      const data = await api.listFiles(token, path);

      if (data.type === "file") return [];

      return data.entries.map((e: { name: string; path: string; type: string }) =>
        new FileItem(e.name, e.path, e.type)
      );
    } catch (err: any) {
      const msg = err?.response?.status === 404
        ? "No branch assigned — ask admin"
        : "Silo service unavailable — partner service not running";
      return [new FileItem(msg, "", "file")];
    }
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly resourcePath: string,
    type: string
  ) {
    super(label, type === "dir"
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = new vscode.ThemeIcon(type === "dir" ? "folder" : "file");
    this.contextValue = type;
    if (type === "file") {
      this.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [siloUri(resourcePath)],
      };
    }
  }
}
