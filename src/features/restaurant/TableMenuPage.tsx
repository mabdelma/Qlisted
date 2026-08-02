import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTableFlow } from './TableFlowLayout';
import { useCart } from '../../contexts/CartContext';
import { useI18n } from '../../contexts/I18nContext';
import { Plus, Check, Search, UtensilsCrossed } from 'lucide-react';
import { formatMoney } from '../../lib/pricing';
import { EmptyState } from '../../components/ui/EmptyState';

export function TableMenuPage() {
  const { t } = useI18n();
  const { tenant, categories, items } = useTableFlow();
  const { dispatch } = useCart();
  const navigate = useNavigate();
  const { slug, tableId } = useParams();
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const mainCats = categories.filter((c) => c.type === 'main');
  const currency = tenant.currency;

  useEffect(() => {
    if (!selectedCat && mainCats.length > 0) {
      setSelectedCat(mainCats[0].id);
    }
  }, [mainCats, selectedCat]);

  const filteredItems = items.filter((i) => {
    const matchesCategory = i.categoryId === selectedCat;
    const matchesSearch = !search
      || i.name.toLowerCase().includes(search.toLowerCase())
      || (i.description && i.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  function handleAdd(e: React.MouseEvent, item: typeof items[0]) {
    e.stopPropagation();
    dispatch({ type: 'ADD_ITEM', payload: item, quantity: 1 });
    setAddingId(item.id);
    window.setTimeout(() => setAddingId(null), 800);
  }

  return (
    <div className="space-y-6">
      {/* Search + category chips — sticky under the app header for easy browsing */}
      <div className="sticky top-16 z-20 -mx-4 bg-gray-50 px-4 pt-2 pb-3 sm:-mx-6 sm:px-6 dark:bg-gray-950">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('menu.search')}
            aria-label={t('menu.search')}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 text-gray-700 placeholder-gray-400 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800"
          />
        </div>

        <div className="mt-3 flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          {mainCats.map((c) => {
            const count = items.filter((i) => i.categoryId === c.id).length;
            const active = selectedCat === c.id;
            return (
              <button key={c.id} onClick={() => setSelectedCat(c.id)}
                aria-pressed={active}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors flex-shrink-0 ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-brand-400 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-800'
                }`}>
                {c.name}
                <span className={`ms-1.5 text-xs ${active ? 'text-white/80' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div key={item.id}
            onClick={() => item.available && navigate(`/r/${slug}/table/${tableId}/menu/${item.id}`)}
            role="button"
            tabIndex={item.available ? 0 : -1}
            onKeyDown={(e) => {
              if (item.available && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                navigate(`/r/${slug}/table/${tableId}/menu/${item.id}`);
              }
            }}
            className={`card p-3 sm:p-4 flex items-center gap-4 transition-all ${
              item.available ? 'cursor-pointer hover:shadow-card-hover' : 'opacity-60'
            }`}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} width="64" height="64" loading="lazy" decoding="async"
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 dark:bg-gray-800">
                <UtensilsCrossed className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
              {item.description && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.description}</p>}
              <p className="text-brand-600 font-bold mt-1 dark:text-brand-400">{formatMoney(item.price, currency)}</p>
            </div>
            {item.available ? (
              <button onClick={(e) => handleAdd(e, item)}
                aria-label={`Add ${item.name} to cart`}
                className="p-2.5 bg-brand-500 text-white rounded-full hover:bg-brand-600 active:scale-95 flex-shrink-0 transition-all"
                disabled={addingId === item.id}>
                {addingId === item.id ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-400 rounded-full text-sm flex-shrink-0 font-medium dark:bg-gray-800">
                {t('menu.soldOut')}
              </span>
            )}
          </div>
        ))}
        {filteredItems.length === 0 && (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title={t('common.noResults')}
            description={t('menu.search')}
          />
        )}
      </div>
    </div>
  );
}
