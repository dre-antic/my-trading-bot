from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .paths import resources_dir

BLOCKED_FOR_COMMERCIAL = {"NON_COMMERCIAL", "BLOCKED", "UNKNOWN", "REVIEW_REQUIRED"}


@dataclass
class LicenseRecord:
    component_name: str
    type: str
    repository_url: str
    repository_license: str
    model_license: str
    weights_license: str
    commercial_use: str
    attribution_required: bool
    redistribution_allowed: str
    source_required: bool
    restrictions: str
    verified_date: str
    verification_source: str
    notes: str
    status: str
    hardware_requirements: str = ""
    provider: str = ""
    version: str = ""
    fallbacks: list[str] | None = None


def registry_path() -> Path:
    return resources_dir() / "models.json"


def load_registry() -> dict:
    path = registry_path()
    if not path.exists():
        return {"verified_date": str(date.today()), "components": []}
    return json.loads(path.read_text(encoding="utf-8"))


def components() -> list[dict]:
    return load_registry().get("components", [])


def get_component(name: str) -> dict | None:
    needle = name.lower()
    for item in components():
        if item.get("component_name", "").lower() == needle or item.get("id", "").lower() == needle:
            return item
    return None


def allowed_for_usage(component: dict, usage_mode: str, override: bool = False) -> tuple[bool, str]:
    status = (component.get("status") or "UNKNOWN").upper()
    if usage_mode != "commercial":
        if status == "BLOCKED":
            return False, f"{component.get('component_name')} is blocked for all productions."
        return True, "ok"
    if status in BLOCKED_FOR_COMMERCIAL and not override:
        return False, (
            f"{component.get('component_name')} is marked {status} and cannot be used for a commercial "
            "project unless you explicitly override after reading the license."
        )
    return True, "ok"


def filter_providers(names: list[str], usage_mode: str, overrides: set[str] | None = None) -> list[str]:
    overrides = overrides or set()
    allowed = []
    for name in names:
        rec = get_component(name)
        if not rec:
            if usage_mode == "commercial":
                continue
            allowed.append(name)
            continue
        ok, _ = allowed_for_usage(rec, usage_mode, override=name in overrides)
        if ok:
            allowed.append(name)
    return allowed
