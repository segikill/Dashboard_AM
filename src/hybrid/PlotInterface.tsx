import { useEffect } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type { AtlasPlotOption, AtlasPlotView, LegacyPlotContextSummary } from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function usePlot() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getPlotSummary(), active: snapshot.view === "plot" };
}

function setOption(option: AtlasPlotOption, value: string) {
  getLegacyBridge()?.setPlotOption(option, value);
}

function SelectField({ option, label, value, options }: {
  option: AtlasPlotOption;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="react-plot-field">
      <span>{label}</span>
      <select data-react-plot-option={option} value={value} onChange={(event) => setOption(option, event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function ChoiceGroup({ option, label, value, items }: {
  option: AtlasPlotOption;
  label: string;
  value: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="react-plot-choice">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {items.map(([itemValue, itemLabel]) => (
          <button
            key={itemValue}
            type="button"
            className={value === itemValue ? "is-active" : ""}
            aria-pressed={value === itemValue}
            data-react-plot-option={option}
            data-value={itemValue}
            onClick={() => setOption(option, itemValue)}
          >{itemLabel}</button>
        ))}
      </div>
    </div>
  );
}

const MODES: Array<[AtlasPlotView, string, string]> = [
  ["profile", "Профиль", "медиана и интервалы"],
  ["compare", "Сравнение", "два года или два пола"],
  ["distribution", "Одна причина", "форма распределения"]
];

export function PlotControls() {
  const { bridge, summary, active } = usePlot();
  useReactOwnedHost("[data-react-plot-controls]", "is-react-plot-owned", active);

  useEffect(() => {
    document.body.classList.toggle("plot-react-owned", Boolean(active && bridge && summary));
    return () => document.body.classList.remove("plot-react-owned");
  }, [active, bridge, summary]);

  if (!bridge || !summary || !active) return null;
  const isComparison = summary.view === "compare";
  const isDistribution = summary.view === "distribution";
  const sortOptions: Array<[string, string]> = isComparison
    ? [["shift", "По величине изменения"], ["n", "По числу наблюдений"], ["medianAsc", "Медиана: раньше → позже"], ["medianDesc", "Медиана: позже → раньше"], ["spread", "По ширине Q1–Q3"]]
    : [["n", "По числу наблюдений"], ["medianAsc", "Медиана: раньше → позже"], ["medianDesc", "Медиана: позже → раньше"], ["spread", "По ширине Q1–Q3"]];

  return (
    <div className="react-plot-controls" data-react-plot-controls-ready>
      <div className="react-plot-mode">
        <span>Режим анализа</span>
        <div role="group" aria-label="Режим анализа возраста смерти">
          {MODES.map(([mode, label, note]) => (
            <button
              key={mode}
              type="button"
              className={summary.view === mode ? "is-active" : ""}
              aria-pressed={summary.view === mode}
              data-react-plot-option="view"
              data-value={mode}
              onClick={() => setOption("view", mode)}
            ><b>{label}</b><small>{note}</small></button>
          ))}
        </div>
      </div>

      <ChoiceGroup option="level" label="Уровень МКБ-10" value={summary.level} items={[["class", "Классы"], ["block", "Блоки"], ["code", "Коды"]]} />

      {summary.level !== "class" && (
        <SelectField
          option="classIndex"
          label="Класс для детализации"
          value={summary.classIndex}
          options={[["all", "Все классы"], ...summary.classOptions.map((item) => [item.value, item.label] as [string, string])]}
        />
      )}

      {isDistribution && (
        <SelectField
          option="cause"
          label="Причина для распределения"
          value={summary.cause}
          options={[["all", "Выберите причину"], ...summary.causeOptions.map((item) => [item.value, item.label] as [string, string])]}
        />
      )}

      <ChoiceGroup option="minN" label="Минимум наблюдений" value={summary.minN} items={[["5", "n ≥ 5"], ["10", "n ≥ 10"], ["20", "n ≥ 20"], ["50", "n ≥ 50"]]} />

      {!isDistribution && <ChoiceGroup option="top" label="Количество строк" value={summary.top} items={[["15", "Топ-15"], ["25", "Топ-25"]]} />}

      {isComparison && (
        <>
          <SelectField option="compare" label="Сравнивать" value={summary.compare} options={[["time", "Два года"], ["sex", "Мужчины → женщины"]]} />
          {summary.compare === "time" && (
            <div className="react-plot-fields-row">
              <SelectField option="yearA" label="Первый год" value={summary.yearA} options={summary.years.map((year) => [String(year), String(year)])} />
              <SelectField option="yearB" label="Второй год" value={summary.yearB} options={summary.years.map((year) => [String(year), String(year)])} />
            </div>
          )}
        </>
      )}

      {!isDistribution ? (
        <>
          <SelectField option="interval" label="Внешний интервал" value={summary.interval} options={[["p10p90", "P10–P90 · рекомендуется"], ["range", "Полный min–max"]]} />
          <SelectField option="sort" label="Сортировка" value={summary.sort} options={sortOptions} />
        </>
      ) : (
        <SelectField option="distributionMetric" label="Шкала гистограммы" value={summary.distributionMetric} options={[["n", "Количество наблюдений"], ["share", "Доля внутри причины, %"]]} />
      )}

      <p className="react-plot-note">
        {summary.view === "profile" && <><b>Профиль.</b> Один клик показывает аналитику справа, двойной открывает распределение.</>}
        {summary.view === "compare" && <><b>Независимые срезы.</b> Верхний фильтр {summary.compare === "time" ? "периода" : "пола"} временно не применяется.</>}
        {summary.view === "distribution" && <><b>Одна причина.</b> Плотность показывает форму распределения, столбцы — пятилетние группы.</>}
      </p>
    </div>
  );
}

function ContextCard({ context }: { context: LegacyPlotContextSummary }) {
  const changeClass = context.changeValue.startsWith("+") ? "is-later" : context.changeValue.startsWith("−") || context.changeValue.startsWith("-") ? "is-earlier" : "";
  return (
    <>
      <section className="react-plot-card react-plot-selection">
        <span className="react-plot-kicker">{context.key ? "Выбранная причина" : "Текущий аналитический срез"}</span>
        <h4>{context.title}</h4>
        <p>{context.subtitle}</p>
        <div className="react-plot-primary"><strong>{context.primaryValue}</strong><span>{context.primaryLabel}</span></div>
        {context.changeValue && <div className={`react-plot-change ${changeClass}`}><span>Изменение</span><b>{context.changeValue}</b></div>}
      </section>
      {context.metrics.length > 0 && <div className="react-plot-metrics">{context.metrics.map((item) => <div key={`${item.label}:${item.value}`}><span>{item.label}</span><b title={item.value}>{item.value}</b></div>)}</div>}
      {context.insight && <section className="react-plot-card"><span className="react-plot-kicker">Автоматический вывод</span><p className="react-plot-insight">{context.insight}</p></section>}
      {context.details.length > 0 && <section className="react-plot-card"><span className="react-plot-kicker">Детали</span><dl className="react-plot-details">{context.details.map((item) => <div key={`${item.label}:${item.value}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>}
    </>
  );
}

export function PlotInspector() {
  const { bridge, summary, active } = usePlot();
  useReactOwnedHost("[data-react-plot-inspector]", "is-react-plot-owned", active);
  if (!bridge || !summary || !summary.context || !active) return null;

  return (
    <div className="react-plot-inspector" data-react-plot-inspector-ready>
      <ContextCard context={summary.context} />

      {summary.topItems.length > 0 && summary.view !== "distribution" && (
        <section className="react-plot-card">
          <div className="react-plot-card-head"><span className="react-plot-kicker">Ведущие строки</span><b>{summary.itemCount} всего</b></div>
          <div className="react-plot-top">
            {summary.topItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={item.key === summary.selectedKey ? "is-selected" : ""}
                data-react-plot-key={item.key}
                onClick={() => bridge.selectPlotItem(item.key)}
              >
                <i style={{ background: item.color }} />
                <span><b>{item.code}</b><small title={item.label}>{item.label}</small></span>
                <strong>{summary.view === "compare" && item.deltaMedian != null ? `${item.deltaMedian > 0 ? "+" : ""}${decimal.format(item.deltaMedian)} г.` : `${decimal.format(item.median)} г.`}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {summary.context.key && summary.view !== "distribution" && (
        <button type="button" className="react-plot-action" data-react-plot-action="distribution" onClick={() => bridge.triggerPlotAction("distribution")}>Открыть полное распределение</button>
      )}
    </div>
  );
}

