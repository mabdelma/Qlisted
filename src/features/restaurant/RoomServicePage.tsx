import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { BedDouble, Plus, Minus, Check, ConciergeBell, Loader2 } from 'lucide-react';
import { menuApi, roomServiceApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { MenuCategory, MenuItem } from '../../lib/api/types';

export function RoomServicePage() {
  const { t, locale } = useI18n();
  const { slug, token } = useParams<{ slug: string; token: string }>();

  const [loading, setLoading] = useState(true);
  const [stay, setStay] = useState<{ active: boolean; guestName: string | null; roomNumber: string | null } | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  const tr = (m: MenuItem) => m.translations?.[locale]?.name || m.name;
  const price = (n: number) => n.toFixed(2);

  const load = useCallback(async () => {
    if (!slug || !token) return;
    setLoading(true);
    try {
      const [s, menu] = await Promise.all([roomServiceApi.stay(slug, token), menuApi.getFullMenu(slug)]);
      setStay(s);
      setCategories(menu.categories);
      setItems(menu.items.filter((i) => i.available));
    } catch { setStay({ active: false, guestName: null, roomNumber: null }); }
    finally { setLoading(false); }
  }, [slug, token]);
  useEffect(() => { load(); }, [load]);

  const inc = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id: string) => setCart((c) => { const q = (c[id] || 0) - 1; const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  const cartLines = items.filter((i) => cart[i.id]);
  const count = cartLines.reduce((s, i) => s + cart[i.id], 0);
  const total = cartLines.reduce((s, i) => s + cart[i.id] * i.price, 0);

  async function placeOrder() {
    if (!slug || !token || count === 0) return;
    setPlacing(true);
    try {
      await roomServiceApi.order(slug, token, cartLines.map((i) => ({ menuItemId: i.id, name: i.name, quantity: cart[i.id], unitPrice: i.price })));
      setCart({}); setPlaced(true);
    } catch { /* ignore */ } finally { setPlacing(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-amber-50"><Loader2 className="w-8 h-8 text-[#0f766e] animate-spin" /></div>;

  if (!stay?.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="text-center max-w-sm">
          <BedDouble className="w-12 h-12 text-[#0f766e] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('roomService.title')}</h1>
          <p className="text-gray-600">{t('roomService.noStay')}</p>
        </div>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" /></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('roomService.placed')}</h1>
          <p className="text-gray-600 mb-6">{t('roomService.placedDesc')}</p>
          <button onClick={() => setPlaced(false)} className="px-5 py-2.5 bg-[#0f766e] text-white rounded-lg hover:bg-[#1e3a5f]">{t('roomService.orderMore')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-gradient-to-r from-[#0f766e] to-[#1e3a5f] text-white px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <p className="flex items-center gap-1.5 text-sm text-white/80"><ConciergeBell className="w-4 h-4" /> {t('roomService.title')}</p>
          <h1 className="text-2xl font-bold mt-1">{t('roomService.welcome', { name: stay.guestName || '' })}</h1>
          <p className="text-sm text-white/80 mt-1">{t('roomService.subtitle', { room: stay.roomNumber || '' })}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {categories.filter((c) => items.some((i) => i.categoryId === c.id)).map((cat) => (
          <section key={cat.id}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{cat.translations?.[locale]?.name || cat.name}</h2>
            <div className="space-y-2">
              {items.filter((i) => i.categoryId === cat.id).map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{tr(item)}</p>
                    {item.description && <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>}
                    <p className="text-sm font-semibold text-[#0f766e] mt-0.5">{price(item.price)}</p>
                  </div>
                  {cart[item.id] ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => dec(item.id)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"><Minus className="w-4 h-4" /></button>
                      <span className="w-5 text-center font-semibold">{cart[item.id]}</span>
                      <button onClick={() => inc(item.id)} className="w-8 h-8 rounded-full bg-[#0f766e] text-white flex items-center justify-center hover:bg-[#1e3a5f]"><Plus className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => inc(item.id)} className="w-9 h-9 rounded-full bg-[#0f766e] text-white flex items-center justify-center hover:bg-[#1e3a5f] shrink-0"><Plus className="w-5 h-5" /></button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 p-4">
          <div className="max-w-2xl mx-auto">
            <button onClick={placeOrder} disabled={placing}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-[#0f766e] text-white rounded-xl shadow-lg hover:bg-[#1e3a5f] disabled:opacity-60">
              <span className="font-medium">{placing ? `${t('common.loading')}...` : `${t('roomService.addToRoom')} · ${count}`}</span>
              <span className="font-bold">{price(total)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
