import { useEffect } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import type { AtlasAge, AtlasSex, LegacyStateSnapshot } from "./types";

const AGE_OPTIONS: ReadonlyArray<readonly [AtlasAge, string]> = [
  ["all", "Все возрасты"],
  ["0_14", "0–14"],
  ["15_44", "15–44"],
  ["45_64", "45–64"],
  ["65_79", "65–79"],
  ["80P", "80+"]
];

const SEX_OPTIONS: ReadonlyArray<readonly [AtlasSex, string]> = [
  ["all", "Все"],
  ["1", "М"],
  ["2", "Ж"]
];

function updateGlobalFilters(filters: Partial<Pick<LegacyStateSnapshot, "year" | "sex" | "age">>) {
  getLegacyBridge()?.setGlobalFilters(filters);
}

export function GlobalFilters() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  const summary = bridge?.getDataSummary();
  const pyramid = bridge?.getPyramidSummary();
  const plot = bridge?.getPlotSummary();
  const pyramidActive = snapshot.view === "pyramid";
  const pyramidTrend = pyramidActive && pyramid?.view === "trend";
  const plotComparison = snapshot.view === "plot" && plot?.view === "compare";
  const plotTimeComparison = plotComparison && plot?.compare === "time";
  const plotSexComparison = plotComparison && plot?.compare === "sex";

  useEffect(() => {
    const host = document.querySelector<HTMLElement>("[data-react-global-filters]");
    const legacy = document.querySelector<HTMLElement>("[data-legacy-global-filters]");
    if (!host || !legacy || !bridge) return;

    host.hidden = false;
    host.dataset.reactStatus = "ready";
    legacy.hidden = true;
    return () => {
      host.hidden = true;
      legacy.hidden = false;
    };
  }, [bridge]);

  if (!bridge || !summary) return null;

  return (
    <div className="filters" aria-label="Общие фильтры React">
      <div className="field">
        <label htmlFor="reactYearSelect">Период</label>
        <select
          id="reactYearSelect"
          data-react-year-filter
          value={snapshot.year}
          disabled={pyramidTrend || plotTimeComparison}
          onChange={(event) => updateGlobalFilters({ year: event.target.value })}
        >
          <option value="all">{summary.period}</option>
          {summary.years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>

      <div className="field">
        <label id="reactSexLabel">Пол</label>
        <div className="seg" role="group" aria-labelledby="reactSexLabel" data-react-sex-filter>
          {SEX_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={snapshot.sex === value ? "active" : ""}
              aria-pressed={snapshot.sex === value}
              data-value={value}
              disabled={pyramidActive || plotSexComparison}
              onClick={() => updateGlobalFilters({ sex: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="reactAgeSelect">Возраст</label>
        <select
          id="reactAgeSelect"
          data-react-age-filter
          value={snapshot.age}
          disabled={pyramidActive}
          onChange={(event) => updateGlobalFilters({ age: event.target.value as AtlasAge })}
        >
          {AGE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <button
        type="button"
        className="app-filter-reset"
        data-react-filter-reset
        onClick={() => updateGlobalFilters({ year: "all", sex: "all", age: "all" })}
      >
        Сбросить
      </button>
    </div>
  );
}
