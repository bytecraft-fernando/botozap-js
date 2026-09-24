import type { AiAudioPricing } from "./types.js";
/** Validate at the shared boundary used by typed SDK, CLI and generic invoke. */
export function assertAudioPricing(
  value: unknown,
): asserts value is AiAudioPricing | null {
  if (value === null) return;
  const fail = () => {
    throw new Error(
      "audio_pricing inválido: informe tarifas de áudio e unidade compatíveis.",
    );
  };
  if (typeof value !== "object" || Array.isArray(value)) return fail();
  const row = value as Record<string, unknown>;
  const money = (v: unknown) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100000)
      return false;
    const [mantissa, exponent = "0"] = v.toString().toLowerCase().split("e");
    return (
      Math.max(0, (mantissa!.split(".")[1]?.length ?? 0) - Number(exponent)) <=
      8
    );
  };
  const limits = (v: unknown) =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100000000;
  const fields =
    row.unit === "tokens"
      ? [
          "unit",
          "input_audio_usd_per_million",
          "input_text_usd_per_million",
          "output_text_usd_per_million",
          "max_input_tokens",
          "max_output_tokens",
        ]
      : row.unit === "duration"
        ? ["unit", "usd_per_minute"]
        : [];
  if (
    !fields.length ||
    Object.keys(row).some((key) => !fields.includes(key)) ||
    fields.some((key) => !(key in row))
  )
    return fail();
  if (row.unit === "duration") {
    if (!money(row.usd_per_minute)) return fail();
  } else if (
    ![
      row.input_audio_usd_per_million,
      row.input_text_usd_per_million,
      row.output_text_usd_per_million,
    ].every(money) ||
    !limits(row.max_input_tokens) ||
    !limits(row.max_output_tokens)
  )
    return fail();
}
