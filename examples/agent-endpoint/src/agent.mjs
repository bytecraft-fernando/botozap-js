/**
 * Seam do runtime de agente. Sem AGENT_ENDPOINT_URL, usa uma resposta local
 * determinística para o exemplo subir sem credenciais de modelo. Em produção,
 * a URL configurada recebe `{ input, event }` e devolve `{ reply }`.
 */
export function createAgent({ endpointUrl, bearerToken }) {
  if (!endpointUrl) {
    return async ({ text }) => {
      const question = text.trim().endsWith("?");
      return question
        ? "Recebi sua pergunta. Um agente da sua aplicação pode responder por este worker."
        : "Recebi sua mensagem. Um agente da sua aplicação pode continuar este atendimento."
    };
  }

  return async ({ text, event }) => {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify({ input: text, event }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw Object.assign(new Error("agent_endpoint_error"), {
        code: `agent_http_${response.status}`,
      });
    }
    const body = await response.json();
    if (!body || typeof body.reply !== "string" || !body.reply.trim()) {
      throw Object.assign(new Error("agent_invalid_response"), {
        code: "agent_invalid_response",
      });
    }
    return body.reply;
  };
}
