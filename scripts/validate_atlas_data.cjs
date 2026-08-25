const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootArgIndex = process.argv.indexOf("--root");
const root = rootArgIndex >= 0
  ? path.resolve(process.cwd(), process.argv[rootArgIndex + 1] || "")
  : path.resolve(__dirname, "..");
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error(`Atlas data validation root does not exist: ${root}`);
}
const dataDir = path.join(root, "data");
const checksumPath = path.join(dataDir, "atlas-data.sha256");
const manifestPath = path.join(dataDir, "atlas-data.manifest.json");
const schemaPath = path.join(dataDir, "atlas-data.schema.json");
const htmlPath = path.join(root, "index.html");
const coreFiles = ["atlas-reference.js", "atlas-observations.js", "atlas-data.js"];
const resourceFiles = [...coreFiles, "atlas-spatial.js"];

const fail = (message) => {
  throw new Error(`Atlas data validation failed: ${message}`);
};
const sha256 = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

const checksumEntries = new Map(
  fs.readFileSync(checksumPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      if (!match) fail(`invalid checksum line: ${line}.`);
      return [match[2], match[1]];
    })
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== 2) fail(`manifest schemaVersion must be 2, got ${manifest.schemaVersion}.`);

const sources = {};
for (const file of resourceFiles) {
  const filePath = path.join(dataDir, file);
  const source = fs.readFileSync(filePath, "utf8");
  const actualHash = sha256(source);
  const expectedHash = checksumEntries.get(file);
  const manifestEntry = manifest.resources?.[file];
  if (!expectedHash) fail(`checksum is missing for ${file}.`);
  if (actualHash !== expectedHash) fail(`${file} SHA-256 mismatch.`);
  if (manifestEntry?.sha256 !== actualHash) fail(`${file} manifest SHA-256 mismatch.`);
  if (manifestEntry?.bytes !== Buffer.byteLength(source, "utf8")) fail(`${file} manifest byte size mismatch.`);
  sources[file] = source;
}
if (checksumEntries.size !== resourceFiles.length) fail("checksum file contains unexpected resources.");

const context = { window: {} };
for (const file of coreFiles) {
  vm.runInNewContext(sources[file], context, {
    filename: path.join(dataDir, file),
    timeout: 5_000
  });
}
const data = context.window.AMUR_ATLAS_DATA;
const loader = context.window.AmurAtlasDataLoader;
if (!data || typeof data !== "object") fail("window.AMUR_ATLAS_DATA was not assembled.");
if (!loader || typeof loader.applySpatial !== "function") fail("lazy spatial loader was not created.");
if (loader.isSpatialReady()) fail("spatial data must not be present in the initial core package.");
if (data.mapBounds3857 !== null) fail("mapBounds3857 must be deferred in the core package.");
if (data.municipalities.some((item) => item.geometry !== null)) fail("municipality geometry leaked into the core package.");
if (data.settlements.some((item) => [item.lat, item.lon, item.x3857, item.y3857].some((value) => value !== null))) {
  fail("settlement coordinates leaked into the core package.");
}

vm.runInNewContext(sources["atlas-spatial.js"], context, {
  filename: path.join(dataDir, "atlas-spatial.js"),
  timeout: 5_000
});
loader.applySpatial(context.window.AMUR_ATLAS_SPATIAL);
if (!loader.isSpatialReady()) fail("spatial package was not applied.");
if (!Array.isArray(data.mapBounds3857) || data.mapBounds3857.length !== 4) fail("map bounds were not restored.");
if (data.municipalities.some((item) => !item.geometry)) fail("municipality geometry was not fully restored.");
if (data.settlements.some((item) => ![item.lat, item.lon, item.x3857, item.y3857].every(Number.isFinite))) {
  fail("settlement coordinates were not fully restored.");
}

const canonicalHash = sha256(JSON.stringify(data));
if (canonicalHash !== manifest.canonicalDataSha256) {
  fail(`canonical data hash mismatch (expected ${manifest.canonicalDataSha256}, got ${canonicalHash}).`);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const contract = schema["x-atlas-contract"];
const deliveryContract = schema["x-delivery-contract"];
if (deliveryContract?.schemaVersion !== manifest.schemaVersion) {
  fail("schema and manifest delivery versions do not match.");
}
if (JSON.stringify(deliveryContract?.eagerResources) !== JSON.stringify(coreFiles)) {
  fail("schema eager resource order does not match the runtime order.");
}
if (JSON.stringify(deliveryContract?.lazyResources) !== JSON.stringify(["atlas-spatial.js"])) {
  fail("schema lazy resource list is invalid.");
}
for (const key of schema.required) {
  if (!(key in data)) fail(`required root field is missing: ${key}.`);
}
if (data.regionKey !== contract.regionKey) fail(`unexpected regionKey: ${data.regionKey}.`);
if (data.period !== contract.period) fail(`unexpected period: ${data.period}.`);
if (data.populationYear !== contract.populationYear) fail(`unexpected populationYear: ${data.populationYear}.`);
if (data.populationTotal !== contract.populationTotal) fail(`unexpected populationTotal: ${data.populationTotal}.`);

const expectedCounts = contract.expectedCounts;
for (const [key, expected] of Object.entries(expectedCounts)) {
  const value = key === "records" ? data.records : data[key];
  if (!Array.isArray(value) || value.length !== expected) {
    fail(`${key} count must be ${expected}, got ${value?.length ?? "missing"}.`);
  }
  if (manifest.counts?.[key] !== expected) fail(`manifest count for ${key} must be ${expected}.`);
}

const years = new Set(contract.years);
const sexes = new Set(contract.sexes);
const aggregate = { mappedIcd: 0, validAge: 0, municipalityMapped: 0, settlementMapped: 0 };
for (let index = 0; index < data.records.length; index += 1) {
  const record = data.records[index];
  if (!Array.isArray(record) || record.length !== contract.recordLayout.length) {
    fail(`record ${index} must contain ${contract.recordLayout.length} fields.`);
  }
  if (!record.every(Number.isInteger)) fail(`record ${index} contains a non-integer value.`);
  const [year, sex, age, codeIndex, municipalityIndex, settlementIndex] = record;
  if (!years.has(year)) fail(`record ${index} has invalid year ${year}.`);
  if (!sexes.has(sex)) fail(`record ${index} has invalid sex ${sex}.`);
  if (age < -1 || age > contract.maxAge) fail(`record ${index} has invalid age ${age}.`);
  if (codeIndex < -1 || codeIndex >= data.codes.length) fail(`record ${index} has invalid code index ${codeIndex}.`);
  if (municipalityIndex < -1 || municipalityIndex >= data.municipalities.length) fail(`record ${index} has invalid municipality index ${municipalityIndex}.`);
  if (settlementIndex < -1 || settlementIndex >= data.settlements.length) fail(`record ${index} has invalid settlement index ${settlementIndex}.`);
  if (codeIndex >= 0) {
    aggregate.mappedIcd += 1;
    const code = String(data.codes[codeIndex]?.code || "").toUpperCase();
    if (code === "Y35" || code === "Y36") fail(`excluded code ${code} is still used by record ${index}.`);
  }
  if (age >= 0) aggregate.validAge += 1;
  if (municipalityIndex >= 0) aggregate.municipalityMapped += 1;
  if (settlementIndex >= 0) aggregate.settlementMapped += 1;
}

for (let index = 0; index < data.blocks.length; index += 1) {
  const classIndex = data.blocks[index]?.class;
  if (!Number.isInteger(classIndex) || classIndex < 0 || classIndex >= data.classes.length) {
    fail(`block ${index} has invalid class index ${classIndex}.`);
  }
}
for (let index = 0; index < data.codes.length; index += 1) {
  const code = data.codes[index];
  if (!Number.isInteger(code?.class) || code.class < 0 || code.class >= data.classes.length) {
    fail(`code ${index} has invalid class index ${code?.class}.`);
  }
  if (!Number.isInteger(code?.block) || code.block < 0 || code.block >= data.blocks.length) {
    fail(`code ${index} has invalid block index ${code?.block}.`);
  }
}
for (let index = 0; index < data.settlements.length; index += 1) {
  const municipalityIndex = data.settlements[index]?.municipalityIndex;
  if (!Number.isInteger(municipalityIndex) || municipalityIndex < 0 || municipalityIndex >= data.municipalities.length) {
    fail(`settlement ${index} has invalid municipality index ${municipalityIndex}.`);
  }
}

const qualityPairs = {
  period_rows: data.records.length,
  mapped_icd: aggregate.mappedIcd,
  valid_age: aggregate.validAge,
  municipality_mapped: aggregate.municipalityMapped,
  settlement_coordinate_mapped: aggregate.settlementMapped,
  classes: data.classes.length,
  blocks: data.blocks.length,
  codes: data.codes.length,
  municipalities: data.municipalities.length,
  settlements_in_layer: data.settlements.length
};
for (const [key, actual] of Object.entries(qualityPairs)) {
  if (data.quality?.[key] !== actual) {
    fail(`quality.${key} must be ${actual}, got ${data.quality?.[key]}.`);
  }
}

const html = fs.readFileSync(htmlPath, "utf8");
let previousIndex = -1;
for (const file of coreFiles) {
  const versionMatch = html.match(new RegExp(`<script\\s+src=["']data/${file.replace(".", "\\.")}\\?v=([a-f0-9]{12})["']><\\/script>`));
  if (!versionMatch) fail(`index.html does not load versioned ${file}.`);
  if (versionMatch[1] !== manifest.resources[file].sha256.slice(0, 12)) {
    fail(`index.html uses a stale version for ${file}.`);
  }
  const index = html.indexOf(versionMatch[0]);
  if (index <= previousIndex) fail("core atlas resources are loaded in the wrong order.");
  previousIndex = index;
}
if (/data\/atlas-spatial\.js/.test(html)) fail("atlas-spatial.js must remain lazy and must not be linked statically.");
if (!sources["atlas-data.js"].includes(`atlas-spatial.js?v=${manifest.resources["atlas-spatial.js"].sha256.slice(0, 12)}`)) {
  fail("atlas-data.js uses a stale spatial package version.");
}
if (/const DATA=\{/.test(html)) fail("index.html still contains an embedded DATA object.");
if (!/const DATA=window\.AMUR_ATLAS_DATA;/.test(html)) fail("index.html does not expose DATA to the legacy runtime.");

console.log(JSON.stringify({
  status: "ok",
  schemaVersion: manifest.schemaVersion,
  canonicalDataSha256: canonicalHash,
  coreBytes: coreFiles.reduce((total, file) => total + manifest.resources[file].bytes, 0),
  lazySpatialBytes: manifest.resources["atlas-spatial.js"].bytes,
  records: data.records.length,
  years: [...years],
  mappedIcd: aggregate.mappedIcd,
  validAge: aggregate.validAge,
  municipalityMapped: aggregate.municipalityMapped,
  settlementMapped: aggregate.settlementMapped,
  classes: data.classes.length,
  blocks: data.blocks.length,
  codes: data.codes.length,
  municipalities: data.municipalities.length,
  settlements: data.settlements.length
}, null, 2));
