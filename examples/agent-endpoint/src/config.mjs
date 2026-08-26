function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Defina ${name}.`);
  return value;
}

function port() {
  const value = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error("PORT precisa ser um inteiro entre 1 e 65535.");
  }
  return value;
}

function fallbackTemplate() {
  const name = process.env.BOTOZAP_FALLBACK_TEMPLATE?.trim();
  if (!name) return null;

  let components;
  if (process.env.BOTOZAP_FALLBACK_COMPONENTS) {
    components = JSON.parse(process.env.BOTOZAP_FALLBACK_COMPONENTS);
    if (!Array.isArray(components)) {
      throw new Error("BOTOZAP_FALLBACK_COMPONENTS precisa ser um array JSON.");
    }
  }

  return {
    name,
    language: {
      code: process.env.BOTOZAP_FALLBACK_LANGUAGE?.trim() || "pt_BR",
    },
    ...(components ? { components } : {}),
  };
}

export function endpointConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    webhookSecret: required("BOTOZAP_WEBHOOK_SECRET"),
    port: port(),
  };
}

export function workerConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    apiKey: required("BOTOZAP_API_KEY"),
    baseUrl: process.env.BOTOZAP_BASE_URL?.trim() || undefined,
    fallbackTemplate: fallbackTemplate(),
    agentEndpointUrl: process.env.AGENT_ENDPOINT_URL?.trim() || null,
    agentBearerToken: process.env.AGENT_BEARER_TOKEN?.trim() || null,
  };
}
