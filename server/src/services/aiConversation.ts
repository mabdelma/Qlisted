import { sessionGet, sessionSet } from './aiSessionStore.js';
import type { CartLine, CustomerContext } from './aiService.js';

// ── Conversation state for the customer assistant ────────────────────────────
// Each guest session (keyed by orderToken) keeps its message history, the cart
// mirror the assistant acts on, and the in-flight conversational "task" so the
// flow (e.g. build an order) can be continued across turns and marked done.

export type AiTaskId = 'build_order' | 'recommend' | 'track_order' | 'general';

export interface AiTask { id: AiTaskId; label?: string }

export interface ConversationState {
  orderToken: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  cart: { lines: CartLine[]; total: number };
  task?: AiTask;
  done: boolean;
  nextStep?: string;
  updatedAt: number;
}

const MAX_STORED_MESSAGES = 60;
const SESSION_TTL_SEC = 60 * 60;

// ── Intent classification (keyword heuristics — fast, no extra LLM call) ────
const RE_TRACK = /where('s| is)? (my )?order|order (status|ready|progress)|track|is (my )?food (ready|coming)|how (long|much longer).*order/i;
const RE_BUILD = /(add|i want|i'?ll have|i'?ll take|i'?ll get|can i (order|get|have)|order|get me|put .* in|craving|one of|two of|three of|how much (is|are))/i;
const RE_RECOMMEND = /(recommend|suggest|what should|what'?s good|feel(?:ing)? like|craving|good.?for|popular)/i;
const RE_FINISH = /(done|that'?s it|that'?s all|finish|checkout|confirm|pay|all set|nothing else|that's it|that is all)/i;

export function classifyIntent(text: string): AiTaskId {
  if (RE_TRACK.test(text)) return 'track_order';
  if (RE_BUILD.test(text)) return 'build_order';
  if (RE_RECOMMEND.test(text)) return 'recommend';
  return 'general';
}

export function evaluateDone(taskId: AiTaskId | undefined, lastUserText: string): boolean {
  if (!taskId || taskId === 'general') return true;
  if (taskId === 'build_order') return RE_FINISH.test(lastUserText);
  return true;
}

// Stable keys the client maps to localized follow-up chips.
export function suggestNextStep(taskId: AiTaskId | undefined, done: boolean): string | undefined {
  if (!taskId) return undefined;
  if (taskId === 'build_order') return done ? 'checkout' : 'review_cart';
  if (taskId === 'recommend') return 'order_now';
  if (taskId === 'track_order') return 'continue_asking';
  return undefined;
}

// ── Persistence ──────────────────────────────────────────────────────────────
export async function loadConversation(orderToken: string, context: CustomerContext): Promise<ConversationState> {
  const existing = await sessionGet<ConversationState>(`ai:convo:${orderToken}`);
  if (existing) {
    existing.updatedAt = Date.now();
    return existing;
  }
  const seeded = (context.cart ?? []).map((l) => ({
    menuItemId: l.menuItemId,
    name: l.name,
    quantity: Math.max(1, Math.min(99, Math.floor(l.quantity) || 1)),
    unitPrice: Number(l.unitPrice) || 0,
    imageUrl: l.imageUrl,
  }));
  const fresh: ConversationState = {
    orderToken,
    messages: [],
    cart: { lines: seeded, total: seeded.reduce((s, l) => s + l.quantity * l.unitPrice, 0) },
    done: false,
    updatedAt: Date.now(),
  };
  await saveConversation(fresh);
  return fresh;
}

export async function saveConversation(state: ConversationState): Promise<void> {
  state.updatedAt = Date.now();
  if (state.messages.length > MAX_STORED_MESSAGES) {
    state.messages = state.messages.slice(state.messages.length - MAX_STORED_MESSAGES);
  }
  await sessionSet(`ai:convo:${state.orderToken}`, state, SESSION_TTL_SEC);
}
