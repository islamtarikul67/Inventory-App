import React from 'react';

interface Props {
  onScan: (data: { codice: string, lotto: string }) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h3 className="text-lg font-bold mb-4">Barcode Scanner</h3>
      <button onClick={onClose} className="w-full bg-slate-200 p-2 rounded">Close</button>
    </div>
  );
}
