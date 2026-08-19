import type { CSSProperties, ChangeEvent } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type {
  AtlasTreemapColor,
  AtlasTreemapLevel,
  AtlasTreemapMetric,
  AtlasTreemapSort,
  LegacyTreemapItemSummary
} from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function useTreemap() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getTreemapSummary(), active: snapshot.view === "treemap" };
}

function OptionField({
  label,
  option,
  value,
  options,
  onChange
}: {
  label: string;
  option: "metric" | "color" | "sort";
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="react-tree-field">
      <span>{label}</span>
      <select data-react-treemap-option={option} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function TreemapControls() {
  const { bridge, summary, active } = useTreemap();
  useReactOwnedHost("[data-react-treemap-controls]", "is-react-treemap-owned", active);

  if (!bridge || !summary || !active) return null;

  const setSelect = (option: "metric" | "color" | "sort") => (value: string) => {
    bridge.setTreemapOption(option, value);
  };
  const levels: Array<[AtlasTreemapLevel, string, string]> = [
    ["root", "1", "Классы"],
    ["class", "2", "Блоки"],
    ["block", "3", "Коды"]
  ];

  return (
    <div className="react-tree-controls" data-react-treemap-controls-ready>
      <div className="react-tree-levels" role="group" aria-label="Уровень иерархии МКБ-10">
        {levels.map(([level, number, label]) => (
          <button
            key={level}
            type="button"
            className={summary.level === level ? "active" : ""}
            aria-pressed={summary.level === level}
            onClick={() => bridge.setTreemapLevel(level)}
          >
            <b>{number}</b><span>{label}</span>
          </button>
        ))}
      </div>
      <p className="react-tree-context">Текущий контекст: <b>{summary.contextLabel}</b></p>

      <OptionField
        label="Размер плитки"
        option="metric"
        value={summary.metric}
        options={[
          ["n", "Количество смертей"],
          ["share", "Доля выборки"],
          ["pgpzh", "ПГПЖ-75"],
          ["rate", "На 100 тыс. · в среднем за год"]
        ]}
        onChange={setSelect("metric")}
      />
      <OptionField
        label="Цвет плитки"
        option="color"
        value={summary.color}
        options={[
          ["count", "Объём наблюдений"],
          ["change", "Изменение между периодами"],
          ["age", "Медианный возраст"]
        ]}
        onChange={setSelect("color")}
      />
      <OptionField
        label="Порядок категорий"
        option="sort"
        value={summary.sort}
        options={[
          ["value", "По убыванию значения"],
          ["name", "По коду и названию"],
          ["change", "По изменению"]
        ]}
        onChange={setSelect("sort")}
      />

      <label className="react-tree-check">
        <input
          type="checkbox"
          data-react-treemap-option="showValues"
          checked={summary.showValues}
          onChange={(event) => bridge.setTreemapOption("showValues", event.target.checked)}
        />
        <span>Показывать значения на плитках</span>
      </label>

      <label className="react-tree-range">
        <span><b>Объединять малые категории</b><output>{decimal.format(summary.minShare)}%</output></span>
        <input
          type="range"
          data-react-treemap-option="minShare"
          min="0"
          max="3"
          step="0.1"
          value={summary.minShare}
          onChange={(event: ChangeEvent<HTMLInputElement>) => bridge.setTreemapOption("minShare", Number(event.target.value))}
        />
        <small>Категории меньше порога объединяются в «Прочие» и не теряются.</small>
      </label>

      <button className="react-tree-reset" type="button" onClick={() => bridge.triggerTreemapAction("reset")}>
        Сбросить настройки Treemap
      </button>
    </div>
  );
}

export function TreemapBreadcrumbs() {
  const { bridge, summary, active } = useTreemap();
  useReactOwnedHost("[data-react-treemap-breadcrumbs]", "is-react-owned", active);
  if (!bridge || !summary || !active) return null;

  return (
    <div className="react-tree-path" data-react-treemap-breadcrumbs-ready>
      <nav aria-label="Путь по иерархии МКБ-10">
        {summary.breadcrumbs.map((crumb, index) => (
          <span key={crumb.level}>
            {index > 0 && <i aria-hidden="true">›</i>}
            <button
              type="button"
              className={crumb.current ? "current" : ""}
              aria-current={crumb.current ? "page" : undefined}
              onClick={() => bridge.setTreemapLevel(crumb.level)}
            >{crumb.label}</button>
          </span>
        ))}
      </nav>
      <small>Первый клик — сведения · повторный — открыть</small>
    </div>
  );
}

function Sparkline({ item }: { item: LegacyTreemapItemSummary }) {
  const width = 116;
  const height = 34;
  const padding = 3;
  const maximum = Math.max(...item.series, 1);
  const points = item.series.map((value, index) => {
    const x = padding + index * (width - padding * 2) / Math.max(item.series.length - 1, 1);
    const y = height - padding - value / maximum * (height - padding * 2);
    return [x, y] as const;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика количества смертей по годам">
      <path d={`M${padding},${height - padding}H${width - padding}`} fill="none" stroke="#dce4ef" />
      <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" stroke={item.color} strokeWidth="2" />
      {points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="2.2" fill="#fff" stroke={item.color} strokeWidth="1.5" />)}
    </svg>
  );
}

function ColorLegend({ item, mode }: { item: LegacyTreemapItemSummary; mode: AtlasTreemapColor }) {
  const labels = mode === "age"
    ? ["младше", "медианный возраст", "старше"]
    : mode === "change"
      ? ["снижение", "изменение", "рост"]
      : ["меньше", "объём наблюдений", "больше"];
  return (
    <section className="react-tree-inspector-section">
      <h4>Как читать цвет</h4>
      <div className={`react-tree-color-scale react-tree-color-scale--${mode}`} style={{ "--tree-color": item.color } as CSSProperties}>
        {[0, 1, 2, 3, 4].map((value) => <span key={value} />)}
      </div>
      <div className="react-tree-legend-copy"><span>{labels[0]}</span><span>{labels[1]}</span><span>{labels[2]}</span></div>
    </section>
  );
}

export function TreemapInspector() {
  const { bridge, summary, active } = useTreemap();
  useReactOwnedHost("[data-react-treemap-inspector]", "is-react-owned", active);
  const selected = summary?.selected;
  if (!bridge || !summary || !selected || !active) return null;

  const change = selected.change == null ? "н/д" : `${selected.change > 0 ? "+" : ""}${decimal.format(selected.change)}%`;

  return (
    <div className="react-tree-inspector" data-react-treemap-inspector-ready>
      <section className="react-tree-inspector-section">
        <span className="react-tree-kicker">Выбранная категория</span>
        <div className="react-tree-selection">
          <span style={{ background: selected.color }} />
          <div><h3>{selected.code}</h3><p>{selected.label}</p></div>
        </div>
        <div className="react-tree-primary"><strong>{selected.metricValue}</strong><span>{selected.metricUnit}</span></div>
        <div className="react-tree-metrics">
          <div><span>Абсолютное число</span><b>{integer.format(selected.deaths)}</b></div>
          <div><span>Доля выборки</span><b>{decimal.format(selected.share)}%</b></div>
          <div><span>На 100 тыс. в год</span><b>{selected.rate == null ? "н/д" : decimal.format(selected.rate)}</b></div>
          <div><span>Медианный возраст</span><b>{selected.medianAge == null ? "н/д" : `${decimal.format(selected.medianAge)} года`}</b></div>
          <div><span>ПГПЖ-75</span><b>{integer.format(selected.pgpzh75)}</b></div>
          <div><span>Изменение</span><b>{change}</b></div>
        </div>
        <div className="react-tree-sparkline"><Sparkline item={selected} /><small>2023 → 2025<br />{selected.series.map(integer.format).join(" · ")}</small></div>
        {selected.drillLabel && (
          <button className="react-tree-drill" type="button" onClick={() => bridge.triggerTreemapAction("drill")}>
            {selected.drillLabel} →
          </button>
        )}
      </section>

      <ColorLegend item={selected} mode={summary.color} />

      <section className="react-tree-inspector-section">
        <h4>{selected.entityType === "code" ? "Другие коды текущего блока" : selected.entityType === "other" ? "Состав группы «Прочие»" : "Крупнейшие дочерние категории"}</h4>
        <div className="react-tree-ranks">
          {summary.children.length ? summary.children.map((child, index) => (
            <button key={child.key} type="button" onClick={() => bridge.selectTreemapChild(child.key)}>
              <span>{index + 1}</span><span><b>{child.code}</b><small>{child.label}</small></span><strong>{integer.format(child.deaths)}</strong>
            </button>
          )) : <p>Нет дочерних категорий для текущего фильтра.</p>}
        </div>
      </section>
    </div>
  );
}

export type { AtlasTreemapMetric, AtlasTreemapSort };
