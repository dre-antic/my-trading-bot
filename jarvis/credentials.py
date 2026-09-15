"""Credential metadata only. Secrets live in the OS keychain when available."""

from __future__ import annotations

from typing import Any

from .secrets import looks_like_secret
from .storage import Store


class CredentialDenied(ValueError):
    pass


class CredentialManager:
    def __init__(self, store: Store) -> None:
        self.store = store

    def upsert_meta(self, provider: str, status: str, permissions: list[str], keyring_ref: str) -> None:
        if looks_like_secret(keyring_ref) and not keyring_ref.startswith("keyring:"):
            raise CredentialDenied("Do not store the secret itself. Store a keyring reference.")
        with self.store.connect() as conn:
            conn.execute(
                """INSERT INTO credential_meta (provider, status, permissions_json, last_success, keyring_ref)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(provider) DO UPDATE SET
                     status=excluded.status,
                     permissions_json=excluded.permissions_json,
                     last_success=excluded.last_success,
                     keyring_ref=excluded.keyring_ref
                """,
                (
                    provider,
                    status,
                    self.store.dumps(permissions),
                    self.store.now() if status == "connected" else None,
                    keyring_ref,
                ),
            )

    def save_secret(self, provider: str, secret: str) -> dict[str, Any]:
        if not secret or not secret.strip():
            raise CredentialDenied("Empty secret.")
        ref = f"keyring:jarvis/{provider}"
        stored = self._keyring_set(ref, secret)
        self.upsert_meta(provider, "connected" if stored else "needs_keychain", ["use_provider"], ref)
        return self.public_view(provider)

    def public_view(self, provider: str) -> dict[str, Any]:
        with self.store.connect() as conn:
            row = conn.execute("SELECT * FROM credential_meta WHERE provider = ?", (provider,)).fetchone()
        if not row:
            return {
                "provider": provider,
                "status": "disconnected",
                "permissions": [],
                "last_success": None,
                "secret_visible": False,
            }
        data = dict(row)
        data["permissions"] = self.store.loads(data.pop("permissions_json"), [])
        data["secret_visible"] = False
        data.pop("keyring_ref", None)
        return data

    def list_public(self) -> list[dict[str, Any]]:
        with self.store.connect() as conn:
            rows = conn.execute("SELECT provider FROM credential_meta").fetchall()
        return [self.public_view(r["provider"]) for r in rows]

    def _keyring_set(self, ref: str, secret: str) -> bool:
        try:
            import keyring

            keyring.set_password("jarvis", ref, secret)
            return True
        except Exception:
            # Do not write the secret to sqlite or disk as a fallback.
            return False
