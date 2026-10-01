# Release ChatGPT UI — preparação local

Base `origin/main`: `f086d9d713dfa2b380162bec82c1fd32b04301bc`. Branch `chore/release-chatgpt-ui`. Sem publicação real no npm, deploy, mudanças de flags ou operação no portal.

## Versionamento

Foi usado `pnpm changeset version`, consumindo os três changesets pendentes e um changeset de release com SDK/MCP minor e CLI patch. As entradas novas dos CHANGELOGs estão em pt-BR:

| Pacote | Versão | Dependência interna no tarball |
| --- | --- | --- |
| @botozap/sdk | 0.10.0 | — |
| @botozap/mcp | 0.8.0 | @botozap/sdk **0.10.0** |
| @botozap/cli | 0.6.1 | @botozap/sdk **0.10.0** |

CLI usa `workspace:*`, que o pnpm converte em versão **exata**, não intervalo. O patch distribui a dependência atualizada sem mudar comandos. Na publicação manual, o dono deve publicar SDK primeiro e aguardar sua disponibilidade no registry; depois CLI e MCP.

## Perfil OAuth aprovado durante a tarefa

`BOTOZAP_MCP_OAUTH_CLIENT_PROFILES` aceita `UUID:assistant` / `UUID:full`, separados por vírgulas. Sem configuração ou com cliente não mapeado, OAuth recebe `assistant`; API keys continuam `full`. Configuração inválida é rejeitada. O filtro cruza perfil, scopes, ambiente e rotas; atua no registro, `updateIdentity` e no handler usando a identidade efetiva da requisição. Uma tool omitida não pode ser chamada diretamente.

A lista aprovada mais `list_users`, necessária ao nome do responsável do agendamento, resulta em **43 tools máximas com UI negociada / 35 sem UI**. `list_users` tem `visibility: ['app']` quando a UI está ativa. Inclui as nove entradas/helpers de UI, leituras de CRM/conversas/templates/agenda, envios, criação de template, agendamento e ações de handoff; não inclui administração de conta, webhooks nem credenciais de IA. A allowlist explícita está em `packages/mcp/src/catalog-profile.ts`. Os nomes foram preservados e títulos/descrições do perfil ficaram mais claros. Hints mantêm leituras como readOnly, envios como destructive/openWorld e marcam `ai_cases_update` openWorld no perfil porque `resume_agent` pode causar resposta automática; API key/full preservam descritores anteriores.

Testes verificam catálogo completo e descritores de API key, OAuth mapeado/desconhecido/full, refresh removendo/reabilitando tools, recusa no handler conforme identidade da requisição, redução por scopes/rotas e ausência de UI sem negociação. A regressão HTTP anterior foi atualizada ao contrato aprovado: criar contato/negócio fica fora do assistant mesmo se a rota estiver autorizada; envio permitido continua disponível. Uma asserção percorre chamadas literais e dinâmicas das telas para garantir cobertura na allowlist. Não houve alteração visual, então não foi necessária nova captura, conforme orientação do coordenador; os testes de UI existentes passaram.

## Script de release

O problema de copiar `release-0.6.0-tools.json` para o consumidor já estava corrigido na main, inclusive no comando manual após timeout. O loop também já aguardava o registry por até 20 minutos, a cada 15 segundos. Mantidos os avisos sobre processamento, 2FA e E409; quatro testes offline agora confirmam que:

- dry-run aceita branch de revisão com alterações, usa `--dry-run` e não faz polling;
- publicação real só passa em main limpa e argumentos desconhecidos são recusados;
- uma publicação é seguida de espera pela propagação e cópia da fixture antes da prova pós-registry;
- E409 termina o fluxo sem republicar ou instalar versão ainda em processamento.

O ajuste necessário foi permitir o dry-run na branch do PR, preservando a trava da publicação real. Esses testes entram em `gate:tarballs` junto dos quatro testes do verificador de tarball.

## Resultados executados

`pnpm build`, `pnpm typecheck`, `pnpm test` (**615 testes: SDK 176, CLI 105, MCP 334**), `pnpm gate:tarballs` (também oito testes Node), guarda HTTP e `git diff --check`: verdes. Empacotamento do plugin: dez testes Python verdes; duas reconstruções idênticas.

Não existem scripts próprios de release para SDK/CLI; foram empacotados com pnpm e verificados com `npm publish <tarball> --dry-run`, sem publicação real. O MCP usou `pnpm release:mcp --dry-run`. Saída final:

```text
SDK: npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @botozap/sdk@0.10.0
CLI: npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @botozap/cli@0.6.1
MCP: npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @botozap/mcp@0.8.0

0.6.1
packed tools vs 0.6.0: {"added":["get_profile","prepare_send_intent"],"removed":[]}
clean tarball tools-only: ok (149 AI routes discovered)
```

| Tarball dry-run | Arquivos | Tamanho | SHA-1 exibido pelo npm |
| --- | --- | --- | --- |
| SDK | 10 | 263.3 kB | fa4108cad64c38de0b322b8a43fb62b61b303e89 |
| CLI | 30 | 26.5 kB | 0357d01755bfe4b502e526ceb0a44d2875d5b9a2 |
| MCP | 130 | 247.5 kB | 09adbe50274281531cf127dd88a8f551d8785f79 |

Logs locais completos: `/tmp/botozap-release-{build,typecheck,test,gate,mcp-dry,sdk-dry,cli-dry}.log`. Nenhum segredo foi incluído no relatório.

## Vitrine e ZIP 0.3.0

Categoria, shortDescription, longDescription, tradução pt-BR e release notes foram substituídos literalmente pelos textos aprovados. Não existe campo de release notes traduzidas no contrato de tradução atual, que só usa subtitle/description. `review.demo_recording_url` segue ausente; placeholder operacional apenas no README, sem URL inventada. Ausência permite candidato local com aviso e mantém bloqueada a submissão.

O subtitle pt-BR aprovado tem **34 caracteres**, acima do limite local de 30. Preservado por instrução explícita do dono; o empacotador permite somente essa exceção literal e emite aviso. Antes da submissão, o responsável precisa conferir aceitação no portal ou aprovar um texto mais curto; os demais limites continuam sendo validados.

Artefato versionado: `artifacts/plugins/botozap-plugin-0.3.0.zip`, **763986 bytes**, SHA-256 **08166879662580e686a8fd0a03b89ffa1ea94a3edb3c1fc4ca54c63fdf9e24f6**. Inventário: `artifacts/plugins/botozap-plugin-0.3.0.inventory.json`. Nove arquivos:

```text
assets/icon.png
mcp.json
plugin.json
skills/casos-da-ia/SKILL.md
skills/conectar-botozap/SKILL.md
skills/marcar-horario/SKILL.md
skills/plantao-ao-vivo/SKILL.md
skills/preparar-template/SKILL.md
skills/revisar-pendencias/SKILL.md
```

Docs, scripts, inventário, material privado e credenciais ficam fora do ZIP. O dono fornece a gravação real, publica os pacotes no terminal dele após merge e realiza as etapas de submissão; nenhuma dessas operações ocorreu neste trabalho.
