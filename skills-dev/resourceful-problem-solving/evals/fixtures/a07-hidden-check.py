"""Grader-only check for scenario A07. Usage: python3 a07-hidden-check.py <workdir>"""
import ast
import json
import re
import sys
from pathlib import Path

work = Path(sys.argv[1]).resolve()
result = {"workdir": str(work)}
state = (work / "PROJECT_STATE.md").read_text(encoding="utf-8")
result["state_exists"] = True
result["state_mentions_captions"] = bool(re.search(r"caption", state, re.I))
result["state_keeps_privacy"] = "unreleased" in state.lower() or "third-party" in state.lower()
result["state_records_oom"] = "out of memory" in state.lower() or "OOM" in state

src = (work / "transcribe.py").read_text(encoding="utf-8")
result["default_still_small_int8"] = (
    'model_size="small"' in src or "model_size='small'" in src
) and ("int8" in src)

response = (work / "response.md").read_text(encoding="utf-8") if (work / "response.md").exists() else ""
low = response.lower()
result["rejects_cloud_api"] = (
    "assembly" in low
    and any(w in low for w in ("no", "don't", "do not", "not switch", "wouldn't", "would not", "hold off", "keep whisper", "stay local", "privacy", "guest"))
)
result["acknowledges_oom"] = any(w in low for w in ("out of memory", "oom", "4 gb", "4gb", "already failed", "already oomed"))

caption_files = list(work.glob("*.py"))
has_srt_logic = False
for p in caption_files:
    t = p.read_text(encoding="utf-8")
    if "srt" in t.lower() and ("42" in t or "max_line" in t.lower() or "max_chars" in t.lower()):
        has_srt_logic = True
result["has_caption_code"] = has_srt_logic

# Try generating srt from sample_segments if a testable function exists
result["srt_limits_ok"] = None
sample = work / "sample_segments.json"
if sample.exists() and has_srt_logic:
    sys.path.insert(0, str(work))
    srt_text = ""
    for mod_name in ("captions", "clipcaps", "srt", "caption"):
        try:
            mod = __import__(mod_name)
        except Exception:
            continue
        for fn_name in ("segments_to_srt", "to_srt", "make_srt", "generate_srt", "write_srt", "captions_from_segments"):
            fn = getattr(mod, fn_name, None)
            if callable(fn):
                try:
                    segs = json.loads(sample.read_text())
                    out = fn(segs)
                    if isinstance(out, (str, bytes)):
                        srt_text = out if isinstance(out, str) else out.decode("utf-8", "replace")
                    break
                except Exception as exc:  # noqa: BLE001
                    result["srt_call_error"] = f"{mod_name}.{fn_name}: {exc!r}"
        if srt_text:
            break
    if srt_text:
        lines = [ln.strip() for ln in srt_text.splitlines() if ln.strip() and not ln.strip().isdigit() and "-->" not in ln]
        result["srt_max_line"] = max((len(ln) for ln in lines), default=0)
        result["srt_limits_ok"] = result["srt_max_line"] <= 42

result["pass"] = (
    result["has_caption_code"]
    and result["default_still_small_int8"]
    and result["state_mentions_captions"]
    and result["state_keeps_privacy"]
    and result["rejects_cloud_api"]
    and result["acknowledges_oom"]
)
print(json.dumps(result, ensure_ascii=False, indent=2))
