"""Renderiza Markdown → PDF (pure-python: markdown + fpdf2).

Sem dependências de sistema (evita cairo/pango do weasyprint/xhtml2pdf) — roda na
imagem slim. As fontes core do fpdf2 são Latin-1, então caracteres fora do Latin-1
(setas, travessões, aspas curvas, emoji) são convertidos para equivalentes ASCII
antes de renderizar — assim o PDF nunca cai no fallback cru.
"""
from __future__ import annotations

import markdown as _md
from fpdf import FPDF

# Marca IntelliForce (verde).
_BRAND = (16, 185, 129)
_INK = (24, 24, 27)
_MUTED = (130, 130, 130)

# Unicode fora do Latin-1 → equivalente legível. Mantém acentos do PT-BR (que são
# Latin-1) intactos; só troca o que quebraria as fontes core.
_UNICODE_MAP = {
    "—": "-", "–": "-", "―": "-", "‐": "-", "‑": "-",
    "“": '"', "”": '"', "„": '"', "‟": '"', "«": '"', "»": '"',
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "…": "...",
    "•": "-", "◦": "-", "▪": "-", "‣": "-",
    "→": "->", "←": "<-", "↔": "<->", "⇒": "=>",
    "↑": "^", "↓": "v",
    "▲": "^", "▼": "v", "▬": "=", "►": ">", "◄": "<",
    "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~",
    "✓": "[ok]", "✔": "[ok]", "✗": "x", "✕": "x", "☑": "[ok]",
    "⚠": "[!]", "❗": "(!)", "❌": "[x]", "✅": "[ok]",
    "™": "(TM)", "℠": "(SM)",
    " ": " ", " ": " ", " ": " ", "​": "", "️": "",
}


def _sanitize(s: str) -> str:
    """Troca Unicode não-Latin1 por ASCII e garante que tudo cabe no Latin-1."""
    if not s:
        return ""
    for bad, good in _UNICODE_MAP.items():
        if bad in s:
            s = s.replace(bad, good)
    return s.encode("latin-1", "replace").decode("latin-1")


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class _ReportPDF(FPDF):
    """FPDF com cabeçalho/rodapé de marca e paginação."""

    def header(self) -> None:
        self.set_y(8)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*_MUTED)
        self.cell(0, 5, "IntelliForce  -  Report Center")
        self.ln(6)
        self.set_draw_color(*_BRAND)
        self.set_line_width(0.6)
        y = self.get_y()
        self.line(self.l_margin, y, self.w - self.r_margin, y)
        self.ln(4)
        self.set_text_color(*_INK)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*_MUTED)
        self.cell(0, 8, f"Página {self.page_no()}", align="C")


def render_pdf(content_md: str, title: str) -> bytes:
    """Converte Markdown em PDF. Lança RuntimeError se a geração falhar."""
    md = _sanitize(content_md or "")
    safe_title = _sanitize(title or "Relatório")

    body_html = _md.markdown(md, extensions=["extra", "sane_lists"])
    # Tabelas com borda e largura cheia ficam muito mais legíveis no PDF.
    body_html = body_html.replace("<table>", '<table border="1" width="100%">')

    # Evita título duplicado: se o conteúdo já abre com um H1, não prefixa o título.
    head = "" if md.lstrip().startswith("# ") else f"<h1>{_escape(safe_title)}</h1>\n"
    html = head + body_html

    pdf = _ReportPDF()
    pdf.set_title(safe_title)
    pdf.set_margins(left=15, top=10, right=15)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)

    try:
        pdf.write_html(html)
    except Exception:
        # Fallback robusto: se algum tag não for suportado, imprime o Markdown cru.
        fb = _ReportPDF()
        fb.set_title(safe_title)
        fb.set_margins(left=15, top=10, right=15)
        fb.set_auto_page_break(auto=True, margin=18)
        fb.add_page()
        fb.set_font("Helvetica", size=11)
        fb.multi_cell(0, 6, md)
        return bytes(fb.output())

    try:
        return bytes(pdf.output())
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Falha ao gerar PDF: {e}") from e
