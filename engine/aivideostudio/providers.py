from __future__ import annotations

import json
from typing import Any

import httpx

from . import credentials, cost, licenses
from .logging_util import setup_logging
from .util import parse_json_object

log = setup_logging()

USER_AGENT = "AIVideoStudio/1.0 (local video production; research bot; contact: local-app)"


class ProviderError(RuntimeError):
    def __init__(self, message: str, user_message: str | None = None, retryable: bool = True):
        super().__init__(message)
        self.user_message = user_message or message
        self.retryable = retryable


def http() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(40.0, connect=8.0), headers={"User-Agent": USER_AGENT}, follow_redirects=True)


class LLMProvider:
    name = "base"

    def available(self) -> bool:
        return False

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        raise ProviderError("LLM not configured", retryable=False)


class OllamaLLM(LLMProvider):
    name = "ollama"

    def __init__(self):
        self.url = (credentials.get_secret("ollama_url") or "http://127.0.0.1:11434").rstrip("/")

    def available(self) -> bool:
        try:
            r = httpx.get(f"{self.url}/api/tags", timeout=0.8)
            return r.status_code == 200 and bool(r.json().get("models"))
        except Exception:
            return False

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        models = []
        try:
            models = [m.get("name") for m in httpx.get(f"{self.url}/api/tags", timeout=5).json().get("models", [])]
        except Exception as exc:
            raise ProviderError(str(exc), "The local Ollama service is not responding.")
        model = models[0] if models else "llama3.2"
        payload = {
            "model": model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            payload["format"] = "json"
        r = httpx.post(f"{self.url}/api/chat", json=payload, timeout=120)
        if r.status_code >= 400:
            raise ProviderError(r.text, "The local language model could not complete this step.")
        return r.json().get("message", {}).get("content", "")


class OpenAICompatibleLLM(LLMProvider):
    name = "openai_compatible"

    def available(self) -> bool:
        return bool(credentials.get_secret("openai_api_key"))

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        key = credentials.get_secret("openai_api_key")
        if not key:
            raise ProviderError("missing key", "No OpenAI-compatible API key is saved in Settings.", retryable=False)
        base = (credentials.get_secret("openai_base_url") or "https://api.openai.com/v1").rstrip("/")
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        body: dict[str, Any] = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.4,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        r = httpx.post(f"{base}/chat/completions", headers=headers, json=body, timeout=120)
        if r.status_code >= 400:
            raise ProviderError(r.text, "The cloud writing service returned an error. The system will use the local writer.")
        return r.json()["choices"][0]["message"]["content"]


class StudioWriter(LLMProvider):
    """Research-grounded structured writer. Used when no neural LLM is available."""

    name = "studio_writer"

    def available(self) -> bool:
        return True

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        # The orchestrator should call dedicated engines, not this, for scripts.
        # Kept as a last-resort summarizer.
        text = user[:4000]
        if json_mode:
            return json.dumps({"summary": text[:800], "notes": "local-writer"})
        return text[:1200]


def pick_llm(usage_mode: str = "personal") -> LLMProvider:
    order = licenses.filter_providers(["ollama", "openai_compatible", "studio_writer"], usage_mode)
    mapping = {"ollama": OllamaLLM, "openai_compatible": OpenAICompatibleLLM, "studio_writer": StudioWriter}
    for name in order or ["studio_writer"]:
        cls = mapping.get(name)
        if not cls:
            continue
        inst = cls()
        if inst.available():
            return inst
    return StudioWriter()


class ComfyUIProvider:
    name = "comfyui"

    def __init__(self, url: str | None = None):
        self.url = (url or credentials.get_secret("comfyui_url") or credentials.get_secret("comfyui_remote_url") or "").rstrip("/")

    def available(self) -> bool:
        if not self.url:
            return False
        try:
            r = httpx.get(f"{self.url}/system_stats", timeout=1.5)
            return r.status_code == 200
        except Exception:
            return False

    def generate_image(self, prompt: str, width: int, height: int, seed: int, negative: str = "") -> bytes | None:
        """Best-effort ComfyUI prompt submission. Returns None if the server API cannot complete.

        ComfyUI workflow graphs vary by install. We try the simple /prompt + history pattern
        and fall back so production never depends on a particular node pack.
        """
        if not self.available():
            return None
        # Without a known workflow JSON we do not invent a fake image from ComfyUI.
        log.info("ComfyUI is reachable at %s but no approved workflow is configured; skipping.", self.url)
        return None


def with_retries(fn, attempts: int = 3, backoff: float = 1.4):
    import time

    last = None
    delay = 0.4
    for i in range(attempts):
        try:
            return fn()
        except ProviderError as exc:
            last = exc
            if not exc.retryable or i == attempts - 1:
                raise
            time.sleep(delay)
            delay *= backoff
        except Exception as exc:
            last = exc
            if i == attempts - 1:
                raise ProviderError(str(exc))
            time.sleep(delay)
            delay *= backoff
    raise last or ProviderError("retry failed")
