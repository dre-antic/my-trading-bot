from __future__ import annotations

import json
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .paths import app_data_dir

SERVICE = "AI Video Studio"
KEYRING_KEY = "aivs-master"
KNOWN = (
    "openai_api_key",
    "openai_base_url",
    "anthropic_api_key",
    "ollama_url",
    "comfyui_url",
    "comfyui_remote_url",
    "video_server_url",
    "tts_api_key",
    "image_api_key",
    "research_api_key",
)


def _key_file() -> Path:
    return app_data_dir() / ".master.key"


def _vault_file() -> Path:
    return app_data_dir() / "credentials.vault"


def _load_fernet() -> Fernet:
    try:
        import keyring

        stored = keyring.get_password(SERVICE, KEYRING_KEY)
        if stored:
            return Fernet(stored.encode("utf-8"))
    except Exception:
        stored = None
    path = _key_file()
    if path.exists():
        raw = path.read_bytes().strip()
        return Fernet(raw)
    key = Fernet.generate_key()
    try:
        import keyring

        keyring.set_password(SERVICE, KEYRING_KEY, key.decode("utf-8"))
    except Exception:
        path.write_bytes(key)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    return Fernet(key)


def _read_vault() -> dict[str, str]:
    path = _vault_file()
    if not path.exists():
        return {}
    try:
        token = path.read_bytes()
        data = _load_fernet().decrypt(token)
        return json.loads(data.decode("utf-8"))
    except (InvalidToken, json.JSONDecodeError, OSError):
        return {}


def _write_vault(data: dict[str, str]) -> None:
    token = _load_fernet().encrypt(json.dumps(data).encode("utf-8"))
    path = _vault_file()
    path.write_bytes(token)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def set_secret(name: str, value: str) -> None:
    data = _read_vault()
    if value.strip():
        data[name] = value.strip()
    elif name in data:
        del data[name]
    _write_vault(data)


def get_secret(name: str, default: str | None = None) -> str | None:
    env_name = f"AIVS_{name.upper()}"
    if os.environ.get(env_name):
        return os.environ[env_name]
    # Common aliases
    aliases = {
        "openai_api_key": "OPENAI_API_KEY",
        "anthropic_api_key": "ANTHROPIC_API_KEY",
    }
    if name in aliases and os.environ.get(aliases[name]):
        return os.environ[aliases[name]]
    return _read_vault().get(name, default)


def list_secrets_masked() -> dict[str, str]:
    data = _read_vault()
    out = {}
    for key in KNOWN:
        val = data.get(key) or os.environ.get(f"AIVS_{key.upper()}", "")
        if key.endswith("_url"):
            out[key] = val
        elif val:
            out[key] = val[:4] + "••••••••" if len(val) > 4 else "••••"
        else:
            out[key] = ""
    return out
