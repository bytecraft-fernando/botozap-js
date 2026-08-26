function templateRequired() {
  return Object.assign(
    new Error("Configure BOTOZAP_FALLBACK_TEMPLATE para responder fora da janela."),
    { code: "template_required", status: 422 },
  );
}

export function createBotoZapMessenger({ boto, fallbackTemplate }) {
  async function sendTemplate({ to, from }) {
    if (!fallbackTemplate) throw templateRequired();
    const result = await boto.messages.sendTemplate({
      to,
      from,
      template: fallbackTemplate,
    });
    return { mode: "template", wamid: result.wamid };
  }

  return {
    async sendResponse({ to, from, text, freeformAllowed }) {
      if (!freeformAllowed) return sendTemplate({ to, from });

      try {
        const result = await boto.messages.send({ to, from, text });
        return { mode: "text", wamid: result.wamid };
      } catch (error) {
        // `outside_window` é uma recusa 4xx anterior ao envio: o servidor é a
        // autoridade, então o fallback não duplica uma mensagem aceita.
        if (
          error &&
          typeof error === "object" &&
          error.code === "outside_window" &&
          error.status === 422
        ) {
          return sendTemplate({ to, from });
        }
        throw error;
      }
    },
  };
}
