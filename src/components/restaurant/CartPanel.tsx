import React, { useState } from 'react';
import { X, Minus, Plus, Trash2, MessageCircle } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useNavigate } from 'react-router';

interface CartPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tableId?: string;
  slug?: string;
}

export const CartPanel = React.memo(function CartPanel({ isOpen, onClose, tableId, slug }: CartPanelProps) {
  const { state, dispatch } = useCart();
  const navigate = useNavigate();
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const handleCheckout = () => {
    if (slug && tableId) {
      navigate(`/r/${slug}/table/${tableId}/checkout`);
    } else if (tableId) {
      navigate(`/table/${tableId}/checkout`);
    } else {
      navigate('/checkout');
    }
    onClose();
  };

  const handleSaveComment = (itemId: string) => {
    dispatch({
      type: 'SET_COMMENT',
      payload: { id: itemId, comment: commentText },
    });
    setEditingComment(null);
    setCommentText('');
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed top-0 right-0 h-full w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Your Order</h2>
            <button 
              onClick={onClose}
              aria-label="Close panel"
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {state.items.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Your cart is empty
              </div>
            ) : (
              state.items.map((item) => (
                <div key={item.menuItem.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-gray-900 font-medium">{item.menuItem.name}</h3>
                      <p className="text-gray-500">${item.menuItem.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              dispatch({
                                type: 'UPDATE_QUANTITY',
                                payload: { id: item.menuItem.id, quantity: item.quantity - 1 }
                              });
                            } else {
                              dispatch({ type: 'REMOVE_ITEM', payload: item.menuItem.id });
                            }
                          }}
                          aria-label="Decrease quantity"
                          className="p-1 hover:bg-[#ccfbf1] rounded text-[#0f766e] transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center text-[#1e3a5f] font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => dispatch({
                            type: 'UPDATE_QUANTITY',
                            payload: { id: item.menuItem.id, quantity: item.quantity + 1 }
                          })}
                          aria-label="Increase quantity"
                          className="p-1 hover:bg-[#ccfbf1] rounded text-[#0f766e] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingComment(item.menuItem.id);
                            setCommentText(item.comment || '');
                          }}
                          aria-label="Add note"
                          className="p-1 text-[#0f766e] hover:bg-[#ccfbf1] rounded transition-colors"
                          title={item.comment || 'Add comment'}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.menuItem.id })}
                          aria-label="Remove item"
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingComment === item.menuItem.id && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add special instructions..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-[#0f766e] focus:border-[#0f766e] text-sm"
                        rows={2}
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => setEditingComment(null)}
                          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveComment(item.menuItem.id)}
                          className="px-3 py-1 text-sm bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {item.comment && editingComment !== item.menuItem.id && (
                    <div className="mt-1 text-sm text-gray-600 italic">
                      "{item.comment}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t p-4 space-y-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span className="text-[#1e3a5f]">Total</span>
              <span className="text-[#0f766e]">${state.total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => dispatch({ type: 'CLEAR_CART' })}
              disabled={state.items.length === 0}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Cart
            </button>
            <button
              onClick={handleCheckout}
              disabled={state.items.length === 0}
              className="w-full bg-[#115e59] text-white py-3 rounded-lg font-medium hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </>
  );
});