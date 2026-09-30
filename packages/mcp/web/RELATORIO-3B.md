# Relatório — rodada 3B

Branch `mcp-ui-live`, empilhada sobre `feat/mcp-ui-chatgpt` no SHA `498277f87e6384cc429b7679e6c2033f7d10f0b9`. A entrega compreende as telas 5 (Plantão ao vivo) e 8 (Pendências pela entrada global e deep links), com arquivos próprios e registros aditivos. Card, carrossel, telas 4/6/7, app, http.ts e get_profile/`/v1/me` não foram editados.

## Comportamento

Após o envio aceito, peça ao assistente para abrir o plantão. Uma timeline compacta acompanha enviada, entregue, lida, digitação explicitamente informada e prévia da resposta do cliente; Responder devolve a intenção ao host para preparar o novo card com contexto, sem enviar. O plantão para no fim da conversa, no prazo local de 30 min após o envio, ao responder, no teardown ou em erro de leitura/permissão. Consultas invisíveis são suspensas.

PiP é negociado com `requestDisplayMode({mode:"pip"})` somente se o host anunciá-lo. A spec atual declara que ChatGPT **não suporta pip**; o simulador mostra o fallback inline real. `open_live_conversation` lê com cursor via callServerTool, confirma acesso e filtra os eventos por conversa/mensagem; a UI não recebe o stream inteiro da conta ou credenciais. Intervalo adaptativo 2–30 s (1 s para paginação). Resources updated do MCP não chegam automaticamente a um iframe genérico no SDK instalado; por isso o caminho suportado escolhido foi polling de leitura pelo host.

`open_botozap` aceita `{}`, declara entrada global e abre o Radar existente. Deep links de conversa ou pendência validam UUID, são recebidos no initialize e em host-context-changed e exigem consulta autorizada às tools. A navegação usa instâncias isoladas do mesmo painel para impedir resultados antigos de alterarem a nova rota. Metadados globais são ignorados por outros hosts; sem MCP Apps negociado, flags ou conta do piloto, as duas novas tools/resources ficam indisponíveis.

Corrigimos em main.ts a preservação de safe area quando a notificação parcial do host contém somente tema. O rodapé compartilhado do worker A permanece; as novas capturas conferem as ações e o último conteúdo acima do compositor, incluindo fullscreen do plantão, compositor expandido e mudança de tema.

## Validação

- `CI=true pnpm install --frozen-lockfile`: concluído.
- `pnpm build` e `pnpm typecheck`: verdes.
- `pnpm test`: 552 testes verdes (173 SDK, 105 CLI, 274 MCP); nove testes novos cobrem parsing, permissões, gating, filtragem e ciclo de vida.
- `pnpm gate:tarballs`: verde; catálogo padrão compatível com a fixture 0.6.0, só get_profile/prepare_send_intent adicionadas sem UI.
- Guarda HTTP: executada pelo bloco exato do CI, verde.
- 41 PNGs novos, zero violações axe WCAG A/AA, sem overflow; dois vídeos curtos de browser.
- Inspeção visual de plantão/resposta nova e deep link em claro/escuro e desktop/mobile: concluída.
- Debug e capturas temporárias não fazem parte da entrega.

## Simulador

Ativo em **http://127.0.0.1:4174/chat**, separado da porta 4173.

`/chat?scenario=live`: confirmar Enviar, escrever “Abra o plantão ao vivo”, acompanhar eventos chegando e clicar Responder. `/chat?scenario=global`: abertura direta da conversa por deep link; BotoZap na sidebar abre Pendências e “Marina respondeu · abrir link” simula uma atualização posterior de host context. `host=generic` conserva o Radar e ignora as extensões OpenAI. Todos os dados são fictícios.

Reprodução: `PORT=4174 pnpm --filter @botozap/mcp demo:ui` e `pnpm --filter @botozap/mcp exec node scripts/screenshot-3b.mjs`.

## Artefatos

[Validação automática](screenshots/validation-3b.json), [vídeo do plantão](screenshots/3b-roteiro-live-desktop-dark.webm) e [vídeo da entrada global/deep link](screenshots/3b-roteiro-global-desktop-dark.webm).

Cada etapa abaixo tem capturas `desktop-light`, `desktop-dark`, `mobile-light` e `mobile-dark` em screenshots, com prefixo `3b-`:

| Roteiro | Etapas |
|---|---|
| live | enviada, digitando, resposta, fullscreen, novo-rascunho |
| global | conversa, compositor-alto, contexto-atualizado, pendencias, link-atualizado |

Exemplos: [Plantão mobile escuro](screenshots/3b-live-resposta-mobile-dark.png), [novo contexto no card](screenshots/3b-live-novo-rascunho-mobile-light.png), [conversa desktop escuro](screenshots/3b-global-conversa-desktop-dark.png), [Pendências](screenshots/3b-global-pendencias-desktop-light.png), [compositor expandido](screenshots/3b-global-compositor-alto-mobile-dark.png), [host genérico](screenshots/3b-global-generico-mobile.png).

## Decisões de Fernando

Definir plugin-id publicado, confirmar o nome open_botozap no catálogo publicado, escolher contas do piloto e validar OAuth/layout no host real. Android ainda não tem deep links na tabela atual; decidir fallback para Android e para operadores sem plugin (inbox web autenticada ou conexão do plugin). A proposta de alerta WhatsApp `cta_url` “Sâmia respondeu…” com botão “Responder no ChatGPT”, suas dependências e os formatos web/codex/chatgpt estão em [DESIGN.md](DESIGN.md); não implementamos no app, não habilitamos flags e não houve deploy/publicação.
