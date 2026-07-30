from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"

INFRASTRUCTURE_BUTTON = """
<button class="viz-btn" data-view="infrastructure" title="Медицинская инфраструктура и доступность больниц" aria-label="Медицинская инфраструктура и доступность больниц"><span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h10v16H5zM8 2h4v6H8zM15 9h4v12h-4zM8 12h4M10 10v4M7 18h6"/><circle class="fill" cx="18" cy="6" r="3"/></svg></span><span class="rail-label">Инфраструктура</span></button>
""".strip()


def append_object_entry(source: str, constant: str, entry: str) -> str:
    pattern = rf"^(const {re.escape(constant)}=\{{.*)\}};$"
    match = re.search(pattern, source, flags=re.M)
    if not match:
        raise ValueError(f"Could not find {constant}")
    if "infrastructure:" in match.group(0):
        return source
    replacement = f"{match.group(1)},{entry}}};"
    return source[: match.start()] + replacement + source[match.end() :]


def main() -> None:
    text = INDEX.read_text(encoding="utf-8")

    if "assets/infrastructure-map.css" not in text:
        text = text.replace(
            '<link rel="stylesheet" href="assets/site.css?v=standalone-20260730-1">',
            '<link rel="stylesheet" href="assets/site.css?v=standalone-20260730-1">\n'
            '<link rel="icon" href="data:,">\n'
            '<link rel="stylesheet" href="assets/infrastructure-map.css?v=20260730-2">',
            1,
        )
    if "assets/infrastructure-map.js" not in text:
        text = text.replace(
            '<script defer src="assets/site.js?v=standalone-20260730-1"></script>',
            '<script defer src="assets/infrastructure-map.js?v=20260730-2"></script>\n'
            '<script defer src="assets/site.js?v=standalone-20260730-2"></script>',
            1,
        )

    if 'data-view="infrastructure"' not in text:
        text = text.replace(
            "</nav>\n</aside>",
            f"{INFRASTRUCTURE_BUTTON}\n</nav>\n</aside>",
            1,
        )

    text = text.replace(
        "Амурская область: семь способов увидеть МКБ-10",
        "Амурская область: аналитика смертности и инфраструктуры",
    )
    text = text.replace(
        "Слева переключаются Treemap, территориальная Heatmap, Arrow diagram, пирамида, интервальный Plot, карта и Dotogram.",
        "Слева переключаются семь аналитических визуализаций смертности и отдельная интерактивная карта медицинской инфраструктуры.",
    )

    text = append_object_entry(
        text,
        "VIEWS",
        "infrastructure:['Медицинская инфраструктура и доступность больниц','Медицинские учреждения, изохроны доступности от больниц 20 и 60 минут, границы МО и населённые пункты с размером по численности 2021 года.']",
    )
    text = append_object_entry(
        text,
        "METHOD",
        "infrastructure:'Карта отображается в Web Mercator EPSG:3857. Точки учреждений разделены по типам и управляются блочной панелью. Изохроны 20 и 60 минут показывают совокупную транспортную доступность именно от больниц; остальные типы учреждений не являются исходными точками изохрон. Размер НП определяется населением переписи 2021 года.'",
    )

    controls_marker = "  const activeRateMetric=state.view==='map'?state.mapMetric:state.view==='heatmap'?state.heatMetric:state.view==='dotogram'?state.dotMetric:null;"
    infrastructure_controls = (
        "  if(state.view==='infrastructure')html='<div class=\"note\"><b>Статический инфраструктурный контекст.</b> "
        "Изохроны рассчитаны от больниц. Фильтры периода, пола и возраста на этот слой не влияют. "
        "Включение типов учреждений, изохрон, МО и НП выполняется непосредственно слева от карты.</div>';\n"
    )
    if infrastructure_controls.strip() not in text:
        if controls_marker not in text:
            raise ValueError("Could not find local controls marker")
        text = text.replace(
            controls_marker,
            infrastructure_controls + controls_marker,
            1,
        )

    render_pattern = re.compile(r"^function render\(\)\{.*\}$", flags=re.M)
    render_match = render_pattern.search(text)
    if not render_match:
        raise ValueError("Could not find core render function")
    new_render = (
        "function renderInfrastructure(){"
        "if(window.AmurInfrastructureMap)window.AmurInfrastructureMap.mount(els.viz);"
        "else els.viz.innerHTML='<div class=\"empty\">Модуль инфраструктурной карты не загружен.</div>'"
        "}\n"
        "function render(){"
        "const infrastructureView=state.view==='infrastructure';"
        "document.body.classList.toggle('infrastructure-view',infrastructureView);"
        "if(!infrastructureView&&window.AmurInfrastructureMap)window.AmurInfrastructureMap.destroy();"
        "localControls();renderKpis();"
        "els.title.textContent=VIEWS[state.view][0];"
        "els.subtitle.textContent=VIEWS[state.view][1];"
        "els.method.textContent=METHOD[state.view];"
        "els.meta.innerHTML=infrastructureView"
        "?'<span class=\"chip\">статическая инфраструктура</span><span class=\"chip\">население 2021</span><span class=\"chip\">EPSG:3857</span>'"
        ":`<span class=\"chip\">${state.year==='all'?'2023–2025':state.year}</span><span class=\"chip\">${state.sex==='all'?'оба пола':state.sex==='1'?'мужчины':'женщины'}</span><span class=\"chip\">${document.querySelector(`#ageSelect option[value=\"${state.age}\"]`)?.textContent||'все возрасты'}</span>`;"
        "els.viz.innerHTML='';"
        "({treemap:renderTreemap,heatmap:renderHeatmap,arrow:renderArrow,pyramid:renderPyramid,plot:renderPlot,map:renderMap,dotogram:renderDotogram,infrastructure:renderInfrastructure}[state.view])()"
        "}"
    )
    if "function renderInfrastructure()" not in text:
        text = text[: render_match.start()] + new_render + text[render_match.end() :]

    text = text.replace(
        "addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(render,150)})",
        "addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{"
        "if(state.view==='infrastructure')window.AmurInfrastructureMap?.resize?.();"
        "else render()},150)})",
    )

    INDEX.write_text(text, encoding="utf-8")
    print(f"Patched {INDEX}")


if __name__ == "__main__":
    main()
