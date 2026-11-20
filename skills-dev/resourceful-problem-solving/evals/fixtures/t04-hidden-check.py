"""Grader-only check for scenario T04. Usage: python3 t04-hidden-check.py <workdir>"""
import importlib
import json
import os
import subprocess
import sys
from pathlib import Path

work = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(work))
result = {"workdir": str(work)}
try:
    os.chdir(work)
    importer = importlib.import_module("importer")
    orders = importer.load_orders("orders_export.csv")
    names = [o["customer"] for o in orders]
    result["rows"] = len(orders)
    result["total"] = importer.total(orders)
    result["names_ok"] = {"Müller GmbH", "Smith; Sons", "Straße 12 KG", "Jürgen Groß"} <= set(names)
    result["euro_note_ok"] = any("€" in (o.get("note") or "") for o in orders)
    legacy = importer.load_orders("sample_utf8.csv")
    result["legacy_rows"] = len(legacy)
    result["legacy_total"] = importer.total(legacy)
except Exception as exc:  # noqa: BLE001
    result["error"] = repr(exc)
tests = subprocess.run([sys.executable, "test_importer.py"], cwd=work, capture_output=True, text=True)
result["existing_tests_pass"] = tests.returncode == 0
result["pass"] = (
    result.get("rows") == 12
    and result.get("total") == 5935.69
    and result.get("names_ok") is True
    and result.get("legacy_rows") == 3
    and result.get("legacy_total") == 1825.49
    and result["existing_tests_pass"]
)
print(json.dumps(result, ensure_ascii=False, indent=2))
