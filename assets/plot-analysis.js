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

  VIEWS.plot = [
    "Возраст смерти по причинам",
    "Профиль медианного возраста и интервалов, сравнение двух срезов и подробное распределение для одной причины."
  ];
  METHOD.plot = "Точка показывает медиану, толстый интервал — Q1–Q3, внешний интервал — P10–P90 либо полный наблюдаемый диапазон. В режиме сравнения сопоставляются 2023 и 2025 годы или мужчины и женщины. Значения описывают возраст умерших и не являются коэффициентами риска или доверительными интервалами.";

  const baseLocalControls = localControls;
  const firstYear = Math.min(...DATA.years);
  const lastYear = Math.max(...DATA.years);

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

  const rowIndex = (row) => state.plotLevel === "class"
    ? classOf(row)
    : state.plotLevel === "block" ? blockOf(row) : row[3];

  const rowsForDefinition = (rows, definition) => rows.filter((row) => row[2] >= 0 && row[2] <= 110 && rowIndex(row) === definition.index);

  const summaryFor = (definition, rows) => {
    const causeRows = rowsForDefinition(rows, definition);
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
    const items = definitions().map((definition) => summaryFor(definition, rows)).filter((item) => item.n >= minimum);
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
    return [
      { key: String(firstYear), label: String(firstYear), color: "#91a9c2", rows: filtered({ years: [firstYear], ignoreYear: true }) },
      { key: String(lastYear), label: String(lastYear), color: "#2674b8", rows: filtered({ years: [lastYear], ignoreYear: true }) }
    ];
  };

  const comparisonItems = () => {
    const [first, second] = comparisonSlices();
    const minimum = +state.plotMinN;
    const items = definitions().map((definition) => {
      const a = summaryFor(definition, first.rows);
      const b = summaryFor(definition, second.rows);
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

  const emitContext = (payload) => window.dispatchEvent(new CustomEvent("atlas:inspector-context", { detail: payload }));

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
      insight: `${comparison} ${reliability}`.trim()
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
      insight: `${direction}${spread}`
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
    const sortOptions = state.plotView === "compare"
      ? [["shift", "По величине изменения"], ["n", "По количеству наблюдений"], ["medianAsc", "По медиане: раньше → позже"], ["medianDesc", "По медиане: позже → раньше"], ["spread", "По ширине Q1–Q3"]]
      : [["n", "По количеству наблюдений"], ["medianAsc", "По медиане: раньше → позже"], ["medianDesc", "По медиане: позже → раньше"], ["spread", "По ширине Q1–Q3"]];
    if (state.plotView !== "compare" && state.plotSort === "shift") state.plotSort = "n";
    els.local.innerHTML = `
      <span class="plot-controls__label">Режим анализа</span>
      <div class="plot-mode-switch" role="group" aria-label="Режим анализа возраста смерти">
        <button type="button" data-plot-view="profile" aria-pressed="${state.plotView === "profile"}"><span>Профиль</span><small>медиана и интервалы</small></button>
        <button type="button" data-plot-view="compare" aria-pressed="${state.plotView === "compare"}"><span>Сравнение</span><small>два среза</small></button>
        <button type="button" data-plot-view="distribution" aria-pressed="${state.plotView === "distribution"}"><span>Распределение</span><small>одна причина</small></button>
      </div>
      ${selectField("plotLevel", "Уровень МКБ-10", [["class", "Классы"], ["block", "Крупные блоки"], ["code", "Трёхзначные коды"]], state.plotLevel)}
      ${parent}${causeSelector}${compareSelector}
      ${state.plotView !== "distribution" ? selectField("plotInterval", "Внешний интервал", [["p10p90", "P10–P90 · рекомендуется"], ["range", "Полный min–max"]], state.plotInterval) : ""}
      ${state.plotView !== "distribution" ? selectField("plotSort", "Сортировка", sortOptions, state.plotSort) : ""}
      <div class="plot-control-pair">
        ${selectField("plotMinN", "Минимум наблюдений", [["5", "n ≥ 5"], ["10", "n ≥ 10"], ["20", "n ≥ 20"], ["50", "n ≥ 50"]], state.plotMinN)}
        ${state.plotView !== "distribution" ? selectField("plotTop", "Показать", [["15", "Топ-15"], ["25", "Топ-25"]], state.plotTop) : ""}
      </div>
      <div class="plot-control-note">${state.plotView === "profile" ? "Нажмите строку для аналитики справа. Двойной клик сразу откроет распределение выбранной причины." : state.plotView === "compare" ? `Фильтр ${state.plotCompare === "time" ? "года" : "пола"} сверху временно не применяется.` : state.plotCause === "all" ? "Выберите одну причину, чтобы построить её возрастное распределение." : "Плотность и гистограмма описывают зарегистрированные наблюдения выбранной причины."}</div>`;

    els.local.querySelectorAll("[data-plot-view]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.plotView === button.dataset.plotView) return;
        state.plotView = button.dataset.plotView;
        render();
      });
    });
    ["plotLevel", "plotClass", "plotCause", "plotCompare", "plotInterval", "plotSort", "plotMinN", "plotTop"].forEach((id) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.addEventListener("change", () => {
        state[id] = control.value;
        if (id === "plotLevel") {
          state.plotClass = "all";
          state.plotCause = "all";
        }
        if (id === "plotClass") state.plotCause = "all";
        render();
      });
    });
  };

  localControls = () => {
    const active = state.view === "plot";
    els.viz.classList.toggle("plot-analysis-host", active);
    if (!active) {
      setCompareControls(false);
      baseLocalControls();
      return;
    }
    setCompareControls(state.plotView === "compare", state.plotCompare);
    plotControls();
  };

  const rootShell = (title, subtitle, legend, action = false) => {
    const root = document.createElement("div");
    root.className = `plot-analysis plot-analysis--${state.plotView}`;
    root.innerHTML = `
      <div class="plot-analysis__toolbar">
        <div class="plot-analysis__summary"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></div>
        <div class="plot-analysis__toolbar-side">
          ${legend ? `<div class="plot-analysis__legend">${legend}</div>` : ""}
          ${action ? `<button type="button" class="plot-distribution-open" ${state.plotCause === "all" ? "disabled" : ""}>Распределение причины →</button>` : ""}
        </div>
      </div>
      <div class="plot-analysis__canvas"></div>
      <div class="plot-analysis__footnote"></div>`;
    return root;
  };

  const addRowInteraction = (group, payload, tooltip, definition, openButton) => {
    group.dataset.inspectorManaged = "true";
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${definition.code}. ${definition.label}. Открыть подробности.`);
    const select = () => {
      state.plotCause = String(definition.index);
      if (openButton) {
        openButton.disabled = false;
        openButton.textContent = `Распределение: ${definition.code} →`;
      }
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

  const renderProfile = () => {
    const rows = filtered();
    const items = profileItems(rows);
    const reference = quantile(rows.filter((row) => row[2] >= 0).map((row) => row[2]), .5);
    const root = rootShell(
      "Медианный возраст по причинам",
      `${state.plotLevel === "class" ? "Классы" : state.plotLevel === "block" ? "Крупные блоки" : "Трёхзначные коды"} · Q1–Q3 и ${intervalLabel()} · n ≥ ${state.plotMinN}`,
      `<span><i class="is-outer"></i>${intervalLabel()}</span><span><i class="is-iqr"></i>Q1–Q3</span><span><i class="is-median"></i>медиана</span>`,
      true
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    const openButton = root.querySelector(".plot-distribution-open");
    openButton?.addEventListener("click", () => { if (state.plotCause !== "all") { state.plotView = "distribution"; render(); } });
    if (!items.length) {
      canvas.innerHTML = '<div class="plot-analysis__empty">Нет групп, соответствующих выбранному минимальному числу наблюдений.</div>';
      root.querySelector(".plot-analysis__footnote").textContent = "Уменьшите порог n или измените фильтры.";
      return root;
    }
    const width = Math.max(780, Math.round(els.viz.clientWidth || 1040));
    const height = Math.max(500, items.length * 29 + 84);
    const left = Math.max(265, Math.min(350, width * .29));
    const right = 72;
    const top = 35;
    const bottom = 36;
    const rowHeight = (height - top - bottom) / items.length;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * (width - left - right);
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-analysis-svg", "aria-label": "Медианный возраст и интервалы по причинам смерти" });
    drawAxes(graphic, width, height, left, right, top, bottom, scale, reference);
    const maxN = Math.max(...items.map((item) => item.n), 1);
    items.forEach((item, index) => {
      const y = top + rowHeight * (index + .5);
      const [outerLow, outerHigh] = intervalValues(item);
      const group = svg("g", { class: "plot-cause-row" });
      group.appendChild(svg("rect", { x: 7, y: y - rowHeight / 2, width: width - 14, height: rowHeight, class: "plot-row-hit" }));
      group.appendChild(svg("line", { x1: 12, y1: y + rowHeight / 2, x2: width - 12, y2: y + rowHeight / 2, class: "plot-row-guide" }));
      textNode(group, left - 14, y + 3.5, `${item.code} · ${short(item.label, width < 1000 ? 28 : 40)}`, "plot-row-label", "end");
      group.appendChild(svg("line", { x1: scale(outerLow), y1: y, x2: scale(outerHigh), y2: y, class: "plot-outer-interval" }));
      group.appendChild(svg("line", { x1: scale(item.q1), y1: y, x2: scale(item.q3), y2: y, class: "plot-iqr-interval", stroke: item.color }));
      const radius = 4 + Math.sqrt(item.n / maxN) * 2.6;
      group.appendChild(svg("circle", { cx: scale(item.median), cy: y, r: radius, class: "plot-median-point", fill: item.color }));
      textNode(group, width - 12, y + 3.5, `n=${number(item.n)}`, "plot-n-label", "end");
      graphic.appendChild(group);
      addRowInteraction(group, summaryPayload(item, index + 1), tooltipProfile(item), item, openButton);
    });
    canvas.appendChild(graphic);
    root.querySelector(".plot-analysis__footnote").textContent = "Нажмите строку для подробностей справа; двойной клик открывает полное распределение. Вертикальный пунктир — медиана всего текущего среза.";
    return root;
  };

  const renderComparison = () => {
    const { slices, items } = comparisonItems();
    const root = rootShell(
      `${slices[0].label} → ${slices[1].label}`,
      `Смещение медианы и изменение Q1–Q3 · ${state.plotLevel === "class" ? "классы" : state.plotLevel === "block" ? "крупные блоки" : "трёхзначные коды"}`,
      `<span><i style="background:${slices[0].color}"></i>${slices[0].label}</span><span><i style="background:${slices[1].color}"></i>${slices[1].label}</span>`,
      true
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    const openButton = root.querySelector(".plot-distribution-open");
    openButton?.addEventListener("click", () => { if (state.plotCause !== "all") { state.plotView = "distribution"; render(); } });
    if (!items.length) {
      canvas.innerHTML = '<div class="plot-analysis__empty">Недостаточно наблюдений в обоих сравниваемых срезах.</div>';
      root.querySelector(".plot-analysis__footnote").textContent = "Для строки требуется достижение выбранного порога n в каждом срезе.";
      return root;
    }
    const width = Math.max(780, Math.round(els.viz.clientWidth || 1040));
    const height = Math.max(500, items.length * 31 + 84);
    const left = Math.max(265, Math.min(350, width * .29));
    const right = 78;
    const top = 32;
    const bottom = 36;
    const rowHeight = (height - top - bottom) / items.length;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * (width - left - right);
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-analysis-svg", "aria-label": "Сравнение медианного возраста и интервалов" });
    drawAxes(graphic, width, height, left, right, top, bottom, scale);
    items.forEach((item, index) => {
      const y = top + rowHeight * (index + .5);
      const group = svg("g", { class: "plot-cause-row" });
      group.appendChild(svg("rect", { x: 7, y: y - rowHeight / 2, width: width - 14, height: rowHeight, class: "plot-row-hit" }));
      group.appendChild(svg("line", { x1: 12, y1: y + rowHeight / 2, x2: width - 12, y2: y + rowHeight / 2, class: "plot-row-guide" }));
      textNode(group, left - 14, y + 3.5, `${item.code} · ${short(item.label, width < 1000 ? 28 : 40)}`, "plot-row-label", "end");
      group.appendChild(svg("line", { x1: scale(item.first.median), y1: y, x2: scale(item.second.median), y2: y, class: "plot-median-connector" }));
      [item.first, item.second].forEach((slice, sliceIndex) => {
        const offset = sliceIndex ? 5 : -5;
        const [outerLow, outerHigh] = intervalValues(slice);
        group.appendChild(svg("line", { x1: scale(outerLow), y1: y + offset, x2: scale(outerHigh), y2: y + offset, class: "plot-outer-interval plot-outer-interval--compare", stroke: slices[sliceIndex].color }));
        group.appendChild(svg("line", { x1: scale(slice.q1), y1: y + offset, x2: scale(slice.q3), y2: y + offset, class: "plot-iqr-interval plot-iqr-interval--compare", stroke: slices[sliceIndex].color }));
        group.appendChild(svg("circle", { cx: scale(slice.median), cy: y + offset, r: 4.5, class: "plot-median-point", fill: slices[sliceIndex].color }));
      });
      const deltaClass = item.deltaMedian > 0 ? "is-later" : item.deltaMedian < 0 ? "is-earlier" : "is-stable";
      textNode(group, width - 12, y + 3.5, signed(item.deltaMedian, " г."), `plot-delta-label ${deltaClass}`, "end");
      graphic.appendChild(group);
      addRowInteraction(group, comparisonPayload(item, slices, index + 1), tooltipCompare(item, slices), item, openButton);
    });
    canvas.appendChild(graphic);
    root.querySelector(".plot-analysis__footnote").textContent = "Две точки показывают медианы, две цветные полосы — Q1–Q3. Положительное изменение означает смещение к более старшему возрасту, но не оценивает риск смертности.";
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

  const renderDistribution = () => {
    const definition = activeDefinition();
    const root = rootShell(
      definition ? `${definition.code} · ${definition.label}` : "Распределение одной причины",
      definition ? "Плотность, пятилетняя гистограмма и интервальная сводка" : "Выберите причину в панели параметров",
      definition ? '<span><i class="is-density"></i>плотность</span><span><i class="is-histogram"></i>число наблюдений</span>' : ""
    );
    const canvas = root.querySelector(".plot-analysis__canvas");
    const footnote = root.querySelector(".plot-analysis__footnote");
    if (!definition) {
      canvas.innerHTML = '<div class="plot-analysis__empty"><strong>Причина ещё не выбрана</strong><span>Выберите её слева или вернитесь в режим «Профиль» и нажмите нужную строку.</span></div>';
      footnote.textContent = "Распределение строится только для одной причины, чтобы не смешивать формы разных возрастных профилей.";
      emitContext(null);
      return root;
    }
    const item = summaryFor(definition, filtered());
    if (item.n < +state.plotMinN) {
      canvas.innerHTML = `<div class="plot-analysis__empty"><strong>Недостаточно наблюдений</strong><span>Для ${esc(definition.code)} найдено ${number(item.n)}, выбранный порог — n ≥ ${state.plotMinN}.</span></div>`;
      footnote.textContent = "Уменьшите минимальный размер группы или измените фильтры.";
      emitContext(item.n ? summaryPayload(item) : null);
      return root;
    }
    const width = Math.max(780, Math.round(els.viz.clientWidth || 1040));
    const height = Math.max(520, Math.round((els.viz.clientHeight || 650) - 76));
    const left = 64;
    const right = 34;
    const plotWidth = width - left - right;
    const scale = (age) => left + Math.max(0, Math.min(110, age)) / 110 * plotWidth;
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot-distribution-svg", "aria-label": `Распределение возраста для ${definition.code}` });
    const density = gaussianDensity(item.ages);
    const maxDensity = Math.max(...density.map((point) => point.density), 1e-6);
    const densityBase = Math.round(height * .43);
    const densityHeight = Math.round(height * .27);
    const densityPath = density.map((point, index) => `${index ? "L" : "M"}${scale(point.age).toFixed(1)},${(densityBase - point.density / maxDensity * densityHeight).toFixed(1)}`).join(" ") + ` L${scale(110)},${densityBase} L${scale(0)},${densityBase} Z`;
    graphic.appendChild(svg("path", { d: densityPath, class: "plot-density-area", fill: definition.color }));
    graphic.appendChild(svg("path", { d: densityPath.replace(/ L[^L]+ L[^L]+ Z$/, ""), class: "plot-density-line", fill: "none", stroke: definition.color }));
    textNode(graphic, left, 23, "Плотность распределения", "plot-section-label", "start");

    [40, 60, 75].forEach((age) => {
      const x = scale(age);
      graphic.appendChild(svg("line", { x1: x, y1: 34, x2: x, y2: height - 42, class: `plot-age-threshold ${age === 75 ? "is-75" : ""}` }));
      textNode(graphic, x, 35, `${age} лет`, "plot-threshold-label", "middle");
    });

    const bins = Array.from({ length: 22 }, (_, index) => ({ start: index * 5, end: index === 21 ? 110 : index * 5 + 4, n: 0 }));
    item.ages.forEach((age) => { const index = Math.min(21, Math.floor(age / 5)); bins[index].n += 1; });
    const maxBin = Math.max(...bins.map((bin) => bin.n), 1);
    const histTop = Math.round(height * .55);
    const histBase = Math.round(height * .78);
    bins.forEach((bin) => {
      const x1 = scale(bin.start);
      const x2 = scale(Math.min(110, bin.end + 1));
      const barHeight = bin.n / maxBin * (histBase - histTop);
      const bar = svg("rect", { x: x1 + 1, y: histBase - barHeight, width: Math.max(1, x2 - x1 - 2), height: barHeight, rx: 2, class: "plot-histogram-bar", fill: definition.color });
      graphic.appendChild(bar);
      addTip(bar, `<b>${bin.start}–${bin.end === 110 ? "110" : bin.end} лет</b><div class="tip-grid"><span>Наблюдений</span><strong>${number(bin.n)}</strong><span>Доля причины</span><strong>${number(bin.n / item.n * 100, 1)}%</strong></div>`);
    });
    textNode(graphic, left, histTop - 9, "Наблюдения по пятилетним группам", "plot-section-label", "start");

    const boxY = Math.round(height * .87);
    graphic.appendChild(svg("line", { x1: scale(item.p10), y1: boxY, x2: scale(item.p90), y2: boxY, class: "plot-box-whisker" }));
    graphic.appendChild(svg("rect", { x: scale(item.q1), y: boxY - 11, width: Math.max(2, scale(item.q3) - scale(item.q1)), height: 22, rx: 5, class: "plot-box-iqr", fill: definition.color }));
    graphic.appendChild(svg("line", { x1: scale(item.median), y1: boxY - 15, x2: scale(item.median), y2: boxY + 15, class: "plot-box-median" }));
    [item.p10, item.p90].forEach((age) => graphic.appendChild(svg("line", { x1: scale(age), y1: boxY - 7, x2: scale(age), y2: boxY + 7, class: "plot-box-cap" })));
    textNode(graphic, left, boxY - 22, "P10–Q1–медиана–Q3–P90", "plot-section-label", "start");
    for (let age = 0; age <= 110; age += 10) textNode(graphic, scale(age), height - 12, age, "plot-axis-label", "middle");
    canvas.appendChild(graphic);
    footnote.textContent = `n=${number(item.n)} · медиана ${number(item.median, 1)} года · Q1–Q3 ${number(item.q1, 1)}–${number(item.q3, 1)} · до 75 лет ${number(item.under75, 1)}%. Плотность сглажена для чтения формы распределения.`;
    requestAnimationFrame(() => emitContext(summaryPayload(item)));
    return root;
  };

  renderPlot = () => {
    const rows = effectiveRows();
    updateKpis(rows);
    els.meta.innerHTML = `<span class="chip">${state.plotView === "compare" && state.plotCompare === "time" ? `${firstYear} → ${lastYear}` : state.year === "all" ? `${firstYear}–${lastYear}` : state.year}</span><span class="chip">${state.plotView === "compare" && state.plotCompare === "sex" ? "мужчины → женщины" : state.sex === "all" ? "оба пола" : state.sex === "1" ? "мужчины" : "женщины"}</span><span class="chip">${state.plotView === "profile" ? "профиль" : state.plotView === "compare" ? "сравнение" : "распределение"}</span><span class="chip">описательная статистика возраста</span>`;
    const root = state.plotView === "compare" ? renderComparison() : state.plotView === "distribution" ? renderDistribution() : renderProfile();
    els.viz.appendChild(root);
    if (state.plotView !== "distribution") emitContext(null);
  };
})();
