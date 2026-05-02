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
exports.SiloFileSystemProvider = exports.SCHEME = void 0;
exports.siloUri = siloUri;
const vscode = __importStar(require("vscode"));
const api = __importStar(require("./api"));
const language_1 = require("./language");
exports.SCHEME = "simmsilos";
class SiloFileSystemProvider {
    constructor(getToken) {
        this.getToken = getToken;
        this._onDidChangeFile = new vscode.EventEmitter();
        this.onDidChangeFile = this._onDidChangeFile.event;
    }
    watch() { return { dispose: () => { } }; }
    stat(_uri) {
        return { type: vscode.FileType.File, ctime: 0, mtime: Date.now(), size: 0 };
    }
    readDirectory() { throw vscode.FileSystemError.NoPermissions(); }
    createDirectory() { throw vscode.FileSystemError.NoPermissions(); }
    delete() { throw vscode.FileSystemError.NoPermissions(); }
    rename() { throw vscode.FileSystemError.NoPermissions(); }
    async readFile(uri) {
        const token = await this.getToken();
        if (!token)
            throw vscode.FileSystemError.NoPermissions("Not logged in");
        const { content } = await api.readFile(token, uri.path);
        const bytes = Buffer.from(content, "utf8");
        // set language after opening
        setTimeout(async () => {
            const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            if (doc)
                await vscode.languages.setTextDocumentLanguage(doc, (0, language_1.detectLanguage)(uri.path));
        }, 100);
        return bytes;
    }
    async writeFile(uri, content) {
        const token = await this.getToken();
        if (!token)
            throw vscode.FileSystemError.NoPermissions("Not logged in");
        await api.writeFile(token, uri.path, Buffer.from(content).toString("utf8"));
        this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        vscode.window.setStatusBarMessage(`SimmSilos: saved ${uri.path}`, 3000);
    }
}
exports.SiloFileSystemProvider = SiloFileSystemProvider;
function siloUri(path) {
    return vscode.Uri.parse(`${exports.SCHEME}://${path}`);
}
