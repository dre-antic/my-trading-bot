#!/usr/bin/env python3
"""Stdlib tests for validate_skill.py. Run: python3 -m unittest scripts/test_validate_skill.py"""
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_skill import validate  # noqa: E402

SKILL = Path(__file__).resolve().parents[3] / ".agents/skills/resourceful-problem-solving"


class RealSkill(unittest.TestCase):
    def test_packaged_skill_is_valid(self):
        self.assertEqual(validate(SKILL), [])


class InvalidSkill(unittest.TestCase):
    def test_catches_spec_violations(self):
        tmp = Path(tempfile.mkdtemp())
        folder = tmp / "Bad--Name"
        folder.mkdir()
        (folder / "SKILL.md").write_text(
            "---\nname: Bad--Name\ndescription: <b>x</b>\nmetadata:\n  version: 1\n---\nSee [x](references/missing.md)\n",
            encoding="utf-8",
        )
        try:
            problems = "\n".join(validate(folder))
            self.assertIn("name:", problems)
            self.assertIn("XML", problems)
            self.assertIn("metadata:", problems)
            self.assertIn("broken link", problems)
        finally:
            shutil.rmtree(tmp)


if __name__ == "__main__":
    unittest.main()
