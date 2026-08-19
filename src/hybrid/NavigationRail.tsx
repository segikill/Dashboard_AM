import type { KeyboardEvent, ReactNode } from "react";
import { getLegacyBridge, useLegacyState } from "./legacyStore";
import { useReactOwnedHost } from "./MapChrome";
import type { AtlasView } from "./types";

interface NavigationItem {
  view: AtlasView;
  label: string;
  title: string;
  group: "map" | "analysis";
  icon: ReactNode;
}

const ITEMS: NavigationItem[] = [
  {
    view: "map",
    label: "Смертность",
    title: "Интерактивная карта смертности",
    group: "map",
    icon: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/><circle className="fill" cx="12" cy="11" r="2"/></>
  },
  {
    view: "infrastructure",
    label: "Медобъекты",
    title: "Интерактивная карта инфраструктуры медицинских объектов",
    group: "map",
    icon: <><path d="M5 5h10v16H5zM8 2h4v6H8zM15 9h4v12h-4zM8 12h4M10 10v4M7 18h6"/><circle className="fill" cx="18" cy="6" r="3"/></>
  },
  {
    view: "treemap",
    label: "Treemap",
    title: "Treemap МКБ-10",
    group: "analysis",
    icon: <><rect x="3" y="3" width="10" height="8"/><rect x="14" y="3" width="7" height="14"/><rect x="3" y="12" width="10" height="9"/><rect x="14" y="18" width="7" height="3"/></>
  },
  {
    view: "heatmap",
    label: "Матрица",
    title: "Матрица «территория × причина»",
    group: "analysis",
    icon: <><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/><rect className="fill" x="10" y="10" width="4" height="4"/></>
  },
  {
    view: "arrow",
    label: "Ранги",
    title: "Ранги причин смерти",
    group: "analysis",
    icon: <path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3"/>
  },
  {
    view: "pyramid",
    label: "Пирамида",
    title: "Возрастно-половая пирамида",
    group: "analysis",
    icon: <path d="M11 4 4 20h7zM13 4l7 16h-7zM4 20h16"/>
  },
  {
    view: "plot",
    label: "Возраст",
    title: "Медианный возраст и интервалы",
    group: "analysis",
    icon: <><path d="M3 7h18M3 17h18M6 4v6M18 4v6M8 14v6M16 14v6"/><circle className="fill" cx="12" cy="7" r="2"/><circle className="fill" cx="12" cy="17" r="2"/></>
  },
  {
    view: "dotogram",
    label: "Точки",
    title: "Точечное сравнение территорий",
    group: "analysis",
    icon: <><circle className="fill" cx="6" cy="6" r="2"/><circle className="fill" cx="12" cy="5" r="2"/><circle className="fill" cx="18" cy="7" r="2"/><circle className="fill" cx="7" cy="13" r="2"/><circle className="fill" cx="14" cy="12" r="2"/><circle className="fill" cx="18" cy="17" r="2"/><circle className="fill" cx="9" cy="19" r="2"/></>
  }
];

export function NavigationRail() {
  const snapshot = useLegacyState();
  const bridge = getLegacyBridge();
  const navigation = bridge?.getNavigationSummary();
  useReactOwnedHost("[data-react-navigation-rail]", "is-react-owned");

  if (!bridge || !navigation) return null;

  const focusItem = (index: number) => {
    const bounded = (index + ITEMS.length) % ITEMS.length;
    document.querySelector<HTMLButtonElement>(`[data-react-navigation-view="${ITEMS[bounded].view}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-react-navigation-view]");
    if (!button) return;
    const index = ITEMS.findIndex((item) => item.view === button.dataset.reactNavigationView);
    if (index < 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(ITEMS.length - 1);
    }
  };

  const panelTitle = snapshot.view === "infrastructure"
    ? navigation.panelOpen ? "Свернуть панель слоёв" : "Открыть панель слоёв"
    : navigation.panelOpen ? "Свернуть панель параметров" : "Открыть панель параметров";

  return (
    <div className="react-navigation-rail" data-react-navigation-ready>
      <button
        className="rail-drawer-toggle"
        type="button"
        aria-controls={snapshot.view === "infrastructure" ? "infrastructureLayerComposer" : "atlasDrawer"}
        aria-expanded={navigation.panelOpen}
        title={panelTitle}
        aria-label={panelTitle}
        data-react-navigation-panel
        onClick={() => bridge.setNavigationPanel(!navigation.panelOpen)}
      >
        <span aria-hidden="true">{navigation.panelOpen ? "«" : "»"}</span>
        <small>Панель</small>
      </button>
      <nav className="viz-nav" aria-label="Типы визуализации" onKeyDown={onKeyDown}>
        {ITEMS.map((item, index) => {
          const active = snapshot.view === item.view;
          const className = [
            "viz-btn",
            item.group === "map" ? "viz-btn--map-primary" : "",
            index === 2 ? "viz-btn--analysis-start" : "",
            active ? "active" : ""
          ].filter(Boolean).join(" ");
          return (
            <button
              key={item.view}
              type="button"
              className={className}
              data-order={index + 1}
              data-view={item.view}
              data-react-navigation-view={item.view}
              title={item.title}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              aria-pressed={active}
              onClick={() => bridge.setView(item.view)}
            >
              <span className="icon"><svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg></span>
              <span className="rail-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
