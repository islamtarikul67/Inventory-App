import React, { useState } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { ExtractedData } from '../services/ocrService';
import { CheckCircle2, AlertCircle, Loader2, Save, RotateCcw } from 'lucide-react';

interface InventoryFormProps {
  initialData: ExtractedData;
  onReset: () => void;
}

export default function InventoryForm({ initialData, onReset }: InventoryFormProps) {
  const [formData, setFormData] = useState<ExtractedData>({
    ...initialData,
    quantita: initialData.quantita || 1
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    // Validazione base configurazione Supabase
    if (!supabaseUrl || !supabaseAnonKey) {
      setStatus('error');
      setErrorMessage('Supabase non è configurato. Aggiungi VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nelle impostazioni (Secrets) o nel file .env');
      return;
    }

    try {
      // Inserimento dati nella tabella 'inventario'
      const { error } = await supabase
        .from('inventario')
        .insert([
          {
            codice: formData.codice,
            descrizione: formData.descrizione,
            lotto: formData.lotto,
            quantita: formData.quantita,
          }
        ]);

      if (error) throw error;
      
      setStatus('success');
    } catch (err: any) {
      console.error('Errore salvataggio:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Errore durante il salvataggio nel database.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-sm border border-emerald-100 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Salvato con successo!</h3>
        <p className="text-gray-500 mb-8">I dati dell'etichetta sono stati inseriti correttamente nell'inventario.</p>
        <button
          onClick={onReset}
          className="flex items-center justify-center w-full py-3.5 px-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-md"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Scansiona un'altra etichetta
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
      {status === 'saving' && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in duration-200">
          <div className="relative flex items-center justify-center mb-4">
            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white p-3 rounded-full shadow-md border border-indigo-50">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Sincronizzazione...</h3>
          <p className="text-sm text-gray-500 mt-1">Salvataggio su Supabase in corso</p>
        </div>
      )}

      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-lg font-semibold text-gray-900">Verifica Dati Estratti</h2>
        <p className="text-sm text-gray-500 mt-1">Controlla e correggi i dati prima di salvare nel database.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label htmlFor="codice" className="block text-sm font-medium text-gray-700 mb-1.5">
            Codice Prodotto
          </label>
          <input
            type="text"
            id="codice"
            name="codice"
            value={formData.codice}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white"
            placeholder="Es. PRD-12345"
            required
          />
        </div>

        <div>
          <label htmlFor="descrizione" className="block text-sm font-medium text-gray-700 mb-1.5">
            Descrizione
          </label>
          <input
            type="text"
            id="descrizione"
            name="descrizione"
            value={formData.descrizione}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white"
            placeholder="Es. Vite a testa esagonale M8x20"
            required
          />
        </div>

        <div>
          <label htmlFor="lotto" className="block text-sm font-medium text-gray-700 mb-1.5">
            Lotto
          </label>
          <input
            type="text"
            id="lotto"
            name="lotto"
            value={formData.lotto}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white"
            placeholder="Es. L-2023-10-A"
            required
          />
        </div>

        <div>
          <label htmlFor="quantita" className="block text-sm font-medium text-gray-700 mb-1.5">
            Quantità
          </label>
          <input
            type="number"
            id="quantita"
            name="quantita"
            value={formData.quantita}
            onChange={handleChange}
            min="1"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow bg-gray-50 focus:bg-white"
            placeholder="Es. 1"
            required
          />
        </div>

        {status === 'error' && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            disabled={status === 'saving'}
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={status === 'saving'}
            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-70 shadow-sm"
          >
            {status === 'saving' ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Salva
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
