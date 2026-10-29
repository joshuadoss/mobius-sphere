// Bundles src/main.ts into dist/ along with the page and stylesheet.
// `node build.mjs` builds once; `node build.mjs --serve` runs a local dev server.
import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

const serve = process.argv.includes("--serve");
mkdirSync("dist", { recursive: true });
const copyStatic = () => {
  cpSync("index.html", "dist/index.html");
  cpSync("src/style.css", "dist/style.css");
};
copyStatic();

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "esm",
  target: "es2020",
  outfile: "dist/app.js",
  minify: !serve,
  sourcemap: true,
  plugins: [{ name: "copy-static", setup: (b) => b.onEnd(copyStatic) }],
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: "dist", port: 8000 });
  console.log(`Serving on http://localhost:${port}`);
} else {
  await esbuild.build(options);
  console.log("Built dist/");
}
