import { describe, expect, it } from "vitest";
import {
  agePassesFilter,
  filterObservations,
  quantile,
  summarizeObservations,
  type AtlasObservation
} from "./core";

const records: AtlasObservation[] = [
  [2023, 1, 14, 0, 0, 0],
  [2023, 2, 15, 1, 0, 1],
  [2024, 1, 44, 2, 1, 2],
  [2024, 2, 45, 3, 1, 3],
  [2025, 1, 64, 4, 2, 4],
  [2025, 2, 65, 5, 2, 5],
  [2025, 2, 80, 6, 2, 6],
  [2025, 2, -1, 7, 2, 7]
];

describe("analytics core", () => {
  it("keeps the atlas age-group boundaries", () => {
    expect(agePassesFilter(-1, "all")).toBe(true);
    expect(agePassesFilter(-1, "0_14")).toBe(false);
    expect(agePassesFilter(14, "0_14")).toBe(true);
    expect(agePassesFilter(15, "0_14")).toBe(false);
    expect(agePassesFilter(44, "15_44")).toBe(true);
    expect(agePassesFilter(45, "15_44")).toBe(false);
    expect(agePassesFilter(79, "65_79")).toBe(true);
    expect(agePassesFilter(80, "80P")).toBe(true);
  });

  it("applies global year, sex and age filters", () => {
    expect(filterObservations(records, { year: "2025", sex: "2", age: "65_79" }))
      .toEqual([[2025, 2, 65, 5, 2, 5]]);
  });

  it("supports explicit comparison years", () => {
    const rows = filterObservations(
      records,
      { year: "2023", sex: "1", age: "all" },
      { years: [2024, 2025], ignoreSex: true }
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row[0] === 2024 || row[0] === 2025)).toBe(true);
  });

  it("preserves the legacy ignoreYear precedence", () => {
    const rows = filterObservations(
      records,
      { year: "2023", sex: "1", age: "all" },
      { years: [2024], ignoreYear: true, ignoreSex: true }
    );
    expect(rows).toHaveLength(records.length);
  });

  it("uses linear interpolation for quantiles", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
  });

  it("calculates median age and PGPZH-75 without unknown ages", () => {
    expect(summarizeObservations([
      [2025, 1, 20, 0, 0, 0],
      [2025, 2, 40, 0, 0, 0],
      [2025, 2, 80, 0, 0, 0],
      [2025, 2, -1, 0, 0, 0]
    ])).toEqual({
      n: 4,
      ages: [20, 40, 80],
      median: 40,
      pgpzh: 90
    });
  });
});
