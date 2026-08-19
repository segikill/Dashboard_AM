import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";

export function InfrastructureChrome() {
  useLegacyState();
  const bridge = getLegacyBridge();
  const infrastructure = bridge?.getInfrastructureChromeSummary();
  useReactOwnedHost("[data-react-infra-chrome]", "is-react-owned");

  if (!bridge || !infrastructure?.active) return null;

  return (
    <div className="react-infra-map-chrome" data-react-infra-chrome-ready>
      <div className="react-infra-map-chrome__title">
        <b>Карта медицинской инфраструктуры</b>
        <span>Web Mercator · EPSG:3857</span>
      </div>
      <div className="react-infra-map-chrome__actions">
        <button
          type="button"
          aria-controls="infrastructureLayerComposer"
          aria-pressed={infrastructure.panelOpen}
          onClick={() => bridge.setInfrastructurePanel(!infrastructure.panelOpen)}
        >
          <span className="react-infra-map-chrome__glyph" aria-hidden="true">☷</span>
          <span className="react-infra-map-chrome__label">Слои</span>
        </button>
        <button type="button" onClick={() => bridge.triggerInfrastructureAction("fit")}>Вся область</button>
      </div>
    </div>
  );
}

export function InfrastructurePanelHeader() {
  useLegacyState();
  const bridge = getLegacyBridge();
  const infrastructure = bridge?.getInfrastructureChromeSummary();
  useReactOwnedHost("[data-react-infra-panel]", "is-react-owned");

  if (!bridge || !infrastructure?.active) return null;

  return (
    <div className="react-infra-panel-header" id="infrastructureLayerComposer" data-react-infra-panel-ready>
      <div>
        <span>Состав карты · {infrastructure.facilities.toLocaleString("ru-RU")} объектов</span>
        <h3>Инфраструктура и доступность больниц</h3>
      </div>
      <button
        type="button"
        aria-label="Свернуть панель слоёв"
        title="Свернуть панель слоёв"
        onClick={() => bridge.setInfrastructurePanel(false)}
      >‹</button>
    </div>
  );
}
