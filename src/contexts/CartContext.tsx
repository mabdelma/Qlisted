import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { MenuItem, ModifierSelection } from '../lib/api/types';

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  comment?: string;
  selectedModifiers?: ModifierSelection[];
}

function modifiersPriceAdjustment(modifiers?: ModifierSelection[]): number {
  return (modifiers ?? []).reduce((sum, m) => sum + m.priceAdjustment, 0);
}

function itemTotal(item: CartItem): number {
  return (item.menuItem.price + modifiersPriceAdjustment(item.selectedModifiers)) * item.quantity;
}

interface CartState {
  items: CartItem[];
  total: number;
  tableId?: string;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: MenuItem; quantity: number; comment?: string; selectedModifiers?: ModifierSelection[]; tableId?: string }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'SET_COMMENT'; payload: { id: string; comment: string } }
  | { type: 'CLEAR_CART' };

export const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
} | null>(null);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      if (!action.payload.available) return state;

      const modifiersKey = JSON.stringify(action.selectedModifiers ?? []);
      const existingItem = state.items.find(item =>
        item.menuItem.id === action.payload.id &&
        JSON.stringify(item.selectedModifiers ?? []) === modifiersKey
      );
      const quantity = action.quantity || 1;
      const unitPrice = action.payload.price + modifiersPriceAdjustment(action.selectedModifiers);

      if (existingItem) {
        return {
          ...state,
          tableId: action.tableId || state.tableId,
          items: state.items.map(item =>
            item.menuItem.id === action.payload.id && JSON.stringify(item.selectedModifiers ?? []) === modifiersKey
              ? { ...item, quantity: item.quantity + quantity, comment: action.comment || item.comment }
              : item
          ),
          total: state.total + (unitPrice * quantity),
        };
      }

      return {
        ...state,
        tableId: action.tableId || state.tableId,
        items: [...state.items, {
          menuItem: action.payload,
          quantity,
          comment: action.comment || undefined,
          selectedModifiers: action.selectedModifiers,
        }],
        total: state.total + (unitPrice * quantity),
      };
    }

    case 'REMOVE_ITEM': {
      const item = state.items.find(item => item.menuItem.id === action.payload);
      if (!item) return state;

      return {
        ...state,
        items: state.items.filter(item => item.menuItem.id !== action.payload),
        total: state.total - itemTotal(item),
      };
    }

    case 'UPDATE_QUANTITY': {
      const item = state.items.find(item => item.menuItem.id === action.payload.id);
      if (!item) return state;

      const quantityDiff = action.payload.quantity - item.quantity;
      const unitPrice = item.menuItem.price + modifiersPriceAdjustment(item.selectedModifiers);

      return {
        ...state,
        items: state.items.map(item =>
          item.menuItem.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
        total: state.total + (unitPrice * quantityDiff),
      };
    }

    case 'SET_COMMENT': {
      return {
        ...state,
        items: state.items.map(item =>
          item.menuItem.id === action.payload.id
            ? { ...item, comment: action.payload.comment || undefined }
            : item
        ),
      };
    }

    case 'CLEAR_CART':
      return { items: [], total: 0 };

    default:
      return state;
  }
}

/**
 * The cart lives in sessionStorage so a guest who reloads the page — or whose
 * phone reloads the tab mid-order — does not silently lose what they added.
 * Scoped by `storageKey` (slug + table) so two tables never share a cart, and
 * sessionStorage rather than localStorage so it ends with the browsing session.
 */
function readStored(key: string): CartState {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { items: [], total: 0 };
    const parsed = JSON.parse(raw) as CartState;
    if (!parsed || !Array.isArray(parsed.items)) return { items: [], total: 0 };
    return parsed;
  } catch {
    return { items: [], total: 0 };
  }
}

export function CartProvider({ children, storageKey = 'cart' }: { children: React.ReactNode; storageKey?: string }) {
  const [state, dispatch] = useReducer(cartReducer, storageKey, readStored);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Private mode or a full quota: the cart still works for this page view.
    }
  }, [state, storageKey]);

  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}