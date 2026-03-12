import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, AlertCircle, RefreshCw, Database, PackageOpen, Pencil, Trash2, Check, X, AlertTriangle, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryItem {
  id: number;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  created_at: string;
  sessione_id: string | null;
}

interface InventoryListProps {
  sessionId: string | null;
}

export default function InventoryList({ sessionId }: InventoryListProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<InventoryItem>>({});
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [searchTerm, setSearchTerm] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('inventario')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (sessionId) {
        query = query.eq('sessione_id', sessionId);
      } else {
        query = query.is('sessione_id', null);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Errore nel recupero dati:', err);
      setError(err.message || 'Impossibile caricare l\'inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [sessionId]);

  const handleEditClick = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditFormData(item);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSaveEdit = async (id: number) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('inventario')
        .update({
          codice: editFormData.codice,
          descrizione: editFormData.descrizione,
          lotto: editFormData.lotto,
          quantita: editFormData.quantita
        })
        .eq('id', id);

      if (error) throw error;

      setItems(items.map(item => item.id === id ? { ...item, ...editFormData } as InventoryItem : item));
      setEditingId(null);
      toast.success('Articolo modificato!');
    } catch (err: any) {
      console.error('Errore durante la modifica:', err);
      toast.error(err.message || 'Impossibile modificare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId === null) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('inventario')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;

      setItems(items.filter(item => item.id !== deleteConfirmId));
      setDeleteConfirmId(null);
      toast.success('Articolo eliminato!');
    } catch (err: any) {
      console.error('Errore durante l\'eliminazione:', err);
      toast.error(err.message || 'Impossibile eliminare l\'articolo.');
    } finally {
      setActionLoading(false);
    }
  };

  const exportToHTML = () => {
    if (items.length === 0) return;

    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Esportazione Inventario</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    body { 
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
      margin: 0; 
      padding: 0;
      color: #000;
      background: #fff;
    }
    @page { 
      size: A4 portrait; 
      margin: 10mm; 
    }
    .print-container {
      padding: 20px;
    }
    h2 {
      text-align: center;
      margin-bottom: 20px;
      color: #000;
      font-size: 22px;
      text-transform: uppercase;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 20px;
      table-layout: fixed;
    }
    th, td { 
      border: 1px solid #000; 
      padding: 8px 6px; 
      vertical-align: middle;
      line-height: 1.2;
    }
    th { 
      background-color: #f0f0f0; 
      font-weight: bold; 
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      text-align: center;
    }
    
    /* Column Widths */
    th:nth-child(1) { width: 35%; } /* CODICE */
    th:nth-child(2) { width: 20%; } /* LOTTO BARCODE */
    th:nth-child(3) { width: 35%; } /* DESCRIZIONE */
    th:nth-child(4) { width: 10%; } /* QUANTITÀ */
    
    .barcode-cell {
      text-align: center;
      padding: 6px 2px;
    }
    .barcode-svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .desc-cell {
      vertical-align: middle;
      word-wrap: break-word;
      font-size: 9px;
    }
    .qty-cell {
      text-align: right;
      font-weight: bold;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    
    .no-print {
      text-align: center; 
      margin-top: 20px;
      padding: 20px;
    }
    .print-btn {
      padding: 10px 20px; 
      font-size: 16px; 
      cursor: pointer; 
      background: #4f46e5; 
      color: white; 
      border: none; 
      border-radius: 6px;
    }
    
    @media print {
      body { padding: 0; }
      .print-container { padding: 0; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <h2>Distinta Inventario</h2>
    <table>
      <thead>
        <tr>
          <th>Codice</th>
          <th>Lotto Barcode</th>
          <th>Descrizione</th>
          <th>Quantità</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr>
            <td class="barcode-cell">
              <svg class="barcode-svg codice-barcode" data-value="${item.codice}"></svg>
            </td>
            <td class="barcode-cell">
              <svg class="barcode-svg lotto-barcode" data-value="${item.lotto}"></svg>
            </td>
            <td class="desc-cell">${item.descrizione}</td>
            <td class="qty-cell">${item.quantita}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  <div class="no-print">
    <button onclick="window.print()" class="print-btn">Stampa Documento</button>
  </div>
  <script>
    // Generate Codice Barcodes
    document.querySelectorAll('.codice-barcode').forEach(svg => {
      const value = svg.getAttribute('data-value');
      if (value) {
        try {
          JsBarcode(svg, value, {
            format: "CODE39",
            width: 1.2,
            height: 35,
            displayValue: true,
            fontSize: 10,
            margin: 0,
            textMargin: 2
          });
        } catch (e) {
          console.warn("CODE39 failed for", value, "trying CODE128");
          try {
            JsBarcode(svg, value, {
              format: "CODE128",
              width: 1.2,
              height: 35,
              displayValue: true,
              fontSize: 10,
              margin: 0,
              textMargin: 2
            });
          } catch (e2) {
            svg.outerHTML = "<span style='font-size: 10px;'>" + value + "</span>";
          }
        }
      }
    });

    // Generate Lotto Barcodes
    document.querySelectorAll('.lotto-barcode').forEach(svg => {
      const value = svg.getAttribute('data-value');
      if (value) {
        try {
          JsBarcode(svg, value, {
            format: "CODE128",
            width: 1.2,
            height: 30,
            displayValue: true,
            fontSize: 10,
            margin: 0,
            textMargin: 2
          });
        } catch (e) {
          console.error("Error generating lotto barcode for", value, e);
          svg.outerHTML = "<span style='font-size: 10px;'>" + value + "</span>";
        }
      }
    });

    // Auto-print after a short delay to ensure SVGs are rendered
    setTimeout(() => {
      window.print();
    }, 800);
  </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_stampa_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => 
      item.codice.toLowerCase().includes(lowerSearch) ||
      item.descrizione.toLowerCase().includes(lowerSearch) ||
      item.lotto.toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages > 0 && currentPage === 0) {
      setCurrentPage(1);
    }
  }, [filteredItems.length, currentPage, totalPages]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden relative"
    >
      <div className="p-5 sm:p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 sm:gap-3 tracking-tight">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            Inventario
          </h2>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Gestione articoli scansionati</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full pl-10 pr-4 py-2.5 sm:py-3 border-2 border-slate-100 rounded-xl sm:rounded-2xl bg-white font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-0 transition-all text-xs sm:text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={exportToHTML}
              disabled={loading || items.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 bg-white border-2 border-slate-100 rounded-xl sm:rounded-2xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:inline">Esporta / Stampa</span>
            </button>
            <button 
              onClick={fetchInventory}
              disabled={loading || actionLoading}
              className="p-2.5 sm:p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl sm:rounded-2xl transition-all border-2 border-transparent"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mx-8 mt-6 p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-start text-xs font-bold border border-rose-100"
          >
            <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-x-auto">
        <AnimatePresence mode="wait">
          {loading && items.length === 0 ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-20 text-slate-400"
            >
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-6" />
              <p className="font-bold uppercase tracking-widest text-xs">Caricamento dati...</p>
            </motion.div>
          ) : items.length === 0 ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center p-20 text-slate-400"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                <PackageOpen className="w-12 h-12 text-slate-200" />
              </div>
              <p className="text-xl font-black text-slate-900 tracking-tight">Inventario Vuoto</p>
              <p className="text-sm font-medium mt-2">Inizia a scansionare per vedere qui i tuoi articoli.</p>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="hidden md:block px-8 pb-8">
                <table className="w-full text-left border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      <th className="px-6 py-4">Codice</th>
                      <th className="px-6 py-4">Descrizione</th>
                      <th className="px-6 py-4">Lotto</th>
                      <th className="px-6 py-4 text-right">Quantità</th>
                      <th className="px-6 py-4 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {currentItems.map((item) => (
                        <motion.tr 
                          key={item.id} 
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={`group transition-all duration-300 ${editingId === item.id ? 'bg-indigo-50/50' : 'bg-white hover:bg-slate-50/50'}`}
                        >
                          {editingId === item.id ? (
                            <>
                              <td className="px-4 py-3 first:rounded-l-2xl">
                                <input 
                                  type="text" 
                                  name="codice" 
                                  value={editFormData.codice || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-4 py-2 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white shadow-sm"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  name="descrizione" 
                                  value={editFormData.descrizione || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-4 py-2 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white shadow-sm"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  name="lotto" 
                                  value={editFormData.lotto || ''} 
                                  onChange={handleEditChange} 
                                  className="w-full px-4 py-2 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white shadow-sm"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="number" 
                                  name="quantita" 
                                  value={editFormData.quantita || 0} 
                                  onChange={handleEditChange} 
                                  className="w-full px-4 py-2 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white shadow-sm text-right"
                                />
                              </td>
                              <td className="px-4 py-3 last:rounded-r-2xl text-right">
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => handleSaveEdit(item.id)} 
                                    disabled={actionLoading}
                                    className="p-2.5 text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-lg shadow-emerald-100"
                                  >
                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit} 
                                    disabled={actionLoading}
                                    className="p-2.5 text-slate-400 bg-white border-2 border-slate-100 hover:bg-slate-50 rounded-xl transition-all"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-5 first:rounded-l-2xl">
                                <span className="font-black text-slate-900 tracking-tight">{item.codice}</span>
                              </td>
                              <td className="px-6 py-5">
                                <span className="text-sm font-bold text-slate-500">{item.descrizione}</span>
                              </td>
                              <td className="px-6 py-5">
                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200/50">
                                  {item.lotto}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className="text-lg font-black text-indigo-600 tracking-tight">{item.quantita}</span>
                              </td>
                              <td className="px-6 py-5 last:rounded-r-2xl text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                  <button 
                                    onClick={() => handleEditClick(item)} 
                                    className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" 
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteClick(item.id)} 
                                    className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all" 
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col p-4 sm:p-6 gap-4 bg-slate-50/30">
                <AnimatePresence initial={false}>
                  {currentItems.map((item) => (
                    <motion.div 
                      key={item.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`p-5 sm:p-6 rounded-[1.5rem] sm:rounded-3xl border-2 transition-all duration-300 shadow-sm ${editingId === item.id ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                    >
                      {editingId === item.id ? (
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Codice</label>
                            <input 
                              type="text" 
                              name="codice" 
                              value={editFormData.codice || ''} 
                              onChange={handleEditChange} 
                              className="w-full px-4 py-3 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrizione</label>
                            <input 
                              type="text" 
                              name="descrizione" 
                              value={editFormData.descrizione || ''} 
                              onChange={handleEditChange} 
                              className="w-full px-4 py-3 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lotto</label>
                              <input 
                                type="text" 
                                name="lotto" 
                                value={editFormData.lotto || ''} 
                                onChange={handleEditChange} 
                                className="w-full px-4 py-3 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantità</label>
                              <input 
                                type="number" 
                                name="quantita" 
                                value={editFormData.quantita || 0} 
                                onChange={handleEditChange} 
                                className="w-full px-4 py-3 text-sm font-bold border-2 border-indigo-200 rounded-xl focus:ring-0 outline-none bg-white text-right"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-4 border-t border-indigo-100/50 mt-4">
                            <button 
                              onClick={handleCancelEdit} 
                              disabled={actionLoading}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 bg-white border-2 border-slate-100 rounded-xl transition-all"
                            >
                              Annulla
                            </button>
                            <button 
                              onClick={() => handleSaveEdit(item.id)} 
                              disabled={actionLoading}
                              className="px-6 py-3 text-xs font-black uppercase tracking-widest text-white bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-100"
                            >
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-black text-slate-900 text-lg tracking-tight">{item.codice}</div>
                              <div className="text-sm font-bold text-slate-400 mt-1">{item.descrizione}</div>
                            </div>
                            <div className="text-2xl font-black text-indigo-600 tracking-tighter bg-indigo-50 px-3 py-1 rounded-2xl">
                              x{item.quantita}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200/50">
                              Lotto: {item.lotto}
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleEditClick(item)} 
                                className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all" 
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteClick(item.id)} 
                                className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" 
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-6 border-t border-slate-50 bg-slate-50/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden sm:block">
            Pagina <span className="text-slate-900">{currentPage}</span> di <span className="text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-1">
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[36px] h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${
                    currentPage === page 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {deleteConfirmId !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">Sei sicuro?</h3>
                <p className="text-slate-500 mb-10 leading-relaxed font-medium">
                  Questa azione eliminerà definitivamente l'articolo dall'inventario. Non potrai tornare indietro.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={actionLoading}
                    className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-rose-600 transition-all shadow-xl shadow-rose-100 flex items-center justify-center"
                  >
                    {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sì, Elimina'}
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    disabled={actionLoading}
                    className="w-full py-5 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
