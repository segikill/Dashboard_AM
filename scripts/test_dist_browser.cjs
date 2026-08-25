const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

if (!fs.existsSync(path.join(dist, "build-manifest.json"))) {
  throw new Error("dist is missing; run npm run build before browser tests.");
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const absolute = path.resolve(dist, relative);
  if (absolute !== dist && !absolute.startsWith(`${dist}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(absolute, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(absolute).toLowerCase()] || "application/octet-stream"
    });
    fs.createReadStream(absolute).pipe(response);
  });
});

const run = (script, base) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, "scripts", script)], {
    cwd: root,
    env: {
      ...process.env,
      ATLAS_URL: base,
      DEPLOYED_URL: base,
      SMOKE_ATTEMPTS: "1",
      SMOKE_DELAY_MS: "1"
    },
    stdio: "inherit"
  });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with ${code}.`)));
});

server.listen(0, "127.0.0.1", async () => {
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/`;
  try {
    await run("smoke_deployed_site.cjs", base);
    await run("test_hybrid_react.cjs", base);
    await run("test_spatial_fallback.cjs", base);
    console.log(JSON.stringify({ status: "ok", base }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
