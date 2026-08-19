import { useEffect } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import type { AtlasHeaderAction } from "./types";

const ACTIONS: ReadonlyArray<readonly [Exclude<AtlasHeaderAction, "help">, string, string]> = [
  ["share", "Ссылка", "Скопировать ссылку на текущий срез"],
  ["svg", "SVG", "Скачать текущий график в SVG"],
  ["csv", "CSV", "Скачать сводку по текущему срезу"]
];

export function HeaderStatus() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  const header = bridge?.getHeaderSummary();

  useEffect(() => {
    const host = document.querySelector<HTMLElement>("[data-react-header-status]");
    const legacyStatus = document.querySelector<HTMLElement>("[data-legacy-header-status]");
    const legacyActions = document.querySelector<HTMLElement>("[data-legacy-header-actions]");
    if (!host || !legacyStatus || !legacyActions || !bridge) return;

    host.hidden = false;
    host.dataset.reactStatus = "ready";
    legacyStatus.hidden = true;
    legacyActions.hidden = true;
    return () => {
      host.hidden = true;
      legacyStatus.hidden = false;
      legacyActions.hidden = false;
    };
  }, [bridge]);

  if (!bridge || !header) return null;

  const trigger = (action: AtlasHeaderAction) => bridge.triggerHeaderAction(action);

  return (
    <>
      <div className="app-header-context" aria-label="Состояние данных">
        <span className="app-header-pill">
          Период <b id="reactHeaderPeriod" data-react-header-period>{header.periodLabel}</b>
        </span>
        <span className="app-header-pill">Данные <b>готовы</b></span>
        <span className="app-header-kpi" title="Количество наблюдений после фильтров периода, пола и возраста">
          <b data-react-header-count>{header.filteredRecords.toLocaleString("ru-RU")}</b>
          <span>смертей в фильтре</span>
        </span>
      </div>

      <div className="app-header-actions">
        <div>
          <div className="atlas-actions" aria-label="Действия с текущим срезом">
            {ACTIONS.map(([action, label, title]) => (
              <button
                key={action}
                type="button"
                data-react-header-action={action}
                disabled={action === "svg" && !header.svgAvailable}
                title={action === "svg" && !header.svgAvailable ? "Для этой визуализации SVG недоступен" : title}
                onClick={() => trigger(action)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="atlas-action-status" role="status" aria-live="polite" data-react-action-status>
            {header.actionMessage}
          </p>
        </div>
        <button
          type="button"
          className="app-help-button"
          title="Методика и сведения о данных"
          aria-label="Открыть методику и сведения о данных"
          onClick={() => trigger("help")}
        >
          ?
        </button>
      </div>
    </>
  );
}
