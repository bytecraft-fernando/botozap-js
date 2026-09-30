# P1.1 — versionamento dos resources de UI

Branch `fix/mcp-ui-cache-bust`, criada do `origin/main` atualizado (`5302aff`). Sem deploy, publicação ou alteração de flags. O cache do ChatGPT é a hipótese motivadora; a correção torna o identificador sensível ao conteúdo independentemente de essa hipótese explicar todos os sintomas.

## Implementação e validação

`loadUiResources` lê `dist/ui/review.html` uma única vez por processo, antes do registro das tools/recursos quando a UI está configurada. Para cada uma das oito telas, aplica os atributos de view/display mode e calcula SHA-256 sobre os bytes do HTML servido, um separador NUL e o JSON completo dos metadados do resource. Os primeiros 10 hex formam `ui://botozap/<view>/<hash>.html`. A mesma snapshot fornece o HTML, o URI registrado, `ui.resourceUri` e o alias `openai/outputTemplate`; não há rehash/leitura por chamada ou identidade no hash. Se o bundle estiver ausente, startup com UI falha em vez de publicar um URI falso. Sem UI, não há leitura do bundle nem mudança no catálogo padrão.

Os metadados completos, incluindo `ui.csp` e `openai/widgetCSP`, aparecem nos contents de `resources/read`. Também são espelhados no descriptor de `resources/list` como compatibilidade defensiva; o local exigido pela referência atual continua sendo os contents. Invoking/invoked ficam exclusivamente no descriptor da tool, em português e até 64 caracteres. O alias outputTemplate aponta para o URI atual de cada tool que renderiza UI.

No build validado: review `8f63a8e1c8`, reply `6a046e50f0`, radar-cards `6aa25efded`, template `1c5c81ff11`, cases `e0cb42e924`, booking `a3d75cab43`, live `80e35bd188`, global `b01ad0bbad`. Estes valores são exemplos desse bundle, não constantes no código. Nenhum resource `v1.html` permanece registrado.

Build, typecheck, **573 testes** (173 SDK, 105 CLI, 295 MCP), gate:tarballs, guarda HTTP e diff check passaram. Testes cobrem mudança de HTML/JS/CSS/metadados, determinismo, views distintas, concordância tools/resources/read/list, alias, CSP e recusa dos oito URIs antigos. O gate preserva a fixture 0.6.0 sem UI, com somente os acréscimos já existentes get_profile/prepare_send_intent.

## O que a documentação diz

Fonte consultada em 30/09/2026; numeração de linhas do conteúdo retornado pela ferramenta web nesta consulta:

- [Referência — tool descriptor](https://developers.openai.com/apps-sdk/reference#_meta-fields-on-tool-descriptor), linhas **1116–1129**: resourceUri é padrão; outputTemplate é alias opcional de compatibilidade (linha **1124**); invoking/invoked pertencem ao descriptor da tool e têm limite de 64 caracteres (linhas **1128–1129**). O exemplo das linhas **1156–1165** mantém o alias comentado e declara os rótulos ativos. A doc não estabelece dependência dos rótulos em outputTemplate; adicioná-lo é uma medida de compatibilidade, não prova de que seja obrigatório.
- [Referência — component resource metadata](https://developers.openai.com/apps-sdk/reference#component-resource-_meta-fields), linhas **1213–1223**: `ui.csp` e `openai/widgetCSP` pertencem aos **Resource contents**, respectivamente linhas **1217** e **1222**. Linhas **1224–1235** descrevem os campos snake_case e o requisito de redirect_domains no alias para destinos openExternal; os allowlists atuais foram preservados.
- [Add UI — embed the component](https://developers.openai.com/plugins/build/chatgpt-ui#embed-the-component-in-the-server-response), linhas **1424–1426**: ambos os campos da tool vinculam o template, o URI é chave de cache e mudanças incompatíveis em HTML/JS/CSS exigem novo URI com atualização de todas as tools que o referenciam.

Não houve teste de produção ou deploy nesta tarefa. Após uma implantação autorizada, atualizar a conexão e abrir uma nova chamada de UI deve mostrar os URIs novos; Fernando precisa reconfirmar CSP e rótulos no host real, pois a documentação não promete que invoking/invoked altere todos os tipos de rótulo de abertura global do ChatGPT.
