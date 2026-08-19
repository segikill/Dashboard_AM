import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type { AtlasHeatmapLimit, AtlasHeatmapMetric, AtlasHeatmapUnit, LegacyHeatmapSummary } from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function useHeatmap() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getHeatmapSummary(), active: snapshot.view === "heatmap" };
}

function SelectField({
  option,
  label,
  value,
  options,
  onChange
}: {
  option: "unit" | "metric" | "limit";
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="react-heatmap-field">
      <span>{label}</span>
      <select data-react-heatmap-option={option} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function HeatmapControls() {
  const { bridge, summary, active } = useHeatmap();
  useReactOwnedHost("[data-react-heatmap-controls]", "is-react-heatmap-owned", active);
  if (!bridge || !summary || !active) return null;

  return (
    <div className="react-heatmap-controls" data-react-heatmap-controls-ready>
      <SelectField
        option="unit"
        label="Строки матрицы"
        value={summary.unit}
        options={[["mo", "Города и районы"], ["settlement", "Населённые пункты"]]}
        onChange={(value) => bridge.setHeatmapOption("unit", value as AtlasHeatmapUnit)}
      />
      <SelectField
        option="metric"
        label="Показатель в ячейке"
        value={summary.metric}
        options={[
          ["share", "Доля класса в территории"],
          ["n", "Количество смертей"],
          ["per1k", "На 1 000 населения · в среднем за год"],
          ["per10k", "На 10 000 населения · в среднем за год"],
          ["per100k", "На 100 000 населения · в среднем за год"]
        ]}
        onChange={(value) => bridge.setHeatmapOption("metric", value as AtlasHeatmapMetric)}
      />
      {summary.unit === "settlement" ? (
        <SelectField
          option="limit"
          label="Число населённых пунктов"
          value={summary.limit}
          options={[["25", "Топ-25"], ["50", "Топ-50"], ["all", "Все"]]}
          onChange={(value) => bridge.setHeatmapOption("limit", value as AtlasHeatmapLimit)}
        />
      ) : (
        <p className="react-heatmap-note">
          Города, посёлок городского типа и районы показываются полностью и всегда в одинаковом порядке.
        </p>
      )}
      <p className="react-heatmap-note">
        Выберите ячейку: справа останутся её значение, ранг территории и место причины в структуре смертности.
      </p>
    </div>
  );
}

function conclusion(summary: LegacyHeatmapSummary) {
  const selected = summary.selected;
  if (!selected) return "Выберите ячейку матрицы для аналитического вывода.";
  const territoryPosition = selected.territoryRank > 0
    ? `${selected.territoryRank}-е место из ${selected.territoryCount} территорий`
    : "нет сопоставимого ранга";
  const causePosition = selected.causeRank > 0
    ? `${selected.causeRank}-е место среди ${selected.causeCount} классов`
    : "нет места в структуре причин";
  return `${selected.classCode} занимает ${causePosition} внутри территории. По выбранному показателю территория занимает ${territoryPosition}.`;
}

export function HeatmapInspector() {
  const { bridge, summary, active } = useHeatmap();
  useReactOwnedHost("[data-react-heatmap-inspector]", "is-react-owned", active);
  const selected = summary?.selected;
  if (!bridge || !summary || !selected || !active) return null;

  return (
    <div className="react-heatmap-inspector" data-react-heatmap-inspector-ready>
      <section className="react-heatmap-card">
        <span className="react-heatmap-kicker">Выбранная ячейка</span>
        <h3>{selected.territory}</h3>
        <p><b style={{ color: selected.classColor }}>{selected.classCode}</b> {selected.className}</p>
        <div className="react-heatmap-primary"><strong>{selected.metricText}</strong><span>{selected.metricLabel}</span></div>
        <div className="react-heatmap-metrics">
          <div><span>Смертей</span><b>{integer.format(selected.deaths)}</b></div>
          <div><span>Доля класса</span><b>{decimal.format(selected.share)}%</b></div>
          <div><span>Население 2021</span><b>{selected.population == null ? "н/д" : integer.format(selected.population)}</b></div>
          <div><span>Всего смертей</span><b>{integer.format(selected.totalDeaths)}</b></div>
          <div><span>Место по причине</span><b>{selected.territoryRank || "—"} из {selected.territoryCount}</b></div>
          <div><span>Место в территории</span><b>{selected.causeRank || "—"} из {selected.causeCount}</b></div>
        </div>
        {selected.formula && <p className="react-heatmap-note">Расчёт: {selected.formula}</p>}
      </section>

      <section className="react-heatmap-card">
        <h4>Автоматический вывод</h4>
        <p className="react-heatmap-conclusion">{conclusion(summary)}</p>
      </section>

      <section className="react-heatmap-card">
        <h4>Интенсивность цвета</h4>
        <div className="react-heatmap-scale">{[0, 1, 2, 3, 4].map((step) => <span key={step} />)}</div>
        <div className="react-heatmap-scale-copy"><span>меньше</span><span>{selected.metricLabel}</span><span>больше</span></div>
      </section>

      <section className="react-heatmap-card">
        <h4>Топ территорий по выбранной причине</h4>
        <div className="react-heatmap-ranking">
          {summary.topTerritories.map((territory, index) => (
            <button key={territory.key} type="button" onClick={() => bridge.selectHeatmapCell(territory.key)}>
              <span>{index + 1}</span><b>{territory.territory}</b><strong>{territory.metricText}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
