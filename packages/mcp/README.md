# @botozap/mcp

Servidor **MCP (Model Context Protocol)** para a API pública do **BotoZap** — a
plataforma sobre a WhatsApp Cloud API oficial. Painel, API/MCP e links de setup
operam a mesma Conta, para um ou vários negócios.

Ele expõe as operações da plataforma (`/api/v1`) como **ferramentas MCP** e o
stream durável de Eventos como **resource assinável**, para que assistentes como
**Claude Code**, **Cursor** e **Codex** consigam operar o canal e receber um
sinal de baixa latência quando o WhatsApp mudar.

Cada ferramenta MCP mapeia para uma operação do SDK oficial **`@botozap/sdk`**
(que autentica com a sua chave `bz_...`, monta a requisição e trata o envelope de
erro). É uma ponte fina: valida os argumentos e resultados (zod), delega ao SDK
e devolve o JSON da API.

Todas as tools anunciam `outputSchema` e devolvem o resultado em
`structuredContent`, além do `content[].text` em JSON mantido para clientes
antigos. Isso inclui paginação por cursor/offset, operações de gestão e os
`DELETE` sem corpo — estes preservam `null` no texto legado e devolvem
`{ success: true }` na saída estruturada. Erros preservam `isError` e também
expõem `{ error: { code, message, status } }` em `structuredContent`, sem
credenciais.

> **Status: preview público `0.x`.** Sem promessa de estabilidade de tools e
> argumentos até a `1.0`; fixe a versão para integrações reproduzíveis.

## Requisitos

- **Node.js ≥ 20.19** (ESM).
- Uma chave de API do BotoZap (gere em **/chaves** no painel).
- **pnpm** (este monorepo usa pnpm exclusivamente).

## Descoberta por permissão (próxima versão)

A inicialização consulta `GET /v1/me` pelo SDK e anuncia somente as ferramentas
permitidas pelos escopos e pelo ambiente da credencial. A API precisa oferecer
esse endpoint antes de publicar o SDK e o MCP; erro de introspecção impede iniciar a
sessão, sem fallback para o catálogo completo. Essa consulta não exige
`events:read`: o escopo só é necessário para o resource de Eventos.

No stdio, o catálogo reflete a inicialização; reconecte após alterar escopos.
No Streamable HTTP, a identidade da sessão é reutilizada por até 60 segundos,
inclusive nas consultas periódicas de Eventos. Após esse prazo, uma introspecção
compartilhada entre requests e polls atualiza as permissões. A chave de API precisa
manter o fingerprint original. Um bearer OAuth novo exige introspecção imediata e
só é aceito para a mesma Conta, ambiente, usuário, cliente e grant. A descoberta
OAuth também exige as rotas concretas usadas pela ferramenta.

A API continua autorizando cada chamada, inclusive após revogação da credencial;
esconder uma ferramenta e reutilizar a identidade não substituem essa verificação.
`reply_to_conversation` exige `conversations:read` e `messages:send`, pois o SDK
resolve a conversa antes de enviar. `get_profile` identifica a Conta e o ambiente
autorizados e revalida a credencial a cada consulta; não representa uma pessoa.

Todas as ferramentas declaram `readOnlyHint`, `destructiveHint` e `openWorldHint`
conforme seus efeitos. Operações compostas consideram também efeitos indiretos.
As anotações orientam o host; não implementam autorização nem comprovam que uma
pessoa confirmou a ação. OAuth e a publicação no diretório ChatGPT são etapas
separadas.

Para desenvolvimento: `buildServer` é assíncrono. Aguarde sua conclusão antes de
conectar o transporte. Os testes de operação usam identidade previamente validada;
os testes de descoberta exercitam o contrato real de introspecção com HTTP simulado.

## Compatibilidade das respostas e ordem de publicação

Respostas tipadas publicam somente os campos declarados pelo schema, tanto no
JSON textual quanto em `structuredContent`. `list_users.data[].id` e o alias
`data[].user_id` continuam disponíveis. A auditoria dos endpoints revisados não
identificou remoção de campo público na projeção final. O segredo HMAC de webhook
continua disponível apenas em `create_webhook`. Conteúdo dinâmico de mensagens,
metadados de contatos e payloads de IA preservam seus objetos de negócio.

**Publique primeiro a API com `GET /v1/me` validado; só depois publique SDK e MCP.**
Clientes que usam `npx @botozap/mcp` ou `pnpm dlx @botozap/mcp` sem versão podem
receber a atualização imediatamente. Veja o [plano de release](../../docs/chatgpt-phase1-release.md)
para a auditoria dos campos e as verificações por ambiente.

## Instalação

O pacote pode ser executado diretamente do npm:

```bash
pnpm dlx @botozap/mcp@0.2.6
```

Para desenvolver o monorepo localmente:

```bash
pnpm install
pnpm build
pnpm --filter @botozap/mcp smoke
pnpm --filter @botozap/mcp test
```

## Configuração (variáveis de ambiente)

| Variável | Quando | Default | Descrição |
| --- | --- | --- | --- |
| `BOTOZAP_API_KEY` | Obrigatória em stdio | — | Chave `bz_...` usada pelo processo stdio. |
| `BOTOZAP_API_URL` | Opcional | `https://botozap.com.br/api/v1` | Base da API (útil para staging/local). |
| `BOTOZAP_MCP_TRANSPORT` | Remoto | `stdio` | Use `streamable-http` para iniciar o endpoint remoto. |
| `BOTOZAP_MCP_HOST` | Remoto | `127.0.0.1` | Interface TCP do endpoint remoto. |
| `BOTOZAP_MCP_PORT` | Remoto | `3001` | Porta do endpoint remoto (`0` escolhe uma porta livre). |
| `BOTOZAP_MCP_ALLOWED_HOSTS` | Remoto | loopback em localhost | CSV saneado (trim, vazio descartado) dos valores de `Host` aceitos em `/mcp`. Obrigatória fora de localhost. |
| `BOTOZAP_MCP_ALLOWED_ORIGINS` | Remoto | vazio | CSV saneado das `Origin` aceitas em `/mcp` (match exato). Sem `Origin` continua aceito; `Origin` presente só passa se estiver na lista. |
| `BOTOZAP_MCP_RATE_LIMIT_PER_CLIENT` | Remoto | `120` | Requisições por minuto por cliente/IP antes da autenticação. |
| `BOTOZAP_MCP_RATE_LIMIT_GLOBAL` | Remoto | `1200` | Teto global de requisições por minuto por processo. |
| `BOTOZAP_MCP_TRUSTED_PROXY_CIDRS` | Remoto | vazio | CSV de CIDRs autorizados a alcançar `/mcp`; com Cloudflare, use somente as faixas oficiais e o rate limit passa a usar `CF-Connecting-IP`. |
| `BOTOZAP_EVENT_BUS_DATABASE_URL` | Obrigatória no remoto | — | Conexão PostgreSQL de sessão que suporta `LISTEN/NOTIFY`. |

Sem a configuração obrigatória do transporte escolhido, o servidor falha
imediatamente com uma mensagem clara e sem imprimir o valor recebido.

### Streamable HTTP (operador da plataforma)

O mesmo binário pode manter sessões remotas stateful em `/mcp`. Nesse modo cada
cliente envia sua própria chave BotoZap no header `Authorization: Bearer`; a
sessão fica vinculada a essa credencial e a Conta/ambiente continuam derivados
pela API. A chave nunca entra na URL do endpoint, URI do resource ou
notification.

```bash
BOTOZAP_MCP_TRANSPORT=streamable-http \
BOTOZAP_MCP_HOST=0.0.0.0 \
BOTOZAP_MCP_PORT=3001 \
BOTOZAP_MCP_ALLOWED_HOSTS=mcp.botozap.com.br \
BOTOZAP_EVENT_BUS_DATABASE_URL=postgresql://... \
pnpm dlx @botozap/mcp@0.2.6
```

Bind em `0.0.0.0` ou `::` sem `BOTOZAP_MCP_ALLOWED_HOSTS` recusa o boot (fail-closed). Em `127.0.0.1`/`::1`/`localhost` a allowlist padrão de loopback é aplicada e o desenvolvimento local segue igual.

Todo request a `/mcp` valida `Host` e `Origin` **antes** de Bearer e do parse do corpo, como exige o transporte Streamable HTTP (spec 2025-11-25): `Host` precisa estar na allowlist; `Origin` ausente é aceita (clientes server-to-server); `Origin` presente só passa por match exato. Desvio responde `403` JSON-RPC (`-32000`) sem autenticar.

`GET /healthz` é público, mínimo e sem segredo: responde `200` com `{"ok": true}` para readiness (Fly). Não exige Bearer, não consulta sessão e não revela estado interno — o health check interno pode usar um `Host` que não está na allowlist de `/mcp`.

Quando `BOTOZAP_MCP_TRUSTED_PROXY_CIDRS` está definida, `/mcp` exige que o
`Fly-Client-IP` pertença a uma das redes configuradas; isso bloqueia acesso
direto ao origin mesmo com `Host` forjado. Em deploy atrás da Cloudflare,
mantenha a lista sincronizada com `https://www.cloudflare.com/ips/`; somente
depois dessa validação o rate limiter confia em `CF-Connecting-IP`.

Use uma conexão PostgreSQL persistente/direta ou pooler em modo de sessão;
pooler em modo de transação não preserva `LISTEN`. O bus carrega somente um
sinal vazio. Ao recebê-lo, cada sessão consulta `/events` com sua própria chave
e só envia `notifications/resources/updated` se houver Evento no cursor
autorizado. O payload autoritativo permanece no stream durável.

Se o bus cair — inclusive durante o boot — o servidor continua disponível em
modo degradado, reconecta com backoff de 250 ms a 10 s e mantém um heartbeat de
reconciliação pelo cursor a cada 15 s. Um sinal que chega enquanto outra leitura
está em voo fica pendente para um novo probe imediato; não depende do próximo
heartbeat.

O processo mantém no máximo 1.000 sessões, 5 sessões por chave e 8 resources de
Eventos por sessão. `resources/unsubscribe` interrompe o consumo daquele
resource; `DELETE /mcp` encerra a sessão e libera listeners/timers. Uma sessão
que perde o transporte sem enviar `DELETE` é recolhida após 5 minutos sem
request ativo (varredura a cada 30 s). Esses limites são conservadores para o
preview `0.x` e podem mudar antes da `1.0`.

## Usar com Claude Code

Via CLI:

```bash
claude mcp add botozap \
  --env BOTOZAP_API_KEY=bz_live_suachaveaqui \
  -- pnpm dlx @botozap/mcp@0.2.6
```

Ou no JSON do MCP (`.mcp.json` do projeto ou config do usuário):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.2.6"],
      "env": {
        "BOTOZAP_API_KEY": "bz_live_suachaveaqui"
      }
    }
  }
}
```

## Usar com Cursor

Edite `~/.cursor/mcp.json` (global) ou `.cursor/mcp.json` (no projeto):

```json
{
  "mcpServers": {
    "botozap": {
      "command": "pnpm",
      "args": ["dlx", "@botozap/mcp@0.2.6"],
      "env": {
        "BOTOZAP_API_KEY": "bz_live_suachaveaqui"
      }
    }
  }
}
```

## Ferramentas disponíveis

Transportes: **stdio** (padrão, local) e **Streamable HTTP** (remoto stateful).
Nomes em inglês (snake_case, melhor para tool-calling); descrições em PT-BR.

**Mensagens** — `send_message` (`text`, `template`, `interactive` button/list/cta_url, `location`, `reaction`), `list_messages` (`sort`: `created_at` ou `event_at`; cada item traz `source`), `get_message`
**Conversas** — `reply_to_conversation`, `list_conversations`, `get_conversation`, `update_conversation` (leituras trazem `entry_point`, `referral` Click-to-WhatsApp, `fep_expires_at` e `fep_reply_by`)
**Contatos** — `list_contacts`, `get_contact`, `create_contact`, `update_contact`, `delete_contact` (`display_name` é o nome dado pela empresa; `null` limpa)
**Mídia** — `send_media_message`, `ingest_media`
**Clientes** — `list_customers`, `get_customer`, `create_customer`, `update_customer`, `delete_customer`
**Links de setup** — `list_setup_links`, `create_setup_link`, `update_setup_link` (redirects `https`: concluído → `success_redirect_url` com `status=completed`; link esgotado → `failure_redirect_url` com `status=failed`; cliente volta num erro recuperável → `failure_redirect_url` com `status=cancelled`, link segue válido; todo destino recebe `setup_link_id`)
**Números** — `list_phone_numbers`, `get_phone_number`, `update_phone_number` (só o `label`, nome local), `phone_number_health`
**Templates** — `list_templates`, `get_template`, `create_template`
**Webhooks** — `list_webhooks`, `get_webhook`, `create_webhook`, `update_webhook`, `delete_webhook`, `test_webhook` (`events` aceita a categoria opt-in `app_messages`)
**Entregas de webhook** — `list_webhook_deliveries` (status `limited` = cortada pelo limite de repasse do Free)
**Logs** — `list_api_logs`
**Usuários** — `list_users`
**Uso** — `get_meta_costs` (custo aproximado da Meta por moeda, dia e categoria; custo ausente vem `null`, nunca 0)

## Resource de Eventos

Os dois transportes anunciam `resources.subscribe` e o template
`botozap://events{?after,limit}`. Um cliente persistente pode assinar, por
exemplo, `botozap://events?after=42&limit=100` e receber
`notifications/resources/updated` quando existir um Evento posterior ao cursor
42. O tail da API existe somente enquanto há assinatura ativa; clientes que usam
apenas tools não iniciam consultas de Eventos. A chave usada pelo servidor
precisa incluir o escopo `events:read`.

A notification é deliberadamente só um sinal e não carrega mensagem, Contato
ou credencial. Ao recebê-la, releia o mesmo resource, processe `data` e persista
`paging.cursor`. Depois de uma desconexão, leia a partir do último cursor salvo e
drene todas as páginas de catch-up (`paging.next`). Só então assine uma nova URI
com o cursor final em `after`; o probe inicial da assinatura fecha a corrida com
um Evento persistido entre a última leitura e o subscribe. Notifications são
hints at-least-once e podem se repetir; deduplique por `event.id` antes de
produzir qualquer resposta. O mesmo Evento conserva `id`, `cursor` e identidade
de mensagem em retries e replay.

No stdio, o tail usa intervalo padrão de 1,5 segundo e para no `unsubscribe` ou
no fim da sessão. No remoto, o PostgreSQL acorda o processo MCP mesmo quando o
Evento foi persistido por outra instância; a consulta escopada continua sendo a
fonte do payload e o heartbeat cobre sinais perdidos. Receber a notification não
significa que todo host inicia automaticamente uma nova execução do agente.

Em caso de erro da API, a ferramenta devolve um resultado de erro (`isError`) com
a mensagem PT-BR do envelope `{ error: { code, message } }` no formato
`Erro [code]: message`. `code`, `message` e o status HTTP também ficam
disponíveis de forma programática em todas as tools.

## Chaves de sandbox

Uma chave de **sandbox** (prefixo `bz_sandbox_`) habilita as ferramentas de
mensagem (`send_message`, `send_media_message`, `list_messages` e `get_message`) e o resource de
Eventos do próprio Sandbox. Qualquer outra ferramenta responde
`403 sandbox_forbidden` (vindo da API) — útil para testar a integração sem tocar
dados reais.

**Números mágicos** (destinatários simulados, sem custo, sem número real):

| `to`             | Comportamento simulado                                  |
| ---------------- | ------------------------------------------------------- |
| `+5500000000001` | happy path: `sent → delivered → read`, janela sempre aberta |
| `+5500000000002` | falha: `sent → failed` (erro Meta `131026`)             |
| `+5500000000003` | `sent → delivered` + resposta inbound simulada (abre a janela de 24h) |

### Smokes de sandbox

Há dois smokes, com propósitos distintos:

- **Hermético (roda no `test`, CI):** `tests/sandbox-smoke.test.ts` usa um
  `fetch` stub fiel ao contrato do sandbox — não precisa de credencial nem rede.
  Verifica que o texto (acento + emoji) sobrevive intacto, que a chave vira
  `Authorization: Bearer`, que a resposta (`sandbox: true` + `wamid.sandbox.<...>`)
  chega ao agente, e que **a chave nunca aparece** no resultado.

- **Externo (manual, exige credencial):** `pnpm --filter @botozap/mcp smoke:sandbox`
  bate na API real. Exige `dist/` compilado (`pnpm --filter @botozap/mcp build`
  antes) e as variáveis `BOTOZAP_API_KEY` (uma chave **`bz_sandbox_`**) e
  `BOTOZAP_API_URL`. Recusa qualquer chave que não seja sandbox e **nunca imprime
  a chave** (redação defensiva em toda saída, inclusive erros). **Nunca** entra no
  `test` — não roda em PR/fork, que não têm credencial.

  ```bash
  pnpm --filter @botozap/mcp build
  BOTOZAP_API_KEY=bz_sandbox_suachave BOTOZAP_API_URL=https://.../api/v1 \
    pnpm --filter @botozap/mcp smoke:sandbox
  ```

## Segurança

A conta é sempre derivada da chave de API no servidor do BotoZap (multi-tenant,
IDOR-safe). A chave é um segredo — não a comite nem a logue. O servidor MCP só
escreve logs em **stderr** (stdout é reservado para o protocolo MCP); a chave
nunca aparece em resultado de ferramenta, mensagem de erro, `/healthz` ou
resposta `403` de `Host`/`Origin`.

## Publicação pelos mantenedores

Use `pnpm release:mcp` a partir de um checkout limpo da `main`, após
`pnpm build`, `pnpm typecheck`, `pnpm test` e `pnpm gate:tarballs`. O comando
empacota com pnpm, verifica as dependências no próprio tarball e publica esse
mesmo arquivo com `npm publish`. Publicação usa npm; instalação, build e pack
continuam usando pnpm. `pnpm release:mcp --dry-run` valida sem publicar.

Não publique o diretório com outro empacotador: `workspace:*` pertence ao
monorepo e precisa virar a versão do SDK no artefato. A versão 0.2.5 violou esse
contrato; a 0.2.6 corrige a instalação. Após publicar, instale a versão exata em
um projeto vazio **sem overrides** e repita o cliente MCP real. O gate com
override serve para candidatos cujo SDK ainda não está no registry.

## Atendimento, CRM e Agenda

O catálogo inclui respostas compartilhadas, notas/retornos/arquivo/adiamento,
oportunidades/demandas com histórico e conversas, Radar, réguas e execuções,
Agenda completa e sincronização Google Calendar. Etapas, campos e atribuições
a membros também podem ser descobertos e gerenciados. Cada operação tem schemas
de entrada e saída estruturada, com campos de versão exigidos quando aplicável.

A chave representa a Conta: não acessa rascunhos/respostas pessoais nem executa
a autorização OAuth em nome de um humano. Configure Google em `/calendarios`.
Ferramentas de réguas e ativação podem gerar envios: use conforme instrução do
usuário, preservando o controle de canal, consentimento e plano do servidor.

[Scopes, CAS e roteiro de release](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/attendance-release.md).

IA usa exclusivamente credenciais próprias (BYOK): SDK `client.ai`, CLI `botozap ai`
e ferramentas MCP `ai_*`. Agentes versionados, provedores, credenciais, conhecimento,
memória, skills, follow-ups e retornos prometidos, roteadores, casos, alertas,
avisos, propostas de aprendizado e comerciais, controle de acesso (elegibilidade),
inferências, promessas do operador, catálogo de modelos, execuções e uso. Scopes
`agents:read/write`; aprovação exige chave criada por
owner/admin ainda autorizado. Prévia não envia WhatsApp. Não há carteira, créditos
ou compra de vagas de IA. [Contratos e exemplos IA](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/ai.md).

### Tamanho e contrato dos retornos

O texto de cada resposta usa JSON compacto. Nas entidades com schema tipado,
campos fora do contrato são removidos antes de gerar texto e `structuredContent`.
IDs, cursores e metadados de paginação são preservados; textos e listas não são
truncados. O segredo HMAC de webhook só é retornado na criação.

Os payloads de negócio dinâmicos (IA, CRM/Agenda, conteúdo de mensagens,
metadados de contato, diagnóstico de saúde e extensões de mídia) mantêm seu
conteúdo. Reduções futuras nesses domínios precisam de contratos específicos.

## OAuth no transporte remoto

Configure as mesmas URLs canônicas usadas pelo app BotoZap:

```sh
OAUTH_ENABLED=true
OAUTH_RESOURCE_URL=https://mcp.botozap.com.br/mcp
OAUTH_ISSUER_URL=https://botozap.com.br
```

O endpoint publica metadados RFC 9728 em `/.well-known/oauth-protected-resource/mcp` e `/.well-known/oauth-protected-resource`. Respostas 401 incluem o endereço desses metadados em `WWW-Authenticate`. As URLs vêm da configuração do servidor.

`scopes_supported` anuncia `openid`, `profile`, `email` e `phone`, aceitos pelo servidor de autorização do app. As permissões BotoZap, como `contacts:read` e `messages:send`, são escolhidas no consentimento e retornadas por `/v1/me`; não devem ser enviadas no parâmetro OAuth `scope`. O parâmetro OAuth `resource` deve usar a URL canônica `https://mcp.botozap.com.br/mcp` em autorização e troca de token.

Cada request, inclusive em sessões já abertas, valida a credencial em `/v1/me`. Uma sessão OAuth aceita o token renovado somente quando grant, usuário, cliente, Conta e ambiente permanecem iguais. Chaves de API continuam vinculadas ao fingerprint original. Tokens de requests simultâneos ficam isolados; chamadas de API usam a credencial do próprio request. A descoberta de ferramentas acompanha os scopes e as rotas efetivamente permitidas pelo app. Revogação e mudança de papel passam a valer na próxima requisição.

O transporte stdio continua recebendo a credencial pelo ambiente `BOTOZAP_API_KEY`. O servidor MCP não realiza login nem armazena refresh tokens.


## Intenção de envio e painel de revisão

`send_message`, `send_media_message` e `reply_to_conversation` continuam aceitando
as chamadas da versão 0.6.0. `idempotency_key` é opcional; omiti-la mantém o fluxo
anterior, sem deduplicação por chave. Recomenda-se chamar `prepare_send_intent`
antes de um novo envio e passar a chave retornada à tool. Em retry, preserve chave
e conteúdo. Não crie outra chave para contornar timeout ou 409 pendente.

O painel candidato de Plugin Extensions é habilitado com
`BOTOZAP_MCP_UI_ENABLED=true` (HTTP ou stdio). `open_review_panel` abre a seleção de
negócio e Radar; `stage_review_reply` prepara um rascunho sem enviar. O rascunho e
a UI sempre preservam uma chave por intenção, com confirmação explícita e sem
retry automático. Hosts sem UI continuam usando as tools.

O build inclui `dist/ui/review.html`, sem assets externos nem credenciais.
`pnpm preview:build` cria uma demonstração local em `web/.preview/demo.html`, com
dados fictícios. O pacote de plugin candidato está em `plugins/botozap`; não é
uma publicação no diretório.

API `/v1/me` **e suporte a idempotência** devem estar disponíveis antes de publicar
os pacotes novos. Resultados terminais por chave expiram após 24h; uma tentativa
desconhecida permanece pendente até reconciliação. Ver
`docs/chatgpt-phase1-release.md` para a ordem de release e compatibilidade.

Recusas confirmadas (`outcome: rejected`) liberam a chave. Aguarde o backoff ou
corrija a causa e repita com a mesma chave; após liberação, outro payload é uma
nova intenção. `unknown` ou `accepted` exigem conciliação antes de considerar
outro envio. SDK e MCP preservam `outcome` e `retry` da API. Resultados concluídos
vencidos são removidos pelo cron a cada minuto; claims incertas não são removidas
por tempo, conforme o runbook `botozap/docs/ops/message-send-receipts.md`.
