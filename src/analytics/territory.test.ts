import { describe, expect, it } from "vitest";
import type { AtlasCodeReference } from "./classification";
import type { AtlasObservation } from "./core";
import { aggregateTerritories } from "./territory";

const codes: AtlasCodeReference[] = [
  { class: 0, block: 0 },
  { class: 1, block: 1 }
];

const records: AtlasObservation[] = [
  [2025, 1, 20, 0, 0, 10],
  [2025, 2, 40, 1, 0, 11],
  [2025, 2, 80, -1, 0, 11],
  [2025, 2, -1, 1, 1, 12],
  [2025, 2, 65, 0, -1, -1]
];

describe("territory aggregation", () => {
  it("preserves the heatmap policy that excludes records without an ICD class", () => {
    const result = aggregateTerritories(records, codes, {
      unit: "mo",
      classCount: 2,
      includeUnmappedCodes: false,
      collectRows: true
    });
    expect(result.get(0)).toMatchObject({ total: 2, selected: 2, classes: [1, 1], pgpzh: 90 });
    expect(result.get(0)?.rows).toHaveLength(2);
    expect(result.get(1)).toMatchObject({ total: 1, classes: [0, 1], ages: [] });
  });

  it("preserves the map policy that includes records without an ICD class", () => {
    const result = aggregateTerritories(records, codes, {
      unit: "mo",
      classCount: 2,
      selectedClass: "all",
      includeUnmappedCodes: true
    });
    expect(result.get(0)).toMatchObject({
      total: 3,
      selected: 3,
      classes: [1, 1],
      ages: [20, 40, 80],
      pgpzh: 90
    });
  });

  it("counts a selected class and supports settlement indices", () => {
    const result = aggregateTerritories(records, codes, {
      unit: "settlement",
      classCount: 2,
      selectedClass: 1,
      includeUnmappedCodes: true
    });
    expect(result.get(11)).toMatchObject({ total: 2, selected: 1, classes: [0, 1] });
    expect(result.has(-1)).toBe(false);
  });
});
