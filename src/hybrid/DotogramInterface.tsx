import { useEffect } from "react";
import { useReactOwnedHost } from "./MapChrome";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import type { AtlasDotogramOption } from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function useDotogram() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getDotogramSummary(), active: snapshot.view === "dotogram" };
}

function setOption(option: AtlasDotogramOption, value: string) {
  getLegacyBridge()?.setDotogramOption(option, value);
}

function SelectField({ option, label, value, options }: {
  option: AtlasDotogramOption;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="react-dotogram-field">
      <span>{label}</span>
      <select data-react-dotogram-option={option} value={value} onChange={(event) => setOption(option, event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

export function DotogramControls() {
  const { bridge, summary, active } = useDotogram();
  useReactOwnedHost("[data-react-dotogram-controls]", "is-react-dotogram-owned", active);

  useEffect(() => {
    document.body.classList.toggle("dotogram-react-owned", Boolean(active && bridge && summary));
    return () => document.body.classList.remove("dotogram-react-owned");
  }, [active, bridge, summary]);

  if (!bridge || !summary || !active) return null;
  const isRate = ["per1k", "per10k", "per100k"].includes(summary.metric);

  return (
    <div className="react-dotogram-controls" data-react-dotogram-controls-ready>
      <div className="react-dotogram-choice">
        <span>Уровень территории</span>
        <div role="group" aria-label="Уровень территории Dotogram">
          {([["settlement", "Населённые пункты"], ["mo", "Муниципалитеты"]] as Array<[string, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={summary.unit === value ? "is-active" : ""}
              aria-pressed={summary.unit === value}
              data-react-dotogram-option="unit"
              data-value={value}
              onClick={() => setOption("unit", value)}
            >{label}</button>
          ))}
        </div>
      </div>

      <SelectField
        option="classIndex"
        label="Класс МКБ-10"
        value={summary.classIndex}
        options={[["all", "Все классы"], ...summary.classOptions.map((item) => [item.value, item.label] as [string, string])]}
      />
      <SelectField
        option="metric"
        label="Положение точки"
        value={summary.metric}
        options={[
          ["n", "Количество смертей"],
          ["share", "Доля выбранного класса"],
          ["median", "Медианный возраст"],
          ["pgpzh", "ПГПЖ-75"],
          ["per1k", "На 1 000 населения · в среднем за год"],
          ["per10k", "На 10 000 населения · в среднем за год"],
          ["per100k", "На 100 000 населения · в среднем за год"]
        ]}
      />
      {summary.unit === "settlement" && (
        <SelectField
          option="labels"
          label="Подписи точек"
          value={summary.labels}
          options={[["outliers", "Статистические выбросы"], ["top", "Топ-10 значений"], ["off", "Без подписей"]]}
        />
      )}

      <p className="react-dotogram-note"><b>{summary.unit === "mo" ? "Ранжированный профиль." : "Территориальные строки."}</b> {summary.unit === "mo" ? "Муниципалитеты отсортированы по значению показателя." : "НП сгруппированы по муниципальным территориям; вертикальный сдвиг служит только для разведения точек."}</p>
      {isRate && <p className="react-dotogram-note is-warning"><b>Знаменатель.</b> Используется население переписи 2021 года. При фильтре пола или возраста знаменатель остаётся общей численностью территории.</p>}
    </div>
  );
}

export function DotogramInspector() {
  const { bridge, summary, active } = useDotogram();
  useReactOwnedHost("[data-react-dotogram-inspector]", "is-react-dotogram-owned", active);
  if (!bridge || !summary || !summary.selected || !active) return null;
  const item = summary.selected;
  const subtitle = summary.unit === "settlement"
    ? `${item.territoryType} · ${item.municipality || "муниципалитет не указан"}`
    : item.territoryType;

  return (
    <div className="react-dotogram-inspector" data-react-dotogram-inspector-ready>
      <section className="react-dotogram-card react-dotogram-selection">
        <span className="react-dotogram-kicker">Выбранная территория</span>
        <h4>{item.name}</h4>
        <p>{subtitle}</p>
        <div className="react-dotogram-primary"><strong>{item.valueText}</strong><span>{summary.metricLabel}</span></div>
      </section>

      <div className="react-dotogram-metrics">
        <div><span>Место в текущем списке</span><b>{item.rank} из {summary.itemCount}</b></div>
        <div><span>Медиана территорий</span><b>{summary.medianText}</b></div>
        <div><span>Всего смертей</span><b>{integer.format(item.totalDeaths)}</b></div>
        <div><span>Выбранная причина</span><b>{integer.format(item.selectedDeaths)}</b></div>
        <div><span>Доля внутри территории</span><b>{decimal.format(item.share)}%</b></div>
        <div><span>Население 2021</span><b>{item.population ? integer.format(item.population) : "н/д"}</b></div>
      </div>

      <section className="react-dotogram-card">
        <span className="react-dotogram-kicker">Автоматический вывод</span>
        <p className="react-dotogram-insight">{item.insight}</p>
      </section>

      <section className="react-dotogram-card">
        <span className="react-dotogram-kicker">Наибольшие значения</span>
        <div className="react-dotogram-list">
          {summary.topItems.slice(0, 8).map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={entry.key === summary.selectedKey ? "is-selected" : ""}
              data-react-dotogram-key={entry.key}
              onClick={() => bridge.selectDotogramItem(entry.key)}
            >
              <i style={{ background: entry.color }} />
              <span><b title={entry.name}>{entry.name}</b><small>{entry.municipality || entry.territoryType}</small></span>
              <strong>{entry.valueText}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
