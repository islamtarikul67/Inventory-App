import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { ExtractedData } from '../services/ocrService';
import { CheckCircle2, AlertCircle, Loader2, Save, RotateCcw, WifiOff, CloudOff, Database, ArrowLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { syncService } from '../services/syncService';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryFormProps {
  initialData: ExtractedData;
  onReset: () => void;
  sessionId: string | null;
}

export default function InventoryForm({ initialData, onReset, sessionId }: InventoryFormProps) {
  const [formData, setFormData] = useState<ExtractedData & { quantitaInput: number | string }>({
    ...initialData,
    quantitaInput: initialData.quantita !== undefined ? initialData.quantita : ''
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error' | 'offline_saved'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const sanitizeInput = (str: string) => {
    return str.trim().replace(/[<>]/g, '');
  };

  const getConfidenceColor = (score?: number) => {
    if (score === undefined) return 'bg-slate-200';
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const ConfidenceIndicator = ({ score }: { score?: number }) => {
    if (score === undefined) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, x: 5 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-slate-50 rounded-full border border-slate-100" 
        title={`Confidenza OCR: ${score}%`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${getConfidenceColor(score)} animate-pulse`}></div>
        <span className="text-[10px] text-slate-400 font-bold tracking-tight">{score}%</span>
      </motion.div>
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'quantita') {
      setFormData(prev => ({ 
        ...prev, 
        quantitaInput: value === '' ? '' : Number(value) 
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value 
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    if (!supabaseUrl || !supabaseAnonKey) {
      setStatus('error');
      setErrorMessage('Supabase non è configurato. Controlla le impostazioni.');
      return;
    }

    try {
      const sanitizedData = {
        codice: sanitizeInput(formData.codice),
        descrizione: sanitizeInput(formData.descrizione),
        lotto: sanitizeInput(formData.lotto),
        quantita: typeof formData.quantitaInput === 'number' ? formData.quantitaInput : 1,
        note: formData.note ? sanitizeInput(formData.note) : null,
        sessione_id: sessionId
      };

      if (!isOnline) {
        syncService.addToQueue(sanitizedData);
        setStatus('offline_saved');
        return;
      }

      // Se siamo online, proviamo il salvataggio diretto
      const { error } = await supabase.from('inventario').insert([sanitizedData]);
      
      if (error) {
        // Se è un errore di rete, salviamo offline
        if (error.message === 'Failed to fetch' || error.message.includes('network') || error.message.includes('timeout')) {
           syncService.addToQueue(sanitizedData);
           setStatus('offline_saved');
           return;
        }
        throw error;
      }
      
      setStatus('success');
    } catch (err: any) {
      console.error('Errore salvataggio:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Errore durante il salvataggio.');
      toast.error('Errore durante il salvataggio.');
    }
  };

  if (status === 'success' || status === 'offline_saved') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-10 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center max-w-md mx-auto"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className={`w-24 h-24 ${status === 'offline_saved' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'} rounded-full flex items-center justify-center mb-8 shadow-inner relative`}
        >
          {status === 'offline_saved' ? (
            <>
              <Database className="w-12 h-12" />
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md border border-amber-100"
              >
                <WifiOff className="w-5 h-5 text-amber-500" />
              </motion.div>
            </>
          ) : (
            <CheckCircle2 className="w-12 h-12" />
          )}
        </motion.div>
        
        <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
          {status === 'offline_saved' ? 'Salvato Offline' : 'Ottimo Lavoro!'}
        </h3>
        
        <p className="text-slate-500 mb-10 leading-relaxed font-medium">
          {status === 'offline_saved' 
            ? 'I dati sono stati salvati localmente e verranno sincronizzati automaticamente appena tornerai online.'
            : 'L\'articolo è stato registrato correttamente nel database centrale.'}
        </p>
        
        <button
          onClick={onReset}
          className="group flex items-center justify-center w-full py-5 px-8 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-sm hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl active:scale-95"
        >
          <RotateCcw className="w-5 h-5 mr-3 group-hover:rotate-180 transition-transform duration-500" />
          Nuova Scansione
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative"
    >
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white px-6 py-3 flex items-center gap-3"
          >
            <CloudOff className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest">Modalità Offline Attiva</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'saving' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center z-20"
          >
            <div className="relative flex items-center justify-center mb-6">
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-indigo-200 rounded-full"
              ></motion.div>
              <div className="relative bg-white p-5 rounded-3xl shadow-xl border border-indigo-50">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Salvataggio...</h3>
            <p className="text-sm font-bold text-slate-400 mt-2 uppercase tracking-widest">Sincronizzazione Cloud</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 sm:p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Verifica Dati</h2>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Conferma informazioni</p>
        </div>
        <button 
          onClick={onReset}
          className="p-2 sm:p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="codice" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              Codice Prodotto
            </label>
            <ConfidenceIndicator score={formData.confidence?.codice} />
          </div>
          <div className="relative">
            <input
              type="text"
              id="codice"
              name="codice"
              value={formData.codice}
              onChange={handleChange}
              className="input-field pr-12"
              placeholder="Es. PRD-12345"
              required
            />
            {formData.codice && (
              <button
                type="button"
                onClick={() => handleChange({ target: { name: 'codice', value: '' } } as any)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-slate-500 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="descrizione" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              Descrizione
            </label>
            <ConfidenceIndicator score={formData.confidence?.descrizione} />
          </div>
          <div className="relative">
            <textarea
              id="descrizione"
              name="descrizione"
              value={formData.descrizione}
              onChange={(e) => handleChange(e as any)}
              className="input-field min-h-[80px] py-3 pr-12 resize-none"
              placeholder="Es. Vite a testa esagonale"
              required
            />
            {formData.descrizione && (
              <button
                type="button"
                onClick={() => handleChange({ target: { name: 'descrizione', value: '' } } as any)}
                className="absolute right-3 top-3 p-2 text-slate-300 hover:text-slate-500 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="lotto" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Lotto
              </label>
              <ConfidenceIndicator score={formData.confidence?.lotto} />
            </div>
            <div className="relative">
              <input
                type="text"
                id="lotto"
                name="lotto"
                value={formData.lotto}
                onChange={handleChange}
                className="input-field pr-12"
                placeholder="Es. 250010"
                required
                title="Inserisci il numero di lotto"
              />
              {formData.lotto && (
                <button
                  type="button"
                  onClick={() => handleChange({ target: { name: 'lotto', value: '' } } as any)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-slate-500 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="quantita" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                Quantità
              </label>
              <ConfidenceIndicator score={formData.confidence?.quantita} />
            </div>
            <input
              type="number"
              id="quantita"
              name="quantita"
              value={formData.quantitaInput}
              onChange={handleChange}
              min="1"
              className="input-field text-center font-black text-xl"
              placeholder="1"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="note" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
            Note (Opzionale)
          </label>
          <div className="relative">
            <textarea
              id="note"
              name="note"
              value={formData.note || ''}
              onChange={(e) => handleChange(e as any)}
              className="input-field min-h-[60px] py-3 pr-12 resize-none"
              placeholder="Aggiungi una nota..."
            />
            {formData.note && (
              <button
                type="button"
                onClick={() => handleChange({ target: { name: 'note', value: '' } } as any)}
                className="absolute right-3 top-3 p-2 text-slate-300 hover:text-slate-500 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {status === 'error' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-start text-xs font-bold border border-rose-100"
            >
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4">
          <button
            type="submit"
            disabled={status === 'saving'}
            className={`group w-full py-5 px-8 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all flex items-center justify-center shadow-xl active:scale-95 ${
              !isOnline 
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {status === 'saving' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {!isOnline ? <Database className="w-5 h-5 mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                {!isOnline ? 'Salva Offline' : 'Conferma e Salva'}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
