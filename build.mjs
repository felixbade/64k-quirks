import esbuild from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const serve = process.argv.includes("--serve");
const PORT = Number(process.env.PORT) || 5173;

const livereloadClients = new Set();

const glslLoader = {
  name: "glsl",
  setup(build) {
    build.onLoad({ filter: /\.glsl$/ }, async (args) => {
      const text = await readFile(args.path, "utf8");
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
  await mkdir("dist", { recursive: true });
  await writeFile("dist/index.html", html);
  console.log("built dist/index.html (" + (html.length / 1024).toFixed(1) + " KB)");
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

const buildOpts = {
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: !serve,
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
