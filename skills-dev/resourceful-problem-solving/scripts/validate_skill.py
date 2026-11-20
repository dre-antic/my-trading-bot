#!/usr/bin/env python3
"""Validate a skill folder against the Agent Skills spec (agentskills.io/specification).

Usage: python3 validate_skill.py <path-to-skill-folder>
Exit code 0 when valid; prints every problem otherwise. Standard library only
(uses PyYAML when installed, otherwise a minimal frontmatter parser).
"""
import re
import sys
from pathlib import Path

NAME_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MAX_BODY_LINES = 500
MAX_BODY_TOKENS = 5000
RESERVED = ("anthropic", "claude")


def parse_frontmatter(text):
    if not text.startswith("---\n"):
        raise ValueError("SKILL.md must start with '---' frontmatter")
    end = text.find("\n---\n", 4)
    if end == -1:
        raise ValueError("frontmatter is not closed with '---'")
    raw, body = text[4:end], text[end + 5 :]
    try:
        import yaml

        data = yaml.safe_load(raw)
    except ImportError:
        data, parent = {}, None
        for line in raw.splitlines():
            if not line.strip():
                continue
            if line.startswith("  ") and parent:
                k, _, v = line.strip().partition(":")
                data[parent][k.strip()] = v.strip().strip('"')
                continue
            k, _, v = line.partition(":")
            v = v.strip()
            if v:
                data[k.strip()] = v.strip('"')
                parent = None
            else:
                data[k.strip()] = {}
                parent = k.strip()
    if not isinstance(data, dict):
        raise ValueError("frontmatter must be a mapping")
    return data, body


def validate(folder):
    problems = []
    folder = Path(folder).resolve()
    skill_md = folder / "SKILL.md"
    if not skill_md.is_file():
        return [f"missing {skill_md}"]
    try:
        meta, body = parse_frontmatter(skill_md.read_text(encoding="utf-8"))
    except ValueError as exc:
        return [str(exc)]

    name = meta.get("name")
    if not isinstance(name, str) or not name:
        problems.append("name: required")
    else:
        if len(name) > 64 or not NAME_RE.match(name):
            problems.append("name: 1-64 chars, lowercase letters/digits/single hyphens, no leading/trailing hyphen")
        if name != folder.name:
            problems.append(f"name '{name}' must match folder name '{folder.name}'")
        if any(r in name for r in RESERVED):
            problems.append("name: must not contain reserved words (anthropic, claude)")

    desc = meta.get("description")
    if not isinstance(desc, str) or not desc.strip():
        problems.append("description: required, non-empty")
    else:
        if len(desc) > 1024:
            problems.append(f"description: {len(desc)} chars > 1024")
        if re.search(r"<[^>]+>", desc):
            problems.append("description: must not contain XML/HTML tags")

    compat = meta.get("compatibility")
    if compat is not None and (not isinstance(compat, str) or not 1 <= len(compat) <= 500):
        problems.append("compatibility: 1-500 chars when present")

    md = meta.get("metadata")
    if md is not None:
        if not isinstance(md, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in md.items()):
            problems.append("metadata: must map string keys to string values (quote numbers)")

    lines = body.count("\n") + 1
    tokens = int(len(body.split()) * 1.35)
    if lines > MAX_BODY_LINES:
        problems.append(f"body: {lines} lines > {MAX_BODY_LINES}")
    if tokens > MAX_BODY_TOKENS:
        problems.append(f"body: ~{tokens} tokens > {MAX_BODY_TOKENS}")

    for md_file in sorted(set(folder.rglob("*.md"))):
        text = md_file.read_text(encoding="utf-8")
        for target in re.findall(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", text):
            if re.match(r"^[a-z]+://", target) or target.startswith("mailto:"):
                continue
            if "\\" in target:
                problems.append(f"{md_file.name}: use forward slashes in link '{target}'")
            if not (md_file.parent / target).exists():
                problems.append(f"{md_file.relative_to(folder)}: broken link '{target}'")
            if md_file == skill_md and target.count("/") > 1:
                problems.append(f"SKILL.md: keep references one level deep ('{target}')")

    print(f"{folder.name}: body {lines} lines, ~{tokens} tokens, description {len(desc or '')} chars")
    return problems


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    found = validate(sys.argv[1])
    for p in found:
        print("ERROR:", p)
    print("OK" if not found else f"{len(found)} problem(s)")
    sys.exit(1 if found else 0)
