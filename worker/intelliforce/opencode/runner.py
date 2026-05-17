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

from intelliforce.opencode.lmstudio_loader import ensure_loaded, extract_lmstudio_key
from intelliforce.settings import get_settings

log = structlog.get_logger()

# Buffer máximo por linha NDJSON do CLI OpenCode. Default do StreamReader é
# 64KB, mas eventos podem ser bem maiores quando carregam tool results (ex:
# Read num arquivo longo, texto extenso de resposta do modelo). 10MB cobre
# casos práticos sem comprometer memória.
_STREAM_LIMIT_BYTES = 10 * 1024 * 1024

# Substring literal da mensagem que o LM Studio devolve quando nenhum
# modelo está carregado. O CLI OpenCode (via @ai-sdk/openai-compatible)
# repassa isso pra stderr e/ou pra um evento NDJSON tipo "error"/"abort".
_NO_MODELS_MARKER = "No models loaded"


def _is_no_models_error(stderr: str, events: list[dict[str, Any]]) -> bool:
    """Detecta o erro "No models loaded" do LM Studio em stderr ou eventos.

    Match literal — sem regex em cascata. Eventos são consultados apenas
    nos tipos {"error", "abort"} pra evitar matchear texto vindo do
    próprio prompt/resposta do usuário.
    """
    if stderr and _NO_MODELS_MARKER in stderr:
        return True
    for event in events:
        etype = event.get("type")
        if etype not in ("error", "abort"):
            continue
        err_text = event.get("error") or ""
        if isinstance(err_text, str) and _NO_MODELS_MARKER in err_text:
            return True
        part_text = (event.get("part") or {}).get("text") or ""
        if isinstance(part_text, str) and _NO_MODELS_MARKER in part_text:
            return True
    return False


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
    # True se o runner detectou "No models loaded", carregou o modelo via
    # SDK lmstudio e re-executou o subprocess. Apenas observabilidade.
    retry_attempted: bool = False


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
        extra_env: dict[str, str] | None = None,
    ) -> OpenCodeResult:
        """Executa OpenCode com o prompt dado. Retorna OpenCodeResult.

        `extra_env`: env vars adicionais propagadas pro subprocess. Usado
        pra injetar INTELLIFORCE_TOKEN do user logado (chat) ou da service
        account (worker scheduled tasks) sem mexer no env do worker host.

        Lazy retry: se a 1ª execução falhar com "No models loaded" do LM
        Studio e settings.lmstudio_auto_load=True, tenta carregar o modelo
        via SDK lmstudio e re-executa uma única vez.
        """
        result = await self._run_once(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            timeout_seconds=timeout_seconds,
            extra_args=extra_args,
            extra_env=extra_env,
        )

        if result.success:
            return result
        if not _is_no_models_error(result.raw_stderr, result.events):
            return result
        if not get_settings().lmstudio_auto_load:
            return result

        model_key = extract_lmstudio_key(model) or extract_lmstudio_key(
            f"lmstudio/{get_settings().lmstudio_default_model}"
        )
        if not model_key:
            return result

        ok, info = await ensure_loaded(model_key)
        if not ok:
            original = result.error_message or f"Exit code {result.exit_code}"
            result.error_message = f"{original} | LM Studio load failed: {info}"
            return result

        log.info("opencode.cli_retry_after_load", model_key=model_key, instance=info)
        retried = await self._run_once(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            timeout_seconds=timeout_seconds,
            extra_args=extra_args,
            extra_env=extra_env,
        )
        retried.retry_attempted = True
        return retried

    async def _run_once(
        self,
        prompt: str,
        agent: str | None,
        model: str | None,
        session_id: str | None,
        continue_session: bool,
        timeout_seconds: int | None,
        extra_args: list[str] | None,
        extra_env: dict[str, str] | None,
    ) -> OpenCodeResult:
        """Uma única invocação do subprocess. Caller orquestra retry."""
        cmd = self._build_command(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            extra_args=extra_args,
        )
        timeout = timeout_seconds or self.default_timeout_seconds

        log.info(
            "opencode.cli_invoked",
            command=cmd, cwd=self.config_path, timeout=timeout,
            extra_env_keys=list((extra_env or {}).keys()),
        )
        start = time.monotonic()
        env = {**os.environ, **(extra_env or {})}

        try:
            # Workaround: asyncio.create_subprocess_exec dentro do request
            # handler do uvicorn fica com stdout vazio (subprocess sai exit 0
            # sem produzir output). Mesma chamada via asyncio.run standalone
            # funciona. Rodar via subprocess.run em thread pool contorna o
            # problema sem mudar a semântica blocking de _run_once.
            import subprocess as _sp
            loop = asyncio.get_running_loop()
            try:
                import shlex as _shlex, tempfile as _tmp, os as _os
                _outdir = _tmp.mkdtemp(prefix="opencode-")
                _out_path = f"{_outdir}/stdout"
                _err_path = f"{_outdir}/stderr"
                _cmd_str = " ".join(_shlex.quote(c) for c in cmd)
                _env_exports = " ".join(f"{k}={_shlex.quote(v)}" for k, v in (extra_env or {}).items())
                _shell_cmd = f"cd {_shlex.quote(self.config_path)} && {_env_exports} {_cmd_str} >{_shlex.quote(_out_path)} 2>{_shlex.quote(_err_path)}"
                exit_code_shell = await loop.run_in_executor(None, lambda: _os.system(_shell_cmd))
                exit_code = (exit_code_shell >> 8) & 0xFF
                try:
                    with open(_out_path, "rb") as _f:
                        _stdout_bytes = _f.read()
                    with open(_err_path, "rb") as _f:
                        _stderr_bytes = _f.read()
                except Exception:
                    _stdout_bytes, _stderr_bytes = b"", b""
                finally:
                    try:
                        import shutil as _shutil
                        _shutil.rmtree(_outdir, ignore_errors=True)
                    except Exception:
                        pass

                class _Completed:
                    def __init__(self, ec, so, se):
                        self.returncode = ec
                        self.stdout = so
                        self.stderr = se

                completed = _Completed(exit_code, _stdout_bytes, _stderr_bytes)
            except _sp.TimeoutExpired:
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
            stdout = completed.stdout.decode("utf-8", errors="replace")
            stderr = completed.stderr.decode("utf-8", errors="replace")
            exit_code = completed.returncode or 0

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
                raw_stdout_len=len(result.raw_stdout),
                raw_stderr_len=len(result.raw_stderr),
                raw_stderr_preview=result.raw_stderr[:500],
                raw_stdout_preview=result.raw_stdout[:500],
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
        """Executa OpenCode com retry lazy se a 1ª tentativa falhar com
        "No models loaded" antes de emitir conteúdo substancial.

        Bufferiza os primeiros eventos até o primeiro de:
          - {"type": "text"} com texto não-vazio
          - {"type": "step_start" | "step_finish" | "tool_call" | "tool_result"}
          - {"type": "stream_end" | "stream_error"}

        Se o stream terminar antes de qualquer evento substancial e a causa
        for "No models loaded", carrega o modelo via SDK lmstudio, emite
        {"type": "stream_info", ...} e re-executa uma única vez, marcando
        retry_attempted=True no stream_end final.

        Caso contrário, repassa o buffer e continua normalmente — sem retry
        depois de já ter emitido conteúdo (consumer não pode "voltar").
        """
        first_run_buffer: list[dict[str, Any]] = []
        saw_substantive = False
        final_event: dict[str, Any] | None = None

        async for event in self._run_stream_once(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            timeout_seconds=timeout_seconds,
            extra_args=extra_args,
            extra_env=extra_env,
        ):
            etype = event.get("type")

            if saw_substantive:
                yield event
                continue

            if etype == "text":
                part_text = (event.get("part") or {}).get("text") or ""
                if part_text.strip():
                    saw_substantive = True
            elif etype in ("step_start", "step_finish", "tool_call", "tool_result"):
                saw_substantive = True

            if etype in ("stream_end", "stream_error"):
                final_event = event
                break

            if saw_substantive:
                for ev in first_run_buffer:
                    yield ev
                first_run_buffer.clear()
                yield event
            else:
                first_run_buffer.append(event)

        if final_event is None:
            return

        stderr_text = final_event.get("stderr", "") if final_event.get("type") == "stream_end" else ""
        error_text = final_event.get("error", "") or ""
        combined_stderr = f"{stderr_text}\n{error_text}".strip()

        if not _is_no_models_error(combined_stderr, first_run_buffer):
            for ev in first_run_buffer:
                yield ev
            yield final_event
            return

        if not get_settings().lmstudio_auto_load:
            for ev in first_run_buffer:
                yield ev
            yield final_event
            return

        model_key = extract_lmstudio_key(model) or extract_lmstudio_key(
            f"lmstudio/{get_settings().lmstudio_default_model}"
        )
        if not model_key:
            for ev in first_run_buffer:
                yield ev
            yield final_event
            return

        ok, info = await ensure_loaded(model_key)
        if not ok:
            log.warning("opencode.cli_stream_load_failed", model_key=model_key, info=info)
            for ev in first_run_buffer:
                yield ev
            yield final_event
            return

        yield {
            "type": "stream_info",
            "message": "Carregando modelo no LM Studio…",
            "instance": info,
        }
        log.info("opencode.cli_stream_retry_after_load", model_key=model_key, instance=info)

        async for event in self._run_stream_once(
            prompt=prompt,
            agent=agent,
            model=model,
            session_id=session_id,
            continue_session=continue_session,
            timeout_seconds=timeout_seconds,
            extra_args=extra_args,
            extra_env=extra_env,
        ):
            if event.get("type") == "stream_end":
                event = {**event, "retry_attempted": True}
            yield event

    async def _run_stream_once(
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
        """Uma única invocação streaming do CLI. Caller orquestra retry.

        Eventos sintéticos emitidos:
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

        # Workaround: PIPE do asyncio.create_subprocess_exec — e Popen com
        # stdout=open_fd — ficam vazios quando spawnados de dentro do uvicorn
        # worker. A única forma que funciona é deixar o SHELL fazer o redirect
        # (`> arquivo`) pós-fork, igual `os.system`. Aqui usamos Popen com
        # shell=True e redirect na string; o async loop fica fazendo tail
        # incremental do arquivo enquanto subprocess roda.
        import shlex as _shlex
        import subprocess as _sp
        import tempfile as _tmp
        import shutil as _shutil

        log_raw = os.environ.get("OPENCODE_LOG_RAW_EVENTS", "").lower() in ("1", "true", "yes")

        outdir = _tmp.mkdtemp(prefix="opencode-stream-")
        out_path = f"{outdir}/stdout"
        err_path = f"{outdir}/stderr"
        # Toca os arquivos pra evitar FileNotFoundError no tail antes do shell rodar
        open(out_path, "wb").close()
        open(err_path, "wb").close()
        _cmd_str = " ".join(_shlex.quote(c) for c in cmd)
        _shell_cmd = (
            f"cd {_shlex.quote(self.config_path)} && "
            f"{_cmd_str} > {_shlex.quote(out_path)} 2> {_shlex.quote(err_path)}"
        )
        proc: _sp.Popen[bytes] | None = None
        try:
            proc = _sp.Popen(
                _shell_cmd,
                shell=True,
                stdin=_sp.DEVNULL,
                stdout=_sp.DEVNULL,
                stderr=_sp.DEVNULL,
                env=env,
                start_new_session=True,
            )

            yield {"type": "stream_start", "command": cmd}

            timed_out = False
            deadline = time.monotonic() + timeout
            pos = 0
            partial = b""

            with open(out_path, "rb") as reader:
                while True:
                    reader.seek(pos)
                    chunk = reader.read()
                    if chunk:
                        pos += len(chunk)
                        data = partial + chunk
                        # Last byte sem newline = linha incompleta — guarda
                        if data.endswith(b"\n"):
                            lines = data.split(b"\n")
                            partial = b""
                        else:
                            lines = data.split(b"\n")
                            partial = lines[-1]
                            lines = lines[:-1]
                        for raw in lines:
                            line = raw.decode("utf-8", errors="replace").strip()
                            if not line:
                                continue
                            try:
                                event = json.loads(line)
                            except json.JSONDecodeError:
                                log.warning("opencode.cli_stream_bad_json", line=line[:200])
                                continue
                            if log_raw:
                                log.info(
                                    "opencode.cli_event",
                                    type=event.get("type"),
                                    preview=json.dumps(event, ensure_ascii=False)[:500],
                                )
                            yield event

                    rc = proc.poll()
                    if rc is not None:
                        # Subprocess terminou — flush qualquer sobra residual
                        reader.seek(pos)
                        tail = reader.read()
                        if tail or partial:
                            final_data = partial + tail
                            for raw in final_data.split(b"\n"):
                                line = raw.decode("utf-8", errors="replace").strip()
                                if not line:
                                    continue
                                try:
                                    event = json.loads(line)
                                except json.JSONDecodeError:
                                    log.warning("opencode.cli_stream_bad_json", line=line[:200])
                                    continue
                                if log_raw:
                                    log.info(
                                        "opencode.cli_event",
                                        type=event.get("type"),
                                        preview=json.dumps(event, ensure_ascii=False)[:500],
                                    )
                                yield event
                            partial = b""
                        break

                    if time.monotonic() > deadline:
                        timed_out = True
                        log.error("opencode.cli_stream_timeout", timeout=timeout)
                        try:
                            proc.kill()
                        except Exception:
                            pass
                        break

                    await asyncio.sleep(0.05)

            # Espera subprocess fechar mesmo (poll já confirmou ou kill foi mandado)
            if proc.poll() is None:
                try:
                    await asyncio.to_thread(proc.wait, 5)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass

            duration_ms = int((time.monotonic() - start) * 1000)
            try:
                with open(err_path, "rb") as f:
                    stderr_text = f.read().decode("utf-8", errors="replace")
            except Exception:
                stderr_text = ""

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
            if proc is not None and proc.poll() is None:
                try:
                    proc.kill()
                    await asyncio.to_thread(proc.wait, 2)
                except Exception:  # noqa: BLE001
                    pass
            try:
                _shutil.rmtree(outdir, ignore_errors=True)
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
