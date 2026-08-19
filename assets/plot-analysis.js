(() => {
  "use strict";

  if (typeof state === "undefined" || typeof DATA === "undefined" || typeof renderPlot !== "function") return;

  if (state.plotView === undefined) state.plotView = "profile";
  if (state.plotLevel === undefined) state.plotLevel = "class";
  if (state.plotClass === undefined) state.plotClass = "all";
  if (state.plotCause === undefined) state.plotCause = "all";
  if (state.plotInterval === undefined) state.plotInterval = "p10p90";
  if (state.plotSort === undefined) state.plotSort = "n";
  if (state.plotMinN === undefined) state.plotMinN = "10";
  if (state.plotTop === undefined) state.plotTop = "15";
  if (state.plotCompare === undefined) state.plotCompare = "time";
  if (state.plotYearA === undefined) state.plotYearA = String(Math.min(...DATA.years));
  if (state.plotYearB === undefined) state.plotYearB = String(Math.max(...DATA.years));
  if (state.plotDistributionMetric === undefined) state.plotDistributionMetric = "n";

  VIEWS.plot = [
    "Возраст смерти по причинам",
    "Профиль медианного возраста и интервалов, сравнение двух срезов и подробное распределение для одной причины."
  ];
  METHOD.plot = "Точка показывает медиану, толстый интервал — Q1–Q3, внешний интервал — P10–P90 либо полный наблюдаемый диапазон. В режиме сравнения сопоставляются 2023 и 2025 годы или мужчины и женщины. Значения описывают возраст умерших и не являются коэффициентами риска или доверительными интервалами.";

  const baseLocalControls = localControls;
  const firstYear = Math.min(...DATA.years);
  const lastYear = Math.max(...DATA.years);
  let activePlotContext = null;
  let activePlotItems = [];
  let activePlotSliceLabels = [];

  const emitPlotState = () => window.dispatchEvent(new CustomEvent("atlas:plot-state", { detail: getPublicSummary() }));

  const number = (value, digits = 0) => new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);

  const signed = (value, suffix = "") => {
    if (value == null || !Number.isFinite(value)) return "н/д";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${number(Math.abs(value), 1)}${suffix}`;
  };

  const short = (value, maximum = 38) => {
    const text = String(value || "");
    return text.length > maximum ? `${text.slice(0, maximum - 1)}…` : text;
  };

  const definitions = () => {
    if (state.plotLevel === "block") {
      return DATA.blocks
        .map((definition, index) => ({
          index,
          code: definition.code,
          label: definition.label,
          classIndex: definition.class,
          color: DATA.classes[definition.class]?.color || "#527da4"
        }))
        .filter((item) => state.plotClass === "all" || item.classIndex === +state.plotClass);
    }
    if (state.plotLevel === "code") {
      return DATA.codes
        .map((definition, index) => ({
          index,
          code: definition.code,
          label: definition.label,
          classIndex: definition.class,
          color: DATA.classes[definition.class]?.color || "#527da4"
        }))
        .filter((item) => state.plotClass === "all" || item.classIndex === +state.plotClass);
    }
    return DATA.classes.map((definition, index) => ({
      index,
      code: definition.roman,
      label: definition.short,
      classIndex: index,
      color: definition.color
    }));
  };

  const publicClassOptions = DATA.classes.map((item, index) => ({ value: String(index), label: `${item.roman}. ${item.short}` }));
  const publicCauseOptionsCache = new Map();
  const publicCauseOptions = () => {
    const key = `${state.plotLevel}|${state.plotClass}`;
    if (!publicCauseOptionsCache.has(key)) {
      publicCauseOptionsCache.set(key, definitions().map((item) => ({ value: String(item.index), label: `${item.code} · ${item.label}` })));
    }
    return publicCauseOptionsCache.get(key);
  };

  const rowIndex = (row) => state.plotLevel === "class"
    ? classOf(row)
    : state.plotLevel === "block" ? blockOf(row) : row[3];

  const summaryCache = new WeakMap();

  const summaryFromRows = (definition, causeRows) => {
    const ages = causeRows.map((row) => row[2]).sort((left, right) => left - right);
    if (!ages.length) return { ...definition, rows: causeRows, ages, n: 0 };
    const q1 = quantile(ages, .25);
    const q3 = quantile(ages, .75);
    return {
      ...definition,
      rows: causeRows,
      ages,
      n: ages.length,
      min: ages[0],
      p10: quantile(ages, .1),
      q1,
      median: quantile(ages, .5),
      q3,
      p90: quantile(ages, .9),
      max: ages[ages.length - 1],
      iqr: q3 - q1,
      pgpzh: ages.reduce((sum, age) => sum + Math.max(75 - age, 0), 0),
      under75: ages.filter((age) => age < 75).length / ages.length * 100
    };
  };

  /*
   * Build every cause summary in one pass through the filtered records. The old
   * implementation scanned all records once for every ICD definition; at code
   * level that turned a single render into hundreds of full dataset scans.
   */
  const summariesFor = (rows) => {
    let rowCache = summaryCache.get(rows);
    if (!rowCache) {
      rowCache = new Map();
      summaryCache.set(rows, rowCache);
    }
    const cacheKey = `${state.plotLevel}|${state.plotClass}`;
    if (rowCache.has(cacheKey)) return rowCache.get(cacheKey);

    const items = definitions();
    const allowed = new Set(items.map((item) => item.index));
    const grouped = new Map();
    rows.forEach((row) => {
      if (row[2] < 0 || row[2] > 110) return;
      const index = rowIndex(row);
      if (!allowed.has(index)) return;
      let group = grouped.get(index);
      if (!group) {
        group = [];
        grouped.set(index, group);
      }
      group.push(row);
    });

    const summaries = items.map((definition) => summaryFromRows(definition, grouped.get(definition.index) || []));
    const result = { items: summaries, byIndex: new Map(summaries.map((item) => [item.index, item])) };
    rowCache.set(cacheKey, result);
    return result;
  };

  const summaryFor = (definition, rows) => summariesFor(rows).byIndex.get(definition.index)
    || summaryFromRows(definition, []);

  const sortSummaries = (items, comparison = false) => {
    const sort = state.plotSort === "shift" && !comparison ? "n" : state.plotSort;
    return [...items].sort((left, right) => {
      if (sort === "medianAsc") return left.median - right.median || right.n - left.n;
      if (sort === "medianDesc") return right.median - left.median || right.n - left.n;
      if (sort === "spread") return right.iqr - left.iqr || right.n - left.n;
      if (sort === "shift") return Math.abs(right.deltaMedian || 0) - Math.abs(left.deltaMedian || 0) || right.n - left.n;
      return right.n - left.n || left.median - right.median;
    });
  };

  const profileItems = (rows = filtered()) => {
    const minimum = +state.plotMinN;
    const items = summariesFor(rows).items.filter((item) => item.n >= minimum);
    return sortSummaries(items).slice(0, +state.plotTop);
  };

  const comparisonSlices = () => {
    if (state.plotCompare === "sex") {
      const rows = filtered({ ignoreSex: true });
      return [
        { key: "male", label: "Мужчины", color: "#4d8ec8", rows: rows.filter((row) => row[1] === 1) },
        { key: "female", label: "Женщины", color: "#dc7893", rows: rows.filter((row) => row[1] === 2) }
      ];
    }
    const yearA = DATA.years.includes(+state.plotYearA) ? +state.plotYearA : firstYear;
    const yearB = DATA.years.includes(+state.plotYearB) ? +state.plotYearB : lastYear;
    return [
      { key: String(yearA), label: String(yearA), color: "#8fb7dc", rows: filtered({ years: [yearA], ignoreYear: true }) },
      { key: String(yearB), label: String(yearB), color: "#1766ad", rows: filtered({ years: [yearB], ignoreYear: true }) }
    ];
  };

  const comparisonItems = () => {
    const [first, second] = comparisonSlices();
    const minimum = +state.plotMinN;
    const definitionsList = definitions();
    const firstSummaries = summariesFor(first.rows).byIndex;
    const secondSummaries = summariesFor(second.rows).byIndex;
    const items = definitionsList.map((definition) => {
      const a = firstSummaries.get(definition.index) || summaryFromRows(definition, []);
      const b = secondSummaries.get(definition.index) || summaryFromRows(definition, []);
      return {
        ...definition,
        first: a,
        second: b,
        n: a.n + b.n,
        median: b.median,
        iqr: b.iqr,
        deltaMedian: a.n && b.n ? b.median - a.median : null,
        deltaIqr: a.n && b.n ? b.iqr - a.iqr : null
      };
    }).filter((item) => item.first.n >= minimum && item.second.n >= minimum);
    return { slices: [first, second], items: sortSummaries(items, true).slice(0, +state.plotTop) };
  };

  const activeDefinition = () => definitions().find((definition) => String(definition.index) === String(state.plotCause)) || null;

  const intervalLabel = () => state.plotInterval === "range" ? "min–max" : "P10–P90";

  const intervalValues = (summary) => state.plotInterval === "range"
    ? [summary.min, summary.max]
    : [summary.p10, summary.p90];

  const effectiveRows = () => {
    if (state.plotView !== "compare") return filtered();
    const slices = comparisonSlices();
    return state.plotCompare === "sex" ? filtered({ ignoreSex: true }) : [...slices[0].rows, ...slices[1].rows];
  };

  const updateKpis = (rows) => {
    const summary = stats(rows);
    const linked = rows.filter((row) => row[5] >= 0).length;
    const counts = new Array(DATA.classes.length).fill(0);
    rows.forEach((row) => { const index = classOf(row); if (index >= 0) counts[index] += 1; });
    const lead = counts.indexOf(Math.max(...counts, 0));
    document.getElementById("kpiN").textContent = number(rows.length);
    document.getElementById("kpiAge").textContent = summary.median == null ? "н/д" : `${number(summary.median, 0)} лет`;
    document.getElementById("kpiPgpzh").textContent = number(summary.pgpzh);
    document.getElementById("kpiGeo").textContent = rows.length ? `${number(linked / rows.length * 100, 1)}%` : "н/д";
    document.getElementById("kpiLead").textContent = lead >= 0 ? DATA.classes[lead].roman : "н/д";
  };

  const contextToPublic = (payload) => payload ? {
    key: String(payload.key || ""),
    title: String(payload.title || ""),
    subtitle: String(payload.subtitle || ""),
    primaryLabel: String(payload.primary?.label || ""),
    primaryValue: String(payload.primary?.value || ""),
    changeValue: payload.change?.value == null ? "" : String(payload.change.value),
    metrics: (payload.metrics || []).slice(0, 6).map((item) => ({ label: String(item.label || ""), value: String(item.value || "") })),
    details: (payload.details || []).slice(0, 7).map((item) => ({ label: String(item.label || ""), value: String(item.value || "") })),
    insight: String(payload.insight || ""),
    action: payload.action ? {
      id: String(payload.action.id || ""),
      label: String(payload.action.label || ""),
      cause: String(payload.action.cause || ""),
      level: String(payload.action.level || "")
    } : null
  } : null;

  const emitContext = (payload) => {
    activePlotContext = contextToPublic(payload);
    window.dispatchEvent(new CustomEvent("atlas:inspector-context", { detail: payload }));
    emitPlotState();
  };

  const itemToPublic = (item, rank) => ({
    key: `${state.plotLevel}:${item.index}`,
    index: Number(item.index),
    code: String(item.code || ""),
    label: String(item.label || ""),
    color: String(item.color || "#527da4"),
    n: Number(item.n || 0),
    median: Number(item.median ?? item.second?.median ?? 0),
    q1: Number(item.q1 ?? item.second?.q1 ?? 0),
    q3: Number(item.q3 ?? item.second?.q3 ?? 0),
    p10: Number(item.p10 ?? item.second?.p10 ?? 0),
    p90: Number(item.p90 ?? item.second?.p90 ?? 0),
    min: Number(item.min ?? item.second?.min ?? 0),
    max: Number(item.max ?? item.second?.max ?? 0),
    iqr: Number(item.iqr ?? item.second?.iqr ?? 0),
    pgpzh75: Number(item.pgpzh ?? item.second?.pgpzh ?? 0),
    under75: Number(item.under75 ?? item.second?.under75 ?? 0),
    firstMedian: item.first?.median == null ? null : Number(item.first.median),
    secondMedian: item.second?.median == null ? null : Number(item.second.median),
    deltaMedian: item.deltaMedian == null ? null : Number(item.deltaMedian),
    rank: Number(rank || 0)
  });

  const setActivePlotModel = (items, payload, sliceLabels = []) => {
    activePlotItems = items;
    activePlotContext = contextToPublic(payload);
    activePlotSliceLabels = sliceLabels.map(String);
  };

  const leadingTerritory = (rows) => {
    const counts = new Map();
    rows.forEach((row) => { if (row[4] >= 0) counts.set(row[4], (counts.get(row[4]) || 0) + 1); });
    const leading = [...counts].sort((left, right) => right[1] - left[1])[0];
    return leading ? { name: DATA.municipalities[leading[0]]?.name || "н/д", n: leading[1] } : null;
  };

  const summaryPayload = (item, rank = null) => {
    const overallMedian = quantile(filtered().filter((row) => row[2] >= 0).map((row) => row[2]), .5);
    const difference = overallMedian == null ? null : item.median - overallMedian;
    const territory = leadingTerritory(item.rows);
    const reliability = item.n < 20
      ? "Выборка мала: интерпретируйте медиану и интервалы осторожно."
      : item.iqr >= 25
        ? "Возрастной профиль неоднороден: межквартильный интервал широкий."
        : "Возрастной профиль относительно компактный внутри межквартильного интервала.";
    const comparison = difference == null ? "" : difference < 0
      ? `Медиана на ${number(Math.abs(difference), 1)} года ниже общей медианы текущего среза.`
      : difference > 0 ? `Медиана на ${number(difference, 1)} года выше общей медианы текущего среза.` : "Медиана совпадает с общей медианой текущего среза.";
    return {
      key: `${state.plotLevel}:${item.index}`,
      title: `${item.code} · ${item.label}`,
      subtitle: `${state.year === "all" ? `${firstYear}–${lastYear}` : state.year} · ${state.sex === "all" ? "оба пола" : state.sex === "1" ? "мужчины" : "женщины"}`,
      primary: { label: "медианный возраст смерти", value: `${number(item.median, 1)} года` },
      change: difference == null ? undefined : { value: signed(difference, " года") },
      metrics: [
        { label: "Наблюдений", value: number(item.n) },
        { label: "Q1–Q3", value: `${number(item.q1, 1)}–${number(item.q3, 1)} года` },
        { label: "P10–P90", value: `${number(item.p10, 1)}–${number(item.p90, 1)} года` },
        { label: "Доля до 75 лет", value: `${number(item.under75, 1)}%` }
      ],
      details: [
        { label: "ПГПЖ-75", value: number(item.pgpzh) },
        { label: "Ширина IQR", value: `${number(item.iqr, 1)} года` },
        { label: "Наблюдаемый диапазон", value: `${number(item.min, 0)}–${number(item.max, 0)} лет` },
        ...(rank ? [{ label: "Место в текущем списке", value: `${rank} из ${profileItems().length}` }] : []),
        ...(territory ? [{ label: "Больше всего наблюдений", value: `${territory.name} · ${number(territory.n)}` }] : [])
      ],
      insight: `${comparison} ${reliability}`.trim(),
      action: { id: "plot-distribution", label: "Открыть распределение", cause: String(item.index), level: state.plotLevel }
    };
  };

  const comparisonPayload = (item, slices, rank) => {
    const delta = item.deltaMedian;
    const direction = delta == null ? "Недостаточно данных для сопоставления медиан."
      : delta > 0 ? `Медианный возраст увеличился на ${number(delta, 1)} года.`
        : delta < 0 ? `Медианный возраст уменьшился на ${number(Math.abs(delta), 1)} года.`
          : "Медианный возраст не изменился.";
    const spread = item.deltaIqr == null ? ""
      : item.deltaIqr > 0 ? ` Разброс Q1–Q3 расширился на ${number(item.deltaIqr, 1)} года.`
        : item.deltaIqr < 0 ? ` Разброс Q1–Q3 сузился на ${number(Math.abs(item.deltaIqr), 1)} года.`
          : " Ширина Q1–Q3 не изменилась.";
    return {
      key: `${state.plotLevel}:${item.index}`,
      title: `${item.code} · ${item.label}`,
      subtitle: `${slices[0].label} → ${slices[1].label} · медианный возраст`,
      primary: { label: `${slices[1].label} · медианный возраст`, value: `${number(item.second.median, 1)} года` },
      change: { value: signed(delta, " года") },
      metrics: [
        { label: slices[0].label, value: `${number(item.first.median, 1)} года · n=${number(item.first.n)}` },
        { label: slices[1].label, value: `${number(item.second.median, 1)} года · n=${number(item.second.n)}` },
        { label: "Изменение Q1", value: signed(item.second.q1 - item.first.q1, " года") },
        { label: "Изменение Q3", value: signed(item.second.q3 - item.first.q3, " года") }
      ],
      details: [
        { label: `${slices[0].label} · Q1–Q3`, value: `${number(item.first.q1, 1)}–${number(item.first.q3, 1)}` },
        { label: `${slices[1].label} · Q1–Q3`, value: `${number(item.second.q1, 1)}–${number(item.second.q3, 1)}` },
        { label: "Место по изменению", value: `${rank} из ${comparisonItems().items.length}` },
        { label: "Изменение ширины IQR", value: signed(item.deltaIqr, " года") }
      ],
      insight: `${direction}${spread}`,
      action: { id: "plot-distribution", label: "Открыть распределение", cause: String(item.index), level: state.plotLevel }
    };
  };

  const profileOverviewPayload = (items, rows) => {
    const ages = rows.filter((row) => row[2] >= 0 && row[2] <= 110).map((row) => row[2]).sort((a, b) => a - b);
    const earliest = [...items].sort((a, b) => a.median - b.median)[0];
    const widest = [...items].sort((a, b) => b.iqr - a.iqr)[0];
    return {
      title: "Профиль возраста по причинам",
      subtitle: `${state.year === "all" ? `${firstYear}–${lastYear}` : state.year} · ${state.sex === "all" ? "оба пола" : state.sex === "1" ? "мужчины" : "женщины"}`,
      primary: { label: "наблюдений с известным возрастом", value: number(ages.length) },
      metrics: [
        { label: "Общая медиана", value: ages.length ? `${number(quantile(ages, .5), 1)} года` : "н/д" },
        { label: "Показано причин", value: number(items.length) },
        { label: "Самая ранняя медиана", value: earliest ? `${earliest.code} · ${number(earliest.median, 1)}` : "н/д" },
        { label: "Самый широкий Q1–Q3", value: widest ? `${widest.code} · ${number(widest.iqr, 1)} года` : "н/д" }
      ],
      insight: earliest && widest
        ? `${earliest.code} имеет наиболее ранний медианный возраст среди показанных групп. У ${widest.code} возрастной профиль наиболее неоднороден по ширине Q1–Q3.`
        : "Измените порог выборки или фильтры, чтобы отобразить сопоставимые группы."
    };
  };

  const comparisonOverviewPayload = (items, slices) => {
    const changed = items.filter((item) => Number.isFinite(item.deltaMedian));
    const strongest = [...changed].sort((a, b) => Math.abs(b.deltaMedian) - Math.abs(a.deltaMedian))[0];
    const average = changed.length ? changed.reduce((sum, item) => sum + item.deltaMedian, 0) / changed.length : null;
    return {
      title: "Сравнение возрастных профилей",
      subtitle: `${slices[0].label} → ${slices[1].label}`,
      primary: { label: "сопоставимых причин", value: number(items.length) },
      change: average == null ? undefined : { value: signed(average, " года") },
      metrics: [
        { label: "Среднее смещение медиан", value: average == null ? "н/д" : signed(average, " года") },
        { label: "Наибольшее изменение", value: strongest ? `${strongest.code} · ${signed(strongest.deltaMedian, " года")}` : "н/д" },
        { label: "Сдвиг к старшему возрасту", value: number(changed.filter((item) => item.deltaMedian > 0).length) },
        { label: "Сдвиг к младшему возрасту", value: number(changed.filter((item) => item.deltaMedian < 0).length) }
      ],
      insight: strongest
        ? `${strongest.code} показывает самое заметное изменение медианного возраста. Изменение возраста не следует интерпретировать как изменение риска смертности.`
        : "Для сравнения двух срезов недостаточно наблюдений."
    };
  };

  const tooltipProfile = (item) => `<b>${esc(item.code)} · ${esc(item.label)}</b><div class="tip-grid">`
    + `<span>Наблюдений</span><strong>${number(item.n)}</strong>`
    + `<span>Медиана</span><strong>${number(item.median, 1)} года</strong>`
    + `<span>Q1–Q3</span><strong>${number(item.q1, 1)}–${number(item.q3, 1)}</strong>`
    + `<span>P10–P90</span><strong>${number(item.p10, 1)}–${number(item.p90, 1)}</strong>`
    + `<span>До 75 лет</span><strong>${number(item.under75, 1)}%</strong></div>`;

  const tooltipCompare = (item, slices) => `<b>${esc(item.code)} · ${esc(item.label)}</b><div class="tip-grid">`
    + `<span>${esc(slices[0].label)}</span><strong>${number(item.first.median, 1)} года · n=${number(item.first.n)}</strong>`
    + `<span>${esc(slices[1].label)}</span><strong>${number(item.second.median, 1)} года · n=${number(item.second.n)}</strong>`
    + `<span>Изменение медианы</span><strong>${signed(item.deltaMedian, " года")}</strong>`
    + `<span>Изменение IQR</span><strong>${signed(item.deltaIqr, " года")}</strong></div>`;

  const setCompareControls = (active, mode = null) => {
    const year = document.getElementById("yearSelect");
    const sexButtons = [...document.querySelectorAll("#sexSeg button")];
    if (year) year.disabled = active && mode === "time";
    sexButtons.forEach((button) => { button.disabled = active && mode === "sex"; });
    document.body.classList.toggle("plot-year-suspended", active && mode === "time");
    document.body.classList.toggle("plot-sex-suspended", active && mode === "sex");
  };

  const plotControls = () => {
    const causes = definitions();
    if (state.plotCause !== "all" && !causes.some((item) => String(item.index) === String(state.plotCause))) state.plotCause = "all";
    const parent = state.plotLevel === "class" ? "" : selectField("plotClass", "Класс для детализации", classOptions("Все классы"), state.plotClass);
    const causeSelector = state.plotView === "distribution" ? selectField(
      "plotCause",
      "Причина для распределения",
      [["all", "Выберите причину"], ...causes.map((item) => [item.index, `${item.code} · ${item.label}`])],
      state.plotCause
    ) : "";
    const compareSelector = state.plotView === "compare"
      ? selectField("plotCompare", "Сравнивать", [["time", `${firstYear} → ${lastYear}`], ["sex", "Мужчины → женщины"]], state.plotCompare)
      : "";
    const compareYears = state.plotView === "compare" && state.plotCompare === "time"
      ? `<div class="plot-year-pair">
          ${selectField("plotYearA", "Первый год", DATA.years.map((year) => [String(year), String(year)]), state.plotYearA)}
          ${selectField("plotYearB", "Второй год", DATA.years.map((year) => [String(year), String(year)]), state.plotYearB)}
        </div>` : "";
    const sortOptions = state.plotView === "compare"
      ? [["shift", "По величине изменения"], ["n", "По количеству наблюдений"], ["medianAsc", "По медиане: раньше → позже"], ["medianDesc", "По медиане: позже → раньше"], ["spread", "По ширине Q1–Q3"]]
      : [["n", "По количеству наблюдений"], ["medianAsc", "По медиане: раньше → позже"], ["medianDesc", "По медиане: позже → раньше"], ["spread", "По ширине Q1–Q3"]];
    if (state.plotView !== "compare" && state.plotSort === "shift") state.plotSort = "n";
    els.local.innerHTML = `
      <section class="plot-control-section">
        <header><span>Что анализируем</span><small>структура МКБ-10</small></header>
        <div class="plot-choice-grid plot-choice-grid--level" role="group" aria-label="Уровень детализации МКБ-10">
          <button type="button" data-plot-level="class" aria-pressed="${state.plotLevel === "class"}">Классы</button>
          <button type="button" data-plot-level="block" aria-pressed="${state.plotLevel === "block"}">Блоки</button>
          <button type="button" data-plot-level="code" aria-pressed="${state.plotLevel === "code"}">Коды</button>
        </div>
        ${parent}${causeSelector}
      </section>
      <section class="plot-control-section">
        <header><span>Выборка</span><small>надёжность и объём</small></header>
        <span class="plot-control-caption">Минимум наблюдений в группе</span>
        <div class="plot-choice-grid" role="group" aria-label="Минимум наблюдений">
          ${[5, 10, 20, 50].map((value) => `<button type="button" data-plot-min="${value}" aria-pressed="${String(value) === String(state.plotMinN)}">n ≥ ${value}</button>`).join("")}
        </div>
        ${state.plotView !== "distribution" ? `<span class="plot-control-caption">Количество строк</span><div class="plot-choice-grid plot-choice-grid--two" role="group" aria-label="Количество отображаемых строк"><button type="button" data-plot-top="15" aria-pressed="${state.plotTop === "15"}">Топ-15</button><button type="button" data-plot-top="25" aria-pressed="${state.plotTop === "25"}">Топ-25</button></div>` : ""}
      </section>
      <section class="plot-control-section">
        <header><span>Отображение</span><small>${state.plotView === "profile" ? "профиль" : state.plotView === "compare" ? "сопоставление" : "одна причина"}</small></header>
        ${compareSelector}${compareYears}
        ${state.plotView !== "distribution" ? selectField("plotInterval", "Внешний интервал", [["p10p90", "P10–P90 · рекомендуется"], ["range", "Полный min–max"]], state.plotInterval) : ""}
        ${state.plotView !== "distribution" ? selectField("plotSort", "Сортировка", sortOptions, state.plotSort) : selectField("plotDistributionMetric", "Шкала гистограммы", [["n", "Количество наблюдений"], ["share", "Доля внутри причины, %"]], state.plotDistributionMetric)}
      </section>
      <div class="plot-control-note">${state.plotView === "profile" ? "Один клик выбирает причину и открывает аналитику справа. Двойной клик — подробное распределение." : state.plotView === "compare" ? `Сопоставляются две независимые выборки; верхний фильтр ${state.plotCompare === "time" ? "года" : "пола"} временно не применяется.` : state.plotCause === "all" ? "Выберите одну причину — распределение не смешивает разные возрастные профили." : "Плотность показывает форму распределения, столбцы — наблюдения по пятилетним группам."}</div>`;

    els.local.querySelectorAll("[data-plot-level]").forEach((button) => button.addEventListener("click", () => {
      if (state.plotLevel === button.dataset.plotLevel) return;
      state.plotLevel = button.dataset.plotLevel;
      state.plotClass = "all";
      state.plotCause = "all";
      render();
    }));
    els.local.querySelectorAll("[data-plot-min]").forEach((button) => button.addEventListener("click", () => { state.plotMinN = button.dataset.plotMin; render(); }));
    els.local.querySelectorAll("[data-plot-top]").forEach((button) => button.addEventListener("click", () => { state.plotTop = button.dataset.plotTop; render(); }));
    ["plotClass", "plotCause", "plotCompare", "plotYearA", "plotYearB", "plotInterval", "plotSort", "plotDistributionMetric"].forEach((id) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.addEventListener("change", () => {
        state[id] = control.value;
        if (id === "plotClass") state.plotCause = "all";
        if (id === "plotYearA" && state.plotYearA === state.plotYearB) {
          state.plotYearB = String([...DATA.years].reverse().find((year) => String(year) !== state.plotYearA) ?? lastYear);
        }
        if (id === "plotYearB" && state.plotYearA === state.plotYearB) {
          state.plotYearA = String(DATA.years.find((year) => String(year) !== state.plotYearB) ?? firstYear);
        }
        render();
      });
    });
  };

  const getPublicSummary = () => ({
    active: state.view === "plot",
    view: String(state.plotView),
    level: String(state.plotLevel),
    classIndex: String(state.plotClass),
    cause: String(state.plotCause),
    interval: String(state.plotInterval),
    sort: String(state.plotSort),
    minN: String(state.plotMinN),
    top: String(state.plotTop),
    compare: String(state.plotCompare),
    yearA: String(state.plotYearA),
    yearB: String(state.plotYearB),
    distributionMetric: String(state.plotDistributionMetric),
    years: [...DATA.years],
    classOptions: publicClassOptions,
    causeOptions: publicCauseOptions(),
    sliceLabels: [...activePlotSliceLabels],
    itemCount: activePlotItems.length,
    selectedKey: state.plotCause === "all" ? null : `${state.plotLevel}:${state.plotCause}`,
    context: activePlotContext,
    topItems: activePlotItems.slice(0, 5)
  });

  const setPublicOption = (option, value) => {
    const next = String(value);
    const accepted = {
      view: new Set(["profile", "compare", "distribution"]),
      level: new Set(["class", "block", "code"]),
      interval: new Set(["p10p90", "range"]),
      sort: new Set(["n", "medianAsc", "medianDesc", "spread", "shift"]),
      minN: new Set(["5", "10", "20", "50"]),
      top: new Set(["15", "25"]),
      compare: new Set(["time", "sex"]),
      distributionMetric: new Set(["n", "share"])
    };
    if (accepted[option] && !accepted[option].has(next)) return;
    if (option === "classIndex" && next !== "all" && !DATA.classes[next]) return;
    if (option === "cause" && next !== "all" && !definitions().some((item) => String(item.index) === next)) return;
    if ((option === "yearA" || option === "yearB") && !DATA.years.map(String).includes(next)) return;

    if (option === "view") {
      if (state.plotView === next) return;
      state.plotView = next;
      if (next === "compare" && state.plotSort !== "shift") state.plotSort = "shift";
      if (next !== "compare" && state.plotSort === "shift") state.plotSort = "n";
    } else if (option === "level") {
      if (state.plotLevel === next) return;
      state.plotLevel = next;
      state.plotClass = "all";
      state.plotCause = "all";
    } else if (option === "classIndex") {
      if (String(state.plotClass) === next) return;
      state.plotClass = next;
      state.plotCause = "all";
    } else if (option === "cause") {
      if (String(state.plotCause) === next) return;
      state.plotCause = next;
    } else if (option === "yearA" || option === "yearB") {
      state[option === "yearA" ? "plotYearA" : "plotYearB"] = next;
      if (state.plotYearA === state.plotYearB) {
        if (option === "yearA") state.plotYearB = String([...DATA.years].reverse().find((year) => String(year) !== next) ?? lastYear);
        else state.plotYearA = String(DATA.years.find((year) => String(year) !== next) ?? firstYear);
      }
    } else {
      const stateKey = {
        interval: "plotInterval",
        sort: "plotSort",
        minN: "plotMinN",
        top: "plotTop",
        compare: "plotCompare",
        distributionMetric: "plotDistributionMetric"
      }[option];
      if (!stateKey || String(state[stateKey]) === next) return;
      state[stateKey] = next;
    }
    render();
  };

  const selectPublicItem = (key) => {
    const [level, index] = String(key).split(":");
    if (level !== state.plotLevel || !activePlotItems.some((item) => item.key === `${level}:${index}`)) return;
    state.plotCause = index;
    render();
  };

  const triggerPublicAction = (action) => {
    if (action !== "distribution" || state.plotCause === "all") return;
    state.plotView = "distribution";
    if (state.plotSort === "shift") state.plotSort = "n";
    render();
  };

  window.AmurPlotAnalysis = Object.freeze({
    getSummary: getPublicSummary,
    setOption: setPublicOption,
    selectItem: selectPublicItem,
    triggerAction: triggerPublicAction
  });

  localControls = () => {
    const active = state.view === "plot";
    els.viz.classList.toggle("plot-analysis-host", active);
    document.body.classList.toggle("plot-analysis-active", active);
    if (!active) {
      setCompareControls(false);
      baseLocalControls();
      return;
    }
    setCompareControls(state.plotView === "compare", state.plotCompare);
    plotControls();
  };

  const rootShell = (title, subtitle, legend, stats = []) => {
    const root = document.createElement("div");
    root.className = `plot-analysis plot-analysis--${state.plotView}`;
    root.innerHTML = `
      <nav class="plot-workspace-tabs" aria-label="Режим анализа возраста смерти">
        <button type="button" data-plot-view="profile" aria-pressed="${state.plotView === "profile"}"><span>Профиль причин</span><small>медиана и интервалы</small></button>
        <button type="button" data-plot-view="compare" aria-pressed="${state.plotView === "compare"}"><span>Сравнение</span><small>два года или два пола</small></button>
        <button type="button" data-plot-view="distribution" aria-pressed="${state.plotView === "distribution"}"><span>Одна причина</span><small>форма распределения</small></button>
      </nav>
      <div class="plot-analysis__toolbar">
        <div class="plot-analysis__summary"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div>
        <div class="plot-analysis__toolbar-side">
          ${legend ? `<div class="plot-analysis__legend">${legend}</div>` : ""}
        </div>
      </div>
      ${stats.length ? `<div class="plot-analysis__stats">${stats.map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></div>`).join("")}</div>` : ""}
      <div class="plot-analysis__canvas"></div>
      <div class="plot-analysis__footnote"></div>`;
    root.querySelectorAll("[data-plot-view]").forEach((button) => button.addEventListener("click", () => {
      if (state.plotView === button.dataset.plotView) return;
      state.plotView = button.dataset.plotView;
      if (state.plotView === "compare" && state.plotSort !== "shift") state.plotSort = "shift";
      if (state.plotView !== "compare" && state.plotSort === "shift") state.plotSort = "n";
      render();
    }));
    return root;
  };

  const addRowInteraction = (group, payload, tooltip, definition) => {
    group.dataset.inspectorManaged = "true";
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${definition.code}. ${definition.label}. Открыть подробности.`);
    if (String(state.plotCause) === String(definition.index)) group.classList.add("is-selected");
    const select = () => {
      state.plotCause = String(definition.index);
      group.ownerSVGElement?.querySelectorAll(".plot-cause-row.is-selected").forEach((row) => row.classList.remove("is-selected"));
      group.classList.add("is-selected");
      emitContext(payload);
    };
    group.addEventListener("mouseenter", () => group.classList.add("is-active"));
    group.addEventListener("mouseleave", () => group.classList.remove("is-active"));
    group.addEventListener("focus", () => group.classList.add("is-active"));
    group.addEventListener("blur", () => group.classList.remove("is-active"));
    group.addEventListener("click", select);
    group.addEventListener("dblclick", () => { select(); state.plotView = "distribution"; render(); });
    group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select();
    });
    addTip(group, tooltip);
  };

  const drawAxes = (graphic, width, height, left, right, top, bottom, scale, reference = null) => {
    for (let age = 0; age <= 110; age += 10) {
      const x = scale(age);
      graphic.appendChild(svg("line", { x1: x, y1: top, x2: x, y2: height - bottom, class: "plot-grid" }));
      textNode(graphic, x, height - 10, age, "plot-axis-label", "middle");
    }
    if (reference != null) {
      const x = scale(reference);
      graphic.appendChild(svg("line", { x1: x, y1: top - 3, x2: x, y2: height - bottom, class: "plot-reference" }));
      textNode(graphic, x, top - 9, `общая медиана ${number(reference, 0)}`, "plot-reference-label", "middle");
    }
    textNode(graphic, left + (width - left - right) / 2, height - 1, "Возраст смерти, лет", "plot-axis-title", "middle");
  };

  const rowLabelLayout = (width, rowHeight) => {
    const left = Math.max(250, Math.min(width - 420, width * .34, width >= 1400 ? 500 : 430));
    const fontSize = rowHeight < 22 ? 9 : window.innerWidth >= 2200 ? 15 : window.innerWidth >= 1900 ? 12 : 11.5;
    return { left, fontSize, labelWidth: Math.max(190, left - 36) };
  };

  const wrapLabel = (value, maximum, maximumLines) => {
    const words = String(value || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || candidate.length <= maximum) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (lines.length <= maximumLines) return lines.map((item) => short(item, maximum));
    const visible = lines.slice(0, maximumLines);
    visible[maximumLines - 1] = short(lines.slice(maximumLines - 1).join(" "), maximum);
    return visible;
  };

  const appendRowLabel = (group, x, y, item, rowHeight, labelWidth, fontSize) => {
    const fullLabel = `${item.code} · ${item.label}`;
    const characterWidth = fontSize * .57;
    const maximum = Math.max(22, Math.floor(labelWidth / characterWidth));
    const maximumLines = rowHeight >= fontSize * 1.9 ? 2 : 1;
    const lines = wrapLabel(fullLabel, maximum, maximumLines);
    const lineHeight = fontSize * 1.05;
    const baseline = y + fontSize * .34 - (lines.length - 1) * lineHeight / 2;
    const label = svg("text", { x, y: baseline, class: `plot-row-label${lines.length > 1 ? " is-wrapped" : ""}`, "text-anchor": "start" });
    lines.forEach((line, index) => {
      const span = svg("tspan", { x, dy: index ? lineHeight : 0 });
      span.textContent = line;
      label.appendChild(span);
    });
    group.appendChild(label);
  };

  const renderProfile = () => {
    const rows = filtered();
    const items = profileItems(rows);
    const reference = quantile(rows.filter((row) => row[2] >= 0).map((row) => row[2]), .5);
    const earliest = [...items].sort((a, b) => a.median - b.median)[0];
    const widest = [...items].sort((a, b) => b.iqr - a.iqr)[0];
    const root = rootShell(
      "Медианный возраст по причинам",
      `${state.plotLevel === "class" ? "Классы" : state.plotLevel === "block" ? "Крупные блоки" : "Трёхзначные коды"} · Q1–Q3 и ${intervalLabel()} · n ≥ ${state.plotMinN}`,
      `<span><i class="is-outer"></i>${intervalLabel()}</span><span><i class="is-iqr"></i>Q1–Q3</span><span><i class="is-median"></i>медиана</span>`,
      [
        { label: "Известный возраст", value: number(rows.filter((row) => row[2] >= 0 && row[2] <= 110).length) },
        { label: "Общая медиана", value: reference == null ? "н/д" : `${number(reference, 1)} года` },
        { label: "Самая ранняя", value: earliest ? `${earliest.code} · ${number(earliest.median, 1)}` : "н/д" },
        { label: "Широкий Q1–Q3", value: widest ? `${widest.code} · ${number(widest.iqr, 1)}` : "н/д" }
      ]
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    if (!items.length) {
      const context = profileOverviewPayload(items, rows);
      setActivePlotModel([], context);
      canvas.innerHTML = '<div class="plot-analysis__empty">Нет групп, соответствующих выбранному минимальному числу наблюдений.</div>';
      root.querySelector(".plot-analysis__footnote").textContent = "Уменьшите порог n или измените фильтры.";
      requestAnimationFrame(() => emitContext(context));
      return root;
    }
    const width = Math.max(720, Math.round(els.viz.clientWidth || 1040));
    const largeScreen = window.innerWidth >= 2200;
    const height = Math.max(360, Math.round((els.viz.clientHeight || 700) - (largeScreen ? 205 : 175)));
    const top = items.length > 18 ? 30 : 38;
    const bottom = items.length > 18 ? 32 : 38;
    const rowHeight = (height - top - bottom) / items.length;
    root.classList.toggle("plot-analysis--dense", rowHeight < 22);
    const labelLayout = rowLabelLayout(width, rowHeight);
    const left = labelLayout.left;
    const right = 78;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * (width - left - right);
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-analysis-svg", preserveAspectRatio: "xMidYMid meet", "aria-label": "Медианный возраст и интервалы по причинам смерти" });
    drawAxes(graphic, width, height, left, right, top, bottom, scale, reference);
    const maxN = Math.max(...items.map((item) => item.n), 1);
    const publicItems = [];
    items.forEach((item, index) => {
      const y = top + rowHeight * (index + .5);
      const [outerLow, outerHigh] = intervalValues(item);
      const group = svg("g", { class: "plot-cause-row" });
      group.appendChild(svg("rect", { x: 7, y: y - rowHeight / 2, width: width - 14, height: rowHeight, class: "plot-row-hit" }));
      group.appendChild(svg("line", { x1: 12, y1: y + rowHeight / 2, x2: width - 12, y2: y + rowHeight / 2, class: "plot-row-guide" }));
      appendRowLabel(group, 18, y, item, rowHeight, labelLayout.labelWidth, labelLayout.fontSize);
      group.appendChild(svg("line", { x1: scale(outerLow), y1: y, x2: scale(outerHigh), y2: y, class: "plot-outer-interval" }));
      group.appendChild(svg("line", { x1: scale(item.q1), y1: y, x2: scale(item.q3), y2: y, class: "plot-iqr-interval", stroke: item.color }));
      const radius = 4 + Math.sqrt(item.n / maxN) * 2.6;
      group.appendChild(svg("circle", { cx: scale(item.median), cy: y, r: radius, class: "plot-median-point", fill: item.color }));
      textNode(group, width - 12, y + 4, `n=${number(item.n)}`, "plot-n-label", "end");
      graphic.appendChild(group);
      const payload = summaryPayload(item, index + 1);
      publicItems.push(itemToPublic(item, index + 1));
      addRowInteraction(group, payload, tooltipProfile(item), item);
    });
    canvas.appendChild(graphic);
    root.querySelector(".plot-analysis__footnote").textContent = "Нажмите строку для подробностей справа; двойной клик открывает полное распределение. Вертикальный пунктир — медиана всего текущего среза.";
    const selected = items.find((item) => String(item.index) === String(state.plotCause));
    const context = selected ? summaryPayload(selected, items.indexOf(selected) + 1) : profileOverviewPayload(items, rows);
    setActivePlotModel(publicItems, context);
    requestAnimationFrame(() => emitContext(context));
    return root;
  };

  const renderComparison = () => {
    const { slices, items } = comparisonItems();
    const strongest = [...items].filter((item) => Number.isFinite(item.deltaMedian)).sort((a, b) => Math.abs(b.deltaMedian) - Math.abs(a.deltaMedian))[0];
    const changed = items.filter((item) => Number.isFinite(item.deltaMedian));
    const average = changed.length ? changed.reduce((sum, item) => sum + item.deltaMedian, 0) / changed.length : null;
    const root = rootShell(
      `${slices[0].label} → ${slices[1].label}`,
      `Смещение медианы и изменение Q1–Q3 · ${state.plotLevel === "class" ? "классы" : state.plotLevel === "block" ? "крупные блоки" : "трёхзначные коды"}`,
      `<span><i style="background:${slices[0].color}"></i>${slices[0].label}</span><span><i style="background:${slices[1].color}"></i>${slices[1].label}</span>`,
      [
        { label: "Сопоставлено", value: `${number(items.length)} причин` },
        { label: "Средний сдвиг", value: average == null ? "н/д" : signed(average, " года") },
        { label: "Наибольший сдвиг", value: strongest ? strongest.code : "н/д" },
        { label: "Величина", value: strongest ? signed(strongest.deltaMedian, " года") : "н/д" }
      ]
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    if (!items.length) {
      const context = comparisonOverviewPayload(items, slices);
      setActivePlotModel([], context, slices.map((slice) => slice.label));
      canvas.innerHTML = '<div class="plot-analysis__empty">Недостаточно наблюдений в обоих сравниваемых срезах.</div>';
      root.querySelector(".plot-analysis__footnote").textContent = "Для строки требуется достижение выбранного порога n в каждом срезе.";
      requestAnimationFrame(() => emitContext(context));
      return root;
    }
    const width = Math.max(720, Math.round(els.viz.clientWidth || 1040));
    const largeScreen = window.innerWidth >= 2200;
    const height = Math.max(360, Math.round((els.viz.clientHeight || 700) - (largeScreen ? 205 : 175)));
    const top = items.length > 18 ? 30 : 38;
    const bottom = items.length > 18 ? 32 : 38;
    const rowHeight = (height - top - bottom) / items.length;
    root.classList.toggle("plot-analysis--dense", rowHeight < 23);
    const labelLayout = rowLabelLayout(width, rowHeight);
    const left = labelLayout.left;
    const right = 88;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * (width - left - right);
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-analysis-svg", preserveAspectRatio: "xMidYMid meet", "aria-label": "Сравнение медианного возраста и интервалов" });
    drawAxes(graphic, width, height, left, right, top, bottom, scale);
    const publicItems = [];
    items.forEach((item, index) => {
      const y = top + rowHeight * (index + .5);
      const group = svg("g", { class: "plot-cause-row" });
      group.appendChild(svg("rect", { x: 7, y: y - rowHeight / 2, width: width - 14, height: rowHeight, class: "plot-row-hit" }));
      group.appendChild(svg("line", { x1: 12, y1: y + rowHeight / 2, x2: width - 12, y2: y + rowHeight / 2, class: "plot-row-guide" }));
      appendRowLabel(group, 18, y, item, rowHeight, labelLayout.labelWidth, labelLayout.fontSize);
      group.appendChild(svg("line", { x1: scale(item.first.median), y1: y, x2: scale(item.second.median), y2: y, class: "plot-median-connector" }));
      [item.first, item.second].forEach((slice, sliceIndex) => {
        const offset = sliceIndex ? 5 : -5;
        const [outerLow, outerHigh] = intervalValues(slice);
        group.appendChild(svg("line", { x1: scale(outerLow), y1: y + offset, x2: scale(outerHigh), y2: y + offset, class: "plot-outer-interval plot-outer-interval--compare", stroke: slices[sliceIndex].color }));
        group.appendChild(svg("line", { x1: scale(slice.q1), y1: y + offset, x2: scale(slice.q3), y2: y + offset, class: "plot-iqr-interval plot-iqr-interval--compare", stroke: slices[sliceIndex].color }));
        group.appendChild(svg("circle", { cx: scale(slice.median), cy: y + offset, r: 4.5, class: "plot-median-point", fill: slices[sliceIndex].color }));
      });
      const deltaClass = item.deltaMedian > 0 ? "is-later" : item.deltaMedian < 0 ? "is-earlier" : "is-stable";
      textNode(group, width - 12, y + 4, signed(item.deltaMedian, " г."), `plot-delta-label ${deltaClass}`, "end");
      graphic.appendChild(group);
      const payload = comparisonPayload(item, slices, index + 1);
      publicItems.push(itemToPublic(item, index + 1));
      addRowInteraction(group, payload, tooltipCompare(item, slices), item);
    });
    canvas.appendChild(graphic);
    root.querySelector(".plot-analysis__footnote").textContent = "Две точки показывают медианы, две цветные полосы — Q1–Q3. Положительное изменение означает смещение к более старшему возрасту, но не оценивает риск смертности.";
    const selected = items.find((item) => String(item.index) === String(state.plotCause));
    const context = selected ? comparisonPayload(selected, slices, items.indexOf(selected) + 1) : comparisonOverviewPayload(items, slices);
    setActivePlotModel(publicItems, context, slices.map((slice) => slice.label));
    requestAnimationFrame(() => emitContext(context));
    return root;
  };

  const gaussianDensity = (ages) => {
    const bandwidth = Math.max(3.5, 1.06 * Math.sqrt(quantile(ages, .75) - quantile(ages, .25) || 12) * Math.pow(Math.max(ages.length, 2), -.2));
    return Array.from({ length: 111 }, (_, age) => {
      const density = ages.reduce((sum, value) => {
        const z = (age - value) / bandwidth;
        return sum + Math.exp(-.5 * z * z);
      }, 0) / (ages.length * bandwidth * Math.sqrt(2 * Math.PI));
      return { age, density };
    });
  };

  window.addEventListener("atlas:inspector-action", (event) => {
    if (state.view !== "plot" || event.detail?.id !== "plot-distribution") return;
    if (event.detail.level && event.detail.level !== state.plotLevel) {
      state.plotLevel = event.detail.level;
      state.plotClass = "all";
    }
    state.plotCause = event.detail.cause || state.plotCause;
    state.plotView = "distribution";
    render();
  });

  const renderDistribution = () => {
    const definition = activeDefinition();
    const item = definition ? summaryFor(definition, filtered()) : null;
    const root = rootShell(
      definition ? `${definition.code} · ${definition.label}` : "Распределение одной причины",
      definition ? "Плотность, пятилетняя гистограмма и интервальная сводка" : "Выберите причину в панели параметров",
      definition ? `<span><i class="is-density"></i>плотность</span><span><i class="is-histogram"></i>${state.plotDistributionMetric === "share" ? "доля, %" : "наблюдения"}</span>` : "",
      item?.n ? [
        { label: "Наблюдений", value: number(item.n) },
        { label: "Медиана", value: `${number(item.median, 1)} года` },
        { label: "Q1–Q3", value: `${number(item.q1, 1)}–${number(item.q3, 1)}` },
        { label: "До 75 лет", value: `${number(item.under75, 1)}%` }
      ] : []
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    const footnote = root.querySelector(".plot-analysis__footnote");
    if (!definition) {
      const context = {
        title: "Распределение одной причины",
        subtitle: "Причина не выбрана",
        primary: { label: "доступных причин", value: number(definitions().length) },
        metrics: [
          { label: "Уровень", value: state.plotLevel === "class" ? "Классы" : state.plotLevel === "block" ? "Крупные блоки" : "Трёхзначные коды" },
          { label: "Минимум выборки", value: `n ≥ ${state.plotMinN}` }
        ],
        insight: "Выберите одну причину слева. После выбора будут показаны плотность, пятилетние возрастные группы и квантили."
      };
      setActivePlotModel([], context);
      canvas.innerHTML = '<div class="plot-analysis__empty"><strong>Причина ещё не выбрана</strong><span>Выберите её слева или вернитесь в режим «Профиль» и нажмите нужную строку.</span></div>';
      footnote.textContent = "Распределение строится только для одной причины, чтобы не смешивать формы разных возрастных профилей.";
      requestAnimationFrame(() => emitContext(context));
      return root;
    }
    if (item.n < +state.plotMinN) {
      const context = item.n ? summaryPayload(item) : null;
      setActivePlotModel(item.n ? [itemToPublic(item, 1)] : [], context);
      canvas.innerHTML = `<div class="plot-analysis__empty"><strong>Недостаточно наблюдений</strong><span>Для ${esc(definition.code)} найдено ${number(item.n)}, выбранный порог — n ≥ ${state.plotMinN}.</span></div>`;
      footnote.textContent = "Уменьшите минимальный размер группы или измените фильтры.";
      emitContext(context);
      return root;
    }
    const width = Math.max(720, Math.round(els.viz.clientWidth || 1040));
    const height = Math.max(430, Math.round((els.viz.clientHeight || 700) - 230));
    const left = 72;
    const right = 38;
    const plotWidth = width - left - right;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * plotWidth;
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-distribution-svg", preserveAspectRatio: "xMidYMid meet", "aria-label": `Распределение возраста для ${definition.code}` });
    const bands = [
      { start: 0, end: 18, label: "0–17" },
      { start: 18, end: 45, label: "18–44" },
      { start: 45, end: 65, label: "45–64" },
      { start: 65, end: 75, label: "65–74" },
      { start: 75, end: 110, label: "75+" }
    ];
    bands.forEach((band, index) => {
      graphic.appendChild(svg("rect", { x: scale(band.start), y: 34, width: Math.max(1, scale(band.end) - scale(band.start)), height: height - 78, class: `plot-age-band ${index % 2 ? "is-even" : ""}` }));
      textNode(graphic, (scale(band.start) + scale(band.end)) / 2, 48, band.label, "plot-age-band-label", "middle");
    });
    const density = gaussianDensity(item.ages);
    const maxDensity = Math.max(...density.map((point) => point.density), 1e-6);
    const densityBase = Math.round(height * .43);
    const densityHeight = Math.round(height * .27);
    const densityLine = density.map((point, index) => `${index ? "L" : "M"}${scale(point.age).toFixed(1)},${(densityBase - point.density / maxDensity * densityHeight).toFixed(1)}`).join(" ");
    const densityArea = `${densityLine} L${scale(110)},${densityBase} L${scale(0)},${densityBase} Z`;
    graphic.appendChild(svg("path", { d: densityArea, class: "plot-density-area", fill: definition.color }));
    graphic.appendChild(svg("path", { d: densityLine, class: "plot-density-line", fill: "none", stroke: definition.color }));
    textNode(graphic, left, 23, "Плотность распределения", "plot-section-label", "start");

    const thresholdX = scale(75);
    graphic.appendChild(svg("line", { x1: thresholdX, y1: 34, x2: thresholdX, y2: height - 42, class: "plot-age-threshold is-75" }));
    textNode(graphic, thresholdX, 27, "рубеж 75 лет", "plot-threshold-label", "middle");

    const bins = Array.from({ length: 22 }, (_, index) => ({ start: index * 5, end: index === 21 ? 110 : index * 5 + 4, n: 0 }));
    item.ages.forEach((age) => { const index = Math.min(21, Math.floor(age / 5)); bins[index].n += 1; });
    const metricValue = (bin) => state.plotDistributionMetric === "share" ? bin.n / item.n * 100 : bin.n;
    const maxBin = Math.max(...bins.map(metricValue), 1);
    const histTop = Math.round(height * .55);
    const histBase = Math.round(height * .78);
    bins.forEach((bin) => {
      const x1 = scale(bin.start);
      const x2 = scale(Math.min(110, bin.end + 1));
      const barHeight = metricValue(bin) / maxBin * (histBase - histTop);
      const bar = svg("rect", { x: x1 + 1, y: histBase - barHeight, width: Math.max(1, x2 - x1 - 2), height: barHeight, rx: 2, class: "plot-histogram-bar", fill: definition.color });
      graphic.appendChild(bar);
      addTip(bar, `<b>${bin.start}–${bin.end === 110 ? "110" : bin.end} лет</b><div class="tip-grid"><span>Наблюдений</span><strong>${number(bin.n)}</strong><span>Доля причины</span><strong>${number(bin.n / item.n * 100, 1)}%</strong></div>`);
    });
    textNode(graphic, left, histTop - 9, state.plotDistributionMetric === "share" ? "Доля по пятилетним группам, %" : "Наблюдения по пятилетним группам", "plot-section-label", "start");
    textNode(graphic, left - 8, histTop + 3, state.plotDistributionMetric === "share" ? number(maxBin, 1) : number(maxBin), "plot-y-label", "end");
    textNode(graphic, left - 8, histBase + 3, "0", "plot-y-label", "end");

    const boxY = Math.round(height * .87);
    graphic.appendChild(svg("line", { x1: scale(item.p10), y1: boxY, x2: scale(item.p90), y2: boxY, class: "plot-box-whisker" }));
    graphic.appendChild(svg("rect", { x: scale(item.q1), y: boxY - 11, width: Math.max(2, scale(item.q3) - scale(item.q1)), height: 22, rx: 5, class: "plot-box-iqr", fill: definition.color }));
    graphic.appendChild(svg("line", { x1: scale(item.median), y1: boxY - 15, x2: scale(item.median), y2: boxY + 15, class: "plot-box-median" }));
    [item.p10, item.p90].forEach((age) => graphic.appendChild(svg("line", { x1: scale(age), y1: boxY - 7, x2: scale(age), y2: boxY + 7, class: "plot-box-cap" })));
    textNode(graphic, left, boxY - 25, "Квантили возраста", "plot-section-label", "start");
    [
      { age: item.p10, name: "P10" },
      { age: item.q1, name: "Q1" },
      { age: item.median, name: "Медиана" },
      { age: item.q3, name: "Q3" },
      { age: item.p90, name: "P90" }
    ].forEach((quantileItem, index) => textNode(graphic, scale(quantileItem.age), boxY + (index % 2 ? 31 : 24), `${quantileItem.name} ${number(quantileItem.age, 1)}`, "plot-quantile-label", "middle"));
    for (let age = 0; age <= 110; age += 10) textNode(graphic, scale(age), height - 12, age, "plot-axis-label", "middle");
    canvas.appendChild(graphic);
    footnote.textContent = `n=${number(item.n)} · медиана ${number(item.median, 1)} года · Q1–Q3 ${number(item.q1, 1)}–${number(item.q3, 1)} · до 75 лет ${number(item.under75, 1)}%. Плотность сглажена для чтения формы распределения.`;
    const payload = summaryPayload(item);
    delete payload.action;
    setActivePlotModel([itemToPublic(item, 1)], payload);
    requestAnimationFrame(() => emitContext(payload));
    return root;
  };

  renderPlot = () => {
    const rows = effectiveRows();
    updateKpis(rows);
    els.meta.innerHTML = `<span class="chip">${state.plotView === "compare" && state.plotCompare === "time" ? `${state.plotYearA} → ${state.plotYearB}` : state.year === "all" ? `${firstYear}–${lastYear}` : state.year}</span><span class="chip">${state.plotView === "compare" && state.plotCompare === "sex" ? "мужчины → женщины" : state.sex === "all" ? "оба пола" : state.sex === "1" ? "мужчины" : "женщины"}</span><span class="chip">${state.plotView === "profile" ? "профиль причин" : state.plotView === "compare" ? "сравнение" : "одна причина"}</span><span class="chip">описательная статистика возраста</span>`;
    const root = state.plotView === "compare" ? renderComparison() : state.plotView === "distribution" ? renderDistribution() : renderProfile();
    els.viz.appendChild(root);
  };
})();
