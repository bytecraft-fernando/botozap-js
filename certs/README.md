# CA PostgreSQL do MCP remoto

Estado: Ativo. Validado em 12/09/2026.

O container MCP inclui o certificado **público** Supabase Root 2021 CA.
`NODE_EXTRA_CA_CERTS` adiciona essa CA às raízes conhecidas pelo Node no boot,
preservando a verificação de cadeia e hostname da conexão PostgreSQL.
Não é uma chave privada nem uma credencial de acesso.

Origem: download do Supabase Dashboard em Database Settings → SSL Configuration,
o mesmo certificado já usado na operação local BotoZap. Procedimento oficial:
https://supabase.com/docs/guides/platform/ssl-enforcement

- Subject/issuer: `Supabase Root 2021 CA`, Supabase Inc.
- Validade: 28/04/2021 a 26/04/2031.
- SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

## Incidente e verificação

O MCP 0.2.4 em produção não confiava nessa cadeia e a conexão do event bus
falhava com `SELF_SIGNED_CERT_IN_CHAIN`. Tools e replay continuavam funcionando,
mas as notifications dependiam do heartbeat de 15 segundos. Atualizar somente
o pacote para 0.2.6 não mudou essa configuração TLS.

O `Dockerfile.mcp` copia a CA e define `NODE_EXTRA_CA_CERTS` antes do boot.
Após o deploy, verificar uma conexão com a mesma URL do bus sem reduzir TLS,
a sessão `botozap-mcp-event-bus` em LISTEN, o trigger `account_events_notify_bus`
e uma notification de Evento novo. Healthz sozinho não comprova o bus.

Para conferir o certificado antes de substituir:

```sh
openssl x509 -in certs/supabase-root-2021.crt -noout -subject -issuer -dates -fingerprint -sha256
```

Renovação: obter a CA no Dashboard oficial, revisar subject/validade/fingerprint,
substituir este arquivo e reconstruir o container. Não confiar automaticamente
em certificados retornados por uma conexão que falhou na validação.
Não usar `NODE_TLS_REJECT_UNAUTHORIZED=0` nem `rejectUnauthorized: false`.

Contrato do Node 22: https://nodejs.org/download/release/v22.4.0/docs/api/cli.html#node_extra_ca_certsfile
