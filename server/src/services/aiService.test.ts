import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../db/index.js';
import { customerChat, adminCopilot } from './aiService.js';
import * as openaiNs from 'openai';

// Scriptable OpenAI mock. Each `chat.completions.create` call resolves from a
// per-test sequence so we can drive the bounded tool loop deterministically.
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
type Turn = { content?: string; tool_calls?: ToolCall[] };

vi.mock('openai', () => {
  const createMock = vi.fn(async () => ({ choices: [{ message: { content: 'ok' } }] }));
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
  }
  return { default: FakeOpenAI, __create: createMock };
});

const create = (openaiNs as unknown as { __create: ReturnType<typeof vi.fn> }).__create;

function mockTurn(turn: Turn) {
  create.mockResolvedValueOnce({ choices: [{ message: turn }] } as never);
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  create.mockClear();
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('customerChat', () => {
  it('returns 501 when no LLM is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'hi' }], {});
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.status).toBe(501);
  });

  it('returns a plain reply when no tool is called and marks the task complete', async () => {
    mockTurn({ content: 'Try the margherita pizza!' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: "what's good here?" }], { orderToken: 'tok-recommend' });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.reply).toContain('pizza');
    expect(result.data.blocks).toHaveLength(0);
    expect(result.data.task?.id).toBe('recommend');
    expect(result.data.done).toBe(true);
    expect(result.data.nextStep).toBe('order_now');
  });

  it('reads the seeded cart via read_cart and emits a cart block', async () => {
    mockTurn({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_cart', arguments: '{}' } }] });
    mockTurn({ content: 'You have 2 Burgers in your order.' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'What is in my cart?' }], {
      orderToken: 'tok-cart',
      cart: [{ menuItemId: 'i1', name: 'Burger', quantity: 2, unitPrice: 9 }],
    });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.cart?.items).toHaveLength(1);
    expect(result.data.cart?.total).toBe(18);
    const cartBlock = result.data.blocks?.find((b) => b.type === 'cart');
    expect(cartBlock && cartBlock.type === 'cart' ? cartBlock.total : -1).toBe(18);
  });

  it('adds an item to the session cart via add_to_cart', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [{ id: 'i1', name: 'Burger', price: 9, imageUrl: null }] } as never);
    mockTurn({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add_to_cart', arguments: JSON.stringify({ item_name: 'Burger', quantity: 2 }) } }] });
    mockTurn({ content: 'Added 2 Burgers.' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'Add two burgers' }], { orderToken: 'tok-add' });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.cart?.items).toHaveLength(1);
    expect(result.data.cart?.items[0].name).toBe('Burger');
    expect(result.data.cart?.total).toBe(18);
  });

  it('rejects adding a non-existent menu item', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as never);
    mockTurn({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add_to_cart', arguments: JSON.stringify({ item_name: 'Unicorn Steak' }) } }] });
    mockTurn({ content: 'Sorry, we do not have that.' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'Add unicorn steak' }], { orderToken: 'tok-miss' });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.cart?.items).toHaveLength(0);
  });

  it('keeps a build_order task open until the guest confirms checkout', async () => {
    mockTurn({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_cart', arguments: '{}' } }] });
    mockTurn({ content: 'You have 1 item so far. Anything else?' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'I want the steak' }], { orderToken: 'tok-flow' });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.task?.id).toBe('build_order');
    expect(result.data.done).toBe(false);
    expect(result.data.nextStep).toBe('review_cart');
  });

  it('marks a build_order task done when the guest says checkout', async () => {
    mockTurn({ content: 'Great choice.' });
    await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: "I'll have the steak" }], { orderToken: 'tok-done' });
    mockTurn({ content: 'That is everything — please check out on screen.' });
    const result = await customerChat('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'checkout' }], { orderToken: 'tok-done' });
    if ('error' in result) throw new Error(result.error);
    expect(result.data.done).toBe(true);
    expect(result.data.nextStep).toBe('checkout');
  });
});

describe('adminCopilot', () => {
  it('passes through a plain reply', async () => {
    mockTurn({ content: 'Sales are up 12% this week.' });
    const result = await adminCopilot('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'How is business?' }]);
    if ('error' in result) throw new Error(result.error);
    expect(result.data.reply).toContain('12%');
  });

  it('runs get_menu through the tool loop', async () => {
    vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] } as never);
    mockTurn({ tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_menu', arguments: '{}' } }] });
    mockTurn({ content: 'Here is the menu.' });
    const result = await adminCopilot('t1', 'Test Cafe', 'USD', [{ role: 'user', content: 'Show the menu' }]);
    if ('error' in result) throw new Error(result.error);
    expect(result.data.reply).toContain('menu');
  });
});
