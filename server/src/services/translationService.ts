import OpenAI from 'openai';
import { logger } from '../lib/logger.js';

/**
 * The language bridge.
 *
 * A guest writes "sin cebolla, por favor" and the kitchen works in English; the
 * line cook should read "no onion, please" without anyone learning Spanish. The
 * same path serves reception: a request typed in Arabic reaches the front desk
 * in their working language.
 *
 * Two rules shape everything here:
 *
 *  1. The original is never destroyed. Staff can always see what the guest
 *     actually wrote, because a mistranslated allergy note is dangerous.
 *  2. Translation is best-effort. An order must never fail, or be delayed past
 *     usefulness, because a translation provider was slow or unconfigured.
 */

const MODEL = process.env.OPENAI_TRANSLATE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_URL = process.env.OPENAI_BASE_URL;
const TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS) || 4000;

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (BASE_URL) return new OpenAI({ apiKey: key || 'local', baseURL: BASE_URL });
  return key ? new OpenAI({ apiKey: key }) : null;
}

export function translationEnabled(): boolean {
  return !!(process.env.OPENAI_API_KEY || BASE_URL);
}

export interface Translated {
  /** Null when no translation happened — callers fall back to the original. */
  text: string | null;
  /** BCP-47-ish code the model detected, for showing "translated from …". */
  sourceLanguage: string | null;
}

const EMPTY: Translated = { text: null, sourceLanguage: null };

/**
 * Translate a short guest note into the venue's operating language.
 *
 * Returns EMPTY rather than throwing on every failure path: no key, no text,
 * a timeout, a malformed reply. The caller stores null and staff read the
 * original, which is the correct degradation.
 */
export async function translateNote(text: string | null | undefined, targetLanguage: string): Promise<Translated> {
  const note = (text || '').trim();
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
            role: 'system',
            content:
              'You translate short hospitality notes (food orders, allergies, housekeeping and front-desk requests) '
              + `into ${targetLanguage}. Reply with JSON only: {"language":"<ISO code of the INPUT>","text":"<translation>"}. `
              + 'Preserve quantities, dish names and allergy wording exactly; never add, soften or interpret. '
              + 'If the input is already in the target language, return it unchanged with its language code.',
          },
          { role: 'user', content: note },
        ],
        response_format: { type: 'json_object' },
      },
      { timeout: TIMEOUT_MS },
    );

    const raw = resp.choices[0]?.message?.content;
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { language?: unknown; text?: unknown };
    const out = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    const lang = typeof parsed.language === 'string' ? parsed.language.trim() : null;
    if (!out) return EMPTY;
    // Nothing gained by storing a copy of the original.
    if (out === note) return { text: null, sourceLanguage: lang };
    return { text: out, sourceLanguage: lang };
  } catch (err) {
    // Includes the timeout. The order still goes to the kitchen.
    logger.warn({ err }, 'note translation failed; keeping the original');
    return EMPTY;
  }
}
