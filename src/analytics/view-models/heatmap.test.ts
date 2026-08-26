import { describe, expect, it } from "vitest";
import type { AtlasObservation } from "../core";
import { buildHeatmapViewModel, heatmapCellKey, topHeatmapTerritories, type HeatmapReferenceData } from "./heatmap";

const reference: HeatmapReferenceData = {
  years: [2024, 2025],
  codes: [
    { class: 0, block: 0 },
    { class: 1, block: 1 }
  ],
  classes: [
    { roman: "I", short: "Первый класс", color: "#1677aa" },
    { roman: "II", short: "Второй класс", color: "#7c5aaa" }
  ],
  municipalities: [
    { name: "Город", municipalityType: "city", population2021: 1_000 },
    { name: "Район", municipalityType: "district", population2021: 2_000 },
    { name: "Посёлок", municipalityType: "urban_settlement", population2021: 500 }
  ],
  settlements: [
    { name: "НП 1", population2021: 600 },
    { name: "НП 2", population2021: 400 }
  ]
};

const records: AtlasObservation[] = [
  [2024, 1, 50, 0, 0, 0],
  [2025, 1, 60, 0, 0, 0],
  [2025, 2, 70, 1, 0, 1],
  [2024, 2, 65, 1, 1, 1],
  [2025, 2, 75, 1, 1, 1],
  [2025, 2, 80, 1, 1, 1]
];

describe("heatmap view model", () => {
  it("keeps a stable municipality matrix and annualizes population rates", () => {
    const model = buildHeatmapViewModel(records, records, reference, {
      unit: "mo",
      metric: "per1k",
      limit: "25",
      selectedYear: "all"
    });
    expect(model.rows.map((row) => row.idx)).toEqual([0, 2, 1]);
    expect(model.classes).toEqual([0, 1]);
    expect(model.cells).toHaveLength(6);
    expect(model.cellMap.get(heatmapCellKey("mo", 0, 0))).toMatchObject({
      count: 2,
      population: 1_000,
      value: 1,
      territoryRank: 1
    });
    expect(model.cellMap.get(heatmapCellKey("mo", 1, 1))?.value).toBeCloseTo(0.75, 8);
    expect(model.maximum).toBe(1);
  });

  it("limits settlements after sorting and exposes reusable rankings", () => {
    const model = buildHeatmapViewModel(records, records, reference, {
      unit: "settlement",
      metric: "n",
      limit: "25",
      selectedYear: 2025
    });
    expect(model.rows.map((row) => row.idx)).toEqual([1, 0]);
    const top = topHeatmapTerritories(model, 1, 2);
    expect(top.map((cell) => [cell.definition.name, cell.value])).toEqual([["НП 2", 4], ["НП 1", 0]]);
    expect(top[0]).toMatchObject({ territoryRank: 1, territoryCount: 2, causeRank: 1, causeCount: 2 });
  });
});
