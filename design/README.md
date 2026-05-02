# Design — IntelliForce

> Mockups interativos do IntelliForce, exportados do Claude.ai (design canvas). Esta pasta é **referência visual**, não código de produção.

## Como visualizar

Cada arquivo `.html` é uma tela auto-contida que roda direto no navegador (React via CDN + Babel standalone — sem build).

**Rodar localmente:**

```bash
cd design
python3 -m http.server 8000
# abrir http://localhost:8000/Login.html
```

Ou simplesmente clique duplo em qualquer `.html` no Finder.

## Telas disponíveis

| Arquivo | Tela | JSX principal |
|---------|------|---------------|
| `Login.html` | Sign in (com 2FA) | `app.jsx` |
| `Home.html` | Home v1 | `home.jsx` |
| `Home v2.html` | Home v2 (iteração) | `home-v2.jsx` |
| `Capabilities.html` | Catálogo de capacidades | `capabilities.jsx` |
| `Department setup.html` | Configuração de departamento | `department-setup.jsx` |
| `Logo.html` | Estudos de logo | `logos.jsx` |
| `Logo v2 - Notched.html` | Variantes de logo (notched) | `notched-variants.jsx` |

## Arquivos de suporte

- **`styles.css`** — base visual (tipografia, tokens, dark/light)
- **`icons.jsx`** — ícones SVG inline
- **`stage.jsx`** — componente de palco/contexto compartilhado
- **`tweaks-panel.jsx`** — painel lateral para ajustar variantes em tempo real (cor, tema, atmosfera)
- **`design-canvas.jsx`**, **`logo-canvas.jsx`**, **`notched-canvas.jsx`** — wrappers do Claude design canvas (não precisam ir pra produção)

## Status e próximos passos

Esta pasta serve como **fonte da verdade visual** enquanto a stack de produção não é definida. Quando entrarmos na **Fase 2 — Walking Skeleton** (ver [roadmap](../docs/roadmap.md)):

1. Escolher stack do frontend (provavelmente Next.js + Tailwind)
2. Criar `web/` no root do projeto
3. Portar os componentes desta pasta para a stack escolhida
4. **Manter `design/`** como histórico de exploração e referência visual

## ⚠️ O que **não** levar pra produção

- O carregamento via `<script type="text/babel">` e CDN do Babel standalone — usar build próprio
- Os utilitários do canvas (`design-canvas`, `tweaks-panel`, `stage`) — ferramentas de exploração
- O `scraps/` — rascunhos do canvas

## Origem

Mockups gerados em sessão do Claude.ai e exportados como pacote.
