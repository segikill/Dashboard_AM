const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, "build-manifest.json");
const allowedRoots = new Set([".nojekyll", "index.html", "manifest.json", "assets", "data", "tables"]);
const requiredFiles = [
  ".nojekyll",
  "index.html",
  "manifest.json",
  "assets/react/atlas-hybrid.js",
  "assets/react-legacy-bridge.js",
  "data/atlas-reference.js",
  "data/atlas-observations.js",
  "data/atlas-data.js",
  "data/atlas-spatial.js",
  "data/infrastructure-data.js",
  "data/roads-data.js",
  "tables/quality.json"
];

const fail = (message) => { throw new Error(`Static distribution validation failed: ${message}`); };
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const toPosix = (value) => value.split(path.sep).join("/");
const isPublicFile = (file) => !file.split("/").some((segment) => segment.startsWith("."));
const listFiles = (directory, base = directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute, base);
    return entry.isFile() ? [toPosix(path.relative(base, absolute))] : [];
  })
  .sort((left, right) => left.localeCompare(right, "en"));

if (!fs.existsSync(manifestPath)) fail("build-manifest.json is missing; run npm run build first.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== 1) fail(`unsupported manifest schema ${manifest.schemaVersion}.`);

const actualFiles = listFiles(dist).filter((file) => file !== "build-manifest.json");
const publicFiles = actualFiles.filter(isPublicFile);
const listedFiles = manifest.files.map((file) => file.path);
if (JSON.stringify(publicFiles) !== JSON.stringify(listedFiles)) fail("public file list differs from build manifest.");

for (const file of actualFiles) {
  const top = file.split("/", 1)[0];
  if (!allowedRoots.has(top)) fail(`unexpected deployment root: ${top}.`);
}
for (const file of requiredFiles) {
  if (!actualFiles.includes(file)) fail(`required file is missing: ${file}.`);
}
for (const entry of manifest.files) {
  const content = fs.readFileSync(path.join(dist, ...entry.path.split("/")));
  if (content.byteLength !== entry.bytes) fail(`${entry.path} byte size mismatch.`);
  if (sha256(content) !== entry.sha256) fail(`${entry.path} SHA-256 mismatch.`);
}
if (manifest.totals.files !== publicFiles.length) fail("manifest file count is invalid.");
if (manifest.totals.bytes !== manifest.files.reduce((total, file) => total + file.bytes, 0)) {
  fail("manifest total byte size is invalid.");
}

const index = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const match of index.matchAll(/\b(?:src|href)=(['"])([^'"]+)\1/g)) {
  const url = match[2];
  if (/^(?:[a-z]+:|#|\/\/)/i.test(url) || url.startsWith("data:")) continue;
  const relative = url.replace(/^\.\//, "").split(/[?#]/, 1)[0];
  if (!fs.existsSync(path.join(dist, ...relative.split("/")))) fail(`index.html references missing ${relative}.`);
  const version = new URLSearchParams((url.split("?", 2)[1] || "").split("#", 1)[0]).get("v");
  if (!version || version !== sha256(fs.readFileSync(path.join(dist, ...relative.split("/")))).slice(0, 12)) {
    fail(`index.html uses a stale or missing content version for ${relative}.`);
  }
}

for (const forbidden of ["node_modules", "src", "scripts", "docs", ".git", "package.json", "package-lock.json"] ) {
  if (actualFiles.some((file) => file === forbidden || file.startsWith(`${forbidden}/`))) {
    fail(`development content leaked into dist: ${forbidden}.`);
  }
}
for (const developmentAsset of [
  "assets/icons/medical-facilities/README.md",
  "assets/icons/medical-facilities/preview.html",
  "assets/icons/medical-facilities/preview.png"
]) {
  if (actualFiles.includes(developmentAsset)) fail(`development preview leaked into dist: ${developmentAsset}.`);
}

execFileSync(process.execPath, [path.join(root, "scripts", "validate_atlas_data.cjs"), "--root", dist], {
  cwd: root,
  stdio: "inherit"
});

console.log(JSON.stringify({
  status: "ok",
  files: manifest.totals.files,
  bytes: manifest.totals.bytes,
  sourceRevision: manifest.sourceRevision
}, null, 2));
