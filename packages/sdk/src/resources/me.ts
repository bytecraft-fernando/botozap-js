import type { BotoZap } from "../client.js";

/** Identidade e permissões associadas à chave de API autenticada. */
export interface Me {
  /** UUID da Conta derivado pela API a partir da chave autenticada. */
  account_id: string;
  /** Ambiente ao qual a chave pertence. */
  environment: "live" | "sandbox";
  /** Scopes efetivos concedidos à chave. */
  scopes: string[];
}

/** Introspecção da identidade da chave autenticada. */
export class MeResource {
  constructor(private readonly client: BotoZap) {}

  /** Retorna a Conta, o ambiente e os scopes efetivos da chave. */
  get(): Promise<Me> {
    return this.client.requestItem<Me>("GET", "/me");
  }
}
