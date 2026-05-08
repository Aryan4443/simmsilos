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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getMe = getMe;
exports.logout = logout;
exports.refreshToken = refreshToken;
exports.listFiles = listFiles;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.syncSilo = syncSilo;
exports.updateTaskStatus = updateTaskStatus;
exports.connectTaskSocket = connectTaskSocket;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
function baseUrl() {
    return vscode.workspace.getConfiguration("simmsilos").get("apiUrl", "http://localhost:3000");
}
function client(token) {
    return axios_1.default.create({
        baseURL: baseUrl(),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
}
async function login(username, password) {
    const res = await client().post("/auth/login", { username, password });
    return res.data;
}
async function getMe(token) {
    const res = await client(token).get("/me");
    return res.data;
}
async function logout(token) {
    await client(token).post("/auth/logout");
}
async function refreshToken(token) {
    const res = await client(token).post("/auth/refresh");
    return res.data;
}
async function listFiles(token, path = "") {
    const res = await client(token).get("/silo/files", { params: { path } });
    return res.data;
}
async function readFile(token, path) {
    const res = await client(token).get("/silo/file", { params: { path } });
    return res.data;
}
async function writeFile(token, path, content) {
    const res = await client(token).post("/silo/file", { path, content, overwrite: true });
    return res.data;
}
async function syncSilo(token) {
    const res = await client(token).post("/silo/sync");
    return res.data;
}
async function updateTaskStatus(token, taskId, status) {
    const res = await client(token).patch(`/my/tasks/${taskId}/status`, { status });
    return res.data;
}
function connectTaskSocket(token, onNewTask) {
    const base = vscode.workspace.getConfiguration("simmsilos").get("apiUrl", "http://localhost:3000");
    const wsUrl = base.replace(/^http/, "ws") + `/ws/tasks?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "new_task")
            onNewTask(msg);
    };
    ws.onerror = () => ws.close();
    return () => ws.close();
}
