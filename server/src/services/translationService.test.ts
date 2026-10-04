import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A single mutable handler the fake OpenAI client defers to, so each test can
// decide how the provider behaves.
let completionImpl: () => Promise<unknown>;

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: () => completionImpl() } };
  },
}));

import { translateNote, translationEnabled } from './translationService.js';

const reply = (content: string) => ({ choices: [{ message: { content } }] });

describe('translationService', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    completionImpl = async () => reply(JSON.stringify({ language: 'es', text: 'no onion, please' }));
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
  });

  it('translates a guest note into the venue language', async () => {
    const r = await translateNote('sin cebolla, por favor', 'English');
    expect(r.text).toBe('no onion, please');
    expect(r.sourceLanguage).toBe('es');
  });

  it('stores nothing when the note is already in the venue language', async () => {
    completionImpl = async () => reply(JSON.stringify({ language: 'en', text: 'no onion, please' }));
    const r = await translateNote('no onion, please', 'English');
    // No point keeping a copy of the original.
    expect(r.text).toBeNull();
    expect(r.sourceLanguage).toBe('en');
  });

  it('returns nothing for an empty or whitespace note', async () => {
    expect((await translateNote('   ', 'English')).text).toBeNull();
    expect((await translateNote(null, 'English')).text).toBeNull();
    expect((await translateNote(undefined, 'English')).text).toBeNull();
  });

  // The rest are the ones that matter: an order must survive all of them.
  it('degrades to the original when the provider throws', async () => {
    completionImpl = async () => { throw new Error('upstream 503'); };
    await expect(translateNote('sin cebolla', 'English')).resolves.toEqual({ text: null, sourceLanguage: null });
  });

  it('degrades when the provider times out', async () => {
    completionImpl = async () => { throw Object.assign(new Error('timeout'), { name: 'APIConnectionTimeoutError' }); };
    await expect(translateNote('sin cebolla', 'English')).resolves.toEqual({ text: null, sourceLanguage: null });
  });

  it('degrades when the reply is not valid JSON', async () => {
    completionImpl = async () => reply('sorry, I cannot do that');
    await expect(translateNote('sin cebolla', 'English')).resolves.toEqual({ text: null, sourceLanguage: null });
  });

  it('degrades when the reply is JSON without a usable text field', async () => {
    completionImpl = async () => reply(JSON.stringify({ language: 'es' }));
    expect((await translateNote('sin cebolla', 'English')).text).toBeNull();
  });

  it('is disabled, and silent, with no provider configured', async () => {
    delete process.env.OPENAI_API_KEY;
    expect(translationEnabled()).toBe(false);
    completionImpl = async () => { throw new Error('must not be called'); };
    await expect(translateNote('sin cebolla', 'English')).resolves.toEqual({ text: null, sourceLanguage: null });
  });
});
