import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { InventorySession } from '../types';
import { ChevronDown, Plus, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface SessionSelectorProps {
  currentSessionId: string | null;
  onSessionChange: (session: InventorySession | null) => void;
  dropUp?: boolean;
}

export default function SessionSelector({ currentSessionId, onSessionChange, dropUp = false }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessioni_inventario')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
      
      if (currentSessionId) {
        const current = data?.find(s => s.id === currentSessionId);
        if (current) onSessionChange(current);
      }
    } catch (err) {
      console.error('Errore sessioni:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    const nome = prompt('Inserisci un nome per la nuova sessione:');
    if (!nome) return;

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('sessioni_inventario')
        .insert([{ nome, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      setSessions([data, ...sessions]);
      onSessionChange(data);
      setIsOpen(false);
      toast.success('Sessione creata');
    } catch (err: any) {
      toast.error('Errore creazione sessione');
    } finally {
      setIsCreating(false);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
      >
        <div className="flex flex-col items-start text-left">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sessione</span>
          <span className="text-xs font-black text-slate-700 truncate max-w-[120px]">
            {currentSession ? currentSession.nome : 'Seleziona...'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: dropUp ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 10 : -10 }}
            className={`absolute ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden`}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSessionChange(session);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                    session.id === currentSessionId ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-sm font-bold truncate">{session.nome}</span>
                  {session.id === currentSessionId && <Check className="w-4 h-4" />}
                </button>
              ))}
              
              {sessions.length === 0 && !loading && (
                <div className="px-4 py-8 text-center">
                  <p className="text-xs text-slate-400 font-bold">Nessuna sessione trovata</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={createSession}
              disabled={isCreating}
              className="w-full p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nuova Sessione
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
