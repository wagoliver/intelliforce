---
name: intelliforce-approvals
description: Inbox de aprovações pendentes (human-in-the-loop) + decidir approve/reject. Quando uma task chega em status awaiting_approval, fica esperando aqui até alguém decidir.
license: MIT
allowed-tools:
  - Bash(python /opencode-runtime/.opencode/skills/intelliforce-approvals/scripts/approvals.py *)
  - Read
---

# Approvals — inbox + decisões humanas

Approval é checkpoint humano disparado por tasks que precisam validação antes
de prosseguir (tipicamente operações destrutivas ou acima de threshold).

## Comandos

```bash
# Ver inbox (todas as pendentes)
python .../approvals.py inbox

# Aprovar (devolve task pra pending → executor processa de novo)
python .../approvals.py approve <approval_uuid> --reason "validei manualmente"

# Rejeitar (cancela a task associada)
python .../approvals.py reject <approval_uuid> --reason "fora do escopo"
```

## Comportamento

- **Approve**: task volta pra `pending`, evento `task.approved` emitido,
  `task.created` re-emitido pra executor processar de novo
- **Reject**: task vai pra `cancelled` com error_message contendo o reason

## Importante

- Antes de approve/reject, sempre busque o contexto: `intelliforce-tasks get <task_id>`
  + `intelliforce-audit timeline <task_id>` pra entender o que foi feito até agora
- Confirme com user qual o reason — vira parte do audit log permanente
