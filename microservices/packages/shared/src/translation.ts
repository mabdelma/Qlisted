import OpenAI from "openai";
import { createLogger } from "./logger.js";

/**
 * The language bridge, shared.
 *
 * A guest writes "sin cebolla, por favor" and the kitchen works in English; the
 * line cook should read "no onion, please" without anyone learning Spanish.
 *
 * This lives in `shared` rather than inside `orders` because the bridge is not
 * an ordering concern — reception and housekeeping requests need the same
 * treatment, and they belong to other services.
 *
 * Two rules shape everything here:
 *
 *  1. The original is never destroyed. Staff can always see what the guest
 *     actually wrote, because a mistranslated allergy note is dangerous.
 *  2. Translation is best-effort. An order must never fail, or be delayed past
 *     usefulness, because a translation provider was slow or unconfigured.
 *
 * Rule 2 is why callers should translate AFTER the order is committed and the
 * kitchen has been notified, not before: see translateOrderNotes in the orders
 * service. The monolith's version blocks the insert on the provider, which adds
 * the provider's latency to every order placed.
 */

const MODEL = process.env.OPENAI_TRANSLATE_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL;
const TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS) || 4000;

const log = createLogger("translation");

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  try {
    if (BASE_URL) return new OpenAI({ apiKey: key || "local", baseURL: BASE_URL });
    return key ? new OpenAI({ apiKey: key }) : null;
  } catch (err) {
    // `new OpenAI()` throws synchronously on a malformed baseURL. Swallowing it
    // here keeps construction inside the same best-effort contract as the call
    // itself — the monolith builds its client outside the try and lets that
    // rejection escape into the order path.
    log.warn({ err }, "translation client could not be constructed; disabled");
    return null;
  }
}

export function translationEnabled(): boolean {
  return !!(process.env.OPENAI_API_KEY || BASE_URL);
}

export interface Translated {
  /** Null when no translation happened — callers keep the original. */
  text: string | null;
  /** ISO-ish code the model detected, for showing "translated from …". */
  sourceLanguage: string | null;
}

const EMPTY: Translated = { text: null, sourceLanguage: null };

/**
 * Translate one short guest note into the venue's operating language.
 *
 * Returns EMPTY rather than throwing on every failure path: no key, no text, a
 * timeout, a malformed reply. The caller stores null and staff read the
 * original, which is the correct degradation.
 */
export async function translateNote(
  text: string | null | undefined,
  targetLanguage: string,
): Promise<Translated> {
  const note = (text || "").trim();
  if (!note) return EMPTY;

  const api = client();
  if (!api) return EMPTY;

  try {
    const resp = await api.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You translate short hospitality notes (food orders, allergies, housekeeping and front-desk requests) "
              + `into ${targetLanguage}. Reply with JSON only: {"language":"<ISO code of the INPUT>","text":"<translation>"}. `
              + "Preserve quantities, dish names and allergy wording exactly; never add, soften or interpret. "
              + "If the input is already in the target language, return it unchanged with its language code.",
          },
          { role: "user", content: note },
        ],
        response_format: { type: "json_object" },
      },
      // maxRetries: 0 is load-bearing. `timeout` is per ATTEMPT and the SDK
      // retries twice by default, so inheriting the default makes the real
      // worst case ~3x the timeout plus backoff.
      { timeout: TIMEOUT_MS, maxRetries: 0 },
    );

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { language?: unknown; text?: unknown };
    const out = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const lang = typeof parsed.language === "string" ? parsed.language.trim() : null;
    if (!out) return EMPTY;
    // Nothing gained by storing a copy of the original.
    if (out === note) return { text: null, sourceLanguage: lang };
    return { text: out, sourceLanguage: lang };
  } catch (err) {
    // Includes the timeout. The order has already reached the kitchen.
    log.warn({ err }, "note translation failed; keeping the original");
    return EMPTY;
  }
}
