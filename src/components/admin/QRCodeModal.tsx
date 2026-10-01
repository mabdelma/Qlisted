import { X, Download } from 'lucide-react';
import type { TableData } from '../../lib/api/types';

interface QRCodeModalProps {
  table: TableData;
  onClose: () => void;
}

export function QRCodeModal({ table, onClose }: QRCodeModalProps) {
  const downloadQRCode = async () => {
    try {
      const response = await fetch(table.qrToken);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `table-${table.number}-qr.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download QR code:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Table {table.number} QR Code
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-inner">
            <img
              src={table.qrToken}
              alt={`QR Code for Table ${table.number}`}
              width="256"
              height="256"
              loading="lazy"
              className="w-64 h-64"
            />
          </div>
          
          <p className="text-sm text-gray-500 text-center">
            Scan this QR code to access the menu and place orders for Table {table.number}
          </p>
          
          <button
            onClick={downloadQRCode}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <Download className="w-5 h-5 mr-2" />
            Download QR Code
          </button>
        </div>
      </div>
    </div>
  );
}
