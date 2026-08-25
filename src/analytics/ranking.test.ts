import { describe, expect, it } from "vitest";
import { rankIndexedValues, rankItemsDescending } from "./ranking";

describe("ranking", () => {
  it("creates descending ordinal ranks for indexed values", () => {
    expect(rankIndexedValues([0.2, 0.5, 0.3])).toEqual([
      { i: 1, v: 0.5, rank: 1 },
      { i: 2, v: 0.3, rank: 2 },
      { i: 0, v: 0.2, rank: 3 }
    ]);
  });

  it("keeps source order for ties by default", () => {
    const source = [{ key: "b", value: 5 }, { key: "a", value: 5 }, { key: "c", value: 2 }];
    const ranked = rankItemsDescending(source, (item) => item.value);
    expect(ranked.map((item) => `${item.rank}:${item.key}`)).toEqual(["1:b", "2:a", "3:c"]);
    expect(source.some((item) => "rank" in item)).toBe(false);
  });

  it("supports a deterministic view-specific tie breaker", () => {
    const source = [{ key: "b", value: 5 }, { key: "a", value: 5 }];
    const ranked = rankItemsDescending(
      source,
      (item) => item.value,
      (left, right) => left.key.localeCompare(right.key)
    );
    expect(ranked.map((item) => item.key)).toEqual(["a", "b"]);
  });
});
