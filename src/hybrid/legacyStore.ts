import { useSyncExternalStore } from "react";
import type { AtlasLegacyBridge, LegacyStateSnapshot } from "./types";

export const FALLBACK_STATE: LegacyStateSnapshot = Object.freeze({
  view: "map",
  year: "all",
  sex: "all",
  age: "all"
});

export function getLegacyBridge(): AtlasLegacyBridge | undefined {
  return window.AtlasLegacyBridge;
}

function subscribe(listener: () => void): () => void {
  return getLegacyBridge()?.subscribe(listener) ?? (() => undefined);
}

function getSnapshot(): LegacyStateSnapshot {
  return getLegacyBridge()?.getSnapshot() ?? FALLBACK_STATE;
}

export function useLegacyState(): LegacyStateSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK_STATE);
}
