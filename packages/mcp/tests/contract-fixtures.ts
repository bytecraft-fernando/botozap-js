export const MESSAGE_ID = "10000000-0000-4000-8000-000000000001";
export const PHONE_ID = "20000000-0000-4000-8000-000000000001";
export const TEMPLATE_ID = "30000000-0000-4000-8000-000000000001";
export const CONVERSATION_ID = "40000000-0000-4000-8000-000000000001";
export const CONTACT_ID = "50000000-0000-4000-8000-000000000001";
export const CONNECTION_ID = "60000000-0000-4000-8000-000000000001";
export const CUSTOMER_ID = "70000000-0000-4000-8000-000000000001";

export const messageFixture = {
  id: MESSAGE_ID,
  wamid: "wamid.ABC",
  conversation_id: CONVERSATION_ID,
  phone_number_id: PHONE_ID,
  contact_id: CONTACT_ID,
  direction: "outbound",
  type: "text",
  status: "sent",
  source: "api",
  content: { body: "olá" },
  context: null,
  error: null,
  has_media: false,
  revoked_at: null,
  event_at: "2026-08-25T12:00:00.000Z",
  wa_timestamp: null,
  created_at: "2026-08-25T12:00:00.000Z",
};

export const cursorPagingFixture = {
  cursors: { before: null, after: null },
  next: null,
  previous: null,
};

export const offsetMetaFixture = {
  page: 1,
  per_page: 20,
  total_pages: 1,
  total_count: 1,
};
