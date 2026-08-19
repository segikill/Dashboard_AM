import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type {
  AtlasPyramidOption,
  AtlasPyramidView,
  LegacyPyramidBinSummary
} from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function usePyramid() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getPyramidSummary(), active: snapshot.view === "pyramid" };
}

function setOption(option: AtlasPyramidOption, value: string) {
  getLegacyBridge()?.setPyramidOption(option, value);
}

function SelectField({
  option,
  label,
  value,
  options
}: {
  option: AtlasPyramidOption;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="react-pyramid-field">
      <span>{label}</span>
      <select data-react-pyramid-option={option} value={value} onChange={(event) => setOption(option, event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

const MODE_ITEMS: Array<[AtlasPyramidView, string, string]> = [
  ["structure", "Структура", "один период"],
  ["trend", "Динамика", "первый → последний год"],
  ["gap", "Различия", "мужчины / женщины"]
];

export function PyramidControls() {
  const { bridge, summary, active } = usePyramid();
  useReactOwnedHost("[data-react-pyramid-controls]", "is-react-pyramid-owned", active);
  if (!bridge || !summary || !active) return null;

  const causeLabel = summary.level === "class"
    ? "Класс МКБ-10"
    : summary.level === "block" ? "Крупный блок" : "Трёхзначный код";
  const allCauses = summary.level === "class" ? "Все причины" : "Все причины выбранного класса";

  return (
    <div className="react-pyramid-controls" data-react-pyramid-controls-ready>
      <div className="react-pyramid-mode">
        <span>Режим анализа</span>
        <div role="group" aria-label="Режим возрастно-полового анализа">
          {MODE_ITEMS.map(([value, label, note]) => (
            <button
              key={value}
              type="button"
              className={summary.view === value ? "is-active" : ""}
              aria-pressed={summary.view === value}
              data-react-pyramid-option="view"
              data-value={value}
              onClick={() => setOption("view", value)}
            >
              <b>{label}</b><small>{value === "trend" ? `${summary.firstYear} → ${summary.lastYear}` : note}</small>
            </button>
          ))}
        </div>
      </div>

      <SelectField
        option="level"
        label="Уровень МКБ-10"
        value={summary.level}
        options={[["class", "Классы"], ["block", "Крупные блоки"], ["code", "Трёхзначные коды"]]}
      />

      {summary.level !== "class" && (
        <SelectField
          option="parentClass"
          label="Класс для детализации"
          value={summary.parentClass}
          options={[["all", "Все классы"], ...summary.classOptions.map((item) => [item.value, item.label] as [string, string])]}
        />
      )}

      <SelectField
        option="cause"
        label={causeLabel}
        value={summary.cause}
        options={[["all", allCauses], ...summary.causeOptions.map((item) => [item.value, item.label] as [string, string])]}
      />

      <SelectField
        option="metric"
        label="Показатель"
        value={summary.metric}
        options={[["n", "Количество смертей"], ["share", "Доля внутри каждого пола"], ["pgpzh", "ПГПЖ-75"]]}
      />

      <div className="react-pyramid-fields-row">
        <SelectField
          option="ageStep"
          label="Возрастные группы"
          value={summary.ageStep}
          options={[["5", "По 5 лет"], ["10", "По 10 лет"]]}
        />
        <SelectField
          option="labels"
          label="Подписи значений"
          value={summary.labels}
          options={[["major", "Ключевые"], ["all", "Все"], ["off", "Скрыть"]]}
        />
      </div>

      <p className="react-pyramid-note">
        <b>Сравнение полов.</b> Фильтры пола и возраста сверху не применяются. {summary.view === "trend"
          ? `Сопоставляются крайние годы набора: ${summary.firstYear} и ${summary.lastYear}.`
          : "Период задаётся верхним фильтром."}
      </p>
    </div>
  );
}

function ratioLabel(item: LegacyPyramidBinSummary) {
  if (item.ratio == null) return item.maleN ? "только мужчины" : "н/д";
  if (!item.ratio) return item.femaleN ? "только женщины" : "н/д";
  return `${decimal.format(item.ratio)} : 1`;
}

function changeText(item: LegacyPyramidBinSummary) {
  if (item.changePercent == null) return "н/д";
  return `${item.changePercent > 0 ? "+" : ""}${decimal.format(item.changePercent)}%`;
}

function changeClass(item: LegacyPyramidBinSummary) {
  if (item.changePercent == null || item.changePercent === 0) return "is-stable";
  return item.changePercent > 0 ? "is-rise" : "is-fall";
}

export function PyramidInspector() {
  const { bridge, summary, active } = usePyramid();
  useReactOwnedHost("[data-react-pyramid-inspector]", "is-react-pyramid-owned", active);
  const selected = summary?.selected;
  if (!bridge || !summary || !selected || !active) return null;

  return (
    <div className="react-pyramid-inspector" data-react-pyramid-inspector-ready>
      <section className="react-pyramid-card react-pyramid-selection">
        <span className="react-pyramid-kicker">Выбранная возрастная группа</span>
        <h4>{selected.ageLabel} лет</h4>
        <p>{summary.causeLabel} · {summary.periodLabel}</p>
        <div className="react-pyramid-primary"><strong>{integer.format(selected.total)}</strong><span>наблюдений в группе</span></div>
        <div className={`react-pyramid-change ${changeClass(selected)}`}>
          <b>{summary.view === "trend" ? changeText(selected) : `${selected.rank} место`}</b>
          <span>{summary.view === "trend" ? `${selected.baselineTotal ?? 0} → ${selected.total}` : `из ${selected.binCount} групп`}</span>
        </div>
      </section>

      <div className="react-pyramid-sex-cards">
        <div className="is-male"><span>Мужчины</span><b>{integer.format(selected.maleN)}</b><small>{decimal.format(selected.maleShare)}% мужского профиля</small></div>
        <div className="is-female"><span>Женщины</span><b>{integer.format(selected.femaleN)}</b><small>{decimal.format(selected.femaleShare)}% женского профиля</small></div>
      </div>

      <div className="react-pyramid-metrics">
        <div><span>Соотношение М / Ж</span><b>{ratioLabel(selected)}</b></div>
        <div><span>Ведущий класс</span><b title={selected.leadingClass}>{selected.leadingClass}</b></div>
        <div><span>ПГПЖ-75 · мужчины</span><b>{integer.format(selected.pgpzhMale)}</b></div>
        <div><span>ПГПЖ-75 · женщины</span><b>{integer.format(selected.pgpzhFemale)}</b></div>
      </div>

      <section className="react-pyramid-card">
        <span className="react-pyramid-kicker">Автоматический вывод</span>
        <p className="react-pyramid-insight">{selected.insight}</p>
      </section>

      <section className="react-pyramid-card">
        <div className="react-pyramid-card-head"><span className="react-pyramid-kicker">Крупнейшие возрастные группы</span><b>пик: {summary.peakLabel}</b></div>
        <div className="react-pyramid-top">
          {summary.topBins.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === selected.key ? "is-selected" : ""}
              data-react-pyramid-key={item.key}
              onClick={() => bridge.selectPyramidItem(item.key)}
            >
              <span><b>{item.ageLabel} лет</b><small>М {integer.format(item.maleN)} · Ж {integer.format(item.femaleN)}</small></span>
              <strong>{integer.format(item.total)}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
