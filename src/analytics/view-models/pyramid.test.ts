import { describe, expect, it } from "vitest";
import type { AtlasObservation } from "../core";
import { buildPyramidViewModel, pyramidCauseDefinitions, type PyramidReferenceData } from "./pyramid";

const reference: PyramidReferenceData = {
  years: [2023, 2024, 2025],
  classes: [
    { roman: "I", short: "Инфекции" },
    { roman: "II", short: "Новообразования" }
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

const records: AtlasObservation[] = [
  [2023, 1, 4, 0, 0, 0],
  [2023, 2, 8, 1, 0, 0],
  [2024, 1, 43, 0, 0, 0],
  [2025, 1, 42, 0, 0, 0],
  [2025, 2, 44, 1, 0, -1],
  [2025, 2, 84, 1, 0, 0],
  [2025, 2, -1, 1, 0, 0]
];

describe("pyramid view model", () => {
  it("builds a stable 5-year structure and its public contexts", () => {
    const model = buildPyramidViewModel(records, reference, {
      view: "structure", level: "class", parentClass: "all", cause: "all",
      metric: "n", ageStep: 5, selectedYear: "all"
    });
    expect(model.current.bins).toHaveLength(18);
    expect(model.current.total).toBe(6);
    expect(model.items).toHaveLength(18);
    expect(model.peak?.label).toBe("40–44");
    expect(model.kpis.linkedPercent).toBeCloseTo(5 / 6 * 100);
  });

  it("compares the first and last year on one model", () => {
    const model = buildPyramidViewModel(records, reference, {
      view: "trend", level: "class", parentClass: "all", cause: "all",
      metric: "share", ageStep: 10, selectedYear: "all"
    });
    expect(model.current.bins).toHaveLength(9);
    expect(model.baseline?.total).toBe(2);
    expect(model.current.total).toBe(3);
    expect(model.periodLabel).toBe("2023 → 2025");
    expect(model.items.find((item) => item.ageLabel === "40–49")?.changePercent).toBeNull();
  });

  it("filters cause definitions and records by selected class", () => {
    const options = {
      view: "structure" as const, level: "block" as const, parentClass: 1 as const, cause: 1 as const,
      metric: "n" as const, ageStep: 5 as const, selectedYear: 2025
    };
    expect(pyramidCauseDefinitions(reference, options).map((item) => item.index)).toEqual([1]);
    const model = buildPyramidViewModel(records, reference, options);
    expect(model.current.total).toBe(2);
    expect(model.causeLabel).toContain("C00–C14");
  });
});
