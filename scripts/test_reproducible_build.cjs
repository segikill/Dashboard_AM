const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "dist", "build-manifest.json");
const digest = () => crypto.createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");

if (!fs.existsSync(manifestPath)) throw new Error("Run npm run build before the reproducibility check.");
const before = digest();
execFileSync(process.execPath, [path.join(root, "scripts", "build_static_site.cjs")], {
  cwd: root,
  stdio: "inherit"
});
const after = digest();
if (before !== after) throw new Error(`Static build is not reproducible: ${before} != ${after}`);
console.log(JSON.stringify({ status: "ok", manifestSha256: after }, null, 2));
