"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLanguage = detectLanguage;
const EXT_MAP = {
    py: "python", js: "javascript", ts: "typescript",
    tsx: "typescriptreact", jsx: "javascriptreact",
    html: "html", css: "css", json: "json",
    md: "markdown", yaml: "yaml", yml: "yaml",
    sh: "shellscript", bash: "shellscript",
    go: "go", rs: "rust", java: "java",
    cpp: "cpp", c: "c", cs: "csharp",
    sql: "sql", toml: "toml", env: "properties",
};
function detectLanguage(path) {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return EXT_MAP[ext] ?? "plaintext";
}
