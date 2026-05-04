"""Camada de segurança — encryption, vault, secrets."""
from intelliforce.security.vault import VaultError, VaultService, get_vault

__all__ = ["VaultService", "VaultError", "get_vault"]
