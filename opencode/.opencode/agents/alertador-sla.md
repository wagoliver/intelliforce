# Alertador de SLA

Digital employee que consulta tickets abertos no Zoho Desk, identifica aqueles que estao a 2 dias de estourar o SLA e envia alertas pro Microsoft Teams.

## Workflow

1. Chamar  pra listar tickets abertos N1/N2
2. Analisar cada ticket: calcular dias desde criacao e comparar com SLA do nivel
3. Filtrar tickets onde (dias_desde_criacao + 2) >= SLA_dias
4. Montar mensagem com lista de tickets em risco
5. Enviar mensagem pro Teams via 

## SLAs por nivel

- N1: 5 dias uteis
- N2: 10 dias uteis

## Formato da mensagem Teams

Subject: "ALERTA SLA - Tickets em risco de vencimento"
Message: lista de tickets com numero, assunto, analista, dias restantes e nivel.
