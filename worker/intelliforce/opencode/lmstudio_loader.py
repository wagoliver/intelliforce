"""Carga lazy de modelo no LM Studio quando o CLI OpenCode falha com
'No models loaded'.

Isolado num módulo só pra:
  1. Manter `runner.py` sem dependência direta do SDK `lmstudio`.
  2. Permitir que o worker continue subindo se o pacote `lmstudio` não
     estiver instalado (degrada pra "load não tentado", não derruba).

A LM Studio do Mac mini é apenas o "front door" — a inferência real roda
em outro host (RTX 5090) ligado via LM Link. Quando carregamos via SDK,
o LM Studio decide internamente em qual nó instanciar; a metadata da
instância retornada (`identifier`/`instance_reference`) é logada pra
auditoria sem bloquear o fluxo.
"""
from __future__ import annotations

import asyncio
from typing import Any

import structlog

from intelliforce.settings import get_settings

log = structlog.get_logger()

try:
    import lmstudio as _lmstudio  # type: ignore[import-not-found]
    _SDK_AVAILABLE = True
except Exception as _e:  # noqa: BLE001
    _lmstudio = None  # type: ignore[assignment]
    _SDK_AVAILABLE = False
    log.warning("lmstudio.sdk_unavailable", error=str(_e))


def extract_lmstudio_key(model: str | None) -> str | None:
    """Devolve a parte depois de 'lmstudio/' do identifier do agente.

    Ex.: 'lmstudio/qwen3.6-27b-mtp' -> 'qwen3.6-27b-mtp'.
    Retorna None se o modelo não estiver no provider lmstudio (caller
    decide o fallback — geralmente settings.lmstudio_default_model).
    """
    if not model:
        return None
    prefix = "lmstudio/"
    if model.startswith(prefix):
        rest = model[len(prefix):]
        return rest or None
    return None


def _server_address() -> str:
    """Deriva 'host:porta' do lmstudio_base_url, dropando o /v1 e o scheme.

    O SDK lmstudio espera um endereço sem 'http://' nem path.
    """
    raw = get_settings().lmstudio_base_url.strip()
    for scheme in ("http://", "https://"):
        if raw.startswith(scheme):
            raw = raw[len(scheme):]
            break
    if "/" in raw:
        raw = raw.split("/", 1)[0]
    return raw


def _identifiers_match(loaded_id: str, model_key: str) -> bool:
    """Confirma se um modelo já carregado corresponde ao model_key pedido.

    LM Studio pode retornar identifiers em formatos ligeiramente
    diferentes do que pedimos (com ou sem prefixo de família). Match
    bidirecional via substring cobre os casos práticos sem virar regex.
    """
    if not loaded_id:
        return False
    return loaded_id == model_key or loaded_id in model_key or model_key in loaded_id


def _instance_meta(item: Any) -> dict[str, Any]:
    """Extrai metadata útil de um item do list_loaded() pra log."""
    meta: dict[str, Any] = {}
    for attr in ("identifier", "model_key", "path", "instance_reference", "address"):
        try:
            value = getattr(item, attr, None)
            if value is not None:
                meta[attr] = str(value)
        except Exception:  # noqa: BLE001
            pass
    return meta


def _ensure_loaded_sync(model_key: str) -> tuple[bool, str | None]:
    """Bloco síncrono — chamado via asyncio.to_thread por ensure_loaded().

    O SDK lmstudio é sync; embrulhamos pra não travar o event loop do
    worker async.
    """
    assert _lmstudio is not None  # garantido por _SDK_AVAILABLE
    address = _server_address()
    try:
        client = _lmstudio.Client(address)
    except Exception as e:  # noqa: BLE001
        return False, f"client init failed: {e}"

    # 1. Já carregado?
    try:
        loaded = client.llm.list_loaded()
    except Exception as e:  # noqa: BLE001
        return False, f"list_loaded failed: {e}"

    for item in loaded or []:
        loaded_id = getattr(item, "identifier", "") or getattr(item, "model_key", "") or ""
        if _identifiers_match(loaded_id, model_key):
            log.info(
                "lmstudio.model_already_loaded",
                model_key=model_key,
                instance=_instance_meta(item),
            )
            return True, loaded_id or model_key

    # 2. Carregar agora.
    log.info("lmstudio.load_attempt", model_key=model_key, address=address)
    try:
        instance = client.llm.load_new_instance(model_key)
    except Exception as e:  # noqa: BLE001
        log.error("lmstudio.load_failed", model_key=model_key, error=str(e))
        return False, f"load_new_instance failed: {e}"

    meta = _instance_meta(instance)
    log.info("lmstudio.model_loaded", model_key=model_key, instance=meta)
    instance_ref = meta.get("identifier") or meta.get("instance_reference") or model_key
    return True, instance_ref


async def ensure_loaded(model_key: str) -> tuple[bool, str | None]:
    """Garante que `model_key` está carregado no LM Studio.

    Retorna (ok, instance_ref_or_error). Idempotente: se já estiver
    carregado, é no-op (verifica via list_loaded primeiro). Sem loops
    nem retries internos — o caller decide se tenta de novo.

    Degrada gracefully se o SDK não estiver disponível (False, msg).
    """
    if not _SDK_AVAILABLE:
        return False, "lmstudio SDK not available"
    if not model_key:
        return False, "empty model_key"
    return await asyncio.to_thread(_ensure_loaded_sync, model_key)
