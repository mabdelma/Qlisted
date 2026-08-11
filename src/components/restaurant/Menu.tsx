import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { menuApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import type { MenuItem, MenuCategory } from '../../lib/api/types';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ErrorMessage } from '../ui/ErrorMessage';
import { useNavigate, useParams } from 'react-router';

export function Menu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { slug, tableId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await menuApi.getFullMenu(slug || '');

      const sortedCategories = data.categories.sort((a, b) => a.sortOrder - b.sortOrder);
      const mainCategories = sortedCategories.filter(c => c.type === 'main');
      
      setMenuItems(data.items);
      setCategories(sortedCategories);
      
      // Set initial selections
      if (mainCategories.length > 0) {
        const firstMain = mainCategories[0];
        const firstSub = sortedCategories.find(
          c => c.type === 'sub' && c.parentId === firstMain.id
        );
        
        setSelectedMainCategory(firstMain.id);
        if (firstSub) {
          setSelectedSubCategory(firstSub.id);
        }
      }
      
      setError(null);
    } catch (err) {
      setError(t('error.generic'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  const mainCategories = categories.filter(c => c.type === 'main');
  const subCategories = categories.filter(
    c => c.type === 'sub' && c.parentId === selectedMainCategory
  );

  const filteredItems = menuItems.filter(
    item => item.categoryId === selectedMainCategory &&
           item.subCategoryId === selectedSubCategory &&
           item.available
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-serif text-[#1e3a5f] mb-4">{t('nav.menu')}</h1>
        <p className="text-lg text-[#0f766e] max-w-3xl mx-auto">
          {t('common.notAvailable')}
        </p>
      </div>
      
      {/* Main Categories */}
      <div className="flex justify-center space-x-6 mb-8">
        {mainCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => {
              setSelectedMainCategory(category.id);
              const firstSub = categories.find(
                c => c.type === 'sub' && c.parentId === category.id
              );
              if (firstSub) {
                setSelectedSubCategory(firstSub.id);
              }
            }}
            className={`px-6 py-3 text-lg font-medium rounded-lg transition-colors ${
              selectedMainCategory === category.id
                ? 'bg-[#0f766e] text-white'
                : 'text-[#0f766e] hover:bg-[#ccfbf1]'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
      
      {/* Sub Categories */}
      <div className="flex justify-center space-x-4 mb-12">
        {subCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedSubCategory(category.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedSubCategory === category.id
                ? 'bg-[#ccfbf1] text-[#0f766e]'
                : 'text-gray-600 hover:text-[#0f766e]'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>
      
      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/table/${tableId}/menu/${item.id}`)}
            className={`p-4 rounded-lg border text-left transition-all ${
              item.available 
                ? 'border-gray-200 hover:border-[#0f766e] hover:shadow-md cursor-pointer'
                : 'border-gray-300 bg-gray-50 opacity-50 cursor-not-allowed'
            }`}
            disabled={!item.available}
          >
            <div className="aspect-square mb-2 rounded-md overflow-hidden bg-gray-100">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  width="160"
                  height="160"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  {t('menu.noImage')}
                </div>
              )}
            </div>
            <h3 className="font-medium text-gray-900">{item.name}</h3>
            <p className="text-[#0f766e] font-medium mt-1">
              ${item.price.toFixed(2)}
              {!item.available && (
                <span className="ml-2 text-red-600 text-sm">{t('common.notAvailable')}</span>
              )}
              <ArrowRight className="w-4 h-4 inline-block ml-2" />
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}