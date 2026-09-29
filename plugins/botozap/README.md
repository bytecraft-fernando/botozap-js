# Pacote BotoZap para teste local

Manifesto portátil e skill do fluxo de revisão de pendências. **Candidato em desenvolvimento, não publicado.** O endpoint no `mcp.json` é o destino final; a implantação atual pode não conter a camada OAuth/UI deste stack.

Antes do piloto, use uma cópia do pacote com o endpoint do ambiente autorizado e registre a conexão conforme as instruções atuais do host. A UI exige `BOTOZAP_MCP_UI_ENABLED=true` no servidor candidato; as tools continuam utilizáveis sem UI. Não substitua credenciais OAuth por tokens escritos no manifesto.

A skill pode ser usada sem a superfície visual. Não há IDs fictícios de app registrado nem alegação de aprovação do diretório. Cadastro, URLs de privacidade/suporte, capturas e submissão serão preparados na camada de piloto.

Fontes do formato: [Package your plugin](https://developers.openai.com/plugins/build/plugins), [Build skills](https://developers.openai.com/plugins/build/skills).
