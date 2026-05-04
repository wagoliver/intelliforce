---
name: health
description: Verifica saúde do sistema — auth, estado dos departamentos, tarefas e aprovações pendentes
---

# /health — Verificação de saúde do sistema

Quando o usuário invocar `/health`, execute os seguintes passos em sequência:

## Passo 1: Verificar autenticação

Rode o script de auth check:
```bash
python /opencode-runtime/.opencode/skills/intelliforce-api/scripts/auth_check.py
```

Se falhar com `TOKEN_EMPTY` ou `TOKEN_EXPIRED_OR_INVALID`, pare e avise o usuário: "Seu login expirou. Atualize a página e faça login de novo."

## Passo 2: Descobrir estado do sistema

Rode o discover:
```bash
python /opencode-runtime/.opencode/skills/intelliforce-discover/scripts/discover.py
```

Se falhar com `NETWORK_ERROR` ou `API_ERROR_5xx`, avise: "API com problema. Tenta de novo em alguns segundos."

## Passo 3: Apresentar resumo de saúde

Formate a resposta em markdown amigável com esta estrutura:

### 🏥 Saúde do Sistema

**Usuário:** {name} ({email}) — papel **{role}**

---

#### Resumo geral
- **{N} departamentos**
- **{N} squads**  
- **{N} atividades**
- **{N} digital employees**
- **{N} tarefas recentes**

---

#### Departamentos

Para cada departamento, mostre:
- Nome e status de saúde (✅ saudável / ⚠️ atenção)
- Squads e atividades dentro dele
- Número de agentes instanciados

---

#### Tarefas recentes

Liste as últimas 5 tarefas com:
- ID, status, duração

---

#### Observações

Se detectar problemas (departamento com health=attention, tarefas falhadas, etc), destaque em vermelho com ⚠️.
