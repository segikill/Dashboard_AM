const crypto = require("node:crypto");

const baseInput = process.argv[2] || process.env.DEPLOYED_URL;
if (!baseInput) throw new Error("Pass the deployed Pages URL as the first argument or DEPLOYED_URL.");
const base = new URL(baseInput.endsWith("/") ? baseInput : `${baseInput}/`);
const attempts = Number(process.env.SMOKE_ATTEMPTS || 12);
const delayMs = Number(process.env.SMOKE_DELAY_MS || 10_000);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const fetchBuffer = async (relative, token) => {
  const url = new URL(relative, base);
  url.searchParams.set("deployment", token);
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
};

(async () => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const token = `${Date.now()}-${attempt}`;
      const manifestBuffer = await fetchBuffer("build-manifest.json", token);
      const manifest = JSON.parse(manifestBuffer.toString("utf8"));
      if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
        throw new Error("Deployed build manifest is invalid.");
      }
      const concurrency = 8;
      for (let index = 0; index < manifest.files.length; index += concurrency) {
        await Promise.all(manifest.files.slice(index, index + concurrency).map(async (entry) => {
          const content = await fetchBuffer(entry.path, token);
          if (content.byteLength !== entry.bytes) throw new Error(`${entry.path} size mismatch.`);
          if (sha256(content) !== entry.sha256) throw new Error(`${entry.path} hash mismatch.`);
        }));
      }
      console.log(JSON.stringify({
        status: "ok",
        url: base.href,
        sourceRevision: manifest.sourceRevision,
        files: manifest.totals.files,
        bytes: manifest.totals.bytes
      }, null, 2));
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Deployment smoke attempt ${attempt}/${attempts}: ${error.message}`);
      if (attempt < attempts) await pause(delayMs);
    }
  }
  throw lastError;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
