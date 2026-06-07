import esbuild from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const serve = process.argv.includes("--serve");
const exportMode = process.argv.includes("--export");
const exportInteractive = process.argv.includes("--export-interactive");
const minifyGlslMode = exportMode || exportInteractive;
const PORT = Number(process.env.PORT) || 5173;
const EXPORT_BUDGET = 64 * 1024;

const livereloadClients = new Set();

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function stripLineComment(line) {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "/" && line[i + 1] === "/") break;
    out += line[i];
  }
  return out;
}

function minifyGlsl(text) {
  const parts = [];
  let body = [];
  const flushBody = () => {
    const code = body
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}()[\];,:+\-*/%=<>])\s*/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (code) parts.push(code);
    body = [];
  };
  for (const rawLine of stripBlockComments(text).split("\n")) {
    const line = stripLineComment(rawLine).trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      flushBody();
      parts.push(line);
    } else {
      body.push(line);
    }
  }
  flushBody();
  return parts.join("\n");
}

const glslLoader = {
  name: "glsl",
  setup(build) {
    build.onLoad({ filter: /\.glsl$/ }, async (args) => {
      const raw = await readFile(args.path, "utf8");
      const text = minifyGlslMode ? minifyGlsl(raw) : raw;
      return { contents: `export default ${JSON.stringify(text)};`, loader: "js" };
    });
  },
};

function makeHtml(js) {
  const livereload = serve
    ? `<script>new EventSource("/__livereload").onmessage=()=>location.reload();</script>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>graffathon demo</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  #demo {
    display: block;
    width: 100vw;
    height: 100vh;
    object-fit: contain;
    image-rendering: pixelated;
    margin: auto;
  }
  #demo:fullscreen { width: 100vw; height: 100vh; object-fit: contain; background: #000; }
</style>
</head>
<body>
<script>${js}</script>
${livereload}
</body>
</html>
`;
}

async function writeHtml(js) {
  const html = makeHtml(js);
  const outFile = exportInteractive
    ? "dist/export-interactive.html"
    : exportMode
      ? "dist/export.html"
      : "dist/index.html";
  await mkdir("dist", { recursive: true });
  await writeFile(outFile, html);
  const bytes = Buffer.byteLength(html);
  console.log("built " + outFile + " (" + (bytes / 1024).toFixed(1) + " KB)");
  if (exportMode && bytes > EXPORT_BUDGET) {
    console.error("export exceeds 64 KB by " + (bytes - EXPORT_BUDGET) + " bytes");
    process.exit(1);
  }
  for (const res of livereloadClients) res.write("data: reload\n\n");
}

const htmlWriter = {
  name: "html-writer",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      await writeHtml(result.outputFiles[0].text);
    });
  },
};

const entryPoint = exportInteractive
  ? "src/export-interactive.js"
  : exportMode
    ? "src/export.js"
    : "src/main.js";

const buildOpts = {
  entryPoints: [entryPoint],
  bundle: true,
  minify: !serve || exportMode,
  format: "iife",
  plugins: [glslLoader, htmlWriter],
  write: false,
};

if (serve) {
  const ctx = await esbuild.context(buildOpts);
  await ctx.watch();
  await ctx.rebuild();

  createServer(async (req, res) => {
    if (req.url === "/__livereload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      livereloadClients.add(res);
      req.on("close", () => livereloadClients.delete(res));
      return;
    }
    const html = await readFile(join("dist", "index.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }).listen(PORT, () => {
    console.log(`http://localhost:${PORT}  (watching — changes auto-reload browser)`);
  });
} else {
  const result = await esbuild.build(buildOpts);
  if (result.errors.length) process.exit(1);
}
