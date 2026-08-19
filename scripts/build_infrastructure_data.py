from __future__ import annotations

import argparse
import base64
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

import geopandas as gpd
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ATLAS = ROOT / "index.html"
DEFAULT_MEDICAL = Path(
    r"C:\!Рабочие материалы\Амурская область\Для сайта\Медицинские учереждения.geojson"
)
DEFAULT_ISOCHRONE_20 = Path(
    r"C:\!Рабочие материалы\Амурская область\Для сайта\Изохроны\20 мин Изохроны.gpkg"
)
DEFAULT_ISOCHRONE_60 = Path(
    r"C:\!Рабочие материалы\Амурская область\Для сайта\Изохроны\60 мин Изохроны.gpkg"
)
DEFAULT_OUTPUT = ROOT / "data" / "infrastructure-data.js"
DEFAULT_FACILITY_ICON_DIR = ROOT / "assets" / "icons" / "medical-facilities"

FACILITY_TYPES = {
    "Больница": ("hospital", "Больницы"),
    "Поликлиника": ("polyclinic", "Поликлиники"),
    "ФАП": ("fap", "ФАП"),
    "Амбулатория": ("ambulatory", "Амбулатории"),
    "Консультация": ("consultation", "Консультации"),
    "Реабилитационный центр": ("rehabilitation", "Реабилитационные центры"),
    "Родильный дом": ("maternity", "Родильные дома"),
    "Здравпункт": ("health_post", "Здравпункты"),
}

FACILITY_ICON_FILES = {
    "hospital": "hospital.svg",
    "polyclinic": "polyclinic.svg",
    "fap": "fap.svg",
    "ambulatory": "ambulatory.svg",
    "maternity": "maternity.svg",
    "consultation": "consultation.svg",
    "rehabilitation": "rehabilitation.svg",
    "health_post": "health-post.svg",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the lazy-loaded infrastructure map dataset for Dashboard_AM."
    )
    parser.add_argument("--atlas", type=Path, default=DEFAULT_ATLAS)
    parser.add_argument("--medical", type=Path, default=DEFAULT_MEDICAL)
    parser.add_argument("--isochrone-20", type=Path, default=DEFAULT_ISOCHRONE_20)
    parser.add_argument("--isochrone-60", type=Path, default=DEFAULT_ISOCHRONE_60)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--simplify-20", type=float, default=100.0)
    parser.add_argument("--simplify-60", type=float, default=200.0)
    return parser.parse_args()


def load_atlas_data(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"const DATA=(.*?);\s*\r?\nconst NF=", text, flags=re.S)
    if match:
        return json.loads(match.group(1))

    external_path = path.parent / "data" / "atlas-data.js"
    if external_path.exists():
        external_text = external_path.read_text(encoding="utf-8")
        external_match = re.search(
            r"window\.AMUR_ATLAS_DATA=(.*);\s*$", external_text, flags=re.S
        )
        if external_match:
            return json.loads(external_match.group(1))

    raise ValueError(
        f"Could not find embedded or external atlas DATA for {path}"
    )


def round_geometry(value: Any, precision: int = 6) -> Any:
    if isinstance(value, dict):
        return {key: round_geometry(item, precision) for key, item in value.items()}
    if isinstance(value, list):
        return [round_geometry(item, precision) for item in value]
    if isinstance(value, tuple):
        return [round_geometry(item, precision) for item in value]
    if isinstance(value, float):
        return round(value, precision)
    return value


def transform_geometry_3857_to_4326(
    geometry: dict[str, Any], transformer: Transformer
) -> dict[str, Any]:
    def walk(value: Any) -> Any:
        if (
            isinstance(value, list)
            and len(value) >= 2
            and isinstance(value[0], (int, float))
            and isinstance(value[1], (int, float))
        ):
            lon, lat = transformer.transform(float(value[0]), float(value[1]))
            return [round(lon, 6), round(lat, 6)]
        if isinstance(value, (list, tuple)):
            return [walk(item) for item in value]
        return value

    return {"type": geometry["type"], "coordinates": walk(geometry["coordinates"])}


def native_number(value: Any) -> int | float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return int(numeric) if numeric.is_integer() else round(numeric, 2)


def native_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text and text.lower() not in {"nan", "none"} else None


def population_symbol(population: int | None) -> tuple[str, int, bool]:
    if not population:
        return "missing", 7, False
    if population <= 1_000:
        return "under_1k", 6, False
    if population <= 2_500:
        return "1k_2_5k", 8, False
    if population <= 5_000:
        return "2_5k_5k", 12, False
    if population <= 10_000:
        return "5k_10k", 17, False
    if population <= 20_000:
        return "10k_20k", 21, False
    if population <= 40_000:
        return "20k_40k", 26, False
    if population <= 200_000:
        return "40k_200k", 42, True
    return "over_200k", 62, True


def feature_collection(features: Iterable[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": list(features)}


def build_facility_icon_data_urls(path: Path) -> dict[str, str]:
    icons: dict[str, str] = {}
    for code, filename in FACILITY_ICON_FILES.items():
        svg_path = path / filename
        encoded = base64.b64encode(svg_path.read_bytes()).decode("ascii")
        icons[code] = f"data:image/svg+xml;base64,{encoded}"
    return icons


def build_context_layers(
    atlas: dict[str, Any], transformer: Transformer
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    municipality_features: list[dict[str, Any]] = []
    municipality_label_features: list[dict[str, Any]] = []
    municipality_geometries_3857: list[Any] = []
    for item in atlas["municipalities"]:
        geometry_3857 = make_valid(shape(item["geometry"]))
        municipality_geometries_3857.append(geometry_3857)
        label_point_3857 = geometry_3857.representative_point()
        label_lon, label_lat = transformer.transform(
            float(label_point_3857.x), float(label_point_3857.y)
        )
        municipality_features.append(
            {
                "type": "Feature",
                "id": int(item["id"]),
                "properties": {
                    "id": int(item["id"]),
                    "name": item["name"],
                    "official_name": item.get("officialName"),
                    "municipality_type": item.get("municipalityType"),
                    "population2021": item.get("population2021"),
                },
                "geometry": transform_geometry_3857_to_4326(
                    item["geometry"], transformer
                ),
            }
        )
        municipality_label_features.append(
            {
                "type": "Feature",
                "id": int(item["id"]),
                "properties": {
                    "id": int(item["id"]),
                    "name": item["name"],
                    "municipality_type": item.get("municipalityType"),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        round(float(label_lon), 6),
                        round(float(label_lat), 6),
                    ],
                },
            }
        )

    settlement_features: list[dict[str, Any]] = []
    for item in atlas["settlements"]:
        population = native_number(item.get("population2021"))
        population_int = int(population) if population is not None else None
        symbol_class, diameter, donut = population_symbol(population_int)
        lon = native_number(item.get("lon"))
        lat = native_number(item.get("lat"))
        if lon is None or lat is None:
            lon, lat = transformer.transform(
                float(item["x3857"]), float(item["y3857"])
            )
        settlement_features.append(
            {
                "type": "Feature",
                "id": int(item["id"]),
                "properties": {
                    "id": int(item["id"]),
                    "name": item["name"],
                    "settlement_type": item.get("type"),
                    "is_city": bool(item.get("isCity")),
                    "municipality": item.get("municipality"),
                    "population2021": population_int,
                    "population_class": symbol_class,
                    "diameter_px": diameter,
                    "donut": donut,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(float(lon), 6), round(float(lat), 6)],
                },
            }
        )

    region_3857 = make_valid(unary_union(municipality_geometries_3857))
    web_mercator_limit = 20_037_508.342789244
    world_3857 = box(
        -web_mercator_limit,
        -web_mercator_limit,
        web_mercator_limit,
        web_mercator_limit,
    )
    mask_3857 = make_valid(world_3857.difference(region_3857))
    mask_4326 = gpd.GeoSeries([mask_3857], crs=3857).to_crs(4326).iloc[0]
    region_mask = feature_collection(
        [
            {
                "type": "Feature",
                "id": 1,
                "properties": {
                    "name": "Маска за границами Амурской области",
                    "opacity": 0.7,
                },
                "geometry": round_geometry(mapping(mask_4326), precision=6),
            }
        ]
    )

    return (
        feature_collection(municipality_features),
        feature_collection(municipality_label_features),
        feature_collection(settlement_features),
        region_mask,
    )


def build_medical_layer(path: Path) -> tuple[dict[str, Any], dict[str, int]]:
    layer = gpd.read_file(path)
    if layer.crs is None:
        layer = layer.set_crs(3857)
    layer = layer.to_crs(4326)

    prepared: list[dict[str, Any]] = []
    coordinate_groups: dict[tuple[float, float], list[int]] = defaultdict(list)

    for row_index, row in layer.iterrows():
        facility_type = native_text(row.get("Tip 2.1")) or "Не указан"
        code, label = FACILITY_TYPES.get(
            facility_type, ("other", facility_type)
        )
        lon = round(float(row.geometry.x), 6)
        lat = round(float(row.geometry.y), 6)
        source_fid = native_number(row.get("fid"))
        feature = {
            "type": "Feature",
            "id": int(source_fid) if source_fid is not None else int(row_index),
            "properties": {
                "web_id": f"medical-{int(source_fid) if source_fid is not None else int(row_index)}",
                "source_fid": source_fid,
                "facility_type": facility_type,
                "facility_code": code,
                "facility_label": label,
                "name": native_text(row.get("name")) or "Медицинское учреждение",
                "address": native_text(row.get("adress")),
                "workers": native_number(row.get("workers")),
                "beds": native_number(row.get("bed")),
                "cabinet": native_number(row.get("cabinet")),
                "service": native_number(row.get("service")),
                "org_oid": native_text(row.get("Field1")),
            },
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
        }
        prepared.append(feature)
        coordinate_groups[(lon, lat)].append(len(prepared) - 1)

    for location_number, (_, indexes) in enumerate(
        sorted(coordinate_groups.items()), start=1
    ):
        location_id = f"medical-location-{location_number}"
        stack_size = len(indexes)
        for stack_index, feature_index in enumerate(indexes):
            prepared[feature_index]["properties"].update(
                {
                    "location_id": location_id,
                    "stack_size": stack_size,
                    "stack_index": stack_index,
                }
            )

    type_counts = Counter(
        feature["properties"]["facility_code"] for feature in prepared
    )
    return feature_collection(prepared), dict(sorted(type_counts.items()))


def vertex_count(geometry: Any) -> int:
    if geometry is None or geometry.is_empty:
        return 0
    if geometry.geom_type == "Polygon":
        return len(geometry.exterior.coords) + sum(
            len(interior.coords) for interior in geometry.interiors
        )
    if hasattr(geometry, "geoms"):
        return sum(vertex_count(part) for part in geometry.geoms)
    return 0


def build_isochrone(
    path: Path, minutes: int, simplify_meters: float
) -> tuple[dict[str, Any], dict[str, Any]]:
    layer = gpd.read_file(path)
    if layer.crs is None:
        layer = layer.set_crs(3857)
    layer = layer.to_crs(3857)
    valid_geometries = [
        make_valid(geometry)
        for geometry in layer.geometry
        if geometry is not None and not geometry.is_empty
    ]
    dissolved = make_valid(unary_union(valid_geometries))
    vertices_before = vertex_count(dissolved)
    simplified = make_valid(
        dissolved.simplify(simplify_meters, preserve_topology=True)
    )
    vertices_after = vertex_count(simplified)
    web_geometry = gpd.GeoSeries([simplified], crs=3857).to_crs(4326).iloc[0]
    feature = {
        "type": "Feature",
        "id": minutes,
        "properties": {
            "minutes": minutes,
            "label": f"До {minutes} минут от больниц",
            "origin_type": "hospital",
            "origin_label": "Больницы",
            "source_features": int(len(layer)),
        },
        "geometry": round_geometry(mapping(web_geometry), precision=6),
    }
    quality = {
        "minutes": minutes,
        "source_features": int(len(layer)),
        "vertices_after_dissolve": vertices_before,
        "vertices_after_simplify": vertices_after,
        "simplify_meters": simplify_meters,
        "valid": bool(simplified.is_valid),
    }
    return feature_collection([feature]), quality


def calculate_population_coverage(
    settlements: dict[str, Any],
    isochrone: dict[str, Any],
    minutes: int,
    population_total: int,
) -> dict[str, Any]:
    coverage_geometry = shape(isochrone["features"][0]["geometry"])
    covered_population = 0
    covered_settlements = 0
    for feature in settlements["features"]:
        population = feature["properties"].get("population2021") or 0
        if population <= 0:
            continue
        if coverage_geometry.covers(shape(feature["geometry"])):
            covered_population += int(population)
            covered_settlements += 1
    return {
        "minutes": minutes,
        "population": covered_population,
        "share_percent": round(
            covered_population / population_total * 100, 2
        ) if population_total else 0,
        "settlements_with_population": covered_settlements,
    }


def main() -> None:
    args = parse_args()
    atlas = load_atlas_data(args.atlas)
    transformer = Transformer.from_crs(3857, 4326, always_xy=True)

    (
        municipalities,
        municipality_labels,
        settlements,
        region_mask,
    ) = build_context_layers(atlas, transformer)
    facilities, facility_counts = build_medical_layer(args.medical)
    facility_icons = build_facility_icon_data_urls(DEFAULT_FACILITY_ICON_DIR)
    isochrone_20, isochrone_20_quality = build_isochrone(
        args.isochrone_20, 20, args.simplify_20
    )
    isochrone_60, isochrone_60_quality = build_isochrone(
        args.isochrone_60, 60, args.simplify_60
    )
    population_total = int(atlas.get("populationTotal", 0))
    population_coverage = [
        calculate_population_coverage(
            settlements, isochrone_20, 20, population_total
        ),
        calculate_population_coverage(
            settlements, isochrone_60, 60, population_total
        ),
    ]

    payload = {
        "meta": {
            "region": "Амурская область",
            "web_crs": "EPSG:4326",
            "display_crs": "EPSG:3857",
            "population_year": int(atlas.get("populationYear", 2021)),
            "municipalities": len(municipalities["features"]),
            "municipality_labels": len(municipality_labels["features"]),
            "settlements": len(settlements["features"]),
            "facilities": len(facilities["features"]),
            "facility_counts": facility_counts,
            "isochrone_origin": "hospitals",
            "isochrone_quality": [isochrone_20_quality, isochrone_60_quality],
            "population_total": population_total,
            "population_coverage_method": "settlement_points_2021",
            "isochrone_population_coverage": population_coverage,
        },
        "municipalities": municipalities,
        "municipalityLabels": municipality_labels,
        "settlements": settlements,
        "regionMask": region_mask,
        "facilities": facilities,
        "facilityIcons": facility_icons,
        "isochrones20": isochrone_20,
        "isochrones60": isochrone_60,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(
        payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    )
    args.output.write_text(
        f"window.AMUR_INFRASTRUCTURE_DATA={encoded};\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "bytes": args.output.stat().st_size,
                **payload["meta"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
