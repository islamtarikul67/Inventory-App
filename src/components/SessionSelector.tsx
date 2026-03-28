import React from 'react';
import { InventorySession } from '../types';

interface Props {
  currentSessionId: string | null;
  onSessionChange: (session: InventorySession | null) => void;
  dropUp?: boolean;
}

export default function SessionSelector({ currentSessionId, onSessionChange, dropUp }: Props) {
  return (
    <div className="relative">
      <button className="px-4 py-2 bg-white border rounded-lg shadow-sm text-sm font-medium text-slate-700">
        {currentSessionId ? `Session: ${currentSessionId}` : 'Select Session'}
      </button>
    </div>
  );
}
