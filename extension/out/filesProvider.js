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
exports.FilesProvider = void 0;
const vscode = __importStar(require("vscode"));
const api = __importStar(require("./api"));
const siloFs_1 = require("./siloFs");
class FilesProvider {
    constructor(getToken) {
        this.getToken = getToken;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(item) { return item; }
    async getChildren(item) {
        const token = await this.getToken();
        if (!token)
            return [new FileItem("Not logged in", "", "file")];
        try {
            const path = item?.resourcePath ?? "";
            const data = await api.listFiles(token, path);
            if (data.type === "file")
                return [];
            return data.entries.map((e) => new FileItem(e.name, e.path, e.type));
        }
        catch {
            return [new FileItem("Failed to load files", "", "file")];
        }
    }
}
exports.FilesProvider = FilesProvider;
class FileItem extends vscode.TreeItem {
    constructor(label, resourcePath, type) {
        super(label, type === "dir"
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.resourcePath = resourcePath;
        this.iconPath = new vscode.ThemeIcon(type === "dir" ? "folder" : "file");
        this.contextValue = type;
        if (type === "file") {
            this.command = {
                command: "vscode.open",
                title: "Open File",
                arguments: [(0, siloFs_1.siloUri)(resourcePath)],
            };
        }
    }
}
