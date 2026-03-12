import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { InventorySession } from '../types';
import { Calendar, Plus, ChevronDown, Check, Loader2, LayoutGrid, Trash2, X, AlertCircle, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface SessionSelectorProps {
  currentSessionId: string | null;
  onSessionChange: (session: InventorySession) => void;
  dropUp?: boolean;
}

export default function SessionSelector({ currentSessionId, onSessionChange, dropUp = false }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // Carica prima dalla cache se offline o per velocità
      const cached = localStorage.getItem('cached_inventory_sessions');
      if (cached) {
        setSessions(JSON.parse(cached));
      }

      const { data, error } = await supabase
        .from('sessioni_inventario')
        .select('*')
        .order('data_inizio', { ascending: false });

      if (error) throw error;
      
      setSessions(data || []);
      localStorage.setItem('cached_inventory_sessions', JSON.stringify(data || []));
      
      // Se non c'è una sessione selezionata ma ne esistono, seleziona la più recente
      if (!currentSessionId && data && data.length > 0) {
        onSessionChange(data[0]);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('sessioni_inventario')
        .insert([
          { 
            nome: newSessionName.trim(), 
            stato: 'aperta',
            creato_da: user.id
          }
        ])
        .select();

      if (error) throw error;

      toast.success('Nuova sessione creata!');
      setNewSessionName('');
      setIsCreating(false);
      await fetchSessions();
      if (data && data[0]) {
        onSessionChange(data[0]);
      }
    } catch (err: any) {
      toast.error('Errore nella creazione: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      // Prima eliminiamo tutti gli articoli associati a questa sessione
      const { error: itemsError } = await supabase
        .from('inventario')
        .delete()
        .eq('sessione_id', id);

      if (itemsError) throw itemsError;

      // Poi eliminiamo la sessione stessa
      const { error: sessionError } = await supabase
        .from('sessioni_inventario')
        .delete()
        .eq('id', id);

      if (sessionError) throw sessionError;

      toast.success('Sessione e articoli eliminati!');
      
      // Se era la sessione corrente, resettiamo
      if (currentSessionId === id) {
        // Cerchiamo un'altra sessione da selezionare
        const remainingSessions = sessions.filter(s => s.id !== id);
        if (remainingSessions.length > 0) {
          onSessionChange(remainingSessions[0]);
        } else {
          // Reset completo se non ci sono altre sessioni
          localStorage.removeItem('last_inventory_session');
          window.location.reload(); // Forza il reset dello stato globale
        }
      }
      
      setDeletingId(null);
      await fetchSessions();
    } catch (err: any) {
      toast.error('Errore nella cancellazione: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 bg-white shadow-premium border border-slate-100 rounded-xl sm:rounded-2xl transition-all duration-300 group"
      >
        <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg sm:rounded-xl group-hover:bg-indigo-100 transition-colors">
          <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
        </div>
        <div className="flex flex-col items-start min-w-0 sm:min-w-[120px]">
          <span className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sessione Attiva</span>
          <span className="text-xs sm:text-sm font-bold text-slate-700 truncate max-w-[60px] xs:max-w-[100px] sm:max-w-[150px]">
            {currentSession ? currentSession.nome : 'Nessuna'}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: dropUp ? -10 : 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: dropUp ? -10 : 10, scale: 0.95 }}
              className={`absolute right-0 ${dropUp ? 'bottom-full mb-3' : 'mt-3'} w-80 bg-white shadow-2xl shadow-indigo-100 border border-slate-100 rounded-[2rem] z-50 overflow-hidden`}
            >
              <div className="p-5 border-b border-slate-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Gestione Sessioni</h3>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsCreating(!isCreating)}
                    className={`p-1.5 rounded-lg transition-colors ${isCreating ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}
                  >
                    {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {isCreating && (
                    <motion.form 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleCreateSession} 
                      className="space-y-3 overflow-hidden"
                    >
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nome inventario..."
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-xl text-sm font-bold text-slate-700 placeholder:text-slate-300 transition-all outline-none"
                      />
                      <div className="flex gap-2">
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading || !newSessionName.trim()}
                          className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crea Sessione'}
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>

              <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar">
                {sessions.length === 0 ? (
                  <div className="py-10 text-center">
                    <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nessuna sessione trovata</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((session) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group relative"
                      >
                        <button
                          onClick={() => {
                            onSessionChange(session);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-300 ${
                            currentSessionId === session.id 
                              ? 'bg-indigo-50 border border-indigo-100' 
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl transition-colors ${
                              currentSessionId === session.id ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500'
                            }`}>
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                              <div className={`text-sm font-bold transition-colors ${
                                currentSessionId === session.id ? 'text-indigo-700' : 'text-slate-700 group-hover:text-indigo-600'
                              }`}>
                                {session.nome}
                              </div>
                              <div className="text-[10px] font-medium text-slate-400">
                                {new Date(session.data_inizio).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {currentSessionId === session.id && (
                              <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-100">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                            <div className="w-px h-4 bg-slate-100 mx-1" />
                            <motion.div
                              whileHover={{ scale: 1.1, backgroundColor: '#fee2e2', color: '#ef4444' }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); setDeletingId(session.id); }}
                              className="p-2 text-slate-300 hover:text-rose-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.div>
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {deletingId === session.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-3 px-4 z-10 border border-rose-100"
                            >
                              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Eliminare?</span>
                              <div className="flex gap-2">
                                <motion.button 
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => handleDeleteSession(session.id, e)}
                                  className="p-2 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-100"
                                >
                                  <Check className="w-4 h-4" />
                                </motion.button>
                                <motion.button 
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                  className="p-2 bg-slate-100 text-slate-600 rounded-xl"
                                >
                                  <X className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-50/50 border-t border-slate-50">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <AlertCircle className="w-3 h-3" />
                  <span>Seleziona una sessione per iniziare</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
