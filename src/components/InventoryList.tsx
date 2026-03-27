import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { InventoryItem } from '../types';
import { Loader2, Trash2, Search, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface InventoryListProps {
  sessionId: string | null;
}

export default function InventoryList({ sessionId }: InventoryListProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchItems();
  }, [sessionId]);

  const fetchItems = async () => {
    if (!sessionId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('sessione_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Errore durante il caricamento:', err);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo articolo?')) return;

    try {
      const { error } = await supabase.from('inventario').delete().eq('id', id);
      if (error) throw error;
      setItems(items.filter(item => item.id !== id));
      toast.success('Articolo eliminato');
    } catch (err: any) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(items);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `inventario_${sessionId}.xlsx`);
  };

  const filteredItems = items.filter(item => 
    item.codice.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.descrizione.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lotto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cerca per codice, descrizione o lotto..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-medium"
          />
        </div>
        <button 
          onClick={exportToExcel}
          disabled={items.length === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Esporta Excel
        </button>
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.map(item => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-black text-slate-900">{item.codice}</span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider">Lotto: {item.lotto}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">{item.descrizione}</p>
              </div>
              <div className="flex items-center gap-6 ml-4">
                <div className="text-right">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Quantità</span>
                  <span className="text-lg font-black text-slate-900">{item.quantita}</span>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold">Nessun articolo trovato</p>
          </div>
        )}
      </div>
    </div>
  );
}
