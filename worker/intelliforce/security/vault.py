"""Vault service — encrypt/decrypt de secrets via Fernet (AES-128-CBC + HMAC-SHA256).

Lê master key de VAULT_MASTER_KEY do env. Falha rápido na boot se ausente.

Master key é gerada uma vez via:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

E nunca rotacionada sem migrar todos os secrets criptografados (rotacionar
inviabiliza descriptografar dados antigos).
"""
from __future__ import annotations

import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken


class VaultError(Exception):
    """Erro genérico do Vault — master key ausente, ciphertext corrompido, etc."""


class VaultService:
    """Singleton que encripta/descriptografa secrets em memória.

    Master key vem de VAULT_MASTER_KEY (env var). Stateless além da key.
    """

    def __init__(self, master_key: str) -> None:
        if not master_key:
            raise VaultError(
                "VAULT_MASTER_KEY ausente. Gere via "
                "`python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'`"
                " e adicione ao .env."
            )
        try:
            self._fernet = Fernet(master_key.encode("utf-8"))
        except Exception as e:
            raise VaultError(
                f"VAULT_MASTER_KEY inválida (esperado base64 url-safe de 32 bytes): {e}"
            ) from e

    def encrypt(self, plaintext: str) -> bytes:
        """Encripta texto e retorna ciphertext (bytes pra guardar no DB)."""
        if not isinstance(plaintext, str):
            raise VaultError("plaintext precisa ser str")
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, ciphertext: bytes) -> str:
        """Descriptografa bytes e retorna o plaintext original."""
        if not isinstance(ciphertext, (bytes, bytearray)):
            raise VaultError("ciphertext precisa ser bytes")
        try:
            return self._fernet.decrypt(bytes(ciphertext)).decode("utf-8")
        except InvalidToken as e:
            raise VaultError(
                "Não foi possível descriptografar (ciphertext corrompido ou "
                "VAULT_MASTER_KEY foi trocada). Secret não recuperável."
            ) from e


@lru_cache
def get_vault() -> VaultService:
    """Singleton lazy do VaultService. Falha rápido se master key ausente."""
    master_key = os.environ.get("VAULT_MASTER_KEY", "").strip()
    return VaultService(master_key)
