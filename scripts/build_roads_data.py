from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = Path(
    r"C:\!Рабочие материалы\Амурская область\Для сайта\Дороги_сайт.gpkg"
)
DEFAULT_OUTPUT = ROOT / "data" / "roads-data.js"
DEFAULT_OGR2OGR = Path(r"C:\Program Files\QGIS 3.44.8\bin\ogr2ogr.exe")
KEEP_FIELDS = "fclass,name,ref,bridge,tunnel,layer,length_km"


def build(input_path: Path, output_path: Path, ogr2ogr: Path) -> None:
    if not input_path.exists():
        raise FileNotFoundError(input_path)
    if not ogr2ogr.exists():
        raise FileNotFoundError(ogr2ogr)

    build_root = ROOT / ".build"
    build_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="amur-roads-", dir=build_root) as temporary:
        geojson_path = Path(temporary) / "roads.geojson"
        subprocess.run(
            [
                str(ogr2ogr),
                "-f",
                "GeoJSON",
                str(geojson_path),
                str(input_path),
                "-t_srs",
                "EPSG:4326",
                "-lco",
                "RFC7946=YES",
                "-lco",
                "COORDINATE_PRECISION=6",
                "-select",
                KEEP_FIELDS,
            ],
            check=True,
        )
        collection = json.loads(geojson_path.read_text(encoding="utf-8"))
    try:
        build_root.rmdir()
    except OSError:
        pass

    counts = Counter()
    total_length = 0.0
    for feature in collection.get("features", []):
        properties = feature.get("properties") or {}
        road_class = properties.get("fclass") or "unknown"
        counts[road_class] += 1
        total_length += float(properties.get("length_km") or 0)
        feature["properties"] = {
            key: value
            for key, value in properties.items()
            if key in KEEP_FIELDS.split(",") and value not in (None, "")
        }

    payload = {
        "type": "FeatureCollection",
        "features": collection.get("features", []),
        "meta": {
            "source_crs": "EPSG:3857",
            "geojson_crs": "EPSG:4326",
            "features": len(collection.get("features", [])),
            "length_km": round(total_length, 1),
            "class_counts": dict(sorted(counts.items())),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    output_path.write_text(
        f"window.AMUR_ROADS_DATA={serialized};\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a MapLibre-ready Amur roads bundle.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ogr2ogr", type=Path, default=DEFAULT_OGR2OGR)
    arguments = parser.parse_args()
    build(arguments.input, arguments.output, arguments.ogr2ogr)
    print(arguments.output)


if __name__ == "__main__":
    main()
