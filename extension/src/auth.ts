import * as vscode from "vscode";
import * as api from "./api";

const TOKEN_KEY = "simmsilos.token";

export async function login(context: vscode.ExtensionContext): Promise<string | undefined> {
  const username = await vscode.window.showInputBox({ prompt: "SimmSilos username" });
  if (!username) return;

  const password = await vscode.window.showInputBox({ prompt: "Password", password: true });
  if (!password) return;

  try {
    const { token } = await api.login(username, password);
    await context.secrets.store(TOKEN_KEY, token);
    vscode.window.showInformationMessage(`Logged in as ${username}`);
    return token;
  } catch {
    vscode.window.showErrorMessage("Login failed — check your credentials");
  }
}

export async function logout(context: vscode.ExtensionContext) {
  await context.secrets.delete(TOKEN_KEY);
  vscode.window.showInformationMessage("Logged out of SimmSilos");
}

export async function getToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  return context.secrets.get(TOKEN_KEY);
}

export async function ensureFreshToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  let token = await getToken(context);
  if (!token) return;

  try {
    const me = await api.getMe(token);
    if (me.should_refresh) {
      const refreshed = await api.refreshToken(token);
      await context.secrets.store(TOKEN_KEY, refreshed.token);
      token = refreshed.token;
    }
  } catch {
    await context.secrets.delete(TOKEN_KEY);
    return undefined;
  }

  return token;
}
