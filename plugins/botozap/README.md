# BotoZap — candidato de piloto e submissão

Pacote portátil `0.1.0`, ainda sem upload, submissão ou publicação. O ZIP é um
candidato revisável; a validação local não comprova prontidão no portal. O endpoint
em `mcp.json` é o destino planejado e pode não conter este stack implantado.

A listagem base está em inglês, com tradução `pt-BR` e disponibilidade `BR`.
O manifesto inclui exatamente cinco casos positivos e três negativos no formato
importável. São cenários planejados, **ainda não executados**. O ícone 1024×1024
reutiliza `public/brand/v2/app-icon-1024.png` do aplicativo BotoZap, inspecionado
visualmente; o arquivo está incluído em `assets/icon.png`.

A UI do servidor candidato exige `BOTOZAP_MCP_UI_ENABLED=true`. Os nomes usados
nos casos são verificados contra o catálogo local e a referência publicada das
tools. Somente `open_review_panel` fornece o entrypoint de conversa;
`stage_review_reply` apresenta rascunho e não envia.

## Validar e gerar o ZIP local

Na raiz do repositório, com Python 3.9 ou superior:

```sh
python3 plugins/botozap/scripts/package.py
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-pilot-candidate.zip
unzip -l /tmp/botozap-pilot-candidate.zip
```

A validação verifica campos, limites, caminhos, dimensões do ícone, casos,
nomes de tools, proibição de campos privados e o conteúdo exato do ZIP. O arquivo
é criado com uma lista explícita: `plugin.json`, `mcp.json`, `assets/icon.png` e
as skills. README, scripts e materiais operacionais não entram no ZIP.

```sh
python3 plugins/botozap/scripts/package.py --submission-ready
```

Esse último comando **sempre falha nesta versão**, por bloqueio estático
intencional. Os gates externos não são medidos automaticamente: o script não
verifica deploy, publicação de páginas, execução dos casos ou estado do portal.
Não foi executada nenhuma chamada a uma conta real para alegar sucesso dos casos.
Validação estrutural local não substitui scans de metadata, skills, tools ou
revisão do portal.

## Gates antes de submissão

- O vídeo é obrigatório e **não existe URL de gravação neste candidato**.
  Gravar o fluxo real e disponibilizar a URL aos revisores; preencher
  `extensions.com.openai.review.demo_recording_url` somente com a gravação válida.
- `supportURL` aponta para `https://botozap.com.br/suporte`, destino planejado;
  publicar e verificar essa página antes de submeter. Privacidade e termos usam
  as rotas existentes `/privacidade` e `/termos`; revisar o texto para o tratamento
  de dados desta integração e verificar sua disponibilidade pública.
- Implantar API `/v1/me`, OAuth e MCP candidato, habilitar UI e verificar conexão,
  domínio e descoberta do catálogo no ambiente autorizado.
- Provisionar a fixture controlada e executar P01–P05/N01–N03. Registrar evidência
  real separadamente. Não usar conta ou destinatário de cliente real na revisão.
- Verificar identidade de publicação e completar os scans e atestações exigidos
  no portal. Upload, submissão e publicação exigem a autorização correspondente.

Credenciais e instruções de acesso dos revisores são preenchidas **somente no
formulário seguro do portal**. Não incluir `test_credentials`,
`reviewer_instructions`, senhas, chaves ou tokens no manifesto, nas skills ou no
ZIP. O material operacional [pilot-materials.md](./pilot-materials.md) também fica
fora do ZIP e não contém credenciais.

Formato conferido em 29/09/2026 na documentação oficial:
[Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission),
[Package your plugin](https://developers.openai.com/plugins/build/plugins).
