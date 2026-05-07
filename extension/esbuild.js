const esbuild = require("esbuild");

esbuild.build({
  entryPoints: ["./out/extension.js"],
  bundle: true,
  outfile: "./out/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  allowOverwrite: true,
  minify: false,
}).catch(() => process.exit(1));
