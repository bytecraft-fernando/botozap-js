# Pacote do plugin — rodada 2 (30/09/2026)

Branch `feat/plugin-pack-ui` rebaseada em `origin/main` f586343fd1ea82b7e4f2328486e6b01ba2fcfad7, com #14/#15/#17 integrados. Alterações apenas em `plugins/botozap/**`; sem npm, servidor, deploy, flags ou portal.

## Regra do piloto

Todas as seis skills distinguem pedidos completos e explícitos (tool direta com permissão do ChatGPT) de pedidos incompletos, escolhas e preparação/revisão (UI, com confirmação nela). Agenda completa não abre seletor; texto exato não abre outro card. Criar definição usa `create_template` diretamente; `stage_review_template` só prepara envio aprovado. UI nunca autoriza mutação paralela. Sem UI, pedidos completos mantêm rota direta; preparação/revisão conclui no painel. Administração, credenciais de IA e webhooks continuam no painel.

A tela do agente está preparada nas instruções para casos, alertas abertos e conversas pausadas retornados pelo servidor; não presume implementação nem inventa categorias ausentes. Worker B cuida dessa alteração MCP.

Manifest e materiais mantêm 5 positivos/3 negativos EN/pt-BR. P01/P02/P04 têm ensaios adicionais da rota direta; N02 agora testa contornar qualquer permissão, sem proibir um pedido completo de usar tool direta. Casos reais continuam **não executados**.

## Validação

`package.py` agora exige todas as nove tools de UI/auxiliar no catálogo local integrado; não injeta contratos planejados nem aceita `--catalog-ref`. As tools diretas são conferidas no catálogo existente. Snapshot de origem aponta só para main integrado; nenhuma disponibilidade remota é alegada.

Comandos:

```sh
python3 plugins/botozap/scripts/test_package.py
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-plugin-0.2.0.zip
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-plugin-0.2.0-rebuild.zip
cmp /tmp/botozap-plugin-0.2.0.zip /tmp/botozap-plugin-0.2.0-rebuild.zip
```

Oito testes offline: ZIP idêntico/allowlist, campos privados, token, tool desconhecida, symlink/binding, limites/readiness, tool integrada ausente e regra do piloto em todas as skills. ZERO tools UI ausentes no catálogo integrado. ZIP 764402 bytes; SHA-256 `e441d2ad2392d0499bf45be2d15b2bb720795d34ff3bccb35731b0d7e6f10994`.

Inventário exato (9):

- `assets/icon.png`
- `mcp.json`
- `plugin.json`
- `skills/casos-da-ia/SKILL.md`
- `skills/conectar-botozap/SKILL.md`
- `skills/marcar-horario/SKILL.md`
- `skills/plantao-ao-vivo/SKILL.md`
- `skills/preparar-template/SKILL.md`
- `skills/revisar-pendencias/SKILL.md`

## Submissão e limites

Mantidos os campos/limites e entrypoints conferidos anteriormente na documentação oficial de [submissão](https://developers.openai.com/plugins/deploy/submission) e [Extensions](https://developers.openai.com/plugins/build/extensions). Nenhum campo novo de manifest ou entrypoint fictício; thread/global continuam no servidor. ZIP exclui scripts, docs, contratos, screenshots, .env e materiais privados.

PR pronto para revisão não significa submissão pronta. Ainda faltam gravação real, execução dos casos com conta dedicada, verificação da implantação/host/conta, cobertura das políticas, publisher/scans/atestações e acesso seguro do revisor. `--submission-ready` continua bloqueando; nada foi enviado ao portal.

## Atualização 0.2.1 — fixture real e infraestrutura (01/10/2026)

Cinco positivos simplificados: P01 pendências/resposta confirmada; P02 confirmacao_pedido aprovado; P03 criação direta de template com permissão; P04 alertas não resolvidos/pausadas/casos; P05 plantão após envio controlado. Três negativos: administração/credencial, contornar permissão e ID alheio/inexistente. Tradução e fixture Meta Reviewer em pilot-materials.md (fora do ZIP); sem agendamento, pois zero serviços; sem telefone ou credenciais no ZIP. Todos os casos seguem não executados.

`package.py --zip /tmp/botozap-plugin-0.2.1.zip` e rebuild produziram arquivos idênticos, **764331 bytes**, SHA-256 `89f51eb281a929a7a136f3a07022d61341e4972d2998724b6dc5e48800414614`. **9 testes Python** passaram. Inventário exato permanece nos nove arquivos listados acima (assets/icon.png, mcp.json, plugin.json e seis SKILL.md). Relatório de infraestrutura/citações: [RELATORIO-SUBMISSION-INFRA.md](../../packages/mcp/RELATORIO-SUBMISSION-INFRA.md). Sem deploy/npm/portal; pacote válido não significa pronto para submissão.

## Atualização 0.3.0 — textos aprovados da vitrine (01/10/2026)

Categoria Business & Operations e descrições/release notes aprovadas aplicadas, mantendo a identidade e os casos de revisão. ZIP em `artifacts/plugins/botozap-plugin-0.3.0.zip` com inventário versionado: **763986 bytes**, SHA-256 `08166879662580e686a8fd0a03b89ffa1ea94a3edb3c1fc4ca54c63fdf9e24f6`; nove arquivos e rebuild idêntico, dez testes Python verdes. URL da gravação permanece ausente com aviso; subtitle pt-BR literal aprovado tem 34 caracteres e exige conferir aceitação antes da submissão. Relatório de release e catálogo OAuth: [RELATORIO-RELEASE-CHATGPT-UI.md](../../docs/RELATORIO-RELEASE-CHATGPT-UI.md). Sem publicação npm, deploy ou portal.
