const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const allowedFiles = ["index.html", "manifest.json"];
const allowedDirectories = ["assets", "data", "tables"];
const excludedProductionFiles = [
  "assets/icons/medical-facilities/README.md",
  "assets/icons/medical-facilities/preview.html",
  "assets/icons/medical-facilities/preview.png"
];

if (path.dirname(dist) !== root || path.basename(dist) !== "dist") {
  throw new Error(`Refusing to rebuild an unexpected directory: ${dist}`);
}

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const toPosix = (value) => value.split(path.sep).join("/");
const isPublicFile = (file) => !file.split("/").some((segment) => segment.startsWith("."));

const copyDirectory = (source, destination) => {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, destinationPath);
  }
};

const listFiles = (directory, base = directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute, base);
    return entry.isFile() ? [toPosix(path.relative(base, absolute))] : [];
  })
  .sort((left, right) => left.localeCompare(right, "en"));

const versionFor = (relativePath) => {
  const absolute = path.join(dist, ...relativePath.split("/"));
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  return sha256(fs.readFileSync(absolute)).slice(0, 12);
};

const versioned = (relativePath) => {
  const cleanPath = relativePath.replace(/^\.\//, "").split(/[?#]/, 1)[0];
  const version = versionFor(cleanPath);
  return version ? `${cleanPath}?v=${version}` : relativePath;
};

const replaceLiteralUrl = (file, target) => {
  const absolute = path.join(dist, ...file.split("/"));
  let source = fs.readFileSync(absolute, "utf8");
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  source = source.replace(new RegExp(`${escaped}(?:\\?v=[A-Za-z0-9._-]+)?`, "g"), versioned(target));
  fs.writeFileSync(absolute, source, "utf8");
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of allowedFiles) fs.copyFileSync(path.join(root, file), path.join(dist, file));
for (const directory of allowedDirectories) copyDirectory(path.join(root, directory), path.join(dist, directory));
for (const file of excludedProductionFiles) fs.rmSync(path.join(dist, ...file.split("/")), { force: true });
fs.writeFileSync(path.join(dist, ".nojekyll"), "", "utf8");

replaceLiteralUrl("assets/react-legacy-bridge.js", "./assets/react/atlas-hybrid.js");
replaceLiteralUrl("assets/infrastructure-map.js", "data/infrastructure-data.js");
replaceLiteralUrl("assets/infrastructure-map.js", "data/roads-data.js");
replaceLiteralUrl("assets/mortality-map.js", "data/infrastructure-data.js");

const indexPath = path.join(dist, "index.html");
const index = fs.readFileSync(indexPath, "utf8").replace(
  /\b(src|href)=(['"])([^'"]+)\2/g,
  (match, attribute, quote, url) => {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(url) || url.startsWith("data:")) return match;
    const next = versioned(url);
    return `${attribute}=${quote}${next}${quote}`;
  }
);
fs.writeFileSync(indexPath, index, "utf8");

const sourceRevision = process.env.ATLAS_SOURCE_REVISION || process.env.GITHUB_SHA || "local";

const files = listFiles(dist)
  .filter((file) => file !== "build-manifest.json" && isPublicFile(file))
  .map((file) => {
    const content = fs.readFileSync(path.join(dist, ...file.split("/")));
    return { path: file, bytes: content.byteLength, sha256: sha256(content) };
  });
const manifest = {
  schemaVersion: 1,
  sourceRevision,
  entrypoint: "index.html",
  generatedBy: "scripts/build_static_site.cjs",
  totals: {
    files: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0)
  },
  files
};
fs.writeFileSync(path.join(dist, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ status: "ok", dist, ...manifest.totals, sourceRevision }, null, 2));
