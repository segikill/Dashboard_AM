import { describe, expect, it } from "vitest";
import { blockIndexOf, classIndexOf, countClasses, type AtlasCodeReference } from "./classification";
import type { AtlasObservation } from "./core";

const codes: AtlasCodeReference[] = [
  { class: 0, block: 2 },
  { class: 1, block: 4 },
  { class: 1, block: 5 }
];

const records: AtlasObservation[] = [
  [2025, 1, 60, 0, 0, 0],
  [2025, 2, 70, 1, 0, 1],
  [2025, 2, 80, 2, 1, 2],
  [2025, 2, 80, -1, 1, 3]
];

describe("ICD classification", () => {
  it("resolves class and block indices from the code dictionary", () => {
    expect(classIndexOf(records[0], codes)).toBe(0);
    expect(blockIndexOf(records[1], codes)).toBe(4);
    expect(classIndexOf(records[3], codes)).toBe(-1);
  });

  it("counts only records linked to a valid ICD class", () => {
    expect(countClasses(records, codes, 3)).toEqual([1, 2, 0]);
  });
});
