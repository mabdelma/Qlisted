import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { tableApi } from '../../lib/api';
import type { TableData } from '../../lib/api/types';
import { Grid3X3, Save, ZoomIn, ZoomOut, Table as TableIcon } from 'lucide-react';

const GRID_SIZE = 20;
const TABLE_SIZE = 64;

export function TableLayoutEditor() {
  const { t } = useI18n();
  const { state: { tenant } } = useAuth();
  const slug = tenant?.slug;
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    tableApi.list(slug)
      .then((data) => {
        setTables(data);
        const pos: Record<string, { x: number; y: number }> = {};
        data.forEach((t) => {
          pos[t.id] = { x: t.xPos || 0, y: t.yPos || 0 };
        });
        setPositions(pos);
        const maxX = Math.max(...data.map((t) => (t.xPos || 0) + 120), 800);
        const maxY = Math.max(...data.map((t) => (t.yPos || 0) + 100), 600);
        setCanvasSize({ width: Math.max(800, maxX), height: Math.max(600, maxY) });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    setDragging(tableId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[tableId] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - rect.left - pos.x * zoom,
      y: e.clientY - rect.top - pos.y * zoom,
    });
  }, [positions, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left - dragOffset.x) / zoom;
    const rawY = (e.clientY - rect.top - dragOffset.y) / zoom;
    const x = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
    setPositions((prev) => ({ ...prev, [dragging]: { x: Math.max(0, x), y: Math.max(0, y) } }));
  }, [dragging, dragOffset, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  async function handleSave() {
    if (!slug) return;
    setSaving(true);
    try {
      await Promise.all(
        tables.map((t) => {
          const pos = positions[t.id];
          if (pos && (pos.x !== t.xPos || pos.y !== t.yPos)) {
            return tableApi.update(slug, t.id, { xPos: pos.x, yPos: pos.y });
          }
          return Promise.resolve();
        })
      );
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setSaving(false);
    }
  }

  if (!slug) return null;
  if (loading) return <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">{t('layout.title')}</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white rounded-lg border border-gray-200">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} title={t('layout.zoomOut')}
              className="p-2 text-gray-500 hover:text-gray-700 border-r border-gray-200">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm text-gray-600">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title={t('layout.zoomIn')}
              className="p-2 text-gray-500 hover:text-gray-700 border-l border-gray-200">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#115e59] transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? t('layout.saving') : t('layout.save')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        ref={canvasRef}
        style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div style={{ width: canvasSize.width, height: canvasSize.height, position: 'relative', transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          {/* Grid */}
          <svg className="absolute inset-0 pointer-events-none" width={canvasSize.width} height={canvasSize.height}>
            <defs>
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Tables */}
          {tables.map((table) => {
            const pos = positions[table.id] || { x: 0, y: 0 };
            const isDragging = dragging === table.id;
            return (
              <div key={table.id}
                onMouseDown={(e) => handleMouseDown(e, table.id)}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: TABLE_SIZE,
                  height: TABLE_SIZE,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  zIndex: isDragging ? 10 : 1,
                  transition: isDragging ? 'none' : 'box-shadow 0.2s',
                }}
                className={`rounded-xl border-2 flex items-center justify-center select-none ${
                  table.status === 'available' ? 'border-green-400 bg-green-50 hover:shadow-lg' :
                  table.status === 'occupied' ? 'border-orange-400 bg-orange-50 hover:shadow-lg' :
                  table.status === 'reserved' ? 'border-blue-400 bg-blue-50 hover:shadow-lg' :
                  'border-gray-300 bg-gray-50 hover:shadow-lg'
                } ${isDragging ? 'shadow-xl ring-2 ring-[#0f766e]' : 'shadow-sm'}`}>
                <div className="text-center">
                  <TableIcon className={`w-5 h-5 mx-auto mb-0.5 ${
                    table.status === 'available' ? 'text-green-600' :
                    table.status === 'occupied' ? 'text-orange-600' :
                    table.status === 'reserved' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <span className="text-xs font-bold text-gray-700 block">{table.number}</span>
                  <span className="text-[10px] text-gray-400">({table.capacity})</span>
                </div>
              </div>
            );
          })}

          {tables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Grid3X3 className="w-12 h-12 mx-auto mb-3" />
                <p>{t('layout.noTables')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-400 inline-block" /> {t('layout.legendAvailable')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-50 border border-orange-400 inline-block" /> {t('layout.legendOccupied')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-400 inline-block" /> {t('layout.legendReserved')}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-300 inline-block" /> {t('layout.legendClosed')}</span>
      </div>
    </div>
  );
}
