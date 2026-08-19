(() => {
  "use strict";

  if (
    typeof state === "undefined"
    || typeof DATA === "undefined"
    || typeof renderTreemap !== "function"
    || typeof localControls !== "function"
  ) return;

  state.treeSort ??= "value";
  state.treeShowValues ??= true;
  state.treeMinShare ??= .5;

  VIEWS.treemap = [
    "Treemap МКБ-10",
    "Последовательный анализ: класс → крупный блок → трёхзначный код. Первый клик показывает сведения, повторный быстрый клик открывает следующий уровень."
  ];
  METHOD.treemap = "Площадь плитки кодирует выбранный показатель. Три уровня иерархии переключаются явно. Малые категории не скрываются: при выбранном пороге они объединяются в плитку «Прочие».";

  const originalLocalControls = localControls;
  let selectedKey = "";
  let pendingSelectionKey = "";
  let lastTileClickKey = "";
  let lastTileClickAt = 0;
  let lastModel = null;
  let lastModelKey = "";
  let activeModel = null;
  let activeSelected = null;
  let activeChildren = [];

  const emitTreemapState = () => queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("atlas:treemap-state"));
  });

  const escapeHtml = (value) => esc(value);
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const currentScopeKey = () => `${state.treeType}:${state.treeIndex}`;
  const resetTileClick = () => {
    lastTileClickKey = "";
    lastTileClickAt = 0;
  };
  const periodYearCount = () => state.year === "all" ? Math.max(1, DATA.years.length) : 1;
  const annualRate = (count) => DATA.populationTotal > 0
    ? count / DATA.populationTotal / periodYearCount() * 100000
    : null;

  const mix = (first, second, amount) => {
    const parse = (color) => {
      const normalized = String(color || "#607d9d").replace("#", "");
      if (normalized.length === 3) return normalized.split("").map((part) => parseInt(part + part, 16));
      return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
    };
    const left = parse(first);
    const right = parse(second);
    const ratio = Math.max(0, Math.min(1, numeric(amount)));
    return `rgb(${left.map((channel, index) => Math.round(channel * (1 - ratio) + right[index] * ratio)).join(",")})`;
  };

  const definitionsFor = (scopeType, parentIndex) => {
    if (scopeType === "root") {
      return DATA.classes.map((definition, index) => ({
        i: index,
        key: `root:${index}`,
        scopeType,
        entityType: "class",
        code: definition.roman,
        label: definition.short,
        color: definition.color,
        classIndex: index,
        blockIndex: -1,
        nextScope: "class"
      }));
    }
    if (scopeType === "class") {
      return DATA.blocks
        .map((definition, index) => ({ definition, index }))
        .filter(({ definition }) => definition.class === parentIndex)
        .map(({ definition, index }) => ({
          i: index,
          key: `class:${index}`,
          scopeType,
          entityType: "block",
          code: definition.code,
          label: definition.label,
          color: DATA.classes[definition.class]?.color || "#607d9d",
          classIndex: definition.class,
          blockIndex: index,
          nextScope: "block"
        }));
    }
    return DATA.codes
      .map((definition, index) => ({ definition, index }))
      .filter(({ definition }) => definition.block === parentIndex)
      .map(({ definition, index }) => ({
        i: index,
        key: `block:${index}`,
        scopeType,
        entityType: "code",
        code: definition.code,
        label: definition.label,
        color: DATA.classes[definition.class]?.color || "#607d9d",
        classIndex: definition.class,
        blockIndex: definition.block,
        nextScope: null
      }));
  };

  const indexForRow = (row, scopeType) => scopeType === "root"
    ? classOf(row)
    : scopeType === "class" ? blockOf(row) : row[3];

  const metricValue = (summary, totalRows) => {
    if (state.treeMetric === "share") return summary.n / Math.max(totalRows, 1) * 100;
    if (state.treeMetric === "pgpzh") return summary.pgpzh;
    if (state.treeMetric === "rate") return annualRate(summary.n) || 0;
    return summary.n;
  };

  const changeValue = (entry) => {
    const available = DATA.years;
    let firstYear = available[0];
    let secondYear = available[available.length - 1];
    if (state.year !== "all") {
      secondYear = +state.year;
      firstYear = Math.max(available[0], secondYear - 1);
      if (firstYear === secondYear) return null;
    }
    const usePgpzh = state.treeMetric === "pgpzh";
    const first = usePgpzh ? entry.yearPgpzh.get(firstYear) || 0 : entry.yearCounts.get(firstYear) || 0;
    const second = usePgpzh ? entry.yearPgpzh.get(secondYear) || 0 : entry.yearCounts.get(secondYear) || 0;
    return first > 0 ? (second - first) / first * 100 : null;
  };

  const aggregateItems = (scopeType, parentIndex) => {
    const definitions = definitionsFor(scopeType, parentIndex);
    const currentRows = filtered();
    const allPeriodRows = filtered({ ignoreYear: true });
    const map = new Map(definitions.map((definition) => [definition.i, {
      ...definition,
      rows: [],
      yearCounts: new Map(DATA.years.map((year) => [year, 0])),
      yearPgpzh: new Map(DATA.years.map((year) => [year, 0]))
    }]));

    currentRows.forEach((row) => {
      const entry = map.get(indexForRow(row, scopeType));
      if (entry) entry.rows.push(row);
    });
    allPeriodRows.forEach((row) => {
      const entry = map.get(indexForRow(row, scopeType));
      if (!entry || !entry.yearCounts.has(row[0])) return;
      entry.yearCounts.set(row[0], entry.yearCounts.get(row[0]) + 1);
      if (row[2] >= 0) entry.yearPgpzh.set(row[0], entry.yearPgpzh.get(row[0]) + Math.max(75 - row[2], 0));
    });

    const items = [...map.values()]
      .filter((entry) => entry.rows.length)
      .map((entry) => {
        const summary = stats(entry.rows);
        const value = metricValue(summary, currentRows.length);
        return {
          ...entry,
          ...summary,
          value,
          rate: annualRate(summary.n),
          share: summary.n / Math.max(currentRows.length, 1) * 100,
          change: changeValue(entry),
          series: DATA.years.map((year) => entry.yearCounts.get(year) || 0),
          match: (row) => indexForRow(row, scopeType) === entry.i
        };
      })
      .filter((entry) => entry.value > 0);

    return { items, currentRows };
  };

  const aggregateOther = (items, scopeType) => {
    const rows = items.flatMap((item) => item.rows);
    const summary = stats(rows);
    const yearCounts = new Map(DATA.years.map((year) => [
      year,
      items.reduce((sum, item) => sum + (item.yearCounts.get(year) || 0), 0)
    ]));
    const yearPgpzh = new Map(DATA.years.map((year) => [
      year,
      items.reduce((sum, item) => sum + (item.yearPgpzh.get(year) || 0), 0)
    ]));
    const synthetic = {
      i: -1,
      key: `other:${scopeType}:${state.treeIndex}`,
      scopeType,
      entityType: "other",
      code: "Прочие",
      label: `${items.length} малых категорий`,
      color: "#718096",
      classIndex: -1,
      blockIndex: -1,
      nextScope: null,
      synthetic: true,
      children: items,
      rows,
      yearCounts,
      yearPgpzh,
      ...summary,
      value: items.reduce((sum, item) => sum + item.value, 0),
      rate: annualRate(summary.n),
      share: items.reduce((sum, item) => sum + item.share, 0),
      series: DATA.years.map((year) => yearCounts.get(year) || 0)
    };
    synthetic.change = changeValue(synthetic);
    return synthetic;
  };

  const sortItems = (items) => [...items].sort((left, right) => {
    if (state.treeSort === "name") {
      return `${left.code} ${left.label}`.localeCompare(`${right.code} ${right.label}`, "ru");
    }
    if (state.treeSort === "change") {
      return (right.change ?? -Infinity) - (left.change ?? -Infinity);
    }
    return right.value - left.value;
  });

  const modelCacheKey = () => [
    state.year,
    state.sex,
    state.age,
    state.treeType,
    state.treeIndex,
    state.treeMetric,
    state.treeSort,
    state.treeMinShare
  ].join("|");

  const buildModel = (force = false) => {
    const cacheKey = modelCacheKey();
    if (!force && lastModel && cacheKey === lastModelKey) return lastModel;
    const aggregate = aggregateItems(state.treeType, state.treeIndex);
    const rawItems = sortItems(aggregate.items);
    const totalValue = rawItems.reduce((sum, item) => sum + item.value, 0);
    const threshold = Math.max(0, numeric(state.treeMinShare));
    const small = threshold > 0
      ? rawItems.filter((item) => item.value / Math.max(totalValue, 1) * 100 < threshold)
      : [];
    const large = small.length >= 2 ? rawItems.filter((item) => !small.includes(item)) : rawItems;
    const items = small.length >= 2
      ? sortItems([...large, aggregateOther(small, state.treeType)])
      : rawItems;
    lastModel = {
      key: cacheKey,
      scopeKey: currentScopeKey(),
      rawItems,
      items,
      currentRows: aggregate.currentRows,
      totalValue: items.reduce((sum, item) => sum + item.value, 0),
      totalRows: aggregate.currentRows.length
    };
    lastModelKey = cacheKey;
    return lastModel;
  };

  const formattedMetric = (item) => {
    if (state.treeMetric === "share") return pct(item.value);
    if (state.treeMetric === "rate") return item.value == null ? "н/д" : DF.format(item.value);
    return fmt(item.value);
  };

  const metricUnit = () => state.treeMetric === "share"
    ? "доля выборки"
    : state.treeMetric === "pgpzh" ? "ПГПЖ-75"
      : state.treeMetric === "rate" ? "на 100 тыс. · в среднем за год"
        : "смертей";

  const tileColor = (item, maximum) => {
    if (state.treeColor === "age") return ageColor(item.median);
    if (state.treeColor === "change") return changeColor(item.change, item.color);
    const intensity = Math.sqrt(item.n / Math.max(maximum, 1));
    return mix(item.color, "#172d47", .7 - intensity * .58);
  };

  const hierarchyContext = () => {
    if (state.treeType === "root") return "Все классы МКБ-10";
    if (state.treeType === "class") {
      const definition = DATA.classes[state.treeIndex];
      return `${definition?.roman || ""}. ${definition?.short || ""}`;
    }
    const block = DATA.blocks[state.treeIndex];
    const cls = DATA.classes[block?.class];
    return `${cls?.roman || ""} → ${block?.code || ""}`;
  };

  const classIndexFromContext = (model = buildModel()) => {
    if (state.treeType === "class") return state.treeIndex;
    if (state.treeType === "block") return DATA.blocks[state.treeIndex]?.class ?? -1;
    const selected = model.items.find((item) => item.key === selectedKey && !item.synthetic);
    return selected?.classIndex ?? model.rawItems[0]?.classIndex ?? -1;
  };

  const blockIndexFromContext = (model = buildModel()) => {
    if (state.treeType === "block") return state.treeIndex;
    const selected = model.items.find((item) => item.key === selectedKey && !item.synthetic);
    if (state.treeType === "class" && selected?.entityType === "block") return selected.blockIndex;
    const classIndex = classIndexFromContext(model);
    if (classIndex < 0) return -1;
    return aggregateItems("class", classIndex).items.sort((a, b) => b.n - a.n)[0]?.blockIndex ?? -1;
  };

  const goToLevel = (target) => {
    const model = activeModel || buildModel();
    if (target === "root") {
      state.treeType = "root";
      state.treeIndex = -1;
    } else if (target === "class") {
      const classIndex = classIndexFromContext(model);
      if (classIndex < 0) return;
      state.treeType = "class";
      state.treeIndex = classIndex;
    } else {
      const blockIndex = blockIndexFromContext(model);
      if (blockIndex < 0) return;
      state.treeType = "block";
      state.treeIndex = blockIndex;
    }
    selectedKey = "";
    pendingSelectionKey = "";
    resetTileClick();
    lastModel = null;
    render();
  };

  localControls = () => {
    if (state.view !== "treemap") {
      originalLocalControls();
      return;
    }
    const context = hierarchyContext();
    els.local.innerHTML = `
      <div class="treev2-controls">
        <div>
          <div class="treev2-levels" role="group" aria-label="Уровень иерархии МКБ-10">
            <button class="treev2-level-button ${state.treeType === "root" ? "active" : ""}" type="button" data-tree-level="root"><b>1</b><span>Классы</span></button>
            <button class="treev2-level-button ${state.treeType === "class" ? "active" : ""}" type="button" data-tree-level="class"><b>2</b><span>Блоки</span></button>
            <button class="treev2-level-button ${state.treeType === "block" ? "active" : ""}" type="button" data-tree-level="block"><b>3</b><span>Коды</span></button>
          </div>
          <p class="treev2-context">Текущий контекст: <b>${escapeHtml(context)}</b></p>
        </div>
        ${selectField("treeMetric", "Размер плитки", [
          ["n", "Количество смертей"],
          ["share", "Доля выборки"],
          ["pgpzh", "ПГПЖ-75"],
          ["rate", "На 100 тыс. · в среднем за год"]
        ], state.treeMetric)}
        ${selectField("treeColor", "Цвет плитки", [
          ["count", "Объём наблюдений"],
          ["change", "Изменение между периодами"],
          ["age", "Медианный возраст"]
        ], state.treeColor)}
        ${selectField("treeSort", "Порядок категорий", [
          ["value", "По убыванию значения"],
          ["name", "По коду и названию"],
          ["change", "По изменению"]
        ], state.treeSort)}
        <label class="treev2-check"><input id="treeShowValues" type="checkbox" ${state.treeShowValues ? "checked" : ""}><span>Показывать значения на плитках</span></label>
        <div class="field">
          <div class="treev2-range-head"><label for="treeMinShare">Объединять малые категории</label><output id="treeMinShareValue">${DF.format(numeric(state.treeMinShare))}%</output></div>
          <input id="treeMinShare" type="range" min="0" max="3" step="0.1" value="${numeric(state.treeMinShare)}">
          <small>Категории меньше порога объединяются в «Прочие» и не теряются.</small>
        </div>
        <button class="treev2-reset" id="treeReset" type="button">Сбросить настройки Treemap</button>
      </div>`;

    ["treeMetric", "treeColor", "treeSort"].forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.onchange = () => {
        state[id] = element.value;
        lastModel = null;
        render();
      };
    });
    document.querySelectorAll("[data-tree-level]").forEach((button) => {
      button.onclick = () => goToLevel(button.dataset.treeLevel);
    });
    const showValues = document.getElementById("treeShowValues");
    if (showValues) showValues.onchange = () => {
      state.treeShowValues = showValues.checked;
      renderTreemap();
    };
    const range = document.getElementById("treeMinShare");
    const rangeOutput = document.getElementById("treeMinShareValue");
    if (range) {
      range.oninput = () => {
        if (rangeOutput) rangeOutput.value = `${DF.format(+range.value)}%`;
      };
      range.onchange = () => {
        state.treeMinShare = +range.value;
        lastModel = null;
        render();
      };
    }
    const reset = document.getElementById("treeReset");
    if (reset) reset.onclick = () => {
      state.treeType = "root";
      state.treeIndex = -1;
      state.treeMetric = "n";
      state.treeColor = "count";
      state.treeSort = "value";
      state.treeShowValues = true;
      state.treeMinShare = .5;
      selectedKey = "";
      resetTileClick();
      lastModel = null;
      render();
    };
  };

  const pathParts = () => {
    const parts = [{ type: "root", label: "Все классы", current: state.treeType === "root" }];
    if (state.treeType !== "root") {
      const classIndex = state.treeType === "class"
        ? state.treeIndex
        : DATA.blocks[state.treeIndex]?.class;
      const cls = DATA.classes[classIndex];
      parts.push({
        type: "class",
        label: `${cls?.roman || ""} · ${cls?.short || ""}`,
        current: state.treeType === "class"
      });
    }
    if (state.treeType === "block") {
      const block = DATA.blocks[state.treeIndex];
      parts.push({ type: "block", label: `${block?.code || ""} · ${block?.label || ""}`, current: true });
    }
    return parts;
  };

  const pathHtml = () => pathParts().map((part, index) => `
      ${index ? '<span class="treev2-chevron" aria-hidden="true">›</span>' : ""}
      <button class="treev2-crumb ${part.current ? "current" : ""}" type="button" data-tree-crumb="${part.type}" title="${escapeHtml(part.label)}">${escapeHtml(part.label)}</button>
    `).join("");

  const sparkline = (series, color) => {
    const width = 116;
    const height = 34;
    const padding = 3;
    const minimum = Math.min(...series, 0);
    const maximum = Math.max(...series, 1);
    const points = series.map((value, index) => {
      const x = padding + index * (width - padding * 2) / Math.max(series.length - 1, 1);
      const y = height - padding - (value - minimum) / Math.max(maximum - minimum, 1) * (height - padding * 2);
      return [x, y];
    });
    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Динамика количества смертей по годам">
        <path d="M${padding},${height - padding}H${width - padding}" fill="none" stroke="#dce4ef" stroke-width="1"/>
        <polyline points="${points.map((point) => point.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>
        ${points.map((point) => `<circle cx="${point[0]}" cy="${point[1]}" r="2.2" fill="#fff" stroke="${color}" stroke-width="1.5"/>`).join("")}
      </svg>`;
  };

  const inspectorLegend = (selected) => {
    const base = selected?.color || "#607d9d";
    let colors;
    let left;
    let right;
    if (state.treeColor === "age") {
      colors = [35, 47, 59, 71, 83].map(ageColor);
      left = "младше";
      right = "старше";
    } else if (state.treeColor === "change") {
      colors = [
        mix(base, "#ffffff", .55),
        mix(base, "#ffffff", .3),
        base,
        mix(base, "#172d47", .28),
        mix(base, "#172d47", .5)
      ];
      left = "снижение";
      right = "рост";
    } else {
      colors = [.74, .6, .46, .32, .18].map((amount) => mix(base, "#172d47", amount));
      left = "меньше";
      right = "больше";
    }
    return `
      <div class="treev2-inspector-section">
        <h4>Как читать цвет</h4>
        <div class="treev2-legend-bar">${colors.map((color) => `<span style="background:${color}"></span>`).join("")}</div>
        <div class="treev2-legend-copy"><span>${left}</span><span>${state.treeColor === "age" ? "медианный возраст" : state.treeColor === "change" ? "изменение" : "объём наблюдений"}</span><span>${right}</span></div>
      </div>`;
  };

  const childItemsFor = (item, model) => {
    if (item.synthetic) return item.children || [];
    if (item.entityType === "class") return sortItems(aggregateItems("class", item.classIndex).items);
    if (item.entityType === "block") return sortItems(aggregateItems("block", item.blockIndex).items);
    return model.rawItems.filter((candidate) => candidate.key !== item.key);
  };

  const rankListHtml = (items) => items.slice(0, 6).map((item, index) => `
    <button class="treev2-rank" type="button" data-tree-rank="${escapeHtml(item.key)}">
      <span class="treev2-rank-index">${index + 1}</span>
      <span class="treev2-rank-name"><b>${escapeHtml(item.code)}</b><span>${escapeHtml(item.label)}</span></span>
      <span class="treev2-rank-value">${fmt(item.n)}</span>
    </button>`).join("");

  const drillLabel = (item) => item.entityType === "class"
    ? "Открыть крупные блоки"
    : item.entityType === "block" ? "Открыть трёхзначные коды" : "";

  const openItem = (item, selectionAfterOpen = "") => {
    if (!item || item.synthetic || !item.nextScope) return;
    resetTileClick();
    state.treeType = item.nextScope;
    state.treeIndex = item.i;
    pendingSelectionKey = selectionAfterOpen;
    selectedKey = "";
    lastModel = null;
    render();
  };

  const renderInspector = (model, selected) => {
    const inspector = document.getElementById("treeInspector");
    if (!selected) return;
    const change = selected.change;
    const changeClass = change == null ? "" : change > 0 ? "positive" : "negative";
    const children = childItemsFor(selected, model);
    activeSelected = selected;
    activeChildren = children;
    if (!inspector) return;
    if (inspector.parentElement?.classList.contains("is-react-owned")) return;
    const primary = formattedMetric(selected);
    const unit = metricUnit();
    const drill = drillLabel(selected);
    const sparkColor = tileColor(selected, Math.max(...model.items.map((item) => item.n), 1));
    inspector.innerHTML = `
      <div class="treev2-inspector-section">
        <span class="treev2-inspector-kicker">Выбранная категория</span>
        <div class="treev2-selection-head">
          <span class="treev2-swatch" style="background:${sparkColor}"></span>
          <div><h3>${escapeHtml(selected.code)}</h3><p>${escapeHtml(selected.label)}</p></div>
        </div>
        <div class="treev2-primary"><strong>${primary}</strong><span>${escapeHtml(unit)}</span></div>
        <div class="treev2-metrics">
          <div class="treev2-metric"><span>Абсолютное число</span><b>${fmt(selected.n)}</b></div>
          <div class="treev2-metric"><span>Доля выборки</span><b>${pct(selected.share)}</b></div>
          <div class="treev2-metric"><span>На 100 тыс. в год</span><b>${selected.rate == null ? "н/д" : DF.format(selected.rate)}</b></div>
          <div class="treev2-metric"><span>Медианный возраст</span><b>${selected.median == null ? "н/д" : `${DF.format(selected.median)} года`}</b></div>
          <div class="treev2-metric"><span>ПГПЖ-75</span><b>${fmt(selected.pgpzh)}</b></div>
          <div class="treev2-metric"><span>Изменение</span><b class="treev2-change ${changeClass}">${change == null ? "н/д" : `${change > 0 ? "+" : ""}${DF.format(change)}%`}</b></div>
        </div>
        <div class="treev2-sparkline-wrap">
          ${sparkline(selected.series, sparkColor)}
          <small>${DATA.years.join(" → ")}<br>${selected.series.map(fmt).join(" · ")}</small>
        </div>
        ${drill ? `<button class="treev2-drill" id="treeDrill" type="button">${drill} →</button>` : ""}
      </div>
      ${inspectorLegend(selected)}
      <div class="treev2-inspector-section">
        <h4>${selected.entityType === "code" ? "Другие коды текущего блока" : selected.synthetic ? "Состав группы «Прочие»" : "Крупнейшие дочерние категории"}</h4>
        <div class="treev2-rank-list">${children.length ? rankListHtml(children) : '<div class="treev2-context">Нет дочерних категорий для текущего фильтра.</div>'}</div>
      </div>`;

    const drillButton = document.getElementById("treeDrill");
    if (drillButton) drillButton.onclick = () => openItem(selected);
    inspector.querySelectorAll("[data-tree-rank]").forEach((button) => {
      button.onclick = () => {
        const child = children.find((item) => item.key === button.dataset.treeRank);
        if (!child) return;
        if (selected.entityType === "class" || selected.entityType === "block") {
          openItem(selected, child.key);
          return;
        }
        resetTileClick();
        selectedKey = child.key;
        selectItemInCurrentView(model, child);
      };
    });
  };

  const selectItemInCurrentView = (model, item) => {
    selectedKey = item.key;
    document.querySelectorAll(".treev2-canvas .tile").forEach((tile) => {
      const active = tile.dataset.treeKey === selectedKey;
      tile.classList.toggle("is-selected", active);
      tile.setAttribute("aria-pressed", String(active));
    });
    renderInspector(model, item);
    emitTreemapState();
  };

  const activateTile = (model, item) => {
    const now = performance.now();
    const repeatedClick = lastTileClickKey === item.key && now - lastTileClickAt <= 950;
    selectItemInCurrentView(model, item);
    if (repeatedClick && item.nextScope && !item.synthetic) {
      openItem(item);
      return;
    }
    lastTileClickKey = item.key;
    lastTileClickAt = now;
  };

  const renderTiles = (model) => {
    const canvas = document.getElementById("treeCanvas");
    if (!canvas) return;
    const width = Math.max(420, canvas.clientWidth);
    const height = Math.max(360, canvas.clientHeight);
    const maximum = Math.max(...model.items.map((item) => item.n), 1);
    if (!model.items.length) {
      canvas.innerHTML = '<div class="treev2-empty">Нет данных для выбранных фильтров.</div>';
      return;
    }
    binaryLayout(model.items, 0, 0, width, height).forEach((item) => {
      const gap = 1.2;
      const tileWidth = Math.max(0, item.w - gap * 2);
      const tileHeight = Math.max(0, item.h - gap * 2);
      const tile = document.createElement("button");
      const densityClass = tileWidth < 70 || tileHeight < 32
        ? " tiny"
        : tileWidth < 145 || tileHeight < 68 ? " small" : "";
      tile.type = "button";
      tile.className = `tile treev2-tile${densityClass}${item.key === selectedKey ? " is-selected" : ""}`;
      tile.dataset.treeKey = item.key;
      tile.setAttribute("aria-pressed", String(item.key === selectedKey));
      tile.setAttribute("aria-label", `${item.code}. ${item.label}. ${formattedMetric(item)} ${metricUnit()}`);
      Object.assign(tile.style, {
        left: `${item.x + gap}px`,
        top: `${item.y + gap}px`,
        width: `${tileWidth}px`,
        height: `${tileHeight}px`,
        background: tileColor(item, maximum)
      });
      tile.innerHTML = `
        <span class="tile-inner">
          <span><span class="tile-code">${escapeHtml(item.code)}</span><span class="tile-label">${escapeHtml(item.label)}</span></span>
          ${state.treeShowValues ? `<span class="tile-value"><b>${formattedMetric(item)}</b><span>${pct(item.n / Math.max(model.totalRows, 1) * 100)}</span></span>` : ""}
        </span>`;
      addTip(tile, `
        <b>${escapeHtml(item.code)} · ${escapeHtml(item.label)}</b>
        <div class="tip-grid">
          <span>Смертей</span><strong>${fmt(item.n)}</strong>
          <span>Доля фильтра</span><strong>${pct(item.share)}</strong>
          <span>На 100 тыс. в год</span><strong>${item.rate == null ? "н/д" : DF.format(item.rate)}</strong>
          <span>ПГПЖ-75</span><strong>${fmt(item.pgpzh)}</strong>
          <span>Медианный возраст</span><strong>${item.median == null ? "н/д" : DF.format(item.median)}</strong>
          <span>Изменение</span><strong>${item.change == null ? "н/д" : `${item.change > 0 ? "+" : ""}${DF.format(item.change)}%`}</strong>
        </div>`);
      tile.onclick = () => activateTile(model, item);
      canvas.appendChild(tile);
    });
  };

  renderTreemap = () => {
    resetTileClick();
    const model = buildModel();
    activeModel = model;
    if (pendingSelectionKey && model.items.some((item) => item.key === pendingSelectionKey)) {
      selectedKey = pendingSelectionKey;
      pendingSelectionKey = "";
    }
    if (!model.items.some((item) => item.key === selectedKey)) {
      selectedKey = model.items.find((item) => !item.synthetic)?.key || model.items[0]?.key || "";
    }
    const selected = model.items.find((item) => item.key === selectedKey) || model.items[0];
    els.viz.innerHTML = `
      <div class="treemap-v2-layout">
        <section class="treev2-stage" aria-label="Иерархическая карта МКБ-10">
          <div class="treev2-pathbar">
            <div class="react-treemap-breadcrumbs-host" data-react-treemap-breadcrumbs hidden></div>
            <div class="treev2-pathbar-fallback" data-legacy-treemap-breadcrumbs>
              <nav class="treev2-breadcrumbs" aria-label="Путь по иерархии МКБ-10">${pathHtml()}</nav>
              <span class="treev2-path-help">Первый клик — сведения · повторный — открыть</span>
            </div>
          </div>
          <div class="treev2-canvas" id="treeCanvas"></div>
        </section>
        <aside class="treev2-inspector" aria-label="Аналитика выбранной категории">
          <div class="react-treemap-inspector-host" data-react-treemap-inspector hidden></div>
          <div class="treev2-inspector-fallback" id="treeInspector" data-legacy-treemap-inspector></div>
        </aside>
      </div>`;

    document.querySelectorAll("[data-tree-crumb]").forEach((button) => {
      button.onclick = () => goToLevel(button.dataset.treeCrumb);
    });
    renderTiles(model);
    renderInspector(model, selected);
    els.meta.insertAdjacentHTML("beforeend", `<span class="chip">${state.treeType === "root" ? "1 · классы" : state.treeType === "class" ? "2 · блоки" : "3 · коды"}</span>`);
    emitTreemapState();
  };

  treeItems = () => buildModel().items;

  const publicItem = (item) => item ? Object.freeze({
    key: String(item.key),
    code: String(item.code),
    label: String(item.label),
    color: String(tileColor(item, Math.max(...(activeModel || buildModel()).items.map((entry) => entry.n), 1))),
    entityType: String(item.entityType),
    metricValue: String(formattedMetric(item)),
    metricUnit: String(metricUnit()),
    deaths: numeric(item.n),
    share: numeric(item.share),
    rate: item.rate == null ? null : numeric(item.rate),
    medianAge: item.median == null ? null : numeric(item.median),
    pgpzh75: numeric(item.pgpzh),
    change: item.change == null ? null : numeric(item.change),
    series: Object.freeze([...(item.series || [])].map(numeric)),
    drillLabel: drillLabel(item)
  }) : null;

  const getPublicSummary = () => {
    const model = activeModel || buildModel();
    const selected = activeSelected?.key === selectedKey
      ? activeSelected
      : model.items.find((item) => item.key === selectedKey) || model.items[0] || null;
    const childSource = activeSelected?.key === selected?.key
      ? activeChildren
      : selected ? childItemsFor(selected, model) : [];
    const children = childSource.slice(0, 6).map(publicItem);
    return Object.freeze({
      active: state.view === "treemap",
      level: String(state.treeType),
      metric: String(state.treeMetric),
      color: String(state.treeColor),
      sort: String(state.treeSort),
      showValues: Boolean(state.treeShowValues),
      minShare: numeric(state.treeMinShare),
      contextLabel: hierarchyContext(),
      breadcrumbs: Object.freeze(pathParts().map((part) => Object.freeze({
        level: String(part.type),
        label: String(part.label),
        current: Boolean(part.current)
      }))),
      selected: publicItem(selected),
      children: Object.freeze(children)
    });
  };

  const setPublicOption = (option, value) => {
    const property = {
      metric: "treeMetric",
      color: "treeColor",
      sort: "treeSort",
      showValues: "treeShowValues",
      minShare: "treeMinShare"
    }[option];
    if (!property) return;
    const valid = {
      metric: new Set(["n", "share", "pgpzh", "rate"]),
      color: new Set(["count", "change", "age"]),
      sort: new Set(["value", "name", "change"])
    }[option];
    let next = value;
    if (valid && !valid.has(String(value))) return;
    if (option === "showValues") next = Boolean(value);
    if (option === "minShare") next = Math.max(0, Math.min(3, numeric(value)));
    if (state[property] === next) return;
    state[property] = next;
    lastModel = null;
    if (option === "showValues") renderTreemap();
    else render();
  };

  const resetPublic = () => {
    state.treeType = "root";
    state.treeIndex = -1;
    state.treeMetric = "n";
    state.treeColor = "count";
    state.treeSort = "value";
    state.treeShowValues = true;
    state.treeMinShare = .5;
    selectedKey = "";
    pendingSelectionKey = "";
    resetTileClick();
    lastModel = null;
    render();
  };

  const selectPublicChild = (key) => {
    const model = activeModel || buildModel();
    const selected = model.items.find((item) => item.key === selectedKey) || model.items[0];
    if (!selected) return;
    const child = childItemsFor(selected, model).find((item) => item.key === key);
    if (!child) return;
    if (selected.entityType === "class" || selected.entityType === "block") {
      openItem(selected, child.key);
      return;
    }
    selectItemInCurrentView(model, child);
  };

  window.AmurTreemapV2 = Object.freeze({
    getSummary: getPublicSummary,
    setOption: setPublicOption,
    setLevel: goToLevel,
    reset: resetPublic,
    drill: () => {
      const model = activeModel || buildModel();
      const selected = model.items.find((item) => item.key === selectedKey) || model.items[0];
      openItem(selected);
    },
    selectChild: selectPublicChild
  });
})();
