# Release de identidade e compatibilidade MCP

Esta nota cobre a descoberta por identidade, a projeção das respostas tipadas e
o cache HTTP. Não autoriza deploy ou publicação.

## Ordem obrigatória

1. Publicar a API com `GET /v1/me` em cada base de API suportada, incluindo
   produção, staging e instalações próprias que receberão a atualização.
2. Verificar `/v1/me` com uma chave live, uma chave sandbox e uma credencial sem
   escopos de negócio: `account_id`, `environment` e `scopes` precisam representar
   a credencial autenticada. Credenciais inválidas devem falhar. Para OAuth,
   verificar também usuário, cliente, grant e rotas permitidas.
3. Executar os testes proporcionais de SDK/MCP, build e validação dos tarballs
   com pnpm. Confirmar inicialização MCP nas bases já atualizadas.
4. Só então publicar os tarballs validados do SDK e MCP com `npm publish`.

A API precisa entrar **antes de publicar ambos os pacotes**. Clientes com
`npx @botozap/mcp` ou `pnpm dlx @botozap/mcp` sem versão podem obter o pacote novo
assim que estiver disponível. O MCP falha fechado quando `/v1/me` não existe,
está indisponível ou devolve uma identidade inválida. Fixar a versão permite
controlar a atualização; não elimina a dependência de API da versão nova.

## Descoberta e cache

Ferramentas sem os escopos necessários ou incompatíveis com sandbox ficam
ocultas. OAuth exige também todas as rotas concretas utilizadas pela operação.
Por exemplo, `reply_to_conversation` exige `conversations:read` e `messages:send`.
A ausência de `events:read` oculta o resource de Eventos, sem impedir tools
permitidas ou a consulta inicial de identidade.

No stdio, reconectar atualiza a descoberta. No Streamable HTTP, a identidade da
sessão tem cache de 60 segundos. Chaves de API ficam vinculadas ao fingerprint
original; outra chave não pode reutilizar a sessão. OAuth reutiliza a identidade
para o mesmo bearer e introspecta imediatamente quando seu fingerprint muda;
um refresh precisa preservar Conta, ambiente, usuário, cliente e grant.
Requests e polls de Eventos compartilham o cache e a introspecção em voo. Após
expiração, o refresh atualiza as ferramentas anunciadas. Cada operação continua
sujeita à autorização na API; o cache não autoriza dados de outro tenant.

## Auditoria dos campos descartados

Diff revisado: `feat/629-chatgpt-phase1^..feat/629-chatgpt-phase1`, equivalente a
`ca116b85de31519db5055d4671c316198eb465c8..eaae75d30bcdec2e65443f8f66389790858d85b0`,
em `packages/mcp/src/schemas.ts`. A conclusão final também considera
`feat/629-chatgpt-phase1^..335ee27` (HEAD da base OAuth antes de Extensions):
nessa comparação, `user_id` já está declarado no schema e é preservado.
As formas de resposta foram confrontadas com
os serializers e endpoints `/api/v1` do aplicativo BotoZap.

| Campo concreto | Comportamento na projeção | Evidência |
| --- | --- | --- |
| `secret` de webhook em list/get/update | Descartado se vier como extra; criação continua devolvendo o segredo uma única vez. | `webhookSchema`, `webhookCreationResultSchema` e `src/lib/webhooks/authorization.ts::presentWebhook`. A API atual já limita o segredo à criação. |
| `authorization_secret_id` | Descartado se vier como extra. | Fixture de `output-minimization.test.ts`; o presenter real devolve `has_authorization`, sem a referência do Vault. |
| `private_trace` | Descartado no item de mensagem da fixture. | `output-minimization.test.ts`; não é um campo do serializer público de mensagens revisado. |
| `internal_debug` | Descartado nos envelopes e entidades das fixtures. | `output-minimization.test.ts`; não é um campo público dos endpoints revisados. |

A lista identifica os campos concretos que o schema descarta se recebidos,
separando o segredo restrito à criação dos extras simulados pelos testes.
A auditoria não identificou campo público removido das respostas atuais dos
endpoints revisados. `list_users.data[].id` e `data[].user_id` já estavam
declarados antes da mudança e continuam preservados. Não afirma que o servidor atual devolve referências do Vault ou campos
de debug.

Foram preservados os campos públicos revisados de mensagens, contatos,
conversas, clientes, setup links, números, templates, logs, webhooks, entregas,
mídia e custos. O diff acrescenta schemas explícitos para `channel`,
`channel_account`, `external_id`, `profile_picture_url`, `closed_at`,
`last_message`, `is_self`, `warnings`, `rejection_reason`, diagnósticos de logs,
saúde de webhook e `webhook_deliveries.customer_id`. Paginação e identificadores
continuam disponíveis. Objetos de conteúdo de mensagem, metadata, payloads de IA,
`phone_number_health` e os blocos `target`/`resource` de mídia mantêm seus contratos
abertos; não se deve tratar a mudança como remoção indiscriminada de conteúdo.

## Verificações de compatibilidade

- Inicializar com `/v1/me` válido e confirmar catálogo limitado; sem permissão,
  confirmar ausência da ferramenta e negação na API.
- Confirmar JSON textual e `structuredContent` com a mesma projeção; respostas
  204 mantêm texto `null` e resultado estruturado `{ success: true }`.
- Confirmar `list_users.data[].id` e `data[].user_id` iguais e segredo somente na criação de
  webhook; preservar paginação e os campos públicos listados acima.
- Em HTTP, contar uma chamada `/v1/me` na inicialização para várias tools e polls
  dentro de 60 segundos; após expiração, uma nova introspecção compartilhada;
  em OAuth, trocar bearer acrescenta uma introspecção.
- Confirmar que refresh com outro grant, usuário, cliente ou Conta é recusado e
  que requests simultâneos usam a própria credencial nas chamadas de negócio.
