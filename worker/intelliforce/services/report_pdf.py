"""Renderiza Markdown → PDF (pure-python: markdown + fpdf2).

Sem dependências de sistema (evita cairo/pango do weasyprint/xhtml2pdf) — roda
na imagem slim. Usa as fontes core (Latin-1), suficiente para pt-BR.
"""
from __future__ import annotations

import markdown as _md
from fpdf import FPDF


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_pdf(content_md: str, title: str) -> bytes:
    """Converte Markdown em PDF. Lança RuntimeError se a geração falhar."""
    body_html = _md.markdown(
        content_md or "",
        extensions=["extra", "sane_lists"],
    )
    safe_title = _escape(title or "Relatório")
    html = f"<h1>{safe_title}</h1>\n{body_html}"

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)

    try:
        pdf.write_html(html)
    except Exception:
        # Fallback robusto: se algum tag HTML não for suportado pelo write_html,
        # imprime o Markdown cru (latin-1) pra nunca falhar a geração.
        fallback = FPDF()
        fallback.set_auto_page_break(auto=True, margin=15)
        fallback.add_page()
        fallback.set_font("Helvetica", size=11)
        text = (content_md or "").encode("latin-1", "replace").decode("latin-1")
        fallback.multi_cell(0, 6, text)
        return bytes(fallback.output())

    try:
        return bytes(pdf.output())
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Falha ao gerar PDF: {e}") from e
