import * as vscode from "vscode";
import * as api from "./api";

export const SCHEME = "simmsilos";

export class SiloFileSystemProvider implements vscode.FileSystemProvider {
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  constructor(private getToken: () => Promise<string | undefined>) {}

  // VS Code requires these — silo is read-only for dirs, writable for files
  watch() { return { dispose: () => {} }; }
  stat(uri: vscode.Uri): vscode.FileStat {
    return { type: vscode.FileType.File, ctime: 0, mtime: Date.now(), size: 0 };
  }
  readDirectory(): never { throw vscode.FileSystemError.NoPermissions(); }
  createDirectory(): never { throw vscode.FileSystemError.NoPermissions(); }
  delete(): never { throw vscode.FileSystemError.NoPermissions(); }
  rename(): never { throw vscode.FileSystemError.NoPermissions(); }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const token = await this.getToken();
    if (!token) throw vscode.FileSystemError.NoPermissions("Not logged in");
    const { content } = await api.readFile(token, uri.path);
    return Buffer.from(content, "utf8");
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const token = await this.getToken();
    if (!token) throw vscode.FileSystemError.NoPermissions("Not logged in");
    await api.writeFile(token, uri.path, Buffer.from(content).toString("utf8"));
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    vscode.window.setStatusBarMessage(`SimmSilos: saved ${uri.path}`, 3000);
  }
}

export function siloUri(path: string): vscode.Uri {
  return vscode.Uri.parse(`${SCHEME}://${path}`);
}
