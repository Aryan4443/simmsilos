import axios from "axios";
import * as vscode from "vscode";

function baseUrl(): string {
  return vscode.workspace.getConfiguration("simmsilos").get("apiUrl", "http://localhost:3000");
}

function client(token?: string) {
  return axios.create({
    baseURL: baseUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function login(username: string, password: string) {
  const res = await client().post("/auth/login", { username, password });
  return res.data as { token: string; role: string };
}

export async function getMe(token: string) {
  const res = await client(token).get("/me");
  return res.data as {
    username: string;
    role: string;
    branch: string | null;
    tasks: Task[];
    token_expires_in: number;
    should_refresh: boolean;
  };
}

export async function logout(token: string) {
  await client(token).post("/auth/logout");
}

export async function refreshToken(token: string) {
  const res = await client(token).post("/auth/refresh");
  return res.data as { token: string; role: string };
}

export async function listFiles(token: string, path = "") {
  const res = await client(token).get("/silo/files", { params: { path } });
  return res.data;
}

export async function readFile(token: string, path: string) {
  const res = await client(token).get("/silo/file", { params: { path } });
  return res.data as { path: string; content: string };
}

export async function writeFile(token: string, path: string, content: string) {
  const res = await client(token).post("/silo/file", { path, content, overwrite: true });
  return res.data;
}

export async function syncSilo(token: string) {
  const res = await client(token).post("/silo/sync");
  return res.data;
}

export async function updateTaskStatus(token: string, taskId: number, status: "in_progress" | "done") {
  const res = await client(token).patch(`/my/tasks/${taskId}/status`, { status });
  return res.data;
}

export interface Task {
  id: number;
  branch: string;
  function: string;
  status: string;
  assigned_at: number;
}
