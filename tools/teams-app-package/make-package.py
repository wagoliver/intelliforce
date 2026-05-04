#!/usr/bin/env python3
"""make-package.py — gera o .zip de Teams App customizado pra IntelliForce.

Substitui placeholders no manifest.template.json, gera ícones PNG mínimos
(192x192 colorido + 32x32 outline) e empacota tudo em intelliforce-teams.zip
pronto pra upload no Teams Admin Center.

Uso:
    python make-package.py --client-id <AZURE_CLIENT_ID>

Saída: ./intelliforce-teams.zip

Os PNGs gerados são placeholders sólidos — o Teams aceita perfeitamente.
Quer customizar com logo da empresa? Substitua color.png (192x192,
fundo opaco) e outline.png (32x32, branco com transparência) e rode o
zip manualmente:
    zip intelliforce-teams.zip manifest.json color.png outline.png
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
import uuid
import zipfile
import zlib
from pathlib import Path

HERE = Path(__file__).parent

# Cor accent IntelliForce (verde, mesma da UI)
ACCENT_RGB = (22, 163, 74)  # #16a34a


# ─────────────────────────────────────────────────────────────────────────────
# PNG mínimo via stdlib (sem PIL)
# ─────────────────────────────────────────────────────────────────────────────
def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    chunk = chunk_type + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk))


def _png(width: int, height: int, pixels: list[bytes]) -> bytes:
    """Cria PNG RGBA. `pixels` é uma lista de `height` linhas, cada uma com
    `width * 4` bytes (RGBA por pixel)."""
    sig = b"\x89PNG\r\n\x1a\n"
    # IHDR: width, height, bit depth (8), color type (6 = RGBA), compression,
    # filter, interlace
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    # IDAT: cada scanline prefixada com filter byte 0
    raw = b"".join(b"\x00" + row for row in pixels)
    idat = zlib.compress(raw, level=9)
    return (
        sig
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat)
        + _png_chunk(b"IEND", b"")
    )


def make_color_icon(path: Path, size: int = 192) -> None:
    """192x192, verde sólido com um quadrado branco arredondado simulando 'IF'."""
    r, g, b = ACCENT_RGB
    rows = []
    margin = size // 4  # ~25% de margem
    inner_start = margin
    inner_end = size - margin

    for y in range(size):
        row = bytearray()
        for x in range(size):
            in_inner = inner_start <= x < inner_end and inner_start <= y < inner_end
            if in_inner:
                # Quadrado interno branco
                row.extend([255, 255, 255, 255])
            else:
                # Background verde
                row.extend([r, g, b, 255])
        rows.append(bytes(row))
    path.write_bytes(_png(size, size, rows))


def make_outline_icon(path: Path, size: int = 32) -> None:
    """32x32, branco com transparência — só borda quadrada simples."""
    border = 2
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            on_border = (
                x < border
                or x >= size - border
                or y < border
                or y >= size - border
            )
            if on_border:
                row.extend([255, 255, 255, 255])
            else:
                row.extend([0, 0, 0, 0])
        rows.append(bytes(row))
    path.write_bytes(_png(size, size, rows))


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline
# ─────────────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gera Teams App package zip pronto pra upload."
    )
    parser.add_argument(
        "--client-id",
        required=True,
        help="Azure AD App Registration client_id (mesmo cadastrado no Vault).",
    )
    parser.add_argument(
        "--app-id",
        default=None,
        help="UUID do Teams App (deixa vazio pra gerar novo). "
        "Use o existente se for atualizar versão.",
    )
    parser.add_argument(
        "--output",
        default=str(HERE / "intelliforce-teams.zip"),
        help="Path do .zip de saída.",
    )
    args = parser.parse_args()

    template_path = HERE / "manifest.template.json"
    if not template_path.is_file():
        print(f"ERROR: manifest.template.json não encontrado em {template_path}", file=sys.stderr)
        return 1

    teams_app_id = args.app_id or str(uuid.uuid4())

    # Substitui placeholders
    template = template_path.read_text(encoding="utf-8")
    manifest = (
        template
        .replace("__AZURE_CLIENT_ID__", args.client_id)
        .replace("__TEAMS_APP_ID__", teams_app_id)
    )
    # Valida que é JSON válido depois da substituição
    try:
        json.loads(manifest)
    except json.JSONDecodeError as e:
        print(f"ERROR: manifest gerado não é JSON válido: {e}", file=sys.stderr)
        return 1

    # Gera ícones
    color_path = HERE / "color.png"
    outline_path = HERE / "outline.png"
    make_color_icon(color_path)
    make_outline_icon(outline_path)

    # Empacota tudo num zip (manifest.json + ícones na raiz)
    out = Path(args.output)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest)
        zf.write(color_path, "color.png")
        zf.write(outline_path, "outline.png")

    print(f"✓ Package gerado: {out}")
    print(f"  Teams App ID:  {teams_app_id}")
    print(f"  client_id:     {args.client_id}")
    print(f"  Tamanho:       {out.stat().st_size} bytes")
    print()
    print("Próximos passos:")
    print(
        "  1. Abre https://admin.teams.microsoft.com → Teams apps → Manage apps"
    )
    print("  2. Upload new app → escolhe o intelliforce-teams.zip")
    print("  3. Aprova as permissions (RSC) que aparecerem")
    print("  4. No Teams desktop, vai no Team alvo → Manage team → Apps → Add → IntelliForce")
    print("  5. Testa send: pelo /skills do IntelliForce, peça pro operator")
    print("     mandar mensagem teste no channel 'Digital Employee'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
