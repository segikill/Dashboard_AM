import { useEffect } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";

export function useReactOwnedHost(selector: string, ownerClass: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const host = document.querySelector<HTMLElement>(selector);
    const owner = host?.parentElement;
    if (!host || !owner) return;
    host.hidden = false;
    owner.classList.add(ownerClass);
    return () => {
      host.hidden = true;
      owner.classList.remove(ownerClass);
    };
  }, [enabled, ownerClass, selector]);
}

export function MapChrome() {
  useLegacyState();
  const bridge = getLegacyBridge();
  const map = bridge?.getMapChromeSummary();
  useReactOwnedHost("[data-react-map-chrome]", "is-react-owned");

  if (!bridge || !map?.active) return null;

  return (
    <div className="react-map-chrome" data-react-map-chrome-ready>
      <div className="react-map-chrome__main">
        <button
          type="button"
          className="react-map-chrome__toggle"
          aria-controls="atlasDrawer"
          aria-pressed={map.leftPanelOpen}
          title={map.leftPanelOpen ? "Свернуть параметры карты" : "Открыть параметры карты"}
          onClick={() => bridge.setMapPanel("left", !map.leftPanelOpen)}
        >
          <span className="react-map-chrome__glyph" aria-hidden="true">☰</span>{" "}
          <span className="react-map-chrome__label">Параметры</span>
        </button>
        <div className="react-map-chrome__title">
          <span>Тематическая WebGL-карта</span>
          <b>Смертность по территориям</b>
        </div>
      </div>
      <div className="react-map-chrome__actions">
        <button type="button" onClick={() => bridge.triggerMapAction("fit")}>Весь регион</button>
        <button
          type="button"
          className="react-map-chrome__toggle"
          aria-controls="mortalityMapInspector"
          aria-pressed={map.rightPanelOpen}
          onClick={() => bridge.setMapPanel("right", !map.rightPanelOpen)}
        >
          <span className="react-map-chrome__glyph" aria-hidden="true">◫</span>{" "}
          <span className="react-map-chrome__label">Аналитика</span>
        </button>
      </div>
    </div>
  );
}

export function MapInspectorHeader() {
  useLegacyState();
  const bridge = getLegacyBridge();
  const map = bridge?.getMapChromeSummary();
  useReactOwnedHost("[data-react-map-inspector]", "is-react-owned");

  if (!bridge || !map?.active) return null;

  return (
    <header className="react-map-inspector" id="mortalityMapInspector" data-react-map-inspector-ready>
      <div className="react-map-inspector__copy">
        <span>Аналитический контекст</span>
        <b>{map.selectedLabel || "Легенда и рейтинг территорий"}</b>
      </div>
      <button
        type="button"
        aria-label="Закрыть аналитическую панель"
        title="Закрыть аналитическую панель"
        onClick={() => bridge.setMapPanel("right", false)}
      >×</button>
    </header>
  );
}
