#!/usr/bin/env python3
"""The T04 fixture must reproduce the silent 0-row import. Run from this directory or via unittest discover."""
import importlib.util
import io
import os
import subprocess
import sys
import unittest
from pathlib import Path

FIX = Path(__file__).resolve().parent / "fixtures/t04-csv-import"
CHECK = Path(__file__).resolve().parent / "fixtures/t04-hidden-check.py"


class T04Fixture(unittest.TestCase):
    def test_legacy_utf8_still_passes(self):
        proc = subprocess.run([sys.executable, "test_importer.py"], cwd=FIX, capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)

    def test_new_customer_file_imports_zero_rows(self):
        spec = importlib.util.spec_from_file_location("importer", FIX / "importer.py")
        importer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(importer)
        here = Path.cwd()
        os.chdir(FIX)
        try:
            orders = importer.load_orders("orders_export.csv")
        finally:
            os.chdir(here)
        self.assertEqual(orders, [])

    def test_file_is_not_utf8(self):
        raw = (FIX / "orders_export.csv").read_bytes()
        with self.assertRaises(UnicodeDecodeError):
            raw.decode("utf-8")
        text = raw.decode("cp1252")
        self.assertIn("Müller", text)
        self.assertIn(";", text.splitlines()[0] or text)

    def test_hidden_check_fails_on_unfixed_fixture(self):
        proc = subprocess.run([sys.executable, str(CHECK), str(FIX)], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0)
        self.assertIn('"pass": false', proc.stdout)


if __name__ == "__main__":
    unittest.main()
