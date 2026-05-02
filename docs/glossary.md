# Glossário

> Vocabulário comum do IntelliForce. Use estes termos consistentemente em código, documentação e conversas.

## A

**ADR (Architecture Decision Record)**
Documento curto que registra uma decisão arquitetural importante: contexto, opções consideradas, decisão tomada e consequências. Vivem em `docs/adr/`.

**Agente** *(ver: Funcionário Virtual)*
Sinônimo informal de funcionário virtual.

**Aprovação Humana**
Ponto configurado no fluxo de um agente em que uma ação só prossegue após confirmação de uma pessoa autorizada.

**Auditoria**
Capacidade de reconstruir, a posteriori, exatamente o que um agente fez, com qual contexto e por qual motivo.

## C

**Capacidade (Capability / Tool)**
Função discreta que um agente pode invocar — uma chamada de LLM, uma consulta a banco, uma chamada de API externa, ou outro agente. É versionada e reutilizável.

**Catálogo de Capacidades**
Repositório central das capacidades disponíveis na plataforma, com schema, descrição e custo estimado.

**Contrato (do agente)**
Especificação explícita de entradas, saídas, SLA e taxa de sucesso esperada de um agente. Análogo a uma descrição de cargo.

## E

**Escalonamento**
Mecanismo pelo qual um agente, ao encontrar situação fora do seu escopo, transfere a tarefa para outro agente ou para um humano.

**Event Sourcing**
Padrão arquitetural onde mudanças de estado são persistidas como sequência imutável de eventos. Adotado para tarefas e ações de agente.

## F

**Funcionário Virtual**
Termo canônico para um agente do IntelliForce. Tem identidade, papel, capacidades, políticas e contrato. Veja [agent-spec.md](./agent-spec.md).

## G

**Gestor (Manager) do Agente**
Pessoa humana responsável pelo agente — recebe escalonamentos, aprovações pendentes e relatórios de desempenho.

**Governança**
Conjunto de políticas, processos e controles que garantem que agentes operam dentro de limites aceitáveis.

## L

**LLM (Large Language Model)**
Modelo de linguagem usado pelo agente para inferência. Ex: Claude, GPT, Llama.

## P

**Painel de Controle**
Interface web para criar, configurar, monitorar e auditar agentes e tarefas.

**Política**
Regra que governa o comportamento de um agente — limites de gasto, horários, aprovações necessárias, comportamento em falha.

## R

**RAG (Retrieval-Augmented Generation)**
Padrão onde, antes de gerar resposta, o sistema busca documentos relevantes e os inclui no contexto da LLM.

**RBAC (Role-Based Access Control)**
Modelo de autorização baseado em papéis. Define quem pode criar, executar, aprovar ou auditar o quê.

**Runtime**
Componente que executa o agente — interpreta sua configuração, invoca capacidades, mantém estado da tarefa.

## S

**Schedule**
Mecanismo de agendamento de execução de tarefas (cron, intervalos, eventos).

**Shadow Mode**
Modo em que o agente executa sua lógica completa mas **não aplica** mudanças no mundo externo. Usado para validação antes de habilitar em produção.

**Spike (técnico)**
Investigação curta e descartável para validar uma hipótese técnica antes de tomar uma decisão arquitetural.

**Supervisor**
Componente que media a interação humano-agente: notifica aprovações, permite override, coleta feedback.

## T

**Tarefa (Task)**
Unidade de trabalho atribuída a um agente. Tem origem (gatilho), contexto (entrada), estado (pendente/executando/concluída/etc.) e resultado.

**Tenant**
Cliente ou organização lógica isolada na plataforma (em contextos multi-tenant).

**Trace**
Registro detalhado de uma execução — cada passo, decisão e custo associado. Base para auditoria e debug.

## W

**Walking Skeleton**
Implementação mínima end-to-end, com todos os componentes presentes mas com features simplificadas. Objetivo da Fase 2 do roadmap.

**Webhook**
Mecanismo pelo qual a plataforma notifica sistemas externos sobre eventos (ex: tarefa concluída, aprovação pendente).
