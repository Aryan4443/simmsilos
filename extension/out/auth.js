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
exports.login = login;
exports.logout = logout;
exports.getToken = getToken;
exports.ensureFreshToken = ensureFreshToken;
const vscode = __importStar(require("vscode"));
const api = __importStar(require("./api"));
const TOKEN_KEY = "simmsilos.token";
async function login(context) {
    const username = await vscode.window.showInputBox({ prompt: "SimmSilos username" });
    if (!username)
        return;
    const password = await vscode.window.showInputBox({ prompt: "Password", password: true });
    if (!password)
        return;
    try {
        const { token } = await api.login(username, password);
        await context.secrets.store(TOKEN_KEY, token);
        vscode.window.showInformationMessage(`Logged in as ${username}`);
        return token;
    }
    catch {
        vscode.window.showErrorMessage("Login failed — check your credentials");
    }
}
async function logout(context) {
    const token = await getToken(context);
    if (token) {
        try {
            await api.logout(token);
        }
        catch { }
    }
    await context.secrets.delete(TOKEN_KEY);
    vscode.window.showInformationMessage("Logged out of SimmSilos");
}
async function getToken(context) {
    return context.secrets.get(TOKEN_KEY);
}
async function ensureFreshToken(context) {
    let token = await getToken(context);
    if (!token)
        return;
    try {
        const me = await api.getMe(token);
        if (me.should_refresh) {
            const refreshed = await api.refreshToken(token);
            await context.secrets.store(TOKEN_KEY, refreshed.token);
            token = refreshed.token;
        }
    }
    catch {
        await context.secrets.delete(TOKEN_KEY);
        return undefined;
    }
    return token;
}
