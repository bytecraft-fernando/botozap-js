import type { BotoZap } from "../client.js";

/** Identidade e permissões efetivas da credencial autenticada. */
export interface Me {
  /** UUID da Conta derivado pela API a partir da chave autenticada. */
  account_id: string;
  /** Ambiente ao qual a chave pertence. */
  environment: "live" | "sandbox";
  /** Scopes efetivos concedidos à chave. */
  scopes: string[];
  /** Ausente em versões anteriores da API; OAuth exige todos os campos abaixo. */
  auth_type?: "api_key" | "oauth";
  user_id?: string;
  client_id?: string;
  grant_id?: string;
  /** Contratos de rota permitidos, por exemplo GET /v1/contacts/:id. */
  allowed_routes?: string[];
}

/** Introspecção da identidade da chave autenticada. */
export class MeResource {
  constructor(private readonly client: BotoZap) {}

  /** Retorna a Conta, o ambiente e os scopes efetivos da chave. */
  get(): Promise<Me> {
    return this.client.requestItem<Me>("GET", "/me");
  }
}
