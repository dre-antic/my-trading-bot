# Licenses

Verified on **2026-09-09** from GitHub’s License API and official model cards. A git repository being “open source” does **not** automatically make its model weights commercially usable.

This application (AI Video Studio source) is offered under the **MIT License**.

## How the studio uses this information

`resources/models.json` is the machine-readable registry. Commercial projects cannot silently use components marked `NON_COMMERCIAL`, `BLOCKED`, `UNKNOWN`, or `REVIEW_REQUIRED`.

In-app: **Settings → Licenses & models**. Each row shows “License verified on: DATE”.

## Highlights

| Component | Repo license | Weights / model | Commercial path |
|---|---|---|---|
| FFmpeg | LGPL-2.1+ typical | n/a | Approved with attribution; invoked as a binary |
| Pillow | HPND-style | n/a | Approved |
| Studio motion graphics / composer / writer | MIT (this repo) | n/a | Approved |
| eSpeak NG | GPL-3.0 | n/a | Approved as a **subprocess**, not linked |
| Piper | MIT | per-voice card | Approved when the voice card allows it |
| Kokoro-82M | Apache-2.0 | Apache-2.0 | Approved |
| Chatterbox | MIT | inspect voice/dataset | Cloning real people is disabled |
| Whisper | MIT | MIT | Approved (optional) |
| ACE-Step | Apache-2.0 (not MIT) | confirm card | Optional |
| GPT Researcher | Apache-2.0 | n/a | Optional; default research does not need it |
| Wikipedia text | CC BY-SA 4.0 | n/a | Attribution required |
| ComfyUI | GPL-3.0 | n/a | Optional separate server |
| FLUX.1 schnell | Apache-2.0 | Apache-2.0 | Approved |
| FLUX.1 dev | code portions Apache | **Non-commercial license** | Blocked in commercial mode |
| Wan 2.1 | Apache-2.0 | confirm checkpoint | Optional remote |
| LTX-Video | Apache-2.0 | confirm checkpoint | Optional remote |
| CogVideoX | Apache-2.0 | confirm checkpoint | Optional remote |
| HunyuanVideo | Other / NOASSERTION | Tencent community license | `REVIEW_REQUIRED` |
| LangGraph | MIT | n/a | Evaluated, not bundled |
| Tauri | Apache-2.0 OR MIT | n/a | Approved |
| pywebview | BSD-3-Clause | n/a | Attribution |

Do not treat this file as legal advice. Read the upstream license text before redistributing models or weights.
