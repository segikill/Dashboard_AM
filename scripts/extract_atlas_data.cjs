const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "index.html");
const dataPath = path.join(root, "data", "atlas-data.js");
const checksumPath = path.join(root, "data", "atlas-data.sha256");

const html = fs.readFileSync(htmlPath, "utf8");
const dataToken = "const DATA=";
const dataTokenIndex = html.indexOf(dataToken);
const existingExternalReference = /<script\s+src=["']data\/atlas-data\.js(?:\?[^"']*)?["']><\/script>/.test(html);

if (
  existingExternalReference
  && /const DATA=window\.AMUR_ATLAS_DATA;/.test(html)
  && fs.existsSync(dataPath)
) {
  console.log("DATA is already externalized; no changes were made.");
  process.exit(0);
}

if (dataTokenIndex < 0) {
  if (existingExternalReference && fs.existsSync(dataPath)) {
    console.log("DATA is already externalized; no changes were made.");
    process.exit(0);
  }
  throw new Error("Could not find the embedded `const DATA=` declaration in index.html.");
}

const dataStart = dataTokenIndex + dataToken.length;
const nfTokenIndex = html.indexOf("const NF=", dataStart);
if (nfTokenIndex < 0) {
  throw new Error("Could not find the `const NF=` boundary after DATA.");
}

const semicolonIndex = html.lastIndexOf(";", nfTokenIndex);
if (semicolonIndex < dataStart) {
  throw new Error("Could not find the end of the embedded DATA literal.");
}

const jsonLiteral = html.slice(dataStart, semicolonIndex);
const data = JSON.parse(jsonLiteral);
if (!Array.isArray(data.records) || data.records.length !== 30_232) {
  throw new Error(`Unexpected record count before extraction: ${data.records?.length ?? "missing"}.`);
}

const lineEnding = html.includes("\r\n") ? "\r\n" : "\n";
const scriptOpenIndex = html.lastIndexOf("<script>", dataTokenIndex);
if (scriptOpenIndex < 0 || html.slice(scriptOpenIndex, dataTokenIndex).trim() !== "<script>") {
  throw new Error("The embedded DATA declaration is not the first statement of its script block.");
}

const banner = [
  "/**",
  " * Generated analytical dataset for Dashboard_AM.",
  " * Source of truth: the validated, anonymized DATA object previously embedded in index.html.",
  " * Do not edit manually; rebuild it from the source workbook pipeline.",
  " */",
  `window.AMUR_ATLAS_DATA=${jsonLiteral};`,
  ""
].join("\n");

const checksum = crypto.createHash("sha256").update(banner, "utf8").digest("hex");
const replacement = [
  `<script src="data/atlas-data.js?v=${checksum.slice(0, 12)}"></script>`,
  "<script>",
  "const DATA=window.AMUR_ATLAS_DATA;",
  "if(!DATA){throw new Error('Atlas data failed to load: data/atlas-data.js');}"
].join(lineEnding);
const nextHtml = html.slice(0, scriptOpenIndex) + replacement + html.slice(semicolonIndex + 1);

fs.mkdirSync(path.dirname(dataPath), { recursive: true });
fs.writeFileSync(dataPath, banner, "utf8");
fs.writeFileSync(checksumPath, `${checksum}  atlas-data.js\n`, "utf8");
fs.writeFileSync(htmlPath, nextHtml, "utf8");

console.log(JSON.stringify({
  records: data.records.length,
  dataBytes: Buffer.byteLength(banner, "utf8"),
  htmlBytesBefore: Buffer.byteLength(html, "utf8"),
  htmlBytesAfter: Buffer.byteLength(nextHtml, "utf8"),
  sha256: checksum
}, null, 2));
