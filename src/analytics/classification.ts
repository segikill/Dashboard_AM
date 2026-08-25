import type { AtlasObservation } from "./core";

export interface AtlasCodeReference {
  class: number;
  block: number;
}

export function classIndexOf(
  record: AtlasObservation,
  codes: readonly AtlasCodeReference[]
): number {
  const codeIndex = record[3];
  return codeIndex >= 0 && codeIndex < codes.length ? codes[codeIndex].class : -1;
}

export function blockIndexOf(
  record: AtlasObservation,
  codes: readonly AtlasCodeReference[]
): number {
  const codeIndex = record[3];
  return codeIndex >= 0 && codeIndex < codes.length ? codes[codeIndex].block : -1;
}

export function countClasses(
  records: readonly AtlasObservation[],
  codes: readonly AtlasCodeReference[],
  classCount: number
): number[] {
  const counts = new Array(Math.max(0, classCount)).fill(0);
  records.forEach((record) => {
    const classIndex = classIndexOf(record, codes);
    if (classIndex >= 0 && classIndex < counts.length) counts[classIndex] += 1;
  });
  return counts;
}
