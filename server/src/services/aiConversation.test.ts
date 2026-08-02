import { describe, it, expect } from 'vitest';
import { classifyIntent, evaluateDone, suggestNextStep, loadConversation, saveConversation } from './aiConversation.js';

describe('aiConversation', () => {
  describe('classifyIntent', () => {
    it('detects order-building intent', () => {
      expect(classifyIntent('I want the chicken burger')).toBe('build_order');
      expect(classifyIntent('Can I get two margaritas?')).toBe('build_order');
      expect(classifyIntent("I'll have the steak")).toBe('build_order');
    });

    it('detects order tracking', () => {
      expect(classifyIntent("Where's my order?")).toBe('track_order');
      expect(classifyIntent('Is my food ready yet?')).toBe('track_order');
      expect(classifyIntent('Track my order')).toBe('track_order');
    });

    it('detects recommendations', () => {
      expect(classifyIntent('What do you recommend?')).toBe('recommend');
      expect(classifyIntent('I feel like something spicy')).toBe('recommend');
    });

    it('falls back to general', () => {
      expect(classifyIntent('Hi, good evening')).toBe('general');
    });
  });

  describe('evaluateDone', () => {
    it('closes the order when the guest confirms checkout', () => {
      expect(evaluateDone('build_order', "that's it, checkout please")).toBe(true);
      expect(evaluateDone('build_order', 'Done')).toBe(true);
      expect(evaluateDone('build_order', 'Can you add a dessert?')).toBe(false);
    });

    it('treats non-order tasks as complete after a reply', () => {
      expect(evaluateDone('recommend', 'what should I eat')).toBe(true);
      expect(evaluateDone('track_order', "where's my order")).toBe(true);
      expect(evaluateDone('general', 'hello')).toBe(true);
    });
  });

  describe('suggestNextStep', () => {
    it('offers review/checkout while building an order', () => {
      expect(suggestNextStep('build_order', false)).toBe('review_cart');
      expect(suggestNextStep('build_order', true)).toBe('checkout');
    });
    it('offers to order after a recommendation', () => {
      expect(suggestNextStep('recommend', true)).toBe('order_now');
    });
  });

  describe('persistence', () => {
    it('round-trips a conversation through the store and seeds from context', async () => {
      const token = 'test-token';
      const state = await loadConversation(token, {
        cart: [{ menuItemId: 'i1', name: 'Burger', quantity: 2, unitPrice: 9 }],
      });
      expect(state.cart.total).toBe(18);
      expect(state.cart.lines).toHaveLength(1);

      state.messages.push({ role: 'user', content: 'hi' });
      await saveConversation(state);

      const reloaded = await loadConversation(token, {});
      expect(reloaded.cart.lines[0].name).toBe('Burger');
      expect(reloaded.messages).toHaveLength(1);
    });

    it('starts fresh for a new token', async () => {
      const fresh = await loadConversation('brand-new-token', {});
      expect(fresh.cart.lines).toHaveLength(0);
      expect(fresh.done).toBe(false);
    });
  });
});
