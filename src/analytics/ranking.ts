export interface RankedValue {
  i: number;
  v: number;
  rank: number;
}

export type RankingValueSelector<T> = (item: T) => number;
export type RankingTieBreaker<T> = (left: T, right: T) => number;

export function rankItemsDescending<T extends object>(
  items: readonly T[],
  valueOf: RankingValueSelector<T>,
  tieBreaker?: RankingTieBreaker<T>
): Array<T & { rank: number }> {
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const valueDelta = valueOf(right.item) - valueOf(left.item);
      if (valueDelta) return valueDelta;
      const tieDelta = tieBreaker?.(left.item, right.item) ?? 0;
      return tieDelta || left.sourceIndex - right.sourceIndex;
    })
    .map(({ item }, index) => ({ ...item, rank: index + 1 }));
}

export function rankIndexedValues(values: readonly number[]): RankedValue[] {
  return rankItemsDescending(
    values.map((v, i) => ({ i, v })),
    (item) => item.v
  );
}
