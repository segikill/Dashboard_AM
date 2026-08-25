(() => {
  "use strict";

  if (typeof state === "undefined" || typeof DATA === "undefined" || typeof renderPyramid !== "function") return;

  if (state.pyramidView === undefined) state.pyramidView = "structure";
  if (state.pyramidLevel === undefined) state.pyramidLevel = "class";
  if (state.pyramidParentClass === undefined) state.pyramidParentClass = "all";
  if (state.pyramidCause === undefined) state.pyramidCause = "all";
  if (state.pyramidMetric === undefined) state.pyramidMetric = "n";
  if (state.pyramidAgeStep === undefined) state.pyramidAgeStep = "5";
  if (state.pyramidLabels === undefined) state.pyramidLabels = "major";

  VIEWS.pyramid = [
    "Возрастно-половой профиль смертности",
    "Структура смертей по возрасту и полу, динамика между 2023 и 2025 годами и различия мужского и женского профилей."
  ];
  METHOD.pyramid = "Пирамида показывает абсолютное число наблюдений, долю внутри каждого пола или ПГПЖ-75. Режим «Динамика» сопоставляет 2023 и 2025 годы на общей шкале. Это структура зарегистрированных смертей, а не половозрастной коэффициент: соответствующих знаменателей населения в наборе нет.";

  const baseLocalControls = localControls;
  const firstYear = Math.min(...DATA.years);
  const lastYear = Math.max(...DATA.years);
  let activePyramidModel = null;
  let selectedPyramidKey = "";

  const number = (value, digits = 0) => new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);

  const signed = (value, suffix = "") => {
    if (value == null || !Number.isFinite(value)) return "н/д";
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${number(Math.abs(value), 1)}${suffix}`;
  };

  const metricLabel = () => ({
    n: "количество смертей",
    share: "доля внутри пола",
    pgpzh: "ПГПЖ-75"
  })[state.pyramidMetric] || "значение";

  const metricShort = () => ({ n: "смертей", share: "%", pgpzh: "лет ПГПЖ" })[state.pyramidMetric] || "";

  const metricValue = (value) => state.pyramidMetric === "share"
    ? `${number(value, 1)}%`
    : number(value, 0);

  const causeDefinitions = () => {
    if (state.pyramidLevel === "block") {
      return DATA.blocks
        .map((definition, index) => ({ index, code: definition.code, label: definition.label, classIndex: definition.class }))
        .filter((item) => state.pyramidParentClass === "all" || item.classIndex === +state.pyramidParentClass);
    }
    if (state.pyramidLevel === "code") {
      return DATA.codes
        .map((definition, index) => ({ index, code: definition.code, label: definition.label, classIndex: definition.class }))
        .filter((item) => state.pyramidParentClass === "all" || item.classIndex === +state.pyramidParentClass);
    }
    return DATA.classes.map((definition, index) => ({
      index,
      code: definition.roman,
      label: definition.short,
      classIndex: index
    }));
  };

  const activeCause = () => causeDefinitions().find((item) => String(item.index) === String(state.pyramidCause)) || null;

  const causeLabel = () => {
    const selected = activeCause();
    if (selected) return `${selected.code} · ${selected.label}`;
    if (state.pyramidLevel !== "class" && state.pyramidParentClass !== "all") {
      const definition = DATA.classes[+state.pyramidParentClass];
      return definition ? `Все причины класса ${definition.roman}` : "Все причины";
    }
    return "Все причины смерти";
  };

  const rowCauseIndex = (row) => state.pyramidLevel === "class"
    ? classOf(row)
    : state.pyramidLevel === "block" ? blockOf(row) : row[3];

  const matchesCause = (row) => {
    if (row[3] < 0 && (state.pyramidCause !== "all" || state.pyramidParentClass !== "all")) return false;
    if (state.pyramidLevel !== "class" && state.pyramidParentClass !== "all" && classOf(row) !== +state.pyramidParentClass) return false;
    return state.pyramidCause === "all" || rowCauseIndex(row) === +state.pyramidCause;
  };

  const periodRows = (year = null, applyCause = true) => DATA.records.filter((row) => {
    if (row[2] < 0 || row[2] > 110) return false;
    if (year != null && row[0] !== year) return false;
    if (year == null && state.year !== "all" && row[0] !== +state.year) return false;
    return !applyCause || matchesCause(row);
  });

  const binDefinitions = () => {
    const step = +state.pyramidAgeStep;
    const count = step === 10 ? 9 : 18;
    return Array.from({ length: count }, (_, index) => {
      const start = index * step;
      const last = index === count - 1;
      return {
        index,
        start,
        end: last ? 110 : start + step - 1,
        label: last ? `${start}+` : `${start}–${start + step - 1}`
      };
    });
  };

  const aggregate = (rows) => {
    const bins = binDefinitions().map((definition) => ({
      ...definition,
      male: { n: 0, pgpzh: 0, ages: [] },
      female: { n: 0, pgpzh: 0, ages: [] }
    }));
    rows.forEach((row) => {
      if (row[1] !== 1 && row[1] !== 2) return;
      const bin = bins.find((item) => row[2] >= item.start && row[2] <= item.end);
      if (!bin) return;
      const target = row[1] === 1 ? bin.male : bin.female;
      target.n += 1;
      target.pgpzh += Math.max(75 - row[2], 0);
      target.ages.push(row[2]);
    });
    const maleTotal = bins.reduce((sum, item) => sum + item.male.n, 0);
    const femaleTotal = bins.reduce((sum, item) => sum + item.female.n, 0);
    bins.forEach((item) => {
      item.male.share = maleTotal ? item.male.n / maleTotal * 100 : 0;
      item.female.share = femaleTotal ? item.female.n / femaleTotal * 100 : 0;
      item.male.value = item.male[state.pyramidMetric] || 0;
      item.female.value = item.female[state.pyramidMetric] || 0;
      item.total = item.male.n + item.female.n;
    });
    return {
      bins,
      maleTotal,
      femaleTotal,
      total: maleTotal + femaleTotal,
      maleMedian: quantile(rows.filter((row) => row[1] === 1).map((row) => row[2]), .5),
      femaleMedian: quantile(rows.filter((row) => row[1] === 2).map((row) => row[2]), .5)
    };
  };

  const leadingClass = (rows) => {
    const counts = new Array(DATA.classes.length).fill(0);
    rows.forEach((row) => {
      const index = classOf(row);
      if (index >= 0) counts[index] += 1;
    });
    const maximum = Math.max(...counts, 0);
    const index = counts.indexOf(maximum);
    return index < 0 || !maximum ? null : { index, count: maximum, definition: DATA.classes[index] };
  };

  const rowPayload = (bin, current, baseline = null) => {
    const male = bin.male;
    const female = bin.female;
    const ratio = female.n ? male.n / female.n : male.n ? null : 0;
    const currentTotal = male.n + female.n;
    const baseBin = baseline?.bins.find((item) => item.index === bin.index);
    const baseTotal = baseBin ? baseBin.total : null;
    const change = baseTotal > 0 ? (currentTotal - baseTotal) / baseTotal * 100 : null;
    const ageRows = periodRows(state.pyramidView === "trend" ? lastYear : null, false)
      .filter((row) => row[2] >= bin.start && row[2] <= bin.end);
    const lead = leadingClass(ageRows);
    const maleShare = current.maleTotal ? male.n / current.maleTotal * 100 : 0;
    const femaleShare = current.femaleTotal ? female.n / current.femaleTotal * 100 : 0;
    const dominance = male.n === female.n
      ? "Число мужских и женских наблюдений одинаково."
      : male.n > female.n
        ? `Мужских наблюдений в ${number(female.n ? male.n / female.n : male.n, 1)} раза больше женских.`
        : `Женских наблюдений в ${number(male.n ? female.n / male.n : female.n, 1)} раза больше мужских.`;
    const trendText = state.pyramidView === "trend"
      ? change == null ? `Для расчёта изменения между ${firstYear} и ${lastYear} недостаточно исходных наблюдений.`
        : change > 0 ? `Между ${firstYear} и ${lastYear} число наблюдений выросло на ${number(change, 1)}%.`
          : change < 0 ? `Между ${firstYear} и ${lastYear} число наблюдений снизилось на ${number(Math.abs(change), 1)}%.`
            : `Между ${firstYear} и ${lastYear} число наблюдений не изменилось.`
      : "";
    return {
      key: `age:${bin.index}`,
      ageIndex: bin.index,
      ageLabel: bin.label,
      start: bin.start,
      end: bin.end,
      total: currentTotal,
      maleN: male.n,
      femaleN: female.n,
      maleShare,
      femaleShare,
      ratio,
      pgpzhMale: male.pgpzh,
      pgpzhFemale: female.pgpzh,
      baselineTotal: baseTotal,
      changePercent: change,
      leadingClass: lead ? `${lead.definition.roman}. ${lead.definition.short}` : "н/д",
      title: `Возраст ${bin.label} лет`,
      subtitle: `${causeLabel()} · ${state.pyramidView === "trend" ? `${firstYear} → ${lastYear}` : state.year === "all" ? `${firstYear}–${lastYear}` : state.year}`,
      primary: { label: "наблюдений в возрастной группе", value: number(currentTotal) },
      change: state.pyramidView === "trend" ? { value: signed(change, "%") } : undefined,
      metrics: [
        { label: "Мужчины", value: `${number(male.n)} · ${number(maleShare, 1)}%`, className: "is-male" },
        { label: "Женщины", value: `${number(female.n)} · ${number(femaleShare, 1)}%`, className: "is-female" },
        { label: "Соотношение М / Ж", value: ratio == null ? "только мужчины" : ratio ? `${number(ratio, 2)} : 1` : "н/д" },
        { label: "Ведущий класс возраста", value: lead ? `${lead.definition.roman}. ${lead.definition.short}` : "н/д", title: lead ? lead.definition.short : "" }
      ],
      details: [
        { label: "ПГПЖ-75 · мужчины", value: number(male.pgpzh) },
        { label: "ПГПЖ-75 · женщины", value: number(female.pgpzh) },
        ...(baseBin ? [
          { label: `${firstYear} · наблюдений`, value: number(baseTotal) },
          { label: `${lastYear} · наблюдений`, value: number(currentTotal) }
        ] : [])
      ],
      insight: `${dominance} ${trendText}${lead ? ` Ведущий класс в этом возрасте — ${lead.definition.roman}. ${lead.definition.short}.` : ""}`.trim()
    };
  };

  const emitContext = (payload) => {
    window.dispatchEvent(new CustomEvent("atlas:inspector-context", { detail: payload }));
  };

  const emitPyramidState = () => {
    window.dispatchEvent(new CustomEvent("atlas:pyramid-state", { detail: getPublicSummary() }));
  };

  const publicContext = (payload, rank, binCount) => payload ? Object.freeze({
    key: String(payload.key),
    ageIndex: Number(payload.ageIndex),
    ageLabel: String(payload.ageLabel),
    start: Number(payload.start),
    end: Number(payload.end),
    total: Number(payload.total) || 0,
    maleN: Number(payload.maleN) || 0,
    femaleN: Number(payload.femaleN) || 0,
    maleShare: Number(payload.maleShare) || 0,
    femaleShare: Number(payload.femaleShare) || 0,
    ratio: payload.ratio == null ? null : Number(payload.ratio),
    pgpzhMale: Number(payload.pgpzhMale) || 0,
    pgpzhFemale: Number(payload.pgpzhFemale) || 0,
    baselineTotal: payload.baselineTotal == null ? null : Number(payload.baselineTotal),
    changePercent: payload.changePercent == null ? null : Number(payload.changePercent),
    leadingClass: String(payload.leadingClass || "н/д"),
    title: String(payload.title),
    subtitle: String(payload.subtitle),
    insight: String(payload.insight || ""),
    rank: Number(rank) || 0,
    binCount: Number(binCount) || 0
  }) : null;

  function getPublicSummary() {
    const model = activePyramidModel;
    const definitions = causeDefinitions();
    const ranked = model
      ? ANALYTICS_CORE.rankItems(model.items, (item) => item.total, (left, right) => right.ageIndex - left.ageIndex)
      : [];
    const rankMap = new Map(ranked.map((item, index) => [item.key, index + 1]));
    const selectedPayload = model?.items.find((item) => item.key === selectedPyramidKey) || ranked[0] || null;
    return Object.freeze({
      active: state.view === "pyramid" && Boolean(model),
      view: String(state.pyramidView),
      level: String(state.pyramidLevel),
      parentClass: String(state.pyramidParentClass),
      cause: String(state.pyramidCause),
      metric: String(state.pyramidMetric),
      ageStep: String(state.pyramidAgeStep),
      labels: String(state.pyramidLabels),
      firstYear,
      lastYear,
      periodLabel: state.pyramidView === "trend" ? `${firstYear} → ${lastYear}` : state.year === "all" ? `${firstYear}–${lastYear}` : String(state.year),
      causeLabel: causeLabel(),
      classOptions: Object.freeze(DATA.classes.map((definition, index) => Object.freeze({
        value: String(index),
        label: `${definition.roman}. ${definition.short}`
      }))),
      causeOptions: Object.freeze(definitions.map((definition) => Object.freeze({
        value: String(definition.index),
        label: `${definition.code} · ${definition.label}`
      }))),
      total: Number(model?.current.total) || 0,
      maleTotal: Number(model?.current.maleTotal) || 0,
      femaleTotal: Number(model?.current.femaleTotal) || 0,
      peakLabel: ranked[0]?.ageLabel || "н/д",
      selected: publicContext(selectedPayload, rankMap.get(selectedPayload?.key), ranked.length),
      topBins: Object.freeze(ranked.slice(0, 5).map((item) => publicContext(item, rankMap.get(item.key), ranked.length)))
    });
  }

  const setPublicOption = (option, value) => {
    const valid = {
      view: new Set(["structure", "trend", "gap"]),
      level: new Set(["class", "block", "code"]),
      metric: new Set(["n", "share", "pgpzh"]),
      ageStep: new Set(["5", "10"]),
      labels: new Set(["major", "all", "off"])
    };
    const next = String(value);
    if (option === "parentClass") {
      if (next !== "all" && !DATA.classes[+next]) return;
      if (String(state.pyramidParentClass) === next) return;
      state.pyramidParentClass = next;
      state.pyramidCause = "all";
    } else if (option === "cause") {
      if (next !== "all" && !causeDefinitions().some((item) => String(item.index) === next)) return;
      if (String(state.pyramidCause) === next) return;
      state.pyramidCause = next;
    } else {
      if (!valid[option]?.has(next)) return;
      const stateKey = {
        view: "pyramidView",
        level: "pyramidLevel",
        metric: "pyramidMetric",
        ageStep: "pyramidAgeStep",
        labels: "pyramidLabels"
      }[option];
      if (!stateKey || String(state[stateKey]) === next) return;
      state[stateKey] = next;
      if (option === "level") {
        state.pyramidParentClass = "all";
        state.pyramidCause = "all";
      }
    }
    selectedPyramidKey = "";
    render();
  };

  const selectPublicItem = (key) => {
    const payload = activePyramidModel?.items.find((item) => item.key === String(key));
    if (!payload) return;
    selectedPyramidKey = payload.key;
    emitContext(payload);
    emitPyramidState();
  };

  const tooltipHtml = (bin, current, baseline = null) => {
    const baseBin = baseline?.bins.find((item) => item.index === bin.index);
    const change = baseBin?.total > 0 ? (bin.total - baseBin.total) / baseBin.total * 100 : null;
    return `<b>${esc(bin.label)} лет</b><div class="tip-grid">`
      + `<span>Мужчины</span><strong>${number(bin.male.n)} · ${number(bin.male.share, 1)}%</strong>`
      + `<span>Женщины</span><strong>${number(bin.female.n)} · ${number(bin.female.share, 1)}%</strong>`
      + `<span>ПГПЖ-75</span><strong>${number(bin.male.pgpzh + bin.female.pgpzh)}</strong>`
      + (baseBin ? `<span>${firstYear} → ${lastYear}</span><strong>${number(baseBin.total)} → ${number(bin.total)} · ${signed(change, "%")}</strong>` : "")
      + `</div>`;
  };

  const setGlobalFiltersDisabled = (disabled, trend = false) => {
    const age = document.getElementById("ageSelect");
    const year = document.getElementById("yearSelect");
    if (age) age.disabled = disabled;
    document.querySelectorAll("#sexSeg button").forEach((button) => { button.disabled = disabled; });
    if (year) year.disabled = disabled && trend;
    document.body.classList.toggle("pyramid-filters-suspended", disabled);
    document.body.classList.toggle("pyramid-trend-mode", disabled && trend);
  };

  const pyramidControls = () => {
    const definitions = causeDefinitions();
    if (state.pyramidCause !== "all" && !definitions.some((item) => String(item.index) === String(state.pyramidCause))) state.pyramidCause = "all";
    const parent = state.pyramidLevel === "class" ? "" : selectField(
      "pyramidParentClass",
      "Класс для детализации",
      classOptions("Все классы"),
      state.pyramidParentClass
    );
    const causeName = state.pyramidLevel === "class" ? "Класс МКБ-10" : state.pyramidLevel === "block" ? "Крупный блок" : "Трёхзначный код";
    els.local.innerHTML = `
      <span class="pyramid-controls__label">Режим анализа</span>
      <div class="pyramid-mode-switch" role="group" aria-label="Режим возрастно-полового анализа">
        <button type="button" data-pyramid-view="structure" aria-pressed="${state.pyramidView === "structure"}"><span>Структура</span><small>один срез</small></button>
        <button type="button" data-pyramid-view="trend" aria-pressed="${state.pyramidView === "trend"}"><span>Динамика</span><small>${firstYear} → ${lastYear}</small></button>
        <button type="button" data-pyramid-view="gap" aria-pressed="${state.pyramidView === "gap"}"><span>Различия</span><small>М / Ж</small></button>
      </div>
      ${selectField("pyramidLevel", "Уровень МКБ-10", [["class", "Классы"], ["block", "Крупные блоки"], ["code", "Трёхзначные коды"]], state.pyramidLevel)}
      ${parent}
      ${selectField("pyramidCause", causeName, [["all", state.pyramidLevel === "class" ? "Все причины" : "Все причины выбранного класса"], ...definitions.map((item) => [item.index, `${item.code} · ${item.label}`])], state.pyramidCause)}
      ${selectField("pyramidMetric", "Показатель", [["n", "Количество смертей"], ["share", "Доля внутри каждого пола"], ["pgpzh", "ПГПЖ-75"]], state.pyramidMetric)}
      <div class="pyramid-control-pair">
        ${selectField("pyramidAgeStep", "Возрастные группы", [["5", "По 5 лет"], ["10", "По 10 лет"]], state.pyramidAgeStep)}
        ${selectField("pyramidLabels", "Подписи значений", [["major", "Ключевые"], ["all", "Все"], ["off", "Скрыть"]], state.pyramidLabels)}
      </div>
      <div class="pyramid-control-note"><strong>Сравнение полов.</strong> Фильтры пола и возраста сверху временно не применяются. ${state.pyramidView === "trend" ? "Режим динамики использует крайние годы набора данных." : "Период задаётся верхним фильтром года."}</div>`;

    els.local.querySelectorAll("[data-pyramid-view]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.pyramidView === button.dataset.pyramidView) return;
        state.pyramidView = button.dataset.pyramidView;
        render();
      });
    });
    ["pyramidLevel", "pyramidParentClass", "pyramidCause", "pyramidMetric", "pyramidAgeStep", "pyramidLabels"].forEach((id) => {
      const control = document.getElementById(id);
      if (!control) return;
      control.addEventListener("change", () => {
        state[id] = control.value;
        if (id === "pyramidLevel") {
          state.pyramidParentClass = "all";
          state.pyramidCause = "all";
        }
        if (id === "pyramidParentClass") state.pyramidCause = "all";
        render();
      });
    });
  };

  localControls = () => {
    const active = state.view === "pyramid";
    els.viz.classList.toggle("pyramid-analysis-host", active);
    if (!active) {
      setGlobalFiltersDisabled(false);
      baseLocalControls();
      return;
    }
    setGlobalFiltersDisabled(true, state.pyramidView === "trend");
    pyramidControls();
  };

  const updatePyramidKpis = (rows) => {
    const summary = stats(rows);
    const linked = rows.filter((row) => row[5] >= 0).length;
    const lead = leadingClass(rows);
    document.getElementById("kpiN").textContent = number(rows.length);
    document.getElementById("kpiAge").textContent = summary.median == null ? "н/д" : `${number(summary.median, 0)} лет`;
    document.getElementById("kpiPgpzh").textContent = number(summary.pgpzh);
    document.getElementById("kpiGeo").textContent = rows.length ? `${number(linked / rows.length * 100, 1)}%` : "н/д";
    document.getElementById("kpiLead").textContent = lead ? lead.definition.roman : "н/д";
  };

  const shouldLabel = (bin, maximumTotal) => {
    if (state.pyramidLabels === "all") return true;
    if (state.pyramidLabels === "off") return false;
    return bin.total === maximumTotal || bin.total >= maximumTotal * .32;
  };

  const addRowInteraction = (group, bin, current, baseline) => {
    const payload = rowPayload(bin, current, baseline);
    group.dataset.inspectorManaged = "true";
    group.dataset.ageKey = payload.key;
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${bin.label} лет. Мужчины: ${bin.male.n}. Женщины: ${bin.female.n}.`);
    const select = () => {
      selectedPyramidKey = payload.key;
      emitContext(payload);
      emitPyramidState();
    };
    group.addEventListener("mouseenter", () => group.classList.add("is-active"));
    group.addEventListener("mouseleave", () => group.classList.remove("is-active"));
    group.addEventListener("focus", () => group.classList.add("is-active"));
    group.addEventListener("blur", () => group.classList.remove("is-active"));
    group.addEventListener("click", select);
    group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select();
    });
    addTip(group, tooltipHtml(bin, current, baseline));
    return payload;
  };

  const renderChart = (current, baseline = null) => {
    const root = document.createElement("div");
    root.className = `pyramid-analysis pyramid-analysis--${state.pyramidView}`;
    const peak = [...current.bins].sort((a, b) => b.total - a.total)[0];
    root.innerHTML = `
      <div class="pyramid-analysis__toolbar">
        <div class="pyramid-analysis__summary"><strong>${esc(causeLabel())}</strong><span>${state.pyramidView === "trend" ? `${firstYear} и ${lastYear}` : state.year === "all" ? `${firstYear}–${lastYear}` : state.year} · ${esc(metricLabel())}</span></div>
        <div class="pyramid-analysis__highlights" aria-label="Ключевые показатели">
          <span><small>Пик профиля</small><b>${peak?.label || "н/д"} лет</b></span>
          <span class="is-male"><small>Мужчины</small><b>${number(current.maleTotal)} наблюдений</b></span>
          <span class="is-female"><small>Женщины</small><b>${number(current.femaleTotal)} наблюдений</b></span>
        </div>
      </div>
      <div class="pyramid-analysis__canvas"></div>
      <div class="pyramid-analysis__footnote">${state.pyramidView === "trend" ? `Светлый контур — ${firstYear}, насыщенная полоса — ${lastYear}.` : state.pyramidView === "gap" ? "Метка в центре показывает соотношение числа мужских и женских наблюдений." : "Шкала слева и справа одинакова; нажмите на возрастную группу для подробного анализа."} Не является коэффициентом риска без половозрастной численности населения.</div>`;

    const canvas = root.querySelector(".pyramid-analysis__canvas");
    const width = Math.max(760, Math.round(els.viz.clientWidth || 1060));
    const height = Math.max(500, Math.round((els.viz.clientHeight || 650) - 116));
    const graphic = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "pyramid-analysis-svg", "aria-label": "Возрастно-половой профиль смертности" });
    const center = width / 2;
    const centerGap = state.pyramidView === "gap" ? 78 : 58;
    const margin = Math.max(62, width * .065);
    const top = 48;
    const bottom = 36;
    const rowHeight = (height - top - bottom) / current.bins.length;
    const barHeight = Math.max(11, Math.min(28, rowHeight * .67));
    const baseMaximum = baseline ? Math.max(...baseline.bins.flatMap((item) => [item.male.value, item.female.value]), 0) : 0;
    const maximum = Math.max(baseMaximum, ...current.bins.flatMap((item) => [item.male.value, item.female.value]), 1);
    const halfWidth = center - centerGap - margin;
    const scale = (value) => value / maximum * halfWidth;
    const maximumTotal = Math.max(...current.bins.map((item) => item.total), 1);

    [0, .25, .5, .75, 1].forEach((fraction) => {
      const distance = halfWidth * fraction;
      [center - centerGap - distance, center + centerGap + distance].forEach((x) => {
        graphic.appendChild(svg("line", { x1: x, y1: top - 14, x2: x, y2: height - bottom + 7, class: fraction ? "pyramid-grid" : "pyramid-axis" }));
      });
      if (fraction) {
        const label = metricValue(maximum * fraction);
        textNode(graphic, center - centerGap - distance, height - 8, label, "pyramid-scale-label", "middle");
        textNode(graphic, center + centerGap + distance, height - 8, label, "pyramid-scale-label", "middle");
      }
    });
    textNode(graphic, center - centerGap - halfWidth / 2, 22, "Мужчины", "pyramid-sex-title is-male", "middle");
    textNode(graphic, center + centerGap + halfWidth / 2, 22, "Женщины", "pyramid-sex-title is-female", "middle");
    textNode(graphic, center, 22, "Возраст", "pyramid-age-title", "middle");

    const itemContexts = [];
    [...current.bins].reverse().forEach((bin, rowIndex) => {
      const y = top + rowIndex * rowHeight;
      const maleWidth = scale(bin.male.value);
      const femaleWidth = scale(bin.female.value);
      const baseBin = baseline?.bins.find((item) => item.index === bin.index);
      const group = svg("g", { class: "pyramid-age-row" });
      group.appendChild(svg("rect", { x: margin - 8, y: y - rowHeight / 2, width: width - (margin - 8) * 2, height: rowHeight, class: "pyramid-row-hit" }));
      group.appendChild(svg("line", { x1: margin, y1: y + rowHeight / 2, x2: width - margin, y2: y + rowHeight / 2, class: "pyramid-row-guide" }));
      if (baseBin) {
        const baseMaleWidth = scale(baseBin.male.value);
        const baseFemaleWidth = scale(baseBin.female.value);
        group.appendChild(svg("rect", { x: center - centerGap - baseMaleWidth, y: y - barHeight / 2, width: baseMaleWidth, height: barHeight, rx: 4, class: "pyramid-bar pyramid-bar--baseline pyramid-bar--male" }));
        group.appendChild(svg("rect", { x: center + centerGap, y: y - barHeight / 2, width: baseFemaleWidth, height: barHeight, rx: 4, class: "pyramid-bar pyramid-bar--baseline pyramid-bar--female" }));
      }
      group.appendChild(svg("rect", { x: center - centerGap - maleWidth, y: y - barHeight * .35, width: maleWidth, height: barHeight * .7, rx: 4, class: "pyramid-bar pyramid-bar--current pyramid-bar--male" }));
      group.appendChild(svg("rect", { x: center + centerGap, y: y - barHeight * .35, width: femaleWidth, height: barHeight * .7, rx: 4, class: "pyramid-bar pyramid-bar--current pyramid-bar--female" }));
      textNode(group, center, y + 3.5, bin.label, "pyramid-age-label", "middle");

      if (state.pyramidView === "gap") {
        const ratio = bin.female.n ? bin.male.n / bin.female.n : null;
        const ratioText = ratio == null ? (bin.male.n ? "только М" : "—") : ratio >= 1 ? `М ×${number(ratio, 1)}` : `Ж ×${number(1 / Math.max(ratio, .01), 1)}`;
        group.appendChild(svg("rect", { x: center - 31, y: y + 7, width: 62, height: 14, rx: 7, class: `pyramid-ratio-pill ${ratio != null && ratio < 1 ? "is-female" : "is-male"}` }));
        textNode(group, center, y + 17, ratioText, "pyramid-ratio-text", "middle");
      }

      if (shouldLabel(bin, maximumTotal)) {
        if (maleWidth > 0) textNode(group, Math.max(margin, center - centerGap - maleWidth - 7), y + 3.5, metricValue(bin.male.value), "pyramid-value-label", "end");
        if (femaleWidth > 0) textNode(group, Math.min(width - margin, center + centerGap + femaleWidth + 7), y + 3.5, metricValue(bin.female.value), "pyramid-value-label", "start");
      }
      graphic.appendChild(group);
      itemContexts.push(addRowInteraction(group, bin, current, baseline));
    });
    canvas.appendChild(graphic);
    activePyramidModel = { current, baseline, items: itemContexts };
    if (!itemContexts.some((item) => item.key === selectedPyramidKey)) {
      selectedPyramidKey = [...itemContexts].sort((left, right) => right.total - left.total)[0]?.key || "";
    }
    return root;
  };

  renderPyramid = () => {
    const currentYear = state.pyramidView === "trend" ? lastYear : null;
    const currentRows = periodRows(currentYear);
    const current = aggregate(currentRows);
    const baseline = state.pyramidView === "trend" ? aggregate(periodRows(firstYear)) : null;
    updatePyramidKpis(state.pyramidView === "trend" ? [...periodRows(firstYear), ...currentRows] : currentRows);
    els.meta.innerHTML = `<span class="chip">${state.pyramidView === "trend" ? `${firstYear} → ${lastYear}` : state.year === "all" ? `${firstYear}–${lastYear}` : state.year}</span><span class="chip">оба пола</span><span class="chip">все возрасты</span><span class="chip">${state.pyramidView === "structure" ? "структура" : state.pyramidView === "trend" ? "динамика" : "различия М / Ж"}</span><span class="chip">${esc(metricLabel())}</span>`;
    if (!current.total && !(baseline?.total)) {
      activePyramidModel = null;
      selectedPyramidKey = "";
      els.viz.innerHTML = '<div class="pyramid-analysis__empty">Нет данных для выбранной причины и периода.</div>';
      window.dispatchEvent(new CustomEvent("atlas:inspector-context", { detail: null }));
      emitPyramidState();
      return;
    }
    els.viz.appendChild(renderChart(current, baseline));
    window.dispatchEvent(new CustomEvent("atlas:inspector-context", { detail: null }));
    emitPyramidState();
  };

  window.AmurPyramidAnalysis = Object.freeze({
    getSummary: getPublicSummary,
    setOption: setPublicOption,
    selectItem: selectPublicItem
  });
})();
