export { BotoZap } from "./client.js";
export type { BotoZapOptions, RequestOptions } from "./client.js";
export {
  BotoZapError,
  PLAN_ERROR_CODES,
  isPlanError,
  isBusinessPaymentRequired,
  isFreeCap,
  isFreeNumberCap,
  isConsentOptedOut,
  isConsentRevoked,
  isNotConnected,
} from "./errors.js";
export type { SendFailureDetails, BotoZapErrorCode } from "./errors.js";
export { WEBHOOK_CATEGORIES } from "./types.js";
export type { Me } from "./resources/me.js";

export type {
  SendOptions,
  SendTextParams,
  SendTemplateParams,
  SendImageParams,
  SendVideoParams,
  SendAudioParams,
  SendDocumentParams,
  SendMediaParams,
  SendInteractiveParams,
  InteractivePayload,
  InteractiveButtonPayload,
  InteractiveListPayload,
  InteractiveCtaUrlPayload,
  InteractiveHeader,
  InstagramInteractiveButton,
  InstagramInteractiveButtonPayload,
  InstagramGenericElement,
  InstagramInteractiveGenericPayload,
  InstagramInteractivePayload,
  SendLocationParams,
  SendReactionParams,
  MessageSort,
  ListMessagesParams,
} from "./resources/messages.js";
export type {
  CreateCustomerParams,
  UpdateCustomerParams,
  CreateSetupLinkParams,
  UpdateSetupLinkParams,
} from "./resources/customers.js";
export type {
  Template,
  ListTemplatesParams,
  CreateTemplateParams,
  UpdateTemplateParams,
} from "./resources/templates.js";
export type {
  ListBroadcastsParams,
  CreateBroadcastParams,
  UpdateBroadcastParams,
  ScheduleBroadcastParams,
  ListRecipientsParams,
  AddRecipientsResult,
  AddRecipientsError,
  BroadcastRecipientInput,
} from "./resources/broadcasts.js";
export type {
  ListContactsParams,
  CreateContactParams,
  UpdateContactParams,
  InitialConsent,
  RecordConsentParams,
} from "./resources/contacts.js";
export type {
  ListConversationsParams,
  CreateAssignmentParams,
  ReplyConversationParams,
  RequestConsentParams,
  ConversationTypingResult,
  ConversationReadResult,
} from "./resources/conversations.js";
export type {
  CreateWebhookParams,
  UpdateWebhookParams,
  WebhookAuthorizationHeaders,
} from "./resources/webhooks.js";
export type {
  ListPhoneNumbersParams,
  UpdatePhoneNumberParams,
  WhatsAppBusinessVertical,
  WhatsAppBusinessProfile,
  UpdateWhatsAppProfileParams,
  UploadProfilePhotoParams,
  ConversationalCommand,
  ConversationalAutomation,
  UpdateConversationalAutomationParams,
  QrImageFormat,
  WhatsAppQrCode,
  CreateQrCodeParams,
  BlockedUser,
  BlockUserParams,
  BlockUserResult,
  UnblockUserResult,
  PhoneNumberQrCodes,
  PhoneNumberBlockedUsers,
  HistoryImport,
  HistoryImportStatus,
  HistoryImportWindowDays,
  SetHistoryImportParams,
} from "./resources/phone-numbers.js";
export type { UploadMediaParams } from "./resources/media.js";
export type { ListEventsParams } from "./resources/events.js";
export type {
  MetaCostsParams,
  MetaCostSource,
  MetaCostUnavailableReason,
  MetaCostGroup,
  MetaCostDay,
  MetaCostCategory,
  MetaCostEstimate,
  MetaCostSync,
  MetaCostReport,
} from "./resources/usage.js";
export type {
  Billing,
  BillingGuarantee,
  BillingPlan,
  BusinessSlot,
  CreateBusinessSlotOptions,
} from "./resources/billing.js";
export type {
  AccountExport,
  CreateExportParams,
  ExportDownload,
  ExportFormat,
  ExportScope,
  ExportStatus,
} from "./resources/exports.js";
export type {
  ListTeamEventsParams,
  TeamEvent,
  TeamEventActor,
  TeamEventTarget,
} from "./resources/team-events.js";
export type {
  ListApiLogsParams,
  ListWebhookDeliveriesParams,
  WebhookDeliveryReplay,
} from "./resources/read-only.js";

export type {
  MessageStatus,
  MessageChannel,
  SendResult,
  QuickReply,
  TemplatePayload,
  CursorPaging,
  OffsetMeta,
  CursorList,
  OffsetList,
  CursorParams,
  OffsetParams,
  Customer,
  CustomerBusinessSlot,
  ConnectionBilling,
  ConnectionBillingOutcome,
  ConnectionBillingRefusal,
  Message,
  MessageReplyTo,
  ReplyToParam,
  MessageContent,
  MessageEdit,
  Broadcast,
  BroadcastRecipient,
  Contact,
  ContactConsents,
  ContactWarning,
  Consent,
  ConsentChannel,
  ConsentOrigin,
  ConsentPurpose,
  ConsentRequestResult,
  ConsentState,
  Conversation,
  ChannelAccountRef,
  ConversationEntryPoint,
  ConversationReferral,
  Assignment,
  Webhook,
  WebhookChannelHealth,
  WebhookChannelHealthStatus,
  PhoneNumber,
  User,
  ApiLog,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookCategory,
  MessageSource,
  SendReactionResult,
  MediaUploadResult,
  MediaAsset,
  SetupLink,
  BotoZapEvent,
  InstagramCommentAiAutomation,
  InstagramCommentAiRepliedEvent,
  EventPaging,
  EventList,
} from "./types.js";

export * from "./resources/channel-accounts.js";
export * from "./resources/saved-replies.js";
export * from "./resources/inbox.js";
export * from "./resources/crm.js";
export * from "./resources/journeys.js";
export * from "./resources/appointments.js";
export * from "./resources/contact-configuration.js";
export * from "./resources/calendar.js";
export * from "./resources/ai/index.js";
