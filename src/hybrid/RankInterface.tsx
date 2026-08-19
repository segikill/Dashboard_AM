import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type {
  AtlasRankCompare,
  AtlasRankLevel,
  AtlasRankMetric,
  AtlasRankOption,
  AtlasRankTop,
  AtlasRankView,
  LegacyRankItemSummary
} from "./types";

const integer = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

function useRank() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  return { bridge, summary: bridge?.getRankSummary(), active: snapshot.view === "arrow" };
}

function setOption(option: AtlasRankOption, value: string | boolean) {
  getLegacyBridge()?.setRankOption(option, value);
}

function SelectField({
  option,
  label,
  value,
  options
}: {
  option: AtlasRankOption;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="react-rank-field">
      <span>{label}</span>
      <select data-react-rank-option={option} value={value} onChange={(event) => setOption(option, event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ModeSwitch({
  option,
  value,
  items,
  label
}: {
  option: "view" | "compare";
  value: string;
  items: Array<[string, string, string]>;
  label: string;
}) {
  return (
    <div className="react-rank-mode">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {items.map(([itemValue, itemLabel, note]) => (
          <button
            key={itemValue}
            type="button"
            className={value === itemValue ? "is-active" : ""}
            aria-pressed={value === itemValue}
            data-react-rank-option={option}
            data-value={itemValue}
            onClick={() => setOption(option, itemValue)}
          >
            <b>{itemLabel}</b><small>{note}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RankControls() {
  const { bridge, summary, active } = useRank();
  useReactOwnedHost("[data-react-rank-controls]", "is-react-rank-owned", active);
  if (!bridge || !summary || !active) return null;

  return (
    <div className="react-rank-controls" data-react-rank-controls-ready>
      <ModeSwitch
        option="view"
        value={summary.view}
        label="Форма сравнения"
        items={[["compare", "Два среза", "прямое сопоставление"], ["trend", "По годам", "траектория 2023–2025"]]}
      />

      {summary.view === "compare" && (
        <ModeSwitch
          option="compare"
          value={summary.compare}
          label="Сравниваемые срезы"
          items={[["time", "2023 → 2025", "изменение во времени"], ["sex", "М → Ж", "мужчины и женщины"]]}
        />
      )}

      <SelectField
        option="level"
        label="Уровень МКБ-10"
        value={summary.level}
        options={[["class", "Классы"], ["block", "Крупные блоки"], ["code", "Трёхзначные коды"]]}
      />

      {summary.level !== "class" && (
        <SelectField
          option="classIndex"
          label="Класс для детализации"
          value={summary.classIndex}
          options={[["all", "Все классы"], ...summary.classOptions.map((item) => [item.value, item.label] as [string, string])]}
        />
      )}

      <div className="react-rank-fields-row">
        <SelectField
          option="metric"
          label="Показатель"
          value={summary.metric}
          options={[["n", "Количество смертей"], ["share", "Доля внутри среза"], ["pgpzh", "ПГПЖ-75"]]}
        />
        <SelectField
          option="top"
          label="Число позиций"
          value={summary.top}
          options={[["10", "Топ-10"], ["15", "Топ-15"], ["20", "Топ-20"]]}
        />
      </div>

      <label className="react-rank-check">
        <input
          type="checkbox"
          data-react-rank-option="onlyChanges"
          checked={summary.onlyChanges}
          onChange={(event) => setOption("onlyChanges", event.target.checked)}
        />
        <span><b>Только изменившие позицию</b><small>Скрыть причины с неизменным рангом</small></span>
      </label>

      <p className="react-rank-note">
        {summary.view === "trend"
          ? "Глобальный фильтр года в режиме траектории не применяется: сравниваются все три года."
          : summary.compare === "sex"
            ? "Пол сравнивается внутри выбранного периода; глобальный фильтр пола временно не применяется."
            : "Причина включается, если попала в выбранный топ хотя бы одного сравниваемого года."}
      </p>
    </div>
  );
}

function movementLabel(item: LegacyRankItemSummary) {
  if (item.rankDelta > 0) return `Подъём на ${item.rankDelta}`;
  if (item.rankDelta < 0) return `Снижение на ${Math.abs(item.rankDelta)}`;
  return "Без изменения";
}

function movementClass(item: LegacyRankItemSummary) {
  return item.rankDelta > 0 ? "is-rise" : item.rankDelta < 0 ? "is-fall" : "is-stable";
}

export function RankInspector() {
  const { bridge, summary, active } = useRank();
  useReactOwnedHost("[data-react-rank-inspector]", "is-react-rank-owned", active);
  const selected = summary?.selected;
  if (!bridge || !summary || !selected || !active) return null;

  return (
    <div className="react-rank-inspector" data-react-rank-inspector-ready>
      <section className="react-rank-card react-rank-selection">
        <span className="react-rank-kicker">Выбранная причина</span>
        <div className="react-rank-title"><i style={{ background: selected.color }} /><h4>{selected.code} · {selected.label}</h4></div>
        <p>{selected.subtitle}</p>
        <div className="react-rank-primary"><strong>{selected.primaryValue}</strong><span>{selected.primaryLabel}</span></div>
        <div className={`react-rank-change ${movementClass(selected)}`}>
          <b>{movementLabel(selected)}</b><span>{selected.rankBefore} → {selected.rankAfter} место</span>
        </div>
      </section>

      <div className="react-rank-metrics">
        <div><span>Первый срез</span><b>{selected.valueBeforeText}</b></div>
        <div><span>Последний срез</span><b>{selected.valueAfterText}</b></div>
        <div><span>Изменение значения</span><b>{selected.changeValue}</b></div>
        <div><span>Изменение доли</span><b>{selected.shareDelta > 0 ? "+" : ""}{decimal.format(selected.shareDelta)} п.п.</b></div>
        <div><span>Медианный возраст</span><b>{selected.medianAge == null ? "н/д" : `${decimal.format(selected.medianAge)} года`}</b></div>
        <div><span>ПГПЖ-75</span><b>{integer.format(selected.pgpzh75)}</b></div>
      </div>

      <section className="react-rank-card">
        <span className="react-rank-kicker">Автоматический вывод</span>
        <p className="react-rank-insight">{selected.insight}</p>
      </section>

      <section className="react-rank-card">
        <div className="react-rank-card-head"><div><span className="react-rank-kicker">Крупнейшие перемещения</span><b>{summary.itemCount} причин в поле</b></div></div>
        <div className="react-rank-movers">
          {summary.movers.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === selected.key ? "is-selected" : ""}
              onClick={() => bridge.selectRankItem(item.key)}
            >
              <i style={{ background: item.color }} /><span><b>{item.code}</b><small>{item.label}</small></span><strong className={movementClass(item)}>{item.rankDelta > 0 ? "+" : ""}{item.rankDelta}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
