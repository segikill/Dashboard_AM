(() => {
  "use strict";

  if (
    typeof state === "undefined"
    || typeof DATA === "undefined"
    || typeof renderHeatmap !== "function"
    || typeof territoryAggregate !== "function"
  ) return;

  let selectedKey = "";
  let activeModel = null;
  let activeSelected = null;

  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const escapeHtml = (value) => esc(value);
  const emitHeatmapState = () => queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("atlas:heatmap-state"));
  });

  const cellKey = (unit, territoryIndex, classIndex) => `${unit}:${territoryIndex}:${classIndex}`;
  const typeOrder = { city: 0, urban_settlement: 1, district: 2 };
  const groupNames = {
    city: "Города",
    urban_settlement: "Посёлки городского типа",
    district: "Районы"
  };

  const cellValue = (row, definition, classIndex) => {
    if (state.heatMetric === "share") return row.total ? row.classes[classIndex] / row.total * 100 : 0;
    if (rateBase(state.heatMetric)) return rateValue(row.classes[classIndex], definition, state.heatMetric);
    return row.classes[classIndex];
  };

  const buildModel = () => {
    const { defs, table } = territoryAggregate(state.heatUnit);
    const isMunicipality = state.heatUnit === "mo";
    const emptyRow = (idx) => ({ idx, total: 0, classes: new Array(DATA.classes.length).fill(0), rows: [] });
    const rowMetric = (row) => rateBase(state.heatMetric)
      ? (rateValue(row.total, defs[row.idx], state.heatMetric) ?? -1)
      : row.total;
    const stableCompare = (left, right) => {
      const leftDefinition = defs[left.idx];
      const rightDefinition = defs[right.idx];
      const typeDelta = (typeOrder[leftDefinition.municipalityType] ?? 2)
        - (typeOrder[rightDefinition.municipalityType] ?? 2);
      return typeDelta || leftDefinition.name.localeCompare(rightDefinition.name, "ru-RU");
    };
    const rows = isMunicipality
      ? defs.map((_, idx) => table.get(idx) || emptyRow(idx)).sort(stableCompare)
      : [...table.values()].sort((left, right) => rowMetric(right) - rowMetric(left));
    const limit = state.heatLimit === "all" ? rows.length : numeric(state.heatLimit);
    const shown = isMunicipality ? rows : rows.slice(0, limit);
    const stableClasses = new Set(DATA.records.filter((row) => row[4] >= 0).map(classOf));
    const classes = DATA.classes
      .map((_, index) => index)
      .filter((index) => isMunicipality ? stableClasses.has(index) : shown.some((row) => row.classes[index]));
    const cells = [];
    shown.forEach((row) => {
      const definition = defs[row.idx];
      classes.forEach((classIndex) => {
        const value = cellValue(row, definition, classIndex);
        cells.push({
          key: cellKey(state.heatUnit, row.idx, classIndex),
          row,
          definition,
          classIndex,
          value,
          count: row.classes[classIndex],
          population: populationValue(definition),
          share: row.total ? row.classes[classIndex] / row.total * 100 : 0
        });
      });
    });
    const finiteValues = cells.map((cell) => cell.value).filter(Number.isFinite);
    return {
      unit: state.heatUnit,
      metric: state.heatMetric,
      limit: state.heatLimit,
      defs,
      rows: shown,
      classes,
      cells,
      cellMap: new Map(cells.map((cell) => [cell.key, cell])),
      maximum: Math.max(1, ...finiteValues),
      isMunicipality
    };
  };

  const metricText = (cell) => formatTerritoryMetric(state.heatMetric, cell.value);
  const className = (classIndex) => {
    const definition = DATA.classes[classIndex];
    return `${definition?.roman || ""} · ${definition?.short || ""}`;
  };

  const rankFor = (model, selected) => {
    const territories = model.cells
      .filter((cell) => cell.classIndex === selected.classIndex && Number.isFinite(cell.value))
      .sort((left, right) => right.value - left.value || left.definition.name.localeCompare(right.definition.name, "ru-RU"));
    const causes = model.cells
      .filter((cell) => cell.row.idx === selected.row.idx && Number.isFinite(cell.value))
      .sort((left, right) => right.value - left.value || left.classIndex - right.classIndex);
    return {
      territoryRank: territories.findIndex((cell) => cell.key === selected.key) + 1,
      territoryCount: territories.length,
      causeRank: causes.findIndex((cell) => cell.key === selected.key) + 1,
      causeCount: causes.length,
      topTerritories: territories.slice(0, 6)
    };
  };

  const publicCell = (cell, model = activeModel) => {
    if (!cell || !model) return null;
    const ranks = rankFor(model, cell);
    const cause = DATA.classes[cell.classIndex];
    return Object.freeze({
      key: String(cell.key),
      territory: String(cell.definition.name),
      territoryType: String(cell.definition.municipalityType || (model.unit === "mo" ? "district" : "settlement")),
      classIndex: cell.classIndex,
      classCode: String(cause?.roman || ""),
      className: String(cause?.short || ""),
      classColor: String(cause?.color || "#397aaa"),
      metricValue: cell.value == null || !Number.isFinite(cell.value) ? null : numeric(cell.value),
      metricText: metricText(cell),
      metricLabel: territoryMetricLabel(state.heatMetric),
      deaths: numeric(cell.count),
      totalDeaths: numeric(cell.row.total),
      population: cell.population == null ? null : numeric(cell.population),
      share: numeric(cell.share),
      territoryRank: ranks.territoryRank,
      territoryCount: ranks.territoryCount,
      causeRank: ranks.causeRank,
      causeCount: ranks.causeCount,
      formula: rateBase(state.heatMetric)
        ? rateFormula(cell.count, cell.definition, state.heatMetric)
        : ""
    });
  };

  const renderFallbackInspector = (model, selected) => {
    const fallback = document.getElementById("heatmapInspectorFallback");
    if (!fallback || !selected) return;
    const summary = publicCell(selected, model);
    const ranks = rankFor(model, selected);
    fallback.innerHTML = `
      <section class="heatv2-inspector-card">
        <span class="heatv2-kicker">Выбранная ячейка</span>
        <h3>${escapeHtml(summary.territory)}</h3>
        <p><b>${escapeHtml(summary.classCode)}</b> ${escapeHtml(summary.className)}</p>
        <div class="heatv2-primary"><strong>${escapeHtml(summary.metricText)}</strong><span>${escapeHtml(summary.metricLabel)}</span></div>
        <div class="heatv2-metrics">
          <div><span>Смертей</span><b>${fmt(summary.deaths)}</b></div>
          <div><span>Доля класса</span><b>${pct(summary.share)}</b></div>
          <div><span>Население ${DATA.populationYear}</span><b>${summary.population == null ? "н/д" : fmt(summary.population)}</b></div>
          <div><span>Всего смертей</span><b>${fmt(summary.totalDeaths)}</b></div>
          <div><span>Место по причине</span><b>${summary.territoryRank} из ${summary.territoryCount}</b></div>
          <div><span>Место в территории</span><b>${summary.causeRank} из ${summary.causeCount}</b></div>
        </div>
      </section>
      <section class="heatv2-inspector-card">
        <h4>Топ территорий по выбранной причине</h4>
        <div class="heatv2-ranking">${ranks.topTerritories.map((cell, index) => `
          <button type="button" data-heatmap-rank="${escapeHtml(cell.key)}"><span>${index + 1}</span><b>${escapeHtml(cell.definition.name)}</b><strong>${escapeHtml(metricText(cell))}</strong></button>
        `).join("")}</div>
      </section>`;
    fallback.querySelectorAll("[data-heatmap-rank]").forEach((button) => {
      button.onclick = () => selectCell(button.dataset.heatmapRank);
    });
  };

  const selectCell = (key) => {
    if (!activeModel) return;
    const selected = activeModel.cells.find((cell) => cell.key === key);
    if (!selected) return;
    selectedKey = selected.key;
    activeSelected = selected;
    document.querySelectorAll(".heatv2-cell").forEach((cell) => {
      const active = cell.dataset.heatmapKey === selectedKey;
      cell.classList.toggle("is-selected", active);
      cell.setAttribute("aria-pressed", String(active));
    });
    const fallback = document.getElementById("heatmapInspectorFallback");
    if (!fallback?.parentElement?.classList.contains("is-react-owned")) {
      renderFallbackInspector(activeModel, selected);
    }
    emitHeatmapState();
  };

  renderHeatmap = () => {
    const model = buildModel();
    activeModel = model;
    if (!model.cells.some((cell) => cell.key === selectedKey)) {
      selectedKey = [...model.cells]
        .filter((cell) => Number.isFinite(cell.value))
        .sort((left, right) => right.value - left.value)[0]?.key || model.cells[0]?.key || "";
    }
    activeSelected = model.cells.find((cell) => cell.key === selectedKey) || model.cells[0] || null;

    const layout = document.createElement("div");
    layout.className = "heatmap-v2-layout";
    const stage = document.createElement("section");
    stage.className = "heatv2-stage";
    stage.setAttribute("aria-label", "Матрица территории и причины смерти");
    stage.innerHTML = `
      <header class="heatv2-stage-head">
        <div><span>Срез матрицы</span><b>${fmt(model.rows.length)} территорий × ${fmt(model.classes.length)} классов</b></div>
        <small>Нажмите ячейку для постоянной аналитики справа</small>
      </header>`;

    const wrap = document.createElement("div");
    wrap.className = "heat-wrap heatv2-scroll";
    const grid = document.createElement("div");
    grid.className = "heat-grid";
    grid.style.gridTemplateColumns = `minmax(150px, 21%) repeat(${model.classes.length}, minmax(20px, 1fr))`;
    grid.appendChild(document.createElement("div"));
    model.classes.forEach((classIndex) => {
      const head = document.createElement("div");
      head.className = "heat-head";
      head.textContent = `${DATA.classes[classIndex].roman} ${DATA.classes[classIndex].short}`;
      head.title = className(classIndex);
      grid.appendChild(head);
    });

    let previousGroup = "";
    model.rows.forEach((row) => {
      const definition = model.defs[row.idx];
      const territoryType = definition.municipalityType || "district";
      if (model.isMunicipality && territoryType !== previousGroup) {
        const group = document.createElement("div");
        group.className = "heat-group-label";
        group.textContent = groupNames[territoryType] || "Муниципальные территории";
        grid.appendChild(group);
        previousGroup = territoryType;
      }
      const label = document.createElement("div");
      label.className = "heat-rowlabel";
      label.textContent = definition.name;
      label.title = definition.name;
      grid.appendChild(label);

      model.classes.forEach((classIndex) => {
        const cellData = model.cellMap.get(cellKey(model.unit, row.idx, classIndex));
        const cell = document.createElement("button");
        const available = Number.isFinite(cellData.value);
        const ratio = available ? cellData.value / model.maximum : 0;
        cell.type = "button";
        cell.className = `heat-cell heatv2-cell${cellData.key === selectedKey ? " is-selected" : ""}`;
        cell.dataset.heatmapKey = cellData.key;
        cell.setAttribute("aria-pressed", String(cellData.key === selectedKey));
        cell.setAttribute("aria-label", `${definition.name}. ${className(classIndex)}. ${metricText(cellData)}`);
        cell.style.background = available
          ? `rgb(${Math.round(240 - 177 * ratio)},${Math.round(244 - 118 * ratio)},${Math.round(250 - 35 * ratio)})`
          : "#f2f4f7";
        cell.style.color = available && ratio > .48 ? "#fff" : "#42506a";
        cell.textContent = !available
          ? "—"
          : state.heatMetric === "share"
            ? row.total === 0 ? "0" : cellData.value >= 2 ? DF.format(cellData.value) : ""
            : rateBase(state.heatMetric)
              ? DF.format(cellData.value)
              : row.total === 0 ? "0" : cellData.value || "";
        addTip(cell, `<b>${escapeHtml(definition.name)} · ${DATA.classes[classIndex].roman}</b><div class="tip-grid"><span>Смертей</span><strong>${fmt(cellData.count)}</strong><span>Население ${DATA.populationYear}</span><strong>${cellData.population ? fmt(cellData.population) : "н/д"}</strong><span>${territoryMetricLabel(state.heatMetric)}</span><strong>${metricText(cellData)}</strong>${rateBase(state.heatMetric) ? `<span>Расчёт</span><strong>${rateFormula(cellData.count, definition, state.heatMetric)}</strong>` : ""}<span>Доля класса</span><strong>${pct(cellData.share)}</strong><span>Всего смертей</span><strong>${fmt(row.total)}</strong></div>`);
        cell.onclick = () => selectCell(cellData.key);
        grid.appendChild(cell);
      });
    });

    wrap.appendChild(grid);
    wrap.insertAdjacentHTML("beforeend", `<div class="heat-scale"><span>0</span><i class="gradient"></i><span>максимум · ${escapeHtml(territoryMetricLabel(state.heatMetric))}</span></div>`);
    stage.appendChild(wrap);

    const inspector = document.createElement("aside");
    inspector.className = "heatv2-inspector";
    inspector.setAttribute("aria-label", "Аналитика выбранной ячейки матрицы");
    inspector.innerHTML = `
      <div class="react-heatmap-inspector-host" data-react-heatmap-inspector hidden></div>
      <div id="heatmapInspectorFallback" data-legacy-heatmap-inspector></div>`;
    layout.append(stage, inspector);
    els.viz.appendChild(layout);
    renderFallbackInspector(model, activeSelected);
    emitHeatmapState();
  };

  const getPublicSummary = () => {
    const model = activeModel || buildModel();
    const selected = activeSelected || model.cells[0] || null;
    const ranks = selected ? rankFor(model, selected) : { topTerritories: [] };
    return Object.freeze({
      active: state.view === "heatmap",
      unit: String(state.heatUnit),
      metric: String(state.heatMetric),
      limit: String(state.heatLimit),
      rows: model.rows.length,
      columns: model.classes.length,
      selected: publicCell(selected, model),
      topTerritories: Object.freeze(ranks.topTerritories.map((cell) => publicCell(cell, model)))
    });
  };

  const setPublicOption = (option, value) => {
    const property = { unit: "heatUnit", metric: "heatMetric", limit: "heatLimit" }[option];
    const valid = {
      unit: new Set(["mo", "settlement"]),
      metric: new Set(["share", "n", "per1k", "per10k", "per100k"]),
      limit: new Set(["25", "50", "all"])
    }[option];
    const next = String(value);
    if (!property || !valid?.has(next) || String(state[property]) === next) return;
    state[property] = next;
    selectedKey = "";
    activeModel = null;
    activeSelected = null;
    render();
  };

  window.AmurHeatmapV2 = Object.freeze({
    getSummary: getPublicSummary,
    setOption: setPublicOption,
    selectCell
  });
})();
