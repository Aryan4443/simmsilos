import * as vscode from "vscode";
import * as api from "./api";
import { detectLanguage } from "./language";

export const SCHEME = "simmsilos";

export class SiloFileSystemProvider implements vscode.FileSystemProvider {
  private _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  constructor(private getToken: () => Promise<string | undefined>) {}

  watch() { return { dispose: () => {} }; }
  stat(_uri: vscode.Uri): vscode.FileStat {
    return { type: vscode.FileType.File, ctime: 0, mtime: Date.now(), size: 0 };
  }
  readDirectory(): never { throw vscode.FileSystemError.NoPermissions(); }
  createDirectory(): never { throw vscode.FileSystemError.NoPermissions(); }
  delete(): never { throw vscode.FileSystemError.NoPermissions(); }
  rename(): never { throw vscode.FileSystemError.NoPermissions(); }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const token = await this.getToken();
    if (!token) throw vscode.FileSystemError.NoPermissions("Not logged in");
    const { content } = await api.readFile(token, uri.path.replace(/^\//, ""));
    const bytes = Buffer.from(content, "utf8");
    // set language after opening
    setTimeout(async () => {
      const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
      if (doc) await vscode.languages.setTextDocumentLanguage(doc, detectLanguage(uri.path));
    }, 100);
    return bytes;
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
    const token = await this.getToken();
    if (!token) throw vscode.FileSystemError.NoPermissions("Not logged in");
    await api.writeFile(token, uri.path.replace(/^\//, ""), Buffer.from(content).toString("utf8"));
    this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    vscode.window.setStatusBarMessage(`SimmSilos: saved ${uri.path}`, 3000);
  }
}

export function siloUri(path: string): vscode.Uri {
  const normalPath = path.startsWith("/") ? path : `/${path}`;
  return vscode.Uri.parse(`${SCHEME}://${normalPath}`);
}
