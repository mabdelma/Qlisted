import { useEffect, useState, useRef } from 'react';
import { X, Download } from 'lucide-react';
import QRCode from 'qrcode';
import DOMPurify from 'dompurify';

interface QrCodeModalProps {
  url: string;
  label: string;
  onClose: () => void;
}

export function QrCodeModal({ url, label, onClose }: QrCodeModalProps) {
  const [svg, setSvg] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 2, width: 300 })
      .then(setSvg)
      .catch(() => {});
  }, [url]);

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `qrcode-${label.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function downloadSvg() {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.download = `qrcode-${label.replace(/\s+/g, '-').toLowerCase()}.svg`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}
      role="dialog" aria-modal="true" aria-label={`QR code for ${label}`}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">QR Code — {label}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center bg-white p-4 rounded-lg border">
          {svg ? (
            <div className="flex flex-col items-center gap-2">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg) }} />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-gray-400">Generating...</div>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center break-all">{url}</p>

        <div className="flex gap-3">
          <button onClick={downloadPng}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-[#0f766e] text-white rounded-md hover:bg-[#1e3a5f]">
            <Download className="w-4 h-4 mr-2" /> PNG
          </button>
          <button onClick={downloadSvg}
            className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" /> SVG
          </button>
        </div>
      </div>
    </div>
  );
}
