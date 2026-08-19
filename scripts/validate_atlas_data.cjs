const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "atlas-data.js");
const checksumPath = path.join(root, "data", "atlas-data.sha256");
const schemaPath = path.join(root, "data", "atlas-data.schema.json");
const htmlPath = path.join(root, "index.html");

const fail = (message) => {
  throw new Error(`Atlas data validation failed: ${message}`);
};

const source = fs.readFileSync(dataPath, "utf8");
const expectedChecksum = fs.readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
const actualChecksum = crypto.createHash("sha256").update(source, "utf8").digest("hex");
if (actualChecksum !== expectedChecksum) {
  fail(`SHA-256 mismatch (expected ${expectedChecksum}, got ${actualChecksum}).`);
}

const context = { window: {} };
vm.runInNewContext(source, context, { filename: dataPath, timeout: 5_000 });
const data = context.window.AMUR_ATLAS_DATA;
if (!data || typeof data !== "object") fail("window.AMUR_ATLAS_DATA was not created.");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const contract = schema["x-atlas-contract"];
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
const versionMatch = html.match(/<script\s+src=["']data\/atlas-data\.js\?v=([a-f0-9]{12})["']><\/script>/);
if (!versionMatch) {
  fail("index.html does not load the versioned external atlas dataset.");
}
if (versionMatch[1] !== actualChecksum.slice(0, 12)) {
  fail(`index.html uses stale data version ${versionMatch[1]}; expected ${actualChecksum.slice(0, 12)}.`);
}
if (/const DATA=\{/.test(html)) fail("index.html still contains an embedded DATA object.");
if (!/const DATA=window\.AMUR_ATLAS_DATA;/.test(html)) fail("index.html does not expose DATA to the legacy runtime.");

console.log(JSON.stringify({
  status: "ok",
  sha256: actualChecksum,
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
