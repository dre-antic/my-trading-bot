#!/usr/bin/env bash
# One-time install of Chatterbox (Resemble AI, MIT) for local voice cloning into .voice-venv/.
# Downloads about 2 GB (PyTorch + model weights on first use). Works on CPU, faster with an NVIDIA GPU or Apple Silicon.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .voice-venv
.voice-venv/bin/pip install --upgrade pip
if [[ "$(uname)" == "Linux" ]] && ! command -v nvidia-smi >/dev/null 2>&1; then
	# CPU-only PyTorch wheels are much smaller than the default CUDA build.
	.voice-venv/bin/pip install chatterbox-tts --extra-index-url https://download.pytorch.org/whl/cpu
else
	.voice-venv/bin/pip install chatterbox-tts
fi
# Chatterbox's watermark package still imports pkg_resources, which setuptools 81+ removed.
.voice-venv/bin/pip install "setuptools<81"
.voice-venv/bin/python -c "import chatterbox.tts_turbo; print('Chatterbox ready')"
