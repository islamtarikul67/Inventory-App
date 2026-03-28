import React from 'react';
import { Session } from '@supabase/supabase-js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
}

export default function ProfileModal({ isOpen, onClose, session }: Props) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-96">
        <h2 className="text-xl font-bold mb-4">Profile</h2>
        <p className="mb-4">{session?.user?.email}</p>
        <button onClick={onClose} className="w-full bg-slate-200 p-2 rounded">Close</button>
      </div>
    </div>
  );
}
