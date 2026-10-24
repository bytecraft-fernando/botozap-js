import type { BotoZap } from "../client.js";
import type { CursorList, OffsetList, OffsetParams, PhoneNumber } from "../types.js";

export interface ListPhoneNumbersParams extends OffsetParams {
  customer_id?: string;
}

/** Corpo de `PATCH /v1/phone_numbers/:id`. */
export interface UpdatePhoneNumberParams {
  /**
   * Nome local do Número: até 100 caracteres após aparar, sem quebras de
   * linha nem caracteres de controle. `null` ou `""` limpa.
   */
  label: string | null;
}


/**
 * Categoria do negócio no perfil do WhatsApp (`vertical`, enum da Meta).
 * Valor fora do enum documentado vem como `null` na leitura.
 */
export type WhatsAppBusinessVertical =
  | "AUTO"
  | "ALCOHOL"
  | "BEAUTY"
  | "RESTAURANT"
  | "ONLINE_GAMBLING"
  | "PHYSICAL_GAMBLING"
  | "EDU"
  | "ENTERTAIN"
  | "EVENT_PLAN"
  | "FINANCE"
  | "GOVT"
  | "HOTEL"
  | "NONPROFIT"
  | "OTC_DRUGS"
  | "GROCERY"
  | "HEALTH"
  | "PROF_SERVICES"
  | "RETAIL"
  | "APPAREL"
  | "TRAVEL"
  | "OTHER";

/** Perfil do WhatsApp do número, lido na Meta a cada chamada (`GET …/profile`). */
export interface WhatsAppBusinessProfile {
  /** "Sobre" (1 a 139 caracteres). */
  about: string | null;
  address: string | null;
  description: string | null;
  email: string | null;
  websites: string[];
  vertical: WhatsAppBusinessVertical | null;
  /** URL temporária da foto no CDN da Meta. */
  profile_picture_url: string | null;
  /**
   * `false` em coexistência (número também no app WhatsApp Business do
   * celular): a Meta não aceita mudar o perfil pela API; edite pelo app.
   */
  editable: boolean;
}

/**
 * Corpo de `phoneNumbers.updateProfile`. Campo omitido mantém; string vazia
 * limpa (menos `about`, que precisa de 1 a 139 caracteres). Ao menos um campo.
 */
export interface UpdateWhatsAppProfileParams {
  /** "Sobre": 1 a 139 caracteres. */
  about?: string;
  /** Até 256 caracteres. */
  address?: string;
  /** Até 512 caracteres. */
  description?: string;
  /** E-mail válido, até 128 caracteres. */
  email?: string;
  /** Até 2 sites, cada um com `http://` ou `https://` e até 256 caracteres. */
  websites?: string[];
  vertical?: WhatsAppBusinessVertical;
}

/** Foto do perfil para `phoneNumbers.uploadProfilePhoto` (JPG ou PNG, até 4 MB). */
export interface UploadProfilePhotoParams {
  /** Conteúdo da foto. */
  file: Blob;
  /** Nome do arquivo enviado no multipart (padrão: `foto.jpg` ou `foto.png`). */
  file_name?: string;
  /** Tipo da foto quando o `Blob` não traz (`image/jpeg` ou `image/png`). */
  mime_type?: "image/jpeg" | "image/png";
}

/** Comando que o contato vê ao digitar `/` na conversa. */
export interface ConversationalCommand {
  /** Uma palavra, sem espaço nem emoji, até 32 caracteres (a `/` inicial é tirada). */
  command_name: string;
  /** O que o comando faz: até 256 caracteres, sem emoji. */
  command_description: string;
}

/** Perguntas prontas (ice breakers) e comandos do número, lidos na Meta. */
export interface ConversationalAutomation {
  /** Até 4 perguntas de até 80 caracteres, sem emoji. */
  prompts: string[];
  /** Até 30 comandos. */
  commands: ConversationalCommand[];
}

/**
 * Corpo de `phoneNumbers.updateConversationalAutomation`. Campo omitido mantém
 * o que está na Meta; lista vazia remove. Ao menos um dos dois.
 */
export interface UpdateConversationalAutomationParams {
  prompts?: string[];
  commands?: ConversationalCommand[];
}

/** Formato da imagem do QR code. */
export type QrImageFormat = "PNG" | "SVG";

/** QR code com mensagem pronta e link curto do número. */
export interface WhatsAppQrCode {
  /** Código da Meta (ex.: `4O4YGZEG3RIVE1`). */
  code: string;
  /** Mensagem que já vem escrita ao abrir a conversa (até 140 caracteres). */
  prefilled_message: string;
  /** Link curto `https://wa.me/message/…`. */
  deep_link_url: string;
  /** URL temporária da imagem no CDN da Meta (em `get` e `create`): baixe na hora. */
  qr_image_url?: string;
}

/** Corpo de `phoneNumbers.qrCodes.create`. */
export interface CreateQrCodeParams {
  /** Até 140 caracteres. */
  prefilled_message: string;
  /** `PNG` (padrão) ou `SVG`. */
  image_format?: QrImageFormat;
}

/** Contato bloqueado no número. */
export interface BlockedUser {
  wa_id: string;
  /** Contato da Conta com esse `wa_id`, quando há. */
  contact_id: string | null;
  name: string | null;
}

/** Corpo de `phoneNumbers.blockedUsers.block`: exatamente um dos dois. */
export type BlockUserParams =
  | { contact_id: string; user?: never }
  | { user: string; contact_id?: never };

/** Resposta de `phoneNumbers.blockedUsers.block`. */
export interface BlockUserResult {
  blocked: true;
  wa_id: string | null;
  contact_id: string | null;
}

/** Resposta de `phoneNumbers.blockedUsers.unblock`. */
export interface UnblockUserResult {
  blocked: false;
  wa_id: string | null;
}

/**
 * Estado da importação das conversas antigas do app WhatsApp Business
 * (coexistência). `awaiting_choice`: esperando a escolha; `queued`: janela
 * fixada, o pedido à Meta ainda não saiu; os demais são o desfecho do pedido
 * (`skipped` quando a escolha foi 0 dias).
 */
export type HistoryImportStatus =
  | "awaiting_choice"
  | "queued"
  | "requested"
  | "declined"
  | "failed"
  | "expired"
  | "unconfirmed"
  | "skipped";

/** Janela de conversas antigas a importar, em dias (0 = não importar). */
export type HistoryImportWindowDays = 0 | 30 | 180;

/** Importação das conversas antigas do número (`GET|PUT …/history-import`). */
export interface HistoryImport {
  /** UUID interno do número. */
  phone_id: string;
  status: HistoryImportStatus;
  /** Janela fixada; `null` enquanto ninguém escolheu. */
  window_days: HistoryImportWindowDays | null;
  /** `customer` (escolhida por alguém) ou `default` (aplicada sozinha); `null` sem janela. */
  window_source: "customer" | "default" | null;
  window_set_at: string | null;
  /** A escolha ainda é aceita (`status` = `awaiting_choice` e dentro do prazo). */
  can_choose: boolean;
  /** Janela aplicada se ninguém escolher (hoje, 30). */
  default_window_days: HistoryImportWindowDays;
  /** Quando a janela padrão é aplicada sem escolha (20 h depois da conexão). */
  default_at: string;
  /** Fim do prazo da Meta para pedir o histórico (24 h depois da conexão). */
  deadline_at: string;
  /** Quando o número foi conectado. */
  onboarded_at: string;
}

/** Corpo de `phoneNumbers.setHistoryImport`. */
export interface SetHistoryImportParams {
  /** 0 (não importar), 30 ou 180 dias. */
  window_days: HistoryImportWindowDays;
}

/**
 * QR codes com mensagem pronta e link curto do número
 * (`/v1/phone_numbers/{id}/qr-codes`). `{id}` aceita o UUID interno ou o
 * `phone_number_id` da Meta. Lido e gravado direto na Meta.
 */
export class PhoneNumberQrCodes {
  constructor(private readonly client: BotoZap) {}

  /** Lista os QR codes do número (sem a imagem; use `get`). Scope `numbers:read`. */
  list(id: string): Promise<WhatsAppQrCode[]> {
    return this.client.requestItem<WhatsAppQrCode[]>("GET", `/phone_numbers/${enc(id)}/qr-codes`);
  }

  /**
   * Cria um QR code com mensagem pronta (até 140 caracteres) e devolve
   * `qr_image_url` (201). NÃO é idempotente: em 504 `meta_unconfirmed`, liste
   * antes de criar de novo para não duplicar. Scope `numbers:write`.
   */
  create(id: string, params: CreateQrCodeParams): Promise<WhatsAppQrCode> {
    return this.client.requestItem<WhatsAppQrCode>("POST", `/phone_numbers/${enc(id)}/qr-codes`, {
      body: params,
    });
  }

  /**
   * Um QR code com `qr_image_url` no formato pedido (`PNG` padrão, ou `SVG`).
   * A URL é temporária, do CDN da Meta: baixe na hora. Scope `numbers:read`.
   */
  get(id: string, code: string, params: { image_format?: QrImageFormat } = {}): Promise<WhatsAppQrCode> {
    return this.client.requestItem<WhatsAppQrCode>(
      "GET",
      `/phone_numbers/${enc(id)}/qr-codes/${enc(code)}`,
      { query: { image_format: params.image_format } },
    );
  }

  /** Troca a mensagem pronta; código, link e imagem continuam os mesmos. Scope `numbers:write`. */
  update(id: string, code: string, params: { prefilled_message: string }): Promise<WhatsAppQrCode> {
    return this.client.requestItem<WhatsAppQrCode>(
      "PATCH",
      `/phone_numbers/${enc(id)}/qr-codes/${enc(code)}`,
      { body: { prefilled_message: params.prefilled_message } },
    );
  }

  /**
   * Apaga o QR code na Meta, SEM VOLTA: quem escanear o código impresso ou
   * abrir o link passa a ver "expirado". Responde 204. No acesso por OAuth, só
   * Administrador. Scope `numbers:write`.
   */
  delete(id: string, code: string): Promise<void> {
    return this.client.request<void>("DELETE", `/phone_numbers/${enc(id)}/qr-codes/${enc(code)}`);
  }
}

/** Contatos bloqueados no número (`/v1/phone_numbers/{id}/blocked-users`), direto na Meta. */
export class PhoneNumberBlockedUsers {
  constructor(private readonly client: BotoZap) {}

  /**
   * Bloqueados do número, 100 por página. A próxima página vem em
   * `paging.cursors.after` (passe em `after`); `null` quando acabou. Quando o
   * `wa_id` é de um contato da Conta, vêm `contact_id` e `name`. Scope
   * `numbers:read`.
   */
  list(id: string, params: { after?: string } = {}): Promise<CursorList<BlockedUser>> {
    return this.client.requestCursorList<CursorList<BlockedUser>>(
      "GET",
      `/phone_numbers/${enc(id)}/blocked-users`,
      { query: { after: params.after } },
    );
  }

  /**
   * Bloqueia um contato no número, por `contact_id` (contato da Conta neste
   * número) ou `user` (telefone com DDI). Contato bloqueado não manda mensagem
   * nem liga, e o número não envia nada para ele. Regra da Meta: só quem
   * escreveu nas últimas 24 h (senão 422 `block_window_closed`). Outros:
   * `cannot_block_self`, `blocklist_full` (409), `contact_other_number`,
   * `channel_not_supported` (contato do Instagram). Scope `numbers:write`.
   */
  block(id: string, params: BlockUserParams): Promise<BlockUserResult> {
    return this.client.requestItem<BlockUserResult>("POST", `/phone_numbers/${enc(id)}/blocked-users`, {
      body: params,
    });
  }

  /**
   * Desbloqueia pelo `wa_id` da lista (ou telefone com DDI). Para bloquear de
   * novo, o contato precisa ter escrito nas últimas 24 h. Scope `numbers:write`.
   */
  unblock(id: string, user: string): Promise<UnblockUserResult> {
    return this.client.requestItem<UnblockUserResult>(
      "DELETE",
      `/phone_numbers/${enc(id)}/blocked-users/${enc(user)}`,
    );
  }
}

/** Números conectados de cada cliente. */
export class PhoneNumbers {
  /** QR codes com mensagem pronta e link curto `wa.me/message`. */
  readonly qrCodes: PhoneNumberQrCodes;
  /** Contatos bloqueados no número. */
  readonly blockedUsers: PhoneNumberBlockedUsers;

  constructor(private readonly client: BotoZap) {
    this.qrCodes = new PhoneNumberQrCodes(client);
    this.blockedUsers = new PhoneNumberBlockedUsers(client);
  }

  /** Lista os números da conta (paginação por offset/página). */
  list(params: ListPhoneNumbersParams = {}): Promise<OffsetList<PhoneNumber>> {
    return this.client.requestOffsetList<OffsetList<PhoneNumber>>(
      "GET",
      "/phone_numbers",
      {
        query: {
          page: params.page,
          per_page: params.per_page,
          customer_id: params.customer_id,
        },
      },
    );
  }

  get(id: string): Promise<PhoneNumber> {
    return this.client.requestItem<PhoneNumber>(
      "GET",
      `/phone_numbers/${enc(id)}`,
    );
  }

  /**
   * Atualiza o nome local (`label`) do Número. É o único campo editável:
   * identidade e dados sincronizados da Meta (`display_phone_number`,
   * `verified_name`, `quality_rating`) não mudam por aqui. `{id}` aceita o
   * UUID interno ou o `phone_number_id` da Meta.
   */
  update(id: string, params: UpdatePhoneNumberParams): Promise<PhoneNumber> {
    return this.client.requestItem<PhoneNumber>(
      "PATCH",
      `/phone_numbers/${enc(id)}`,
      { body: { label: params.label } },
    );
  }

  /** Remove um número. Responde 204 (sem corpo). */
  delete(id: string): Promise<void> {
    return this.client.request<void>("DELETE", `/phone_numbers/${enc(id)}`);
  }

  /**
   * Perfil do WhatsApp do número, lido na Meta: Sobre, descrição, endereço,
   * e-mail, sites, categoria e foto. `editable: false` em coexistência.
   * Recusas comuns às configurações do número: `sandbox_not_supported`,
   * `connection_inactive`, `reconnect_required` (409), `meta_rate_limited`
   * (429), `meta_permission_denied` (403), `meta_unavailable` (504) e
   * `meta_error` (502). Scope `numbers:read`.
   */
  getProfile(id: string): Promise<WhatsAppBusinessProfile> {
    return this.client.requestItem<WhatsAppBusinessProfile>("GET", `/phone_numbers/${enc(id)}/profile`);
  }

  /**
   * Muda campos do perfil na Meta e devolve o perfil relido. É o contato
   * público do negócio: mude só a pedido de quem opera. Coexistência responde
   * 409 `coexistence_not_supported`. Pelo acesso OAuth (apps conectados), a
   * API responde 403: só painel e chave de API mudam o perfil. Em 502
   * `saved_unread` a Meta recebeu e a releitura falhou: confira com
   * `getProfile` antes de repetir. Scope `numbers:write`.
   */
  updateProfile(id: string, params: UpdateWhatsAppProfileParams): Promise<WhatsAppBusinessProfile> {
    return this.client.requestItem<WhatsAppBusinessProfile>("PATCH", `/phone_numbers/${enc(id)}/profile`, {
      body: params,
    });
  }

  /**
   * Troca a foto do perfil (`multipart/form-data`, campo `file`; JPG ou PNG
   * até 4 MB) e devolve o perfil relido. Mesmas regras de `updateProfile`
   * (coexistência 409, OAuth 403). Recusas da foto: `invalid_picture` (422),
   * `too_large` (413), `missing_file` (422). Scope `numbers:write`.
   */
  uploadProfilePhoto(id: string, params: UploadProfilePhotoParams): Promise<WhatsAppBusinessProfile> {
    const type = params.mime_type ?? params.file.type;
    const file = params.mime_type && params.file.type !== params.mime_type
      ? new Blob([params.file], { type: params.mime_type })
      : params.file;
    const form = new FormData();
    form.append("file", file, params.file_name ?? (type === "image/png" ? "foto.png" : "foto.jpg"));
    return this.client.requestItem<WhatsAppBusinessProfile>("POST", `/phone_numbers/${enc(id)}/profile/photo`, {
      body: form,
    });
  }

  /**
   * Perguntas prontas (`prompts`, ice breakers) e comandos (`commands`) do
   * número, lidos na Meta. Scope `numbers:read`.
   */
  getConversationalAutomation(id: string): Promise<ConversationalAutomation> {
    return this.client.requestItem<ConversationalAutomation>(
      "GET",
      `/phone_numbers/${enc(id)}/conversational-automation`,
    );
  }

  /**
   * Grava perguntas prontas e/ou comandos na Meta e devolve o que ficou. Campo
   * omitido mantém; lista vazia remove. Gravar conteúdo exige plano com
   * automações (403 `plan_restricted`); só remover é livre. Tocar numa
   * pergunta ou mandar um comando chega como mensagem de texto comum. Scope
   * `numbers:write`.
   */
  updateConversationalAutomation(
    id: string,
    params: UpdateConversationalAutomationParams,
  ): Promise<ConversationalAutomation> {
    return this.client.requestItem<ConversationalAutomation>(
      "PATCH",
      `/phone_numbers/${enc(id)}/conversational-automation`,
      { body: params },
    );
  }

  /** Remove todas as perguntas prontas e comandos do número (livre em qualquer plano). Scope `numbers:write`. */
  clearConversationalAutomation(id: string): Promise<ConversationalAutomation> {
    return this.client.requestItem<ConversationalAutomation>(
      "DELETE",
      `/phone_numbers/${enc(id)}/conversational-automation`,
    );
  }

  /**
   * Quanto das conversas antigas do app WhatsApp Business o número importa
   * (coexistência): estado, janela escolhida e até quando dá para escolher.
   * Número sem importação (não está em coexistência, ou foi conectado antes
   * deste recurso) responde 404 `history_import_not_available`. Scope `numbers:read`.
   */
  getHistoryImport(id: string): Promise<HistoryImport> {
    return this.client.requestItem<HistoryImport>("GET", `/phone_numbers/${enc(id)}/history-import`);
  }

  /**
   * Escolhe quanto importar: `window_days` 0 (nada), 30 ou 180. Vale uma vez
   * por conexão, enquanto `can_choose`; repetir a mesma escolha devolve 200,
   * outra escolha depois responde 409 `history_import_locked`. Sem escolha,
   * o último mês vale 20 h depois da conexão. Scope `numbers:write`.
   */
  setHistoryImport(id: string, params: SetHistoryImportParams): Promise<HistoryImport> {
    return this.client.requestItem<HistoryImport>("PUT", `/phone_numbers/${enc(id)}/history-import`, {
      body: { window_days: params.window_days },
    });
  }

  /** Saúde do número (qualidade, limite, status na Meta). */
  health(id: string): Promise<Record<string, unknown>> {
    return this.client.requestItem<Record<string, unknown>>(
      "GET",
      `/phone_numbers/${enc(id)}/health`,
    );
  }
}

function enc(id: string): string {
  return encodeURIComponent(id);
}
