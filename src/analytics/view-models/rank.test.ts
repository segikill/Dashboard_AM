import { describe, expect, it } from "vitest";
import type { AtlasObservation } from "../core";
import { buildRankViewModel, type RankReferenceData, type RankSlice } from "./rank";

const reference: RankReferenceData = {
  classes: [
    { roman: "I", short: "Инфекции", color: "#2d7dd2" },
    { roman: "II", short: "Новообразования", color: "#e45756" }
  ],
  blocks: [
    { class: 0, code: "A00–A09", label: "Кишечные инфекции" },
    { class: 1, code: "C00–C14", label: "Новообразования губы" }
  ],
  codes: [
    { class: 0, block: 0, code: "A01", label: "Тиф" },
    { class: 1, block: 1, code: "C01", label: "Новообразование языка" }
  ]
};

const left: AtlasObservation[] = [
  [2023, 1, 40, 0, 0, 0],
  [2023, 1, 60, 0, 0, 0],
  [2023, 2, 70, 1, 0, 0]
];
const right: AtlasObservation[] = [
  [2025, 1, 50, 0, 0, 0],
  [2025, 2, 30, 1, 0, 0],
  [2025, 2, 40, 1, 0, 0],
  [2025, 2, 50, 1, 0, 0]
];
const slices: RankSlice[] = [
  { key: "2023", label: "2023", note: "оба пола", rows: left },
  { key: "2025", label: "2025", note: "оба пола", rows: right }
];

describe("rank view model", () => {
  it("aggregates, ranks and prepares inspector context", () => {
    const model = buildRankViewModel(slices, reference, {
      level: "class", classIndex: "all", metric: "n", top: 10, onlyChanges: false
    });
    expect(model.items).toHaveLength(2);
    const tumors = model.items.find((item) => item.definition.key === "class:1");
    expect(tumors?.series.map((item) => [item.n, item.rank])).toEqual([[1, 2], [3, 1]]);
    expect(tumors?.context.rankDelta).toBe(1);
    expect(tumors?.context.relativeDelta).toBe(200);
    expect(tumors?.context.insight).toContain("повысился");
  });

  it("supports class-scoped blocks and changed-only trajectories", () => {
    const model = buildRankViewModel(slices, reference, {
      level: "block", classIndex: 0, metric: "pgpzh", top: 10, onlyChanges: true
    });
    expect(model.definitions.map((item) => item.key)).toEqual(["block:0"]);
    expect(model.items).toHaveLength(0);
  });

  it("uses a fallback rank when an item is absent in a slice", () => {
    const model = buildRankViewModel([
      slices[0],
      { ...slices[1], rows: right.filter((row) => row[3] === 1) }
    ], reference, {
      level: "class", classIndex: "all", metric: "n", top: 10, onlyChanges: false
    });
    const infections = model.items.find((item) => item.definition.key === "class:0");
    expect(infections?.series[1].n).toBe(0);
    expect(infections?.series[1].rank).toBe(2);
  });
});
