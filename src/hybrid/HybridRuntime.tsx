import { useEffect, useMemo } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import {
  validateLegacyData,
  validateLegacyHeader,
  validateLegacyInfrastructureChrome,
  validateLegacyMapChrome,
  validateLegacyNavigation,
  validateLegacyState
} from "./validation";

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get("reactDebug") === "1";
}

export function HybridRuntime() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  const summary = bridge?.getDataSummary();
  const header = bridge?.getHeaderSummary();
  const mapChrome = bridge?.getMapChromeSummary();
  const infrastructureChrome = bridge?.getInfrastructureChromeSummary();
  const navigation = bridge?.getNavigationSummary();
  const validation = useMemo(() => {
    if (!summary) return { ok: false, errors: ["Legacy-мост не найден"] };
    const data = validateLegacyData(summary);
    const state = validateLegacyState(snapshot);
    const headerState = header
      ? validateLegacyHeader(header, summary)
      : { ok: false, errors: ["Состояние верхней строки недоступно"] };
    const mapState = mapChrome
      ? validateLegacyMapChrome(mapChrome)
      : { ok: false, errors: ["Состояние оболочки карты недоступно"] };
    const infrastructureState = infrastructureChrome
      ? validateLegacyInfrastructureChrome(infrastructureChrome)
      : { ok: false, errors: ["Состояние оболочки инфраструктуры недоступно"] };
    const navigationState = navigation
      ? validateLegacyNavigation(navigation)
      : { ok: false, errors: ["Состояние навигации недоступно"] };
    return {
      ok: data.ok && state.ok && headerState.ok && mapState.ok && infrastructureState.ok && navigationState.ok,
      errors: [
        ...data.errors,
        ...state.errors,
        ...headerState.errors,
        ...mapState.errors,
        ...infrastructureState.errors,
        ...navigationState.errors
      ]
    };
  }, [header, infrastructureChrome, mapChrome, navigation, snapshot, summary]);
  const showDebug = debugEnabled();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-react-hybrid-root]");
    if (!root) return;
    root.dataset.reactStatus = validation.ok ? "ready" : "error";
    root.dataset.reactVersion = "1";
    root.dataset.recordCount = String(summary?.records ?? 0);
    if (showDebug) root.hidden = false;
    window.dispatchEvent(
      new CustomEvent("atlas:react-ready", {
        detail: { ok: validation.ok, errors: validation.errors, records: summary?.records ?? 0 }
      })
    );
  }, [showDebug, summary?.records, validation.errors, validation.ok]);

  if (!showDebug) return null;

  return (
    <aside
      aria-label="Диагностика гибридной архитектуры"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 10000,
        width: 300,
        padding: 14,
        border: `1px solid ${validation.ok ? "#6bd6a5" : "#ef7d7d"}`,
        borderRadius: 12,
        background: "rgba(10, 37, 64, 0.96)",
        color: "#fff",
        boxShadow: "0 18px 45px rgba(10, 37, 64, 0.28)",
        font: '12px/1.4 Inter, "Segoe UI", Arial, sans-serif'
      }}
    >
      <strong style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
        React + TypeScript: {validation.ok ? "готово" : "ошибка"}
      </strong>
      <div>Вкладка: {snapshot.view}</div>
      <div>Период: {snapshot.year === "all" ? summary?.period : snapshot.year}</div>
      <div>Наблюдений: {summary?.records.toLocaleString("ru-RU") ?? "—"}</div>
      {!validation.ok && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {validation.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </aside>
  );
}
