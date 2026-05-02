const EXT_MAP: Record<string, string> = {
  py: "python", js: "javascript", ts: "typescript",
  tsx: "typescriptreact", jsx: "javascriptreact",
  html: "html", css: "css", json: "json",
  md: "markdown", yaml: "yaml", yml: "yaml",
  sh: "shellscript", bash: "shellscript",
  go: "go", rs: "rust", java: "java",
  cpp: "cpp", c: "c", cs: "csharp",
  sql: "sql", toml: "toml", env: "properties",
};

export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "plaintext";
}
