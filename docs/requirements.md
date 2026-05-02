# Requisitos do IntelliForce

> Lista de requisitos funcionais (RF) e não-funcionais (RNF) que orientam o desenho da plataforma. Itens marcados com ⭐ são MVP.

## Requisitos Funcionais (RF)

### Gestão de Agentes

- ⭐ **RF-01** — Criar, editar e versionar agentes via UI e via API
- ⭐ **RF-02** — Associar capacidades, políticas e contrato a um agente
- **RF-03** — Clonar agente existente como ponto de partida
- **RF-04** — Importar/exportar definição de agente (formato declarativo)
- **RF-05** — Suportar templates de agente por domínio (financeiro, atendimento, etc.)

### Execução de Tarefas

- ⭐ **RF-10** — Atribuir tarefa a agente via API, schedule ou evento
- ⭐ **RF-11** — Acompanhar estado da tarefa em tempo real
- ⭐ **RF-12** — Cancelar tarefa em execução
- **RF-13** — Reexecutar tarefa anterior com mesma entrada (replay)
- **RF-14** — Suportar tarefas de longa duração (horas/dias)

### Capacidades

- ⭐ **RF-20** — Catálogo de capacidades disponíveis com schema e descrição
- ⭐ **RF-21** — Versionamento de capacidades (semver)
- **RF-22** — Mecanismo de descoberta dinâmica de capacidades pelo agente
- **RF-23** — Capacidades compostas (agente como capacidade de outro agente)

### Supervisão Humana

- ⭐ **RF-30** — Configurar pontos de aprovação humana por capacidade
- ⭐ **RF-31** — Inbox de aprovações pendentes
- **RF-32** — Override manual: pausar agente, alterar resultado
- **RF-33** — Modo "shadow": agente executa mas não aplica mudanças
- **RF-34** — Coleta de feedback humano para melhoria contínua

### Observabilidade

- ⭐ **RF-40** — Dashboard com métricas operacionais por agente
- ⭐ **RF-41** — Trace completo de uma tarefa (cada passo, decisão, custo)
- **RF-42** — Alertas configuráveis (taxa de erro, custo, SLA)
- **RF-43** — Exportação de logs e métricas para sistemas externos

### Governança e Auditoria

- ⭐ **RF-50** — RBAC: quem pode criar, executar, aprovar agentes
- ⭐ **RF-51** — Log imutável de todas as ações de agente
- **RF-52** — Relatório de auditoria por período / agente / usuário
- **RF-53** — Mascaramento de dados sensíveis nos logs

### Integrações

- ⭐ **RF-60** — Conectores com pelo menos um LLM provider (Claude, OpenAI)
- **RF-61** — SDK para criação de capacidades customizadas
- **RF-62** — Webhooks para eventos da plataforma
- **RF-63** — Conectores prontos para sistemas comuns (CRM, e-mail, chat)

## Requisitos Não-Funcionais (RNF)

### Confiabilidade

- ⭐ **RNF-01** — SLA de 99% de disponibilidade do plano de controle
- ⭐ **RNF-02** — Tarefas em execução sobrevivem a reinício do runtime
- **RNF-03** — RTO < 1h, RPO < 15min para falhas catastróficas

### Performance

- **RNF-10** — Atribuição de tarefa simples completa em < 5s (p95)
- **RNF-11** — Suportar 1000 tarefas/min em pico (após escala horizontal)
- **RNF-12** — Latência de UI < 200ms para operações de leitura

### Segurança

- ⭐ **RNF-20** — Autenticação SSO (SAML/OIDC)
- ⭐ **RNF-21** — Secrets nunca expostos em logs ou UI
- ⭐ **RNF-22** — Comunicação interna criptografada (TLS)
- **RNF-23** — Aderência a LGPD (anonimização, direito ao esquecimento)
- **RNF-24** — Suporte a air-gapped deployment (clientes regulados)

### Escalabilidade

- **RNF-30** — Componentes do núcleo escalam horizontalmente
- **RNF-31** — Suportar até 10k agentes ativos por instância
- **RNF-32** — Particionamento por tenant em modo multi-tenant

### Observabilidade

- ⭐ **RNF-40** — Logs estruturados (JSON) em todos os componentes
- ⭐ **RNF-41** — Traces distribuídos (OpenTelemetry)
- **RNF-42** — Métricas Prometheus-compatíveis

### Operabilidade

- ⭐ **RNF-50** — Deploy em container (Docker)
- **RNF-51** — Suportar deploy em Kubernetes (Helm chart)
- **RNF-52** — Configuração via variáveis de ambiente + arquivo
- **RNF-53** — Migrations de schema automatizadas e reversíveis

### Custo

- **RNF-60** — Custo de LLM por tarefa visível em tempo real
- **RNF-61** — Cap de custo configurável (por agente, por tenant)
- **RNF-62** — Estratégia de cache para reduzir chamadas redundantes a LLM

## Restrições

- **R-01** — Sem dependência hard de provider único de LLM (multi-provider obrigatório)
- **R-02** — Não armazenar dados de cliente fora do território brasileiro sem opt-in
- **R-03** — Componentes core devem ter contrapartes open-source (sem lock-in proprietário crítico)
