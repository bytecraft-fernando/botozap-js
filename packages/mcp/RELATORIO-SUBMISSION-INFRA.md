# Infraestrutura de submissão — 01/10/2026

Branch `feat/mcp-submission-infra`, base `origin/main` 5827a52e2ba21d4de0302ed0096cf0c281be44fd. Sem deploy/npm/portal, sem alteração de flags ou do app. Nenhum arquivo em web ou resources/cases-panel foi editado.

## Implementação

GET/HEAD `/.well-known/openai-apps-challenge` passa pelas guardas existentes de proxy, rate limit, host/origin e encerramento, antes do Bearer. OPENAI_APPS_CHALLENGE ausente/vazia ou método diferente retorna 404; GET retorna exatamente o valor (sem trim/newline/JSON), text/plain UTF-8 e no-store; HEAD mantém headers/tamanho e não retorna corpo. O token não é registrado em log. Healthz/MCP/OAuth mantêm o comportamento existente. O valor só deverá ser configurado pelo responsável com o token exato e URL fornecidos pelo portal.

BOTOZAP_MCP_UI_DOMAIN opcional configura `ui.domain` e `openai/widgetDomain` centralmente nos oito resources, tanto no descriptor quanto nos contents. Aceita origem HTTPS sem credenciais, caminho significativo, query ou fragment, normalizada para origin; configuração inválida falha o startup com UI. Sem configuração, os campos seguem ausentes e o default do host permanece. CSP/allowlists não são ampliados. O hash do resource já inclui os metadados, portanto mudar o domínio gera novos URIs coerentes com tools/outputTemplate no próximo startup.

## Evidência oficial e recomendação

Linhas do conteúdo retornado pela ferramenta web nesta consulta; pesquisa anterior do worker A preservada em `/tmp/botozap-submission-infra-blocked.md` e reconferida:

- [Submissão](https://developers.openai.com/plugins/deploy/submission), **979–982**: exige token exato em texto puro na URL HTTPS do desafio, no host MCP ou parent elegível; não substituir token de outro plugin na mesma URL.
- [Referência](https://developers.openai.com/apps-sdk/reference), **1213–1223**, especialmente **1218/1223**: domínio dedicado/único por plugin é exigido para submissão com UI; widgetDomain é alias; default é web-sandbox.oaiusercontent.com. Placement é Resource contents.
- [Add UI](https://developers.openai.com/plugins/build/chatgpt-ui), **1389–1423**, especialmente **1404–1413**: exemplo retorna HTML/JS em resources/read com domain https://example.com.
- [MCP Apps draft](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/draft/apps.mdx), **183–202**: domain configura origem sandbox; formato/validação dependem do host e pode haver origem derivada de URL. **216–243** descrevem HTML entregue nos contents de resources/read.

**Inferência das fontes:** ui.domain configura a identidade/origem dedicada do sandbox, não um endpoint de hosting do bundle. Essas fontes não exigem servir HTML, verificação própria ou DNS separado para esse campo, nem explicam o algoritmo de derivação do ChatGPT. Isso não garante dispensa de validações adicionais do portal. Recomendamos **BOTOZAP_MCP_UI_DOMAIN=https://mcp.botozap.com.br**, se esta origem for exclusiva do plugin; confirmar a aceitação no portal/ChatGPT antes da submissão. O desafio de domínio MCP é requisito separado. Não foi implementado hosting.

## Pacote e testes

Pacote 0.2.1: cinco positivos EN/pt-BR para a conta real Meta Reviewer, com Fernando Gomes controlado, confirmacao_pedido aprovado, criação direta de template com permissão, agente precisa de você e plantão. Sem agendamento: a conta não tem serviços. Janela 24h fechada pede template em P01/P05; P02 permite enviar aprovado. Resposta do cliente no plantão é opcional. Três negativos preservam recusa de administração/credenciais, guardas de confirmação e limites de outra conta/ID inválido. E-mail/credenciais de revisão ficam fora do ZIP; nenhum telefone do contato foi colocado no pacote. Casos continuam **não executados**.

Build, typecheck, **596 testes** (176 SDK, 105 CLI, 315 MCP), gate:tarballs e guarda HTTP verdes; **9 testes Python** do pacote passaram. Tests cobrem GET/HEAD literal/UTF-8, 404 sem token, host/origin/proxy/rate limit, domínio nos oito resources/tools, default sem env, URLs inválidas e hash alterado. Catálogo padrão permanece compatível com fixture 0.6.0.

ZIP reproduzível `/tmp/botozap-plugin-0.2.1.zip`: **764331 bytes**, SHA-256 **89f51eb281a929a7a136f3a07022d61341e4972d2998724b6dc5e48800414614**; rebuild comparado byte a byte. Inventário e casos detalhados em [plugins/botozap/RELATORIO.md](../../plugins/botozap/RELATORIO.md).

Faltam implantação autorizada/configuração de token/domínio, verificação e scans no portal, credenciais no campo seguro, execução dos oito casos e vídeo real. Nenhuma dessas etapas foi realizada aqui.
