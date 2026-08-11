import { useState, useEffect, useCallback } from 'react';
import { Package, Truck, ClipboardList, Plus, Trash2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { inventoryApi, procurementApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { formatPrice } from '../../lib/pricing';
import type { StockItem, Supplier, PurchaseOrder } from '../../lib/api/types';

type Tab = 'stock' | 'suppliers' | 'orders';

export function InventoryManagement() {
  const { t, locale } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const money = (n: number) => formatPrice(n, locale);

  const [tab, setTab] = useState<Tab>('stock');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [newItem, setNewItem] = useState({ name: '', unit: 'units', currentStock: 0, minStock: 0, costPerUnit: 0 });
  const [newSupplier, setNewSupplier] = useState({ name: '', email: '', phone: '' });

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [s, sup, po] = await Promise.all([
        inventoryApi.list(slug),
        procurementApi.listSuppliers(slug).catch(() => []),
        procurementApi.listOrders(slug).catch(() => []),
      ]);
      setStock(s); setSuppliers(sup); setOrders(po); setError('');
    } catch (e) { setError((e as { message?: string }).message || t('error.generic')); }
    finally { setLoading(false); }
  }, [slug, t]);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    if (!slug) return;
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch (e) { setError((e as { message?: string }).message || t('error.generic')); }
    finally { setBusy(false); }
  }

  async function autoReorder() {
    if (!slug) return;
    const suggestions = await procurementApi.suggest(slug);
    if (suggestions.length === 0) { setError(t('analytics.allStocked')); return; }
    await run(() => procurementApi.createOrder(slug, { items: suggestions.map((s) => ({ stockItemId: s.stockItemId, name: s.name, quantity: s.quantity, unitCost: s.unitCost })) }));
  }

  const TABS: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'stock', label: t('inventory.stock'), icon: Package },
    { id: 'suppliers', label: t('inventory.suppliers'), icon: Truck },
    { id: 'orders', label: t('inventory.purchaseOrders'), icon: ClipboardList },
  ];
  const statusColor: Record<string, string> = { ordered: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500', draft: 'bg-yellow-100 text-yellow-700' };

  if (loading) return <div className="p-4 text-gray-500">{t('common.loading')}...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">{t('inventory.title')}</h2>
      {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === id ? 'bg-[#0f766e] text-white' : 'bg-white text-gray-700 border'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Stock ── */}
      {tab === 'stock' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b grid grid-cols-2 md:grid-cols-6 gap-2">
            <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder={t('common.name')} className="col-span-2 rounded-md border-gray-300 text-sm" />
            <input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder={t('inventory.unit')} className="rounded-md border-gray-300 text-sm" />
            <input type="number" value={newItem.currentStock || ''} onChange={(e) => setNewItem({ ...newItem, currentStock: +e.target.value })} placeholder={t('inventory.current')} className="rounded-md border-gray-300 text-sm" />
            <input type="number" value={newItem.minStock || ''} onChange={(e) => setNewItem({ ...newItem, minStock: +e.target.value })} placeholder={t('inventory.min')} className="rounded-md border-gray-300 text-sm" />
            <button disabled={busy || !newItem.name.trim()} onClick={() => run(async () => { await inventoryApi.create(slug!, newItem); setNewItem({ name: '', unit: 'units', currentStock: 0, minStock: 0, costPerUnit: 0 }); })}
              className="flex items-center justify-center gap-1 bg-[#0f766e] text-white rounded-md text-sm hover:bg-[#1e3a5f] disabled:opacity-50"><Plus className="w-4 h-4" /> {t('inventory.addItem')}</button>
          </div>
          {stock.length === 0 ? <p className="p-6 text-center text-gray-500 text-sm">{t('inventory.noStock')}</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-3">{t('common.name')}</th><th className="text-right p-3">{t('inventory.current')}</th><th className="text-right p-3">{t('inventory.min')}</th><th className="text-right p-3">{t('inventory.cost')}</th><th className="p-3"></th>
              </tr></thead>
              <tbody>{stock.map((it) => {
                const low = Number(it.currentStock) <= Number(it.minStock);
                return (
                  <tr key={it.id} className="border-t border-gray-100">
                    <td className="p-3">{it.name} {low && <span className="ml-1 inline-flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="w-3 h-3" />{t('inventory.lowStock')}</span>}</td>
                    <td className="p-3 text-right">
                      <input type="number" defaultValue={it.currentStock} onBlur={(e) => { const v = +e.target.value; if (v !== it.currentStock) run(() => inventoryApi.update(slug!, it.id, { currentStock: v })); }}
                        className="w-20 text-right rounded border-gray-200 text-sm py-1" /> <span className="text-gray-400 text-xs">{it.unit}</span>
                    </td>
                    <td className="p-3 text-right text-gray-500">{it.minStock}</td>
                    <td className="p-3 text-right text-gray-500">{money(Number(it.costPerUnit || 0))}</td>
                    <td className="p-3 text-right"><button onClick={() => run(() => inventoryApi.delete(slug!, it.id))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ── Suppliers ── */}
      {tab === 'suppliers' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b grid grid-cols-2 md:grid-cols-4 gap-2">
            <input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder={t('common.name')} className="rounded-md border-gray-300 text-sm" />
            <input value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder={t('common.email')} className="rounded-md border-gray-300 text-sm" />
            <input value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder={t('common.phone')} className="rounded-md border-gray-300 text-sm" />
            <button disabled={busy || !newSupplier.name.trim()} onClick={() => run(async () => { await procurementApi.createSupplier(slug!, newSupplier); setNewSupplier({ name: '', email: '', phone: '' }); })}
              className="flex items-center justify-center gap-1 bg-[#0f766e] text-white rounded-md text-sm hover:bg-[#1e3a5f] disabled:opacity-50"><Plus className="w-4 h-4" /> {t('inventory.addSupplier')}</button>
          </div>
          {suppliers.length === 0 ? <p className="p-6 text-center text-gray-500 text-sm">{t('inventory.noSuppliers')}</p> : (
            <div className="divide-y">{suppliers.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between">
                <div><span className="font-medium text-gray-800">{s.name}</span> <span className="text-xs text-gray-400 ml-2">{s.email} {s.phone}</span></div>
                <button onClick={() => run(() => procurementApi.deleteSupplier(slug!, s.id))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}</div>
          )}
        </div>
      )}

      {/* ── Purchase Orders ── */}
      {tab === 'orders' && (
        <div className="space-y-3">
          <button onClick={autoReorder} disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg text-sm hover:bg-[#1e3a5f] disabled:opacity-50">
            <RefreshCw className="w-4 h-4" /> {t('inventory.autoReorder')}
          </button>
          {orders.length === 0 ? <p className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">{t('inventory.noPOs')}</p> : orders.map((po) => (
            <div key={po.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">#{po.id.slice(0, 8)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[po.status]}`}>{t(`inventory.${po.status}` as never)}</span>
                  <span className="text-sm font-medium">{money(Number(po.total))}</span>
                </div>
                {po.status === 'ordered' && (
                  <div className="flex gap-2">
                    <button onClick={() => run(() => procurementApi.receiveOrder(slug!, po.id))} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"><Check className="w-3 h-3" /> {t('inventory.receive')}</button>
                    <button onClick={() => run(() => procurementApi.cancelOrder(slug!, po.id))} className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600">{t('common.cancel')}</button>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                {po.items.map((i) => <div key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{money(Number(i.unitCost) * Number(i.quantity))}</span></div>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
