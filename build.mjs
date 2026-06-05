import esbuild from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";

const glslLoader = {
  name: "glsl",
  setup(build) {
    build.onLoad({ filter: /\.glsl$/ }, async (args) => {
      const text = await readFile(args.path, "utf8");
      return { contents: `export default ${JSON.stringify(text)};`, loader: "js" };
    });
  },
};

const serve = process.argv.includes("--serve");

const result = await esbuild.build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: !serve,
  format: "iife",
  plugins: [glslLoader],
  write: false,
});

const js = result.outputFiles[0].text;

const html = `<!doctype html>
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
</body>
</html>
`;

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", html);
console.log("built dist/index.html (" + (html.length / 1024).toFixed(1) + " KB)");
