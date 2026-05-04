# Teams App package — IntelliForce (Graph API + RSC)

> ⚠️ **Considere primeiro o caminho via Power Automate webhook.** A
> skill `intelliforce-teams` (atual) usa webhook por padrão — não
> precisa de Azure AD App, RSC, manifest, nem upload no Teams Admin
> Center. Funciona em tenants com policy restritiva. Veja
> `opencode/.opencode/skills/intelliforce-teams/SKILL.md`.
>
> Use este package APENAS se precisar de algo que webhook não
> entrega: receber respostas (`listen`), listar teams/channels
> dinamicamente, mention de pessoa com notificação real, ou postar
> em chat 1:1.

Gera o `.zip` de Microsoft Teams App customizado que dá ao
`client_id` do Azure AD as **RSC permissions** necessárias pra postar
em channels (`ChannelMessage.Send.Group` etc.) via **Graph API**.

## Quando usar

- Primeira vez configurando integração Teams com IntelliForce
- Trocou de Azure AD App Registration (novo client_id)
- Atualizou versão do manifest (passa `--app-id <existing-uuid>` pra
  manter o mesmo Teams App e só fazer update)

## Gerar o pacote

```bash
cd tools/teams-app-package
python make-package.py --client-id <SEU_AZURE_CLIENT_ID>
```

Saída: `intelliforce-teams.zip` no mesmo diretório.

O `client_id` é o **mesmo que está no Vault** no slug
`microsoft-teams`, campo `client_id`. Se não souber:

```bash
docker compose exec -T worker sh -c '
  curl -s "$INTELLIFORCE_API_URL/secrets/microsoft-teams/values" \
       -H "Authorization: Bearer $INTELLIFORCE_TOKEN" | python3 -c "
import sys, json
print(json.load(sys.stdin)[\"fields\"][\"client_id\"])
"'
```

(Ou só copia direto do Vault na UI.)

## Upload no Teams Admin Center

1. Abre **https://admin.teams.microsoft.com**
2. Sidebar → **Teams apps** → **Manage apps**
3. Botão **Upload new app** (ou **Actions → Upload new app**)
4. Escolhe o `intelliforce-teams.zip` gerado
5. Confirma. Aprova as permissions RSC que aparecerem.

Depois disso o app fica disponível pra ser instalado em qualquer Team
do tenant.

## Adicionar ao Team alvo

No Teams desktop:

1. Vai no Team alvo (ex.: **xOne - Notificações Sistêmicas**)
2. Clica no `...` ao lado do nome → **Manage team**
3. Aba **Apps** → **More apps** → busca por **IntelliForce**
4. Clica → **Add**

Pronto: o `client_id` agora tem RSC permissions ativas dentro desse
Team. `send` no channel **Digital Employee** vai funcionar.

## Trocar ícones (opcional)

O script gera ícones placeholders sólidos em verde IntelliForce
(`#16a34a`). Pra usar logo da empresa:

1. Substitui `color.png` (192x192, fundo opaco) e `outline.png`
   (32x32, branco com transparência) no diretório
2. Re-zipa manualmente: `zip intelliforce-teams.zip manifest.json color.png outline.png`

OU edita o `make-package.py` pra carregar PNGs externos em vez de
gerar.

## Atualizar versão (após upload)

Se já uploadou uma versão e quer atualizar:

1. Anota o **Teams App ID** que apareceu no output do
   `make-package.py` na 1ª execução (UUID do top-level `id`)
2. Bump da `version` no `manifest.template.json` (ex.: `1.0.0` → `1.0.1`)
3. Re-roda passando `--app-id <UUID>`:
   ```bash
   python make-package.py --client-id <CLIENT_ID> --app-id <UUID-EXISTENTE>
   ```
4. No Teams Admin Center → Manage apps → busca **IntelliForce** →
   Actions → **Update**

Sem o `--app-id` igual, o Teams trata como app novo (você acaba com 2).

## Estrutura do package

```
intelliforce-teams.zip
├── manifest.json     ← declarations + RSC permissions
├── color.png         ← 192x192, full color, fundo opaco
└── outline.png       ← 32x32, branco com transparência
```

## RSC permissions declaradas

| Permission | Pra quê |
|---|---|
| `ChannelMessage.Send.Group` | Postar mensagem em channel |
| `ChannelMessage.Read.Group` | Ler mensagens (pra `listen`) |
| `TeamSettings.Read.Group` | Metadata do Team |
| `ChannelSettings.Read.Group` | Metadata de channels |

Application-level permissions (Team.ReadBasic.All etc.) continuam
sendo configuradas no Azure AD App Registration normalmente. Esse
manifest **adiciona** as RSC, não substitui as outras.
