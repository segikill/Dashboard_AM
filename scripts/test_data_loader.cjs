const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const events = [];
let appendedScripts = 0;
let currentScript = null;

const windowObject = {
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  dispatchEvent(event) {
    events.push(event);
  }
};
const context = { window: windowObject };
const documentObject = {
  getElementById() {
    return currentScript;
  },
  createElement() {
    const listeners = new Map();
    return {
      id: "",
      src: "",
      async: false,
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      remove() {
        currentScript = null;
      },
      emit(type) {
        listeners.get(type)?.();
      }
    };
  },
  head: {
    appendChild(script) {
      appendedScripts += 1;
      currentScript = script;
      vm.runInNewContext(
        fs.readFileSync(path.join(dataDir, "atlas-spatial.js"), "utf8"),
        context,
        { filename: "atlas-spatial.js", timeout: 5_000 }
      );
      queueMicrotask(() => script.emit("load"));
    }
  }
};
context.document = documentObject;

for (const file of ["atlas-reference.js", "atlas-observations.js", "atlas-data.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(dataDir, file), "utf8"), context, {
    filename: file,
    timeout: 5_000
  });
}

const loader = windowObject.AmurAtlasDataLoader;
const data = windowObject.AMUR_ATLAS_DATA;
assert.ok(loader, "loader must be exposed");
assert.equal(loader.isSpatialReady(), false, "spatial package must be lazy");
assert.equal(data.records.length, 30_232, "core observations must be immediately available");
assert.equal(data.mapBounds3857, null, "core data must not contain map bounds");

Promise.all([loader.loadSpatial(), loader.loadSpatial()]).then(([first, second]) => {
  assert.equal(appendedScripts, 1, "concurrent requests must share one script load");
  assert.equal(first, data);
  assert.equal(second, data);
  assert.equal(loader.isSpatialReady(), true);
  assert.equal(data.mapBounds3857.length, 4);
  assert.ok(data.municipalities.every((item) => item.geometry));
  assert.ok(data.settlements.every((item) => Number.isFinite(item.x3857) && Number.isFinite(item.y3857)));
  assert.deepEqual(events.map((event) => event.detail.status), ["loading", "ready"]);
  return loader.loadSpatial();
}).then(() => {
  assert.equal(appendedScripts, 1, "ready data must not be loaded twice");
  console.log(JSON.stringify({
    status: "ok",
    appendedScripts,
    events: events.map((event) => event.detail.status),
    records: data.records.length,
    municipalities: data.municipalities.length,
    settlements: data.settlements.length
  }, null, 2));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
