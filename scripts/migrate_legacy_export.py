#!/usr/bin/env python3
"""Convert legacy AI-Plantgraphy data into a PWA backup zip.

Input can be either:
- a legacy export zip containing plants.sqlite and images/
- a legacy plants.sqlite file plus an images directory

The output zip matches the PWA backup format and can be imported from the
PWA Backup page.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import shutil
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

EXPORT_FORMAT = "ai-plantgraphy-pwa-export"
EXPORT_VERSION = 1


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def text_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def text_or_empty(value: Any) -> str:
    return text_or_none(value) or ""


def json_or_none(value: Any) -> Any:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def parse_aliases(value: Any) -> list[str]:
    parsed = json_or_none(value)
    if isinstance(parsed, list):
        return [item.strip() for item in parsed if isinstance(item, str) and item.strip()]
    return []


def sqlite_rows(db_path: Path, table: str) -> list[sqlite3.Row]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        exists = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        if not exists:
            return []
        return conn.execute(f"SELECT * FROM {table}").fetchall()


def row_get(row: sqlite3.Row, key: str, default: Any = None) -> Any:
    return row[key] if key in row.keys() else default


class LegacyImages:
    def __init__(self, source_zip: Path | None, images_dir: Path | None) -> None:
        self.source_zip = source_zip
        self.images_dir = images_dir
        self._zip_names: list[str] | None = None

    def _load_zip_names(self) -> list[str]:
        if self._zip_names is None:
            if not self.source_zip:
                self._zip_names = []
            else:
                with ZipFile(self.source_zip) as archive:
                    self._zip_names = [name for name in archive.namelist() if not name.endswith("/")]
        return self._zip_names

    def read(self, raw_path: str | None) -> tuple[bytes, str] | None:
        if not raw_path:
            return None

        if self.source_zip:
            return self._read_from_zip(raw_path)
        return self._read_from_dir(raw_path)

    def _read_from_zip(self, raw_path: str) -> tuple[bytes, str] | None:
        candidates = self._candidate_zip_names(raw_path)
        names = self._load_zip_names()
        by_lower = {name.replace("\\", "/").lower(): name for name in names}
        for candidate in candidates:
            matched = by_lower.get(candidate.replace("\\", "/").lower())
            if matched:
                with ZipFile(self.source_zip) as archive:
                    return archive.read(matched), matched

        basename = Path(raw_path).name.lower()
        matched = next((name for name in names if Path(name).name.lower() == basename), None)
        if not matched:
            return None
        with ZipFile(self.source_zip) as archive:
            return archive.read(matched), matched

    def _read_from_dir(self, raw_path: str) -> tuple[bytes, str] | None:
        path = Path(raw_path)
        candidates: list[Path] = []
        if path.is_absolute():
            candidates.append(path)
        if self.images_dir:
            candidates.append(self.images_dir / path.name)
            normalized = raw_path.replace("\\", "/")
            if "/images/" in normalized:
                candidates.append(self.images_dir / normalized.split("/images/", 1)[1])
        for candidate in candidates:
            if candidate.exists() and candidate.is_file():
                return candidate.read_bytes(), str(candidate)
        return None

    @staticmethod
    def _candidate_zip_names(raw_path: str) -> list[str]:
        normalized = raw_path.replace("\\", "/")
        candidates = [normalized, f"images/{Path(normalized).name}"]
        if "/images/" in normalized:
            candidates.append(f"images/{normalized.split('/images/', 1)[1]}")
        return list(dict.fromkeys(candidates))


def mime_type_for(path: str) -> str:
    return mimetypes.guess_type(path)[0] or "image/jpeg"


def make_image_records(
    legacy_images: LegacyImages,
    raw_path: str | None,
    observation_id: str | None,
    created_at: str,
) -> tuple[list[dict[str, Any]], str | None]:
    loaded = legacy_images.read(raw_path)
    if not loaded:
        return [], None

    data, source_name = loaded
    mime_type = mime_type_for(source_name)
    records: list[dict[str, Any]] = []
    original_id = str(uuid.uuid4())
    thumbnail_id = str(uuid.uuid4())

    for image_id, kind in [(original_id, "original"), (thumbnail_id, "thumbnail")]:
        records.append(
            {
                "id": image_id,
                "kind": kind,
                "blob": data,
                "mimeType": mime_type,
                "width": 0,
                "height": 0,
                "byteSize": len(data),
                "sourceObservationId": observation_id,
                "createdAt": created_at,
            }
        )

    return records, original_id


def convert_observations(
    rows: list[sqlite3.Row],
    legacy_images: LegacyImages,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    observations: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    representative_by_legacy_path: dict[str, str] = {}

    for row in rows:
        created_at = text_or_none(row_get(row, "created_at")) or now_iso()
        updated_at = text_or_none(row_get(row, "updated_at")) or created_at
        image_ids: list[str] = []
        for column in ["image1_path", "image2_path", "image3_path"]:
            raw_path = text_or_none(row_get(row, column))
            image_records, original_id = make_image_records(legacy_images, raw_path, row["id"], created_at)
            if original_id:
                image_ids.append(original_id)
                representative_by_legacy_path[raw_path or ""] = original_id
            images.extend(image_records)

        observations.append(
            {
                "id": row["id"],
                "schemaVersion": 1,
                "plantId": text_or_none(row_get(row, "plant_id")),
                "status": text_or_none(row_get(row, "status")) or "analyzed",
                "capturedAt": text_or_none(row_get(row, "captured_at")),
                "receivedAt": text_or_none(row_get(row, "received_at")) or created_at,
                "note": text_or_empty(row_get(row, "note")),
                "locationLabel": text_or_empty(row_get(row, "location_label")) or "未設定",
                "latitude": row_get(row, "latitude"),
                "longitude": row_get(row, "longitude"),
                "imageIds": image_ids,
                "confidence": row_get(row, "confidence"),
                "rawResult": json_or_none(row_get(row, "raw_result_json")),
                "errorMessage": text_or_empty(row_get(row, "error_message")),
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

    return observations, images, representative_by_legacy_path


def convert_plants(
    rows: list[sqlite3.Row],
    legacy_images: LegacyImages,
    representative_by_legacy_path: dict[str, str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    plants: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []

    for row in rows:
        created_at = text_or_none(row_get(row, "created_at")) or now_iso()
        updated_at = text_or_none(row_get(row, "updated_at")) or created_at
        representative_path = text_or_none(row_get(row, "representative_image_path"))
        representative_image_id = representative_by_legacy_path.get(representative_path or "")
        if representative_path and not representative_image_id:
            image_records, original_id = make_image_records(legacy_images, representative_path, None, created_at)
            images.extend(image_records)
            representative_image_id = original_id

        plants.append(
            {
                "id": row["id"],
                "schemaVersion": 1,
                "displayName": text_or_empty(row_get(row, "display_name")) or text_or_empty(row_get(row, "common_name_ja")),
                "commonNameJa": text_or_none(row_get(row, "common_name_ja")),
                "scientificName": text_or_none(row_get(row, "scientific_name")),
                "basicProfileText": text_or_empty(row_get(row, "basic_profile_text") or row_get(row, "description")),
                "visualAppealText": text_or_empty(row_get(row, "visual_appeal_text")),
                "careNotes": text_or_empty(row_get(row, "care_notes")),
                "profileGeneratedJson": json_or_none(row_get(row, "profile_raw_json")),
                "profileGenerationSeconds": row_get(row, "profile_generation_seconds"),
                "profileGenerationStatus": row_get(row, "profile_generation_status"),
                "profileGenerationStartedAt": text_or_none(row_get(row, "profile_generation_started_at")),
                "profileGenerationUpdatedAt": text_or_none(row_get(row, "profile_generation_updated_at")),
                "profileGenerationErrorMessage": text_or_none(row_get(row, "profile_generation_error_message")),
                "observationCount": int(row_get(row, "observation_count", 0) or 0),
                "createdFrom": "observation",
                "representativeImageId": representative_image_id,
                "updatedAt": updated_at,
                "aliases": parse_aliases(row_get(row, "aliases_json")),
            }
        )

    return plants, images


def write_pwa_zip(
    output_path: Path,
    observations: list[dict[str, Any]],
    plants: list[dict[str, Any]],
    images: list[dict[str, Any]],
) -> None:
    manifest = {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exportedAt": now_iso(),
        "counts": {
            "settings": 0,
            "observations": len(observations),
            "plants": len(plants),
            "jobs": 0,
            "images": len(images),
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output_path, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        archive.writestr("data/settings.json", "[]")
        archive.writestr("data/observations.json", json.dumps(observations, ensure_ascii=False, indent=2))
        archive.writestr("data/plants.json", json.dumps(plants, ensure_ascii=False, indent=2))
        archive.writestr("data/jobs.json", "[]")
        for image in images:
            data = image["blob"]
            metadata = {key: value for key, value in image.items() if key != "blob"}
            archive.writestr(f"images/{image['id']}.json", json.dumps(metadata, ensure_ascii=False, indent=2))
            archive.writestr(f"images/{image['id']}.bin", data)


def extract_db_from_zip(source_zip: Path, temp_dir: Path) -> Path:
    with ZipFile(source_zip) as archive:
        candidates = [name for name in archive.namelist() if Path(name).name == "plants.sqlite"]
        if not candidates:
            raise SystemExit("plants.sqlite が見つかりません。")
        db_path = temp_dir / "plants.sqlite"
        db_path.write_bytes(archive.read(candidates[0]))
        return db_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert legacy AI-Plantgraphy data to a PWA backup zip.")
    parser.add_argument("--legacy-zip", type=Path, help="Legacy export zip containing plants.sqlite and images/")
    parser.add_argument("--db", type=Path, help="Legacy plants.sqlite path")
    parser.add_argument("--images-dir", type=Path, help="Legacy images directory. Defaults to db parent / images")
    parser.add_argument("--output", type=Path, required=True, help="Output PWA backup zip path")
    args = parser.parse_args()

    if not args.legacy_zip and not args.db:
        raise SystemExit("--legacy-zip or --db is required.")

    with tempfile.TemporaryDirectory() as temp_name:
        temp_dir = Path(temp_name)
        db_path = extract_db_from_zip(args.legacy_zip, temp_dir) if args.legacy_zip else args.db
        if not db_path or not db_path.exists():
            raise SystemExit("plants.sqlite が見つかりません。")

        images_dir = args.images_dir
        if not images_dir and not args.legacy_zip:
            images_dir = db_path.parent / "images"

        temp_db = temp_dir / "working.sqlite"
        shutil.copy2(db_path, temp_db)
        legacy_images = LegacyImages(args.legacy_zip, images_dir)

        observation_rows = sqlite_rows(temp_db, "observations")
        plant_rows = sqlite_rows(temp_db, "plants")
        observations, observation_images, representative_map = convert_observations(observation_rows, legacy_images)
        plants, plant_images = convert_plants(plant_rows, legacy_images, representative_map)
        images = observation_images + plant_images

        write_pwa_zip(args.output, observations, plants, images)
        print(
            f"created {args.output} "
            f"plants={len(plants)} observations={len(observations)} images={len(images)}"
        )


if __name__ == "__main__":
    main()
