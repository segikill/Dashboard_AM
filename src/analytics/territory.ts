import { classIndexOf, type AtlasCodeReference } from "./classification";
import type { AtlasObservation } from "./core";

export type AtlasTerritoryUnit = "mo" | "settlement";
export type AtlasSelectedClass = "all" | number | string;

export interface TerritoryAggregationOptions {
  unit: AtlasTerritoryUnit;
  classCount: number;
  selectedClass?: AtlasSelectedClass;
  includeUnmappedCodes?: boolean;
  collectRows?: boolean;
}

export interface TerritoryAggregate<T extends AtlasObservation = AtlasObservation> {
  idx: number;
  total: number;
  selected: number;
  classes: number[];
  rows: T[];
  ages: number[];
  pgpzh: number;
}

export function aggregateTerritories<T extends AtlasObservation>(
  records: readonly T[],
  codes: readonly AtlasCodeReference[],
  options: TerritoryAggregationOptions
): Map<number, TerritoryAggregate<T>> {
  const keyPosition = options.unit === "mo" ? 4 : 5;
  const selectedClass = options.selectedClass === undefined || options.selectedClass === "all"
    ? null
    : Number(options.selectedClass);
  const classCount = Math.max(0, options.classCount);
  const result = new Map<number, TerritoryAggregate<T>>();

  records.forEach((record) => {
    const territoryIndex = record[keyPosition];
    if (territoryIndex < 0) return;
    const classIndex = classIndexOf(record, codes);
    if (classIndex < 0 && !options.includeUnmappedCodes) return;

    let aggregate = result.get(territoryIndex);
    if (!aggregate) {
      aggregate = {
        idx: territoryIndex,
        total: 0,
        selected: 0,
        classes: new Array(classCount).fill(0),
        rows: [],
        ages: [],
        pgpzh: 0
      };
      result.set(territoryIndex, aggregate);
    }

    aggregate.total += 1;
    if (classIndex >= 0 && classIndex < aggregate.classes.length) aggregate.classes[classIndex] += 1;
    if (selectedClass === null || classIndex === selectedClass) aggregate.selected += 1;
    if (record[2] >= 0) {
      aggregate.ages.push(record[2]);
      aggregate.pgpzh += Math.max(75 - record[2], 0);
    }
    if (options.collectRows) aggregate.rows.push(record);
  });

  return result;
}
