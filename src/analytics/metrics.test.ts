import { describe, expect, it } from "vitest";
import {
  calculateAnnualizedRate,
  calculateTerritoryMetric,
  populationValue,
  rateBase,
  ratePeriodYears,
  russianYearCountLabel
} from "./metrics";

describe("population-based metrics", () => {
  it("accepts only a finite positive population", () => {
    expect(populationValue({ population2021: "246767" })).toBe(246_767);
    expect(populationValue({ population2021: 0 })).toBeNull();
    expect(populationValue({ population2021: "unknown" })).toBeNull();
    expect(populationValue(null)).toBeNull();
  });

  it("maps supported coefficients and preserves the legacy period policy", () => {
    expect(rateBase("per1k")).toBe(1_000);
    expect(rateBase("per10k")).toBe(10_000);
    expect(rateBase("per100k")).toBe(100_000);
    expect(rateBase("n")).toBeNull();
    expect(ratePeriodYears("all", [2023, 2024, 2025])).toBe(3);
    expect(ratePeriodYears(2025, [2023, 2024, 2025])).toBe(1);
    expect(ratePeriodYears("all", [])).toBe(1);
  });

  it("returns a transparent annualized-rate calculation", () => {
    const result = calculateAnnualizedRate(
      9_480,
      { population2021: 246_767 },
      "per1k",
      { year: "all", availableYears: [2023, 2024, 2025] }
    );
    expect(result).toMatchObject({
      count: 9_480,
      population: 246_767,
      periodYears: 3,
      denominator: 740_301,
      base: 1_000
    });
    expect(result?.value).toBeCloseTo(12.805602045654403, 12);
    expect(calculateAnnualizedRate(10, { population2021: null }, "per1k", {
      year: "all",
      availableYears: [2023, 2024, 2025]
    })).toBeNull();
  });

  it("preserves both meanings of territory share", () => {
    const common = {
      metric: "share",
      aggregate: { total: 30, selected: 12 },
      definition: { population2021: 1_000 },
      year: "all" as const,
      availableYears: [2023, 2024, 2025],
      totalRows: 120
    };
    expect(calculateTerritoryMetric({ ...common, selectedClass: "all" })).toBe(25);
    expect(calculateTerritoryMetric({ ...common, selectedClass: 8 })).toBe(40);
    expect(calculateTerritoryMetric({ ...common, metric: "n", selectedClass: 8 })).toBe(12);
  });

  it("formats Russian year counts used by the formula explanation", () => {
    expect(russianYearCountLabel(1)).toBe("1 год");
    expect(russianYearCountLabel(3)).toBe("3 года");
    expect(russianYearCountLabel(5)).toBe("5 лет");
    expect(russianYearCountLabel(11)).toBe("11 лет");
    expect(russianYearCountLabel(21)).toBe("21 год");
  });
});
