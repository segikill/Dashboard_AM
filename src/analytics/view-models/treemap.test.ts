import { describe, expect, it } from "vitest";
import type { AtlasObservation } from "../core";
import { buildTreemapViewModel, treemapBreadcrumbs, type TreemapReferenceData } from "./treemap";

const reference: TreemapReferenceData = {
  years: [2023, 2024, 2025],
  populationTotal: 1_000,
  classes: [
    { roman: "I", short: "Первый класс", color: "#1677aa" },
    { roman: "II", short: "Второй класс", color: "#7c5aaa" },
    { roman: "III", short: "Третий класс", color: "#47a66b" }
  ],
  blocks: [
    { class: 0, code: "A00-A09", label: "Первый блок" },
    { class: 0, code: "A10-A19", label: "Второй блок" },
    { class: 1, code: "B00-B09", label: "Третий блок" },
    { class: 2, code: "C00-C09", label: "Четвёртый блок" }
  ],
  codes: [
    { class: 0, block: 0, code: "A00", label: "Причина A00" },
    { class: 0, block: 1, code: "A10", label: "Причина A10" },
    { class: 1, block: 2, code: "B00", label: "Причина B00" },
    { class: 2, block: 3, code: "C00", label: "Причина C00" }
  ]
};

const record = (year: number, age: number, code: number): AtlasObservation => [year, 1, age, code, 0, 0];

const records: AtlasObservation[] = [
  record(2023, 40, 0),
  record(2023, 60, 0),
  record(2024, 70, 0),
  record(2025, 80, 0),
  record(2025, 20, 1),
  record(2025, 30, 2)
];

describe("treemap view model", () => {
  it("aggregates values, yearly change and annualized rate without DOM dependencies", () => {
    const model = buildTreemapViewModel(records, records, reference, {
      scope: "root",
      parentIndex: -1,
      metric: "n",
      sort: "value",
      minShare: 0,
      selectedYear: "all"
    });
    expect(model.totalRows).toBe(6);
    expect(model.rawItems.map((item) => [item.code, item.n])).toEqual([["I", 5], ["II", 1]]);
    expect(model.rawItems[0]).toMatchObject({
      median: 60,
      pgpzh: 110,
      share: 5 / 6 * 100,
      series: [2, 1, 2],
      change: 0
    });
    expect(model.rawItems[0].rate).toBeCloseTo(166.6666666667, 8);
    expect(model.contextLabel).toBe("Все классы МКБ-10");
  });

  it("groups small categories into a lossless synthetic item", () => {
    const many = [
      ...Array.from({ length: 8 }, (_, index) => record(2023 + index % 3, 50 + index, 0)),
      record(2025, 30, 2),
      record(2025, 25, 3)
    ];
    const model = buildTreemapViewModel(many, many, reference, {
      scope: "root",
      parentIndex: -1,
      metric: "n",
      sort: "value",
      minShare: 15,
      selectedYear: "all"
    });
    expect(model.items).toHaveLength(2);
    expect(model.items[1]).toMatchObject({ synthetic: true, n: 2, value: 2, share: 20 });
    expect(model.items[1].children?.map((item) => item.code)).toEqual(["II", "III"]);
    expect(model.items.flatMap((item) => item.rows)).toHaveLength(10);
  });

  it("builds an explicit hierarchy path for class and block scopes", () => {
    expect(treemapBreadcrumbs(reference, "class", 0)).toEqual([
      { level: "root", label: "Все классы", current: false },
      { level: "class", label: "I · Первый класс", current: true }
    ]);
    expect(treemapBreadcrumbs(reference, "block", 1)[2]).toEqual({
      level: "block",
      label: "A10-A19 · Второй блок",
      current: true
    });
  });
});
