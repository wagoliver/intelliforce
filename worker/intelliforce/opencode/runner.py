"""Wrapper Python pra invocar OpenCode CLI como subprocess.

Encapsula:
  - Construção do comando
  - Execução async com timeout
  - Parsing do stream NDJSON do stdout
  - Acumulação de tokens, custo, latência
  - Captura completa de stdout/stderr pra audit
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import structlog

from intelliforce.settings import get_settings

log = structlog.get_logger()

# Buffer máximo por linha NDJSON do CLI OpenCode. Default do StreamReader é
# 64KB, mas eventos podem ser bem maiores quando carregam tool results (ex:
# Read num arquivo longo, texto extenso de resposta do modelo). 10MB cobre
# casos práticos sem comprometer memória.
_STREAM_LIMIT_BYTES = 10 * 1024 * 1024


@dataclass
class OpenCodeResult:
    """Resultado de uma invocação do OpenCode CLI."""

    success: bool
    exit_code: int
    text: str = ""                          # texto final acumulado da resposta
    session_id: str | None = None
    events: list[dict[str, Any]] = field(default_factory=list)  # cada linha NDJSON
    raw_stdout: str = ""
    raw_stderr: str = ""
    duration_ms: int = 0
    tokens_input: int = 0
    tokens_output: int = 0
    tokens_reasoning: int = 0
    tokens_cache_read: int = 0
    tokens_cache_write: int = 0
    cost_usd: float = 0.0
    error_message: str | None = None
    command: list[str] = field(default_factory=list)


class OpenCodeRunner:
    """Invoca o binário `opencode` via subprocess e parseia o output."""

    def __init__(
        self,
        binary: str = "opencode",
        config_path: str | None = None,
        default_timeout_seconds: int | None = None,
    ) -> None:
        settings = get_settings()
        self.binary = binary
        self.config_path = config_path or settings.opencode_config_path
        self.default_timeout_seconds = (
            default_timeout_seconds or settings.opencode_timeout_seconds
        )

    async def run(
        self,
        prompt: str,
        agent: str | None = None,
        model: str | None = None,
        session_id: str | None = None,
        continue_session: bool = False,
        timeout_seconds: int | None = None,
        extra_args: list[str] | None = None,
    ) -> OpenCodeResult:
        """Executa OpenCode com o prompt dado. Retorna OpenCodeResult."""
        cmd = self._build_command(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            extra_args=extra_args,
        )
        timeout = timeout_seconds or self.default_timeout_seconds

        log.info("opencode.cli_invoked", command=cmd, cwd=self.config_path, timeout=timeout)
        start = time.monotonic()

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.config_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                limit=_STREAM_LIMIT_BYTES,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except TimeoutError:
                proc.kill()
                await proc.wait()
                duration_ms = int((time.monotonic() - start) * 1000)
                log.error("opencode.cli_timeout", duration_ms=duration_ms, timeout=timeout)
                return OpenCodeResult(
                    success=False,
                    exit_code=-1,
                    error_message=f"Timeout após {timeout}s",
                    duration_ms=duration_ms,
                    command=cmd,
                )

            duration_ms = int((time.monotonic() - start) * 1000)
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            exit_code = proc.returncode or 0

            result = self._parse_result(
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                duration_ms=duration_ms,
                command=cmd,
            )

            log.info(
                "opencode.cli_completed",
                success=result.success,
                exit_code=result.exit_code,
                duration_ms=result.duration_ms,
                tokens_input=result.tokens_input,
                tokens_output=result.tokens_output,
                cost_usd=result.cost_usd,
                events=len(result.events),
            )
            return result

        except FileNotFoundError as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            log.error("opencode.cli_not_found", error=str(e))
            return OpenCodeResult(
                success=False,
                exit_code=-1,
                error_message=f"Binário não encontrado: {self.binary} ({e})",
                duration_ms=duration_ms,
                command=cmd,
            )
        except Exception as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            log.exception("opencode.cli_unexpected_error")
            return OpenCodeResult(
                success=False,
                exit_code=-1,
                error_message=f"Erro inesperado: {e}",
                duration_ms=duration_ms,
                command=cmd,
            )

    async def run_stream(
        self,
        prompt: str,
        agent: str | None = None,
        model: str | None = None,
        session_id: str | None = None,
        continue_session: bool = False,
        timeout_seconds: int | None = None,
        extra_args: list[str] | None = None,
        extra_env: dict[str, str] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Executa OpenCode e yielda cada linha NDJSON do stdout em tempo real.

        Diferente de run(), não acumula nem retorna OpenCodeResult — quem consume
        é responsável por agregar o que precisar. Eventos sintéticos extras emitidos:

          - {"type": "stream_start", "command": [...]}                      (antes do primeiro evento)
          - {"type": "stream_end", "exit_code": int, "duration_ms": int,    (depois do último)
             "stderr": str}
          - {"type": "stream_error", "error": str}                          (em caso de exceção)

        Esses eventos sintéticos têm o prefixo "stream_" pra não colidir com os tipos do CLI.

        `extra_env`: env vars adicionais propagadas pro subprocess. Usado pra
        passar credenciais (INTELLIFORCE_TOKEN) e config (INTELLIFORCE_API_URL)
        pros scripts Python das skills sem expor no command line.
        """
        cmd = self._build_command(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            extra_args=extra_args,
        )
        timeout = timeout_seconds or self.default_timeout_seconds
        env = {**os.environ, **(extra_env or {})}

        log.info(
            "opencode.cli_stream_start",
            command=cmd,
            cwd=self.config_path,
            timeout=timeout,
            extra_env_keys=list((extra_env or {}).keys()),
        )
        start = time.monotonic()

        proc: asyncio.subprocess.Process | None = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=self.config_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                limit=_STREAM_LIMIT_BYTES,
            )

            yield {"type": "stream_start", "command": cmd}

            assert proc.stdout is not None  # subprocess garante PIPE → não-nulo
            timed_out = False

            # Modo debug: setar OPENCODE_LOG_RAW_EVENTS=1 no .env loga cada
            # evento NDJSON do CLI (truncado). Útil pra mapear shapes de tool
            # calls que ainda caem no fallback genérico no frontend.
            log_raw = os.environ.get("OPENCODE_LOG_RAW_EVENTS", "").lower() in ("1", "true", "yes")

            async def read_lines() -> AsyncIterator[dict[str, Any]]:
                assert proc is not None and proc.stdout is not None
                async for raw in proc.stdout:
                    line = raw.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        log.warning("opencode.cli_stream_bad_json", line=line[:200])
                        continue
                    if log_raw:
                        # Trunca pra evitar payload gigante (ex.: write com
                        # content de 500kb)
                        log.info(
                            "opencode.cli_event",
                            type=event.get("type"),
                            preview=json.dumps(event, ensure_ascii=False)[:500],
                        )
                    yield event

            try:
                async with asyncio.timeout(timeout):
                    async for event in read_lines():
                        yield event
            except TimeoutError:
                timed_out = True
                log.error("opencode.cli_stream_timeout", timeout=timeout)
                if proc.returncode is None:
                    proc.kill()

            await proc.wait()
            duration_ms = int((time.monotonic() - start) * 1000)

            stderr_bytes = b""
            if proc.stderr is not None:
                try:
                    stderr_bytes = await proc.stderr.read()
                except Exception:
                    pass
            stderr_text = stderr_bytes.decode("utf-8", errors="replace")

            exit_code = proc.returncode if proc.returncode is not None else -1
            if timed_out:
                yield {
                    "type": "stream_error",
                    "error": f"Timeout após {timeout}s",
                    "duration_ms": duration_ms,
                }
            yield {
                "type": "stream_end",
                "exit_code": exit_code,
                "duration_ms": duration_ms,
                "stderr": stderr_text,
            }
            log.info(
                "opencode.cli_stream_completed",
                exit_code=exit_code,
                duration_ms=duration_ms,
                timed_out=timed_out,
            )

        except FileNotFoundError as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            log.error("opencode.cli_not_found", error=str(e))
            yield {
                "type": "stream_error",
                "error": f"Binário não encontrado: {self.binary}",
                "duration_ms": duration_ms,
            }
        except Exception as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            log.exception("opencode.cli_stream_unexpected_error")
            yield {
                "type": "stream_error",
                "error": f"Erro inesperado: {e}",
                "duration_ms": duration_ms,
            }
        finally:
            # Garantia: mata o subprocess se ainda estiver vivo. Cobre todos os
            # caminhos de saída antecipada — incluindo CancelledError (Py 3.11+
            # não herda de Exception, então passa direto pelos except). Quando
            # o cliente HTTP fecha conexão SSE, FastAPI cancela o producer task
            # no chat.py, que fecha esse async gen via aclose(), disparando
            # este finally e evitando subprocess zumbi.
            if proc is not None and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:  # noqa: BLE001
                    pass

    def _build_command(
        self,
        prompt: str,
        agent: str | None,
        model: str | None,
        session_id: str | None,
        continue_session: bool,
        extra_args: list[str] | None,
    ) -> list[str]:
        cmd = [
            self.binary,
            "run",
            "--format", "json",
            "--dangerously-skip-permissions",
            # Emite reasoning/thinking chunks como eventos NDJSON separados.
            # Sem isso, o modelo "pensa" silenciosamente (visível só nos
            # tokens.reasoning do step_finish, mas sem conteúdo). Com a flag,
            # o frontend pode renderizar o raciocínio em tempo real.
            "--thinking",
        ]
        if agent:
            cmd.extend(["--agent", agent])
        if model:
            cmd.extend(["--model", model])
        if session_id:
            cmd.extend(["--session", session_id])
        if continue_session:
            cmd.append("--continue")
        if extra_args:
            cmd.extend(extra_args)
        cmd.append(prompt)
        return cmd

    def _parse_result(
        self,
        stdout: str,
        stderr: str,
        exit_code: int,
        duration_ms: int,
        command: list[str],
    ) -> OpenCodeResult:
        """Parseia stdout NDJSON e extrai métricas."""
        events: list[dict[str, Any]] = []
        text_parts: list[str] = []
        session_id: str | None = None
        tokens = {
            "input": 0,
            "output": 0,
            "reasoning": 0,
            "cache_read": 0,
            "cache_write": 0,
        }
        cost = 0.0

        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            events.append(event)

            etype = event.get("type")
            if etype == "text":
                text_parts.append(event.get("part", {}).get("text", ""))
            elif etype == "step_finish":
                part = event.get("part", {})
                t = part.get("tokens", {})
                tokens["input"] += t.get("input", 0)
                tokens["output"] += t.get("output", 0)
                tokens["reasoning"] += t.get("reasoning", 0)
                cache = t.get("cache", {})
                tokens["cache_read"] += cache.get("read", 0)
                tokens["cache_write"] += cache.get("write", 0)
                cost += part.get("cost", 0) or 0

            sid = event.get("sessionID")
            if sid and not session_id:
                session_id = sid

        success = exit_code == 0 and bool(text_parts)
        return OpenCodeResult(
            success=success,
            exit_code=exit_code,
            text="".join(text_parts),
            session_id=session_id,
            events=events,
            raw_stdout=stdout,
            raw_stderr=stderr,
            duration_ms=duration_ms,
            tokens_input=tokens["input"],
            tokens_output=tokens["output"],
            tokens_reasoning=tokens["reasoning"],
            tokens_cache_read=tokens["cache_read"],
            tokens_cache_write=tokens["cache_write"],
            cost_usd=cost,
            error_message=None if success else f"Exit code {exit_code}",
            command=command,
        )


# -----------------------------------------------------------------------------
# Helper standalone pra testar manualmente:
#   python -m intelliforce.opencode.runner "Diga olá em uma palavra"
# -----------------------------------------------------------------------------
async def _amain(prompt: str, agent: str | None = None) -> None:
    import logging
    logging.basicConfig(level=logging.INFO)
    runner = OpenCodeRunner()
    result = await runner.run(prompt=prompt, agent=agent)
    print("=" * 60)
    print(f"Success:    {result.success}")
    print(f"Exit code:  {result.exit_code}")
    print(f"Duration:   {result.duration_ms}ms")
    print(f"Session ID: {result.session_id}")
    print(f"Tokens:     in={result.tokens_input} out={result.tokens_output} "
          f"reasoning={result.tokens_reasoning}")
    print(f"Cost USD:   {result.cost_usd}")
    print(f"Events:     {len(result.events)}")
    print("-" * 60)
    print("Resposta:")
    print(result.text)
    if result.raw_stderr:
        print("-" * 60)
        print("Stderr:")
        print(result.raw_stderr)


if __name__ == "__main__":
    import sys
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Diga olá em uma palavra"
    agent = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(_amain(prompt, agent))
