export interface AiField {
  type: string;
  optional: boolean;
}
export interface AiOperation {
  group: string;
  name: string;
  method: string;
  path: string;
  shape: string;
  /** Required API scope when it differs from the method default (GET = read, others = write). */
  scope?: "agents:read" | "agents:write";
  description: string;
  fields: Record<string, AiField>;
}
/** Explicit public routes, checked against the API candidate. */
export const AI_OPERATIONS: readonly AiOperation[] = [
  {
    group: "agents",
    name: "list",
    method: "GET",
    path: "/ai/agents",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "agents",
    name: "get",
    method: "GET",
    path: "/ai/agents/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "agents",
    name: "create",
    method: "POST",
    path: "/ai/agents",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      description: {
        type: "string",
        optional: true,
      },
      config: {
        type: "agentConfig",
        optional: true,
      },
    },
  },
  {
    group: "agents",
    name: "saveDraft",
    method: "PUT",
    path: "/ai/agents/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      description: {
        type: "string",
        optional: true,
      },
      config: {
        type: "agentConfig",
        optional: true,
      },
      expected_revision: {
        type: "revision",
        optional: true,
      },
    },
  },
  {
    group: "agents",
    name: "publish",
    method: "POST",
    path: "/ai/agents/:id/publish",
    shape: "item",
    description:
      "Publica versão e altera próximos atendimentos; confira a versão antes de executar.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "agents",
    name: "restore",
    method: "POST",
    path: "/ai/agents/:id/restore",
    shape: "item",
    description: "Restaura versão para edição; não ativa atendimento.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
      expected_draft_revision: {
        type: "revision",
        optional: true,
      },
    },
  },
  {
    group: "agents",
    name: "duplicate",
    method: "POST",
    path: "/ai/agents/:id/duplicate",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "agents",
    name: "operation",
    method: "POST",
    path: "/ai/agents/:id/operation",
    shape: "item",
    description:
      "Ativar automático pode enviar respostas; exige intenção explícita do usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      mode: {
        type: "automatic|assisted",
        optional: false,
      },
      paused: {
        type: "boolean",
        optional: false,
      },
    },
  },
  {
    group: "agents",
    name: "archive",
    method: "POST",
    path: "/ai/agents/:id/archive",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      archived: {
        type: "boolean",
        optional: false,
      },
    },
  },
  {
    group: "agents",
    name: "preview",
    method: "POST",
    path: "/ai/agents/:id/preview",
    shape: "item",
    description:
      "Teste livre BYOK sem enviar ao WhatsApp; ferramentas simuladas. Preserve operation_key UUID em resultado incerto.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      messages: {
        type: "messages",
        optional: false,
      },
    },
  },
  {
    group: "credentials",
    name: "list",
    method: "GET",
    path: "/ai/credentials",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "credentials",
    name: "get",
    method: "GET",
    path: "/ai/credentials/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "credentials",
    name: "create",
    method: "POST",
    path: "/ai/credentials",
    shape: "item",
    description:
      "Cria credencial própria no Vault; a resposta nunca contém a chave.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      provider: {
        type: "provider",
        optional: false,
      },
      label: {
        type: "string",
        optional: false,
      },
      key: {
        type: "secret",
        optional: false,
      },
    },
  },
  {
    group: "credentials",
    name: "update",
    method: "PATCH",
    path: "/ai/credentials/:id",
    shape: "item",
    description:
      "Rotação mantém ID; envie key sozinha ou label/active. CAS obrigatório.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      key: {
        type: "secret",
        optional: true,
      },
      label: {
        type: "string",
        optional: true,
      },
      active: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "credentials",
    name: "revalidate",
    method: "POST",
    path: "/ai/credentials/:id/revalidate",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "credentials",
    name: "remove",
    method: "DELETE",
    path: "/ai/credentials/:id",
    shape: "empty",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "providers",
    name: "get",
    method: "GET",
    path: "/ai/providers",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "providers",
    name: "saveBinding",
    method: "PUT",
    path: "/ai/providers",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      purpose: {
        type: "configurablePurpose",
        optional: false,
      },
      provider: {
        type: "provider",
        optional: false,
      },
      model: {
        type: "string",
        optional: false,
      },
      credential_id: {
        type: "uuid",
        optional: false,
      },
      fallback: {
        type: "binding",
        optional: true,
      },
    },
  },
  {
    group: "providers",
    name: "removeBinding",
    method: "DELETE",
    path: "/ai/providers",
    shape: "empty",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      purpose: {
        type: "configurablePurpose",
        optional: false,
      },
    },
  },
  {
    group: "providers",
    name: "models",
    method: "GET",
    path: "/ai/providers/:provider/models",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      provider: {
        type: "provider",
        optional: false,
      },
      credential_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "executions",
    name: "list",
    method: "GET",
    path: "/ai/executions",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "executions",
    name: "get",
    method: "GET",
    path: "/ai/executions/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "executions",
    name: "decide",
    method: "POST",
    path: "/ai/executions/:id/decision",
    shape: "item",
    description:
      "Aprova plano imutável e pode enviar resposta; confirme conteúdo com usuário. Operador executa ações sem enviar. Ator é a chave autenticada.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: false,
      },
      decision: {
        type: "approve|reject",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "list",
    method: "GET",
    path: "/ai/knowledge",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "get",
    method: "GET",
    path: "/ai/knowledge/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "create",
    method: "POST",
    path: "/ai/knowledge",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      kind: {
        type: "text|faq|document|catalog|conversation",
        optional: false,
      },
      text: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "update",
    method: "PATCH",
    path: "/ai/knowledge/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      name: {
        type: "string",
        optional: true,
      },
      active: {
        type: "boolean",
        optional: true,
      },
      text: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "remove",
    method: "DELETE",
    path: "/ai/knowledge/:id",
    shape: "empty",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "reindex",
    method: "POST",
    path: "/ai/knowledge/:id/reindex",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "chunks",
    method: "GET",
    path: "/ai/knowledge/:id/chunks",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "search",
    method: "POST",
    path: "/ai/knowledge/search",
    shape: "item",
    scope: "agents:read",
    description:
      "Busca somente nas fontes permitidas; pode chamar embeddings BYOK.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      source_ids: {
        type: "uuids",
        optional: false,
      },
      query: {
        type: "string",
        optional: false,
      },
      top_k: {
        type: "number",
        optional: true,
      },
      threshold: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "upload",
    method: "POST",
    path: "/ai/knowledge/upload",
    shape: "multipart",
    description: "Upload de documento de até 20 MiB para indexação BYOK.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      file: {
        type: "file",
        optional: false,
      },
      file_name: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "get",
    method: "GET",
    path: "/ai/memory",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "publish",
    method: "PUT",
    path: "/ai/memory",
    shape: "item",
    description: "Publica nova memória de negócio versionada.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      content: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "setEnabled",
    method: "PATCH",
    path: "/ai/memory",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      enabled: {
        type: "boolean",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "versions",
    method: "GET",
    path: "/ai/memory/versions",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "entries",
    method: "GET",
    path: "/ai/memory/entries",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      status: {
        type: "active|pending|archived",
        optional: true,
      },
      contact_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "memory",
    name: "createEntry",
    method: "POST",
    path: "/ai/memory/entries",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      title: {
        type: "string",
        optional: false,
      },
      body: {
        type: "string",
        optional: false,
      },
      contact_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "memory",
    name: "updateEntry",
    method: "PATCH",
    path: "/ai/memory/entries/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      title: {
        type: "string",
        optional: false,
      },
      body: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "archiveEntry",
    method: "DELETE",
    path: "/ai/memory/entries/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "approveEntry",
    method: "POST",
    path: "/ai/memory/entries/:id/approve",
    shape: "item",
    description:
      "Aprova memória pendente após revisão explícita; ator é chave autenticada de owner/admin atual.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "list",
    method: "GET",
    path: "/ai/skills",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "get",
    method: "GET",
    path: "/ai/skills/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "create",
    method: "POST",
    path: "/ai/skills",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      description: {
        type: "string",
        optional: false,
      },
      body: {
        type: "string",
        optional: false,
      },
      matcher: {
        type: "matcher",
        optional: false,
      },
      active: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "skills",
    name: "update",
    method: "PATCH",
    path: "/ai/skills/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      description: {
        type: "string",
        optional: false,
      },
      body: {
        type: "string",
        optional: false,
      },
      matcher: {
        type: "matcher",
        optional: false,
      },
      active: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "skills",
    name: "remove",
    method: "DELETE",
    path: "/ai/skills/:id",
    shape: "empty",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "versions",
    method: "GET",
    path: "/ai/skills/:id/versions",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "reference",
    method: "GET",
    path: "/ai/skills/:id/references",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
      path: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "importZip",
    method: "POST",
    path: "/ai/skills/import",
    shape: "multipart",
    description:
      "Importa pacote ZIP até 5 MiB; substituir exige id e expected_revision juntos.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: true,
      },
      expected_revision: {
        type: "revision",
        optional: true,
      },
      file: {
        type: "file",
        optional: false,
      },
      file_name: {
        type: "string",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "list",
    method: "GET",
    path: "/ai/followup-flows",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "get",
    method: "GET",
    path: "/ai/followup-flows/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "create",
    method: "POST",
    path: "/ai/followup-flows",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      graph: {
        type: "graph",
        optional: false,
      },
      settings: {
        type: "flowSettings",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "update",
    method: "PUT",
    path: "/ai/followup-flows/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      graph: {
        type: "graph",
        optional: false,
      },
      settings: {
        type: "flowSettings",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "control",
    method: "PATCH",
    path: "/ai/followup-flows/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      status: {
        type: "active|paused|archived",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "publish",
    method: "POST",
    path: "/ai/followup-flows/:id/publish",
    shape: "item",
    description:
      "Publica grafo validado; mensagens futuras respeitam consentimento, janelas e aprovação assistida.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "versions",
    method: "GET",
    path: "/ai/followup-flows/:id/versions",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "rollback",
    method: "POST",
    path: "/ai/followup-flows/:id/rollback",
    shape: "item",
    description:
      "Restaura e publica uma nova versão atomicamente; confirme substituição do rascunho.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followupFlows",
    name: "models",
    method: "GET",
    path: "/ai/followup-flows/from-model",
    shape: "item",
    description: "",
    fields: {},
  },
  {
    group: "followupFlows",
    name: "installModel",
    method: "POST",
    path: "/ai/followup-flows/from-model",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      model_id: {
        type: "string",
        optional: false,
      },
      name: {
        type: "string",
        optional: true,
      },
      stage_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "list",
    method: "GET",
    path: "/ai/followups/enrollments",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      flow_id: {
        type: "uuid",
        optional: true,
      },
      contact_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "string",
        optional: true,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "get",
    method: "GET",
    path: "/ai/followups/enrollments/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followups",
    name: "enroll",
    method: "POST",
    path: "/ai/followups/enrollments",
    shape: "item",
    description:
      "Inicia acompanhamento que pode enviar mensagens; preserve operation_key UUID.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      flow_id: {
        type: "uuid",
        optional: false,
      },
      contact_id: {
        type: "uuid",
        optional: false,
      },
      conversation_id: {
        type: "uuid",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      appointment_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "control",
    method: "POST",
    path: "/ai/followups/enrollments/:id/control",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      action: {
        type: "pause|resume|postpone|skip|cancel",
        optional: false,
      },
      due_at: {
        type: "datetime",
        optional: true,
      },
      branch_id: {
        type: "string",
        optional: true,
      },
      note: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "decideEffect",
    method: "POST",
    path: "/ai/followups/effects/:id/decision",
    shape: "item",
    description:
      "Aprova/rejeita mensagem imutável após revisão. Não aceita texto substituto nem actor_id.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      approve: {
        type: "boolean",
        optional: false,
      },
    },
  },
  {
    group: "followups",
    name: "resolveEffect",
    method: "POST",
    path: "/ai/followups/effects/:id/resolve",
    shape: "item",
    description:
      "Concilia resultado incerto com evidência. Sem dispatch só cancelled; sent exige wamid. Nunca reenvia unknown.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      outcome: {
        type: "sent|rejected|cancelled",
        optional: false,
      },
      note: {
        type: "evidence",
        optional: false,
      },
      wamid: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "routers",
    name: "list",
    method: "GET",
    path: "/ai/routers",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "routers",
    name: "get",
    method: "GET",
    path: "/ai/routers/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "routers",
    name: "create",
    method: "POST",
    path: "/ai/routers",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      config: {
        type: "routerConfig",
        optional: false,
      },
    },
  },
  {
    group: "routers",
    name: "update",
    method: "PUT",
    path: "/ai/routers/:id",
    shape: "item",
    description:
      "Edição de roteador ativo aplica imediatamente e invalida classificações da revisão anterior.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      config: {
        type: "routerConfig",
        optional: false,
      },
    },
  },
  {
    group: "routers",
    name: "archive",
    method: "DELETE",
    path: "/ai/routers/:id",
    shape: "item",
    description:
      "Desativa e arquiva preservando histórico; não ativa outro responsável.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "routers",
    name: "operation",
    method: "POST",
    path: "/ai/routers/:id/operation",
    shape: "item",
    description:
      "Tomar canal exige confirmação explícita, replace_current e CAS expected_owner_agent_id; não substitui outro roteador.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
      active: {
        type: "boolean",
        optional: false,
      },
      replace_current: {
        type: "boolean",
        optional: true,
      },
      expected_owner_agent_id: {
        type: "nullableUuid",
        optional: true,
      },
    },
  },
  {
    group: "routers",
    name: "test",
    method: "POST",
    path: "/ai/routers/:id/test",
    shape: "item",
    description:
      "Classifica com BYOK sem encaminhar nem enviar; preserve UUID da tentativa.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      text: {
        type: "string",
        optional: false,
      },
      request_key: {
        type: "uuid",
        optional: false,
      },
      sticky_agent_id: {
        type: "nullableUuid",
        optional: true,
      },
      sticky_intent: {
        type: "nullableString",
        optional: true,
      },
    },
  },
  {
    group: "routers",
    name: "activateMember",
    method: "POST",
    path: "/ai/routers/:id/members/:agent_id/activate",
    shape: "item",
    description: "Ativa membro sem criar vínculo direto com canal.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_agent_revision: {
        type: "revision",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: false,
      },
      mode: {
        type: "automatic|assisted",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "list",
    method: "GET",
    path: "/ai/cases",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      status: {
        type: "open|waiting|resolved|closed",
        optional: true,
      },
      kind: {
        type: "agendamento|duvida|problema|financeiro|acesso|outro",
        optional: true,
      },
      source: {
        type: "agent|guardrail|human|operator",
        optional: true,
      },
    },
  },
  {
    group: "cases",
    name: "get",
    method: "GET",
    path: "/ai/cases/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "messages",
    method: "GET",
    path: "/ai/cases/:id/messages",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "update",
    method: "PATCH",
    path: "/ai/cases/:id",
    shape: "item",
    description:
      "Atualiza caso; resume_agent pode retomar automação e exige intenção explícita.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
      status: {
        type: "open|waiting|resolved|closed",
        optional: true,
      },
      assigned_user_id: {
        type: "nullableUuid",
        optional: true,
      },
      message: {
        type: "string",
        optional: true,
      },
      resume_agent: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "alerts",
    name: "list",
    method: "GET",
    path: "/ai/alerts",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      status: {
        type: "open|acknowledged|resolved",
        optional: true,
      },
      kind: {
        type: "alertKind",
        optional: true,
      },
      severity: {
        type: "info|warning|critical",
        optional: true,
      },
    },
  },
  {
    group: "alerts",
    name: "update",
    method: "PATCH",
    path: "/ai/alerts/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
      status: {
        type: "open|acknowledged|resolved",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "get",
    method: "GET",
    path: "/ai/notices",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "update",
    method: "PATCH",
    path: "/ai/notices",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      enabled: {
        type: "boolean",
        optional: false,
      },
      contact_id: {
        type: "nullableUuid",
        optional: false,
      },
      template_id: {
        type: "nullableUuid",
        optional: false,
      },
      variable_map: {
        type: "noticeMap",
        optional: false,
      },
      consent_confirmed: {
        type: "boolean",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "options",
    method: "GET",
    path: "/ai/notices/options",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "jobs",
    method: "GET",
    path: "/ai/notices/jobs",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "notices",
    name: "test",
    method: "POST",
    path: "/ai/notices/test",
    shape: "item",
    description:
      "Envia template real ao destinatário autorizado. Exige confirmação explícita e confirm_send:true.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      confirm_send: {
        type: "true",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "retry",
    method: "POST",
    path: "/ai/notices/jobs/:id/retry",
    shape: "item",
    description:
      "Reenfileira apenas falha confirmada; unknown não admite retry.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "proposals",
    name: "list",
    method: "GET",
    path: "/ai/proposals",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "pending|applied|rejected",
        optional: true,
      },
    },
  },
  {
    group: "proposals",
    name: "decide",
    method: "PATCH",
    path: "/ai/proposals/:id",
    shape: "item",
    description:
      "Aplicar playbook publica NOVA versão atomicamente; memória entra na base. Revise conteúdo e evidência, obtenha confirmação antes de aplicar.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
      decision: {
        type: "apply|reject",
        optional: false,
      },
      reason: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "proposals",
    name: "analyze",
    method: "POST",
    path: "/ai/proposals/analyze",
    shape: "item",
    description:
      "Analisa execuções via BYOK e gera propostas pendentes, sem aprovação automática.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: false,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "proposals",
    name: "settings",
    method: "GET",
    path: "/ai/proposals/settings",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "proposals",
    name: "saveSettings",
    method: "PATCH",
    path: "/ai/proposals/settings",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      enabled: {
        type: "boolean",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
    },
  },
  {
    group: "usage",
    name: "get",
    method: "GET",
    path: "/ai/usage",
    shape: "item",
    description:
      "Medições e estimativas de consumo BYOK, sem cobrança ou crédito BotoZap. agent_id e purpose filtram; agents, handoff e p50/p95 diários são adicionais.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      from: {
        type: "datetime",
        optional: true,
      },
      to: {
        type: "datetime",
        optional: true,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      purpose: {
        type: "purpose",
        optional: true,
      },
    },
  },
  {
    group: "usage",
    name: "budget",
    method: "GET",
    path: "/ai/usage/budget",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "usage",
    name: "saveBudget",
    method: "PATCH",
    path: "/ai/usage/budget",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      monthly_limit_usd: {
        type: "nullableNumber",
        optional: false,
      },
      mode: {
        type: "off|warn|block",
        optional: false,
      },
      alarm_threshold_pct: {
        type: "number",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
    },
  },
  {
    group: "usage",
    name: "rates",
    method: "GET",
    path: "/ai/usage/rates",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "usage",
    name: "saveRate",
    method: "PUT",
    path: "/ai/usage/rates",
    shape: "item",
    description:
      "Tarifas próprias: audio_pricing ausente preserva, null remove. Reservas de tokens são estimativas; o custo real pode excedê-las.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      provider: {
        type: "provider",
        optional: false,
      },
      model: {
        type: "string",
        optional: false,
      },
      input_usd_per_million: {
        type: "number",
        optional: false,
      },
      output_usd_per_million: {
        type: "number",
        optional: false,
      },
      cache_read_usd_per_million: {
        type: "number",
        optional: false,
      },
      cache_write_usd_per_million: {
        type: "number",
        optional: false,
      },
      audio_pricing: { type: "audioPricing", optional: true },
      expected_revision: {
        type: "number",
        optional: false,
      },
    },
  },
  {
    group: "usage",
    name: "reprice",
    method: "POST",
    path: "/ai/usage/rates/reprice",
    shape: "item",
    description:
      "Aplica tarifa própria a medições sem preço; não gera cobrança BotoZap. Exige confirmação.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      provider: {
        type: "provider",
        optional: false,
      },
      model: {
        type: "string",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
      confirm: {
        type: "true",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "reply",
    method: "POST",
    path: "/ai/cases/:id/reply",
    shape: "item",
    description:
      "Decisão humana explícita: resolved/need_lead_info retomam o agente e podem enviar ao contato; escalate mantém atendimento humano. Revise texto e resultado com o usuário. Confira queued e queue_reason; não repita com outra UUID após resultado incerto.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      action: {
        type: "resolved|need_lead_info|escalate",
        optional: false,
      },
      body: {
        type: "caseBody",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "consult",
    method: "POST",
    path: "/ai/cases/:id/chat",
    shape: "item",
    description:
      "Consulta interna paga no provedor próprio, sem ferramentas nem envio ao contato. Mesma UUID reconsulta o resultado sem nova inferência; unknown não autoriza repetir automaticamente.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      question: {
        type: "caseQuestion",
        optional: false,
      },
    },
  },
  {
    group: "cases",
    name: "chatHistory",
    method: "GET",
    path: "/ai/cases/:id/chat",
    shape: "offset",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "importSource",
    method: "POST",
    path: "/ai/knowledge/import",
    shape: "item",
    description:
      "Importa serviços da Agenda, catálogo informado ou conversa autorizada. Conversa exige revisão humana do texto anonimizado, preview_hash atual e reviewed=true explícito; nunca confirme revisão por conta própria.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      name: {
        type: "string",
        optional: false,
      },
      kind: {
        type: "services|products|conversation",
        optional: false,
      },
      source_id: {
        type: "uuid",
        optional: true,
      },
      expected_revision: {
        type: "revisionZero",
        optional: true,
      },
      products: {
        type: "catalogProducts",
        optional: true,
      },
      conversation_id: {
        type: "uuid",
        optional: true,
      },
      permission_revision: {
        type: "revisionZero",
        optional: true,
      },
      preview_hash: {
        type: "sha256",
        optional: true,
      },
      reviewed: {
        type: "true",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "conversations",
    method: "GET",
    path: "/ai/knowledge/conversations",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "conversationPermission",
    method: "PATCH",
    path: "/ai/knowledge/conversations/:id/permission",
    shape: "item",
    description:
      "Autoriza/revoga reutilizar conversa encerrada como conhecimento. Exige decisão explícita do usuário; não autorize para contornar bloqueio.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revisionZero",
        optional: false,
      },
      allowed: {
        type: "boolean",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "conversationPreview",
    method: "GET",
    path: "/ai/knowledge/conversations/:id/preview",
    shape: "item",
    description:
      "Retorna texto anonimizado e hash para revisão humana antes de importar. Não confirma a revisão nem indexa por si só.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "catalog",
    method: "GET",
    path: "/ai/skills/catalog",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "install",
    method: "POST",
    path: "/ai/skills/catalog/:slug/install",
    shape: "item",
    description:
      "Instala cópia de uma versão específica do catálogo de skills no Cliente autorizado.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      slug: {
        type: "string",
        optional: false,
      },
      version_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "checkpoints",
    method: "GET",
    path: "/ai/memory/checkpoints",
    shape: "item",
    description:
      "Resumos de conversa, evidências e estado da compactação; sem conteúdo bruto de origem.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      conversation_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "uploads",
    name: "prepare",
    method: "POST",
    path: "/ai/uploads",
    shape: "item",
    description:
      "Prepara upload direto. Envie bytes por PUT na URL assinada com os headers retornados, sem Authorization BotoZap. Guarde upload_id para finalizar a mesma importação.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      kind: {
        type: "knowledge|skill",
        optional: false,
      },
      file_name: {
        type: "string",
        optional: false,
      },
      mime_type: {
        type: "string",
        optional: false,
      },
      byte_size: {
        type: "number",
        optional: false,
      },
      sha256: {
        type: "sha256",
        optional: false,
      },
      name: {
        type: "string",
        optional: true,
      },
      skill_id: {
        type: "uuid",
        optional: true,
      },
      expected_revision: {
        type: "revision",
        optional: true,
      },
    },
  },
  {
    group: "uploads",
    name: "complete",
    method: "POST",
    path: "/ai/uploads/:id/complete",
    shape: "item",
    description:
      "Finaliza upload já enviado ao armazenamento. Preserve o mesmo id em timeout; não prepara nem envia arquivo novamente.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  // #498 agent parity: appended so existing indexes stay stable.
  {
    group: "alerts",
    name: "resolveBulk",
    method: "POST",
    path: "/ai/alerts/resolve",
    shape: "item",
    description:
      "Resolve em lote somente alertas criados até created_before que casam com filters (status open|acknowledged, kind, severity); até 500 por chamada e remaining indica o restante. Confirme o filtro com o usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      created_before: {
        type: "datetime",
        optional: false,
      },
      filters: {
        type: "alertBulkFilters",
        optional: true,
      },
    },
  },
  {
    group: "cases",
    name: "events",
    method: "GET",
    path: "/ai/cases/:id/events",
    shape: "offset",
    description:
      "Linha do tempo tipada do caso, da mais antiga para a mais recente, com label leigo ao lado do kind.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "list",
    method: "GET",
    path: "/ai/commercial-proposals",
    shape: "offset",
    description:
      "Propostas de próxima ação comercial. status decided reúne approved e dismissed.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      status: {
        type: "pending|approved|dismissed|superseded|decided",
        optional: true,
      },
      opportunity_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "request",
    method: "POST",
    path: "/ai/commercial-proposals",
    shape: "item",
    description:
      "Enfileira geração BYOK de proposta para o negócio; não altera o CRM. Reuse o mesmo request_key ao repetir (replayed). Exige CRM no plano.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      opportunity_id: {
        type: "uuid",
        optional: false,
      },
      request_key: {
        type: "requestKey",
        optional: false,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "decide",
    method: "POST",
    path: "/ai/commercial-proposals/:id/decision",
    shape: "item",
    description:
      "approve aplica o efeito no CRM (etapa, tarefa ou retorno) atomicamente; apply_effect false aprova sem efeito. Revise e confirme com o usuário. seq é o lock: 409 proposal_changed exige reler. Repetir a mesma decisão devolve replayed:true sem reaplicar.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      decision: {
        type: "approve|dismiss",
        optional: false,
      },
      seq: {
        type: "number",
        optional: false,
      },
      note: {
        type: "string",
        optional: true,
      },
      apply_effect: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "jobs",
    method: "GET",
    path: "/ai/commercial-proposals/jobs",
    shape: "item",
    description: "Últimas 50 gerações de proposta comercial e seus erros.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "settings",
    method: "GET",
    path: "/ai/commercial-proposals/settings",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "commercialProposals",
    name: "saveSettings",
    method: "PATCH",
    path: "/ai/commercial-proposals/settings",
    shape: "item",
    description:
      "Liga/desliga a geração automática de propostas comerciais. CAS numérico.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      enabled: {
        type: "boolean",
        optional: false,
      },
      expected_revision: {
        type: "number",
        optional: false,
      },
    },
  },
  {
    group: "eligibility",
    name: "get",
    method: "GET",
    path: "/ai/eligibility",
    shape: "item",
    description: "Controle de acesso da IA: configurações e gate de cada canal.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "eligibility",
    name: "saveSettings",
    method: "PUT",
    path: "/ai/eligibility/settings",
    shape: "item",
    description:
      "Validade e origens de autorização. assignment_blocks_ai omitido preserva; false reduz a proteção e exige confirmação do usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revisionZero",
        optional: false,
      },
      authorization_ttl_days: {
        type: "number",
        optional: false,
      },
      authorize_broadcast_replies: {
        type: "boolean",
        optional: false,
      },
      authorize_automation_replies: {
        type: "boolean",
        optional: false,
      },
      assignment_blocks_ai: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "eligibility",
    name: "channel",
    method: "GET",
    path: "/ai/eligibility/channels/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "eligibility",
    name: "saveChannel",
    method: "PUT",
    path: "/ai/eligibility/channels/:id",
    shape: "item",
    description:
      "Substitui modo e a lista inteira de telefones de teste (CAS). Mudar para open libera a IA para qualquer contato: só com confirmação explícita do usuário e confirm_open_to_all:true (senão open_confirmation_required).",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revisionZero",
        optional: false,
      },
      mode: {
        type: "open|allowlist|pre_go_live",
        optional: false,
      },
      test_phone_numbers: {
        type: "testPhones",
        optional: false,
      },
      confirm_open_to_all: {
        type: "boolean",
        optional: true,
      },
    },
  },
  {
    group: "eligibility",
    name: "authorizations",
    method: "GET",
    path: "/ai/eligibility/authorizations",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      channel_account_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "active|all",
        optional: true,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "eligibility",
    name: "revokeAuthorization",
    method: "POST",
    path: "/ai/eligibility/authorizations/:id/revoke",
    shape: "empty",
    description:
      "Revoga já: resposta ainda não admitida para envio não sai. Confirme com o usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "inferences",
    name: "list",
    method: "GET",
    path: "/ai/inferences",
    shape: "offset",
    description:
      "Cada chamada de modelo do ledger BYOK (padrão: últimos 7 dias; até 366). meta.summary agrega falhas e pontos do período filtrado.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      page: {
        type: "number",
        optional: true,
      },
      per_page: {
        type: "number",
        optional: true,
      },
      from: {
        type: "datetime",
        optional: true,
      },
      to: {
        type: "datetime",
        optional: true,
      },
      purpose: {
        type: "purpose",
        optional: true,
      },
      point: {
        type: "inferencePoint",
        optional: true,
      },
      outcome: {
        type: "ok|failed|unknown|in_progress",
        optional: true,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "searchDiagnostics",
    method: "POST",
    path: "/ai/knowledge/search/diagnostics",
    shape: "item",
    scope: "agents:read",
    description:
      "Mesma busca de search mais diagnóstico: motivo, melhor trecho abaixo do limiar e estado das fontes. Pode chamar embeddings BYOK.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      source_ids: {
        type: "uuids",
        optional: false,
      },
      query: {
        type: "string",
        optional: false,
      },
      top_k: {
        type: "number",
        optional: true,
      },
      threshold: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "catalogItems",
    method: "GET",
    path: "/ai/knowledge/:id/catalog",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "knowledge",
    name: "syncCatalog",
    method: "POST",
    path: "/ai/knowledge/:id/catalog",
    shape: "item",
    description:
      "Sincronização incremental de fonte de produtos: upserts/removals por item, até 1.000. event_key é idempotente: repita o mesmo corpo com a mesma chave (replayed:true não reaplica).",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      event_key: {
        type: "eventKey",
        optional: false,
      },
      integration: {
        type: "integration",
        optional: true,
      },
      upserts: {
        type: "catalogUpserts",
        optional: true,
      },
      removals: {
        type: "catalogRemovals",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "citations",
    method: "GET",
    path: "/ai/knowledge/citations",
    shape: "item",
    description:
      "Fontes por trás das respostas da IA; dado interno da equipe, nunca enviado ao contato. Informe exatamente um: execution_id ou conversation_id.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      execution_id: {
        type: "uuid",
        optional: true,
      },
      conversation_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "knowledge",
    name: "coverage",
    method: "POST",
    path: "/ai/knowledge/coverage",
    shape: "item",
    scope: "agents:read",
    description:
      "Diagnóstico de prontidão das fontes, skills e etapas do funil selecionadas para um agente. Não altera nada.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      knowledge_source_ids: {
        type: "uuidList",
        optional: true,
      },
      skill_ids: {
        type: "uuidList",
        optional: true,
      },
      allowed_stage_ids: {
        type: "uuidList",
        optional: true,
      },
      tool_ids: {
        type: "toolIdList",
        optional: true,
      },
    },
  },
  {
    group: "memory",
    name: "entryEvents",
    method: "GET",
    path: "/ai/memory/entries/:id/events",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "memory",
    name: "reactivateEntry",
    method: "POST",
    path: "/ai/memory/entries/:id/reactivate",
    shape: "item",
    description:
      "Devolve memória arquivada ao contexto dos agentes. É nova aprovação: chave criada por owner/admin atual; confirme com o usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revisionZero",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "diagnostics",
    method: "GET",
    path: "/ai/notices/diagnostics",
    shape: "item",
    description:
      "Checagens dos avisos da equipe (destino, canal, conexão, template); não envia mensagem.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "notices",
    name: "effect",
    method: "GET",
    path: "/ai/notices/effect",
    shape: "item",
    description:
      "Efeito dos avisos no tempo de resposta da equipe (1–90 dias, padrão 30).",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      days: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "operator",
    name: "metrics",
    method: "GET",
    path: "/ai/operator-metrics",
    shape: "item",
    description:
      "Promessas por agente: responsáveis, sem dono e correções (1–90 dias, padrão 30).",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      days: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "operator",
    name: "promises",
    method: "GET",
    path: "/ai/promises",
    shape: "item",
    description:
      "Promessas declaradas e responsáveis. Somente leitura; correções são feitas por uma pessoa no painel.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "pending|owned|unowned|dismissed",
        optional: true,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "providers",
    name: "catalog",
    method: "GET",
    path: "/ai/providers/catalog",
    shape: "item",
    description:
      "Último snapshot do catálogo de cada credencial; nunca contém chaves.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "providers",
    name: "syncCatalog",
    method: "POST",
    path: "/ai/providers/catalog",
    shape: "item",
    description:
      "Consulta o catálogo do provedor com a chave própria na revisão informada e grava snapshot. Nunca altera tarifas: preços são sugestões. 502 provider_* quando o provedor falha, sem alteração.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      credential_id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revision",
        optional: false,
      },
    },
  },
  {
    group: "skills",
    name: "nearMisses",
    method: "GET",
    path: "/ai/skills/near-misses",
    shape: "item",
    description:
      "Quase acionamentos por palavra de sondagem, para curadoria humana.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      status: {
        type: "pending|accepted|ignored",
        optional: true,
      },
      skill_id: {
        type: "uuid",
        optional: true,
      },
    },
  },
  {
    group: "skills",
    name: "decideNearMiss",
    method: "POST",
    path: "/ai/skills/near-misses/:id",
    shape: "item",
    description:
      "Curadoria humana: accept cria nova versão da skill com phrase (exige skill_revision; CAS); ignore encerra. Confirme com o usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      expected_revision: {
        type: "revisionZero",
        optional: false,
      },
      decision: {
        type: "accept|ignore",
        optional: false,
      },
      phrase: {
        type: "string",
        optional: true,
      },
      skill_revision: {
        type: "revisionZero",
        optional: true,
      },
    },
  },
  {
    group: "skills",
    name: "composition",
    method: "GET",
    path: "/ai/skills/composition",
    shape: "item",
    description:
      "Skills da plataforma e se uma cópia ou skill homônima do Cliente as substitui.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  // #498 follow-ups: promised returns and unified queue.
  {
    group: "followups",
    name: "queue",
    method: "GET",
    path: "/ai/followups/queue",
    shape: "item",
    description:
      "Fila unificada de inscrições em fluxos e retornos avulsos. Pagine com cursor = next_cursor (null encerra); limit 1–100, padrão 30.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      kind: {
        type: "enrollment|promise",
        optional: true,
      },
      flow_id: {
        type: "uuid",
        optional: true,
      },
      status: {
        type: "queueStatus",
        optional: true,
      },
      q: {
        type: "queueSearch",
        optional: true,
      },
      contact_id: {
        type: "uuid",
        optional: true,
      },
      cursor: {
        type: "queueCursor",
        optional: true,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "promises",
    method: "GET",
    path: "/ai/followups/promises",
    shape: "item",
    description:
      "Retornos avulsos (mesma fila, kind promise). Pagine com cursor = next_cursor.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      status: {
        type: "queueStatus",
        optional: true,
      },
      q: {
        type: "queueSearch",
        optional: true,
      },
      contact_id: {
        type: "uuid",
        optional: true,
      },
      cursor: {
        type: "queueCursor",
        optional: true,
      },
      limit: {
        type: "number",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "schedulePromise",
    method: "POST",
    path: "/ai/followups/promises",
    shape: "item",
    description:
      "Marca retorno avulso: no horário (ajustado à janela do agente) o agente reabre a conversa e pode enviar mensagem. Um pendente por contato. Preserve operation_key UUID: repetir devolve o mesmo retorno. outside_window template envia template fora da janela; confirme com o usuário.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      contact_id: {
        type: "uuid",
        optional: false,
      },
      conversation_id: {
        type: "uuid",
        optional: false,
      },
      agent_id: {
        type: "uuid",
        optional: false,
      },
      operation_key: {
        type: "uuid",
        optional: false,
      },
      reason: {
        type: "string",
        optional: false,
      },
      promise: {
        type: "string",
        optional: false,
      },
      context_snapshot: {
        type: "string",
        optional: true,
      },
      promised_at: {
        type: "datetime",
        optional: false,
      },
      outside_window: {
        type: "alert|template",
        optional: true,
      },
      template_id: {
        type: "uuid",
        optional: true,
      },
      template_variables: {
        type: "templateVariables",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "getPromise",
    method: "GET",
    path: "/ai/followups/promises/:id",
    shape: "item",
    description: "",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
    },
  },
  {
    group: "followups",
    name: "cancelPromise",
    method: "POST",
    path: "/ai/followups/promises/:id/cancel",
    shape: "item",
    description:
      "Desmarca retorno ainda não disparado; disparado ou já cancelado responde 409.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      reason: {
        type: "string",
        optional: true,
      },
    },
  },
  {
    group: "followups",
    name: "resolvePromise",
    method: "POST",
    path: "/ai/followups/promises/:id/resolve",
    shape: "item",
    description:
      "Concilia template de retorno com resultado incerto, com evidência (note); nunca reenvia. sent pode incluir wamid.",
    fields: {
      customer_id: {
        type: "uuid",
        optional: false,
      },
      id: {
        type: "uuid",
        optional: false,
      },
      outcome: {
        type: "sent|rejected",
        optional: false,
      },
      note: {
        type: "evidence",
        optional: false,
      },
      wamid: {
        type: "string",
        optional: true,
      },
    },
  },
];
