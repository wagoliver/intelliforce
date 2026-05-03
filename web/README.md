# IntelliForce Web

Frontend Next.js 14 (App Router) + Tailwind. Conecta na API IntelliForce em `http://localhost:8000` (ou `NEXT_PUBLIC_API_URL`).

## Telas

- `/login` — login + cadastro (primeiro user vira admin)
- `/dashboard` — visão geral (agentes ativos, tarefas em execução, custo)
- `/agents` — catálogo + criação de agentes
- `/tasks` — lista + detalhe (timeline + resposta do agente)
- `/approvals` — inbox de aprovações pendentes
- `/audit` — eventos do sistema + cost summary

## Rodando local (sem Docker)

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# abre http://localhost:3000
```

## Rodando via Docker Compose

Já está integrado no `docker-compose.yml` da raiz. Apenas:

```bash
docker compose up -d --build web
```

Acesse http://localhost:3000.

## Estrutura

```
web/
├── app/                    # App Router (rotas)
│   ├── login/              # /login (com server action)
│   ├── (app)/              # rotas autenticadas (sidebar layout)
│   │   ├── dashboard/
│   │   ├── agents/
│   │   ├── tasks/
│   │   ├── approvals/
│   │   └── audit/
│   └── layout.tsx
├── components/layout/      # Sidebar
├── lib/
│   ├── api/                # client HTTP + types + endpoints (auth, agents, tasks, audit, approvals)
│   ├── auth/               # session helpers (cookies httpOnly)
│   └── cn.ts               # utility
└── middleware.ts           # protege rotas exigindo cookie if_token
```

## Auth

JWT vem da API em /auth/login → cookie httpOnly `if_token` (1h) + `if_refresh` (7d).
Middleware redireciona pra /login se não tiver cookie.
Logout: GET /logout limpa cookies.
