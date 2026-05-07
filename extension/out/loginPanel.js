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
exports.LoginPanel = void 0;
const vscode = __importStar(require("vscode"));
class LoginPanel {
    static show(context, onLogin) {
        if (LoginPanel.currentPanel) {
            LoginPanel.currentPanel._panel.reveal();
            return;
        }
        const panel = vscode.window.createWebviewPanel("simmsilosLogin", "SimmSilos — Login", vscode.ViewColumn.One, { enableScripts: true });
        LoginPanel.currentPanel = new LoginPanel(panel, context, onLogin);
    }
    constructor(panel, _context, onLogin) {
        this.onLogin = onLogin;
        this._disposables = [];
        this._panel = panel;
        this._panel.webview.html = this._getHtml();
        this._panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.command === "login") {
                const ok = await this.onLogin(msg.username, msg.password);
                if (ok) {
                    this._panel.webview.postMessage({ command: "success" });
                    setTimeout(() => this._panel.dispose(), 1000);
                }
                else {
                    this._panel.webview.postMessage({ command: "error", text: "Invalid credentials" });
                }
            }
        }, null, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    dispose() {
        LoginPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }
    _getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .card {
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      padding: 40px;
      width: 360px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .logo {
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      color: var(--vscode-textLink-foreground);
      letter-spacing: -0.5px;
    }
    .subtitle {
      text-align: center;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-top: -12px;
    }
    label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      display: block;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    input:focus { border-color: var(--vscode-focusBorder); }
    button {
      width: 100%;
      padding: 11px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error {
      color: var(--vscode-errorForeground);
      font-size: 13px;
      text-align: center;
      display: none;
    }
    .success {
      color: #4caf50;
      font-size: 13px;
      text-align: center;
      display: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SimmSilos</div>
    <div class="subtitle">Developer workspace management</div>

    <div>
      <label>Username</label>
      <input id="username" type="text" placeholder="Enter your username" autofocus/>
    </div>
    <div>
      <label>Password</label>
      <input id="password" type="password" placeholder="Enter your password"/>
    </div>

    <button id="loginBtn" onclick="login()">Sign In</button>
    <div class="error" id="error"></div>
    <div class="success" id="success">✓ Logged in! Loading your workspace...</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById("password").addEventListener("keydown", e => {
      if (e.key === "Enter") login();
    });

    function login() {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      if (!username || !password) return;

      const btn = document.getElementById("loginBtn");
      btn.disabled = true;
      btn.textContent = "Signing in...";
      document.getElementById("error").style.display = "none";

      vscode.postMessage({ command: "login", username, password });
    }

    window.addEventListener("message", e => {
      const btn = document.getElementById("loginBtn");
      if (e.data.command === "success") {
        document.getElementById("success").style.display = "block";
      } else if (e.data.command === "error") {
        btn.disabled = false;
        btn.textContent = "Sign In";
        const err = document.getElementById("error");
        err.textContent = e.data.text;
        err.style.display = "block";
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.LoginPanel = LoginPanel;
